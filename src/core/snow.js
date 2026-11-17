// Marine snow: the specks that float in a body of water (plankton, bits
// of plants, dust). They hardly move, and they are what the eye reads the
// water's depth and its light with: a near one is a large soft disc, a far
// one a point, and each lights up as it drifts through a shaft of sun.
// One mesh of small quads that face the camera.
//   drift    each speck sinks slowly and sways; it starts again at the
//            top when it reaches the floor
//   light    the water's light in the eye's direction (hazeColor of
//            core/underwater.js), dimmed by the water above the speck and
//            between it and the eye, with a slow twinkle
//   near     closer than `near`, a speck grows and fades: out of focus
// Added, not blended: a speck only adds light, and needs no sorting. It
// writes no depth, so the depth effects (AO, depth of field) ignore it.
// The quads are placed in the vertex stage, so the mesh is never culled
// and is skipped by the focus and walk rays (userData.noFocus).
//
// box: { min, max } of the water (max y: the level). count: specks.
// radius: [ min, max ] in meters. sink: m/s. near: m.
//
// Event bus: none (driven by the clock, core/clock.js).

import { BufferGeometry, BufferAttribute, Mesh, MeshBasicNodeMaterial, AdditiveBlending } from 'three/webgpu';
import { attribute, varying, vec2, vec3, vec4, float, uv, fract, sin, cos, exp, mix, smoothstep, length, cameraProjectionMatrix, cameraViewMatrix, cameraPosition } from 'three/tsl';
import { refractedPoint } from './refraction.js';
import { ixTime } from './clock.js';
import { waterBody, hazeColor } from './underwater.js';

export function createSnow( { box, count = 500, radius = [ 0.0003, 0.0011 ], sink = 0.0025, near = 0.08, seed = 5 }, W = waterBody ) {

	let k = seed * 9301 + 49297;
	const rnd = () => ( k = ( k * 233280 + 49297 ) % 2147483647 ) / 2147483647;
	const [ x0, y0, z0 ] = box.min, [ x1, y1, z1 ] = box.max;

	// Four vertices per speck. a: x, z, phase along the fall, size 0..1.
	// b: sway phase, sway direction, twinkle phase, brightness 0..1.
	const pos = new Float32Array( count * 12 ), uvs = new Float32Array( count * 8 ), a = new Float32Array( count * 16 ), b = new Float32Array( count * 16 ), index = [];
	for ( let i = 0; i < count; i ++ ) {

		const size = rnd();
		const A = [ x0 + ( x1 - x0 ) * rnd(), z0 + ( z1 - z0 ) * rnd(), rnd(), size * size ], B = [ rnd() * 6.283, rnd() * 6.283, rnd() * 6.283, rnd() ]; // most specks are small
		[ [ 0, 0 ], [ 1, 0 ], [ 1, 1 ], [ 0, 1 ] ].forEach( ( c, j ) => { uvs.set( c, ( i * 4 + j ) * 2 ); a.set( A, ( i * 4 + j ) * 4 ); b.set( B, ( i * 4 + j ) * 4 ); } );
		index.push( i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3 );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new BufferAttribute( uvs, 2 ) );
	g.setAttribute( 'snowA', new BufferAttribute( a, 4 ) );
	g.setAttribute( 'snowB', new BufferAttribute( b, 4 ) );
	g.setIndex( index );

	const A = attribute( 'snowA', 'vec4' ), B = attribute( 'snowB', 'vec4' );
	const H = y1 - y0 - 0.002;
	const r = mix( float( radius[ 0 ] ), float( radius[ 1 ] ), A.w );
	const fall = fract( A.z.add( ixTime.mul( sink / H ).mul( A.w.mul( 0.8 ).add( 0.6 ) ) ) ); // 0 under the surface, 1 at the floor
	const sway = vec2( cos( B.y ), sin( B.y ) ).mul( sin( ixTime.mul( 0.35 ).add( B.x ) ) ).mul( 0.012 );
	const centre = vec3( A.x.add( sway.x ), float( y1 - 0.001 ).sub( fall.mul( H ) ), A.y.add( sway.y ) );
	const corner = uv().mul( 2 ).sub( 1 );
	const toEye = cameraPosition.sub( centre );
	const dist = toEye.length();
	// Out of focus near the eye: up to four times wider, and as much dimmer.
	const blur = smoothstep( near, near * 0.25, dist );
	const size = r.mul( blur.mul( 3 ).add( 1 ) );
	const view = cameraViewMatrix.mul( vec4( refractedPoint( centre ), 1 ) ).add( vec4( corner.mul( size ), 0, 0 ) );

	// The light of a speck, once per vertex: the water's light where the eye
	// looks, less what the water takes above it and on the way to the eye.
	const sigma = W.absorb.add( W.turbidity );
	const water = float( y1 ).sub( centre.y ).max( 0 ).add( dist ).mul( W.depthScale );
	const twinkle = sin( ixTime.mul( 0.9 ).add( B.z ) ).mul( 0.35 ).add( 0.65 );
	const edge = smoothstep( 0, 0.06, fall ).mul( smoothstep( 1, 0.94, fall ) ); // no pop at the wrap
	const light = varying( hazeColor( toEye.normalize().negate(), W ).add( W.sunTint.mul( 0.5 ) ).mul( exp( sigma.negate().mul( water ) ) ).mul( twinkle ).mul( edge ).mul( B.w.mul( 0.7 ).add( 0.3 ) ).mul( blur.mul( - 0.8 ).add( 1 ) ) );

	const m = new MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: AdditiveBlending } );
	m.vertexNode = cameraProjectionMatrix.mul( view );
	const d = length( corner );
	const disc = smoothstep( 1, 0.2, d );
	m.colorNode = light.mul( disc ).mul( W.snow );
	m.opacityNode = float( 1 );

	const mesh = new Mesh( g, m );
	mesh.frustumCulled = false;
	mesh.userData.noFocus = true;
	mesh.renderOrder = 15; // after the water's surface, which reads the screen
	return mesh;

}
