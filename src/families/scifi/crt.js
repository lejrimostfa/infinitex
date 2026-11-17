// A CRT screen showing a low resolution picture. Level by level:
//   L0 image     the retro sunset of screen.js, cut into video pixels of
//                size_mm (about 1.5 mm on a 30 cm face: 200 lines) and
//                reduced to a few levels per channel, like a game console
//   L1 lines     each video line is the trace of the electron beam: bright
//                lines are wider (the beam spreads with current), so dark
//                gaps open between dim lines and close on bright ones
//   L2 mask      a slot mask: red, green and blue phosphor slots, triad
//                pitch feature_mm (0.5 to 0.8 mm), every other column of
//                triads shifted by half a slot
//   L3 grain     inside a slot, the phosphor is a layer of grains about
//                15 um across, each a little brighter or dimmer
// Glass: the tube darkens toward the corners of the face; a faint bright
// band rolls slowly down the picture (mains hum). Each level, once under a
// few view pixels, fades to its mean, so the picture keeps its brightness
// and nothing moires.

import { vec2, vec3, float, floor, fract, clamp, smoothstep, mix, mod, abs, min, step, exp, sin, dot } from 'three/tsl';
import { ixTime as time } from '../../core/clock.js';
import { fadeIn } from '../../core/lod.js';
import { valueNoise, wrapCoord } from '../../core/hash.js';
import { picture } from './screen.js';

export function buildCrt( p, fp, u ) {

	const L = u.sizeM, M = u.featureM;
	const t = time.mul( u.speed );

	// L0: one colour per video pixel, a palette of 6 levels per channel.
	const cell = floor( p.div( L ) );
	const q = fract( cell.add( 0.5 ).mul( L ).div( 0.3 ) );
	const raw = picture( q, fp.max( L ).div( 0.3 ), t.mul( 0.25 ) );
	const img = floor( raw.max( 0 ).pow( 1 / 2.2 ).mul( 6 ).add( 0.5 ) ).div( 6 ).pow( 2.2 );

	// L1: the beam across the line, a Gaussian whose width grows with the
	// brightness; divided by its mean so a far view keeps the same light.
	const lum = dot( img, vec3( 0.2126, 0.7152, 0.0722 ) );
	const w = mix( float( 0.2 ), float( 0.42 ), lum.pow( 0.5 ) );
	const fy = fract( p.y.div( L ) ).sub( 0.5 );
	const beam = exp( fy.div( w ).pow( 2 ).negate() ).div( w.mul( 1.772 ) );
	const wLine = fadeIn( L, fp, 2.0, 5.0 );

	// L2: slot mask. Slot index in the triad, opening inside the slot.
	const sx = p.x.div( M ).mul( 3 );
	const k = mod( floor( sx ), 3 ), lx = fract( sx );
	const col = floor( p.x.div( M ) );
	const H = M.mul( 1.1 ); // slot row height
	const fs = fract( p.y.div( H ).add( mod( col, 2 ).mul( 0.5 ) ) );
	const ox = float( 0.34 ).sub( lx.sub( 0.5 ).abs() ).mul( M.div( 3 ) );
	const oy = float( 0.41 ).sub( fs.sub( 0.5 ).abs() ).mul( H );
	const open = clamp( min( ox, oy ).div( fp ).add( 0.5 ), 0, 1 );
	const fill = 0.68 * 0.82;
	const pick3 = vec3( step( k, 0.5 ), step( 0.5, k ).mul( step( k, 1.5 ) ), step( 1.5, k ) );
	const wMask = fadeIn( M.div( 3 ), fp, 2.0, 5.0 );
	const mask = mix( vec3( 1 ), pick3.mul( open ).mul( 3 / fill ), wMask );

	// L3: phosphor grains.
	const grain = valueNoise( wrapCoord( p.div( 1.5e-5 ) ) ).sub( 0.5 ).mul( 0.5 ).mul( fadeIn( float( 1.5e-5 ), fp, 1.5, 4.0 ) );

	// Glass: corners darker, a slow rolling band.
	const qf = fract( p.div( 0.3 ) );
	const edge = min( min( qf.x, float( 1 ).sub( qf.x ) ), min( qf.y, float( 1 ).sub( qf.y ) ) );
	const vig = smoothstep( 0.0, 0.18, edge ).mul( 0.6 ).add( 0.4 );
	const roll = sin( qf.y.add( t.mul( 0.08 ) ).mul( 6.2832 ) ).mul( 0.04 ).add( 1 );

	// Close up, expose like a macro camera so slots keep their colour.
	const expose = mix( float( 1 ), float( 0.5 ), wMask );
	const light = img.mul( mix( float( 1 ), beam, wLine ) ).mul( mask ).mul( grain.add( 1 ) ).mul( vig ).mul( roll ).mul( expose );

	// Dull grey-green phosphor screen where unlit, matt grain on the glass.
	const g = valueNoise( wrapCoord( p.div( 6e-5 ) ) ).sub( 0.5 ).mul( fadeIn( float( 6e-5 ), fp, 2.0, 5.0 ) );
	return {
		color: u.color3, emissive: light.mul( u.glow ), metal: float( 0 ),
		slope: vec2( g, g.negate() ).mul( 0.03 ).mul( u.relief ), rough: u.roughness, s2: float( 0.001 ),
		cavity: float( 0 ), coat: u.coat, coatRough: float( 0.03 ),
	};

}
