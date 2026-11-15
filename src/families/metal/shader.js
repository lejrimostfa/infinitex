// Metal family: TSL node graph. The mode (params.js) picks the matter:
//   hammered  worked bronze, copper, brass, gold (hammered.js)
//   rust      rusted iron: flaking scale, blisters, pits (rust.js)
//   brushed   brushed steel: parallel grooves, stretched highlight (brushed.js)
//   chrome    polished chrome plate: mirror, swirls, pits, nodules (chrome.js)
//   painted   painted steel: orange peel, chips, primer, rust creep (painted.js)
// Each returns colour, slope, roughness (and the slope variance of its
// faded levels), metalness, a cavity signal and a porosity; this file
// turns them into the material nodes and lays the shared surface states
// on top (wetness, gloss, wear). A mode may add an anisotropy direction
// (tangent space): the stretched highlight of brushed metal.

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { applyStates } from '../../core/states.js';
import { buildHammered } from './hammered.js';
import { buildRust } from './rust.js';
import { buildBrushed } from './brushed.js';
import { buildChrome } from './chrome.js';
import { buildPainted } from './painted.js';

const MODES = { hammered: buildHammered, rust: buildRust, brushed: buildBrushed, chrome: buildChrome, painted: buildPainted };

export function buildMetalNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv().mul( u.metersPerUV ) ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const M = ( MODES[ u.mode ] ?? buildHammered )( p, fp, u, opts );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, M.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( M.rough, M.s2 ), normalNode );

	const nodes = { colorNode: M.color, normalNode, roughnessNode, metalnessNode: M.metalness };
	if ( M.aniso ) nodes.anisotropyNode = M.aniso;
	applySurface( nodes, u.surface, { cavity: M.cavity, flatNormal: base, porosity: M.porosity } );
	applyStates( nodes, u.states, { cavity: M.cavity, flatNormal: base, coords: p, fp } );
	nodes.debug = { fp, covered: float( 1 ), ...M.debug };
	return nodes;

}
