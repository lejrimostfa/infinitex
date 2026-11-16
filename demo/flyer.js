// A tiny vehicle the visitor can fly, shared by the demos: the mosquito of
// the Knit page, the toy helicopter of All matters, more to come.
// One controller, tuned per vehicle (FLYER_DEFAULTS):
//   keys      (flyinput.js, with touch from flytouch.js) Space / C up and
//             down, Z / S nose down and up, Q / D turn, arrows forward,
//             back and sideways, Shift slower, V boards or leaves. The nose
//             keeps its angle when the key is released.
//   hover     no move key: the speed eases to zero and the vehicle hangs
//             in place (a mosquito, a bee, a helicopter all can)
//   path      forward and back follow the nose (nose down and forward
//             dives); sideways stays level; up and down are straight
//   attitude  a turn banks the body. plane: true (an insect) shows the
//             whole nose angle; plane: false (a helicopter) shows a part
//             of it and dips the nose to fly forward (tilt)
//   idle      'hover' (bobs in place before boarding) or 'landed' (sits
//             still, rotor stopped: the pose gets beat 0)
//   scale     the speed follows the distance to the surface ahead, as the
//             camera walk does (walk.js): across the room at maxSpeed,
//             along a stitch at a crawl. Never closer than the body radius
//   chase     the camera follows behind (chase.js)
//   bounds    { min, max } (Vector3): a box the vehicle stays in (the toy
//             submarine keeps under the water of its tank)
// While flying, the orbit controls and the camera walk hold still (app.js
// passes move: false to the kit); the lens, AO and shadows keep working.
// vehicle: { group, pose( t, flight, beat ), radius } (demo/vehicles/).
// Event bus: an EventTarget. It emits
//   vehicleBoarded { name }   the camera now follows the vehicle
//   vehicleLeft    { name }   the orbit camera is back, centred on it
// The page's UI (flyhud.js) listens; the loop calls update( dt, t ).

import * as THREE from 'three/webgpu';
import { createChase } from './chase.js';
import { createFlyInput } from './flyinput.js';

export const FLYER_DEFAULTS = Object.freeze( {
	name: 'vehicle', key: 'KeyV', idle: 'hover',
	maxSpeed: 0.5, minSpeed: 0.008, near: 2.5, turnRate: 2.2, pitchRate: 1.1, maxPitch: 1.35, response: 3, slow: 0.3,
	chase: 0.03, chaseMin: 0.008, chaseMax: 0.6, chaseLift: 0.3,
	plane: true, bank: 0.7, nose: 0.3, tilt: 0.15, // nose: share of the aim a helicopter body shows
	bounds: null,
} );

