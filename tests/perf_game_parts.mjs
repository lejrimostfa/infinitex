// Follow-up of tests/perf_game.mjs at 1920x1080:
//   1. what each part of game.html costs: only that part wears its
//      Infinitex matter, every other part is plain (wall time, min of runs);
//   2. GPU process memory (macOS footprint) and JS heap of the page with
//      the 13 Infinitex matters (?) against the same page without them
//      (?noix), each in a fresh browser.
//   IX_URL=http://localhost:5240/game.html node tests/perf_game_parts.mjs out.json [runs]

import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { launchBrowser } from './chromium.mjs';

const out = process.argv[ 2 ] ?? 'perf_game_parts.json';
const RUNS = + ( process.argv[ 3 ] ?? 3 );
const URL = process.env.IX_URL ?? 'http://localhost:5211/game.html';
const gpuPids = () => {

	try {

		return execSync( 'pgrep -f -- "--type=gpu-process"' ).toString().trim().split( '\n' ).map( Number );

	} catch {

		return [];

	}

};
const footprintMB = ( pid ) => {

	const m = execSync( `footprint --pid ${ pid }` ).toString().match( /Footprint: ([\d.]+) (KB|MB|GB)/ );
	return m ? + ( m[ 1 ] * { KB: 1 / 1024, MB: 1, GB: 1024 }[ m[ 2 ] ] ).toFixed( 0 ) : null;

};

async function open( query ) {

	const before = new Set( gpuPids() );
	const browser = await launchBrowser();
	const page = await browser.newPage( { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } );
	page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
	const cdp = await page.context().newCDPSession( page );
	await cdp.send( 'Performance.enable' );
	await page.goto( URL + query );
	await page.waitForFunction( () => window.__game?.ready, null, { timeout: 180000 } );
	const pid = gpuPids().find( ( p ) => ! before.has( p ) );
	const heap = async () => + ( ( await cdp.send( 'Performance.getMetrics' ) ).metrics.find( ( x ) => x.name === 'JSHeapUsedSize' ).value / 1e6 ).toFixed( 1 );
	return { browser, page, pid, heap };

}

const result = { memory: {}, parts: {} };

// Memory: every view drawn once in the page's own mode, then measured.
for ( const [ key, query, mode ] of [ [ 'noix', '?noix', 'plain' ], [ 'ix', '', 'ix' ] ] ) {

	const { browser, page, pid, heap } = await open( query );
	await page.evaluate( async ( mode ) => {

		for ( const v of window.__game.views ) await window.__game.measure( { mode, name: v, frames: 2 } );

	}, mode );
	result.memory[ key ] = { footprintMB: pid ? footprintMB( pid ) : null, heapMB: await heap(), three: await page.evaluate( () => window.__game.memory() ) };
	console.log( key, result.memory[ key ].footprintMB, 'MB footprint' );
	await browser.close();

}

// Parts: tps3 (third person, 2.8 m) and far10.
const { browser, page } = await open( '' );
for ( let r = 0; r < RUNS; r ++ ) {

	const rows = await page.evaluate( async () => {

		const g = window.__game, rows = [];
		for ( const name of [ 'tps3', 'far10' ] ) {

			rows.push( await g.measure( { mode: 'plain', name } ) );
			for ( const p of g.parts ) rows.push( { ...await g.measure( { mode: 'ix', only: p.name, name } ), part: p.name, matter: p.matter } );

		}

		return rows;

	} );
	for ( const row of rows ) {

		const k = `${ row.view } ${ row.part ?? 'none' }`;
		( result.parts[ k ] ??= { ...row, wall: [] } ).wall.push( row.wallMs );

	}

	writeFileSync( out, JSON.stringify( result, null, 1 ) );
	console.log( `parts run ${ r + 1 }/${ RUNS }` );

}

await browser.close();
writeFileSync( out, JSON.stringify( result, null, 1 ) );
console.log( `wrote ${ out }` );
