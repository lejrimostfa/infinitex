// Small blocks every molten mode shares. Sizes in surface meters.
//   frame      the flow frame: x along the flow, y across, and back
//   flowFbm    value noise carried by a flow, seamless in time: two copies
//              half a period apart, each restarted (and reseeded) while its
//              weight is zero, crossfaded with a triangle (flow maps)
//   vesicles   gas bubbles frozen in the skin (0.2 to 5 mm): pits with a rim
//   microlites crystal laths in the glass (20 to 200 um): each a tilted
//              mirror that glints, faded to a wider lobe under a pixel
// The bubbles come from ceramic/bubbles.js, the laths from
// stone/crystals.js, the octaves from stone/common.js.

import { vec2, float, floor, fract, abs, cos, sin, mod, clamp, step, sqrt } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';
import { fbm } from '../stone/common.js';
import { bubbleField, capSlope } from '../ceramic/bubbles.js';
import { crystals } from '../stone/crystals.js';

export { fbm };

export function frame( p, a ) {

	const c = cos( a ), s = sin( a );
	return {
		f: vec2( p.x.mul( c ).add( p.y.mul( s ) ), p.y.mul( c ).sub( p.x.mul( s ) ) ),
		dir: vec2( c, s ),
		toP: ( g ) => vec2( g.x.mul( c ).sub( g.y.mul( s ) ), g.x.mul( s ).add( g.y.mul( c ) ) ),
	};

}

// vel: meters per second (vec2, may vary per pixel), t seconds, period
// seconds a copy lives. Mean 0.5, contrast kept through the crossfade.
export function flowFbm( p, vel, t, period, scaleM, fp, oct = 3, seed = 0 ) {

	const ph = t.div( period );
	let n = float( 0 ), w2 = float( 0 );
	for ( const off of [ 0, 0.5 ] ) {

		const k = ph.add( off ), a = fract( k ), cyc = mod( floor( k ), 997 );
		const w = float( 1 ).sub( abs( a.mul( 2 ).sub( 1 ) ) );
		const shift = vec2( fract( cyc.mul( 0.618 ).add( off ) ), fract( cyc.mul( 0.382 ).add( off * 1.7 ) ) ).mul( float( scaleM ).mul( 7.3 ) );
		const q = p.sub( vel.mul( a.sub( 0.5 ).mul( period ) ) ).add( shift );
		n = n.add( fbm( q, scaleM, fp, oct, seed ).sub( 0.5 ).mul( w ) );
		w2 = w2.add( w.mul( w ) );

	}

	return n.div( sqrt( w2 ) ).add( 0.5 );

}

// Two octaves of bubbles. Returns pit cover (faded), slope, a bright rim
// and the slope variance of the octaves under a pixel.
export function vesicles( q, fp, cellM, density, salt, depth = 0.7 ) {

	let pit = float( 0 ), slope = vec2( 0 ), rim = float( 0 ), s2 = float( 0 );
	for ( const [ k, dens ] of [ [ 1, 1 ], [ 0.33, 1.4 ] ] ) {

		const B = bubbleField( q, fp, float( cellM ).mul( k ), float( density ).mul( dens ).min( 0.95 ), salt + k * 13.1 );
		const w = B.inside.mul( B.fade );
		pit = pit.max( w );
		slope = slope.add( capSlope( B.v, B.d ).mul( w ).mul( depth ) );
		rim = rim.max( B.rim.mul( B.fade ) );
		// Variance from the mean bubble (0.18 cell radius), not per cell:
		// a per cell value would show the grid as blocks of roughness.
		const fm = fadeIn( float( cellM ).mul( k * 0.36 ), fp, 1.0, 3.0 );
		s2 = s2.add( float( 1 ).sub( fm ).mul( density ).mul( dens * 0.03 * depth ) );

	}

	return { pit, slope, rim, s2 };

}

// Laths in a glass: share of the cells that hold one, tilt of its face.
export function microlites( q, fp, sizeM, salt, share = 0.45, tilt = 1.2 ) {

	const C = crystals( mod( q.div( sizeM ), 4096 ).add( salt ), { elong: 3, size: 0.3, square: 0.6 } );
	const h = hash3( C.id1.add( salt + 3.3 ) );
	const w = fadeIn( sizeM, fp, 1.5, 4.0 );
	const lath = clamp( float( 0.32 ).sub( C.d1 ).mul( sizeM ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( h.z, share ) );
	return { on: lath.mul( w ), slope: h.xy.sub( 0.5 ).mul( tilt ).mul( lath ).mul( w ), s2: float( 0.04 * share * tilt ).mul( w.oneMinus() ), h };

}
