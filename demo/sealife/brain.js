// A brain coral built by code: a low dome whose surface folds into long
// meandering ridges and valleys, in the Infinitex coral matter (organic
// family, mode coral) for the fine polyp cups.
//   dome      a grid over the half sphere, squashed, the lower edge tucked
//             in where it meets the sand
//   meanders  the contour lines of a smooth 3D noise (gradient noise, two
//             octaves) are long closed curves, evenly spaced, that wind
//             and branch: the valleys run along them. The vertices move
//             along the normal by a profile with broad round ridges and
//             narrow deep valleys, so the folds show in the silhouette.
//   colour    a ridge attribute: valleys darker and greener, ridge tops
//             paler, multiplied over the matter's own colour
// Three levels of detail (seabed.js lod). UVs: an azimuthal map of the
// dome (angle, distance from the top) in meters, so the cups keep their
// size and there is no seam.
// update( t ) is a no-op.
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { attribute, uv, vec3, mix } from 'three/tsl';
import { createMaterial } from '../../src/index.js';
import { rng, rgb, lod, wetMaterial } from './seabed.js';

// Gradient noise in 3D (improved Perlin), about -0.7..0.7.
function makeNoise( rnd ) {

	const p = Array.from( { length: 256 }, ( _, i ) => i );
	for ( let i = 255; i > 0; i -- ) { const j = Math.floor( rnd() * ( i + 1 ) ); [ p[ i ], p[ j ] ] = [ p[ j ], p[ i ] ]; }
	const P = p.concat( p );
	const fade = ( t ) => t * t * t * ( t * ( t * 6 - 15 ) + 10 );
	const grad = ( h, x, y, z ) => { const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ( h & 1 ? - u : u ) + ( h & 2 ? - v : v ); };
	const lerp = ( a, b, t ) => a + ( b - a ) * t;
	return ( x, y, z ) => {

		const X = Math.floor( x ) & 255, Y = Math.floor( y ) & 255, Z = Math.floor( z ) & 255;
		x -= Math.floor( x ); y -= Math.floor( y ); z -= Math.floor( z );
		const u = fade( x ), v = fade( y ), w = fade( z );
		const A = P[ X ] + Y, AA = P[ A ] + Z, AB = P[ A + 1 ] + Z, B = P[ X + 1 ] + Y, BA = P[ B ] + Z, BB = P[ B + 1 ] + Z;
		const g = ( i, dx, dy, dz ) => grad( P[ i ] & 15, x - dx, y - dy, z - dz );
		return lerp( lerp( lerp( g( AA, 0, 0, 0 ), g( BA, 1, 0, 0 ), u ), lerp( g( AB, 0, 1, 0 ), g( BB, 1, 1, 0 ), u ), v ),
			lerp( lerp( g( AA + 1, 0, 0, 1 ), g( BA + 1, 1, 0, 1 ), u ), lerp( g( AB + 1, 0, 1, 1 ), g( BB + 1, 1, 1, 1 ), u ), v ), w );

	};

}

