// The liquid inside any closed shape, cut at a level (CPU, three.js only).
//   cavity  a closed (watertight) geometry: the inside of the container,
//           in its local frame. A lathe of the inner profile, a sphere, a
//           mesh from Blender. Its normals point out of the liquid.
//   level   local y of the still surface
// Gives the body (the cavity's triangles under the level, those crossing it
// cut), the loops where the level cuts the walls, the volume and the area.
// The cap over the loops is built by core/fillcap.js.
// Cost: linear in triangles, about 2 ms for 10k on an M1 Max (measured in
// tests/kit_volume.mjs). Run again on every level change, not per frame.

import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Positions only, merged, optionally pushed inside by `inset` metres along
// the smooth normals (so the liquid does not z-fight the glass wall).
export function prepareCavity( geometry, inset = 0 ) {

	const g = new BufferGeometry();
	g.setAttribute( 'position', geometry.getAttribute( 'position' ).clone() );
	if ( geometry.index ) g.setIndex( geometry.index.clone() );
	const m = mergeVertices( g.index ? g.toNonIndexed() : g, 1e-6 );
	// Faces must point out of the liquid: flip a cavity wound inside out.
	const I = m.index.array, flat = [];
	for ( let f = 0; f < I.length; f ++ ) flat.push( m.attributes.position.getX( I[ f ] ), m.attributes.position.getY( I[ f ] ), m.attributes.position.getZ( I[ f ] ) );
	if ( measure( flat ).vol < 0 ) for ( let f = 0; f < I.length; f += 3 ) [ I[ f + 1 ], I[ f + 2 ] ] = [ I[ f + 2 ], I[ f + 1 ] ];
	if ( inset > 0 ) {

		m.computeVertexNormals();
		const P = m.attributes.position, N = m.attributes.normal;
		for ( let i = 0; i < P.count; i ++ ) P.setXYZ( i, P.getX( i ) - N.getX( i ) * inset, P.getY( i ) - N.getY( i ) * inset, P.getZ( i ) - N.getZ( i ) * inset );

	}

	return m;

}

// Signed volume and area of a triangle soup (flat array of xyz, 9 per triangle).
function measure( t ) {

	let vol = 0, area = 0;
	const a = new Vector3(), b = new Vector3(), c = new Vector3(), x = new Vector3();
	for ( let i = 0; i < t.length; i += 9 ) {

		a.fromArray( t, i ); b.fromArray( t, i + 3 ); c.fromArray( t, i + 6 );
		vol += a.dot( x.crossVectors( b, c ) ) / 6;
		area += x.crossVectors( b.clone().sub( a ), c.clone().sub( a ) ).length() / 2;

	}

	return { vol, area };

}

// Cut the merged cavity at y = level.
export function clipCavity( cavity, level ) {

	const P = cavity.attributes.position, I = cavity.index.array;
	let y0 = level;
	for ( let i = 0; i < P.count; i ++ ) if ( Math.abs( P.getY( i ) - y0 ) < 1e-7 ) { y0 += 2e-7; i = - 1; }
	const tris = [], seg = new Map(); // edge key -> [ other key ], for the loops
	const pt = new Map(); // edge key -> [ x, z ]
	const v = ( i ) => [ P.getX( i ), P.getY( i ), P.getZ( i ) ];
	const cut = ( i, j ) => {

		const k = i < j ? `${ i }_${ j }` : `${ j }_${ i }`;
		if ( ! pt.has( k ) ) {

			const a = v( i ), b = v( j ), t = ( y0 - a[ 1 ] ) / ( b[ 1 ] - a[ 1 ] );
			pt.set( k, [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * t ] );

		}

		return k;

	};

	for ( let f = 0; f < I.length; f += 3 ) {

		const ids = [ I[ f ], I[ f + 1 ], I[ f + 2 ] ];
		const below = ids.map( ( i ) => P.getY( i ) < y0 );
		const n = below.filter( Boolean ).length;
		if ( n === 0 ) continue;
		if ( n === 3 ) { for ( const i of ids ) tris.push( ...v( i ) ); continue; }
		// Walk the triangle in order; keep the part under the level.
		const poly = [], keys = [];
		for ( let e = 0; e < 3; e ++ ) {

			const i = ids[ e ], j = ids[ ( e + 1 ) % 3 ];
			if ( below[ e ] ) poly.push( v( i ) );
			if ( below[ e ] !== below[ ( e + 1 ) % 3 ] ) {

				const k = cut( i, j ), q = pt.get( k );
				poly.push( [ q[ 0 ], y0, q[ 1 ] ] );
				keys.push( k );

			}

		}

		for ( let k = 1; k + 1 < poly.length; k ++ ) tris.push( ...poly[ 0 ], ...poly[ k ], ...poly[ k + 1 ] );
		const [ k1, k2 ] = keys;
		if ( ! seg.has( k1 ) ) seg.set( k1, [] );
		if ( ! seg.has( k2 ) ) seg.set( k2, [] );
		seg.get( k1 ).push( k2 );
		seg.get( k2 ).push( k1 );

	}

	// Chain the segments into closed loops of [ x, z ].
	const loops = [], seen = new Set();
	for ( const start of seg.keys() ) {

		if ( seen.has( start ) ) continue;
		const loop = [];
		let prev = null, cur = start;
		while ( cur && ! seen.has( cur ) ) {

			seen.add( cur );
			loop.push( pt.get( cur ) );
			const next = seg.get( cur ).find( ( k ) => k !== prev && ! seen.has( k ) );
			prev = cur;
			cur = next;

		}

		if ( loop.length >= 3 ) loops.push( loop );

	}

	return { tris, loops, level: y0 };

}

export function bodyGeometry( tris ) {

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( tris, 3 ) );
	const m = mergeVertices( g, 1e-6 ); // smooth normals across the cut triangles
	m.computeVertexNormals();
	return m;

}

export function signedVolume( tris ) {

	return measure( tris ).vol;

}

// Volume (m3) and area (m2) of the liquid: the body plus a flat cap.
export function liquidMeasures( tris, capTris ) {

	const b = measure( tris ), c = measure( capTris );
	return { volume: Math.abs( b.vol + c.vol ), area: b.area + c.area };

}
