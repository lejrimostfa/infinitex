// Path, obstacles and camera of the submarine tour film
// (tests/reels/submarine_tour.mjs). Plain module: the film imports it in
// node (captions, checks) and the page imports it in setup().
//   buildTour( { live } )  live.jelly( i ) and live.crab() give the moving
//                          creatures ([ x, y, z ]); node passes none
//   returns { sub( u ), camera( t, dt ), sdf, captions, W, INTRO, TOUR }
//     u   seconds of tour (film time minus INTRO), t  film time
// The tank is mapped as obstacles (sdf, metres to the nearest surface):
// sand, walls, surface, the three cubes, kelp, seagrass, anemones, corals,
// jellyfish (their whole drift), the crab's lane. The submarine path is
// pushed out of them by its clearance; the camera by its own, and kept off
// the submarine. Then a spring smooths the camera (no jump, no whip).
// Event bus: none (a pure module).

import { sandFloor } from '../../demo/sealife/seafloor.js';

export const INTRO = 22, TOUR = 80, END = 4, LEVEL = 0.35, TW = 1.2, TD = 0.8;
const SAND = { family: 'ground', mode: 'sand', grain_mm: 0.35, color: '#d6bd92', color2: '#b8804f', color3: '#2b2622', ripple_mm: 90, ripple: 0.5, specks: 0.4, sparkle: 0.5, roughness: 0.8, seed: 2, dune: 1 };
export const sand = sandFloor( SAND, { width: TW, depth: TD } );

// [ cx, cz, half side, top, ry ]: the cubes of aquarium/tank.js.
const BOXES = [ [ - 0.25, - 0.12, 0.08, 0.16, 0.4 ], [ 0.12, 0.15, 0.06, 0.12, - 0.3 ], [ 0.3, - 0.18, 0.07, 0.48, 0.2 ] ];
// [ x, z, radius, bottom, top ]: the life of aquarium/life.js, as upright cylinders.
const JELLY = [ [ 0.5, 0.2, 0.0 ], [ - 0.5, 0.17, - 0.28 ], [ 0.05, 0.22, - 0.32 ], [ 0.47, 0.16, 0.3 ] ];
const CYLS = [
	[ 0.5, - 0.3, 0.08, 0, 0.31 ], [ 0.16, - 0.33, 0.08, 0, 0.29 ], // kelp, with the sway of its leaves
	[ - 0.46, - 0.18, 0.09, 0, 0.13 ], [ - 0.5, 0.12, 0.08, 0, 0.16 ], [ - 0.07, - 0.31, 0.09, 0, 0.14 ], [ - 0.04, 0.02, 0.05, 0, 0.12 ], [ 0.46, 0.3, 0.08, 0, 0.15 ], // seagrass
	[ - 0.2, 0.12, 0.04, 0, 0.05 ], [ 0.33, 0.12, 0.03, 0, 0.04 ], [ - 0.52, - 0.02, 0.045, 0, 0.055 ], // anemones
	[ 0.5, 0.11, 0.06, 0, 0.1 ], [ - 0.27, - 0.355, 0.08, 0, 0.15 ], [ 0.26, - 0.005, 0.05, 0, 0.05 ], // corals
	...JELLY.map( ( [ x, y, z ] ) => [ x, z, 0.055, y - 0.1, y + 0.07 ] ), // a bell, its arms and its drift
];
const CRAB = [ - 0.04, 0.31, 0.3, 0.04, 0.05 ]; // [ cx, cz, half x, half z, top ]: its lane along the front

const clamp = ( v, a, b ) => Math.min( b, Math.max( a, v ) );
const ease = ( x ) => { x = clamp( x, 0, 1 ); return x * x * ( 3 - 2 * x ); };
const lerp = ( a, b, k ) => a + ( b - a ) * k;
const mix = ( a, b, k ) => a.map( ( v, i ) => v + ( b[ i ] - v ) * k );
const len = ( a ) => Math.hypot( ...a );
const sub3 = ( a, b ) => a.map( ( v, i ) => v - b[ i ] );

function box( x, y, z, [ cx, cz, h, top, ry ] ) {

	const wx = x - cx, wz = z - cz, c = Math.cos( ry ), s = Math.sin( ry );
	const q = [ Math.abs( c * wx - s * wz ) - h, Math.abs( y - top / 2 ) - top / 2, Math.abs( s * wx + c * wz ) - h ];
	return Math.hypot( ...q.map( ( v ) => Math.max( v, 0 ) ) ) + Math.min( Math.max( ...q ), 0 );

}

