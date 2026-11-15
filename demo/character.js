// Character demo: a game character whose texture is one atlas (Meshy and
// the like). Some zones of its clothes or skin become procedural matter;
// the atlas gives the colours and the zone masks, each zone gets its own
// triangle group and material (zones.js), the rest keeps the game look.
// ?c=<name> picks demo/characters/<name>.js (default: riveraine).
// Models are not in git (the repo ignores *.glb): see each config.
// URL flags: ?webgl, ?nofuzz, ?noao, ?film, ?stop=<stop>, ?noknit (original look).

import * as THREE from 'three/webgpu';
import { attribute, uv, smoothstep } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createMaterial } from '../src/index.js';
import { baseFromStandard } from '../src/core/basematerial.js';
import { projectKnitCoords, partCentroid } from '../src/tools/knitCoords.js';
import { rigidCoords } from '../src/tools/rigidCoords.js';
import { float } from 'three/tsl';
import { atlasZones, groupByZone } from './zones.js';
import { createStage } from './scene.js';
import { createFilm } from './film.js';
import { createFlyover } from './flyover.js';
import { startApp } from './app.js';

const params = new URLSearchParams( location.search );
const cfg = ( await import( `./characters/${ params.get( 'c' ) ?? 'riveraine' }.js` ) ).default;
const original = params.has( 'noknit' );
document.body.classList.toggle( 'film', params.has( 'film' ) );
const ctx = await createStage( { forceWebGL: params.has( 'webgl' ) } );
const { scene, camera, controls } = ctx;
ctx.updateClip = () => camera.position.distanceTo( controls.target );

const gltf = await new GLTFLoader().loadAsync( cfg.model );
scene.add( gltf.scene );
gltf.scene.traverse( ( o ) => { if ( o.isMesh ) o.frustumCulled = false; } );
const mixer = new THREE.AnimationMixer( gltf.scene );
const clip = gltf.animations.find( ( a ) => a.name === cfg.idle ) ?? gltf.animations[ 0 ];
mixer.clipAction( clip ).play();

let body = null;
gltf.scene.traverse( ( o ) => { if ( ! body && cfg.body( o ) ) body = o; } );
const base = body.material;
const V = ( x, y, z ) => new THREE.Vector3( x, y, z );
const C = ( ...n ) => partCentroid( body, n );

const zones = atlasZones( base.map.image, cfg.zones );
if ( ! original ) projectKnitCoords( body, { regions: cfg.regions( C, V ), garment: zones.union } );
const zoneTris = original ? cfg.zones.map( () => new Uint8Array( 0 ) ) : groupByZone( body.geometry, zones.masks );

// WebGPU allows 8 vertex buffers per pipeline. Skinning, normal, tangent,
// uv and the atlas rotation already take 7: pack the knit coordinates and
// up to two zone weights into one vec4, ixPack = ( u, v, zone 0, zone 1 ).
if ( ! original ) {

	const g = body.geometry, n = g.attributes.position.count, packed = new Float32Array( n * 4 );
	for ( let i = 0; i < n; i ++ ) {

		packed[ i * 4 ] = g.attributes.ixUV.getX( i );
		packed[ i * 4 + 1 ] = g.attributes.ixUV.getY( i );
		packed[ i * 4 + 2 ] = g.attributes.ixZone0?.getX( i ) ?? 0;
		packed[ i * 4 + 3 ] = g.attributes.ixZone1?.getX( i ) ?? 0;

	}

	g.setAttribute( 'ixPack', new THREE.BufferAttribute( packed, 4 ) );
	for ( const a of [ 'ixUV', 'ixZone0', 'ixZone1' ] ) if ( g.attributes[ a ] ) g.deleteAttribute( a );

}

const pack = attribute( 'ixPack', 'vec4' );
const baseNodes = baseFromStandard( base, original ? {} : { atlasRot: attribute( 'ixAtlasRot', 'vec3' ) } );
const materials = cfg.zones.map( ( z, k ) => createMaterial( z.preset, {
	coords: pack.xy,
	colorMap: { map: base.map, uv: uv() },
	mask: smoothstep( 0.25, 0.75, k === 0 ? pack.z : pack.w ),
	base: baseNodes,
} ) );
// Everything else keeps the game look, as nodes (the knit tangents would
// bend the original normal map).
const plain = new THREE.MeshStandardNodeMaterial();
Object.assign( plain, { colorNode: baseNodes.color, normalNode: baseNodes.normal, roughnessNode: baseNodes.roughness, metalnessNode: baseNodes.metalness } );
if ( baseNodes.emissive ) plain.emissiveNode = baseNodes.emissive;
let fuzz = [];
if ( ! original ) {

	body.material = [ ...materials.map( ( m ) => m.material ), plain ];
	if ( ! params.has( 'nofuzz' ) ) fuzz = cfg.zones.flatMap( ( z, k ) => z.fuzz ? [ materials[ k ].createFuzz( body, { triangles: zoneTris[ k ] } ) ] : [] );

}

// Rigid extras (mask parts, a rope), found by material name: own metric
// coordinates, one family each, the game material as the base.
const extras = ( original ? [] : cfg.extras ?? [] ).map( ( ex ) => {

	let mesh = null;
	gltf.scene.traverse( ( o ) => { if ( ! mesh && o.isMesh && ! o.isSkinnedMesh && o.material.name === ex.material ) mesh = o; } );
	const old = mesh.material;
	rigidCoords( mesh, { axis: V( 0, 0, 1 ), uvScale: ex.uvScale ?? null } );
	const ix = createMaterial( ex.preset, {
		coords: attribute( 'ixUV', 'vec2' ),
		colorMap: old.map ? { map: old.map, uv: uv() } : null,
		mask: float( 1 ),
		base: baseFromStandard( old ),
	} );
	mesh.material = ix.material;
	if ( ex.fuzz && ! params.has( 'nofuzz' ) ) fuzz.push( ix.createFuzz( mesh ) );
	return { mesh, ix, name: ex.name };

} );

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
const app = startApp( {
	ctx, ix: materials[ 0 ], meshes: [ body ], fuzz, film, params,
	panel: [ ...cfg.zones.map( ( z, k ) => ( { name: z.name, ix: materials[ k ] } ) ), ...extras.map( ( e ) => ( { name: e.name, ix: e.ix } ) ) ],
	animate: ( t ) => mixer.setTime( t % clip.duration ),
} );
app.materials = materials;
app.leather = materials[ 1 ];
app.extras = extras;
