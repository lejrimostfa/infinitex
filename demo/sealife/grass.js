// Seagrass meadows built by code: hundreds of ribbon blades in one
// InstancedMesh, like an eelgrass bed (Zostera).
//   blade    10 rows of 5 points: a ribbon with a curved cross-section
//            (the edges turn forward), a midrib that stands out at the
//            back, a sheath at the root and a rounded tip. It twists a
//            little along its length. UVs: across, along.
//   shoots   3 to 5 blades from one root, fanned; the meadows are dense
//            in the middle and shorter at the edge.
//   sway     in the vertex stage, from the water's current (seabed.js):
//            the root stays, the tip moves most (bend with the square of
//            the distance), the blade keeps its length (the tip drops as
//            it bends), and each blade flutters with its own phase.
//   look     dark green at the root, lighter and yellower to the tip, a
//            pale midrib, fine veins, brown specks of growth on old tips.
//            Light passes through the thin blade (SSS material).
// update( t ) is a no-op: all motion is in the shader.
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { attribute, instancedBufferAttribute, positionLocal, uv, vec2, vec3, float, sin, cos, mix, smoothstep, abs, sqrt, fwidth } from 'three/tsl';
import { ixTime } from '../../src/core/clock.js';
import { valueNoise } from '../../src/core/hash.js';
import { rng, rgb, current, wetMaterial } from './seabed.js';

const ACROSS = [ - 0.5, - 0.22, 0, 0.22, 0.5 ];

// A blade 1 long and 1 wide, standing on +y; instances scale it.
function bladeGeometry( NS = 10 ) {

	const pos = [], uvs = [], along = [], idx = [], NA = ACROSS.length;
	for ( let i = 0; i <= NS; i ++ ) {

		const s = i / NS;
		// Narrower at the sheath, full from a fifth up, round at the tip.
		const w = s < 0.15 ? 0.7 + 2 * s : s > 0.82 ? Math.sqrt( Math.max( 0, 1 - ( ( s - 0.82 ) / 0.18 ) ** 2 ) ) * 0.98 + 0.02 : 1;
		const tw = s * 0.9; // twist
		for ( const x0 of ACROSS ) {

			const z0 = 0.16 * ( x0 / 0.5 ) ** 2 - ( x0 === 0 ? 0.05 : 0 ); // trough, keel of the midrib
			const x = x0 * w, z = z0 * w;
			pos.push( x * Math.cos( tw ) - z * Math.sin( tw ), s, x * Math.sin( tw ) + z * Math.cos( tw ) );
			uvs.push( x0 + 0.5, s );
			along.push( s );

		}

	}

	for ( let i = 0; i < NS; i ++ ) for ( let j = 0; j < NA - 1; j ++ ) {

		const a = i * NA + j, b = a + NA;
		idx.push( a, b, a + 1, a + 1, b, b + 1 );

	}

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	g.setAttribute( 'along', new THREE.Float32BufferAttribute( along, 1 ) );
	g.setIndex( idx );
	g.computeVertexNormals();
	return g;

}

