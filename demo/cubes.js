// Cube wall: one rounded cube per matter of the catalogue (cubelist.js),
// one row per family. Lit cubes wear their Infinitex material; the others
// are grey with their name, waiting for their family.
//   ?fly    flyover film: approach, dive to the microns, rise, next cube
//   ?family=N  one family only (row N): the others stay grey and the
//           flyover tours that row (one film per family, tests/film.mjs)
//   ?webgl  WebGL2 backend, ?nofuzz, ?nohair (3D strands), ?noao
// window.__ix.bench() measures each lit matter full screen at three
// distances (tests/bench.mjs).

import * as THREE from 'three/webgpu';
import { uv } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { setLoadingProgress } from './nav.js';
import { streamMaterials } from './warmup.js';
import { createMaterial } from '../src/index.js';
import { HAIR_LAYER } from '../src/core/hair3d.js';
import { createStage } from './scene.js';
import { createFlyover } from './flyover.js';
import { startApp } from './app.js';
import { CUBES } from './cubelist.js';
import { cubeEn, rowEn } from './cubelist_en.js';

const SIZE = 0.3, DX = 0.6, DZ = 1.0, PER_ROW = 12;
const params = new URLSearchParams( location.search );
const famSel = params.get( 'family' ); // row number, e.g. '10'
const inTour = ( title ) => ! famSel || title.startsWith( `${ famSel }.` );
document.body.classList.toggle( 'film', params.has( 'film' ) );
const ctx = await createStage( { forceWebGL: params.has( 'webgl' ) } );
const { scene, camera, controls } = ctx;
ctx.updateClip = () => camera.position.distanceTo( controls.target );
ctx.floor.visible = false;
const floor = new THREE.Mesh( new THREE.PlaneGeometry( 60, 60 ), new THREE.MeshStandardMaterial( { color: 0x1d1f24, roughness: 0.9 } ) );
floor.rotation.x = - Math.PI / 2;
floor.position.set( 3, 0, - 10 );
floor.receiveShadow = true;
scene.add( floor );
ctx.scene.children.find( ( o ) => o.isDirectionalLight ).position.set( 1.5, 2.5, 2.2 );

// One geometry for every cube: UVs in meters, tangents for the families.
let geo = new RoundedBoxGeometry( SIZE, SIZE, SIZE, 6, 0.025 );
geo.deleteAttribute( 'uv1' );
geo = mergeVertices( geo );
geo.computeTangents();
const coords = uv().mul( SIZE );
const grey = new THREE.MeshStandardMaterial( { color: 0x3b3d43, roughness: 0.85 } );

// A Fair Isle motif for the jacquard cube: each stitch takes its colour.
function jacquardMap() {

	const c = document.createElement( 'canvas' );
	c.width = c.height = 64;
	const g = c.getContext( '2d' );
	g.fillStyle = '#e8dcc4'; g.fillRect( 0, 0, 64, 64 );
	g.fillStyle = '#7a1f2b'; g.fillRect( 0, 6, 64, 6 ); g.fillRect( 0, 52, 64, 6 );
	g.fillStyle = '#1f3d6b';
	for ( let x = 0; x < 64; x += 16 ) for ( let k = 0; k < 8; k ++ ) { g.fillRect( x + k, 24 + k, 2, 2 ); g.fillRect( x + 14 - k, 24 + k, 2, 2 ); g.fillRect( x + k, 38 - k, 2, 2 ); g.fillRect( x + 14 - k, 38 - k, 2, 2 ); }
	g.fillStyle = '#2f6b3a'; for ( let x = 0; x < 64; x += 4 ) g.fillRect( x, 16, 2, 2 ), g.fillRect( x + 2, 46, 2, 2 );
	const t = new THREE.CanvasTexture( c );
	t.colorSpace = THREE.SRGBColorSpace;
	return t;

}

