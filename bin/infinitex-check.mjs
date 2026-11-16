#!/usr/bin/env node
// Check a material family the way the built-ins are checked.
//   npx infinitex-check <family folder> [options]       from a game project
//   npm run check-family -- <family folder> [options]   in this repository
// Options:
//   --name n          register the family under this name (default: defaults.family)
//   --preset '{...}'  preset overrides as JSON
//   --backend b       webgpu, webgl or both (default both)
//   --url u           use a running server that serves the Infinitex root
//   --out dir         where the report and contact sheets go (default ./infinitex-check/<name>)
//   --no-perf         skip the frame time
//   --lint-only       only the static lint
// Steps: lint the folder for the known traps (src/kit/check/lint.mjs); load
// it on check.html, register it, run the quality gate of tests/gate.js at
// the gate heights (0.5 m to 1 mm), time a full 1080p frame at 30 cm, 2 cm
// and 1.5 mm, and write a contact sheet of the swatch at every height.
// Exits 1 when a rule fails. Needs vite and playwright-core (dev
// dependencies here; in a game: npm i -D vite playwright-core) and a
// Chromium (npx playwright install chromium, or IX_CHROMIUM=path).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative, basename, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintFamily } from '../src/kit/check/lint.mjs';
import { printLint, printGate, printPerf } from '../src/kit/check/report.mjs';
import { HEIGHTS, LIMITS } from '../tests/gate-limits.js';

const pkgRoot = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );
const argv = process.argv.slice( 2 ), opt = { backend: 'both' }, pos = [];
for ( let i = 0; i < argv.length; i ++ ) {

	const a = argv[ i ];
	if ( a === '--no-perf' ) opt.noPerf = true;
	else if ( a === '--lint-only' ) opt.lintOnly = true;
	else if ( a.startsWith( '--' ) ) opt[ a.slice( 2 ) ] = argv[ ++ i ];
	else pos.push( a );

}

if ( ! pos[ 0 ] ) { console.error( 'usage: infinitex-check <family folder> [--name n] [--preset json] [--backend webgpu|webgl|both] [--no-perf] [--lint-only]' ); process.exit( 2 ); }
const dir = resolve( process.cwd(), pos[ 0 ] );
const entry = join( dir, 'index.js' );
if ( ! existsSync( entry ) ) { console.error( `infinitex-check: ${ entry } not found (the family must export its impl as default from index.js)` ); process.exit( 2 ); }

console.log( `infinitex-check ${ relative( process.cwd(), dir ) || '.' }` );
const lintOk = printLint( lintFamily( dir ) );
if ( opt.lintOnly ) process.exit( lintOk ? 0 : 1 );

const rel = relative( pkgRoot, entry );
const famUrl = ! rel.startsWith( '..' ) && ! isAbsolute( rel ) ? '/' + rel.split( '\\' ).join( '/' ) : '/@fs' + entry;
let server = null, base = opt.url;
if ( ! base ) { const { startServer } = await import( '../src/kit/check/server.mjs' ); server = await startServer( pkgRoot, [ dir, process.cwd() ] ); base = server.url; }
if ( ! base.endsWith( '/' ) ) base += '/';

const { launchBrowser } = await import( '../tests/chromium.mjs' ).catch( () => { throw new Error( 'infinitex-check needs playwright-core: npm i -D playwright-core' ); } );
const browser = await launchBrowser();
const backends = opt.backend === 'both' ? [ 'webgpu', 'webgl' ] : [ opt.backend ];
const report = { family: null, lint: lintOk, limits: LIMITS, backends: {} };
let ok = lintOk;
for ( const backend of backends ) {

	const page = await browser.newPage( { viewport: { width: 800, height: 600 } } );
	const errors = [];
	page.on( 'pageerror', ( e ) => errors.push( e.message ) );
	const q = new URLSearchParams( { family: famUrl } );
	if ( opt.name ) q.set( 'name', opt.name );
	if ( opt.preset ) q.set( 'preset', opt.preset );
	await page.goto( `${ base }check.html?${ q }${ backend === 'webgl' ? '&webgl' : '' }` );
	try { await page.waitForFunction( () => window.__ixCheck?.ready || window.__ixCheckFailed, null, { timeout: 120000 } ); } catch { errors.push( 'the page never became ready' ); }
	if ( errors.length ) { console.log( `\n${ backend }: FAIL, page errors:\n  ${ errors.join( '\n  ' ) }` ); ok = false; await page.close(); continue; }
	const { family, kind } = await page.evaluate( () => ( { family: window.__ixCheck.family, kind: window.__ixCheck.kind } ) );
	report.family = family;
	const { rows } = await page.evaluate( ( h ) => window.__ixCheck.gate( h ), HEIGHTS );
	ok = printGate( backend, kind, rows, LIMITS ) && ok;
	const perf = opt.noPerf ? null : await page.evaluate( () => window.__ixCheck.perf( [ 0.3, 0.02, 0.0015 ], 20 ) );
	if ( perf ) ok = printPerf( backend, perf ) && ok;
	const out = resolve( process.cwd(), opt.out ?? join( 'infinitex-check', family ?? basename( dir ) ) );
	mkdirSync( out, { recursive: true } );
	const png = await page.evaluate( ( h ) => window.__ixCheck.sheet( h ), HEIGHTS );
	const sheet = join( out, `sheet-${ backend }.png` );
	writeFileSync( sheet, Buffer.from( png.split( ',' )[ 1 ], 'base64' ) );
	console.log( `\n${ backend }: contact sheet ${ sheet }` );
	if ( errors.length ) { console.log( `${ backend }: page errors during the run:\n  ${ errors.join( '\n  ' ) }` ); ok = false; }
	report.backends[ backend ] = { kind, rows, perf, errors, sheet };
	writeFileSync( join( out, 'report.json' ), JSON.stringify( report, null, 2 ) );
	await page.close();

}

await browser.close();
await server?.close();
console.log( ok ? '\nCHECK PASSED' : '\nCHECK FAILED' );
process.exit( ok ? 0 : 1 );
