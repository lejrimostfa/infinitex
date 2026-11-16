// The lens of the camera kit: a focus that follows what the camera aims
// at, a depth of field that shrinks like a real lens, and a macro field of
// view when the camera comes very close to a surface.
//
//   focus     the nearest surface under five points around the screen
//             centre, as a camera's autofocus area (focusArea; a figure a
//             little off centre wins over the landscape behind it), nothing
//             farther than maxFocus (30 m). Found every frame by the shared
//             BVH collider (collide.js, about 0.02 ms a ray). The focus
//             distance eases to it in log space (time constant 0.18 s),
//             like a focus pull, so a switch from a near object to a far one
//             never jumps. Nothing aimed at: the orbit target, with a deep,
//             weak blur that still shows the scene. The kit also uses this
//             distance for the AO radius and the shadow cascades.
//   depth     the sharp zone is a share of the focus distance: 1 at 1 cm,
//             3 at 3 m. At 3 m almost everything is sharp; at 1 cm only
//             about a centimetre is.
//   macro     driven by the surface at the screen centre only (the first
//             ray of the area), eased the same way. Above macroFrom
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
// The autofocus area, in NDC: the centre first (it also drives the macro).
const AREA = [ [ 0, 0 ], [ 0.16, 0 ], [ - 0.16, 0 ], [ 0, 0.16 ], [ 0, - 0.16 ] ];

export function createLens( { camera, controls, renderer, surfaceAhead, dof = true, macro = true, enabled = true, macroFov = 22, macroFrom = 0.12, macroFull = 0.03, maxFocus = 30, focusArea = true, key = 'KeyF' } ) {

	const bus = new EventTarget();
	const emit = ( type, detail ) => bus.dispatchEvent( new CustomEvent( type, { detail } ) );
	const distance = uniform( 1 ), range = uniform( 1 ), bokeh = uniform( 0 );
	const fwd = new THREE.Vector3(), toTarget = new THREE.Vector3();
	const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
	let on = enabled, aimed = null, aimedObject = null, centre = null, logD = null, logM = null, weight = 1, inMacro = 0, macroOn = false;
	let sentD = 0, sentObject = null, written = camera.fov; // the last fov this lens set
	bus.baseFov = camera.fov; // the page's own field of view; a page may change it
	bus.bokehScale = 1; // a page may soften the blur (the aquarium halves it under water)

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
		camera.updateMatrixWorld(); // the controls moved it; setFromCamera reads matrixWorld
		camera.getWorldDirection( fwd );
		aimed = null; aimedObject = null; centre = null;
		if ( on ) {

			// The autofocus area: the nearest hit within maxFocus. Ray 0 is the
			// screen centre, which alone drives the macro lens.
			const n = focusArea ? AREA.length : 1;
			for ( let i = 0; i < n; i ++ ) {

				ray.setFromCamera( ndc.set( AREA[ i ][ 0 ], AREA[ i ][ 1 ] ), camera );
				const h = surfaceAhead( ray.ray.origin, ray.ray.direction, maxFocus );
				if ( h >= maxFocus ) continue;
				if ( i === 0 ) centre = h;
				if ( aimed === null || h < aimed ) { aimed = h; aimedObject = surfaceAhead.object; }

			}

		}

		const fallback = Math.max( 1e-4, controls ? toTarget.copy( controls.target ).sub( camera.position ).dot( fwd ) : 1 );
		const k = 1 - Math.exp( - dt / 0.18 );
		const ease = ( log, to ) => log === null ? to : log + ( to - log ) * k;
		logD = ease( logD, Math.log( Math.max( 1e-4, aimed ?? fallback ) ) );
		logM = ease( logM, Math.log( Math.max( 1e-4, centre ?? fallback ) ) );
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
		bokeh.value = on && dof ? 2.2 * px * THREE.MathUtils.lerp( 0.5, 1, weight ) * bus.bokehScale : 0;

		// Macro lens: the field of view narrows as the subject comes close.
		const want = on && macro ? 1 - smooth( Math.log( macroFull ), Math.log( macroFrom ), logM ) : 0;
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

	// Share of a move that the image should get at distance h, so the felt
	// zoom stays the same while the macro lens narrows. Moving closer by a
	// ratio magnifies by that ratio; between macroFrom and macroFull the
	// narrowing field adds s = d ln tan( fov / 2 ) / d ln h on top. So the
	// walk and the wheel scale their step by 1 / ( 1 + s ). 1 outside the band.
	const tanHalf = ( h ) => Math.tan( THREE.MathUtils.degToRad( THREE.MathUtils.lerp( bus.baseFov, macroFov, 1 - smooth( Math.log( macroFull ), Math.log( macroFrom ), Math.log( h ) ) ) ) / 2 );
	bus.zoomGain = ( h ) => {

		if ( ! on || ! macro || ! ( h > 0 && h < Infinity ) ) return 1;
		const e = 0.02, s = Math.log( tanHalf( h * Math.exp( e ) ) / tanHalf( h * Math.exp( - e ) ) ) / ( 2 * e );
		return 1 / ( 1 + Math.max( 0, s ) );

	};

	Object.defineProperty( bus, 'macro', { get: () => inMacro } ); // 0 to 1, how far the macro lens is in
	Object.defineProperty( bus, 'focusDistance', { get: () => Math.exp( logD ?? 0 ) } );
	return Object.assign( bus, { distance, range, bokeh, hasDof: dof, hasMacro: macro } );

}
