// A tiny vehicle the visitor can fly, shared by the demos: the mosquito of
// the Knit page today, a bee, a toy helicopter and a toy submarine later.
// One controller, tuned per vehicle:
//   keys      W / S or up / down arrows: forward, back (ZQSD on AZERTY:
//             read by physical key). A / D or left / right: turn. Space up,
//             C down, Shift faster. V boards or leaves.
//   hover     no key held: the speed eases to zero and the vehicle hangs
//             in place (a mosquito, a bee, a helicopter all can)
//   plane     at speed, a turn banks the body and a climb lifts the nose
//   scale     the speed follows the distance to the surface ahead, as the
//             camera walk does (walk.js): across the room at maxSpeed,
//             along a stitch at a crawl. Never closer than the body radius
//   chase     the camera follows behind. Drag to look around, the wheel
//             sets the distance; the camera stays in front of any surface
//             between it and the vehicle
// While flying, the orbit controls and the camera walk hold still (app.js
// passes move: false to the kit); the lens, AO and shadows keep working.
// Pointer and wheel events are taken in the capture phase, before the
// orbit controls and the walk see them.
// vehicle: { group, pose( t, flight, beat ), radius } (demo/vehicles/).
// Event bus: an EventTarget. It emits
//   vehicleBoarded { name }   the camera now follows the vehicle
//   vehicleLeft    { name }   the orbit camera is back, centred on it
// The page's UI (flyhud.js) listens; the loop calls update( dt, t ).

import * as THREE from 'three/webgpu';

const KEYS = {
	fwd: [ 'KeyW', 'ArrowUp' ], back: [ 'KeyS', 'ArrowDown' ], left: [ 'KeyA', 'ArrowLeft' ], right: [ 'KeyD', 'ArrowRight' ],
	up: [ 'Space' ], down: [ 'KeyC' ], fast: [ 'ShiftLeft', 'ShiftRight' ],
};
const FLIGHT_KEYS = new Set( Object.values( KEYS ).flat() );

export const FLYER_DEFAULTS = Object.freeze( {
	name: 'vehicle', key: 'KeyV',
	maxSpeed: 0.5, minSpeed: 0.008, climb: 0.35, turnRate: 2.2, response: 3, boost: 3,
	chase: 0.03, chaseMin: 0.008, chaseMax: 0.6, chaseLift: 0.3,
	bank: 0.7, nose: 0.6,
} );

