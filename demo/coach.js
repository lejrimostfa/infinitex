// The coach: a card at the bottom of every demo that pushes the visitor
// toward what the page is made for. Many visitors orbit once and leave,
// and never see the matter up close or the little vehicle. Two tips:
//   zoom   scroll in (pinch on a touch screen): the detail goes down to the
//          page's finest scale (DETAIL below)
//   fly    press V (tap Fly) to board the page's vehicle
// It shows once the page is ready (window.__ix.ready). A tip is ticked when
// the visitor does it, and the card leaves when both are done or on its
// close button. Done tips are remembered for the page (localStorage), so a
// second visit only shows what is left. After NUDGE seconds with nothing
// done, the card pulses once. A light runs around its edge all the time
// (a conic gradient on a registered angle, masked to a 2 px ring, plus a
// blurred copy for the glow); still with prefers-reduced-motion. The fly
// tip is a button: a click boards the vehicle. Hidden in film mode
// (body.film) and while flying (body.flying).
// Called by addFlyHud (flyhud.js), so every page with a vehicle has it.
// Event bus: an EventTarget. It emits
//   tipDone      { tip: 'zoom' | 'fly' }
//   coachClosed  { done: [ tips ] }
// It listens to the flyer's vehicleBoarded (flyer.js) and to the canvas's
// wheel and touch events.

const DETAIL = { // the finest scale each page shows
	'index.html': 'the fibres of the yarn',
	'character.html': 'the fibres of the yarn',
	'cubes.html': 'the microstructure of every matter',
	'aquarium.html': 'single grains of sand',
	'livingroom.html': 'the pores of the orange peel',
};
const NUDGE = 20; // seconds before the card pulses
const KEY = 'ix-coach:';

const css = `
@property --ix-coach-a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes ix-coach-spin { to { --ix-coach-a: 360deg; } }
#ix-coach::before, #ix-coach::after { content: ''; position: absolute; inset: -2px; padding: 2px; border-radius: 12px; pointer-events: none;
	background: conic-gradient(from var(--ix-coach-a), transparent 0deg 220deg, rgba(217,164,65,.5) 270deg, #ffe7a8 320deg, #fffaf0 338deg, #d9a441 350deg, transparent 360deg);
	-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
	animation: ix-coach-spin 3.2s linear infinite; }
#ix-coach::after { filter: blur(7px); opacity: .9; }
@media (prefers-reduced-motion: reduce) { #ix-coach::before, #ix-coach::after { animation: none; } }
#ix-coach { position: fixed; left: 50%; bottom: 58px; transform: translateX(-50%); width: max-content; max-width: min(460px, calc(100vw - 32px));
	color: #e8e6e3; font: 14px/1.45 system-ui, sans-serif; background: rgba(16,17,20,.88); border: 1px solid rgba(217,164,65,.3);
	border-radius: 10px; padding: 10px 34px 10px 14px; z-index: 12; box-shadow: 0 6px 24px rgba(0,0,0,.45);
	opacity: 0; transition: opacity .5s; pointer-events: none; }
#ix-coach.on { opacity: 1; pointer-events: auto; }
#ix-coach.pulse { animation: ix-coach-pulse 1.2s ease-in-out 2; }
@keyframes ix-coach-pulse { 50% { box-shadow: 0 0 0 6px rgba(217,164,65,.35), 0 6px 24px rgba(0,0,0,.45); } }
#ix-coach .tip { display: flex; gap: 10px; align-items: baseline; padding: 2px 0; transition: opacity .4s; }
#ix-coach .tip.done { opacity: .45; text-decoration: line-through; }
#ix-coach .tip[data-tip="fly"]:not(.done) { cursor: pointer; border-radius: 6px; margin: 0 -6px; padding: 2px 6px; }
#ix-coach .tip[data-tip="fly"]:not(.done):hover { background: rgba(217,164,65,.15); }
#ix-coach .tip i { font-style: normal; color: #d9a441; width: 14px; flex: none; }
#ix-coach kbd { font: 600 12px system-ui, sans-serif; color: #101114; background: #d9a441; border-radius: 4px; padding: 1px 6px; }
#ix-coach button { position: absolute; right: 6px; top: 6px; background: none; border: 0; color: #9a9ca3; font-size: 16px; cursor: pointer; padding: 2px 6px; }
#ix-coach button:hover { color: #e8e6e3; }
body.film #ix-coach, body.flying #ix-coach { display: none; }
`;

