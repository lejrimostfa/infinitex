// A hand-painted cobalt motif on tin glaze (Delft, Nevers, Moustiers).
// The painter works on the raw glaze powder, so the pigment soaks in and
// its edges are soft (about 0.15 mm), and the firing melts it under the
// coat. One motif per square of motif_mm (100 mm):
//   a flower: eight petals in a light wash, outlined, a vein in each,
//   a dark heart; a frame of two rings with dots between; a fan of
//   three leaves in each corner; a small star at the middle of each side.
// Real painting is never exact: the whole drawing wobbles by about 1.5 mm,
// each square turns a little, the wash pools darker at its edges.
// At the brush scale (5 mm) the wash shows bristle streaks along the
// stroke; at 0.5 mm the cobalt is grains of 20 to 40 um, unevenly spread.
//
// Returns pigment density 0..1 (0 white glaze, 1 full cobalt).

import { vec2, float, floor, fract, clamp, smoothstep, abs, cos, sin, atan, mix, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';

// Soft edge of a shape whose signed distance (meters, positive inside) is
// sd: the pigment bleeds over `bleed` meters, or a pixel when larger.
const fill = ( sd, fp, bleed = 1.5e-4 ) => clamp( sd.div( fp.max( bleed ) ).add( 0.5 ), 0, 1 );

// Brush streaks: bristles leave lines along the stroke, about 0.25 mm apart.
function streaks( along, across, fp, seed ) {

	const n = valueNoise( vec2( along.div( 0.004 ), across.div( 0.00028 ) ).add( seed ) );
	return mix( float( 0.5 ), n, fadeIn( float( 0.00028 ), fp, 1.0, 3.0 ) ).mul( 0.6 ).add( 0.7 );

}

export function paintMotif( p, fp, u ) {

	const T = u.motifM, s = u.seed;
	// The hand wobbles, and each square turns a little.
	const wob = vec2( valueNoise( p.div( T.mul( 0.18 ) ).add( s ) ), valueNoise( p.div( T.mul( 0.18 ) ).add( s.add( 4.4 ) ) ) ).sub( 0.5 ).mul( T ).mul( 0.03 );
	const q = p.add( wob ).div( T ).add( vec2( 0.13, 0.09 ) );
	const tile = floor( q );
	const h = hash3( wrapCoord( tile ).add( s ) );
	const lp = fract( q ).sub( 0.5 );
	const rot = h.x.sub( 0.5 ).mul( 0.12 );
	const l = vec2( lp.x.mul( cos( rot ) ).sub( lp.y.mul( sin( rot ) ) ), lp.x.mul( sin( rot ) ).add( lp.y.mul( cos( rot ) ) ) ).toVar();
	const r = l.length(), a = atan( l.y, l.x );
	const lw = float( 0.0006 ).div( T ); // outline half width, motif units

	// Flower: eight petals, wash inside, dark outline, a vein in each.
	const ph = a.mul( 4 ).add( h.y.mul( 0.5 ) );
	const R = abs( cos( ph ) ).pow( 0.7 ).mul( 0.55 ).add( 0.45 ).mul( 0.17 );
	const petal = fill( R.sub( r ).mul( T ), fp );
	const pool = smoothstep( R.sub( 0.025 ), R, r ).mul( 0.35 ); // the wash dries darker at its edge
	const outline = fill( lw.sub( abs( r.sub( R ) ) ).mul( T ), fp );
	const vein = fill( lw.mul( 0.6 ).sub( abs( sin( ph ) ).mul( r ).mul( 0.25 ) ).mul( T ), fp ).mul( smoothstep( 0.05, 0.07, r ) ).mul( smoothstep( 0.0, 0.03, R.mul( 0.85 ).sub( r ) ) );
	const heart = fill( float( 0.04 ).sub( r ).mul( T ), fp );
	const pStreak = streaks( r.mul( T ), a.mul( r ).mul( T ), fp, s );
	let cov = petal.mul( pool.add( 0.38 ) ).mul( pStreak ).max( outline.mul( 0.95 ) ).max( vein.mul( 0.8 ) ).max( heart.mul( 0.92 ) );

	// Frame: two rings, a dot between them every 15 degrees.
	const ring = fill( lw.mul( 0.8 ).sub( abs( r.sub( 0.3 ) ) ).mul( T ), fp ).max( fill( lw.mul( 1.3 ).sub( abs( r.sub( 0.335 ) ) ).mul( T ), fp ) );
	const da = fract( a.div( Math.PI * 2 / 24 ) ).sub( 0.5 ).mul( Math.PI * 2 / 24 ).mul( 0.3175 );
	const dot = fill( float( 0.007 ).sub( vec2( da, r.sub( 0.3175 ) ).length() ).mul( T ), fp );
	cov = cov.max( ring.mul( 0.9 ) ).max( dot.mul( 0.85 ) );

	// Corners: a fan of three leaves from each corner.
	const lc = vec2( 0.5 ).sub( abs( l ) );
	const rc = lc.length(), ac = atan( lc.y, lc.x ); // 0..pi/2 inside the square
	const lph = ac.mul( 6 ).sub( Math.PI * 0.5 );
	const RL = abs( cos( lph ) ).pow( 1.4 ).mul( 0.17 ).add( 0.02 );
	const leaf = fill( RL.sub( rc ).mul( T ), fp );
	const lOut = fill( lw.sub( abs( rc.sub( RL ) ) ).mul( T ), fp );
	const lStreak = streaks( rc.mul( T ), ac.mul( rc ).mul( T ), fp, s.add( 2 ) );
	const lpool = smoothstep( RL.sub( 0.02 ), RL, rc ).mul( 0.3 );
	cov = cov.max( leaf.mul( lpool.add( 0.42 ) ).mul( lStreak ) ).max( lOut.mul( 0.92 ) );

	// A small star at the middle of each side: a dot and four petals.
	const lm = vec2( abs( l.x ).sub( 0.5 ), l.y ).toVar();
	const lm2 = pickSide( l, lm );
	const rm = lm2.length(), am = atan( lm2.y, lm2.x );
	const star = fill( abs( cos( am.mul( 2 ) ) ).mul( 0.03 ).add( 0.008 ).sub( rm ).mul( T ), fp );
	cov = cov.max( star.mul( 0.8 ) );

	// Each square painted with a little more or less cobalt; pigment grains.
	cov = cov.mul( h.z.mul( 0.2 ).add( 0.9 ) );
	const grain = valueNoise( wrapCoord( p.div( 3e-5 ) ).add( 1.3 ) ).mul( 0.6 ).add( valueNoise( wrapCoord( p.div( 1.1e-5 ) ).add( 7.1 ) ).mul( 0.4 ) );
	const speck = smoothstep( 0.82, 0.9, hash1( floor( wrapCoord( p.div( 1.5e-5 ) ) ) ) );
	const wG = fadeIn( float( 3e-5 ), fp, 1.5, 4.0 );
	cov = cov.mul( mix( float( 1 ), grain.mul( 0.7 ).add( 0.65 ).add( speck.mul( 0.35 ) ), wG ) );
	return clamp( cov, 0, 1 );

}

// The side star sits on the nearest side midpoint (left/right or top/bottom).
function pickSide( l, lmx ) {

	const lmy = vec2( abs( l.y ).sub( 0.5 ), l.x );
	const t = smoothstep( - 0.001, 0.001, abs( l.y ).sub( abs( l.x ) ) );
	return mix( lmx, lmy, t );

}
