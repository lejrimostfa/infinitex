// Seaweed blade and a dusting of pollen.
// Seaweed (a kelp blade):
//   L0 blade    a smooth glossy blade with slow ruffles, olive to golden
//               brown, fine longitudinal lines along the axis (angle), a
//               few darker veins, faint spore patches, a slime clear coat
//   L1 slime    sparse air bubbles caught in the slime (feature_mm and a
//               fifth of it): clear domes with a bright rim
//   L2 cells    cortical cells (cell_um, 15 to 25 um) in rows along the
//               blade, short blocks of cells from one division; brown
//               plastids (2 to 5 um) inside each cell
// Pollen:
//   L0 dusting  pollen fallen on a dark petal: thinning across the face,
//               small heaps (3 to 8 mm) with a halo of stray grains
//   L1 clumps   grains held in clumps (0.2 to 0.5 mm) by their oily coat
//               (pollenkitt), single grains between
//   L2 grains   spheres of cell_um (20 to 50 um), spines every 4 to 5 um
//               (bright tips, spiky outline), two or three pores
// Returns { color, slope, cavity, rough, s2, coat, glow } for shader.js.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, mod, atan, sin } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { rot2, fbm, band, grains, warp2 } from './common.js';

export function buildSeaweed( p, fp, u ) {

	const s = u.seed;
	const a = rot2( p, u.angle ).add( vec2( 0, s.mul( 0.1 ) ) );
	// L0: a smooth blade. Slow ruffles (waves 3 to 6 cm long running
	// along the blade, stronger toward one side), colour drifting from
	// olive to golden brown, fine longitudinal lines (0.5 to 1 mm apart)
	// and a few darker veins; faint spore patches.
	const side = smoothstep( 0.0, 0.3, a.x ).mul( 0.7 ).add( 0.3 );
	const e = float( 2e-4 );
	const wave = ( x ) => fbm( vec2( x.x.mul( 0.5 ), x.y ), float( 0.05 ), fp, 2, 3 ).add( fbm( x, float( 0.12 ), fp, 2, 7 ).mul( 0.5 ) );
	const h0 = wave( a ).toVar();
	const bSlope = rot2( vec2( wave( a.add( vec2( e, 0 ) ) ).sub( h0 ), wave( a.add( vec2( 0, e ) ) ).sub( h0 ) ).div( e ).mul( u.relief.mul( 0.012 ) ).mul( side ), u.angle.negate() );
	const tint = fbm( p.add( s ), float( 0.1 ), fp, 2, 8 );
	let color = mix( u.color, u.color2, smoothstep( 0.3, 0.75, tint ).mul( 0.35 ) ).mul( h0.sub( 0.7 ).mul( 0.12 ).add( 1 ) );
	const lineT = fbm( vec2( a.x.div( 7e-4 ), a.y.div( 0.03 ) ), float( 1 ), fp, 2, 4 );
	const lines = lineT.sub( 0.5 ).mul( fadeIn( float( 7e-4 ), fp, 1.0, 3.0 ) );
	const vein = smoothstep( 0.7, 0.85, valueNoise( vec2( a.x.div( 0.004 ), a.y.div( 0.08 ) ).add( 5.5 ) ) ).mul( fadeIn( float( 0.004 ), fp, 1.0, 3.0 ) );
	const sori = smoothstep( 0.65, 0.8, fbm( p.add( 9.1 ), float( 0.04 ), fp, 2, 6 ) );
	color = color.mul( lines.mul( 0.3 ).add( 1 ) ).mul( float( 1 ).sub( vein.mul( 0.1 ) ) );
	color = mix( color, u.color3, sori.mul( 0.12 ) );

	// L2: cells in rows (computed before the bubbles that lie on them).
	const cw = u.cellM, ch = u.cellM.mul( 1.6 );
	const ar = a.add( warp2( a, cw.mul( 40 ), 4.4 ).mul( cw.mul( 6 ) ) );
	const row = floor( ar.x.div( cw ) );
	const hr = hash3( vec2( wrapCoord( row ), 2.2 ) );
	const along = ar.y.div( ch ).add( hr.x.mul( 7 ) );
	const col = floor( along );
	const hc = hash3( wrapCoord( vec2( row, col ) ).add( 6.6 ) );
	const fx = fract( ar.x.div( cw ) ), fy = fract( along );
	const ex = fx.min( fx.oneMinus() ).mul( cw ), ey = fy.min( fy.oneMinus() ).mul( ch );
	// Every few cells a thicker wall: blocks of cells from one division.
	const block = step( 0.7, hash3( wrapCoord( vec2( row, floor( along.div( 4 ) ) ) ) ).x );
	const wC = fadeIn( cw, fp, 2.0, 6.0 );
	const wall = band( ex.min( ey.mul( block.mul( - 0.5 ).add( 1 ) ) ), cw.mul( 0.07 ).mul( block.mul( 0.6 ).add( 1 ) ), fp ).mul( fadeIn( cw, fp, 2.0, 6.0 ) );
	const plast = smoothstep( 0.6, 0.75, valueNoise( ar.div( cw.mul( 0.22 ) ).add( hc.xy.mul( 30 ) ) ) ).mul( fadeIn( cw.mul( 0.22 ), fp, 1.5, 4.0 ) );
	color = color.mul( hc.z.sub( 0.5 ).mul( 0.45 ).mul( wC ).add( 1 ) ).mul( float( 1 ).sub( wall.mul( 0.65 ) ) );
	color = mix( color, u.color3.mul( vec3( 1.2, 0.9, 0.4 ) ), plast.mul( 0.65 ) );
	const domeC = vec2( fx.sub( 0.5 ), fy.sub( 0.5 ).div( 1.6 ) ).mul( - 0.5 ).mul( wC );

	// L1: bubbles in the slime, two sizes.
	const bub = ( sizeM, share, salt ) => {

		// A sphere cap per cell, radius 0.15 to 0.4 cells.
		const V = voronoi( wrapCoord( p.div( sizeM ) ).add( salt ), 0.8 );
		const h = hash3( V.id1.add( salt ) );
		const R = h.y.mul( 0.25 ).add( 0.15 );
		const t = V.toSeed.div( R );
		const r2 = t.dot( t );
		const on = step( h.x, share );
		const body = clamp( float( 1 ).sub( r2.sqrt() ).mul( R ).mul( sizeM ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
		const z = float( 1 ).sub( r2 ).max( 0.04 ).sqrt();
		const grad = t.div( z ).negate().mul( 0.6 ).mul( body );
		return { body, grad, rim: smoothstep( 0.5, 0.95, r2.sqrt() ).mul( body ), w: fadeIn( sizeM.mul( 0.3 ), fp, 1.0, 3.0 ) };

	};

	const B1 = bub( u.featureM, u.bubbles.mul( 0.08 ), 5.5 );
	const B2 = bub( u.featureM.mul( 0.2 ), u.bubbles.mul( 0.1 ), 8.8 );
	const bubble = B1.body.mul( B1.w ).max( B2.body.mul( B2.w ) );
	const rim = B1.rim.mul( B1.w ).max( B2.rim.mul( B2.w ) );
	// Clear dome: the blade seen through, lighter, bright rim (total reflection).
	color = mix( color, color.mul( 1.25 ), bubble.mul( 0.5 ) );
	color = mix( color, vec3( 0.75, 0.78, 0.72 ), rim.mul( 0.35 ) );

	const slope = bSlope.add( vec2( lines.mul( 0.25 ), 0 ) ).add( rot2( domeC, u.angle.negate() ).mul( 0.4 ) )
		.add( B1.grad.mul( 0.5 ).mul( B1.w ) ).add( B2.grad.mul( 0.5 ).mul( B2.w ) );
	const s2 = wC.oneMinus().mul( 0.01 );
	return {
		color, slope, cavity: vein.mul( 0.2 ), rough: u.roughness, s2,
		coat: float( 0.7 ), coatRough: mix( float( 0.06 ), float( 0.02 ), bubble ), glow: color.mul( 1.3 ),
	};

}

export function buildPollen( p, fp, u ) {

	const g = u.cellM, s = u.seed;
	// L0: the dusting thins across the face (a gradient with a slow
	// wander); small heaps (3 to 8 mm) sit where pollen fell in lumps,
	// each a soft dome with a halo of scattered grains around it.
	const a = rot2( p, u.angle );
	const grad = a.y.div( 0.3 ).add( fbm( p.add( s ), float( 0.12 ), fp, 2, 2 ).sub( 0.5 ).mul( 0.5 ) );
	const Hv = voronoi( wrapCoord( p.div( 0.03 ) ).add( s.mul( 1.3 ) ), 0.7 );
	const hh = hash3( Hv.id1.add( 7.7 ) );
	const hr = hh.y.mul( 0.1 ).add( 0.08 ); // heap radius, cells
	const hd = Hv.toSeed.length().add( valueNoise( Hv.toSeed.mul( 12 ).add( hh.xz.mul( 30 ) ) ).sub( 0.5 ).mul( 0.08 ) ).div( hr );
	const heapOn = step( hh.x, grad.mul( 0.4 ).add( 0.1 ) );
	const heap = float( 1 ).sub( hd.mul( hd ) ).max( 0 ).mul( heapOn ).toVar();
	const halo = smoothstep( 1.8, 1.0, hd ).mul( heapOn );
	const heapSlope = Hv.toSeed.div( hr.mul( hr ) ).mul( - 0.12 ).mul( step( hd, 1 ) ).mul( heapOn ).mul( u.relief );
	// L1: clumps of 0.2 to 0.5 mm held by the oily coat.
	const clump = smoothstep( 0.35, 0.75, fbm( p, g.mul( 6 ), fp, 2, 5 ) );
	const den = smoothstep( 0.0, 1.0, grad ).mul( 0.75 ).add( 0.1 ).add( halo.mul( 0.35 ) ).add( heap ).mul( u.dust ).mul( clump.mul( 0.3 ).add( 0.8 ) ).min( 1 ).toVar();
	// Base: a dark velvety petal with its own cells.
	const bc = voronoi( wrapCoord( p.div( g.mul( 0.9 ) ) ).add( 1.1 ), 0.8 );
	const wBc = fadeIn( g.mul( 0.9 ), fp, 2.0, 6.0 );
	let color = u.color3.mul( fbm( p, float( 0.02 ), fp, 2, 3 ).mul( 0.4 ).add( 0.8 ) )
		.mul( smoothstep( 0.0, 0.25, bc.edge ).mul( 0.3 ).mul( wBc ).add( float( 1 ).sub( wBc.mul( 0.15 ) ) ) );
	let slope = bc.dir.negate().mul( smoothstep( 0.25, 0.0, bc.edge ) ).mul( 0.3 ).mul( wBc );

	// L2: two layers of grains; the upper one only where the drift is thick.
	const wG = fadeIn( g, fp, 1.5, 4.0 );
	let cover = float( 0 );
	for ( let i = 0; i < 2; i ++ ) {

		const G = grains( p.add( vec2( i * 1.7e-5, i * 2.9e-5 ) ), g.mul( 1.15 ), fp, 3.3 + i * 4.1, { gap: 0.02, radius: 0.4, round: 0.42, crown: 1.2, elong: 0.1, jitter: 0.45 } );
		const on = step( G.id.x, den.mul( 1.4 ).sub( i * 0.45 ) );
		// Spines: a dot lattice on the sphere, foreshortened at the rim.
		const t = G.v.toSeed.div( 0.4 );
		const r = t.length();
		const z = float( 1 ).sub( r.mul( r ) ).max( 0.02 ).sqrt();
		const sp = voronoi( wrapCoord( t.div( z.mul( 0.5 ).add( 0.5 ) ).mul( 3.2 ).add( G.id.xy.mul( 40 ) ) ), 0.5 );
		const wS = fadeIn( g.mul( 0.14 ), fp, 2.0, 5.0 );
		const sd = sp.toSeed.length();
		const spike = smoothstep( 0.38, 0.1, sd ).mul( wS );
		const ring = smoothstep( 0.25, 0.4, sd ).mul( smoothstep( 0.55, 0.4, sd ) ).mul( wS );
		// Spiky outline: spines stand out past the rim.
		const fringe = smoothstep( 1.0, 0.9, r ).max( spike.mul( smoothstep( 1.12, 1.0, r ) ) );
		const body = G.body.max( fringe.mul( wS ) ).mul( on ).toVar();
		// Pores: two or three dark discs.
		const pa = atan( t.y, t.x ).add( G.id.y.mul( 6.28 ) );
		const pore = smoothstep( 0.18, 0.1, vec2( fract( pa.mul( 3 / 6.283 ) ).sub( 0.5 ).mul( 2.1 ), r.sub( 0.55 ) ).length() ).mul( step( 0.4, G.id.z ) ).mul( wS );
		const tone = mix( u.color, u.color2, G.id.z.mul( 0.6 ) );
		const shade = sin( z.mul( 1.4 ) ).mul( 0.45 ).add( 0.55 );
		const gc = tone.mul( shade ).mul( spike.mul( 0.6 ).add( 1 ) ).mul( float( 1 ).sub( ring.mul( 0.3 ) ) ).mul( float( 1 ).sub( pore.mul( 0.45 ) ) );
		const lower = i === 0 ? 0.75 : 1.0;
		color = mix( color, gc.mul( lower ), body.mul( wG ) );
		slope = mix( slope, G.grad.mul( 0.35 ).add( sp.toSeed.mul( - 0.8 ).mul( spike ) ), body.mul( wG ) );
		cover = cover.max( body );

	}

	// Far: grains too small to draw tint the base by their share; the
	// heaps are lit like domes and shaded at their foot.
	// Grains about a pixel wide still show as a grainy speckle.
	const speck = valueNoise( wrapCoord( p.div( g ) ).add( 4.4 ) ).sub( 0.5 ).mul( fadeIn( g, fp, 0.5, 1.5 ) ).mul( wG.oneMinus() );
	color = mix( color, u.color.mul( 0.8 ).mul( speck.mul( 0.6 ).add( 1 ) ), wG.oneMinus().mul( den.mul( 0.9 ) ).mul( speck.mul( 0.6 ).add( 1 ) ).min( 1 ) );
	color = color.mul( smoothstep( 0.0, 0.3, heap ).mul( 0.15 ).add( 1 ) ).mul( float( 1 ).sub( smoothstep( 1.0, 1.3, hd ).mul( smoothstep( 2.0, 1.3, hd ) ).mul( heapOn ).mul( 0.2 ) ) );
	slope = slope.add( heapSlope );
	color = color.mul( float( 1 ).sub( wG.oneMinus().mul( clump.oneMinus() ).mul( den ).mul( 0.1 ) ) );
	const rough = mix( u.roughness, float( 0.9 ), cover.mul( wG ).max( wG.oneMinus().mul( den ) ) );
	const s2 = wG.oneMinus().mul( den ).mul( 0.15 );
	const sheen = u.color3.mul( 2 ).mul( u.sheen ).mul( den.oneMinus() );
	return { color, slope, cavity: cover.oneMinus().mul( den ).mul( wG ), rough, s2, sheen };

}