// A tattoo flash: a compass rose with rings and dots, black ink on white.
function tattooDesign() {

	const c = document.createElement( 'canvas' );
	c.width = c.height = 1024;
	const g = c.getContext( '2d' );
	g.fillStyle = '#fff'; g.fillRect( 0, 0, 1024, 1024 );
	g.translate( 512, 512 );
	g.strokeStyle = g.fillStyle = '#000';
	g.lineCap = g.lineJoin = 'round';
	const ring = ( r, w ) => { g.lineWidth = w; g.beginPath(); g.arc( 0, 0, r, 0, Math.PI * 2 ); g.stroke(); };
	ring( 430, 14 ); ring( 395, 5 ); ring( 175, 10 );
	for ( let k = 0; k < 72; k ++ ) { const a = k / 72 * Math.PI * 2; g.beginPath(); g.arc( Math.cos( a ) * 412, Math.sin( a ) * 412, k % 6 ? 4 : 9, 0, Math.PI * 2 ); g.fill(); }
	// Eight points: long ones on the axes, short between; one half of each filled.
	for ( let k = 0; k < 8; k ++ ) {

		const a = k / 8 * Math.PI * 2 - Math.PI / 2, L = k % 2 ? 250 : 380, W = k % 2 ? 42 : 64;
		const tip = [ Math.cos( a ) * L, Math.sin( a ) * L ];
		const l = [ Math.cos( a - Math.PI / 2 ) * W, Math.sin( a - Math.PI / 2 ) * W ];
		const r = [ - l[ 0 ], - l[ 1 ] ];
		g.beginPath(); g.moveTo( 0, 0 ); g.lineTo( ...l ); g.lineTo( ...tip ); g.closePath(); g.fill();
		g.lineWidth = 9; g.beginPath(); g.moveTo( 0, 0 ); g.lineTo( ...r ); g.lineTo( ...tip ); g.closePath(); g.stroke();

	}

	g.fillStyle = '#fff'; g.beginPath(); g.arc( 0, 0, 34, 0, Math.PI * 2 ); g.fill();
	g.fillStyle = '#000'; ring( 34, 9 );
	const t = new THREE.CanvasTexture( c );
	t.colorSpace = THREE.SRGBColorSpace;
	t.generateMipmaps = true;
	t.minFilter = THREE.LinearMipmapLinearFilter;
	return t;

}

// Name plate lying on the floor in front of a cube.
function plate( text, lit, w = SIZE + 0.1 ) {

	const c = document.createElement( 'canvas' );
	c.width = 512; c.height = 96;
	const g = c.getContext( '2d' );
	g.fillStyle = lit ? '#d9a441' : '#7d8088';
	g.font = '600 38px system-ui, sans-serif';
	g.textAlign = 'center'; g.textBaseline = 'middle';
	let s = text;
	while ( g.measureText( s ).width > 490 && s.length > 4 ) s = s.slice( 0, - 2 ) + '…';
	g.fillText( s, 256, 50 );
	const t = new THREE.CanvasTexture( c );
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	const m = new THREE.Mesh( new THREE.PlaneGeometry( w, w * 96 / 512 ), new THREE.MeshBasicMaterial( { map: t, transparent: true } ) );
	m.rotation.x = - Math.PI / 2;
	m.userData.plate = true;
	return m;

}

