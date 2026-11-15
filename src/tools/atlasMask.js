// Garment mask from an atlas texture: a per-pixel colour test, softened.
// Used to choose where the knit replaces the painted texture.

import * as THREE from 'three';

// Mask of the garment in the atlas, from a per-pixel test on the colour.
// Returns { w, h, data (0..1), sampleUV( u, v ) }.
export function maskFromImage( image, test, blur = 2 ) {

	const w = image.width, h = image.height;
	const canvas = new OffscreenCanvas( w, h );
	const g = canvas.getContext( '2d' );
	g.drawImage( image, 0, 0 );
	const px = g.getImageData( 0, 0, w, h ).data;
	let data = new Float32Array( w * h );
	for ( let i = 0; i < w * h; i ++ ) data[ i ] = test( px[ i * 4 ], px[ i * 4 + 1 ], px[ i * 4 + 2 ] ) ? 1 : 0;
	// Box blur (separable) so the border is soft, not a pixel staircase.
	for ( let pass = 0; pass < 2; pass ++ ) {

		const out = new Float32Array( w * h );
		for ( let y = 0; y < h; y ++ ) for ( let x = 0; x < w; x ++ ) {

			let s = 0, n = 0;
			for ( let k = - blur; k <= blur; k ++ ) {

				const xx = pass === 0 ? x + k : x, yy = pass === 0 ? y : y + k;
				if ( xx < 0 || yy < 0 || xx >= w || yy >= h ) continue;
				s += data[ yy * w + xx ];
				n ++;

			}

			out[ y * w + x ] = s / n;

		}

		data = out;

	}

	// glTF images are not flipped: v = 0 is the top row.
	const sampleUV = ( u, v ) => {

		const x = Math.min( w - 1, Math.max( 0, Math.floor( u * w ) ) );
		const y = Math.min( h - 1, Math.max( 0, Math.floor( v * h ) ) );
		return data[ y * w + x ];

	};

	return { w, h, data, sampleUV };

}

// Mask as a texture (red channel), same layout as the atlas.
export function maskTexture( mask ) {

	const bytes = new Uint8Array( mask.w * mask.h * 4 );
	for ( let i = 0; i < mask.w * mask.h; i ++ ) bytes[ i * 4 ] = bytes[ i * 4 + 1 ] = bytes[ i * 4 + 2 ] = Math.round( mask.data[ i ] * 255 );
	for ( let i = 0; i < mask.w * mask.h; i ++ ) bytes[ i * 4 + 3 ] = 255;
	const tex = new THREE.DataTexture( bytes, mask.w, mask.h );
	tex.flipY = false;
	tex.generateMipmaps = true;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.magFilter = THREE.LinearFilter;
	tex.needsUpdate = true;
	return tex;

}
