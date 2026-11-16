// Depth effects on a frame the page drew itself, for the camera kit
// (kit.js, option target). The aquarium is the case: the pane and the
// camera port each draw the scene twice and mix the two (waterline.js), so
// the frame cannot go through post.js. The waterline composes its picture
// with a depth buffer (compose(), rtC); this pipeline reads it:
//   AO      GTAO from that depth (normals rebuilt from it), over the
//           colour: contacts of the cubes on the sand, the corners of the
//           tank
//   shafts  light added before the blur, such as the sun's shafts in the
//           water (src/core/shafts.js)
//   blur    depth of field (dof.js), the same lens as the other pages
// One pipeline serves both waterlines: draw( line ) points it at that
// line's target. drawTarget( rt ) takes a plain render of the scene: the
// aquarium uses it beside the tank, where no waterline is drawn. (There
// the frame did go through post.js at first, and its depth of field
// blurred everything: the water surface reads the screen in the middle of
// the pass, and the pass's depth was no longer the scene's.)
//
// Event bus: listens to the lens's 'dofToggled' (through followLens, dof.js).

import * as THREE from 'three/webgpu';
import { texture, screenUV, uniform, vec4, mix, reference, perspectiveDepthToViewZ } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { followLens } from './dof.js';

// first: a target with a depth texture, to build the graph on (any later
// target of the same kind can be drawn).
// shafts: an object with sample( uv ) (a light node) and render( depth
// texture ), such as createShafts() of src/core/shafts.js; its light is
// added before the blur.
export function createTargetPost( renderer, camera, first, { lens = null, shafts = null } = {} ) {

	const pipeline = new THREE.RenderPipeline( renderer );
	const colour = texture( first.texture ), depth = texture( first.depthTexture );
	const aoPass = ao( depth, null, camera );
	aoPass.resolutionScale = 0.5;
	const strength = uniform( 0.8 );
	let lit = colour.sample( screenUV ).rgb.mul( mix( 1, aoPass.getTextureNode().sample( screenUV ).r, strength ) );
	if ( shafts ) lit = lit.add( shafts.sample( screenUV ) );
	const shaded = vec4( lit, 1 );
	const viewZ = perspectiveDepthToViewZ( depth.sample( screenUV ).r, reference( 'near', 'float', camera ), reference( 'far', 'float', camera ) );
	pipeline.outputNode = followLens( pipeline, shaded, viewZ, lens );

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
			shafts?.render( rt.depthTexture );
			pipeline.render();

		},
	};

}
