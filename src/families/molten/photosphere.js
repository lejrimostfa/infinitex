// The photosphere: the visible surface of the Sun, gas at about 5800 K
// (melt_k). It is the light source of a scene, so it emits far above 1
// (SUN_GAIN times glow) and reflects nothing (black, rough, flat).
//   L0 limb      the disc: we see deeper, hotter gas at the centre and
//                higher, cooler gas at the edge, so the edge is darker and
//                redder: I = 1 - u (1 - mu), mu the cosine between the
//                surface normal and the view ray, u about 0.6, larger in
//                blue than in red.
//   L1 faculae   a network of hot magnetic walls along the borders of
//                supergranules (25 granules). Seen face on they hide in the
//                granulation; seen edge on, near the limb, their hot walls
//                show as bright patches. Denser in active regions and
//                around spots (cover).
//   L2 spots     rare sunspots (sunspot.js), amount set by cover.
//   L3 granules  size_mm: convection cells (1000 km on the Sun). Hot gas
//                rises in the bright centre, cools, sinks in narrow dark
//                lanes. Each cell brightens and fades on its own clock; a
//                slow flowing warp (flowFbm) reshapes the lanes, so the
//                pattern evolves and never pops.
// Shape (preset.shape, read when the graph is built):
//   disc    a flat camera facing disc (CircleGeometry): coords are its uv,
//           0..1 over the bounding square. The disc is read as the front
//           half of a sphere of radius scale_mm: mu and the surface
//           position come from the uv, so cells shrink toward the limb.
//   sphere  a real sphere: coords in surface meters (uv times 2 pi R, pi R),
//           mu from the view ray and the interpolated normal.
// Haze: Rayleigh scattering removes blue far more than red (lambda^-4),
// so a low sun seen through a long air path turns orange then red. The
// transmission is divided by its red value: haze sets the colour, glow
// the brightness.

