// The look and the swim of a fish built by code (fishshape.js), in one
// material: the Infinitex fish-scale matter on the body behind the gill
// line, a smooth head, rayed fins, eyes. One draw call per school.
//   colour   the scales matter is near white; a tint multiplies the
//            final colour (the underwater terms are linear in it): a dark
//            back, pale sides, a white belly (countershading), an
//            optional lateral stripe, fin colours with a darker margin.
//   fins     createMaterial's base (src/index.js, mask = 0): darker rays
//            on a paler membrane; opaque (the water surface reads the
//            screen, so no blending), the ragged edge is geometry
//   eyes     a dark pupil, a bright iris ring, a dark rim, glossy
//   swim     in positionNode, after the instance transform: so the side
//            axis of each fish comes per instance (`side`, fishswim.js).
//            A wave runs from the head to the tail (phase per instance,
//            set by the CPU from the distance swum), the body bends
//            into the path's curve, the pectorals scull.
//
// Event bus: none (the school's update() writes the instance attributes).

import * as THREE from 'three/webgpu';
import { attribute, varying, instancedDynamicBufferAttribute, positionLocal, positionGeometry, positionWorld, cameraPosition, normalView, reflectVector, uv, vec3, float, color, sin, exp, mix, step, smoothstep, clamp, fract, min } from 'three/tsl';
import { createMaterial } from '../../src/index.js';
import { waterBody as W } from '../../src/core/underwater.js';

export const FISH_LOOKS = {
	school: { back: '#1f4256', side: '#a7b8be', belly: '#f0f2ec', stripe: '#24323a', stripeY: 0.12, stripeAmt: 0.55, fin: '#8ea69e', finEdge: 0.1, iris: '#e0d49a',
		scale_mm: 1.1, iridescence: 0.7, roughness: 0.2, metal: 0.2, seed: 33, glint: 0.25 },
	silver: { back: '#2f5c66', side: '#e4ecef', belly: '#f6f8f6', stripe: '#f4fbff', stripeY: 0.18, stripeAmt: 0.6, fin: '#b4c6c6', finEdge: 0, iris: '#98a4a4',
		scale_mm: 0.7, iridescence: 0, roughness: 0.18, metal: 0.25, seed: 41, gain: 1.25, lite: true, glint: 0.9 },
	// The water takes red first: the red fish gets a gain, and vivid gives
	// back part of what the path to the eye took (capped), so it stays red
	// from across the tank.
	hero: { back: '#a81204', side: '#ff3a0e', belly: '#ff8a24', stripe: '#ffb050', stripeY: - 0.2, stripeAmt: 0, fin: '#ff4012', finEdge: 0.6, iris: '#f0b828',
		scale_mm: 2.0, iridescence: 0.3, roughness: 0.22, metal: 0.05, seed: 52, gain: 1.7, vivid: 0.85 },
};

