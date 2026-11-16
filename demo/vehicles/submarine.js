// A toy submarine built in code, for the Water page's flyer (demo/flyer.js):
// a bath toy about 10 cm long, yellow hull, red fins and propeller, round
// portholes. Every part is an Infinitex plastic built with underwater: 1,
// so it takes the caustics, the colour loss of the water and the
// refraction through the surface like the rest of the tank
// (core/underwater.js, core/refraction.js).
// The propeller turns with the speed (pose( t, flight, beat ): flight 0
// to 1); at rest it idles. Local frame: +Z forward, +Y up, origin at the
// hull centre. Every mesh has userData.owner = the group (collide.js, skip).
// Event bus: none, a model driven by the flyer.

import * as THREE from 'three/webgpu';
import { ellipsoid, tube, blade, glossy, moulded } from './toy.js';

const CM = 0.01;

export function createSubmarine() {

	const group = new THREE.Group();
	group.name = 'toy submarine';
	const wet = { underwater: 1 };
	const yellow = glossy( '#e8b012', 21, wet );
	const red = glossy( '#c0201a', 22, wet );
	const blue = glossy( '#1a3a6a', 23, { ...wet, roughness: 0.04, dust: 0.1 } ); // the porthole glass, dark and glossy
	const black = moulded( 24, wet );
	const mesh = ( g, m, parent = group ) => { const o = new THREE.Mesh( g, m.material ); parent.add( o ); return o; };

	// Hull and sail (the tower), a periscope on top.
	mesh( ellipsoid( 1.9 * CM, 1.9 * CM, 4.8 * CM ), yellow );
	const sail = mesh( ellipsoid( 0.85 * CM, 1.3 * CM, 1.7 * CM ), yellow );
	sail.position.set( 0, 1.85 * CM, 0.9 * CM );
	const scope = mesh( tube( 0.14 * CM, 0.14 * CM, 1.6 * CM ), black );
	scope.position.set( 0, 3.6 * CM, 1.1 * CM );
	const eyepiece = mesh( tube( 0.16 * CM, 0.16 * CM, 0.6 * CM ).rotateX( Math.PI / 2 ), black );
	eyepiece.position.set( 0, 4.35 * CM, 1.3 * CM );
	for ( const sx of [ - 1, 1 ] ) {

		const plane = mesh( blade( 0.8 * CM, 1.6 * CM, 0.15 * CM ), red ); // dive planes on the sail
		plane.position.set( sx * 1.4 * CM, 1.9 * CM, 0.7 * CM );

	}

	// Portholes: three a side, a black rim around dark glass.
	for ( const sx of [ - 1, 1 ] ) for ( const z of [ - 1.6, 0, 1.6 ] ) {

		const zz = z * CM, r = 1.9 * CM * Math.sqrt( Math.max( 0, 1 - ( zz / ( 4.8 * CM ) ) ** 2 ) ); // the hull's half width there
		const rim = mesh( tube( 0.55 * CM, 0.55 * CM, 0.2 * CM, 24 ).rotateZ( Math.PI / 2 ), black );
		rim.position.set( sx * ( r - 0.02 * CM ), 0.15 * CM, zz );
		const pane = mesh( tube( 0.4 * CM, 0.4 * CM, 0.24 * CM, 24 ).rotateZ( Math.PI / 2 ), blue );
		pane.position.copy( rim.position );

	}

	// Tail: a cross of fins, then the propeller on its hub.
	for ( let k = 0; k < 4; k ++ ) {

		const fin = mesh( blade( 1.4 * CM, 0.15 * CM, 1.5 * CM ).translate( 0, 0.75 * CM, - 1.4 * CM ), red );
		fin.position.z = - 3.6 * CM;
		fin.rotation.z = k * Math.PI / 2;

	}

	const prop = new THREE.Group();
	prop.position.z = - 5 * CM;
	group.add( prop );
	mesh( ellipsoid( 0.4 * CM, 0.4 * CM, 0.5 * CM ), red, prop );
	for ( let k = 0; k < 3; k ++ ) {

		const b = mesh( blade( 1.3 * CM, 0.7 * CM, 0.12 * CM ).rotateX( - Math.PI / 2 ).rotateY( 0.5 ), red, prop );
		b.rotation.z = k * Math.PI * 2 / 3;

	}

	group.traverse( ( o ) => {

		if ( ! o.isMesh ) return;
		o.userData.owner = group;
		o.castShadow = o.receiveShadow = true;

	} );

	// Propeller turns a second: idles at 0.5, 8 at full speed, eased.
	let spin = 0, angle = 0, last = null;
	function pose( t, flight = 0 ) {

		const dt = last === null ? 0 : Math.min( 0.1, Math.max( 0, t - last ) );
		last = t;
		spin += ( 0.5 + flight * 7.5 - spin ) * ( 1 - Math.exp( - dt / 0.5 ) );
		angle += spin * dt * Math.PI * 2;
		prop.rotation.z = angle;

	}

	pose( 0 );
	return { group, pose, length: 10 * CM, radius: 2.4 * CM };

}
