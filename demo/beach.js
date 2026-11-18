// Paper beach: a tropical lagoon at true scale (metres). The ground is
// one height field (beach/terrain.js), the sea is the aquarium's water
// (core/watersurface.js, core/underwater.js) on an open sea with foam on
// the shore and the reef (beach/ocean.js). The props are folded paper
// (papercraft GLBs, beach/props.js, later), the matter Infinitex paper.
//   ?view=beach | sea | under | high   start from a preset camera
//   ?nofx  no AO and no depth of field   ?nograde  no bloom and grade
//   ?noshafts  ?nosnow
// window.__ix: renderer, scene, camera, controls, kit, waterBody, view,
// setTime, ready.
//
// Event bus: the camera kit (src/camera/kit.js); the page listens to
// pixelRatioChanged to resize its waterline targets.

import * as THREE from 'three/webgpu';
import { positionWorldDirection, vec2, vec3, uv, fog, rangeFogFactor } from 'three/tsl';
import './nav.js';
import { setTime } from '../src/core/clock.js';
import { reliefLight } from '../src/core/relief.js';
import { waterBody, applyUnderwater } from '../src/core/underwater.js';
import { createWaterline } from '../src/core/waterline.js';
import { createMirror } from '../src/core/mirror.js';
import { refractSurface, refractOff } from '../src/core/refraction.js';
import { createShafts } from '../src/core/shafts.js';
import { createSnow } from '../src/core/snow.js';
import { createMaterial } from '../src/index.js';
import { createStage } from './scene.js';
import { createStats } from './stats.js';
import { createDemoKit } from './camerakit.js';
import { groundGeometry, sandHeight, deepFloor } from './beach/terrain.js';
import { createOcean } from './beach/ocean.js';
import { createViews } from './beach/views.js';
import { tropicalSky } from './beach/sky.js';
import { loadProps, place, fileURL } from './beach/props.js';
import { createClouds } from './beach/clouds.js';
import { placements } from './beach/layout.js';
import { createShip } from './beach/ship.js';

const params = new URLSearchParams( location.search );
const ctx = await createStage( { forceWebGL: params.has( 'webgl' ) } );
const { renderer, scene, camera, controls } = ctx;
ctx.floor.visible = false;
camera.far = 20000;
camera.updateProjectionMatrix();
controls.maxDistance = 2000;
document.getElementById( 'panel' ).style.display = 'none';

// A tropical afternoon: one warm sun, high behind the beach. Looking out
// to sea the lagoon, the clouds and the props are lit from the front, as on
// a postcard; with the sun over the sea the cut paper clouds showed their
// shaded side and read grey.
const sun = scene.children.find( ( o ) => o.isDirectionalLight && o.castShadow );
sun.position.set( - 40, 70, - 45 );
sun.color.set( 0xffe8c8 );
sun.intensity = + params.get( 'sun' ) || 3.6;
reliefLight.value.copy( sun.position ).normalize();
const sky = tropicalSky( reliefLight );
scene.background = null;
scene.backgroundNode = sky( positionWorldDirection );
// The ambient light from this sky (blue fill in the shadows), not the
// stage's overcast HDRI, which filled every shadow with grey and flattened
// the beach. Low, as in the living room (0.35): the sun gives the shapes.
{

	const skyScene = new THREE.Scene();
	skyScene.backgroundNode = sky( positionWorldDirection );
	scene.environment = new THREE.PMREMGenerator( renderer ).fromScene( skyScene ).texture;

}
scene.environmentIntensity = + params.get( 'env' ) || 0.45;

// The lagoon's water, at true scale (the aquarium scales a tank up).
const W = waterBody;
W.level.value = 0;
W.depthScale.value = 1;
W.sizeM.value = 9; // a long, low swell
W.featureM.value = 0.3;
W.amount.value = 0.35;
W.inscatter.value.set( '#46e8d4' );
W.deep.value.set( '#0f6f95' );
W.sunGlow.value = 1.2;
W.fill.value = 0.22;
W.causticTint.value.set( '#fff0c0' );
W.rim.value = 0.3;
W.absorb.value.set( 0.3, 0.05, 0.02 );
W.turbidity.value = 0.05; // a lagoon is clear for tens of metres
W.shafts.value = 1.0;
W.shaftCut.value = 1.5;

// Everything that stands in or by the water sits in one clipping group:
// the water's mirrors draw it cut at the level (core/mirror.js).
const world = new THREE.ClippingGroup();
scene.add( world );

// The ground: Infinitex sand, under water where it dips (caustics, colour
// loss). UVs are metres.
const sandPreset = { family: 'ground', mode: 'sand', grain_mm: 0.35, color: '#e8d4a8', color2: '#c99b62', color3: '#2b2622', ripple_mm: 90, ripple: 0.5, specks: 0.3, sparkle: 0.6, roughness: 0.85, seed: 2, underwater: 1 };
const ground = new THREE.Mesh( groundGeometry( + params.get( 'step' ) || 1.5 ), createMaterial( sandPreset, { coords: uv() } ).material );
ground.receiveShadow = true;
world.add( ground );
world.add( deepFloor( applyUnderwater ) );

// The folded paper props (beach/props.js, beach/layout.js); ?noprops.
const props = params.has( 'noprops' ) ? {} : await loadProps();
const placed = [];
for ( const e of placements() ) if ( props[ e.name ] ) placed.push( place( props[ e.name ], world, e ) );

