// What the eye itself sees once it is under water, on top of what the
// water does to each matter (core/underwater.js). Without it the picture
// under the surface is as crisp and still as in air. Applied by the
// waterline pass (core/waterline.js) to the water side of a camera port.
//   wobble     the image sways by a few pixels: the water between the
//              eye and the scene is never still
//   softness   a little of the neighbours in each pixel: water scatters
//              light forward, fine detail loses contrast
//   vignette   darker corners, as in a diving mask
// amount (waterBody.lens, 0 to 1) scales all three.
// No specks here: specks drawn on the screen stay put when the camera
// turns, so they read as dust on the lens. The marine snow lives in the
// water instead (core/snow.js).
//
// tex: the water pass. s: screen uv. t: time in seconds.

import { vec2, vec3, float, texture, sin, cos, smoothstep, length, mix } from 'three/tsl';

export function underwaterLens( tex, s, t, { amount = float( 1 ), tint = vec3( 0.55, 0.85, 0.9 ), aspect = float( 16 / 9 ) } = {} ) {

	const sway = vec2( sin( s.y.mul( 17 ).add( t.mul( 1.3 ) ) ), cos( s.x.mul( 13 ).add( t.mul( 1.1 ) ) ) ).mul( 0.0016 ).mul( amount );
	const c = s.add( sway );
	const r = float( 0.0022 ).mul( amount );
	const near = texture( tex, c.add( vec2( r, 0 ) ) ).rgb.add( texture( tex, c.sub( vec2( r, 0 ) ) ).rgb )
		.add( texture( tex, c.add( vec2( 0, r.mul( aspect ) ) ) ).rgb ).add( texture( tex, c.sub( vec2( 0, r.mul( aspect ) ) ) ).rgb ).mul( 0.25 );
	const col = mix( texture( tex, c ).rgb, near, 0.55 );
	const edge = length( s.sub( 0.5 ).mul( vec2( 1, 0.8 ) ) );
	return col.mul( mix( float( 1 ), smoothstep( 0.95, 0.35, edge ).mul( 0.3 ).add( 0.7 ), amount ) );

}
