// Metric coordinates for a rigid (not skinned) mesh whose UVs are unusable
// (stretched, or all the same point): a cylinder projection around an axis,
// then the same edge-length relaxation as the garments (relaxCoords.js).
// Writes the attribute ixUV (meters, in the mesh's local units times
// `unitMeters`) and tangents along it. Groups and other attributes are kept.
//
//   rigidCoords( maskMesh, { axis: new Vector3( 0, 0, 1 ), unitMeters: 1 } );

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { relaxCoords } from './relaxCoords.js';

// keepUV: { [groupIndex]: [ su, sv ] } uses that group's own UVs times the
// scales (meters) instead of the projection: a rope unwrapped along its
// length, a plank along its grain.
export function rigidCoords( mesh, { axis = new THREE.Vector3( 0, 0, 1 ), unitMeters = 1, relax = 120, keepUV = {}, uvScale = null } = {} ) {

	const src = mesh.geometry;
	const groups = src.groups.map( ( g ) => ( { ...g } ) );
	let geo = src.index ? src.toNonIndexed() : src.clone();
	geo.computeBoundingBox();
	const c = geo.boundingBox.getCenter( new THREE.Vector3() );
	const dir = axis.clone().normalize();
	const seam = Math.abs( dir.y ) < 0.9 ? new THREE.Vector3( 0, - 1, 0 ) : new THREE.Vector3( 0, 0, - 1 );
	seam.addScaledVector( dir, - seam.dot( dir ) ).normalize();
	const side = new THREE.Vector3().crossVectors( dir, seam );
	const pos = geo.attributes.position, n = pos.count;
	const ix = new Float32Array( n * 2 ), p = new THREE.Vector3();
	// Mean radius, so u is roughly in meters before relaxing.
	let rSum = 0;
	for ( let i = 0; i < n; i ++ ) {

		p.fromBufferAttribute( pos, i ).sub( c );
		rSum += p.addScaledVector( dir, - p.dot( dir ) ).length();

	}

	const R = rSum / n;
	for ( let t = 0; t < n; t += 3 ) {

		const th = [ 0, 1, 2 ].map( ( k ) => {

			p.fromBufferAttribute( pos, t + k ).sub( c );
			const a = Math.atan2( p.dot( side ), p.dot( seam ) );
			return a < 0 ? a + Math.PI * 2 : a;

		} );
		if ( Math.max( ...th ) - Math.min( ...th ) > Math.PI ) for ( let k = 0; k < 3; k ++ ) if ( th[ k ] < Math.PI ) th[ k ] += Math.PI * 2;
		for ( let k = 0; k < 3; k ++ ) {

			p.fromBufferAttribute( pos, t + k ).sub( c );
			ix[ ( t + k ) * 2 ] = th[ k ] * R * unitMeters;
			ix[ ( t + k ) * 2 + 1 ] = p.dot( dir ) * unitMeters;

		}

	}

	// uvScale: the whole mesh keeps its own UVs times [ su, sv ].
	if ( uvScale ) keepUV = { all: uvScale };
	for ( const [ gi, [ su, sv ] ] of Object.entries( keepUV ) ) {

		const g = gi === 'all' ? { start: 0, count: geo.attributes.position.count } : groups[ gi ];
		if ( ! g ) continue;
		const uvA = geo.attributes.uv;
		for ( let i = g.start; i < g.start + g.count; i ++ ) {

			ix[ i * 2 ] = uvA.getX( i ) * su;
			ix[ i * 2 + 1 ] = uvA.getY( i ) * sv;

		}

	}

	geo.setAttribute( 'ixUV', new THREE.BufferAttribute( ix, 2 ) );
	geo = mergeVertices( geo );
	// relaxCoords works on the 3D lengths: scale them to meters through ixUV.
	if ( unitMeters !== 1 ) {

		const pa = geo.attributes.position;
		for ( let i = 0; i < pa.count; i ++ ) pa.setXYZ( i, pa.getX( i ) * unitMeters, pa.getY( i ) * unitMeters, pa.getZ( i ) * unitMeters );
		relaxCoords( geo, relax );
		for ( let i = 0; i < pa.count; i ++ ) pa.setXYZ( i, pa.getX( i ) / unitMeters, pa.getY( i ) / unitMeters, pa.getZ( i ) / unitMeters );

	} else {

		relaxCoords( geo, relax );

	}

	const keep = geo.attributes.uv;
	geo.setAttribute( 'uv', geo.attributes.ixUV );
	geo.computeTangents();
	if ( keep ) geo.setAttribute( 'uv', keep );
	else geo.deleteAttribute( 'uv' );
	// toNonIndexed drops the groups' index ranges: rebuild them by triangle.
	geo.clearGroups();
	for ( const g of groups ) geo.addGroup( g.start, g.count, g.materialIndex );
	mesh.geometry = geo;
	return geo;

}
