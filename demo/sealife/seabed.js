// What the fixed life of the floor shares: where the sand is, how the
// water moves, and a plain wet material.
//   sandAt    the height of the displaced sand at a point (x, z), on the
//             CPU: the same ripples and mounds as the ground family's
//             sandHeight (src/families/ground/sand.js), so roots and feet
//             sit on the sand, not over a hollow
//   current   the water's push, a TSL vec2 in the floor plane: a steady
//             drift, a surge that rocks back and forth, and gusts that
//             travel across the tank. Every plant reads the same field,
//             so a gust bends a meadow, then the next one.
//   wetMaterial  an opaque node material that gets the underwater light
//             (caustics, colour loss, refraction: core/underwater.js),
//             for matters no Infinitex family covers
//   lod       levels of detail by distance, for the costly matters
//   rng, rgb  a seeded random and a colour as a vec3 node
//
// Event bus: none (pure helpers, no state).

import * as THREE from 'three/webgpu';
import { vec2, vec3, float, sin } from 'three/tsl';
import { ixTime } from '../../src/core/clock.js';
import { applyUnderwater } from '../../src/core/underwater.js';

export const rng = ( seed ) => {

	let k = seed * 7919 + 13;
	return () => ( k = ( k * 16807 ) % 2147483647 ) / 2147483647;

};

export const rgb = ( hex ) => { const c = new THREE.Color( hex ); return vec3( c.r, c.g, c.b ); };

// The hashes of core/hash.js, in JS (float32 on the GPU, float64 here: the
// noise differs by about 1e-3 of its range, a few microns of height).
const fr = ( x ) => x - Math.floor( x );
const wrap = ( i ) => i - 4096 * Math.floor( i / 4096 );
function hash1( x, y ) {

	const a = fr( x * 0.1031 ), b = fr( y * 0.1031 ), c = a;
	const d = a * ( b + 33.33 ) + b * ( c + 33.33 ) + c * ( a + 33.33 );
	return fr( ( a + d + b + d ) * ( c + d ) );

}

function noise( x, y ) {

	const ix = Math.floor( x ), iy = Math.floor( y ), fx = x - ix, fy = y - iy;
	const sx = fx * fx * ( 3 - 2 * fx ), sy = fy * fy * ( 3 - 2 * fy );
	const h = ( i, j ) => hash1( wrap( ix + i ), wrap( iy + j ) );
	const a = h( 0, 0 ) + ( h( 1, 0 ) - h( 0, 0 ) ) * sx, b = h( 0, 1 ) + ( h( 1, 1 ) - h( 0, 1 ) ) * sx;
	return a + ( b - a ) * sy;

}

function fbm( x, y ) {

	let s = 0, a = 0.5;
	for ( let i = 0; i < 3; i ++ ) { s += noise( x, y ) * a; x = x * 2.03 + 5.17; y = y * 2.03 + 5.17; a *= 0.5; }
	return s / ( 1 - a * 2 );

}

// sand: the floor's ground preset ({ ripple_mm, ripple, dune, seed });
// null for a flat floor. The floor plane is w by d, centred, its UVs in
// meters from its corner at ( - w / 2, + d / 2 ).
export function sandAt( sand, w, d ) {

	if ( ! sand ) return () => 0;
	const L = sand.ripple_mm * 1e-3, amp = ( sand.ripple ?? 0.6 ) * 0.1, seed = sand.seed ?? 1, dune = sand.dune ?? 0;
	return ( x, z ) => {

		const px = x + w / 2, py = d / 2 - z;
		const warp = ( fbm( px / ( L * 2.5 ) + seed, py / ( L * 2.5 ) + seed ) - 0.5 ) * 1.6;
		const t = fr( py / L + warp + px / ( L * 7 ) );
		const u = t <= 0.75 ? t / 0.75 : ( 1 - t ) / 0.25;
		const ripple = u * u * ( 3 - 2 * u ) * amp * L;
		const L4 = L * 4;
		return ripple + fbm( px / L4 + seed + 17.3, py / L4 + seed + 17.3 ) * dune * L4 * 0.09;

	};

}

// The push of the water at world xz (a vec2 node), in units of a plant's
// own length: about 0.2 at rest, up to 0.9 in a gust.
const FLOW = new THREE.Vector2( 0.94, 0.34 ).normalize();
export function current( xz ) {

	const D = vec2( FLOW.x, FLOW.y ), side = vec2( - FLOW.y, FLOW.x );
	const along = xz.dot( D );
	// A gust front 0.7 m long that crosses the tank in about 6 s.
	const gust = sin( along.mul( 9 ).sub( ixTime.mul( 1.25 ) ) ).mul( 0.5 ).add( 0.5 ).pow( 3 );
	// The surge: the swell above rocks the water back and forth.
	const surge = sin( ixTime.mul( 0.75 ).add( along.mul( 3 ) ) );
	const drift = sin( ixTime.mul( 0.43 ).add( xz.y.mul( 7 ) ).add( xz.x.mul( 3 ) ) ).mul( 0.12 );
	return D.mul( gust.mul( 0.6 ).add( surge.mul( 0.22 ) ).add( 0.12 ) ).add( side.mul( drift ) );

}

// Levels of detail: [ [ geometry, material, distance ], ... ], nearest
// first. Far away the Infinitex matters cost the most for the least: their
// cups and granules are under a pixel, and the dense meshes make triangles
// smaller than a pixel, which the GPU shades four times over. So the far
// levels get coarser meshes, then a plain material of the same mean colour.
// Every camera picks its own level: the shadow map, far up, the coarsest.
export function lod( levels ) {

	const l = new THREE.LOD();
	for ( const [ g, m, d ] of levels ) {

		const mesh = new THREE.Mesh( g, m );
		mesh.castShadow = mesh.receiveShadow = true;
		l.addLevel( mesh, d );

	}

	return l;

}

// color: a vec3 node (linear). sss: the light through a thin tissue (a
// blade, a tentacle), 0 for none. Opaque: no blending under the water.
export function wetMaterial( { color, roughness = 0.6, sss = 0, side = THREE.FrontSide } ) {

	const m = sss ? new THREE.MeshSSSNodeMaterial( { side } ) : new THREE.MeshStandardNodeMaterial( { side } );
	const nodes = applyUnderwater( { colorNode: color } );
	m.colorNode = nodes.colorNode;
	m.emissiveNode = nodes.emissiveNode;
	m.vertexNode = nodes.vertexNode;
	m.roughnessNode = float( roughness );
	m.metalnessNode = float( 0 );
	if ( sss ) {

		m.thicknessColorNode = nodes.colorNode.mul( sss );
		m.thicknessDistortionNode = float( 0.25 );
		m.thicknessAmbientNode = float( 0.05 );
		m.thicknessPowerNode = float( 2.5 );
		m.thicknessScaleNode = float( 2.5 );
		m.thicknessAttenuationNode = float( 0.8 );

	}

	return m;

}
