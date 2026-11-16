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
import { uv, vec2, vec3, float, positionWorldDirection, positionLocal, positionWorld, normalLocal, cameraPosition, attribute, reflect, mix } from 'three/tsl';
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
import { refraction, refractSurface, refractOff, apparentPoint, refractedVertex } from '../src/core/refraction.js';
import { createStage } from './scene.js';
import { createStats } from './stats.js';
import { createDemoKit } from './camerakit.js';
import { createShafts } from '../src/core/shafts.js';
import { createBubbles } from '../src/core/bubbles.js';
import { createSchool } from './sealife/fish.js';
import { createJellies } from './sealife/jelly.js';
import { createCrab } from './sealife/crab.js';
import { sandAt } from './sealife/seabed.js';
import { createSeagrass } from './sealife/grass.js';
import { createKelp } from './sealife/kelp.js';
import { createAnemones } from './sealife/anemone.js';
import { createCorals } from './sealife/coral.js';
import { createBrainCorals } from './sealife/brain.js';
import { createStarfish } from './sealife/starfish.js';
import { sandFloor } from './sealife/seafloor.js';

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
// A rim folded down around a plane (in place): the border vertices again,
// and one under each, `drop` below the plane, flagged `skirt` = 1. Both
// rows keep the plane's normal: the fold is lit like the top, so the eye
// reads one surface that turns down (an outward normal made it a dark
// or a white band, by the light it caught). A slab whose
// vertices are displaced lifts the upper row with its surface and keeps
// the lower one, so its edge is a closed face down to its base. `tall`:
// about how high the fold stands (m), for the texture that runs down it.
function addSkirt( g, w, h, drop, tall = 0.025 ) {

	const nx = g.parameters.widthSegments, ny = g.parameters.heightSegments, n0 = g.attributes.position.count;
	const P = g.attributes.position, U = g.attributes.uv;
	const at = ( i, j ) => i + j * ( nx + 1 );
	const ring = [];
	for ( let i = 0; i < nx; i ++ ) ring.push( at( i, 0 ) );
	for ( let j = 0; j < ny; j ++ ) ring.push( at( nx, j ) );
	for ( let i = nx; i > 0; i -- ) ring.push( at( i, ny ) );
	for ( let j = ny; j > 0; j -- ) ring.push( at( 0, j ) );
	const pos = Array.from( P.array ), uvs = Array.from( U.array ), nor = Array.from( g.attributes.normal.array ), idx = Array.from( g.index.array ), flag = new Array( n0 ).fill( 0 );
	for ( const v of ring ) {

		const x = P.getX( v ), y = P.getY( v );
		// The texture goes on down the fold.
		const ox = Math.abs( Math.abs( x ) - w / 2 ) < 1e-6 ? Math.sign( x ) : 0, oy = Math.abs( Math.abs( y ) - h / 2 ) < 1e-6 ? Math.sign( y ) : 0;
		pos.push( x, y, 0, x, y, - drop ); uvs.push( U.getX( v ), U.getY( v ), U.getX( v ) + ox * tall / w, U.getY( v ) + oy * tall / h ); nor.push( 0, 0, 1, 0, 0, 1 ); flag.push( 0, 1 );

	}

	// The plane's border runs clockwise seen from +z: these faces look out.
	const N = ring.length;
	for ( let k = 0; k < N; k ++ ) { const a = n0 + 2 * k, b = n0 + 2 * ( ( k + 1 ) % N ); idx.push( a, b, a + 1, b, b + 1, a + 1 ); }
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	g.setAttribute( 'normal', new THREE.Float32BufferAttribute( nor, 3 ) );
	g.setAttribute( 'skirt', new THREE.Float32BufferAttribute( flag, 1 ) );
	g.setIndex( idx );

}