function cyl( x, y, z, [ cx, cz, r, y0, y1 ] ) {

	const a = Math.hypot( x - cx, z - cz ) - r, b = Math.abs( y - ( y0 + y1 ) / 2 ) - ( y1 - y0 ) / 2;
	return Math.hypot( Math.max( a, 0 ), Math.max( b, 0 ) ) + Math.min( Math.max( a, b ), 0 );

}

// Metres to the nearest obstacle. sandOff lifts the floor (the hull's half height).
export function sdf( x, y, z, sandOff = 0 ) {

	let d = Math.min( y - sand( x, z ) - sandOff, LEVEL - y, z + TD / 2, TD / 2 - z, TW / 2 - Math.abs( x ) );
	for ( const b of BOXES ) d = Math.min( d, box( x, y, z, b ) );
	for ( const c of CYLS ) d = Math.min( d, cyl( x, y, z, c ) );
	const [ cx, cz, hx, hz, top ] = CRAB, q = [ Math.abs( x - cx ) - hx, Math.abs( y - top / 2 ) - top / 2, Math.abs( z - cz ) - hz ];
	return Math.min( d, Math.hypot( ...q.map( ( v ) => Math.max( v, 0 ) ) ) + Math.min( Math.max( ...q ), 0 ) );

}

// Push a point out until it is CL from every obstacle (along the gradient).
function relax( p, CL, off = 0, extra = null ) {

	const f = ( x, y, z ) => Math.min( sdf( x, y, z, off ), extra ? extra( x, y, z ) : Infinity );
	for ( let k = 0; k < 40; k ++ ) {

		const d = f( ...p );
		if ( d >= CL ) break;
		const e = 5e-4, g = [ f( p[ 0 ] + e, p[ 1 ], p[ 2 ] ) - f( p[ 0 ] - e, p[ 1 ], p[ 2 ] ), f( p[ 0 ], p[ 1 ] + e, p[ 2 ] ) - f( p[ 0 ], p[ 1 ] - e, p[ 2 ] ), f( p[ 0 ], p[ 1 ], p[ 2 ] + e ) - f( p[ 0 ], p[ 1 ], p[ 2 ] - e ) ];
		const n = len( g ) || 1;
		p = p.map( ( v, i ) => v + g[ i ] / n * ( CL - d + 2e-4 ) );

	}

	return p;

}

// The ground under a point: the sand, or a cube's top when over it.
const support = ( x, z ) => {

	let y = sand( x, z );
	for ( const b of BOXES ) if ( box( x, b[ 3 ] - 0.001, z, b ) < 0.012 ) y = Math.max( y, b[ 3 ] );
	return y;

};

