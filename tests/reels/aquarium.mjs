// The aquarium showcase (tests/reel.mjs): wide, dive, glass, life, crab, sand grains.
export const url = '/aquarium.html?dof&fullres&nofly';
export const seconds = Number( process.env.REEL_SECONDS ?? 46 );
export const title = { text: 'Infinitex', sub: 'Procedural materials for three.js, under water', seconds: 4.5 };
export const end = { text: 'github.com/lejrimostfa/infinitex', sub: 'Open source, MIT. Runs in the browser.', seconds: 4 };
export const captions = [
	[ 6, 14.5, 'Real refraction at the surface, Snell\'s window from below' ],
	[ 15.5, 20.5, '8 mm glass panes, with their refractive index' ],
	[ 21.5, 27.5, 'Fish, jellyfish, kelp and corals, all built in code' ],
	[ 28.5, 33.5, 'A crab walks on the displaced sand' ],
	[ 34.5, 38.5, 'Get closer' ],
	[ 38.5, 41.8, 'Sand grains, 0.35 mm' ],
];

export async function setup( ix ) {

	const { sandFloor } = await import( '/demo/sealife/seafloor.js' );
	const sand = { family: 'ground', mode: 'sand', grain_mm: 0.35, color: '#d6bd92', color2: '#b8804f', color3: '#2b2622', ripple_mm: 90, ripple: 0.5, specks: 0.4, sparkle: 0.5, roughness: 0.8, seed: 2, dune: 1 };
	window.__sandH = sandFloor( sand, { width: 1.2, depth: 0.8 } );
	window.__crab = ix.life.find( ( l ) => l.position && l.group ).position; // the crab's live position

}

export function pose( ix, t ) {

	const { camera, controls } = ix;
	const ease = ( x ) => { x = Math.min( 1, Math.max( 0, x ) ); return x * x * ( 3 - 2 * x ); };
	const mix = ( a, b, k ) => a.map( ( v, i ) => v + ( b[ i ] - v ) * k );
	const set = ( p, l ) => { camera.position.set( ...p ); controls.target.set( ...l ); camera.lookAt( ...l ); };
	const seg = ( t0, t1 ) => ease( ( t - t0 ) / ( t1 - t0 ) );

	if ( t < 5 ) { // wide, a slow turn around the tank

		const a = 0.52 + 0.12 * t / 5, r = 1.22;
		set( [ r * Math.sin( a ), 0.95 - 0.05 * t / 5, r * Math.cos( a ) ], [ 0, 0.12, 0 ] );

	} else if ( t < 15 ) ix.dive( ( t - 5 ) * 1.6 ); // the dive through the surface
	else if ( t < 21 ) { // through the front pane

		const k = seg( 15, 21 );
		set( mix( [ - 0.12, 0.21, 1.05 ], [ 0.06, 0.18, 0.72 ], k ), mix( [ - 0.05, 0.17, 0 ], [ 0.08, 0.15, 0 ], k ) );

	} else if ( t < 28 ) { // inside, past the jellyfish and the kelp

		const k = seg( 21, 28 );
		set( mix( [ - 0.4, 0.14, 0.3 ], [ - 0.05, 0.2, 0.22 ], k ), mix( [ 0.05, 0.16, - 0.2 ], [ 0.35, 0.24, - 0.22 ], k ) );

	} else if ( t < 34 ) { // the crab

		const k = seg( 28, 34 ), c = window.__crab;
		const L = [ c.x, c.y + 0.02, c.z ];
		set( [ c.x + 0.2 - 0.16 * k, c.y + 0.075 - 0.015 * k, 0.392 ], [ c.x, c.y + 0.015, c.z - 0.03 ] );

	} else { // down to the grains: same direction, the distance falls from 16 cm to 4 mm

		const k = seg( 34.3, 41.5 );
		const P = [ - 0.14, 0, 0.24 ];
		P[ 1 ] = window.__sandH( P[ 0 ], P[ 2 ] );
		const d = Math.exp( Math.log( 0.16 ) * ( 1 - k ) + Math.log( 0.004 ) * k );
		const dir = [ 0.1, 0.8, 0.55 ], n = Math.hypot( ...dir );
		set( P.map( ( v, i ) => v + dir[ i ] / n * d ), P );

	}

}
