// A sheet of paper, shared by burn and ink.
//   L0 formation  fibres settle in flocs of 3 to 8 mm, so the sheet is
//                 cloudy: denser flocs a little darker, thin spots lighter
//   L1 fibres     cellulose fibres 1 to 3 mm long and fiber_um wide (20 to
//                 40 um), lying flat in every direction, two layers; each
//                 is a flattened tube, so it shows as a soft ridge
//   L2 fibrils    the fibre walls are bundles of fibrils: a fine grain of
//                 4 to 8 um, and pores between the fibres
// Returns tone (multiplies the paper colour, mean 1), slope, fib (fibre
// cover, the ink runs along it), floc and s2 (variance of faded fibres).

import { float, mod, smoothstep } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { valueNoise } from '../../core/hash.js';
import { fibres } from '../ground/grains.js';
import { fbm } from '../stone/common.js';

export function paper( p, fp, u ) {

	const fM = u.fiberM;
	const floc = fbm( p, float( 6e-3 ), fp, 4, 3 ).toVar();
	// The fibres fade out under a pixel (fibres(): 2 widths over 0.7 px).
	// Past the wider one's fade the gate skips both layers.
	const Fb = gate( fadeOn( fM, fp, 0.7 ), { fib: 0, slope: [ 0, 0 ] }, () => {

		const F1 = fibres( p, fM.mul( 50 ), fM.mul( 0.5 ), float( 0.9 ), fp, 3.1, 0.25 );
		const F2 = fibres( p.add( 1.3e-3 ), fM.mul( 28 ), fM.mul( 0.4 ), float( 0.85 ), fp, 7.7, 0.3 );
		return { fib: F1.fiber.max( F2.fiber.mul( 0.8 ) ), slope: F1.slope.add( F2.slope.mul( 0.7 ) ) };

	}, [ p, fp ] );
	const fib = Fb.fib.toVar();
	// Pores: the gaps between fibres, a little darker and lower.
	const wF = fadeIn( fM.mul( 28 ), fp, 2.0, 6.0 );
	const pore = smoothstep( 0.5, 0.9, valueNoise( mod( p.div( fM.mul( 3 ) ), 4096 ).add( 2.3 ) ) ).mul( fib.oneMinus() ).mul( fadeIn( fM.mul( 3 ), fp, 2.0, 6.0 ) );
	const fibril = valueNoise( mod( p.div( 6e-6 ), 4096 ).add( 5.5 ) ).sub( 0.5 ).mul( fadeIn( 6e-6, fp, 2.0, 6.0 ) );
	const tone = floc.sub( 0.5 ).mul( - 0.16 ).add( 1 ).mul( fib.mul( 0.05 ).add( 0.98 ) ).mul( float( 1 ).sub( pore.mul( 0.1 ) ) ).add( fibril.mul( 0.05 ) );
	const slope = Fb.slope.mul( 0.18 ).mul( u.relief );
	const s2 = wF.oneMinus().mul( 0.01 );
	return { tone, slope, fib, floc, pore, s2 };

}
