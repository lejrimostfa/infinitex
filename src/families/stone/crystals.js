// Interlocked crystals: a Voronoi where each seed has its own size,
// elongation and orientation, so cells look like grown grains (laths of
// feldspar, equant calcite) instead of even polygons. Branch-free 3 x 3
// search like core/voronoi.js; sizes and elongation stay moderate so the
// nearest seed is always in the window.
// Returns the nearest and second ids, the gap d2 - d1 (0 on a border) and
// the position in the crystal's own frame. square bends the metric toward
// a box in that frame: straight crystal faces, angular laths.

import { vec2, float, floor, step, cos, sin, sqrt } from 'three/tsl';
import { pick } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';

export function crystals( x, { jitter = 0.9, elong = 0.6, size = 0.35, square = 0 } = {} ) {

	const cell = floor( x ).toVar();
	let d1 = float( 1e3 ), d2 = float( 1e3 ), id1 = vec2( 0 ), id2 = vec2( 0 ), loc = vec2( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = cell.add( vec2( ox, oy ) );
		const h = hash3( id ), k = hash3( id.add( 17.3 ) );
		const r = x.sub( id.add( 0.5 ).add( h.xy.sub( 0.5 ).mul( jitter ) ) );
		const a = k.x.mul( 3.1416 ), c = cos( a ), s = sin( a );
		const e = sqrt( k.y.mul( elong ).add( 1 ) ); // keep the area, stretch the shape
		const l = vec2( r.x.mul( c ).add( r.y.mul( s ) ).div( e ), r.y.mul( c ).sub( r.x.mul( s ) ).mul( e ) );
		// square > 0: a box metric in the crystal frame, so faces are straight.
		const m = square > 0 ? l.length().mul( 1 - square ).add( l.x.abs().max( l.y.abs() ).mul( 1.15 * square ) ) : l.length();
		const d = m.div( k.z.sub( 0.5 ).mul( size * 2 ).add( 1 ) ); // big crystals win
		const first = step( d, d1 );
		const second = float( 1 ).sub( first ).mul( step( d, d2 ) );
		d2 = pick( first, d1, pick( second, d, d2 ) ).toVar();
		id2 = pick( first, id1, pick( second, id, id2 ) ).toVar();
		d1 = pick( first, d, d1 ).toVar();
		id1 = pick( first, id, id1 ).toVar();
		loc = pick( first, l, loc ).toVar();

	}

	return { id1, id2, d1, gap: d2.sub( d1 ).toVar(), loc };

}
