// Small blocks the organic modes share. Sizes in surface meters.
//   rot2     coordinates turned by an angle (veins, ribs, streaks)
//   cells    plant cells on a Voronoi net: each a dome or a cone bulging
//            between thin walls, a hash per cell, an analytic slope; the
//            level fades in by the footprint and hands its slope variance
//            to the roughness once it is too small to draw
//   ridged   ridged fbm and its slope by finite differences (wrinkles)
//   warp2    a slow offset vector for domain warps
// Re-exported: fbm, band and lines (stone/common.js), grains, packed and
// fibres (ground/grains.js), hairs (hairs.js), so modes import one file.

import { vec2, float, cos, sin, clamp, smoothstep, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

export { fbm, band, lines, dir2 } from '../stone/common.js';
export { grains, packed, fibres } from '../ground/grains.js';
export { hairs } from './hairs.js';

export function rot2( p, a ) {

	const c = cos( a ), s = sin( a );
	return vec2( p.x.mul( c ).add( p.y.mul( s ) ), p.y.mul( c ).sub( p.x.mul( s ) ) );

}

// o: { jitter, cone (0 dome, 1 cone), crown (cells units), wallM (half
// width of the wall in meters), lo, hi (fade in pixels per cell) }.
// Returns { V, id, h (0 wall .. 1 top), slope (per unit amplitude), wall
// (AA line), w (fade weight), s2 (slope variance when faded) }.
export function cells( p, sizeM, fp, salt, o = {} ) {

	const V = voronoi( mod( p.div( sizeM ), 4096 ).add( salt ), o.jitter ?? 0.8 );
	const id = hash3( V.id1.add( salt * 1.71 + 0.3 ) );
	const w = fadeIn( sizeM, fp, o.lo ?? 2.0, o.hi ?? 6.0 );
	const k = float( o.crown ?? 0.35 );
	// Height rises from the wall (edge 0) over k cells; the slope points
	// down toward the wall (dh/dp = h'(edge) * -dir).
	const s = clamp( V.edge.div( k ), 0, 1 );
	const dome = float( 1 ).sub( s.oneMinus().mul( s.oneMinus() ) );
	const dDome = s.oneMinus().mul( 2 ).div( k ).mul( smoothstep( 1.0, 0.98, s ) );
	// A cone: height falls with the distance to the seed.
	const r = V.toSeed.length().max( 1e-4 );
	const cone = float( o.cone ?? 0 );
	const h = dome.mul( float( 1 ).sub( cone.mul( r.mul( 1.6 ).min( 1 ) ) ) ).toVar();
	const slope = V.dir.negate().mul( dDome ).mul( cone.oneMinus().mul( 0.7 ).add( 0.3 ) )
		.sub( V.toSeed.div( r ).mul( cone ).mul( 1.6 ).mul( dome ) ).mul( w );
	const wallM = o.wallM ?? sizeM.mul( 0.04 );
	const wall = clamp( float( wallM ).sub( V.edge.mul( sizeM ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( fadeIn( sizeM, fp, 3.0, 8.0 ) );
	const s2 = w.oneMinus().mul( cone.mul( 0.25 ).add( 0.05 ) );
	return { V, id, h, slope, wall, w, s2 };

}

// Ridged fbm (creases where the noise crosses 0.5) and its slope, by
// central differences of the whole sum. Octaves under a few pixels fade
// to flat. Height 0..1, slope in units of height per scale.
export function ridged( p, scaleM, fp, oct = 4, salt = 0 ) {

	const e = float( scaleM ).mul( 0.01 );
	const sample = ( q ) => {

		let sum = float( 0 ), amp = 0.5, tot = 0;
		for ( let i = 0; i < oct; i ++ ) {

			const per = float( scaleM ).mul( 1 / ( 1 << i ) );
			const n = valueNoise( mod( q.div( per ), 4096 ).add( salt + i * 7.13 ) );
			const r = float( 1 ).sub( n.sub( 0.5 ).abs().mul( 2 ) );
			sum = sum.add( r.mul( r ).mul( amp ).mul( fadeIn( per, fp, 1.5, 4.0 ) ) );
			tot += amp;
			amp *= 0.55;

		}

		return sum.div( tot );

	};

	const h = sample( p ).toVar();
	const hx = sample( p.add( vec2( e, 0 ) ) ), hy = sample( p.add( vec2( 0, e ) ) );
	const slope = vec2( hx.sub( h ), hy.sub( h ) ).div( e );
	return { h, slope };

}

// Two value noises, an offset vector in -0.5..0.5 (domain warps).
export const warp2 = ( p, perM, salt = 0 ) =>
	vec2( valueNoise( p.div( perM ).add( salt ) ), valueNoise( p.div( perM ).add( salt + 31.7 ) ) ).sub( 0.5 );
