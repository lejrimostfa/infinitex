// Game-like scene to measure what Infinitex costs in a real frame
// (tests/perf_game.mjs, docs/performance.md). A character built from
// primitives wears 5 matters (face and forearm skin with 3D hair, knit with
// fuzz, leather, steel) in a decor of 8 matters (soil, brick, concrete,
// wood, rusty iron, plastic, terracotta, granite). Sun shadows, GTAO and
// the hair pass of src/camera/post.js, as in a game.
// window.__game.measure() swaps every material between three modes:
//   ix     the Infinitex matters
//   plain  MeshStandardMaterial, one colour, no texture: "the rest of the frame"
//   ?noix  builds no Infinitex matter at all (memory baseline)
//   pbr    MeshStandardMaterial with a 2K albedo, normal and ORM map each
//          (RGBA8, mipmaps, anisotropy 8): the conventional texture set
// Event bus: none, a measuring page. No UI.

import * as THREE from 'three/webgpu';
import { uv } from 'three/tsl';
import { createMaterial } from '../src/index.js';
import { HAIR_LAYER } from '../src/core/hair3d.js';
import { createStage } from './scene.js';
import { createPost } from '../src/camera/index.js';
import { CUBES } from './cubelist.js';

const params = new URLSearchParams( location.search );
const ctx = await createStage( { forceWebGL: params.has( 'webgl' ) } );
const { renderer, scene, camera } = ctx;
ctx.floor.visible = false;
renderer.shadowMap.enabled = true;
const sun = scene.children.find( ( o ) => o.isDirectionalLight );
sun.position.set( 4, 8, 5 );
sun.castShadow = true;
sun.shadow.mapSize.set( 2048, 2048 );
Object.assign( sun.shadow.camera, { left: - 9, right: 9, top: 9, bottom: - 9, near: 0.5, far: 30 } );
sun.shadow.camera.updateProjectionMatrix();

const preset = ( name ) => {

	for ( const f of CUBES ) for ( const it of f.items ) if ( it.name === name ) return it.preset;
	throw new Error( `no matter ${ name }` );

};

// UVs in surface meters: boxes and planes by their dominant axis, so a
// texel or a stitch has the same size on every face.
function metricUV( g ) {

	const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
	for ( let i = 0; i < p.count; i ++ ) {

		const ax = Math.abs( n.getX( i ) ), ay = Math.abs( n.getY( i ) ), az = Math.abs( n.getZ( i ) );
		const x = p.getX( i ), y = p.getY( i ), z = p.getZ( i );
		if ( ax >= ay && ax >= az ) u.setXY( i, z, y );
		else if ( ay >= az ) u.setXY( i, x, z );
		else u.setXY( i, x, y );

	}

	return g;

}

// Cylinders and spheres keep their own parametrisation, scaled to meters.
const scaleUV = ( g, su, sv ) => {

	const u = g.attributes.uv;
	for ( let i = 0; i < u.count; i ++ ) u.setXY( i, u.getX( i ) * su, u.getY( i ) * sv );
	return g;

};
const cyl = ( r, h, seg = 32 ) => scaleUV( new THREE.CylinderGeometry( r, r, h, seg, 4 ), 2 * Math.PI * r, h );
const sph = ( r ) => scaleUV( new THREE.SphereGeometry( r, 48, 32 ), 2 * Math.PI * r, Math.PI * r );
const box = ( w, h, d ) => metricUV( new THREE.BoxGeometry( w, h, d ) );
const at = ( g, x, y, z, rx = 0, rz = 0 ) => g.rotateX( rx ).rotateZ( rz ).translate( x, y, z );
const merge = ( ...gs ) => {

	// Same attributes on every part: position, normal, uv, index.
	let vo = 0;
	const pos = [], nor = [], uvs = [], idx = [];
	for ( const g of gs ) {

		pos.push( ...g.attributes.position.array ); nor.push( ...g.attributes.normal.array ); uvs.push( ...g.attributes.uv.array );
		for ( const k of g.index.array ) idx.push( k + vo );
		vo += g.attributes.position.count;

	}

	const m = new THREE.BufferGeometry();
	m.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	m.setAttribute( 'normal', new THREE.Float32BufferAttribute( nor, 3 ) );
	m.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	m.setIndex( idx );
	return m;

};

