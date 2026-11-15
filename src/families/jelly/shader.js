// Jelly family: TSL node graph. The mode (params.js) draws the tissue
// (medusa.js) and returns colour, slope, transmission share and emission.
// This file makes a transmissive material of it: three.js copies the
// opaque scene once per frame and every jelly pixel samples it, bent by
// the surface relief (ior 1.34, water). The colour tints what is seen
// through; the organs let less light through, so they read as milky or
// violet shapes inside a clear body.

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildMedusa } from './medusa.js';

const MODES = { medusa: buildMedusa };

export function buildJellyNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const W = MODES[ u.mode ]( p, fp, u );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, W.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( W.rough, W.s2 ), normalNode );
	const nodes = { colorNode: W.color, normalNode, roughnessNode, metalnessNode: float( 0 ) };
	applySurface( nodes, u.surface, { cavity: W.cavity, flatNormal: base, porosity: float( 0 ) } );
	nodes.transmissionNode = W.transmission;
	nodes.thicknessNode = u.thicknessM;
	nodes.iorNode = u.ior;
	nodes.attenuationColorNode = u.color;
	nodes.attenuationDistanceNode = u.tintM;
	nodes.emissiveNode = W.emissive;
	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
