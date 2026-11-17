// A kelp plant built by code, in the Infinitex seaweed matter (organic
// family, mode seaweed: a slimy blade, cells in rows, air bubbles).
//   holdfast  a tuft of short root claws gripping the sand
//   stipe     a thin stem, tapered, with a gentle S
//   blades    broad leaves along the stipe, turning around it (137 deg),
//            each on a gas float (pneumatocyst), with ruffled margins and
//            a short terminal blade at the top
//   sway      in the vertex stage: the stipe bends with the current
//            (seabed.js) like a grass blade, each leaf follows its point of
//            the stipe, streams with the water and flutters on its own
//   colour    a shade attribute darkens the base, lightens the leaf tips
// All plants are one mesh; beyond 90 cm a plain material of the same mean
// colour (seabed.js lod). update( t ) is a no-op.
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { attribute, positionLocal, uv, vec3, sin, sqrt } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createMaterial } from '../../src/index.js';
import { tintUnderwater } from '../../src/core/underwater.js';
import { ixTime } from '../../src/core/clock.js';
import { rng, rgb, current, lod, wetMaterial } from './seabed.js';

// Arrays of one plant: position, uv (m), kelp = ( k, leaf s, phase, leaf
// length ), lnorm (the leaf's normal, for its flutter), shade.
function builder() {

	const B = { pos: [], uv: [], kelp: [], lnorm: [], shade: [], idx: [] };
	// A grid of rows x cols points from f( i, j ) -> [ x, y, z, u, v, k, s, phase, len, nx, ny, nz, shade ].
	B.grid = ( rows, cols, f, wrapCols ) => {

		const base = B.pos.length / 3;
		for ( let i = 0; i <= rows; i ++ ) for ( let j = 0; j <= cols; j ++ ) {

			const p = f( i / rows, j / cols );
			B.pos.push( p[ 0 ], p[ 1 ], p[ 2 ] ); B.uv.push( p[ 3 ], p[ 4 ] ); B.kelp.push( p[ 5 ], p[ 6 ], p[ 7 ], p[ 8 ] );
			B.lnorm.push( p[ 9 ], p[ 10 ], p[ 11 ] ); B.shade.push( p[ 12 ] );

		}

		for ( let i = 0; i < rows; i ++ ) for ( let j = 0; j < cols; j ++ ) {

			const a = base + i * ( cols + 1 ) + j, b = a + cols + 1;
			if ( wrapCols ) B.idx.push( a, b, a + 1, a + 1, b, b + 1 ); else B.idx.push( a, a + 1, b, a + 1, b + 1, b );

		}

	};
	return B;

}

// A tube from point a to b along the curve c( t ) -> Vector3, radius r( t ).
function tube( B, c, r, len, kOf, shadeOf, rows = 10, sides = 8 ) {

	const T = new THREE.Vector3(), N = new THREE.Vector3(), Bn = new THREE.Vector3(), P = new THREE.Vector3(), up = new THREE.Vector3( 0, 0, 1 );
	B.grid( rows, sides, ( t, a ) => {

		P.copy( c( Math.min( 1, t + 0.01 ) ) ).sub( c( Math.max( 0, t - 0.01 ) ) );
		T.copy( P ).normalize();
		N.crossVectors( T, Math.abs( T.z ) > 0.9 ? new THREE.Vector3( 1, 0, 0 ) : up ).normalize();
		Bn.crossVectors( T, N );
		const w = a * Math.PI * 2, rr = r( t ), q = c( t );
		const x = q.x + ( N.x * Math.cos( w ) + Bn.x * Math.sin( w ) ) * rr, y = q.y + ( N.y * Math.cos( w ) + Bn.y * Math.sin( w ) ) * rr, z = q.z + ( N.z * Math.cos( w ) + Bn.z * Math.sin( w ) ) * rr;
		return [ x, y, z, a * 6.283 * rr, t * len, kOf( t ), 0, 0, 0, 0, 1, 0, shadeOf( t ) ];

	}, true );

}

