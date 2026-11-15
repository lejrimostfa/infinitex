// Caustic nets: sunlight focused by a rippled surface onto what lies under
// it (sand, stone, a diver). Each patch of the surface is a weak lens. A
// ray crossing it at x reaches depth D at x + c grad h, with
// c = D (1 - 1/n) for a sun overhead. A small area dA there becomes
// |det J| dA, with J = I + c Hess(h). The light is the inverse ratio:
//   I = 1 / |det J|,  det J = (1 + c hxx)(1 + c hyy) - (c hxy)^2
// Where det J reaches zero the rays cross: the bright lines of the net.
// Their sharpness grows with depth until the focus, then they smear out,
// as at a real pool floor. With the mean curvature alone (the old lap
// formula) only soft blobs appear: the lines need both directions.
// The light is evaluated with the curvature right above the point, not at
// the point each ray comes from: the net is drawn a little off its true
// place, the look stays. Waves under a pixel have faded out of the
// Hessian already (waveField), so the net turns into an even light far
// away and never shimmers.
//   hess   vec3 (hxx, hxy, hyy) of the surface, 1/m
//   depth  m below the surface; n: refractive index of the liquid
//   blur   floor of |det J|: the sun disc (0.53 degrees) and turbidity.
//          0.04 gives fine bright lines, 0.15 soft ones.
// Returns about 1 on average, up to `peak` on the lines.

import { float, clamp } from 'three/tsl';

export function causticLight( hess, depth, { n = 1.33, blur = 0.05, peak = 6 } = {} ) {

	const c = float( depth ).mul( 1 - 1 / n );
	const a = hess.x.mul( c ).add( 1 ), b = hess.z.mul( c ).add( 1 ), x = hess.y.mul( c );
	const det = a.mul( b ).sub( x.mul( x ) ).abs();
	return clamp( float( 1 ).div( det.max( blur ) ), 0, peak );

}
