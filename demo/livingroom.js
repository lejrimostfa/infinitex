// Living room on a volcano: an 80s room at sunset, a bay window over a
// lava lake, a figure in a cable sweater looking out. Ten matters in one
// game-like scene (demo/roomMatters.js). Geometry from Blender
// (blender/livingroom.py -> demo/assets/livingroom.glb, UVs in metres).
// Light: the low sun through the window (shadows), the lava's glow from
// below (it lights the ceiling), the CRT's glow, a dim sky.
//   ?view=room | window | tv | fruit | rug | chair   start from a preset camera
//   arrows or ZQSD walk, Space and C up and down, a click focuses (walk.js)
// window.__ix: renderer, scene, camera, controls, view( name ), setTime( s ), ready.
// Event bus: none, a viewing page. The nav (nav.js) waits for __ix.ready.

import * as THREE from 'three/webgpu';
import { positionWorldDirection, vec2, vec3, mix, smoothstep, float, pow, max, uv } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './nav.js';
import { createMaterial } from '../src/index.js';
import { setTime } from '../src/core/clock.js';
import { createStage } from './scene.js';
import { createStats } from './stats.js';
import { createAdaptiveResolution } from './adaptive.js';
import { createWalk } from './walk.js';
import { createMannequin } from './mannequin.js';
import { MATTERS, SWEATER } from './roomMatters.js';

const params = new URLSearchParams( location.search );
const ctx = await createStage( { forceWebGL: params.has( 'webgl' ) } );
const { renderer, scene, camera, controls } = ctx;
ctx.floor.visible = false;
document.getElementById( 'panel' ).style.display = 'none';
camera.far = 1500;
camera.updateProjectionMatrix();
controls.maxDistance = 12;

// The sun's direction (three.js axes; the Blender sun sits at x -25, 330 m
// out, 10 m up, so here at z = -330). The sky and the key light share it.
const SUN = new THREE.Vector3( - 25, 10, - 330 );
const sunDir = SUN.clone().normalize();

// Sunset sky: violet overhead, orange at the horizon, a glow around the
// sun, dark ground under the horizon (hidden by the lake anyway).
{

	const d = positionWorldDirection;
	const up = max( d.y, 0 );
	let c = mix( vec3( 1.0, 0.45, 0.18 ), vec3( 0.16, 0.12, 0.3 ), pow( up, 0.45 ) );
	const s = max( d.dot( vec3( sunDir.x, sunDir.y, sunDir.z ) ), 0 );
	c = c.add( vec3( 1.0, 0.55, 0.2 ).mul( pow( s, 24 ).mul( 1.5 ).add( pow( s, 4 ).mul( 0.35 ) ) ) );
	scene.background = null;
	scene.backgroundNode = mix( vec3( 0.08, 0.04, 0.03 ), c, smoothstep( float( - 0.05 ), float( 0.02 ), d.y ) );

}

scene.environmentIntensity = 0.35; // dusk: the HDRI only as a fill
// The sky through the window and the lake under it fill the room: warm
// from above, red from below.
scene.add( new THREE.HemisphereLight( 0xffb27a, 0x7a2a12, 1.1 ) );
scene.fog = new THREE.Fog( 0x9a4a2a, 60, 700 ); // haze over the lake

const key = scene.children.find( ( o ) => o.isDirectionalLight && o.castShadow );
key.color.set( 0xffa060 );
key.intensity = 5;
key.position.copy( sunDir ).multiplyScalar( 20 );
key.target.position.set( 0, 0, 0 );
scene.add( key.target );
Object.assign( key.shadow.camera, { left: - 4, right: 4, top: 4, bottom: - 4, near: 1, far: 40 } );
key.shadow.camera.updateProjectionMatrix();
scene.children.find( ( o ) => o.isDirectionalLight && ! o.castShadow ).intensity = 0.15;

// The lake lights the room from below, through the window: on the
// ceiling, the window head, the figure. A spot from the lake aimed up
// through the opening, with a shadow, so the walls stop it.
const lavaGlow = new THREE.SpotLight( 0xff5a1e, 1400, 0, 0.75, 0.6, 2 );
lavaGlow.position.set( 0, - 4, - 8 );
lavaGlow.target.position.set( 0, 2.6, 0.5 );
lavaGlow.castShadow = true;
lavaGlow.shadow.mapSize.set( 1024, 1024 );
lavaGlow.shadow.bias = - 0.0005;
scene.add( lavaGlow, lavaGlow.target );
const tvGlow = new THREE.PointLight( 0x9fd0ff, 0.6, 3, 2 );
tvGlow.position.set( - 2.2, 0.8, - 0.2 );
scene.add( tvGlow );