function slab( w, h, preset, place, seg = 0.02, skirt = 0 ) {

	// 2 cm segments: refraction moves vertices (core/refraction.js). A line
	// seen through a flat interface bends gently; 1 cm gave 4 times the
	// triangles for no visible gain.
	const g = new THREE.PlaneGeometry( w, h, Math.ceil( w / seg ), Math.ceil( h / seg ) );
	if ( skirt ) addSkirt( g, w, h, skirt );
	g.computeTangents();
	const ix = createMaterial( { ...preset, underwater: 1 }, { coords: uv().mul( vec2( w, h ) ) } );
	// The height the family gives, applied straight up (whatever the
	// normal), and not at all on the fold's lower row.
	if ( skirt && ix.material.positionNode ) ix.material.positionNode = positionLocal.add( vec3( 0, 0, 1 ).mul( ix.material.positionNode.sub( positionLocal ).dot( normalLocal ) ).mul( float( 1 ).sub( attribute( 'skirt', 'float' ) ) ) );
	const m = new THREE.Mesh( g, ix.material );
	place( m );
	tank.add( m );
	return m;

}

const RIM = 0.012; // how far the sand's folded rim goes down (m); the panes' waterline pass starts there too
const sand = { family: 'ground', mode: 'sand', grain_mm: 0.35, color: '#d6bd92', color2: '#b8804f', color3: '#2b2622', ripple_mm: 90, ripple: 0.5, specks: 0.4, sparkle: 0.5, roughness: 0.8, seed: 2 };
const marble = { family: 'stone', mode: 'marble', intent: 'white marble tank wall', color: '#d9d6cf', color2: '#8c8c88', roughness: 0.35, seed: 4 };
// The floor: the sand's ripples and low mounds move its vertices
// (preset.displace; ?flat keeps the plane, same normals), so
// it gets 5 mm segments: the lee side of a ripple is 2 cm wide. Measured:
// the finer floor and its displacement cost under 0.2 ms per frame.
slab( TW, TD, { ...sand, dune: 1, displace: params.has( 'flat' ) ? 0 : 1 }, ( m ) => { m.rotation.x = - Math.PI / 2; }, ( + params.get( 'seg' ) || 5 ) * 1e-3, RIM ); // ?seg=20: the former 2 cm, to compare
// The displaced sand stands about 2 cm over its plane. Without the folded
// rim (addSkirt) the eye at floor height looked under it through a pane,
// and saw the marble base as a second, white floor. The rim goes RIM
// down, past the top of the base (which stands a hair inside the panes, so
// the two never share a plane): no slit under the sand from any height.
slab( TW, TH, marble, ( m ) => { m.position.set( 0, TH / 2, - TD / 2 ); } );
// Front and both sides: panes of glass (drawn by the waterline pass,
// core/waterline.js). They have no mesh. Seen from inside the water, a
// pane shows the water's own haze, not the room: a plane of that colour
// up to the level, facing inwards (so culled from outside, where the
// eye looks through the glass). The walk and the focus go through it.
for ( const [ w, x, z, ry ] of [ [ TW, 0, TD / 2, Math.PI ], [ TD, - TW / 2, 0, Math.PI / 2 ], [ TD, TW / 2, 0, - Math.PI / 2 ] ] ) {

	const hm = new THREE.MeshBasicNodeMaterial();
	hm.colorNode = waterBody.inscatter.mul( 0.55 );
	hm.vertexNode = refractedVertex();
	const m = new THREE.Mesh( new THREE.PlaneGeometry( w, LEVEL, Math.ceil( w / 0.02 ), Math.ceil( LEVEL / 0.02 ) ), hm );
	m.position.set( x, LEVEL / 2, z );
	m.rotation.y = ry;
	m.userData.noFocus = true;
	tank.add( m );

}

