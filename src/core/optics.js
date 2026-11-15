// Optics helpers for view-dependent colour (diffraction, thin films,
// birefringence, play of colour). The colour of these matters comes from
// interference, so it changes with the view direction:
//   spectral     wavelength in nm -> linear RGB of that pure colour
//                (Zucconi 6 bump fit of the CIE matching functions)
//   viewTangent  view direction in the surface frame: xy along the
//                surface coordinates (u, v), z along the normal
//   viewInCoords the same, built from the coordinates (seam free)
//   upTangent    world up (where room light comes from) in the same frame
//   interference sin^2 (pi * retardation / lambda) for R, G and B: the
//                colour between crossed polarisers (Michel-Levy chart)
// All of them are cheap ALU only; no texture, no loop.

import { vec2, vec3, vec4, float, clamp, sin, step, dFdx, dFdy, normalView, normalViewGeometry, tangentView, bitangentView, positionView, positionViewDirection, cameraViewMatrix } from 'three/tsl';

const bump = ( x, c, x0, y0 ) => {

	const t = x.sub( x0 ).mul( c );
	return clamp( float( 1 ).sub( t.mul( t ) ).sub( y0 ), 0, 1 );

};

// Pure spectral colour, 0 outside 400 to 700 nm. Peak about 1.
export function spectral( nm ) {

	const x = clamp( float( nm ).sub( 400 ).div( 300 ), 0, 1 );
	const xv = vec3( x );
	return bump( xv, vec3( 3.54585104, 2.93225262, 2.41593945 ), vec3( 0.69549072, 0.49228336, 0.27699880 ), vec3( 0.02312639, 0.15225084, 0.52607955 ) )
		.add( bump( xv, vec3( 3.90307140, 3.21182957, 3.96587128 ), vec3( 0.11748627, 0.86755042, 0.66077860 ), vec3( 0.84897130, 0.88445281, 0.73949448 ) ) );

}

// View direction (surface to eye) in the tangent frame of the surface.
export function viewTangent( n = normalView ) {

	const V = positionViewDirection;
	return vec3( V.dot( tangentView ), V.dot( bitangentView ), V.dot( n ) );

}

// View direction in the frame of the surface coordinates p themselves,
// from screen derivatives: x along +p.x, y along +p.y, z along the normal.
// Also `scale`: units of p per metre along x and y. A mesh's UVs are
// rarely exactly uniform (the demo's rounded cube is off by a few percent
// from patch to patch): invisible in a texture, but a ray carried 40 cm
// under water lands centimetres off, a seam. Offsets in metres times
// `scale` land right.
export function viewInCoords( p ) {

	const P = positionView, V = positionViewDirection;
	const dPx = dFdx( P ), dPy = dFdy( P ), dpx = dFdx( p ), dpy = dFdy( p );
	const det = dpx.x.mul( dpy.y ).sub( dpy.x.mul( dpx.y ) );
	const sdet = det.abs().max( 1e-14 ).mul( step( 0, det ).mul( 2 ).sub( 1 ) );
	const eu = dPx.mul( dpy.y ).sub( dPy.mul( dpx.y ) ).div( sdet ); // metres per unit p.x
	const ev = dPy.mul( dpx.x ).sub( dPx.mul( dpy.x ) ).div( sdet );
	const nu = eu.normalize(), nv = ev.normalize();
	const n = nu.cross( nv ).normalize();
	const nf = n.mul( step( 0, n.dot( normalViewGeometry ) ).mul( 2 ).sub( 1 ) );
	// A view-space vector w along the surface -> its change of p, exact
	// even when the UVs are sheared: solve w = a eu + b ev.
	const uu = eu.dot( eu ), uv2 = eu.dot( ev ), vv = ev.dot( ev );
	const g = uu.mul( vv ).sub( uv2.mul( uv2 ) ).max( 1e-20 );
	const toP = ( w ) => {

		const a = w.dot( eu ), b = w.dot( ev );
		return vec2( a.mul( vv ).sub( b.mul( uv2 ) ), b.mul( uu ).sub( a.mul( uv2 ) ) ).div( g );

	};
	return { V: vec3( V.dot( nu ), V.dot( nv ), V.dot( nf ) ), Vview: V, n: nf, toP };

}

// World up in the tangent frame: room light mostly comes from above.
export function upTangent( n = normalView ) {

	const U = cameraViewMatrix.mul( vec4( 0, 1, 0, 0 ) ).xyz.normalize();
	return vec3( U.dot( tangentView ), U.dot( bitangentView ), U.dot( n ) );

}

// Transmission between crossed polarisers for a retardation in nm, per
// channel (650, 550, 450 nm). Grey at 0, then the interference orders.
export function interference( retardNm ) {

	const r = float( retardNm ).mul( Math.PI );
	const s = vec3( sin( r.div( 650 ) ), sin( r.div( 550 ) ), sin( r.div( 450 ) ) );
	return s.mul( s );

}
