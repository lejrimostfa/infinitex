// Sea anemones built by code: a column and a crown of tentacles.
//   column    a lathe: a wide foot on the sand, a waist, a flared rim and
//             a slightly hollow oral disc with a raised mouth. Stripes run
//             up the column, lines run out from the mouth. All columns are
//             one mesh, their colours in attributes.
//   crown     tapered tentacles with round tips, in three rings on the
//             disc, longer outside, leaning out more. All tentacles of all
//             anemones are one InstancedMesh; each has its own colours
//             (base to a lighter tip), length and phase.
//   motion    in the vertex stage: each tentacle waves slowly on its own
//             (bend with the square of the distance from its root), and
//             the current (seabed.js) leans the whole crown a little.
// update( t ) is a no-op: all motion is in the shader.
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { attribute, instancedBufferAttribute, positionLocal, uv, vec3, float, sin, cos, mix, smoothstep, abs } from 'three/tsl';
import { ixTime } from '../../src/core/clock.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, current, wetMaterial } from './seabed.js';

// The column's profile ( r, y ) for a radius R and height H, foot to mouth.
function columnGeometry( R, H ) {

	const pts = [ [ 0, 0 ], [ R * 1.1, 0 ], [ R * 1.08, H * 0.1 ], [ R * 0.98, H * 0.25 ], [ R * 0.9, H * 0.5 ], [ R * 0.95, H * 0.78 ], [ R * 1.12, H * 0.95 ], [ R * 1.15, H ],
		[ R * 0.95, H * 0.985 ], [ R * 0.6, H * 0.94 ], [ R * 0.25, H * 0.93 ], [ R * 0.12, H * 0.97 ], [ R * 0.05, H * 0.95 ], [ 0, H * 0.92 ] ];
	const curve = new THREE.SplineCurve( pts.map( ( [ r, y ] ) => new THREE.Vector2( r, y ) ) );
	// v along the profile (uv.y): 0 foot, 1 mouth; userData.rim: the rim.
	const prof = curve.getSpacedPoints( 48 );
	const g = new THREE.LatheGeometry( prof, 48 ); // its own normals: smooth across the seam
	g.userData.rim = prof.reduce( ( b, p, i ) => ( p.y > prof[ b ].y ? i : b ), 0 ) / 48; // v of the rim
	return g;

}

// A tentacle 1 long, radius 1 at the root, round tip, standing on +y.
function tentacleGeometry( rows = 12, sides = 8 ) {

	const pos = [], along = [], idx = [];
	for ( let i = 0; i <= rows; i ++ ) {

		const s = i / rows, tip = s > 0.92 ? Math.sqrt( Math.max( 0, 1 - ( ( s - 0.92 ) / 0.08 ) ** 2 ) ) : 1;
		const r = ( 1 - 0.62 * Math.pow( s, 0.8 ) ) * tip;
		for ( let j = 0; j <= sides; j ++ ) { const a = j / sides * 6.283; pos.push( Math.cos( a ) * r, s, Math.sin( a ) * r ); along.push( s ); }

	}

	for ( let i = 0; i < rows; i ++ ) for ( let j = 0; j < sides; j ++ ) { const a = i * ( sides + 1 ) + j, b = a + sides + 1; idx.push( a, b, a + 1, a + 1, b, b + 1 ); }
	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'along', new THREE.Float32BufferAttribute( along, 1 ) );
	g.setIndex( idx );
	g.computeVertexNormals();
	return g;

}

