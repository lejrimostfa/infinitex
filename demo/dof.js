// Depth of field for the demo pages, with a focus that follows what the
// camera aims at, and a macro lens when it comes very close.
//
//   focus     the nearest mesh in a small area around the screen centre
//             (five rays every 120 ms, or less often when they are slow;
//             nothing farther than maxFocus, 30 m). The focus distance eases
//             to it, like a focus pull. Nothing under the centre: the
//             orbit target, with a deep, weak blur that still shows the
//             scene.
//   depth     the sharp zone shrinks with the distance, as with a real
//             lens: at 3 m almost everything is sharp, at 1 cm only about
//             a centimetre is.
//   macro     under 12 cm the field of view narrows from the page's own
//             (40 degrees) to 22 degrees at 3 cm: less perspective, a
//             softer background, as a macro lens.
//
// The blur itself is three's DepthOfFieldNode (bokeh on a half-size
// target). Its circle of confusion is linear: 0 at the focus distance, 1
// at `range` meters from it.
//
// Off with ?nodof, in film mode, in an automated browser (unless ?dof),
// or with the F key.
//
// Event bus: createFocus returns an EventTarget. It emits
//   dofToggled   { enabled }           F key or the enabled setter
//   macroChanged { macro }             the macro lens goes on or off
// focus.cast = walk.surfaceAhead gives it the walk's fast ray (collide.js).
// The page calls update( dt ) once per frame, after controls.update(),
// and draws through demo/post.js, which ends with withDof().

import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

// Whether a page starts with the effect on. Automated browsers (the tests,
// the gate, the benches) get the plain image unless they ask with ?dof.
export const dofWanted = ( params, filmMode = false ) => ! filmMode && ! params.has( 'nodof' ) && ( ! navigator.webdriver || params.has( 'dof' ) );

const smooth = ( a, b, x ) => { const k = THREE.MathUtils.clamp( ( x - a ) / ( b - a ), 0, 1 ); return k * k * ( 3 - 2 * k ); };

export function createFocus( { camera, controls, scene, renderer, enabled = true, macroFov = 22, macroFrom = 0.12, macroFull = 0.03, maxFocus = 30 } ) {

	const bus = new EventTarget();
	const distance = uniform( 1 ), range = uniform( 1 ), bokeh = uniform( 0 );
	const baseFov = camera.fov;
	const ray = new THREE.Raycaster();
	const centre = new THREE.Vector2( 0, 0 );
	const fwd = new THREE.Vector3();
	const visible = ( o ) => { for ( let p = o; p; p = p.parent ) if ( ! p.visible ) return false; return true; };
	let on = enabled, aimed = null, logD = null, weight = 1, macro = 0, macroOn = false;
	let nextRay = 0, every = 120;

	// What the camera aims at: the nearest mesh under five points around the
	// screen centre, as a camera's autofocus area. A figure a little off
	// centre wins over the landscape behind it. Distance in meters, or null.
	const AREA = [ [ 0, 0 ], [ 0.16, 0 ], [ - 0.16, 0 ], [ 0, 0.16 ], [ 0, - 0.16 ] ];
	const ok = ( h ) => h.object.isMesh && visible( h.object ) && ! h.object.userData.noFocus && ! h.object.userData.hairStrands;
	function aim() {

		const t = performance.now();
		scene.updateMatrixWorld();
		let best = null;
		for ( const [ x, y ] of AREA ) {

			ray.setFromCamera( centre.set( x, y ), camera );
			// bus.cast: the walk's BVH ray (collide.js), about 0.02 ms. Without
			// it three tests every triangle: 34 ms on the aquarium's fine meshes.
			const d = bus.cast ? bus.cast( ray.ray.origin, ray.ray.direction, maxFocus ) : ray.intersectObjects( scene.children, true ).find( ok )?.distance;
			if ( d !== undefined && d < maxFocus && ( best === null || d < best ) ) best = d;

		}

		const cost = performance.now() - t;
		every = cost > 6 ? 800 : cost > 2 ? 300 : 120; // a dense skinned mesh is slow to cross
		return best;

	}

	addEventListener( 'keydown', ( e ) => {

		if ( e.code !== 'KeyF' || e.ctrlKey || e.metaKey || /INPUT|SELECT|TEXTAREA/.test( e.target?.tagName ?? '' ) ) return;
		bus.enabled = ! on;

	} );

	Object.defineProperty( bus, 'enabled', {
		get: () => on,
		set( v ) {

			if ( on === !! v ) return;
			on = !! v;
			bus.dispatchEvent( Object.assign( new Event( 'dofToggled' ), { enabled: on } ) );

		},
	} );

	bus.update = ( dt ) => {

		const now = performance.now();
		if ( now >= nextRay ) { aimed = on ? aim() : null; nextRay = now + every; }
		camera.getWorldDirection( fwd );
		const fallback = Math.max( 1e-4, controls ? controls.target.clone().sub( camera.position ).dot( fwd ) : 1 );
		const target = Math.log( Math.max( 1e-4, aimed ?? fallback ) );
		const k = 1 - Math.exp( - Math.min( dt, 0.1 ) / 0.18 );
		logD = logD === null ? target : logD + ( target - logD ) * k;
		weight += ( ( aimed === null ? 0 : 1 ) - weight ) * k;
		const d = Math.exp( logD );

		// Sharp zone, as a share of the focus distance: 1 at 1 cm, 3 at 3 m.
		// Twice as deep, and half the blur, when nothing is aimed at.
		const share = THREE.MathUtils.lerp( 1, 3, smooth( - 2, 0.5, Math.log10( d ) ) );
		distance.value = d;
		range.value = d * share * THREE.MathUtils.lerp( 2, 1, weight );
		// The bokeh step is in pixels of the drawing buffer: scale it so the
		// blur keeps its size on screen when the pixel ratio changes.
		const px = renderer ? renderer.getPixelRatio() : 1;
		bokeh.value = on ? 2.2 * px * THREE.MathUtils.lerp( 0.5, 1, weight ) : 0;

		// Macro lens: the field of view narrows as the subject comes close.
		const want = on ? 1 - smooth( Math.log( macroFull ), Math.log( macroFrom ), logD ) : 0;
		macro += ( want - macro ) * ( 1 - Math.exp( - Math.min( dt, 0.1 ) / 0.35 ) );
		const fov = THREE.MathUtils.lerp( baseFov, macroFov, macro );
		if ( Math.abs( fov - camera.fov ) > 0.01 ) { camera.fov = fov; camera.updateProjectionMatrix(); }
		if ( ( macro > 0.5 ) !== macroOn ) {

			macroOn = macro > 0.5;
			bus.dispatchEvent( Object.assign( new Event( 'macroChanged' ), { macro: macroOn } ) );

		}

	};

	Object.defineProperty( bus, 'macro', { get: () => macro } ); // 0 to 1, how far the macro lens is in
	return Object.assign( bus, { distance, range, bokeh } );

}

// Blurs a colour node by the scene's view depth. viewZ: the pass's
// getViewZNode().
export function withDof( color, viewZ, focus ) {

	return dof( color, viewZ, focus.distance, focus.range, focus.bokeh );

}