// name, matter, geometry, fuzz, hair3d, plain colour
const PARTS = [
	// Character, about 1.8 m, facing +z.
	[ 'face', 'Visage', at( sph( 0.11 ), 0, 1.66, 0 ), false, true, 0xc89a7c ],
	[ 'forearms', 'Peau mate', merge( at( cyl( 0.042, 0.26 ), 0.25, 1.06, 0 ), at( cyl( 0.042, 0.26 ), - 0.25, 1.06, 0 ), at( cyl( 0.035, 0.12 ), 0, 1.53, 0 ) ), false, true, 0xa87656 ],
	[ 'sweater', 'Jersey', merge( at( cyl( 0.17, 0.58 ), 0, 1.22, 0 ), at( cyl( 0.055, 0.3 ), 0.23, 1.32, 0, 0, 0.2 ), at( cyl( 0.055, 0.3 ), - 0.23, 1.32, 0, 0, - 0.2 ) ), true, false, 0x7a2030 ],
	[ 'trousers', 'Cuir pleine fleur', merge( at( cyl( 0.08, 0.82 ), 0.09, 0.5, 0 ), at( cyl( 0.08, 0.82 ), - 0.09, 0.5, 0 ), at( box( 0.12, 0.1, 0.24 ), 0.09, 0.05, 0.04 ), at( box( 0.12, 0.1, 0.24 ), - 0.09, 0.05, 0.04 ) ), false, false, 0x5a3a24 ],
	[ 'steel', 'Acier brossé', merge( at( cyl( 0.18, 0.06, 48 ), 0, 0.93, 0 ), at( sph( 0.08 ).scale( 1.2, 0.8, 1.2 ), 0.2, 1.47, 0 ), at( cyl( 0.05, 0.14 ), 0.25, 0.98, 0 ) ), false, false, 0x9aa0a6 ],
	// Decor.
	[ 'ground', 'Terre', at( metricUV( new THREE.PlaneGeometry( 30, 30, 1, 1 ).rotateX( - Math.PI / 2 ) ), 0, 0, - 5 ), false, false, 0x4a3a2a ],
	[ 'wall', 'Brique et mortier', at( box( 12, 3, 0.3 ), 0, 1.5, - 4 ), false, false, 0x8a4a3a ],
	[ 'path', 'Béton', at( box( 2, 0.04, 14 ), 1.6, 0.02, - 1 ), false, false, 0x8a8a86 ],
	[ 'crates', 'Bois brut', merge( at( box( 0.8, 0.8, 0.8 ), - 2.2, 0.4, - 2.8 ), at( box( 0.6, 0.6, 0.6 ), - 2.1, 1.1, - 2.8 ), at( box( 0.7, 0.7, 0.7 ), - 3.1, 0.35, - 2.5 ) ), false, false, 0x8a6a44 ],
	[ 'barrel', 'Fer rouillé', at( cyl( 0.3, 0.9 ), 2.6, 0.45, - 3.2 ), false, false, 0x6a3a22 ],
	[ 'bin', 'Plastique usé, jauni', at( box( 0.6, 0.7, 0.5 ), 3.4, 0.35, - 3.3 ), false, false, 0x2a6a3a ],
	[ 'pot', 'Terre cuite', at( cyl( 0.22, 0.5 ), - 1.2, 0.25, - 3.4 ), false, false, 0xa0583a ],
	[ 'rock', 'Granit', at( new THREE.IcosahedronGeometry( 0.7, 3 ).scale( 1.4, 0.7, 1 ), 4.5, 0.3, - 1.5 ), false, false, 0x7a7a78 ],
];

// The rock (non-indexed, spherical uv) gets a metric uv and an index.
metricUV( PARTS.find( ( p ) => p[ 0 ] === 'rock' )[ 2 ] );
for ( const p of PARTS ) if ( ! p[ 2 ].index ) p[ 2 ].setIndex( [ ...Array( p[ 2 ].attributes.position.count ).keys() ] );

const parts = PARTS.map( ( [ name, matter, geo, fuzz, hair, color ] ) => {

	geo.computeTangents();
	const plain = new THREE.MeshStandardMaterial( { color, roughness: 0.7 } );
	const ix = params.has( 'noix' ) ? null : createMaterial( preset( matter ), { coords: uv() } );
	const mesh = new THREE.Mesh( geo, ix ? ix.material : plain );
	mesh.name = name;
	mesh.castShadow = mesh.receiveShadow = true;
	const extra = [];
	if ( ix && fuzz && ! params.has( 'nofuzz' ) ) extra.push( ix.createFuzz( mesh ) );
	if ( ix && hair && ! params.has( 'nohair' ) ) extra.push( ix.createHair( mesh, { metersPerUV: 1 } ) );
	scene.add( mesh );
	return { name, matter, mesh, ix, extra, color, plain, pbr: null };

} );

