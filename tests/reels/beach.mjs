// The paper beach film (tests/reel.mjs), 64 s:
//   0-10   aerial: the beach pops up from the sand, prop by prop
//   10-19  low along the sand: parasol, surfboard, torches, the crab
//   19-28  the dive by the pier: refraction, caustics, light shafts
//   28-33  under water, turning to the pier: its shadow on the caustics
//   33-47  back on the sand, looking out to sea: the ship comes out of
//          the haze, the clouds part
//   47-55  high over the grove: the hull's shadow sweeps the bay
//   55-60  from the sand, straight up at the hull; 60-64 the end card
//   IX_BASE=http://localhost:5213 node tests/reel.mjs tests/reels/beach.mjs beach.mp4
export const url = '/beach.html?fullres&dof';
export const seconds = Number( process.env.REEL_SECONDS ?? 64 );
export const title = { text: 'Paper Beach', sub: 'Folded paper, procedural matter, real water. In the browser.', seconds: 4.5 };
export const end = { text: 'github.com/lejrimostfa/infinitex', sub: 'Open source, MIT. three.js WebGPU.', seconds: 4 };
export const captions = [
	[ 5, 9.5, 'Every prop folded from one painted sheet of paper' ],
	[ 11, 18, 'Infinitex paper on every fold, lit by the sun and the sky' ],
	[ 20, 27, 'The water: refraction, caustics, light shafts' ],
	[ 28.5, 32.5, 'Under the surface: caustics, and the pier\'s shadow' ],
	[ 36, 46, 'Something is coming' ],
	[ 47.5, 54.5, 'A 3 km paper flagship. Its shadow crosses the bay' ],
];

export async function setup( ix ) {

	window.__T = await import( '/demo/beach/terrain.js' );
	ix.setPop( 0 );
	ix.setShip( 0 );

}

export function pose( ix, t ) {

	const { camera, controls } = ix;
	const T = window.__T;
	const ease = ( x ) => { x = Math.min( 1, Math.max( 0, x ) ); return x * x * ( 3 - 2 * x ); };
	const mix = ( a, b, k ) => a.map( ( v, i ) => v + ( b[ i ] - v ) * k );
	const set = ( p, l ) => { camera.position.set( ...p ); controls.target.set( ...l ); camera.lookAt( ...l ); };
	const seg = ( t0, t1 ) => ease( ( t - t0 ) / ( t1 - t0 ) );
	const ground = ( x, z, up ) => Math.max( T.sandHeight( x, z ), 0 ) + up;

	// The pop-up runs from 0.5 s; after 12 s everything stands.
	ix.setPop( t < 12 ? t - 0.5 : null );
	// The ship: out of sight until 34 s, then in (path t 0 to 0.35 by 47 s,
	// to 1 by 55 s: beach/ship.js eases it).
	ix.setShip( t < 34 ? 0 : t < 47 ? 0.35 * seg( 34, 47 ) : 0.35 + 0.65 * seg( 47, 55 ) );

	if ( t < 10 ) { // aerial, a slow arc from the lagoon side, coming down

		const k = seg( 0, 10 ), a = 0.55 - 0.75 * k, R = 62 - 18 * k;
		set( [ - 5 + R * Math.sin( a ), 30 - 14 * k, 5 + R * Math.cos( a ) ], [ - 9, 2.5 - 1 * k, - 7 ] );

	} else if ( t < 19 ) { // low along the sand, toward the hut

		const k = seg( 10, 19 ), x = 16 - 20 * k;
		const z = T.shoreZ( x ) - 5.5;
		set( [ x, ground( x, z, 1.5 ), z ], [ x - 12, 1.2, T.shoreZ( x - 12 ) - 1 ] );

	} else if ( t < 28 ) { // the dive beside the pier

		const k = seg( 19, 28 );
		set( mix( [ - 3, 2.6, 13 ], [ - 4.5, - 1.35, 19 ], k ), mix( [ - 7, - 0.5, 20 ], [ - 4, - 2.1, 30 ], k ) );

	} else if ( t < 33 ) { // under water, turning to look up at the pier

		const k = seg( 28, 33 );
		set( [ - 4.5, - 1.35, 19 ], mix( [ - 4, - 2.1, 30 ], [ - 8, 1.5, 9 ], k ) );

	} else if ( t < 47 ) { // on the sand, looking out to sea and up

		const k = seg( 33, 47 ), S = ix.ship.group.position;
		const P = [ - 2, ground( - 2, - 6, 1.6 ), - 6 ];
		const look = ix.ship.t > 0 ? [ S.x * 0.6, S.y * 0.55, S.z * 0.6 ] : [ 60, 260, 1500 ];
		set( P, mix( [ 30, 120, 1500 ], look, ease( k * 1.4 ) ) );

	} else if ( t < 55 ) { // high over the grove: the shadow comes in over the lagoon

		const k = seg( 47, 55 );
		set( mix( [ - 70, 95, - 120 ], [ - 40, 70, - 95 ], k ), [ 0, 0, 25 ] );

	} else { // straight up at the hull

		const k = seg( 55, 61 ), S = ix.ship.group.position;
		set( [ - 6, ground( - 6, - 14, 1.6 ), - 14 ], mix( [ - 200, 400, 400 ], [ S.x * 0.5, S.y, S.z * 0.8 ], k ) );

	}

}
