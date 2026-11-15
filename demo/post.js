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
import { HAIR_LAYER } from '../src/core/hair3d.js';
import { nodeObject, pass, mrt, output, normalView, directionToColor, colorToDirection, sample, screenUV, uniform, vec4, mix } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';

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

export function createPost( renderer, scene, camera ) {

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
	pipeline.outputNode = vec4( lit.mul( hair.a.oneMinus() ).add( hair.rgb ), color.a );

	let enabled = true;
	return {
		pipeline, aoPass, strength, hairPass,
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
