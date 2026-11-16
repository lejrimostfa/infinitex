// A tiger mosquito (Aedes albopictus) built in code, for the Knit demo's
// flyer (demo/flyer.js). About 6 mm from the proboscis to the tail, legs
// 9 mm long, at real size: the camera can follow it into the wool.
//   eyes      the Infinitex insect eye (organic family, insecteye mode):
//             facets of 18 um that appear as the camera comes close
//   body      black cuticle with the white bands of the tiger mosquito,
//             on the abdomen and the legs (stripes along each part)
//   wings     thin clear membranes with a soft thin-film sheen, plus a
//             faint fan that shows the swept stroke while they beat
// Local frame: +Z forward (the proboscis), +Y up, origin at the thorax.
// pose( t, flight ) beats the wings and swings the legs; flight is 0 when
// hovering, 1 at full speed (the legs trail behind).
// Every mesh has userData.owner = the returned group, so the flyer's own
// collision ray can skip it (collide.js, skip).
// Event bus: none, a model driven by the flyer.

import * as THREE from 'three/webgpu';
import { positionLocal, fract, smoothstep, mix, color, float } from 'three/tsl';
import { createMaterial } from '../../src/index.js';
import { uvToMeters } from '../scene.js';

const MM = 1e-3;

// Black cuticle with white bands along one local axis, period in meters.
function banded( axis, period, white = 0.22 ) {

	const m = new THREE.MeshPhysicalNodeMaterial( { roughness: 0.45, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color( 0x8a8a90 ) } );
	const k = fract( positionLocal[ axis ].div( period ) );
	m.colorNode = mix( color( 0x0b0b0d ), color( 0xe8e6e0 ), smoothstep( 1 - white, 1 - white + 0.05, k ) );
	return m;

}

// An ellipsoid of half sizes a (x), b (y), c (z), in meters.
const blob = ( a, b, c, seg = 24 ) => new THREE.SphereGeometry( 1, seg, Math.round( seg * 0.7 ) ).scale( a, b, c );

// A thin cylinder from p to q, radius r.
function rod( p, q, r, material ) {

	const len = p.distanceTo( q );
	const g = new THREE.CylinderGeometry( r * 0.7, r, len, 6, 1 ).translate( 0, len / 2, 0 );
	const m = new THREE.Mesh( g, material );
	m.position.copy( p );
	m.quaternion.setFromUnitVectors( new THREE.Vector3( 0, 1, 0 ), q.clone().sub( p ).normalize() );
	return m;

}