function kelpGeometry( H, rnd ) {

	const B = builder();
	const stipe = ( t ) => new THREE.Vector3( Math.sin( t * 3.2 ) * 0.012, t * H, Math.sin( t * 2.1 + 1 ) * 0.008 );
	tube( B, stipe, ( t ) => 0.0032 - 0.0016 * t, H, ( t ) => t, ( t ) => 0.55 + 0.3 * t, 16, 8 );
	// Holdfast: claws out and down into the sand.
	for ( let i = 0; i < 7; i ++ ) {

		const a = i / 7 * 6.283 + rnd(), R = 0.012 + rnd() * 0.008;
		tube( B, ( t ) => new THREE.Vector3( Math.cos( a ) * R * t, 0.008 * ( 1 - t ) - 0.004 * t * t, Math.sin( a ) * R * t ), ( t ) => 0.0022 - 0.0012 * t, R, () => 0, () => 0.5, 4, 6 );

	}

	// Leaves: attach k, azimuth, length, width, elevation.
	const n = 9;
	for ( let i = 0; i <= n; i ++ ) {

		const top = i === n, k = top ? 1 : 0.22 + 0.74 * i / n + ( rnd() - 0.5 ) * 0.04;
		const az = i * 2.4 + rnd() * 0.3, Lb = top ? 0.05 : 0.09 + rnd() * 0.06, Wb = top ? 0.014 : 0.022 + rnd() * 0.014;
		const elev = top ? 1.4 : 0.55 + rnd() * 0.35, phase = rnd() * 6.283, at = stipe( k );
		const D = new THREE.Vector3( Math.cos( az ) * Math.cos( elev ), Math.sin( elev ), Math.sin( az ) * Math.cos( elev ) );
		const S = new THREE.Vector3( - Math.sin( az ), 0, Math.cos( az ) ); // across the leaf
		const Nn = new THREE.Vector3().crossVectors( D, S ).normalize();
		// Float: a small sphere at the leaf's root.
		const fr = 0.0035, fc = at.clone().addScaledVector( D, 0.006 );
		if ( ! top ) B.grid( 6, 8, ( v, a ) => { const th = v * Math.PI, w = a * 6.283; return [ fc.x + Math.sin( th ) * Math.cos( w ) * fr, fc.y + Math.cos( th ) * fr * 1.3, fc.z + Math.sin( th ) * Math.sin( w ) * fr, a * 0.02, v * 0.01, k, 0, phase, Lb, 0, 1, 0, 0.8 ]; }, true );
		const root = top ? at : fc.clone().addScaledVector( D, fr );
		// The blade arches: its direction rises toward the vertical along it.
		B.grid( 44, 8, ( s, a ) => {

			const w = Wb * Math.pow( Math.sin( Math.PI * Math.min( 1, Math.pow( s, 0.6 ) ) ), 0.8 ) * ( 0.3 + 0.7 * Math.min( 1, s * 6 ) );
			const x = ( a - 0.5 ) * w, e = Math.abs( a - 0.5 ) * 2;
			const ruffle = e * e * 0.0035 * Math.sin( s * Lb / 0.022 * 6.283 + a * 2 ) + ( 1 - e * e ) * 0.002; // wavy margin, a shallow cup
			const lift = s * s * Lb * 0.35;
			const p = root.clone().addScaledVector( D, s * Lb ).addScaledVector( S, x ).addScaledVector( Nn, ruffle ).add( new THREE.Vector3( 0, lift, 0 ) );
			return [ p.x, p.y, p.z, x, s * Lb, k, s, phase, Lb, Nn.x, Nn.y, Nn.z, 0.75 + 0.45 * s ];

		}, false );

	}

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( B.pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( B.uv, 2 ) );
	g.setAttribute( 'kelp', new THREE.Float32BufferAttribute( B.kelp, 4 ) );
	g.setAttribute( 'lnorm', new THREE.Float32BufferAttribute( B.lnorm, 3 ) );
	g.setAttribute( 'shade', new THREE.Float32BufferAttribute( B.shade, 1 ) );
	g.setIndex( B.idx );
	g.computeVertexNormals();
	g.computeTangents();
	return g;

}

// spots: [ [ x, z, height ], ... ]. floor( x, z ): the sand height.
export function createKelp( { spots, floor = () => 0, seed = 9, preset = {} } ) {

	const rnd = rng( seed );
	const ix = createMaterial( { family: 'organic', mode: 'seaweed', intent: 'kelp blade', angle_deg: 90, feature_mm: 2, cell_um: 25, color: '#5a4410', color2: '#8c6c1c', color3: '#2a1c06',
		bubbles: 0.5, relief: 1, translucency: 0.8, roughness: 0.35, seed: 11, underwater: 1, ...preset }, { coords: uv() } );
	const m = ix.material, shade = attribute( 'shade', 'float' );
	m.side = THREE.DoubleSide;
	tintUnderwater( m, shade );
	// Far away (seabed.js lod): the matter's mean colour, plain.
	const far = wetMaterial( { color: rgb( '#64501a' ).mul( shade ), roughness: 0.4, sss: 0.6, side: THREE.DoubleSide } );
	// The sway. plant = ( root x, root z, height ), the same on every vertex.
	const P = attribute( 'plant', 'vec3' ), K = attribute( 'kelp', 'vec4' ), k = K.x, s = K.y, t = ixTime;
	const c0 = current( P.xy ).mul( 0.7 );
	const c = c0.div( sqrt( c0.dot( c0 ).add( 1 ) ) );
	const stem = vec3( c.x, c.dot( c ).mul( k ).mul( - 2 / 3 ), c.y ).mul( k.mul( k ) ).mul( P.z );
	const stream = vec3( c.x, 0.15, c.y ).mul( s.mul( s ) ).mul( K.w ).mul( 0.6 );
	const flutter = attribute( 'lnorm', 'vec3' ).mul( sin( t.mul( 1.9 ).add( K.z ).add( s.mul( 5 ) ) ).mul( s.mul( s ) ).mul( K.w ).mul( 0.16 ) );
	m.positionNode = far.positionNode = positionLocal.add( stem ).add( stream ).add( flutter );
	// All plants in one mesh (one draw), around their centre (the level of
	// detail is chosen by the distance to it).
	const cx = spots.reduce( ( a, p ) => a + p[ 0 ], 0 ) / spots.length, cz = spots.reduce( ( a, p ) => a + p[ 1 ], 0 ) / spots.length;
	const geos = spots.map( ( [ x, z, H ] ) => {

		const g = kelpGeometry( H, rnd ), n = g.getAttribute( 'position' ).count;
		g.setAttribute( 'plant', new THREE.Float32BufferAttribute( new Float32Array( n * 3 ).map( ( _, i ) => [ x, z, H ][ i % 3 ] ), 3 ) );
		return g.translate( x - cx, floor( x, z ) - 0.003, z - cz );

	} );
	const g = mergeGeometries( geos );
	const mesh = lod( [ [ g, m, 0 ], [ g, far, 0.9 ] ] );
	mesh.position.set( cx, 0, cz );
	mesh.levels.forEach( ( l ) => { l.object.frustumCulled = false; } );
	const group = new THREE.Group();
	group.add( mesh );

	return { group, material: ix, update() {} };

}
