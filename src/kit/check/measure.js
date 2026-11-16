// In-page measures of the family check (src/kit/check/page.js).
//   framePerf     frame time at 1920x1080, the matter filling the frame,
//                 seen face on from each distance; also the same view with
//                 a grey material, so cost = frame - grey (as in
//                 docs/performance.md section 2). Each frame reads one pixel
//                 back, which waits for the GPU: an upper bound.
//   contactSheet  the swatch seen from each gate height, one tile each,
//                 tone mapped (ACES fit, one exposure for the sheet) and
//                 labelled: a PNG data URL.

import * as THREE from 'three/webgpu';

function topDown( cam, d ) {

	cam.position.set( 0.013, d, 0.007 );
	cam.lookAt( 0.013, 0, 0.007 );
	cam.near = d * 0.05;
	cam.far = d * 10;
	cam.updateProjectionMatrix();

}

const median = ( a ) => a.sort( ( x, y ) => x - y )[ a.length >> 1 ];

export async function framePerf( { renderer, scene }, { plane, hide }, dists, frames = 30 ) {

	const rt = new THREE.RenderTarget( 1920, 1080, { type: THREE.HalfFloatType } );
	const cam = new THREE.PerspectiveCamera( 40, 1920 / 1080, 0.001, 100 );
	const grey = new THREE.MeshStandardMaterial( { color: 0x808080, roughness: 0.6 } );
	const mat = plane.material;
	for ( const m of hide ) m.visible = false;
	plane.visible = true;
	renderer.setRenderTarget( rt );
	const time = async () => {

		const one = async () => { await renderer.renderAsync( scene, cam ); await renderer.readRenderTargetPixelsAsync( rt, 960, 540, 1, 1 ); };
		for ( let i = 0; i < 5; i ++ ) await one();
		const t = [];
		for ( let i = 0; i < frames; i ++ ) { const t0 = performance.now(); await one(); t.push( performance.now() - t0 ); }
		return median( t );

	};

	const rows = [];
	for ( const d of dists ) {

		topDown( cam, d );
		plane.material = mat;
		const ms = await time();
		plane.material = grey;
		const greyMs = await time();
		rows.push( { d, ms, greyMs, cost: Math.max( 0, ms - greyMs ) } );

	}

	plane.material = mat;
	plane.visible = false;
	for ( const m of hide ) m.visible = true;
	renderer.setRenderTarget( null );
	rt.dispose();
	grey.dispose();
	return rows;

}

const aces = ( x ) => Math.min( 1, Math.max( 0, ( x * ( 2.51 * x + 0.03 ) ) / ( x * ( 2.43 * x + 0.59 ) + 0.14 ) ) );
const srgb = ( x ) => 255 * ( x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow( x, 1 / 2.4 ) - 0.055 );

export async function contactSheet( { renderer, scene }, { swatch, hide }, heights, label, T = 160 ) {

	const cam = new THREE.PerspectiveCamera( 30, 1, 0.001, 100 );
	const rt = new THREE.RenderTarget( T, T, { type: THREE.HalfFloatType } );
	const canvas = document.createElement( 'canvas' );
	canvas.width = T * heights.length;
	canvas.height = T + 22;
	const g = canvas.getContext( '2d' );
	g.fillStyle = '#15161a';
	g.fillRect( 0, 0, canvas.width, canvas.height );
	const tm = renderer.toneMapping;
	renderer.toneMapping = THREE.NoToneMapping;
	for ( const m of hide ) m.visible = false;
	swatch.visible = true;
	const flip = !! renderer.backend.isWebGLBackend;
	const tiles = [];
	for ( let k = 0; k < heights.length; k ++ ) {

		topDown( cam, heights[ k ] );
		renderer.setRenderTarget( rt );
		await renderer.renderAsync( scene, cam );
		const raw = await renderer.readRenderTargetPixelsAsync( rt, 0, 0, T, T );
		const f = raw instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat : ( x ) => x;
		tiles.push( Float32Array.from( raw, f ) );

	}

	// One exposure for the whole sheet, from the farthest tile: its mean
	// luminance maps to 0.3. Bright matters keep their fine tones out of the
	// clipped top of the curve, and tiles stay comparable with each other.
	let sum = 0;
	for ( let i = 0; i < T * T; i ++ ) sum += 0.2126 * tiles[ 0 ][ i * 4 ] + 0.7152 * tiles[ 0 ][ i * 4 + 1 ] + 0.0722 * tiles[ 0 ][ i * 4 + 2 ];
	const exposure = 0.3 / Math.max( 1e-4, sum / ( T * T ) );
	for ( let k = 0; k < heights.length; k ++ ) {

		const img = g.createImageData( T, T );
		for ( let y = 0; y < T; y ++ ) for ( let x = 0; x < T; x ++ ) {

			const s = ( ( flip ? T - 1 - y : y ) * T + x ) * 4, o = ( y * T + x ) * 4;
			for ( let c = 0; c < 3; c ++ ) img.data[ o + c ] = srgb( aces( tiles[ k ][ s + c ] * exposure ) );
			img.data[ o + 3 ] = 255;

		}

		g.putImageData( img, k * T, 0 );
		g.fillStyle = '#ddd';
		g.font = '13px system-ui';
		const h = heights[ k ];
		g.fillText( h >= 0.01 ? `${ ( h * 100 ).toFixed( h >= 0.1 ? 0 : 1 ) } cm` : `${ ( h * 1000 ).toFixed( 0 ) } mm`, k * T + 6, T + 16 );

	}

	g.fillText( label, canvas.width - 8 - g.measureText( label ).width, T + 16 );
	renderer.setRenderTarget( null );
	renderer.toneMapping = tm;
	swatch.visible = false;
	for ( const m of hide ) m.visible = true;
	rt.dispose();
	return canvas.toDataURL( 'image/png' );

}
