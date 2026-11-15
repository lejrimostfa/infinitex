// Knit coordinates for a skinned character whose texture is an atlas.
//
// Atlas UVs (Meshy and the like) are hundreds of islands with random size
// and orientation: stitches laid on them would break at every island edge
// and point anywhere. So the knit gets its own coordinates, computed once on
// the CPU in the bind pose: a cylinder around each body part (torso, arms,
// head). u runs around the cylinder, v along its axis, both in meters, so
// wales run down the body and along the sleeves, as a knitter would do it.
// The atlas keeps its UVs and only gives the colours and the mask.
//
//   const garment = maskFromImage( material.map.image, isOrange ); // atlasMask.js
//   const out = projectKnitCoords( skinnedMesh, { regions, garment } );
//   // geometry now has: ixUV (meters), tangent (along ixUV u), and
//   // out.garmentTriangles marks the triangles that wear the knit.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { relaxCoords } from './relaxCoords.js';

// Centre of the vertices a group of bones drives most, in geometry space.
// Read from the vertices, not from the inverse bind matrices: those can be
// in another unit (Meshy rigs: bones in cm, geometry in m).
export function partCentroid( mesh, names ) {

	const want = new Set( names.map( ( n ) => mesh.skeleton.bones.findIndex( ( b ) => b.name === n ) ).filter( ( i ) => i >= 0 ) );
	if ( ! want.size ) throw new Error( `knitCoords: no bone among ${ names }` );
	const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
	const c = new THREE.Vector3(), p = new THREE.Vector3();
	let n = 0;
	for ( let i = 0; i < pos.count; i ++ ) {

		let best = 0, bw = - 1;
		for ( let k = 0; k < 4; k ++ ) if ( sw.getComponent( i, k ) > bw ) { bw = sw.getComponent( i, k ); best = si.getComponent( i, k ); }
		if ( ! want.has( best ) ) continue;
		c.add( p.fromBufferAttribute( pos, i ) );
		n ++;

	}

	return c.divideScalar( Math.max( 1, n ) );

}

