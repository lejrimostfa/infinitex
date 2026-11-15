// Calm shallow water over sand (a pond edge, a clear lake), seen from
// above. The surface reflects 2 % face on (ior 1.33, the material does
// the Fresnel); the rest of what we see comes up from below.
//   L0 depth     the bottom lies 1.5 to 10 cm down (depth_mm); the light
//                path down and back takes the colour of the water
//                (clarity: 12 cm), so deep pockets read teal
//   L0 gusts     patches of wind about 9 cm wide drift over the water:
//                rippled there, glassy between (waves.js)
//   L1 ripples   20 travelling waves from size_mm (6 cm) to feature_mm
//                (3 mm), with the gravity capillary dispersion
//   L1 caustics  each wave is a weak lens: crests focus the sun on the
//                bottom in a net of bright lines (core/caustics.js, from
//                the full curvature of the surface)
//   L1 refraction the bottom is seen where the bent ray meets it: it
//                slides under the eye (parallax) and wobbles with the waves
//   L2 sand      the bottom: sand ripples (7 cm), pebbles (1 to 2 cm),
//                quartz and dark grains of 0.5 mm
//   L2 floating  air bubbles of 0.2 to 0.9 mm and pollen or dust grains
//                (50 to 200 um) ride the surface drift (4 mm/s downwind)
// Returns colour, slope, cavity, roughness and its slope variance.

import { vec2, vec3, float, clamp, exp, mix, cos, sin, step, smoothstep } from 'three/tsl';
import { viewInCoords } from '../../core/optics.js';
import { causticLight } from '../../core/caustics.js';
import { footprint } from '../../core/lod.js';
import { ixTime } from '../../core/clock.js';
import { fbm, grains } from '../stone/common.js';
import { bubbleField, capSlope } from '../ceramic/bubbles.js';
import { waveField, gusts } from './waves.js';

export const N_WATER = 1.33;

// Where the ray seen at p meets a layer d meters below: bent at the
// surface (view direction over n) and by the wave slope.
export function underWater( p, d, slope ) {

	const F = viewInCoords( p );
	// The view ray, bent at the surface (Snell, small angles kept exact
	// in length): its part along the surface shrinks by n.
	const along = F.Vview.sub( F.n.mul( F.Vview.dot( F.n ) ) ).div( N_WATER ); // view space
	const vn = float( 1 ).sub( along.dot( along ) ).max( 0.05 ).sqrt();
	const at = p.sub( F.toP( along.mul( d ).div( vn ) ) ).add( slope.mul( d ).mul( 1 - 1 / N_WATER ) );
	return { at, path: d.mul( float( 1 ).add( vn.reciprocal() ) ) };

}

// Floating things that ride the surface: bubbles and specks.
export function floaters( p, fp, u, t, color, slope ) {

	const wind = vec2( cos( u.angle ), sin( u.angle ) );
	const q = p.sub( wind.mul( t.mul( 0.004 ) ) );
	const B = bubbleField( q, fp, float( 0.0025 ), u.density.mul( 0.12 ), 11 );
	const bw = B.inside.mul( B.fade );
	// A floating bubble: a clear dome that mirrors the room, a thin bright
	// meniscus ring where it meets the water.
	let col = mix( color, color.mul( 0.8 ), bw );
	col = mix( col, vec3( 0.7, 0.74, 0.76 ), B.rim.mul( B.fade ).mul( 0.2 ) );
	const sl = slope.sub( capSlope( B.v, B.d ).mul( bw ).mul( 0.6 ) ); // a dome falls outward
	const S = bubbleField( q, fp, float( 6e-4 ), u.density.mul( 0.22 ), 23 );
	const speck = mix( vec3( 0.55, 0.42, 0.14 ), u.color3.add( 0.12 ), step( 0.6, S.h.y ) ).mul( S.h.z.mul( 0.5 ).add( 0.6 ) );
	col = mix( col, speck, S.inside.mul( S.fade ) );
	return { color: col, slope: sl.sub( capSlope( S.v, S.d ).mul( S.inside ).mul( S.fade ).mul( 0.4 ) ), mask: bw.max( S.inside.mul( S.fade ) ) };

}

