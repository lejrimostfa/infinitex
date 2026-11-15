// Cross-scale quality gate, runs inside the page (WebGPU or WebGL2).
//
// For each camera height d (top-down on the flat swatch):
//   test  = render at S x S, 1 sample per pixel (what the game sees)
//   ref   = render at 8S x 8S, box-downsampled to S x S (64 spp ground truth)
// Metrics, all on linear luminance:
//   meanShift  |mean(test) - mean(ref)| / mean(ref)   cross-scale consistency
//   blurRmse   RMSE after a 4 px blur, / mean(ref)     structure at that scale
//   shimmer    change between d and 1.01 d after a 2x blur, test vs ref ratio
//   shimmerRaw same without the blur (also counts legit sharpness)
// The ref itself shows how the true average drifts with distance.

import * as THREE from 'three/webgpu';

const S = 96, K = 8;

async function renderLum( renderer, scene, camera, size ) {

	const rt = new THREE.RenderTarget( size, size, { type: THREE.HalfFloatType, samples: 0 } );
	renderer.setRenderTarget( rt );
	await renderer.renderAsync( scene, camera );
	renderer.setRenderTarget( null );
	const raw = await renderer.readRenderTargetPixelsAsync( rt, 0, 0, size, size );
	rt.dispose();
	const lum = new Float32Array( size * size );
	const f = raw instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat : ( x ) => x;
	for ( let i = 0; i < size * size; i ++ ) {

		lum[ i ] = 0.2126 * f( raw[ i * 4 ] ) + 0.7152 * f( raw[ i * 4 + 1 ] ) + 0.0722 * f( raw[ i * 4 + 2 ] );

	}

	return lum;

}

function downsample( src, size, k ) {

	const n = size / k, out = new Float32Array( n * n );
	for ( let y = 0; y < size; y ++ ) for ( let x = 0; x < size; x ++ ) out[ ( ( y / k ) | 0 ) * n + ( ( x / k ) | 0 ) ] += src[ y * size + x ];
	for ( let i = 0; i < n * n; i ++ ) out[ i ] /= k * k;
	return out;

}

const mean = ( a ) => a.reduce( ( s, v ) => s + v, 0 ) / a.length;
const blur = ( a, n ) => downsample( a, n, 4 );
const rmse = ( a, b ) => Math.sqrt( a.reduce( ( s, v, i ) => s + ( v - b[ i ] ) ** 2, 0 ) / a.length );

// Double-counted sheen check. Far, grazing views of the swatch (where sheen
// matters most): fuzz on with the base sheen lowered, against fuzz off with
// the full base sheen. The fuzz must replace the sheen it takes, not add to it.
async function sheenCheck( renderer, scene, gate ) {

	const cam = new THREE.PerspectiveCamera( 20, 1, 0.01, 10 );
	const u = gate.ix.uniforms;
	const keep = u.sheenKeep.value;
	const out = [];
	for ( const deg of [ 45, 70, 80 ] ) {

		const a = deg * Math.PI / 180;
		cam.position.set( 0, 0.4 * Math.cos( a ), 0.4 * Math.sin( a ) );
		cam.lookAt( 0, 0, 0 );
		cam.updateProjectionMatrix();
		const on = mean( await renderLum( renderer, scene, cam, S ) );
		for ( const f of gate.fuzz ) f.visible = false;
		u.sheenKeep.value = 1;
		const off = mean( await renderLum( renderer, scene, cam, S ) );
		for ( const f of gate.fuzz ) f.visible = true;
		u.sheenKeep.value = keep;
		out.push( { deg, on, off, ratio: on / off } );

	}

	return out;

}

export async function runGate( { renderer, scene, gate }, heights ) {

	const cam = new THREE.PerspectiveCamera( 30, 1, 0.001, 100 );
	const hidden = gate.hide;
	for ( const m of hidden ) m.visible = false;
	gate.swatch.visible = true;
	const toneMapping = renderer.toneMapping;
	renderer.toneMapping = THREE.NoToneMapping;

	const place = ( d ) => {

		cam.position.set( 0.013, d, 0.007 );
		cam.lookAt( 0.013, 0, 0.007 );
		cam.near = d * 0.05;
		cam.far = d * 10;
		cam.updateProjectionMatrix();

	};

	const rows = [];
	for ( const d of heights ) {

		place( d );
		const test = await renderLum( renderer, scene, cam, S );
		const ref = downsample( await renderLum( renderer, scene, cam, S * K ), S * K, K );
		place( d * 1.01 );
		const test2 = await renderLum( renderer, scene, cam, S );
		const ref2 = downsample( await renderLum( renderer, scene, cam, S * K ), S * K, K );

		const mRef = mean( ref );
		rows.push( {
			d,
			meanTest: mean( test ),
			meanRef: mRef,
			meanShift: Math.abs( mean( test ) - mRef ) / mRef,
			blurRmse: rmse( blur( test, S ), blur( ref, S ) ) / mRef,
			shimmerRaw: rmse( test, test2 ) / Math.max( 1e-6, rmse( ref, ref2 ) ),
			// Moire and beating survive a 2x box blur, legit sharpness does not.
			shimmer: rmse( downsample( test, S, 2 ), downsample( test2, S, 2 ) )
				/ Math.max( 1e-6, rmse( downsample( ref, S, 2 ), downsample( ref2, S, 2 ) ) ),
		} );

	}

	const sheen = gate.fuzz?.length ? await sheenCheck( renderer, scene, gate ) : null;

	for ( const m of hidden ) m.visible = true;
	gate.swatch.visible = false;
	renderer.toneMapping = toneMapping;
	return { rows, sheen };

}
