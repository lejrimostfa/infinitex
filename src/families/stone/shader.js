// Stone family: TSL node graph. The mode (params.js) picks the matter,
// one file per matter or pair of matters. Each returns colour, a surface
// slope, a cavity signal and a roughness; this file turns them into the
// material nodes and lays the shared surface states on top (wetness, wax
// = gloss, wear). Marble lets light in: index.js gives it the SSS
// material and the thickness nodes below carry the glow.

import { uv, float, vec3, mix, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildGranite } from './granite.js';
import { buildMarble } from './marble.js';
import { buildSandstone, buildSlate } from './sediment.js';
import { buildConcrete } from './concrete.js';
import { buildBrick } from './brick.js';
import { buildPlaster } from './plaster.js';

const MODES = {
	granite: buildGranite, marble: buildMarble, sandstone: buildSandstone, slate: buildSlate,
	concrete: buildConcrete, brick: buildBrick, plaster: buildPlaster,
};

// How much each matter drinks water (polished stone barely, plaster a lot).
const POROSITY = { granite: 0.25, marble: 0.2, sandstone: 0.9, slate: 0.35, concrete: 0.8, brick: 0.9, plaster: 1.0 };

// index.js reads this to choose the material class.
export const stoneMaterialKind = ( u ) => ( u.mode === 'marble' ? 'sss' : 'physical' );

export function buildStoneNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const build = MODES[ u.mode ];
	if ( ! build ) throw new Error( `infinitex stone: unknown mode "${ u.mode }"` );
	const S = build( p, fp, u );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, S.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( S.rough, S.s2 ), normalNode );
	const nodes = {
		colorNode: S.color, normalNode, roughnessNode, metalnessNode: S.metal ?? float( 0 ),
		sheenNode: S.sheen ?? S.color.mul( u.sheen ), sheenRoughnessNode: float( 0.35 ),
	};
	if ( u.mode === 'marble' ) {

		// Light enters the calcite, spreads a few mm and comes out warm.
		const glow = S.color.mul( vec3( 1.0, 0.93, 0.85 ) ).mul( u.scatter );
		Object.assign( nodes, {
			thicknessColorNode: glow, thicknessDistortionNode: float( 0.3 ), thicknessAmbientNode: u.scatter.mul( 0.15 ),
			thicknessPowerNode: float( 3.0 ), thicknessScaleNode: float( 2.0 ), thicknessAttenuationNode: float( 0.9 ),
		} );

	}

	const porosity = float( POROSITY[ u.mode ] ?? 0.6 ).mul( float( 1 ).sub( u.polish.mul( 0.5 ) ) );
	applySurface( nodes, u.surface, { cavity: S.cavity, flatNormal: base, porosity } );
	if ( u.mode === 'granite' || u.mode === 'marble' ) {

		// A polished stone face is a mirror-flat film over the crystals: a
		// clear coat lobe that reflects the room, the grains sparkle below.
		nodes.clearcoatNode = nodes.clearcoatNode.max( u.polish.mul( 0.9 ) );
		nodes.clearcoatRoughnessNode = mix( nodes.clearcoatRoughnessNode, float( 0.03 ), u.polish );

	}
	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
