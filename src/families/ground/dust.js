// A dust layer settled on a flat, dark, glossy base (black lacquer).
//   L0 layer     thicker on faces turned up, drifts and thin patches over
//                a few cm; a finger swipe: a clean stroke with streaks along
//                it and soft piled edges; dust greys the black, kills its gloss
//   L1 debris    grit and soil particles (60 to 300 um), hairs (60 to 80
//                um thick, cm long), lint clumps
//   L2 motes     the bulk of house dust: mineral specks (5 to 30 um),
//                textile fibres (10 to 20 um thick, curly, some dyed),
//                skin flakes (pale, flat, 30 to 80 um), pollen (round,
//                20 to 40 um, yellow)
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, vec3, float, mix, smoothstep, step, normalWorld } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { valueNoise } from '../../core/hash.js';
import { grains, fibres, fbm, line } from './grains.js';

// Sparse particles: one layer of grains, kept where the hash says so.
function specks( p, cellM, fp, share, salt ) {

	const G = grains( p, cellM, fp, salt, { gap: 0.2, radius: 0.32, round: 0.3, crown: 0.6, elong: 1.4, tilt: 0.6 } );
	const on = step( G.id.x, share );
	return { G, cover: G.body.mul( on ), w: fadeIn( cellM.mul( 0.5 ), fp, 1.0, 3.0 ) };

}

export function buildDust( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	// L0: how much dust lies here. Dust falls: faces turned up collect
	// more; it gathers in drifts and thin patches over a few cm.
	const up = smoothstep( - 0.3, 1.0, normalWorld.y ).mul( 0.9 ).add( 0.45 );
	const thick = smoothstep( 0.25, 0.75, fbm( p.div( 0.06 ).add( s ), 3 ) ).mul( 0.7 ).add( 0.3 )
		.mul( smoothstep( 0.2, 0.6, fbm( p.div( 0.015 ).add( 3.3 ), 2 ) ).mul( 0.4 ).add( 0.6 ) ).mul( up );
	// A finger swipe: a straight stroke 18 mm wide with round ends. Inside,
	// streaks left by the skin ridges run along the stroke; the pushed dust
	// piles up in soft ridges along both edges.
	const dir = vec2( 0.966, - 0.259 ), nrm = vec2( 0.259, 0.966 );
	const q = p.sub( vec2( 0.05, 0.19 ) );
	const along = q.dot( dir ), across = q.dot( nrm );
	const len = 0.17, hw = float( 0.009 ).add( fbm( vec2( along.div( 0.01 ), 1.7 ), 2 ).sub( 0.5 ).mul( 0.002 ) );
	const capped = vec2( along.sub( along.clamp( 0, len ) ), across ).length();
	const inside = smoothstep( hw, hw.sub( 0.0015 ), capped );
	const streak = valueNoise( vec2( across.div( 3e-4 ), along.div( 0.03 ) ) );
	const residue = smoothstep( 0.55, 0.85, streak ).mul( 0.35 ).add( smoothstep( 0.6, 1.0, along.div( len ) ).mul( 0.3 ) );
	const pile = smoothstep( hw.add( 0.005 ), hw, capped ).mul( smoothstep( hw.sub( 0.001 ), hw.add( 0.0008 ), capped ) );
	const wiped = inside.mul( residue.oneMinus() );
	const den = u.cover.mul( thick ).mul( wiped.oneMinus() ).mul( pile.mul( 1.3 ).add( 1 ) ).min( 1 ).toVar();

	// L2 bulk: a dense haze of motes and the fine particles themselves.
	const M = specks( p, g.mul( 0.4 ), fp, den, 3.3 );
	const F = specks( p, g, fp, den.mul( 0.6 ), 7.1 );
	const C = specks( p, g.mul( 8 ), fp, den.mul( 0.3 ), 11.9 );
	const K = specks( p, g.mul( 25 ), fp, den.mul( 0.25 ), 13.1 );
	// Haze: what the unresolved motes add, by their mean cover.
	const grainy = fbm( p.div( g.mul( 2 ) ).add( 2.2 ), 2 ).mul( fadeIn( g.mul( 2 ), fp, 2.0, 6.0 ) ).sub( 0.5 ).mul( 0.8 ).add( 1 );
	const haze = den.mul( 0.55 ).mul( M.w.oneMinus().mul( 0.6 ).add( 0.4 ) ).mul( grainy );
	const base = u.color3.mul( valueNoise( p.div( 0.05 ) ).mul( 0.2 ).add( 0.9 ) );
	let color = mix( base, u.color.mul( 0.85 ), haze );
	const tone = ( G ) => mix( u.color, u.color2, G.id.y ).mul( G.id.z.mul( 0.6 ).add( 0.5 ) );
	color = mix( color, tone( M.G ), M.cover.mul( M.w ).mul( 0.8 ) );
	// Skin flakes: flat, pale, translucent; pollen: yellow balls.
	const flake = step( 0.75, F.G.id.y );
	const pollen = step( 0.95, F.G.id.z ).mul( flake.oneMinus() );
	const fCol = mix( mix( tone( F.G ), u.color2.mul( 1.1 ), flake.mul( 0.7 ) ), vec3( 0.75, 0.55, 0.12 ), pollen );
	color = mix( color, fCol, F.cover.mul( F.w ).mul( mix( float( 1 ), float( 0.6 ), flake ) ) );
	color = mix( color, tone( C.G ).mul( 0.7 ), C.cover.mul( C.w ) );
	color = mix( color, tone( K.G ).mul( 0.55 ), K.cover.mul( K.w ) );

	// Fibres: textile lint (thin, curly, some dyed) and hairs.
	const T = fibres( p, g.mul( 50 ), g.mul( 0.3 ), den.mul( 0.6 ), fp, 5.5, 0.6 );
	const wT = fadeIn( g.mul( 0.6 ), fp, 1.0, 3.0 );
	const dyed = step( 0.8, T.tone );
	const tCol = mix( u.color2, mix( vec3( 0.12, 0.2, 0.5 ), vec3( 0.5, 0.1, 0.1 ), step( 0.9, T.tone ) ), dyed );
	color = mix( color, tCol, T.fiber.mul( wT ).mul( 0.85 ) );
	const H = fibres( p, g.mul( 700 ), g.mul( 1.1 ), u.roots.mul( 0.25 ).mul( wiped.oneMinus() ), fp, 9.4, 0.3 );
	color = mix( color, mix( vec3( 0.03, 0.022, 0.016 ), u.color2.mul( 0.6 ), step( 0.75, H.tone ) ), H.fiber );

	const bump = ( S, k ) => S.G.grad.mul( S.cover ).mul( S.w ).mul( k );
	const slope = bump( M, 0.3 ).add( bump( F, 0.5 ).mul( flake.mul( - 0.7 ).add( 1 ) ) ).add( bump( C, 0.6 ) ).add( bump( K, 0.6 ) )
		.add( T.slope.mul( wT ).mul( 0.6 ) ).add( H.slope.mul( 0.8 ) );
	// Dust kills the gloss of the lacquer.
	const anyDust = haze.max( M.cover.mul( M.w ) ).max( F.cover.mul( F.w ) ).max( C.cover.mul( C.w ) ).max( K.cover.mul( K.w ) ).max( T.fiber.mul( wT ) ).max( H.fiber );
	const rough = mix( u.roughness, float( 0.85 ), anyDust.min( 1 ) );
	const s2 = den.mul( 0.02 );
	return { color, slope, cavity: float( 0 ), rough, s2 };

}