// The room. Each ix_<key> slot gets its matter; meshes need tangents for
// the relief.
// The CRT's picture is 0.3 m square (scifi/crt.js): the 0.5 m tube maps
// onto one picture, centred, so the sun is not cut in two (its pixel and
// mask sizes in roomMatters.js are divided by the same 0.6).
const COORDS = { crt: uv().mul( 0.6 ).add( vec2( 0, 0.036 ) ) };
// The rug: one design (rug_mm, pile/knot.js) over the whole 2.6 x 1.8 m
// top, its fringed ends on the short sides. Design y runs along the rug's
// length; design x across, stretched 2.6 / 1.8 (knot_mm in roomMatters.js
// is widened by the same factor, so knots stay square).
function rugCoords( g ) {

	g.computeBoundingBox();
	const a = g.attributes.uv.array;
	let x0 = Infinity, x1 = - Infinity, y0 = Infinity, y1 = - Infinity;
	for ( let i = 0; i < a.length; i += 2 ) {

		x0 = Math.min( x0, a[ i ] ); x1 = Math.max( x1, a[ i ] );
		y0 = Math.min( y0, a[ i + 1 ] ); y1 = Math.max( y1, a[ i + 1 ] );

	}

	const L = x1 - x0, Wd = y1 - y0;
	return vec2( uv().y.sub( y0 ).mul( L / Wd ), uv().x.sub( x0 ) );

}

const matters = {};
const matter = ( k ) => matters[ k ] ??= MATTERS[ k ] ? createMaterial( MATTERS[ k ], COORDS[ k ] ? { coords: COORDS[ k ] } : {} ).material : null;
const rock = new THREE.MeshStandardMaterial( { color: 0x1a1512, roughness: 0.95 } );
const gltf = await new GLTFLoader().loadAsync( new URL( './assets/livingroom.glb', import.meta.url ).href );
const room = gltf.scene;
room.traverse( ( o ) => {

	if ( ! o.isMesh ) return;
	const k = o.material.name.replace( /^ix_/, '' );
	if ( o.geometry.index && o.geometry.attributes.uv ) o.geometry.computeTangents();
	if ( k === 'rug' ) COORDS.rug = rugCoords( o.geometry );
	o.material = k === 'rock' || k === 'sun' ? rock : matter( k ) ?? rock;
	const outside = k === 'lava' || k === 'rock' || k === 'sun';
	o.castShadow = ! outside;
	o.receiveShadow = ! outside;

} );
scene.add( room );

// The sun: Blender placed a sphere; the photosphere wants a disc facing
// the eye, same centre and radius (molten/photosphere.js), out of the haze.
const sunBall = room.getObjectByName( 'sun' );
sunBall.geometry.computeBoundingSphere();
const sunR = sunBall.geometry.boundingSphere.radius;
const sunDisc = new THREE.Mesh( new THREE.CircleGeometry( sunR, 128 ), matter( 'sun' ) );
sunDisc.material.fog = false;
sunDisc.position.copy( sunBall.geometry.boundingSphere.center ).applyMatrix4( sunBall.matrixWorld );
sunBall.visible = false;
scene.add( sunDisc );

// The figure at the window, back to us, in a cable sweater.
const figure = createMannequin( createMaterial( SWEATER ).material );
figure.group.position.set( 0.4, 0, - 1.75 );
figure.group.rotation.y = Math.PI;
figure.group.traverse( ( o ) => { if ( o.isMesh ) { o.castShadow = true; o.receiveShadow = true; } } );
scene.add( figure.group );

const VIEWS = {
	room: { pos: [ - 0.6, 1.6, 2.3 ], look: [ 0.1, 1.1, - 2.5 ] },
	window: { pos: [ 0.9, 1.55, - 0.4 ], look: [ - 0.3, 1.3, - 3 ] },
	tv: { pos: [ - 1.3, 1.0, 0.4 ], look: [ - 2.4, 0.8, - 0.2 ] },
	fruit: { pos: [ 0.75, 0.85, 0.55 ], look: [ 0.92, 0.58, 0.85 ] },
	rug: { pos: [ - 0.3, 2.3, 1.9 ], look: [ 0.1, 0, - 0.1 ] },
	chair: { pos: [ - 0.2, 1.0, 0.9 ], look: [ 0.9, 0.5, 0 ] },
};
function view( name ) {

	const v = VIEWS[ name ] ?? VIEWS.room;
	camera.position.set( ...v.pos );
	controls.target.set( ...v.look );
	camera.lookAt( ...v.look );

}

view( params.get( 'view' ) ?? 'room' );

// Adaptive resolution and the stats panel, as every demo. No post pass:
// shadows and each matter's own occlusion carry the contacts.
const adaptive = createAdaptiveResolution( renderer, { enabled: ! params.has( 'fullres' ) } );
const stats = createStats( { renderer, camera, adaptive, backend: params.has( 'webgl' ) ? 'WebGL2' : 'WebGPU' } );
// Arrows or ZQSD to walk, a click to focus (walk.js).
const walk = createWalk( { camera, controls, scene, maxSpeed: 1.5 } );
let clock = 0, last = performance.now();
renderer.setAnimationLoop( () => {

	const now = performance.now();
	const dt = ( now - last ) / 1000;
	clock += dt;
	last = now;
	setTime( clock );
	walk.update( dt );
	controls.update();
	sunDisc.lookAt( camera.position );
	stats.beginFrame();
	renderer.render( scene, camera );
	stats.endFrame( camera.position.distanceTo( controls.target ) );
	adaptive.frame();

} );

window.__ix = { renderer, scene, camera, controls, walk, adaptive, view, setTime, matters, ready: true };
