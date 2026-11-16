// The camera kit (src/camera) with the demo URL flags:
//   ?nodof     the lens (macro field of view and depth of field) starts off
//   ?dof       the lens starts on, even in an automated browser
//   ?fullres   no adaptive resolution
//   ?film      film mode: lens off, full resolution
// Automated browsers (tests, the gate, benches) get the plain image unless
// they ask with ?dof. The F key toggles the lens on every page.
// Event bus: the kit itself (see src/camera/kit.js); pages listen to it.

import { createCameraKit } from '../src/camera/index.js';

export const lensWanted = ( params, film = params.has( 'film' ) ) => ! film && ! params.has( 'nodof' ) && ( ! navigator.webdriver || params.has( 'dof' ) );

export function createDemoKit( { renderer, scene, camera, controls, params, options = {} } ) {

	const film = params.has( 'film' );
	return createCameraKit( {
		renderer, scene, camera, controls,
		options: { lensOn: lensWanted( params, film ), adaptive: ! film && ! params.has( 'fullres' ), ...options },
	} );

}