const lit = [], fuzz = [];
let row = 0;
for ( const fam of CUBES ) {

	const title = plate( rowEn( fam.title ), true, 1.0 );
	title.position.set( - 0.9, 0.002, - row * DZ );
	title.rotation.z = Math.PI / 2;
	scene.add( title );
	fam.items.forEach( ( item, i ) => {

		if ( i && i % PER_ROW === 0 ) row ++;
		const x = ( i % PER_ROW ) * DX, z = - row * DZ;
		let mesh;
		if ( item.preset && inTour( fam.title ) ) {

			if ( item.tattooDesign ) item.preset = { ...item.preset, tattoo_map: tattooDesign() };
			const ix = createMaterial( item.preset, {
				coords,
				colorMap: item.jacquard ? { map: jacquardMap(), uv: uv() } : null,
			} );
			mesh = new THREE.Mesh( geo, ix.material );
			if ( item.fuzz && ! params.has( 'nofuzz' ) ) fuzz.push( ix.createFuzz( mesh ) );
			// Every skin with body hair grows it in 3D near the camera.
			const hairy = item.hair3d || ( item.preset.family === 'skin' && ( item.preset.hair_density ?? 0.5 ) > 0 );
			if ( hairy && ! params.has( 'nohair' ) ) ix.createHair( mesh, { metersPerUV: SIZE } );
			lit.push( { ...item, ...cubeEn( item ), ix, mesh, family: rowEn( fam.title ) } );
			mesh.userData.lit = true;
			mesh.userData.ix = ix; // tests and film reach the material here

		} else {

			mesh = new THREE.Mesh( geo, grey );

		}

		mesh.position.set( x, SIZE / 2, z );
		mesh.name = item.name;
		mesh.castShadow = mesh.receiveShadow = true;
		scene.add( mesh );
		const p = plate( cubeEn( item ).name, !! item.preset );
		p.position.set( x, 0.002, z + SIZE / 2 + 0.09 );
		scene.add( p );

	} );
	row ++;

}

const rows = row;
const center = new THREE.Vector3( ( PER_ROW - 1 ) * DX / 2, 0, - ( rows - 1 ) * DZ / 2 );

// Flyover: for each lit cube, approach its front face, dive to the
// microns, rise, then a high aerial key on the way to the next cube (the
// camera never skims the grey cubes between). Front faces look at +z.
function flyKeys() {

	const keys = [];
	let t = 0;
	const tour = lit;
	const first = tour[ 0 ].mesh.position;
	if ( famSel ) {

		// One family: an aerial shot of its row, titled.
		const last = tour[ tour.length - 1 ].mesh.position;
		const mx = ( first.x + last.x ) / 2;
		keys.push( { at: t, pos: [ mx, 1.6, first.z + 2.4 ], look: [ mx, 0.1, first.z - 0.3 ], caption: `${ tour[ 0 ].family }: ${ tour.length } matters` } );
		// Then glide down from above to the first cube: never between the rows.
		keys.push( { at: t + 2.8, pos: [ first.x + 0.1, 0.75, first.z + 0.9 ], look: [ first.x, first.y, first.z ] } );

	} else {

		keys.push( { at: t, pos: [ center.x, 5.5, first.z + 6 ], look: [ center.x, 0, first.z - 5 ], caption: `Infinitex: ${ lit.length } matters of ${ CUBES.reduce( ( s, f ) => s + f.items.length, 0 ) }` } );

	}

	t += 5;
	tour.forEach( ( c, i ) => {

		const P = c.mesh.position;
		const face = ( dx, dy ) => ( C, V ) => [ V( P.x + dx * 2, P.y + dy * 2, P.z + 1 ), V( P.x + dx, P.y + dy, P.z ) ];
		keys.push( { at: t, ray: face( 0.04, 0.03 ), alt: 0.14, caption: c.name } );
		keys.push( { at: t + 2.6, ray: face( 0.02, 0.01 ), alt: 0.01 } );
		keys.push( { at: t + 5.2, ray: face( 0.0, 0.0 ), alt: 0.0012, caption: c.zoom } );
		// A looping process (transform family) is mid-way when the camera dives in.
		if ( c.preset.family === 'transform' ) {

			const per = c.preset.period_s ?? 12, sp = c.preset.speed ?? 1;
			c.ix.set( { phase_s: 0.35 * per / sp - ( t + 2.6 ) } ); // a third of the way in at the approach, three quarters when it rises

		}
		keys.push( { at: t + 7.4, ray: face( - 0.02, 0.0 ), alt: 0.22 } );
		t += 7.4;
		const next = tour[ i + 1 ]?.mesh.position;
		if ( next ) {

			const mid = P.clone().add( next ).multiplyScalar( 0.5 );
			const far = Math.max( 1, P.distanceTo( next ) * 0.6 );
			t += 1.6 + 0.5 * Math.min( 3, far - 1 );
			keys.push( { at: t, pos: [ mid.x, mid.y + 0.45 * far, mid.z + 0.9 * far ], look: [ mid.x, mid.y, mid.z ] } );
			t += 1.6 + 0.5 * Math.min( 3, far - 1 );

		}

	} );
	t += 2;
	if ( famSel ) {

		// Back up over the row: every matter of the family at once.
		const last = tour[ tour.length - 1 ].mesh.position;
		const mx = ( first.x + last.x ) / 2;
		keys.push( { at: t + 2, pos: [ mx, 1.4, last.z + 2.2 ], look: [ mx, 0.1, last.z - 0.2 ] } );
		t += 5;
		keys.push( { at: t, pos: [ mx, 2.2, last.z + 3.2 ], look: [ mx, 0.05, last.z - 0.2 ], caption: tour[ 0 ].family } );

	} else {

		keys.push( { at: t, pos: [ center.x + 1, 2.4, lit[ lit.length - 1 ].mesh.position.z + 3.5 ], look: [ center.x, 0, lit[ lit.length - 1 ].mesh.position.z - 2 ] } );
		t += 5;
		keys.push( { at: t, pos: [ center.x, 9, 7 ], look: [ center.x, 0, center.z + 3 ], caption: 'A row of cubes lights up with each new family' } );

	}

	return keys;

}

