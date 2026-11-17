// Hairs lying on a skin (peach fuzz, strawberry trichomes): one straight,
// tapered hair per cell of cellM, rooted in the cell and pointing along
// `ang` (a node: a slow flow field, so the fuzz looks combed) give or take
// `spread` radians, about lenK cells long, half width w at the root.
// The 3 x 3 neighbour cells are searched, so lenK stays near 1.
// A hair thinner than a pixel is widened to one pixel and dimmed by its
// true width (same idea as core/marks.js): no shimmer from afar.
// Returns { cover, slope, tone, t (0 root .. 1 tip) }.
//
// Each candidate hair sits in a gate() (core/lod.js): a hair of length
// len <= lenK cells and half width ww <= 1.25 w covers a pixel only within
// lenK + ( 1.25 w + fp ) / cellM cells of its root, so farther candidates
// are skipped. A skipped hair has f = 0 and leaves the state as it was:
// tone and t may differ, but only while cover is 0, where they are not read.

import { vec2, float, floor, cos, sin, clamp, step, mod } from 'three/tsl';
import { pick, gate } from '../../core/lod.js';
import { hash3, wrapCoord } from '../../core/hash.js';

// One candidate hair laid over the state st.
function hair( lp, id, cellM, w, share, fp, salt, ang, spread, lenK, h, st ) {

	const h2 = hash3( id.add( salt + 17.3 ) );
	const a = ang.add( h.x.sub( 0.5 ).mul( spread * 2 ) );
	const dir = vec2( cos( a ), sin( a ) ), nrm = vec2( sin( a ).negate(), cos( a ) );
	const len = h2.y.mul( 0.4 ).add( 0.6 ).mul( lenK );
	const t = lp.dot( dir ).div( len );
	const inLen = step( 0, t ).mul( step( t, 1 ) );
	const d = lp.dot( nrm ).mul( cellM );
	const ww = w.mul( float( 1 ).sub( t.mul( 0.8 ) ) ).mul( h2.x.mul( 0.5 ).add( 0.75 ) );
	const wE = ww.max( fp.mul( 0.5 ) );
	const f = clamp( wE.sub( d.abs() ).div( fp ).add( 0.5 ), 0, 1 ).mul( ww.div( wE ) ).mul( inLen ).mul( step( h2.z, share ) );
	const on = step( st.cover, f );
	return {
		cover: st.cover.max( f ),
		slope: pick( on, nrm.mul( d.div( wE ).clamp( - 1, 1 ) ).mul( - 0.9 ).mul( f ), st.slope ),
		tone: pick( on, h2.x, st.tone ),
		t: pick( on, t, st.t ),
	};

}

export function hairs( p, cellM, w, share, fp, salt, ang, spread = 0.5, lenK = 1.0 ) {

	const q = wrapCoord( p.div( cellM ) ).toVar();
	const c0 = floor( q ).toVar();
	const A = ang.toVar();
	const reach = float( lenK * 1.01 + 0.01 ).add( w.mul( 1.3 ).add( fp.mul( 1.01 ) ).div( cellM ) );
	let st = { cover: float( 0 ), slope: vec2( 0 ), tone: float( 0 ), t: float( 0 ) };
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = c0.add( vec2( ox, oy ) ).toVar();
		const h = hash3( id.add( salt ) ).toVar();
		const lp = q.sub( id.add( h.yz ) ).toVar();
		const v = { cover: st.cover.toVar(), slope: st.slope.toVar(), tone: st.tone.toVar(), t: st.t.toVar() };
		st = gate( lp.length().lessThan( reach ), { cover: v.cover, slope: { node: v.slope, size: 2 }, tone: v.tone, t: v.t },
			() => hair( lp, id, cellM, w, share, fp, salt, A, spread, lenK, h, v ), [ lp, id, h, fp, A, v.cover, v.slope, v.tone, v.t ] );

	}

	return { cover: st.cover, slope: st.slope, tone: st.tone, t: st.t };

}
