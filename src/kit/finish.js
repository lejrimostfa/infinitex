// The tail every family shader shares (see plastic/shader.js, ground/shader.js):
// the levels hand back W = { color, slope, cavity, rough, s2 } and this
// turns it into material nodes.
//   normal     the summed slope on the base normal (perturbNormal)
//   roughness  the family roughness, widened by the slope variance of the
//              faded levels (composeRoughness), then by the normal change
//              between pixels (specularAA)
//   states     wetness, gloss, wear over the result (core/surface.js),
//              the cavity also becomes ambient occlusion and micro-shadow
// Optional W fields, copied to the nodes:
//   emissive (vec3), sheen (vec3) + sheenRough, transmission + thickness,
//   ior, attenuationColor + attenuationDistance, metalness, clearcoat,
//   sss { color, distortion, ambient, power, scale, attenuation }: light
//   through the matter, for impl.material = 'sss' (see skin/shader.js)
// opts: { base (the .toVar() base normal), surface (u.surface),
//         porosity (0 glass .. 1 felt), fp (the footprint, for the level view) }

import { float, tangentView, bitangentView } from 'three/tsl';
import { composeRoughness, specularAA, perturbNormal } from '../core/lod.js';
import { applySurface } from '../core/surface.js';

export function finishNodes( W, { base, surface, porosity = 0.5, fp = float( 0 ) } ) {

	const normalNode = perturbNormal( base, W.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( W.rough, W.s2 ?? float( 0 ) ), normalNode );
	const nodes = { colorNode: W.color, normalNode, roughnessNode, metalnessNode: W.metalness ?? float( 0 ) };
	if ( W.sheen ) {

		nodes.sheenNode = W.sheen;
		nodes.sheenRoughnessNode = W.sheenRough ?? float( 0.5 );

	}

	applySurface( nodes, surface, { cavity: W.cavity ?? float( 0 ), flatNormal: base, porosity: float( porosity ) } );
	if ( W.clearcoat ) nodes.clearcoatNode = nodes.clearcoatNode.max( W.clearcoat );
	if ( W.emissive ) nodes.emissiveNode = W.emissive;
	if ( W.transmission ) {

		nodes.transmissionNode = W.transmission;
		nodes.thicknessNode = W.thickness ?? float( 0 );
		if ( W.attenuationColor ) nodes.attenuationColorNode = W.attenuationColor;
		if ( W.attenuationDistance ) nodes.attenuationDistanceNode = W.attenuationDistance;

	}

	if ( W.ior ) nodes.iorNode = W.ior;
	if ( W.sss ) {

		const S = W.sss;
		nodes.thicknessColorNode = S.color;
		nodes.thicknessDistortionNode = S.distortion ?? float( 0.5 );
		nodes.thicknessAmbientNode = S.ambient ?? float( 0.1 );
		nodes.thicknessPowerNode = S.power ?? float( 2 );
		nodes.thicknessScaleNode = S.scale ?? float( 4 );
		nodes.thicknessAttenuationNode = S.attenuation ?? float( 0.8 );

	}

	nodes.debug = { fp, w1: W.w1 ?? float( 1 ), w2: W.w2 ?? float( 1 ), w3: W.w3 ?? float( 1 ), covered: float( 1 ) };
	return nodes;

}
