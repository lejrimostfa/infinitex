// Ceramic and glass family: TSL node graph. The mode (params.js) picks the
// matter:
//   glaze   porcelain, faience (glaze.js, crackle.js, motif.js)
//   clay    terracotta (clay.js)
//   glass   frosted or blown glass, seen through (glass.js)
//   enamel  vitreous enamel on steel (enamel.js)
// Each returns colour, a surface slope, a cavity signal and a roughness.
// Glazes and enamel add a clear coat (the glass surface, its own slope);
// glass adds transmission. This file turns them into material nodes and
// lays the shared surface states on top (wetness, wear).
//
// Transmission cost: three.js copies the opaque scene once per frame into
// a mip chain and every glass pixel samples it. Only the glass mode turns
// it on, so the other modes stay in the opaque pass.

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildGlaze } from './glaze.js';
import { buildClay } from './clay.js';
import { buildGlass } from './glass.js';
import { buildEnamel } from './enamel.js';

const MODES = { glaze: buildGlaze, clay: buildClay, glass: buildGlass, enamel: buildEnamel };
const POROSITY = { glaze: 0.05, clay: 1, glass: 0, enamel: 0 };

export function buildCeramicNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const W = MODES[ u.mode ]( p, fp, u );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, W.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( W.rough, W.s2 ), normalNode );
	const nodes = {
		colorNode: W.color, normalNode, roughnessNode, metalnessNode: W.metal ?? float( 0 ),
		sheenNode: W.color.mul( u.sheen ), sheenRoughnessNode: float( 0.5 ),
	};
	applySurface( nodes, u.surface, { cavity: W.cavity, flatNormal: base, porosity: float( POROSITY[ u.mode ] ) } );

	if ( W.coat ) {

		// The glass surface of the glaze: a clear coat with its own waves.
		const coatNormal = perturbNormal( base, W.coatSlope, tangentView, bitangentView ).toVar( 'ix_coat_normal' );
		const coatRough = specularAA( composeRoughness( W.coatRough, W.coatS2 ), coatNormal );
		nodes.clearcoatNode = W.coat.max( nodes.clearcoatNode );
		nodes.clearcoatRoughnessNode = coatRough.min( nodes.clearcoatRoughnessNode.add( W.coat.oneMinus() ) );
		nodes.clearcoatNormalNode = coatNormal;

	}

	if ( W.transmission ) {

		nodes.transmissionNode = W.transmission;
		nodes.thicknessNode = u.thicknessM;
		nodes.iorNode = u.ior;
		nodes.attenuationColorNode = u.tintColor;
		nodes.attenuationDistanceNode = u.tintM;

	}

	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