// L: the fish length the geometry was built for; sh: its shape; motion:
// an InstancedInterleavedBuffer of 8 floats per fish, swim then side
// (fishswim.js); pecAmp: how far the pectorals scull (radians).
export function fishMaterial( { L, sh, look, motion, pecAmp = 0.35, preset = {} } ) {

	const k = typeof look === 'string' ? FISH_LOOKS[ look ] : look;
	const F = attribute( 'fish', 'vec4' ), kind = F.x;
	const isEye = step( 1.7, kind ), isFin = step( 0.5, kind ).sub( isEye ), isBody = float( 1 ).sub( step( 0.5, kind ) );
	const s = F.y, yn = F.z;

	// Body: the gill cover's edge bows back at mid height and turns forward
	// above the eye, where it fades: the nape is scaled. Scales behind it.
	const dg = s.sub( float( sh.gill ).add( float( 1 ).sub( yn.mul( yn ) ).mul( 0.04 ) ).sub( smoothstep( 0.3, 0.85, yn ).mul( sh.gill * 0.55 ) ) );
	const scaleMask = isBody.mul( smoothstep( 0.0, 0.02, dg ) );
	const opLine = float( 1 ).sub( smoothstep( 0.002, 0.008, dg.abs() ) ).mul( float( 1 ).sub( smoothstep( 0.4, 0.7, yn ) ) );
	const mouth = float( 1 ).sub( smoothstep( 0.04, 0.06, s ) ).mul( float( 1 ).sub( smoothstep( 0.04, 0.1, yn.add( 0.08 ).abs() ) ) );
	const head = float( 0.74 ).sub( opLine.mul( 0.3 ) ).sub( mouth.mul( 0.5 ) );
	// Fins: rays along them, the membrane thinner between.
	const rr = fract( F.y ), dr = min( rr, float( 1 ).sub( rr ) );
	const ray = float( 1 ).sub( smoothstep( 0.06, 0.2, dr ) );
	const finBase = mix( float( 1 ), float( 0.7 ), ray );
	// Eyes: a big pupil, a thin iris ring brighter at its outer side, a rim.
	const er = F.y;
	const pupil = float( 1 ).sub( smoothstep( 0.52, 0.57, er ) ), iris = smoothstep( 0.52, 0.57, er ).mul( float( 1 ).sub( smoothstep( 0.78, 0.86, er ) ) );
	const eyeCol = mix( mix( vec3( 0.18 ), color( k.iris ).mul( er.sub( 0.5 ).mul( 2.2 ).add( 0.35 ) ), iris ), vec3( 0.006 ), pupil );
	const baseColor = eyeCol.mul( isEye ).add( vec3( finBase ).mul( isFin ) ).add( vec3( head ).mul( isBody ) );
	const baseRough = isEye.mul( 0.05 ).add( isFin.mul( 0.42 ) ).add( isBody.mul( 0.3 ) );

	const ix = createMaterial( { family: 'scales', mode: 'overlap', scale_mm: k.scale_mm, aspect: 1.1, size_variation: 0.1, depth: 0.5, iridescence: k.iridescence, iridescence_nm: [ 300, 700 ], ridge_um: 8,
		color: '#f4f6f6', groove_color: '#7c8488', color_variation: 0.08, roughness: k.roughness, wetness: 0.5, seed: k.seed, underwater: 1, micro: 0, ...preset },
	{ coords: uv(), base: { color: baseColor, normal: normalView, roughness: baseRough, metalness: float( 0 ) }, mask: scaleMask } );
	const m = ix.material;

	// Per fish: the swim (fishswim.js) and a brightness, side.w.
	// setInstanced: three r187 drops the flag for a vec4 read from a buffer.
	const sw = instancedDynamicBufferAttribute( motion, 'vec4', 8, 0 ).setInstanced( true ), sd = instancedDynamicBufferAttribute( motion, 'vec4', 8, 4 ).setInstanced( true );
	const sdw = sd.w;

	// Countershading and stripe on the body, fin colour, nothing on the eyes.
	const counter = mix( mix( color( k.belly ), color( k.side ), smoothstep( - 0.7, - 0.15, yn ) ), color( k.back ), smoothstep( 0.2, 0.7, yn ) );
	const stripe = float( 1 ).sub( smoothstep( 0.03, 0.08, yn.sub( k.stripeY ).abs() ) ).mul( smoothstep( 0.22, 0.32, s ) ).mul( k.stripeAmt );
	const bodyTint = mix( counter, color( k.stripe ), stripe );
	const r = F.z;
	const finTint = color( k.fin ).mul( float( 1 ).sub( smoothstep( 0.72, 1.0, r ).mul( k.finEdge ) ) );
	// The eye's path in the water, as core/underwater.js counts it.
	const V = positionWorld.sub( cameraPosition ), depth = W.level.sub( positionWorld.y ).max( 0 );
	const path = mix( depth.div( V.normalize().y.abs().max( 0.08 ) ), V.length(), step( cameraPosition.y, W.level ) ).mul( W.depthScale );
	let gain = vec3( float( k.gain ?? 1 ).mul( varying( sdw ) ) );
	if ( k.vivid ) gain = gain.mul( exp( W.absorb.mul( path ).mul( k.vivid ) ).min( vec3( 4 ) ) );
	m.colorNode = m.colorNode.mul( bodyTint.mul( isBody ).add( finTint.mul( isFin ) ).mul( gain ).add( vec3( isEye ) ) );
	// Shiny guanine sides: part mirror where the scales are. Glint: those
	// mirrors catch the bright window of the surface above (Snell's window,
	// about 48 degrees around the vertical) when the reflected view ray
	// points into it: a fish that rolls in a turn flashes.
	m.metalnessNode = m.metalnessNode.add( scaleMask.mul( k.metal ) );
	// Below the window the surface still mirrors the lit tank (total internal
	// reflection), dimmer. The glint fades along the eye's path like the rest.
	if ( k.glint ) {

		const sky = smoothstep( 0.25, 0.8, reflectVector.y ).mul( scaleMask ).mul( k.glint );
		m.emissiveNode = m.emissiveNode.add( color( '#dff4ff' ).mul( sky ).mul( exp( W.absorb.add( W.turbidity ).mul( path ).negate() ) ) );

	}

	// FrontSide, no alpha: the fins are two-sided and ragged in the
	// geometry (fishfins.js). A discard (alphaTest) and DoubleSide cost
	// several times more: no early depth test, every back face shaded.
	m.side = THREE.FrontSide;
	// No cloth sheen on a fish. lite (many small fish): no thin film and no
	// clearcoat layer either, both are lobes evaluated per pixel.
	m.sheenNode = null;
	if ( k.lite ) { m.iridescenceNode = null; m.clearcoatNode = null; }

	// The swim, in mesh space: lateral offsets along each fish's side axis.
	const pg = positionGeometry;
	const a = clamp( float( 0.4 * L ).sub( pg.x ).div( L ), 0, 1.1 );
	const wave = sin( a.mul( Math.PI * 1.9 ).sub( sw.x ) ).mul( a.mul( a ).mul( 0.92 ).add( 0.05 ) ).mul( sw.z ).mul( L * 0.1 );
	const dx = pg.x.sub( 0.05 * L );
	const flap = F.w.mul( sin( sw.w ) ).mul( pecAmp );
	m.positionNode = positionLocal.add( sd.xyz.mul( wave.add( dx.mul( dx ).mul( sw.y ) ).add( flap ) ) );
	return ix;

}
