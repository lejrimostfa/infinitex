// Bread: the crust and the crumb.
// Crust:
//   L0 loaf     Maillard browning drifts from gold to dark brown; a score
//               where the crust tore open (pale, ragged); a crackle net
//               (cells of 6 to 10 mm) from cooling; patches of flour
//   L1 blisters bubbles of size_mm (1 to 4 mm) under a thin skin: darker
//               on their tops, glossy; fine cracks with dark depths
//   L2 starch   flour grains (30 to 100 um) on the dusted parts, pores of
//               0.1 to 0.3 mm, gelatinised starch granules (cell_um)
// Crumb:
//   L0 cells    open, irregular air cells of three sizes around size_mm,
//               stretched along the rise (angle), deep and shadowed
//   L1 walls    thin walls between cells catch the light at their rims;
//               smaller cells open in the walls and at the back of holes
//   L2 starch   swollen starch granules (cell_um, 15 to 30 um) in a
//               glossy gluten film, pinholes
// Returns { color, slope, cavity, rough, s2 } for shader.js.
//
// Crust: the blisters, the crazed skin, the tear relief and the L2 grains
// and cells sit in gate()s (core/lod.js) and run only where they show.

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod, sin } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { rot2, cells, fbm, band, packed, grains, ridged } from './common.js';

