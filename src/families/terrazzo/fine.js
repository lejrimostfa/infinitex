// Terrazzo, the fine levels (levels.js draws L0 and calls these, each in
// its own gate()). stone: 1 on a chip (large or fine), 0 in the cement.
//   L1 grains    sand grains in the cement, calcite grains in the chips
//                (grain_mm); air voids in the cement (pores)
//   L2 crystals  inside each grain: a mosaic of calcite crystals with twin
//                lamellae (stripes) in the chips, silt grains in the cement
//                (fine_um)
//   L3 scratches grinding scratches (polish_um), one direction per patch
//   L3 pits      micro pits (pit_um): plucked crystals on the chips,
//                capillary pores in the cement
// Every level returns what it averages to when faded (its mean), so the far
// view keeps the colour of the near view: tones have zero mean, pits and
// voids hand their measured coverage to means() in levels.js.

import { vec2, float, mix, smoothstep, step, mod, cos, sin } from 'three/tsl';
import { fadeIn, hash3, valueNoise, voronoi } from '../../kit.js';

const PORE_R = 0.2, J1 = 0.6; // void radius and jitter of L1 (cells): a void never crosses its cell
const PIT_R = 0.3, PIT_P = 0.18; // pit radius (cells), share of cells with a pit
export const PIT_COVER = PIT_P * Math.PI * PIT_R * PIT_R; // 0.051: share of the surface in pits
export const VOID_COVER = 0.5 * Math.PI * PORE_R * PORE_R; // voids per unit of `pores`
const LINE_MEAN = 0.0779; // mean of the scratch mask, 2M samples of valueNoise
export const S2F = { grains: 0.002, crystals: 0.0012, scratches: 0.0015, pits: 0.001 };

// L1. cp: the mean void share, what the voids fade to.
export function grains( q1, fp, u, stone, cp ) {

	const V = voronoi( q1, J1 );
	const h = hash3( V.id1.add( u.seed.mul( 3.3 ) ) );
	const w = fadeIn( u.grainM, fp, 1.5, 5.0 );
	const tone = mix( h.x.sub( 0.5 ).mul( 0.4 ), h.x.sub( 0.5 ).mul( 0.26 ), stone ).mul( w ).add( 1 );
	const slope = V.dir.mul( smoothstep( 0.06, 0.0, V.edge ) ).mul( mix( float( 0.05 ), float( 0.015 ), stone ) ).mul( w );
	const aa = fp.div( u.grainM ).mul( 0.75 );
	const pore = smoothstep( aa.add( PORE_R ), float( PORE_R ).sub( aa ), V.toSeed.length() ).mul( step( h.z, u.pores.mul( 0.5 ) ) );
	return { tone, slope, pore: mix( cp, pore, w ) };

}

// L2. Twin lamellae: stripes a quarter of a crystal wide at the crystal's own angle,
// a sine, so their mean is zero.
export function crystals( q2, fp, u, stone ) {

	const V = voronoi( q2, 0.8 );
	const h = hash3( V.id1.add( u.seed.mul( 5.7 ) ) );
	const w = fadeIn( u.fineM, fp, 1.5, 5.0 );
	const a = h.z.mul( Math.PI );
	const t = V.toSeed.x.mul( cos( a ) ).add( V.toSeed.y.mul( sin( a ) ) );
	const wT = fadeIn( u.fineM.mul( 0.25 ), fp, 2.0, 6.0 );
	const twin = sin( t.div( 0.25 ).mul( Math.PI * 2 ) ).mul( wT ).mul( stone ).mul( step( 0.5, h.y ) ); // half the crystals are twinned
	const tone = h.x.sub( 0.5 ).mul( mix( float( 0.34 ), float( 0.3 ), stone ) ).add( twin.mul( 0.1 ) ).mul( w ).add( 1 );
	const slope = V.dir.mul( smoothstep( 0.05, 0.0, V.edge ) ).mul( 0.08 ).add( vec2( cos( a ), sin( a ) ).mul( twin.mul( 0.04 ) ) ).mul( w );
	return { tone, slope };

}

// L3 scratches: patches of 2 cm, one direction each. The tone is the mask
// minus its mean: zero mean at any fade.
export function scratches( p, fp, u, stone ) {

	const P = u.polishM;
	const w = fadeIn( P, fp, 2.0, 6.0 );
	const a = valueNoise( p.div( 0.02 ).add( u.seed.mul( 5.1 ) ) ).mul( Math.PI * 2 );
	const ca = cos( a ), sa = sin( a );
	const r = vec2( p.x.mul( ca ).add( p.y.mul( sa ) ), p.y.mul( ca ).sub( p.x.mul( sa ) ) );
	const q = mod( vec2( r.x.div( P.mul( 40 ) ), r.y.div( P ) ), 4096 );
	const line = smoothstep( 0.72, 0.92, valueNoise( q ) );
	const across = valueNoise( q.add( vec2( 0, 0.5 ) ) ).sub( valueNoise( q.sub( vec2( 0, 0.5 ) ) ) );
	const k = u.scratches.mul( w ).mul( stone.mul( 0.7 ).add( 0.3 ) );
	return { slope: vec2( sa.negate(), ca ).mul( across.mul( line ).mul( k ).mul( 0.12 ) ), tone: line.sub( LINE_MEAN ).mul( k ).mul( 0.4 ) };

}

// L3 pits: a disc in some cells, domed inward, dark. Faded, the pit share
// is its coverage, so the mean darkening stays put.
export function pits( q3, fp, u ) {

	const V = voronoi( q3, 0.7 );
	const h = hash3( V.id1.add( u.seed.mul( 9.1 ) ) );
	const w = fadeIn( u.pitM, fp, 1.5, 5.0 );
	const aa = fp.div( u.pitM ).mul( 0.75 );
	const d = V.toSeed.length();
	const disc = smoothstep( aa.add( PIT_R ), float( PIT_R ).sub( aa ), d ).mul( step( h.x, PIT_P ) );
	return { pit: mix( float( PIT_COVER ), disc, w ).mul( u.pits ), slope: V.toSeed.mul( disc ).mul( 0.6 ).mul( w ).mul( u.pits ) };

}
