// Parts shared by the insects built in code (mosquito.js, bee.js): banded
// cuticle, ellipsoids, thin rods, compound eyes, beating wings, legs.
// All sizes in meters. Event bus: none, building blocks.

import * as THREE from 'three/webgpu';
import { positionLocal, fract, smoothstep, mix, color } from 'three/tsl';
import { createMaterial } from '../../src/index.js';
import { uvToMeters } from '../scene.js';

// Cuticle with bands along one local axis: dark, then light over the last
// share `light` of each period (meters). light 0: plain dark.
export function banded( axis, period, light = 0.22, { dark = 0x0b0b0d, pale = 0xe8e6e0, sheen = 0x8a8a90, sheenAmount = 0.6, roughness = 0.45 } = {} ) {

	const m = new THREE.MeshPhysicalNodeMaterial( { roughness, sheen: sheenAmount, sheenRoughness: 0.5, sheenColor: new THREE.Color( sheen ) } );
	const k = fract( positionLocal[ axis ].div( period ) );
	m.colorNode = light > 0 ? mix( color( dark ), color( pale ), smoothstep( 1 - light, 1 - light + 0.05, k ) ) : color( dark );
	return m;

}

// An ellipsoid of half sizes a (x), b (y), c (z).
export const blob = ( a, b, c, seg = 24 ) => new THREE.SphereGeometry( 1, seg, Math.round( seg * 0.7 ) ).scale( a, b, c );

// A thin cylinder from p to q, radius r (0.7 r at q).
export function rod( p, q, r, material ) {

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

// Compound eyes: the Infinitex insect eye (organic family), UVs in meters
// on each ellipsoid. r: radius, scale: [ x, y, z ] stretch, at: [ x, y, z ]
// of the right eye (the left one mirrored). preset: overrides.
export function addEyes( body, { r, scale = [ 1, 1, 1 ], at, preset = {} } ) {

	const eyes = createMaterial( { family: 'organic', mode: 'insecteye', size_mm: 1.2, feature_mm: 0.3, cell_um: 18, fiber_um: 3,
		color: '#2a2a2e', color2: '#3a5a50', color3: '#050506', color_variation: 0.1, fuzz: 0, relief: 1, roughness: 0.15, sheen: 0.4, seed: 7, ...preset } );
	for ( const sx of [ - 1, 1 ] ) {

		const g = uvToMeters( new THREE.SphereGeometry( r, 28, 20 ).scale( ...scale ), 2 * Math.PI * r * Math.max( scale[ 0 ], scale[ 2 ] ), Math.PI * r * scale[ 1 ] );
		g.computeTangents();
		const e = new THREE.Mesh( g, eyes.material );
		e.position.set( sx * at[ 0 ], at[ 1 ], at[ 2 ] );
		body.add( e );

	}

	return eyes;

}

// Wings hinged on the thorax, lying back over the abdomen at rest and
// standing out sideways while they beat, with a faint fan that shows the
// swept stroke. pairs: [ { at: [ x, y, z ], len, wide } ] (right side,
// mirrored), freq: shown beats a second (real insects beat 200 to 600 Hz;
// about 30 Hz at 60 frames a second lands on scattered angles, as a
// flutter would). Returns beat( t, on ) and the two materials.
export function addWings( body, { pairs, freq = 31, spread = 1.2, opacity = 0.28, tint = 0xdfe6ee, fan = 0.035 } ) {

	const wingMat = new THREE.MeshPhysicalNodeMaterial( { color: tint, roughness: 0.15, transparent: true, opacity, side: THREE.DoubleSide,
		iridescence: 0.8, iridescenceIOR: 1.4, iridescenceThicknessMinimum: 250, iridescenceThicknessMaximum: 600, depthWrite: false } );
	const fanMat = new THREE.MeshBasicNodeMaterial( { color: 0xd8dde4, transparent: true, opacity: fan, side: THREE.DoubleSide, depthWrite: false } );
	const wings = [];
	pairs.forEach( ( { at, len, wide }, k ) => {

		for ( const sx of [ - 1, 1 ] ) {

			// hinge: the beat, a roll around the body axis. swing: from lying
			// back over the abdomen to standing out sideways.
			const hinge = new THREE.Group(), swing = new THREE.Group();
			hinge.position.set( sx * at[ 0 ], at[ 1 ], at[ 2 ] );
			swing.add( new THREE.Mesh( wingGeometry( len, wide * sx ), wingMat ) );
			hinge.add( swing );
			body.add( hinge );
			const f = new THREE.Mesh( new THREE.CircleGeometry( len * 0.97, 16, sx > 0 ? - 0.6 : Math.PI - 0.9, 1.5 ), fanMat );
			f.position.copy( hinge.position );
			f.rotation.y = sx * ( Math.PI / 2 - spread );
			f.renderOrder = 1;
			body.add( f );
			wings.push( { hinge, swing, sx, fan: f, lag: k * 0.6 } );

		}

	} );

	function beat( t, on ) {

		for ( const { hinge, swing, sx, fan: f, lag } of wings ) {

			const a = Math.sin( t * Math.PI * 2 * freq - lag );
			hinge.rotation.z = sx * ( on ? 0.15 + a * 0.75 : 0.05 );
			swing.rotation.y = - sx * ( on ? spread : 0.08 );
			f.visible = on > 0;

		}

	}

	return { beat, wingMat, fanMat };

}

// Mark every mesh as the vehicle's own (collide.js, skip) and set shadows:
// all cast except the given see-through materials.
export function finish( body, group, clear ) {

	body.traverse( ( o ) => {

		if ( ! o.isMesh ) return;
		o.userData.owner = group;
		o.castShadow = ! clear.includes( o.material );

	} );

}
