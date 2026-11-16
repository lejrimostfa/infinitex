// Ray queries against skinned meshes, for collide.js. A plain three.js
// raycast poses every vertex on the CPU (52 ms in front of a 115 000
// triangle character), and a BVH refit costs 25 ms or more per frame.
// So one BVH per bone instead, over the triangles that bone moves (skin
// weight >= WMIN at one of their corners). A bone moves its triangles
// rigidly, so the trees never change: each cast just uses the bone's
// current matrix. Exact where one bone drives a vertex; at the joints the
// surface is a blend of the rigid copies, a few mm off. Within NEAR of the
// camera, exactSkinned() poses the candidate triangles the way three skins
// them and tests them exactly.
// Event bus: none, pure functions called by collide.js.

import * as THREE from 'three/webgpu';
import { MeshBVH } from 'three-mesh-bvh';

const WMIN = 0.1; // skin weight that puts a triangle in a bone's tree
export const NEAR = 0.05; // m: inside this range a skinned mesh is tested exactly
const TOL = 0.03; // m: largest gap between a rigid bone copy and the skinned surface

// One tree per bone: { bone, bvh, part } where part is { matrixWorld, material }.
export function boneTrees( mesh ) {

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

// World matrix of the rigid copy that bone b moves, as three skins it:
// matrixWorld * bindMatrixInverse * boneWorld * boneInverse * bindMatrix.
export function boneMatrix( mesh, b, target ) {

	const sk = mesh.skeleton;
	return target.multiplyMatrices( mesh.matrixWorld, mesh.bindMatrixInverse )
		.multiply( sk.bones[ b ].matrixWorld ).multiply( sk.boneInverses[ b ] ).multiply( mesh.bindMatrix );

}

// Exact distance along worldRay to a skinned mesh within reach (world
// units), or Infinity. The bone trees pick the candidate triangles: boxes
// grown by TOL, which covers the joint error of the rigid copies. Each
// candidate is then posed the way three skins it (getVertexPosition) and
// tested against the ray.
const local = new THREE.Ray(), inv = new THREE.Matrix4(), grown = new THREE.Box3();
const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), at = new THREE.Vector3();
export function exactSkinned( mesh, bones, worldRay, reach ) {

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
		local.copy( worldRay ).applyMatrix4( inv );
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
					? worldRay.intersectTriangle( pc, pb, pa, true, at )
					: worldRay.intersectTriangle( pa, pb, pc, side === THREE.FrontSide, at );
				if ( hit ) best = Math.min( best, at.distanceTo( worldRay.origin ) );
				return false;

			},
		} );

	}

	return best <= reach ? best : Infinity;

}
