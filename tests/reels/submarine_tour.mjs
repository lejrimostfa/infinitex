// The submarine tour (tests/reel.mjs): one minute around the aquarium of
// the Water page. The toy submarine follows a written path (a spline
// through WAY) over the bronze cube, past the corals, up the driftwood
// post, over the granite cube and back low over the sand. The camera
// turns around it and, a few times, leaves it for the matter next to it.
// Nothing is steered by keys: setup() replaces the flyer's update, so the
// same film comes out at every run.
//   REEL_SECONDS  film length (default 62: 58 s of path, 4 s of end card)
export const url = '/aquarium.html?dof&fullres';
export const seconds = Number( process.env.REEL_SECONDS ?? 62 );
export const title = { text: 'The submarine tour', sub: 'An aquarium built in code. three.js, no texture files.', seconds: 4 };
export const end = { text: 'github.com/lejrimostfa/infinitex', sub: 'Open source, MIT. Press V in the live demo to steer it.', seconds: 4 };
export const captions = [
	[ 4.3, 7.3, 'A 3.5 cm toy submarine' ],
	[ 8.8, 12, 'Bronze, computed in the shader' ],
	[ 18.6, 22, 'Driftwood, down to the grain' ],
	[ 24, 28, 'Kelp, fish and jellyfish, all built in code' ],
	[ 35.6, 39.4, 'Polished granite' ],
	[ 49.8, 52.5, 'Sand grains, 0.35 mm' ],
];

