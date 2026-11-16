// Materials of a liquid volume (core/liquidvolume.js).
//   body   the walls and floor of the liquid, seen through the container:
//          three.js transmission (the opaque scene behind, bent by ior),
//          Beer-Lambert absorption over the mean chord 4 V / S of the
//          volume (Cauchy: the mean path of a random line through a
//          convex body). One number: exact on average, not per pixel.
//   cap    the free surface: ripples (families/liquid/waves.js, faded with
//          the footprint and handed to the roughness), the meniscus at the
//          walls (vertex stage, wallDist), absorption over the true depth
//          under each point (a floor map of the cavity) along the
//          refracted ray.
//   glass  a thin container wall: Fresnel reflection, blended, no
//          transmission. three's transmission sees the opaque scene only,
//          so a transmissive glass would hide the liquid behind it.
// U: the uniforms of liquidvolume.js.

import { MeshPhysicalNodeMaterial, DoubleSide, FrontSide } from 'three/webgpu';
import { vec3, float, exp, attribute, positionLocal, positionWorld, cameraPosition, texture, transformNormalToView, mix, normalView, positionViewDirection } from 'three/tsl';
import { footprint, composeRoughness, specularAA } from './lod.js';
import { ixTime } from './clock.js';
import { waveField } from '../families/liquid/waves.js';

const optics = ( m, U ) => {

	m.colorNode = U.tint;
	m.metalnessNode = float( 0 );
	m.iorNode = U.ior;
	m.transmissionNode = U.transmission;
	m.attenuationColorNode = exp( U.absorb.negate() ); // colour left after 1 m
	m.attenuationDistanceNode = float( 1 );
	m.emissiveNode = U.glow;

};

export function liquidBodyMaterial( U ) {

	const m = new MeshPhysicalNodeMaterial( { side: FrontSide } );
	optics( m, U );
	m.roughnessNode = U.roughness;
	m.thicknessNode = U.chord;
	return m;

}

// floor: { map (DataTexture of the cavity floor height, local y), min, size (Vector2 uniforms, local xz) }
export function liquidCapMaterial( U, floor ) {

	const m = new MeshPhysicalNodeMaterial( { side: FrontSide } );
	optics( m, U );
	const d = attribute( 'wallDist', 'float' ), dir = attribute( 'wallDir', 'vec2' );
	// Meniscus: h0 at the wall, decaying over the capillary length lc,
	// exactly 0 at the last ring of the cap (ringMax).
	const e = exp( U.ringMax.div( U.lc ).negate() );
	const prof = exp( d.div( U.lc ).negate() ).sub( e ).div( float( 1 ).sub( e ) ).max( 0 );
	m.positionNode = positionLocal.add( vec3( 0, U.h0.mul( prof ), 0 ) );
	const dhdd = U.h0.div( U.lc ).negate().mul( exp( d.div( U.lc ).negate() ) ).div( float( 1 ).sub( e ) ).mul( d.lessThan( U.ringMax ) );
	// Ripples on the local xz, faded under the pixel (their variance goes to s2).
	const q = positionLocal.xz.toVar();
	const fq = footprint( q ).toVar();
	const wf = waveField( q, fq, { lmax: U.sizeM, lmin: U.featureM, angle: U.angle, steep: U.ripple.mul( 0.14 ), t: ixTime.mul( U.speed ), rate: U.speed, seed: U.seed, count: 8, spreadDeg: 180 } );
	const grad = dir.mul( dhdd ).add( wf.slope );
	const nLocal = vec3( grad.x.negate(), 1, grad.y.negate() ).normalize();
	const n = transformNormalToView( nLocal ).normalize().toVar();
	m.normalNode = n;
	m.roughnessNode = specularAA( composeRoughness( U.roughness, wf.s2 ), n );
	// Depth under this point, along the ray refracted into the liquid.
	const uvF = q.sub( floor.min ).div( floor.size ).clamp( 0, 1 );
	const depth = U.level.sub( texture( floor.map, uvF ).level( 0 ).r ).max( 0 );
	const V = cameraPosition.sub( positionWorld ).normalize();
	const cosI = V.y.abs().max( 0.05 ), sin2T = float( 1 ).sub( cosI.mul( cosI ) ).div( U.ior.mul( U.ior ) );
	m.thicknessNode = depth.div( float( 1 ).sub( sin2T ).sqrt() ).min( U.chord.mul( 4 ) );
	return m;

}

// A thin glass wall: about 4 % reflected face on, most at grazing angles
// (Schlick), the rest let through unbent: thin parallel faces barely
// shift a ray. Blended, so whatever is behind it (the liquid) shows.
export function thinGlassMaterial( { color = 0xffffff, roughness = 0.04, opacity = 0.06 } = {} ) {

	const m = new MeshPhysicalNodeMaterial( { color, roughness, metalness: 0, transparent: true, depthWrite: false, side: DoubleSide } );
	const cosV = normalView.dot( positionViewDirection ).abs();
	m.opacityNode = mix( float( opacity ), float( 0.85 ), float( 1 ).sub( cosV ).pow( 5 ) );
	m.ior = 1.52;
	return m;

}
