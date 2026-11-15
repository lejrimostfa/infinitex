// Light on faded slopes. When a level of relief fades out, the far view
// shades a flat normal where the near view had tilted ones. Tilted normals
// see another part of the sky and another angle to the sun, so the far view
// must get the light of the faded normals, not the light of the flat one.
//
// How much a tilted normal loses depends on the light: about 9 % at 30
// degrees in the three.js studio room, under 3 % in a field HDRI whose low
// sun the tilted fibres catch. A constant can only be right for one sky.
// So the light itself is averaged over the faded normals: four taps around
// the shading normal, tilted by the faded slope (sin^2 of the tilt = s2).
// Four symmetric taps are exact for any light that is quadratic in the
// normal, which the cosine-convolved sky nearly is.
//   environment  iblIrradiance *= mean( E(n_k) ) / E(n)
//   direct       diffuse       *= mean( sat(n_k . L) ) / sat(n . L)
//                sheen         *= mean( sat(n_k . L) sheen(n_k) ) / same at n
// s2 = 0 once the relief is resolved: every tap is n and nothing changes.
// Cost: 4 extra irradiance reads, and 4 cosines and 4 sheen lobes per light.
//
// Wraps the material like core/microshadow.js does. The family hands in s2
// as nodes.slopeLight (see knit/shader.js).

import { float, vec3, normalView, normalWorld, tangentView, tangentWorld, positionViewDirection, sheenRoughness } from 'three/tsl';

const MAX_S2 = 0.9;

// Four normals tilted from n by the angle whose sin^2 is s2, around n.
function taps( n, t, s2 ) {

	const s = s2.clamp( 0, MAX_S2 );
	const sinT = s.sqrt(), cosT = float( 1 ).sub( s ).sqrt();
	const tt = t.sub( n.mul( n.dot( t ) ) ).normalize();
	const bb = n.cross( tt );
	return [ tt, tt.negate(), bb, bb.negate() ].map( ( d ) => n.mul( cosT ).add( d.mul( sinT ) ) );

}

// The sheen lobe of three.js (Charlie D, Neubelt V, BRDF_Sheen.js) without
// the sheen colour, for any normal.
function sheenLobe( dotNH, dotNV, dotNL ) {

	const nh = dotNH.clamp( 0, 1 ), nv = dotNV.clamp( 0, 1 );
	const inv = float( 1 ).div( sheenRoughness.pow2() );
	const sin2h = float( 1 ).sub( nh.mul( nh ) ).max( 0.0078125 );
	const D = inv.add( 2 ).mul( sin2h.pow( inv.mul( 0.5 ) ) ).div( 2 * Math.PI );
	const Vis = float( 1 ).div( dotNL.add( nv ).sub( dotNL.mul( nv ) ).mul( 4 ) ).clamp( 0, 1 );
	return D.mul( Vis );

}

export function addSlopeLight( material, s2 ) {

	if ( ! s2 ) return material;

	// Environment: the irradiance of the faded normals.
	const setupEnvironment = material.setupEnvironment.bind( material );
	material.setupEnvironment = ( builder ) => {

		const env = setupEnvironment( builder );
		if ( ! env ) return env;
		const setup = env.setup.bind( env );
		env.setup = ( b ) => {

			setup( b );
			const pm = env._pmremNode ?? env.envNode;
			const irr = ( n ) => pm.context( { getUV: () => n, getTextureLevel: () => float( 1 ) } );
			const k = taps( normalWorld, tangentWorld, s2 );
			const mean = irr( k[ 0 ] ).add( irr( k[ 1 ] ) ).add( irr( k[ 2 ] ) ).add( irr( k[ 3 ] ) ).mul( 0.25 );
			b.context.iblIrradiance.mulAssign( mean.div( irr( normalWorld ).max( vec3( 1e-5 ) ) ) );

		};
		return env;

	};

	// Direct lights. The diffuse part gets the mean cosine of the faded
	// normals. The sheen gets their mean sheen: a fibre tilted towards the
	// light shines much more than a flat one seen from above (3 times in the
	// gate, sun at 40 degrees). The specular lobe is left alone: it already
	// widens with the faded slopes (composeRoughness). The ratios are capped:
	// light that misses the flat normal cannot be created here.
	const setupLightingModel = material.setupLightingModel.bind( material );
	material.setupLightingModel = ( builder ) => {

		const model = setupLightingModel( builder );
		const direct = model.direct.bind( model );
		model.direct = ( args, b ) => {

			const L = args.lightDirection, V = positionViewDirection, H = L.add( V ).normalize();
			const k = taps( normalView, tangentView, s2 );
			const cosL = ( n ) => n.dot( L ).clamp( 0, 1 );
			const mean = k.map( cosL ).reduce( ( a, c ) => a.add( c ) ).mul( 0.25 );
			const flat = cosL( normalView );
			const ratio = mean.div( flat.max( 1e-3 ) ).min( 2 );
			const diffuse = args.reflectedLight.directDiffuse;
			const before = vec3( diffuse ).toVar();
			const sheenOn = model.sheen === true && model.sheenSpecularDirect;
			const sheenBefore = sheenOn ? vec3( model.sheenSpecularDirect ).toVar() : null;
			direct( args, b );
			diffuse.assign( before.add( diffuse.sub( before ).mul( ratio ) ) );
			if ( sheenOn ) {

				const lobe = ( n ) => cosL( n ).mul( sheenLobe( n.dot( H ), n.dot( V ), cosL( n ) ) );
				const meanS = k.map( lobe ).reduce( ( a, c ) => a.add( c ) ).mul( 0.25 );
				const ratioS = meanS.div( lobe( normalView ).max( 1e-4 ) ).min( 8 );
				const acc = model.sheenSpecularDirect;
				acc.assign( sheenBefore.add( acc.sub( sheenBefore ).mul( ratioS ) ) );

			}

		};
		return model;

	};

	return material;

}
