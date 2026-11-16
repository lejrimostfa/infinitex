// Refraction on the GPU (core/refraction.js) against the same math in JS.
// In the aquarium, a 1.2 cm cube of matter is put under the water at a
// known point; the frame is drawn with and without it, and the centre of
// what changed is compared with where apparentPoint() says the eye sees
// it. One case through the surface, one through the front pane, one
// through the camera port under water. The water is flat for the test.
//   node tests/refraction_gpu.mjs        (dev server on 5211, or IX_URL)
// Exit code 1 when a marker is more than 3 px from its prediction.

import { launchBrowser } from './chromium.mjs';

const URL = process.env.IX_URL ?? 'http://localhost:5211/aquarium.html';
const W = 1000, H = 640, TOL = 3;
const CASES = [
	{ name: 'surface, from above', eye: [ 0.05, 0.8, 0.1 ], look: [ 0.1, 0, - 0.15 ], P: [ - 0.05, 0.12, - 0.25 ] },
	{ name: 'front pane, from outside', eye: [ - 0.4, 0.24, 0.85 ], look: [ 0.1, 0.18, 0 ], P: [ 0.35, 0.1, 0.15 ] },
	{ name: 'camera port, under water', eye: [ - 0.3, 0.15, 0.25 ], look: [ 0.2, 0.12, - 0.2 ], P: [ 0.0, 0.1, - 0.05 ] },
];

const browser = await launchBrowser();
const page = await browser.newPage( { viewport: { width: W, height: H }, deviceScaleFactor: 1 } );
await page.goto( `${ URL }?fullres` );
await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 300000 } );
await page.waitForTimeout( 2000 );
await page.evaluate( () => {

	document.querySelectorAll( '#stats, nav, .nav, #nav' ).forEach( ( e ) => { e.style.display = 'none'; } );
	const ix = window.__ix;
	ix.renderer.setAnimationLoop( null );
	// Flat water: the ripples push what is under them on screen (their
	// slope, core/watersurface.js), on top of the flat refraction tested here.
	ix.waterBody.amount.value = 0;
	// The marker: the bronze cube's mesh, scaled to 1.2 cm.
	const src = ix.tank.children.find( ( o ) => o.isMesh && o.geometry.type !== 'PlaneGeometry' && o.position.y < 0.1 );
	ix.marker = src.clone();
	ix.marker.scale.setScalar( 0.1 );
	ix.marker.rotation.set( 0, 0, 0 );

} );

// Frame pixels as RGBA, decoded in the page.
async function frame() {

	const png = await page.screenshot( { type: 'png' } );
	return page.evaluate( async ( b64 ) => {

		const bmp = await createImageBitmap( await ( await fetch( `data:image/png;base64,${ b64 }` ) ).blob() );
		const c = new OffscreenCanvas( bmp.width, bmp.height ), g = c.getContext( '2d' );
		g.drawImage( bmp, 0, 0 );
		return Array.from( g.getImageData( 0, 0, bmp.width, bmp.height ).data );

	}, png.toString( 'base64' ) );

}

let fails = 0;
for ( const c of CASES ) {

	const predicted = await page.evaluate( async ( c ) => {

		const ix = window.__ix, cam = ix.camera, V = cam.position.constructor;
		cam.position.set( ...c.eye );
		cam.lookAt( ...c.look );
		cam.updateMatrixWorld();
		ix.marker.position.set( ...c.P );
		ix.marker.updateMatrixWorld();
		ix.setTime( 3 );
		// Prediction: which interface draws this view (demo/aquarium.js draw()).
		const E = cam.position.clone(), P = new V( ...c.P );
		let A;
		if ( E.z > ix.TD / 2 ) A = ix.apparentPoint( E, P, new V( 0, 0, 1 ), ix.TD / 2, 1 / 1.33 );
		else if ( E.y > ix.LEVEL ) A = ix.apparentPoint( E, P, new V( 0, 1, 0 ), ix.LEVEL, 1 / 1.33 );
		else {

			const f = cam.getWorldDirection( new V() ), n = f.clone().negate();
			A = ix.apparentPoint( E, P, n, n.dot( E.clone().addScaledVector( f, 0.03 ) ), 1 / 1.33 );

		}

		const s = A.project( cam ), t = P.clone().project( cam );
		return { x: ( s.x + 1 ) / 2 * innerWidth, y: ( 1 - s.y ) / 2 * innerHeight, tx: ( t.x + 1 ) / 2 * innerWidth, ty: ( 1 - t.y ) / 2 * innerHeight };

	}, c );
	const draw = ( on ) => page.evaluate( async ( on ) => {

		const ix = window.__ix;
		if ( on ) ix.tank.add( ix.marker ); else ix.tank.remove( ix.marker );
		for ( let i = 0; i < 3; i ++ ) { ix.draw(); await new Promise( ( r ) => requestAnimationFrame( r ) ); }

	}, on );
	await draw( false );
	const a = await frame();
	await draw( true );
	const b = await frame();
	await draw( false );
	// Centre of the pixels that changed, within 25 px of the prediction (the
	// marker's shadow and caustics change a few pixels farther away).
	let sx = 0, sy = 0, n = 0;
	for ( let y = 0; y < H; y ++ ) for ( let x = 0; x < W; x ++ ) {

		if ( Math.hypot( x - predicted.x, y - predicted.y ) > 25 ) continue;
		const i = ( y * W + x ) * 4;
		if ( Math.abs( a[ i ] - b[ i ] ) + Math.abs( a[ i + 1 ] - b[ i + 1 ] ) + Math.abs( a[ i + 2 ] - b[ i + 2 ] ) > 12 ) { sx += x; sy += y; n ++; }

	}

	const seen = { x: sx / n, y: sy / n };
	const err = Math.hypot( seen.x - predicted.x, seen.y - predicted.y );
	const shift = Math.hypot( predicted.x - predicted.tx, predicted.y - predicted.ty );
	const ok = n > 20 && err <= TOL;
	if ( ! ok ) fails ++;
	console.log( `${ ok ? 'ok  ' : 'FAIL' } ${ c.name.padEnd( 26 ) } marker at ${ seen.x.toFixed( 1 ) }, ${ seen.y.toFixed( 1 ) } px, predicted ${ predicted.x.toFixed( 1 ) }, ${ predicted.y.toFixed( 1 ) }: ${ err.toFixed( 1 ) } px off (${ n } px; refraction moved it ${ shift.toFixed( 0 ) } px)` );

}

await browser.close();
process.exit( fails ? 1 : 0 );
