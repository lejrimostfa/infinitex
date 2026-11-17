// Nematic liquid crystal in a thin glass cell, lit from behind between
// crossed polarisers (the schlieren texture of a polarising microscope).
// The rod-like molecules share a direction (the director, angle theta in
// the plane). Light passes with intensity sin^2 (2 theta) sin^2 (pi R /
// lambda): R = birefringence x thickness is the retardation, so the
// colours are the interference orders of the Michel-Levy chart, and the
// director turns the light off along dark brushes.
//   director  the angle of a smooth random vector field. Its zeros are the
//             defects: two dark brushes meet at a half integer defect,
//             four at an integer one (both kinds, by region)
//   octaves   the field sums octaves from size_mm down to 35 um, each faded
//             in by the pixel: zooming in finds new, smaller defects
//   colour    retardation from film_nm (cell thickness drifts), lower
//             near a defect core where the molecules stand up (grey core);
//             tilting the view lengthens the path: the colours shift
//   specks    dust and air bubbles of 10 to 40 um in the cell
// Light comes through the cell: the colour is emitted, the glass on top
// is a clear coat.

import { vec2, float, clamp, smoothstep, mod, mix, cos, sin, dFdx, dFdy } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { interference, viewTangent } from '../../core/optics.js';
import { fbm } from '../stone/common.js';

export function buildCrystal( p, fp, u ) {

	const s = u.seed;
	// Director field: octaves of a vector noise, fine ones faded in.
	let N = vec2( 0 ), per = u.sizeM, amp = 1;
	for ( let i = 0; i < 6; i ++ ) {

		const q = wrapCoord( p.div( per ) ).add( vec2( i * 5.3, i * 2.9 ) ).add( s );
		const n = vec2( valueNoise( q ), valueNoise( q.add( vec2( 31.7, 17.1 ) ) ) ).sub( 0.5 );
		N = N.add( n.mul( amp ).mul( fadeIn( per, fp, 2.0, 5.0 ) ) );
		per = per.div( 3 );
		amp *= 0.42;

	}

	// Polarisers at angle_deg: turn the field the other way.
	const ca = cos( u.angle.mul( 2 ) ), sa = sin( u.angle.mul( 2 ) );
	N = vec2( N.x.mul( ca ).add( N.y.mul( sa ) ), N.y.mul( ca ).sub( N.x.mul( sa ) ) );
	const len = N.length();
	const n = N.div( len.max( 1e-5 ) );
	// Half integer defects: theta = phi / 2, sin^2(2 theta) = n.y^2.
	// Integer defects: theta = phi, sin^2(2 theta) = (2 n.x n.y)^2.
	const four = smoothstep( 0.45, 0.6, valueNoise( p.div( u.sizeM.mul( 2.5 ) ).add( s.add( 8 ) ) ) );
	const s2p = n.x.mul( n.y ).mul( 2 );
	// Near a core the direction turns faster than a pixel: use the mean.
	const dN = dFdx( N ).length().add( dFdy( N ).length() );
	const sure = smoothstep( 0.7, 2.0, len.div( dN.max( 1e-7 ) ) );
	const bright = mix( float( 0.45 ), mix( n.y.mul( n.y ), s2p.mul( s2p ), four ), sure );

	// Retardation: thickness drift, low at the cores, longer path at a slant.
	const ndv = viewTangent().z.clamp( 0.2, 1 );
	const core = mix( float( 0.6 ), smoothstep( 0.0, 0.08, len ), sure );
	const R = mix( u.filmMin, u.filmMax, fbm( p, 0.08, fp, 7, 3 ) ).mul( core.mul( 0.8 ).add( 0.2 ) ).div( ndv.pow( 0.6 ) );
	let light = interference( R ).mul( bright );

	// Dust and bubbles: dark rims, a bright dot in a bubble.
	const B = voronoi( wrapCoord( p.div( 6e-4 ) ).add( 3.7 ), 0.8 );
	const bh = hash3( B.id1.add( 1.1 ) );
	const rad = bh.x.mul( 0.04 ).add( 0.015 ).mul( 6e-4 );
	const d = B.toSeed.length().mul( 6e-4 );
	const on = smoothstep( 0.75, 0.8, bh.y ).mul( fadeIn( rad.mul( 2 ), fp, 1.5, 4.0 ) );
	const rim = clamp( rad.mul( 0.3 ).sub( d.sub( rad ).abs() ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
	const dot = clamp( rad.mul( 0.25 ).sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
	light = light.mul( float( 1 ).sub( rim.mul( 0.85 ) ) ).add( dot.mul( 0.6 ) );

	const fine = fbm( p, 0.01, fp, 2, 6 ).sub( 0.5 );
	return {
		color: light.mul( 0.18 ).add( u.color3 ), emissive: light.mul( u.glow ),
		slope: vec2( fine, fine ).mul( 0.004 ), rough: u.roughness, s2: float( 0 ), cavity: rim,
		coat: u.coat, coatRough: float( 0.02 ),
	};

}
