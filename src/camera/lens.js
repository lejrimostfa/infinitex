// The lens of the camera kit: a focus that follows what the camera aims
// at, a depth of field that shrinks like a real lens, and a macro field of
// view when the camera comes very close to a surface.
//
//   focus     the surface under the screen centre, found every frame by the
//             shared BVH collider (collide.js, about 0.02 ms a ray). The
//             focus distance eases to it in log space (time constant
//             0.18 s), like a focus pull, so a switch from a near object to
//             a far one never jumps. Nothing under the centre: the orbit
//             target, with a deep, weak blur that still shows the scene.
//   depth     the sharp zone is a share of the focus distance: 1 at 1 cm,
//             3 at 3 m. At 3 m almost everything is sharp; at 1 cm only
//             about a centimetre is.
//   macro     driven by the same eased focus distance. Above macroFrom
//             (12 cm) the field of view is the page's own (40 degrees in
//             the demos). Between macroFrom and macroFull (3 cm) it
//             narrows to macroFov (22 degrees), then holds. The change
//             eases again (0.35 s) both ways.
//
// The blur itself is three's DepthOfFieldNode, drawn by post.js. This
// module only owns its three uniforms: distance, range and bokeh.
//
// Event bus: createLens returns an EventTarget (kit.js forwards all). It
// emits CustomEvents:
//   dofToggled    { enabled }            the lens goes on or off (F key or setter)
//   focusChanged  { distance, object }   the aimed object changes, or the eased
//                                        focus distance moves by 5 %
//   fovChanged    { fov }                the camera field of view changed
//   macroChanged  { macro }              the macro lens goes in (true) or out
// update( dt ) runs once per frame, after controls.update().

import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

const smooth = ( a, b, x ) => { const k = THREE.MathUtils.clamp( ( x - a ) / ( b - a ), 0, 1 ); return k * k * ( 3 - 2 * k ); };

// surfaceAhead: the collider of collide.js. dof, macro: which parts exist.
// enabled: whether the lens starts on.
export function createLens( { camera, controls, renderer, surfaceAhead, dof = true, macro = true, enabled = true, macroFov = 22, macroFrom = 0.12, macroFull = 0.03, key = 'KeyF' } ) {

	const bus = new EventTarget();
	const emit = ( type, detail ) => bus.dispatchEvent( new CustomEvent( type, { detail } ) );
	const distance = uniform( 1 ), range = uniform( 1 ), bokeh = uniform( 0 );
	const fwd = new THREE.Vector3(), toTarget = new THREE.Vector3();
	let on = enabled, aimed = null, aimedObject = null, logD = null, weight = 1, inMacro = 0, macroOn = false;
	let sentD = 0, sentObject = null, written = camera.fov; // the last fov this lens set
	bus.baseFov = camera.fov; // the page's own field of view; a page may change it

	const onKey = ( e ) => {

		if ( e.code !== key || e.ctrlKey || e.metaKey || /INPUT|SELECT|TEXTAREA/.test( e.target?.tagName ?? '' ) ) return;
		bus.enabled = ! on;

	};
	if ( key ) addEventListener( 'keydown', onKey );
	bus.dispose = () => removeEventListener( 'keydown', onKey );

	Object.defineProperty( bus, 'enabled', {
		get: () => on,
		set( v ) {

			if ( on === !! v ) return;
			on = !! v;
			emit( 'dofToggled', { enabled: on } );

		},
	} );

	bus.update = ( dt ) => {

		dt = Math.min( dt, 0.1 );
		camera.getWorldDirection( fwd );
		if ( on ) {

			// The centre ray: distance along the view axis to the first surface.
			const h = surfaceAhead( camera.position, fwd, camera.far );
			aimed = h < Infinity ? h : null;
			aimedObject = aimed === null ? null : surfaceAhead.object;

		} else { aimed = null; aimedObject = null; }

		const fallback = Math.max( 1e-4, controls ? toTarget.copy( controls.target ).sub( camera.position ).dot( fwd ) : 1 );
		const target = Math.log( Math.max( 1e-4, aimed ?? fallback ) );
		const k = 1 - Math.exp( - dt / 0.18 );
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
		bokeh.value = on && dof ? 2.2 * px * THREE.MathUtils.lerp( 0.5, 1, weight ) : 0;

		// Macro lens: the field of view narrows as the subject comes close.
		const want = on && macro ? 1 - smooth( Math.log( macroFull ), Math.log( macroFrom ), logD ) : 0;
		inMacro += ( want - inMacro ) * ( 1 - Math.exp( - dt / 0.35 ) );
		if ( want === 0 && inMacro < 1e-4 ) inMacro = 0;
		const fov = THREE.MathUtils.lerp( bus.baseFov, macroFov, inMacro );
		if ( macro && ( Math.abs( fov - written ) > 0.01 || ( inMacro === 0 && fov !== written ) ) ) {

			camera.fov = written = fov;
			camera.updateProjectionMatrix();
			emit( 'fovChanged', { fov } );

		}

		if ( ( inMacro > 0.5 ) !== macroOn ) {

			macroOn = inMacro > 0.5;
			emit( 'macroChanged', { macro: macroOn } );

		}

		if ( on && ( aimedObject !== sentObject || Math.abs( Math.log( d / sentD ) ) > Math.log( 1.05 ) ) ) {

			sentD = d;
			sentObject = aimedObject;
			emit( 'focusChanged', { distance: d, object: aimedObject } );

		}

	};

	Object.defineProperty( bus, 'macro', { get: () => inMacro } ); // 0 to 1, how far the macro lens is in
	Object.defineProperty( bus, 'focusDistance', { get: () => Math.exp( logD ?? 0 ) } );
	return Object.assign( bus, { distance, range, bokeh, hasDof: dof, hasMacro: macro } );

}