// The capital ship (beach/ship.js), out at sea until the timeline brings
// it in; ?ship=0..1 puts it on its path. As its shadow covers the bay the
// sun dims, the caustics and the shafts fade (cover, 0 to 1).
const ship = props.ship ? createShip( props.ship, scene, sun.position ) : null;
const SUN = sun.intensity, ENV = scene.environmentIntensity;
function setShip( t ) {

	if ( ! ship ) return;
	ship.update( t );
	const c = ship.cover;
	sun.intensity = SUN * ( 1 - 0.8 * c );
	scene.environmentIntensity = ENV * ( 1 - 0.35 * c );
	W.caustics.value = 1 - 0.85 * c;

}
setShip( + params.get( 'ship' ) || 0 );
// Cut paper clouds (beach/clouds.js), parted by the ship; ?noclouds.
let clouds = null;
if ( ! params.has( 'noclouds' ) && fileURL( 'clouds.png' ) ) {

	const tex = await new THREE.TextureLoader().loadAsync( fileURL( 'clouds.png' ) );
	const { rects } = await ( await fetch( fileURL( 'clouds.json' ) ) ).json();
	clouds = createClouds( { tex, rects, scene } );

}

// Aerial haze: kilometres away, things take the sky's colour. It is what
// tells the ship's size; the lagoon and the beach are too near to change.
scene.fogNode = fog( vec3( 0.62, 0.79, 0.92 ), rangeFogFactor( 1500, 18000 ) );

// The sea, and its two mirrors (what is above, seen from above; the
// lagoon, seen from below).
const hide = [], hideUp = [];
const mirrors = {
	up: createMirror( { group: world, level: W.level.value, side: 1, hide: hideUp } ),
	down: createMirror( { group: world, level: W.level.value, side: - 1, hide } ),
};
const prepare = ( cam ) => { mirrors.up.render( renderer, cam ); mirrors.down.render( renderer, cam ); };
const ocean = createOcean( { sky, mirrors, W } );
for ( const m of [ ocean.near, ocean.far ] ) { world.add( m ); hide.push( m ); hideUp.push( m ); }

// The camera port at the waterline: near or under the surface the frame
// is drawn twice (air and water) and split along the line.
const port = createWaterline( renderer, scene, camera, { lens: true, meniscus: 0.0008, power: 2.5, prepare } );
const resize = () => { const s = renderer.getDrawingBufferSize( new THREE.Vector2() ); port.setSize( s.x, s.y ); };
addEventListener( 'resize', resize );

// Light shafts and floating specks in the lagoon.
const LAGOON = { min: [ - 160, - 26, - 30 ], max: [ 160, 0, 190 ] };
if ( ! params.has( 'nosnow' ) ) scene.add( createSnow( { box: { min: [ - 40, - 3, 0 ], max: [ 40, 0, 60 ] }, count: 3000, radius: [ 0.002, 0.008 ], near: 0.6 } ) );
const shafts = params.has( 'noshafts' ) ? null : createShafts( renderer, camera, { steps: 8, box: LAGOON } );

const fx = ! params.has( 'nofx' );
const GRADE = { shadowTint: [ 0.2, 0.75, 0.85 ], shadows: 0.25, highlights: 0.2, highlightTint: [ 1, 0.9, 0.7 ], vignetteTint: [ 0.6, 0.8, 0.85 ] };
const kit = createDemoKit( { renderer, scene, camera, controls, params, options: { maxSpeed: 12, shadows: true, shadowFar: 120, ao: fx, gi: fx && ! params.has( 'nogi' ), aoMax: 2, dof: fx, maxFocus: 3000, target: fx ? port.rtC : null, shafts, grade: fx && ! params.has( 'nograde' ) ? GRADE : null } } );
kit.addEventListener( 'pixelRatioChanged', resize );
// Tuning from the URL: ?bounce= (SSGI gain), ?ao= (AO strength).
if ( kit.post?.bounce ) kit.post.bounce.value = params.has( 'bounce' ) ? + params.get( 'bounce' ) : 0.3; // sand and sunlit paper light the undersides
if ( kit.post?.strength && params.has( 'ao' ) ) kit.post.strength.value = + params.get( 'ao' );
const stats = createStats( { renderer, camera, adaptive: kit.adaptive, backend: params.has( 'webgl' ) ? 'WebGL2' : 'WebGPU' } );

const { view } = createViews( { camera, controls, sandHeight } );
view( params.get( 'view' ) ?? 'beach' );

// Near or under the surface: the port (two passes). Above: one pass, the
// lagoon floor bent by the flat surface (core/refraction.js).
function draw() {

	const y = camera.position.y - W.level.value;
	if ( y < 0.6 ) { if ( fx ) kit.render( port.compose() ); else port.render(); return; }
	refractSurface( camera.position, W.level.value );
	prepare( camera );
	if ( fx ) {

		renderer.setRenderTarget( port.rtA );
		renderer.render( scene, camera );
		renderer.setRenderTarget( null );
		kit.render( port.rtA );

	} else { renderer.setRenderTarget( null ); renderer.render( scene, camera ); }

}

let clock = 0, last = performance.now();
renderer.setAnimationLoop( () => {

	const now = performance.now();
	const dt = Math.min( 0.1, ( now - last ) / 1000 );
	clock += dt;
	last = now;
	setTime( clock );
	const under = camera.position.y < W.level.value;
	if ( kit.lens ) kit.lens.bokehScale = under ? 0.5 : 1;
	W.shafts.value = ( under ? 1.0 : 0.3 ) * ( 1 - ( ship?.cover ?? 0 ) );
	if ( kit.post?.grade ) kit.post.grade.uniforms.water.value = under ? 1 : 0;
	clouds?.update( clock, ship && ship.t > 0 ? ship.group.position : null );
	kit.update( dt );
	stats.beginFrame();
	draw();
	stats.endFrame( camera.position.distanceTo( controls.target ) );

} );

window.__ix = { clouds, ship, setShip, props, placed, renderer, scene, camera, controls, kit, waterBody: W, world, ground, ocean, view, setTime, draw, refractOff, ready: true };
