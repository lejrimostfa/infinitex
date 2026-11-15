// Garden soil, from clods down to silt.
//   L0 clods     crumbs and clods of 3 to 15 mm, domed, with dark voids
//                between them; moist patches darker; a few stones (3 to
//                10 mm, pale grey or ochre) and root fibres (0.2 to 1 mm
//                thick, centimetres long, pale and wavy)
//   L1 crumbs    each clod is an aggregate of small crumbs (0.3 to 1 mm)
//                held by clay and humus; dark organic specks (bits of
//                leaf and charcoal), mineral sand grains that glint
//   L2 silt      silt and clay particles (2 to 50 um), white fungal
//                hyphae (5 um thick) crossing the pores
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, vec3, float, mix, smoothstep, step, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { packed, grains, fbm, fibres } from './grains.js';

export function buildSoil( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	const pw = p.add( vec2( valueNoise( p.div( g.mul( 1.2 ) ) ), valueNoise( p.div( g.mul( 1.2 ) ).add( 3.7 ) ) ).sub( 0.5 ).mul( g.mul( 0.3 ) ) );
	const C = packed( pw.add( s.mul( 0.13 ) ), g, fp, 2.9, { gap: 0.08, round: 0.4, crown: 0.4, radius: 0.5, elong: 0.8, sizeVar: u.sizeVar, ratio: 0.45, lift: 0.15 } );
	const wC = fadeIn( g, fp, 1.0, 4.0 ).toVar();
	const moist = fbm( p.div( 0.04 ).add( s ), 3 );
	const dryTone = mix( u.color, u.color2, smoothstep( 0.35, 0.75, moist ) );
	let clodCol = dryTone.mul( C.id.z.mul( 0.3 ).add( 0.8 ) );
	// Stones: some clods are pebbles.
	const stone = step( float( 1 ).sub( u.stones.mul( 0.25 ) ), C.id.y ).mul( step( 0.5, C.top ) );
	const stoneCol = mix( vec3( 0.13, 0.12, 0.11 ), vec3( 0.17, 0.12, 0.07 ), C.id.x ).mul( valueNoise( p.div( g.mul( 0.05 ) ) ).mul( 0.25 ).add( 0.85 ) );
	// L1: crumbs inside each clod, dark specks, sand grains.
	const K = grains( pw, g.mul( 0.08 ), fp, 4.1, { gap: 0.08, round: 0.35, crown: 0.5, radius: 0.5, elong: 0.8, tilt: 0.3 } );
	const wK = fadeIn( g.mul( 0.08 ), fp, 1.5, 5.0 ).toVar();
	clodCol = clodCol.mul( mix( float( 1 ), K.id.x.mul( 0.35 ).add( 0.75 ).mul( smoothstep( - 0.3, 0.4, K.h ).mul( 0.5 ).add( 0.5 ) ), wK ) );
	const speck = step( float( 1 ).sub( u.specks.mul( 0.12 ) ), K.id.y ).mul( K.body );
	clodCol = mix( clodCol, u.color3.mul( K.id.z.mul( 0.5 ).add( 0.5 ) ), speck.mul( wK ) );
	const sandG = step( 0.93, K.id.z ).mul( K.body ).mul( speck.oneMinus() );
	clodCol = mix( clodCol, vec3( 0.24, 0.21, 0.17 ), sandG.mul( wK ) );
	// Finer crumbs on each crumb (0.1 to 0.2 mm).
	const Q = grains( pw, g.mul( 0.02 ), fp, 5.3, { gap: 0.1, round: 0.4, crown: 0.4, radius: 0.5, elong: 0.8, tilt: 0.4 } );
	const wQ = fadeIn( g.mul( 0.02 ), fp, 1.5, 5.0 ).toVar();
	clodCol = clodCol.mul( mix( float( 1 ), Q.id.x.mul( 0.3 ).add( 0.8 ).mul( smoothstep( - 0.4, 0.4, Q.h ).mul( 0.45 ).add( 0.55 ) ), wQ ) );
	let color = mix( clodCol, stoneCol, stone );
	// Shadowed voids between clods.
	const ao = smoothstep( - 0.5, 0.35, C.h ).mul( 0.85 ).add( 0.15 );
	const meanCol = mix( u.color, u.color2, 0.3 ).mul( 0.75 );
	color = mix( meanCol, color.mul( ao ), wC );

	// Roots: pale wavy fibres lying on the clods.
	const R = fibres( p, g.mul( 1.5 ), g.mul( 0.035 ), u.roots.mul( 0.6 ), fp, 7.7, 0.5 );
	const rootT = R.tone.mul( 0.5 ).add( 0.5 );
	const root = R.fiber.mul( fadeIn( g.mul( 0.08 ), fp, 1.0, 3.0 ) );
	color = mix( color, vec3( 0.22, 0.15, 0.09 ).mul( rootT ), root );

	// L2: silt texture and hyphae.
	const wS = fadeIn( g.mul( 0.004 ), fp, 2.0, 6.0 );
	const silt = fbm( p.div( g.mul( 0.004 ) ).add( 2.1 ), 3 );
	const Sv = voronoi( mod( p.div( g.mul( 0.003 ) ), 4096 ).add( 1.3 ), 0.9 );
	const sh = hash3( Sv.id1 );
	color = color.mul( silt.sub( 0.5 ).mul( 0.35 ).mul( wS ).add( 1 ) ).mul( sh.x.sub( 0.5 ).mul( 0.25 ).mul( wS ).add( 1 ) );
	const H = fibres( p, g.mul( 0.03 ), g.mul( 4e-4 ), float( 0.2 ), fp, 3.3 );
	const hypha = H.fiber.mul( fadeIn( g.mul( 0.003 ), fp, 1.5, 4.0 ) ).mul( mix( float( 0.3 ), float( 1 ), step( C.h, 0.4 ) ) );
	color = mix( color, vec3( 0.75, 0.72, 0.66 ), hypha.mul( 0.8 ) );

	const amp = u.relief.mul( 0.25 );
	const slope = C.grad.mul( amp ).mul( wC )
		.add( K.grad.mul( 0.2 ).mul( wK ) )
		.add( Q.grad.mul( 0.2 ).mul( wQ ) )
		.add( R.slope.mul( fadeIn( g.mul( 0.08 ), fp, 1.0, 3.0 ) ) )
		.add( sh.xy.sub( 0.5 ).mul( 0.3 ).mul( wS ) );
	const rough = mix( u.roughness, float( 0.45 ), sandG.mul( wK ).mul( 0.8 ) );
	const s2 = wC.oneMinus().mul( 0.1 ).mul( amp ).add( wK.oneMinus().mul( 0.03 ) ).add( wQ.oneMinus().mul( 0.03 ) );
	const cavity = smoothstep( 0.2, - 0.4, C.h ).mul( wC ).max( smoothstep( 0.1, - 0.3, K.h ).mul( wK ).mul( 0.5 ) );
	return { color, slope, cavity, rough, s2 };

}
