// A soap film standing in a frame (a giant bubble wall), seen through.
// Water with soap, index 1.33, between air on both sides: one of the two
// reflections flips phase, so a film thinner than 30 nm reflects nothing.
//   L0 drainage  gravity pulls the water down: the film is 1 to 2 um
//                thick at the bottom (pale, washed out colours), thins
//                upward through the orders of colour (green, magenta,
//                gold), and at the top turns into black film: 5 to 30 nm,
//                fully clear, its edge a sharp step. size_mm = height of
//                the film (on the cube: the face)
//   L1 marbling  the film is never still: eddies of 2 to 3 cm (four
//                times feature_mm) swirl the bands at about 1 cm/s; thin
//                (light) film rises, thick film sinks (flow.js)
//   L2 eddies    finer whorls from feature_mm (8 mm) down to 0.1 mm, and
//                spots of thin film of 0.3 to 1.5 mm that rise from the
//                bottom border at 1 to 4 cm/s (marginal regeneration)
// The film is all reflection (core/thinfilm.js); what it does not
// reflect goes through (transmission 1, no refraction: it is thin).

import { vec2, vec3, float, floor, fract, mix, exp, log, clamp, smoothstep, step, mod, pow } from 'three/tsl';
import { ixTime } from '../../core/clock.js';
import { fadeIn } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';
import { viewTangent } from '../../core/optics.js';
import { filmReflectance, opdBlur } from '../../core/thinfilm.js';
import { fbm } from '../stone/common.js';
import { curlFlow, advect } from './flow.js';

function swirl( q, fp, E, salt ) {

	const x = q.add( salt.mul( E ) );
	const w = vec2( fbm( x, E.mul( 3 ), fp, 3, 1 ), fbm( x, E.mul( 3 ), fp, 3, 2 ) ).sub( 0.5 );
	const y = x.add( w.mul( E ).mul( 4 ) );
	return fbm( y, E.mul( 2.2 ), fp, 5, 3 );

}

// Thin spots rising: one candidate per 4 mm cell of a lane moving up.
function spots( p, fp, t, seed ) {

	const C = 0.004;
	const lane = floor( p.x.div( C ) );
	const hl = hash3( vec2( mod( lane, 4096 ), seed.add( 2.2 ) ) );
	const v = hl.x.mul( 0.03 ).add( 0.01 );
	const qy = p.y.sub( v.mul( t ) ).div( C );
	const h = hash3( vec2( mod( lane, 4096 ), mod( floor( qy ), 4096 ) ).add( 0.71 ) );
	const r = h.x.mul( 0.25 ).add( 0.08 );
	const f = vec2( fract( p.x.div( C ) ), fract( qy ) ).sub( vec2( hl.y.mul( 0.4 ).add( 0.3 ), h.y.mul( 0.4 ).add( 0.3 ) ) );
	const d = f.mul( vec2( 1, 0.8 ) ).length();
	const rm = r.mul( C );
	return clamp( r.sub( d ).mul( C ).div( fp.max( rm.mul( 0.25 ) ) ).add( 0.5 ), 0, 1 ).mul( step( h.z, 0.12 ) ).mul( fadeIn( rm.mul( 2 ), fp, 1, 3 ) );

}

export function buildSoap( p, fp, u ) {

	const t = ixTime.mul( u.speed );
	const E = u.featureM;
	const y = clamp( p.y.div( u.sizeM ), 0, 1 );
	// Eddies turn at about 1 cm/s; thin film rises a little faster.
	const vel = curlFlow( p, E.mul( 4 ), float( 0.004 ), u.seed ).add( vec2( 0, 0.002 ) );
	const m = advect( p, vel, t, 4, ( q, salt ) => swirl( q, fp, E, salt ) );
	// Log thickness: thick bottom, thin top, the marbling on top of it.
	const top = log( float( 22 ) ), bottom = log( u.film.y.max( 30 ) );
	let ld = mix( bottom, top, pow( y, 1.4 ) ).add( m.sub( 0.5 ).mul( u.amount ).mul( 3.0 ) );
	// Fine whorls (feature_mm / 4 and below) carried by the same eddies.
	const fq = p.sub( vel.mul( fract( t.div( 8 ) ).mul( 8 ) ) );
	ld = ld.add( fbm( fq, E.mul( 0.3 ), fp, 4, 7 ).sub( 0.5 ).mul( 0.9 ) );
	// Whorls down to 0.1 mm: a warped noise, so at 3 mm the film still
	// swirls in bands of colour.
	const wq = fq.add( vec2( fbm( fq, E.mul( 0.08 ), fp, 2, 12 ), fbm( fq, E.mul( 0.08 ), fp, 2, 13 ) ).sub( 0.5 ).mul( E.mul( 0.15 ) ) );
	ld = ld.add( fbm( wq, E.mul( 0.05 ), fp, 4, 14 ).sub( 0.5 ).mul( 0.6 ) );
	// Thin spots rise from the bottom half: thinner, not black.
	ld = ld.add( spots( p, fp, t, u.seed ).mul( - 0.9 ).mul( smoothstep( 0.75, 0.35, y ) ) );
	let d = exp( ld ).toVar();
	// Black film: below about 30 nm the film snaps to 8 nm, a sharp step.
	const step30 = clamp( d.sub( 30 ).div( opdBlur( d, 1 ).max( 0.5 ) ).add( 0.5 ), 0, 1 );
	d = mix( float( 8 ), d, step30 ).max( u.film.x );
	const cosI = viewTangent().z.abs();
	const R = filmReflectance( d, 1.33, 1.0, cosI, opdBlur( d, 1.33 ) );
	return {
		color: vec3( 0.97 ), slope: vec2( 0 ), cavity: float( 0 ), rough: u.roughness, s2: float( 0 ),
		spec: R, transmission: float( 1 ),
	};

}