// meadows: [ { x, z, r, shoots, h: [ min, max ] (m), w: [ min, max ] (m) } ].
// floor( x, z ): the sand height (seabed.js sandAt).
export function createSeagrass( { meadows, floor = () => 0, seed = 5 } ) {

	const rnd = rng( seed ), blades = [];
	for ( const m of meadows ) for ( let k = 0; k < m.shoots; k ++ ) {

		// Denser in the middle: the radius of a sum of two randoms.
		const d = Math.abs( rnd() + rnd() - 1 ) * m.r, a = rnd() * 6.283;
		const x = m.x + Math.cos( a ) * d, z = m.z + Math.sin( a ) * d;
		const edge = 1 - 0.45 * ( d / m.r ) ** 2, yaw = rnd() * 6.283, n = 3 + Math.floor( rnd() * 3 );
		for ( let j = 0; j < n; j ++ ) {

			const fan = ( j - ( n - 1 ) / 2 ) * 0.35, out = 0.08 + rnd() * 0.18;
			blades.push( {
				x: x + ( rnd() - 0.5 ) * 0.004, z: z + ( rnd() - 0.5 ) * 0.004,
				L: ( m.h[ 0 ] + rnd() * ( m.h[ 1 ] - m.h[ 0 ] ) ) * edge * ( j === ( n >> 1 ) ? 1 : 0.65 + rnd() * 0.3 ),
				w: m.w[ 0 ] + rnd() * ( m.w[ 1 ] - m.w[ 0 ] ), yaw: yaw + fan + ( rnd() - 0.5 ) * 0.3,
				lean: [ Math.cos( yaw + fan * 2 + 1.57 ) * out + Math.cos( a ) * 0.06, Math.sin( yaw + fan * 2 + 1.57 ) * out + Math.sin( a ) * 0.06 ],
				phase: rnd() * 6.283, tint: rnd(), age: rnd(),
			} );

		}

	}

	const count = blades.length, geo = bladeGeometry();
	const A = new Float32Array( count * 4 ), B = new Float32Array( count * 4 );
	blades.forEach( ( b, i ) => { A.set( [ b.x, b.z, b.L, b.phase ], i * 4 ); B.set( [ b.lean[ 0 ], b.lean[ 1 ], b.tint, b.age ], i * 4 ); } );
	geo.setAttribute( 'bladeA', new THREE.InstancedBufferAttribute( A, 4 ) );
	geo.setAttribute( 'bladeB', new THREE.InstancedBufferAttribute( B, 4 ) );
	const iA = instancedBufferAttribute( geo.getAttribute( 'bladeA' ) ), iB = instancedBufferAttribute( geo.getAttribute( 'bladeB' ) );

	// Colour along the blade (u across, s along).
	const u = uv().x, s = uv().y, L = iA.z;
	let c = mix( rgb( '#14300c' ), rgb( '#3f7a1c' ), smoothstep( 0.0, 0.4, s ) );
	c = mix( c, rgb( '#a3a63a' ), smoothstep( 0.45, 1.0, s ).mul( iB.w.mul( 0.5 ).add( 0.35 ) ) );
	c = c.mul( iB.z.mul( 0.35 ).add( 0.8 ) );
	// Thin lines fade to their mean where a pixel covers them (no shimmer).
	const fu = fwidth( u ), near = smoothstep( 0.06, 0.02, fu );
	const rib = mix( float( 0.08 ), smoothstep( 0.05, 0.0, abs( u.sub( 0.5 ) ) ), near );
	c = mix( c, c.mul( 1.45 ).add( vec3( 0.03, 0.04, 0.0 ) ), rib.mul( 0.7 ) );
	const veins = sin( u.mul( Math.PI * 12 ) ).abs().pow( 10 ).mul( smoothstep( 0.03, 0.01, fu ) );
	c = c.mul( float( 1 ).sub( veins.mul( 0.12 ) ) );
	const q = vec2( u.mul( 4 ), s.mul( L ).mul( 260 ).add( iA.w.mul( 10 ) ) );
	const spots = smoothstep( 0.72, 0.8, valueNoise( q ) ).mul( smoothstep( 0.55, 1.0, s ) ).mul( iB.w ).mul( smoothstep( 0.6, 0.2, fwidth( q.y ) ) );
	c = mix( c, rgb( '#5e4a22' ), spots.mul( 0.7 ) );
	const mat = wetMaterial( { color: c, roughness: 0.42, sss: 0.6, side: THREE.DoubleSide } );

	// The sway: a bend in units of the blade's length, soft-clamped below 1.
	const sA = attribute( 'along', 'float' );
	const t = ixTime, ph = iA.w;
	const flutter = vec2( sin( t.mul( 2.1 ).add( ph ).add( sA.mul( 5 ) ) ), cos( t.mul( 1.7 ).add( ph.mul( 1.3 ) ).add( sA.mul( 4 ) ) ) ).mul( 0.1 );
	const bend0 = current( iA.xy ).mul( 0.85 ).add( iB.xy ).add( flutter );
	const bend = bend0.div( sqrt( bend0.dot( bend0 ).add( 1 ) ) );
	const off = bend.mul( sA.mul( sA ) ).mul( L );
	const drop = bend.dot( bend ).mul( sA.mul( sA ).mul( sA ) ).mul( L ).mul( 2 / 3 );
	mat.positionNode = positionLocal.add( vec3( off.x, drop.negate(), off.y ) );

	const mesh = new THREE.InstancedMesh( geo, mat, count );
	const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3( 0, 1, 0 );
	blades.forEach( ( b, i ) => {

		P.set( b.x, floor( b.x, b.z ) - 0.004, b.z ); // 4 mm into the sand
		mesh.setMatrixAt( i, M.compose( P, Q.setFromAxisAngle( Y, b.yaw ), S.set( b.w, b.L, b.w ) ) );

	} );
	mesh.frustumCulled = false; // the blades move in the shader
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	mesh.userData.noFocus = true;
	return { mesh, count, update() {} };

}
