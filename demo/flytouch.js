// Touch controls of the flyer (flyer.js), shown on touch screens while a
// vehicle is flown (body.flying; ?touch forces them on a desktop). They
// follow the keys (flyinput.js):
//   left stick    the arrows: forward, back, turn
//   right stick   Z / S / Q / D: up on the stick dips the nose (Z), down
//                 raises it (S), left and right move sideways
//   buttons       above the right stick: up (Space) and down (C), held;
//                 above the left one: the top speed (Shift), a tap goes
//                 slow, medium, fast
//   look          a drag anywhere else on the scene looks around (chase.js)
// Analog: half way, half the speed or rate. Each control keeps its own
// pointer (setPointerCapture), so both thumbs work together.
// They write the flyer's input.touch, read with the keys.
// Event bus: none. flyhud.js adds the pad; CSS shows it with body.flying.

export const isTouch = () => matchMedia( '(pointer: coarse)' ).matches || new URLSearchParams( location.search ).has( 'touch' );

const css = `
#ix-pad { display: none; }
body.flying.ix-touch #ix-pad { display: block; }
body.film #ix-pad { display: none; }
#ix-pad .stick, #ix-pad .btn { position: fixed; z-index: 12; touch-action: none; user-select: none; -webkit-user-select: none;
	background: rgba(16,17,20,.55); border: 1px solid rgba(232,230,227,.25); color: #e8e6e3; font: 600 15px system-ui, sans-serif; border-radius: 50%; }
#ix-pad .stick { bottom: 72px; width: 118px; height: 118px; }
#ix-pad .stick.l { left: 16px; } #ix-pad .stick.r { right: 16px; }
#ix-pad .stick small { position: absolute; left: 0; right: 0; top: -18px; text-align: center; font: 600 11px system-ui, sans-serif; color: #f2f0ed; text-shadow: 0 1px 3px rgba(0,0,0,.9); }
#ix-pad .knob { position: absolute; left: 35px; top: 35px; width: 48px; height: 48px; border-radius: 50%; background: rgba(217,164,65,.85); pointer-events: none; }
#ix-pad .btn { width: 52px; height: 52px; display: grid; place-items: center; }
#ix-pad .btn.on { background: rgba(217,164,65,.85); color: #101114; }
#ix-pad .up { right: 82px; bottom: 214px; } #ix-pad .down { right: 22px; bottom: 214px; }
#ix-pad .gearbtn { left: 22px; bottom: 214px; width: 68px; border-radius: 26px; font-size: 12px; }
`;

export function addFlyTouch( flyer ) {

	const style = document.createElement( 'style' );
	style.textContent = css;
	document.head.appendChild( style );
	document.body.classList.add( 'ix-touch' );
	const touch = flyer.input.touch;

	const pad = document.createElement( 'div' );
	pad.id = 'ix-pad';
	pad.innerHTML = '<div class="stick l"><small>move, turn</small><div class="knob"></div></div>'
		+ '<div class="stick r"><small>nose, side</small><div class="knob"></div></div>'
		+ '<div class="btn up">▲</div><div class="btn down">▼</div><div class="btn gearbtn gear">' + flyer.gear + '</div>';
	document.body.appendChild( pad );

	// A stick: the knob follows the thumb within the ring; set( x, y ) gets
	// -1 to 1, y up.
	const R = 48; // px of travel
	const releases = [];
	function stick( el, set ) {

		const knob = el.querySelector( '.knob' );
		let id = null;
		const move = ( e ) => {

			const r = el.getBoundingClientRect();
			let dx = e.clientX - ( r.left + r.width / 2 ), dy = e.clientY - ( r.top + r.height / 2 );
			const l = Math.hypot( dx, dy );
			if ( l > R ) { dx *= R / l; dy *= R / l; }
			knob.style.transform = `translate(${ dx }px, ${ dy }px)`;
			set( dx / R, - dy / R );

		};
		const release = () => { id = null; knob.style.transform = ''; set( 0, 0 ); };
		el.addEventListener( 'pointerdown', ( e ) => { id = e.pointerId; el.setPointerCapture( id ); move( e ); e.preventDefault(); } );
		el.addEventListener( 'pointermove', ( e ) => { if ( e.pointerId === id ) move( e ); } );
		el.addEventListener( 'pointerup', release );
		el.addEventListener( 'pointercancel', release );
		releases.push( release );

	}

	stick( pad.querySelector( '.stick.l' ), ( x, y ) => { touch.turn = - x; touch.throttle = y; } );
	stick( pad.querySelector( '.stick.r' ), ( x, y ) => { touch.strafe = x; touch.nose = - y; } ); // up dips the nose, as Z

	// Held buttons.
	const hold = ( cls, set ) => {

		const b = pad.querySelector( cls );
		const up = () => { b.classList.remove( 'on' ); set( false ); };
		b.addEventListener( 'pointerdown', ( e ) => { b.setPointerCapture( e.pointerId ); b.classList.add( 'on' ); set( true ); e.preventDefault(); } );
		b.addEventListener( 'pointerup', up );
		b.addEventListener( 'pointercancel', up );
		releases.push( up );

	};
	let rise = false, sink = false;
	const lift = () => { touch.lift = ( rise ? 1 : 0 ) - ( sink ? 1 : 0 ); };
	hold( '.up', ( on ) => { rise = on; lift(); } );
	hold( '.down', ( on ) => { sink = on; lift(); } );
	const gb = pad.querySelector( '.gearbtn' ); // its label follows gearChanged (flyhud.js)
	gb.addEventListener( 'pointerdown', ( e ) => { flyer.nextGear(); e.preventDefault(); } );

	flyer.addEventListener( 'vehicleLeft', () => releases.forEach( ( r ) => r() ) );

}
