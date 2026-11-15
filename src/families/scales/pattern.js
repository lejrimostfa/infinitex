// Colour patterns of living snakes, read per scale (pos is the scale's
// position in meters, so every scale takes one colour, as in life). Each
// returns the same signal as the default blotches of shader.js:
//   0.53 to 0.62  dark (pattern colour), above 0.65 a lighter heart,
//   below 0.5 the ground colour.
//   ocelli  rainbow boa: rows of large dark rings around a heart of the
//           ground colour, about pattern_mm apart, and smaller solid
//           dark spots between the rows

import { vec2 } from 'three/tsl';
import { valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

function ocelli( pos, u ) {

	const P = u.patternM;
	const wob = valueNoise( pos.div( P.mul( 0.3 ) ).add( u.seed ) ).sub( 0.5 ).mul( 0.12 );
	const big = voronoi( pos.div( P.mul( vec2( 1.4, 1.0 ) ) ).add( u.seed.mul( 0.7 ) ), 0.3 );
	const dBig = big.toSeed.mul( vec2( 1.4, 1.0 ) ).length().add( wob );
	const small = voronoi( pos.div( P.mul( vec2( 1.4, 0.8 ) ) ).add( vec2( 0.5, 0.25 ) ).add( u.seed.mul( 1.3 ) ), 0.4 );
	const dSmall = small.toSeed.mul( vec2( 1.4, 0.8 ) ).length().add( wob );
	// A dark ring (about 0.12 wide at 0.25 from the centre) around a heart
	// of ground colour; small solid spots between.
	return dBig.sub( 0.25 ).abs().mul( - 1.2 ).add( 0.6 ).max( dSmall.mul( - 0.5 ).add( 0.6 ) );

}

export const PATTERNS = { ocelli };
