// Stills from candidate camera poses, to plan a reel.
//   node tests/reel_stills.mjs <url> <outdir> '<json [[name,[px,py,pz],[lx,ly,lz],t]]>'
import { launchBrowser } from './chromium.mjs';
const [ url, dir, json ] = process.argv.slice( 2 );
const browser = await launchBrowser();
const page = await browser.newPage( { viewport: { width: 960, height: 540 } } );
page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
await page.goto( ( process.env.IX_BASE ?? 'http://localhost:5211' ) + url );
await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 120000 } );
await page.addStyleTag( { content: 'body > *:not(canvas) { display: none !important; }' } );
await page.waitForTimeout( 2000 );
for ( const [ name, p, l ] of JSON.parse( json ) ) {
	await page.evaluate( ( [ p, l ] ) => { const { camera, controls } = window.__ix; camera.position.set( ...p ); controls.target.set( ...l ); camera.lookAt( ...l ); }, [ p, l ] );
	await page.waitForTimeout( 1200 );
	await page.screenshot( { path: `${ dir }/${ name }.png` } );
}
await browser.close();
