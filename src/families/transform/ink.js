// Ink drops spreading in wet paper. Each drop (size_mm apart, dropped at
// its own time) wicks outward through the fibre network; capillary flow
// slows as it spreads, so the radius grows like the square root of time.
//   front    ragged at every scale (fractal), and at the fibre scale it
//            runs ahead along the fibres: fingers 1 to 3 mm long
//   halo     water runs ahead of the pigment: a band of darker, wetter
//            paper without colour (chromatography)
//   rim      pigment is carried to the edge and piles up there, so the
//            edge is darker than the inside (coffee ring), about front_mm
//            wide; faint tide lines where the edge paused
//   inside   paler, mottled; pigment grains (20 to 40 um) caught in the
//            pores, fibres soaked darker than the gaps between them
// Colour by Beer-Lambert: the paper seen through c layers of ink,
// paper * ink^c, so thin ink is a tint and thick ink near the ink colour.
// Paper levels from paper.js.

import { vec2, vec3, float, mix, smoothstep, mod, pow, sqrt, fract, abs } from 'three/tsl';
import { ixTime } from '../../core/clock.js';
import { fadeIn } from '../../core/lod.js';
import { valueNoise } from '../../core/hash.js';
import { arrival, heroSeed, rough, ageMeters } from '../../core/front.js';
import { fbm } from '../stone/common.js';
import { grains, line } from '../ground/grains.js';
import { paper } from './paper.js';

const vn = valueNoise;

export function buildInk( p, fp, u, prog ) {

	const g = u.sizeM, s = u.seed;
	const t = ixTime.mul( u.speed );
	const P = paper( p, fp, u );
	const q = p.div( g );
	const wq = vec2( vn( q.mul( 2.3 ).add( s ) ), vn( q.mul( 2.3 ).add( s.add( 5.7 ) ) ) ).sub( 0.5 ).mul( 0.3 );
	const A = arrival( q.add( wq ).add( s.mul( 0.91 ) ), { jitter: 0.8, delay: 0.6, salt: 12 } );
	// The ink reaches a fibre a little before the paper around it.
	const T = A.t1.add( 0.1 ).min( heroSeed( q.add( wq ), g, [ 0.28, 0.22 ] ) )
		.add( rough( p, g, fp, { top: 0.15, amp: 0.45, oct: 11, minM: 2e-5, salt: 3 } ) )
		.sub( P.fib.mul( u.fiberM.mul( 60 ).div( g ) ) ).toVar();
	const F = ageMeters( T, sqrt( prog ).mul( 0.95 ).sub( 0.05 ), g, p, fp );
	const age = F.age, W = u.frontM;

	const inked = F.aa( float( 0 ) ).toVar();
	const halo = smoothstep( W.mul( - 1.2 ), float( 0 ), age ).mul( inked.oneMinus() );
	// Rim: the pigment piled at the edge, a soft fall inward.
	const rim = smoothstep( W.mul( 1.4 ), W.mul( 0.15 ), age ).mul( inked );
	// Tide lines: the edge paused here (at fixed arrival times).
	const tq = T.mul( 9 ).add( vn( q.mul( 8 ) ).mul( 0.3 ) );
	const tide = line( abs( fract( tq.add( 0.5 ) ).sub( 0.5 ) ).mul( g.div( 9 ) ), float( 1.5e-4 ), F.fpA )
		.mul( smoothstep( W, W.mul( 3 ), age ) ).mul( vn( q.mul( 20 ).add( 4.4 ) ) );
	// Inside: paler and mottled, flowing slowly while wet.
	const fq = mod( p.div( 8e-3 ), 4096 ).add( vec2( t.mul( 0.05 ), t.mul( - 0.03 ) ) );
	const mott = fbm( p.add( 2.7 ), float( 0.02 ), fp, 3, 5 ).mul( 0.5 ).add( vn( fq ).mul( 0.2 ) ).add( 0.6 );
	// Pigment grains in the pores and along the fibres.
	const Gr = grains( p, float( 3e-5 ), fp, 8.3, { gap: 0.3, radius: 0.35, round: 0.4, crown: 0.4 } );
	const wG = fadeIn( 3e-5, fp, 1.5, 4.0 );
	const fine = Gr.body.mul( Gr.id.x ).mul( wG ).mul( 0.5 ).add( P.fib.mul( 0.45 ) ).add( 0.85 );
	const c = mix( float( 0.75 ), float( 1.5 ), rim ).mul( mott ).add( tide.mul( 0.25 ) ).mul( fine ).mul( inked ).mul( u.density.add( 0.4 ) ).toVar();

	// Colour: wet paper, darker in the halo, then through c layers of ink.
	const wetPaper = mix( u.color, u.color3, smoothstep( 0.0, 0.6, halo ).mul( 0.7 ).add( inked.mul( 0.3 ) ).add( 0.3 ).min( 1 ) ).mul( P.tone );
	const col = wetPaper.mul( pow( u.color2.max( 0.004 ), vec3( c, c, c ) ) );
	const wetness = halo.max( inked );
	const slope = P.slope.mul( float( 1 ).sub( wetness.mul( 0.4 ) ) ).add( Gr.grad.mul( 0.05 ).mul( wG ).mul( inked ) );
	const rgh = mix( u.roughness, float( 0.45 ), wetness.mul( 0.7 ) );
	return { color: col, slope, cavity: P.pore.mul( 0.5 ), rough: rgh, s2: P.s2 };

}
