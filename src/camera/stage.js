// Renderer, camera and controls settings that Infinitex needs to get close.
// A material holds detail down to 1 um, so the camera must be able to sit
// 0.1 mm from a surface without the near plane cutting it, and without
// depth fighting far away.
//
//   reversed depth   a float depth buffer read backwards keeps precision
//                    from 1 um to 100 m. It is a renderer constructor
//                    option (RENDERER_OPTIONS): it cannot be set later.
//   near, far        1e-6 and 100 m, fixed. (A raycast to place the near
//                    plane every frame cost 50 ms on a skinned character.)
//                    Without reversed depth a near of 1e-6 breaks the depth
//                    test: use a near of 1e-3 or more then.
//   controls         OrbitControls with damping, zoom to the cursor, and a
//                    minimum distance of 0.2 mm (the walk stops at 0.1 mm).
//
// Two ways in: createCameraStage() builds the three objects with these
// settings, or applyCameraSettings() sets them on a game's own objects.
// Event bus: none. Resize is handled by createCameraStage only.

import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Pass these to new WebGPURenderer( { ...RENDERER_OPTIONS, ... } ).
export const RENDERER_OPTIONS = Object.freeze( { reversedDepthBuffer: true } );

export const CAMERA_SETTINGS = Object.freeze( { near: 1e-6, far: 100, minDistance: 2e-4, maxDistance: 5, zoomSpeed: 1.6 } );

// Sets near, far and the controls limits. Warns when the renderer has no
// reversed depth buffer, and then keeps the near plane at 1 mm.
export function applyCameraSettings( { renderer = null, camera, controls = null, settings = {} } ) {

	const s = { ...CAMERA_SETTINGS, ...settings };
	let near = s.near;
	if ( renderer && renderer.reversedDepthBuffer !== true && near < 1e-3 ) {

		console.warn( 'infinitex/camera: the renderer has no reversed depth buffer, near stays at 1 mm. Create it with RENDERER_OPTIONS.' );
		near = 1e-3;

	}

	camera.near = near;
	camera.far = s.far;
	camera.updateProjectionMatrix();
	if ( controls ) {

		controls.enableDamping = true;
		controls.zoomToCursor = true;
		controls.minDistance = s.minDistance;
		controls.maxDistance = s.maxDistance;
		controls.zoomSpeed = s.zoomSpeed;

	}

	return s;

}

// A full-window renderer, a 40 degree camera and orbit controls, all set.
// The canvas follows the window size.
export async function createCameraStage( { forceWebGL = false, container = document.body, fov = 40, antialias = true, trackTimestamp = false, settings = {} } = {} ) {

	const renderer = new THREE.WebGPURenderer( { ...RENDERER_OPTIONS, antialias, forceWebGL, trackTimestamp } );
	renderer.setPixelRatio( Math.min( devicePixelRatio, 2 ) );
	renderer.setSize( innerWidth, innerHeight );
	container.appendChild( renderer.domElement );
	await renderer.init();

	const camera = new THREE.PerspectiveCamera( fov, innerWidth / innerHeight, 1e-3, 50 );
	const controls = new OrbitControls( camera, renderer.domElement );
	applyCameraSettings( { renderer, camera, controls, settings } );

	const onResize = () => {

		camera.aspect = innerWidth / innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( innerWidth, innerHeight );

	};
	addEventListener( 'resize', onResize );
	return { renderer, camera, controls, dispose: () => removeEventListener( 'resize', onResize ) };

}