export async function setup( ix ) {

	const TOUR = 58; // seconds of path
	// [ x, y, z ] in metres. The tank is 1.2 x 0.8, the water 0.35 deep.
	const WAY = [
		[ - 0.16, 0.3, 0.22 ], [ 0, 0.24, 0.21 ],
		[ 0.12, 0.155, 0.16 ], // over the bronze cube
		[ 0.25, 0.09, 0.09 ],
		[ 0.355, 0.08, 0.01 ], // past the brain coral
		[ 0.43, 0.1, - 0.1 ],
		[ 0.44, 0.16, - 0.2 ], // up the driftwood post
		[ 0.33, 0.23, - 0.315 ], // behind it
		[ 0.19, 0.3, - 0.27 ], // over the kelp
		[ 0.04, 0.3, - 0.17 ], [ - 0.12, 0.24, - 0.12 ],
		[ - 0.25, 0.19, - 0.12 ], // over the granite cube
		[ - 0.39, 0.13, - 0.07 ],
		[ - 0.44, 0.08, 0.04 ], // the orange anemone
		[ - 0.36, 0.065, 0.17 ],
		[ - 0.22, 0.075, 0.2 ], // the pink anemone
		[ - 0.06, 0.065, 0.245 ], // the starfish
		[ 0.06, 0.12, 0.27 ], [ 0.2, 0.22, 0.27 ], [ 0.3, 0.3, 0.2 ],
	];
	const N = 40, pts = [], n = WAY.length;
	const cr = ( a, b, c, d, u ) => b.map( ( _, i ) => 0.5 * ( 2 * b[ i ] + ( c[ i ] - a[ i ] ) * u + ( 2 * a[ i ] - 5 * b[ i ] + 4 * c[ i ] - d[ i ] ) * u * u + ( 3 * b[ i ] - a[ i ] - 3 * c[ i ] + d[ i ] ) * u * u * u ) );
	for ( let i = 0; i < n - 1; i ++ ) for ( let k = 0; k < N; k ++ ) pts.push( cr( WAY[ Math.max( i - 1, 0 ) ], WAY[ i ], WAY[ i + 1 ], WAY[ Math.min( i + 2, n - 1 ) ], k / N ) );
	pts.push( WAY[ n - 1 ] );
	const L = [ 0 ];
	for ( let i = 1; i < pts.length; i ++ ) L.push( L[ i - 1 ] + Math.hypot( ...pts[ i ].map( ( v, j ) => v - pts[ i - 1 ][ j ] ) ) );
	const total = L[ L.length - 1 ];
	const at = ( s ) => { // the point at arc length s

		s = Math.min( total, Math.max( 0, s ) );
		let i = 1;
		while ( i < L.length - 1 && L[ i ] < s ) i ++;
		const k = ( s - L[ i - 1 ] ) / Math.max( 1e-9, L[ i ] - L[ i - 1 ] );
		return pts[ i - 1 ].map( ( v, j ) => v + ( pts[ i ][ j ] - v ) * k );

	};
	const speed = total / TOUR;
	const yawAt = ( s ) => { const a = at( s - 0.012 ), b = at( s + 0.012 ); return Math.atan2( b[ 0 ] - a[ 0 ], b[ 2 ] - a[ 2 ] ); };
	// The submarine at film time t: place, heading, nose angle, bank.
	const sub = ( t ) => {

		const s = Math.min( total - 0.013, Math.max( 0.013, speed * t ) );
		const a = at( s - 0.012 ), b = at( s + 0.012 ), yaw = yawAt( s );
		let turn = yawAt( s + 0.01 ) - yawAt( s - 0.01 );
		turn = Math.atan2( Math.sin( turn ), Math.cos( turn ) ) / 0.02 * speed; // radians a second
		return { p: at( s ), yaw, pitch: - Math.atan2( b[ 1 ] - a[ 1 ], Math.hypot( b[ 0 ] - a[ 0 ], b[ 2 ] - a[ 2 ] ) ), roll: Math.max( - 0.45, Math.min( 0.45, - turn * 0.6 ) ) };

	};

	// Camera rigs. Each returns { p, l }: the eye and what it looks at.
	const ease = ( x ) => { x = Math.min( 1, Math.max( 0, x ) ); return x * x * ( 3 - 2 * x ); };
	const mix = ( a, b, k ) => a.map( ( v, i ) => v + ( b[ i ] - v ) * k );
	const lerp = ( a, b, k ) => a + ( b - a ) * k;
	// Around the submarine: azimuth a (0 = seen from +z), distance d, height h over it.
	const orbit = ( t, a, d, h ) => { const s = sub( t ).p; return { p: [ s[ 0 ] + Math.sin( a ) * d, s[ 1 ] + h, s[ 2 ] + Math.cos( a ) * d ], l: s }; };
	// Onto a point T of a surface, along dir, from d0 to d1 (the distance falls by ratio: a steady approach on screen).
	const push = ( T, dir, d0, d1, k ) => { const m = Math.hypot( ...dir ), d = Math.exp( lerp( Math.log( d0 ), Math.log( d1 ), k ) ); return { p: T.map( ( v, i ) => v + dir[ i ] / m * d ), l: T }; };

	let ground = () => 0.02;
	try {

		const { sandFloor } = await import( '/demo/sealife/seafloor.js' );
		ground = sandFloor( { family: 'ground', mode: 'sand', grain_mm: 0.35, color: '#d6bd92', color2: '#b8804f', color3: '#2b2622', ripple_mm: 90, ripple: 0.5, specks: 0.4, sparkle: 0.5, roughness: 0.8, seed: 2, dune: 1 }, { width: 1.2, depth: 0.8 } );

	} catch ( e ) { /* node: no page to import from */ }
	const SAND = [ - 0.1, 0, 0.13 ];
	SAND[ 1 ] = ground( SAND[ 0 ], SAND[ 2 ] );

	// The shots. from: start (s); blend: seconds to ease in from the shot before (0 cuts); rig( t, k ): k runs 0 to 1 over the shot.
	const SHOTS = [
		// Opening: most of a turn around the submarine as it dives to the bronze cube.
		{ from: 0, blend: 0, rig: ( t, k ) => orbit( t, lerp( 2.5, - 1.9, ease( k ) ), lerp( 0.17, 0.085, ease( k ) ), lerp( 0.045, 0.012, k ) ) },
		// The bronze cube: its top, from 9 cm to 6 mm, as the submarine leaves it.
		{ from: 7.6, blend: 1.6, rig: ( t, k ) => push( [ 0.135, 0.12, 0.165 ], [ - 0.35, 0.75, 0.6 ], 0.09, 0.006, ease( k * 1.15 ) ) },
		// Back to the submarine, low, as it rounds the brain coral and reaches the post.
		{ from: 12, blend: 2.2, rig: ( t, k ) => orbit( t, lerp( 2.2, 0.9, ease( k ) ), lerp( 0.1, 0.075, k ), lerp( 0.07, 0.005, ease( k * 1.6 ) ) ) }, // it starts high: the way back clears the cube's edge
		// The driftwood post: its face toward the pane, while the submarine climbs past it.
		{ from: 17.6, blend: 1.6, rig: ( t, k ) => push( [ 0.3686, lerp( 0.13, 0.16, k ), - 0.165 ], [ 0.98, 0.15, 0.25 ], 0.07, 0.007, ease( k * 1.2 ) ) },
		// Cut: behind the post, the camera follows the submarine over the kelp, then swings ahead of it.
		{ from: 22.2, blend: 0, rig: ( t, k ) => orbit( t, lerp( 1.6, - 0.9, ease( k ) ), lerp( 0.085, 0.115, k ), lerp( 0.012, 0.0, k ) ) },
		// The glide down to the granite cube, the camera comes round to its front.
		{ from: 28.5, blend: 2, rig: ( t, k ) => orbit( t, lerp( - 0.9, 0.35, ease( k ) ), lerp( 0.115, 0.085, k ), lerp( 0.0, 0.03, k ) ) },
		// The granite cube: its top.
		{ from: 34.5, blend: 1.6, rig: ( t, k ) => push( [ - 0.235, 0.16, - 0.1 ], [ 0.25, 0.8, 0.55 ], 0.08, 0.006, ease( k * 1.2 ) ) },
		// Back to the submarine among the anemones, a slow turn around it. It starts high: the way back clears the cube.
		{ from: 39.5, blend: 2, rig: ( t, k ) => orbit( t, lerp( 0.5, 2.6, ease( k ) ), lerp( 0.085, 0.1, k ), lerp( 0.08, 0.03, ease( k * 2 ) ) ) },
		// The sand beside its path: down to the grains.
		{ from: 48.6, blend: 1.6, rig: ( t, k ) => push( SAND, [ 0.15, 0.8, 0.55 ], 0.07, 0.004, ease( k * 1.2 ) ) },
		// The way up: the camera pulls back as the submarine rises to the surface.
		{ from: 52.6, blend: 1.6, rig: ( t, k ) => orbit( t, lerp( 0.9, - 0.4, ease( k ) ), lerp( 0.09, 0.2, ease( k ) ), lerp( 0.0, - 0.03, k ) ) },
	];
	const shotAt = ( i, t ) => { const a = SHOTS[ i ].from, b = SHOTS[ i + 1 ]?.from ?? TOUR + 4; return SHOTS[ i ].rig( t, Math.min( 1.3, ( t - a ) / ( b - a ) ) ); }; // a shot goes on a little while the next eases in
	const cam = ( t ) => {

		let i = 0;
		while ( i < SHOTS.length - 1 && SHOTS[ i + 1 ].from <= t ) i ++;
		let c = shotAt( i, t );
		const S = SHOTS[ i ];
		if ( i > 0 && S.blend > 0 && t < S.from + S.blend ) {

			const k = ease( ( t - S.from ) / S.blend ), prev = shotAt( i - 1, t );
			c = { p: mix( prev.p, c.p, k ), l: mix( prev.l, c.l, k ) };

		}

		// Stay in the water: inside the panes, over the sand, under the surface.
		c.p[ 0 ] = Math.min( 0.585, Math.max( - 0.585, c.p[ 0 ] ) );
		c.p[ 2 ] = Math.min( 0.385, Math.max( - 0.385, c.p[ 2 ] ) );
		c.p[ 1 ] = Math.min( 0.338, Math.max( ground( c.p[ 0 ], c.p[ 2 ] ) + 0.003, c.p[ 1 ] ) );
		return c;

	};

	window.__tour = { sub, cam, total, speed, WAY, wayTimes: WAY.map( ( _, i ) => L[ Math.min( i * N, L.length - 1 ) ] / speed ), t: 0 };

	// The flyer no longer drives the model: the path does. The propeller
	// turns as at cruise speed.
	const v = ix?.vehicle;
	if ( v ) v.update = ( dt, clock ) => {

		const s = sub( window.__tour.t ), g = v.model.group;
		v.position.set( ...s.p );
		g.position.set( ...s.p );
		g.rotation.set( s.pitch, s.yaw, s.roll, 'YXZ' );
		v.model.pose( clock, 0.55, 1 );

	};

}

export function pose( ix, t ) {

	const { camera, controls } = ix, T = window.__tour;
	T.t = t;
	const c = T.cam( t );
	camera.position.set( ...c.p );
	controls.target.set( ...c.l );
	camera.lookAt( ...c.l );

}
