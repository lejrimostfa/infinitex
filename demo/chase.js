// The chase camera of the flyer (flyer.js): it follows behind a vehicle.
// Drag looks around it, the wheel sets the distance. The view swings back
// behind the vehicle while it moves. A surface between the vehicle and
// the camera pulls the camera in, so it never looks from inside a wall.
// Pointer and wheel events are taken in the capture phase, only while
// the vehicle is flown, before the orbit controls and the walk see them.
// Event bus: none. The flyer calls follow( dt, state ) once per frame.

import * as THREE from 'three/webgpu';

// o: chase, chaseMin, chaseMax, chaseLift (radians above the horizon).
// ahead( from, dir, far ): the flyer's collider ray, vehicle skipped.
export function createChase( { camera, controls, dom, radius, ahead, o, isActive } ) {

	let camYaw = 0, camPitch = 0, dist = o.chase, glide = 0, drag = null;
	const dir = new THREE.Vector3(), eye = new THREE.Vector3();

	const own = ( e ) => { if ( ! isActive() ) return false; e.stopImmediatePropagation(); return true; };
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
	const opts = { capture: true };
	dom.addEventListener( 'pointerdown', onPointerDown, opts );
	dom.addEventListener( 'pointermove', onPointerMove, opts );
	dom.addEventListener( 'pointerup', onPointerUp, opts );
	dom.addEventListener( 'wheel', onWheel, { capture: true, passive: false } );

	return {

		// On boarding: behind the vehicle, the first second eases in from
		// where the orbit camera was.
		reset() { camYaw = camPitch = 0; dist = o.chase; glide = 1; drag = null; },

		// pos: the vehicle, yaw: its heading, aim: its nose angle (the
		// camera sits behind and under a nose that points up), moving:
		// whether it moves.
		follow( dt, pos, yaw, aim, moving ) {

			if ( ! drag && moving ) { const k = 1 - Math.exp( - dt / 1.5 ); camYaw -= camYaw * k; camPitch -= camPitch * k; }
			const a = yaw + Math.PI + camYaw, p = THREE.MathUtils.clamp( o.chaseLift - aim + camPitch, - 1.45, 1.45 );
			dir.set( Math.sin( a ) * Math.cos( p ), Math.sin( p ), Math.cos( a ) * Math.cos( p ) );
			const h = ahead( pos, dir, dist );
			const d = h < dist ? Math.max( radius * 1.2, h * 0.85 ) : dist;
			eye.copy( pos ).addScaledVector( dir, d );
			glide = Math.max( 0, glide - dt );
			camera.position.lerp( eye, 1 - Math.exp( - dt / ( glide > 0 ? 0.3 : 0.06 ) ) );
			camera.lookAt( pos );
			controls.target.copy( pos );

		},

		dispose() {

			dom.removeEventListener( 'pointerdown', onPointerDown, opts );
			dom.removeEventListener( 'pointermove', onPointerMove, opts );
			dom.removeEventListener( 'pointerup', onPointerUp, opts );
			dom.removeEventListener( 'wheel', onWheel, opts );

		},

	};

}
