// The bee showcase (tests/reel.mjs): fly the honeybee of the Room page to the skin of an orange
// (V boards, the up arrow flies forward: flyer.js). The wheel events sent
// by pose() bring the chase camera closer, as a visitor's wheel does.
export const url = '/livingroom.html?dof&fullres';
export const seconds = Number( process.env.REEL_SECONDS ?? 28 );
export const title = { text: 'Fly a honeybee', sub: 'From the room to the skin of an orange. three.js, no textures.', seconds: 4.5 };
export const end = { text: 'github.com/lejrimostfa/infinitex', sub: 'Open source, MIT. Press V in the live demo.', seconds: 4 };
export const captions = [
	[ 5.5, 10.5, '700 hairs on its back, built in code' ],
	[ 11.5, 16.5, 'The speed follows the room ahead' ],
	[ 17.5, 23, 'Orange peel, pore by pore' ],
];
const hold = ( a, b, code ) => [ [ a, code, true ], [ b, code, false ] ];
export const keys = [
	...hold( 4.6, 4.7, 'KeyV' ),
	...hold( 5.5, 5.95, 'KeyW' ),
	...hold( 6.2, 12, 'ArrowUp' ),
];
export const ORBIT = [ 0.09, 0.03, - 1.2, 0.7 ]; // opening shot: [ distance, height, start angle, sweep ] around the vehicle
export const ZOOM = []; // [ from, to, wheel delta a second ] spans of the chase zoom

export function setup( ix ) {

	window.__orbit = [ 0.09, 0.03, - 1.2, 0.7 ];
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
