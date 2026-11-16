// Distance to the nearest solid surface in any direction, the second query
// of the collider (collide.js), for walk.js. The ray of collide.js only
// sees what lies along the move, so a strafe over the floor or along a
// wall needs this one to slow down. It uses the collider's own trees
// (BVH closest point), bounds, solid test and pads:
//   static mesh   one closest-point search in the mesh's local space.
//   skinned mesh  the rigid bone copies, a few mm off at the joints: fine
//                 for a speed limit.
//   displaced     its flat mesh minus its pad, as the ray does.
// Instanced meshes are skipped.
// Event bus: none, a pure query. After a call, near.point is the nearest
// surface point (or null).

import * as THREE from 'three/webgpu';

import { boneMatrix } from './skinned.js';

// scene: the collider's scene. solid, padOf, boundsOf, treeOf: the
// collider's helpers; boundsOf writes the world bounding sphere into sphere.
export function createNearest( { scene, solid, padOf, boundsOf, treeOf, sphere } ) {

	// Nearest point of one BVH to point (world), if closer than best (world).
	// The search runs in the mesh's local space: a local distance L is at
	// least L * smallest scale in the world, which sets the local cut-off.
	const inv = new THREE.Matrix4(), local = new THREE.Vector3(), axis = new THREE.Vector3(), at = new THREE.Vector3(), found = {};
	function closest( bvh, matrix, point, best, pad ) {

		let s = Infinity;
		for ( let i = 0; i < 3; i ++ ) s = Math.min( s, axis.setFromMatrixColumn( matrix, i ).length() );
		if ( ! ( s > 0 ) ) return best;
		local.copy( point ).applyMatrix4( inv.copy( matrix ).invert() );
		if ( ! bvh.closestPointToPoint( local, found, 0, ( best + pad ) / s ) ) return best;
		found.point.applyMatrix4( matrix );
		const d = Math.max( 0, found.point.distanceTo( point ) - pad );
		if ( d < best ) at.copy( found.point );
		return Math.min( d, best );

	}

	// Distance from point to the nearest solid surface in any direction, up to
	// far, skipping the mesh skip (walk.js: the one the move ray hit, which
	// the ray already handles).
	function near( point, far, skip = null ) {

		let best = far;
		scene.traverseVisible( ( o ) => {

			if ( o === skip || ! solid( o ) || o.isInstancedMesh ) return;
			boundsOf( o );
			const pad = padOf( o );
			if ( point.distanceTo( sphere.center ) - sphere.radius - pad >= best ) return;
			const t = treeOf( o );
			if ( t.bvh ) best = closest( t.bvh, o.matrixWorld, point, best, pad );
			else for ( const { bone, bvh, part } of t.bones ) {

				boneMatrix( o, bone, part.matrixWorld );
				best = closest( bvh, part.matrixWorld, point, best, pad );

			}

		} );
		near.point = best < far ? at : null;
		return best < far ? best : Infinity;

	}

	near.point = null;
	return near;

}
