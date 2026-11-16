// Mould colonies spreading on a slice of bread. Spores land at different
// times (size_mm apart); each colony grows outward at a steady rate, so
// it stays round. By distance behind its edge:
//   runners  single hyphae run ahead of the edge over a few mm
//   fringe   the young edge: a white fluffy band of aerial mycelium
//   spores   behind it the colony sporulates: blue green (Penicillium)
//            or grey black (Rhizopus), the colour coming in over front_mm
//   rings    growth rings (zonation): denser and paler bands laid down at
//            fixed radii, so they stay where they formed
//   meeting  where two colonies meet they stop: a thin line of bare
//            bread between them
// Fine levels: hyphae (fiber_um), spore heads (feature_mm, 50 to 150 um)
// on stalks. Bread crumb from organic/bread.js: air cells of 0.3 to
// 3 mm, thin walls, starch granules of 20 um. Same look as organic/soil.js mould, here growing.

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod, fract, abs } from 'three/tsl';
import { fadeIn, fadeOn, gate, surfaceGradient } from '../../core/lod.js';
import { arrival, heroSeed, rough, ageMeters } from '../../core/front.js';
import { fbm } from '../stone/common.js';
import { grains, fibres } from '../ground/grains.js';
import { buildCrumb } from '../organic/bread.js';

