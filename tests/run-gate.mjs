// Headless quality gate. Needs the dev server (npm run dev) on :5211.
//   node tests/run-gate.mjs            WebGPU and WebGL2
//   node tests/run-gate.mjs webgl      one backend
// Writes tests/gate-report.json and exits 1 when a threshold fails.

import { writeFileSync } from 'node:fs';
import { launchBrowser } from './chromium.mjs';

const PAGE_URL = process.env.IX_URL ?? 'http://localhost:5211/';
const HEIGHTS = [ 0.5, 0.25, 0.12, 0.06, 0.03, 0.015, 0.008, 0.004, 0.002, 0.001 ];
const LIMITS = { meanShift: 0.05, shimmer: 1.6, sheen: 0.1 };

const backends = process.argv[ 2 ] ? [ process.argv[ 2 ] ] : [ 'webgpu', 'webgl' ];
const browser = await launchBrowser();

const report = {};
let failed = false;
for ( const backend of backends ) {

	const page = await browser.newPage( { viewport: { width: 640, height: 480 } } );
	page.on( 'pageerror', ( e ) => console.error( `[${ backend }] page error:`, e.message ) );
	await page.goto( PAGE_URL + ( backend === 'webgl' ? '?webgl' : '' ) );
	await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 30000 } );
	const info = await page.evaluate( () => ( { isWebGPU: !! window.__ix.renderer.backend.isWebGPUBackend } ) );
	const { rows, sheen } = await page.evaluate( ( h ) => window.__ix.runGate( h ), HEIGHTS );
	const frameMs = await page.evaluate( () => window.__ix.perf() );
	report[ backend ] = { ...info, frameMs, rows, sheen };

	console.log( `\n${ backend } (WebGPU backend: ${ info.isWebGPU }), 1080p full-screen wool: ${ frameMs.toFixed( 2 ) } ms median per synced frame (headless, upper bound)` );
	console.log( 'height_m   meanRef  meanShift  blurRmse  shimmer' );
	for ( const r of rows ) {

		const bad = r.meanShift > LIMITS.meanShift || r.shimmer > LIMITS.shimmer;
		failed ||= bad;
		console.log( `${ r.d.toFixed( 3 ).padStart( 8 ) }  ${ r.meanRef.toFixed( 4 ) }  ${ ( r.meanShift * 100 ).toFixed( 1 ).padStart( 8 ) }%  ${ ( r.blurRmse * 100 ).toFixed( 1 ).padStart( 7 ) }%  ${ r.shimmer.toFixed( 2 ).padStart( 7 ) }${ bad ? '  FAIL' : '' }` );

	}

	if ( sheen ) {

		console.log( 'sheen check, grazing view, fuzz on (base sheen lowered) / fuzz off (full sheen):' );
		for ( const s of sheen ) {

			const bad = Math.abs( s.ratio - 1 ) > LIMITS.sheen;
			failed ||= bad;
			console.log( `  ${ s.deg } deg  ratio ${ s.ratio.toFixed( 3 ) }${ bad ? '  FAIL' : '' }` );

		}

	}

	await page.close();

}

await browser.close();
writeFileSync( new URL( './gate-report.json', import.meta.url ), JSON.stringify( { limits: LIMITS, report }, null, 2 ) );
console.log( failed ? '\nGATE FAILED' : '\nGATE PASSED' );
process.exit( failed ? 1 : 0 );
