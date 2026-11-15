// Precious opal, polished. Silica spheres of 150 to 300 nm stack into
// small crystals; each crystal reflects one wavelength by Bragg
// diffraction, lambda = 2 n d cos(theta), so its colour depends on the
// sphere spacing d and on the angle between the view, the light and its
// lattice planes. Turn the stone: patches flash on and off and shift hue.
//   L0 body     milky white with a blue haze, potch zones (common opal,
//               no fire) of a few cm, greyer
//   L1 patches  crystals of size_mm (2 to 6 mm), angular, each with its
//               own lattice tilt and sphere spacing ("harlequin")
//   L2 bands    stacking faults: parallel bands of feature_mm (0.2 to
//               0.5 mm) inside each patch, the spacing a little off in each
//   L3 pinfire  sub-domains of about 60 um, slightly turned lattices: the
//               patch breaks into a mosaic of nearly equal colours
// The fire comes from the light falling on the stone, assumed from above
// (room light): it is the main reflection, so most of it is albedo and a
// little is emission, to keep the spectral colours clean.

import { vec2, vec3, float, clamp, smoothstep, mix, mod, fract, max } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { spectral, viewTangent, upTangent } from '../../core/optics.js';
import { fbm } from '../stone/common.js';

export function buildOpal( p, fp, u ) {

	const s = u.seed;
	const V = viewTangent(), L = upTangent();
	const H = V.add( L ).normalize();
	// Potch: zones without fire; milky body clouds.
	const potch = smoothstep( 0.5, 0.7, fbm( p, 0.06, fp, 3, 2 ) );
	const milk = fbm( p, 0.02, fp, 4, 5 );
	const body = mix( u.color, u.color3, potch.mul( 0.5 ) ).mul( milk.sub( 0.5 ).mul( 0.25 ).add( 1 ) );

	// L1: angular patches, a little stretched along a flow.
	const warp = vec2( valueNoise( p.div( u.sizeM.mul( 3 ) ).add( s ) ), valueNoise( p.div( u.sizeM.mul( 3 ) ).add( s.add( 9 ) ) ) ).sub( 0.5 ).mul( u.sizeM ).mul( 0.8 );
	const P1 = voronoi( mod( p.add( warp ).div( u.sizeM ), 4096 ).add( s.mul( 3 ) ), 0.95 );
	const h1 = hash3( P1.id1.add( 4.1 ) ), k1 = hash3( P1.id1.add( 9.7 ) );
	const w1 = fadeIn( u.sizeM, fp, 1.5, 4.0 );
	// L3: pinfire sub-domains jitter the lattice of the patch.
	const P3 = voronoi( mod( p.div( u.featureM.mul( 0.25 ) ), 4096 ).add( 7.7 ), 0.9 );
	const h3 = hash3( P3.id1.add( 2.3 ) );
	const w3 = fadeIn( u.featureM.mul( 0.25 ), fp, 1.5, 4.0 );
	const tilt = h1.xy.sub( 0.5 ).mul( 1.3 ).add( h3.xy.sub( 0.5 ).mul( 0.35 ).mul( w3 ) );
	const g = vec3( tilt, 1 ).normalize();
	// L2: stacking bands across the patch.
	const bdir = vec2( k1.x.sub( 0.5 ), k1.y.sub( 0.5 ) ).normalize();
	const band = fract( p.dot( bdir ).div( u.featureM ).add( k1.z.mul( 7 ) ) );
	const w2 = fadeIn( u.featureM, fp, 2.0, 5.0 );
	const bandShift = band.sub( 0.5 ).mul( 0.08 ).mul( w2 ).mul( valueNoise( p.div( u.featureM.mul( 6 ) ).add( 3.3 ) ) );

	// Bragg: spacing 190 to 300 nm, n = 1.45; theta between the view and
	// the planes (refraction softens it). Under room light the planes
	// mirror whatever lies in the reflected direction: brighter when that
	// points up to the ceiling lights.
	const d = mix( float( 190 ), float( 300 ), h1.z ).mul( bandShift.add( 1 ) ).add( h3.z.sub( 0.5 ).mul( 20 ).mul( w3 ) );
	const c = V.dot( g ).clamp( 0, 1 );
	const lambda = d.mul( 2.9 ).mul( mix( float( 1 ), c, 0.55 ) );
	const R = g.mul( V.dot( g ).mul( 2 ) ).sub( V );
	const flash = smoothstep( - 0.2, 0.9, R.dot( L ) ).mul( 0.8 ).add( 0.2 ).mul( smoothstep( 0.3, 0.6, H.dot( g ).add( 0.4 ) ) );
	const rim = smoothstep( 0.0, 0.06, P1.edge ).mul( 0.25 ).add( 0.75 ); // the boundaries read faintly
	const fireOn = float( 1 ).sub( potch ).mul( u.amount ).mul( step01( h1.x, 0.12 ) );
	const fireNear = spectral( lambda ).mul( flash ).mul( rim ).mul( fireOn ).mul( float( 1 ).sub( bandShift.abs().mul( 3 ) ) );
	// Far: patches below a pixel blend into a soft mixed shimmer.
	const fireFar = vec3( 0.32, 0.42, 0.4 ).mul( fireOn ).mul( 0.5 );
	const fire = mix( fireFar, fireNear, w1 );

	const color = body.mul( float( 1 ).sub( max( fire.x, max( fire.y, fire.z ) ).mul( 0.85 ) ) ).add( fire.mul( 1.35 ) );
	const fine = fbm( p, 3e-4, fp, 2, 11 ).sub( 0.5 );
	return {
		color: clamp( color, 0, 1 ), emissive: fire.mul( u.glow ).mul( 0.35 ),
		slope: vec2( fine, fine.negate() ).mul( 0.01 ).mul( u.relief ), rough: u.roughness, s2: float( 0.0004 ),
		cavity: float( 0 ), coat: u.coat, coatRough: float( 0.02 ),
	};

}

// 1 above the threshold: a few patches stay dull.
function step01( x, t ) {

	return smoothstep( t, t + 0.02, x );

}
