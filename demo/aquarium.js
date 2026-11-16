// Aquarium: a tank of clear water under a day sky. Sand floor, marble
// walls and a few cubes of Infinitex matter, all built with underwater:
// caustics and colour loss below the level (core/underwater.js). The
// water surface (core/watersurface.js) is seen from above (sky by
// Fresnel, refraction) and from below (Snell's window).
//   ?view=above | below | floor | glass | lens   start from a preset camera
//   ?wall=glass | cleanGlass | acrylic | coatedGlass | ptfe   the pane (meniscus)
//   arrows or ZQSD walk, Space and C up and down, a click focuses, F the
//   lens (the camera kit, src/camera, through camerakit.js)
//   ?nofx   no AO and no depth of field
// window.__ix: renderer, scene, camera, ready, view( name ), setTime( s ),
// refraction (core/refraction.js; strength 0 draws the true positions),
// apparentPoint, waterBody, tank, LEVEL, TD (tests/refraction_gpu.mjs).

import * as THREE from 'three/webgpu';
import { uv, vec2, positionWorldDirection } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import './nav.js';
import { createMaterial } from '../src/index.js';
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

// Everything in the tank sits in a clipping group: the water's mirrors
// render it cut at the level (core/mirror.js).
const tank = new THREE.ClippingGroup();
scene.add( tank );

// A plane with UVs in metres, facing +z before it is placed.
function slab( w, h, preset, place ) {

	// 2 cm segments: refraction moves vertices (core/refraction.js). A line
	// seen through a flat interface bends gently; 1 cm gave 4 times the
	// triangles for no visible gain.
	const g = new THREE.PlaneGeometry( w, h, Math.ceil( w / 0.02 ), Math.ceil( h / 0.02 ) );
	g.computeTangents();
	const ix = createMaterial( { ...preset, underwater: 1 }, { coords: uv().mul( vec2( w, h ) ) } );
	const m = new THREE.Mesh( g, ix.material );
	place( m );
	tank.add( m );
	return m;

}

const sand = { family: 'ground', mode: 'sand', grain_mm: 0.35, color: '#d6bd92', color2: '#b8804f', color3: '#2b2622', ripple_mm: 90, ripple: 0.5, specks: 0.4, sparkle: 0.5, roughness: 0.8, seed: 2 };
const marble = { family: 'stone', mode: 'marble', intent: 'white marble tank wall', color: '#d9d6cf', color2: '#8c8c88', roughness: 0.35, seed: 4 };
slab( TW, TD, sand, ( m ) => { m.rotation.x = - Math.PI / 2; } );
slab( TW, TH, marble, ( m ) => { m.position.set( 0, TH / 2, - TD / 2 ); } );
// Front: a pane of glass (drawn by the waterline pass, core/waterline.js).
slab( TD, TH, marble, ( m ) => { m.position.set( - TW / 2, TH / 2, 0 ); m.rotation.y = Math.PI / 2; } );
slab( TD, TH, marble, ( m ) => { m.position.set( TW / 2, TH / 2, 0 ); m.rotation.y = - Math.PI / 2; } );

// Cubes of matter; the tall one breaks the surface.
function cube( size, h, preset, x, z, ry ) {

	let g = new RoundedBoxGeometry( size, h, size, 4, 0.012 );
	g.deleteAttribute( 'uv1' );
	// Its flat faces are single quads: cut them to about 2 cm, so the part
	// under water can bend (core/refraction.js).
	g = new TessellateModifier( 0.02, 10 ).modify( g.toNonIndexed() );
	g = mergeVertices( g );
	g.computeTangents();
	const ix = createMaterial( { ...preset, underwater: 1 }, { coords: uv().mul( vec2( size, h ) ) } );
	const m = new THREE.Mesh( g, ix.material );
	m.position.set( x, h / 2, z );
	m.rotation.y = ry;
	tank.add( m );

}

