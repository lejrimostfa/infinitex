#!/usr/bin/env node
// Audit, bench and stills of a page built on Infinitex, in headless
// Chromium on the real GPU (WebGPU, ?webgl for WebGL2). The page shows its
// renderer as window.__ix = { renderer, scene, camera, ready: true } and
// may add draw() (its own frame: mirrors, waterline, post), kit (the camera
// kit), view( name ) (preset cameras), setTime( s ) (a fixed clock).
//
//   infinitex-perf <url> [--views beach,props] [--dpr 2] [--size 1600x900]
//       audit (src/perf/audit.js) and frame time for each view
//   infinitex-perf <url> --shots <dir> [--views ...]
//       one still per view, at a fixed time, for a before/after
//   infinitex-perf --compare <dirA> <dirB>
//       pixel difference of the stills of two runs: mean, share of pixels
//       off by more than 8 and 24 levels (of 255). 0.00 % over 8: the same
//       image; anything else, look at the stills before keeping the change
//
// The skill skills/infinitex-optimize/SKILL.md walks through the fixes.

import { readFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { launchBrowser } from '../tests/chromium.mjs';

const here = dirname( fileURLToPath( import.meta.url ) );
const argv = process.argv.slice( 2 );
const opt = ( k, d = null ) => { const i = argv.indexOf( '--' + k ); return i < 0 ? d : argv[ i + 1 ]; };
const browser = await launchBrowser();

if ( argv.includes( '--compare' ) ) {

	const a = resolve( opt( 'compare' ) ), b = resolve( argv[ argv.indexOf( '--compare' ) + 2 ] );
	const page = await browser.newPage();
	for ( const f of readdirSync( a ).filter( ( f ) => f.endsWith( '.png' ) ) ) {

		const url = ( d ) => 'data:image/png;base64,' + readFileSync( join( d, f ) ).toString( 'base64' );
		const r = await page.evaluate( async ( [ ua, ub ] ) => {

			const load = async ( u ) => { const i = new Image(); i.src = u; await i.decode(); const c = new OffscreenCanvas( i.width, i.height ); const x = c.getContext( '2d' ); x.drawImage( i, 0, 0 ); return x.getImageData( 0, 0, i.width, i.height ).data; };
			const [ A, B ] = await Promise.all( [ load( ua ), load( ub ) ] );
			if ( A.length !== B.length ) return null;
			let sum = 0, o8 = 0, o24 = 0; const n = A.length / 4;
			for ( let i = 0; i < A.length; i += 4 ) { const d = Math.max( Math.abs( A[ i ] - B[ i ] ), Math.abs( A[ i + 1 ] - B[ i + 1 ] ), Math.abs( A[ i + 2 ] - B[ i + 2 ] ) ); sum += d; if ( d > 8 ) o8 ++; if ( d > 24 ) o24 ++; }
			return { mean: sum / n, o8: o8 / n * 100, o24: o24 / n * 100 };

		}, [ url( a ), url( b ) ] );
		console.log( f.padEnd( 20 ), r ? `mean |d| ${ r.mean.toFixed( 2 ) }   over 8: ${ r.o8.toFixed( 2 ) } %   over 24: ${ r.o24.toFixed( 2 ) } %` : 'different sizes' );

	}

	await browser.close();
	process.exit( 0 );

}

const url = argv.find( ( a ) => /^https?:/.test( a ) );
if ( ! url ) { console.error( 'usage: infinitex-perf <url> [--views a,b] [--shots dir] | --compare dirA dirB' ); process.exit( 1 ); }
const [ w, h ] = ( opt( 'size', '1600x900' ) ).split( 'x' ).map( Number );
const page = await browser.newPage( { viewport: { width: w, height: h }, deviceScaleFactor: + opt( 'dpr', 2 ) } );
page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
await page.goto( url );
await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 300000 } );
await page.waitForTimeout( 2000 );
await page.addScriptTag( { type: 'module', content: readFileSync( join( here, '../src/perf/audit.js' ), 'utf8' ) + '\nwindow.__ixAudit = auditFrame;' } );
await page.waitForFunction( () => window.__ixAudit );
// One frame of the page, driven by hand (the render loop stops).
await page.evaluate( () => {

	const ix = window.__ix, R = ix.renderer;
	R.setAnimationLoop( null );
	const cam = ix.camera ?? ix.scene.getObjectByProperty( 'isCamera', true );
	window.__ixFrame = async () => {

		R._nodes.nodeFrame.update();
		ix.setTime?.( 5 );
		ix.kit?.update( 1 / 60, { move: false } );
		if ( ix.draw ) ix.draw(); else if ( ix.kit?.renderAsync ) await ix.kit.renderAsync(); else R.render( ix.scene, cam );
		if ( R.backend.device ) await R.backend.device.queue.onSubmittedWorkDone();
		else { const gl = R.backend.gl; gl.readPixels( 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array( 4 ) ); }

	};

} );
const views = opt( 'views' )?.split( ',' ) ?? [ null ];
const shots = opt( 'shots' );
if ( shots ) { mkdirSync( shots, { recursive: true } ); await page.addStyleTag( { content: 'body > *:not(canvas) { display: none !important; }' } ); }
const report = {};
for ( const v of views ) {

	const name = v ?? 'default';
	if ( v ) await page.evaluate( ( v ) => window.__ix.view?.( v ), v );
	for ( let i = 0; i < 16; i ++ ) await page.evaluate( () => window.__ixFrame() );
	if ( shots ) { await page.screenshot( { path: join( shots, name + '.png' ) } ); console.log( 'still', name ); continue; }
	const audit = await page.evaluate( () => window.__ixAudit( { renderer: window.__ix.renderer, scene: window.__ix.scene, frame: window.__ixFrame } ) );
	const ms = await page.evaluate( async () => {

		let best = Infinity;
		for ( let k = 0; k < 3; k ++ ) { const t = []; for ( let i = 0; i < 8; i ++ ) { const t0 = performance.now(); await window.__ixFrame(); t.push( performance.now() - t0 ); } t.sort( ( a, b ) => a - b ); best = Math.min( best, t[ 3 ] ); }
		return best;

	} );
	report[ name ] = { ms, ...audit };
	const kinds = {};
	for ( const p of audit.passes ) { kinds[ p.kind ] ??= { n: 0, draws: 0 }; kinds[ p.kind ].n ++; kinds[ p.kind ].draws += p.draws; }
	console.log( `\n== ${ name }: ${ ms.toFixed( 1 ) } ms a frame, ${ audit.draws } draws, ${ ( audit.tris / 1e6 ).toFixed( 2 ) } M triangles, pixel ratio ${ audit.pixelRatio }` );
	console.log( '   passes: ' + Object.entries( kinds ).map( ( [ k, v ] ) => `${ v.n } ${ k } (${ v.draws } draws)` ).join( ', ' ) );
	console.log( '   most drawn: ' + audit.objects.slice( 0, 6 ).map( ( o ) => `${ o.name } ${ o.draws } (${ o.passes })` ).join( ', ' ) );
	for ( const f of audit.findings ) console.log( `   [${ f.id }] ${ f.saves ? 'saves ' + f.saves + ' draws. ' : '' }${ f.objects.join( ', ' ) }\n      ${ f.fix }` );
	if ( ! audit.findings.length ) console.log( '   nothing found by the audit: measure each post stage with its flag off (see the skill)' );

}

if ( opt( 'json' ) ) writeFileSync( opt( 'json' ), JSON.stringify( report, null, 1 ) );
await browser.close();