// regions: [ { name, bones: [...], axis: { origin, dir, seam } } ]
//   origin: a point on the axis, dir: unit axis (v grows along it),
//   seam: unit vector perpendicular to dir, where the u seam sits.
// garment: a mask from maskFromImage, or null (every triangle wears it).
export function projectKnitCoords( mesh, { regions, garment = null, bins = 48, relax = 120 } ) {

	let geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
	const pos = geo.attributes.position, uv = geo.attributes.uv;
	const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
	const nTri = pos.count / 3;
	const boneRegion = new Map();
	regions.forEach( ( r, k ) => r.bones.forEach( ( b ) => {

		const i = mesh.skeleton.bones.findIndex( ( x ) => x.name === b );
		if ( i >= 0 ) boneRegion.set( i, k );

	} ) );

	// Region of each triangle: the one with the most skin weight.
	const triRegion = new Int16Array( nTri ).fill( - 1 );
	const garmentTri = new Uint8Array( nTri );
	for ( let t = 0; t < nTri; t ++ ) {

		const score = new Float32Array( regions.length );
		let cu = 0, cv = 0;
		for ( let c = 0; c < 3; c ++ ) {

			const v = t * 3 + c;
			for ( let k = 0; k < 4; k ++ ) {

				const r = boneRegion.get( si.getComponent( v, k ) );
				if ( r !== undefined ) score[ r ] += sw.getComponent( v, k );

			}

			cu += uv.getX( v ) / 3;
			cv += uv.getY( v ) / 3;

		}

		let best = - 1, bs = 0;
		score.forEach( ( s, r ) => { if ( s > bs ) { bs = s; best = r; } } );
		triRegion[ t ] = best;
		garmentTri[ t ] = ( ! garment || garment.sampleUV( cu, cv ) > 0.5 || [ 0, 1, 2 ].some( ( c ) => garment.sampleUV( uv.getX( t * 3 + c ), uv.getY( t * 3 + c ) ) > 0.5 ) ) && best >= 0 ? 1 : 0;

	}

	// Per region: cylinder coordinates, and the mean garment radius per band
	// along the axis, so a stitch keeps its width around the body while rows
	// stay straight.
	const p = new THREE.Vector3(), rel = new THREE.Vector3();
	const frames = regions.map( ( r ) => {

		const dir = r.axis.dir.clone().normalize();
		const seam = r.axis.seam.clone().addScaledVector( dir, - r.axis.seam.dot( dir ) ).normalize();
		return { o: r.axis.origin, dir, seam, side: new THREE.Vector3().crossVectors( dir, seam ) };

	} );
	const cyl = ( k, i ) => {

		const f = frames[ k ];
		p.fromBufferAttribute( pos, i );
		rel.subVectors( p, f.o );
		const t = rel.dot( f.dir );
		rel.addScaledVector( f.dir, - t );
		let th = Math.atan2( rel.dot( f.side ), rel.dot( f.seam ) );
		if ( th < 0 ) th += Math.PI * 2;
		return { t, r: rel.length(), th };

	};

	const bands = frames.map( () => ( { lo: Infinity, hi: - Infinity, sum: new Float64Array( bins ), n: new Float64Array( bins ) } ) );
	for ( let t = 0; t < nTri; t ++ ) {

		if ( ! garmentTri[ t ] ) continue;
		const k = triRegion[ t ], b = bands[ k ];
		for ( let c = 0; c < 3; c ++ ) {

			const q = cyl( k, t * 3 + c );
			b.lo = Math.min( b.lo, q.t );
			b.hi = Math.max( b.hi, q.t );

		}

	}

	const binOf = ( b, t ) => Math.min( bins - 1, Math.max( 0, Math.floor( ( t - b.lo ) / ( b.hi - b.lo + 1e-9 ) * bins ) ) );
	for ( let t = 0; t < nTri; t ++ ) {

		if ( ! garmentTri[ t ] ) continue;
		const k = triRegion[ t ], b = bands[ k ];
		for ( let c = 0; c < 3; c ++ ) {

			const q = cyl( k, t * 3 + c );
			const j = binOf( b, q.t );
			b.sum[ j ] += q.r;
			b.n[ j ] ++;

		}

	}

	// Fill empty bands from their neighbours.
	const radius = bands.map( ( b ) => {

		const r = Array.from( b.sum, ( s, j ) => b.n[ j ] ? s / b.n[ j ] : NaN );
		let lastGood = r.find( ( x ) => ! isNaN( x ) ) ?? 0.1;
		for ( let j = 0; j < bins; j ++ ) if ( isNaN( r[ j ] ) ) r[ j ] = lastGood; else lastGood = r[ j ];
		return r;

	} );

	const ix = new Float32Array( pos.count * 2 );
	for ( let t = 0; t < nTri; t ++ ) {

		if ( ! garmentTri[ t ] ) continue;
		const k = triRegion[ t ], b = bands[ k ];
		const q = [ 0, 1, 2 ].map( ( c ) => cyl( k, t * 3 + c ) );
		// A triangle across the seam: unwrap its angles.
		const ths = q.map( ( x ) => x.th );
		if ( Math.max( ...ths ) - Math.min( ...ths ) > Math.PI ) for ( const x of q ) if ( x.th < Math.PI ) x.th += Math.PI * 2;
		for ( let c = 0; c < 3; c ++ ) {

			const r = radius[ k ][ binOf( b, q[ c ].t ) ];
			ix[ ( t * 3 + c ) * 2 ] = q[ c ].th * r;
			ix[ ( t * 3 + c ) * 2 + 1 ] = q[ c ].t;

		}

	}

	geo.setAttribute( 'ixUV', new THREE.BufferAttribute( ix, 2 ) );
	// Weld back: vertices equal in every attribute (seams stay split).
	geo = mergeVertices( geo );
	relaxCoords( geo, relax );
	// Atlas tangents first (per vertex, smooth), then tangents along the
	// knit u: computeTangents reads 'uv', so swap.
	geo.computeTangents();
	const atlasT = geo.attributes.tangent.clone();
	const atlasUV = geo.attributes.uv;
	geo.setAttribute( 'uv', geo.attributes.ixUV );
	geo.computeTangents();
	geo.setAttribute( 'uv', atlasUV );
	// Outside the garment the knit coordinates are zero and the tangents
	// degenerate (NaN). A NaN normal stays NaN through any mix, even with a
	// zero mask: give those vertices any tangent perpendicular to the normal.
	const tan = geo.attributes.tangent, nor = geo.attributes.normal;
	const tv = new THREE.Vector3(), nv = new THREE.Vector3();
	for ( let i = 0; i < tan.count; i ++ ) {

		tv.fromBufferAttribute( tan, i );
		if ( Number.isFinite( tv.x + tv.y + tv.z ) && tv.lengthSq() > 1e-12 ) continue;
		nv.fromBufferAttribute( nor, i );
		tv.set( 1, 0, 0 ).addScaledVector( nv, - nv.x );
		if ( tv.lengthSq() < 1e-6 ) tv.set( 0, 1, 0 ).addScaledVector( nv, - nv.y );
		tv.normalize();
		tan.setXYZW( i, tv.x, tv.y, tv.z, 1 );

	}
	mesh.geometry = geo;

	storeAtlasRotation( geo, atlasT );

	// Garment triangles of the welded geometry, for the fuzz shells.
	const index = geo.index.array;
	const tri = new Uint8Array( index.length / 3 );
	const gx = geo.attributes.ixUV;
	for ( let t = 0; t < tri.length; t ++ ) {

		tri[ t ] = [ 0, 1, 2 ].every( ( c ) => gx.getX( index[ t * 3 + c ] ) !== 0 || gx.getY( index[ t * 3 + c ] ) !== 0 ) ? 1 : 0;

	}

	return { garmentTriangles: tri, radius, triRegion };

}

// The atlas normal map needs its own tangent frame. A frame from screen
// derivatives is constant per triangle and shows the triangles of a
// low-poly mesh. A second tangent attribute would not be skinned. So store
// the atlas frame as a rotation of the (skinned) knit frame: ixAtlasRot =
// ( cos, sin, handedness ). Both frames turn together with the bones.
function storeAtlasRotation( geo, atlasT ) {

	const kt = geo.attributes.tangent, nor = geo.attributes.normal;
	const out = new Float32Array( kt.count * 3 );
	const n = new THREE.Vector3(), tk = new THREE.Vector3(), bk = new THREE.Vector3(), ta = new THREE.Vector3();
	for ( let i = 0; i < kt.count; i ++ ) {

		n.fromBufferAttribute( nor, i ).normalize();
		tk.fromBufferAttribute( kt, i );
		bk.crossVectors( n, tk ).multiplyScalar( kt.getW( i ) );
		ta.fromBufferAttribute( atlasT, i );
		ta.addScaledVector( n, - ta.dot( n ) );
		const c = ta.dot( tk ), s = ta.dot( bk ), l = Math.hypot( c, s );
		const ok = Number.isFinite( l ) && l > 1e-6;
		out[ i * 3 ] = ok ? c / l : 1;
		out[ i * 3 + 1 ] = ok ? s / l : 0;
		out[ i * 3 + 2 ] = Number.isFinite( atlasT.getW( i ) ) ? Math.sign( atlasT.getW( i ) ) || 1 : 1;

	}

	geo.setAttribute( 'ixAtlasRot', new THREE.BufferAttribute( out, 3 ) );

}
