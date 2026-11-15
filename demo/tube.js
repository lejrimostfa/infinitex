// Skinned elliptic tube with UVs in surface meters (wales along v).
// Used by mannequin.js for the sweater torso and sleeves.

import * as THREE from 'three/webgpu';

// Elliptic tube along a curve. ring(s) -> { c, a, b, e1, e2 }: centre and two
// half-axes with their directions. Angle 0 is the seam (along -e2).
// weights(s) -> [[bone, w], ...] up to 4.
export function tube( ring, weights, segS, segT, uPerimeter ) {

	const pos = [], uvs = [], si = [], sw = [], index = [];
	let v = 0, prev = null;
	for ( let i = 0; i <= segS; i ++ ) {

		const s = i / segS;
		const r = ring( s );
		const mean = ( r.a + r.b ) / 2;
		if ( prev ) v += Math.hypot( r.c.distanceTo( prev.c ), mean - prev.mean );
		prev = { c: r.c, mean };
		const w = weights( s );
		for ( let j = 0; j <= segT; j ++ ) {

			const phi = ( j / segT ) * Math.PI * 2;
			const p = r.c.clone().addScaledVector( r.e1, r.a * Math.sin( phi ) ).addScaledVector( r.e2, - r.b * Math.cos( phi ) );
			pos.push( p.x, p.y, p.z );
			uvs.push( ( j / segT ) * uPerimeter, v );
			for ( let k = 0; k < 4; k ++ ) {

				si.push( w[ k ]?.[ 0 ] ?? 0 );
				sw.push( w[ k ]?.[ 1 ] ?? 0 );

			}

		}

	}

	const row = segT + 1;
	for ( let i = 0; i < segS; i ++ ) for ( let j = 0; j < segT; j ++ ) {

		const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
		index.push( a, c, b, b, c, d );

	}

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	g.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( si, 4 ) );
	g.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( sw, 4 ) );
	g.setIndex( index );
	g.computeVertexNormals();
	// Make sure normals point out of the tube.
	const n0 = new THREE.Vector3().fromBufferAttribute( g.attributes.normal, row * ( segS >> 1 ) + ( segT >> 2 ) );
	const p0 = new THREE.Vector3().fromBufferAttribute( g.attributes.position, row * ( segS >> 1 ) + ( segT >> 2 ) );
	if ( n0.dot( p0.sub( ring( 0.5 ).c ) ) < 0 ) {

		const ix = g.index.array;
		for ( let k = 0; k < ix.length; k += 3 ) [ ix[ k + 1 ], ix[ k + 2 ] ] = [ ix[ k + 2 ], ix[ k + 1 ] ];
		g.computeVertexNormals();

	}

	// Weld the seam: average normals of the first and last column.
	const nrm = g.attributes.normal;
	for ( let i = 0; i <= segS; i ++ ) {

		const a = i * row, b = a + segT;
		const n = new THREE.Vector3().fromBufferAttribute( nrm, a ).add( new THREE.Vector3().fromBufferAttribute( nrm, b ) ).normalize();
		nrm.setXYZ( a, n.x, n.y, n.z );
		nrm.setXYZ( b, n.x, n.y, n.z );

	}

	g.computeTangents();
	g.userData.grid = { segS, segT };
	return g;

}

export const ellipsePerimeter = ( a, b ) => Math.PI * ( 3 * ( a + b ) - Math.sqrt( ( 3 * a + b ) * ( a + 3 * b ) ) );
export const sstep = ( a, b, x ) => {

	const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

};
