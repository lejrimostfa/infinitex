// Light from hot matter. Rock, char and metal glow like a blackbody:
// colour and brightness both follow the temperature T in kelvin.
//   colour   chroma of a blackbody in linear sRGB, red = 1. Fitted on the
//            CIE table (1000 K deep red, 1400 K orange, 1800 K orange
//            yellow, 3000 K pale): green/red = 1.55 exp(-3680 / T).
//   bright   Wien's law at 620 nm: exp(-c2 / (lambda T)), c2 / lambda =
//            23200 K, relative to 1400 K. Between a 750 K crust and a
//            1400 K crack this spans 6 decades; a camera (or the eye at
//            night) compresses it: contrast is that exponent (1 = physical,
//            0.3 keeps the dull red of the crust visible next to the cracks).
// Thin bright features fade by the footprint before they reach here, so
// callers mix radiances (never temperatures): the mean glow stays right.

import { vec3, float, exp } from 'three/tsl';

const T_REF = 1400;

export function blackbody( T ) {

	const t = float( T ).max( 300 );
	return vec3( 1, exp( float( - 3680 ).div( t ) ).mul( 1.55 ).min( 1 ), exp( float( - 12000 ).div( t ) ).mul( 8 ).min( 1 ) );

}

// Emitted light at T, 1 for the red channel of a 1400 K body.
export function radiance( T, u ) {

	const t = float( T ).max( 300 );
	const x = float( 23200 ).mul( float( 1 / T_REF ).sub( t.reciprocal() ) );
	return blackbody( t ).mul( exp( x.mul( u.contrast ) ) );

}
