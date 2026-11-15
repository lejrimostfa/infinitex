// Soil states: dust and mud laid over any matter (core/states.js).
// Dust (dusty, dusty_um = mean mote size, about 40 um):
//   L0  dust falls, so faces turned up hold more; it drifts in patches of
//       a few cm and fills the grooves of the matter; a clean disc shows
//       where a vase stood (7 cm), with a soft rim of dust pushed aside
//   L1  grit (8 x mote, 0.3 mm), lint fibres (10 to 20 um thick, mm long)
//       and a few hairs (70 um thick, cm long)
//   L2  the motes: mineral specks, pale skin flakes; dust kills the gloss
// Mud (muddy, muddy_mm = splash spacing, about 30 mm):
//   L0  splashes thrown one way: big blobs and satellite drops, a dark wet
//       halo where the matter drank the water around each blob
//   L1  thick blobs dry from the rim (pale) and crack into plates of
//       2 to 3 mm; some are still wet at heart (dark, glossy)
//   L2  sand grains (0.25 mm, some glinting quartz) in a silt of 30 um
// Grains, fibres and fbm come from the ground family (ground/grains.js).

import { vec2, vec3, float, mix, smoothstep, step, clamp, normalWorld, mod } from 'three/tsl';
import { fadeIn } from './lod.js';
import { valueNoise } from './hash.js';
import { voronoi } from './voronoi.js';
import { grains, fibres, fbm, line } from '../families/ground/grains.js';
import { blobs, over, hero } from './states_shape.js';
import { lay } from './states.js';

const specks = ( p, cellM, fp, share, salt ) => {

	const G = grains( p, cellM, fp, salt, { gap: 0.1, radius: 0.42, round: 0.3, crown: 0.6, elong: 1.4, tilt: 0.6 } );
	return { G, cover: G.body.mul( step( G.id.x, share ) ), w: fadeIn( cellM.mul( 0.5 ), fp, 1.0, 3.0 ) };

};

export function buildDust( nodes, ctx ) {

	const { p, fp, s, cavity } = ctx;
	const g = s.dustM;
	const up = smoothstep( - 0.3, 1.0, normalWorld.y ).mul( 0.9 ).add( 0.45 );
	const drift = smoothstep( 0.25, 0.75, fbm( p.div( 0.06 ).add( s.seed ), 3 ) ).mul( 0.65 ).add( 0.35 )
		.mul( smoothstep( 0.2, 0.6, fbm( p.div( 0.012 ).add( 3.3 ), 2 ) ).mul( 0.4 ).add( 0.6 ) );
	// The vase: a clean disc, dust pushed into a soft ring around it.
	const r = p.sub( vec2( 0.2, 0.1 ) ).length().add( fbm( p.div( 0.004 ), 2 ).sub( 0.5 ).mul( 0.002 ) );
	const clean = smoothstep( 0.0352, 0.0345, r );
	const ring = smoothstep( 0.041, 0.036, r ).mul( clean.oneMinus() );
	const den = s.dusty.mul( drift ).mul( up ).mul( clean.oneMinus() ).mul( ring.mul( 0.8 ).add( 1 ) )
		.add( cavity.mul( 0.35 ).mul( s.dusty ) ).min( 1 ).toVar();

	const M = specks( p, g, fp, den, 3.3 );
	const F = specks( p, g.mul( 3 ), fp, den.mul( 0.5 ), 7.1 );
	const C = specks( p, g.mul( 12 ), fp, den.mul( 0.25 ), 11.9 );
	// Haze: what the unresolved motes add, by their mean cover.
	const grainy = fbm( p.div( g.mul( 3 ) ).add( 2.2 ), 2 ).mul( fadeIn( g.mul( 3 ), fp, 2.0, 6.0 ) ).sub( 0.5 ).mul( 0.8 ).add( 1 );
	const haze = den.mul( 0.6 ).mul( M.w.oneMinus().mul( 0.6 ).add( 0.4 ) ).mul( grainy ).min( 1 );
	const tone = ( G ) => mix( s.dustColor, s.dustColor.mul( vec3( 1.25, 1.22, 1.18 ) ), G.id.y ).mul( G.id.z.mul( 0.6 ).add( 0.6 ) );
	let color = mix( nodes.colorNode, s.dustColor.mul( 0.85 ), haze );
	color = mix( color, tone( M.G ), M.cover.mul( M.w ).mul( 0.8 ) );
	const flake = step( 0.75, F.G.id.y );
	color = mix( color, mix( tone( F.G ), s.dustColor.mul( 1.4 ), flake.mul( 0.7 ) ), F.cover.mul( F.w ).mul( 0.85 ) );
	color = mix( color, tone( C.G ).mul( 0.65 ), C.cover.mul( C.w ) );
	// Lint (thin, curly, some dyed) and hairs.
	const T = fibres( p, g.mul( 40 ), g.mul( 0.35 ), den.mul( 0.6 ), fp, 5.5, 0.6 );
	const wT = fadeIn( g.mul( 0.7 ), fp, 1.0, 3.0 );
	const tCol = mix( s.dustColor.mul( 1.3 ), mix( vec3( 0.12, 0.2, 0.5 ), vec3( 0.5, 0.1, 0.1 ), step( 0.9, T.tone ) ), step( 0.8, T.tone ) );
	color = mix( color, tCol, T.fiber.mul( wT ).mul( 0.85 ) );
	const H = fibres( p, g.mul( 600 ), g.mul( 0.9 ), den.mul( 0.15 ), fp, 9.4, 0.3 );
	color = mix( color, mix( vec3( 0.03, 0.022, 0.016 ), s.dustColor.mul( 0.9 ), step( 0.6, H.tone ) ), H.fiber );
	nodes.colorNode = color;

	const bump = ( S, k ) => S.G.grad.mul( S.cover ).mul( S.w ).mul( k );
	const slope = bump( M, 0.3 ).add( bump( F, 0.4 ) ).add( bump( C, 0.6 ) ).add( T.slope.mul( wT ).mul( 0.6 ) ).add( H.slope.mul( 0.8 ) );
	const any = haze.max( M.cover.mul( M.w ) ).max( F.cover.mul( F.w ) ).max( C.cover.mul( C.w ) ).max( T.fiber.mul( wT ) ).max( H.fiber ).min( 1 );
	return lay( nodes, ctx, { cov: any, rough: float( 0.85 ), slope, hide: float( 0.2 ) } );

}

