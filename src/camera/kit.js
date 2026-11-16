// The camera kit: everything the Infinitex demos do with the camera, in one
// object a game can drop in. Each part can be turned off with an option.
//
//   walk        keys move along the view direction, a click glides to an
//               object (walk.js)
//   collide     the walk slows down near a surface and stops 0.1 mm from
//               it (collide.js, BVH ray, shared with the lens)
//   speedScale  walk speed follows the distance to the target and to the
//               surface ahead
//   macro       field of view from the page's own to 22 degrees between
//               12 cm and 3 cm from the surface at the screen centre (lens.js)
//   dof         depth of field focused on that surface (lens.js, post.js)
//   adaptive    pixel ratio lowered while frames are slow (adaptive.js)
//   ao          GTAO and the 3D hair pass (post.js)
//
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
import { createPost, createDofPipeline } from './post.js';

export const KIT_DEFAULTS = Object.freeze( {
	walk: true, collide: true, speedScale: true, minSpeed: 0.02, maxSpeed: 3,
	macro: true, macroFov: 22, macroFrom: 0.12, macroFull: 0.03,
	dof: true, lensKey: 'KeyF',
	adaptive: true, ao: true,
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
	} ) : null;
	// Always built, so a page can read max or hold it; it only acts when enabled.
	const adaptive = createAdaptiveResolution( renderer, { enabled: !! o.adaptive } );
	const post = o.ao ? createPost( renderer, scene, camera, { lens: o.dof ? lens : null } ) : null;
	const dofOnly = ! o.ao && o.dof ? createDofPipeline( renderer, scene, camera, lens ) : null;

	if ( walk ) forward( walk, [ 'focusStarted', 'focusEnded' ] );
	if ( lens ) forward( lens, [ 'focusChanged', 'fovChanged', 'macroChanged', 'dofToggled' ] );
	forward( adaptive, [ 'pixelRatioChanged' ] );

	// move: false holds the walk and the controls (a scripted camera path).
	// dist: camera to surface for the AO radius, by default the orbit distance.
	function update( dt, { move = true, dist = null } = {} ) {

		adaptive.frame();
		if ( move ) {

			walk?.update( dt );
			controls?.update();

		}

		lens?.update( dt );
		post?.update( dist ?? ( controls ? camera.position.distanceTo( controls.target ) : 1 ) );

	}

	function render() {

		if ( post ) post.render();
		else if ( dofOnly ) dofOnly.render();
		else renderer.render( scene, camera );

	}

	async function renderAsync() {

		if ( post ) await post.renderAsync();
		else if ( dofOnly ) await dofOnly.renderAsync();
		else await renderer.renderAsync( scene, camera );

	}

	function dispose() {

		walk?.dispose();
		lens?.dispose();

	}

	return Object.assign( kit, { update, render, renderAsync, dispose, walk, lens, post, adaptive, collider, options: o } );

}