// R: radius of the dome (m); groove: valley spacing (m), about. k: the
// grid's density (1: about 1 mm between vertices on a 5 cm dome).
function brainGeometry( R, groove, noise, k ) {

	const NA = Math.round( 280 * k ), NP = Math.round( 104 * k ), PHI = Math.PI * 0.56, H = 0.62, depth = groove * 0.42;
	const f = 1 / ( R * 0.55 ), bands = R * 0.55 / groove * 2.2; // the noise rises about 25 per meter across the dome
	const pos = [], uvs = [], ridge = [], idx = [], n = new THREE.Vector3(), p = new THREE.Vector3();
	for ( let i = 0; i <= NP; i ++ ) {

		const ph = i / NP * PHI;
		for ( let j = 0; j <= NA; j ++ ) {

			const th = j / NA * 6.283;
			// The squashed dome, its rim turned in under it.
			const tuck = ph > Math.PI / 2 ? ( ph - Math.PI / 2 ) * 0.6 : 0;
			p.set( Math.sin( ph ) * Math.cos( th ) * R * ( 1 - tuck ), Math.cos( ph ) * R * H, Math.sin( ph ) * Math.sin( th ) * R * ( 1 - tuck ) );
			n.set( p.x / R, p.y / ( R * H * H ), p.z / R ).normalize();
			// Contour bands of the noise: valleys at whole numbers.
			const q = noise( p.x * f, p.y * f * 1.6, p.z * f ) + 0.45 * noise( p.x * f * 2.1 + 7, p.y * f * 2.1, p.z * f * 2.1 + 3 );
			const b = q * bands - Math.floor( q * bands );
			const h = Math.pow( 0.5 - 0.5 * Math.cos( 6.283 * b ), 0.7 ), fade = Math.min( 1, ( PHI - ph ) / 0.25 );
			p.addScaledVector( n, ( h - 0.5 ) * depth * fade );
			pos.push( p.x, p.y, p.z );
			uvs.push( Math.cos( th ) * ph * R, Math.sin( th ) * ph * R );
			ridge.push( h * fade + ( 1 - fade ) * 0.5 );

		}

	}

	for ( let i = 0; i < NP; i ++ ) for ( let j = 0; j < NA; j ++ ) { const a = i * ( NA + 1 ) + j, b = a + NA + 1; idx.push( a, a + 1, b, a + 1, b + 1, b ); }
	let g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	g.setAttribute( 'ridge', new THREE.Float32BufferAttribute( ridge, 1 ) );
	g.setIndex( idx );
	g.computeVertexNormals();
	// The seam column and the top point repeat: average their normals.
	const N = g.getAttribute( 'normal' );
	for ( let i = 0; i <= NP; i ++ ) {

		const a = i * ( NA + 1 ), b = a + NA;
		n.set( N.getX( a ) + N.getX( b ), N.getY( a ) + N.getY( b ), N.getZ( a ) + N.getZ( b ) ).normalize();
		N.setXYZ( a, n.x, n.y, n.z ); N.setXYZ( b, n.x, n.y, n.z );

	}

	for ( let j = 0; j <= NA; j ++ ) N.setXYZ( j, 0, 1, 0 );
	g.computeTangents();
	return g;

}

// list: [ { x, z, R, groove } ] (meters).
export function createBrainCorals( { list, floor = () => 0, seed = 51, preset = {} } ) {

	const rnd = rng( seed ), group = new THREE.Group();
	const ix = createMaterial( { family: 'organic', mode: 'coral', intent: 'living brain coral', size_mm: 1.3, cell_um: 90, color: '#a8a060', color2: '#c8b878', color3: '#3a3418',
		color_variation: 0.1, relief: 1, roughness: 0.8, seed: 43, underwater: 1, ...preset }, { coords: uv() } );
	const r = attribute( 'ridge', 'float' ), tint = mix( vec3( 0.42, 0.55, 0.32 ), vec3( 1.2, 1.15, 1.0 ), r.pow( 1.5 ) );
	ix.material.colorNode = ix.material.colorNode.mul( tint );
	const far = wetMaterial( { color: rgb( '#9c9456' ).mul( tint ), roughness: 0.8 } ); // the matter's mean colour
	for ( const c of list ) {

		// Full grid up close, half beyond 45 cm, plain matter beyond 1 m.
		const noise = makeNoise( rnd ), half = brainGeometry( c.R, c.groove ?? 0.007, noise, 0.5 );
		const mesh = lod( [ [ brainGeometry( c.R, c.groove ?? 0.007, noise, 1 ), ix.material, 0 ], [ half, ix.material, 0.45 ], [ half, far, 1.0 ] ] );
		mesh.position.set( c.x, floor( c.x, c.z ) - c.R * 0.08, c.z );
		mesh.rotation.y = rnd() * 6.283;
		group.add( mesh );

	}

	return { group, material: ix, update() {} };

}
