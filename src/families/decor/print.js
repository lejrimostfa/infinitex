// A tattoo flash printed on cotton (direct to garment): the line art of a
// drawing (design_map, dark lines on white, the same flash the skin
// family wears) filled with the flat colours of old school flash. The
// dye soaks into the fibres instead of sitting on them, so it is a filter
// over the woven ground: the threads keep their relief and shading.
//   L0 design   design_size_mm across, centred at design_center; black
//               lines from the map, red, yellow and green fills laid by
//               the shape of a compass rose (points, rings, heart)
//   L1 weave    the dye follows each thread; it reaches the gaps less
//   L2 fibres   single fibres (15 um) missed by the spray stay pale, so
//               every colour is speckled under the loupe; the line edges
//               wick a little along the threads
// Without a map, the fills alone are printed.
// Returns { tint } (a colour multiplying the ground) and no cover.

import { vec2, vec3, float, floor, clamp, smoothstep, step, mod, mix, abs, atan, cos, sin, texture, PI } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { valueNoise, wrapCoord } from '../../core/hash.js';

export function buildPrint( p, fp, u ) {

	const tuv = p.sub( u.designCenter ).div( u.designSize ).add( 0.5 );
	const inside = step( 0, tuv.x ).mul( step( tuv.x, 1 ) ).mul( step( 0, tuv.y ) ).mul( step( tuv.y, 1 ) );
	// Wicking: the dye runs a little along the threads (0.1 mm).
	const wick = vec2( valueNoise( p.div( 3e-4 ) ), valueNoise( p.div( 3e-4 ).add( 5 ) ) ).sub( 0.5 ).mul( 1.2e-4 ).div( u.designSize );
	const t = tuv.add( wick );
	let line = float( 0 );
	if ( u.designMap ) {

		const s = texture( u.designMap, t );
		line = smoothstep( 0.25, 0.7, float( 1 ).sub( s.rgb.dot( vec3( 0.2126, 0.7152, 0.0722 ) ) ) ).mul( inside );

	}

	// Fills, in the 1024 px frame of the drawing (centre 512).
	const c = t.sub( 0.5 ).mul( vec2( 1024, - 1024 ) );
	const r = c.length();
	const a = atan( c.y, c.x ).add( PI.mul( 0.5 ) ); // 0 at the top point
	const k = floor( a.div( PI.div( 4 ) ).add( 0.5 ) );
	const odd = k.mul( 0.5 ).fract().mul( 2 ); // k may be negative
	const ka = k.mul( PI.div( 4 ) ).sub( PI.mul( 0.5 ) );
	const along = c.dot( vec2( cos( ka ), sin( ka ) ) ), across = c.dot( vec2( sin( ka ).negate(), cos( ka ) ) );
	const Lp = mix( float( 380 ), float( 250 ), odd ), Wp = mix( float( 64 ), float( 42 ), odd );
	const hub = smoothstep( 34, 40, r ); // the white hub of the rose stays white
	const inPoint = smoothstep( 0, 3, Wp.mul( float( 1 ).sub( along.div( Lp ) ) ).sub( abs( across ) ) ).mul( step( 0, along ) ).mul( hub );
	const band = smoothstep( 0, 3, float( 17 ).sub( abs( r.sub( 412 ) ) ) );
	const disc = smoothstep( 0, 3, float( 175 ).sub( r ) );
	const halo = smoothstep( 0, 3, float( 395 ).sub( r ) ).mul( smoothstep( 0, 3, r.sub( 175 ) ) );
	let fill = mix( vec3( 1 ), mix( u.color2, vec3( 1 ), 0.55 ), halo.mul( 0.8 ) );
	fill = mix( fill, u.color3, disc.mul( hub ).mul( 0.85 ) );
	fill = mix( fill, u.color2, band );
	fill = mix( fill, mix( u.color, u.color3.mul( 0.8 ), odd ), inPoint );
	fill = mix( vec3( 1 ), fill, inside.mul( smoothstep( 440, 436, r ) ) );

	// L2: fibres the spray missed.
	const wF = fadeIn( float( 1.5e-5 ), fp, 1.5, 4.0 );
	const miss = smoothstep( 0.74, 0.9, valueNoise( wrapCoord( p.div( vec2( 1.5e-5, 9e-5 ) ) ) ) ).mul( wF ).mul( 0.45 );
	const ink = mix( fill, vec3( 0.02, 0.02, 0.03 ), line );
	const tint = mix( ink, vec3( 1 ), miss );
	return { tint: clamp( tint, 0, 1 ), cover: float( 0 ) };

}
