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

const PAD_REACH = 0.5; // m: pad / cos of a displaced surface, at most (37 cm for 3.7 cm at cos 0.1)

const SKIN_PAD = 1.25; // a skinned bounding sphere is computed once; the pose may leave it

export function createCollider( scene, camera ) {

	const ray = new THREE.Raycaster();
	ray.firstHitOnly = true;
	ray.camera = camera;
	const trees = new WeakMap(); // mesh -> { geometry, bvh } or { geometry, bones }
	const hits = [];
	const normal = new THREE.Vector3();
	const sphere = new THREE.Sphere();
	// GPU-moved meshes are skipped (fuzz, hair, a water surface), except a
	// displaced surface that bounds its height (preset.displace, index.js):
	// its flat CPU mesh counts, padded by that bound (padOf).
	const padOf = ( o ) => [ o.material ].flat()[ 0 ]?.userData?.ixDisplaceMax?.() ?? 0;
	const solid = ( o ) => o.isMesh && ! o.userData.noFocus && [ o.material ].flat().every( ( m ) => ! m?.positionNode || m.userData?.ixDisplaceMax );

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
		// A displaced surface counts from up to PAD_REACH before its flat mesh.
		ray.far = far + PAD_REACH;
		let best = Infinity, bestObject = null, bestHit = null;
		const keep = ( d, o, hit = null ) => { if ( d < best && d <= far ) { best = d; bestObject = o; bestHit = hit; } };
		scene.traverseVisible( ( o ) => {

			if ( ! solid( o ) ) return;
			boundsOf( o );
			if ( ! ray.ray.intersectsSphere( sphere ) ) return;
			if ( origin.distanceTo( sphere.center ) - sphere.radius > Math.min( best, far ) + PAD_REACH ) return;
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

			// A displaced surface rises up to pad above its flat mesh, so the
			// distance shrinks by pad over the cosine of the incidence.
			const pad = padOf( o );
			for ( const h of hits ) {

				const cos = pad && h.face ? Math.max( Math.abs( dir.dot( normal.copy( h.face.normal ).transformDirection( h.object.matrixWorld ) ) ), 0.1 ) : 1;
				keep( Math.max( 0, h.distance - pad / cos ), o, h );

			}

			hits.length = 0;

		} );
		surfaceAhead.object = best < Infinity ? bestObject : null;
		// World normal of the hit face, or null (skinned meshes: not tracked).
		surfaceAhead.normal = bestHit?.face ? normal.copy( bestHit.face.normal ).transformDirection( bestHit.object.matrixWorld ) : null;
		return best;

	}

	surfaceAhead.object = null;
	surfaceAhead.normal = null;
	return surfaceAhead;

}
