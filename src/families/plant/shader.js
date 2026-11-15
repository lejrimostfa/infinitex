// Plant and organic family: TSL node graph. The mode (params.js) picks the
// matter, one file per matter. Each returns colour, a surface slope, a
// cavity signal and a roughness; some also return:
//   glow   colour of the light that crossed the matter (leaf, horn, bone):
//          index.js gives these modes the SSS material
//   irid   { amount, thickness } of a thin film (nacre)
// This file turns them into material nodes and lays the shared surface
// states on top (wetness, wax = gloss, wear).

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildLeaf } from './leaf.js';
import { buildMoss } from './moss.js';
import { buildGills } from './gills.js';
import { buildBone } from './bone.js';
import { buildHorn } from './horn.js';
import { buildNacre } from './nacre.js';

const MODES = { leaf: buildLeaf, moss: buildMoss, gills: buildGills, bone: buildBone, horn: buildHorn, nacre: buildNacre };

// How much each matter drinks water.
const POROSITY = { leaf: 0.15, moss: 1.0, gills: 0.9, bone: 0.6, horn: 0.2, nacre: 0.1 };

// index.js reads this to choose the material class: light crosses a leaf,
// horn and thin bone.
const SSS = { leaf: true, horn: true, bone: true };
export const plantMaterialKind = ( u ) => ( SSS[ u.mode ] ? 'sss' : 'physical' );

export function buildPlantNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const build = MODES[ u.mode ];
	if ( ! build ) throw new Error( `infinitex plant: unknown mode "${ u.mode }"` );
	const S = build( p, fp, u );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, S.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( S.rough, S.s2 ), normalNode );
	const nodes = {
		colorNode: S.color, normalNode, roughnessNode, metalnessNode: float( 0 ),
		sheenNode: S.sheen ?? S.color.mul( u.sheen ), sheenRoughnessNode: float( 0.4 ),
	};
	if ( SSS[ u.mode ] && S.glow ) {

		Object.assign( nodes, {
			thicknessColorNode: S.glow.mul( u.scatter ), thicknessDistortionNode: float( 0.25 ), thicknessAmbientNode: u.scatter.mul( 0.1 ),
			thicknessPowerNode: float( 2.5 ), thicknessScaleNode: float( 2.5 ), thicknessAttenuationNode: float( 0.85 ),
		} );

	}

	if ( S.irid ) {

		nodes.iridescenceNode = S.irid.amount;
		nodes.iridescenceIORNode = float( 1.68 ); // aragonite
		nodes.iridescenceThicknessNode = S.irid.thickness;

	}

	applySurface( nodes, u.surface, { cavity: S.cavity, flatNormal: base, porosity: float( POROSITY[ u.mode ] ?? 0.5 ) } );
	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
