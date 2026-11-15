// Aran cables: knit strands crossing over a reverse stockinette ground.
//   L0 the rope: a 6 stitch panel (two strands of 3) every 12 stitches,
//      about 3 cm on a 20 stitch per 10 cm yarn. Every 8 rows (about 3 cm)
//      the left strand crosses over the right one, always in front, so the
//      panel twists like a rope. The strands stand about 1.5 mm proud of
//      the ground, rounded across, the front strand higher at the cross,
//      the back strand pushed down. The rope pinches at each cross and the
//      ground shows in deep shadow at its sides.
//   L1 stitches: knit V legs in the frame of each strand, so the V's lean
//      along the strand while it travels; purl bumps on the ground.
// The pattern relief (h, ao) stays visible at a distance.

import { vec2, float, floor, fract, smoothstep, sin, max, min, PI } from 'three/tsl';
import { knitItems, purlItems, posmod } from './pieces.js';

// One strand j (0 moves left to right in front, 1 right to left behind).
function strand( u, g, p, j ) {

	const w = g.cableW / 2;
	const N = g.cableW + g.ground;
	const x0 = g.ground / 2;
	const rows = p.y.div( u.aspect ).div( g.cableRows );
	const t = fract( rows );
	const tc = 0.45;
	const k = t.div( tc ).clamp( 0, 1 );
	const s = smoothstep( 0, tc, t );
	const ds = k.mul( float( 1 ).sub( k ) ).mul( 6 / tc ).div( u.aspect.mul( g.cableRows ) ); // ds / dy
	const dir = j === 0 ? 1 : - 1;
	const left = float( x0 + ( j === 0 ? 0 : w ) ).add( s.mul( w * dir ) );
	const X = posmod( p.x, N );
	const xs = X.sub( left ).toVar(); // across the strand, 0..w inside
	const bump = sin( s.mul( PI ) );
	const L = u.relief.mul( g.lift );
	const lift = L.add( bump.mul( j === 0 ? 0.6 : - 0.75 ).mul( L ) );
	return { w, xs, shear: ds.mul( w * dir ), lift, panel: floor( p.x.div( N ) ), X, bump };

}

// Dome across a strand: outer columns sit lower, so inner legs overlap
// them like the round of a rope.
const dome = ( x, w ) => {

	const r = x.sub( w / 2 ).div( w / 2 );
	return float( 1 ).sub( r.mul( r ) ).mul( 0.35 );

};

export function cableLevel( u, f, g ) {

	const items = [];
	const S = [ strand( u, g, f.p, 0 ), strand( u, g, f.p, 1 ) ];
	const L = u.relief.mul( g.lift );
	S.forEach( ( st, j ) => {

		const col = floor( st.xs );
		const off = posmod( st.panel, 256 ).mul( 16 ).add( 4 + j * 4 );
		const frame = { local: vec2( st.xs.sub( col ), f.local.y ), col: col.add( off ), row: f.row };
		const inStrand = ( c ) => {

			const x = c.x.sub( off );
			return smoothstep( - 0.6, - 0.4, x ).mul( float( 1 ).sub( smoothstep( st.w - 0.6, st.w - 0.4, x ) ) );

		};

		const lift = ( c ) => st.lift.add( dome( c.x.sub( off ).add( 0.5 ), st.w ).mul( L ) );
		items.push( ...knitItems( u, frame, inStrand, lift, { shear: st.shear, sideOffset: 10 + j * 4 } ) );

	} );
	// Ground: purl outside the cable panel columns.
	const N = g.cableW + g.ground, x0 = g.ground / 2;
	const ground = ( c ) => {

		const X = posmod( c.x, N );
		return float( 1 ).sub( smoothstep( x0 - 0.6, x0 - 0.4, X ).mul( float( 1 ).sub( smoothstep( x0 + g.cableW - 0.6, x0 + g.cableW - 0.4, X ) ) ) );

	};

	items.push( ...purlItems( u, f, ground, () => float( 0 ) ) );
	return { items, macro: ( p ) => cableMacro( u, g, p ) };

}

// Macro relief: rounded strands, ground in shadow along their sides.
function cableMacro( u, g, p ) {

	const L = u.relief.mul( g.lift );
	let h = float( 0 ), inAny = float( 0 ), dist = float( 9 ), aoS = float( 1 );
	for ( const j of [ 0, 1 ] ) {

		const st = strand( u, g, p, j );
		const inS = smoothstep( - 0.25, 0.35, st.xs ).mul( float( 1 ).sub( smoothstep( st.w - 0.35, st.w + 0.25, st.xs ) ) );
		const hs = st.lift.add( dome( st.xs, st.w ).mul( L ) ).mul( inS );
		const top = step01( hs.sub( h ) );
		h = max( h, hs );
		// The back strand sinks at the cross: darker there.
		aoS = top.mul( float( 1 ).sub( st.bump.mul( j === 1 ? 0.3 : 0 ) ) ).add( float( 1 ).sub( top ).mul( aoS ) );
		inAny = max( inAny, inS );
		dist = min( dist, max( st.xs.negate(), st.xs.sub( st.w ) ).max( 0 ) );

	}

	const edgeShade = smoothstep( 0.0, 0.5, float( 0.5 ).sub( inAny.sub( 0.5 ).abs() ) ); // dark rim at the strand sides
	const groundAO = float( 1 ).sub( float( 1 ).sub( smoothstep( 0.0, 1.4, dist ) ).mul( 0.4 ) );
	const ao = groundAO.mul( float( 1 ).sub( inAny ) ).add( aoS.mul( inAny ) ).mul( float( 1 ).sub( edgeShade.mul( 0.25 ) ) );
	return { h, ao };

}

const step01 = ( x ) => smoothstep( - 0.001, 0.001, x );
