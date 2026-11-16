// Post-processing of the camera kit (kit.js), or alone (createPost).
// Screen-space ambient occlusion (GTAO from three/addons) in one scene pass.
// The pass writes colour and view normals (MRT). GTAO reads depth and
// normals and darkens creases and contacts: the sleeves on the torso, the
// arms on the body. The knit itself already has its own analytic AO.
//
// The AO radius is in world meters, so it follows the camera distance:
// at 1 mm from the wool a 25 cm radius means nothing.
//
// 3D hair strands (layer HAIR_LAYER) are drawn in a pass of their own and
// laid over the AO-shaded scene where they are in front of it. Thousands of
// strands in the depth buffer made GTAO darken a square around the hair
// window; the strands have their own self-shadow and occlusion.

import * as THREE from 'three/webgpu';
import { HAIR_LAYER } from '../core/hair3d.js';
import { nodeObject, pass, mrt, output, normalView, directionToColor, colorToDirection, sample, screenUV, uniform, vec4, mix } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';

// Blurs a colour node by the scene's view depth (viewZ: a pass's
// getViewZNode()), with the focus uniforms of a lens.
export function withDof( color, viewZ, lens ) {

	return dof( color, viewZ, lens.distance, lens.range, lens.bokeh );

}

// Output node that follows the lens: blurred while it is on, sharp when off.
function followLens( pipeline, sharp, viewZ, lens ) {

	if ( ! lens?.hasDof ) return sharp;
	const blurred = withDof( sharp, viewZ, lens );
	lens.addEventListener( 'dofToggled', ( e ) => { pipeline.outputNode = e.detail.enabled ? blurred : sharp; pipeline.needsUpdate = true; } );
	return lens.enabled ? blurred : sharp;

}

// For a page with no AO: one scene pass, then the blur. With the lens off
// the scene is drawn straight to the screen.
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

// The hair pass: no background and a transparent clear, so thin strands
// keep their own coverage (alpha) instead of blending into the backdrop.
class HairPassNode extends THREE.PassNode {

	updateBefore( frame ) {

		const r = frame.renderer, s = this.scene, bg = s.background;
		const c = new THREE.Color(), a = r.getClearAlpha();
		r.getClearColor( c );
		s.background = null;
		r.setClearColor( 0x000000, 0 );
		super.updateBefore( frame );
		s.background = bg;
		r.setClearColor( c, a );

	}

}

// lens: a createLens() of lens.js, for a depth of field at the end; without
// it (game.html) the frame is AO and hair only.
export function createPost( renderer, scene, camera, { lens = null } = {} ) {

	const pipeline = new THREE.RenderPipeline( renderer );
	const sceneLayers = new THREE.Layers();
	sceneLayers.enableAll();
	sceneLayers.disable( HAIR_LAYER );
	const hairLayers = new THREE.Layers();
	hairLayers.set( HAIR_LAYER );
	const scenePass = pass( scene, camera );
	scenePass.setLayers( sceneLayers );
	const hairPass = nodeObject( new HairPassNode( THREE.PassNode.COLOR, scene, camera ) );
	hairPass.setLayers( hairLayers );
	// Strand meshes move to their own layer as they appear.
	const sortHair = () => scene.traverse( ( o ) => { if ( o.userData.hairStrands && ! o.layers.isEnabled( HAIR_LAYER ) ) o.layers.set( HAIR_LAYER ); } );
	scenePass.setMRT( mrt( { output, normal: directionToColor( normalView ) } ) );
	const color = scenePass.getTextureNode( 'output' );
	const normalTex = scenePass.getTextureNode( 'normal' );
	const normal = sample( ( uv ) => colorToDirection( normalTex.sample( uv ) ) );
	const depth = scenePass.getTextureNode( 'depth' );

	const aoPass = ao( depth, normal, camera );
	aoPass.resolutionScale = 0.5;
	const aoTex = aoPass.getTextureNode();
	const strength = uniform( 1 );
	const lit = color.rgb.mul( mix( 1, aoTex.sample( screenUV ).r, strength ) );
	// Hair over the scene by its coverage (premultiplied alpha). The strands
	// grow on the face the camera looks at, so they are always in front of
	// their host; no depth test is needed.
	const hair = hairPass.getTextureNode( 'output' );
	const sharp = vec4( lit.mul( hair.a.oneMinus() ).add( hair.rgb ), color.a );
	// Depth of field last, on the finished image. The strands are not in the
	// scene depth: they blur as the skin they grow on.
	pipeline.outputNode = followLens( pipeline, sharp, scenePass.getViewZNode(), lens );

	let enabled = true;
	return {
		pipeline, aoPass, strength, hairPass, scenePass,
		get enabled() { return enabled; },
		set enabled( on ) { enabled = on; strength.value = on ? 1 : 0; },
		// dist: camera to surface, meters.
		update( dist ) {

			aoPass.radius.value = THREE.MathUtils.clamp( dist * 0.12, 1e-5, 0.25 );
			aoPass.thickness.value = aoPass.radius.value * 2;

		},
		render() { sortHair(); pipeline.render(); },
		async renderAsync() { sortHair(); await pipeline.renderAsync(); },
	};

}
