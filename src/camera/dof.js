// Depth of field nodes of the camera kit: three's DepthOfFieldNode, driven
// by the focus uniforms of a lens (lens.js: distance, range, bokeh).
//   withDof           blurs a colour node by a view depth
//   followLens        an output node that is blurred while the lens is on
//   createDofPipeline one scene pass then the blur, for a page with no AO
// Event bus: followLens listens to the lens's 'dofToggled' and swaps the
// pipeline's output node, so with the lens off no blur pass is drawn.

import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

// viewZ: a pass's getViewZNode(), or any node of view-space z.
export function withDof( color, viewZ, lens ) {

	return dof( color, viewZ, lens.distance, lens.range, lens.bokeh );

}

// Output node that follows the lens: blurred while it is on, sharp when off.
export function followLens( pipeline, sharp, viewZ, lens ) {

	if ( ! lens?.hasDof ) return sharp;
	const blurred = withDof( sharp, viewZ, lens );
	lens.addEventListener( 'dofToggled', ( e ) => { pipeline.outputNode = e.detail.enabled ? blurred : sharp; pipeline.needsUpdate = true; } );
	return lens.enabled ? blurred : sharp;

}

// With the lens off the scene is drawn straight to the screen.
export function createDofPipeline( renderer, scene, camera, lens ) {

	const pipeline = new THREE.RenderPipeline( renderer );
	const scenePass = pass( scene, camera );
	pipeline.outputNode = followLens( pipeline, scenePass, scenePass.getViewZNode(), lens );
	return {
		pipeline, scenePass,
		render() { if ( lens.enabled ) pipeline.render(); else renderer.render( scene, camera ); },
		async renderAsync() { if ( lens.enabled ) await pipeline.renderAsync(); else await renderer.renderAsync( scene, camera ); },
	};

}