const film = createFlyover( {
	camera, scene, keys: flyKeys(), C: () => null, V: ( x, y, z ) => new THREE.Vector3( x, y, z ),
	ignore: ( o ) => ! o.userData.lit,
	targets: lit.map( ( c ) => c.mesh ),
} );

// The sun's shadow covers the cubes that are built (one row with ?family).
{

	const box = new THREE.Box3();
	for ( const o of scene.children ) if ( o.isMesh && o.castShadow ) box.expandByObject( o );
	const sun = scene.children.find( ( o ) => o.isDirectionalLight );
	const c = box.getCenter( new THREE.Vector3() ), r = box.getSize( new THREE.Vector3() ).length() / 2 + 0.5;
	const dir = sun.position.clone().normalize();
	sun.target.position.copy( c );
	sun.position.copy( c ).addScaledVector( dir, r + 2 );
	scene.add( sun.target );
	Object.assign( sun.shadow.camera, { left: - r, right: r, top: r, bottom: - r, near: 0.1, far: 2 * r + 4 } );
	sun.shadow.camera.updateProjectionMatrix();

}

controls.target.set( center.x, 0.15, 0 );
camera.position.set( center.x, 2.2, 4 );
const app = startApp( {
	ctx, ix: lit[ 0 ].ix, meshes: lit.map( ( c ) => c.mesh ), fuzz, film, params,
	panel: lit.map( ( c ) => ( { name: c.name, ix: c.ix } ) ),
	animate: () => {},
	statsLevels: false, // the knit levels belong to the first cube only
} );

