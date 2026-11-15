// Frame time at 1920x1080, film camera at `dist` meters from the chest so
// the sweater fills the screen. Each frame reads one pixel back, which waits
// for the GPU: an upper bound that includes the readback round trip.

import * as THREE from 'three/webgpu';
import { FILM } from '../demo/film.js';

// Inverse of the film's distance curve: distance -> k.
function kForDistance( d ) {

	const e = ( Math.log( FILM.dFar ) - Math.log( d ) ) / ( Math.log( FILM.dFar ) - Math.log( FILM.dNear ) );
	return Math.acos( 1 - 2 * e ) / Math.PI;

}

export async function perfRun( { renderer, scene, camera }, film, frames = 60, dist = 0.06 ) {

	const rt = new THREE.RenderTarget( 1920, 1080, { type: THREE.HalfFloatType } );
	const aspect = camera.aspect;
	camera.aspect = 1920 / 1080;
	film.pose( kForDistance( dist ) );
	renderer.setRenderTarget( rt );
	const one = async () => {

		await renderer.renderAsync( scene, camera );
		await renderer.readRenderTargetPixelsAsync( rt, 960, 540, 1, 1 );

	};
	for ( let i = 0; i < 5; i ++ ) await one();
	const times = [];
	for ( let i = 0; i < frames; i ++ ) {

		const t0 = performance.now();
		await one();
		times.push( performance.now() - t0 );

	}

	renderer.setRenderTarget( null );
	rt.dispose();
	camera.aspect = aspect;
	camera.updateProjectionMatrix();
	times.sort( ( a, b ) => a - b );
	return times[ times.length >> 1 ];

}
