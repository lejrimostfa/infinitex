// The submarine showcase (tests/reel.mjs): steer the 3.5 cm toy submarine of the Water page down to the sand
// (V boards, the up arrow flies forward: flyer.js). The wheel events sent
// by pose() bring the chase camera closer, as a visitor's wheel does.
export const url = '/aquarium.html?dof&fullres';
export const seconds = Number( process.env.REEL_SECONDS ?? 28 );
export const title = { text: 'Steer a 3.5 cm submarine', sub: 'In an aquarium built in code. three.js, no textures.', seconds: 4.5 };
export const end = { text: 'github.com/lejrimostfa/infinitex', sub: 'Open source, MIT. Press V in the live demo.', seconds: 4 };
export const captions = [
	[ 5.5, 10.5, 'Fish, kelp and caustics, all procedural' ],
	[ 11.5, 16.5, 'The speed follows the distance to the sand' ],
	[ 17.5, 23, 'Sand grains, 0.35 mm' ],
];
const hold = ( a, b, code ) => [ [ a, code, true ], [ b, code, false ] ];
export const keys = [
	...hold( 4.6, 4.7, 'KeyV' ),
	...hold( 5.5, 9.5, 'ArrowUp' ),
	...hold( 9.5, 10.2, 'KeyW' ),
	...hold( 10.8, 17, 'ArrowUp' ),
];
export const ORBIT = [ 0.22, 0.05, 0.5, - 0.5 ]; // opening shot: [ distance, height, start angle, sweep ] around the vehicle
export const ZOOM = []; // [ from, to, wheel delta a second ] spans of the chase zoom

export function setup( ix ) {

	window.__orbit = [ 0.22, 0.05, 0.5, - 0.5 ];
	window.__zoom = [];

}

export function pose( ix, t, dt ) {

	const { camera, controls, vehicle } = ix;
	if ( t < 4.6 ) { // a slow arc around the waiting vehicle

		const [ d, h, a0, sweep ] = window.__orbit, k = t / 4.6, a = a0 + sweep * k * k * ( 3 - 2 * k ), p = vehicle.position;
		camera.position.set( p.x + Math.sin( a ) * d, p.y + h, p.z + Math.cos( a ) * d );
		controls.target.copy( p );
		camera.lookAt( p );
		return;

	}

	for ( const [ a, b, perSecond ] of window.__zoom ) if ( t >= a && t < b )
		document.querySelector( 'canvas' ).dispatchEvent( new WheelEvent( 'wheel', { deltaY: perSecond * dt, bubbles: true, cancelable: true } ) );

}
