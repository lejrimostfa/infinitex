// Pressed wood products.
//   chips  particle board: flat chips pressed with glue. Coarse chips lie
//          in two directions over a matrix of fine particles; seams of
//          glue, a few voids; inside each chip its own grain and fibres.
//   cork   agglomerated cork: granules of bark glued together, gaps
//          between them, dark lenticels (breathing channels), and inside
//          each granule the honeycomb of cork cells.
// Both return { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, float, floor, fract, mix, smoothstep, step, clamp, sin, mod } from 'three/tsl';
import { fadeIn, pick, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

// A seam where a Voronoi cell ends: 1 on the border, AA by the footprint.
const seam = ( v, cellM, widthM, fp ) => clamp( widthM.sub( v.edge.mul( cellM ) ).div( fp ).add( 0.5 ), 0, 1 );

export function buildChips( p, fp, u ) {

	const c = u.chipM, s = u.seed;
	// Chips are slivers, not polygons: bend the cell borders.
	const pw = p.add( vec2( valueNoise( p.div( c.mul( 0.45 ) ) ), valueNoise( p.div( c.mul( 0.45 ) ).add( 7.7 ) ) ).sub( 0.5 ).mul( c ).mul( 0.7 ) );
	// Two layers of coarse chips, one long along x, one along y; the one
	// with the higher stacking hash lies on top.
	const A = voronoi( vec2( pw.x.div( c.mul( 2.6 ) ), pw.y.div( c ) ).add( s.mul( 3 ) ), 0.9 );
	const Bv = voronoi( vec2( pw.x.div( c ), pw.y.div( c.mul( 2.6 ) ) ).add( s.mul( 5 ).add( 11 ) ), 0.9 );
	const hA = hash3( A.id1.add( 1.1 ) ), hB = hash3( Bv.id1.add( 2.2 ) );
	const aTop = step( hB.x, hA.x );
	const coarse = step( 0.35, hA.x.max( hB.x ) ); // else the fine matrix shows
	const F = voronoi( pw.div( c.mul( 0.3 ) ).add( s.mul( 7 ) ), 0.95 );
	const hF = hash3( F.id1.add( 3.3 ) );
	const hC = pick( aTop, hA, hB );
	const h = pick( coarse, hC, hF ).toVar();
	// Chip tone between the two wood colours, its own grain stripes.
	const along = pick( coarse, pick( aTop, p.y, p.x ), p.x.mul( 0.7 ).add( p.y.mul( 0.7 ) ) );
	const stripes = sin( along.div( c.mul( 0.06 ) ).add( h.y.mul( 40 ) ) ).mul( 0.5 ).add( 0.5 ).mul( fadeIn( c.mul( 0.4 ), fp, 2.0, 6.0 ) );
	const fib = hash1( vec2( floor( along.div( u.fiberM ) ), h.z.mul( 100 ) ) ).sub( 0.5 ).mul( fadeIn( u.fiberM, fp, 2.0, 6.0 ) ).mul( 0.15 );
	let color = mix( u.earlyColor, u.lateColor, h.x.mul( 0.7 ) ).mul( h.z.mul( 0.25 ).add( 0.88 ) ).mul( stripes.mul( 0.08 ).add( 0.96 ) ).mul( fib.add( 1 ) );
	// Glue seams and voids where chips meet.
	const sCoarse = pick( aTop, seam( A, c, float( 6e-5 ), fp ), seam( Bv, c, float( 6e-5 ), fp ) ).mul( coarse );
	const sFine = seam( F, c.mul( 0.3 ), float( 3e-5 ), fp ).mul( coarse.oneMinus() );
	const sm = sCoarse.max( sFine ).mul( fadeIn( c.mul( 0.3 ), fp, 1.0, 3.0 ) );
	const voidM = step( 0.93, hF.y ).mul( smoothstep( 0.25, 0.1, F.edge ) ).mul( coarse.oneMinus() );
	color = color.mul( float( 1 ).sub( sm.mul( 0.25 ) ) ).mul( float( 1 ).sub( voidM.mul( 0.7 ) ) );
	// Each chip at its own height: a step at its border.
	const height = h.y.mul( 4e-5 ).add( coarse.mul( 3e-5 ) ).sub( voidM.mul( 1e-4 ) );
	const slope = surfaceGradient( height, p ).mul( fadeIn( c.mul( 0.3 ), fp, 2.0, 6.0 ) );
	return { color, slope, cavity: sm.max( voidM ), rough: u.roughness, s2: float( 0.01 ) };

}

export function buildCork( p, fp, u ) {

	const g = u.granuleM, s = u.seed;
	// Granules are crumbs, not tiles: bend the borders.
	const pw = p.add( vec2( valueNoise( p.div( g.mul( 0.5 ) ) ), valueNoise( p.div( g.mul( 0.5 ) ).add( 7.7 ) ) ).sub( 0.5 ).mul( g ).mul( 0.8 ) );
	const G = voronoi( pw.div( g ).add( s.mul( 2 ) ), 0.9 );
	const hg = hash3( G.id1.add( 4.4 ) );
	// Granule tone; a few darker, toasted ones.
	const toast = step( 0.88, hg.y );
	let color = mix( u.earlyColor, u.lateColor, hg.x.mul( 0.6 ).add( toast.mul( 0.5 ) ) ).mul( hg.z.mul( 0.2 ).add( 0.9 ) );
	// Gaps between granules, wide and irregular.
	const gapW = valueNoise( p.div( g.mul( 0.4 ) ).add( 5.5 ) ).mul( 0.06 ).add( 0.008 );
	const gap = clamp( gapW.sub( G.edge ).mul( g ).div( fp ).add( 0.5 ), 0, 1 ).mul( fadeIn( g.mul( 0.1 ), fp, 1.0, 3.0 ) ).toVar();
	// Cork cells: a honeycomb of thin walls, cut open.
	const C = voronoi( wrapCoord( p.div( u.cellM ) ).add( G.id1.mul( 0.37 ) ), 0.6 ); // mod: hashes stay exact
	const wC = fadeIn( u.cellM, fp, 2.0, 6.0 );
	const cw = float( 1 ).sub( smoothstep( 0.03, 0.1, C.edge ) ).mul( wC );
	const lumen = smoothstep( 0.1, 0.35, C.edge ).mul( wC );
	// Lenticels: dark channels across the granule, long in one direction.
	const lq = vec2( p.x.div( g.mul( 0.3 ) ), p.y.div( g.mul( 0.12 ) ) ).add( s.mul( 9 ) );
	const lh = hash3( floor( lq ) );
	const ll = fract( lq ).sub( 0.5 ).sub( lh.xy.sub( 0.5 ).mul( 0.4 ) );
	const lent = smoothstep( 0.3, 0.2, vec2( ll.x, ll.y.mul( 1.6 ) ).length() ).mul( step( 0.7, lh.z ) ).mul( fadeIn( g.mul( 0.1 ), fp, 1.0, 3.0 ) );
	color = color.mul( float( 1 ).sub( cw.mul( 0.18 ) ) ).mul( lumen.mul( 0.06 ).add( 1 ) );
	color = mix( color, u.lateColor.mul( 0.45 ), lent.mul( 0.8 ) ).mul( float( 1 ).sub( gap.mul( 0.75 ) ) );
	// Granules domed, gaps deep, cells slightly concave.
	const height = smoothstep( 0.0, 0.3, G.edge ).mul( 1.5e-4 ).sub( gap.mul( 3e-4 ) ).sub( lent.mul( 6e-5 ) );
	const slope = surfaceGradient( height, p ).add( G.dir.mul( smoothstep( 0.3, 0.0, G.edge ) ).mul( - 0.3 ).mul( fadeIn( g, fp, 2.0, 6.0 ) ) )
		.add( C.toSeed.mul( 0.25 ).mul( lumen ) ); // concave: rises away from the centre
	return { color, slope, cavity: gap.max( lent ).max( cw.mul( 0.3 ) ), rough: u.roughness, s2: wC.oneMinus().mul( 0.02 ) };

}
