// The flyer's controls (flyer.js), keyboard and touch in one reading.
//   keys    read by physical key, so AZERTY and QWERTY both work:
//             Space / C          up, down
//             Z / S (W / S)      nose down, nose up
//             Q / D (A / D)      turn left, right
//             arrows             forward, back, sideways left, right
//             Shift              slower
//           The toggle key (V) boards or leaves.
//   touch   input.touch: { throttle, strafe, lift, turn, nose, slow },
//           analog values from -1 to 1 that a touch pad writes
//           (flytouch.js).
// read() sums both and clamps: { throttle, strafe, lift, turn, nose, slow }.
// nose > 0 raises the nose, turn > 0 turns left, strafe > 0 moves right.
// Event bus: none. Listens to window keydown, keyup and blur; calls
// toggle() on the toggle key.

const KEYS = {
	up: [ 'Space' ], down: [ 'KeyC' ], noseDown: [ 'KeyW' ], noseUp: [ 'KeyS' ], left: [ 'KeyA' ], right: [ 'KeyD' ],
	fwd: [ 'ArrowUp' ], back: [ 'ArrowDown' ], strafeL: [ 'ArrowLeft' ], strafeR: [ 'ArrowRight' ], slow: [ 'ShiftLeft', 'ShiftRight' ],
};
const FLIGHT_KEYS = new Set( Object.values( KEYS ).flat() );
const clamp = ( x ) => Math.max( - 1, Math.min( 1, x ) );

// key: the toggle key code. isActive(): whether the vehicle is flown.
export function createFlyInput( { key, toggle, isActive } ) {

	const down = new Set();
	const held = ( k ) => KEYS[ k ].some( ( c ) => down.has( c ) ) ? 1 : 0;
	const typing = ( e ) => /INPUT|SELECT|TEXTAREA/.test( e.target?.tagName ?? '' );
	const onKeyDown = ( e ) => {

		if ( typing( e ) || e.ctrlKey || e.metaKey ) return;
		if ( e.code === key && ! e.repeat ) { toggle(); return; }
		if ( isActive() && FLIGHT_KEYS.has( e.code ) ) e.preventDefault();
		down.add( e.code );

	};
	const onKeyUp = ( e ) => down.delete( e.code );
	const onBlur = () => down.clear();
	addEventListener( 'keydown', onKeyDown );
	addEventListener( 'keyup', onKeyUp );
	addEventListener( 'blur', onBlur );

	const touch = { throttle: 0, strafe: 0, lift: 0, turn: 0, nose: 0, slow: false };
	return {

		touch,
		read() {

			return {
				throttle: clamp( held( 'fwd' ) - held( 'back' ) + touch.throttle ),
				strafe: clamp( held( 'strafeR' ) - held( 'strafeL' ) + touch.strafe ),
				lift: clamp( held( 'up' ) - held( 'down' ) + touch.lift ),
				turn: clamp( held( 'left' ) - held( 'right' ) + touch.turn ),
				nose: clamp( held( 'noseUp' ) - held( 'noseDown' ) + touch.nose ),
				slow: !! held( 'slow' ) || touch.slow,
			};

		},
		clear() { down.clear(); Object.assign( touch, { throttle: 0, strafe: 0, lift: 0, turn: 0, nose: 0, slow: false } ); },
		dispose() {

			removeEventListener( 'keydown', onKeyDown );
			removeEventListener( 'keyup', onKeyUp );
			removeEventListener( 'blur', onBlur );

		},

	};

}
