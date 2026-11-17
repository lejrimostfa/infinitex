// Soft fruit skins: strawberry and peach.
// Strawberry (berry):
//   L0 fruit    red flesh, deeper red in the pits, a few paler zones;
//               the achenes make a dotted net readable from afar
//   L1 achenes  the true fruits: yellow to brown seeds 1 to 1.5 mm long,
//               size_mm (3 to 5 mm) apart on a staggered net, each in a
//               pit; the flesh bulges between them, wet and glossy
//   L2 hairs    tiny hairs (feature_mm long, fiber_um thick) near the
//               achenes, the bulging epidermis cells (cell_um, 60 um),
//               the ridged husk of each achene
// Peach:
//   L0 skin     a smooth gradient of red blush into yellow orange, tiny
//               freckles (0.2 to 0.5 mm) where the blush fades
//   L1 fuzz     four layers of fine hairs (trichomes, fiber_um 10 to 20 um,
//               feature_mm 0.3 to 1 mm long) lying combed along a slow
//               flow; unresolved, they are the velvet sheen and a haze
//   L2 cells    epidermis cells (cell_um), stomata, the hair bases
// Returns { color, slope, cavity, rough, s2, sheen, coat, glow }.

import { vec2, vec3, float, mix, smoothstep, step, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { rot2, cells, fbm, grains, hairs } from './common.js';

export function buildBerry( p, fp, u ) {

	const g = u.sizeM, s = u.seed;
	// Staggered net: a skewed square grid (achenes sit on spirals).
	const a = rot2( p, u.angle ).div( g );
	const q = vec2( a.x.sub( a.y.mul( 0.577 ) ), a.y.mul( 1.1547 ) );
	const V = voronoi( wrapCoord( q ).add( s.mul( 7 ) ), 0.6 );
	const id = hash3( V.id1.add( 2.9 ) );
	const t = V.toSeed;
	const off = vec2( t.x.add( t.y.mul( 0.5 ) ), t.y.mul( 0.866 ) ); // back to cells of the fruit
	// Pit around the achene, a teardrop opening down the fruit; the
	// flesh bulges between pits.
	const po = vec2( off.x, off.y.add( 0.06 ) ).mul( vec2( 1, smoothstep( - 0.4, 0.2, off.y ).mul( 0.4 ).add( 0.75 ) ) );
	const r = po.length();
	const pitR = id.z.mul( 0.06 ).add( 0.3 );
	const pit = smoothstep( pitR, pitR.mul( 0.35 ), r );
	const dPit = po.div( r.max( 1e-3 ) ).mul( smoothstep( pitR, pitR.mul( 0.3 ), r ) ).mul( 1.1 );
	// Achene: a small ellipse pointing down the fruit, tilted a little.
	const ac = rot2( off, id.x.sub( 0.5 ).mul( 0.6 ) );
	const ae = vec2( ac.x.div( 0.1 ), ac.y.sub( 0.02 ).div( 0.16 ) );
	const ar = ae.length();
	const wA = fadeIn( g.mul( 0.2 ), fp, 1.0, 3.0 );
	const achene = smoothstep( 1.0, 0.85, ar ).mul( step( id.y, u.density.mul( 0.4 ).add( 0.6 ) ) ).toVar();
	const dome = ae.mul( - 0.6 ).mul( achene );

	// L0: flesh colour, deeper in the pits.
	const ripe = fbm( p, float( 0.08 ), fp, 3, 3 ).sub( 0.5 ).mul( u.colorVar.mul( 2 ) );
	let color = u.color.mul( ripe.add( 1 ) );
	color = mix( color, u.color3, pit.mul( 0.55 ).mul( wA.mul( 0.6 ).add( 0.4 ) ) );
	color = mix( color, u.color.mul( vec3( 1.35, 1.15, 1.1 ) ), smoothstep( 0.45, 0.6, r ).mul( 0.25 ) );
	// Achene: yellow, browner and ridged at its tip.
	const ridge = valueNoise( ac.mul( vec2( 60, 8 ) ).add( id.xy.mul( 30 ) ) );
	const aCol = mix( u.color2, u.color2.mul( vec3( 0.6, 0.38, 0.2 ) ), smoothstep( - 0.05, 0.14, ac.y ).mul( id.z.mul( 0.5 ).add( 0.3 ) ) )
		.mul( ridge.mul( 0.25 ).mul( fadeIn( g.mul( 0.01 ), fp, 2.0, 5.0 ) ).add( 0.88 ) );
	// Far: achenes too small to draw mix into the flesh.
	color = mix( color, mix( u.color, u.color2, 0.12 ), wA.oneMinus().mul( 0.2 ) );
	color = mix( color, aCol, achene.mul( wA ) );

	// L2: epidermis cells, tiny hairs near the achenes.
	const E = cells( p, u.cellM, fp, 4.2, { jitter: 0.85, crown: 0.7 } );
	color = color.mul( float( 1 ).sub( E.wall.mul( 0.2 ) ) ).mul( E.id.x.sub( 0.5 ).mul( 0.12 ).mul( E.w ).add( 1 ) );
	const H0 = hairs( p, u.featureM.mul( 0.8 ), u.fiberM, u.fuzz.mul( pit.mul( 0.6 ).add( 0.1 ) ), fp, 3.3, u.angle.add( 1.57 ), 0.6 );
	const H = { fiber: H0.cover, slope: H0.slope };
	color = mix( color, color.mul( 0.5 ).add( vec3( 0.4, 0.33, 0.3 ) ), H.fiber.mul( 0.5 ) );
	const flesh = achene.mul( wA ).oneMinus();

	const amp = u.relief.mul( 0.5 );
	const slope = rot2( dPit.mul( amp ).mul( wA ).add( dome.mul( amp ).mul( wA ) ), u.angle.negate() )
		.add( E.slope.mul( 0.35 ).mul( flesh ) ).add( H.slope.mul( 0.4 ) );
	// The flesh is wet and glossy; achenes and hairs are dry.
	const rough = mix( u.roughness, float( 0.55 ), achene.mul( wA ).max( H.fiber ) );
	const s2 = wA.oneMinus().mul( 0.04 ).mul( amp ).add( E.s2.mul( 0.15 ) );
	const cavity = pit.mul( 0.6 ).mul( flesh );
	return { color, slope, cavity, rough, s2, coat: flesh.mul( 0.5 ), coatRough: float( 0.1 ), glow: u.color.mul( 0.8 ) };

}

export function buildPeach( p, fp, u ) {

	const s = u.seed;
	// L0: a smooth gradient of blush across the fruit (the sun side),
	// softened by one slow octave; tiny freckles thicken where it fades.
	const a = rot2( p, u.angle );
	const b = a.y.div( 0.3 ).add( fbm( p.add( s ), float( 0.18 ), fp, 2, 3 ).sub( 0.5 ).mul( 0.6 ) );
	const blush = smoothstep( 0.2, 0.75, b ).mul( u.blush );
	const edge = smoothstep( 0.1, 0.4, b ).mul( smoothstep( 0.85, 0.45, b ) );
	const F = grains( p, float( 0.0012 ), fp, 6.6, { gap: 0.1, radius: 0.22, round: 0.3, sizeVar: 1 } );
	const freckle = step( F.id.x, edge.mul( 0.45 ).add( blush.mul( 0.1 ) ) ).mul( F.body ).mul( F.id.z.mul( 0.5 ).add( 0.35 ) ).mul( fadeIn( float( 3e-4 ), fp, 1.0, 3.0 ) );
	let color = mix( u.color2, u.color, blush );
	color = mix( color, u.color3, freckle.mul( 0.8 ) ).mul( fbm( p, float( 0.03 ), fp, 2, 8 ).sub( 0.5 ).mul( 0.06 ).add( 1 ) );

	// L2 under the fuzz: epidermis cells, stomata.
	const E = cells( p, u.cellM, fp, 2.4, { jitter: 0.85, crown: 0.4 } );
	color = color.mul( float( 1 ).sub( E.wall.mul( 0.15 ) ) ).mul( E.id.x.sub( 0.5 ).mul( 0.1 ).mul( E.w ).add( 1 ) );

	// L1: fuzz, four layers of hairs combed along a slow flow; pale and
	// translucent, so they lighten the skin, the lower ones less.
	const L = u.featureM;
	const flow = u.angle.add( fbm( p, float( 0.01 ), fp, 2, 9 ).sub( 0.5 ).mul( 5 ) );
	const hairCol = mix( vec3( 0.85, 0.78, 0.62 ), color, 0.45 );
	let hair = float( 0 ), hSlope = vec2( 0 );
	for ( let i = 0; i < 4; i ++ ) {

		const H = hairs( p.add( vec2( i * 3.1e-4, i * 7.3e-4 ) ), L.mul( 0.45 - i * 0.05 ), u.fiberM.mul( 0.5 - i * 0.06 ), u.fuzz.mul( u.paintedShare ), fp, 1.1 + i * 4.7, flow, 0.45 );
		// Tips are thinner and catch more light.
		color = mix( color, hairCol.mul( H.tone.mul( 0.2 ).add( 0.85 ) ).mul( H.t.mul( 0.15 ).add( 0.95 ) ), H.cover.mul( 0.25 + i * 0.07 ) );
		hSlope = hSlope.add( H.slope.mul( 0.4 ) );
		hair = hair.max( H.cover );

	}

	// Mid and far: the unresolved felt is a pale haze with a fine grain
	// (hair density varies from spot to spot), fading out as the hairs
	// themselves resolve.
	const wH = fadeIn( u.fiberM.mul( 2 ), fp, 0.7, 2.0 );
	const fz = fbm( p, L.mul( 0.25 ), fp, 3, 13 );
	color = mix( color, hairCol, wH.oneMinus().mul( u.fuzz ).mul( fz.mul( 0.12 ).add( 0.06 ) ) );

	const dent = vec2( fbm( p, float( 0.02 ), fp, 2, 21 ), fbm( p, float( 0.02 ), fp, 2, 23 ) ).sub( 0.5 ).mul( 0.05 );
	const slope = dent.mul( u.relief ).add( E.slope.mul( 0.2 ).mul( hair.oneMinus() ) )
		.add( hSlope ).add( vec2( fz.sub( 0.5 ), fz.sub( 0.5 ).mul( - 0.6 ) ).mul( 0.15 ).mul( wH.oneMinus() ).mul( u.fuzz ) );
	// Velvet: the hairs scatter at grazing angles (sheen), the skin is matte.
	const sheen = mix( vec3( 1.0, 0.85, 0.7 ), color.mul( 1.4 ), 0.75 ).mul( u.sheen ).mul( u.fuzz ).mul( fz.mul( 0.4 ).add( 0.8 ) );
	return { color, slope, cavity: freckle.mul( 0.2 ), rough: u.roughness, s2: E.s2.mul( 0.1 ).add( wH.oneMinus().mul( 0.04 ) ), sheen, sheenRough: float( 0.45 ), glow: color.mul( 0.6 ) };

}
