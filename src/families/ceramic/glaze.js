// A glaze: a glass coat 0.2 to 1 mm thick fired on a clay body
// (porcelain, faience). Level by level:
//   L0 coat     its colour, thinner in places (the body shows warmer
//               through it), deeper where it pooled; a hand-painted
//               cobalt motif under it (motif.js)
//   L1 peel     the fired surface is never flat: soft waves of 1 to 3 mm,
//               a few um high, that wobble the reflections
//   L1 crackle  a net of cracks in generations, inked or plain (crackle.js)
//   L2 pinholes bubbles that burst at the surface: pits of 0.1 to 0.5 mm,
//               the body seen at the bottom
//   L3 bubbles  gas held in the coat, 20 to 120 um: a dark rim, a bright
//               dot where the light reflects inside
// Pigment and ink absorb light (Beer law): a thin wash is a light, clean
// blue, not a grey mix. The coat is a clear coat lobe on top; the colour
// layer under it is rougher.
//
// Returns { color, slope, cavity, rough, s2, coat, coatRough, coatSlope }.

import { vec2, vec3, float, exp, log, smoothstep, mix } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { valueNoise } from '../../core/hash.js';
import { crackleNet } from './crackle.js';
import { paintMotif } from './motif.js';
import { bubbleField, capSlope } from './bubbles.js';

// Light through an absorbing layer: amount 1 gives exactly `tint`.
export const absorb = ( color, tint, amount ) => color.mul( exp( log( tint.max( vec3( 0.004 ) ) ).mul( amount ) ) );

// Soft waviness of a fired coat. Height in meters, amplitude a few um.
export function orangePeel( p, fp, amount, periodM = 0.0022 ) {

	const w1 = fadeIn( float( periodM ), fp, 2.0, 6.0 ), w2 = fadeIn( float( periodM * 0.3 ), fp, 2.0, 6.0 );
	const h = valueNoise( p.div( periodM ).add( 2.2 ) ).mul( w1 ).add( valueNoise( p.div( periodM * 0.3 ).add( 9.4 ) ).mul( 0.35 ).mul( w2 ) );
	return { slope: surfaceGradient( h.mul( amount ).mul( 1.6e-5 ), p ), s2: amount.mul( amount ).mul( float( 1 ).sub( w1 ) ).mul( 4e-4 ) };

}

// Bubbles held under a clear coat, two sizes. Changes the colour only.
export function coatBubbles( color, p, fp, cellM, density, salt = 3 ) {

	let c = color;
	for ( const [ k, dens, sl ] of [ [ 14, 0.12, 29 ], [ 4, 0.55, 0 ], [ 1.6, 1, 17 ] ] ) {

		const B = bubbleField( p, fp, cellM.mul( k ), density.mul( dens ), salt + sl );
		const spot = smoothstep( 0.35, 0.05, B.v.sub( vec2( - 0.3, 0.35 ) ).length() ).mul( B.inside );
		c = c.mul( float( 1 ).add( B.inside.mul( 0.07 ).sub( B.rim.mul( 0.4 ) ).mul( B.fade ) ) ).add( spot.mul( B.fade ).mul( 0.18 ) );
		// Under a pixel: a faint haze of the same mean.
		c = c.mul( float( 1 ).sub( B.fade.oneMinus().mul( density ).mul( dens ).mul( 0.02 ) ) );

	}

	return c;

}

// Specks: grains of iron oxide or kiln dust caught in the coat, 0.1 to
// 0.6 mm, dark brown with a soft halo where they melted in.
export function specks( color, p, fp, amount ) {

	let c = color;
	for ( const [ cell, dens, salt ] of [ [ 0.0016, 0.3, 61 ], [ 0.0006, 0.3, 67 ] ] ) {

		const B = bubbleField( p, fp, float( cell ), amount.mul( dens ), salt );
		// Ragged grain: its edge wobbles with the angle.
		const rag = valueNoise( B.v.mul( 2.5 ).add( B.h.xy.mul( 50 ) ) ).mul( 0.5 ).add( 0.6 );
		const core = smoothstep( rag, rag.sub( 0.15 ), B.d ).mul( B.on );
		const halo = smoothstep( 1.4, 0.7, B.d ).mul( B.on ).mul( 0.35 );
		c = mix( c, c.mul( vec3( 0.55, 0.4, 0.28 ) ), halo.mul( B.fade ) );
		c = mix( c, vec3( 0.04, 0.025, 0.015 ), core.mul( 0.9 ).mul( B.fade ) );
		c = c.mul( float( 1 ).sub( B.fade.oneMinus().mul( amount ).mul( dens ).mul( 0.03 ) ) );

	}

	return c;

}