export function buildMud( nodes, ctx ) {

	const { p, fp, s } = ctx;
	const g = s.mudM;
	const zone = smoothstep( 0.3, 0.7, fbm( p.div( 0.08 ).add( s.seed.mul( 1.7 ) ), 2 ) ).mul( 0.6 ).add( 0.4 );
	const share = s.muddy.mul( zone );
	// Splashes thrown upward and a little sideways; satellites smaller.
	const A = over( blobs( p, fp, g, share.mul( 0.8 ), 2.3, { rMin: 0.12, rMax: 0.55, wobble: 0.45, elong: 1.2, angle: 1.35 } ), hero( p, fp, vec2( 0.158, 0.149 ), 0.007, [ 0.7, 0.8, 0.9 ], 0.5 ) );
	const S = blobs( p, fp, g.mul( 0.22 ), share.mul( 0.7 ), 6.1, { rMin: 0.08, rMax: 0.3, wobble: 0.2, elong: 1.5, angle: 1.35 } );
	const top = step( S.sd, A.sd );
	const sd = A.sd.max( S.sd ).toVar();
	// The edge frays at 0.2 mm: grains and silt left at the splash front.
	const fray = valueNoise( p.div( 1.5e-4 ).add( 3.9 ) ).sub( 0.5 ).mul( 3e-4 );
	const cov = clamp( sd.add( fray ).div( fp ).add( 0.5 ), 0, 1 ).toVar();
	const B = { rho: mix( S.rho, A.rho, top ), id: mix( S.id, A.id, top ), rad: mix( S.rad, A.rad, top ), R: mix( S.R, A.R, top ) };
	// Thickness: thin rim, thicker heart, big blobs thicker.
	const thick = smoothstep( 1.0, 0.35, B.rho ).mul( B.id.z.mul( 0.6 ).add( 0.4 ) ).mul( smoothstep( 0.002, 0.008, B.R ).mul( 0.6 ).add( 0.4 ) ).toVar();
	// Halo: the matter drank the water, 1 to 4 mm around each blob.
	const halo = smoothstep( B.R.mul( - 0.35 ).min( - 0.001 ), float( 0 ), sd ).mul( cov.oneMinus() ).mul( 0.8 );
	nodes.colorNode = nodes.colorNode.mul( mix( float( 1 ), float( 0.55 ), halo ) );
	nodes.roughnessNode = mix( nodes.roughnessNode, nodes.roughnessNode.mul( 0.6 ), halo );

	// Wet at heart for some blobs; dry rims pale.
	const wet = step( B.id.y, 0.45 ).mul( smoothstep( 0.75, 0.2, B.rho ) ).toVar();
	let color = mix( s.mudColor.mul( 1.35 ), s.mudColor, thick ).mul( B.id.x.mul( 0.3 ).add( 0.85 ) );
	color = mix( color, s.mudColor.mul( 0.45 ), wet.mul( 0.8 ) );
	// L1 craquelure of the dry thick crust.
	const wC = fadeIn( g.mul( 0.08 ), fp, 2.0, 6.0 );
	const V = voronoi( mod( p.div( g.mul( 0.08 ) ), 4096 ).add( 4.4 ), 0.85 );
	const dry = thick.mul( wet.oneMinus() ).mul( smoothstep( 0.35, 0.6, thick ) );
	// Cracks open wider where the crust is thicker; each plate its own tone.
	const cw = g.mul( 0.004 ).mul( valueNoise( p.div( g.mul( 0.03 ) ).add( 2.2 ) ).mul( 1.2 ).add( 0.2 ) ).mul( thick );
	const crack = line( V.edge.mul( g.mul( 0.08 ) ), cw, fp ).mul( dry ).mul( wC );
	const plate = valueNoise( V.id1.mul( 0.61 ) ).sub( 0.5 ).mul( 0.25 ).mul( dry ).mul( wC ).add( 1 );
	color = color.mul( plate ).mul( float( 1 ).sub( crack.mul( 0.75 ) ) );
	// L2 sand and silt.
	const Gs = grains( p, float( 2.5e-4 ), fp, 8.8, { gap: 0.25, radius: 0.33, round: 0.3, crown: 0.6, tilt: 0.5 } );
	const sand = Gs.body.mul( step( 0.7, Gs.id.x ) ).mul( fadeIn( float( 2.5e-4 ), fp, 1.5, 4.0 ) );
	const quartz = step( 0.6, Gs.id.y );
	color = mix( color, mix( s.mudColor.mul( 1.6 ), vec3( 0.62, 0.58, 0.52 ), quartz ), sand.mul( 0.8 ) );
	const wS = fadeIn( float( 3e-5 ), fp, 2.0, 6.0 );
	const silt = fbm( p.div( 3e-5 ), 2 ).toVar();
	color = color.mul( silt.sub( 0.5 ).mul( 0.9 ).mul( wS ).add( 1 ) )
		.mul( fbm( p.div( 0.004 ).add( 5.1 ), 2 ).sub( 0.5 ).mul( 0.3 ).add( 1 ) );

	// Relief: a soft dome per blob (0.3 to 1 mm high), plates, grains.
	const k = B.id.z.mul( 0.25 ).add( 0.2 );
	const slope = B.rad.mul( smoothstep( 0.5, 1.0, B.rho ).mul( k ).mul( - 1.5 ) ).mul( fadeIn( B.R, fp, 2.0, 6.0 ) )
		.add( V.dir.mul( smoothstep( 0.1, 0.0, V.edge ) ).mul( 0.35 ).mul( dry ).mul( wC ) )
		.add( Gs.grad.mul( sand ).mul( 0.6 ) )
		.add( vec2( valueNoise( p.div( 3e-5 ).add( 1.3 ) ), valueNoise( p.div( 3e-5 ).add( 6.1 ) ) ).sub( 0.5 ).mul( 0.5 ).mul( wS ) )
		.add( vec2( valueNoise( p.div( 4e-4 ) ), valueNoise( p.div( 4e-4 ).add( 7.7 ) ) ).sub( 0.5 ).mul( 0.3 ).mul( fadeIn( float( 4e-4 ), fp, 2.0, 6.0 ) ) )
		.mul( cov );
	const rough = mix( float( 0.88 ), float( 0.22 ), wet ).sub( sand.mul( quartz ).mul( 0.4 ) );
	return lay( nodes, ctx, { cov, color, rough, slope, hide: thick.mul( 0.6 ).add( 0.4 ) } );

}
