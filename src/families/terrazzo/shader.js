// Terrazzo family: TSL node graph. levels.js draws the matter and returns
// W = { color, slope, cavity, rough, s2 }; finishNodes (src/kit/finish.js)
// turns it into material nodes with the shared surface states on top.
// The footprint is taken here, once, before any branch.

import { uv, normalView } from 'three/tsl';
import { footprint, finishNodes } from '../../kit.js';
import { buildTerrazzo } from './levels.js';

export function buildTerrazzoNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' ); // surface metres
	const fp = footprint( p ).toVar( 'ix_fp' ); // one pixel, in metres
	const W = buildTerrazzo( p, fp, u );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	// Polished stone drinks a little water: the cement more than the chips.
	return finishNodes( W, { base, surface: u.surface, porosity: 0.3, fp } );

}
