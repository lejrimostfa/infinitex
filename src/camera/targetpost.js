// Depth effects on a frame the page drew itself, for the camera kit
// (kit.js, option target). The aquarium is the case: the pane and the
// camera port each draw the scene twice and mix the two (waterline.js), so
// the frame cannot go through post.js. The waterline composes its picture
// with a depth buffer (compose(), rtC); this pipeline reads it:
//   AO      GTAO from that depth (normals rebuilt from it), over the
//           colour: contacts of the cubes on the sand, the corners of the
//           tank
//   gi      (option) SSGI bounce light, as in post.js but with normals
//           rebuilt from the depth (no MRT here) and the frame's own
//           colour standing in for the albedo: a small gain (bounce 0.15).
//           No TRAA in this mode (no velocity target), so 2 slices
//   shafts  light added before the blur, such as the sun's shafts in the
//           water (src/core/shafts.js)
//   blur    depth of field (dof.js), the same lens as the other pages
//   grade   bloom, colour grade and vignette (grade.js), after the blur,
//           on linear colour; the pipeline tone maps after it
// One pipeline serves both waterlines: draw( line ) points it at that
// line's target. drawTarget( rt ) takes a plain render of the scene: the
// aquarium uses it beside the tank, where no waterline is drawn. (There
// the frame did go through post.js at first, and its depth of field
// blurred everything: the water surface reads the screen in the middle of
// the pass, and the pass's depth was no longer the scene's.)
// The grade comes after the blur. The bloom is glare of the image the lens
// formed: a defocused glint spreads into its bokeh disc first, then glows.
// The vignette and the tints belong to the frame, not to a depth: blurred,
// the dark corners would bleed by depth. followLens sets the output node on
// each lens toggle; it sets it here through a small adapter that grades
// the node first, so the grade survives the swap.
//
// Event bus: listens to the lens's 'dofToggled' (through followLens, dof.js).

import * as THREE from 'three/webgpu';
import { texture, screenUV, uniform, vec4, mix, reference, perspectiveDepthToViewZ } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { followLens } from './dof.js';
import { createGrade } from './grade.js';

// first: a target with a depth texture, to build the graph on (any later
// target of the same kind can be drawn).
// shafts: an object with sample( uv ) (a light node) and render( depth
// texture ), such as createShafts() of src/core/shafts.js; its light is
// added before the blur.
// grade: null for none (no extra pass), or createGrade() settings ({} for
// the default look, grade.js).
// gi: SSGI bounce light. aoMax: the largest AO radius (m); 0.25 suits a
// tank, a beach with palms wants metres.
export function createTargetPost( renderer, camera, first, { lens = null, shafts = null, grade = null, gi = false, aoMax = 0.25 } = {} ) {

	const pipeline = new THREE.RenderPipeline( renderer );
	const colour = texture( first.texture ), depth = texture( first.depthTexture );
	const aoPass = ao( depth, null, camera );
	aoPass.resolutionScale = 0.5;
	const strength = uniform( 0.8 );
	let lit = colour.sample( screenUV ).rgb.mul( mix( 1, aoPass.getTextureNode().sample( screenUV ).r, strength ) );
	const bounce = uniform( 0.15 );
	let giPass = null;
	if ( gi ) {

		giPass = ssgi( colour, depth, null, camera );
		giPass.resolutionScale = 0.5;
		giPass.sliceCount.value = 2;
		giPass.stepCount.value = 8;
		giPass.aoIntensity.value = 0;
		giPass.giIntensity.value = 1;
		giPass.useTemporalFiltering = false;
		lit = lit.add( colour.sample( screenUV ).rgb.mul( giPass.rgb ).mul( bounce ) );

	}

	if ( shafts ) lit = lit.add( shafts.sample( screenUV ) );
	const shaded = vec4( lit, 1 );
	const viewZ = perspectiveDepthToViewZ( depth.sample( screenUV ).r, reference( 'near', 'float', camera ), reference( 'far', 'float', camera ) );
	const graded = grade ? createGrade( grade ) : null;
	let base = null, gradeOn = !! graded; // base: the sharp or the blurred frame
	const output = () => { pipeline.outputNode = gradeOn ? graded.apply( base ) : base; pipeline.needsUpdate = true; };
	// followLens writes outputNode and needsUpdate on a lens toggle: this
	// adapter takes the node and outputs it graded.
	const stage = { set outputNode( n ) { base = n; output(); }, set needsUpdate( v ) {} };
	stage.outputNode = followLens( stage, shaded, viewZ, lens );

	return {
		pipeline, aoPass, giPass, bounce, strength, grade: graded,
		// The grade on or off, for an A/B from the console (it must exist).
		useGrade( on ) { gradeOn = !! on && !! graded; output(); },
		// line: a createWaterline(). dist: camera to subject, meters.
		draw( line, dist ) { this.drawTarget( line.compose(), dist ); },
		// rt: any target with the frame in linear colour and a depth texture.
		drawTarget( rt, dist ) {

			colour.value = rt.texture;
			depth.value = rt.depthTexture;
			aoPass.radius.value = THREE.MathUtils.clamp( dist * 0.12, 1e-5, aoMax );
			aoPass.thickness.value = aoPass.radius.value * 2;
			shafts?.render( rt.depthTexture );
			pipeline.render();

		},
	};

}
