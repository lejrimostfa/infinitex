// An LCD screen showing an image. Level by level:
//   L0 image     a retro sunset (sky, striped sun, mountains, a scrolling
//                grid floor), one image per face of the cube, drawn at the
//                resolution of the screen: each pixel shows one colour
//   L1 pixels    pixel pitch size_mm (0.25 to 0.5 mm): from a hand away
//                the image breaks into square pixels with a black matrix
//   L2 subpixels three stripes per pixel, red, green and blue, each lit
//                by its share of the colour; a thin black matrix between
//                them, the TFT transistor hiding one corner
//   L3 film      inside a subpixel: a faint mottle of the liquid crystal
//                and the matt grain of the anti-glare film (20 um)
// Moire free: a subpixel stripe under a few pixels fades to the mean
// colour of the pixel (the sum of its three stripes is the image colour),
// and the image itself is never sharper than a screen pixel or a view
// pixel, whichever is larger.

import { vec2, vec3, float, floor, fract, clamp, smoothstep, mix, mod, abs, max, min, step } from 'three/tsl';
import { ixTime as time } from '../../core/clock.js';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { fbm } from '../stone/common.js';

// The picture, q in 0..1 over the face (y up), fq: footprint in q units.
export function picture( q, fq, t ) {

	const hz = float( 0.42 ); // horizon
	const up = q.y.sub( hz );
	// Sky: deep violet at the top to hot pink at the horizon.
	let c = mix( vec3( 0.55, 0.06, 0.32 ), vec3( 0.05, 0.01, 0.16 ), smoothstep( 0.0, 0.55, up ) );
	// Sun: yellow to pink, cut by bands that widen toward the horizon.
	const sd = vec2( q.x.sub( 0.5 ), q.y.sub( 0.62 ) );
	const sunIn = clamp( float( 0.2 ).sub( sd.length() ).div( fq ).add( 0.5 ), 0, 1 );
	const by = q.y.sub( 0.62 ).negate().div( 0.2 ); // 0 at centre, 1 at the bottom
	const gapW = by.mul( 0.5 ).max( 0 ).mul( 0.022 );
	const bf = fract( q.y.div( 0.032 ) ).sub( 0.5 ).abs().mul( 0.032 );
	const gap = clamp( gapW.sub( bf ).div( fq ).add( 0.5 ), 0, 1 ).mul( step( 0, by ) ).mul( smoothstep( 1.5, 4.0, float( 0.032 ).div( fq ) ) );
	const sunCol = mix( vec3( 1.0, 0.85, 0.2 ), vec3( 1.0, 0.18, 0.45 ), clamp( by.add( 1 ).mul( 0.5 ), 0, 1 ) );
	c = mix( c, sunCol, sunIn.mul( float( 1 ).sub( gap ) ) );
	// Mountains: a ridge above the horizon.
	const ridge = hz.add( valueNoise( vec2( q.x.mul( 9 ), 1.7 ) ).mul( 0.07 ) ).add( valueNoise( vec2( q.x.mul( 31 ), 4.1 ) ).mul( 0.02 ) )
		.mul( smoothstep( 0.0, 0.25, abs( q.x.sub( 0.5 ) ) ).mul( 0.6 ).add( 0.4 ) ).max( hz );
	const mtn = clamp( ridge.sub( q.y ).div( fq ).add( 0.5 ), 0, 1 );
	c = mix( c, vec3( 0.06, 0.02, 0.1 ), mtn );
	// Floor: a perspective grid, scrolling toward the viewer.
	const depth = hz.sub( q.y ).max( 1e-3 );
	const gx = q.x.sub( 0.5 ).div( depth ).mul( 0.12 );
	const gz = float( 0.05 ).div( depth ).add( t );
	const line = ( f, spacing ) => {

		const d = fract( f ).sub( 0.5 ).abs().mul( spacing ); // q units
		const w = spacing.mul( 0.06 ).max( 0.0012 );
		const cov = clamp( w.sub( d ).div( fq ).add( 0.5 ), 0, 1 );
		return mix( w.mul( 2 ).div( spacing ).min( 1 ), cov, smoothstep( 2.5, 6.0, spacing.div( fq ) ) );

	};
	const grid = max( line( gx, depth.div( 0.12 ) ), line( gz, depth.mul( depth ).div( 0.05 ) ) );
	const floorOn = clamp( depth.sub( 1e-3 ).div( fq ).add( 0.5 ), 0, 1 ).mul( step( q.y, hz ) );
	const floorCol = mix( vec3( 0.03, 0.0, 0.08 ), vec3( 1.0, 0.2, 0.85 ), grid ).add( vec3( 0.3, 0.02, 0.25 ).mul( smoothstep( 0.12, 0.0, depth ) ) );
	return mix( c, floorCol, floorOn );

}

