// The flyer's UI: a board / leave button (#fly in the page panel, if any)
// and a small pill at the bottom with the controls while flying.
// Event bus: listens to the flyer's vehicleBoarded and vehicleLeft
// (flyer.js); the button calls flyer.board() or flyer.leave().

const css = `
#ix-fly { position: fixed; left: 50%; bottom: 58px; transform: translateX(-50%); max-width: min(560px, calc(100vw - 32px));
	text-align: center; color: #e8e6e3; font: 12px/1.45 system-ui, sans-serif; background: rgba(16,17,20,.72);
	border: 1px solid #2a2c31; border-radius: 8px; padding: 5px 12px; z-index: 11; pointer-events: none; display: none; }
#ix-fly b { color: #d9a441; font-weight: 600; }
body.flying #ix-fly { display: block; }
body.film #ix-fly { display: none; }
`;

// label: the vehicle as the button names it ('the mosquito').
export function addFlyHud( flyer, { label = 'the vehicle', key = 'V' } = {} ) {

	const style = document.createElement( 'style' );
	style.textContent = css;
	document.head.appendChild( style );

	const hint = document.createElement( 'div' );
	hint.id = 'ix-fly';
	// Key names as the visitor's layout prints them (Z on AZERTY, W on
	// QWERTY), where the browser tells (Chrome's keyboard map).
	const name = { KeyW: 'W', KeyA: 'A' };
	const fill = () => {

		hint.innerHTML = `<b>${ name.KeyW } S</b> nose up, down &nbsp; <b>${ name.KeyA } D</b> turn &nbsp; <b>Space</b> forward &nbsp; <b>C</b> back &nbsp; <b>Shift</b> faster<br>`
			+ `Drag to look around, scroll for the distance, <b>${ key }</b> to land`;

	};
	fill();
	navigator.keyboard?.getLayoutMap?.().then( ( m ) => { for ( const k in name ) name[ k ] = ( m.get( k ) ?? name[ k ] ).toUpperCase(); fill(); } ).catch( () => {} );
	document.body.appendChild( hint );

	const btn = document.getElementById( 'fly' );
	const text = ( on ) => on ? `Land (${ key })` : `Fly ${ label } (${ key })`;
	if ( btn ) {

		btn.textContent = text( false );
		btn.onclick = () => { flyer.active ? flyer.leave() : flyer.board(); btn.blur(); };

	}

	const show = ( on ) => { document.body.classList.toggle( 'flying', on ); if ( btn ) btn.textContent = text( on ); };
	flyer.addEventListener( 'vehicleBoarded', () => show( true ) );
	flyer.addEventListener( 'vehicleLeft', () => show( false ) );

}
