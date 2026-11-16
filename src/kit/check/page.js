// The page of the family check (bin/infinitex-check.mjs) and of the kit
// viewer. Loads one family module, registers it, shows it on a rounded
// cube and a floor swatch, and exposes the measures to Playwright.
//   check.html?family=<module url>&name=<name>&preset=<json>[&webgl]
//   check.html?volume=1&liquid=wine       a liquid volume in a glass and a bottle
// <module url>: /src/families/terrazzo/index.js in this repository, or
// /@fs/<absolute path>/index.js for a family in a game project.
// window.__ixCheck: { ready, kind, family, gate( heights ), perf( dists ), sheet( heights ) }
// The page reacts to the material's events: materialReady fills the info line.

import * as THREE from 'three/webgpu';
import { uv, vec2 } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStage, uvToMeters } from '../../../demo/scene.js';
import { createMaterial, registerFamily, listFamilies } from '../../index.js';
import { framePerf, contactSheet } from './measure.js';

const q = new URLSearchParams( location.search );
const info = document.getElementById( 'info' );
const errors = [];
const failed = ( m ) => { errors.push( String( m ) ); window.__ixCheckFailed = true; };
addEventListener( 'error', ( e ) => failed( e.message ) );
addEventListener( 'unhandledrejection', ( e ) => failed( e.reason?.message ?? e.reason ) );
const ctx = await createStage( { forceWebGL: q.has( 'webgl' ) } );
const { renderer, scene, camera, controls, floor } = ctx;

if ( q.has( 'volume' ) ) {

	const { buildVolumeScene } = await import( './volume.js' );
	await buildVolumeScene( ctx, q );

} else {

	await buildFamilyScene();

}

async function buildFamilyScene() {

	const url = q.get( 'family' ) ?? '/src/families/terrazzo/index.js';
	const mod = await import( /* @vite-ignore */ url );
	const impl = mod.default ?? mod.impl;
	if ( ! impl ) throw new Error( `infinitex check: ${ url } has no default export (the family impl)` );
	const name = q.get( 'name' ) ?? impl.defaults?.family;
	if ( ! listFamilies().some( ( f ) => f.name === name && f.builtin ) ) registerFamily( name, impl );
	const preset = { family: name, ...JSON.parse( q.get( 'preset' ) ?? '{}' ) };

	// Gate swatch: 30 cm flat square, uv in metres (as demo/scene.js).
	const swatchGeo = uvToMeters( new THREE.PlaneGeometry( 0.3, 0.3, 1, 1 ), 0.3, 0.3 ).rotateX( - Math.PI / 2 );
	swatchGeo.computeTangents();
	const ix = createMaterial( preset, { coords: uv() } );
	ix.addEventListener( 'materialReady', ( e ) => { info.textContent = `${ e.detail.family }: ${ e.detail.preset.intent ?? '' }`; } );
	const swatch = new THREE.Mesh( swatchGeo, ix.material );
	swatch.visible = false;
	scene.add( swatch );
	// A transmissive matter is checked over a grey backdrop 2 cm below.
	const kind = impl.kind ?? ( ix.material.transmissionNode ? 'transmissive' : ix.material.emissiveNode ? 'emissive' : 'opaque' );
	if ( kind === 'transmissive' ) {

		const back = new THREE.Mesh( new THREE.PlaneGeometry( 2, 2 ).rotateX( - Math.PI / 2 ), new THREE.MeshStandardMaterial( { color: 0x7a7a7a, roughness: 0.9 } ) );
		back.position.y = - 0.02;
		scene.add( back );

	}

	// Perf plane: 1 m, fills a 1080p frame from 30 cm down.
	const perfGeo = uvToMeters( new THREE.PlaneGeometry( 1, 1 ), 1, 1 ).rotateX( - Math.PI / 2 );
	perfGeo.computeTangents();
	const perfPlane = new THREE.Mesh( perfGeo, ix.material );
	perfPlane.visible = false;
	scene.add( perfPlane );

	const size = 0.2;
	let cubeGeo = new RoundedBoxGeometry( size, size, size, 6, 0.015 );
	cubeGeo.deleteAttribute( 'uv1' );
	cubeGeo = mergeVertices( cubeGeo ); // computeTangents needs an index
	cubeGeo.computeTangents();
	const show = createMaterial( preset, { coords: uv().mul( vec2( size, size ) ) } );
	const cube = new THREE.Mesh( cubeGeo, show.material );
	cube.position.y = size / 2;
	scene.add( cube );
	controls.target.set( 0, size / 2, 0 );
	camera.position.set( 0.25, 0.3, 0.4 );

	ctx.gate = { swatch, hide: [ cube, floor ] };
	const run = async ( f ) => { renderer.setAnimationLoop( null ); try { return await f(); } finally { renderer.setAnimationLoop( loop ); } };
	window.__ixCheck = {
		family: name, kind, ix, errors,
		gate: ( heights ) => run( async () => ( await import( '../../../tests/gate.js' ) ).runGate( ctx, heights ) ),
		perf: ( dists, frames ) => run( () => framePerf( ctx, { plane: perfPlane, hide: [ cube, floor ] }, dists, frames ) ),
		sheet: ( heights ) => run( () => contactSheet( ctx, { swatch, hide: [ cube, floor ] }, heights, name ) ),
		ready: true,
	};

}

function loop() {

	controls.update();
	renderer.render( scene, camera );

}

renderer.setAnimationLoop( loop );
if ( ! window.__ixCheck ) window.__ixCheck = { ready: true, errors };