// Conventional set: 2K albedo, normal and ORM per material, RGBA8 with
// mipmaps. Noise content: the cost of sampling does not depend on it.
let seed = 1;
const rnd = () => ( seed = ( seed * 1664525 + 1013904223 ) >>> 0 );
function noiseTex( size, kind ) {

	const a = new Uint8Array( size * size * 4 ), w = new Uint32Array( a.buffer );
	if ( kind === 'normal' ) for ( let i = 0; i < w.length; i ++ ) { const r = rnd(); w[ i ] = ( 0xff << 24 ) | ( 0xf0 + ( r & 15 ) ) << 16 | ( 0x78 + ( ( r >> 8 ) & 15 ) ) << 8 | ( 0x78 + ( ( r >> 16 ) & 15 ) ); }
	else for ( let i = 0; i < w.length; i ++ ) w[ i ] = rnd() | 0xff000000;
	const t = new THREE.DataTexture( a, size, size );
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.generateMipmaps = true;
	t.minFilter = THREE.LinearMipmapLinearFilter;
	t.magFilter = THREE.LinearFilter;
	t.anisotropy = 8;
	if ( kind === 'albedo' ) t.colorSpace = THREE.SRGBColorSpace;
	t.needsUpdate = true;
	return t;

}

function pbrMaterial( size ) {

	const orm = noiseTex( size, 'orm' );
	return new THREE.MeshStandardMaterial( {
		map: noiseTex( size, 'albedo' ), normalMap: noiseTex( size, 'normal' ),
		aoMap: orm, roughnessMap: orm, metalnessMap: orm, metalness: 1,
	} );

}

// only: the name of the one part that takes `mode`, the others are plain.
function setMode( mode, only = null, size = 2048 ) {

	for ( const p of parts ) {

		const m = only && p.name !== only ? 'plain' : p.ix ? mode : mode === 'ix' ? 'plain' : mode;
		if ( m === 'pbr' && ! p.pbr ) p.pbr = pbrMaterial( size );
		p.mesh.material = m === 'ix' ? p.ix.material : m === 'pbr' ? p.pbr : p.plain;
		for ( const e of p.extra ) e.visible = m === 'ix';

	}

}

const post = createPost( renderer, scene, camera );
const CH = new THREE.Vector3( 0, 1.25, 0 );
// Camera views: [ position, look at ].
const VIEWS = {
	far10: [ [ 2.5, 2.6, 10 ], CH ],
	mid5: [ [ 1.4, 2.0, 5 ], CH ],
	tps3: [ [ 0.9, 1.75, 2.8 ], CH ],
	face: [ [ 0.05, 1.68, 0.48 ], [ 0, 1.66, 0 ] ],
	macro: [ [ 0, 1.25, 0.17 + 0.06 ], [ 0, 1.25, 0 ] ],
	hair: [ [ 0.25, 1.06, 0.042 + 0.04 ], [ 0.25, 1.06, 0 ] ], // forearm at 4 cm: 3D hair drawn
};
const empty = new THREE.Scene();

function view( name ) {

	const [ p, l ] = VIEWS[ name ];
	camera.position.set( ...p );
	camera.lookAt( l.isVector3 ? l : new THREE.Vector3( ...l ) );
	camera.updateMatrixWorld();
	post.update( camera.position.distanceTo( l.isVector3 ? l : new THREE.Vector3( ...l ) ) );

}

