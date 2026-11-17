// Aquarium: a tank of clear water under a day sky. Sand floor, marble
// wall, three panes of glass and a few cubes of Infinitex matter
// (aquarium/tank.js), life built by code (aquarium/life.js), all with underwater:
// caustics and colour loss below the level (core/underwater.js). The
// water surface (core/watersurface.js) is seen from above (sky by
// Fresnel, refraction) and from below (Snell's window).
//   ?view=above | below | floor | glass | lens   start from a preset camera
//   ?wall=glass | cleanGlass | acrylic | coatedGlass | ptfe   the pane (meniscus)
//   arrows or ZQSD walk, Space and C up and down, a click focuses, F the
//   lens (the camera kit, src/camera, through camerakit.js)
//   ?nofx   no AO and no depth of field
//   ?nograde  no bloom and no colour grade (src/camera/grade.js)
//   ?nomood   the plain physical water: one haze colour, no fill, no rim
//   ?nosnow   no floating specks (src/core/snow.js)
//   ?nomirror the panes seen from inside are flat haze, no mirror
//   ?nofly  no toy submarine. Without it, a toy submarine floats in the
//           tank; V or the button at the bottom right steers it (flyer.js)
// window.__ix: renderer, scene, camera, ready, view( name ), setTime( s ),
// refraction (core/refraction.js; strength 0 draws the true positions),
// apparentPoint, waterBody, tank, LEVEL, TD (tests/refraction_gpu.mjs).

import * as THREE from 'three/webgpu';
import { positionWorldDirection } from 'three/tsl';
import './nav.js';
import { setTime } from '../src/core/clock.js';
import { reliefLight } from '../src/core/relief.js';
import { waterBody } from '../src/core/underwater.js';
import { createWaterSurface, daySky } from '../src/core/watersurface.js';
import { createWaterline } from '../src/core/waterline.js';
import { WALL_CONTACT } from '../src/core/meniscus.js';
import { createMirror } from '../src/core/mirror.js';
import { refraction, refractSurface, refractOff, apparentPoint } from '../src/core/refraction.js';
import { createStage } from './scene.js';
import { createStats } from './stats.js';
import { createDemoKit } from './camerakit.js';
import { createShafts } from '../src/core/shafts.js';
import { createBubbles } from '../src/core/bubbles.js';
import { createSnow } from '../src/core/snow.js';
import { buildTank } from './aquarium/tank.js';
import { createLife } from './aquarium/life.js';
import { createShots } from './aquarium/shots.js';
import { createSubmarine } from './vehicles/submarine.js';
import { createFlyer } from './flyer.js';
import { addFlyHud } from './flyhud.js';

const TW = 1.2, TD = 0.8, TH = 0.5, LEVEL = 0.35; // tank (m)
const params = new URLSearchParams( location.search );
const ctx = await createStage( { forceWebGL: params.has( 'webgl' ) } );
const { renderer, scene, camera, controls } = ctx;
ctx.floor.visible = false;
document.getElementById( 'panel' ).style.display = 'none';

// One sun for the lights, the caustics and the sky.
const sun = scene.children.find( ( o ) => o.isDirectionalLight );
sun.position.set( 1.2, 3, 0.9 );
reliefLight.value.copy( sun.position ).normalize();
const sky = daySky( reliefLight );
scene.background = null;
scene.backgroundNode = sky( positionWorldDirection );
scene.environmentIntensity = 0.8;
waterBody.level.value = LEVEL;
waterBody.depthScale.value = 4; // a 35 cm tank reads as 1.4 m of water
waterBody.sizeM.value = 0.6; // pool swell: long, gentle ripples from every side
waterBody.featureM.value = 0.1;
waterBody.amount.value = 0.5;
waterBody.turbidity.value = 0.35;
// The mood, a sunlit reef in an animated film (core/underwater.js, "mood").
// One warm sun, and the water answers in blue: aqua under the surface,
// deep blue level and down, blue in the shadows, a halo around the sun,
// a line of light on the back of what swims. ?nomood: the plain water.
const mood = ! params.has( 'nomood' );
if ( mood ) {

	sun.color.set( 0xffe4bc );
	sun.intensity = 2.8;
	scene.environmentIntensity = 0.55; // the grey sky light gives way to the water's fill
	waterBody.inscatter.value.set( '#46e8d4' ); // lagoon: turquoise green, not the cold royal blue of the first pass
	waterBody.deep.value.set( '#1593a8' );
	waterBody.sunGlow.value = 1.3;
	waterBody.fill.value = 0.22;
	waterBody.causticTint.value.set( '#fff0c0' );
	waterBody.rim.value = 0.3;
	waterBody.absorb.value.set( 0.3, 0.06, 0.02 ); // less red lost: the sand stays warm in the sun
	waterBody.turbidity.value = 0.2; // clearer: what is near keeps its colours
	waterBody.shafts.value = 1.1;
	waterBody.shaftCut.value = 1.5; // separate beams, not a veil

}

