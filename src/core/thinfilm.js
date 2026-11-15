// Thin film interference as a reflectance colour: soap films, oil on
// water, the cap of a bubble. Light reflected at the top and at the bottom
// of a film d nm thick interferes; the path difference is 2 n d cos(t).
// With one phase flip (air|soap|air, air|oil|water) a film thinner than
// about 30 nm reflects nothing (black film), 100 to 1000 nm gives the
// orders of colour, and beyond 1.5 um the orders overlap into white.
//   filmReflectance  RGB reflectance at normal-ish incidence: nine
//                    wavelengths weighted by the spectral colour of each
//                    (core/optics.js) and summed, so high orders wash out
//                    the way they do in a real film. Each wavelength also
//                    stands for a 15 nm band: its fringes fade with order.
//   opdBlur          the spread of the path difference inside one pixel:
//                    fringes closer than a pixel average to their mean
//                    instead of aliasing (a Gaussian box, no ringing).
// Two-beam formula, enough for films of index 1.3 to 1.5:
//   R = r12^2 + r23^2 + 2 r12 r23 cos( 2 pi opd / lambda )

import { vec3, float, cos, exp, dFdx, dFdy } from 'three/tsl';
import { spectral } from './optics.js';

const LAMBDAS = [ 410, 445, 480, 515, 550, 585, 620, 655, 690 ];
const BAND = 15; // nm, half width of the band each sample stands for

// dNm: film thickness (nm). nFilm: film index. nBelow: what lies under
// it (1 for a free film, 1.33 for oil on water). cosI: cos of the view
// angle. blurNm: from opdBlur, 0 for a sharp film.
export function filmReflectance( dNm, nFilm, nBelow, cosI, blurNm = 0 ) {

	const n = float( nFilm ), nb = float( nBelow );
	const sin2 = float( 1 ).sub( cosI.mul( cosI ) );
	const cosT = float( 1 ).sub( sin2.div( n.mul( n ) ) ).max( 0.05 ).sqrt();
	const opd = float( dNm ).max( 0 ).mul( n ).mul( cosT ).mul( 2 );
	const r12 = float( 1 ).sub( n ).div( n.add( 1 ) );
	const r23 = n.sub( nb ).div( n.add( nb ) );
	const base = r12.mul( r12 ).add( r23.mul( r23 ) );
	const amp = r12.mul( r23 ).mul( 2 );
	const b2 = float( blurNm ).mul( blurNm );
	let sum = vec3( 0 ), wsum = vec3( 0 );
	for ( const nm of LAMBDAS ) {

		const w = spectral( float( nm ) );
		const spread = opd.mul( BAND / nm ); // path spread across the band
		const s2 = b2.add( spread.mul( spread ) );
		const fade = exp( s2.mul( - 2 * Math.PI * Math.PI / ( nm * nm ) ) );
		const R = base.add( amp.mul( cos( opd.mul( 2 * Math.PI / nm ) ) ).mul( fade ) );
		sum = sum.add( w.mul( R ) );
		wsum = wsum.add( w );

	}

	return sum.div( wsum );

}

// Spread (one sigma, nm) of the path difference over a pixel, for a film
// of index n seen face on. Derivatives: call it where the flow is uniform.
export function opdBlur( dNm, n = 1.4 ) {

	const g = dFdx( dNm ).abs().add( dFdy( dNm ).abs() );
	return g.mul( n ).mul( 0.9 );

}
