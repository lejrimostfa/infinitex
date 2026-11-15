// Plastic family: TSL node graph. The mode (params.js) picks the matter:
//   solid    moulded part (solid.js), its wear (life.js), its age
//            (aged.js), silicone (silicone.js)
//   tyre     rubber tread (tyre.js)
//   foam     open-cell foam (foam.js)
//   ripstop  woven nylon (ripstop.js)
//   print    FDM 3D print (print3d.js)
//   record   vinyl record (record.js)
// Each returns colour, a surface slope, a cavity signal and a roughness,
// and may add a sheen or an anisotropic lobe; this file turns them into the
// material nodes and lays the shared surface states on top.

import { uv, float, vec3, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildSolid } from './solid.js';
import { applyLife } from './life.js';
import { applyAged } from './aged.js';
import { applySilicone } from './silicone.js';
import { buildTyre } from './tyre.js';
import { buildFoam } from './foam.js';
import { buildRipstop } from './ripstop.js';
import { buildPrint } from './print3d.js';
import { buildRecord } from './record.js';

function solid( p, fp, u ) {

	let W = buildSolid( p, fp, u );
	W = applyLife( W, p, fp, u );
	W = applyAged( W, p, fp, u );
	if ( u.transl.value > 0 || u.bubbles.value > 0 || u.tack.value > 0 ) W = applySilicone( W, p, fp, u );
	return W;

}

const MODES = { solid, tyre: buildTyre, foam: buildFoam, ripstop: buildRipstop, print: buildPrint, record: buildRecord };

export function buildPlasticNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const W = MODES[ u.mode ]( p, fp, u );

	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, W.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( W.rough, W.s2 ), normalNode );
	const nodes = {
		colorNode: W.color, normalNode, roughnessNode, metalnessNode: float( 0 ),
		sheenNode: ( W.sheen ?? vec3( 0 ) ).add( W.color.mul( u.sheen ) ), sheenRoughnessNode: W.sheenRough ?? float( 0.5 ),
	};
	if ( W.aniso ) nodes.anisotropyNode = W.aniso;
	// Plastics drink almost nothing; foam and woven nylon hold water.
	const porosity = u.mode === 'foam' || u.mode === 'ripstop' ? 0.9 : 0.15;
	applySurface( nodes, u.surface, { cavity: W.cavity, flatNormal: base, porosity } );
	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