cube( 0.16, 0.16, { family: 'stone', mode: 'granite', color: '#a8807a', color2: '#2a2626', color3: '#d8d0c8', roughness: 0.3, seed: 3 }, - 0.25, - 0.12, 0.4 );
cube( 0.12, 0.12, { family: 'metal', metal: 'bronze', seed: 7 }, 0.12, 0.15, - 0.3 );
cube( 0.14, 0.48, { family: 'wood', intent: 'driftwood', ring_mm: 5, figure: 1, knots: 0.3, weather: 1, weather_color: '#8e8a82', checks: 0.6, roughness: 0.85, seed: 4 }, 0.3, - 0.18, 0.2 );

// The water: one plane at the level, inside the walls, and its two
// mirrors (what is above, seen from above; the pool, seen from below).
const hide = [];
const mirrors = {
	up: createMirror( { group: tank, level: LEVEL, side: 1, hide } ),
	down: createMirror( { group: tank, level: LEVEL, side: - 1, hide } ),
};
const prepare = ( cam ) => { mirrors.up.render( renderer, cam ); mirrors.down.render( renderer, cam ); };
const water = new THREE.Mesh( new THREE.PlaneGeometry( TW, TD, 240, 160 ), createWaterSurface( sky, mirrors, undefined, { spacing: TW / 240 } ) );
water.rotation.x = - Math.PI / 2;
water.position.y = LEVEL;
water.renderOrder = 10; // after the opaque scene: it reads the screen
tank.add( water );
hide.push( water );
water.userData.noFocus = true; // a click and the walk go through to what is under it (src/camera)

const VIEWS = {
	above: { pos: [ 0.55, 0.95, 0.95 ], look: [ 0, 0.12, 0 ] },
	below: { pos: [ - 0.35, 0.12, 0.28 ], look: [ 0.1, 0.42, - 0.15 ] },
	floor: { pos: [ - 0.5, 0.06, 0.3 ], look: [ 0.2, 0.08, - 0.2 ] },
	glass: { pos: [ - 0.15, LEVEL - 0.02, TD / 2 + 0.35 ], look: [ 0.05, LEVEL - 0.05, 0 ] }, // the aquarium waterline
	lens: { pos: [ - 0.3, LEVEL + 0.004, 0.25 ], look: [ 0.25, LEVEL - 0.02, - 0.2 ] }, // camera half in
};
function view( name ) {

	const v = VIEWS[ name ] ?? VIEWS.above;
	camera.position.set( ...v.pos );
	controls.target.set( ...v.look );
	camera.lookAt( ...v.look );

}

