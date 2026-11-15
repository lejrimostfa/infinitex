// LOD branches check (core/lod.js gate()): every ground matter drawn on the
// ground plane of game.html with the branches on and off. The two images
// must match, and the script prints what the branches save.
// Needs the dev server.
//
//   node tests/lod_branches.mjs                  image check and timing, 1080p
//   node tests/lod_branches.mjs --only soil,sand one or several modes
//   node tests/lod_branches.mjs --notime         image check only
//   node tests/lod_branches.mjs --dump dir       640x360 captures to dir
//   node tests/lod_branches.mjs --compare a b    compare two dumps (two
//                                                versions of the code)
// IX_URL sets the page (default http://localhost:5211/game.html).
// Exit code 1 when more than 0.05% of the pixels of a view differ.

import { writeFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice( 2 );
const opt = ( name ) => { const i = args.indexOf( name ); return i < 0 ? null : args[ i + 1 ] ?? true; };
const TOL = 6; // sum of |d| over r, g, b, display-encoded, 0 to 765
const countDiff = ( a, b ) => {

	let n = 0, max = 0;
	for ( let i = 0; i < a.length; i += 3 ) {

		const d = Math.abs( a[ i ] - b[ i ] ) + Math.abs( a[ i + 1 ] - b[ i + 1 ] ) + Math.abs( a[ i + 2 ] - b[ i + 2 ] );
		if ( d > TOL ) n ++;
		if ( d > max ) max = d;

	}

	return { pixels: n, max };

};

if ( opt( '--compare' ) ) {

	const i = args.indexOf( '--compare' ), A = args[ i + 1 ], B = args[ i + 2 ];
	let bad = 0;
	for ( const f of readdirSync( A ).filter( ( f ) => f.endsWith( '.bin' ) ).sort() ) {

		const a = readFileSync( join( A, f ) ), b = readFileSync( join( B, f ) );
		const d = countDiff( a, b ), share = d.pixels / ( a.length / 3 );
		if ( share > 5e-4 ) bad ++;
		console.log( `${ share > 5e-4 ? 'FAIL' : 'ok  ' } ${ f.padEnd( 44 ) } ${ String( d.pixels ).padStart( 7 ) } px differ, max ${ d.max }` );

	}

	process.exit( bad ? 1 : 0 );

}

const { launchBrowser } = await import( './chromium.mjs' );
const URL = process.env.IX_URL ?? 'http://localhost:5211/game.html';
const dump = opt( '--dump' ), only = opt( '--only' ), timing = ! opt( '--notime' ) && ! dump;
const [ W, H ] = dump ? [ 640, 360 ] : [ 1920, 1080 ];
if ( dump ) mkdirSync( dump, { recursive: true } );

const browser = await launchBrowser();
const page = await browser.newPage( { viewport: { width: W, height: H }, deviceScaleFactor: 1 } );
page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message.slice( 0, 800 ) ) );
page.on( 'console', ( m ) => { if ( m.type() === 'error' ) console.error( 'console:', m.text().slice( 0, 800 ) ); } );
await page.goto( URL );
await page.waitForFunction( () => window.__game?.ready, null, { timeout: 180000 } );

