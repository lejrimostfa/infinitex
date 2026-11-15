// Interlace family: TSL node graph. The mode (params.js) picks the
// structure: cane.js, braid.js, mail.js. Each returns, per pixel:
//   color, slope (dh/du, dh/dv), rough, s2 (slope variance of the levels
//   faded out), cavity, metal, and for open structures `alpha`, the share
//   of the pixel covered by matter (already blended toward the mean
//   coverage where the holes are under a few pixels).
// Open structures are drawn blended and two sided: through a hole the far
// face of the object shows, as through a real mesh.

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { DoubleSide } from 'three';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildCane } from './cane.js';
import { buildBraid } from './braid.js';
import { buildMail } from './mail.js';

const MODES = { cane: buildCane, braid: buildBraid, mail: buildMail };
const POROSITY = { cane: 0.3, braid: 1, mail: 0 };

export function buildInterlaceNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const W = MODES[ u.mode ]( p, fp, u );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, W.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( W.rough, W.s2 ), normalNode );
	const nodes = {
		colorNode: W.color, normalNode, roughnessNode, metalnessNode: W.metal ?? float( 0 ),
		sheenNode: W.color.mul( u.sheen ), sheenRoughnessNode: float( 0.5 ),
	};
	applySurface( nodes, u.surface, { cavity: W.cavity, flatNormal: base, porosity: float( POROSITY[ u.mode ] ) } );
	if ( W.alpha ) {

		nodes.opacityNode = W.alpha;
		nodes.transparent = true;
		nodes.side = DoubleSide;

	}

	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
