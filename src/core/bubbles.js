// Air bubbles rising in a body of water, as one mesh. A bubble under water
// is seen by its rim: light inside the water hits the air at a grazing
// angle there and is reflected whole, so the edge is a bright ring and the
// middle shows what is behind. Each bubble is a small quad that faces the
// camera, cut to that ring plus the glint of the sun.
//   sources   a few points on the floor; each sends a string of bubbles
//   rise      faster for a larger bubble (speed grows as the square root
//             of the radius), with a side wobble, a wider string higher up
//   pop       a bubble ends 1 mm under the surface and starts again below
// Opaque and alpha-tested, not blended: a water surface that reads the
// screen (core/watersurface.js) then shows them through it, refracted.
// The quads are placed in the vertex stage, so the mesh is never culled
// and is skipped by the focus and walk rays (userData.noFocus).
//
// box: { min, max } of the water (max y: the level). count: bubbles.
// radius: [ min, max ] in meters. sources: [ [ x, z ], ... ] or a number
// of random ones.

import { BufferGeometry, BufferAttribute, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, vec2, vec3, vec4, float, uv, fract, sin, cos, sqrt, mix, smoothstep, length, cameraProjectionMatrix, cameraViewMatrix } from 'three/tsl';
import { refractedPoint } from './refraction.js';
import { ixTime } from './clock.js';

export function createBubbles( { box, count = 120, radius = [ 0.0008, 0.0026 ], sources = 3, speed = 0.12, seed = 1 } ) {

	let k = seed * 9301 + 49297;
	const rnd = () => ( k = ( k * 233280 + 49297 ) % 2147483647 ) / 2147483647;
	const [ x0, y0, z0 ] = box.min, [ x1, y1, z1 ] = box.max;
	const src = Array.isArray( sources ) ? sources : Array.from( { length: sources }, () => [ x0 + ( x1 - x0 ) * ( 0.15 + 0.7 * rnd() ), z0 + ( z1 - z0 ) * ( 0.15 + 0.7 * rnd() ) ] );

	// Four vertices per bubble. a: source x, z, phase along the rise, size 0..1.
	// b: wobble phase, spread direction, spread amount, unused.
	const pos = new Float32Array( count * 12 ), uvs = new Float32Array( count * 8 ), a = new Float32Array( count * 16 ), b = new Float32Array( count * 16 ), index = [];
	for ( let i = 0; i < count; i ++ ) {

		const s = src[ i % src.length ], A = [ s[ 0 ], s[ 1 ], rnd(), rnd() ], B = [ rnd() * 6.283, rnd() * 6.283, rnd(), 0 ];
		[ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ].forEach( ( c, j ) => { uvs.set( c, ( i * 4 + j ) * 2 ); a.set( A, ( i * 4 + j ) * 4 ); b.set( B, ( i * 4 + j ) * 4 ); } );
		index.push( i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3 );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new BufferAttribute( uvs, 2 ) );
	g.setAttribute( 'bubbleA', new BufferAttribute( a, 4 ) );
	g.setAttribute( 'bubbleB', new BufferAttribute( b, 4 ) );
	g.setIndex( index );

	const A = attribute( 'bubbleA', 'vec4' ), B = attribute( 'bubbleB', 'vec4' );
	const H = y1 - y0 - 0.001;
	const r = mix( float( radius[ 0 ] ), float( radius[ 1 ] ), A.w );
	const v = sqrt( r.div( radius[ 1 ] ) ).mul( speed ); // m/s
	const up = fract( A.z.add( ixTime.mul( v ).div( H ) ) ); // 0 at the floor, 1 at the pop
	const wob = vec2( sin( ixTime.mul( 5 ).add( B.x ) ), cos( ixTime.mul( 4.3 ).add( B.x.mul( 1.7 ) ) ) ).mul( r.mul( 1.5 ) );
	const spread = vec2( cos( B.y ), sin( B.y ) ).mul( B.z ).mul( up ).mul( 0.03 );
	const centre = vec3( A.x.add( wob.x ).add( spread.x ), up.mul( H ).add( y0 ), A.y.add( wob.y ).add( spread.y ) );
	const corner = uv().mul( 2 ).sub( 1 );
	// Small at birth, full size after the first tenth of the rise.
	const size = r.mul( smoothstep( 0, 0.1, up ).mul( 0.7 ).add( 0.3 ) );
	// Seen through the water like the rest (core/refraction.js): else the
	// floor and the walls, which look nearer, pass in front of the bubbles.
	const view = cameraViewMatrix.mul( vec4( refractedPoint( centre ), 1 ) ).add( vec4( corner.mul( size ), 0, 0 ) );

	const m = new MeshBasicNodeMaterial();
	m.vertexNode = cameraProjectionMatrix.mul( view );
	const d = length( corner );
	const rim = smoothstep( 0.6, 0.74, d ).mul( smoothstep( 1.0, 0.94, d ) );
	const glint = smoothstep( 0.3, 0.12, length( corner.sub( vec2( - 0.3, 0.38 ) ) ) );
	m.opacityNode = rim.max( glint );
	m.alphaTest = 0.5;
	// Brighter towards the top of the ring, where the sky comes from.
	m.colorNode = mix( vec3( 0.55, 0.85, 0.9 ), vec3( 1.6, 1.9, 1.9 ), corner.y.mul( 0.5 ).add( 0.5 ).mul( rim ).add( glint ).min( 1 ) );

	const mesh = new Mesh( g, m );
	mesh.frustumCulled = false;
	mesh.userData.noFocus = true;
	return mesh;

}
