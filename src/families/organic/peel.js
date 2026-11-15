// Fruit peels with a waxy cuticle: orange and apple.
// Orange (citrus):
//   L0 peel     colour drifts, greener patches, pale wind scars, a slow
//               waviness of the rind (2 to 3 cm)
//   L1 glands   oil glands under the peel, size_mm (0.8 to 1.5 mm) apart.
//               The peel bulges between them; over each gland a dimple,
//               darker and translucent (oil seen through the skin).
//   L2 cells    flavedo cells (cell_um, 20 to 30 um), stomata (oval, 25
//               um, a dark slit) every 0.15 mm, specks of wax
// Apple:
//   L0 colour   a smooth red blush over a yellow green ground; where the
//               blush is partial, soft short stripes along the stem axis
//               (1 to 2 mm wide); a faint matt bluish wax bloom
//   L1 lenticels pale dots (0.2 to 0.6 mm) about size_mm (2 to 4 mm) apart,
//               a pale halo on red skin; shallow dents in the skin
//   L2 cuticle  epidermal cells (cell_um, 20 to 40 um) under the wax, flat
//               wax plates (3 to 8 um) with cracks, a cork crater in each
//               lenticel
// Returns { color, slope, cavity, rough, s2, coat } for shader.js.

import { vec2, vec3, float, mix, smoothstep, step, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { rot2, cells, fbm, grains } from './common.js';

export function buildCitrus( p, fp, u ) {

	const g = u.sizeM, s = u.seed;
	// L0: drifts, greener patches near where the fruit hid from the sun.
	const drift = fbm( p, float( 0.06 ), fp, 3, 1 );
	const green = smoothstep( 0.55, 0.8, fbm( p.add( s ), float( 0.1 ), fp, 2, 4 ) ).mul( u.colorVar.mul( 2 ) );
	const scar = smoothstep( 0.72, 0.8, fbm( p, float( 0.025 ), fp, 4, 9 ) ).mul( u.wax.mul( 0.5 ).add( 0.3 ) );
	let color = mix( u.color, u.color2, green ).mul( drift.sub( 0.5 ).mul( 0.25 ).add( 1 ) );
	const wave = vec2( fbm( p, float( 0.025 ), fp, 2, 11 ), fbm( p, float( 0.025 ), fp, 2, 13 ) ).sub( 0.5 ).mul( 0.08 );

	// L1: glands. Rounded bulges between, a dimple over each gland.
	const V = voronoi( mod( p.div( g ), 4096 ).add( 2.1 ), 0.9 );
	const gid = hash3( V.id1.add( 4.4 ) );
	const wG = fadeIn( g, fp, 1.0, 4.0 );
	// A round dome per gland cell (paraboloid), creased where cells meet.
	const r = V.toSeed.length();
	const Gh = float( 1 ).sub( r.mul( r ).mul( 2.2 ) );
	const G = { h: Gh, grad: V.toSeed.mul( - 4.4 ), id: gid, v: V };
	const pitR = G.id.y.mul( 0.08 ).add( 0.1 ).mul( u.density.add( 0.5 ) );
	const pit = smoothstep( pitR, pitR.mul( 0.3 ), r ).mul( wG );
	const dPit = G.v.toSeed.div( r.max( 1e-3 ) ).mul( smoothstep( pitR, 0, r ).mul( smoothstep( 0, pitR.mul( 0.5 ), r ) ) ).mul( 1.2 );
	color = color.mul( smoothstep( - 0.6, 1.0, G.h ).mul( 0.3 ).mul( wG ).add( float( 1 ).sub( wG.mul( 0.2 ) ) ) );
	color = mix( color, color.mul( vec3( 0.62, 0.48, 0.3 ) ), pit.mul( 0.8 ) );
	// A few dark specks (old oil spots, rind blemishes), 1 to 2 mm.
	const Sp = grains( p, float( 0.012 ), fp, 9.4, { gap: 0.3, radius: 0.12, round: 0.3 } );
	color = mix( color, u.color3.mul( 0.6 ), step( 0.85, Sp.id.x ).mul( Sp.body ).mul( 0.6 ) );
	color = mix( color, u.color3, scar.mul( 0.6 ) );
	// Far: the bulges and pits average to a slightly darker peel.
	color = color.mul( wG.oneMinus().mul( - 0.08 ).add( 1 ) );

	// L2: flavedo cells, stomata, wax specks.
	const F = cells( p, u.cellM, fp, 7.7, { jitter: 0.8, crown: 0.4 } );
	color = color.mul( float( 1 ).sub( F.wall.mul( 0.15 ) ) ).mul( F.id.x.sub( 0.5 ).mul( 0.1 ).mul( F.w ).add( 1 ) );
	const st = grains( p, u.cellM.mul( 5 ), fp, 4.4, { gap: 0.3, radius: 0.18, round: 0.2, elong: 1.2 } );
	const stoma = step( 0.6, st.id.x ).mul( st.body ).mul( fadeIn( u.cellM, fp, 2.0, 5.0 ) );
	const slit = smoothstep( 0.06, 0.0, st.v.toSeed.length() ).mul( stoma );
	color = color.mul( float( 1 ).sub( stoma.mul( 0.15 ) ).sub( slit.mul( 0.5 ) ) );

	const amp = u.relief.mul( 0.12 );
	const slope = wave.add( G.grad.mul( amp ).mul( wG ) ).add( dPit.mul( amp ).mul( wG ) )
		.add( F.slope.mul( 0.15 ) ).add( st.grad.mul( - 0.2 ).mul( stoma ) );
	const rough = mix( u.roughness, u.roughness.add( 0.25 ), scar ).add( F.w.oneMinus().mul( 0.03 ) );
	const s2 = wG.oneMinus().mul( 0.05 ).mul( amp ).add( F.s2.mul( 0.05 ) );
	const cavity = pit.mul( 0.6 ).max( smoothstep( 0.2, - 0.6, G.h ).mul( wG ).mul( 0.5 ) );
	// Oil and the thick peel let light in; the glands glow a little.
	const glow = color.mul( pit.mul( 0.5 ).add( 0.6 ) );
	return { color, slope, cavity, rough, s2, coat: u.wax.mul( 0.4 ), coatRough: float( 0.2 ), glow };

}

export function buildApple( p, fp, u ) {

	const g = u.sizeM, s = u.seed;
	const a = rot2( p, u.angle );
	// L0: a smooth blush over the yellow green ground (a broad gradient
	// plus slow patches), then fine soft stripes 1 to 2 mm wide and 1 to
	// 3 cm long. Stripes show where the blush is partial: a full blush is
	// solid red, the ground stays clean.
	const grad = a.y.div( 0.3 ).clamp( 0, 1 );
	const patch = fbm( p.add( s ), float( 0.15 ), fp, 2, 3 );
	const blush = smoothstep( 0.42, 0.62, grad.mul( 0.7 ).add( patch.mul( 0.6 ) ).sub( 0.1 ) ).mul( u.blush ).toVar();
	const st = fbm( vec2( a.x.mul( 15 ), a.y ).add( s ), float( 0.02 ), fp, 2, 11 );
	const partial = blush.mul( blush.oneMinus() ).mul( 4 );
	const red = blush.add( st.sub( 0.5 ).mul( 0.5 ).mul( partial ).mul( u.streaks ) ).clamp( 0, 1 ).toVar();
	let color = mix( u.color2, u.color, red );
	// Deeper red at the heart of the blush.
	color = mix( color, u.color3, smoothstep( 0.75, 1.0, red ).mul( smoothstep( 0.55, 0.8, patch ) ).mul( 0.35 ) );
	color = color.mul( fbm( p, float( 0.02 ), fp, 2, 5 ).sub( 0.5 ).mul( 0.08 ).add( 1 ) );

	// L1: lenticels, pale dots with a halo on the red skin.
	const L = voronoi( mod( p.div( g ), 4096 ).add( 3.3 ), 0.9 );
	const lh = hash3( L.id1.add( 1.7 ) );
	const lr = lh.x.mul( 0.04 ).add( 0.025 ).mul( u.density.add( 0.5 ) ); // radius, cells
	const dl = L.toSeed.mul( vec2( 1, lh.y.mul( 0.6 ).add( 0.7 ) ) ).length();
	const wL = fadeIn( g.mul( lr ), fp, 0.6, 2.0 );
	const dot = smoothstep( lr, lr.mul( 0.6 ), dl ).mul( wL );
	const halo = smoothstep( lr.mul( 3.5 ), lr, dl ).mul( red ).mul( wL );
	// Far: dots too small to draw lighten the skin a little.
	const meanDot = wL.oneMinus().mul( 0.06 ).mul( u.density );
	color = mix( color, mix( color, u.color2.mul( 1.1 ), 0.6 ), halo.mul( 0.25 ).add( meanDot ) );
	// Cork inside the lenticel: tan, grainy, a darker crater at the heart.
	const corky = valueNoise( L.toSeed.div( lr.mul( 0.25 ) ).add( lh.xy.mul( 20 ) ) );
	color = mix( color, vec3( 0.55, 0.46, 0.3 ).mul( corky.mul( 0.4 ).add( 0.8 ) ), dot.mul( 0.5 ) );
	const crater = smoothstep( lr.mul( 0.45 ), lr.mul( 0.1 ), dl ).mul( fadeIn( g.mul( lr ).mul( 0.3 ), fp, 2.0, 5.0 ) );
	color = mix( color, vec3( 0.3, 0.2, 0.1 ), crater.mul( corky ).mul( 0.7 ) );
	const dent = vec2( fbm( p, float( 0.03 ), fp, 2, 21 ), fbm( p, float( 0.03 ), fp, 2, 23 ) ).sub( 0.5 ).mul( 0.06 );

	// Wax bloom: a faint matt bluish haze, thicker in patches.
	const bloom = smoothstep( 0.3, 0.9, fbm( p.add( 3.3 ), float( 0.06 ), fp, 3, 7 ) ).mul( u.wax ).mul( 0.6 ).add( u.wax.mul( 0.1 ) );
	color = mix( color, color.mul( 0.75 ).add( vec3( 0.07, 0.075, 0.09 ) ), bloom.mul( 0.5 ) );

	// L2: epidermal cells (cell_um) seen through the cuticle, and on top
	// the wax: flat plates of 3 to 8 um with fine cracks between them.
	const E = cells( p, u.cellM, fp, 6.6, { jitter: 0.85, crown: 0.5 } );
	color = color.mul( float( 1 ).sub( E.wall.mul( 0.3 ) ) ).mul( E.id.z.sub( 0.5 ).mul( 0.25 ).mul( E.w ).mul( red.mul( 0.7 ).add( 0.3 ) ).add( 1 ) );
	const W = cells( p, u.cellM.mul( 0.18 ), fp, 9.2, { jitter: 0.9, crown: 0.15, wallM: u.cellM.mul( 0.008 ) } );
	color = mix( color, color.mul( 0.8 ).add( vec3( 0.06 ) ), W.w.mul( W.id.x.mul( 0.25 ).add( 0.05 ) ) ).mul( float( 1 ).sub( W.wall.mul( 0.25 ) ) );
	const wW = W.w;
	const wp = W.id.y;

	const slope = dent.mul( u.relief ).add( L.toSeed.mul( - 0.8 ).mul( dot ).mul( u.relief ) )
		.add( E.slope.mul( 0.12 ) ).add( W.slope.mul( 0.15 ) ).add( vec2( wp.sub( 0.5 ), W.id.z.sub( 0.5 ) ).mul( 0.12 ).mul( wW ) );
	const rough = mix( u.roughness, float( 0.65 ), bloom ).add( dot.mul( 0.3 ) );
	const s2 = E.s2.mul( 0.03 ).add( wW.oneMinus().mul( 0.01 ).add( bloom.mul( 0.02 ) ) );
	return { color, slope, cavity: crater.mul( 0.5 ), rough, s2, coat: float( 0.6 ).mul( bloom.oneMinus() ), coatRough: float( 0.12 ) };

}
