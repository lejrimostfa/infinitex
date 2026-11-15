// Organic family: TSL node graph. The mode (params.js) picks the matter,
// one file per group of matters:
//   petal (petal.js), citrus and apple (peel.js), berry and peach
//   (berry.js), crust and crumb (bread.js), cactus (cactus.js), walnut
//   and coir (husk.js), seaweed and pollen (algae.js)
// Each returns colour, a surface slope, a cavity signal and a roughness,
// and optionally a sheen colour (velvet, fuzz), a clear coat (slime, wax)
// and a glow (light that went through). This file turns them into the
// material nodes and lays the shared surface states on top.
// To add a matter: one entry in MODES, one in POROSITY, and in SSS when
// light passes through it.

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildPetal } from './petal.js';
import { buildCitrus, buildApple } from './peel.js';
import { buildBerry, buildPeach } from './berry.js';
import { buildCrust, buildCrumb } from './bread.js';
import { buildCactus } from './cactus.js';
import { buildWalnut, buildCoir } from './husk.js';
import { buildSeaweed, buildPollen } from './algae.js';
// Animal matters (row 20, second part).
import { ANIMAL_MODES, ANIMAL_POROSITY, ANIMAL_SSS } from './animal.js';
import { applyExtras } from './extras.js';

const MODES = {
	petal: buildPetal, citrus: buildCitrus, apple: buildApple, berry: buildBerry, peach: buildPeach,
	crust: buildCrust, crumb: buildCrumb, cactus: buildCactus, walnut: buildWalnut, coir: buildCoir,
	seaweed: buildSeaweed, pollen: buildPollen,
	...ANIMAL_MODES,
};

// How much each matter drinks water (surface.js wetness).
const POROSITY = {
	petal: 0.3, citrus: 0.2, apple: 0.1, berry: 0.4, peach: 0.5, crust: 0.8, crumb: 1, cactus: 0.1,
	walnut: 0.6, coir: 0.9, seaweed: 0.1, pollen: 0.7,
	...ANIMAL_POROSITY,
};

// Matters light enters: index.js gives them the SSS material.
const SSS = new Set( [ 'petal', 'citrus', 'apple', 'berry', 'peach', 'seaweed', 'cactus', ...ANIMAL_SSS ] );
export const organicMaterialKind = ( u ) => ( SSS.has( u.mode ) ? 'sss' : 'physical' );

export function buildOrganicNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const build = MODES[ u.mode ];
	if ( ! build ) throw new Error( `infinitex organic: unknown mode "${ u.mode }"` );
	const O = build( p, fp, u );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, O.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( O.rough, O.s2 ), normalNode );
	const nodes = {
		colorNode: O.color, normalNode, roughnessNode, metalnessNode: float( 0 ),
		sheenNode: O.sheen ?? O.color.mul( u.sheen ), sheenRoughnessNode: O.sheenRough ?? float( 0.4 ),
	};
	if ( SSS.has( u.mode ) ) {

		// Light enters the soft tissue, spreads and comes out in its colour.
		const glow = ( O.glow ?? O.color ).mul( u.translucency );
		Object.assign( nodes, {
			thicknessColorNode: glow, thicknessDistortionNode: float( 0.2 ), thicknessAmbientNode: u.translucency.mul( 0.1 ),
			thicknessPowerNode: float( 2.5 ), thicknessScaleNode: float( 2.0 ), thicknessAttenuationNode: float( 0.8 ),
		} );

	}

	applySurface( nodes, u.surface, { cavity: O.cavity, flatNormal: base, porosity: float( POROSITY[ u.mode ] ?? 0.6 ) } );
	// Slime, wax and the juice film: a smooth coat over the tissue.
	if ( O.coat ) {

		nodes.clearcoatNode = nodes.clearcoatNode.max( O.coat );
		nodes.clearcoatRoughnessNode = O.coatRough ?? float( 0.08 );

	}

	applyExtras( nodes, O ); // nacre film, amber transmission, web cut out
	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
