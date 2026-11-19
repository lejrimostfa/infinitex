// The folded paper props of the beach (demo/beach.js). Each GLB is a
// papercraft model folded in Blender from a painted dieline (repo
// testingBlenderMCP, assets/generated/paper_beach_01, synced into
// demo/assets/beach with props.json). Here each mesh gets Infinitex paper:
// the fibermat family as paper (fibres, flocs, pores when the eye comes
// close), its colour multiplied by the painting, its scale from the
// atlas (metersPerUV: one UV unit in metres on the folded sheet).
//   cut-outs  a painting with alpha (leaf cards) keeps its holes
//             (alphaTest) and both sides
//   water     every prop is a matter under the water too (underwater: 1),
//             so pier posts and the canoe's hull take the lagoon's colour
// loadProps() -> { name: { scene (THREE.Group), meta } }, one load per GLB;
// place() clones a prop at x, z on the ground, turned by yaw.
//
// Event bus: none (built once by the page).

import * as THREE from 'three/webgpu';
import { uv, texture, float, vec3 } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createInstances } from '../../src/perf/batch.js';
import { createMaterial } from '../../src/index.js';

// Every file of demo/assets/beach, resolved by Vite (dev and build): a
// directory URL built with new URL( ..., import.meta.url ) is rewritten by
// Vite and broke.
const FILES = import.meta.glob( '../assets/beach/*.{glb,json,png}', { query: '?url', import: 'default', eager: true } );
export const fileURL = ( f ) => FILES[ '../assets/beach/' + f ];

// Paper: straight flat fibres, low contrast, a cloudy formation.
const PAPER = { family: 'fibermat', intent: 'paper', color: '#ffffff', color2: '#f4f1ea', color_variation: 0.04, fiber_um: 25, fiber_mm: 2, curl: 0.1, flatten: 0.1, contrast: 0.35, density: 1, formation: 0.35, formation_mm: 6, lumps: 0.05, roughness: 0.85, sheen: 0.15, underwater: 1 };

function paperize( mesh, meta, cache ) {

	const src = mesh.material;
	const map = src.map;
	const cut = !! ( map && ( src.transparent || src.alphaTest > 0 || meta.opaque === false ) );
	const key = ( map?.uuid ?? 'plain' ) + cut;
	if ( ! cache.has( key ) ) {

		const ix = createMaterial( PAPER, { coords: uv().mul( meta.metersPerUV ) } );
		const m = ix.material;
		if ( map ) {

			map.colorSpace = THREE.SRGBColorSpace;
			const t = texture( map, uv() );
			m.colorNode = m.colorNode.mul( t.rgb );
			if ( cut ) { m.opacityNode = t.a; m.alphaTest = 0.5; m.side = THREE.DoubleSide; }

		} else m.colorNode = m.colorNode.mul( vec3( src.color?.r ?? 1, src.color?.g ?? 1, src.color?.b ?? 1 ) );
		// The painted relief of finish.py (maps.py): its AO darkens the folds' insides.
		if ( src.aoMap ) m.colorNode = m.colorNode.mul( float( 0.35 ).add( texture( src.aoMap, uv() ).r.mul( 0.65 ) ) );
		cache.set( key, m );

	}

	mesh.material = cache.get( key );
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	if ( ! mesh.geometry.attributes.tangent && mesh.geometry.index ) mesh.geometry.computeTangents();

}

export async function loadProps( names = null ) {

	const meta = await ( await fetch( fileURL( 'props.json' ) ) ).json();
	const loader = new GLTFLoader();
	const out = {};
	await Promise.all( Object.entries( meta ).filter( ( [ n ] ) => ! names || names.includes( n ) ).map( async ( [ name, m ] ) => {

		const gltf = await loader.loadAsync( fileURL( m.file ) );
		const cache = new Map();
		gltf.scene.traverse( ( o ) => { if ( o.isMesh ) paperize( o, m, cache ); } );
		out[ name ] = { scene: gltf.scene, meta: m, animations: gltf.animations };

	} ) );
	return out;

}

// A copy of a prop standing on the ground at x, z (height from ground( x, z )),
// turned by yaw (radians), scaled by s. Shares geometry and materials.
export function place( prop, parent, entry ) {

	const { x, z, yaw = 0, s = 1, y = null, ground } = entry;

	const o = prop.scene.clone( true );
	o.position.set( x, y ?? ground( x, z ), z );
	o.rotation.y = yaw;
	o.scale.setScalar( s );
	o.userData.entry = entry; // the layout entry (beach/life.js reads its name)
	parent.add( o );
	return o;

}

// Many copies of one prop in one draw per part (infinitex/perf
// createInstances): add( entry ) returns an empty stand-in placed like
// place() does, which beach/life.js moves as before; sync() once a frame.
export function instanced( prop, parent ) {

	const batch = createInstances( prop.scene, parent );
	const empty = { scene: new THREE.Group() };
	return { ...batch, add: ( entry ) => batch.add( place( empty, parent, entry ) ) };

}