// list: [ { x, z, R (m), H (m), count, column, base, tip } ] (colours as hex).
export function createAnemones( { list, floor = () => 0, seed = 21 } ) {

	const rnd = rng( seed ), group = new THREE.Group(), tents = [], cols = [];
	for ( const a of list ) {

		// Columns: one merged mesh (one draw); colours and the rim as attributes.
		const geo = columnGeometry( a.R, a.H ), y0 = floor( a.x, a.z ) - 0.004, n = geo.getAttribute( 'position' ).count;
		const each = ( v, k ) => new THREE.Float32BufferAttribute( new Float32Array( n * k ).map( ( _, i ) => v[ i % k ] ), k );
		geo.setAttribute( 'acol', each( new THREE.Color( a.column ).toArray(), 3 ) );
		geo.setAttribute( 'abase', each( new THREE.Color( a.base ).toArray(), 3 ) );
		geo.setAttribute( 'atip', each( new THREE.Color( a.tip ).toArray(), 3 ) );
		geo.setAttribute( 'arim', each( [ geo.userData.rim ], 1 ) );
		cols.push( geo.translate( a.x, y0, a.z ) );
		// Crown: three rings on the disc, each tentacle leans out.
		for ( let k = 0; k < a.count; k ++ ) {

			const ring = k % 3, ph = k / a.count * 6.283 * 3 + ring * 0.7 + rnd() * 0.2;
			const rr = a.R * ( 0.45 + ring * 0.27 ), lean = 0.35 + ring * 0.38 + rnd() * 0.15;
			tents.push( { x: a.x + Math.cos( ph ) * rr, y: y0 + a.H * ( 0.94 + ( 2 - ring ) * 0.015 ), z: a.z + Math.sin( ph ) * rr, ph, lean,
				L: a.R * ( 1.1 + ring * 0.35 ) * ( 0.85 + rnd() * 0.3 ), r: a.R * ( 0.06 + rnd() * 0.02 ), phase: rnd() * 6.283, a } );

		}

	}

	// Column: stripes up the side, lines out from the mouth on the disc.
	const v = uv().y, ang = uv().x.mul( 6.283 ), rim = attribute( 'arim', 'float' );
	const stripes = sin( ang.mul( 24 ) ).mul( 0.5 ).add( 0.5 ).pow( 2 );
	const disc = smoothstep( rim.sub( 0.01 ), rim.add( 0.04 ), v );
	let cc = mix( attribute( 'acol', 'vec3' ).mul( float( 0.75 ).add( stripes.mul( 0.4 ) ) ), attribute( 'abase', 'vec3' ).mul( 0.8 ), disc );
	cc = mix( cc, attribute( 'atip', 'vec3' ), smoothstep( 0.93, 0.98, v ).mul( 0.6 ) ); // pale lips
	cc = cc.mul( float( 1 ).sub( abs( sin( ang.mul( 12 ) ) ).pow( 8 ).mul( disc ).mul( 0.3 ) ) );
	const column = new THREE.Mesh( mergeGeometries( cols ), wetMaterial( { color: cc, roughness: 0.35, sss: 0.4 } ) );
	column.castShadow = true;
	column.receiveShadow = true;
	group.add( column );

	const geo = tentacleGeometry(), n = tents.length;
	const T = new Float32Array( n * 4 ), C0 = new Float32Array( n * 3 ), C1 = new Float32Array( n * 3 ), c = new THREE.Color();
	tents.forEach( ( t, i ) => {

		T.set( [ t.x, t.z, t.L, t.phase ], i * 4 );
		C0.set( c.set( t.a.base ).multiplyScalar( 0.85 + rnd() * 0.3 ).toArray(), i * 3 );
		C1.set( c.set( t.a.tip ).toArray(), i * 3 );

	} );
	geo.setAttribute( 'tent', new THREE.InstancedBufferAttribute( T, 4 ) );
	geo.setAttribute( 'tbase', new THREE.InstancedBufferAttribute( C0, 3 ) );
	geo.setAttribute( 'ttip', new THREE.InstancedBufferAttribute( C1, 3 ) );
	const iT = instancedBufferAttribute( geo.getAttribute( 'tent' ) );
	const s = attribute( 'along', 'float' );
	// Colour: base to a lighter tip, faint rings along the tentacle.
	const rings = sin( s.mul( 40 ) ).mul( 0.5 ).add( 0.5 ).pow( 4 ).mul( 0.12 );
	const col = mix( instancedBufferAttribute( geo.getAttribute( 'tbase' ) ), instancedBufferAttribute( geo.getAttribute( 'ttip' ) ), smoothstep( 0.45, 1.0, s ).mul( 0.8 ) ).mul( float( 1 ).sub( rings ) );
	const mat = wetMaterial( { color: col, roughness: 0.3, sss: 0.7 } );
	// The wave: slow, independent, more at the tip; the current leans all.
	const t = ixTime, ph = iT.w;
	const wave = vec3( sin( t.mul( 0.9 ).add( ph ).add( s.mul( 2.5 ) ) ), sin( t.mul( 0.6 ).add( ph.mul( 1.7 ) ) ).mul( 0.3 ), cos( t.mul( 0.75 ).add( ph.mul( 1.3 ) ).add( s.mul( 2 ) ) ) ).mul( 0.22 );
	// The tips curl up, as a crown open in the water does.
	const cur = current( iT.xy ).mul( 0.35 );
	mat.positionNode = positionLocal.add( wave.add( vec3( cur.x, 0.3, cur.y ) ).mul( s.mul( s ) ).mul( iT.z ) );

	const mesh = new THREE.InstancedMesh( geo, mat, n );
	const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), D = new THREE.Vector3(), Y = new THREE.Vector3( 0, 1, 0 );
	tents.forEach( ( t, i ) => {

		D.set( Math.cos( t.ph ) * Math.sin( t.lean ), Math.cos( t.lean ), Math.sin( t.ph ) * Math.sin( t.lean ) );
		mesh.setMatrixAt( i, M.compose( P.set( t.x, t.y, t.z ), Q.setFromUnitVectors( Y, D ), S.set( t.r, t.L, t.r ) ) );

	} );
	mesh.frustumCulled = false;
	mesh.castShadow = true;
	mesh.userData.noFocus = true;
	group.add( mesh );
	return { group, update() {} };

}
