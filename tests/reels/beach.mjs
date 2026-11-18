// The paper beach film (tests/reel.mjs), 73 s:
//   0-10   aerial: the beach pops up from the sand, prop by prop
//   10-18  low along the sand: parasol, surfboard, torches, the crab
//   18-27  macro into the parasol, 3 m to 3 mm: the painting stays soft,
//          the paper's fibres come out (matter, not a picture)
//   27-35  the dive by the pier: refraction, caustics, light shafts
//   35-41  macro into the beach sand, 1.5 m to 8 mm: the grains
//   41-55  back on the sand, looking out to sea: the ship comes out of
//          the haze over the clouds
//   55-63  high over the grove: the hull's shadow crosses the bay
//   63-69  from the sand, straight up at the hull; 69-73 the end card
//   IX_BASE=http://localhost:5213 node tests/reel.mjs tests/reels/beach.mjs beach.mp4
export const url = '/beach.html?fullres&dof';
export const seconds = Number( process.env.REEL_SECONDS ?? 73 );
export const title = { text: 'Paper Beach', sub: 'Folded paper, procedural matter, real water. In the browser.', seconds: 4.5 };
export const end = { text: 'github.com/lejrimostfa/infinitex', sub: 'Open source, MIT. three.js WebGPU.', seconds: 4 };
export const captions = [
	[ 5, 9.5, 'Every prop folded from one painted sheet of paper' ],
	[ 11, 17, 'Infinitex paper on every fold, lit by the sun and the sky' ],
	[ 19, 22.5, 'Closer. It is matter, not a picture' ],
	[ 23, 26.8, 'Paper fibres, 25 µm wide' ],
	[ 28, 34, 'The water: refraction, caustics, light shafts' ],
	[ 36, 40.8, 'Beach sand, grain by grain: 0.35 mm' ],
	[ 44, 54, 'Something is coming' ],
	[ 55.5, 62.5, 'A 3 km paper flagship. Its shadow crosses the bay' ],
];

export async function setup( ix ) {

	window.__T = await import( '/demo/beach/terrain.js' );
	// Aim the parasol macro: the canopy, hit from the side the camera
	// comes from, before the pop-up flattens everything.
	ix.setPop( null );
	ix.life.update( 0 );
	ix.world.updateMatrixWorld( true );
	const para = ix.placed.find( ( o ) => o.userData.entry.name === 'parasol' ).position;
	window.__Z1 = ix.surfaceAt( [ para.x + 2.6, para.y + 4.2, para.z + 1.8 ], [ para.x + 0.35, para.y + 2.05, para.z + 0.25 ] );
	// The sand macro, on the dry beach by the shells: the mesh's own surface
	// (the formula and the 1.5 m grid differ by centimetres). Under water the
	// sand went flat under 10 cm (open bug, the port's refraction?).
	window.__Z2 = ix.surfaceAt( [ 1.2, 5, window.__T.shoreZ( 1.2 ) - 3.4 ], [ 1.2, - 5, window.__T.shoreZ( 1.2 ) - 3.4 ], ix.ground );
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
	// A macro: down a direction to a surface point, the distance falling
	// in log steps from d0 to d1 (each second covers the same zoom ratio).
	const macro = ( P, dir, d0, d1, k ) => {

		const n = Math.hypot( ...dir ), d = Math.exp( Math.log( d0 ) * ( 1 - k ) + Math.log( d1 ) * k );
		set( P.map( ( v, i ) => v + dir[ i ] / n * d ), P );

	};

	ix.setPop( t < 12 ? t - 0.5 : null );
	// The ship: out of sight until 42 s, path t 0 to 0.35 by 55 s, to 1 by
	// 63 s (beach/ship.js eases it).
	ix.setShip( t < 42 ? 0 : t < 55 ? 0.35 * seg( 42, 55 ) : 0.35 + 0.65 * seg( 55, 63 ) );

	if ( t < 10 ) { // aerial, a slow arc from the lagoon side, coming down

		const k = seg( 0, 10 ), a = 0.55 - 0.75 * k, R = 62 - 18 * k;
		set( [ - 5 + R * Math.sin( a ), 30 - 14 * k, 5 + R * Math.cos( a ) ], [ - 9, 2.5 - 1 * k, - 7 ] );

	} else if ( t < 18 ) { // low along the sand

		const k = seg( 10, 18 ), x = 16 - 9 * k;
		const z = T.shoreZ( x ) - 5.5;
		set( [ x, ground( x, z, 1.5 ), z ], [ x - 12, 1.2, T.shoreZ( x - 12 ) - 1 ] );

	} else if ( t < 27 ) { // macro into the parasol's paper

		const Z = window.__Z1, k = seg( 18.3, 26.6 );
		const dir = [ Z.normal[ 0 ] + 0.25, Z.normal[ 1 ] + 0.2, Z.normal[ 2 ] + 0.15 ]; // a little off the normal: the fibres catch the light
		macro( Z.point, dir, 3.2, 0.0025, k );

	} else if ( t < 35 ) { // the dive beside the pier

		const k = seg( 27, 35 );
		set( mix( [ - 3, 2.6, 13 ], [ - 4.5, - 1.2, 19 ], k ), mix( [ - 7, - 0.5, 20 ], [ - 4, - 2.1, 27 ], k ) );

	} else if ( t < 41 ) { // macro into the beach sand, down to the grains

		const k = seg( 35.2, 40.8 );
		macro( window.__Z2.point, [ 0.35, 1, 0.5 ], 1.5, 0.008, k );

	} else if ( t < 55 ) { // on the sand, looking out to sea and up

		const k = seg( 41, 55 ), S = ix.ship.group.position;
		const P = [ - 2, ground( - 2, - 6, 1.6 ), - 6 ];
		const look = ix.ship.t > 0 ? [ S.x * 0.6, S.y * 0.55, S.z * 0.6 ] : [ 60, 260, 1500 ];
		set( P, mix( [ 30, 120, 1500 ], look, ease( k * 1.4 ) ) );

	} else if ( t < 63 ) { // high over the grove: the shadow comes in over the lagoon

		const k = seg( 55, 63 );
		set( mix( [ - 70, 95, - 120 ], [ - 40, 70, - 95 ], k ), [ 0, 0, 25 ] );

	} else { // straight up at the hull

		const k = seg( 63, 69 ), S = ix.ship.group.position;
		set( [ - 6, ground( - 6, - 14, 1.6 ), - 14 ], mix( [ - 200, 400, 400 ], [ S.x * 0.5, S.y, S.z * 0.8 ], k ) );

	}

}
