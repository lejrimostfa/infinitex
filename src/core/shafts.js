// Light shafts in a body of water: the sunlight that the rippled surface
// focuses is seen on its way down, lit by what floats in the water, before
// it draws the caustic net on the floor. A screen pass, after the scene:
//   ray      each pixel's view ray is cut to the part that lies inside the
//            water box and in front of the scene (its depth buffer)
//   march    a few steps along that part. At each one the sun ray is
//            followed up to the surface (refracted, as core/underwater.js
//            does for a matter) and the caustic light there is read
//            (core/caustics.js): the same waves, so a shaft ends on its
//            own bright line on the sand
//   light    only what exceeds the mean light counts (the mean is already
//            in each matter's inscatter glow), dimmed by the water above
//            the step and by the water between the step and the eye
// Drawn at half size (soft by nature) into `rt`, which the page adds to
// its frame. Not done: shadows of the objects in the shafts (a cube does
// not cut a dark column in them).
//
// box: { min: [ x, y, z ], max: [ x, y, z ] } of the water, world meters;
// max y is the still level. steps: 8. waves: 5 of the surface's longest
// (the fine ones do not survive the scattering).

import { RenderTarget, HalfFloatType, QuadMesh, NodeMaterial, Matrix4, Vector2, Vector3 } from 'three/webgpu';
import { vec2, vec3, vec4, float, uniform, texture, uv, exp, smoothstep, getViewPosition, interleavedGradientNoise, screenCoordinate } from 'three/tsl';
import { waterBody, hazeColor } from './underwater.js';
import { reliefLight } from './relief.js';
import { ixTime } from './clock.js';
import { causticLight } from './caustics.js';
import { waveField } from '../families/liquid/waves.js';

const GAIN = 5;

export function createShafts( renderer, camera, { box, steps = 8, waves = 5 }, W = waterBody ) {

	const rt = new RenderTarget( 1, 1, { type: HalfFloatType, depthBuffer: false } );
	const depth = texture( rt.texture ); // .value is set to the scene depth at each render
	const projInv = uniform( new Matrix4() ), camWorld = uniform( new Matrix4() ), camPos = uniform( new Vector3() );
	const bmin = uniform( new Vector3( ...box.min ) ), bmax = uniform( new Vector3( ...box.max ) );

	const s = uv();
	const world = camWorld.mul( vec4( getViewPosition( s, depth.sample( s ).r, projInv ), 1 ) ).xyz;
	const V = world.sub( camPos );
	const dist = V.length();
	const dir = V.div( dist );
	// The ray against the box (slabs).
	const inv = vec3( 1 ).div( dir.add( vec3( 1e-6 ) ) );
	const a = bmin.sub( camPos ).mul( inv ), b = bmax.sub( camPos ).mul( inv );
	const lo = a.min( b ), hi = a.max( b );
	const tn = lo.x.max( lo.y ).max( lo.z ).max( 0 );
	const tf = hi.x.min( hi.y ).min( hi.z ).min( dist );
	const len = tf.sub( tn ).max( 0 );

	// The sun ray in the water (n = 1.33), as in core/underwater.js.
	const L = reliefLight.normalize();
	const lt = vec2( L.x, L.z ).div( 1.33 );
	const ly = float( 1 ).sub( lt.dot( lt ) ).max( 0.05 ).sqrt();
	const sigma = W.absorb.add( W.turbidity ).dot( vec3( 1 / 3 ) );
	const t = ixTime.mul( W.speed );
	// The jitter moves every 60th of a second: what the nine taps leave of
	// it is then a fine grain in time, not a fixed hatch on the picture.
	const jitter = interleavedGradientNoise( screenCoordinate.add( ixTime.mul( 60 ).floor().mod( 64 ).mul( 5.588238 ) ) );
	let acc = float( 0 );
	for ( let i = 0; i < steps; i ++ ) {

		const ts = tn.add( len.mul( jitter.add( i ).div( steps ) ) );
		const P = camPos.add( dir.mul( ts ) );
		const d = W.level.sub( P.y ).max( 0 );
		const Q = vec2( P.x, P.z ).add( lt.mul( d.div( ly ) ) );
		const D = d.mul( W.depthScale );
		const wf = waveField( Q.mul( W.depthScale ), float( 0.02 ), {
			lmax: W.sizeM, lmin: W.sizeM.mul( 0.35 ), angle: W.angle, steep: W.amount.mul( 0.14 ), t, rate: W.speed, seed: W.seed, count: waves, spreadDeg: 180,
		} );
		const streak = causticLight( wf.hess, D, { blur: 0.2, peak: 5 } ).sub( W.shaftCut ).max( 0 );
		// Not against the lens: a beam the eye stands in would veil the frame.
		acc = acc.add( streak.mul( exp( sigma.negate().mul( D.div( ly ) ) ) ).mul( exp( sigma.negate().mul( ts.sub( tn ).mul( W.depthScale ) ) ) ).mul( smoothstep( 0.02, 0.14, ts ) ) );

	}

	const mat = new NodeMaterial();
	// GAIN: the share of the focused light that the water scatters to the eye,
	// set by eye so that shafts = 1 reads as clear water on a sunny day.
	// Its colour is the water's light in that direction (hazeColor): a
	// shaft towards the sun is brighter and warmer, as the haze behind it.
	mat.fragmentNode = vec4( hazeColor( dir, W ).mul( acc ).mul( len.mul( W.depthScale ).div( steps ) ).mul( W.shafts ).mul( GAIN ), 1 );
	const quad = new QuadMesh( mat );

	// The page reads the shafts with sixteen taps, one texel apart (a box of
	// four by four). The dither of the jittered steps is strongest from one
	// texel to the next: neighbours one texel apart cancel it wherever the
	// tap falls. Taps two texels apart all read the same phase of it and
	// left a comb at depth edges; five taps on a cross left a hatch.
	const texel = uniform( new Vector2( 1, 1 ) );
	const tex = texture( rt.texture );
	const sample = ( p ) => {

		let sum = vec3( 0 );
		for ( let j = 0; j < 4; j ++ ) for ( let i = 0; i < 4; i ++ ) sum = sum.add( tex.sample( p.add( texel.mul( vec2( i - 1.5, j - 1.5 ) ) ) ).rgb );
		return sum.div( 16 );

	};

	return {
		rt, sample,
		// sceneDepth: the depth texture of the frame the shafts go over.
		render( sceneDepth ) {

			const w = Math.max( 1, sceneDepth.image.width >> 1 ), h = Math.max( 1, sceneDepth.image.height >> 1 );
			if ( rt.width !== w || rt.height !== h ) { rt.setSize( w, h ); texel.value.set( 1 / w, 1 / h ); }
			depth.value = sceneDepth;
			camera.updateMatrixWorld();
			projInv.value.copy( camera.projectionMatrixInverse );
			camWorld.value.copy( camera.matrixWorld );
			camPos.value.copy( camera.position );
			renderer.setRenderTarget( rt );
			quad.render( renderer );
			renderer.setRenderTarget( null );

		},
	};

}
