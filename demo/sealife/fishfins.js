// The fins of a fish built by code (fishshape.js): thin sheets, two-sided
// in the geometry, a ragged edge between the rays, rays for the shader.
//   tail      forked: two lobes from the tail root, the notch at fork
//   dorsal    on the top midline, tallest at its front, raked back; its
//             front part spiny (deep notches between the rays)
//   anal      on the belly midline, behind the vent
//   pectoral  a rounded paddle low on each side behind the gill line;
//             its flap weight lets the vertex stage scull it
//   pelvic    a small fan under the belly on each side
// Each sheet appends to the builder B (pos, uv, fish, idx).
//
// Event bus: none (a pure geometry helper).

import { ringPoint } from './fishshape.js';

const norm = ( v ) => { const l = Math.hypot( ...v ) || 1; return v.map( ( c ) => c / l ); };
const add = ( a, b, k = 1 ) => a.map( ( c, i ) => c + b[ i ] * k );

// The point at a (0..1) along a polyline.
function along( pts, a ) {

	const f = a * ( pts.length - 1 ), i = Math.min( pts.length - 2, Math.floor( f ) );
	return add( pts[ i ], add( pts[ i + 1 ], pts[ i ], - 1 ), f - i );

}

// A sheet between a root line and an edge line (polylines, resampled).
// Columns sit on the rays and between them; between two rays the membrane
// stops short of the edge (notch( a ) deepens it on spines): the ragged
// edge is in the geometry, so the material needs no alpha and no discard.
// Both sides: the points twice, the second set wound the other way, so a
// FrontSide material shows the fin from either side.
// rays: ray count; flap: side sign for a pectoral, else 0;
// warp( P, a, r ): moves a point (the tail's lobes flare).
function sheet( B, root, edge, { nr = 4, rays = 8, flap = 0, notch = () => 0, warp = null } = {} ) {

	const nc = rays * 2, verts = [];
	for ( let i = 0; i <= nr; i ++ ) for ( let j = 0; j <= nc; j ++ ) {

		const a = j / nc, r = i / nr * ( j % 2 ? 1 - 0.08 - 0.32 * notch( a ) : 1 );
		const R0 = along( root, a ), E0 = along( edge, a ), len = Math.hypot( ...add( E0, R0, - 1 ) );
		let P = add( R0, add( E0, R0, - 1 ), r );
		if ( warp ) P = warp( P, a, r );
		verts.push( [ P, [ a * len, r * len ], [ 1, a * rays, r, flap * r * len ] ] );

	}

	for ( const flip of [ false, true ] ) {

		const base = B.pos.length / 3;
		for ( const [ P, uv, f ] of verts ) { B.pos.push( ...P ); B.uv.push( ...uv ); B.fish.push( ...f ); }
		for ( let i = 0; i < nr; i ++ ) for ( let j = 0; j < nc; j ++ ) {

			const a = base + i * ( nc + 1 ) + j, b = a + nc + 1;
			if ( flip ) B.idx.push( a, b, a + 1, a + 1, b, b + 1 );
			else B.idx.push( a, a + 1, b, a + 1, b + 1, b );

		}

	}

}

// A fan from a short root: rays turn from dir toward perp by +-spread / 2.
function fan( rootA, rootB, dir, perp, len, spread, shape, n ) {

	const root = [], edge = [];
	for ( let j = 0; j <= n; j ++ ) {

		const a = j / n, t = ( a - 0.5 ) * spread, P = add( rootA, add( rootB, rootA, - 1 ), a );
		const d = norm( add( dir.map( ( c ) => c * Math.cos( t ) ), perp, Math.sin( t ) ) );
		root.push( P );
		edge.push( add( P, d, len * shape( a ) ) );

	}

	return { root, edge };

}

export function addFins( B, sh, L, at ) {

	const smooth = ( x ) => { x = Math.min( 1, Math.max( 0, x ) ); return x * x * ( 3 - 2 * x ); };

	// Tail: rays from the tail root out to a forked edge.
	{

		const oE = at( 1 ), R = oE.top * 0.92, n = 12, root = [], edge = [];
		const { len, span, fork } = sh.tail;
		for ( let j = 0; j <= n; j ++ ) {

			const a = j / n * 2 - 1, d = len * L * ( fork + ( 1 - fork ) * Math.abs( a ) ** 1.4 );
			root.push( [ oE.x + 0.004 * L, a * R, 0 ] );
			edge.push( [ oE.x - d, a * span * L, 0 ] );

		}

		// The lobes flare: the edge points spread faster than they recede.
		sheet( B, root, edge, { nr: 5, rays: 14, warp: ( P, a, r ) => [ P[ 0 ], ( a * 2 - 1 ) * ( R + ( span * L - R ) * r ** 0.75 ), P[ 2 ] ] } );

	}

	// Dorsal and anal: long bases on the midlines, rays raked back.
	const median = ( f, top ) => {

		const n = Math.max( 6, Math.round( f.rays * 0.8 ) ), root = [], edge = [];
		for ( let j = 0; j <= n; j ++ ) {

			const a = j / n, o = at( f.from + ( f.to - f.from ) * a );
			const h = f.height * L * Math.sin( Math.PI / 2 * Math.min( 1, a / 0.15 + 0.15 ) ) * ( 1 - 0.45 * a ) * ( 1 - 0.55 * smooth( ( a - 0.8 ) / 0.2 ) );
			const rake = 0.45 + 0.5 * a, y = top ? o.top * 0.97 : - o.bot * 0.97;
			root.push( [ o.x, y, 0 ] );
			edge.push( [ o.x - Math.sin( rake ) * h, y + ( top ? 1 : - 1 ) * Math.cos( rake ) * h, 0 ] );

		}

		const spiny = f.spiny ?? 0;
		sheet( B, root, edge, { nr: 4, rays: f.rays, notch: ( a ) => spiny * ( 1 - smooth( ( a - 0.35 ) / 0.25 ) ) } );

	};
	median( sh.dorsal, true );
	median( sh.anal, false );

	// Pectorals and pelvics, one of each per side.
	for ( const side of [ 1, - 1 ] ) {

		const P = sh.pectoral, th = Math.acos( P.y ), ang = side > 0 ? th : Math.PI * 2 - th;
		const ra = ringPoint( at( P.s - 0.015 ), ang - side * 0.18 ), rb = ringPoint( at( P.s + 0.005 ), ang + side * 0.18 );
		const pec = fan( ra, rb, norm( [ - 1, - 0.15, 0.55 * side ] ), norm( [ - 0.2, 1, 0.1 * side ] ), P.len * L, P.width * 12, ( a ) => 0.62 + 0.38 * Math.sin( Math.PI * a ), 7 );
		sheet( B, pec.root, pec.edge, { nr: 4, rays: 9, flap: side } );

		const V = sh.pelvic, va = side > 0 ? Math.PI - 0.45 : Math.PI + 0.45;
		const pa = ringPoint( at( V.s - 0.012 ), va ), pb = ringPoint( at( V.s + 0.012 ), va );
		const pel = fan( pa, pb, norm( [ - 1, - 0.7, 0.3 * side ] ), norm( [ - 0.5, 0.6, 0 ] ), V.len * L, 0.5, ( a ) => 0.7 + 0.3 * a, 5 );
		sheet( B, pel.root, pel.edge, { nr: 3, rays: 6 } );

	}

}
