// Drops of liquid on a surface (meltwater beads, condensation), one per
// cell at most, so they never overlap. Each is a cap of water: it bends
// the light, so its rim is dark and a bright caustic sits on the side
// away from the light; its slope is the slope of the cap.

import { vec2, float, floor, smoothstep, clamp, mod, sqrt, mix } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, wrapCoord } from '../../core/hash.js';

// One bead per cell of cellM at most, radius k (0..1) of its maximum,
// present in a share of the cells (node).
// A cap of water: dark refracting rim, bright caustic on the far side.
export function beads( p, cellM, fp, k, share, salt ) {

	const q = wrapCoord( p.div( cellM ) ).add( salt );
	const id = floor( q );
	const h = hash3( id );
	const R = h.z.mul( 0.22 ).add( 0.18 ).mul( k ).mul( smoothstep( share.oneMinus(), share.oneMinus().add( 0.1 ), hash3( id.add( 5.3 ) ).x ) ).max( 1e-4 );
	// The drop wanders in its cell as far as its size allows: no grid.
	const v = q.sub( id.add( 0.5 ).add( h.xy.sub( 0.5 ).mul( float( 0.96 ).sub( R.mul( 2 ) ) ) ) );
	const r = v.length();
	// Under a few pixels a pixel sees the mean share of area under drops.
	const mean = k.mul( k ).mul( 0.27 ).mul( share );
	// The drop itself decides: a drop under two pixels is its mean.
	const near = fadeIn( cellM.mul( R ).mul( 2 ), fp, 1.0, 2.5 ).toVar();
	const cover = mix( mean, clamp( R.sub( r ).mul( cellM ).div( fp ).add( 0.5 ), 0, 1 ), near ).toVar();
	const z = sqrt( R.mul( R ).sub( r.mul( r ) ).max( R.mul( R ).mul( 0.04 ) ) );
	const slope = v.div( z ).mul( - 0.7 ).mul( cover ).mul( near );
	const rim = smoothstep( R.mul( 0.55 ), R, r ).mul( cover ).mul( near );
	const caustic = smoothstep( R.mul( 0.7 ), float( 0 ), v.add( vec2( 0, R.mul( 0.45 ) ) ).length() ).mul( cover ).mul( near );
	return { cover, slope, rim, caustic };

}