// The ripples of buildWater, steepness and gusts included.
const waveOpts = ( u, t, gu, count ) => ( {
	lmax: u.sizeM, lmin: u.featureM, angle: u.angle, steep: u.amount.mul( 0.14 ).mul( gu.mul( 0.65 ).add( 0.35 ) ),
	t, rate: u.speed, seed: u.seed, gust: gu, count, spreadDeg: u.spread,
} );

// Height of the water surface for the relief march (core/relief.js), in
// metres below the highest crest. The 8 longest-to-shortest waves carry
// the shape; the march stays cheap. Bound: crests rise at most about
// steep * lmax / 4 above the mean.
export function waterHeight( u, p, fp ) {

	if ( u.mode !== 'water' ) return null;
	const t = ixTime.mul( u.speed );
	const H = u.amount.mul( 0.14 ).mul( u.sizeM ).mul( 0.5 ).max( 1e-6 );
	return { H, h: ( q ) => waveField( q, fp, waveOpts( u, t, gusts( q, u.angle, t, 0.09, u.seed ), 8 ) ).h.sub( H.mul( 0.5 ) ).clamp( H.negate(), 0 ) };

}

export function buildWater( p, fp, u ) {

	const t = ixTime.mul( u.speed );
	const gu = gusts( p, u.angle, t, 0.09, u.seed );
	const W = waveField( p, fp, waveOpts( u, t, gu ) );

	// Bottom: a slow slope of depths, read where the bent ray lands.
	const D = u.depthM.mul( fbm( p, 0.22, fp, 3, 1 ).mul( 1.6 ).add( 0.15 ) ).toVar();
	const R = underWater( p, D, W.slope );
	// The bottom is drawn half a metre off: a deep, oblique ray lands
	// beyond the face (b < 0), and the shared helpers wrap cells with
	// mod(.., 4096), which jumps at 0. Kept positive, no seam.
	const b = R.at.add( 0.5 ).toVar();
	// Seen from close, the bottom is much further than the surface: it
	// looks smaller, so its detail fades by its own footprint.
	const fb = footprint( b ).toVar();
	const dir = vec2( cos( u.angle.add( 0.3 ) ), sin( u.angle.add( 0.3 ) ) );
	const rip = sin( b.dot( dir ).div( 0.07 ).mul( 6.283 ).add( fbm( b, 0.1, fb, 2, 4 ).mul( 9 ) ) ).mul( 0.08 ).add( 1 );
	const G = grains( b, 5e-4, fb, 0.12, 3, 0.9 );
	let sand = u.color2.mul( fbm( b, 0.05, fb, 4, 2 ).sub( 0.5 ).mul( 0.5 ).add( 1 ) ).mul( rip );
	const grainCol = mix( sand.mul( G.h.z.mul( 0.6 ).add( 0.7 ) ), mix( u.color3.add( 0.04 ), vec3( 0.75, 0.72, 0.66 ), G.h.x ), step( 0.9, G.h.y ) );
	sand = mix( sand.mul( 0.8 ), grainCol, G.inside );
	// Pebbles: round (a small gap, so no cell border cuts them straight),
	// domed (lit on the sun side), sunk in the sand at the rim.
	const P = grains( b, 0.02, fb, 0.04, 5 );
	const pebOn = step( 0.72, P.h.y ).mul( P.inside ).mul( P.w );
	const dome = P.slope.dot( vec2( - 0.5, - 0.8 ) ).mul( 0.35 ).add( 0.85 ).mul( smoothstep( 0.0, 0.1, P.m ).mul( 0.35 ).add( 0.65 ) );
	const pebble = mix( vec3( 0.3, 0.28, 0.25 ), vec3( 0.52, 0.46, 0.38 ), P.h.z ).mul( fbm( b, 0.004, fb, 3, 6 ).mul( 0.5 ).add( 0.75 ) ).mul( dome );
	sand = mix( sand, pebble, pebOn );
	// Caustics: the sun only (the sky light is not focused). The net is
	// drawn where the ray lands, by the waves above that point.
	const Wb = waveField( b, fb, waveOpts( u, t, gu, 10 ) );
	const light = causticLight( Wb.hess, D, { blur: 0.06 } ).mul( 0.7 ).add( 0.15 );
	const T = exp( R.path.negate().div( u.clarity ) );
	let color = mix( u.color, sand.mul( light ), T );

	const F = floaters( p, fp, u, t, color, W.slope );
	color = F.color;
	return { color, slope: F.slope, cavity: float( 0 ), rough: u.roughness, s2: W.s2 };

}
