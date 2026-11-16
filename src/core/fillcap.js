// The free surface of a liquid over the loops where its level cuts the
// container (core/fillgeometry.js). Any outline: round, square, a bottle
// neck, several pools, a rod standing in the liquid (a hole).
// Near each wall the cap gets rings of vertices at a few capillary lengths,
// so the meniscus (core/meniscus.js: water climbs glass by about 2 mm) can
// bend it in the vertex stage. Each vertex carries:
//   wallDist  distance to the wall along the surface (m), 0 on the wall
//   wallDir   unit xz direction away from the wall (into the liquid)
// Past the last ring the cap is flat: the inside is one triangulated polygon.

import { BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2 } from 'three';

const shoelace = ( L ) => { let a = 0; for ( let i = 0; i < L.length; i ++ ) { const p = L[ i ], q = L[ ( i + 1 ) % L.length ]; a += p[ 0 ] * q[ 1 ] - q[ 0 ] * p[ 1 ]; } return a / 2; };
const perimeter = ( L ) => L.reduce( ( s, p, i ) => s + Math.hypot( L[ ( i + 1 ) % L.length ][ 0 ] - p[ 0 ], L[ ( i + 1 ) % L.length ][ 1 ] - p[ 1 ] ), 0 );

function inside( pt, L ) {

	let c = false;
	for ( let i = 0, j = L.length - 1; i < L.length; j = i ++ ) {

		const [ xi, zi ] = L[ i ], [ xj, zj ] = L[ j ];
		if ( ( zi > pt[ 1 ] ) !== ( zj > pt[ 1 ] ) && pt[ 0 ] < ( xj - xi ) * ( pt[ 1 ] - zi ) / ( zj - zi ) + xi ) c = ! c;

	}

	return c;

}

// Unit normals into the loop (counter-clockwise loop: the left side), with
// the miter scale that keeps an offset edge parallel to its wall.
function inwardNormals( L ) {

	const n = L.length, out = [];
	const edge = ( i ) => {

		const p = L[ i ], q = L[ ( i + 1 ) % n ];
		const dx = q[ 0 ] - p[ 0 ], dz = q[ 1 ] - p[ 1 ], l = Math.hypot( dx, dz ) || 1;
		return [ - dz / l, dx / l ];

	};

	for ( let i = 0; i < n; i ++ ) {

		const a = edge( ( i + n - 1 ) % n ), b = edge( i );
		let x = a[ 0 ] + b[ 0 ], z = a[ 1 ] + b[ 1 ];
		const l = Math.hypot( x, z ) || 1;
		x /= l; z /= l;
		const miter = 1 / Math.max( 0.5, x * b[ 0 ] + z * b[ 1 ] );
		out.push( [ x, z, miter ] );

	}

	return out;

}

// Area inside the loops, holes taken out (m2).
export function netArea( loops ) {

	let a = 0;
	for ( const L of loops ) {

		const depth = loops.filter( ( o ) => o !== L && inside( L[ 0 ], o ) ).length;
		a += Math.abs( shoelace( L ) ) * ( depth % 2 ? - 1 : 1 );

	}

	return a;

}

// loops: [ [ [ x, z ], ... ], ... ]. rings: distances from the wall (m),
// increasing; those over 45 % of a loop's inradius are dropped.
export function capGeometry( loops, level, rings = [] ) {

	const outer = [], holes = [];
	for ( const L of loops ) {

		const depth = loops.filter( ( o ) => o !== L && inside( L[ 0 ], o ) ).length;
		const ccw = shoelace( L ) > 0 ? L : [ ...L ].reverse();
		( depth % 2 ? holes : outer ).push( ccw );

	}

	const pos = [], dist = [], dir = [], idx = [];
	const vert = ( x, z, d, nx, nz ) => { pos.push( x, level, z ); dist.push( d ); dir.push( nx, nz ); return pos.length / 3 - 1; };
	for ( const L of outer ) {

		const inr = 2 * Math.abs( shoelace( L ) ) / perimeter( L ); // inradius of a round loop
		const D = [ 0, ...rings.filter( ( d ) => d < 0.45 * inr ) ];
		const N = inwardNormals( L ), n = L.length;
		const ringIds = D.map( ( d ) => L.map( ( p, i ) => vert( p[ 0 ] + N[ i ][ 0 ] * d * N[ i ][ 2 ], p[ 1 ] + N[ i ][ 1 ] * d * N[ i ][ 2 ], d, N[ i ][ 0 ], N[ i ][ 1 ] ) ) );
		for ( let k = 0; k + 1 < D.length; k ++ ) for ( let i = 0; i < n; i ++ ) {

			const a = ringIds[ k ][ i ], b = ringIds[ k ][ ( i + 1 ) % n ], c = ringIds[ k + 1 ][ ( i + 1 ) % n ], d = ringIds[ k + 1 ][ i ];
			idx.push( a, b, c, a, c, d );

		}

		// The flat inside: the last ring, with the holes in it.
		const last = ringIds[ D.length - 1 ], dl = D[ D.length - 1 ];
		const mine = holes.filter( ( H ) => inside( H[ 0 ], L ) );
		const contour = last.map( ( i ) => new Vector2( pos[ i * 3 ], pos[ i * 3 + 2 ] ) );
		const holeIds = mine.map( ( H ) => H.map( ( p ) => vert( p[ 0 ], p[ 1 ], dl, 0, 0 ) ) );
		const holeV = mine.map( ( H ) => H.map( ( p ) => new Vector2( p[ 0 ], p[ 1 ] ) ) );
		const all = [ ...last, ...holeIds.flat() ];
		for ( const f of ShapeUtils.triangulateShape( contour, holeV ) ) idx.push( all[ f[ 0 ] ], all[ f[ 1 ] ], all[ f[ 2 ] ] );

	}

	// Every triangle faces up (+y).
	for ( let t = 0; t < idx.length; t += 3 ) {

		const [ a, b, c ] = [ idx[ t ], idx[ t + 1 ], idx[ t + 2 ] ].map( ( i ) => [ pos[ i * 3 ], pos[ i * 3 + 2 ] ] );
		if ( ( b[ 1 ] - a[ 1 ] ) * ( c[ 0 ] - a[ 0 ] ) - ( b[ 0 ] - a[ 0 ] ) * ( c[ 1 ] - a[ 1 ] ) < 0 ) [ idx[ t + 1 ], idx[ t + 2 ] ] = [ idx[ t + 2 ], idx[ t + 1 ] ];

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'normal', new Float32BufferAttribute( pos.map( ( _, i ) => ( i % 3 === 1 ? 1 : 0 ) ), 3 ) );
	g.setAttribute( 'wallDist', new Float32BufferAttribute( dist, 1 ) );
	g.setAttribute( 'wallDir', new Float32BufferAttribute( dir, 2 ) );
	g.setIndex( idx );
	const tris = [];
	for ( const i of idx ) tris.push( pos[ i * 3 ], pos[ i * 3 + 1 ], pos[ i * 3 + 2 ] );
	return { geometry: g, tris };

}
