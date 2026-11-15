// Cactus stem (a barrel or column cactus).
//   L0 ribs     ribs size_mm (20 to 40 mm) apart along the stem (angle):
//               rounded crests, narrow furrows, crests swell a little at
//               each areole. Crests paler, furrows darker.
//   L1 areoles  felt cushions (2 to 4 mm, greyish wool) on the crests,
//               feature_mm (10 to 20 mm) apart. Each holds a cluster of
//               radial spines (6 to 12 mm, fiber_um thick at the base,
//               tapering) and one or two longer central spines: pale
//               straw with brown tips, a soft shadow on the skin.
//   L2 skin     a waxy cuticle: sunken stomata (40 um) every 0.15 mm,
//               epidermis cells (cell_um), wax crystals that dull it.
// Returns { color, slope, cavity, rough, s2, coat, glow } for shader.js.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, mod, cos, sin } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { rot2, cells, fbm, grains } from './common.js';

// One spine: segment from the areole centre, half width w0 at the base.
function spine( l, ang, len, w0, fp ) {

	const dir = vec2( cos( ang ), sin( ang ) );
	const t = clamp( l.dot( dir ), 0, len );
	const d = l.sub( dir.mul( t ) ).length();
	const w = w0.mul( float( 1 ).sub( t.div( len ) ).max( 0.08 ) );
	const wE = w.max( fp.mul( 0.5 ) );
	const c = clamp( wE.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( w.div( wE ) );
	return { c, t: t.div( len ), d, w, dir };

}

export function buildCactus( p, fp, u ) {

	const S = u.sizeM, L = u.featureM, s = u.seed;
	const a = rot2( p, u.angle ).add( vec2( s.mul( 0.011 ), 0 ) );
	// L0: ribs across x, a slow sway along the stem.
	const sway = fbm( vec2( 0, a.y ), float( 0.2 ), fp, 2, 3 ).sub( 0.5 ).mul( S.mul( 0.3 ) );
	const x = a.x.div( S ).add( sway.div( S ) );
	const rib = floor( x );
	const t = fract( x ).sub( 0.5 ); // 0 on the crest
	const shift = hash3( vec2( mod( rib, 4096 ), 1.3 ) );
	const row = a.y.div( L ).add( shift.x );
	const j = floor( row );
	const ty = fract( row ).sub( 0.5 );
	// Profile: rounded crest, steep furrow (1 - |2t|^1.6), tubercle swell.
	const at = t.abs().mul( 2 );
	const swell = smoothstep( 0.5, 0.0, ty.abs() ).mul( 0.25 );
	const h = float( 1 ).sub( at.pow( 1.6 ) ).mul( swell.add( 0.85 ) );
	const dhx = at.max( 1e-3 ).pow( 0.6 ).mul( - 1.6 * 2 ).mul( t.sign() ).div( S ).mul( swell.add( 0.85 ) );
	const dhy = ty.sign().negate().mul( smoothstep( 0.5, 0.1, ty.abs() ) ).mul( 0.5 ).div( L ).mul( float( 1 ).sub( at.pow( 1.6 ) ) );
	const amp = u.relief.mul( S ).mul( 0.25 ); // rib height, meters
	const ribSlope = vec2( dhx.mul( amp ), dhy.mul( amp ).mul( 0.25 ) );

	let color = mix( u.color3, u.color, smoothstep( 0.0, 0.7, h ) );
	color = mix( color, u.color2, smoothstep( 0.8, 1.0, h ).mul( 0.4 ) );
	color = color.mul( fbm( p, float( 0.05 ), fp, 3, 7 ).sub( 0.5 ).mul( u.colorVar.mul( 2 ) ).add( 1 ) );
	// Sun scars: pale corky patches here and there.
	const cork = smoothstep( 0.75, 0.82, fbm( p, float( 0.03 ), fp, 3, 13 ) ).mul( u.colorVar.mul( 3 ) ).min( 1 );
	color = mix( color, vec3( 0.45, 0.42, 0.33 ), cork.mul( 0.7 ) );

	// L2 skin: cells, sunken stomata, wax.
	const E = cells( p, u.cellM, fp, 4.7, { jitter: 0.85, crown: 0.4 } );
	color = color.mul( float( 1 ).sub( E.wall.mul( 0.15 ) ) ).mul( E.id.x.sub( 0.5 ).mul( 0.1 ).mul( E.w ).add( 1 ) );
	const St = grains( p, u.cellM.mul( 4 ), fp, 2.2, { gap: 0.3, radius: 0.2, round: 0.2, elong: 0.8 } );
	const stoma = step( 0.4, St.id.x ).mul( St.body ).mul( fadeIn( u.cellM.mul( 0.6 ), fp, 2.0, 5.0 ) );
	color = color.mul( float( 1 ).sub( stoma.mul( 0.35 ) ) );
	const waxy = valueNoise( p.div( u.cellM.mul( 0.2 ) ) );
	const wW = fadeIn( u.cellM.mul( 0.2 ), fp, 2.0, 5.0 );
	color = color.mul( waxy.sub( 0.5 ).mul( 0.15 ).mul( wW ).add( 1 ) );

	// L1: areoles and their spines (this one and its two neighbours).
	let wool = float( 0 ), spn = float( 0 ), tip = float( 0 ), shadow = float( 0 ), sSlope = vec2( 0 ), across = float( 0 ), along = float( 0 );
	for ( let k = - 1; k <= 1; k ++ ) {

		const jj = j.add( k );
		const hA = hash3( mod( vec2( rib, jj ), 4096 ).add( 5.5 ) );
		const ctr = vec2( rib.add( 0.5 ).mul( S ).sub( sway ), jj.add( 0.5 ).sub( shift.x ).mul( L ) ).add( hA.xy.sub( 0.5 ).mul( S.mul( 0.04 ) ) );
		const l = a.sub( ctr );
		const rA = hA.z.mul( 0.4 ).add( 0.8 ).mul( 2.2e-3 ).mul( u.fuzz.mul( 0.5 ).add( 0.5 ) ); // wool radius
		const dl = l.length();
		const woolA = smoothstep( rA, rA.mul( 0.6 ), dl.add( valueNoise( l.div( 3e-4 ) ).mul( 6e-4 ) ) );
		wool = wool.max( woolA );
		const nS = 9;
		for ( let i = 0; i < nS + 2; i ++ ) {

			const central = i >= nS;
			const hs = hash3( mod( vec2( rib.mul( 13 ).add( i ), jj ), 4096 ).add( 9.9 ) );
			const ang = central ? hs.x.mul( 6.283 ) : hs.x.sub( 0.5 ).mul( 0.5 ).add( i * 6.283 / nS ).add( hA.x.mul( 6.283 ) );
			const len = L.mul( central ? hs.y.mul( 0.35 ).add( 0.6 ) : hs.y.mul( 0.3 ).add( 0.3 ) ).mul( u.density.mul( 0.6 ).add( 0.6 ) );
			const w0 = u.fiberM.mul( central ? 1.4 : 1 );
			const on = step( hs.z, u.density.mul( 0.7 ).add( 0.3 ) );
			const sp = spine( l, ang, len, w0, fp );
			const c = sp.c.mul( on );
			const isTop = step( spn, c );
			spn = spn.max( c );
			tip = pick( isTop, smoothstep( 0.6, 0.95, sp.t ), tip );
			across = pick( isTop, clamp( l.dot( vec2( sp.dir.y.negate(), sp.dir.x ) ).div( sp.w.max( 1e-7 ) ), - 1, 1 ), across );
			along = pick( isTop, l.dot( sp.dir ), along );
			sSlope = pick( isTop, vec2( sp.dir.y.negate(), sp.dir.x ).mul( clamp( l.dot( vec2( sp.dir.y.negate(), sp.dir.x ) ).div( sp.w.max( 1e-7 ) ), - 1, 1 ) ).mul( - 0.8 ).mul( c ), sSlope );
			// Shadow on the skin, offset down and to the right.
			const sh = spine( l.sub( vec2( 3e-4, - 6e-4 ) ), ang, len, w0.mul( 2.5 ), fp.mul( 3 ).add( 2e-4 ) );
			shadow = shadow.max( sh.c.mul( on ) );

		}

	}

	// Wool: matted hairs, a tangle of short bright strokes.
	const tangle = valueNoise( rot2( a, valueNoise( a.div( 1e-3 ) ).mul( 6 ) ).div( vec2( 4e-5, 4e-4 ) ) );
	const woolCol = vec3( 0.55, 0.53, 0.48 ).mul( tangle.mul( 0.5 ).mul( fadeIn( float( 4e-5 ), fp, 1.0, 3.0 ) ).add( 0.75 ) );
	color = color.mul( float( 1 ).sub( shadow.mul( 0.45 ) ) );
	color = mix( color, woolCol, wool.mul( 0.95 ) );
	const spCol = mix( vec3( 0.46, 0.38, 0.24 ), vec3( 0.28, 0.15, 0.07 ), tip ).mul( float( 1 ).sub( across.mul( across ).mul( 0.5 ) ) )
		.mul( valueNoise( vec2( across.mul( 4 ), along.div( 2e-4 ) ) ).mul( 0.2 ).add( 0.9 ) );
	color = mix( color, spCol, spn );

	const slope = rot2( ribSlope.mul( spn.oneMinus() ).add( sSlope ), u.angle.negate() )
		.add( E.slope.mul( 0.15 ) ).add( St.grad.mul( - 0.3 ).mul( stoma ) );
	const rough = mix( u.roughness, float( 0.8 ), wool.max( cork ) ).add( wW.oneMinus().mul( u.wax ).mul( 0.1 ) );
	const s2 = E.s2.mul( 0.05 ).add( wW.oneMinus().mul( 0.02 ) );
	const cavity = smoothstep( 0.4, 0.0, h ).mul( 0.6 ).max( shadow.mul( 0.4 ) );
	return { color, slope, cavity, rough, s2, coat: u.wax.mul( 0.5 ).mul( wool.oneMinus() ).mul( spn.oneMinus() ), coatRough: float( 0.25 ), glow: u.color.mul( 0.5 ).mul( spn.max( wool ).oneMinus() ) };

}