import { vec2, vec3, float, exp, asin, sqrt, sin, mod, smoothstep, mix, positionView, normalView } from 'three/tsl';
import { fadeIn, footprint } from '../../core/lod.js';
import { hash3, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { fbm, flowFbm } from './common.js';
import { sunspots } from './sunspot.js';

const SUN_GAIN = 12; // disc centre red at glow 1

// Chroma of a blackbody, linear sRGB, red = 1, fitted for 3000 to 7000 K
// (D65 white): green/red = 1.74 exp(-4020 / T), blue/red =
// 5.3 exp(-10750 / T). heat.js fits 1000 to 2200 K and turns blue above
// 4000 K, so the Sun has its own fit.
export function sunChroma( T ) {

	const t = float( T ).max( 2500 );
	return vec3( 1, exp( float( - 4020 ).div( t ) ).mul( 1.74 ).min( 1 ), exp( float( - 10750 ).div( t ) ).mul( 5.3 ).min( 1 ) );

}

// Wien's law at 550 nm (c2 / lambda = 26160 K) relative to T0, raised to
// contrast like heat.js (1 = physical: an umbra at 4000 K is about 0.13).
function sunRadiance( T, T0, u ) {

	const t = float( T ).max( 2500 );
	return sunChroma( t ).mul( exp( float( 26160 ).mul( T0.reciprocal().sub( t.reciprocal() ) ).mul( u.contrast ) ) );

}

// Surface position q (meters), its footprint, and mu.
function surface( p, fp, u ) {

	if ( u.shape === 'sphere' ) {

		const mu = normalView.dot( positionView.normalize().negate() ).clamp( 0, 1 );
		return { q: p, fp, mu };

	}

	// Disc: d in the unit disc, r = sin of the angle from the disc centre.
	// Arc length on the sphere is R asin(r): cells squeeze radially by mu.
	const d = p.mul( 2 ).sub( 1 );
	const r = d.length().min( 0.9995 ).toVar();
	const mu = sqrt( float( 1 ).sub( r.mul( r ) ) );
	const q = d.mul( asin( r ).div( r.max( 1e-4 ) ) ).mul( u.scaleM ).toVar( 'ix_sun_q' );
	return { q, fp: footprint( q ).toVar( 'ix_sun_fp' ), mu };

}

export function buildPhotosphere( p, fp0, u, t ) {

	const { q, fp, mu } = surface( p, fp0, u );
	const S = u.sizeM, T0 = u.meltK;
	const R = ( T ) => sunRadiance( T, T0, u );

	// L3 granules. The warp (0.45 cell) reshapes the lanes over about 30 s.
	const wx = flowFbm( q, vec2( 0 ), t, 30, S.mul( 1.6 ), fp, 2, 3 );
	const wy = flowFbm( q, vec2( 0 ), t, 30, S.mul( 1.6 ), fp, 2, 4 );
	const gq = wrapCoord( q.div( S ).add( vec2( wx, wy ).sub( 0.5 ).mul( 0.9 ) ) ).add( u.seed.mul( 3.7 ) );
	const V = voronoi( gq, 0.9 );
	const h = hash3( V.id1.add( 5.1 ) );
	// Each cell breathes (period 30 to 80 s): granules live about 10 min
	// on the Sun, sped up here so the disc looks alive.
	const breath = sin( t.mul( h.x.mul( 0.13 ).add( 0.08 ) ).add( h.y.mul( 6.283 ) ) ).mul( 0.5 ).add( 0.5 );
	// Mesogranulation: groups of cells a little hotter or cooler.
	const meso = fbm( q, S.mul( 6 ), fp, 2, 5 ).sub( 0.5 ).mul( 80 );
	// Rising gas +60 to +240 K, lanes -260 K: about 15 % rms at 550 nm.
	const Tc = T0.add( h.z.mul( 0.6 ).add( 0.4 ).mul( breath.mul( 0.5 ).add( 0.5 ) ).mul( 240 ) ).add( meso );
	const Tl = T0.sub( 260 ).add( meso.mul( 0.5 ) );
	// A narrow dark lane at the border, then a dome: the gas is hottest
	// where it rises, near the seed, and cools as it spreads out. Small
	// eddies inside the cell (0.3 granule) shift it by about 40 K.
	const lane = smoothstep( 0.015, 0.11, V.edge );
	const dome = smoothstep( 0.0, 0.75, V.toSeed.length() ).oneMinus().mul( 0.45 ).add( 0.55 );
	const eddy = fbm( q, S.mul( 0.3 ), fp, 2, 7 ).sub( 0.5 ).mul( 0.25 );
	const bright = lane.mul( dome.add( eddy ) ).clamp( 0, 1 );
	const Rloc = mix( R( Tl ), R( Tc ), bright );
	// Under a few pixels, the mean of the cells. Granulation contrast also
	// drops toward the limb (we look along the cells, not down on them).
	const Rmean = mix( R( Tl ), R( T0.add( 100 ) ), 0.78 );
	const wG = fadeIn( S, fp, 2.0, 5.0 ).mul( smoothstep( 0.05, 0.35, mu ) );
	let L = mix( Rmean, Rloc, wG );

	// L2 spots.
	const P = sunspots( q, fp, S, u.cover, t, u.seed );

	// L1 faculae on the supergranule network, near the limb only.
	const Gn = S.mul( 25 );
	const N = voronoi( wrapCoord( q.div( Gn ) ).add( u.seed.mul( 1.9 ) ), 0.9 );
	// The walls are broken into clumps a few granules wide, not lines.
	const clump = smoothstep( 0.45, 0.7, fbm( q, S.mul( 3 ), fp, 2, 43 ) );
	const wall = smoothstep( 0, 0.12, N.edge ).oneMinus().mul( clump );
	const net = mix( float( 0.08 ), wall, fadeIn( Gn.mul( 0.12 ), fp, 1.0, 3.0 ) );
	const active = smoothstep( 0.5, 0.72, fbm( q, Gn.mul( 3 ), fp, 2, 41 ).add( u.cover.mul( 0.2 ) ) ).max( P.halo );
	const edgeOn = smoothstep( 0.2, 0.7, mu ).oneMinus().mul( smoothstep( 0.02, 0.12, mu ) );
	L = L.mul( net.mul( active ).mul( edgeOn ).mul( 0.6 ).add( 1 ) );

	// Penumbra: dark and bright filaments (4900 to 5500 K for 5800 K).
	const Tpd = T0.sub( 900 ), Tpb = T0.sub( 300 );
	const Rpen = mix( mix( R( Tpd ), R( Tpb ), 0.5 ), mix( R( Tpd ), R( Tpb ), smoothstep( 0.3, 0.7, P.fil ) ), P.wF );
	// Umbra: crust_k, a little warmer toward its border.
	const Rum = R( u.crustK.add( P.ru.mul( P.ru ).mul( 350 ) ) );
	L = mix( L, Rpen, P.pen );
	L = mix( L, Rum, P.um );

	// L0 limb darkening, u per channel (red 0.5, green 0.6, blue 0.72).
	L = L.mul( vec3( 1 ).sub( vec3( 0.5, 0.6, 0.72 ).mul( float( 1 ).sub( mu ) ) ) );
	// Haze: Rayleigh optical depth at 550 nm, scaled by (550 / lambda)^4
	// at 610, 550, 465 nm (0.66, 1, 1.96), divided by red.
	const trans = exp( vec3( 0, 0.34, 1.3 ).mul( u.haze ).negate() );
	const emissive = L.mul( trans ).mul( SUN_GAIN );

	return {
		color: vec3( 0 ), slope: vec2( 0 ), emissive, porosity: 0,
		rough: float( 1 ), s2: float( 0 ), cavity: float( 0 ),
	};

}
