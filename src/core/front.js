// Growth fronts: a process that spreads over a surface (fire, frost, rust,
// ink, mould, drying) reaches each point at an arrival time T. A point is
// reached when T < Tth, the threshold the progress moves; age = Tth - T
// says how long ago the front passed, so every zone behind it (ember,
// char, ash) is a band of age, and nothing pops while the front moves.
//   arrival   T from seeds that start at different times: an additively
//             weighted Voronoi (each seed has a delay), seeds are points
//             or short segments (scratches). Also the second arrival, so
//             the line where two fronts meet is known (colonies stop there)
//   rough     fractal wiggle added to T, amplitude proportional to the
//             period of each octave: the front stays irregular at every
//             zoom; octaves under a few pixels fade out
//   ageMeters the age in meters and the pixel size in the same units, from
//             the screen derivatives of T, so band edges are anti-aliased
//             by the footprint while they move
//   loop      a progress that plays the process again and again from the
//             material clock: hold, grow, hold, a short smooth rewind
// T is in cell units: a distance field with a slope near 1 per cell.

import { vec2, float, floor, cos, sin, clamp, step, mod, fract, smoothstep } from 'three/tsl';
import { pick, fadeIn, surfaceGradient } from './lod.js';
import { hash3, valueNoise, wrapCoord } from './hash.js';

// q: coordinates in cells. o: { jitter, delay (cells of lag at most),
// len (half length of a segment in cells, 0 for points), salt }.
// Returns { t1, t2, d (distance to the winning seed, cells), id (its
// cell id), h (its hash), toSeed }.
export function arrival( q, o = {} ) {

	const jitter = o.jitter ?? 0.7, delay = float( o.delay ?? 0.3 ), salt = o.salt ?? 0;
	const len = o.len ?? 0;
	const cell = floor( q ).toVar();
	let t1 = float( 1e3 ), t2 = float( 1e3 ), d1 = float( 1e3 ), id1 = vec2( 0 ), h1 = hash3( vec2( 0 ) ), ts1 = vec2( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = cell.add( vec2( ox, oy ) );
		const hid = wrapCoord( id ).add( salt );
		const h = hash3( hid );
		const c = id.add( 0.5 ).add( h.xy.sub( 0.5 ).mul( jitter ) );
		let v = q.sub( c );
		if ( len ) {

			const h2 = hash3( hid.add( 17.31 ) );
			const a = h2.x.mul( 6.2832 );
			const dir = vec2( cos( a ), sin( a ) );
			const half = float( len ).mul( h2.y.mul( 0.6 ).add( 0.4 ) );
			v = v.sub( dir.mul( clamp( v.dot( dir ), half.negate(), half ) ) );

		}

		const dist = v.length();
		const t = dist.add( h.z.mul( delay ) );
		const first = step( t, t1 );
		const second = float( 1 ).sub( first ).mul( step( t, t2 ) );
		t2 = pick( first, t1, pick( second, t, t2 ) ).toVar();
		t1 = pick( first, t, t1 ).toVar();
		d1 = pick( first, dist, d1 ).toVar();
		id1 = pick( first, id, id1 ).toVar();
		h1 = pick( first, h, h1 ).toVar();
		ts1 = pick( first, v, ts1 ).toVar();

	}

	return { t1, t2, d: d1, id: id1, h: h1, toSeed: ts1 };

}

// A seed near the middle of a 30 cm face (coords 0.15, 0.15) shifted by
// `off` cells, so the deepest zoom of the demo sees the front pass in
// the middle of the cycle. On a real asset it is one seed more.
export function heroSeed( q, cellM, off ) {

	return q.sub( vec2( 0.15, 0.15 ).div( cellM ).add( vec2( off[ 0 ], off[ 1 ] ) ) ).length();

}

// Fractal wiggle for T (cell units). p in meters. Octave i has period
// cellM * top / 2^i and amplitude amp * period / cellM; `oct` octaves,
// none finer than minM meters.
export function rough( p, cellM, fp, { top = 0.25, amp = 0.35, oct = 10, minM = 1e-5, salt = 0 } = {} ) {

	let s = float( 0 );
	let per = top;
	for ( let i = 0; i < oct; i ++ ) {

		const perM = cellM.mul( per );
		const n = valueNoise( wrapCoord( p.div( perM ) ).add( salt + i * 3.71 ) ).sub( 0.5 );
		s = s.add( n.mul( per * amp * 2 ).mul( fadeIn( perM, fp, 1.5, 4.0 ) ).mul( step( minM, perM ) ) );
		per *= 0.5;

	}

	return s;

}

// Age in meters behind the front (positive: reached) and the size of a
// pixel in those units, from the screen derivatives of T. aa(x) is the
// share of the pixel past an edge at age x (meters).
export function ageMeters( T, Tth, cellM, p, fp ) {

	const g = surfaceGradient( T, p ).length().mul( cellM ).clamp( 0.35, 6 );
	const fpA = fp.mul( g ).toVar();
	const age = Tth.sub( T ).mul( cellM ).toVar();
	const aa = ( x ) => clamp( age.sub( x ).div( fpA ).add( 0.5 ), 0, 1 );
	return { age, fpA, aa };

}

// Progress 0..1 from the clock: hold at 0, grow (eased), hold at 1, then
// rewind fast and smoothly, so the loop has no jump. `fixed` >= 0 wins.
export function loopProgress( time, period, hold, fixed ) {

	const x = fract( time.div( period ) );
	const back = 0.08;
	const up = smoothstep( hold, float( 1 - back ).sub( hold ), x );
	const down = smoothstep( 1 - back, 1, x );
	const auto = up.mul( down.oneMinus() );
	return pick( step( 0, fixed ), fixed.clamp( 0, 1 ), auto );

}