// Split shots: through the front glass from outside, or with the camera
// port at the waterline; else a plain render.
// The pane: ordinary glass by default, clean water. The meniscus follows
// (core/meniscus.js): 2.9 mm up the glass; ?wall=ptfe or coatedGlass for
// a pane the water does not wet, the edge dips and rolls over (convex).
const wall = WALL_CONTACT[ params.get( 'wall' ) ] ?? WALL_CONTACT.glass;
const glassLine = createWaterline( renderer, scene, camera, { glassZ: TD / 2, xMin: - TW / 2, xMax: TW / 2, yMin: 0, yMax: TH, contactDeg: wall, prepare } );
// The port's film is thinner and flatter than the meniscus on a pane.
const lensLine = createWaterline( renderer, scene, camera, { lens: true, meniscus: 0.0008, power: 2.5, prepare } );
addEventListener( 'resize', () => { const s = renderer.getDrawingBufferSize( new THREE.Vector2() ); glassLine.setSize( s.x, s.y ); lensLine.setSize( s.x, s.y ); } );
// Which pass: in front of the glass, the pane split; over or in the tank,
// the camera port (it may cross the surface); anywhere else outside (beside
// or behind the tank) a plain render. The port there drew its waterline,
// 3 cm from the eye, across the whole frame, far from any water.
function draw() {

	const p = camera.position;
	// ?nofx: the frame as before, no AO and no depth of field.
	if ( p.z > TD / 2 ) { if ( fx ) kit.render( glassLine.compose() ); else glassLine.render(); }
	else if ( Math.abs( p.x ) < TW / 2 && Math.abs( p.z ) < TD / 2 ) { if ( fx ) kit.render( lensLine.compose() ); else lensLine.render(); }
	else {

		// Above the water, it is seen through the surface; beside the
		// tank below the rim, only the marble walls are seen.
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

// The dive (film): from above the tank down through the surface to the
// driftwood post, slow and level, no turn of the camera. It lingers half
// in the water (6 to 11 s): the port straddles the line, which rides the
// waves across the frame.
const ease = ( x ) => x * x * ( 3 - 2 * x );
const seg = ( t, t0, t1, a, b ) => a + ( b - a ) * ease( Math.min( 1, Math.max( 0, ( t - t0 ) / ( t1 - t0 ) ) ) );
function dive( t ) {

	const y = t < 6 ? seg( t, 0, 6, 0.62, LEVEL + 0.012 ) : t < 11 ? seg( t, 6, 11, LEVEL + 0.012, LEVEL - 0.012 ) : seg( t, 11, 16, LEVEL - 0.012, 0.16 );
	const k = seg( t, 0, 16, 0, 1 );
	camera.position.set( - 0.38 + 0.3 * k, y, 0.33 - 0.2 * k );
	controls.target.set( 0.3, 0.16 + 0.12 * Math.min( 1, Math.max( 0, ( 0.62 - y ) / 0.3 ) ), - 0.18 );
	camera.lookAt( controls.target );

}

// Along the glass (film, second shot): a slow sideways track at the
// waterline, the camera never turns; the thick water top bends the tank.
function glassPan( t, dur = 8 ) {

	const k = seg( t, 0, dur, 0, 1 );
	camera.position.set( - 0.32 + 0.5 * k, LEVEL + 0.004 - 0.008 * k, TD / 2 + 0.08 );
	controls.target.set( camera.position.x + 0.12, LEVEL - 0.01, 0 );
	camera.lookAt( controls.target );

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
// Light shafts in the tank's water (src/core/shafts.js); ?noshafts.
const shafts = params.has( 'noshafts' ) ? null : createShafts( renderer, camera, { box: { min: [ - TW / 2, 0, - TD / 2 ], max: [ TW / 2, LEVEL, TD / 2 ] } } );
const fx = ! params.has( 'nofx' );
const kit = createDemoKit( { renderer, scene, camera, controls, params, options: { maxSpeed: 0.6, shadows: false, ao: fx, dof: fx, target: fx ? glassLine.rtC : null, shafts } } );
const { walk, adaptive, lens } = kit;
kit.addEventListener( 'pixelRatioChanged', () => { const s = renderer.getDrawingBufferSize( new THREE.Vector2() ); glassLine.setSize( s.x, s.y ); lensLine.setSize( s.x, s.y ); } );
const stats = createStats( { renderer, camera, adaptive, backend: params.has( 'webgl' ) ? 'WebGL2' : 'WebGPU' } );
let clock = 0, last = performance.now();
renderer.setAnimationLoop( () => {

	const now = performance.now();
	const dt = ( now - last ) / 1000;
	clock += dt;
	last = now;
	setTime( clock );
	// Under water the haze tells the distance, not the lens: half the blur.
	const under = camera.position.y < LEVEL && Math.abs( camera.position.x ) < TW / 2 && Math.abs( camera.position.z ) < TD / 2;
	if ( lens ) lens.bokehScale = under ? 0.5 : 1;
	kit.update( dt );
	stats.beginFrame();
	draw();
	stats.endFrame( camera.position.distanceTo( controls.target ) );

} );

window.__ix = { renderer, scene, camera, controls, kit, walk, adaptive, lens, focus: lens, fx, refraction, apparentPoint, waterBody, tank, LEVEL, TD, view, setTime, draw, dive, glassPan, ready: true };
