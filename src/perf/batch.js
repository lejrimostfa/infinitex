// Fewer draws for a game scene built of copies and parts (infinitex/perf).
// A draw costs CPU time to submit, and every pass draws it again: the main
// pass, each sun cascade, each mirror or probe. On the paper beach 280
// palms of 2 parts were 560 draws in each of 5 passes.
//
//   createInstances( source, parent )
//            many copies of one object (a tree, a torch, a rock) in one
//            draw per part. add( stand ) takes an Object3D placed as the
//            copy would be (position, rotation, scale, visible); the game
//            moves the stand-ins as before, then calls sync() once a frame,
//            before drawing. A hidden stand-in draws nothing (zero matrix).
//            Raycasts and the camera kit's collider hit the instances.
//   skinParts( root )
//            an object made of parts that move on their own (a crab's legs,
//            a door, a wheel) as one skinned mesh: each part becomes a bone
//            with the part's name and transform. Code that turns a part by
//            name turns the bone instead. All parts must share one parent
//            and one material. Returns the mesh, or null when it cannot.
//
// Both keep the image: checked pixel by pixel on the beach (palms, torches,
// rocks, shells, the crab walking).
//
// Event bus: none (the game calls sync() in its frame).

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createInstances( source, parent ) {

	source.updateMatrixWorld( true );
	const inv = source.matrixWorld.clone().invert();
	const parts = [];
	source.traverse( ( o ) => { if ( o.isMesh ) parts.push( { src: o, rel: inv.clone().multiply( o.matrixWorld ) } ); } );
	const stands = [], meshes = [];
	const m = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale( 0, 0, 0 );

	function sync() {

		for ( const o of stands ) o.updateMatrix();
		parts.forEach( ( p, k ) => {

			const im = meshes[ k ];
			if ( ! im ) return;
			stands.forEach( ( o, i ) => im.setMatrixAt( i, o.visible ? m.multiplyMatrices( o.matrix, p.rel ) : zero ) );
			im.instanceMatrix.needsUpdate = true;

		} );

	}

	// After the last add(): one InstancedMesh per part, in parent.
	function build( { margin = 2 } = {} ) {

		for ( const p of parts ) {

			const im = new THREE.InstancedMesh( p.src.geometry, p.src.material, stands.length );
			im.name = source.name + ':' + p.src.name;
			im.castShadow = p.src.castShadow;
			im.receiveShadow = p.src.receiveShadow;
			parent.add( im );
			meshes.push( im );

		}

		sync();
		// The bound of all copies, with room for a small sway (margin, m).
		for ( const im of meshes ) { im.computeBoundingSphere(); im.boundingSphere.radius += margin; }

	}

	function add( stand = new THREE.Object3D() ) {

		if ( ! stand.parent ) parent.add( stand );
		stands.push( stand );
		return stand;

	}

	return { add, build, sync, meshes, stands };

}

export function skinParts( root ) {

	root.updateMatrixWorld( true );
	const meshes = [];
	root.traverse( ( o ) => { if ( o.isMesh ) meshes.push( o ); } );
	const holder = meshes[ 0 ]?.parent;
	if ( meshes.length < 2 || meshes.some( ( m ) => m.parent !== holder || m.material !== meshes[ 0 ].material || m.isSkinnedMesh || m.isInstancedMesh ) ) return null;
	const inv = holder.matrixWorld.clone().invert();
	const bones = [], geos = [];
	meshes.forEach( ( m, i ) => {

		const bone = new THREE.Bone();
		bone.name = m.name;
		bone.position.copy( m.position );
		bone.quaternion.copy( m.quaternion );
		bone.scale.copy( m.scale );
		bones.push( bone );
		const g = m.geometry.clone().applyMatrix4( inv.clone().multiply( m.matrixWorld ) ); // into the holder's space
		const n = g.attributes.position.count;
		const idx = new Uint16Array( n * 4 ), w = new Float32Array( n * 4 );
		for ( let k = 0; k < n; k ++ ) { idx[ k * 4 ] = i; w[ k * 4 ] = 1; }
		g.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( idx, 4 ) );
		g.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( w, 4 ) );
		geos.push( g );

	} );
	const merged = mergeGeometries( geos );
	if ( ! merged ) return null; // parts with different attributes
	const skinned = new THREE.SkinnedMesh( merged, meshes[ 0 ].material );
	skinned.name = holder.name + ':skinned';
	skinned.castShadow = meshes[ 0 ].castShadow;
	skinned.receiveShadow = meshes[ 0 ].receiveShadow;
	for ( const m of meshes ) m.removeFromParent();
	for ( const b of bones ) holder.add( b );
	holder.add( skinned );
	holder.updateMatrixWorld( true );
	skinned.bind( new THREE.Skeleton( bones ), skinned.matrixWorld );
	return skinned;

}
