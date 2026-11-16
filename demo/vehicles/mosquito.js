// A tiger mosquito (Aedes albopictus) built in code, for the Knit demo's
// flyer (demo/flyer.js). About 6 mm from the proboscis to the tail, legs
// 9 mm long, at real size: the camera can follow it into the wool.
//   eyes      the Infinitex insect eye (organic family, insecteye mode):
//             facets of 18 um that appear as the camera comes close
//   body      black cuticle with the white bands of the tiger mosquito,
//             on the abdomen and the legs (stripes along each part)
//   wings     thin clear membranes with a soft thin-film sheen, plus a
//             faint fan that shows the swept stroke while they beat
// The parts come from insect.js, shared with the bee.
// Local frame: +Z forward (the proboscis), +Y up, origin at the thorax.
// pose( t, flight, beat ) beats the wings and swings the legs; flight is 0
// when hovering, 1 at full speed (the legs trail behind).
// Every mesh has userData.owner = the returned group, so the flyer's own
// collision ray can skip it (collide.js, skip).
// Event bus: none, a model driven by the flyer.

import * as THREE from 'three/webgpu';
import { positionLocal, smoothstep, mix, color } from 'three/tsl';
import { banded, blob, rod, addEyes, addWings, finish } from './insect.js';

const MM = 1e-3;

export function createMosquito() {

	const group = new THREE.Group();
	group.name = 'mosquito';
	const body = new THREE.Group(); // tilted a little, nose up
	group.add( body );

	const cuticle = banded( 'y', 1, 0 ); // plain black
	const thoraxMat = new THREE.MeshPhysicalNodeMaterial( { roughness: 0.4, sheen: 0.8, sheenRoughness: 0.4, sheenColor: new THREE.Color( 0x9a9aa0 ) } );
	// The white line down the back of the thorax.
	thoraxMat.colorNode = mix( color( 0xe8e6e0 ), color( 0x0d0d10 ), smoothstep( 0.06 * MM, 0.12 * MM, positionLocal.x.abs() ).max( smoothstep( 0.2 * MM, 0.1 * MM, positionLocal.y ) ) );
	const abdomenMat = banded( 'z', 0.55 * MM, 0.28 );
	const legMat = banded( 'y', 0.9 * MM, 0.3 );

	const add = ( mesh ) => { body.add( mesh ); return mesh; };
	add( new THREE.Mesh( blob( 0.55 * MM, 0.6 * MM, 0.75 * MM ), thoraxMat ) );
	const abdomen = add( new THREE.Mesh( blob( 0.42 * MM, 0.36 * MM, 1.7 * MM ), abdomenMat ) );
	abdomen.position.set( 0, - 0.15 * MM, - 2.1 * MM );
	abdomen.rotation.x = - 0.12;
	const head = add( new THREE.Mesh( blob( 0.32 * MM, 0.32 * MM, 0.3 * MM ), cuticle ) );
	head.position.set( 0, 0.05 * MM, 0.95 * MM );
	const eyes = addEyes( body, { r: 0.27 * MM, at: [ 0.17 * MM, 0.12 * MM, 1.02 * MM ] } );

	const v = ( x, y, z ) => new THREE.Vector3( x * MM, y * MM, z * MM );
	add( rod( v( 0, - 0.05, 1.2 ), v( 0, - 0.75, 3.1 ), 0.035 * MM, cuticle ) ); // proboscis
	for ( const sx of [ - 1, 1 ] ) add( rod( v( sx * 0.1, 0.15, 1.2 ), v( sx * 0.55, 0.6, 2.6 ), 0.02 * MM, cuticle ) ); // antennae
	add( rod( v( 0.12, 0.05, 1.15 ), v( 0.08, - 0.35, 2.4 ), 0.03 * MM, legMat ) ); // palps, white tipped
	add( rod( v( - 0.12, 0.05, 1.15 ), v( - 0.08, - 0.35, 2.4 ), 0.03 * MM, legMat ) );

	const wings = addWings( body, { pairs: [ { at: [ 0.25 * MM, 0.45 * MM, 0.1 * MM ], len: 3.0 * MM, wide: 0.42 * MM } ] } );

	// Legs: three pairs, femur then a long banded tibia and tarsus.
	const legs = [];
	for ( let i = 0; i < 3; i ++ ) for ( const sx of [ - 1, 1 ] ) {

		const hip = new THREE.Group();
		hip.position.set( sx * 0.3 * MM, - 0.4 * MM, ( 0.35 - i * 0.35 ) * MM );
		const knee = v( sx * 1.3, 0.5, ( 1 - i ) * 0.9 );
		hip.add( rod( v( 0, 0, 0 ), knee, 0.04 * MM, legMat ) );
		hip.add( rod( knee, v( sx * 2.4, - 2.4, ( 1 - i ) * 2.2 - 0.6 ), 0.03 * MM, legMat ) );
		body.add( hip );
		legs.push( { hip, sx, i } );

	}

	finish( body, group, [ wings.wingMat, wings.fanMat ] );

	// t: seconds. flight: 0 hovering, 1 full speed. beat: 0 wings folded.
	function pose( t, flight = 0, beat = 1 ) {

		wings.beat( t, beat );
		for ( const { hip, sx, i } of legs ) {

			hip.rotation.x = - flight * ( 0.5 + i * 0.25 ) + Math.sin( t * 2.1 + i ) * 0.05;
			hip.rotation.z = sx * ( 0.1 - flight * 0.35 );

		}

		body.rotation.x = - 0.1 + flight * 0.08;

	}

	pose( 0 );
	return { group, pose, ix: eyes, length: 6 * MM, radius: 1.2 * MM };

}
