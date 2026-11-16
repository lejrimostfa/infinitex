// Records a showcase film of any demo page, frame by frame, on a virtual clock.
//   node tests/reel.mjs <shots.mjs> <out.mp4> [width] [height]
// Needs a dev server (IX_BASE, default http://localhost:5211) and ffmpeg.
//
// The page loads on the real clock. Then performance.now and
// requestAnimationFrame are switched to a virtual clock: each step advances
// it by 1/30 s and runs the page's own loop once, so the page renders every
// frame at its exact time, however slow the GPU is.
//
// A shots module exports:
//   url        page path and query, e.g. '/aquarium.html?dof&fullres'
//   seconds    film length
//   title      { text, sub, seconds }   opening card over the first shot
//   end        { text, sub, seconds }   closing card on black (the repo link)
//   captions   [ [ from, to, text ], ... ] lower-third captions, seconds
//   keys       [ [ at, code, down ], ... ] physical keys pressed by the film
//   setup      page-side function( ix ) run once before the first frame
//   pose       page-side function( ix, t, dt ) run before each frame
//   virtual    false: no virtual clock (pose renders the frame itself)
// setup and pose run inside the page: no closure over this file.

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launchBrowser } from './chromium.mjs';

const [ shotsPath, out = 'reel.mp4', W = '1920', H = '1080' ] = process.argv.slice( 2 );
const S = await import( pathToFileURL( resolve( shotsPath ) ).href );
const FPS = Number( process.env.REEL_FPS ?? 30 ), total = Math.round( S.seconds * FPS ), FADE = Math.max( 1, Math.round( FPS / 2 ) );
const BASE = process.env.IX_BASE ?? 'http://localhost:5211';

const browser = await launchBrowser();
const page = await browser.newPage( { viewport: { width: Number( W ), height: Number( H ) } } );
page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
page.on( 'console', ( m ) => { if ( m.type() === 'error' ) console.error( 'console:', m.text() ); } );

// Virtual clock, armed later by __reel.start().
await page.addInitScript( () => {

	const realNow = performance.now.bind( performance ), realRaf = window.requestAnimationFrame.bind( window );
	let on = false, t = 0, queue = [];
	performance.now = () => on ? t : realNow();
	window.requestAnimationFrame = ( cb ) => { if ( on ) { queue.push( cb ); return queue.length; } return realRaf( cb ); };
	window.__reel = {
		start() { t = realNow(); on = true; },
		async step( dt ) {

			t += dt * 1000;
			const q = queue; queue = [];
			for ( const cb of q ) cb( t );
			const r = window.__ix?.renderer;
			const dev = r?.backend?.device;
			if ( dev ) await dev.queue.onSubmittedWorkDone();
			else r?.backend?.gl?.finish();

		},
	};

} );

await page.goto( BASE + S.url );
await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 120000 } );
await page.waitForTimeout( 1500 ); // let the first pipelines compile on the real clock

// Overlay: hide the page UI, add the caption and card layers.
await page.evaluate( () => {

	const css = document.createElement( 'style' );
	css.textContent = `
		body > *:not(canvas):not(#reel) { display: none !important; }
		#reel { position: fixed; inset: 0; pointer-events: none; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #fff; z-index: 99; }
		#reel .cap { position: absolute; left: 0; right: 0; bottom: 7%; text-align: center; font-size: 2.6vw; font-weight: 500; text-shadow: 0 0.15vw 0.8vw rgba(0,0,0,.8); }
		#reel .card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
		#reel .card h1 { margin: 0; font-size: 6vw; font-weight: 700; letter-spacing: .02em; }
		#reel .card p { margin: 1.2vw 0 0; font-size: 2.2vw; font-weight: 400; opacity: .9; }`;
	document.head.append( css );
	const root = document.createElement( 'div' );
	root.id = 'reel';
	root.innerHTML = '<div class="card"></div><div class="cap"></div>';
	document.body.append( root );

} );

const setupSrc = S.setup?.toString() ?? '() => {}', poseSrc = S.pose?.toString() ?? '() => {}';
await page.evaluate( ( src ) => { window.__reelPose = eval( `(${ src[ 1 ] })` ); return eval( `(${ src[ 0 ] })` )( window.__ix ); }, [ setupSrc, poseSrc ] );
// virtual: false for a page that renders each frame itself (its film hook
// waits on real animation frames, so the virtual clock would block it).
if ( S.virtual !== false ) await page.evaluate( () => window.__reel.start() );

const ff = spawn( 'ffmpeg', [ '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String( FPS ), '-i', '-',
	'-vf', `fade=in:0:${ FADE },fade=out:${ total - FADE }:${ FADE }`,
	'-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out ], { stdio: [ 'pipe', 'inherit', 'inherit' ] } );

const fade = ( t, a, b, f = 0.6 ) => Math.max( 0, Math.min( 1, ( t - a ) / f, ( b - t ) / f ) );
const keys = [ ...( S.keys ?? [] ) ].sort( ( a, b ) => a[ 0 ] - b[ 0 ] );
let ki = 0;
const t0 = Date.now();
for ( let i = 0; i < total; i ++ ) {

	const t = i / FPS;
	while ( ki < keys.length && keys[ ki ][ 0 ] <= t ) {

		const [ , code, down ] = keys[ ki ++ ];
		await page.evaluate( ( [ code, down ] ) => dispatchEvent( new KeyboardEvent( down ? 'keydown' : 'keyup', { code, key: code, bubbles: true } ) ), [ code, down ] );

	}

	// Cards and captions for this frame.
	const T = S.title, E = S.end;
	let card = null;
	if ( T && t < T.seconds ) card = { ...T, o: fade( t, - 1, T.seconds ), bg: 0.35 };
	if ( E && t >= S.seconds - E.seconds ) card = { ...E, o: fade( t, S.seconds - E.seconds, S.seconds + 1 ), bg: 1 };
	const cap = ( S.captions ?? [] ).find( ( c ) => t >= c[ 0 ] && t < c[ 1 ] );
	await page.evaluate( ( [ card, cap, capO ] ) => {

		const [ c, k ] = document.querySelectorAll( '#reel > div' );
		c.innerHTML = card ? `<h1>${ card.text }</h1>${ card.sub ? `<p>${ card.sub }</p>` : '' }` : '';
		c.style.opacity = card ? card.o : 0;
		c.style.background = card ? `rgba(0,0,0,${ card.bg })` : 'none';
		k.textContent = cap ?? '';
		k.style.opacity = capO;

	}, [ card, cap?.[ 2 ] ?? null, cap ? fade( t, cap[ 0 ], cap[ 1 ], 0.4 ) : 0 ] );

	await page.evaluate( ( [ t, dt ] ) => window.__reelPose( window.__ix, t, dt ), [ t, 1 / FPS ] );
	await page.evaluate( ( dt ) => window.__reel.step( dt ), 1 / FPS );
	const png = await page.screenshot( { type: 'png', timeout: 120000 } );
	if ( ! ff.stdin.write( png ) ) await new Promise( ( r ) => ff.stdin.once( 'drain', r ) );
	if ( process.env.REEL_DEBUG || i % 90 === 0 ) console.log( `frame ${ i }/${ total }, ${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 0 ) } s` );

}

ff.stdin.end();
await new Promise( ( r ) => ff.on( 'close', r ) );
await browser.close();
console.log( 'wrote', out );
