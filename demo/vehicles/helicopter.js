// A toy helicopter built in code, for the All matters page's flyer
// (demo/flyer.js). About 6 cm from the nose to the tail rotor, a main
// rotor of 5.5 cm: a small desk toy next to cubes of 30 cm.
//   body     glossy red ABS, the Infinitex plastic of the wall's "glossy
//            plastic" cube: fine scratches and dust up close
//   rotors   textured black ABS (the "moulded plastic" cube): spark
//            erosion grain, as on a real moulded toy
//   canopy   a tinted clear bubble; skids in grey tube
// The rotor spins up when the helicopter takes off and runs down when it
// lands (pose( t, flight, beat ): beat 0 stops it); a faint disc shows the
// blur of the blades at speed.
// ixMeshes: the meshes that wear an Infinitex matter, so a page that
// streams its materials (warmup.js) can compile them with the rest.
// Local frame: +Z forward, +Y up, origin at the cabin centre.
// Every mesh has userData.owner = the returned group (collide.js, skip).
// Event bus: none, a model driven by the flyer.

import * as THREE from 'three/webgpu';
import { ellipsoid, tube, blade, glossy, moulded } from './toy.js';

const CM = 0.0055; // the model's unit: its sizes below were drawn for 11 cm, it is built at 55 percent

export function createHelicopter() {

	const group = new THREE.Group();
	group.name = 'toy helicopter';
	const red = glossy( '#b3141c', 12 );
	const black = moulded( 13 );
	const steel = new THREE.MeshPhysicalNodeMaterial( { color: 0x9a9da3, metalness: 0.9, roughness: 0.35 } );
	const glass = new THREE.MeshPhysicalNodeMaterial( { color: 0x9fd0ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.4, clearcoat: 1, depthWrite: false } );
	const blur = new THREE.MeshBasicNodeMaterial( { color: 0x202124, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false } );
	const ixMeshes = [];
	const mesh = ( g, m, parent = group ) => { const o = new THREE.Mesh( g, m.material ?? m ); if ( m.material ) ixMeshes.push( o ); parent.add( o ); return o; };

	// Cabin, canopy, tail boom, fin and stabiliser.
	mesh( ellipsoid( 1.7 * CM, 1.8 * CM, 2.8 * CM ), red );
	const canopy = mesh( new THREE.SphereGeometry( 1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55 ).scale( 1.5 * CM, 1.5 * CM, 1.9 * CM ), glass );
	canopy.rotation.x = Math.PI / 2 * 0.85;
	canopy.position.set( 0, 0.35 * CM, 1.1 * CM );
	canopy.renderOrder = 1;
	const boom = mesh( tube( 0.65 * CM, 0.32 * CM, 6 * CM ).rotateX( - Math.PI / 2 ), red );
	boom.position.set( 0, 0.4 * CM, - 5 * CM );
	const fin = mesh( blade( 2.2 * CM, 0.25 * CM, 1.6 * CM ).rotateX( - 0.5 ), red );
	fin.position.set( 0, 0.9 * CM, - 7.9 * CM );
	const stab = mesh( blade( 1.1 * CM, 3.2 * CM, 0.2 * CM ), red );
	stab.position.set( 0, 0.4 * CM, - 7.4 * CM );

	// Main rotor: mast, hub, two blades, and the blur disc.
	const mast = mesh( tube( 0.22 * CM, 0.2 * CM, 1 * CM ), black );
	mast.position.y = 2.1 * CM;
	const rotor = new THREE.Group();
	rotor.position.y = 2.6 * CM;
	group.add( rotor );
	mesh( ellipsoid( 0.45 * CM, 0.3 * CM, 0.45 * CM ), black, rotor );
	for ( const a of [ 0, Math.PI ] ) mesh( blade( 5 * CM, 0.75 * CM, 0.12 * CM ).rotateY( a ), black, rotor );
	const disc = mesh( new THREE.CircleGeometry( 5 * CM, 48 ).rotateX( - Math.PI / 2 ), blur, rotor );
	disc.renderOrder = 2;

	// Tail rotor, on the left of the fin.
	const tail = new THREE.Group();
	tail.position.set( 0.3 * CM, 1.3 * CM, - 8.2 * CM );
	group.add( tail );
	for ( const a of [ 0, Math.PI ] ) mesh( blade( 1.2 * CM, 0.35 * CM, 0.08 * CM ).rotateZ( Math.PI / 2 ).rotateX( a ), black, tail );

	// Skids: two runners on four struts.
	for ( const sx of [ - 1, 1 ] ) {

		const run = mesh( new THREE.CylinderGeometry( 0.18 * CM, 0.18 * CM, 6 * CM, 8 ).rotateX( Math.PI / 2 ), steel );
		run.position.set( sx * 1.7 * CM, - 2.45 * CM, 0.2 * CM );
		for ( const z of [ - 1.2, 1.4 ] ) {

			const p = new THREE.Vector3( sx * 1.7 * CM, - 2.45 * CM, z * CM ), q = new THREE.Vector3( sx * 0.9 * CM, - 1.3 * CM, z * CM );
			const s = mesh( new THREE.CylinderGeometry( 0.14 * CM, 0.14 * CM, p.distanceTo( q ), 6 ), steel );
			s.position.copy( p ).add( q ).multiplyScalar( 0.5 );
			s.quaternion.setFromUnitVectors( new THREE.Vector3( 0, 1, 0 ), q.clone().sub( p ).normalize() );

		}

	}

	group.traverse( ( o ) => {

		if ( ! o.isMesh ) return;
		o.userData.owner = group;
		o.castShadow = o.material !== glass && o.material !== blur;
		o.receiveShadow = o.castShadow;

	} );

	// Rotor speed in turns a second, eased: spins up in about a second.
	let spin = 0, angle = 0, tailAngle = 0, last = null;
	const TOP = 9; // turns a second at full speed (60 fps shows it as a flicker, the disc does the rest)
	function pose( t, flight = 0, beat = 1 ) {

		const dt = last === null ? 0 : Math.min( 0.1, Math.max( 0, t - last ) );
		last = t;
		spin += ( beat * TOP * ( 1 + flight * 0.2 ) - spin ) * ( 1 - Math.exp( - dt / ( beat ? 0.6 : 1.5 ) ) );
		angle += spin * dt * Math.PI * 2;
		tailAngle += spin * 2.7 * dt * Math.PI * 2;
		rotor.rotation.y = angle;
		tail.rotation.x = tailAngle;
		blur.opacity = 0.16 * THREE.MathUtils.smoothstep( spin, 2, TOP ); // drawn at 0 too: its pipeline compiles with the page, not at take-off

	}

	pose( 0, 0, 0 );
	return { group, pose, ixMeshes, ix: [ red, black ], length: 11 * CM, radius: 3.5 * CM, skid: 2.6 * CM };

}
