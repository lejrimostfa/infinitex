// Exact surface coordinates on a big horizontal plane (a lake, a sea, a
// salt flat), per pixel, from the pixel's own view ray.
// A plane of hundreds of metres is a couple of triangles. Seen from a few
// centimetres, the GPU interpolates its uv (and its world position) with
// too little precision across such a triangle: the values step along the
// screen rows, and every pattern drawn on them steps too (a lava crack
// with a sawtooth edge, rows of lines). Here the camera ray of the pixel
// meets the plane y = height, so the point is exact wherever the camera is.
//   planeCoords( { height, offset } )
//     height   world y of the plane (number or node)
//     offset   [ du, dv ]: uv = ( x, z ) + offset, to match the mesh's uv
// Use it as a material's coords ( createMaterial( preset, { coords } ) ).
// Only for the plane's top: sides of the same mesh get the coordinates of
// the plane behind them.
// Event bus: none, a TSL node.

import { vec2, vec4, float, screenUV, cameraProjectionMatrixInverse, cameraWorldMatrix, cameraPosition } from 'three/tsl';

export function planeCoords( { height, offset = [ 0, 0 ] } ) {

	// The pixel's direction, from its screen position (exact, not
	// interpolated): NDC to view space, then to world space.
	const ndc = vec2( screenUV.x.mul( 2 ).sub( 1 ), screenUV.y.mul( - 2 ).add( 1 ) );
	const v = cameraProjectionMatrixInverse.mul( vec4( ndc, 1, 1 ) );
	const dir = cameraWorldMatrix.mul( vec4( v.xyz.div( v.w ), 0 ) ).xyz.normalize();
	const t = float( height ).sub( cameraPosition.y ).div( dir.y.min( - 1e-6 ) ).max( 0 );
	const P = cameraPosition.add( dir.mul( t ) );
	return vec2( P.x.add( offset[ 0 ] ), P.z.add( offset[ 1 ] ) );

}
