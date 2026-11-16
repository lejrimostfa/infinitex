// Walk and click to focus, for the scene demos (living room, aquarium,
// knit). Works with the page's OrbitControls: the mouse still orbits and
// zooms; this adds
//   keys     arrows, or ZQSD on AZERTY / WASD on QWERTY (read by physical
//            key, e.code, so both layouts work): move on the ground plane
//            along the view. Space up, C down, Shift faster. Camera and
//            orbit target move together, so orbiting stays centred.
//            Speed follows the distance to the target (about 0.8 of it
//            per second), so the same keys walk a room or creep along a
//            stitch.
//   click    a click (not a drag) on a mesh glides the camera to it: a
//            small object is framed whole, a large one (floor, wall) is
//            approached at the point clicked. The view direction is kept.
// Meshes with userData.noFocus are skipped (a water surface over the
// objects under it).
// Event bus: the returned object is an EventTarget. It emits
//   focusStarted { object, point }   a glide begins
//   focusEnded   { object }          the camera has arrived
// The page calls update( dt ) once per frame, before controls.update().

import * as THREE from 'three/webgpu';

const MOVE = {
	ArrowUp: [ 0, 1 ], KeyW: [ 0, 1 ], ArrowDown: [ 0, - 1 ], KeyS: [ 0, - 1 ],
	ArrowLeft: [ - 1, 0 ], KeyA: [ - 1, 0 ], ArrowRight: [ 1, 0 ], KeyD: [ 1, 0 ],
};

export function createWalk( { camera, controls, scene, dom = controls.domElement, minSpeed = 0.02, maxSpeed = 3 } ) {

	const bus = new EventTarget();
	const down = new Set();
	const typing = ( e ) => /INPUT|SELECT|TEXTAREA/.test( e.target?.tagName ?? '' );
	addEventListener( 'keydown', ( e ) => {

		if ( typing( e ) ) return;
		if ( MOVE[ e.code ] || e.code === 'Space' || e.code === 'KeyC' ) e.preventDefault();
		down.add( e.code );
		glide = null; // a key takes the camera back

	} );
	addEventListener( 'keyup', ( e ) => down.delete( e.code ) );
	addEventListener( 'blur', () => down.clear() );

	// Click versus drag: a press that moves under 5 px and lasts under 0.35 s.
	let press = null, glide = null;
	dom.addEventListener( 'pointerdown', ( e ) => { press = { x: e.clientX, y: e.clientY, t: performance.now() }; glide = null; } );
	dom.addEventListener( 'pointerup', ( e ) => {

		if ( ! press ) return;
		const moved = Math.hypot( e.clientX - press.x, e.clientY - press.y ), dt = performance.now() - press.t;
		press = null;
		if ( e.button === 0 && moved < 5 && dt < 350 ) focusAt( e.clientX, e.clientY );

	} );

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
		bus.dispatchEvent( Object.assign( new Event( 'focusStarted' ), { object: hit.object, point: hit.point } ) );

	}

	const visible = ( o ) => { for ( let p = o; p; p = p.parent ) if ( ! p.visible ) return false; return true; };
	const fwd = new THREE.Vector3(), right = new THREE.Vector3(), step = new THREE.Vector3();
	const ease = ( k ) => k * k * ( 3 - 2 * k );

	bus.update = ( dt ) => {

		if ( glide ) {

			// The glide runs on wall time (0.7 s), even when frames are slow.
			glide.t = Math.min( 1, glide.t + Math.min( dt, 0.25 ) / 0.7 );
			const k = ease( glide.t );
			controls.target.lerpVectors( glide.fromT, glide.toT, k );
			camera.position.lerpVectors( glide.fromP, glide.toP, k );
			if ( glide.t === 1 ) {

				bus.dispatchEvent( Object.assign( new Event( 'focusEnded' ), { object: glide.object } ) );
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
		camera.getWorldDirection( fwd );
		fwd.y = 0;
		if ( fwd.lengthSq() < 1e-6 ) fwd.set( 0, 0, - 1 ).applyQuaternion( camera.quaternion ).setY( 0 );
		fwd.normalize();
		right.crossVectors( fwd, camera.up ).normalize();
		const d = camera.position.distanceTo( controls.target );
		const speed = THREE.MathUtils.clamp( d * 0.8, minSpeed, maxSpeed ) * ( down.has( 'ShiftLeft' ) || down.has( 'ShiftRight' ) ? 3 : 1 );
		step.set( 0, 0, 0 ).addScaledVector( fwd, mz ).addScaledVector( right, mx ).add( new THREE.Vector3( 0, my, 0 ) );
		if ( step.lengthSq() > 1 ) step.normalize();
		step.multiplyScalar( speed * dt );
		camera.position.add( step );
		controls.target.add( step );

	};

	return bus;

}
