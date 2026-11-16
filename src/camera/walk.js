// Walk and click to focus, a part of the camera kit (kit.js). Works with
// the page's OrbitControls: the mouse still orbits and zooms; this adds
//   keys     arrows, or ZQSD on AZERTY / WASD on QWERTY (read by physical
//            key, e.code, so both layouts work): forward and back follow the
//            view direction (looking down, forward goes down); left and
//            right strafe. Space up, C down, Shift faster. Camera and
//            orbit target move together, so orbiting stays centred.
//            Speed follows the distance to the target and to the surface
//            ahead (about 0.8 of it per second), so the same keys walk a
//            room or creep along a stitch, and the approach feels the same
//            at every scale. No minimum speed while a surface is ahead. In
//            the macro band the step shrinks by zoomGain (lens.js), the
//            share the narrowing field already adds (speedScale: false
//            keeps maxSpeed / 3 everywhere).
//   walls    a ray along the move finds the surface ahead. Speed also
//            follows that distance, and a step covers at most a share of
//            the room left (exponential approach), so the camera slows
//            down near a surface and never passes through it. The ray
//            query and what it skips live in collide.js (collider: null
//            turns walls off).
//   click    a click (not a drag) on a mesh glides the camera to it: a
//            small object is framed whole, a large one (floor, wall) is
//            approached at the point clicked. The view direction is kept.
// Meshes with userData.noFocus are skipped (a water surface over the
// objects under it).
// Event bus: the returned object is an EventTarget. It emits
//   focusStarted { object, point }   a glide begins (CustomEvent detail)
//   focusEnded   { object }          the camera has arrived
// kit.js forwards both to the kit. update( dt ) runs once per frame,
// before controls.update().

import * as THREE from 'three/webgpu';

const MOVE = {
	ArrowUp: [ 0, 1 ], KeyW: [ 0, 1 ], ArrowDown: [ 0, - 1 ], KeyS: [ 0, - 1 ],
	ArrowLeft: [ - 1, 0 ], KeyA: [ - 1, 0 ], ArrowRight: [ 1, 0 ], KeyD: [ 1, 0 ],
};

