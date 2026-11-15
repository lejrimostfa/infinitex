// Ripples on a water surface: a sum of travelling plane waves.
// Each wave obeys the dispersion relation of deep water with surface
// tension:  w^2 = g k + (sigma / rho) k^3,  sigma / rho = 7.3e-5 m3/s2.
// So gravity waves (longer than 17 mm) go faster when long, capillary
// waves (shorter) go faster when short; the slowest, 17 mm, runs at
// 23 cm/s. A wave 5 cm long runs at 29.5 cm/s, one 3 mm long at 40 cm/s.
// Wind ripples have a slope spectrum about flat per octave: the same
// steepness (about 0.1 at most) at every length.
//   L0  long ripples along the wind, their crests bent by a slow warp,
//       in groups (each wave strong in some patches, weak in others)
//   L1  short capillary waves, spread wider around the wind (they come
//       from every gust); both damp where the wind does not blow (gusts)
// Each wave carries its Stokes second harmonic: crests sharper and higher
// than the troughs are deep, the shape of real ripples.
// Every wave fades in with its length (2 to 4 pixels) and hands its slope
// variance (s^2 / 2) to the roughness: far away the ripples are a sheen.
// Returns slope (dh/du, dh/dv), lap (mean curvature), hess (hxx, hxy,
// hyy: the full curvature, for caustic nets), h, s2.

import { vec2, vec3, float, cos, sin, mod, smoothstep } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';

export const G = 9.81, SIGMA = 7.28e-5;

// Angular frequency (rad/s) and group speed (m/s) of wave number k (1/m).
export function omega( k ) {

	return k.mul( G ).add( k.mul( k ).mul( k ).mul( SIGMA ) ).sqrt();

}

export function groupSpeed( k ) {

	return k.mul( k ).mul( 3 * SIGMA ).add( G ).div( omega( k ).mul( 2 ) );

}

// Fixed scatter of the waves (same for every seed: the seed moves phases).
const rnd = ( i, s ) => {

	const x = Math.sin( i * 12.9898 + s * 78.233 ) * 43758.5453;
	return x - Math.floor( x );

};

// Time LOD: a wave that turns faster than about 15 times a second (at
// the playback rate `rate`) would strobe at 60 frames per second. It
// fades into the roughness like a wave under a pixel. Real capillary
// waves 3 mm long turn 130 times a second: shown in slow motion
// (speed 0.3) they stay, in real time they become a shimmer.
export function flickerFade( w, rate ) {

	return smoothstep( 110, 60, w.mul( rate ?? 1 ) );

}

