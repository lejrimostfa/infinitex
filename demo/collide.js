// Distance to the first solid surface along a ray, for the walk camera
// (walk.js). A plain three.js raycast tests every triangle of a mesh: 52 ms
// per frame in front of the knit character (115 000 triangles). Here each
// solid mesh gets a BVH (three-mesh-bvh), so a cast only opens the boxes
// along the ray (about 0.02 ms).
//   static mesh   one MeshBVH, indirect: true so the drawn geometry is never
//                 reordered.
//   skinned mesh  the pose changes every frame, and a refit costs 25 ms or
//                 more. So one BVH per bone instead, over the triangles that
//                 bone moves (skin weight >= WMIN at one of their corners).
//                 A bone moves its triangles rigidly, so the trees never
//                 change: each cast just uses the bone's current matrix.
//                 Exact where one bone drives a vertex; at the joints the
//                 surface is a blend of the rigid copies, a few mm off.
// Trees are built in idle time after the page loads, one mesh per slot, so
// the first key press does not pay for them. Meshes added later are built
// on first use.
// Skipped: invisible meshes, noFocus meshes (a water surface) and GPU-moved
// meshes (fuzz, hair), whose CPU geometry is not what is drawn.
// Event bus: none, a pure query called by walk.js.

import * as THREE from 'three/webgpu';
import { MeshBVH } from 'three-mesh-bvh';

const WMIN = 0.1; // skin weight that puts a triangle in a bone's tree
const SKIN_PAD = 1.25; // a skinned bounding sphere is computed once; the pose may leave it
const NEAR = 0.05; // m: inside this range a skinned mesh is tested exactly
const TOL = 0.03; // m: largest gap between a rigid bone copy and the skinned surface

// One tree per bone: { bone, bvh, part } where part is { matrixWorld, material }.
function boneTrees( mesh ) {

	const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
	const index = g.index?.array, tris = ( index ? index.length : g.attributes.position.count ) / 3;
	const vi = ( k ) => index ? index[ k ] : k;
	const lists = new Map(), seen = new Set();
	for ( let t = 0; t < tris; t ++ ) {

		seen.clear();
		for ( let c = 0; c < 3; c ++ ) {

			const v = vi( 3 * t + c );
			for ( let j = 0; j < si.itemSize; j ++ ) if ( sw.getComponent( v, j ) >= WMIN ) seen.add( si.getComponent( v, j ) );

		}

		for ( const b of seen ) {

			if ( ! lists.has( b ) ) lists.set( b, [] );
			lists.get( b ).push( vi( 3 * t ), vi( 3 * t + 1 ), vi( 3 * t + 2 ) );

		}

	}

	const material = { side: [ mesh.material ].flat()[ 0 ].side };
	return [ ...lists ].map( ( [ bone, list ] ) => {

		const sub = new THREE.BufferGeometry(); // shares the positions, own index
		sub.setAttribute( 'position', g.attributes.position );
		sub.setIndex( list );
		return { bone, bvh: new MeshBVH( sub ), part: { matrixWorld: new THREE.Matrix4(), material } };

	} );

}

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

	// World matrix of the rigid copy that bone b moves, as three skins it:
	// matrixWorld * bindMatrixInverse * boneWorld * boneInverse * bindMatrix.
	function boneMatrix( mesh, b, target ) {

		const sk = mesh.skeleton;
		return target.multiplyMatrices( mesh.matrixWorld, mesh.bindMatrixInverse )
			.multiply( sk.bones[ b ].matrixWorld ).multiply( sk.boneInverses[ b ] ).multiply( mesh.bindMatrix );

	}

	// Exact distance to a skinned mesh within reach (world units), or Infinity.
	// The bone trees pick the candidate triangles: boxes grown by TOL, which
	// covers the joint error of the rigid copies. Each candidate is then posed
	// the way three skins it (getVertexPosition) and tested against the ray.
	const local = new THREE.Ray(), inv = new THREE.Matrix4(), grown = new THREE.Box3();
	const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), at = new THREE.Vector3();
	function exactSkinned( mesh, bones, reach ) {

		const side = [ mesh.material ].flat()[ 0 ].side;
		const cache = new Map(); // a vertex is shared by about six triangles: pose it once
		const posed = ( i, v ) => {

			let p = cache.get( i );
			if ( ! p ) cache.set( i, p = mesh.getVertexPosition( i, new THREE.Vector3() ).applyMatrix4( mesh.matrixWorld ) );
			return v.copy( p );

		};
		let best = Infinity;
		for ( const { bone, bvh } of bones ) {

			boneMatrix( mesh, bone, inv ).invert();
			local.copy( ray.ray ).applyMatrix4( inv );
			const k = 1 / inv.getMaxScaleOnAxis(); // world length per local unit
			const reachL = reach / k, tolL = TOL / k;
			const idx = bvh.geometry.index.array;
			bvh.shapecast( {
				intersectsBounds: ( box ) => {

					grown.copy( box ).expandByScalar( tolL );
					if ( grown.containsPoint( local.origin ) ) return true;
					return local.intersectBox( grown, at ) !== null && at.distanceTo( local.origin ) <= reachL;

				},
				intersectsTriangle: ( tri, i ) => {

					posed( idx[ 3 * i ], pa ); posed( idx[ 3 * i + 1 ], pb ); posed( idx[ 3 * i + 2 ], pc );
					const hit = side === THREE.BackSide
						? ray.ray.intersectTriangle( pc, pb, pa, true, at )
						: ray.ray.intersectTriangle( pa, pb, pc, side === THREE.FrontSide, at );
					if ( hit ) best = Math.min( best, at.distanceTo( ray.ray.origin ) );
					return false;

				},
			} );

		}

		return best <= reach ? best : Infinity;

	}

	const idle = globalThis.requestIdleCallback ?? ( ( f ) => setTimeout( f, 50 ) );
	setTimeout( () => {

		const queue = [];
		scene.traverseVisible( ( o ) => { if ( solid( o ) && ! o.isInstancedMesh ) queue.push( o ); } );
		const next = () => { const o = queue.shift(); if ( ! o ) return; treeOf( o ); idle( next ); };
		idle( next );

	}, 1000 );

	// Distance from origin along unit dir to the nearest solid surface, up to far.
	return function surfaceAhead( origin, dir, far ) {

		ray.set( origin, dir );
		ray.near = 0;
		ray.far = far;
		let best = Infinity;
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
					const exact = exactSkinned( o, t.bones, near ); // cheap when nothing is near
					best = Math.min( best, exact < Infinity ? exact : Math.max( rigid, near ) );

				}

			}

			for ( const h of hits ) if ( h.distance < best ) best = h.distance;
			hits.length = 0;

		} );
		return best;

	};

}