// A wing: a long ellipse from the hinge (origin) toward -z, in the xz plane.
function wingGeometry( len, wide ) {

	const s = new THREE.Shape();
	s.moveTo( 0, 0 );
	s.bezierCurveTo( wide * 0.9, - len * 0.15, wide * 1.1, - len * 0.75, wide * 0.3, - len );
	s.bezierCurveTo( - wide * 0.15, - len * 0.85, - wide * 0.1, - len * 0.3, 0, 0 );
	return new THREE.ShapeGeometry( s, 10 ).rotateX( Math.PI / 2 );

}

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

	// Compound eyes: the Infinitex insect eye, UVs in meters on each sphere.
	const eyeR = 0.27 * MM;
	const eyes = createMaterial( { family: 'organic', mode: 'insecteye', size_mm: 1.2, feature_mm: 0.3, cell_um: 18, fiber_um: 3,
		color: '#2a2a2e', color2: '#3a5a50', color3: '#050506', color_variation: 0.1, fuzz: 0, relief: 1, roughness: 0.15, sheen: 0.4, seed: 7 } );
	for ( const sx of [ - 1, 1 ] ) {

		const g = uvToMeters( new THREE.SphereGeometry( eyeR, 28, 20 ), 2 * Math.PI * eyeR, Math.PI * eyeR );
		g.computeTangents();
		const e = add( new THREE.Mesh( g, eyes.material ) );
		e.position.set( sx * 0.17 * MM, 0.12 * MM, 1.02 * MM );

	}

	const v = ( x, y, z ) => new THREE.Vector3( x * MM, y * MM, z * MM );
	add( rod( v( 0, - 0.05, 1.2 ), v( 0, - 0.75, 3.1 ), 0.035 * MM, cuticle ) ); // proboscis
	for ( const sx of [ - 1, 1 ] ) add( rod( v( sx * 0.1, 0.15, 1.2 ), v( sx * 0.55, 0.6, 2.6 ), 0.02 * MM, cuticle ) ); // antennae
	add( rod( v( 0.12, 0.05, 1.15 ), v( 0.08, - 0.35, 2.4 ), 0.03 * MM, legMat ) ); // palps, white tipped
	add( rod( v( - 0.12, 0.05, 1.15 ), v( - 0.08, - 0.35, 2.4 ), 0.03 * MM, legMat ) );

	// Wings: hinged on the top of the thorax, lying back over the abdomen.
	const wingMat = new THREE.MeshPhysicalNodeMaterial( { color: 0xdfe6ee, roughness: 0.15, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
		iridescence: 0.8, iridescenceIOR: 1.4, iridescenceThicknessMinimum: 250, iridescenceThicknessMaximum: 600, depthWrite: false } );
	const fanMat = new THREE.MeshBasicNodeMaterial( { color: 0xd8dde4, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false } );
	const wings = [];
	const SPREAD = 1.2; // rad, how far a beating wing swings out from lying back
	for ( const sx of [ - 1, 1 ] ) {

		// hinge: the beat, a roll around the body axis. swing: from lying back
		// over the abdomen to standing out sideways.
		const hinge = new THREE.Group(), swing = new THREE.Group();
		hinge.position.set( sx * 0.25 * MM, 0.45 * MM, 0.1 * MM );
		swing.add( new THREE.Mesh( wingGeometry( 3.0 * MM, 0.42 * MM * sx ), wingMat ) );
		hinge.add( swing );
		body.add( hinge );
		// The swept stroke: a fan in the plane the beating wing sweeps.
		const start = sx > 0 ? - 0.6 : Math.PI - 0.9;
		const fan = new THREE.Mesh( new THREE.CircleGeometry( 2.9 * MM, 16, start, 1.5 ), fanMat );
		fan.position.copy( hinge.position );
		fan.rotation.y = sx * ( Math.PI / 2 - SPREAD );
		fan.renderOrder = 1;
		body.add( fan );
		wings.push( { hinge, swing, sx, fan } );

	}

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

	body.traverse( ( o ) => {

		if ( ! o.isMesh ) return;
		o.userData.owner = group;
		o.castShadow = o.material !== wingMat && o.material !== fanMat;

	} );

	// t: seconds. flight: 0 hovering, 1 full speed. beat: 0 wings folded.
	function pose( t, flight = 0, beat = 1 ) {

		// Real mosquitoes beat at about 600 Hz: here 31 Hz, which at 60 frames
		// a second lands on scattered angles, as a flutter would.
		const a = Math.sin( t * Math.PI * 2 * 31 );
		for ( const { hinge, swing, sx, fan } of wings ) {

			hinge.rotation.z = sx * ( beat ? 0.15 + a * 0.75 : 0.05 );
			swing.rotation.y = - sx * ( beat ? SPREAD : 0.08 );
			fan.visible = beat > 0;

		}

		for ( const { hip, sx, i } of legs ) {

			hip.rotation.x = - flight * ( 0.5 + i * 0.25 ) + Math.sin( t * 2.1 + i ) * 0.05;
			hip.rotation.z = sx * ( 0.1 - flight * 0.35 );

		}

		body.rotation.x = - 0.1 + flight * 0.08;

	}

	pose( 0 );
	return { group, pose, ix: eyes, length: 6 * MM, radius: 1.2 * MM };

}
