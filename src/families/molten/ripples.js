// Ripples on molten rock: a blob of lava falling back, or a bubble that
// bursts, sends slow rings over the surface. Lava is thick: the rings are
// few, wide and slow, and they die out within a few seconds. Where a crest
// stretches the skin, the hot melt under it shows: the rings glow.
//
// One shared list for every molten material (a scene has one lava): up to
// RIPPLES slots, each vec4( x, y, t0, size ) in the material's surface
// coordinates (metres), t0 on the material clock (core/clock.js times the
// family's speed), size the radius of what fell in (metres, 0 = empty).
// addRipple() writes the oldest slot. A page that never calls it pays for
// a loop of empty slots only (about 16 cheap tests a pixel).
//
// rippleField( p, t, fp ) returns the slope it adds (surface metres) and a
// glow from 0 to 1. Rings under a few pixels fade away (fadeIn of their
// wavelength).
// Event bus: none (the lava effects of a page call addRipple).

import { Vector4 } from 'three';
import { vec2, float, uniformArray, length, sin, cos, exp, smoothstep, step, max } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';

export const RIPPLES = 16;
const slots = Array.from( { length: RIPPLES }, () => new Vector4( 0, 0, - 1e4, 0 ) );
export const lavaRipples = uniformArray( slots, 'vec4' );
let next = 0;

// x, y: surface coordinates; t0: material time; size: metres.
export function addRipple( x, y, t0, size ) {

	slots[ next ].set( x, y, t0, size );
	next = ( next + 1 ) % RIPPLES;

}

export function rippleField( p, t, fp ) {

	let slope = vec2( 0 ), glow = float( 0 );
	for ( let i = 0; i < RIPPLES; i ++ ) {

		const r = lavaRipples.element( i );
		const s = r.w.max( 1e-4 );
		const age = t.sub( r.z ).max( 0 );
		const off = p.sub( r.xy );
		const d = length( off ).max( 1e-5 );
		// Wavelength a few times the size; slow front (viscous), about
		// 0.4 sqrt( wavelength ) metres a second.
		const lam = s.mul( 3 ).add( 0.05 );
		const front = lam.sqrt().mul( 0.4 ).mul( age );
		const k = float( Math.PI * 2 ).div( lam );
		// Behind the front only, three crests, fading in 2.5 s and with distance.
		const env = float( 1 ).sub( smoothstep( front.sub( lam.mul( 0.5 ) ), front, d ) ).mul( smoothstep( front.sub( lam.mul( 3.5 ) ), front.sub( lam.mul( 2 ) ), d ) )
			.mul( exp( age.div( - 2.5 ) ) ).mul( exp( d.div( lam.mul( - 5 ) ) ) ).mul( step( 1e-6, r.w ) )
			.mul( fadeIn( lam, fp, 2.0, 6.0 ) );
		const ph = k.mul( d.sub( front ) );
		const a = s.mul( 0.12 ).mul( env ); // crest height, metres
		slope = slope.add( off.div( d ).mul( a.mul( k ).mul( cos( ph ) ) ) );
		glow = max( glow, env.mul( sin( ph ).max( 0 ) ) );

	}

	return { slope, glow };

}
