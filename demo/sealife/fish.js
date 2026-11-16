// A school of fish built by code: one lofted body with fins, drawn as an
// InstancedMesh, in the Infinitex fish-scale matter.
//   body     20 rings of 10 points from the nose to the tail root, a
//            tail fan and a dorsal fin (thin, two-sided).
//            UVs in meters along and around the body: the scales keep
//            their real size.
//   swim     a wave runs down the body in the vertex stage: no bend at
//            the head, the widest swing at the tail tip. Each fish has
//            its own phase and beats faster when it swims faster.
//   school   every fish follows the same closed loop with its own delay
//            and offset, and faces where it goes. The loop is given by
//            the page (centre and radii), clear of the scene's objects.
// update( t ) once per frame.
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { attribute, instancedBufferAttribute, positionLocal, uv, vec3, sin } from 'three/tsl';
import { createMaterial } from '../../src/index.js';
import { ixTime } from '../../src/core/clock.js';

// Half height of the body at s (0 nose, 1 tail root), for a length of 1.
const profile = ( s ) => Math.max( 0.17 * Math.pow( Math.sin( Math.PI * Math.pow( s, 0.55 ) ), 0.9 ), 0.03 * Math.min( 1, s * 8 ) );

function fishGeometry( L ) {

	const NS = 20, NA = 10, pos = [], uvs = [], along = [], idx = [];
	for ( let i = 0; i <= NS; i ++ ) {

		const s = i / NS, h = profile( s ) * L, w = h * 0.45;
		for ( let j = 0; j <= NA; j ++ ) {

			const a = j / NA * Math.PI * 2;
			pos.push( ( 0.5 - s ) * L, Math.cos( a ) * h, Math.sin( a ) * w );
			uvs.push( s * L, j / NA * 0.3 * L );
			along.push( s );

		}

	}

	for ( let i = 0; i < NS; i ++ ) for ( let j = 0; j < NA; j ++ ) {

		const a = i * ( NA + 1 ) + j, b = a + NA + 1;
		idx.push( a, a + 1, b, b, a + 1, b + 1 );

	}

	// A thin fin: a fan of points [ x, y, z, s ], drawn on both sides.
	const fin = ( pts ) => {

		const base = pos.length / 3;
		for ( const [ x, y, z, s ] of pts ) { pos.push( x * L, y * L, z * L ); uvs.push( ( 0.5 - x ) * L, y * L + 0.4 * L ); along.push( s ); }
		for ( let k = 1; k < pts.length - 1; k ++ ) idx.push( base, base + k, base + k + 1, base, base + k + 1, base + k );

	};
	fin( [ [ - 0.47, 0, 0, 1 ], [ - 0.78, 0.2, 0, 1.35 ], [ - 0.66, 0, 0, 1.2 ], [ - 0.78, - 0.2, 0, 1.35 ] ] ); // tail
	fin( [ [ 0.1, 0.15, 0, 0.4 ], [ - 0.03, 0.22, 0, 0.53 ], [ - 0.17, 0.18, 0, 0.67 ], [ - 0.2, 0.11, 0, 0.7 ] ] ); // dorsal

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	g.setAttribute( 'along', new THREE.Float32BufferAttribute( along, 1 ) );
	g.setIndex( idx );
	g.computeVertexNormals();
	g.computeTangents();
	return g;

}

// loop: { centre: [ x, y, z ], radii: [ rx, ry, rz ] } of the school's path.
export function createSchool( { count = 14, length = 0.06, loop, period = 26, preset = {}, seed = 3 } ) {

	let k = seed * 7919 + 13;
	const rnd = () => ( k = ( k * 16807 ) % 2147483647 ) / 2147483647;
	const ix = createMaterial( { family: 'scales', mode: 'overlap', scale_mm: 2.2, aspect: 1.15, size_variation: 0.1, depth: 0.6, iridescence: 1, iridescence_nm: [ 300, 700 ], ridge_um: 8,
		color: '#aab4b8', groove_color: '#3a4044', color_variation: 0.1, roughness: 0.14, wetness: 0.5, seed: 33, underwater: 1, ...preset }, { coords: uv() } );
	const mesh = new THREE.InstancedMesh( fishGeometry( length ), ix.material, count );
	const fish = Array.from( { length: count }, () => ( { delay: rnd(), off: [ rnd() - 0.5, rnd() - 0.5, rnd() - 0.5 ], size: 0.8 + rnd() * 0.45, phase: rnd() * 6.283 } ) );
	mesh.geometry.setAttribute( 'swimPhase', new THREE.InstancedBufferAttribute( new Float32Array( fish.map( ( f ) => f.phase ) ), 1 ) );
	// The swim: sideways (local z), growing with the square of the distance
	// from the nose. Four beats per second at this size.
	const a = attribute( 'along', 'float' );
	const wave = sin( a.mul( 6.5 ).sub( ixTime.mul( 25 ) ).add( instancedBufferAttribute( mesh.geometry.getAttribute( 'swimPhase' ) ) ) );
	ix.material.positionNode = positionLocal.add( vec3( 0, 0, wave.mul( a.mul( a ) ).mul( length * 0.085 ) ) );
	ix.material.side = THREE.DoubleSide;
	mesh.frustumCulled = false; // the instances move; the tank is always in view anyway
	mesh.castShadow = true;

	const P = new THREE.Vector3(), Q = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), M = new THREE.Matrix4(), up = new THREE.Vector3( 0, 1, 0 );
	const [ cx, cy, cz ] = loop.centre, [ rx, ry, rz ] = loop.radii;
	// The loop: an ellipse that rises and falls twice per turn.
	const at = ( u, f, out ) => {

		const w = u * Math.PI * 2;
		return out.set( cx + Math.cos( w ) * ( rx + f.off[ 0 ] * 0.09 ), cy + Math.sin( w * 2 + f.phase ) * ry + f.off[ 1 ] * 0.05, cz + Math.sin( w ) * ( rz + f.off[ 2 ] * 0.09 ) );

	};

	return {
		mesh, material: ix,
		update( t ) {

			for ( let i = 0; i < count; i ++ ) {

				const f = fish[ i ], u = t / period + f.delay * 0.16 + Math.sin( t * 0.3 + f.phase ) * 0.004;
				at( u, f, P ); at( u + 0.002, f, Q );
				X.subVectors( Q, P ).normalize(); // the nose points along +x
				Z.crossVectors( X, up ).normalize();
				Y.crossVectors( Z, X );
				M.makeBasis( X, Y, Z ).scale( P.set( f.size, f.size, f.size ) );
				at( u, f, P );
				M.setPosition( P );
				mesh.setMatrixAt( i, M );

			}

			mesh.instanceMatrix.needsUpdate = true;

		},
	};

}
