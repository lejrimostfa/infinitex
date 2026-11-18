// The beach's ground (demo/beach.js): one height field, in JS for the mesh
// and the camera, in TSL for the water (foam where the sand comes near the
// surface). Metres, y up, the sea toward +z, the shore along x.
//   shore    a winding line: z = shoreZ( x )
//   land     the beach rises gently from the line (1 in 16), then a berm
//            at about 1.6 m, then flat ground inland
//   lagoon   the floor goes down to about 2.5 m (1 in 4 at the line, so
//            the foam stays a narrow band), with low mounds
//   reef     a crest about 80 m out, 0.35 m under the surface, where the
//            swell breaks; beyond it the floor drops to 25 m
// The two versions must stay the same formula: edit both.
//
// Event bus: none (built once by the page).

import * as THREE from 'three/webgpu';
import { grid } from './ocean.js';
import { vec3, float, sin, exp, mix, step, smoothstep as sstep, min as tmin, max as tmax } from 'three/tsl';

export const REEF = 80; // m from the shore line to the reef crest
export const BOX = { x: [ - 320, 320 ], z: [ - 70, 190 ] }; // the ground mesh (wide: the bay must not end in view)

const ss = ( a, b, x ) => { const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) ); return t * t * ( 3 - 2 * t ); };

export function shoreZ( x ) {

	return 6 * Math.sin( x / 40 ) + 3 * Math.sin( x / 13 + 1 );

}

// JS height (m) at world x, z.
export function sandHeight( x, z ) {

	const d = z - shoreZ( x ); // < 0 on land, > 0 at sea
	const land = Math.min( - d / 16, 1.6 ) + 0.15 * Math.sin( x / 9 ) * ss( 30, 60, - d );
	const lagoon = - 2.5 * ( 1 - Math.exp( - Math.max( d, 0 ) / 9 ) ) + 0.4 * Math.sin( x / 11 + z / 7 ) * ss( 20, 40, d );
	const reef = 2.15 * ss( REEF - 18, REEF, d ) * ( 1 - ss( REEF, REEF + 8, d ) ) + 0.12 * Math.sin( x / 3.1 ) * ss( REEF - 10, REEF, d );
	const drop = - 22.5 * ss( REEF + 4, REEF + 40, d );
	return d < 0 ? land : lagoon + reef + drop;

}

// The same in TSL. xz: vec2 node of world x, z.
export function sandHeightNode( xz ) {

	const x = xz.x, z = xz.y;
	const d = z.sub( sin( x.div( 40 ) ).mul( 6 ).add( sin( x.div( 13 ).add( 1 ) ).mul( 3 ) ) );
	const land = tmin( d.negate().div( 16 ), float( 1.6 ) ).add( sin( x.div( 9 ) ).mul( 0.15 ).mul( sstep( 30, 60, d.negate() ) ) );
	const lagoon = float( 1 ).sub( exp( tmax( d, 0 ).div( - 9 ) ) ).mul( - 2.5 ).add( sin( x.div( 11 ).add( z.div( 7 ) ) ).mul( 0.4 ).mul( sstep( 20, 40, d ) ) );
	const reef = sstep( REEF - 18, REEF, d ).mul( float( 1 ).sub( sstep( REEF, REEF + 8, d ) ) ).mul( 2.15 ).add( sin( x.div( 3.1 ) ).mul( 0.12 ).mul( sstep( REEF - 10, REEF, d ) ) );
	const drop = sstep( REEF + 4, REEF + 40, d ).mul( - 22.5 );
	const sea = lagoon.add( reef ).add( drop );
	return mix( sea, land, step( d, 0 ) ); // land where d <= 0

}

// The ground mesh: a grid, finer near the shore line where the eye is.
// UVs in metres (the Infinitex matter reads them as coordinates).
export function groundGeometry( step = 1 ) {

	const [ x0, x1 ] = BOX.x, [ z0, z1 ] = BOX.z;
	const nx = Math.round( ( x1 - x0 ) / step ), nz = Math.round( ( z1 - z0 ) / step );
	const g = new THREE.PlaneGeometry( x1 - x0, z1 - z0, nx, nz );
	g.rotateX( - Math.PI / 2 ); // y up; plane z runs from z1 (v = 0) to z0
	g.translate( ( x0 + x1 ) / 2, 0, ( z0 + z1 ) / 2 );
	const P = g.attributes.position, U = g.attributes.uv;
	for ( let i = 0; i < P.count; i ++ ) {

		const x = P.getX( i ), z = P.getZ( i );
		P.setY( i, sandHeight( x, z ) );
		U.setXY( i, x, - z );

	}

	g.computeVertexNormals();
	g.computeTangents();
	return g;

}

// The deep floor out to the horizon, 0.5 m under the ground mesh's deepest
// edge: without it the far sea had nothing under it and showed the sky's
// ground colour, a lighter band past the fine water patch. A plain lit
// matter under water (core/underwater.js): it is only seen through 25 m of
// water, an Infinitex sand would cost for nothing.
export function deepFloor( applyUnderwater ) {

	// 40 m quads, the ground mesh cut out: refraction moves the vertices
	// (core/refraction.js), and two huge triangles bent at their corners
	// rose in front of the lagoon.
	const g = grid( - 3000, 3000, - 3000, 3000, 40, { x: [ BOX.x[ 0 ] + 40, BOX.x[ 1 ] - 40 ], z: [ BOX.z[ 0 ] + 40, BOX.z[ 1 ] - 40 ] } );
	const m = new THREE.MeshStandardNodeMaterial( { roughness: 1 } );
	const nodes = applyUnderwater( { colorNode: vec3( 0.75, 0.66, 0.5 ) } );
	m.colorNode = nodes.colorNode;
	m.emissiveNode = nodes.emissiveNode;
	m.vertexNode = nodes.vertexNode;
	const mesh = new THREE.Mesh( g, m );
	mesh.position.y = - 25.5;
	return mesh;

}
