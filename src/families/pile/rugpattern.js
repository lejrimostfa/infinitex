// The design of a small Persian rug, read one knot at a time: the weaver
// follows a cartoon, a grid where each square is one knot of one colour.
// Layout, from the edge inward (sizes for a 300 mm rug, they scale):
//   selvedge    one knot of dark blue overcast
//   outer guard gold, a dark dot every other knot
//   main border dark blue, red rosettes with an ivory heart, a gold vine
//   inner guard red line between two dark lines
//   field       red ground, small ivory and blue lozenges in a lattice
//   medallion   lobed lozenge: blue, ivory, red, gold heart, pendants
//   spandrels   quarter medallions in the field corners (blue, gold)
// Every border between two colours is outlined one knot wide in dark
// brown, as on most city rugs. Input: knot centre in meters; insetY:
// the pile stops that far from both ends (kilim and fringe).

import { vec2, float, floor, abs, min, max, mix, step, sin, cos, atan, mod } from 'three/tsl';
import { hash1 } from '../../core/hash.js';

const inside = ( f ) => step( f, 0 ); // f: signed distance, < 0 inside

export function rugColor( kc, u, insetY = 0 ) {

	const S = u.rugM, k = u.knotM.max( u.rowM );
	const rel = mod( kc, S ).sub( S.mul( 0.5 ) ); // meters from the rug centre
	const half = S.mul( 0.5 );
	// The design is squeezed along y to leave room for the rug ends.
	const sq = half.div( half.sub( insetY ) );
	const ax = abs( rel.x ), ay = abs( rel.y ).mul( sq );
	const edge = min( half.sub( ax ), half.sub( ay ).div( sq ) ); // distance to the pile edge
	const s = S.div( 0.3 ); // sizes below are for a 300 mm rug
	const g1 = s.mul( 0.008 ), b0 = s.mul( 0.012 ), b1 = s.mul( 0.046 ), g2 = s.mul( 0.054 );
	let col = u.red;
	let line = float( 1e3 ); // distance to the nearest outline

	// Field lattice of small lozenges, 24 mm apart, odd rows shifted.
	const L = s.mul( 0.024 );
	const lq = rel.div( L );
	const lrow = floor( lq.y );
	const lc = vec2( floor( lq.x.add( mod( lrow, 2 ).mul( 0.5 ) ) ).sub( mod( lrow, 2 ).mul( 0.5 ) ).add( 0.5 ), lrow.add( 0.5 ) ).mul( L );
	const dl = abs( rel.x.sub( lc.x ) ).add( abs( rel.y.sub( lc.y ) ) ).sub( L.mul( 0.3 ) );
	const lozCol = mix( u.ivory, u.blue, step( 0.5, hash1( lc.div( L ).add( 3.1 ) ) ) );
	col = mix( col, lozCol, inside( dl ) );
	line = min( line, abs( dl ) );
	const dot = abs( rel.x.sub( lc.x ) ).add( abs( rel.y.sub( lc.y ) ) ).sub( L.mul( 0.08 ) );
	col = mix( col, u.gold, inside( dot ) );

	// Spandrels: quarter lozenges in the field corners.
	const fc = half.sub( g2 );
	const dsp = fc.sub( ax ).div( 0.75 ).add( fc.sub( ay ) ).sub( s.mul( 0.06 ) );
	col = mix( col, u.blue, inside( dsp ) );
	line = min( line, abs( dsp ) );
	const dsp2 = dsp.add( s.mul( 0.022 ) );
	col = mix( col, u.gold, inside( dsp2 ) );
	line = min( line, abs( dsp2 ) );

	// Medallion: a lozenge with eight lobes, then its pendants.
	const ang = atan( rel.y, rel.x );
	const lobe = cos( ang.mul( 8 ) ).mul( s.mul( 0.004 ) );
	const md = ax.div( 0.8 ).add( ay ).sub( s.mul( 0.072 ) ).add( lobe );
	const pend = ax.mul( 1.6 ).add( abs( ay.sub( s.mul( 0.088 ) ) ) ).sub( s.mul( 0.014 ) );
	const outer = min( md, pend );
	col = mix( col, u.blue, inside( outer ) );
	line = min( line, abs( outer ) );
	const rings = [ [ 0.024, 'ivory' ], [ 0.042, 'red' ], [ 0.056, 'gold' ] ];
	for ( const [ r, name ] of rings ) {

		const f = md.add( s.mul( r ) );
		col = mix( col, u[ name ], inside( f ) );
		line = min( line, abs( f ) );

	}

	// Borders, from the inner guard out to the edge.
	const inBorder = step( edge, g2 );
	const t = mix( rel.x, rel.y, step( ay, ax ) ); // along the border
	const mid = edge.sub( b0.add( b1 ).mul( 0.5 ) );
	const ros = vec2( mod( t.add( s.mul( 0.0175 ) ), s.mul( 0.035 ) ).sub( s.mul( 0.0175 ) ), mid );
	const dr = ros.length().sub( s.mul( 0.012 ) ).add( cos( atan( ros.y, ros.x ).mul( 6 ) ).mul( s.mul( 0.002 ) ) );
	const vine = abs( mid.sub( sin( t.div( s.mul( 0.035 ) ).mul( Math.PI * 2 ) ).mul( s.mul( 0.012 ) ) ) ).sub( k.mul( 0.6 ) );
	let bcol = mix( mix( u.blue, u.gold, inside( vine ) ), u.red, inside( dr ) );
	bcol = mix( bcol, u.ivory, inside( dr.add( s.mul( 0.006 ) ) ) );
	const bline = min( abs( dr ), abs( dr.add( s.mul( 0.006 ) ) ) );
	const guardIn = step( b1, edge );
	bcol = mix( bcol, u.red, guardIn );
	const outerGuard = step( edge, b0 );
	const gdot = step( 0.5, mod( floor( t.div( k ) ), 2 ) ).mul( step( abs( edge.sub( b0.add( g1 ).mul( 0.5 ) ) ), k.mul( 0.6 ) ) );
	bcol = mix( bcol, mix( u.gold, u.dark, gdot ), outerGuard );
	bcol = mix( bcol, u.blue, step( edge, g1 ) );
	col = mix( col, bcol, inBorder );
	const ring = min( min( abs( edge.sub( g2 ) ), abs( edge.sub( b1 ) ) ), min( abs( edge.sub( b0 ) ), abs( edge.sub( g1 ) ) ) );
	line = mix( line, min( bline, ring ), inBorder );
	line = min( line, abs( edge.sub( g2 ) ) );

	// Outlines one knot wide (half a knot on each side of the border).
	const outline = step( line, k.mul( 0.55 ) );
	return mix( col, u.dark, outline );

}