export function buildCrust( p, fp, u ) {

	const g = u.sizeM, s = u.seed;
	// L0: browning, score, crackle, flour patches.
	const brown = fbm( p.add( s ), float( 0.07 ), fp, 4, 2 );
	const a = rot2( p, u.angle ).toVar();
	const scoreD = a.y.sub( 0.15 ).sub( sin( a.x.mul( 9 ) ).mul( 0.012 ) ).sub( fbm( a, float( 0.02 ), fp, 2, 5 ).sub( 0.5 ).mul( 0.02 ) );
	const score = smoothstep( 0.014, 0.006, scoreD.abs() ).toVar();
	// The tear shows only in the score, once its widest octave spans
	// 1.5 px (ridged() is 0 and flat below). tearTint multiplies the colour.
	const tear = gate( score.greaterThan( 0 ).and( fadeOn( float( 0.006 ), fp, 1.5 ) ), { tint: { node: float( 0.7 ).mul( score ).add( score.oneMinus() ), size: 1 }, slope: [ 0, 0 ] }, () => {

		const R = ridged( a.mul( vec2( 1, 3 ) ), float( 0.006 ), fp, 3, 4.4 );
		return { tint: R.h.mul( 0.5 ).add( 0.7 ).mul( score ).add( score.oneMinus() ), slope: R.slope.mul( 0.004 ).mul( score ) };

	}, [ a, fp, score ] );
	const Ck = voronoi( p.div( 0.009 ).add( s.mul( 2 ) ), 0.9 );
	const crack = band( Ck.edge.mul( 0.009 ), float( 1.2e-4 ), fp ).mul( fadeIn( float( 0.009 ), fp, 2.0, 6.0 ) ).mul( score.oneMinus() );
	const flour = smoothstep( 0.6, 0.85, fbm( p.add( 4.4 ), float( 0.025 ), fp, 4, 9 ) ).mul( u.dust );

	// L1: blisters, sparse bubbles of two sizes on a crisp, crazed skin.
	// Every blister term is weighted by wB: skipped under 1 px of 0.4 g.
	const B = gate( fadeOn( g.mul( 0.4 ), fp, 1.0 ), { top: 0, rimB: 0, slope: [ 0, 0 ], wB: 0 }, () => {

		const B1 = grains( p, g, fp, 2.7, { gap: 0.1, radius: 0.42, round: 0.5, crown: 0.4, elong: 0.6, sizeVar: 0.8 } );
		const B2 = grains( p.add( vec2( 0.37, 0.71 ).mul( g ) ), g.mul( 0.4 ), fp, 4.9, { gap: 0.1, radius: 0.4, round: 0.5, crown: 0.4, elong: 0.6 } );
		const on1 = step( B1.id.x, u.density.mul( 0.5 ).add( 0.15 ) ).mul( B1.body ), on2 = step( B2.id.x, u.density.mul( 0.6 ).add( 0.2 ) ).mul( B2.body );
		const wB = fadeIn( g.mul( 0.4 ), fp, 1.0, 3.5 );
		const bh = B1.h.mul( on1 ).max( B2.h.mul( on2 ).mul( 0.6 ) );
		return {
			top: smoothstep( 0.3, 0.9, bh ).mul( wB ),
			rimB: smoothstep( 0.0, 0.25, bh ).mul( smoothstep( 0.6, 0.25, bh ) ).mul( wB ),
			slope: B1.grad.mul( on1 ).add( B2.grad.mul( on2 ).mul( 0.6 ) ).mul( u.relief.mul( 0.6 ) ).mul( wB ), wB,
		};

	}, [ p, fp ] );
	const wB = B.wB, top = B.top;
	// Crazed skin: ridged() is 0 and flat once its widest octave is under
	// 1.5 px.
	const skin = gate( fadeOn( g.mul( 0.6 ), fp, 1.5 ), { h: 0, slope: [ 0, 0 ] }, () => {

		const R = ridged( p, g.mul( 0.6 ), fp, 3, 6.6 );
		return { h: R.h, slope: R.slope };

	}, [ p, fp ] );
	const roast = brown.add( top.mul( 0.3 ) ).add( skin.h.sub( 0.4 ).mul( 0.2 ) ).sub( score.mul( 0.45 ) );
	let color = mix( u.color2, u.color, smoothstep( 0.2, 0.6, roast ) );
	color = mix( color, u.color3, smoothstep( 0.6, 1.0, roast ).mul( 0.85 ) );
	// Blister rims are thin and lighter; the skin between is crazed.
	color = color.mul( B.rimB.mul( 0.12 ).add( 1 ) ).mul( skin.h.mul( 0.25 ).add( 0.85 ) );
	color = color.mul( tear.tint );
	color = mix( color, u.color3.mul( 0.4 ), crack.mul( 0.8 ) );

	// L2: pores, starch granules, flour grains, each skipped under its fade.
	// Micro blisters (0.2 to 0.4 mm) all over the skin.
	const M = gate( fadeOn( g.mul( 0.14 ), fp, 1.5 ), { tint: 1, slope: [ 0, 0 ] }, () => {

		const G = grains( p, g.mul( 0.14 ), fp, 12.2, { gap: 0.06, radius: 0.4, round: 0.5, crown: 0.6, elong: 0.5, sizeVar: 0.6 } );
		const onM = step( G.id.x, float( 0.55 ) ).mul( G.body ).mul( fadeIn( g.mul( 0.14 ), fp, 1.5, 4.0 ) );
		return { tint: smoothstep( 0.0, 0.8, G.h ).mul( 0.18 ).mul( onM ).add( 1 ), slope: G.grad.mul( 0.35 ).mul( onM ).mul( u.relief ) };

	}, [ p, fp ] );
	color = color.mul( M.tint );
	const { pore, poreSlope } = gate( fadeOn( g.mul( 0.04 ), fp, 2.0 ), { pore: 0, poreSlope: [ 0, 0 ] }, () => {

		const G = grains( p, g.mul( 0.12 ), fp, 8.8, { gap: 0.05, radius: 0.25, round: 0.3 } );
		const pore = step( 0.75, G.id.x ).mul( G.body ).mul( fadeIn( g.mul( 0.04 ), fp, 2.0, 5.0 ) );
		return { pore, poreSlope: G.grad.mul( - 0.4 ).mul( pore ) };

	}, [ p, fp ] );
	color = color.mul( float( 1 ).sub( pore.mul( 0.55 ) ) );
	// Starch cells: cells() gives s2 = 0.05 once under 2 px.
	const S = gate( fadeOn( u.cellM, fp, 2.0 ), { tint: 1, slope: [ 0, 0 ], s2: 0.05 }, () => {

		const C = cells( p, u.cellM, fp, 3.9, { jitter: 0.9, crown: 0.5 } );
		return { tint: C.id.y.sub( 0.5 ).mul( 0.2 ).mul( C.w ).add( 1 ).mul( float( 1 ).sub( C.wall.mul( 0.15 ) ) ), slope: C.slope, s2: C.s2 };

	}, [ p, fp ] );
	color = color.mul( S.tint );
	const flour1 = flour.toVar();
	const Fl = gate( fadeOn( u.cellM.mul( 2.5 ), fp, 1.5 ), { fl: { node: flour1.min( 1 ), size: 1 }, tone: 0.9, slope: [ 0, 0 ] }, () => {

		const P = packed( p, u.cellM.mul( 2.5 ), fp, 5.1, { gap: 0.1, round: 0.4, crown: 0.6, sizeVar: 1, tilt: 0.4 } );
		const wF = fadeIn( u.cellM.mul( 2.5 ), fp, 1.5, 4.0 );
		const fl = flour1.mul( mix( float( 1 ), P.body.mul( 1.1 ), wF ) ).min( 1 );
		return { fl, tone: P.id.z.mul( 0.15 ).mul( wF ).add( 0.9 ), slope: P.grad.mul( 0.4 ).mul( fl ).mul( wF ) };

	}, [ p, fp, flour1 ] );
	const fl = Fl.fl;
	color = mix( color, vec3( 0.86, 0.84, 0.8 ).mul( Fl.tone ), fl.mul( 0.9 ) );

	const amp = u.relief.mul( 0.6 );
	const slope = B.slope.add( skin.slope.mul( g.mul( 0.04 ) ).mul( u.relief ) ).add( tear.slope )
		.add( Ck.dir.mul( smoothstep( 0.08, 0.0, Ck.edge ) ).mul( 0.3 ).mul( crack.max( 0.0001 ).sign() ).mul( score.oneMinus() ) )
		.add( poreSlope ).add( M.slope ).add( S.slope.mul( 0.15 ) ).add( Fl.slope );
	// Blister tops have a glossy skin; flour and tears are matte.
	const rough = mix( u.roughness, u.roughness.sub( 0.15 ), top ).add( fl.mul( 0.3 ) ).add( score.mul( 0.15 ) ).min( 1 );
	const s2 = wB.oneMinus().mul( 0.06 ).mul( amp ).add( S.s2.mul( 0.1 ) );
	const cavity = skin.h.oneMinus().mul( 0.3 ).max( crack ).max( pore );
	return { color, slope, cavity, rough, s2 };

}

