// Stills of the paper beach from its preset views (demo/beach/views.js),
// in headless Chromium on the real GPU. Works while no browser is visible.
//   IX_BASE=http://localhost:5213 node tests/beach_shots.mjs <outdir> [view ...] [--q=extra&query]
import { launchBrowser } from './chromium.mjs';
import { mkdirSync } from 'node:fs';
const args = process.argv.slice( 2 );
const dir = args.shift();
const extra = ( args.find( ( a ) => a.startsWith( '--q=' ) ) ?? '--q=' ).slice( 4 );
const views = args.filter( ( a ) => ! a.startsWith( '--' ) );
mkdirSync( dir, { recursive: true } );
const browser = await launchBrowser();
const page = await browser.newPage( { viewport: { width: 1280, height: 720 } } );
page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
await page.goto( ( process.env.IX_BASE ?? 'http://localhost:5213' ) + '/beach.html?fullres&' + extra );
await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 180000 } );
await page.addStyleTag( { content: 'body > *:not(canvas) { display: none !important; }' } );
for ( const v of views.length ? views : [ 'beach' ] ) {

	await page.evaluate( ( v ) => window.__ix.view( v ), v );
	await page.waitForTimeout( 4000 );
	await page.screenshot( { path: `${ dir }/${ v }.png` } );
	console.log( 'shot', v );

}

await browser.close();