export function createFlyer( { vehicle, camera, controls, dom, collider = null, home, options = {} } ) {

	const o = { ...FLYER_DEFAULTS, ...options };
	const bus = new EventTarget();
	const emit = ( type ) => bus.dispatchEvent( new CustomEvent( type, { detail: { name: o.name } } ) );
	const { group } = vehicle;
	const pos = home.clone(), vel = new THREE.Vector3();
	let yaw = 0, pitch = 0, roll = 0, active = false, camYaw = 0, camPitch = 0, dist = o.chase, glide = 0;

	// Keys: a held set, read by physical key.
	const down = new Set();
	const held = ( k ) => KEYS[ k ].some( ( c ) => down.has( c ) );
	const typing = ( e ) => /INPUT|SELECT|TEXTAREA/.test( e.target?.tagName ?? '' );
	const onKeyDown = ( e ) => {

		if ( typing( e ) || e.ctrlKey || e.metaKey ) return;
		if ( e.code === o.key && ! e.repeat ) { active ? leave() : board(); return; }
		if ( active && FLIGHT_KEYS.has( e.code ) ) e.preventDefault();
		down.add( e.code );

	};
	const onKeyUp = ( e ) => down.delete( e.code );
	const onBlur = () => down.clear();

	// Pointer: drag looks around the vehicle, the wheel sets the distance.
	let drag = null;
	const own = ( e ) => { if ( ! active ) return false; e.stopImmediatePropagation(); return true; };
	const onPointerDown = ( e ) => { if ( own( e ) ) drag = { x: e.clientX, y: e.clientY }; };
	const onPointerMove = ( e ) => {

		if ( ! drag || ! own( e ) ) return;
		camYaw -= ( e.clientX - drag.x ) * 0.006;
		camPitch = THREE.MathUtils.clamp( camPitch + ( e.clientY - drag.y ) * 0.006, - 1.2, 1.2 );
		drag.x = e.clientX; drag.y = e.clientY;

	};
	const onPointerUp = ( e ) => { if ( own( e ) ) drag = null; };
	const onWheel = ( e ) => {

		if ( ! own( e ) ) return;
		e.preventDefault();
		dist = THREE.MathUtils.clamp( dist * Math.exp( e.deltaY * 0.0015 ), o.chaseMin, o.chaseMax );

	};
	addEventListener( 'keydown', onKeyDown );
	addEventListener( 'keyup', onKeyUp );
	addEventListener( 'blur', onBlur );
	dom.addEventListener( 'pointerdown', onPointerDown, { capture: true } );
	dom.addEventListener( 'pointermove', onPointerMove, { capture: true } );
	dom.addEventListener( 'pointerup', onPointerUp, { capture: true } );
	dom.addEventListener( 'wheel', onWheel, { capture: true, passive: false } );

	function board() {

		if ( active ) return;
		active = true;
		down.clear();
		camYaw = camPitch = 0;
		dist = o.chase;
		glide = 1; // the first second eases the camera in from where it was
		controls.enabled = false;
		emit( 'vehicleBoarded' );

	}

	function leave() {

		if ( ! active ) return;
		active = false;
		drag = null;
		vel.set( 0, 0, 0 );
		home.copy( pos );
		controls.target.copy( pos );
		controls.enabled = true;
		emit( 'vehicleLeft' );

	}

	const fwd = new THREE.Vector3(), dir = new THREE.Vector3(), want = new THREE.Vector3(), step = new THREE.Vector3(), eye = new THREE.Vector3();
	// The kit's BVH collider (collide.js), set here or later by app.js.
	bus.collider = collider ?? null;
	const ahead = ( from, d, far ) => bus.collider ? bus.collider( from, d, far, group ) : Infinity;

	function fly( dt ) {

		const throttle = ( held( 'fwd' ) ? 1 : 0 ) - ( held( 'back' ) ? 0.4 : 0 );
		const turn = ( held( 'left' ) ? 1 : 0 ) - ( held( 'right' ) ? 1 : 0 );
		const lift = ( held( 'up' ) ? 1 : 0 ) - ( held( 'down' ) ? 1 : 0 );
		const boost = held( 'fast' ) ? o.boost : 1;
		yaw += turn * o.turnRate * dt;
		fwd.set( Math.sin( yaw ), 0, Math.cos( yaw ) );

		// Felt speed: the room ahead sets the top speed, as the walk does.
		dir.copy( fwd ).multiplyScalar( throttle || 1 ).normalize();
		const room = ahead( pos, dir, o.maxSpeed * 4 );
		const top = THREE.MathUtils.clamp( ( room - vehicle.radius ) * 2.5, o.minSpeed, o.maxSpeed ) * boost;
		want.copy( fwd ).multiplyScalar( throttle * top );
		want.y += lift * Math.min( o.climb, Math.max( top, o.minSpeed * 2 ) );
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

		// Body: banked in turns and nose up in a climb, at speed (plane);
		// level when hovering.
		const speed = Math.hypot( vel.x, vel.z ), share = Math.min( 1, speed / ( o.maxSpeed * 0.5 ) );
		const k = 1 - Math.exp( - dt * 5 );
		roll += ( - turn * o.bank * share - roll ) * k;
		pitch += ( - Math.atan2( vel.y, speed + o.climb * 0.3 ) * o.nose + vel.dot( fwd ) / o.maxSpeed * 0.15 * ( 1 - share ) - pitch ) * k;
		return share;

	}

	function chase( dt ) {

		// The view swings back behind the vehicle while it moves.
		if ( ! drag && vel.lengthSq() > 1e-6 ) { const k = 1 - Math.exp( - dt / 1.5 ); camYaw -= camYaw * k; camPitch -= camPitch * k; }
		const a = yaw + Math.PI + camYaw, p = o.chaseLift + camPitch;
		dir.set( Math.sin( a ) * Math.cos( p ), Math.sin( p ), Math.cos( a ) * Math.cos( p ) );
		const h = ahead( pos, dir, dist );
		const d = h < dist ? Math.max( vehicle.radius * 1.2, h * 0.85 ) : dist;
		eye.copy( pos ).addScaledVector( dir, d );
		// Eased in from the orbit view on boarding, then tight.
		glide = Math.max( 0, glide - dt );
		const tau = glide > 0 ? 0.3 : 0.06;
		camera.position.lerp( eye, 1 - Math.exp( - dt / tau ) );
		camera.lookAt( pos );
		controls.target.copy( pos );

	}

	bus.update = ( dt, t ) => {

		dt = Math.min( dt, 0.1 );
		let flight = 0;
		if ( active ) {

			flight = fly( dt );
			chase( dt );

		} else pos.copy( home );

		group.position.copy( pos );
		if ( ! active ) group.position.y += Math.sin( t * 2.3 ) * vehicle.radius * 0.4; // a hover bob
		group.rotation.set( pitch, yaw, roll, 'YXZ' );
		vehicle.pose( t, flight, 1 );

	};

	bus.board = board;
	bus.leave = leave;
	bus.dispose = () => {

		removeEventListener( 'keydown', onKeyDown );
		removeEventListener( 'keyup', onKeyUp );
		removeEventListener( 'blur', onBlur );
		dom.removeEventListener( 'pointerdown', onPointerDown, { capture: true } );
		dom.removeEventListener( 'pointermove', onPointerMove, { capture: true } );
		dom.removeEventListener( 'pointerup', onPointerUp, { capture: true } );
		dom.removeEventListener( 'wheel', onWheel, { capture: true } );

	};
	Object.defineProperty( bus, 'active', { get: () => active } );
	Object.defineProperty( bus, 'position', { get: () => pos } );
	Object.defineProperty( bus, 'yaw', { get: () => yaw, set: ( v ) => { yaw = v; } } );
	return bus;

}