export function buildScreen( p, fp, u ) {

	const P = u.sizeM;
	const fq = fp.max( P ).div( 0.3 );
	const cell = floor( p.div( P ) );
	const centre = cell.add( 0.5 ).mul( P );
	const img = picture( fract( centre.div( 0.3 ) ), fq, time.mul( u.speed ).mul( 0.25 ) );

	// L2 subpixels: stripe index and the opening inside each stripe.
	const f = fract( p.div( P ) );
	const sx = f.x.mul( 3 );
	const k = floor( sx ), lx = fract( sx );
	const sub = P.div( 3 );
	const ox = float( 0.36 ).sub( lx.sub( 0.5 ).abs() ).mul( sub );
	const oy = float( 0.44 ).sub( f.y.sub( 0.5 ).abs() ).mul( P );
	const tft = min( float( 0.62 ).sub( lx ).mul( sub ).negate(), float( 0.28 ).sub( f.y ).mul( P ) ); // corner notch
	const open = clamp( min( min( ox, oy ), tft.negate() ).div( fp ).add( 0.5 ), 0, 1 );
	const fill = 0.72 * 0.88 - 0.04;
	const pick3 = vec3( step( k, 0.5 ), step( 0.5, k ).mul( step( k, 1.5 ) ), step( 1.5, k ) );
	// L3: each subpixel a little off, the crystal mottled inside.
	const sh = hash3( wrapCoord( cell.mul( vec2( 3, 1 ) ).add( vec2( k, 0 ) ) ) );
	const mottle = valueNoise( wrapCoord( p.div( 1.2e-5 ) ) ).sub( 0.5 ).mul( 0.12 ).mul( fadeIn( float( 1.2e-5 ), fp, 1.5, 4.0 ) );
	const sub3 = img.mul( pick3 ).mul( open ).mul( 3 / fill ).mul( sh.x.sub( 0.5 ).mul( 0.08 ).add( 1 ).add( mottle ) );
	const wSub = fadeIn( sub, fp, 2.0, 5.0 );
	// L1: below the subpixels, the pixel grid alone (black rows).
	const wPix = fadeIn( P, fp, 2.5, 6.0 );
	const rowGap = clamp( oy.div( fp ).add( 0.5 ), 0, 1 );
	const pix = mix( img, img.mul( rowGap ).div( 0.88 ), wPix );
	// Close up, expose like a macro camera: half the light, so the
	// subpixels keep their pure colours instead of clipping to white.
	const light = mix( pix, sub3.mul( 0.45 ), wSub );

	// Anti-glare film: matt grain, faded by the pixel.
	const g = fbm( p, 8e-5, fp, 2, 9 ).sub( 0.5 );
	return {
		color: u.color3, emissive: light.mul( u.glow ), metal: float( 0 ),
		slope: vec2( g, g.negate() ).mul( 0.08 ).mul( u.relief ), rough: u.roughness, s2: float( 0.002 ),
		cavity: float( 0 ), coat: u.coat, coatRough: float( 0.05 ),
	};

}