// The panes themselves: 8 mm of ordinary glass (n = 1.52), outside the
// water. A box each, without its face on the water's side. Its wide face
// mirrors the sky by Fresnel's law (4 % face on, all of it at a grazing
// angle); its edges, where the eye looks through centimetres of glass,
// show the green of soda-lime glass. Blended after the opaque scene, no
// depth written: the effects (AO, depth of field) see through it. What the
// plate does to the picture behind (it comes 2.7 mm nearer) is not drawn:
// the waterline pass can do it (`glass`), but each pane then shifts the
// tank along its own normal, and at a grazing angle that opened a wedge
// in the corners, between the true corner and the shifted floor.
// The walk and the focus go through it, like the water.
const GLASS = { thickness: 0.008, ior: 1.52 };
const paneMeshes = [];
{

	const GT = GLASS.thickness, F0 = ( ( GLASS.ior - 1 ) / ( GLASS.ior + 1 ) ) ** 2, Y0 = - 0.021;
	// thin: the axis across the pane; inner: the box face on the water's side (BoxGeometry order +x -x +y -y +z -z).
	const pane = ( w, h, d, x, z, thin, inner ) => {

		const g = new THREE.BoxGeometry( w, h, d );
		const edge = new Float32Array( 24 ), idx = [];
		for ( let f = 0; f < 6; f ++ ) {

			const wide = ( f >> 1 ) === ( thin === 'x' ? 0 : 2 );
			edge.fill( wide ? 0 : 1, f * 4, f * 4 + 4 );
			if ( f !== inner ) for ( let k = 0; k < 6; k ++ ) idx.push( g.index.array[ f * 6 + k ] );

		}

		g.setAttribute( 'edge', new THREE.BufferAttribute( edge, 1 ) );
		g.setIndex( idx );
		const m = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false } );
		const V = positionWorld.sub( cameraPosition ).normalize();
		const N = normalLocal; // the box is not turned: its own normal is the world's
		const fres = float( F0 ).add( float( 1 - F0 ).mul( float( 1 ).sub( V.dot( N ).abs() ).pow( 5 ) ) );
		const e = attribute( 'edge', 'float' );
		// Two faces mirror on a wide side, 2 F / ( 1 + F ) with the bounces
		// between them; an edge is a deep, bright green.
		const a = mix( fres.mul( 2 ).div( fres.add( 1 ) ), float( 0.82 ), e );
		m.colorNode = mix( sky( reflect( V, N ) ), vec3( 0.42, 0.72, 0.6 ).mul( fres.mul( 3 ).add( 0.75 ) ), e );
		m.opacityNode = a;
		const mesh = new THREE.Mesh( g, m );
		mesh.position.set( x, Y0 + h / 2, z );
		mesh.renderOrder = 20; // after the water's surface
		mesh.userData.noFocus = true;
		scene.add( mesh );
		paneMeshes.push( mesh );

	};
	pane( TW + 2 * GT, TH - Y0, GT, 0, TD / 2 + GT / 2, 'z', 5 ); // front, over both corners
	for ( const sx of [ - 1, 1 ] ) pane( GT, TH - Y0, TD + 0.021, sx * ( TW / 2 + GT / 2 ), - 0.021 / 2, 'x', sx > 0 ? 1 : 0 );

}

