// Hairs lying on a skin (peach fuzz, strawberry trichomes): one straight,
// tapered hair per cell of cellM, rooted in the cell and pointing along
// `ang` (a node: a slow flow field, so the fuzz looks combed) give or take
// `spread` radians, about lenK cells long, half width w at the root.
// The 3 x 3 neighbour cells are searched, so lenK stays near 1.
// A hair thinner than a pixel is widened to one pixel and dimmed by its
// true width (same idea as core/marks.js): no shimmer from afar.
// Returns { cover, slope, tone, t (0 root .. 1 tip) }.

import { vec2, float, floor, cos, sin, clamp, step, mod } from 'three/tsl';
import { pick } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';

export function hairs( p, cellM, w, share, fp, salt, ang, spread = 0.5, lenK = 1.0 ) {

	const q = mod( p.div( cellM ), 4096 );
	const c0 = floor( q );
	let cover = float( 0 ), slope = vec2( 0 ), tone = float( 0 ), tt = float( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = c0.add( vec2( ox, oy ) );
		const h = hash3( id.add( salt ) ), h2 = hash3( id.add( salt + 17.3 ) );
		const a = ang.add( h.x.sub( 0.5 ).mul( spread * 2 ) );
		const dir = vec2( cos( a ), sin( a ) ), nrm = vec2( sin( a ).negate(), cos( a ) );
		const lp = q.sub( id.add( h.yz ) );
		const len = h2.y.mul( 0.4 ).add( 0.6 ).mul( lenK );
		const t = lp.dot( dir ).div( len );
		const inLen = step( 0, t ).mul( step( t, 1 ) );
		const d = lp.dot( nrm ).mul( cellM );
		const ww = w.mul( float( 1 ).sub( t.mul( 0.8 ) ) ).mul( h2.x.mul( 0.5 ).add( 0.75 ) );
		const wE = ww.max( fp.mul( 0.5 ) );
		const f = clamp( wE.sub( d.abs() ).div( fp ).add( 0.5 ), 0, 1 ).mul( ww.div( wE ) ).mul( inLen ).mul( step( h2.z, share ) );
		const on = step( cover, f );
		cover = cover.max( f );
		slope = pick( on, nrm.mul( d.div( wE ).clamp( - 1, 1 ) ).mul( - 0.9 ).mul( f ), slope );
		tone = pick( on, h2.x, tone );
		tt = pick( on, t, tt );

	}

	return { cover, slope, tone, t: tt };

}