export function addCoach( flyer, { label = 'the vehicle', key = 'V', touch = false } = {} ) {

	const bus = new EventTarget();
	const page = location.pathname.split( '/' ).pop() || 'index.html';
	const store = { get: () => { try { return JSON.parse( localStorage.getItem( KEY + page ) ) ?? []; } catch { return []; } },
		set: ( v ) => { try { localStorage.setItem( KEY + page, JSON.stringify( v ) ); } catch { /* private window */ } } };
	const done = new Set( store.get() );
	const TIPS = [
		[ 'zoom', touch ? '<kbd>Pinch</kbd> in on any surface' : '<kbd>Scroll</kbd> in on any surface',
			`: the detail goes down to ${ DETAIL[ page ] ?? 'the microns' }.` ],
		[ 'fly', touch ? '<kbd>Fly</kbd> at the top right' : `<kbd>${ key }</kbd> to fly ${ label }`, ': it goes where the camera cannot.' ],
	];
	if ( TIPS.every( ( [ id ] ) => done.has( id ) ) || ! flyer ) return bus;

	const style = document.createElement( 'style' );
	style.textContent = css;
	document.head.appendChild( style );
	const card = document.createElement( 'div' );
	card.id = 'ix-coach';
	card.innerHTML = '<div style="color:#d9a441;font-weight:600;margin-bottom:4px">Get closer, it never runs out</div>'
		+ TIPS.map( ( [ id, act, why ] ) => `<div class="tip${ done.has( id ) ? ' done' : '' }" data-tip="${ id }"><i>${ done.has( id ) ? '✓' : '›' }</i><span>${ act }${ why }</span></div>` ).join( '' )
		+ '<button aria-label="Close">×</button>';
	document.body.appendChild( card );

	const close = () => {

		card.classList.remove( 'on' );
		setTimeout( () => card.remove(), 600 );
		cleanup();
		bus.dispatchEvent( new CustomEvent( 'coachClosed', { detail: { done: [ ...done ] } } ) );

	};

	const tick = ( id ) => {

		if ( done.has( id ) ) return;
		done.add( id );
		store.set( [ ...done ] );
		const row = card.querySelector( `[data-tip="${ id }"]` );
		row?.classList.add( 'done' );
		if ( row ) row.querySelector( 'i' ).textContent = '✓';
		bus.dispatchEvent( new CustomEvent( 'tipDone', { detail: { tip: id } } ) );
		if ( TIPS.every( ( [ t ] ) => done.has( t ) ) ) setTimeout( close, 1200 );

	};

	card.querySelector( 'button' ).onclick = close;
	// The fly tip boards the vehicle on a click (the same as V or the Fly button).
	card.querySelector( '[data-tip="fly"]' ).onclick = () => { if ( ! flyer.active ) flyer.board(); };
	// Zoom: a few wheel steps toward the scene, or a two-finger touch.
	let wheel = 0;
	const onWheel = ( e ) => { if ( e.deltaY < 0 && ( wheel += - e.deltaY ) > 300 ) tick( 'zoom' ); };
	const onTouch = ( e ) => { if ( e.touches.length > 1 ) tick( 'zoom' ); };
	addEventListener( 'wheel', onWheel, { passive: true, capture: true } );
	addEventListener( 'touchstart', onTouch, { passive: true, capture: true } );
	const onBoard = () => tick( 'fly' );
	flyer.addEventListener( 'vehicleBoarded', onBoard );
	let nudge = 0;
	const cleanup = () => {

		removeEventListener( 'wheel', onWheel, { capture: true } );
		removeEventListener( 'touchstart', onTouch, { capture: true } );
		flyer.removeEventListener( 'vehicleBoarded', onBoard );
		clearInterval( poll );
		clearTimeout( nudge );

	};

	// Shown 1.5 s after the page is ready (the loading note is gone by then).
	const poll = setInterval( () => {

		if ( ! window.__ix?.ready ) return;
		clearInterval( poll );
		setTimeout( () => card.classList.add( 'on' ), 1500 );
		nudge = setTimeout( () => { if ( card.isConnected ) card.classList.add( 'pulse' ); }, ( NUDGE + 1.5 ) * 1000 );

	}, 200 );

	return bus;

}
