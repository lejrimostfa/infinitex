// What the eye itself sees once it is under water, on top of what the
// water does to each matter (core/underwater.js). Without it the picture
// under the surface is as crisp and still as in air. Applied by the
// waterline pass (core/waterline.js) to the water side of a camera port.
//   wobble     the image sways by a few pixels: the water between the
//              eye and the scene is never still
//   softness   a little of the neighbours in each pixel: water scatters
//              light forward, fine detail loses contrast
//   snow       sparse bright specks drifting slowly, in two sizes:
//              suspended particles lit by the sun (marine snow). They
//              give the water its depth and its scale
//   vignette   darker corners, as in a diving mask
// amount (waterBody.lens, 0 to 1) scales all four.
//
// tex: the water pass. s: screen uv. t: time in seconds.

import { vec2, vec3, float, texture, sin, cos, floor, fract, smoothstep, length, mix } from 'three/tsl';
import { hash3 } from './hash.js';

// One layer of specks: a grid on the screen, one speck per cell at a
// random place, drifting; most cells are empty.
function specks( s, t, cells, speed, radius, aspect ) {

	const q = vec2( s.x.mul( aspect ), s.y ).mul( cells ).add( vec2( t.mul( speed ), t.mul( speed ).mul( - 0.6 ) ) );
	const id = floor( q ), f = fract( q );
	const h = hash3( id ).xy;
	const d = length( f.sub( h.mul( 0.7 ).add( 0.15 ) ) );
	const twinkle = sin( t.mul( 0.9 ).add( h.x.mul( 40 ) ) ).mul( 0.5 ).add( 0.5 );
	return smoothstep( radius, radius * 0.35, d ).mul( smoothstep( 0.72, 0.9, fract( h.x.add( h.y ).mul( 7.31 ) ) ) ).mul( twinkle.mul( 0.6 ).add( 0.4 ) );

}

export function underwaterLens( tex, s, t, { amount = float( 1 ), tint = vec3( 0.55, 0.85, 0.9 ), aspect = float( 16 / 9 ) } = {} ) {

	const sway = vec2( sin( s.y.mul( 17 ).add( t.mul( 1.3 ) ) ), cos( s.x.mul( 13 ).add( t.mul( 1.1 ) ) ) ).mul( 0.0016 ).mul( amount );
	const c = s.add( sway );
	const r = float( 0.0022 ).mul( amount );
	const near = texture( tex, c.add( vec2( r, 0 ) ) ).rgb.add( texture( tex, c.sub( vec2( r, 0 ) ) ).rgb )
		.add( texture( tex, c.add( vec2( 0, r.mul( aspect ) ) ) ).rgb ).add( texture( tex, c.sub( vec2( 0, r.mul( aspect ) ) ) ).rgb ).mul( 0.25 );
	let col = mix( texture( tex, c ).rgb, near, 0.55 );
	const snow = specks( s, t, 26, 0.035, 0.07, aspect ).add( specks( s.add( 0.37 ), t, 58, 0.02, 0.09, aspect ).mul( 0.6 ) );
	col = col.add( tint.mul( snow ).mul( 0.22 ).mul( amount ) );
	const edge = length( s.sub( 0.5 ).mul( vec2( 1, 0.8 ) ) );
	return col.mul( mix( float( 1 ), smoothstep( 0.95, 0.35, edge ).mul( 0.3 ).add( 0.7 ), amount ) );

}
