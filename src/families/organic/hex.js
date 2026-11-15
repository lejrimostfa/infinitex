// A hexagonal net (honeycomb cells, insect eye facets), in units of the
// pitch: neighbour centres are 1 apart, the flat sides face them, so a
// cell is a hexagon of inradius 0.5. Branch-free: the nearer of two
// rectangular lattices of centres is kept with pick().
// Returns { g (from the centre), id (stable vec2 per cell, for hashes),
// d (hex distance from the centre, 0.5 on the wall), edge (0.5 - d),
// n (unit outward normal of the nearest side) }.

import { vec2, float, floor, step, abs } from 'three/tsl';
import { pick } from '../../core/lod.js';

const R3 = Math.sqrt( 3 );

export function hexNet( q ) {

	const r = vec2( 1, R3 ), h = r.mul( 0.5 );
	const wrap = ( x ) => x.sub( r.mul( floor( x.div( r ) ) ) ).sub( h );
	const a = wrap( q ), b = wrap( q.sub( h ) );
	const useA = step( a.dot( a ), b.dot( b ) );
	const g = pick( useA, a, b ).toVar();
	const c = q.sub( g );
	// Centres sit on half-integer x and multiples of sqrt(3)/2 in y.
	const id = floor( vec2( c.x.mul( 2 ), c.y.mul( 2 / R3 ) ).add( 0.5 ) );
	// Distance along the three side normals: (1,0), (1/2, +-sqrt3/2).
	const n1 = vec2( 1, 0 ), n2 = vec2( 0.5, R3 / 2 ), n3 = vec2( 0.5, - R3 / 2 );
	const d1 = g.dot( n1 ), d2 = g.dot( n2 ), d3 = g.dot( n3 );
	const a1 = abs( d1 ), a2 = abs( d2 ), a3 = abs( d3 );
	const t2 = step( a1, a2 ).mul( step( a3, a2 ) ), t3 = step( a1, a3 ).mul( step( a2, a3 ) ).mul( t2.oneMinus() );
	const d = a1.max( a2 ).max( a3 ).toVar();
	const sgn = ( x ) => step( 0, x ).mul( 2 ).sub( 1 );
	const n = pick( t2, n2.mul( sgn( d2 ) ), pick( t3, n3.mul( sgn( d3 ) ), n1.mul( sgn( d1 ) ) ) );
	return { g, id, d, edge: float( 0.5 ).sub( d ), n };

}
