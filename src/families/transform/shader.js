// Transform family: TSL node graph. The mode (params.js) picks the
// process, one file per process:
//   burn (burn.js), frost (frost.js), melt (melt.js), rust (rust.js),
//   ink (ink.js), dry (dry.js), mould (mould.js)
// The progress (core/front.js loopProgress) is computed once here from the
// material clock and handed to the mode. Each mode returns colour, a
// surface slope, a cavity signal and a roughness, and optionally metal,
// emissive (embers), alpha (holes), coat and coatRough (a liquid film).
// This file turns them into the material nodes and lays the shared
// surface states on top.

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { DoubleSide } from 'three';
import { ixTime } from '../../core/clock.js';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { loopProgress } from '../../core/front.js';
import { applySurface } from '../../core/surface.js';
import { buildBurn } from './burn.js';
import { buildFrost } from './frost.js';
import { buildMelt } from './melt.js';
import { buildRust } from './rust.js';
import { buildInk } from './ink.js';
import { buildDry } from './dry.js';
import { buildMould } from './mould.js';

const MODES = { burn: buildBurn, frost: buildFrost, melt: buildMelt, rust: buildRust, ink: buildInk, dry: buildDry, mould: buildMould };
const POROSITY = { burn: 0.9, frost: 0, melt: 0, rust: 0.3, ink: 1, dry: 0.1, mould: 0.8 };

export function buildTransformNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const build = MODES[ u.mode ];
	if ( ! build ) throw new Error( `infinitex transform: unknown mode "${ u.mode }"` );
	const prog = loopProgress( ixTime.add( u.phase ).mul( u.speed ), u.period, u.hold, u.progress ).toVar( 'ix_progress' );
	const S = build( p, fp, u, prog );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, S.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( S.rough, S.s2 ), normalNode );
	const nodes = { colorNode: S.color, normalNode, roughnessNode, metalnessNode: S.metal ?? float( 0 ) };
	applySurface( nodes, u.surface, { cavity: S.cavity, flatNormal: base, porosity: float( POROSITY[ u.mode ] ) } );
	if ( S.coat ) {

		nodes.clearcoatNode = nodes.clearcoatNode.max( S.coat );
		nodes.clearcoatRoughnessNode = S.coatRough ?? float( 0.04 );
		if ( S.coatSlope ) nodes.clearcoatNormalNode = perturbNormal( base, S.coatSlope, tangentView, bitangentView );

	}

	if ( S.emissive ) nodes.emissiveNode = S.emissive;
	if ( S.alpha ) {

		nodes.opacityNode = S.alpha;
		nodes.transparent = true;
		nodes.side = DoubleSide;

	}

	nodes.debug = { fp, w1: prog, w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
