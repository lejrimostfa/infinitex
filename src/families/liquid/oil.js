// An oil slick on wet asphalt: a puddle and the wet road around it, with
// a film of motor oil (index 1.47) 0 to 1 um thick floating on the
// water (1.33). Its colour is interference (core/thinfilm.js): grey
// where it is thinner than 100 nm, then gold, magenta, blue, green as it
// thickens, pastel beyond 1 um. The colour is in the reflection only:
// over the dark road it reads strongly, and it shifts with the view.
//   L0 slick     the film covers patches (amount); the thickness is a
//                marbled field carried by slow eddies of size_mm (4 cm)
//                turning at 2 to 3 mm/s (flow.js), so the bands swirl
//   L1 bands     finer marbling of feature_mm (2 mm): thin bands curl
//                around each other
//   L1 ground    the asphalt (asphalt.js); a stone breaking the water
//                parts the film, which climbs it as a ring of colour
//   L2 whorls    marbling down to 0.2 mm, so the bands curl at 3 mm
//   L2 fringes   on the wet road the film thins over every grain top:
//                fringes ring the sand grains (0.5 to 2 mm). Fringes
//                closer than a pixel average out (opdBlur)
// Oil damps the capillary waves: the slick is flatter than the water.

import { vec2, float, mix, exp, smoothstep, abs } from 'three/tsl';
import { ixTime } from '../../core/clock.js';
import { viewTangent } from '../../core/optics.js';
import { filmReflectance, opdBlur } from '../../core/thinfilm.js';
import { fbm } from '../stone/common.js';
import { curlFlow, advect } from './flow.js';
import { buildAsphalt } from './asphalt.js';

// Marbled thickness pattern in [0, 1]: fbm, warped by fbm.
function marble( q, fp, S, F, salt ) {

	const x = q.add( salt.mul( S ) );
	const w = vec2( fbm( x, S.mul( 0.9 ), fp, 3, 1 ), fbm( x, S.mul( 0.9 ), fp, 3, 2 ) ).sub( 0.5 );
	const y = x.add( w.mul( S ).mul( 1.6 ) );
	const v = fbm( y, S.mul( 0.6 ), fp, 4, 3 ).mul( 0.93 ).add( fbm( y.add( w.mul( F ).mul( 4 ) ), F, fp, 3, 4 ).mul( 0.07 ) );
	return v;

}

export function buildOil( p, fp, u ) {

	const t = ixTime.mul( u.speed );
	const A = buildAsphalt( p, fp, u );
	const level = fbm( p, 0.14, fp, 3, 5 ).sub( 0.5 ).mul( 2.4 ).add( u.density.mul( 2 ).sub( 1 ) ).mul( u.depthM );
	const Dw = level.sub( A.h ).toVar();
	const water = smoothstep( 0.0, 2.5e-4, Dw ).toVar();

	// The film: eddies carry the marbling; the slick drifts as a whole.
	const S = u.sizeM, F = u.featureM;
	const vel = curlFlow( p, S.mul( 1.5 ), float( 0.0012 ), u.seed ).add( vec2( 0.0008, 0.0003 ) );
	const m = advect( p, vel, t, 7, ( q, salt ) => marble( q, fp, S, F, salt ) );
	const cover = smoothstep( 0.35, 0.55, fbm( p, S.mul( 2.5 ), fp, 3, 8 ).add( u.amount.sub( 0.5 ).mul( 0.6 ) ) );
	// Most of the slick sits in 200 to 600 nm, the first and second orders:
	// the most saturated colours (magenta, blue, green, gold).
	let d = mix( u.film.x, u.film.y, smoothstep( 0.3, 0.7, m ) ).mul( cover.mul( 0.85 ).add( 0.15 ) );
	// Fine marbling down to 0.2 mm: at 3 mm the bands still curl.
	const fq = p.sub( vec2( 0.0008, 0.0003 ).mul( t ) ); // the drift only: a field would shear without end
	const fw = fq.add( vec2( fbm( fq, F.mul( 0.5 ), fp, 2, 12 ), fbm( fq, F.mul( 0.5 ), fp, 2, 13 ) ).sub( 0.5 ).mul( F ) );
	d = d.add( fbm( fw, F.mul( 0.3 ), fp, 4, 14 ).sub( 0.5 ).mul( 220 ).mul( cover ) );
	// Where a stone breaks the water the film climbs it; on the wet road
	// it thins over each grain top, thickens in the hollows.
	const shore = exp( abs( Dw ).div( 3e-4 ).negate() );
	d = d.add( shore.mul( 250 ).mul( cover.mul( 0.7 ).add( 0.3 ) ) );
	d = mix( d.mul( float( 0.75 ).add( A.cavity.mul( 0.4 ) ) ), d, water ).toVar();
	const blur = opdBlur( d, 1.47 );
	const cosI = viewTangent().z.abs();
	const R = filmReflectance( d, 1.47, 1.33, cosI, blur );

	// Very dark below: wet bitumen, and the puddle darker still, so the
	// reflected film colours carry the image.
	const wet = A.color.mul( 0.35 );
	const tint = float( 1 ).sub( exp( Dw.max( 0 ).div( 0.006 ).negate() ) );
	const color = mix( wet, mix( wet.mul( 0.5 ), u.color, tint.mul( 0.7 ) ), water );
	const slope = A.slope.mul( water.oneMinus().mul( 0.8 ) );
	const rough = mix( float( 0.22 ), u.roughness, water );
	return { color, slope, cavity: A.cavity.mul( water.oneMinus() ), rough, s2: A.s2.mul( water.oneMinus() ), spec: R, wet: float( 1 ) };

}
