// Distance to the first solid surface along a ray, for the walk camera
// (walk.js) and the focus of the lens (lens.js), which share one collider.
// A plain three.js raycast tests every triangle of a mesh: 52 ms per frame
// in front of the knit character (115 000 triangles). Here each solid mesh
// gets a BVH (three-mesh-bvh), so a cast only opens the boxes along the ray
// (about 0.02 ms).
//   static mesh   one MeshBVH, indirect: true so the drawn geometry is never
//                 reordered.
//   skinned mesh  one BVH per bone, posed by the bone's matrix, plus an
//                 exact posed test within 5 cm (skinned.js).
// Trees are built in idle time after the page loads, one mesh per slot, so
// the first key press does not pay for them. Meshes added later are built
// on first use.
// Skipped: invisible meshes, noFocus meshes (a water surface) and GPU-moved
// meshes (fuzz, hair), whose CPU geometry is not what is drawn.
// Event bus: none, a pure query called by walk.js and lens.js. After a
// call, surfaceAhead.object is the mesh that was hit (or null).

import * as THREE from 'three/webgpu';
import { MeshBVH } from 'three-mesh-bvh';
import { boneTrees, boneMatrix, exactSkinned, NEAR } from './skinned.js';

const SKIN_PAD = 1.25; // a skinned bounding sphere is computed once; the pose may leave it

export function createCollider( scene, camera ) {

	const ray = new THREE.Raycaster();
	ray.firstHitOnly = true;
	ray.camera = camera;
	const trees = new WeakMap(); // mesh -> { geometry, bvh } or { geometry, bones }
	const hits = [];
	const sphere = new THREE.Sphere();
	const solid = ( o ) => o.isMesh && ! o.userData.noFocus && ! [ o.material ].flat().some( ( m ) => m?.positionNode );

	function treeOf( mesh ) {

		let t = trees.get( mesh );
		if ( t && t.geometry === mesh.geometry ) return t; // a swapped geometry gets new trees
		t = mesh.isSkinnedMesh
			? { geometry: mesh.geometry, bones: boneTrees( mesh ) }
			: { geometry: mesh.geometry, bvh: new MeshBVH( mesh.geometry, { indirect: true } ) };
		trees.set( mesh, t );
		return t;

	}

	function boundsOf( o ) {

		if ( o.isSkinnedMesh || o.isInstancedMesh ) {

			if ( ! o.boundingSphere ) o.computeBoundingSphere();
			sphere.copy( o.boundingSphere );
			if ( o.isSkinnedMesh ) sphere.radius *= SKIN_PAD;

		} else {

			if ( ! o.geometry.boundingSphere ) o.geometry.computeBoundingSphere();
			sphere.copy( o.geometry.boundingSphere );

		}

		return sphere.applyMatrix4( o.matrixWorld );

	}

	const idle = globalThis.requestIdleCallback ?? ( ( f ) => setTimeout( f, 50 ) );
	setTimeout( () => {

		const queue = [];
		scene.traverseVisible( ( o ) => { if ( solid( o ) && ! o.isInstancedMesh ) queue.push( o ); } );
		const next = () => { const o = queue.shift(); if ( ! o ) return; treeOf( o ); idle( next ); };
		idle( next );

	}, 1000 );

	// Distance from origin along unit dir to the nearest solid surface, up to far.
	function surfaceAhead( origin, dir, far ) {

		ray.set( origin, dir );
		ray.near = 0;
		ray.far = far;
		let best = Infinity, bestObject = null;
		const keep = ( d, o ) => { if ( d < best ) { best = d; bestObject = o; } };
		scene.traverseVisible( ( o ) => {

			if ( ! solid( o ) ) return;
			boundsOf( o );
			if ( ! ray.ray.intersectsSphere( sphere ) ) return;
			if ( origin.distanceTo( sphere.center ) - sphere.radius > Math.min( best, far ) ) return;
			if ( o.isInstancedMesh ) {

				o.raycast( ray, hits ); // rare here; three's own test

			} else {

				const t = treeOf( o );
				if ( t.bvh ) t.bvh.raycastObject3D( o, ray, hits );
				else {

					// Rigid copies give the distance beyond NEAR; inside NEAR only the
					// exact test counts. No exact hit there means the surface is at
					// least NEAR away, so NEAR is a safe answer.
					let rigid = Infinity;
					for ( const { bone, bvh, part } of t.bones ) {

						boneMatrix( o, bone, part.matrixWorld );
						bvh.raycastObject3D( part, ray, hits );

					}

					for ( const h of hits ) rigid = Math.min( rigid, h.distance );
					hits.length = 0;
					const near = Math.min( NEAR, far );
					const exact = exactSkinned( o, t.bones, ray.ray, near ); // cheap when nothing is near
					keep( exact < Infinity ? exact : Math.max( rigid, near ), o );

				}

			}

			for ( const h of hits ) keep( h.distance, o );
			hits.length = 0;

		} );
		surfaceAhead.object = best < Infinity ? bestObject : null;
		return best;

	}

	surfaceAhead.object = null;
	return surfaceAhead;

}
