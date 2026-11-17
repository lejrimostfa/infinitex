// Moving patterns for liquids, seamless in time.
//   curlFlow  a swirling velocity field without sources or sinks (the curl
//             of a noise potential): a film or a slick turns in eddies,
//             it never piles up or empties at a point
//   advect    a pattern carried by a velocity field. Carried too long, it
//             would stretch without end, so it is sampled at two phases
//             half a period apart and crossfaded (two phase flow mapping):
//             each phase restarts while its weight is 0, with a new
//             random offset, so nothing pops and nothing repeats
// Velocities in m/s, periods in seconds, sizes in surface meters.

import { vec2, float, floor, fract, mod } from 'three/tsl';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';

// Velocity (m/s) of eddies about scaleM wide turning at about `speed`.
export function curlFlow( p, scaleM, speed, salt = 0 ) {

	const q = wrapCoord( p.div( scaleM ) ).add( salt );
	const e = 0.05;
	const n0 = valueNoise( q ), nx = valueNoise( q.add( vec2( e, 0 ) ) ), ny = valueNoise( q.add( vec2( 0, e ) ) );
	const n1 = valueNoise( q.mul( 2.1 ).add( 7.7 ) );
	const n1x = valueNoise( q.add( vec2( e, 0 ) ).mul( 2.1 ).add( 7.7 ) ), n1y = valueNoise( q.add( vec2( 0, e ) ).mul( 2.1 ).add( 7.7 ) );
	const gx = nx.sub( n0 ).add( n1x.sub( n1 ).mul( 0.35 ) ), gy = ny.sub( n0 ).add( n1y.sub( n1 ).mul( 0.35 ) );
	return vec2( gy, gx.negate() ).div( e ).mul( speed );

}

// sample( q, salt ) -> float pattern with mean `mean`. Returns the
// crossfaded value, its contrast restored (two noises mixed are flatter).
export function advect( p, vel, t, period, sample, mean = 0.5 ) {

	const c = float( t ).div( period );
	const ph0 = fract( c ), ph1 = fract( c.add( 0.5 ) );
	const k0 = wrapCoord( floor( c ) ), k1 = wrapCoord( floor( c.add( 0.5 ) ) ).add( 0.5 );
	const w0 = float( 1 ).sub( ph0.mul( 2 ).sub( 1 ).abs() );
	const w1 = float( 1 ).sub( w0 );
	const a = sample( p.sub( vel.mul( ph0.mul( period ) ) ), hash3( vec2( k0, 3.1 ) ).xy.mul( 50 ) );
	const b = sample( p.sub( vel.mul( ph1.mul( period ) ) ), hash3( vec2( k1, 7.3 ) ).xy.mul( 50 ) );
	const norm = w0.mul( w0 ).add( w1.mul( w1 ) ).sqrt();
	return a.sub( mean ).mul( w0 ).add( b.sub( mean ).mul( w1 ) ).div( norm ).add( mean );

}
