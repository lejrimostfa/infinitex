// 2D Voronoi for cell patterns (leather grain, cracks, pebbles, scales).
// Returns, in cell units: the nearest seed (p1), the second one (p2), the
// distance to the shared border (edge, measured to the bisector), the unit
// direction from p1 to p2 (dir) and both cell ids. Branch-free 3 x 3 search:
// every candidate is evaluated and kept with pick() (see core/lod.js).
// Cell ids are periodic (mod 4096, core/hash.js), so are id1 and id2.

import { vec2, float, floor, step } from 'three/tsl';
import { pick } from './lod.js';
import { hash3, wrapId } from './hash.js';

export function voronoi( x, jitter = 0.85 ) {

	const cell = floor( x ).toVar();
	let d1 = float( 1e3 ), d2 = float( 1e3 );
	let p1 = vec2( 0 ), p2 = vec2( 0 ), id1 = vec2( 0 ), id2 = vec2( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = cell.add( vec2( ox, oy ) );
		const wid = wrapId( id ); // periodic ids: a caller's mod( x, 4096 ) is seamless
		const p = id.add( 0.5 ).add( hash3( wid ).xy.sub( 0.5 ).mul( jitter ) );
		const d = x.sub( p ).dot( x.sub( p ) );
		const first = step( d, d1 ); // 1 when d <= d1: new nearest
		const second = float( 1 ).sub( first ).mul( step( d, d2 ) ); // between d1 and d2
		// Nearest becomes second when a new nearest arrives.
		d2 = pick( first, d1, pick( second, d, d2 ) ).toVar();
		p2 = pick( first, p1, pick( second, p, p2 ) ).toVar();
		id2 = pick( first, id1, pick( second, wid, id2 ) ).toVar();
		d1 = pick( first, d, d1 ).toVar();
		p1 = pick( first, p, p1 ).toVar();
		id1 = pick( first, wid, id1 ).toVar();

	}

	const dir = p2.sub( p1 ).normalize().toVar();
	// Distance from x to the bisector of p1 p2 (positive inside p1's cell).
	const edge = p1.add( p2 ).mul( 0.5 ).sub( x ).dot( dir ).toVar();
	return { p1, p2, id1, id2, dir, edge, toSeed: x.sub( p1 ) };

}
