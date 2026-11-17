// Post-processing of the camera kit (kit.js), or alone (createPost).
// The frame, in one pipeline:
//   scene      one pass: colour, view normals (MRT) and depth
//   AO         GTAO (three/addons) from depth and normals: creases and
//              contacts, the sleeves on the torso, a fruit in its bowl.
//              The knit itself already has its own analytic AO.
//   hair       3D strands, drawn apart and laid over (see below)
//   gi         (option) SSGI: the light bounced from what is on screen,
//              taken by the diffuse colour (MRT), added to the frame
//   taa        (option) TRAA: the camera jitters by a sub-pixel each frame
//              and the history is reprojected by the velocities (MRT).
//              Edges are smooth, and the SSGI noise is averaged in time
//   blur       depth of field (dof.js), when a lens (lens.js) is given
//
// Two ways to apply AO:
//   lit: false   (game.html, the test page) the finished colour times AO,
//                as before.
//   lit: true    (the kit's default, aoLit) the materials read AO while they are
//                lit: it dims the ambient light in full, as occlusion
//                does. The finished colour then takes a part of it too
//                (DIRECT), which grounds objects that sit in full sun: not
//                physical, but without it a fruit in a sunlit bowl floats.
//                The ambient AO is the one of the frame before (drawn
//                after the scene, read by the next scene pass): one frame
//                late, which a moving camera hides. A single still frame
//                must be drawn twice (renderAsync( 2 ), as the film
//                recorder does).
//
// The AO radius is in world meters, so it follows the camera distance: at
// 1 mm from the wool a 25 cm radius means nothing.
//
// Event bus: listens to the lens's 'dofToggled' (dof.js swaps the output
// node, so with the lens off the blur passes are not drawn at all).
//
// 3D hair strands (layer HAIR_LAYER) are drawn in a pass of their own and
// laid over the AO-shaded scene where they are in front of it. Thousands of
// strands in the depth buffer made GTAO darken a square around the hair
// window; the strands have their own self-shadow and occlusion.

import * as THREE from 'three/webgpu';
import { HAIR_LAYER } from '../core/hair3d.js';
import { nodeObject, pass, mrt, output, normalView, directionToColor, colorToDirection, sample, screenUV, uniform, vec4, mix, texture, builtinAOContext, diffuseColor, velocity } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { followLens } from './dof.js';

// The hair pass: no background and a transparent clear, so thin strands
// keep their own coverage (alpha) instead of blending into the backdrop.
class HairPassNode extends THREE.PassNode {

	updateBefore( frame ) {

		const r = frame.renderer, s = this.scene, bg = s.background, bgNode = s.backgroundNode;
		const c = new THREE.Color(), a = r.getClearAlpha();
		r.getClearColor( c );
		s.background = null;
		s.backgroundNode = null; // a node sky (the living room) would fill the pass too
		r.setClearColor( 0x000000, 0 );
		super.updateBefore( frame );
		s.background = bg;
		s.backgroundNode = bgNode;
		r.setClearColor( c, a );

	}

}

const DIRECT = 0.55; // share of the AO that also dims direct light (lit)

