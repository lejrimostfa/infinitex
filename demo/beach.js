// Paper beach: a tropical lagoon at true scale (metres). The ground is
// one height field (beach/terrain.js), the sea is the aquarium's water
// (core/watersurface.js, core/underwater.js) on an open sea with foam on
// the shore and the reef (beach/ocean.js). The props are folded paper
// (papercraft GLBs, beach/props.js, later), the matter Infinitex paper.
//   ?view=beach | sea | under | high   start from a preset camera
//   ?nofx  no AO and no depth of field   ?nograde  no bloom and grade
//   ?pr=   pixel ratio cap (1.25)   ?nofxaa   ?nogi  no lift   ?bake=  sand bounce baked in the probe
//   ?shafts  (off: they drew nothing, see below)  ?nosnow
// window.__ix: renderer, scene, camera, controls, kit, waterBody, view,
// setTime, ready.
//
// Event bus: the camera kit (src/camera/kit.js); the page listens to
// pixelRatioChanged to resize its waterline targets.

import * as THREE from 'three/webgpu';
import { positionWorldDirection, positionWorld, cameraPosition, vec2, vec3, float, exp, uv, sin, mix, smoothstep, fog } from 'three/tsl';
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
import { loadProps, place, instanced, skinParts, fileURL } from './beach/props.js';
import { createClouds } from './beach/clouds.js';
import { createLife } from './beach/life.js';
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
// ?bake=k: its lower half becomes the sunlit sand (k times), a bounce
// baked in the probe. Off by default: the look was tuned with the kit's
// flat lift (gi, targetpost.js), which brightens the whole frame instead.
const BAKE = params.has( 'bake' ) ? + params.get( 'bake' ) : 0;
const LIFT = ! params.has( 'nogi' );
{

	const skyScene = new THREE.Scene();
	// Sand radiance: albedo (the sand matter's base colour, linear) times
	// the sun's irradiance over pi. The sky's own share is small beside it.
	const L = sun.position.clone().normalize();
	const sand = new THREE.Color( '#f2dcaa' ).multiplyScalar( sun.intensity * Math.max( L.y, 0 ) / Math.PI * BAKE );
	const d = positionWorldDirection.normalize();
	skyScene.backgroundNode = BAKE ? mix( vec3( sand.r, sand.g, sand.b ), sky( positionWorldDirection ), smoothstep( - 0.05, 0.0, d.y ) ) : sky( positionWorldDirection );
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
W.inscatter.value.set( '#2ff2d6' ); // turquoise
W.deep.value.set( '#0a62a8' ); // ultramarine past the reef
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
const sandPreset = { family: 'ground', mode: 'sand', grain_mm: 0.35, color: '#f2dcaa', color2: '#d9a868', color3: '#2b2622', ripple_mm: 90, ripple: 0.5, specks: 0.3, sparkle: 0.6, roughness: 0.85, seed: 2, underwater: 1 };
const groundMat = createMaterial( sandPreset, { coords: uv() } ).material;
// Inland, under the grove, the sand turns to a jungle floor: duller,
// greener, littered (a tint over the sand matter, 25 to 45 m from the line).
{

	const P = positionWorld;
	const d = P.z.sub( sin( P.x.div( 40 ) ).mul( 6 ).add( sin( P.x.div( 13 ).add( 1 ) ).mul( 3 ) ) ); // beach/terrain.js shoreZ
	const jungle = smoothstep( - 22, - 42, d );
	groundMat.colorNode = groundMat.colorNode.mul( mix( vec3( 1 ), vec3( 0.42, 0.55, 0.3 ), jungle ) );

}
const ground = new THREE.Mesh( groundGeometry( + params.get( 'step' ) || 1.5 ), groundMat );
ground.receiveShadow = true;
world.add( ground );
const deep = deepFloor( applyUnderwater );
world.add( deep );

// The folded paper props (beach/props.js, beach/layout.js); ?noprops.
const props = params.has( 'noprops' ) ? {} : await loadProps();
// A prop placed more than once is instanced (one draw per part for all its
// copies: the grove's palms, the torches, rocks and shells). Each copy
// gets an empty stand-in that beach/life.js moves as before. A prop with
// moving parts of its own (the crab's legs) stays a copy, skinned.
const placed = [];
const entries = placements( { dense: ! params.has( 'sparse' ) } ).filter( ( e ) => props[ e.name ] );
const copies = {};
for ( const e of entries ) copies[ e.name ] = ( copies[ e.name ] ?? 0 ) + 1;
const groups = {};
for ( const n in copies ) if ( copies[ n ] > 1 && n !== 'crab' ) groups[ n ] = instanced( props[ n ], world );
for ( const e of entries ) placed.push( groups[ e.name ] ? groups[ e.name ].add( e ) : place( props[ e.name ], world, e ) );
for ( const o of placed ) if ( o.userData.entry.name === 'crab' ) skinParts( o ); // its 13 parts, one skinned draw
for ( const g of Object.values( groups ) ) g.build();
const palms = groups.palm ?? null;
// Life (beach/life.js): palms sway, the crab walks sideways, and the
// pop-up: each prop stands up from the sand like a pop-up book, in a wave
// from the pier (setPop( seconds ), null: all standing).
const life = createLife( placed );

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
// tells the ship's size and the sea's breadth.
{

	// Density of air: exponential with distance, thinner with height (scale
	// height 800 m, taken at the middle of the ray: the hull overhead stays
	// crisp). At sea level 2 km
	// veils about a third, 10 km nine tenths; the ship at 6 km and 1 km up
	// about half. The colour is the sky at the horizon, so the far sea melts
	// into it.
	const P = positionWorld;
	const dist = P.sub( cameraPosition ).length();
	const midH = P.y.add( cameraPosition.y ).mul( 0.5 ).max( 0 );
	const density = exp( midH.div( - 800 ) ).div( 4500 );
	scene.fogNode = fog( vec3( 0.55, 0.82, 0.98 ), float( 1 ).sub( exp( dist.mul( density ).negate() ) ).mul( 0.88 ) );

}

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
hideUp.push( deep ); // 25 m down: the mirror above the level clips all of it, it only cost its vertices

// The camera port at the waterline: near or under the surface the frame
// is drawn twice (air and water) and split along the line.
const port = createWaterline( renderer, scene, camera, { lens: true, meniscus: 0.0008, power: 2.5, prepare } );
const resize = () => { const s = renderer.getDrawingBufferSize( new THREE.Vector2() ); port.setSize( s.x, s.y ); };
addEventListener( 'resize', resize );

// Light shafts and floating specks in the lagoon.
const LAGOON = { min: [ - 160, - 26, - 30 ], max: [ 160, 0, 190 ] };
if ( ! params.has( 'nosnow' ) ) scene.add( createSnow( { box: { min: [ - 40, - 3, 0 ], max: [ 40, 0, 60 ] }, count: 3000, radius: [ 0.002, 0.008 ], near: 0.6 } ) );
// The shafts are off unless asked (?shafts): with this long low swell and
// shaftCut 1.5 no caustic passes the cut, the pass drew zero everywhere
// (read back, 2026-11-19) for 1 to 2 ms a frame. To bring them in, lower
// shaftCut with ?shafts and check the look.
const shafts = params.has( 'shafts' ) ? createShafts( renderer, camera, { steps: 8, box: LAGOON } ) : null;

const fx = ! params.has( 'nofx' );
// The tropical grade (src/camera/grade.js): saturated but soft (vibrance
// lifts the weak colours: the lagoon, the sky), a gentle S, turquoise in
// the shadows, gold in the highlights, a light teal vignette.
const GRADE = { vibrance: 0.6, contrast: 1.18, pivot: 0.16, airShadows: 0.12, shadows: 0.3, shadowTint: [ 0.05, 0.62, 0.72 ], highlights: 0.2, highlightTint: [ 1, 0.88, 0.62 ], bloom: 0.3, airThreshold: 1.0, vignette: 0.25, vignetteTint: [ 0.45, 0.8, 0.85 ] };
// ?snap (films): focus and field of view follow at once, and the AO takes
// the true subject distance each frame. Eased, they lagged a fast macro
// zoom: a blur, then a dark AO blot the size of the old distance.
const snap = params.has( 'snap' );
// Pixel ratio capped (?pr=, default PR): Retina density cost twice the
// pixels for an image the eye does not tell apart once FXAA smooths the
// edges (?nofxaa).
const PR = 1.25;
const kit = createDemoKit( { renderer, scene, camera, controls, params, options: { maxPixelRatio: + params.get( 'pr' ) || PR, fxaa: fx && ! params.has( 'nofxaa' ), ...( snap ? { focusTime: 0.03, macroTime: 0.03 } : {} ), maxSpeed: 12, shadows: true, shadowFar: 120, ao: fx, gi: fx && LIFT, aoMax: 2, dof: fx, maxFocus: 3000, target: fx ? port.rtC : null, shafts, grade: fx && ! params.has( 'nograde' ) ? GRADE : null } } );
kit.addEventListener( 'pixelRatioChanged', resize );
resize(); // the port was sized before the kit capped the ratio
// Tuning from the URL: ?bounce= (the lift), ?ao= (AO strength).
if ( kit.post?.bounce ) kit.post.bounce.value = params.has( 'bounce' ) ? + params.get( 'bounce' ) : 0.3; // sand and sunlit paper light the undersides
if ( kit.post?.strength && params.has( 'ao' ) ) kit.post.strength.value = + params.get( 'ao' );
const stats = createStats( { renderer, camera, adaptive: kit.adaptive, backend: params.has( 'webgl' ) ? 'WebGL2' : 'WebGPU' } );

const { view } = createViews( { camera, controls, sandHeight } );
view( params.get( 'view' ) ?? 'beach' );

// Near or under the surface: the port (two passes). Above: one pass, the
// lagoon floor bent by the flat surface (core/refraction.js).
// The sun's cascades fit the page camera (CSMShadowNode keeps the camera
// it was built with), but three re-renders a shadow map once per camera
// per frame: the mirror's camera and the port's second pass drew the same
// three maps again (6 to 9 cascade passes a frame). Drawn once per frame,
// by the first pass that needs them.
function shadowsOnce() {

	for ( const l of kit.cascades?.csm.lights ?? [] ) { l.shadow.autoUpdate = false; l.shadow.needsUpdate = true; }

}

function draw() {

	shadowsOnce();
	for ( const g of Object.values( groups ) ) g.sync();
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
	life.update( clock );
	kit.update( dt );
	if ( snap ) kit.prepare( camera.position.distanceTo( controls.target ) );
	stats.beginFrame();
	draw();
	stats.endFrame( camera.position.distanceTo( controls.target ) );

} );

// The first surface along a ray (films aim their macro shots with it):
// { point, normal } in world space, or null.
const caster = new THREE.Raycaster();
function surfaceAt( origin, target, root = world ) {

	const o = new THREE.Vector3( ...origin ), d = new THREE.Vector3( ...target ).sub( o ).normalize();
	caster.set( o, d );
	const hit = caster.intersectObject( root, true ).find( ( h ) => h.object.visible && ! h.object.userData.noFocus );
	if ( ! hit ) return null;
	const n = hit.face.normal.clone();
	if ( hit.instanceId !== undefined ) { const im = new THREE.Matrix4(); hit.object.getMatrixAt( hit.instanceId, im ); n.transformDirection( im ); }
	n.transformDirection( hit.object.matrixWorld );
	if ( n.dot( d ) > 0 ) n.negate(); // the side facing the ray
	return { point: hit.point.toArray(), normal: n.toArray() };

}

window.__ix = { surfaceAt, life, palms, groups, setPop: life.setPop, clouds, ship, setShip, props, placed, renderer, scene, camera, controls, kit, waterBody: W, world, ground, ocean, view, setTime, draw, refractOff, ready: true };
