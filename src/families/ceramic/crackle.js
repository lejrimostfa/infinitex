// Crackle: the glaze shrinks more than the body as it cools, so it cracks
// into a net. The first cracks run long and split the coat into cells of
// 1 to 3 cm; later ones split each cell again, and end on the cracks that
// were already there (T junctions, never crossings). Here each generation
// is a Voronoi net whose pattern is shifted by the id of the parent cell,
// so it breaks off at the parent cracks.
//   gen 1  cells crackle_mm, cracks about 0.1 mm wide
//   gen 2  cells a third of that, about 0.04 mm (Ge ware "gold thread")
//   gen 3  cells a tenth, hairlines of 10 um, faint
// Ink rubbed into the cracks bleeds a little into the glaze beside them.
// Lines thinner than a pixel are widened to a pixel and dimmed, so their
// mean darkness stays right and nothing flickers.

import { vec2, float, clamp, smoothstep, mod, mix } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

// Coverage of a line of half width w at distance d, conserving its mean.
// soft: width of the edge (the ink fades into the glaze over it).
function line( d, w, fp, soft = 0 ) {

	const rEff = w.max( fp.mul( 0.7 ) );
	return clamp( rEff.sub( d ).div( fp.max( w.mul( soft ) ) ).add( 0.5 ), 0, 1 ).mul( w.div( rEff ) );

}

// One generation. x: coordinates in cells. Returns coverage, halo, slope.
function generation( x, cellM, wRel, fp, salt ) {

	const V = voronoi( mod( x, 4096 ).add( salt ), 0.9 );
	// Width changes along the crack: some open, some barely.
	const open = valueNoise( x.mul( 2.3 ).add( salt ) ).mul( 0.9 ).add( 0.35 );
	const w = cellM.mul( wRel ).mul( open );
	// The crack edge is jagged at the scale of its own width.
	const jag = valueNoise( mod( x.mul( 90 ), 4096 ).add( salt ) ).sub( 0.5 ).mul( w ).mul( 1.4 ).mul( fadeIn( w.mul( 3 ), fp, 1.0, 3.0 ) );
	const d = V.edge.max( 0 ).mul( cellM ).add( jag ).abs();
	const f = fadeIn( cellM, fp, 1.5, 4.0 );
	const mean = w.mul( 3.5 ).div( cellM ); // share of the area covered by the line
	// The ink stain fades at its edges; the crack itself is a sharp dark
	// thread in its middle, a sixth of its width.
	const stain = line( d, w, fp, 0.6 ).mul( 0.85 ).max( line( d, w.mul( 0.16 ), fp ) );
	const cov = clamp( mix( mean, stain, f ), 0, 1 );
	const halo = smoothstep( w.mul( 6 ), w, d ).mul( fadeIn( w.mul( 6 ), fp, 1.0, 3.0 ) );
	// A shallow groove where the crack meets the surface.
	const g = smoothstep( w.mul( 4 ), float( 0 ), d );
	const slope = V.dir.mul( g.mul( float( 1 ).sub( g ) ).mul( - 0.5 ) ).mul( fadeIn( w.mul( 4 ), fp, 1.0, 3.0 ) );
	return { V, cov, halo, slope, f };

}

export function crackleNet( p, fp, u, cellM = u.crackleM ) {

	const s = u.seed;
	// Cracks wander: two octaves of warp.
	const w1 = vec2( valueNoise( p.div( cellM.mul( 0.6 ) ).add( s ) ), valueNoise( p.div( cellM.mul( 0.6 ) ).add( s.add( 7.7 ) ) ) ).sub( 0.5 ).mul( cellM ).mul( 0.45 );
	const w2 = vec2( valueNoise( p.div( cellM.mul( 0.12 ) ).add( 3.1 ) ), valueNoise( p.div( cellM.mul( 0.12 ) ).add( 5.3 ) ) ).sub( 0.5 ).mul( cellM ).mul( 0.06 );
	const pw = p.add( w1 ).add( w2 ).toVar();

	const G1 = generation( pw.div( cellM ), cellM, float( 0.0045 ), fp, s.mul( 3 ) );
	const c2 = cellM.mul( 0.33 );
	const G2 = generation( pw.div( c2 ).add( hash3( G1.V.id1 ).xy.mul( 31 ) ), c2, float( 0.006 ), fp, 11 );
	const c3 = c2.mul( 0.3 );
	const G3 = generation( pw.div( c3 ).add( hash3( G2.V.id1.add( 5 ) ).xy.mul( 29 ) ), c3, float( 0.008 ), fp, 23 );

	const fine = u.crackleFine;
	return {
		// Ink did not reach every part of a crack evenly.
		c1: G1.cov.mul( valueNoise( pw.div( cellM.mul( 0.15 ) ).add( 1.9 ) ).mul( 0.6 ).add( 0.5 ) ).mul( valueNoise( mod( pw.div( 4e-5 ), 4096 ) ).sub( 1 ).mul( 0.35 ).mul( fadeIn( float( 4e-5 ), fp, 1.5, 4.0 ) ).add( 1 ) ).min( 1 ), c2: G2.cov.mul( fine ).mul( valueNoise( pw.div( c2.mul( 0.2 ) ).add( 2.9 ) ).mul( 0.8 ).add( 0.4 ) ), c3: G3.cov.mul( fine ).mul( 0.6 ),
		halo: G1.halo.add( G2.halo.mul( fine ).mul( 0.6 ) ).min( 1 ),
		slope: G1.slope.add( G2.slope.mul( fine ).mul( 0.6 ) ).add( G3.slope.mul( fine ).mul( 0.3 ) ),
		cell: G1.V.id1,
	};

}