export function buildGlaze( p, fp, u ) {

	const s = u.seed;
	// Coat colour and thickness.
	const tone = valueNoise( p.div( 0.05 ).add( s ) ).mul( 0.7 ).add( valueNoise( p.div( 0.009 ).add( s.add( 3 ) ) ).mul( 0.3 ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 );
	const thick = valueNoise( p.div( 0.03 ).add( s.add( 6 ) ) ).mul( 0.65 ).add( valueNoise( p.div( 0.006 ).add( s.add( 8 ) ) ).mul( 0.35 ) );
	const thin = smoothstep( 0.42, 0.12, thick ).mul( u.pooling );
	let color = mix( u.glazeColor.mul( tone ), u.bodyColor, thin.mul( 0.55 ) );
	color = mix( color, color.mul( color ).mul( 1.12 ).min( color ), smoothstep( 0.55, 0.85, thick ).mul( u.pooling ).mul( 0.5 ) );

	const peel = orangePeel( p, fp, u.orangePeel );
	let slope = vec2( 0 ), cavity = float( 0 ), coat = float( 1 );
	let coatSlope = peel.slope;

	if ( u.paint.value > 0 ) {

		const cov = paintMotif( p, fp, u ).mul( u.paint );
		// Under a thin coat the cobalt fires darker and sharper.
		color = absorb( color, u.paintColor, cov.mul( thin.mul( 0.3 ).add( 1 ) ) );

	}

	if ( u.specks.value > 0 ) color = specks( color, p, fp, u.specks );
	if ( u.bubbles.value > 0 ) color = coatBubbles( color, p, fp, u.bubbleM, u.bubbles );

	if ( u.crackle.value > 0 ) {

		const K = crackleNet( p, fp, u );
		// Plain crazing still shows: dirt and the crack plane catch the light.
		const ink1 = mix( vec3( 0.55, 0.52, 0.48 ), u.inkColor, u.ink );
		const ink2 = mix( vec3( 0.62, 0.58, 0.52 ), u.ink2Color, u.ink );
		color = absorb( color, ink1, K.c1.add( K.halo.mul( 0.12 ).mul( u.ink ) ).mul( u.crackle ) );
		color = absorb( color, ink2, K.c2.add( K.c3.mul( 0.7 ) ).mul( u.crackle ) );
		slope = slope.add( K.slope.mul( u.crackle ) );
		coatSlope = coatSlope.add( K.slope.mul( u.crackle ).mul( 0.6 ) );
		cavity = cavity.max( K.c1.max( K.c2 ).mul( u.crackle ) );

	}

	if ( u.pinholes.value > 0 ) {

		// Pits: the lip rounds over, the body shows at the bottom.
		const P = bubbleField( p, fp, float( 0.0011 ), u.pinholes.mul( 0.22 ), 41 );
		const bottom = smoothstep( 0.75, 0.3, P.d ).mul( P.inside );
		color = mix( color, u.bodyColor.mul( 0.3 ), bottom.mul( 0.85 ).mul( P.fade ) ).mul( float( 1 ).sub( P.rim.mul( 0.25 ).mul( P.fade ) ) );
		const pit = capSlope( P.v, P.d ).mul( P.inside ).mul( P.fade ).mul( 0.4 );
		slope = slope.add( pit );
		coatSlope = coatSlope.add( pit );
		cavity = cavity.max( P.inside.mul( 0.8 ) );
		coat = coat.sub( bottom.mul( 0.7 ) );

	}

	return { color, slope: slope.add( peel.slope ), cavity, rough: u.roughness, s2: peel.s2, coat, coatRough: u.glazeRough, coatSlope, coatS2: peel.s2 };

}
