// Asphalt (road surface, AC 0/11): crushed stone bound by bitumen. The
// ground under a puddle, an oil slick, a rain shower.
//   L0  coarse aggregate: angular grey stones of 5 to 11 mm, each its own
//       rock tone, their tops worn flat and proud of the binder
//   L1  fine aggregate: sand of 0.4 to 1.2 mm in the mastic, mostly
//       coated black, a light grain here and there
//   L2  the mastic: bitumen with filler dust, almost black, and the
//       speckle of the rock inside each stone (crystals of 0.1 to 0.3 mm)
// Returns colour (dry), height h (meters above the binder), slope,
// slope variance and a cavity signal. Albedo about 0.08 to 0.12 dry.

import { vec2, float, mix, mod, smoothstep, step } from 'three/tsl';
import { valueNoise, wrapCoord } from '../../core/hash.js';
import { fadeIn } from '../../core/lod.js';
import { fbm, grains } from '../stone/common.js';

export function buildAsphalt( p, fp, u ) {

	// Crushed stone is angular: a warp breaks the round Voronoi grains.
	const A = float( 0.009 );
	const wq = wrapCoord( p.div( 0.006 ) );
	const pw = p.add( vec2( valueNoise( wq ), valueNoise( wq.add( 3.3 ) ) ).sub( 0.5 ).mul( 0.0035 ) );
	const S = grains( pw, A, fp, 0.16, 11, 0.85 );
	const F = grains( p, float( 8e-4 ), fp, 0.2, 13, 0.9 );
	const speck = fbm( p, 3e-4, fp, 3, 7 );
	// Each stone its own rock, never far from the binder grey: the
	// bitumen still coats its sides, only the worn top shows the rock.
	const rock = mix( u.color2.mul( 0.5 ), u.color2.mul( 1.05 ), S.h.z ).mul( mix( float( 0.9 ), float( 1.1 ), S.h.y ) );
	const binder = u.color3.mul( fbm( p, 0.03, fp, 3, 9 ).mul( 0.5 ).add( 0.75 ) );
	const worn = smoothstep( 0.02, 0.22, S.m );
	const stone = mix( binder.mul( 1.6 ), rock.mul( speck.sub( 0.5 ).mul( 0.9 ).add( 1 ) ), worn.mul( 0.85 ).add( 0.15 ) );
	// Sand in the mastic: mostly coated, a lighter grain here and there.
	const sand = mix( binder.mul( 1.5 ), u.color2.mul( 0.6 ), step( 0.7, F.h.z ).mul( F.h.y ) );
	// Far away the surface is a mean grey: the grains fade to coverage.
	let color = mix( binder, sand, F.inside.mul( 0.6 ) );
	color = mix( color, stone, S.inside );
	// Stones: worn flat tops 1 to 2 mm proud; sand half a millimetre.
	const top = smoothstep( 0.0, 0.25, S.m ).mul( S.w );
	const h = top.mul( float( 1.2e-3 ).add( S.h.x.mul( 8e-4 ) ) ).add( F.inside.mul( F.w ).mul( 3e-4 ) ).add( S.w.oneMinus().mul( 7e-4 ) );
	const flat = smoothstep( 0.1, 0.3, S.m ).oneMinus().mul( 0.7 ).add( 0.3 );
	const slope = S.slope.mul( flat ).mul( 0.8 ).add( F.slope.mul( 0.4 ).mul( S.inside.oneMinus() ) );
	const s2 = float( 0.06 ).mul( S.w.oneMinus() ).add( float( 0.03 ).mul( F.w.oneMinus() ) );
	const cavity = S.inside.oneMinus().mul( F.inside.oneMinus().mul( 0.5 ).add( 0.5 ) ).mul( fadeIn( 0.0013, fp, 1.5, 4 ).mul( 0.6 ).add( 0.4 ) );
	return { color, h, slope, s2, cavity };

}
