// Ground family: TSL node graph. The mode (params.js) picks the matter:
//   soil (soil.js), sand (sand.js), gravel (gravel.js), mud (mud.js),
//   snow and frost (snow.js, frost.js), ice (ice.js),
//   crystals (crystals.js: salt, sugar), dust (dust.js)
// Each returns colour, a surface slope, a cavity signal and a roughness
// (and, for ice, a clear coat); this file turns them into the material
// nodes and lays the shared surface states on top (wetness, wear).

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildSand, sandHeight } from './sand.js';
import { buildGravel } from './gravel.js';
import { buildSoil } from './soil.js';
import { buildMud } from './mud.js';
import { buildSnow } from './snow.js';
import { buildFrost } from './frost.js';
import { buildIce } from './ice.js';
import { buildCrystals } from './crystals.js';
import { buildDust } from './dust.js';

const MODES = {
	sand: buildSand, gravel: buildGravel, soil: buildSoil, mud: buildMud, snow: buildSnow,
	frost: buildFrost, ice: buildIce, crystals: buildCrystals, dust: buildDust,
};

// How much each matter drinks water (surface.js wetness).
const POROSITY = { sand: 0.9, gravel: 0.6, soil: 1, mud: 0.8, snow: 0.3, frost: 0.2, ice: 0, crystals: 0.4, dust: 0.9 };

// The relief large enough to move vertices (preset.displace), as a height
// in meters along the normal, or null when the mode has none. Sand: its
// wind ripples (a few millimetres). The other modes are not done.
export function groundDisplace( u, p ) {

	return u.mode === 'sand' ? sandHeight( p, u ) : null;

}

export function buildGroundNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const build = MODES[ u.mode ];
	if ( ! build ) throw new Error( `infinitex ground: unknown mode "${ u.mode }"` );
	const G = build( p, fp, u );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, G.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( G.rough, G.s2 ), normalNode );
	const nodes = { colorNode: G.color, normalNode, roughnessNode, metalnessNode: float( 0 ) };
	applySurface( nodes, u.surface, { cavity: G.cavity, flatNormal: base, porosity: float( POROSITY[ u.mode ] ?? 0.8 ) } );
	// Ice: a smooth coat over the scratched, bubbly body.
	if ( G.coat ) {

		nodes.clearcoatNode = nodes.clearcoatNode.max( G.coat );
		nodes.clearcoatRoughnessNode = G.coatRough;

	}

	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
