// Depth of field for the demo pages, with a focus that follows what the
// camera aims at, and a macro lens when it comes very close.
//
//   focus     the mesh under the screen centre (a ray every 120 ms, or
//             less often when the ray is slow). The focus distance eases
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
// The page calls update( dt ) once per frame, after controls.update(),
// and draws through a pipeline whose output went through withDof().

import * as THREE from 'three/webgpu';
import { pass, uniform } from 'three/tsl';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

// Whether a page starts with the effect on. Automated browsers (the tests,
// the gate, the benches) get the plain image unless they ask with ?dof.
export const dofWanted = ( params, filmMode = false ) => ! filmMode && ! params.has( 'nodof' ) && ( ! navigator.webdriver || params.has( 'dof' ) );

const smooth = ( a, b, x ) => { const k = THREE.MathUtils.clamp( ( x - a ) / ( b - a ), 0, 1 ); return k * k * ( 3 - 2 * k ); };

export function createFocus( { camera, controls, scene, renderer, enabled = true, macroFov = 22, macroFrom = 0.12, macroFull = 0.03 } ) {

	const bus = new EventTarget();
	const distance = uniform( 1 ), range = uniform( 1 ), bokeh = uniform( 0 );
	const baseFov = camera.fov;
	const ray = new THREE.Raycaster();
	const centre = new THREE.Vector2( 0, 0 );
	const fwd = new THREE.Vector3();
	const visible = ( o ) => { for ( let p = o; p; p = p.parent ) if ( ! p.visible ) return false; return true; };
	let on = enabled, aimed = null, logD = null, weight = 1, macro = 0, macroOn = false;
	let nextRay = 0, every = 120;

	// What the screen centre shows: distance along the view axis, or null.
	function aim() {

		const t = performance.now();
		scene.updateMatrixWorld();
		ray.setFromCamera( centre, camera );
		const hit = ray.intersectObjects( scene.children, true ).find( ( h ) => h.object.isMesh && visible( h.object ) && ! h.object.userData.noFocus && ! h.object.userData.hairStrands );
		const cost = performance.now() - t;
		every = cost > 4 ? 600 : cost > 1.5 ? 300 : 120; // a dense skinned mesh is slow to cross
		return hit ? hit.distance : null;

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

// For a page with no post pass of its own: one scene pass, then the blur.
// With the effect off the scene is drawn straight to the screen.
export function createDofPipeline( renderer, scene, camera, focus ) {

	const pipeline = new THREE.RenderPipeline( renderer );
	const scenePass = pass( scene, camera );
	pipeline.outputNode = withDof( scenePass, scenePass.getViewZNode(), focus );
	return {
		pipeline, scenePass,
		render() { if ( focus.enabled ) pipeline.render(); else renderer.render( scene, camera ); },
	};

}
