// CPU statistics of the stitch level, used when stitches shrink below a few
// pixels. The shader then replaces the stitch detail by these means, so the
// far view keeps the average look of the near view.
//
// Must stay in sync with the TSL in shader.js: same legs, same AO formula.

import { CANDIDATES, LEG, legShape, legEvalCPU } from './legs.js';

export const AO_BACKGROUND = 0.15;
export const AO_MIN = 0.3;

// AO of the winning leg height z. Mirrors stitchAO() in shader.js.
export function stitchAOCPU( z, R ) {

	if ( z < - 1 ) return AO_BACKGROUND;
	const top = R * ( 1 + LEG.archFactor );
	const k = Math.min( 1, Math.max( 0, ( z + 0.2 * R ) / ( top + 0.2 * R ) ) );
	return AO_MIN + ( 1 - AO_MIN ) * Math.pow( k, 0.8 );

}

// Mean AO and mean squared tangent-plane normal (slope proxy) over one stitch.
// meanAO is weighted by the light a tilted normal loses: a resolved yarn
// tilts its normals, which lowers the diffuse light. Under a sky-like
// environment the irradiance goes as (1 + n_z) / 2. The far view (flat
// normal) must carry that loss or it reads too bright once sheen is lowered.
// (Full n_z weighting overshot by 5 % in the gate: the light is mostly sky.)
export function stitchStats( { aspect, spread, R }, n = 48 ) {

	const shapes = { '-1': legShape( - 1, aspect, spread ), '1': legShape( 1, aspect, spread ) };
	let aoSum = 0, s2Sum = 0;

	for ( let i = 0; i < n; i ++ ) {

		for ( let j = 0; j < n; j ++ ) {

			const x = ( i + 0.5 ) / n, y = ( j + 0.5 ) / n * aspect;
			let best = { z: - 10, rn: 0, core: 1 };

			for ( const [ dc, dr, side ] of CANDIDATES ) {

				const r = legEvalCPU( x - dc, y - dr * aspect, shapes[ side ], R );
				if ( r.z > best.z ) best = r;

			}

			const nz = best.z < - 1 ? 1 : Math.sqrt( Math.max( 0, 1 - Math.min( 1, best.rn * best.rn ) ) );
			aoSum += stitchAOCPU( best.z, R ) * ( 1 + nz ) / 2;
			// normal = (perp * rn, core): squared tangent part = rn^2 (clamped)
			s2Sum += best.z < - 1 ? 0 : Math.min( 1, best.rn * best.rn );

		}

	}

	return { meanAO: aoSum / ( n * n ), slopeVar: s2Sum / ( n * n ) };

}
