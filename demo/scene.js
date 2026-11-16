// Demo scene: a mannequin in a knitted sweater (mannequin.js) and a flat
// swatch used only by the quality gate. UVs are in meters.
// Renderer, camera and controls come from the camera kit's stage
// (src/camera/stage.js: reversed depth, near 1 um); this adds the
// environment light, the sun and the floor.

import * as THREE from 'three/webgpu';
import { createCameraStage } from '../src/camera/index.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { createMannequin } from './mannequin.js';

// Rescale a geometry's UVs so one UV unit is one meter on the surface.
export function uvToMeters( geometry, metersU, metersV ) {

	const uv = geometry.attributes.uv;
	for ( let i = 0; i < uv.count; i ++ ) uv.setXY( i, uv.getX( i ) * metersU, uv.getY( i ) * metersV );
	uv.needsUpdate = true;
	return geometry;

}

// Renderer, light, floor, camera and orbit controls. Shared by both demos.
export async function createStage( { forceWebGL } ) {

	const { renderer, camera, controls } = await createCameraStage( { forceWebGL, trackTimestamp: true } );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	camera.position.set( 0.9, 1.45, 1.9 );

	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x15161a );
	const pmrem = new THREE.PMREMGenerator( renderer );
	// A real sky by default (CC0 Poly Haven HDRI, overcast field): its
	// dynamic range, bounce colours and soft sun make matter read as real;
	// ?env=room keeps the synthetic studio of three.js.
	if ( new URLSearchParams( location.search ).get( 'env' ) === 'room' ) {

		scene.environment = pmrem.fromScene( new RoomEnvironment(), 0.04 ).texture;
		scene.environmentIntensity = 0.6;

	} else {

		const hdr = await new HDRLoader().loadAsync( new URL( './assets/hdri/kloppenheim_06_2k.hdr', import.meta.url ).href );
		hdr.mapping = THREE.EquirectangularReflectionMapping;
		scene.environment = hdr;
		scene.environmentIntensity = 0.9;

	}

	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	const sun = new THREE.DirectionalLight( 0xfff1e0, 2.2 );
	sun.position.set( 1.5, 2.5, 1.2 );
	sun.castShadow = true; // each demo fits sun.shadow.camera to its scene
	sun.shadow.mapSize.set( 4096, 4096 );
	sun.shadow.bias = - 0.0002;
	sun.shadow.normalBias = 0.002;
	scene.add( sun );

	const fill = new THREE.DirectionalLight( 0xd8e4ff, 0.5 );
	fill.position.set( - 2, 1, - 1 );
	scene.add( fill );

	const floor = new THREE.Mesh( new THREE.CircleGeometry( 1.2, 64 ), new THREE.MeshStandardMaterial( { color: 0x1d1f24, roughness: 0.9 } ) );
	floor.rotation.x = - Math.PI / 2;
	scene.add( floor );

	return { THREE, renderer, scene, camera, controls, floor };

}

export async function createScene( { forceWebGL, knitMaterial } ) {

	const { renderer, scene, camera, controls, floor } = await createStage( { forceWebGL } );
	const mannequin = createMannequin( knitMaterial );
	scene.add( mannequin.group );

	// Gate swatch: 30 cm flat square, hidden outside the gate.
	const swatchGeo = uvToMeters( new THREE.PlaneGeometry( 0.3, 0.3, 1, 1 ), 0.3, 0.3 );
	swatchGeo.rotateX( - Math.PI / 2 );
	swatchGeo.computeTangents();
	const swatch = new THREE.Mesh( swatchGeo, knitMaterial );
	swatch.visible = false;
	scene.add( swatch );

	const meshes = mannequin.meshes;
	controls.target.set( 0, 1.2, 0 );

	// The distance to the orbit target stands in for the distance to the
	// surface: zoom-to-cursor pulls the target onto the wool.
	function updateClip() {

		return camera.position.distanceTo( controls.target );

	}


	const gate = { swatch, hide: [ mannequin.group, floor ] };
	return { THREE, renderer, scene, camera, controls, meshes, mannequin, swatch, gate, updateClip };

}
