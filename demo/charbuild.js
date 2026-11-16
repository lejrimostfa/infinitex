// A game character whose texture is one atlas (Meshy and the like), with
// some zones of its clothes or skin turned into procedural matter: the
// atlas gives the colours and the zone masks, each zone gets its own
// triangle group and material (zones.js), the rest keeps the game look.
// Rigid extras (a mask, a rope) get one family each. Used by the
// character page (character.js) and the living room (livingroom.js).
//   buildCharacter( { cfg, scene, original, fuzz } )
//     cfg       demo/characters/<name>.js
//     original  true: the game look only (no matter)
//     fuzz      false: no fuzz shells
//   returns { gltf, body, materials, extras, fuzz, zoneTris, mixer, clip, C, V }
// Built at the origin (the knit coordinates follow the bones); the caller
// may move gltf.scene afterwards.
// Event bus: none (each material is an EventTarget, see src/index.js).

import * as THREE from 'three/webgpu';
import { attribute, uv, smoothstep, positionGeometry, float } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createMaterial } from '../src/index.js';
import { baseFromStandard } from '../src/core/basematerial.js';
import { projectKnitCoords, partCentroid } from '../src/tools/knitCoords.js';
import { rigidCoords } from '../src/tools/rigidCoords.js';
import { atlasZones, groupByZone } from './zones.js';

// Area-weighted normals shared by every vertex at one position: a noisy
// remeshed export otherwise lights as triangle facets.
function smoothNormals( g ) {

	const P = g.attributes.position, N = g.attributes.normal, idx = g.index.array;
	const key = ( i ) => `${ P.getX( i ).toFixed( 4 ) },${ P.getY( i ).toFixed( 4 ) },${ P.getZ( i ).toFixed( 4 ) }`;
	const sum = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
	for ( let t = 0; t < idx.length; t += 3 ) {

		a.fromBufferAttribute( P, idx[ t ] ); b.fromBufferAttribute( P, idx[ t + 1 ] ); c.fromBufferAttribute( P, idx[ t + 2 ] );
		const n = c.sub( b ).cross( a.sub( b ) ); // length = twice the area
		for ( let k = 0; k < 3; k ++ ) {

			const s = key( idx[ t + k ] );
			if ( ! sum.has( s ) ) sum.set( s, new THREE.Vector3() );
			sum.get( s ).add( n );

		}

	}

	for ( let i = 0; i < P.count; i ++ ) {

		const n = sum.get( key( i ) );
		if ( n ) { n.normalize(); N.setXYZ( i, n.x, n.y, n.z ); }

	}

	N.needsUpdate = true;

}

export async function buildCharacter( { cfg, scene, original = false, fuzz: withFuzz = true } ) {

	const gltf = await new GLTFLoader().loadAsync( cfg.model );
	scene.add( gltf.scene );
	gltf.scene.traverse( ( o ) => { if ( o.isMesh ) o.frustumCulled = false; } );
	const mixer = new THREE.AnimationMixer( gltf.scene );
	const clip = gltf.animations.find( ( a ) => a.name === cfg.idle ) ?? gltf.animations[ 0 ];
	mixer.clipAction( clip ).play();

	let body = null;
	gltf.scene.traverse( ( o ) => { if ( ! body && cfg.body( o ) ) body = o; } );
	const base = body.material;
	// A broken export (UVs squeezed into a strip) has a normal map that only
	// draws triangle facets: the config can drop it.
	if ( cfg.dropNormalMap ) base.normalMap = null;
	if ( cfg.smoothNormals ) smoothNormals( body.geometry );
	const V = ( x, y, z ) => new THREE.Vector3( x, y, z );
	const C = ( ...n ) => partCentroid( body, n );

	const zones = atlasZones( base.map.image, cfg.zones );
	if ( ! original ) projectKnitCoords( body, { regions: cfg.regions( C, V ), garment: zones.union } );
	const zoneTris = original ? cfg.zones.map( () => new Uint8Array( 0 ) ) : groupByZone( body.geometry, zones.masks, { where: cfg.zones.map( ( z ) => z.where ) } );

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
	// zone.inner: a second matter inside the zone, drawn per pixel where
	// inner.mask( positionGeometry ) is 1 (leather edging on a coat, cut on
	// the rest shape so its borders are straight, not the mesh triangles).
	// It becomes the base the zone's family blends over.
	// The zone's own soft border (a fade to the game look) is dropped then:
	// its triangles draw the two matters only.
	const inner = ( z, m ) => z.inner ? float( 1 ).sub( z.inner.mask( positionGeometry ) ) : m;
	const innerBase = ( spec ) => {

		const n = createMaterial( spec.preset, { coords: pack.xy } ).material;
		return { color: n.colorNode, normal: n.normalNode, roughness: n.roughnessNode, metalness: n.metalnessNode ?? float( 0 ), under: false };

	};
	const materials = cfg.zones.map( ( z, k ) => createMaterial( z.preset, {
		coords: pack.xy,
		// ownColor: the zone keeps its preset colours (a broken atlas only
		// gives flat triangles of colour).
		colorMap: z.ownColor ? null : { map: base.map, uv: uv() },
		mask: inner( z, smoothstep( 0.25, 0.75, k === 0 ? pack.z : pack.w ) ),
		base: z.inner ? innerBase( z.inner ) : baseNodes,
	} ) );
	// Everything else keeps the game look, as nodes (the knit tangents would
	// bend the original normal map).
	const plain = new THREE.MeshStandardNodeMaterial();
	Object.assign( plain, { colorNode: baseNodes.color, normalNode: baseNodes.normal, roughnessNode: baseNodes.roughness, metalnessNode: baseNodes.metalness } );
	if ( baseNodes.emissive ) plain.emissiveNode = baseNodes.emissive;
	let fuzz = [];
	if ( ! original ) {

		body.material = [ ...materials.map( ( m ) => m.material ), plain ];
		if ( withFuzz ) fuzz = cfg.zones.flatMap( ( z, k ) => z.fuzz ? [ materials[ k ].createFuzz( body, { triangles: zoneTris[ k ] } ) ] : [] );

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
		if ( ex.fuzz && withFuzz ) fuzz.push( ix.createFuzz( mesh ) );
		return { mesh, ix, name: ex.name };

	} );


	return { gltf, body, materials, extras, fuzz, zoneTris, mixer, clip, C, V };

}