// Page side: the modules the page already loaded (same instances), the
// ground plane alone in Infinitex, capture and timing helpers.
const presets = await page.evaluate( async ( only ) => {

	const names = performance.getEntriesByType( 'resource' ).map( ( e ) => e.name );
	const mod = ( re ) => import( names.find( ( n ) => re.test( n ) ) );
	const T = await mod( /three[._]webgpu/ ), tsl = await mod( /three[._]tsl/ );
	const ix = await mod( /\/src\/index\.js/ ), lod = await mod( /\/src\/core\/lod\.js/ ), cubes = await mod( /\/demo\/cubelist\.js/ );
	const g = window.__game, { renderer, scene, camera, parts } = g;
	const w = renderer.domElement.width, h = renderer.domElement.height;
	const rt = new T.RenderTarget( w, h, { type: T.HalfFloatType } );
	const nodeFrame = renderer._nodes.nodeFrame, queue = renderer.backend.device?.queue;
	const ground = parts.find( ( p ) => p.name === 'ground' );
	g.setMode( 'ix', 'ground' );
	const VIEWS = {
		far10: 'far10', tps3: 'tps3',
		at40cm: [ [ 4, 0.3, 3.3 ], [ 4, 0, 3 ] ], at6cm: [ [ 4, 0.05, 3.03 ], [ 4, 0, 3 ] ], at1cm: [ [ 4, 0.01, 3.004 ], [ 4, 0, 3 ] ],
	};
	const list = [];
	for ( const f of cubes.CUBES ) for ( const it of f.items ) if ( it.preset.family === 'ground' && ( ! only || only.split( ',' ).includes( it.preset.mode ) ) ) list.push( it );
	const lut = new Uint8Array( 4097 );
	for ( let i = 0; i <= 4096; i ++ ) lut[ i ] = Math.round( Math.pow( i / 4096, 1 / 2.2 ) * 255 );
	window.__lod = {
		hasSwitch: typeof lod.setLodBranches === 'function',
		make( i, branches ) {

			lod.setLodBranches?.( branches );
			const m = ix.createMaterial( list[ i ].preset, { coords: tsl.uv() } ).material;
			lod.setLodBranches?.( true );
			return m;

		},
		view( name ) {

			const v = VIEWS[ name ];
			if ( Array.isArray( v ) ) { camera.position.set( ...v[ 0 ] ); camera.lookAt( new T.Vector3( ...v[ 1 ] ) ); camera.updateMatrixWorld(); } else g.view( v );

		},
		// Display-encoded rgb bytes of one frame.
		async grab( material ) {

			ground.mesh.material = material;
			nodeFrame.update();
			renderer.setRenderTarget( rt );
			renderer.render( scene, camera );
			const px = await renderer.readRenderTargetPixelsAsync( rt, 0, 0, w, h );
			renderer.setRenderTarget( null );
			const out = new Uint8Array( w * h * 3 );
			for ( let i = 0, j = 0; i < px.length; i += 4 ) for ( let c = 0; c < 3; c ++ ) {

				const v = T.DataUtils.fromHalfFloat( px[ i + c ] );
				out[ j ++ ] = lut[ Math.round( Math.min( 1, Math.max( 0, v ) ) * 4096 ) ];

			}

			return out;

		},
		// Median wall time of a frame, submit to GPU done.
		async time( material, frames = 16 ) {

			ground.mesh.material = material;
			const wall = [];
			renderer.setRenderTarget( rt );
			for ( let i = 0; i < frames + 4; i ++ ) {

				nodeFrame.update();
				camera.position.x += ( i % 2 ? 1 : - 1 ) * 1e-5; camera.updateMatrixWorld();
				const t = performance.now();
				renderer.render( scene, camera );
				await queue.onSubmittedWorkDone();
				if ( i >= 4 ) wall.push( performance.now() - t );

			}

			renderer.setRenderTarget( null );
			return wall.sort( ( a, b ) => a - b )[ wall.length >> 1 ];

		},
		views: Object.keys( VIEWS ),
	};
	return { names: list.map( ( it ) => `${ it.preset.mode }: ${ it.name }` ), views: Object.keys( VIEWS ), hasSwitch: window.__lod.hasSwitch };

}, typeof only === 'string' ? only : null );

if ( ! presets.hasSwitch && ! dump ) { console.error( 'this version has no setLodBranches: only --dump works' ); await browser.close(); process.exit( 2 ); }
let bad = 0;
const slug = ( s ) => s.replace( /[^a-z0-9]+/gi, '_' );
for ( let i = 0; i < presets.names.length; i ++ ) {

	console.log( `\n${ presets.names[ i ] }` );
	await page.evaluate( ( i ) => { const L = window.__lod; L.on = L.make( i, true ); L.off = L.hasSwitch ? L.make( i, false ) : null; }, i );
	for ( const v of presets.views ) {

		if ( dump ) {

			const b64 = await page.evaluate( async ( v ) => { const L = window.__lod; L.view( v ); const a = await L.grab( L.on ); let s = ''; for ( let i = 0; i < a.length; i += 32768 ) s += String.fromCharCode( ...a.subarray( i, i + 32768 ) ); return btoa( s ); }, v );
			writeFileSync( join( dump, `${ slug( presets.names[ i ] ) }_${ v }.bin` ), Buffer.from( b64, 'base64' ) );
			continue;

		}

		const r = await page.evaluate( async ( { v, timing, TOL } ) => {

			const L = window.__lod;
			L.view( v );
			const a = await L.grab( L.off ), b = await L.grab( L.on );
			let n = 0, max = 0;
			for ( let i = 0; i < a.length; i += 3 ) { const d = Math.abs( a[ i ] - b[ i ] ) + Math.abs( a[ i + 1 ] - b[ i + 1 ] ) + Math.abs( a[ i + 2 ] - b[ i + 2 ] ); if ( d > TOL ) n ++; if ( d > max ) max = d; }
			const t = { off: [], on: [] };
			if ( timing ) for ( let k = 0; k < 3; k ++ ) { t.off.push( await L.time( L.off ) ); t.on.push( await L.time( L.on ) ); }
			return { pixels: n, max, total: a.length / 3, off: Math.min( ...t.off ), on: Math.min( ...t.on ) };

		}, { v, timing, TOL } );
		const fail = r.pixels / r.total > 5e-4;
		if ( fail ) bad ++;
		console.log( `  ${ fail ? 'FAIL' : 'ok  ' } ${ v.padEnd( 7 ) } ${ String( r.pixels ).padStart( 7 ) } px differ, max ${ String( r.max ).padStart( 3 ) }` + ( timing ? `   ${ r.off.toFixed( 1 ).padStart( 5 ) } ms -> ${ r.on.toFixed( 1 ).padStart( 5 ) } ms` : '' ) );

	}

	await page.evaluate( () => { const L = window.__lod; L.on.dispose(); L.off?.dispose(); } );

}

await browser.close();
if ( dump ) console.log( `\ncaptures in ${ dump }` );
process.exit( bad ? 1 : 0 );
