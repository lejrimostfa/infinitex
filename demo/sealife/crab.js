// A crab built by code, in the Infinitex crab-shell matter: a flattened
// shell, two eyes on stalks, two claws and eight legs of three segments.
// Each part is a rigid mesh in a small hierarchy; nothing is skinned.
//   walk     sideways, as crabs do, back and forth along a segment of the
//            floor. The legs of one side reach and pull in turn (two
//            groups half a step apart), the other side pushes. A pause at
//            each end, claws raised.
//   scale    `size` is the width of the shell in meters.
// It walks on a flat height: on a displaced floor (preset.displace) its
// feet sink in the mounds or stand a few millimetres above the hollows.
// update( t ) once per frame.
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { uv } from 'three/tsl';
import { createMaterial } from '../../src/index.js';

export function createCrab( { size = 0.06, from, to, y = 0, period = 18, preset = {} } ) {

	const ix = createMaterial( { family: 'scales', mode: 'quill', holes: 1, scale_mm: 1.2, size_variation: 0.9, depth: 0.6, wrinkles: 0.4, color: '#a8381c', groove_color: '#4a1608', color_variation: 0.25,
		pattern: 0.6, pattern_color: '#d07a3a', pattern_mm: 8, roughness: 0.35, gloss: 0.4, seed: 38, underwater: 1, ...preset }, { coords: uv().mul( size ) } );
	const part = ( g, parent, x = 0, y = 0, z = 0 ) => { g.computeTangents(); const m = new THREE.Mesh( g, ix.material ); m.position.set( x, y, z ); m.castShadow = true; parent.add( m ); return m; };
	const limb = ( len, r0, r1 ) => { const g = new THREE.CapsuleGeometry( 1, 1, 3, 8 ); g.scale( ( r0 + r1 ) / 2, 1, ( r0 + r1 ) / 2 ); g.scale( 1, len / 3, 1 ); g.translate( 0, - len / 2, 0 ); return g; }; // the unit capsule is 3 high; the limb hangs from its top
	const root = new THREE.Group();
	const S = size;
	// Shell: wider than long, flat, the front edge a little straighter.
	const shellG = new THREE.SphereGeometry( 0.5, 28, 16 );
	shellG.scale( S, S * 0.34, S * 0.72 );
	const body = new THREE.Group();
	root.add( body );
	part( shellG, body );
	for ( const sx of [ - 1, 1 ] ) {

		const stalk = part( limb( S * 0.12, S * 0.018, S * 0.014 ), body, sx * S * 0.14, S * 0.2, S * 0.3 );
		stalk.rotation.x = Math.PI; // points up
		part( new THREE.SphereGeometry( S * 0.03, 10, 8 ), stalk, 0, - S * 0.13, 0 );

	}

	// Legs: four per side, fanned. Each: coxa out, then a leg down, then a tip.
	const legs = [];
	for ( const sx of [ - 1, 1 ] ) for ( let k = 0; k < 4; k ++ ) {

		const hip = new THREE.Group();
		hip.position.set( sx * S * 0.4, 0, S * ( 0.2 - k * 0.15 ) );
		hip.rotation.y = sx * ( 0.5 - k * 0.33 ); // fan
		body.add( hip );
		const upper = part( limb( S * 0.42, S * 0.035, S * 0.028 ), hip );
		const lower = part( limb( S * 0.46, S * 0.026, S * 0.012 ), upper, 0, - S * 0.42, 0 );
		legs.push( { sx, k, hip, upper, lower } );

	}

	// Claws: an arm forward, a palm, and two fingers.
	const claws = [];
	for ( const sx of [ - 1, 1 ] ) {

		const sh = new THREE.Group();
		sh.position.set( sx * S * 0.34, 0, S * 0.3 );
		body.add( sh );
		const arm = part( limb( S * 0.36, S * 0.04, S * 0.045 ), sh );
		const palmG = new THREE.SphereGeometry( 0.5, 14, 10 );
		palmG.scale( S * 0.2, S * 0.26, S * 0.14 );
		const palm = part( palmG, arm, 0, - S * 0.44, 0 );
		const f1 = part( limb( S * 0.2, S * 0.03, S * 0.008 ), palm, S * 0.04, - S * 0.08, 0 ), f2 = part( limb( S * 0.18, S * 0.024, S * 0.008 ), palm, - S * 0.04, - S * 0.08, 0 );
		claws.push( { sx, sh, arm, f1, f2 } );

	}

	const A = new THREE.Vector3( ...from ), B = new THREE.Vector3( ...to ), dir = B.clone().sub( A );
	const len = dir.length();
	dir.normalize();
	// The crab's own x axis lies along the walk: it moves sideways.
	root.rotation.y = Math.atan2( - dir.z, dir.x );
	const stand = S * 0.42; // height of the shell above the feet
	const smooth = ( x ) => x * x * ( 3 - 2 * x );

	return {
		group: root, material: ix,
		update( t ) {

			// Out for 42% of the period, a pause, back, a pause.
			const u = ( t / period ) % 1;
			const go = u < 0.42 ? 1 : u < 0.5 ? 0 : u < 0.92 ? - 1 : 0;
			const d = u < 0.42 ? smooth( u / 0.42 ) : u < 0.5 ? 1 : u < 0.92 ? 1 - smooth( ( u - 0.5 ) / 0.42 ) : 0;
			const step = d * len / ( S * 0.5 ) * Math.PI * 2; // one stride every half shell width
			root.position.copy( A ).addScaledVector( dir, d * len );
			root.position.y = y + stand;
			body.position.y = go ? Math.abs( Math.sin( step ) ) * S * 0.015 : Math.sin( t * 1.3 ) * S * 0.01;
			body.rotation.z = go ? Math.sin( step ) * 0.04 : 0;
			for ( const L of legs ) {

				const ph = step + ( L.k % 2 ) * Math.PI + ( L.sx > 0 ? 0 : Math.PI );
				const reach = go ? Math.sin( ph ) : 0, lift = go ? Math.max( 0, Math.cos( ph ) ) : 0;
				// Out and down: the upper segment leans out, the lower one comes back in.
				L.upper.rotation.z = L.sx * ( 1.15 + reach * 0.22 * go * L.sx + lift * 0.3 );
				L.lower.rotation.z = - L.sx * ( 1.25 + reach * 0.2 * go * L.sx - lift * 0.15 );

			}

			for ( const C of claws ) {

				const raise = go ? 0 : 0.5 + Math.sin( t * 2 + C.sx ) * 0.15;
				C.sh.rotation.set( - 1.1 - raise * 0.5, C.sx * 0.5, C.sx * 0.5 );
				const open = 0.12 + ( go ? 0 : 0.2 + Math.sin( t * 3 + C.sx ) * 0.15 );
				C.f1.rotation.z = open; C.f2.rotation.z = - open;

			}

		},
	};

}