// One layer of air cells cut open: a round bowl in most Voronoi cells
// (radius 0.3 to 0.48 cells, outline wobbling), the walls between them
// left standing. Inside a bowl the depth grows toward the centre, the rim
// is sharp and catches the light. Coordinates stretched along the rise.
function foam( p, cellM, fp, salt, share ) {

	const V = voronoi( wrapCoord( p.div( cellM ) ).add( salt ), 0.95 );
	const k = hash3( V.id1.add( salt * 2.3 ) );
	const t = V.toSeed;
	const R = k.y.mul( 0.18 ).add( 0.3 );
	const wob = valueNoise( t.mul( 4 ).add( k.xz.mul( 50 ) ) ).sub( 0.5 ).mul( 0.25 ).add( 1 );
	const rr = t.length().mul( wob ).div( R );
	const on = step( k.x, share );
	const w = fadeIn( cellM, fp, 1.5, 4.0 );
	const inside = clamp( float( 1 ).sub( rr ).mul( R ).mul( cellM ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
	const depth = float( 1 ).sub( rr.mul( rr ) ).max( 0 ).sqrt().mul( inside );
	// The bowl wall falls steeply at the rim, flattens at the bottom.
	const slope = t.div( R ).mul( float( 1 ).sub( rr.mul( rr ) ).max( 0.08 ).sqrt().reciprocal() ).mul( 0.35 ).mul( inside );
	const wall = smoothstep( 1.25, 1.0, rr ).mul( on ).mul( inside.oneMinus() );
	return { V, wall, depth, slope, k, w };

}

export function buildCrumb( p, fp, u ) {

	const g = u.sizeM, s = u.seed;
	const a0 = rot2( p, u.angle ).add( s.mul( 0.13 ) );
	const a = vec2( a0.x, a0.y.div( 1.5 ) ).add( fbm( a0, g.mul( 6 ), fp, 2, 3 ).sub( 0.5 ).mul( g.mul( 2 ) ) );
	const tone = fbm( p, float( 0.06 ), fp, 3, 2 ).sub( 0.5 ).mul( u.colorVar ).add( 1 );
	const col = u.color.mul( tone );
	// Three sizes: big (merged) holes, the main cells, small cells.
	const A = foam( a, g, fp, 3.1, u.density.mul( 0.3 ).add( 0.6 ) );
	const Z = foam( a.add( vec2( 0.13, 0.41 ).mul( g ) ), g.mul( 2.6 ), fp, 17.9, u.density.mul( 0.4 ) );
	const big = Z.depth.mul( Z.w );
	const B = foam( a.add( vec2( 0.31, 0.77 ).mul( g ) ), g.mul( 0.4 ), fp, 7.7, float( 0.7 ) );
	const C = foam( a.add( vec2( 0.53, 0.11 ).mul( g ) ), g.mul( 0.13 ), fp, 11.3, float( 0.6 ) );
	// Deep in a main cell, the smaller cells behind it show (darker).
	const inA = A.depth.mul( A.w );
	const occl = float( 1 ).sub( inA.mul( 0.5 ) ).sub( B.depth.mul( B.w ).mul( 0.35 ) ).sub( C.depth.mul( C.w ).mul( 0.2 ) ).max( 0.12 );
	let color = col.mul( occl ).mul( float( 1 ).sub( big.mul( 0.5 ) ) );
	// Wall crests catch the light; a few deep holes go dark.
	color = color.mul( A.wall.mul( 0.1 ).add( B.wall.mul( 0.06 ) ).mul( A.w ).add( 1 ) );
	const hole = step( 0.8, A.k.z ).mul( smoothstep( 0.3, 0.9, A.depth ) ).mul( A.w );
	color = color.mul( float( 1 ).sub( hole.mul( 0.45 ) ) );
	// Far: the mean shadow of cells too small to draw.
	color = color.mul( float( 1 ).sub( A.w.oneMinus().mul( 0.25 ) ) ).mul( float( 1 ).sub( B.w.oneMinus().mul( 0.12 ) ) ).mul( float( 1 ).sub( C.w.oneMinus().mul( 0.07 ) ) );

	// L2: starch granules in the gluten film.
	const S = cells( p, u.cellM, fp, 2.3, { jitter: 0.9, crown: 0.6 } );
	const G = grains( p, u.cellM.mul( 1.3 ), fp, 6.2, { gap: 0.15, radius: 0.35, round: 0.4, crown: 0.7, elong: 0.8, tilt: 0.3 } );
	const wG = fadeIn( u.cellM.mul( 1.3 ), fp, 1.5, 4.0 );
	color = color.mul( float( 1 ).sub( S.wall.mul( 0.15 ) ) ).mul( G.body.mul( 0.1 ).mul( wG ).add( 1 ) ).mul( G.id.x.sub( 0.5 ).mul( 0.12 ).mul( wG ).add( 1 ) );

	const back = ( v ) => rot2( vec2( v.x, v.y.div( 1.5 ) ), u.angle.negate() );
	const slope = back( A.slope.mul( A.w ).add( Z.slope.mul( Z.w ) ).add( B.slope.mul( B.w ).mul( 0.8 ) ).add( C.slope.mul( C.w ).mul( 0.6 ) ) ).mul( u.relief )
		.add( S.slope.mul( 0.2 ) ).add( G.grad.mul( 0.5 ).mul( wG ) );
	// The gluten film is glossy on the walls, dull in the depths.
	const rough = mix( u.roughness.sub( 0.15 ), float( 0.95 ), inA );
	const s2 = A.w.oneMinus().mul( 0.12 ).add( B.w.oneMinus().mul( 0.08 ) ).add( C.w.oneMinus().mul( 0.05 ) ).add( S.s2.mul( 0.2 ) ).mul( u.relief );
	return { color, slope, cavity: inA.max( hole ).max( big ), rough, s2 };

}
