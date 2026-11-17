// Metal mode `brushed`: stainless steel sheet run under an abrasive belt.
//   L0 belt passes: bands a few mm wide and tens of cm long, a little
//                   brighter or duller, all along the brush direction
//   L1 grooves:     long parallel grooves cut by the grit, on four scales:
//                   rows 400, 120, 35 and 10 um apart, 2 to 50 um wide,
//                   each a segment 40 to 200 rows long that fades at both
//                   ends. Grooves smaller than a few pixels fade out and
//                   leave their slope variance to the roughness.
//   L2 highlight:   the grooves tilt the normal across them only, so the
//                   highlight is stretched across the brush direction
//                   (anisotropy). The finest scratches (under 1 um) are
//                   never drawn: anisotropy stands for them at every zoom.
//   L3 grains:      austenite grains of about grain_um, stretched by the
//                   rolling, each with its own faint sheen, and manganese
//                   sulfide stringers: dark specks 3 um wide, 20 to 40 um long
// The brush direction is brush_deg on the surface (0: along u).

import { vec2, vec3, float, floor, clamp, smoothstep, step, mix, mod, sin, cos } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { grooves } from './scratch.js';

const vn = valueNoise;

export function buildBrushed( p, fp, u ) {

	const dir = vec2( cos( u.brush ), sin( u.brush ) );
	const perp = vec2( sin( u.brush ).negate(), cos( u.brush ) );
	const a = p.dot( dir ).toVar(), c = p.dot( perp ).toVar();

	// L0 belt passes: long streaks, three octaves, each faded by its width.
	const band = ( lenM, widM, off ) => vn( vec2( a.div( lenM ), c.div( widM ) ).add( off ) ).sub( 0.5 ).mul( fadeIn( widM, fp, 2.0, 6.0 ) );
	const st = band( 0.25, 4e-3, u.seed.mul( 1.9 ) ).mul( 0.5 ).add( band( 0.08, 1.2e-3, 3.3 ).mul( 0.32 ) ).add( band( 0.03, 4e-4, 7.7 ).mul( 0.2 ) ).toVar();

	// L1 grooves on four scales.
	const S = [
		[ 400e-6, 1.3, 0.35, 0.1, 0.22 ],
		[ 120e-6, 2.9, 0.5, 0.12, 0.25 ],
		[ 35e-6, 5.1, 0.75, 0.12, 0.25 ],
		[ 10e-6, 7.3, 0.85, 0.14, 0.25 ],
	];
	let sAcross = float( 0 ), cov = float( 0 ), s2 = float( 0 );
	for ( const [ P, seed, density, half, k ] of S ) {

		const w = fadeIn( P, fp, 3.0, 10.0 );
		const g = grooves( a, c, fp, float( P ), seed, density, half, k );
		sAcross = sAcross.add( g.s.mul( w ) );
		cov = cov.max( g.cov.mul( w ) );
		// Faded share of the slope variance (rounded groove: k^2 / 3 over
		// its coverage), a third of it: the anisotropy carries the rest.
		s2 = s2.add( float( 1 ).sub( w ).mul( k * k / 3 * 2 * half * 0.65 * density / 3 ) );

	}

	// L3 grains stretched along the rolling direction, and stringers.
	const gq = vec2( a.div( u.grainM.mul( 2.2 ) ), c.div( u.grainM ) );
	const gv = voronoi( wrapCoord( gq ).add( 4.4 ), 0.9 );
	const wG = fadeIn( u.grainM, fp, 2.0, 6.0 );
	const gh = hash3( gv.id1 );
	const grainTone = gh.z.sub( 0.5 ).mul( 0.05 ).mul( wG ).add( 1 )
		.mul( float( 1 ).sub( float( 1 ).sub( smoothstep( 0.0, 0.06, gv.edge ) ).mul( 0.08 ).mul( wG ) ) );
	const mq = vec2( a.div( 2e-4 ), c.div( 6e-5 ) ).add( 11.1 );
	const mc = wrapCoord( floor( mq ) );
	const mh = hash3( mc );
	const mv = mq.sub( floor( mq ) ).sub( mh.xy.mul( 0.5 ).add( 0.25 ) ).mul( vec2( 2e-4, 6e-5 ) );
	const mL = mh.z.mul( 1e-5 ).add( 1e-5 ), mW = float( 1.5e-6 );
	const md = vec2( mv.x.abs().sub( mL ).max( 0 ), mv.y ).length();
	const mWE = mW.max( fp );
	const stringer = clamp( mWE.sub( md ).div( fp ).add( 0.5 ), 0, 1 ).mul( mW.div( mWE ) ).mul( step( mh.z, 0.25 ) ).mul( fadeIn( 2e-5, fp, 2.0, 6.0 ) );

	// Colour: the steel reflectance; grooves trap a little light.
	const color = u.f0.mul( st.mul( 0.3 ).mul( u.streaks ).add( 1 ) ).mul( grainTone )
		.mul( float( 1 ).sub( cov.mul( 0.12 ) ) ).mul( mix( vec3( 1 ), vec3( 0.25 ), stringer ) );
	const rough = u.roughness.add( st.mul( 0.25 ).mul( u.streaks ) ).add( cov.mul( 0.05 ) ).clamp( 0.05, 1 );

	return {
		color, rough, s2,
		slope: perp.mul( sAcross ).add( gh.xy.sub( 0.5 ).mul( 0.01 ).mul( wG ) ),
		metalness: float( 1 ),
		cavity: cov.mul( 0.5 ).max( stringer ),
		porosity: float( 0.05 ),
		// Stretched highlight: across the grooves, in tangent space.
		aniso: perp.mul( u.aniso ),
		debug: { w1: fadeIn( 400e-6, fp, 3.0, 10.0 ), w2: fadeIn( 35e-6, fp, 3.0, 10.0 ), w3: wG },
	};

}