// Warm-up (demo/warmup.js). The lit cubes start grey and their matters
// compile in the background, nearest first; each cube lights up when its
// shader is ready, and the page keeps its frame rate. __ix.ready (tests,
// bench, loading note) waits for the last one; adaptive resolution holds still.
if ( ! params.has( 'film' ) ) {

	const queue = lit.map( ( c ) => c.mesh ).sort( ( a, b ) => a.position.distanceToSquared( camera.position ) - b.position.distanceToSquared( camera.position ) );
	app.ready = false;
	app.adaptive.hold = true;
	// Pixel ratio 1 while it loads: each frame of the wall at ratio 2 took
	// about 20 ms of main thread, which the compile then lacked. At ratio 1
	// the page draws every frame (27 fps, 16 ms median) and loads as fast.
	ctx.renderer.setPixelRatio( Math.min( 1, app.adaptive.max ) );
	setLoadingProgress( `Compiling the materials: 0 / ${ queue.length }` );
	const stream = streamMaterials( { renderer: ctx.renderer, scene, camera, pass: app.post.scenePass, meshes: queue, placeholder: grey } );
	stream.addEventListener( 'materialReady', ( e ) => setLoadingProgress( `Compiling the materials: ${ e.detail.done } / ${ e.detail.total }` ) );
	stream.addEventListener( 'allReady', () => { ctx.renderer.setPixelRatio( app.adaptive.max ); requestAnimationFrame( () => { app.adaptive.hold = false; app.ready = true; } ); } ); // after the last ones are drawn

}

// Benchmark: each lit matter fills a 1920x1080 target, seen straight on
// with a slight tilt, at 30 cm (whole face), 2 cm and 1.5 mm. Each frame
// reads one pixel back, so the time includes the GPU work. A grey cube
// gives the baseline (scene, plates, readback).
app.bench = async ( frames = 30, dists = [ 0.3, 0.02, 0.0015 ] ) => {

	const { renderer } = ctx;
	renderer.setAnimationLoop( null );
	const rt = new THREE.RenderTarget( 1920, 1080, { type: THREE.HalfFloatType } );
	const aspect = camera.aspect;
	camera.aspect = 1920 / 1080;
	camera.updateProjectionMatrix();
	renderer.setRenderTarget( rt );
	camera.layers.enable( HAIR_LAYER ); // the post pass moved the strands there
	// GPU time from timestamp queries (WebGPU, and WebGL2 when the driver
	// has EXT_disjoint_timer_query); else wall time with a pixel readback,
	// which the display cadence can pad.
	const gpuTimer = renderer.backend.trackTimestamp && ( renderer.backend.isWebGPUBackend || renderer.backend.disjoint );
	const one = async () => {

		const t0 = performance.now();
		await renderer.renderAsync( scene, camera );
		if ( gpuTimer ) {

			const ms = await renderer.resolveTimestampsAsync( 'render' );
			if ( ms ) return ms;

		}

		await renderer.readRenderTargetPixelsAsync( rt, 960, 540, 1, 1 );
		return performance.now() - t0;

	};
	const median = async () => {

		for ( let i = 0; i < 4; i ++ ) await one();
		const times = [];
		for ( let i = 0; i < frames; i ++ ) times.push( await one() );
		times.sort( ( a, b ) => a - b );
		return +times[ times.length >> 1 ].toFixed( 3 );

	};
	const measure = async ( P, d ) => {

		camera.position.set( P.x + d * 0.15, P.y + d * 0.25, P.z + SIZE / 2 + d );
		camera.up.set( 0, 1, 0 );
		camera.lookAt( P.x, P.y, P.z + SIZE / 2 );
		return median();

	};
	const greyCube = scene.children.find( ( o ) => o.isMesh && o.material === grey );
	const out = { backend: renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2', size: '1920x1080', dists, baseline: [], matters: [] };
	for ( const d of dists ) out.baseline.push( await measure( greyCube.position, d ) );
	for ( const c of lit ) {

		const ms = [];
		for ( const d of dists ) ms.push( await measure( c.mesh.position, d ) );
		out.matters.push( { name: c.name, family: c.preset.family, ms } );

	}

	// The whole wall from above.
	camera.position.set( center.x, 9, 7 );
	camera.lookAt( center.x, 0, center.z + 3 );
	out.wall = await median();
	out.timer = gpuTimer ? 'gpu timestamps' : 'wall + readback';
	renderer.setRenderTarget( null );
	camera.layers.disable( HAIR_LAYER );
	rt.dispose();
	camera.aspect = aspect;
	camera.updateProjectionMatrix();
	return out;

};