export function createFlyer( { vehicle, camera, controls, dom, collider = null, home, options = {} } ) {

	const o = { ...FLYER_DEFAULTS, ...options };
	const bus = new EventTarget();
	const emit = ( type ) => bus.dispatchEvent( new CustomEvent( type, { detail: { name: o.name } } ) );
	const { group } = vehicle;
	const pos = home.clone(), vel = new THREE.Vector3();
	let yaw = 0, aim = 0, pitch = 0, roll = 0, active = false; // aim: the nose angle the keys set, radians up

	// The kit's BVH collider (collide.js), set here or later by app.js.
	bus.collider = collider ?? null;
	const ahead = ( from, d, far ) => bus.collider ? bus.collider( from, d, far, group ) : Infinity;
	const chase = createChase( { camera, controls, dom, radius: vehicle.radius, ahead, o, isActive: () => active } );

	// Keys and touch (flyinput.js); input.touch is written by flytouch.js.
	const input = createFlyInput( { key: o.key, toggle: () => active ? leave() : board(), isActive: () => active } );
	bus.input = input;

	function board() {

		if ( active ) return;
		active = true;
		input.clear();
		chase.reset();
		controls.enabled = false;
		emit( 'vehicleBoarded' );

	}

	function leave() {

		if ( ! active ) return;
		active = false;
		vel.set( 0, 0, 0 );
		home.copy( pos );
		controls.target.copy( pos );
		controls.enabled = true;
		emit( 'vehicleLeft' );

	}

	const fwd = new THREE.Vector3(), side = new THREE.Vector3(), dir = new THREE.Vector3(), want = new THREE.Vector3(), step = new THREE.Vector3();

	// One frame of flight. Returns how fast it goes, 0 to 1.
	function fly( dt ) {

		const { throttle, strafe, lift, turn, nose, slow } = input.read();
		yaw += turn * o.turnRate * dt;
		aim = THREE.MathUtils.clamp( aim + nose * o.pitchRate * dt, - o.maxPitch, o.maxPitch );
		fwd.set( Math.sin( yaw ) * Math.cos( aim ), Math.sin( aim ), Math.cos( yaw ) * Math.cos( aim ) ); // where the nose points
		side.set( - Math.cos( yaw ), 0, Math.sin( yaw ) ); // the vehicle's right, level

		// The wanted move, then its speed: the room ahead sets the top speed,
		// as the walk does; Shift slows down.
		want.copy( fwd ).multiplyScalar( throttle ).addScaledVector( side, strafe );
		want.y += lift;
		if ( want.lengthSq() > 1 ) want.normalize();
		let top = 0;
		if ( want.lengthSq() > 1e-6 ) {

			const room = ahead( pos, dir.copy( want ).normalize(), o.maxSpeed * 4 );
			top = THREE.MathUtils.clamp( ( room - vehicle.radius ) * o.near, o.minSpeed, o.maxSpeed ) * ( slow ? o.slow : 1 );

		}

		want.multiplyScalar( top );
		vel.lerp( want, 1 - Math.exp( - dt * o.response ) ); // no key: eases to a hover

		// Never closer than the body radius; the part of the speed into the
		// surface is dropped, so the vehicle slides along it.
		step.copy( vel ).multiplyScalar( dt );
		const len = step.length();
		if ( len > 1e-9 ) {

			dir.copy( step ).divideScalar( len );
			const h = ahead( pos, dir, len + vehicle.radius * 2 );
			const free = Math.max( 0, h - vehicle.radius );
			if ( free < len ) {

				step.copy( dir ).multiplyScalar( free );
				vel.addScaledVector( dir, - vel.dot( dir ) );

			}

			pos.add( step );

		}

		if ( o.bounds ) {

			// Out of the box: back in, and the speed out of it is dropped.
			const before = dir.copy( pos );
			pos.clamp( o.bounds.min, o.bounds.max );
			if ( before.x !== pos.x ) vel.x = 0;
			if ( before.y !== pos.y ) vel.y = 0;
			if ( before.z !== pos.z ) vel.z = 0;

		}

		// Attitude: banked in turns, the nose angle in full (plane) or in
		// part with a dip to fly forward (helicopter). rotation.x > 0 is nose down.
		const speed = vel.length(), share = Math.min( 1, speed / ( o.maxSpeed * 0.5 ) );
		const k = 1 - Math.exp( - dt * 5 );
		const forward = vel.dot( fwd ) / o.maxSpeed * o.tilt * ( o.plane ? 1 - share : 1 );
		roll += ( ( strafe * 0.6 - turn ) * o.bank * Math.max( share, 0.3 ) - roll ) * k; // into the turn, and toward a sideways move
		pitch += ( - aim * ( o.plane ? 1 : o.nose ) + forward - pitch ) * k;
		return share;

	}

	bus.update = ( dt, t ) => {

		dt = Math.min( dt, 0.1 );
		let flight = 0;
		if ( active ) {

			flight = fly( dt );
			chase.follow( dt, pos, yaw, aim, vel.lengthSq() > 1e-6 );

		} else pos.copy( home );

		group.position.copy( pos );
		const hovering = active || o.idle === 'hover';
		if ( ! active && hovering ) group.position.y += Math.sin( t * 2.3 ) * vehicle.radius * 0.4; // a hover bob
		group.rotation.set( pitch, yaw, roll, 'YXZ' );
		vehicle.pose( t, flight, hovering ? 1 : 0 );

	};

	bus.board = board;
	bus.leave = leave;
	bus.dispose = () => {

		input.dispose();
		chase.dispose();

	};
	bus.model = vehicle;
	Object.defineProperty( bus, 'active', { get: () => active } );
	Object.defineProperty( bus, 'position', { get: () => pos } );
	Object.defineProperty( bus, 'yaw', { get: () => yaw, set: ( v ) => { yaw = v; } } );
	Object.defineProperty( bus, 'aim', { get: () => aim, set: ( v ) => { aim = v; } } );
	return bus;

}
