// Cheap TSL hashes and value noise without trig ("hash without sine",
// D. Hoskins). GPU sin() is slow and MaterialX cell noise costs too much
// in loops that run many times per pixel. Exact for ids below about 1e4.

import { vec2, vec3, fract, floor, mix, mod } from 'three/tsl';

// vec2 id -> vec3 in [0, 1).
export function hash3( id ) {

	let p3 = fract( vec3( id.x, id.y, id.x ).mul( vec3( 0.1031, 0.1030, 0.0973 ) ) );
	p3 = p3.add( p3.dot( p3.yxz.add( 33.33 ) ) );
	return fract( p3.xxy.add( p3.yzz ).mul( p3.zyx ) );

}

// vec2 id -> float in [0, 1).
export function hash1( id ) {

	let p3 = fract( vec3( id.x, id.y, id.x ).mul( 0.1031 ) );
	p3 = p3.add( p3.dot( p3.yzx.add( 33.33 ) ) );
	return fract( p3.x.add( p3.y ).mul( p3.z ) );

}

// Lattice ids are hashed modulo 4096 (WRAP). Callers fold big coordinates
// with mod( q, 4096 ) to keep the hashes exact; with a periodic hash that
// fold is seamless, even where q crosses 0 (world-space water centred on
// the origin, rotated grain frames). For ids in [0, 4096) nothing changes.
export const WRAP = 4096;
export const wrapId = ( i ) => mod( i, WRAP );

// Folds a lattice coordinate into one period of the hashes, centred on 0:
// [ -2048, 2048 ). The same lattice as mod( q, 4096 ), so the same pattern,
// but a coordinate just under 0 stays just under 0. mod() sent it to
// 4095.9, where a float32 keeps only about 5e-4 of a cell: every pattern on
// negative coordinates (a lake in world space, a crust frame that runs
// back from a seam) stepped by that much, a sawtooth along the screen rows
// seen from close.
export const wrapCoord = ( q ) => mod( q.add( WRAP / 2 ), WRAP ).sub( WRAP / 2 );

// Smooth value noise in [0, 1): bilinear over a lattice, smoothstep weights.
export function valueNoise( q ) {

	const i = floor( q ), f = fract( q );
	const s = f.mul( f ).mul( f.mul( - 2 ).add( 3 ) );
	const v00 = hash1( wrapId( i ) ), v10 = hash1( wrapId( i.add( vec2( 1, 0 ) ) ) );
	const v01 = hash1( wrapId( i.add( vec2( 0, 1 ) ) ) ), v11 = hash1( wrapId( i.add( vec2( 1, 1 ) ) ) );
	return mix( mix( v00, v10, s.x ), mix( v01, v11, s.x ), s.y );

}
