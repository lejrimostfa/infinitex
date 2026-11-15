// Pile family: TSL node graph. The mode (params.js) picks the matter:
//   cut     cut-pile carpet (cut.js)
//   loop    berber loops, terry  towel loops (loops.js)
//   velvet, cord  velvet and corduroy (velvet.js)
//   knot    hand-knotted rug (knot.js, rugpattern.js)
//   fur     faux fur: the strands graph, fed by the same uniforms
// Each returns colour, a surface slope, a cavity signal, a roughness and a
// sheen colour; this file turns them into the material nodes and lays the
// shared surface states on top (wetness, wear).
// Pile fabrics glow at grazing angles: light hits the sides of the fibres.
// That is the sheen lobe, strong on velvet, weak on loops.

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildStrandsNodes } from '../strands/shader.js';
import { brushField } from './fibres.js';
import { buildCut } from './cut.js';
import { buildLoop, buildTerry } from './loops.js';
import { buildVelvet, buildCord } from './velvet.js';
import { buildKnot } from './knot.js';

const MODES = { cut: buildCut, loop: buildLoop, terry: buildTerry, velvet: buildVelvet, cord: buildCord, knot: buildKnot };

export function buildPileNodes( u, opts = {} ) {

	if ( u.mode === 'fur' ) return buildStrandsNodes( u, opts );
	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const B = brushField( p, u );
	const W = MODES[ u.mode ]( p, fp, u, B );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, W.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( W.rough, W.s2 ), normalNode );
	const nodes = {
		colorNode: W.color, normalNode, roughnessNode, metalnessNode: float( 0 ),
		sheenNode: W.sheenColor.mul( u.sheen ), sheenRoughnessNode: float( u.mode === 'velvet' || u.mode === 'cord' ? 0.35 : 0.5 ),
	};
	applySurface( nodes, u.surface, { cavity: W.cavity, flatNormal: base, porosity: 1 } );
	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