// collider: a createCollider() of collide.js, or null for no walls.
export function createWalk( { camera, controls, scene, collider = null, dom = controls.domElement, minSpeed = 0.02, maxSpeed = 3, speedScale = true, zoomGain = () => 1 } ) {

	const bus = new EventTarget();
	const emit = ( type, detail ) => bus.dispatchEvent( new CustomEvent( type, { detail } ) );
	const down = new Set();
	const typing = ( e ) => /INPUT|SELECT|TEXTAREA/.test( e.target?.tagName ?? '' );
	const onKeyDown = ( e ) => {

		if ( typing( e ) ) return;
		if ( MOVE[ e.code ] || e.code === 'Space' || e.code === 'KeyC' ) e.preventDefault();
		down.add( e.code );
		glide = null; // a key takes the camera back

	};
	const onKeyUp = ( e ) => down.delete( e.code );
	const onBlur = () => down.clear();

	// Click versus drag: a press that moves under 5 px and lasts under 0.35 s.
	let press = null, glide = null;
	const onPointerDown = ( e ) => { press = { x: e.clientX, y: e.clientY, t: performance.now() }; glide = null; };
	const onPointerUp = ( e ) => {

		if ( ! press ) return;
		const moved = Math.hypot( e.clientX - press.x, e.clientY - press.y ), dt = performance.now() - press.t;
		press = null;
		if ( e.button === 0 && moved < 5 && dt < 350 ) focusAt( e.clientX, e.clientY );

	};
	addEventListener( 'keydown', onKeyDown );
	addEventListener( 'keyup', onKeyUp );
	addEventListener( 'blur', onBlur );
	dom.addEventListener( 'pointerdown', onPointerDown );
	dom.addEventListener( 'pointerup', onPointerUp );
	bus.dispose = () => {

		removeEventListener( 'keydown', onKeyDown );
		removeEventListener( 'keyup', onKeyUp );
		removeEventListener( 'blur', onBlur );
		dom.removeEventListener( 'pointerdown', onPointerDown );
		dom.removeEventListener( 'pointerup', onPointerUp );

	};

	const ray = new THREE.Raycaster();
	const ndc = new THREE.Vector2();
	function focusAt( x, y ) {

		const r = dom.getBoundingClientRect();
		ndc.set( ( x - r.left ) / r.width * 2 - 1, - ( ( y - r.top ) / r.height ) * 2 + 1 );
		scene.updateMatrixWorld();
		ray.setFromCamera( ndc, camera );
		const hit = ray.intersectObjects( scene.children, true ).find( ( h ) => h.object.isMesh && visible( h.object ) && ! h.object.userData.noFocus );
		if ( ! hit ) return;
		const box = new THREE.Box3().setFromObject( hit.object );
		const sphere = box.getBoundingSphere( new THREE.Sphere() );
		const dir = camera.position.clone().sub( controls.target ).normalize();
		let to, dist;
		if ( sphere.radius < 1.5 ) {

			to = sphere.center;
			dist = Math.max( sphere.radius * 2.4, 0.02 );

		} else {

			to = hit.point;
			dist = Math.min( camera.position.distanceTo( hit.point ), 1.2 );

		}

		glide = { t: 0, object: hit.object, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: to.clone(), toP: to.clone().addScaledVector( dir, dist ) };
		emit( 'focusStarted', { object: hit.object, point: hit.point } );

	}

	const visible = ( o ) => { for ( let p = o; p; p = p.parent ) if ( ! p.visible ) return false; return true; };
	const fwd = new THREE.Vector3(), right = new THREE.Vector3(), step = new THREE.Vector3(), dir = new THREE.Vector3();
	const surfaceAhead = collider ?? ( () => Infinity ); // collide.js: BVH raycast
	const ease = ( k ) => k * k * ( 3 - 2 * k );
	const MARGIN = 1e-4; // m, half of controls.minDistance (stage.js)

	bus.update = ( dt ) => {

		if ( glide ) {

			// The glide runs on wall time (0.7 s), even when frames are slow.
			glide.t = Math.min( 1, glide.t + Math.min( dt, 0.25 ) / 0.7 );
			const k = ease( glide.t );
			controls.target.lerpVectors( glide.fromT, glide.toT, k );
			camera.position.lerpVectors( glide.fromP, glide.toP, k );
			if ( glide.t === 1 ) {

				emit( 'focusEnded', { object: glide.object } );
				glide = null;

			}

			return;

		}

		dt = Math.min( dt, 0.1 ); // a stalled frame does not jump the walker
		let mx = 0, my = 0, mz = 0;
		for ( const c of down ) if ( MOVE[ c ] ) { mx += MOVE[ c ][ 0 ]; mz += MOVE[ c ][ 1 ]; }
		if ( down.has( 'Space' ) ) my += 1;
		if ( down.has( 'KeyC' ) ) my -= 1;
		if ( ! mx && ! my && ! mz ) return;
		camera.getWorldDirection( fwd ); // full view direction, pitch included
		right.set( 1, 0, 0 ).applyQuaternion( camera.quaternion ); // camera right, also valid looking straight down
		const d = camera.position.distanceTo( controls.target );
		step.set( 0, 0, 0 ).addScaledVector( fwd, mz ).addScaledVector( right, mx );
		step.y += my;
		if ( step.lengthSq() < 1e-12 ) return;
		dir.copy( step ).normalize();
		const want = Math.min( step.length(), 1 ); // keys held: 1, diagonals are not faster
		const h = surfaceAhead( camera.position, dir, Math.max( d, maxSpeed ) * 2 );
		// Felt speed: the distance shrinks by the same share each second, far
		// or at a stitch. So no floor while a surface is ahead (a floor made the
		// last 2 cm four times faster), and the macro lens share is taken out.
		const near = speedScale ? Math.min( d, h ) * 0.8 * zoomGain( h ) : maxSpeed / 3;
		const floor = speedScale && h < Infinity ? 0 : minSpeed;
		const speed = THREE.MathUtils.clamp( near, floor, maxSpeed ) * ( down.has( 'ShiftLeft' ) || down.has( 'ShiftRight' ) ? 3 : 1 );
		// Never closer than MARGIN, perpendicular to the surface (a slanted
		// approach stops sooner along the path, as approach.js does); each
		// frame covers at most 1 - e^(-4 dt) of the room left.
		const n = surfaceAhead.normal, cos = n ? Math.max( Math.abs( dir.dot( n ) ), 0.02 ) : 1;
		const room = Math.max( 0, h - MARGIN / cos );
		const len = Math.min( want * speed * dt, room * ( 1 - Math.exp( - 4 * dt ) ) );
		if ( len <= 0 ) return;
		step.copy( dir ).multiplyScalar( len );
		camera.position.add( step );
		controls.target.add( step );

	};

	bus.surfaceAhead = surfaceAhead; // the BVH ray (the kit shares the same collider with lens.js)
	return bus;

}
