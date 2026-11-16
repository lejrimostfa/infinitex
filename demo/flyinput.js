// The flyer's controls (flyer.js), keyboard and touch in one reading.
//   keys    Z / S on AZERTY (W / S on QWERTY, read by physical key) or up /
//           down arrows: the nose. Q / D (A / D) or left / right: turn.
//           Space forward, C back, Shift faster. The toggle key (V)
//           boards or leaves.
//   touch   input.touch: { turn, nose, throttle, fast }, analog values
//           from -1 to 1 that a touch pad writes (flytouch.js).
// read() sums both and clamps: { throttle, turn, nose, fast }.
// Event bus: none. Listens to window keydown, keyup and blur; calls
// toggle() on the toggle key.

const KEYS = {
	noseUp: [ 'KeyW', 'ArrowUp' ], noseDown: [ 'KeyS', 'ArrowDown' ], left: [ 'KeyA', 'ArrowLeft' ], right: [ 'KeyD', 'ArrowRight' ],
	fwd: [ 'Space' ], back: [ 'KeyC' ], fast: [ 'ShiftLeft', 'ShiftRight' ],
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

	const touch = { turn: 0, nose: 0, throttle: 0, fast: false };
	return {

		touch,
		read() {

			return {
				throttle: clamp( held( 'fwd' ) - held( 'back' ) * 0.4 + touch.throttle ),
				turn: clamp( held( 'left' ) - held( 'right' ) + touch.turn ),
				nose: clamp( held( 'noseUp' ) - held( 'noseDown' ) + touch.nose ),
				fast: !! held( 'fast' ) || touch.fast,
			};

		},
		clear() { down.clear(); Object.assign( touch, { turn: 0, nose: 0, throttle: 0, fast: false } ); },
		dispose() {

			removeEventListener( 'keydown', onKeyDown );
			removeEventListener( 'keyup', onKeyUp );
			removeEventListener( 'blur', onBlur );

		},

	};

}
