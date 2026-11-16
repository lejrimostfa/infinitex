// Character demo: a game character whose texture is one atlas, with some
// zones of its clothes turned into procedural matter (built by
// charbuild.js, shared with the living room).
// ?c=<name> picks demo/characters/<name>.js (default: riveraine, the one
// published; the others stay on the author's disk).
// URL flags: ?webgl, ?nofuzz, ?noao, ?film, ?fly (flyover film), ?nofly
// (no mosquito), ?stop=<stop>, ?noknit (original look).
// The tiger mosquito hovers in front of the knit sleeve; V or
// the panel button flies it (flyer.js, flyhud.js).

import * as THREE from 'three/webgpu';
import { buildCharacter } from './charbuild.js';
import { createMosquito } from './vehicles/mosquito.js';
import { createFlyer } from './flyer.js';
import { addFlyHud } from './flyhud.js';
import './nav.js';
import { createStage } from './scene.js';
import { createFilm } from './film.js';
import { createFlyover } from './flyover.js';
import { startApp } from './app.js';
import { addCharacterPicker } from './charpick.js';

const params = new URLSearchParams( location.search );
addCharacterPicker( params.get( 'c' ) ?? 'riveraine' );
const cfg = ( await import( `./characters/${ params.get( 'c' ) ?? 'riveraine' }.js` ) ).default;
const original = params.has( 'noknit' );
document.body.classList.toggle( 'film', params.has( 'film' ) );
const ctx = await createStage( { forceWebGL: params.has( 'webgl' ) } );
const { scene, camera, controls } = ctx;
ctx.updateClip = () => camera.position.distanceTo( controls.target );

const { gltf, body, materials, extras, fuzz, zoneTris, mixer, clip, C, V } = await buildCharacter( { cfg, scene, original, fuzz: ! params.has( 'nofuzz' ) } );

// Film anchor: the zone triangle closest to the stop's goal point.
const stopName = params.get( 'stop' ) ?? cfg.defaultStop;
const stop = cfg.stops[ stopName ];
// stop.ray: shoot from a point in front of the part toward it, so the
// anchor is on the visible outer surface (a nearest-point search can land
// inside a big toon head or on a hidden face).
let anchorMesh = stop.extra !== undefined ? extras[ stop.extra ].mesh : body;
let tri = null, goal = stop.goal ? stop.goal( C, V ) : new THREE.Vector3();
if ( stop.ray ) {

	// The hit point becomes the goal; the anchor is the closest triangle of
	// the zone (the ray may hit hair or a headband first).
	const [ from, to ] = stop.ray( C, V );
	scene.updateMatrixWorld( true );
	// The first surface really hit, whatever the mesh (testing one mesh only
	// went through the face plate and ended inside the mask).
	const cands = stop.extra !== undefined ? extras.map( ( e ) => e.mesh ) : [ body ];
	const hit = new THREE.Raycaster( from, to.clone().sub( from ).normalize() ).intersectObjects( scene.children, true )
		.find( ( h ) => h.object.isMesh && ! h.object.name.endsWith( '_fuzz' ) && ! h.object.isSkinnedMesh === ( stop.extra !== undefined ) );
	if ( hit && cands.includes( hit.object ) ) {

		anchorMesh = hit.object;
		goal = anchorMesh.worldToLocal( hit.point.clone() );

	}

}

const g = anchorMesh.geometry, idx = g.index.array, P = g.attributes.position;
{

	const anchorTris = stop.extra !== undefined ? new Uint8Array( idx.length / 3 ).fill( 1 ) : zoneTris[ stop.zone ];
	let bestT = 0, bestD = Infinity;
	const c = new THREE.Vector3(), v = new THREE.Vector3();
	for ( let t = 0; t < anchorTris.length; t ++ ) {

		if ( ! anchorTris[ t ] ) continue;
		c.set( 0, 0, 0 );
		for ( let k = 0; k < 3; k ++ ) c.add( v.fromBufferAttribute( P, idx[ t * 3 + k ] ) );
		c.divideScalar( 3 );
		const d = c.distanceTo( goal );
		if ( d < bestD ) { bestD = d; bestT = t; }

	}

	tri = [ idx[ bestT * 3 ], idx[ bestT * 3 + 1 ], idx[ bestT * 3 + 2 ] ];

}

// ?fly: the flyover film over every matter of the character (flyover.js).
const film = params.has( 'fly' ) && cfg.flyover ? createFlyover( {
	camera, scene, keys: cfg.flyover.keys, C, V,
	ignore: ( o ) => o.name.endsWith( '_fuzz' ) || o.geometry?.type === 'CircleGeometry',
	targets: [ body, ...extras.map( ( e ) => e.mesh ) ],
} ) : createFilm( {
	camera, scene,
	anchor: { mesh: anchorMesh, tri, uvName: stop.extra !== undefined ? 'ixUV' : 'ixPack', outward: V( ...stop.outward ) },
	// A stop may start from its own far view (a mask is reached from above,
	// not through the helmet).
	farTarget: V( ...( stop.far ?? cfg.far ).target ), farDir: V( ...( stop.far ?? cfg.far ).dir ).normalize(),
	captions: stop.captions,
} );

controls.target.set( ...cfg.view.target );
camera.position.set( ...cfg.view.camera );

// The mosquito, in front of the left knit sleeve, facing it (the leather
// apron covers the chest). Not in the
// films (?film, ?fly): their shots stay as they were.
let vehicle = null;
if ( ! params.has( 'film' ) && ! params.has( 'fly' ) && ! params.has( 'nofly' ) ) {

	const mosquito = createMosquito();
	scene.add( mosquito.group );
	// The upper arm as posed by the idle loop (the bind pose has the arms out).
	mixer.setTime( 0 );
	gltf.scene.updateMatrixWorld( true );
	const at = ( n ) => gltf.scene.getObjectByName( n ).getWorldPosition( new THREE.Vector3() );
	const sleeve = at( 'LeftArm' ).lerp( at( 'LeftForeArm' ), 0.5 );
	vehicle = createFlyer( { vehicle: mosquito, camera, controls, dom: ctx.renderer.domElement,
		home: sleeve.clone().add( V( 0, 0, 0.2 ) ), options: { name: 'mosquito', maxSpeed: 0.15, near: 1.2, turnRate: 1.8 } } );
	vehicle.yaw = Math.PI; // facing the chest
	addFlyHud( vehicle, { label: 'the mosquito' } );

}
const app = startApp( {
	ctx, ix: materials[ 0 ], meshes: [ body ], fuzz, film, params,
	panel: [ ...cfg.zones.map( ( z, k ) => ( { name: z.name, ix: materials[ k ] } ) ), ...extras.map( ( e ) => ( { name: e.name, ix: e.ix } ) ) ],
	animate: ( t ) => mixer.setTime( t % clip.duration ),
	vehicle,
} );
app.materials = materials;
app.leather = materials[ 1 ];
app.extras = extras;