// One measured view: median GPU time (timestamp queries, every pass of the
// frame), median wall time from submit to queue done (cross-check), and
// median CPU submit time (the synchronous render call: hair raycasts, node
// updates, command encoding).
// Outside setAnimationLoop three.js never advances its node frame, so the
// post passes would skip every frame after the first: advance it here as
// the animation loop does. The output goes to a render target: headless,
// the canvas pass returns a broken end timestamp.
let rt = null;
// calib: an empty scene, no post: the fixed latency inside wallMs.
async function measure( { mode = 'ix', name = 'tps3', frames = 40, usePost = true, calib = false, only = null } = {} ) {

	setMode( mode, only );
	view( name );
	const w = renderer.domElement.width, h = renderer.domElement.height;
	if ( ! rt || rt.width !== w || rt.height !== h ) { rt?.dispose(); rt = new THREE.RenderTarget( w, h, { type: THREE.HalfFloatType } ); }
	renderer.setRenderTarget( rt );
	renderer.info.autoReset = false;
	const nodeFrame = renderer._nodes.nodeFrame, queue = renderer.backend.device?.queue;
	const gpu = [], cpu = [], wall = [], pool = renderer.backend.timestampQueryPool?.render;
	let bad = 0;
	let draws = 0, tris = 0;
	for ( let i = 0; i < frames + 6; i ++ ) {

		nodeFrame.update();
		renderer.info.frame = nodeFrame.frameId;
		renderer.info.reset();
		camera.position.x += ( i % 2 ? 1 : - 1 ) * 1e-5; // the hair window updates every frame, as in a game
		camera.updateMatrixWorld();
		const t = performance.now();
		if ( calib ) renderer.render( empty, camera );
		else if ( usePost ) post.render();
		else renderer.render( scene, camera );
		const c = performance.now() - t;
		if ( queue ) await queue.onSubmittedWorkDone();
		const wl = performance.now() - t;
		await renderer.resolveTimestampsAsync( 'render' );
		// Sum the passes of this frame; drop the ones with a broken end
		// timestamp (counted in badPasses).
		let g = 0;
		for ( const [ uid, d ] of pool?.timestamps ?? [] ) if ( uid.endsWith( `:f${ nodeFrame.frameId }` ) ) { if ( d >= 0 && d < 500 ) g += d; else bad ++; }
		draws = renderer.info.render.drawCalls; tris = renderer.info.render.triangles;
		if ( i >= 6 ) { cpu.push( c ); wall.push( wl ); if ( g > 0 && g < 1000 ) gpu.push( g ); }

	}

	renderer.setRenderTarget( null );
	const med = ( a ) => a.length ? + a.slice().sort( ( x, y ) => x - y )[ a.length >> 1 ].toFixed( 3 ) : null;
	return { mode: calib ? 'calib' : mode, view: name, post: usePost && ! calib, gpuMs: med( gpu ), wallMs: med( wall ), cpuMs: med( cpu ), gpuSamples: gpu.length, badPasses: bad, drawCalls: draws, triangles: tris, size: `${ w }x${ h }` };

}

// CPU cost of the 3D hair window on a skinned game character: three.js
// raycasts a SkinnedMesh by skinning each tested vertex on the CPU, no BVH.
async function skinnedRaycast() {

	const { GLTFLoader } = await import( 'three/addons/loaders/GLTFLoader.js' );
	const { createMannequin } = await import( './mannequin.js' );
	const out = {};
	const ray = new THREE.Raycaster();
	const timeHit = ( obj, target ) => {

		obj.updateMatrixWorld( true );
		const from = target.clone().add( new THREE.Vector3( 0, 0, 2 ) );
		ray.set( from, target.clone().sub( from ).normalize() );
		ray.intersectObject( obj, false );
		const t = performance.now();
		let hits = 0;
		for ( let i = 0; i < 20; i ++ ) hits = ray.intersectObject( obj, false ).length;
		return { ms: + ( ( performance.now() - t ) / 20 ).toFixed( 3 ), hits, triangles: obj.geometry.index ? obj.geometry.index.count / 3 : obj.geometry.attributes.position.count / 3 };

	};

	const man = createMannequin( new THREE.MeshStandardMaterial() );
	scene.add( man.group );
	man.group.position.set( 20, 0, 0 );
	const torso = man.meshes[ 0 ];
	man.group.updateMatrixWorld( true );
	out.mannequinTorso = timeHit( torso, new THREE.Box3().setFromObject( torso ).getCenter( new THREE.Vector3() ) );
	scene.remove( man.group );
	try {

		const gltf = await new GLTFLoader().loadAsync( 'demo/assets/riveraine.glb' );
		let body = null;
		gltf.scene.traverse( ( o ) => { if ( ! body && o.isSkinnedMesh ) body = o; } );
		scene.add( gltf.scene );
		gltf.scene.position.set( 20, 0, 0 );
		const b = new THREE.Box3().setFromObject( body );
		out.characterBody = timeHit( body, b.getCenter( new THREE.Vector3() ) );
		scene.remove( gltf.scene );

	} catch ( e ) {

		out.characterBody = `not measured: ${ e.message }`;

	}

	// The same window update on the static cube-like hosts of this scene.
	const host = parts.find( ( p ) => p.name === 'forearms' );
	view( 'tps3' );
	const t = performance.now();
	for ( let i = 0; i < 200; i ++ ) { camera.position.x += ( i % 2 ? 1 : - 1 ) * 1e-5; camera.updateMatrixWorld(); host.ix.hair.update( renderer, scene, camera ); }
	out.staticForearmsUpdateMs = + ( ( performance.now() - t ) / 200 ).toFixed( 4 );
	out.forearmsTriangles = host.mesh.geometry.index.count / 3;
	return out;

}

camera.layers.enable( HAIR_LAYER );
view( 'tps3' );
await post.renderAsync();
window.__game = {
	renderer, scene, camera, parts, post, measure, setMode, view, skinnedRaycast,
	views: Object.keys( VIEWS ),
	memory: () => ( { ...renderer.info.memory } ),
	ready: true,
};
