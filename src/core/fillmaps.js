// Per-level maps of a liquid volume (core/liquidvolume.js).
//   floorMap  the lowest y of the body under each cell of a 48 x 48 grid
//             over its xz box: the depth under each point of the surface,
//             for absorption (core/liquidshading.js). Half float, linear.
//   addUV     uv in metres on the body and the cap, and tangents, so any
//             family material can dress them (`surface` option).

import { DataTexture, RedFormat, HalfFloatType, LinearFilter, DataUtils, Float32BufferAttribute } from 'three';

const FLOOR_N = 48;

// Lowest y of the body under each cell of a grid over its xz box.
export function floorMap( tris, min, size, level ) {

	const N = FLOOR_N, f = new Float32Array( N * N ).fill( level );
	for ( let t = 0; t < tris.length; t += 9 ) {

		const ax = tris[ t ], ay = tris[ t + 1 ], az = tris[ t + 2 ], bx = tris[ t + 3 ], by = tris[ t + 4 ], bz = tris[ t + 5 ], cx = tris[ t + 6 ], cy = tris[ t + 7 ], cz = tris[ t + 8 ];
		const det = ( bz - cz ) * ( ax - cx ) + ( cx - bx ) * ( az - cz );
		if ( Math.abs( det ) < 1e-14 ) continue;
		const i0 = Math.max( 0, Math.floor( ( Math.min( ax, bx, cx ) - min.x ) / size.x * N ) ), i1 = Math.min( N - 1, Math.ceil( ( Math.max( ax, bx, cx ) - min.x ) / size.x * N ) );
		const j0 = Math.max( 0, Math.floor( ( Math.min( az, bz, cz ) - min.y ) / size.y * N ) ), j1 = Math.min( N - 1, Math.ceil( ( Math.max( az, bz, cz ) - min.y ) / size.y * N ) );
		for ( let j = j0; j <= j1; j ++ ) for ( let i = i0; i <= i1; i ++ ) {

			const x = min.x + ( i + 0.5 ) / N * size.x, z = min.y + ( j + 0.5 ) / N * size.y;
			const l1 = ( ( bz - cz ) * ( x - cx ) + ( cx - bx ) * ( z - cz ) ) / det, l2 = ( ( cz - az ) * ( x - cx ) + ( ax - cx ) * ( z - cz ) ) / det, l3 = 1 - l1 - l2;
			if ( l1 >= - 1e-6 && l2 >= - 1e-6 && l3 >= - 1e-6 ) f[ j * N + i ] = Math.min( f[ j * N + i ], l1 * ay + l2 * by + l3 * cy );

		}

	}

	const tex = new DataTexture( Uint16Array.from( f, ( v ) => DataUtils.toHalfFloat( v ) ), N, N, RedFormat, HalfFloatType );
	tex.minFilter = tex.magFilter = LinearFilter;
	tex.needsUpdate = true;
	return tex;

}

// uv in metres for a family material (surface option).
export function addUV( g, cap ) {

	const P = g.attributes.position, uv = [];
	for ( let i = 0; i < P.count; i ++ ) uv.push( cap ? P.getX( i ) : P.getX( i ) + P.getZ( i ), cap ? P.getZ( i ) : P.getY( i ) );
	g.setAttribute( 'uv', new Float32BufferAttribute( uv, 2 ) );
	if ( g.index ) g.computeTangents();

}
