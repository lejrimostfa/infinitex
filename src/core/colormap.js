// Colour from an image, one colour per stitch (or per any cell).
//
// The knit runs in its own coordinates (meters), the image in its own UVs
// (an atlas). The shader knows, per pixel, the offset in meters from this
// pixel to the centre of its stitch. The screen derivatives give the local
// Jacobian d(imageUV) / d(meters), so the image UV of the stitch centre is
// imageUV + J * offset. The texture is read there at a mip level that
// covers one stitch: the stitch takes the mean colour of its patch of image.
// From afar (stitches below a pixel) the plain per-pixel colour is used.

import { dFdx, dFdy, log2, texture as textureNode } from 'three/tsl';

export function createStitchColor( { map, mapUV, coords } ) {

	const dAx = dFdx( mapUV ), dAy = dFdy( mapUV );
	const dKx = dFdx( coords ), dKy = dFdy( coords );
	const det = dKx.x.mul( dKy.y ).sub( dKx.y.mul( dKy.x ) );
	const safe = det.abs().max( 1e-20 ).mul( det.sign().add( 0.5 ).sign() );
	// J columns: d(imageUV) / du and d(imageUV) / dv, u and v in meters.
	const J0 = dAx.mul( dKy.y ).sub( dAy.mul( dKx.y ) ).div( safe ).toVar( 'ix_J0' );
	const J1 = dAy.mul( dKx.x ).sub( dAx.mul( dKy.x ) ).div( safe ).toVar( 'ix_J1' );
	const size = map.image ? Math.max( map.image.width, map.image.height ) : 2048;

	return {
		// Mean colour of the image over a cell of `cellMeters` centred at
		// `offset` meters from this pixel.
		at( offset, cellMeters ) {

			// The Jacobian is noisy across atlas island edges: clamp the reach.
			const uvC = mapUV.add( J0.mul( offset.x ) ).add( J1.mul( offset.y ) );
			const texelsPerCell = J0.length().max( J1.length() ).mul( cellMeters ).mul( size );
			const lod = log2( texelsPerCell.max( 1 ) ).clamp( 0, 6 );
			return textureNode( map, uvC ).level( lod ).rgb;

		},
		// Plain per-pixel colour.
		here: textureNode( map, mapUV ).rgb,
	};

}
