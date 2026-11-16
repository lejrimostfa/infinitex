// Molten family: TSL node graph. The mode (params.js) picks the matter,
// one file per matter:
//   pahoehoe (pahoehoe.js), aa (aa.js), lake (lake.js), embers (embers.js),
//   steel (steel.js), slag (slag.js), photosphere (photosphere.js)
// Each returns colour, a surface slope, a cavity signal, a roughness, its
// slope variance s2, the light it emits (heat.js radiances, already mixed
// by coverage) and optionally a metalness, a porosity and a tarnish film
// (irid, iridNm). Time is the shared clock
// (core/clock.js) times speed, so a film rendered frame by frame is
// reproducible. This file turns the result into material nodes, scales
// the glow and lays the shared surface states on top.

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { ixTime } from '../../core/clock.js';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildPahoehoe } from './pahoehoe.js';
import { buildAa } from './aa.js';
import { buildLake } from './lake.js';
import { buildEmbers } from './embers.js';
import { buildSteel } from './steel.js';
import { buildSlag } from './slag.js';
import { buildPhotosphere } from './photosphere.js';

const MODES = { pahoehoe: buildPahoehoe, aa: buildAa, lake: buildLake, embers: buildEmbers, steel: buildSteel, slag: buildSlag, photosphere: buildPhotosphere };

export function buildMoltenNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const build = MODES[ u.mode ];
	if ( ! build ) throw new Error( `infinitex molten: unknown mode "${ u.mode }"` );
	const t = ixTime.mul( u.speed ).toVar( 'ix_t' );
	const M = build( p, fp, u, t );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, M.slope.mul( u.relief ), tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( M.rough, M.s2 ), normalNode );
	const nodes = { colorNode: M.color, normalNode, roughnessNode, metalnessNode: M.metal ?? float( 0 ) };
	// Glassy crust and metal drink nothing; ash and char a little.
	applySurface( nodes, u.surface, { cavity: M.cavity, flatNormal: base, porosity: float( M.porosity ?? 0.1 ) } );
	nodes.emissiveNode = M.emissive.mul( u.glow );
	// Slag: a thin tarnish film (iridescence), thickness in nm.
	if ( M.irid ) {

		nodes.iridescenceNode = M.irid;
		nodes.iridescenceIORNode = float( 1.8 );
		nodes.iridescenceThicknessNode = M.iridNm;

	}

	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
