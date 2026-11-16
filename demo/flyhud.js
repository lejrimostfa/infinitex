// The flyer's UI: a board / leave button (#fly in the page panel, or a
// floating one at the bottom right when the page has no panel) and a small
// pill at the bottom with the controls while flying. On a touch screen
// (flytouch.js): the button floats at the top right (the phone layout
// hides the panel, the nav fills the bottom), the pill moves to the top
// and lists the touch controls, and the touch pad is added.
// Event bus: listens to the flyer's vehicleBoarded and vehicleLeft
// (flyer.js); the button calls flyer.board() or flyer.leave().

import { isTouch, addFlyTouch } from './flytouch.js';

const css = `
#ix-fly { position: fixed; left: 50%; bottom: 58px; transform: translateX(-50%); max-width: min(560px, calc(100vw - 32px));
	text-align: center; color: #e8e6e3; font: 12px/1.45 system-ui, sans-serif; background: rgba(16,17,20,.72);
	border: 1px solid #2a2c31; border-radius: 8px; padding: 5px 12px; z-index: 11; pointer-events: none; display: none; }
#ix-fly b { color: #d9a441; font-weight: 600; }
body.flying #ix-fly { display: block; }
body.film #ix-fly, body.film #ix-fly-btn { display: none; }
#ix-fly-btn { position: fixed; right: 14px; bottom: 14px; z-index: 10; background: rgba(16,17,20,.82); color: #e8e6e3;
	border: 1px solid #2a2c31; border-radius: 9px; padding: 9px 12px; font: 13px system-ui, sans-serif; cursor: pointer; }
#ix-fly-btn:hover { background: #2a2c31; }
body.ix-touch #ix-fly-btn { bottom: auto; top: 12px; right: 12px; }
body.ix-touch #ix-fly { bottom: auto; top: 58px; }
`;

// label: the vehicle as the button names it ('the mosquito'). fly, land:
// the button's verbs ('Steer', 'Leave' for the submarine).
export function addFlyHud( flyer, { label = 'the vehicle', key = 'V', fly = 'Fly', land = 'Land' } = {} ) {

	const style = document.createElement( 'style' );
	style.textContent = css;
	document.head.appendChild( style );

	const touch = isTouch();
	if ( touch ) addFlyTouch( flyer ); // also sets body.ix-touch
	const hint = document.createElement( 'div' );
	hint.id = 'ix-fly';
	// Key names as the visitor's layout prints them (Z on AZERTY, W on
	// QWERTY), where the browser tells (Chrome's keyboard map).
	const name = { KeyW: 'W', KeyA: 'A' };
	const fill = () => {

		hint.innerHTML = touch ? `<b>Left</b> move, turn &nbsp; <b>Right</b> nose, sideways &nbsp; <b>▲ ▼</b> up, down<br>Drag the scene to look around`
			: `<b>Space C</b> up, down &nbsp; <b>${ name.KeyW } S</b> nose down, up &nbsp; <b>${ name.KeyA } D</b> sideways &nbsp; <b>arrows</b> move, turn &nbsp; <b>Shift</b> slower<br>`
				+ `Drag to look around, scroll for the distance, <b>${ key }</b> to ${ land.toLowerCase() }`;

	};
	fill();
	navigator.keyboard?.getLayoutMap?.().then( ( m ) => { for ( const k in name ) name[ k ] = ( m.get( k ) ?? name[ k ] ).toUpperCase(); fill(); } ).catch( () => {} );
	document.body.appendChild( hint );

	let btn = touch ? null : document.getElementById( 'fly' );
	if ( touch ) document.getElementById( 'fly' )?.remove();
	if ( ! btn ) {

		btn = document.createElement( 'button' );
		btn.id = 'ix-fly-btn';
		document.body.appendChild( btn );

	}

	const k = touch ? '' : ` (${ key })`;
	const text = ( on ) => on ? `${ land }${ k }` : `${ fly } ${ label }${ k }`;
	if ( btn ) {

		btn.textContent = text( false );
		btn.onclick = () => { flyer.active ? flyer.leave() : flyer.board(); btn.blur(); };

	}

	const show = ( on ) => { document.body.classList.toggle( 'flying', on ); if ( btn ) btn.textContent = text( on ); };
	flyer.addEventListener( 'vehicleBoarded', () => show( true ) );
	flyer.addEventListener( 'vehicleLeft', () => show( false ) );

}
