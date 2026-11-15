// Game-like scene cost (game.html, demo/game.js): Infinitex vs plain
// colour vs a 2K PBR texture set, five camera views, 1080p and 1440p, post
// on (sun shadows, GTAO, hair pass). Also GPU memory as three.js counts it,
// the GPU process footprint (macOS `footprint`), the JS heap and the CPU
// cost of the 3D hair window on skinned characters.
// Needs the dev server. Other GPU users inflate the times: repeated runs.
//   IX_URL=http://localhost:5240/game.html node tests/perf_game.mjs out.json [runs]

import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { launchBrowser } from './chromium.mjs';

const out = process.argv[ 2 ] ?? 'perf_game.json';
const RUNS = + ( process.argv[ 3 ] ?? 3 );
const URL = process.env.IX_URL ?? 'http://localhost:5211/game.html';
const SIZES = [ [ 1920, 1080 ], [ 2560, 1440 ] ];

const gpuPids = () => {

	try {

		return execSync( 'pgrep -f -- "--type=gpu-process"' ).toString().trim().split( '\n' ).map( Number );

	} catch {

		return [];

	}

};
const footprintMB = ( pid ) => {

	try {

		const s = execSync( `footprint --pid ${ pid }` ).toString();
		const m = s.match( /Footprint: ([\d.]+) (KB|MB|GB)/ );
		return m ? + ( m[ 1 ] * { KB: 1 / 1024, MB: 1, GB: 1024 }[ m[ 2 ] ] ).toFixed( 0 ) : null;

	} catch {

		return null;

	}

};

const before = new Set( gpuPids() );
const browser = await launchBrowser();
const result = { runs: RUNS, sizes: {} };
const save = () => writeFileSync( out, JSON.stringify( result, null, 1 ) );

for ( const [ w, h ] of SIZES ) {

	const key = `${ w }x${ h }`;
	const page = await browser.newPage( { viewport: { width: w, height: h }, deviceScaleFactor: 1 } );
	page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
	const cdp = await page.context().newCDPSession( page );
	await cdp.send( 'Performance.enable' );
	const heapMB = async () => {

		const { metrics } = await cdp.send( 'Performance.getMetrics' );
		return + ( metrics.find( ( x ) => x.name === 'JSHeapUsedSize' ).value / 1e6 ).toFixed( 1 );

	};
	const t0 = Date.now();
	await page.goto( URL );
	await page.waitForFunction( () => window.__game?.ready, null, { timeout: 180000 } );
	const gpuPid = gpuPids().find( ( p ) => ! before.has( p ) );
	const R = { loadToFirstFrameMs: Date.now() - t0, gpuPid, memory: {}, heapMB: {}, footprintMB: {}, frames: [] };
	result.sizes[ key ] = R;

	// Memory per mode, after a frame of every view (all pipelines and
	// targets created).
	for ( const mode of [ 'ix', 'plain', 'pbr' ] ) {

		await page.evaluate( async ( mode ) => {

			for ( const v of window.__game.views ) await window.__game.measure( { mode, name: v, frames: 2 } );

		}, mode );
		R.memory[ mode ] = await page.evaluate( () => window.__game.memory() );
		R.heapMB[ mode ] = await heapMB();
		R.footprintMB[ mode ] = gpuPid ? footprintMB( gpuPid ) : null;

	}

	for ( let r = 0; r < RUNS; r ++ ) {

		const frames = await page.evaluate( async () => {

			const g = window.__game, rows = [ await g.measure( { calib: true } ) ];
			for ( const v of g.views ) for ( const mode of [ 'ix', 'plain', 'pbr' ] ) rows.push( await g.measure( { mode, name: v } ) );
			// Post cost: the same views without shadows-AO-hair pass pipeline.
			for ( const v of [ 'tps3', 'face' ] ) for ( const mode of [ 'ix', 'plain' ] ) rows.push( await g.measure( { mode, name: v, usePost: false } ) );
			return rows;

		} );
		frames.forEach( ( f ) => { f.run = r; } );
		R.frames.push( ...frames );
		save();
		console.log( `${ key } run ${ r + 1 }/${ RUNS }` );

	}

	if ( w === 1920 ) result.skinnedRaycast = await page.evaluate( () => window.__game.skinnedRaycast() );
	await page.close();
	save();

}

await browser.close();
save();
console.log( `wrote ${ out }` );
