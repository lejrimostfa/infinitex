// A honeybee worker (Apis mellifera) built in code, for the Room demo's
// flyer (demo/flyer.js). About 13 mm long, at real size: it can go from
// the window to a stitch of the sweater or the skin of a fruit.
//   fuzz     the thorax wears 700 real hairs (one instanced cone each,
//            0.5 mm long) over a golden sheen, so its outline is soft
//   abdomen  golden and dark bands; it pulses a little, as a bee breathes
//   eyes     the Infinitex insect eye (insect.js), large dark ovals
//   wings    two pairs, the fore wing 6.5 mm, a faint amber tint
//   legs     dark, the hind pair carries two orange pollen loads
// Local frame: +Z forward, +Y up, origin at the thorax. pose( t, flight,
// beat ) as the mosquito (mosquito.js). Every mesh has userData.owner =
// the group (collide.js, skip); the hairs are also noFocus, so the lens
// and the walk never test 700 instances.
// Event bus: none, a model driven by the flyer.

import * as THREE from 'three/webgpu';
import { banded, blob, rod, addEyes, addWings, finish } from './insect.js';

const MM = 1e-3;

// Deterministic random numbers (the same bee on every visit).
function rng( seed ) {

	let s = seed >>> 0;
	return () => ( s = ( s * 1664525 + 1013904223 ) >>> 0 ) / 4294967296;

}

// n hairs on an ellipsoid (half sizes a, b, c), pointing out and leaning
// back; none on the underside below yMin (a share of b).
function hairs( n, a, b, c, len, r, material, { yMin = - 0.4, seed = 3 } = {} ) {

	const g = new THREE.ConeGeometry( r, len, 4, 1 ).translate( 0, len / 2, 0 );
	const mesh = new THREE.InstancedMesh( g, material, n );
	const rand = rng( seed ), d = new THREE.Vector3(), nrm = new THREE.Vector3(), q = new THREE.Quaternion(), m = new THREE.Matrix4();
	const up = new THREE.Vector3( 0, 1, 0 ), back = new THREE.Vector3( 0, 0, - 0.5 ), one = new THREE.Vector3( 1, 1, 1 );
	let k = 0;
	while ( k < n ) {

		d.set( rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1 );
		const l = d.length();
		if ( l > 1 || l < 1e-3 ) continue;
		d.divideScalar( l );
		if ( d.y < yMin ) continue;
		nrm.set( d.x / a, d.y / b, d.z / c ).normalize().add( back ).normalize();
		q.setFromUnitVectors( up, nrm );
		m.compose( new THREE.Vector3( d.x * a, d.y * b, d.z * c ).multiplyScalar( 0.97 ), q, one.setScalar( 0.6 + rand() * 0.6 ) );
		mesh.setMatrixAt( k ++, m );

	}

	mesh.userData.noFocus = true;
	return mesh;

}

