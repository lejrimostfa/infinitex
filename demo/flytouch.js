// Touch controls of the flyer (flyer.js), shown on touch screens while a
// vehicle is flown (body.flying; ?touch forces them on a desktop):
//   stick     bottom left: up and down raise or lower the nose, left and
//             right turn. Analog: half way, half the rate
//   buttons   bottom right: forward (held), back (held), fast (held)
//   look      a drag anywhere else on the scene looks around (chase.js)
// They write the flyer's input.touch (flyinput.js), the same reading as
// the keys. Each control keeps its own pointer (setPointerCapture), so the
// stick and a button work together with two thumbs.
// Event bus: none. flyhud.js adds the pad; CSS shows it with body.flying.

export const isTouch = () => matchMedia( '(pointer: coarse)' ).matches || new URLSearchParams( location.search ).has( 'touch' );

const css = `
#ix-pad { display: none; }
body.flying.ix-touch #ix-pad { display: block; }
body.film #ix-pad { display: none; }
#ix-pad .stick, #ix-pad .btn { position: fixed; z-index: 12; touch-action: none; user-select: none; -webkit-user-select: none;
	background: rgba(16,17,20,.55); border: 1px solid rgba(232,230,227,.25); color: #e8e6e3; font: 600 13px system-ui, sans-serif; }
#ix-pad .stick { left: 18px; bottom: 72px; width: 124px; height: 124px; border-radius: 50%; }
#ix-pad .knob { position: absolute; left: 37px; top: 37px; width: 50px; height: 50px; border-radius: 50%;
	background: rgba(217,164,65,.85); pointer-events: none; }
#ix-pad .btn { right: 18px; border-radius: 50%; display: grid; place-items: center; }
#ix-pad .btn.on { background: rgba(217,164,65,.85); color: #101114; }
#ix-pad .fwd { bottom: 132px; width: 78px; height: 78px; }
#ix-pad .back { bottom: 72px; right: 104px; width: 54px; height: 54px; }
#ix-pad .fast { bottom: 222px; width: 54px; height: 54px; right: 30px; }
`;

export function addFlyTouch( flyer ) {

	const style = document.createElement( 'style' );
	style.textContent = css;
	document.head.appendChild( style );
	document.body.classList.add( 'ix-touch' );
	const touch = flyer.input.touch;

	const pad = document.createElement( 'div' );
	pad.id = 'ix-pad';
	pad.innerHTML = '<div class="stick"><div class="knob"></div></div>'
		+ '<div class="btn fwd">▲ Go</div><div class="btn back">▼</div><div class="btn fast">»</div>';
	document.body.appendChild( pad );

	// The stick: the knob follows the thumb within the ring.
	const stick = pad.querySelector( '.stick' ), knob = pad.querySelector( '.knob' );
	const R = 50; // px of travel
	let id = null;
	const move = ( e ) => {

		const r = stick.getBoundingClientRect();
		let dx = e.clientX - ( r.left + r.width / 2 ), dy = e.clientY - ( r.top + r.height / 2 );
		const l = Math.hypot( dx, dy );
		if ( l > R ) { dx *= R / l; dy *= R / l; }
		knob.style.transform = `translate(${ dx }px, ${ dy }px)`;
		touch.turn = - dx / R; // right turns right
		touch.nose = - dy / R; // up raises the nose

	};
	const release = () => { id = null; knob.style.transform = ''; touch.turn = touch.nose = 0; };
	stick.addEventListener( 'pointerdown', ( e ) => { id = e.pointerId; stick.setPointerCapture( id ); move( e ); e.preventDefault(); } );
	stick.addEventListener( 'pointermove', ( e ) => { if ( e.pointerId === id ) move( e ); } );
	stick.addEventListener( 'pointerup', release );
	stick.addEventListener( 'pointercancel', release );

	// Held buttons.
	const hold = ( cls, on, off ) => {

		const b = pad.querySelector( cls );
		const up = () => { b.classList.remove( 'on' ); off(); };
		b.addEventListener( 'pointerdown', ( e ) => { b.setPointerCapture( e.pointerId ); b.classList.add( 'on' ); on(); e.preventDefault(); } );
		b.addEventListener( 'pointerup', up );
		b.addEventListener( 'pointercancel', up );

	};
	hold( '.fwd', () => { touch.throttle = 1; }, () => { touch.throttle = 0; } );
	hold( '.back', () => { touch.throttle = - 0.4; }, () => { touch.throttle = 0; } );
	hold( '.fast', () => { touch.fast = true; }, () => { touch.fast = false; } );

	flyer.addEventListener( 'vehicleLeft', release );

}