// The tank seen from outside: the slabs above face inwards only, so from
// behind the tank the back wall was culled and the eye fell into the
// void (and the light shafts drew there in blocks). A marble shell gives
// the back wall and the floor their thickness. It stays 1 mm behind the
// slabs (no depth fight), and in the scene, not in the tank group: it is
// dry, and the water's mirrors do not need it.
{

	const T = 0.02, GAP = 0.001;
	const block = ( w, h, d, x, y, z ) => {

		const g = new THREE.BoxGeometry( w, h, d );
		g.computeTangents();
		const m = new THREE.Mesh( g, createMaterial( marble, { coords: uv().mul( vec2( Math.max( w, d ), Math.max( h, Math.min( w, d ) ) ) ) } ).material );
		m.position.set( x, y, z );
		m.castShadow = m.receiveShadow = true;
		scene.add( m );

	};
	block( TW, TH + T, T, 0, ( TH - T ) / 2, - TD / 2 - GAP - T / 2 ); // back, down to under the floor
	const IN = 0.0003; // inside the three panes, behind the sand's rim
	block( TW - 2 * IN, T, TD + GAP - IN, 0, - GAP - T / 2, - ( GAP + IN ) / 2 ); // under the sand

}

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
// The fixed life of the floor, built by code (demo/sealife): seagrass
// meadows, two kelps, anemones, three corals and two starfish, in the free
// floor clear of the cubes and of the crab's lane (z = 0.31). All stand on
// the displaced sand (seabed.js sandAt) and below the level. ?noflora.
const flora = [];
if ( ! params.has( 'nolife' ) && ! params.has( 'noflora' ) ) {

	const floor = sandAt( params.has( 'flat' ) ? null : { ...sand, dune: 1 }, TW, TD );
	const grass = createSeagrass( { floor, meadows: [
		{ x: - 0.46, z: - 0.18, r: 0.09, shoots: 36, h: [ 0.08, 0.13 ], w: [ 0.004, 0.006 ] },
		{ x: - 0.5, z: 0.12, r: 0.08, shoots: 26, h: [ 0.1, 0.16 ], w: [ 0.004, 0.006 ] },
		{ x: - 0.07, z: - 0.31, r: 0.09, shoots: 30, h: [ 0.08, 0.14 ], w: [ 0.004, 0.0065 ] },
		{ x: - 0.04, z: 0.02, r: 0.05, shoots: 14, h: [ 0.07, 0.12 ], w: [ 0.0035, 0.005 ] },
		{ x: 0.46, z: 0.3, r: 0.08, shoots: 24, h: [ 0.09, 0.15 ], w: [ 0.004, 0.006 ] },
	] } );
	tank.add( grass.mesh );
	const kelp = createKelp( { floor, spots: [ [ 0.5, - 0.3, 0.25 ], [ 0.16, - 0.33, 0.21 ] ] } ); // [ x, z, height ]: the top leaf stays 2 cm under the level
	tank.add( kelp.group );
	const anemones = createAnemones( { floor, list: [
		{ x: - 0.2, z: 0.12, R: 0.022, H: 0.035, count: 130, column: '#a04a5c', base: '#e0508c', tip: '#fff0f6' },
		{ x: 0.33, z: 0.12, R: 0.016, H: 0.028, count: 84, column: '#3e5e2e', base: '#4caa58', tip: '#d070e8' },
		{ x: - 0.52, z: - 0.02, R: 0.028, H: 0.04, count: 150, column: '#a04018', base: '#f06a1c', tip: '#ffe0a0' },
	] } );
	tank.add( anemones.group );
	const corals = createCorals( { floor, list: [
		{ kind: 'branching', x: 0.5, z: 0.11, size: 0.1 },
		{ kind: 'fan', x: - 0.27, z: - 0.355, size: 0.14, ry: 0 },
	] } );
	const brains = createBrainCorals( { floor, list: [ { x: 0.26, z: - 0.005, R: 0.05 } ] } );
	const stars = createStarfish( { floor, list: [
		{ x: - 0.04, z: 0.19, Ra: 0.04, knobs: 1, color: '#e0a060', knobColor: '#3a1a10', groove: '#5a2a10' },
		{ x: 0.48, z: - 0.04, Ra: 0.048, knobs: 0, color: '#3a6ae0', groove: '#0c1a50' },
	] } );
	tank.add( corals.group, brains.group, stars.group );
	flora.push( grass, kelp, anemones, corals, brains, stars );
	hideUp.push( grass.mesh, kelp.group, anemones.group, corals.group, brains.group, stars.group );
	// Sharp sun shadows: the stage has a shadow map, but nothing in the tank
	// received it. The map now covers the tank only (2048 texels over 1.5 m:
	// 0.7 mm each, a quarter of the stage's 4096 map to fill), the
	// sand, the walls and the cubes take shadows, the cubes cast them too.
	// The map is drawn once per frame: each water mirror is another camera,
	// which would draw it again. ?noshadow.
	if ( ! params.has( 'noshadow' ) ) {

		const S = sun.shadow.camera;
		S.left = S.bottom = - 0.75; S.right = S.top = 0.75; S.near = 2.4; S.far = 4.4;
		S.updateProjectionMatrix();
		sun.shadow.mapSize.set( 2048, 2048 );
		for ( const o of tank.children ) if ( o.isMesh && o !== water && ! o.isInstancedMesh ) { o.receiveShadow = true; o.castShadow ||= o.geometry.type !== 'PlaneGeometry'; }
		sun.shadow.autoUpdate = false;
		flora.push( { update() { sun.shadow.needsUpdate = true; } } );

	}

}

