// Jellyfish built by code: a bell, a skirt of short tentacles and four
// long arms, in one mesh each.
//   bell      a lathe profile; it contracts and opens in the vertex stage
//             (the rim moves most), and the body rises a little at each
//             stroke, then sinks back
//   arms      ribbons hanging under the bell, swaying more towards the tip
//   look      a clear jelly: almost invisible face on, milky at the rim
//             where the wall is seen edge on (Fresnel), with a faint glow
//             of its own. Opaque with a hashed alpha, not blended: a water
//             surface that reads the screen then shows it from above too.
// The Infinitex jelly matter (src/families/jelly) is not used here: it is
// transmissive, and three would copy the scene once more for each of the
// aquarium's passes and mirrors.
// update( t ) once per frame.
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { attribute, positionLocal, normalView, positionView, vec3, float, sin, uniform, mix } from 'three/tsl';
import { ixTime } from '../../src/core/clock.js';

function jellyGeometry( R ) {

	const pos = [], part = [], idx = [];
	// Bell: profile from the top (v = 0) to the rim (v = 1), with a lip.
	const NV = 14, NA = 28;
	for ( let i = 0; i <= NV; i ++ ) {

		const v = i / NV, a = v * Math.PI * 0.56, r = Math.sin( a ) * R * ( 1 + 0.06 * Math.sin( v * 9 ) ), y = Math.cos( a ) * R * 0.75;
		for ( let j = 0; j <= NA; j ++ ) { const t = j / NA * Math.PI * 2; pos.push( Math.cos( t ) * r, y, Math.sin( t ) * r ); part.push( v, 0 ); }

	}

	for ( let i = 0; i < NV; i ++ ) for ( let j = 0; j < NA; j ++ ) { const a = i * ( NA + 1 ) + j, b = a + NA + 1; idx.push( a, b, a + 1, b, b + 1, a + 1 ); }
	const rimY = Math.cos( Math.PI * 0.56 ) * R * 0.75, rimR = Math.sin( Math.PI * 0.56 ) * R;
	// A ribbon from ( x, z ) at the rim height down by len, w wide.
	const ribbon = ( x, z, len, w, seg ) => {

		const base = pos.length / 3, n = Math.hypot( x, z ) || 1, tx = - z / n * w, tz = x / n * w;
		for ( let i = 0; i <= seg; i ++ ) { const s = i / seg, k = 1 - s * 0.7; pos.push( x - tx * k, rimY - s * len, z - tz * k, x + tx * k, rimY - s * len, z + tz * k ); part.push( 1, s, 1, s ); }
		for ( let i = 0; i < seg; i ++ ) { const a = base + i * 2; idx.push( a, a + 2, a + 1, a + 1, a + 2, a + 3 ); }

	};
	for ( let j = 0; j < 16; j ++ ) { const t = j / 16 * Math.PI * 2; ribbon( Math.cos( t ) * rimR * 0.96, Math.sin( t ) * rimR * 0.96, R * ( 1.1 + 0.6 * ( ( j * 7 ) % 5 ) / 5 ), R * 0.012, 8 ); }
	for ( let j = 0; j < 4; j ++ ) { const t = j / 4 * Math.PI * 2 + 0.4; ribbon( Math.cos( t ) * rimR * 0.25, Math.sin( t ) * rimR * 0.25, R * 2.4, R * 0.07, 12 ); }

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'part', new THREE.Float32BufferAttribute( part, 2 ) ); // x: 0 bell, 1 arm; y: along the arm (bell: x holds v)
	g.setIndex( idx );
	g.computeVertexNormals();
	return g;

}

// spots: [ [ x, y, z ], ... ] where each one drifts. radius of the bell (m).
export function createJellies( { spots, radius = 0.022, color = '#cfe6ff', glow = '#7fb8ff', beat = 1.6 } ) {

	const group = new THREE.Group();
	const all = spots.map( ( [ x, y, z ], i ) => {

		const phase = uniform( i * 1.9 );
		const m = new THREE.MeshBasicNodeMaterial( { side: THREE.DoubleSide } );
		const part = attribute( 'part', 'vec2' );
		const isArm = part.x.greaterThan( 0.5 );
		const stroke = sin( ixTime.mul( 6.283 / beat ).add( phase ) ); // 1: closed
		// Bell: the rim (v = 1) pulls in and down on the stroke.
		const v = part.x;
		const bell = vec3( positionLocal.x.mul( float( 1 ).sub( stroke.mul( 0.16 ).mul( v ).mul( v ) ) ), positionLocal.y.sub( stroke.mul( v ).mul( radius * 0.12 ) ), positionLocal.z.mul( float( 1 ).sub( stroke.mul( 0.16 ).mul( v ).mul( v ) ) ) );
		// Arms: they follow the rim, and sway more towards the tip.
		const s = part.y;
		const sway = vec3( sin( ixTime.mul( 1.7 ).add( s.mul( 5 ) ).add( phase ) ), 0, sin( ixTime.mul( 1.3 ).add( s.mul( 4 ) ).add( phase.mul( 1.7 ) ) ) ).mul( s.mul( s ) ).mul( radius * 0.5 );
		const arm = vec3( positionLocal.x.mul( float( 1 ).sub( stroke.mul( 0.16 ) ) ), positionLocal.y.sub( stroke.mul( radius * 0.12 ) ), positionLocal.z.mul( float( 1 ).sub( stroke.mul( 0.16 ) ) ) ).add( sway );
		m.positionNode = isArm.select( arm, bell );
		// Edge on, the wall is milky; face on, clear.
		const fres = float( 1 ).sub( normalView.dot( positionView.normalize().negate() ).abs() ).pow( 1.6 );
		m.colorNode = mix( vec3( new THREE.Color( glow ).r, new THREE.Color( glow ).g, new THREE.Color( glow ).b ).mul( 0.9 ), vec3( new THREE.Color( color ).r, new THREE.Color( color ).g, new THREE.Color( color ).b ).mul( 1.5 ), fres );
		m.opacityNode = isArm.select( float( 0.5 ).sub( s.mul( 0.3 ) ), fres.mul( 0.75 ).add( 0.16 ) );
		m.alphaHash = true;
		const mesh = new THREE.Mesh( jellyGeometry( radius * ( 0.8 + ( i % 3 ) * 0.2 ) ), m );
		mesh.userData.noFocus = true;
		mesh.frustumCulled = false;
		group.add( mesh );
		return { mesh, x, y, z, i, phase: i * 1.9 };

	} );

	return {
		group,
		update( t ) {

			for ( const j of all ) {

				// A slow drift, and a lift on each stroke (a quarter beat late).
				const lift = Math.max( 0, Math.sin( t * 6.283 / beat + j.phase - 1.2 ) ) * 0.006;
				j.mesh.position.set( j.x + Math.sin( t * 0.11 + j.i ) * 0.03, j.y + Math.sin( t * 0.17 + j.i * 2.1 ) * 0.04 + lift, j.z + Math.cos( t * 0.09 + j.i * 1.3 ) * 0.03 );
				j.mesh.rotation.set( Math.sin( t * 0.2 + j.i ) * 0.2, 0, Math.cos( t * 0.16 + j.i ) * 0.2 );

			}

		},
	};

}
