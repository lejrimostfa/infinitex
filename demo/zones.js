// Material zones of a game character whose texture is one atlas.
// Each zone has a colour test on the atlas (a soft mask) and gets its own
// group of triangles, so each triangle runs one material only: the cost of
// knit, leather and the rest does not add up on every pixel.

import * as THREE from 'three/webgpu';
import { maskFromImage } from '../src/tools/atlasMask.js';

const hsv = ( r, g, b ) => {

	const mx = Math.max( r, g, b ), mn = Math.min( r, g, b );
	return { s: mx ? ( mx - mn ) / mx : 0, v: mx / 255 };

};

// Orange cloth. Leather has a close hue but far less red over green.
export const isOrange = ( r, g, b ) => r > 70 && r - g > 50 && g > b && hsv( r, g, b ).s > 0.55;
// Light skin paint of a toon atlas: bright, warm, a little saturated.
export const isSkin = ( r, g, b ) => {

	const { s, v } = hsv( r, g, b );
	return r > g && g > b && v > 0.72 && s > 0.12 && s < 0.5 && r - b > 30;

};
// Brown leather: warm, saturated enough, and not the orange cloth.
export const isBrown = ( r, g, b ) => {

	const { s, v } = hsv( r, g, b );
	return ! isOrange( r, g, b ) && r > g && g >= b && s > 0.28 && v > 0.12 && r - b > 18;

};

// zones: [ { name, test } ]. Returns masks, a union mask for the knit
// coordinates and, after projection, a function that regroups triangles.
export function atlasZones( image, zones ) {

	const masks = zones.map( ( z ) => maskFromImage( image, z.test, 3 ) );
	const union = { ...masks[ 0 ], sampleUV: ( u, v ) => Math.max( ...masks.map( ( m ) => m.sampleUV( u, v ) ) ) };
	return { masks, union };

}

// Decides a zone per triangle, cleans it on the mesh, then reorders the
// index into one group per zone plus a last group for the rest.
//   1. vote: mean mask over the corners and the centre of the triangle
//   2. majority filter over neighbouring triangles (shared corners, by
//      position, so seams do not cut the neighbourhood): fills the holes
//      that a colour test leaves (greyish worn leather, painted scratches)
//   3. per-vertex weights ixZone<z>: share of the vertex's triangles in
//      zone z, used as the material mask (soft only on real borders)
// Returns a Uint8Array per zone (1 = triangle in the zone, new order).
export function groupByZone( geometry, masks, { vote = 0.3, passes = 3 } = {} ) {

	const idx = geometry.index.array, uv = geometry.attributes.uv, pos = geometry.attributes.position;
	const nTri = idx.length / 3, nZ = masks.length;
	const zoneOf = new Int8Array( nTri ).fill( nZ );
	for ( let t = 0; t < nTri; t ++ ) {

		let best = nZ, bs = vote;
		const a = idx[ t * 3 ], b = idx[ t * 3 + 1 ], c = idx[ t * 3 + 2 ];
		const cu = ( uv.getX( a ) + uv.getX( b ) + uv.getX( c ) ) / 3, cv = ( uv.getY( a ) + uv.getY( b ) + uv.getY( c ) ) / 3;
		masks.forEach( ( m, z ) => {

			const sc = ( m.sampleUV( uv.getX( a ), uv.getY( a ) ) + m.sampleUV( uv.getX( b ), uv.getY( b ) ) + m.sampleUV( uv.getX( c ), uv.getY( c ) ) + m.sampleUV( cu, cv ) ) / 4;
			if ( sc > bs ) { bs = sc; best = z; }

		} );
		zoneOf[ t ] = best;

	}

	// Neighbours by corner position.
	const key = ( i ) => `${ pos.getX( i ).toFixed( 4 ) },${ pos.getY( i ).toFixed( 4 ) },${ pos.getZ( i ).toFixed( 4 ) }`;
	const byPos = new Map();
	for ( let t = 0; t < nTri; t ++ ) for ( let c = 0; c < 3; c ++ ) {

		const k = key( idx[ t * 3 + c ] );
		if ( ! byPos.has( k ) ) byPos.set( k, [] );
		byPos.get( k ).push( t );

	}

	const nbrs = Array.from( { length: nTri }, () => new Set() );
	for ( const list of byPos.values() ) for ( const t of list ) for ( const o of list ) if ( o !== t ) nbrs[ t ].add( o );
	for ( let pass = 0; pass < passes; pass ++ ) {

		const next = zoneOf.slice();
		for ( let t = 0; t < nTri; t ++ ) {

			const count = new Int32Array( nZ + 1 );
			for ( const o of nbrs[ t ] ) count[ zoneOf[ o ] ] ++;
			let best = zoneOf[ t ], bc = 0;
			count.forEach( ( n, z ) => { if ( n > bc ) { bc = n; best = z; } } );
			if ( best !== zoneOf[ t ] && bc >= 0.6 * nbrs[ t ].size ) next[ t ] = best;

		}

		zoneOf.set( next );

	}

	// Per-vertex zone weights.
	const nV = pos.count;
	const total = new Float32Array( nV ), w = masks.map( () => new Float32Array( nV ) );
	for ( let t = 0; t < nTri; t ++ ) for ( let c = 0; c < 3; c ++ ) {

		const i = idx[ t * 3 + c ];
		total[ i ] ++;
		if ( zoneOf[ t ] < nZ ) w[ zoneOf[ t ] ][ i ] ++;

	}

	w.forEach( ( arr, z ) => {

		for ( let i = 0; i < nV; i ++ ) arr[ i ] = total[ i ] ? arr[ i ] / total[ i ] : 0;
		geometry.setAttribute( `ixZone${ z }`, new THREE.BufferAttribute( arr, 1 ) );

	} );

	const out = new Uint32Array( idx.length );
	const perZone = masks.map( () => new Uint8Array( nTri ) );
	let wr = 0;
	geometry.clearGroups();
	for ( let z = 0; z <= nZ; z ++ ) {

		const start = wr;
		for ( let t = 0; t < nTri; t ++ ) {

			if ( zoneOf[ t ] !== z ) continue;
			if ( z < nZ ) perZone[ z ][ wr / 3 ] = 1;
			out.set( idx.subarray( t * 3, t * 3 + 3 ), wr );
			wr += 3;

		}

		geometry.addGroup( start, wr - start, z );

	}

	geometry.setIndex( new THREE.BufferAttribute( out, 1 ) );
	return perZone;

}