// Everything in the tank sits in a clipping group: the water's mirrors
// render it cut at the level (core/mirror.js).
const tank = new THREE.ClippingGroup();
scene.add( tank );

// The tank itself: sand, wall, panes, base, cubes (aquarium/tank.js).
// The panes' mirror from inside: the tank seen from its centre, once the
// floor and its life are built (?nomirror: the flat haze of before).
const probe = params.has( 'nomirror' ) ? null : new THREE.CubeRenderTarget( 256, { type: THREE.HalfFloatType } );
const { sand, RIM, paneHazes } = buildTank( { scene, tank, params, sky, TW, TD, TH, LEVEL, probe } );

// The water: one plane at the level, inside the walls, and its two
// mirrors (what is above, seen from above; the pool, seen from below).
const hide = [], hideUp = []; // hideUp: also what lives wholly under the level, which the mirror of the air side clips anyway (one pass less for the fauna)
const mirrors = {
	up: createMirror( { group: tank, level: LEVEL, side: 1, hide: hideUp } ),
	down: createMirror( { group: tank, level: LEVEL, side: - 1, hide } ),
};
const prepare = ( cam ) => { mirrors.up.render( renderer, cam ); mirrors.down.render( renderer, cam ); };
const water = new THREE.Mesh( new THREE.PlaneGeometry( TW, TD, 240, 160 ), createWaterSurface( sky, mirrors, undefined, { spacing: TW / 240 } ) );
water.rotation.x = - Math.PI / 2;
water.position.y = LEVEL;
water.renderOrder = 10; // after the opaque scene: it reads the screen
tank.add( water );
hide.push( water );
hideUp.push( water );
water.userData.noFocus = true; // a click and the walk go through to what is under it (src/camera)

// Camera places and film paths (aquarium/shots.js).
const { view, dive, glassPan } = createShots( { camera, controls, LEVEL, TD } );

// Split shots: through the front glass from outside, or with the camera
// port at the waterline; else a plain render.
// The pane: ordinary glass by default, clean water. The meniscus follows
// (core/meniscus.js): 2.9 mm up the glass; ?wall=ptfe or coatedGlass for
// a pane the water does not wet, the edge dips and rolls over (convex).
const wall = WALL_CONTACT[ params.get( 'wall' ) ] ?? WALL_CONTACT.glass;
const glassLine = createWaterline( renderer, scene, camera, { panes: [ { axis: 'z', at: TD / 2, min: - TW / 2, max: TW / 2, out: 1 }, { axis: 'x', at: - TW / 2, min: - TD / 2, max: TD / 2, out: - 1 }, { axis: 'x', at: TW / 2, min: - TD / 2, max: TD / 2, out: 1 } ], yMin: - RIM, yMax: TH, contactDeg: wall, prepare } );
// The port's film is thinner and flatter than the meniscus on a pane.
const lensLine = createWaterline( renderer, scene, camera, { lens: true, meniscus: 0.0008, power: 2.5, prepare } );
addEventListener( 'resize', () => { const s = renderer.getDrawingBufferSize( new THREE.Vector2() ); glassLine.setSize( s.x, s.y ); lensLine.setSize( s.x, s.y ); } );
// Which pass: in front of a pane (the front or a side), the pane split;
// over or in the tank, the camera port (it may cross the surface); behind
// the back wall a plain render. The port there drew its waterline,
// 3 cm from the eye, across the whole frame, far from any water.
function draw() {

	const p = camera.position;
	// ?nofx: the frame as before, no AO and no depth of field.
	if ( p.z > TD / 2 || Math.abs( p.x ) > TW / 2 ) { if ( fx ) kit.render( glassLine.compose() ); else glassLine.render(); }
	else if ( Math.abs( p.x ) < TW / 2 && Math.abs( p.z ) < TD / 2 ) { if ( fx ) kit.render( lensLine.compose() ); else lensLine.render(); }
	else {

		// Behind the wall: above the water, it is seen through the surface;
		// below the rim, only the marble wall is seen.
		if ( p.y > LEVEL ) refractSurface( p, LEVEL ); else refractOff();
		prepare( camera );
		renderer.setRenderTarget( null );
		if ( fx ) {

			// A plain render into the pane's air target, then the same effects.
			renderer.setRenderTarget( glassLine.rtA );
			renderer.render( scene, camera );
			renderer.setRenderTarget( null );
			kit.render( glassLine.rtA );

		} else renderer.render( scene, camera );

	}

}