// o: { lmax, lmin (m), angle (rad, wind), steep (slope amplitude), t (s),
//      rate (speed), seed, count, gust (weight of the short waves, 0..1),
//      spreadDeg }
export function waveField( p, fp, o ) {

	const N = o.count ?? 20;
	const lmax = float( o.lmax ), lmin = float( o.lmin );
	// The crests are never straight: a slow warp of a quarter wave.
	// The noises below read p + 256 m: mod( .., 4096 ) keeps hashes exact
	// but jumps where its argument crosses 0, which cut world-space water
	// (a pool centred on the origin) into squares.
	const pp = p.add( 256 );
	const wq = mod( pp.div( lmax.mul( 3 ) ), 4096 ).add( o.seed );
	const warp = vec2( valueNoise( wq ), valueNoise( wq.add( 5.2 ) ) ).sub( 0.5 ).mul( lmax ).mul( 0.5 );
	const pw = p.add( warp );
	// Wave groups: each wave is strong in some patches and weak in others
	// (its own mix of two drifting noises), so the sum never reads as a
	// plaid of long straight crests.
	const eq = mod( pp.sub( vec2( cos( o.angle ), sin( o.angle ) ).mul( float( o.t ).mul( 0.1 ) ) ).div( lmax.mul( 1.6 ) ), 4096 ).add( o.seed.mul( 1.7 ) );
	const E = vec2( valueNoise( eq ), valueNoise( eq.add( 7.7 ) ) ).sub( 0.5 );
	let slope = vec2( 0 ), lap = float( 0 ), h = float( 0 ), s2 = float( 0 ), hess = vec3( 0 );
	for ( let i = 0; i < N; i ++ ) {

		const f = i / ( N - 1 );
		const lam = lmax.mul( lmin.div( lmax ).pow( f ) ).mul( 1 + ( rnd( i, 1 ) - 0.5 ) * 0.25 );
		const k = float( 2 * Math.PI ).div( lam );
		const spread = ( o.spreadDeg ?? 50 ) * Math.PI / 180 * ( 0.5 + f );
		// From every side (spread 180 or more): golden-angle directions, so no
		// two long waves line up into a grid.
		const th = float( o.angle ).add( ( o.spreadDeg ?? 50 ) >= 180 ? i * 2.39996 : ( rnd( i, 2 ) - 0.5 ) * 2 * spread );
		const d = vec2( cos( th ), sin( th ) );
		const ph = hash1( vec2( i * 3.7 + 1.1, o.seed ) ).mul( 2 * Math.PI );
		const arg = pw.dot( d ).mul( k ).sub( omega( k ).mul( o.t ) ).add( ph );
		const gust = f < 0.4 ? float( 1 ) : float( o.gust ?? 1 );
		const env = sin( E.dot( vec2( ( rnd( i, 4 ) - 0.5 ) * 30, ( rnd( i, 5 ) - 0.5 ) * 30 ) ).add( rnd( i, 6 ) * 6.28 ) ).mul( 0.5 ).add( 0.5 );
		const s = float( o.steep ).mul( ( 0.6 + 0.8 * rnd( i, 3 ) ) * 1.4 / Math.sqrt( N ) ).mul( gust ).mul( env );
		const w = fadeIn( lam, fp, 2.0, 4.0 ).mul( flickerFade( omega( k ), o.rate ) );
		const c = cos( arg ), sn = sin( arg );
		// Stokes second harmonic, -(k a^2 / 2) cos 2 arg with a = s / k:
		// sharp crests, flat troughs, as real ripples.
		const c2 = cos( arg.mul( 2 ) ), s2n = sin( arg.mul( 2 ) ), ss = s.mul( s ).mul( w );
		slope = slope.add( d.mul( s.mul( c ).mul( w ).add( ss.mul( s2n ) ) ) );
		// Curvature along d: the Hessian is that times d d^T.
		const curv = ss.mul( k ).mul( c2 ).mul( 2 ).sub( s.mul( k ).mul( sn ).mul( w ) );
		lap = lap.add( curv );
		hess = hess.add( vec3( d.x.mul( d.x ), d.x.mul( d.y ), d.y.mul( d.y ) ).mul( curv ) );
		h = h.add( s.div( k ).mul( sn ).mul( w ) ).sub( ss.div( k ).mul( c2 ).mul( 0.5 ) );
		s2 = s2.add( s.mul( s ).mul( 0.5 ).mul( w.oneMinus() ) );

	}

	return { slope, lap, hess, h, s2 };

}

// Where the wind blows now: patches (cat's paws) about 8 cm wide that
// drift with the wind at a few cm/s. 0 calm (glassy), 1 rippled.
export function gusts( p, angle, t, sizeM = 0.08, salt = 0 ) {

	const wind = vec2( cos( angle ), sin( angle ) );
	const q = mod( p.add( 256 ).sub( wind.mul( t.mul( 0.04 ) ) ).div( sizeM ), 4096 ).add( salt ); // + 256 m: see waveField
	const n = valueNoise( q ).mul( 0.65 ).add( valueNoise( q.mul( 2.3 ).add( 3.1 ) ).mul( 0.35 ) );
	return smoothstep( 0.3, 0.7, n );

}
