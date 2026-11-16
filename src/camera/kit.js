// The camera kit: everything the Infinitex demos do with the camera, in one
// object a game can drop in. Each part can be turned off with an option.
//
//   walk        keys move along the view direction, a click glides to an
//               object (walk.js)
//   collide     the walk slows down near a surface and stops 0.1 mm from
//               it (collide.js, BVH ray, shared with the lens)
//   speedScale  walk speed follows the distance to the target, to the
//               surface ahead and to the nearest surface beside (a strafe
//               over the floor slows down too)
//   macro       field of view from the page's own to 22 degrees between
//               12 cm and 3 cm from the surface at the screen centre (lens.js)
//   dof         depth of field on the nearest surface of a small autofocus
//               area around the centre (lens.js, dof.js)
//   adaptive    pixel ratio lowered while frames are slow (adaptive.js)
//   ao          GTAO and the 3D hair pass (post.js). aoLit: the AO dims the
//               ambient light inside the materials, not the finished colour
//   shadows     the sun's shadows in three cascades that follow the focus
//               (shadows.js)
//   target      for a page that draws its own frame into a target with a
//               depth texture (the aquarium's waterline): AO and depth of
//               field on that target (targetpost.js), render( rt ).
//               shafts: light added there before the blur (src/core/shafts.js)
//
// The subject distance (the eased focus distance, or the orbit distance
// without a lens) sets the AO radius and the shadow cascades.
// Event bus: the kit is an EventTarget. It forwards, as CustomEvents with
// the same detail, every event of its parts:
//   focusStarted, focusEnded           walk.js (click to glide)
//   focusChanged, fovChanged,
//   macroChanged, dofToggled           lens.js
//   pixelRatioChanged                  adaptive.js
// UI listens to the kit; it never reads the parts' internals.
// The page calls update( dt ) once per frame, then render().

import { createCollider } from './collide.js';
import { createWalk } from './walk.js';
import { createLens } from './lens.js';
import { createAdaptiveResolution } from './adaptive.js';
import { createPost } from './post.js';
import { createDofPipeline } from './dof.js';
import { createTargetPost } from './targetpost.js';
import { createSunCascades } from './shadows.js';

export const KIT_DEFAULTS = Object.freeze( {
	walk: true, collide: true, speedScale: true, minSpeed: 0.02, maxSpeed: 3,
	macro: true, macroFov: 22, macroFrom: 0.12, macroFull: 0.03,
	dof: true, lensKey: 'KeyF', maxFocus: 30, focusArea: true,
	adaptive: true, ao: true, aoLit: true,
	shadows: true, sun: null, shadowFar: 40,
	target: null, shafts: null,
} );

// Whether the lens (macro and depth of field) starts on. Automated browsers
// (tests, benches, films) get the plain image unless the page asks.
export const lensDefault = () => ! globalThis.navigator?.webdriver;

export function createCameraKit( { renderer, scene, camera, controls = null, dom = renderer.domElement, options = {} } ) {

	const o = { ...KIT_DEFAULTS, lensOn: lensDefault(), ...options };
	const kit = new EventTarget();
	const forward = ( part, types ) => { for ( const t of types ) part.addEventListener( t, ( e ) => kit.dispatchEvent( new CustomEvent( t, { detail: e.detail } ) ) ); };

	const wantLens = o.macro || o.dof;
	const collider = ( o.walk && o.collide ) || wantLens ? createCollider( scene, camera ) : null;
	const walk = o.walk && controls ? createWalk( {
		camera, controls, scene, dom, collider: o.collide ? collider : null,
		minSpeed: o.minSpeed, maxSpeed: o.maxSpeed, speedScale: o.speedScale,
	} ) : null;
	const lens = wantLens ? createLens( {
		camera, controls, renderer, surfaceAhead: collider, dof: o.dof, macro: o.macro, enabled: o.lensOn,
		macroFov: o.macroFov, macroFrom: o.macroFrom, macroFull: o.macroFull, key: o.lensKey,
		maxFocus: o.maxFocus, focusArea: o.focusArea,
	} ) : null;
	// Always built, so a page can read max or hold it; it only acts when enabled.
	const adaptive = createAdaptiveResolution( renderer, { enabled: !! o.adaptive } );
	const dofLens = o.dof ? lens : null;
	const post = o.target ? createTargetPost( renderer, camera, o.target, { lens: dofLens, shafts: o.shafts } )
		: o.ao ? createPost( renderer, scene, camera, { lens: dofLens, lit: o.aoLit } ) : null;
	const dofOnly = ! post && o.dof ? createDofPipeline( renderer, scene, camera, lens ) : null;
	// The sun: the given light, or the scene's first shadow-casting directional light.
	const sun = o.shadows ? o.sun ?? scene.children.find( ( c ) => c.isDirectionalLight && c.castShadow ) : null;
	const cascades = sun ? createSunCascades( { light: sun, camera, far: o.shadowFar } ) : null;

	if ( walk ) forward( walk, [ 'focusStarted', 'focusEnded' ] );
	if ( lens ) forward( lens, [ 'focusChanged', 'fovChanged', 'macroChanged', 'dofToggled' ] );
	forward( adaptive, [ 'pixelRatioChanged' ] );

	// Camera to subject, meters: the lens's eased focus distance, or the
	// orbit distance without a lens.
	const subject = () => lens ? lens.distance.value : controls ? camera.position.distanceTo( controls.target ) : 1;

	// AO radius and shadow cascades for a subject distance (a still frame
	// calls it alone, then renderAsync( 2 )).
	function prepare( dist = subject() ) {

		cascades?.update( dist );
		if ( post && ! o.target ) post.update( dist );
		kit.subject = dist;

	}

	// move: false holds the walk and the controls (a scripted camera path).
	// dist: the subject distance, a number or a function read after the
	// lens update; by default the lens's focus distance.
	function update( dt, { move = true, dist = null } = {} ) {

		adaptive.frame();
		if ( move ) {

			walk?.update( dt );
			controls?.update();

		}

		lens?.update( dt );
		prepare( typeof dist === 'function' ? dist() : dist ?? subject() );

	}

	// rt: in target mode, the frame the page drew (colour and depth).
	function render( rt = null ) {

		if ( o.target ) post.drawTarget( rt ?? o.target, kit.subject );
		else if ( post ) post.render();
		else if ( dofOnly ) dofOnly.render();
		else renderer.render( scene, camera );

	}

	// times: 2 for a still frame with aoLit (its ambient AO is one frame late).
	async function renderAsync( times = 1 ) {

		if ( o.target ) { render(); return; }
		if ( post ) await post.renderAsync( times );
		else if ( dofOnly ) await dofOnly.renderAsync();
		else await renderer.renderAsync( scene, camera );

	}

	function dispose() {

		walk?.dispose();
		lens?.dispose();

	}

	kit.subject = subject();
	return Object.assign( kit, { update, prepare, render, renderAsync, dispose, walk, lens, post, adaptive, collider, cascades, options: o } );

}
