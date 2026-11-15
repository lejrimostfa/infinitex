// 1080p against 1440p in the same page, interleaved: other GPU users then
// slow both sizes alike (tests/perf_game.mjs ran them one after the other).
// Views tps3 (2.8 m) and macro (knit at 6 cm), Infinitex and plain, post on.
//   IX_URL=http://localhost:5240/game.html node tests/perf_game_sizes.mjs out.json [rounds]

import { writeFileSync } from 'node:fs';
import { launchBrowser } from './chromium.mjs';

const out = process.argv[ 2 ] ?? 'perf_game_sizes.json';
const ROUNDS = + ( process.argv[ 3 ] ?? 4 );
const URL = process.env.IX_URL ?? 'http://localhost:5211/game.html';
const browser = await launchBrowser();
const page = await browser.newPage( { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } );
page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
await page.goto( URL );
await page.waitForFunction( () => window.__game?.ready, null, { timeout: 180000 } );
const rows = [];
for ( let r = 0; r < ROUNDS; r ++ ) {

	for ( const [ w, h ] of [ [ 1920, 1080 ], [ 2560, 1440 ] ] ) {

		await page.setViewportSize( { width: w, height: h } );
		await page.waitForFunction( ( w ) => window.__game.renderer.domElement.width === w, w );
		rows.push( ...( await page.evaluate( async () => {

			const g = window.__game, o = [];
			for ( const name of [ 'tps3', 'macro' ] ) for ( const mode of [ 'ix', 'plain' ] ) o.push( await g.measure( { mode, name, frames: 30 } ) );
			return o;

		} ) ).map( ( x ) => ( { ...x, round: r } ) ) );

	}

	writeFileSync( out, JSON.stringify( rows, null, 1 ) );
	console.log( `round ${ r + 1 }/${ ROUNDS }` );

}

await browser.close();
console.log( `wrote ${ out }` );