export function createBee() {

	const group = new THREE.Group();
	group.name = 'bee';
	const body = new THREE.Group();
	group.add( body );

	const gold = { dark: 0x7a4e18, sheen: 0xf0c060, sheenAmount: 1, roughness: 0.8 };
	const thoraxMat = banded( 'y', 1, 0, gold );
	const hairMat = new THREE.MeshStandardNodeMaterial( { color: 0xd8a650, roughness: 0.7 } );
	const darkMat = banded( 'y', 1, 0, { dark: 0x17110c, sheen: 0x8a7050, sheenAmount: 0.5, roughness: 0.5 } );
	const abdomenMat = banded( 'z', 1.25 * MM, 0.45, { dark: 0x1a120a, pale: 0xc98a22, sheen: 0xe8b860, sheenAmount: 0.8, roughness: 0.55 } );
	const pollenMat = new THREE.MeshStandardNodeMaterial( { color: 0xf0a020, roughness: 0.9 } );

	const add = ( mesh ) => { body.add( mesh ); return mesh; };
	add( new THREE.Mesh( blob( 1.9 * MM, 1.8 * MM, 2.1 * MM ), thoraxMat ) );
	add( hairs( 700, 1.9 * MM, 1.8 * MM, 2.1 * MM, 0.5 * MM, 0.035 * MM, hairMat ) );
	const abdomen = add( new THREE.Mesh( blob( 2.1 * MM, 1.9 * MM, 3.3 * MM, 28 ), abdomenMat ) );
	abdomen.position.set( 0, - 0.5 * MM, - 4.4 * MM );
	abdomen.rotation.x = - 0.25;
	const head = add( new THREE.Mesh( blob( 1.35 * MM, 1.4 * MM, 0.9 * MM ), darkMat ) );
	head.position.set( 0, 0.1 * MM, 2.6 * MM );
	head.rotation.x = 0.35;
	const eyes = addEyes( body, { r: 0.6 * MM, scale: [ 0.55, 1.1, 0.8 ], at: [ 1.0 * MM, 0.35 * MM, 2.55 * MM ],
		preset: { color: '#2a1c12', color2: '#4a3a20', color3: '#060403', seed: 9 } } );

	const v = ( x, y, z ) => new THREE.Vector3( x * MM, y * MM, z * MM );
	for ( const sx of [ - 1, 1 ] ) {

		// Elbowed antennae: the scape up and forward, then the flagellum.
		add( rod( v( sx * 0.3, 0.6, 3.3 ), v( sx * 0.6, 1.5, 4.0 ), 0.07 * MM, darkMat ) );
		add( rod( v( sx * 0.6, 1.5, 4.0 ), v( sx * 1.0, 0.9, 5.4 ), 0.06 * MM, darkMat ) );

	}

	add( rod( v( 0, - 1.2, - 7.3 ), v( 0, - 1.5, - 8.1 ), 0.06 * MM, darkMat ) ); // the sting

	const wings = addWings( body, { freq: 29, opacity: 0.3, tint: 0xe8e0d0, pairs: [
		{ at: [ 0.8 * MM, 1.5 * MM, 0.7 * MM ], len: 6.5 * MM, wide: 1.4 * MM },
		{ at: [ 0.9 * MM, 1.3 * MM, - 0.4 * MM ], len: 4.5 * MM, wide: 1.0 * MM },
	] } );

	// Legs: femur, tibia; the hind tibia carries a pollen load.
	const legs = [];
	for ( let i = 0; i < 3; i ++ ) for ( const sx of [ - 1, 1 ] ) {

		const hip = new THREE.Group();
		hip.position.set( sx * 0.8 * MM, - 1.3 * MM, ( 0.9 - i * 0.9 ) * MM );
		const reach = 1 + i * 0.35;
		const knee = v( sx * 1.6 * reach, - 0.6, ( 1 - i ) * 1.2 );
		const foot = v( sx * 2.2 * reach, - 3.2 * reach, ( 1 - i ) * 1.6 - i * 1.4 );
		hip.add( rod( v( 0, 0, 0 ), knee, 0.16 * MM, darkMat ) );
		hip.add( rod( knee, foot, 0.12 * MM, darkMat ) );
		if ( i === 2 ) {

			const load = new THREE.Mesh( blob( 0.45 * MM, 0.6 * MM, 0.45 * MM, 16 ), pollenMat );
			load.position.copy( knee ).lerp( foot, 0.55 );
			hip.add( load );

		}

		body.add( hip );
		legs.push( { hip, sx, i } );

	}

	finish( body, group, [ wings.wingMat, wings.fanMat, hairMat ] );

	// t: seconds. flight: 0 hovering, 1 full speed. beat: 0 wings folded.
	function pose( t, flight = 0, beat = 1 ) {

		wings.beat( t, beat );
		for ( const { hip, sx, i } of legs ) {

			hip.rotation.x = - flight * ( 0.4 + i * 0.3 ) + Math.sin( t * 1.7 + i ) * 0.04;
			hip.rotation.z = sx * ( 0.05 - flight * 0.25 );

		}

		abdomen.scale.y = 1 + Math.sin( t * 5 ) * 0.03; // breathing
		abdomen.rotation.x = - 0.25 - flight * 0.1;
		body.rotation.x = - 0.05 + flight * 0.06;

	}

	pose( 0 );
	return { group, pose, ix: eyes, length: 13 * MM, radius: 4 * MM };

}