export function buildMould( p, fp, u, prog ) {

	const g = u.sizeM, s = u.seed;
	const q = p.div( g );
	const A = arrival( q.add( s.mul( 0.77 ) ), { jitter: 0.85, delay: 0.9, salt: 15 } );
	const H = heroSeed( q, g, [ 0.2, 0.3 ] );
	const isHero = step( H, A.t1 );
	const T1 = A.t1.min( H );
	const T = T1.add( rough( p, g, fp, { top: 0.06, amp: 0.3, oct: 10, minM: 2e-5, salt: 4 } ) ).toVar();
	const F = ageMeters( T, prog.mul( 1.05 ).sub( 0.12 ), g, p, fp );
	const age = F.age, W = u.frontM;

	// Bread crumb: the crumb of organic/bread.js (air cells, walls, starch).
	const B = buildCrumb( p, fp, { sizeM: float( 2.5e-3 ), seed: s, angle: float( 1.57 ), colorVar: float( 0.1 ), color: u.color3,
		density: float( 0.6 ), cellM: float( 2e-5 ), relief: u.relief, roughness: u.roughness } );
	let col = B.color;

	// Colony zones.
	const cov = F.aa( float( 0 ) ).toVar();
	const meet = smoothstep( 0.012, 0.004, A.t2.sub( A.t1 ) ).mul( isHero.oneMinus() ).mul( cov );
	const spore = smoothstep( W.mul( 0.25 ), W, age ).mul( cov ).mul( meet.oneMinus() ).toVar();
	const fringe = cov.mul( spore.oneMinus() ).mul( meet.oneMinus() ).toVar();
	// Rings at fixed radii, period front_mm * 0.6.
	const rP = W.mul( 0.6 ).div( g );
	const rd = abs( fract( T1.div( rP ).add( fbm( p.add( 6.3 ), float( 8e-3 ), fp, 3, 2 ).mul( 0.6 ) ) ).sub( 0.5 ) ).mul( rP ).mul( g );
	const ring = smoothstep( W.mul( 0.2 ), W.mul( 0.02 ), rd ).mul( fadeIn( W.mul( 0.6 ), F.fpA, 2.0, 6.0 ) )
		.mul( fbm( p.add( 2.4 ), float( 0.01 ), fp, 2, 7 ).mul( 0.8 ).add( 0.2 ) );
	// Kind per colony: Penicillium (blue green) or Rhizopus (grey black).
	const kind = step( 0.65, A.h.y ).mul( isHero.oneMinus() );
	const sporeC = mix( u.color2, vec3( 0.07, 0.07, 0.075 ), kind ).mul( fbm( p.add( 7.7 ), float( 2e-3 ), fp, 3, 6 ).mul( 0.4 ).add( 0.8 ) );
	const white = u.color4.mul( fbm( p.add( 4.4 ), float( 1.5e-3 ), fp, 4, 8 ).mul( 0.2 ).add( 0.88 ) );
	col = mix( col, white.mul( 0.8 ), fringe.mul( 0.92 ) ); // felt: shaded gaps between hyphae
	col = mix( col, mix( sporeC, white.mul( 0.85 ), ring.mul( 0.14 ) ), spore );

	// Hyphae: runners ahead of the edge, a felt inside.
	const ahead = smoothstep( W.mul( - 0.5 ), float( 0 ), age ).mul( cov.oneMinus() );
	// The hyphae show only on and just ahead of a colony, and only while
	// a pixel is under about 4 hyphae widths (their fibres() fade): the
	// gate skips the three nets elsewhere.
	const reach = ahead.mul( 0.9 ).add( fringe ).add( spore.mul( 0.3 ) ).toVar();
	const Hy = gate( reach.greaterThan( 0 ).and( fadeOn( u.fiberM, fp, 0.7 ) ), { thread: 0, hS: [ 0, 0 ] }, () => {

		const H1 = fibres( p, u.fiberM.mul( 40 ), u.fiberM.mul( 0.5 ), float( 0.8 ), fp, 3.3, 0.8 );
		const H2 = fibres( p, u.fiberM.mul( 14 ), u.fiberM.mul( 0.5 ), float( 0.7 ), fp, 7.9, 0.8 );
		const H3 = fibres( p.add( 1e-4 ), u.fiberM.mul( 7 ), u.fiberM.mul( 0.45 ), float( 0.8 ), fp, 2.2, 0.9 );
		const thread = H1.fiber.max( H2.fiber ).max( H3.fiber.mul( fringe ) ).mul( reach ).min( 1 );
		return { thread, hS: H1.slope.add( H2.slope ).mul( 0.4 ).mul( thread ) };

	}, [ p, fp, reach, fringe ] );
	const thread = Hy.thread;
	col = mix( col, white.mul( 1.1 ), thread.mul( 0.9 ) );
	// Spore heads on the sporulating part, under featureM / 1.5 per pixel.
	const Sp = gate( spore.greaterThan( 0 ).and( fadeOn( u.featureM, fp, 1.5 ) ), { head: 0, shh: 0, shS: [ 0, 0 ] }, () => {

		const Sh = grains( p, u.featureM, fp, 6.1, { gap: 0.35, radius: 0.3, round: 0.5, crown: 0.8 } );
		const head = Sh.body.mul( step( 0.35, Sh.id.x ) ).mul( spore ).mul( fadeIn( u.featureM, fp, 1.5, 4.0 ) );
		return { head, shh: Sh.h, shS: Sh.grad.mul( 0.6 ).mul( head ) };

	}, [ p, fp, spore ] );
	const head = Sp.head;
	col = mix( col, sporeC.mul( Sp.shh.mul( 0.5 ).add( 0.55 ) ), head.mul( 0.9 ) );

	// Relief: crumb, then the colony mound rising behind its edge.
	const mound = smoothstep( float( 0 ), W.mul( 0.5 ), age ).mul( 4e-4 ).mul( meet.oneMinus() );
	const slope = surfaceGradient( mound, p ).add( B.slope.mul( cov.mul( 0.8 ).oneMinus() ) )
		.add( Hy.hS ).add( Sp.shS ).mul( u.relief );
	const felt = cov.max( ahead.mul( 0.3 ) );
	const s2 = felt.mul( fadeIn( u.fiberM.mul( 14 ), fp, 1.0, 3.0 ).oneMinus() ).mul( 0.1 ).add( B.s2.mul( cov.oneMinus() ) );
	return { color: col, slope, cavity: B.cavity.mul( cov.oneMinus() ).add( spore.mul( 0.2 ) ), rough: mix( u.roughness, float( 0.95 ), felt ), s2 };

}