// Strings of bubbles from three points of the floor (src/core/bubbles.js);
// ?nobubbles. In the scene, not in the tank group: the mirrors skip them.
if ( ! params.has( 'nobubbles' ) ) scene.add( createBubbles( { box: { min: [ - TW / 2, 0, - TD / 2 ], max: [ TW / 2, LEVEL, TD / 2 ] }, count: 150, sources: [ [ - 0.36, 0.14 ], [ 0.02, - 0.22 ], [ 0.42, 0.2 ] ] } ) );
// Life, built by code (demo/sealife): a school of fish that circles above
// the low cubes, small silver fish milling around the driftwood post just
// under the surface, one red fish on a slow loop by the front glass (under
// the school, in front of the bronze cube), four jellyfish in the free
// corners, a crab that walks along the front of the floor. ?nolife. The
// fish and the crab are in the tank group, so the water's mirrors show them.
const life = [];
if ( ! params.has( 'nolife' ) ) {

	const school = createSchool( { count: 16, length: 0.045, loop: { centre: [ - 0.12, 0.25, 0.1 ], radii: [ 0.32, 0.025, 0.17 ] }, lanes: [ 0.045, 0.018 ] } );
	const silver = createSchool( { count: 64, length: 0.022, shape: 'silver', seed: 7, period: 15, arc: 0.6, lanes: [ 0.022, 0.012 ], size: [ 0.85, 1.1 ], bankG: 0.08, pec: [ 2.5, 0.3 ],
		loop: { centre: [ 0.3, 0.305, - 0.17 ], radii: [ 0.16, 0.006, 0.15 ] } } );
	const hero = createSchool( { count: 1, length: 0.1, shape: 'hero', seed: 11, period: 42, arc: 0, lanes: [ 0, 0 ], size: [ 1, 1 ], surge: 0.4, bankG: 0.1, pec: [ 1.3, 0.5 ],
		loop: { centre: [ - 0.02, 0.155, 0.3 ], half: 0.24, radius: 0.07, bob: 0.006 } } );
	tank.add( school.mesh, silver.mesh, hero.mesh );
	const jellies = createJellies( { spots: [ [ 0.5, 0.2, 0.0 ], [ - 0.5, 0.17, - 0.28 ], [ 0.05, 0.22, - 0.32 ], [ 0.47, 0.16, 0.3 ] ] } );
	scene.add( jellies.group );
	// The crab stands on the displaced sand: its height, on the CPU, by the
	// same formula as the floor's vertices (sealife/seafloor.js); ?flat: 0.
	const ground = params.has( 'flat' ) ? () => 0 : sandFloor( { ...sand, dune: 1 }, { width: TW, depth: TD } );
	const crab = createCrab( { size: 0.055, from: [ - 0.3, 0, 0.31 ], to: [ 0.22, 0, 0.31 ], ground } );
	tank.add( crab.group );
	life.push( school, silver, hero, jellies, crab );
	silver.mesh.castShadow = false; // 64 fish of 2 cm: their shadows are specks, and a pass of 160 k triangles
	hideUp.push( school.mesh, silver.mesh, hero.mesh, crab.group );

}

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
	for ( const l of life ) l.update( clock );
	for ( const f of flora ) f.update( clock );
	// Under water the haze tells the distance, not the lens: half the blur.
	const under = camera.position.y < LEVEL && Math.abs( camera.position.x ) < TW / 2 && Math.abs( camera.position.z ) < TD / 2;
	if ( lens ) lens.bokehScale = under ? 0.5 : 1;
	kit.update( dt );
	stats.beginFrame();
	draw();
	stats.endFrame( camera.position.distanceTo( controls.target ) );

} );

window.__ix = { renderer, scene, camera, controls, kit, life, flora, walk, adaptive, lens, focus: lens, fx, refraction, apparentPoint, waterBody, tank, LEVEL, TD, view, setTime, draw, dive, glassPan, ready: true };
