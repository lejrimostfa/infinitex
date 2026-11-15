// Silicone rubber: soft, translucent, a little tacky.
//   translucency  light enters a few mm: colours are soft, the relief has
//                 little contrast, the body glows a little (color2 is the
//                 colour of the light coming back out)
//   bubbles       air trapped while casting, seen through the body. Three
//                 layers at 0.2, 0.8 and 2 mm deep, drawn with parallax
//                 (they slide against the surface when the eye moves).
//                 Deeper ones are blurred and faint. Sizes: 0.3 to 1 mm,
//                 100 to 300 um, and micro bubbles of 15 to 40 um.
//                 Each bubble: a dark rim (light bent away at its wall) and
//                 a small bright spot.
//   tack          the sticky skin holds lint and dust: pale fibres, and a
//                 broad soft sheen
// W: { color, slope, cavity, rough, s2 }, returned updated, with sheen.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, exp, positionView, tangentView, bitangentView, normalView } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { scratchMarks } from '../../core/marks.js';

// One layer of bubbles at depth `depth` (m) below the surface, cell cellM.
function bubbleLayer( p, fp, view, cellM, depth, density, off ) {

	// Where the eye ray meets this depth, bent by the index (1.41).
	const q = p.sub( view.xy.div( view.z.max( 0.2 ) ).mul( depth ).div( 1.41 ) ).div( cellM ).add( off ).mod( 4096 ); // mod: hashes stay exact
	const id = floor( q );
	const h = hash3( id );
	const rel = fract( q ).sub( h.xy.mul( 0.5 ).add( 0.25 ) );
	const R = h.z.mul( h.z ).mul( 0.2 ).add( 0.07 ); // cells, most bubbles small
	const d = rel.length();
	const on = step( hash1( id.add( 5.1 ) ), density );
	// Blur grows with depth: light scattered on the way out.
	const blur = fp.add( depth.mul( 0.015 ) ).div( cellM ).max( 1e-4 );
	const inside = clamp( R.sub( d ).div( blur ).add( 0.5 ), 0, 1 );
	const rim = smoothstep( R.mul( 0.55 ), R.mul( 0.95 ), d ).mul( inside );
	const spot = smoothstep( R.mul( 0.3 ), R.mul( 0.1 ), rel.sub( vec2( - 0.3, 0.35 ).mul( R ) ).length() );
	const fade = exp( depth.div( 0.004 ).negate() ).mul( fadeIn( cellM, fp, 2.0, 5.0 ) ).mul( on );
	return { rim: rim.mul( fade ), spot: spot.mul( inside ).mul( fade ), body: inside.mul( fade ) };

}

export function applySilicone( W, p, fp, u ) {

	let { color, slope, cavity, rough, s2 } = W;
	const t = u.transl;
	// Translucent body: soft, flat colour, its own light mixed in.
	// Seen face on, the eye looks deep: saturated. At grazing angles the
	// light comes back from near the skin: milky, paler.
	const Vf = positionView.negate().normalize().dot( normalView ).clamp( 0, 1 );
	color = mix( color, mix( mix( color, u.color2, 0.55 ).mul( 1.05 ), color.mul( color ).mul( 1.6 ).min( color ), Vf.pow( 0.7 ) ), t.mul( 0.7 ) );
	slope = slope.mul( float( 1 ).sub( t.mul( 0.4 ) ) );

	if ( u.bubbles.value > 0 ) {

		const V = positionView.negate().normalize();
		const view = vec3( V.dot( tangentView ), V.dot( bitangentView ), V.dot( normalView ) );
		const b = u.bubbleM;
		const L1 = bubbleLayer( p, fp, view, b.mul( 4 ), float( 2e-3 ), u.bubbles.mul( 0.25 ), u.seed.add( 1.1 ) );
		const L2 = bubbleLayer( p, fp, view, b, float( 8e-4 ), u.bubbles.mul( 0.45 ), u.seed.add( 4.4 ) );
		const L3 = bubbleLayer( p, fp, view, b.mul( 0.15 ), float( 2e-4 ), u.bubbles.mul( 0.5 ), u.seed.add( 9.9 ) );
		const rim = L1.rim.max( L2.rim ).max( L3.rim );
		const spot = L1.spot.max( L2.spot ).max( L3.spot );
		const body = L1.body.max( L2.body ).max( L3.body );
		// A bubble: dark wall (light bent away), clear inside, a bright spot.
		color = color.mul( float( 1 ).sub( rim.mul( 0.7 ) ) ).mul( body.mul( 0.12 ).add( 1 ) ).add( u.color2.mul( spot ).mul( 0.6 ) );

	}

	let sheen = u.color2.mul( t.mul( 0.4 ) );
	if ( u.tack.value > 0 ) {

		// Lint and dust stuck on the tacky skin.
		const lint = scratchMarks( p, fp, float( 0.006 ), float( 4e-6 ), u.seed.add( 3.7 ), { length: 1.4, density: u.tack.mul( 0.35 ) } );
		const fine = scratchMarks( p, fp, float( 6e-4 ), float( 1.5e-6 ), u.seed.add( 8.1 ), { length: 1.2, density: u.tack.mul( 0.3 ) } );
		const q = p.div( 2e-4 ).add( 6.6 );
		const gh = hash3( floor( q ) );
		const grain = smoothstep( gh.z.mul( 0.08 ).add( 0.03 ), 0.0, fract( q ).sub( gh.xy.mul( 0.6 ).add( 0.2 ) ).length() ).mul( step( gh.x, u.tack.mul( 0.25 ) ) ).mul( fadeIn( float( 2e-4 ), fp, 2.0, 6.0 ) );
		const stuck = lint.cov.max( fine.cov.mul( 0.8 ) ).max( grain );
		color = mix( color, vec3( 0.75, 0.74, 0.7 ), stuck.mul( 0.8 ) );
		slope = slope.add( lint.slope.mul( 0.5 ) );
		rough = mix( rough, float( 0.9 ), stuck );
		sheen = sheen.add( vec3( u.tack.mul( 0.15 ) ) );

	}

	return { ...W, color, slope, cavity, rough, s2, sheen, sheenRough: float( 0.35 ) };

}