view( params.get( 'view' ) ?? 'above' );
// Stats panel (demo/stats.js): fps, frame and GPU time, triangles, draw calls.
// The camera kit (walk, collisions, lens, adaptive pixel ratio). The page
// draws its own frame (mirrors, waterlines), so the kit runs in target
// mode: AO and depth of field after the two passes of a waterline are
// mixed (compose(), a target with depth), or after a plain render beside
// the tank (src/camera/targetpost.js). ?nofx: the frame as before, no AO
// and no depth of field. No sun cascades here. The waterline targets
// follow the pixel ratio (kit event).
// The sun's light shafts in the water join the frame before the blur.
// Strings of bubbles from three points of the floor (src/core/bubbles.js);
// ?nobubbles. In the scene, not in the tank group: the mirrors skip them.
if ( ! params.has( 'nobubbles' ) ) scene.add( createBubbles( { box: { min: [ - TW / 2, 0, - TD / 2 ], max: [ TW / 2, LEVEL, TD / 2 ] }, count: 150, sources: [ [ - 0.36, 0.14 ], [ 0.02, - 0.22 ], [ 0.42, 0.2 ] ] } ) );
// Marine snow: specks that float in the water and catch its light
// (src/core/snow.js); ?nosnow. In the scene, like the bubbles.
if ( ! params.has( 'nosnow' ) ) scene.add( createSnow( { box: { min: [ - TW / 2, 0, - TD / 2 ], max: [ TW / 2, LEVEL, TD / 2 ] }, count: 500 } ) );
// Life, built by code (aquarium/life.js, demo/sealife): fish, jellyfish,
// a crab, plants, corals, starfish. ?nolife, ?noflora.
const { life, flora } = createLife( { scene, tank, params, sand, sun, water, hideUp, TW, TD } );

// Light shafts in the tank's water (src/core/shafts.js); ?noshafts.
const shafts = params.has( 'noshafts' ) ? null : createShafts( renderer, camera, { steps: + params.get( 'shaftsteps' ) || 8, box: { min: [ - TW / 2, 0, - TD / 2 ], max: [ TW / 2, LEVEL, TD / 2 ] } } );
const fx = ! params.has( 'nofx' );
// The grade of a lagoon (src/camera/grade.js): teal shadows, warm highlights.
const LAGOON = { shadowTint: [ 0.2, 0.8, 0.85 ], shadows: 0.3, highlights: 0.2, highlightTint: [ 1, 0.9, 0.65 ], vignetteTint: [ 0.6, 0.85, 0.85 ] };
const kit = createDemoKit( { renderer, scene, camera, controls, params, options: { maxSpeed: 0.6, shadows: false, ao: fx, dof: fx, target: fx ? glassLine.rtC : null, shafts, grade: fx && ! params.has( 'nograde' ) ? LAGOON : null } } );
const { walk, adaptive, lens } = kit;
kit.addEventListener( 'pixelRatioChanged', () => { const s = renderer.getDrawingBufferSize( new THREE.Vector2() ); glassLine.setSize( s.x, s.y ); lensLine.setSize( s.x, s.y ); } );
const stats = createStats( { renderer, camera, adaptive, backend: params.has( 'webgl' ) ? 'WebGL2' : 'WebGPU' } );

