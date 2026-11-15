// Scifi family: TSL node graph. The mode (params.js) picks the matter,
// one file per matter:
//   carpaint (carpaint.js), opal (opal.js), hologram (hologram.js),
//   foil (foil.js), lc (crystal.js), screen (screen.js), energy (energy.js),
//   crt (crt.js)
// Each returns colour, a surface slope, a cavity signal and a roughness,
// and optionally: metal (metalness), emissive (light it makes), coat and
// coatSlope (a clear coat and its own relief), irid and iridNm (thin
// film). This file turns them into the material nodes and lays the
// shared surface states on top.

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildCarPaint } from './carpaint.js';
import { buildOpal } from './opal.js';
import { buildHologram } from './hologram.js';
import { buildFoil } from './foil.js';
import { buildCrystal } from './crystal.js';
import { buildScreen } from './screen.js';
import { buildEnergy } from './energy.js';
import { buildCrt } from './crt.js';

const MODES = {
	carpaint: buildCarPaint, opal: buildOpal, hologram: buildHologram, foil: buildFoil,
	lc: buildCrystal, screen: buildScreen, energy: buildEnergy, crt: buildCrt,
};

export function buildScifiNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const build = MODES[ u.mode ];
	if ( ! build ) throw new Error( `infinitex scifi: unknown mode "${ u.mode }"` );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const S = build( p, fp, u, base );

	const normalNode = perturbNormal( base, S.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( S.rough, S.s2 ), normalNode );
	const nodes = { colorNode: S.color, normalNode, roughnessNode, metalnessNode: S.metal ?? float( 0 ) };
	applySurface( nodes, u.surface, { cavity: S.cavity, flatNormal: base, porosity: float( 0.05 ) } );
	if ( S.coat ) {

		nodes.clearcoatNode = nodes.clearcoatNode.max( S.coat );
		nodes.clearcoatRoughnessNode = S.coatRough ?? float( 0.04 );
		if ( S.coatSlope ) nodes.clearcoatNormalNode = perturbNormal( base, S.coatSlope, tangentView, bitangentView );

	}

	if ( S.emissive ) nodes.emissiveNode = S.emissive;
	if ( S.irid ) {

		nodes.iridescenceNode = S.irid;
		nodes.iridescenceIORNode = S.iridIOR ?? float( 1.45 );
		nodes.iridescenceThicknessNode = S.iridNm;

	}

	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
