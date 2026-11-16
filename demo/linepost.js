// Depth effects after a waterline pass (src/core/waterline.js), for the
// aquarium: the pane and the camera port each draw the scene twice and
// mix the two, so the frame cannot go through demo/post.js. The waterline
// composes its picture with a depth buffer (compose(), rtC); this pipeline
// reads it:
//   AO      GTAO from that depth (normals rebuilt from it), over the
//           colour: contacts of the cubes on the sand, the corners of the
//           tank
//   blur    depth of field (demo/dof.js), the same focus as the other pages
// One pipeline serves both waterlines: draw( line ) points it at that
// line's target. drawTarget( rt ) takes a plain render of the scene: the
// aquarium uses it beside the tank, where no waterline is drawn. (There
// the frame did go through demo/post.js at first, and its depth of field
// blurred everything: the water surface reads the screen in the middle of
// the pass, and the pass's depth was no longer the scene's.)
//
// Event bus: listens to the focus's dofToggled (demo/dof.js).

import * as THREE from 'three/webgpu';
import { texture, screenUV, uniform, vec4, mix, reference, perspectiveDepthToViewZ } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { withDof } from './dof.js';

export function createLinePost( renderer, camera, first, { focus = null } = {} ) {

	const pipeline = new THREE.RenderPipeline( renderer );
	const colour = texture( first.rtC.texture ), depth = texture( first.rtC.depthTexture );
	const aoPass = ao( depth, null, camera );
	aoPass.resolutionScale = 0.5;
	const strength = uniform( 0.8 );
	const shaded = vec4( colour.sample( screenUV ).rgb.mul( mix( 1, aoPass.getTextureNode().sample( screenUV ).r, strength ) ), 1 );
	const viewZ = perspectiveDepthToViewZ( depth.sample( screenUV ).r, reference( 'near', 'float', camera ), reference( 'far', 'float', camera ) );
	const blurred = focus ? withDof( shaded, viewZ, focus ) : null;
	pipeline.outputNode = focus?.enabled ? blurred : shaded;
	focus?.addEventListener( 'dofToggled', ( e ) => { pipeline.outputNode = e.enabled ? blurred : shaded; pipeline.needsUpdate = true; } );

	return {
		pipeline, aoPass, strength,
		// line: a createWaterline(). dist: camera to subject, meters.
		draw( line, dist ) { this.drawTarget( line.compose(), dist ); },
		// rt: any target with the frame in linear colour and a depth texture.
		drawTarget( rt, dist ) {

			colour.value = rt.texture;
			depth.value = rt.depthTexture;
			aoPass.radius.value = THREE.MathUtils.clamp( dist * 0.12, 1e-5, 0.25 );
			aoPass.thickness.value = aoPass.radius.value * 2;
			pipeline.render();

		},
	};

}
