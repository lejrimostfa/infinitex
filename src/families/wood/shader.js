// Wood family: TSL node graph. The mode (params.js) picks the matter:
//   board  solid wood (board.js) and what happened to it (finish.js)
//   chips  particle board, cork  agglomerated cork (composite.js)
//   bark   furrowed bark (bark.js)
// Each returns colour, a surface slope, a cavity signal and a roughness;
// this file turns them into the material nodes and lays the shared
// surface states on top (varnish = gloss, wetness, wear).

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { applyStates } from '../../core/states.js';
import { buildBoard } from './board.js';
import { finishBoard } from './finish.js';
import { buildChips, buildCork } from './composite.js';
import { buildBark } from './bark.js';

const MODES = {
	board: ( p, fp, u ) => finishBoard( buildBoard( p, fp, u ), p, fp, u ),
	chips: buildChips,
	cork: buildCork,
	bark: buildBark,
};

export function buildWoodNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const W = MODES[ u.mode ]( p, fp, u );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, W.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( W.rough, W.s2 ), normalNode );
	const nodes = {
		colorNode: W.color, normalNode, roughnessNode, metalnessNode: float( 0 ),
		sheenNode: W.color.mul( u.sheen ), sheenRoughnessNode: float( 0.5 ),
	};
	// Bare wood drinks water and varnish; paint and char much less.
	const porosity = u.mode === 'board' ? float( 0.8 ).sub( u.paint.mul( 0.5 ) ).sub( u.char.mul( 0.4 ) ) : float( 0.9 );
	applySurface( nodes, u.surface, { cavity: W.cavity, flatNormal: base, porosity } );
	applyStates( nodes, u.states, { cavity: W.cavity, flatNormal: base, coords: p, fp } );
	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
