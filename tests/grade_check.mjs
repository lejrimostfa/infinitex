// Bloom and colour grade of the aquarium (src/camera/grade.js): the same
// frame with and without the grade, per view, then what the grade costs.
// Needs the dev server. Run nothing else on the GPU meanwhile.
//   node tests/grade_check.mjs <outdir> [query]     (IX_BASE: server root)
// IX_GRADE='{"bloom":0.3,"shadowTint":[0.2,0.4,1]}' sets grade uniforms
// first (grade.js), to try values; IX_NOPERF=1 skips the cost.
// Stills: <outdir>/<view>_off.png and <view>_on.png, the clock held at
// 4 s, so the fish and the water match. The animation loop is stopped:
// the page's draw() is called by hand, after the node frame is advanced
// (outside the loop three.js never advances it, the post passes would
// skip every frame after the first).
// Cost: the post alone (AO, shafts, the grade) drawn on the last composed
// frame, 30 frames back to back between two GPU syncs. Median of 11 such
// batches, and the fastest one (less hit by other GPU work). Grade off
// and on interleaved, 1080p and 4K. Grade cost = on - off. Not timestamp
// queries: on this Mac each pass's timestamps span the whole batch of
// passes (tile GPU), so their sum means nothing.
// Event bus: none.

import { launchBrowser } from './chromium.mjs';

const [ dir = '/tmp/sea-grade-ab', query = '?nofly&fullres' ] = process.argv.slice( 2 );
const BASE = process.env.IX_BASE ?? 'http://localhost:5211';
// name, eye, target, water (the grade's water uniform: 1 under water).
const VIEWS = [
	[ 'mid', [ - 0.5, 0.18, 0.3 ], [ 0.3, 0.14, - 0.25 ], 1 ],
	[ 'wide', [ 0.5, 0.2, 0.33 ], [ - 0.3, 0.1, - 0.2 ], 1 ],
	[ 'below', [ - 0.35, 0.12, 0.28 ], [ 0.1, 0.42, - 0.15 ], 1 ],
	[ 'glass', [ - 0.15, 0.33, 0.75 ], [ 0.05, 0.3, 0 ], 0 ],
	[ 'above', [ 0.55, 0.95, 0.95 ], [ 0, 0.12, 0 ], 0 ],
];

const browser = await launchBrowser();

async function open( w, h ) {

	const page = await browser.newPage( { viewport: { width: w, height: h }, deviceScaleFactor: 1 } );
	page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
	page.on( 'console', ( m ) => { if ( m.type() === 'error' ) console.error( 'console error:', m.text().slice( 0, 300 ) ); } );
	await page.goto( BASE + '/aquarium.html' + query );
	await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 120000 } );
	await page.addStyleTag( { content: 'body > *:not(canvas) { display: none !important; }' } );
	await page.waitForTimeout( 1500 );
	// Stop the loop; frame( n ) draws n frames of the page at the held clock.
	await page.evaluate( () => {

		const ix = window.__ix, nf = ix.renderer._nodes.nodeFrame;
		ix.renderer.setAnimationLoop( null );
		ix.frame = ( n = 4, t = 4 ) => {

			for ( let i = 0; i < n; i ++ ) {

				nf.update();
				ix.setTime( t );
				for ( const l of ix.life ) l.update( t );
				for ( const f of ix.flora ) f.update( t );
				ix.kit.update( 1 / 60, { move: false } );
				ix.draw();

			}

		};
		// The last frame the post received.
		const post = ix.kit.post, d = post.drawTarget;
		post.drawTarget = function ( rt, dist ) { ix.lastFrame = rt; return d.call( this, rt, dist ); };

	} );
	return page;

}

const page = await open( 960, 540 );
const hasGrade = await page.evaluate( () => !! window.__ix.kit.post?.grade );
console.log( 'grade on the post:', hasGrade );
if ( process.env.IX_GRADE ) await page.evaluate( ( set ) => {

	const u = window.__ix.kit.post.grade.uniforms;
	window.__ix.waterSet = 'water' in set;
	for ( const [ k, v ] of Object.entries( set ) ) if ( Array.isArray( v ) ) u[ k ].value.set( ...v ); else u[ k ].value = v;

}, JSON.parse( process.env.IX_GRADE ) );
for ( const [ name, p, l, water ] of VIEWS ) {

	for ( const on of [ false, true ] ) {

		await page.evaluate( ( [ p, l, on, water ] ) => {

			const { camera, controls, kit } = window.__ix;
			camera.position.set( ...p ); controls.target.set( ...l ); camera.lookAt( ...l );
			if ( ! window.__ix.waterSet ) kit.post.grade.uniforms.water.value = water;
			kit.post.useGrade( on );
			window.__ix.frame( 8 );

		}, [ p, l, on, water ] );
		await page.screenshot( { path: `${ dir }/${ name }_${ on ? 'on' : 'off' }.png` } );

	}

}

await page.close();

for ( const [ w, h ] of process.env.IX_NOPERF ? [] : [ [ 1920, 1080 ], [ 3840, 2160 ] ] ) {

	const pg = await open( w, h );
	const r = await pg.evaluate( async ( view ) => {

		const ix = window.__ix, R = ix.renderer, post = ix.kit.post, nf = R._nodes.nodeFrame;
		const [ , p, l ] = view;
		ix.camera.position.set( ...p ); ix.controls.target.set( ...l ); ix.camera.lookAt( ...l );
		ix.frame( 4 );
		const src = ix.lastFrame;
		// A one pixel read waits for the GPU on both backends (the queue runs
		// in order, so the frames before it are done).
		const sync = () => R.readRenderTargetPixelsAsync( src, 0, 0, 1, 1 );
		const frames = ( n ) => {

			for ( let i = 0; i < n; i ++ ) {

				nf.update();
				post.drawTarget( src, ix.kit.subject );

			}

		};
		const N = 30;
		const batch = async ( on ) => {

			post.useGrade( on );
			frames( 3 ); // the first frame after a swap compiles
			await sync();
			const t = performance.now();
			frames( N );
			await sync();
			return ( performance.now() - t ) / N;

		};
		// Off and on interleaved: drift hits both alike.
		const off = [], on = [];
		for ( let k = 0; k < 11; k ++ ) { off.push( await batch( false ) ); on.push( await batch( true ) ); }
		const med = ( a ) => + a.slice().sort( ( x, y ) => x - y )[ a.length >> 1 ].toFixed( 3 );
		const least = ( a ) => + Math.min( ...a ).toFixed( 3 );
		return { offMs: med( off ), onMs: med( on ), offMin: least( off ), onMin: least( on ), webgpu: !! R.backend.isWebGPUBackend };

	}, VIEWS[ 0 ] );
	console.log( `${ w }x${ h } ${ query } (${ r.webgpu ? 'WebGPU' : 'WebGL2' }): post without grade ${ r.offMs } ms, with grade ${ r.onMs } ms, grade ${ ( r.onMs - r.offMs ).toFixed( 3 ) } ms per frame (medians; fastest batches: ${ r.offMin } and ${ r.onMin }, grade ${ ( r.onMin - r.offMin ).toFixed( 3 ) } ms)` );
	await pg.close();

}

await browser.close();