// The toy submarine, in the tank group so the water's mirrors cut it at
// the level. It stays in the water: its centre a hull radius inside the
// glass, over the sand and just under the surface.
let vehicle = null;
if ( ! params.has( 'nofly' ) ) {

	const sub = createSubmarine();
	tank.add( sub.group );
	const r = sub.radius;
	vehicle = createFlyer( { vehicle: sub, camera, controls, dom: renderer.domElement, collider: kit.collider,
		home: new THREE.Vector3( 0.12, 0.2, 0.12 ), options: { name: 'submarine', idle: 'hover', plane: false, nose: 0.25, tilt: 0, bank: 0.12,
			maxSpeed: 0.12, minSpeed: 0.004, near: 1.5, turnRate: 1.1, pitchRate: 0.8, response: 1.2,
			chase: 0.12, chaseMin: 0.02, chaseMax: 0.8, chaseLift: 0.25,
			bounds: { min: new THREE.Vector3( - TW / 2 + r, 0.03, - TD / 2 + r ), max: new THREE.Vector3( TW / 2 - r, LEVEL - 0.012, TD / 2 - r ) } } } );
	vehicle.yaw = Math.PI; // toward the back wall: boarding shows the tank ahead
	addFlyHud( vehicle, { label: 'the submarine', fly: 'Steer', land: 'Leave' } );

}
// Fill the probe once, at the first frame: the floor, the walls, the cubes
// and the plants, seen from the middle of the water. Not what moves (fish,
// crab, jellyfish, bubbles, specks: they would freeze in the glass), not
// the water's surface (it reads the screen) nor the panes themselves.
// Refraction off: the probe's eye is in the water with what it sees.
// In place of the surface, a ceiling of the lit water under it: seen from
// below at a slant the surface mirrors the tank, and the bright window
// above is narrow. Without it the panes mirrored the white sky.
function fillProbe() {

	const ceiling = new THREE.Mesh( new THREE.PlaneGeometry( TW, TD ), new THREE.MeshBasicNodeMaterial( { side: THREE.DoubleSide } ) );
	ceiling.material.colorNode = waterBody.inscatter.mul( 0.75 );
	ceiling.rotation.x = Math.PI / 2;
	ceiling.position.y = LEVEL;
	scene.add( ceiling );

	const cam = new THREE.CubeCamera( 0.001, 5, probe );
	cam.position.set( 0, LEVEL / 2, 0 );
	const moving = life.map( ( l ) => l.mesh ?? l.group );
	const hidden = [ water, ...moving, ...scene.children.filter( ( o ) => o.isMesh && o.userData.noFocus && o.frustumCulled === false ) ].filter( Boolean );
	const was = hidden.map( ( o ) => o.visible );
	hidden.forEach( ( o ) => { o.visible = false; } );
	// The panes in the probe: their haze, not the mirror (it would read the
	// probe while it is drawn), and not hidden (the room would show).
	const plain = new THREE.MeshBasicNodeMaterial();
	plain.colorNode = waterBody.inscatter.mul( 0.55 );
	const own = paneHazes.map( ( m ) => m.material );
	paneHazes.forEach( ( m ) => { m.material = plain; } );
	refractOff();
	cam.update( renderer, scene );
	paneHazes.forEach( ( m, i ) => { m.material = own[ i ]; } );
	plain.dispose();
	hidden.forEach( ( o, i ) => { o.visible = was[ i ]; } );
	scene.remove( ceiling );
	ceiling.geometry.dispose();
	ceiling.material.dispose();

}

let probeFilled = ! probe;
let clock = 0, last = performance.now();
renderer.setAnimationLoop( () => {

	const now = performance.now();
	const dt = ( now - last ) / 1000;
	clock += dt;
	last = now;
	setTime( clock );
	for ( const l of life ) l.update( clock );
	for ( const f of flora ) f.update( clock );
	// Under water the haze tells the distance, not the lens: half the blur.
	const under = camera.position.y < LEVEL && Math.abs( camera.position.x ) < TW / 2 && Math.abs( camera.position.z ) < TD / 2;
	if ( lens ) lens.bokehScale = under ? 0.5 : 1;
	// From the air the shafts are seen across the whole tank, side on: a
	// third of their strength there, or they stand as blue columns.
	if ( mood ) waterBody.shafts.value = under ? 1.1 : 0.45;
	// The grade's blue push and low bloom threshold are for the eye under water (src/camera/grade.js).
	if ( kit.post?.grade ) kit.post.grade.uniforms.water.value = under ? 1 : 0;
	vehicle?.update( dt, clock ); // while steered, it moves the camera and the walk holds still
	kit.update( dt, { move: ! vehicle?.active, dist: vehicle?.active ? () => camera.position.distanceTo( controls.target ) : null } ); // flying: AO follows the vehicle, not the autofocus
	if ( ! probeFilled ) { fillProbe(); probeFilled = true; }
	stats.beginFrame();
	draw();
	stats.endFrame( camera.position.distanceTo( controls.target ) );

} );

window.__ix = { renderer, scene, camera, controls, kit, vehicle, life, flora, walk, adaptive, lens, focus: lens, fx, refraction, apparentPoint, waterBody, tank, LEVEL, TD, view, setTime, draw, dive, glassPan, ready: true };