// lens: a createLens() of lens.js, for the depth of field blur.
// lit: AO inside the lighting (see the header).
// With no option (game.html, the test page) the frame is AO over the
// colour, then the hair.
// gi: SSGI bounce light added to the GTAO-shaded frame (bounce: its
// gain). taa: TRAA before the blur. Both read more targets of the scene
// pass (diffuse colour, velocity).
export function createPost( renderer, scene, camera, { lens = null, lit = false, gi = false, taa = false } = {} ) {

	const pipeline = new THREE.RenderPipeline( renderer );
	const sceneLayers = new THREE.Layers();
	sceneLayers.enableAll();
	sceneLayers.disable( HAIR_LAYER );
	const hairLayers = new THREE.Layers();
	hairLayers.set( HAIR_LAYER );
	// TRAA copies the depth of the pass: it cannot be multisampled. It
	// smooths the edges itself, so the pass then needs no MSAA.
	const scenePass = taa ? pass( scene, camera, { samples: 0 } ) : pass( scene, camera );
	scenePass.setLayers( sceneLayers );
	const hairPass = nodeObject( new HairPassNode( THREE.PassNode.COLOR, scene, camera ) );
	hairPass.setLayers( hairLayers );
	// Strand meshes move to their own layer as they appear.
	const sortHair = () => scene.traverse( ( o ) => { if ( o.userData.hairStrands && ! o.layers.isEnabled( HAIR_LAYER ) ) o.layers.set( HAIR_LAYER ); } );
	scenePass.setMRT( mrt( { output, normal: directionToColor( normalView ), ...( gi ? { diffuse: diffuseColor } : {} ), ...( taa ? { velocity } : {} ) } ) );
	const color = scenePass.getTextureNode( 'output' );
	const normalTex = scenePass.getTextureNode( 'normal' );
	const normal = sample( ( uv ) => colorToDirection( normalTex.sample( uv ) ) );
	const depth = scenePass.getTextureNode( 'depth' );

	const aoPass = ao( depth, normal, camera );
	aoPass.resolutionScale = 0.5;
	const aoTex = aoPass.getTextureNode();
	const strength = uniform( 1 );
	let shaded;
	if ( lit ) {

		// The AO target of the frame before, as a plain texture: the AO node
		// itself must not sit in a material, or it would draw in the middle of
		// the scene pass.
		const aoPrev = texture( aoPass._aoRenderTarget.texture );
		scenePass.contextNode = builtinAOContext( mix( 1, aoPrev.sample( screenUV ).r, strength ) );
		// This frame's AO over the finished colour, at DIRECT of its strength:
		// it also keeps the AO pass in the graph, after the scene pass.
		shaded = color.rgb.mul( mix( 1, aoTex.sample( screenUV ).r, strength.mul( DIRECT ) ) );

	} else shaded = color.rgb.mul( mix( 1, aoTex.sample( screenUV ).r, strength ) );
	// Bounce light (gi): SSGI gathers the light of what is on screen around
	// each pixel; the diffuse colour of the surface takes it. Its own AO is
	// left out: GTAO above gives the contacts and the fine cavities this
	// scene is tuned with (SSGI's AO alone washed the room out and lost the
	// pores of the fruit). With TRAA: the low preset (1 slice of 12 steps)
	// at half size, 15 ms at 1080p at full size and 2 slices of 8. Bounce
	// light is soft by nature. Without TRAA: 2 slices of 8, still half size.
	// bounce 0.2: SSGI reads the HDR frame, where the sunset sky and the
	// lava are many times brighter than a wall; at 1 the room washed out.
	const bounce = uniform( 0.2 );
	let giPass = null;
	if ( gi ) {

		giPass = ssgi( color, depth, normal, camera );
		giPass.resolutionScale = 0.5;
		giPass.sliceCount.value = taa ? 1 : 2;
		giPass.stepCount.value = taa ? 12 : 8;
		giPass.aoIntensity.value = 0;
		giPass.giIntensity.value = 1;
		giPass.useTemporalFiltering = taa;
		shaded = shaded.add( scenePass.getTextureNode( 'diffuse' ).rgb.mul( giPass.rgb ).mul( bounce ).mul( strength ) );

	}

	// Hair over the scene by its coverage (premultiplied alpha). The strands
	// grow on the face the camera looks at, so they are always in front of
	// their host; no depth test is needed.
	const hair = hairPass.getTextureNode( 'output' );
	let sharp = vec4( shaded.mul( hair.a.oneMinus() ).add( hair.rgb ), color.a );
	if ( taa ) sharp = traa( sharp, depth, scenePass.getTextureNode( 'velocity' ), camera );
	// Depth of field last, on the finished image. The strands are not in the
	// scene depth: they blur as the skin they grow on. With the lens off the
	// blur passes are not drawn at all.
	pipeline.outputNode = followLens( pipeline, sharp, scenePass.getViewZNode(), lens );

	let enabled = true;
	return {
		pipeline, aoPass, giPass, bounce, strength, hairPass, scenePass,
		get enabled() { return enabled; },
		set enabled( on ) { enabled = on; strength.value = on ? 1 : 0; },
		// dist: camera to surface, meters.
		update( dist ) {

			aoPass.radius.value = THREE.MathUtils.clamp( dist * 0.12, 1e-5, 0.25 );
			aoPass.thickness.value = aoPass.radius.value * 2;

		},
		render() { sortHair(); pipeline.render(); },
		// times: 2 for a still frame of a lit pipeline (AO one frame late).
		async renderAsync( times = 1 ) { sortHair(); for ( let i = 0; i < times; i ++ ) await pipeline.renderAsync(); },
	};

}
