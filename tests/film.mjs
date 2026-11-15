// Records the zoom film: whole mannequin to the wool fibers, with captions.
// Needs the dev server (npm run dev) and ffmpeg on the PATH.
//   node tests/film.mjs [out.mp4] [seconds|auto] [width] [height]
// IX_URL picks the page (e.g. .../cubes.html?family=10); `auto` takes the
// length of the page's flight plus the final hold.
// Each frame is posed and rendered by window.__ix.filmFrame( k, t ), then
// screenshotted (captions are DOM) and piped to ffmpeg. Deterministic.

import { spawn } from 'node:child_process';
import { launchBrowser } from './chromium.mjs';

const [ out = 'infinitex_zoom.mp4', seconds = '40', W = '1920', H = '1080' ] = process.argv.slice( 2 );
const FPS = 30;
let total = Math.round( Number( seconds ) * FPS );
const hold = 2.5 * FPS; // last seconds: stay at the fibers while the camera turns
const PAGE_URL = process.env.IX_URL ?? 'http://localhost:5211/';

const browser = await launchBrowser();
const page = await browser.newPage( { viewport: { width: Number( W ), height: Number( H ) } } );
page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
const filmURL = new URL( PAGE_URL );
filmURL.searchParams.set( 'film', '' );
await page.goto( filmURL.toString() );
await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 60000 } );

if ( seconds === 'auto' ) total = Math.round( ( await page.evaluate( () => window.__ix.film.duration ) ) * FPS ) + hold;
const ff = spawn( 'ffmpeg', [ '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String( FPS ), '-i', '-',
	'-vf', `fade=in:0:${ FPS / 2 },fade=out:${ total - FPS / 2 }:${ FPS / 2 }`,
	'-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out ], { stdio: [ 'pipe', 'inherit', 'inherit' ] } );


const t0 = Date.now();
for ( let i = 0; i < total; i ++ ) {

	const k = i / ( total - hold ); // > 1 during the hold
	await page.evaluate( ( [ k, t ] ) => window.__ix.filmFrame( k, t ), [ k, i / FPS ] );
	// A busy GPU (another page rendering) can stall a capture: retry.
	let png = null;
	for ( let tries = 0; ! png; tries ++ ) {

		try {

			png = await page.screenshot( { type: 'png', timeout: 120000 } );

		} catch ( e ) {

			if ( tries >= 2 ) throw e;
			console.log( `frame ${ i }: capture retry (${ e.message.split( '\n' )[ 0 ] })` );

		}

	}

	if ( ! ff.stdin.write( png ) ) await new Promise( ( r ) => ff.stdin.once( 'drain', r ) );
	if ( i % 60 === 0 ) console.log( `frame ${ i }/${ total }, ${ ( ( Date.now() - t0 ) / 1000 ).toFixed( 0 ) } s` );

}

ff.stdin.end();
await new Promise( ( r ) => ff.on( 'close', r ) );
await browser.close();
console.log( `wrote ${ out }` );
