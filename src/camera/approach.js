// Approach rules for the moves the walk does not own (camera kit).
//   wheel   OrbitControls dollies toward its target. With the target in
//           front of the surface under the cursor, the zoom crawls and stops
//           in the air; with the target behind it, the zoom speeds up and
//           goes through. So before each wheel step the target slides along
//           the view axis to the depth of that surface (no visible jump, the
//           view direction is kept). Each step then shrinks the distance to
//           the surface by the same share, far or at a stitch. The zoom
//           speed also takes out the macro lens share (lens.zoomGain).
//   guard   a ray from the last safe position to the new one: a surface in
//           between stops the camera MARGIN before it, and the target
//           follows. It runs around the kit's own moves (keys, click glide,
//           damping), and on every OrbitControls 'change' during a user
//           gesture: OrbitControls moves the camera inside its own pointer
//           and wheel handlers, outside the kit's update. Page scripts and
//           view buttons are free to jump.
// Event bus: listens to OrbitControls 'start', 'change', 'end'. The kit
// calls begin() before the moves of a frame and end() after them; the wheel
// listener runs in the capture phase, before OrbitControls reads the event.

import * as THREE from 'three/webgpu';

const MARGIN = 1e-4; // m, the walk's stop distance (walk.js)

export function createApproach( { camera, controls, dom, collider, lens = null } ) {

	const ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
	const fwd = new THREE.Vector3(), fix = new THREE.Vector3(), prev = new THREE.Vector3(), move = new THREE.Vector3();
	let base = controls.zoomSpeed, written = base;

	function onWheel( e ) {

		if ( ! controls.enabled || ! controls.enableZoom ) return;
		if ( controls.zoomSpeed !== written ) base = controls.zoomSpeed; // the page changed it
		const r = dom.getBoundingClientRect();
		ndc.set( ( e.clientX - r.left ) / r.width * 2 - 1, - ( ( e.clientY - r.top ) / r.height ) * 2 + 1 );
		camera.updateMatrixWorld();
		ray.setFromCamera( ndc, camera );
		const h = collider( ray.ray.origin, ray.ray.direction, controls.maxDistance * 4 );
		controls.zoomSpeed = written = base * ( lens?.zoomGain ? lens.zoomGain( h ) : 1 );
		if ( ! ( h < Infinity ) ) return;
		camera.getWorldDirection( fwd );
		const depth = ray.ray.direction.dot( fwd ) * h; // the hit's depth along the view axis
		if ( depth <= 0 ) return;
		// Not under minDistance: OrbitControls would push the camera back.
		controls.target.copy( camera.position ).addScaledVector( fwd, Math.max( depth, controls.minDistance ) );

	}

	// From prev (the last safe position) to where the camera is now.
	function check() {

		move.subVectors( camera.position, prev );
		const len = move.length();
		if ( len >= 1e-12 ) {

			move.divideScalar( len );
			const h = collider( prev, move, len + MARGIN / 0.02 );
			// MARGIN is a clearance perpendicular to the surface: along a grazing
			// path it takes a longer stretch (stop sooner), never less than MARGIN.
			const n = collider.normal, cos = n ? Math.max( Math.abs( move.dot( n ) ), 0.02 ) : 1;
			const room = MARGIN / cos;
			if ( h < len + room ) {

				fix.copy( prev ).addScaledVector( move, Math.max( 0, Math.min( len, h - room ) ) ).sub( camera.position );
				camera.position.add( fix );
				controls.target.add( fix );

			}

		}

		prev.copy( camera.position );

	}

	let gesture = false;
	const onStart = () => { gesture = true; prev.copy( camera.position ); };
	const onChange = () => { if ( gesture ) check(); };
	const onEnd = () => { gesture = false; };
	dom.addEventListener( 'wheel', onWheel, { capture: true, passive: true } );
	controls.addEventListener( 'start', onStart );
	controls.addEventListener( 'change', onChange );
	controls.addEventListener( 'end', onEnd );

	return {

		begin() {

			if ( ! gesture ) prev.copy( camera.position ); // a page jump between frames is free

		},

		end: check,

		dispose() {

			dom.removeEventListener( 'wheel', onWheel, { capture: true } );
			controls.removeEventListener( 'start', onStart );
			controls.removeEventListener( 'change', onChange );
			controls.removeEventListener( 'end', onEnd );

		},

	};

}
