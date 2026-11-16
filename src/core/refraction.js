// Refraction at a flat water interface, for matter under water (or above
// it, seen from below). Each vertex is drawn where the eye sees it, not
// where it is: the ray from the eye bends where it crosses the interface
// (Snell, n = 1.33), so the eye sees the point along the first leg of that
// broken ray. Only the screen position moves (material.vertexNode): the
// light, the caustics and the shadows keep the true position.
//
// What it gives: the pool floor seen from above looks shallower (3/4 of
// its depth face on, much less at grazing), a post standing in the water
// breaks at the surface, and through a pane or a camera port everything
// under water looks a third closer and larger.
//
// The interface is a plane: normal (unit, toward the eye) . X = offset.
//   surface  the water level, eye above or below it
//   pane     an aquarium wall, the eye in the air outside
//   port     a camera housing, the eye in the air behind it
// The app (or core/waterline.js, per pass) sets it before a render. Only
// the camera at `eye` is bent: mirrors and shadow maps draw from other
// points, so they see the true positions.
//
// Exact for a flat interface. The ripples are not in it: the water
// surface still pushes what is under it by their slope (core/watersurface.js).
// Vertices move, the triangles between them stay straight: a mesh needs
// segments of about 2 cm, or its edges will not bend.

import { Vector3 } from 'three';
import { uniform, vec4, float, step, mix, sqrt, positionLocal, modelWorldMatrix, cameraPosition, cameraProjectionMatrix, cameraViewMatrix } from 'three/tsl';

export const N_WATER = 1.33;
const STEPS = 18; // bisection: the crossing to r / 2^18

export const refraction = {
	on: uniform( 0 ),
	eye: uniform( new Vector3() ),
	normal: uniform( new Vector3( 0, 1, 0 ) ), // toward the eye
	offset: uniform( 0 ),
	eta: uniform( 1 / N_WATER ), // n on the eye's side / n on the far side
	plate: uniform( 0 ), // a glass plate on the plane (m): how much nearer it brings what is behind it, t ( 1 - 1 / n )
	strength: uniform( 1 ), // 0: the true positions (tests, comparisons)
};

const R = refraction;

// The still water surface at `level`, the eye on either side.
export function refractSurface( eye, level ) {

	const up = eye.y >= level ? 1 : - 1;
	R.plate.value = 0;
	R.on.value = 1;
	R.eye.value.copy( eye );
	R.normal.value.set( 0, up, 0 );
	R.offset.value = up * level;
	R.eta.value = up > 0 ? 1 / N_WATER : N_WATER;

}

// A pane or a port: the plane through `point` with `normal` toward the
// eye, the eye in the air, the water beyond. Every point beyond is bent,
// also those above the level: their rays cross the plane into the water
// first, then the surface (that second bend is not modelled). Bending
// only the wet ones put the dry marble inside the magnified water.
// plate: { thickness (m), ior } of a pane of glass standing on the plane,
// on the eye's side. Parallel faces do not turn the ray, they shift it:
// to the eye the glass is a layer of air thickness / ior deep, so all that
// is behind comes nearer by thickness ( 1 - 1 / ior ) (2.7 mm for 8 mm of
// ordinary glass). Exact near the normal, a little short at grazing angles.
export function refractPlane( eye, point, normal, plate = null ) {

	R.plate.value = plate ? plate.thickness * ( 1 - 1 / plate.ior ) : 0;
	R.on.value = 1;
	R.eye.value.copy( eye );
	R.normal.value.copy( normal ).normalize();
	R.offset.value = R.normal.value.dot( point );
	R.eta.value = 1 / N_WATER;

}

export function refractOff() {

	R.on.value = 0;

}

// Where the eye sees world point P (JS, same math as the shader): for the
// tests. Returns P itself when it is on the eye's side.
export function apparentPoint( E, P, normal, offset, eta ) {

	const a = Math.max( normal.dot( E ) - offset, 1e-6 ), b = offset - normal.dot( P );
	if ( b <= 0 ) return P.clone();
	const D = P.clone().sub( E ), tv = D.clone().addScaledVector( normal, - D.dot( normal ) );
	const r = tv.length(), u = tv.clone().divideScalar( Math.max( r, 1e-9 ) ), k = 1 / eta;
	let lo = 0, hi = r;
	for ( let i = 0; i < STEPS; i ++ ) {

		const m = ( lo + hi ) / 2;
		const f = m / Math.hypot( m, a ) - k * ( r - m ) / Math.hypot( r - m, Math.max( b, 1e-6 ) );
		if ( f >= 0 ) hi = m; else lo = m;

	}

	const S = E.clone().addScaledVector( normal, - a ).addScaledVector( u, ( lo + hi ) / 2 );
	const ES = S.clone().sub( E ), l = ES.length();
	return E.clone().addScaledVector( ES.divideScalar( l ), l + P.distanceTo( S ) * eta );

}

// Where the eye sees the world point P (a vec3 node): P itself when the
// refraction is off, or for another eye. For a mesh that places its own
// vertices (billboards, core/bubbles.js).
export function refractedPoint( P ) {

	// Through a plate the eye stands nearer the plane by R.plate; what it
	// sees from there is then moved back by as much.
	const N = R.normal, E = R.eye.sub( N.mul( R.plate ) );
	const a = N.dot( E ).sub( R.offset ).max( 1e-6 ); // eye above the plane
	const b = R.offset.sub( N.dot( P ) ); // point beyond it (> 0)
	const bb = b.max( 1e-6 );
	const D = P.sub( E );
	const tv = D.sub( N.mul( D.dot( N ) ) );
	const r = tv.length();
	const u = tv.div( r.max( 1e-9 ) );
	const k = float( 1 ).div( R.eta );
	// The crossing S, at s along the plane from the eye's foot: the root of
	// sin(i) - k sin(t), which rises from s = 0 to s = r.
	let lo = float( 0 ), hi = r;
	for ( let i = 0; i < STEPS; i ++ ) {

		const m = lo.add( hi ).mul( 0.5 );
		const f = m.div( sqrt( m.mul( m ).add( a.mul( a ) ) ) ).sub( k.mul( r.sub( m ) ).div( sqrt( r.sub( m ).mul( r.sub( m ) ).add( bb.mul( bb ) ) ) ) );
		const c = step( 0, f );
		hi = mix( hi, m, c );
		lo = mix( m, lo, c );

	}

	const S = E.sub( N.mul( a ) ).add( u.mul( lo.add( hi ).mul( 0.5 ) ) );
	const ES = S.sub( E );
	const l = ES.length();
	// Along the first leg, as far as the optical path: in water seen from
	// the air, the depth shrinks by 1 / 1.33.
	const A = E.add( ES.div( l.max( 1e-9 ) ).mul( l.add( P.sub( S ).length().mul( R.eta ) ) ) ).add( N.mul( R.plate ) );
	const gate = R.on.mul( R.strength )
		.mul( step( 0, b ) )
		.mul( step( cameraPosition.sub( R.eye ).length(), 1e-4 ) ); // this eye only
	return mix( P, A, gate );

}

// Clip-space position for material.vertexNode.
export function refractedVertex() {

	const P = modelWorldMatrix.mul( vec4( positionLocal, 1 ) ).xyz;
	return cameraProjectionMatrix.mul( cameraViewMatrix.mul( vec4( refractedPoint( P ), 1 ) ) );

}