export function buildTour( { live = {} } = {} ) {

	const jelly = live.jelly ?? ( ( i ) => JELLY[ i ] );
	const crab = live.crab ?? ( () => [ - 0.04, 0.03, 0.31 ] );

	// The route: [ x, y, z ], or [ x, h, z, 1 ] for h over the ground.
	const ROUTE = [
		[ - 0.16, 0.3, 0.22 ], // 0 under the surface, by the front pane
		[ - 0.1, 0.17, 0.24 ], // 1 diving past the red fish
		[ - 0.12, 0.018, 0.2, 1 ], // 2 on the sand
		[ - 0.03, 0.022, 0.19, 1 ], // 3 over the orange starfish
		[ 0.03, 0.03, 0.09, 1 ], // 4 to the bronze cube
		[ 0.1, 0.135, 0.15 ], // 5 over its top
		[ 0.17, 0.135, 0.13 ], // 6
		[ 0.22, 0.03, 0.07, 1 ], // 7 down its far side
		[ 0.27, 0.078, 0.0 ], // 8 over the brain coral
		[ 0.38, 0.03, - 0.01, 1 ], // 9 over the blue starfish
		[ 0.43, 0.04, 0.04, 1 ], // 10 the branching coral
		[ 0.44, 0.05, - 0.1, 1 ], // 11 under the jellyfish
		[ 0.44, 0.12, - 0.22 ], // 12 up between the kelp and the post
		[ 0.4, 0.2, - 0.33 ], // 13 behind the post
		[ 0.26, 0.28, - 0.33 ], // 14 the silver fish, under the surface
		[ 0.12, 0.24, - 0.25 ], // 15 past the kelp
		[ - 0.02, 0.17, - 0.2 ], // 16 the jellyfish at the back
		[ - 0.1, 0.03, - 0.19, 1 ], // 17 down to the seagrass
		[ - 0.2, 0.03, - 0.25, 1 ], // 18 the fan coral
		[ - 0.33, 0.07, - 0.24 ], // 19
		[ - 0.3, 0.18, - 0.13 ], // 20 onto the granite cube
		[ - 0.24, 0.178, - 0.08 ], // 21 across its top
		[ - 0.4, 0.04, - 0.06, 1 ], // 22 down its far side
		[ - 0.44, 0.07, 0.04, 1 ], // 23 the orange anemone
		[ - 0.38, 0.03, 0.15, 1 ], // 24 past the seagrass
		[ - 0.27, 0.03, 0.16, 1 ], // 25
		[ - 0.2, 0.075, 0.12, 1 ], // 26 over the pink anemone
		[ - 0.1, 0.15, 0.08 ], // 27 up into the school
		[ 0.0, 0.24, 0.05 ], // 28
		[ 0.12, 0.31, 0.0 ], // 29 under the surface
	].map( ( [ x, y, z, rel ] ) => [ x, rel ? support( x, z ) + y : y, z ] );

	// Spline, pushed out of the obstacles, smoothed, pushed again.
	const N = 60, CL = 0.02, OFF = 0.008; // clearance; the floor needs only the hull's half height plus 5 mm
	const n = ROUTE.length;
	const cr = ( a, b, c, d, u ) => b.map( ( _, i ) => 0.5 * ( 2 * b[ i ] + ( c[ i ] - a[ i ] ) * u + ( 2 * a[ i ] - 5 * b[ i ] + 4 * c[ i ] - d[ i ] ) * u * u + ( 3 * b[ i ] - a[ i ] - 3 * c[ i ] + d[ i ] ) * u * u * u ) );
	let pts = [];
	for ( let i = 0; i < n - 1; i ++ ) for ( let k = 0; k < N; k ++ ) pts.push( cr( ROUTE[ Math.max( i - 1, 0 ) ], ROUTE[ i ], ROUTE[ i + 1 ], ROUTE[ Math.min( i + 2, n - 1 ) ], k / N ) );
	pts.push( ROUTE[ n - 1 ] );
	for ( let round = 0; round < 6; round ++ ) {

		pts = pts.map( ( p ) => relax( p, CL, OFF ) );
		for ( let pass = 0; pass < 8; pass ++ ) pts = pts.map( ( p, i ) => i === 0 || i === pts.length - 1 ? p : p.map( ( v, j ) => ( pts[ i - 1 ][ j ] + 2 * v + pts[ i + 1 ][ j ] ) / 4 ) );

	}

	pts = pts.map( ( p ) => relax( p, CL, OFF ) );
	const L = [ 0 ];
	for ( let i = 1; i < pts.length; i ++ ) L.push( L[ i - 1 ] + len( sub3( pts[ i ], pts[ i - 1 ] ) ) );
	const total = L[ L.length - 1 ];
	const at = ( s ) => {

		s = clamp( s, 0, total );
		let lo = 0, hi = L.length - 1;
		while ( hi - lo > 1 ) { const m = ( lo + hi ) >> 1; if ( L[ m ] < s ) lo = m; else hi = m; }
		return mix( pts[ lo ], pts[ hi ], ( s - L[ lo ] ) / Math.max( 1e-9, L[ hi ] - L[ lo ] ) );

	};

	// Arc length at tour time u: 2 s to speed up, 2 s to stop.
	const sp = total / ( TOUR - 2 );
	const sOf = ( u ) => u <= 0 ? 0 : u < 2 ? sp * u * u / 4 : u > TOUR - 2 ? total - sp * Math.max( 0, TOUR - u ) ** 2 / 4 : sp * ( u - 1 );
	const uOf = ( s ) => s < sp ? 2 * Math.sqrt( s / sp ) : s > total - sp ? TOUR - 2 * Math.sqrt( Math.max( 0, total - s ) / sp ) : s / sp + 1;
	const W = ROUTE.map( ( _, i ) => uOf( L[ i * N ] ) ); // tour time at each stop of the route

	const heading = ( s, w ) => { const a = at( s - w ), b = at( s + w ); return Math.atan2( b[ 0 ] - a[ 0 ], b[ 2 ] - a[ 2 ] ); };
	const wrap = ( a ) => Math.atan2( Math.sin( a ), Math.cos( a ) );
	function sub( u ) {

		const s = clamp( sOf( u ), 0.015, total - 0.015 ), a = at( s - 0.012 ), b = at( s + 0.012 ), yaw = heading( s, 0.012 );
		const turn = wrap( heading( s + 0.02, 0.012 ) - heading( s - 0.02, 0.012 ) ) / 0.04 * sp;
		return { p: at( sOf( u ) ), yaw, slow: heading( clamp( s, 0.1, total - 0.1 ), 0.1 ), pitch: - Math.atan2( b[ 1 ] - a[ 1 ], Math.hypot( b[ 0 ] - a[ 0 ], b[ 2 ] - a[ 2 ] ) ), roll: clamp( - turn * 0.6, - 0.4, 0.4 ) };

	}

	// Camera rigs: each returns { p, l } (eye, look at).
	const FRONT = TD / 2;
	const subAt = ( t ) => sub( t - INTRO );
	// Behind the submarine on its slow heading. h: height over the ground (the low skim); else dy over the submarine.
	const follow = ( t, { back, side = 0, h = null, dy = 0, ahead = 0.015 } ) => {

		const s = subAt( t ), f = [ Math.sin( s.slow ), 0, Math.cos( s.slow ) ], r = [ - Math.cos( s.slow ), 0, Math.sin( s.slow ) ];
		const x = s.p[ 0 ] - f[ 0 ] * back + r[ 0 ] * side, z = s.p[ 2 ] - f[ 2 ] * back + r[ 2 ] * side;
		return { p: [ x, h !== null ? support( x, z ) + h : s.p[ 1 ] + dy, z ], l: [ s.p[ 0 ] + f[ 0 ] * ahead, s.p[ 1 ], s.p[ 2 ] + f[ 2 ] * ahead ] };

	};

	const orbit = ( t, a, d, { h = null, dy = 0 } ) => {

		const s = subAt( t ).p, x = s[ 0 ] + Math.sin( a ) * d, z = s[ 2 ] + Math.cos( a ) * d;
		return { p: [ x, h !== null ? support( x, z ) + h : s[ 1 ] + dy, z ], l: s };

	};

	const watch = ( P, L ) => ( { p: P, l: L } );
	const push = ( T, dir, d0, d1, k ) => { const m = len( dir ), d = Math.exp( lerp( Math.log( d0 ), Math.log( d1 ), k ) ); return { p: T.map( ( v, i ) => v + dir[ i ] / m * d ), l: T }; };
	const near = ( a, b, w ) => mix( a, b, w ); // look between a creature and the submarine

	const T = ( i, dt = 0 ) => INTRO + W[ i ] + dt; // film time at stop i of the route
	const SANDPT = [ - 0.33, sand( - 0.33, 0.22 ), 0.22 ];
	// The shots, in film time. blend: seconds to ease in from the shot before; cut: no blend, the spring restarts; out: outside the water (no clamp).
	const SHOTS = [
		// Outside. A wide turn that ends over the water: the sand seen through the surface.
		{ at: 0, cut: true, out: true, rig: ( t, k ) => { const a = lerp( 0.85, 0.3, ease( k ) ), r = lerp( 1.45, 0.62, ease( k ) ); return watch( [ r * Math.sin( a ), lerp( 0.9, 0.6, ease( k ) ), r * Math.cos( a ) ], [ lerp( 0, 0.06, k ), lerp( 0.12, 0.04, k ), lerp( 0, 0.04, k ) ] ); } },
		// Down to the waterline outside the front pane, a sideways track: the post breaks at the surface.
		{ at: 8.5, blend: 3, out: true, rig: ( t, k ) => watch( [ lerp( 0.22, - 0.05, ease( k ) ), lerp( LEVEL + 0.07, LEVEL + 0.006, ease( k ) ), lerp( FRONT + 0.32, FRONT + 0.22, k ) ], [ 0.3, LEVEL - 0.01, - 0.18 ] ) },
		// Up to the pane at the waterline: the meniscus.
		{ at: 15.5, blend: 2.5, out: true, rig: ( t, k ) => { const d = Math.exp( lerp( Math.log( 0.22 ), Math.log( 0.06 ), ease( k ) ) ), x = lerp( - 0.05, - 0.08, k ); return watch( [ x, lerp( LEVEL + 0.006, LEVEL + 0.003, k ), FRONT + d ], mix( [ 0.3, LEVEL - 0.01, - 0.18 ], [ x - 0.08, LEVEL - 0.006, FRONT - 0.25 ], ease( k ) ) ); } },
		// Inside. A turn around the submarine as it dives to the sand.
		{ at: INTRO, cut: true, rig: ( t, k ) => orbit( t, lerp( 2.4, 0.9, ease( k ) ), lerp( 0.11, 0.08, k ), { dy: lerp( 0.03, - 0.01, k ) } ) },
		// The low skim: just over the sand, behind it, the starfish below.
		{ at: T( 2, - 1 ), blend: 2.5, rig: ( t ) => follow( t, { back: 0.075, side: 0.025, h: 0.009 } ) },
		// Low by the front pane: the crab's lane between the camera and the submarine.
		{ at: T( 3, 1 ), blend: 2.5, rig: ( t ) => { const s = subAt( t ).p, c = crab(); return watch( [ - 0.02, sand( - 0.02, 0.37 ) + 0.012, 0.37 ], len( sub3( c, s ) ) < 0.25 ? near( c, s, 0.6 ) : s ); } },
		// Grazing the bronze cube's top as the submarine crosses it.
		{ at: T( 4, 0.3 ), blend: 2.5, rig: ( t ) => watch( [ 0.09, 0.1265, 0.19 ], subAt( t ).p ) }, // behind it on the top: it moves away, the view turns little
		// The low skim from the side: brain coral, anemone, starfish, coral.
		{ at: T( 6, 0.5 ), blend: 2.5, rig: ( t ) => follow( t, { back: 0.04, side: 0.07, h: 0.01 } ) },
		// Under the jellyfish.
		{ at: T( 10, 0.5 ), blend: 2.5, rig: ( t ) => watch( [ 0.36, 0.05, 0.12 ], near( jelly( 0 ), subAt( t ).p, 0.5 ) ) },
		// Below and behind as it climbs between the kelp and the post.
		{ at: T( 11, 0.5 ), blend: 2.5, rig: ( t ) => follow( t, { back: 0.08, side: - 0.03, dy: - 0.03 } ) },
		// The driftwood post, down to its grain.
		{ at: T( 12, 1 ), blend: 2, rig: ( t, k ) => push( [ 0.3646, lerp( 0.17, 0.21, k ), - 0.17 ], [ 0.98, 0.15, - 0.2 ], 0.08, 0.03, ease( k * 1.2 ) ) },
		// Behind it, just under the surface, among the silver fish.
		{ at: T( 14, - 1 ), blend: 2.5, rig: ( t ) => follow( t, { back: 0.085, side: 0.02, dy: - 0.012 } ) },
		// Low under the jellyfish at the back.
		{ at: T( 15, 1 ), blend: 2.5, rig: ( t ) => watch( [ 0.03, 0.09, - 0.1 ], near( jelly( 2 ), subAt( t ).p, 0.75 ) ) },
		// The low skim past the seagrass and the fan coral.
		{ at: T( 17, - 0.5 ), blend: 2.5, rig: ( t ) => follow( t, { back: 0.07, side: 0.03, h: 0.009 } ) },
		// Grazing the granite cube's top.
		{ at: T( 19, 0.3 ), blend: 2.5, rig: ( t ) => watch( [ - 0.19, 0.176, - 0.13 ], subAt( t ).p ) },
		// The low skim among the anemones (an orbit here crossed the submarine's path).
		{ at: T( 21, 0.5 ), blend: 2.5, rig: ( t ) => follow( t, { back: 0.08, side: - 0.035, h: 0.012 } ) },
		// The sand, down to the grains.
		{ at: T( 25 ), blend: 2, rig: ( t, k ) => push( SANDPT, [ 0.15, 0.8, 0.55 ], 0.06, 0.005, ease( k * 1.2 ) ) },
		// The way up into the school, the camera pulls back.
		{ at: T( 26, 2 ), blend: 2.5, rig: ( t, k ) => orbit( t, lerp( 0.9, - 0.4, ease( k ) ), lerp( 0.09, 0.2, ease( k ) ), { dy: lerp( 0, - 0.03, k ) } ) },
	];
	const shotAt = ( i, t ) => { const a = SHOTS[ i ].at, b = SHOTS[ i + 1 ]?.at ?? INTRO + TOUR + END; return SHOTS[ i ].rig( t, Math.min( 1.3, ( t - a ) / ( b - a ) ) ); };
	const indexAt = ( t ) => { let i = 0; while ( i < SHOTS.length - 1 && SHOTS[ i + 1 ].at <= t ) i ++; return i; };
	function rig( t ) {

		const i = indexAt( t ), S = SHOTS[ i ];
		let c = shotAt( i, t );
		if ( ! S.cut && S.blend && t < S.at + S.blend ) { const k = ease( ( t - S.at ) / S.blend ), b = shotAt( i - 1, t ); c = { p: mix( b.p, c.p, k ), l: mix( b.l, c.l, k ) }; }
		return { ...c, i, out: S.out };

	}

	// Keep the eye 6 mm off every surface and 3 cm off the submarine.
	const CAM = 0.006;
	const clampCam = ( p, t ) => { const s = subAt( t ).p; return relax( p, CAM, 0, ( x, y, z ) => Math.hypot( x - s[ 0 ], y - s[ 1 ], z - s[ 2 ] ) - 0.04 ); };

	// The spring: the eye and the target follow the rig with a lag (TAU,
	// TAUL). Then two limits: the eye moves at most VMAX, the view turns at
	// most WMAX, at a rate that grows with the gap (a submarine passing near a still camera no longer whips it).
	const TAU = 0.5, TAUL = 0.7, WMAX = 35 * Math.PI / 180, WGAIN = 2.5, VMAX = 0.1, VOUT = 0.4;
	let state = null;
	const unit = ( v ) => { const n = len( v ) || 1; return v.map( ( x ) => x / n ); };
	function camera( t, dt ) {

		const c = rig( t );
		if ( ! c.out ) c.p = clampCam( c.p, t );
		if ( ! state || state.i !== c.i && SHOTS[ c.i ].cut ) state = { p: c.p, l: c.l, f: unit( sub3( c.l, c.p ) ), i: c.i };
		state.i = c.i;
		let step = sub3( c.p, state.p ).map( ( v ) => v * ( 1 - Math.exp( - dt / TAU ) ) );
		const vmax = ( c.out ? VOUT : VMAX ) * dt, m = len( step );
		if ( m > vmax ) step = step.map( ( v ) => v * vmax / m );
		state.p = state.p.map( ( v, i ) => v + step[ i ] );
		if ( ! c.out ) { const s = subAt( t ).p; state.p = relax( state.p, 0.004, 0, ( x, y, z ) => Math.hypot( x - s[ 0 ], y - s[ 1 ], z - s[ 2 ] ) - 0.03 ); }
		state.l = mix( state.l, c.l, 1 - Math.exp( - dt / TAUL ) );
		const want = unit( sub3( state.l, state.p ) ), cos = clamp( want.reduce( ( a, v, i ) => a + v * state.f[ i ], 0 ), - 1, 1 ), ang = Math.acos( cos );
		const w = Math.min( WMAX, ang * WGAIN ) * dt; // eases in and out of a turn, at most WMAX
		if ( ang > w ) { const k = w / ang; state.f = unit( state.f.map( ( v, i ) => v + ( want[ i ] - v ) * k ) ); } else state.f = want;
		const d = len( sub3( state.l, state.p ) );
		return { p: state.p, l: state.p.map( ( v, i ) => v + state.f[ i ] * d ) };

	}

	const captions = [
		[ 4.5, 8.3, 'Seen through the surface: real refraction' ],
		[ 10, 15, 'The post breaks at the waterline' ],
		[ 16.5, 21.5, 'The meniscus climbs 2.9 mm up the glass' ],
		[ INTRO + 1, INTRO + 4, 'A 3.5 cm toy submarine' ],
		[ T( 2 ), T( 2, 3.5 ), 'Skimming the sand' ],
		[ T( 4, 1 ), T( 5, 1 ), 'Bronze, computed in the shader' ],
		[ T( 7 ), T( 7, 3.5 ), 'Corals, anemones, starfish: all code' ],
		[ T( 12, 1.5 ), T( 13, 1 ), 'Driftwood, down to the grain' ],
		[ T( 15, 1.5 ), T( 15, 5 ), 'Jellyfish and kelp' ],
		[ T( 21, 1.2 ), T( 21, 4.5 ), 'Polished granite' ],
		[ T( 25, 2.4 ), T( 26, 2 ), 'Sand grains, 0.35 mm' ],
	];

	return { sub, camera, sdf, captions, W, total, INTRO, TOUR, END, u: 0 };

}
