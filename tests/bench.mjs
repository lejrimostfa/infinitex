// Cost of every lit matter of the cube wall, WebGPU and WebGL2.
// Needs the dev server (npm run dev). Run nothing else on the GPU meanwhile.
//   node tests/bench.mjs [out.json]
// Each matter fills a 1920x1080 target at 30 cm, 2 cm and 1.5 mm
// (demo/cubes.js, __ix.bench). The baseline is a grey cube in the same
// views: matter cost = time - baseline. Prints a markdown table.

import { writeFileSync } from 'node:fs';
import { launchBrowser } from './chromium.mjs';

const out = process.argv[ 2 ] ?? 'docs/bench.json';
const BASE = process.env.IX_URL ?? 'http://localhost:5211/cubes.html';
const browser = await launchBrowser();
const runs = [];
for ( const webgl of [ false, true ] ) {

	const page = await browser.newPage( { viewport: { width: 1280, height: 720 } } );
	page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
	await page.goto( `${ BASE }?film${ webgl ? '&webgl' : '' }` );
	await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 120000 } );
	runs.push( await page.evaluate( () => window.__ix.bench() ) );
	await page.close();

}

await browser.close();
writeFileSync( out, JSON.stringify( runs, null, 1 ) );

const mpx = 1920 * 1080 / 1e6;
const [ gpu, gl ] = runs;
const net = ( r, i, k ) => Math.max( 0, r.matters[ i ].ms[ k ] - r.baseline[ k ] );
console.log( `| Matter | WebGPU 30 cm | 2 cm | 1.5 mm | WebGL2 30 cm | 2 cm | 1.5 mm |` );
console.log( `|---|---|---|---|---|---|---|` );
console.log( `| baseline (grey cube) | ${ gpu.baseline.join( ' | ' ) } | ${ gl.baseline.join( ' | ' ) } |` );
gpu.matters.forEach( ( m, i ) => console.log( `| ${ m.name } | ${ [ 0, 1, 2 ].map( ( k ) => net( gpu, i, k ).toFixed( 2 ) ).join( ' | ' ) } | ${ [ 0, 1, 2 ].map( ( k ) => net( gl, i, k ).toFixed( 2 ) ).join( ' | ' ) } |` ) );
console.log( `\nWhole wall from above: WebGPU ${ gpu.wall } ms, WebGL2 ${ gl.wall } ms. Times in ms per 1920x1080 frame (${ mpx.toFixed( 2 ) } Mpx), above the baseline. Timers: WebGPU ${ gpu.timer }, WebGL2 ${ gl.timer }.` );
