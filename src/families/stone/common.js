// Small blocks every stone mode shares. All sizes in surface meters.
//   fbm        value noise octaves, the fine ones faded by the footprint
//              (fbmGated: the faded ones skipped)
//   band       a line of half width w around d = 0, anti-aliased
//   lines      parallel lines (cleavage, twins, laminae), faded when the
//              spacing gets near a pixel so they never moire
//   grains     packed rounded grains (sand, grog, aggregate) on a Voronoi
//   scratches  polishing scratches: short straight hairlines, 1 to 3 um
//   tone       per cell colour jitter

import { vec2, float, floor, fract, cos, sin, clamp, smoothstep, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

export const dir2 = ( a ) => vec2( cos( a ), sin( a ) );

// Value noise sum in [0, 1). Octave i has period scaleM / 2^i and fades
// to its mean (0.5) when it gets under a few pixels.
export function fbm( p, scaleM, fp, oct = 4, seed = 0 ) {

	let sum = float( 0 ), amp = 0.5, total = 0;
	for ( let i = 0; i < oct; i ++ ) {

		const per = float( scaleM ).mul( 1 / ( 1 << i ) );
		const q = wrapCoord( p.div( per ) ).add( vec2( seed * 1.7 + i * 5.3, seed * 3.1 + i * 2.9 ) );
		const n = valueNoise( q ).sub( 0.5 ).mul( fadeIn( per, fp, 1.0, 3.0 ) );
		sum = sum.add( n.mul( amp ) );
		total += amp;
		amp *= 0.5;

	}

	return sum.div( total ).add( 0.5 );

}

// Same sum, each octave in a gate() (core/lod.js), nested: once an octave
// has faded, it and every finer one are skipped. The sum keeps the order
// of fbm(), so the value is the same. It pays where most octaves are fine
// for the view (granite, marble); elsewhere the branches cost more than
// they save, so fbm() stays the default.
export function fbmGated( p, scaleM, fp, oct = 4, seed = 0 ) {

	let total = 0;
	for ( let i = 0, amp = 0.5; i < oct; i ++, amp *= 0.5 ) total += amp;
	const pv = p.isVarNode ? p : p.toVar();
	const octaves = ( i, amp, sum ) => {

		if ( i >= oct ) return sum;
		const per = float( scaleM ).mul( 1 / ( 1 << i ) );
		const s = sum.isVarNode ? sum : sum.toVar();
		return gate( fadeOn( per, fp, 1.0 ), { sum: s }, () => {

			const q = wrapCoord( pv.div( per ) ).add( vec2( seed * 1.7 + i * 5.3, seed * 3.1 + i * 2.9 ) );
			const n = valueNoise( q ).sub( 0.5 ).mul( fadeIn( per, fp, 1.0, 3.0 ) );
			return { sum: octaves( i + 1, amp * 0.5, s.add( n.mul( amp ) ) ) };

		}, [ pv, fp, s ] ).sum;

	};

	return octaves( 0, 0.5, float( 0 ) ).div( total ).add( 0.5 );

}

// 1 where |d| < w, edges anti-aliased by the footprint.
export const band = ( d, w, fp ) => clamp( float( w ).sub( d.abs() ).div( fp ).add( 0.5 ), 0, 1 );

// Lines across coordinate t (meters), every spacing meters, half width w.
// Faded in once the spacing spans `lo` pixels: thin regular lines alias.
export function lines( t, spacing, w, fp, lo = 3.0, hi = 8.0 ) {

	const d = fract( t.div( spacing ).add( 0.5 ) ).sub( 0.5 ).mul( spacing );
	return band( d, w, fp ).mul( fadeIn( spacing, fp, lo, hi ) );

}

// Packed grains of mean size sizeM. gap: share of the cell left to the
// matrix between grains (0 touching). Returns the Voronoi, a per grain
// hash, `inside` (1 on a grain, AA), a domed slope and the fade weight.
export function grains( p, sizeM, fp, gap = 0.1, seed = 0, jitter = 0.6 ) {

	const V = voronoi( wrapCoord( p.div( sizeM ) ).add( seed * 7.3 ), jitter );
	const h = hash3( V.id1.add( seed * 1.9 + 0.7 ) );
	// A round grain, small enough (with jitter 0.6) that two neighbours
	// rarely meet, so they never read as one blob split by a line.
	const r = h.x.mul( 0.12 ).add( 0.3 ); // radius, cells
	// Outline never a true circle: a wobble by direction from the seed.
	const wob = valueNoise( V.toSeed.normalize().mul( 1.7 ).add( h.xy.mul( 20 ) ) ).sub( 0.5 ).mul( 0.3 ).add( 1 );
	const d = V.toSeed.length().mul( wob );
	const m = r.sub( d ).min( V.edge.sub( gap ) ); // distance to the grain outline, cells
	const w = fadeIn( sizeM, fp, 1.5, 4.0 );
	const inside = clamp( m.mul( sizeM ).div( fp ).add( 0.5 ), 0, 1 ).mul( w ).add( w.oneMinus().mul( 0.5 ) );
	// Domed: height falls away from the seed, steepest at the rim.
	const slope = V.toSeed.mul( - 0.9 ).mul( smoothstep( 0.0, 0.15, m ).mul( 0.6 ).add( 0.4 ) ).mul( w );
	// Soft: the grain seen through a film (paste skin), edges blurred.
	const soft = smoothstep( - 0.05, 0.2, m ).mul( w ).add( w.oneMinus().mul( 0.5 ) );
	return { V, h, inside, soft, slope, w, m };

}

// Polishing scratches: in each cell of cellM a straight hairline at a
// random angle, half width wM, shorter than the cell. density 0..1.
export function scratches( p, fp, cellM, wM, density, seed = 0 ) {

	const q = wrapCoord( p.div( cellM ) ).add( seed * 3.7 );
	const id = floor( q ), f = fract( q ).sub( 0.5 );
	const h = hash3( id );
	const d = dir2( h.x.mul( 6.283 ) );
	const along = f.dot( d ), across = f.dot( vec2( d.y.negate(), d.x ) ).sub( h.y.sub( 0.5 ).mul( 0.4 ) );
	const len = smoothstep( 0.45, 0.25, along.abs() );
	const on = smoothstep( 0, 0.05, float( density ).sub( h.z ) );
	return band( across.mul( cellM ), wM, fp ).mul( len ).mul( on ).mul( fadeIn( float( wM ).mul( 8 ), fp, 2.0, 5.0 ) );

}

// Colour jitter of a cell: 1 +- amount.
export const tone = ( id, amount, salt = 0 ) => hash1( id.add( salt ) ).sub( 0.5 ).mul( amount ).add( 1 );
