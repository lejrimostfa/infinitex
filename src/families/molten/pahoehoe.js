// Ropy pahoehoe (Hawaii): basalt at about 1420 K under a glassy skin a
// few mm thick, still red hot (900 to 1000 K). The melt beneath drags the
// skin forward; the front stalls, so the skin folds into ropes. Level by
// level:
//   L0 lobes     scale_mm (80 to 200 mm): toes of lava, each a dome with a
//                glowing seam where it broke out of its neighbour.
//   L1 ropes     size_mm (8 to 20 mm) apart: folds bent into arcs convex
//                downstream (the middle of a lobe moves fastest). Crests are
//                stretched, so the skin tears there: cracks open to the
//                orange melt. The ropes advance at flow_mm_s and fold under
//                at the lobe front.
//   L2 wrinkles  feature_mm (1 to 3 mm): small folds on the ropes, and
//                stretch marks across them.
//   L3 vesicles  cell_um (0.3 to 2 mm): gas bubbles, a few broken open
//                (they glow a little: the skin is thin there).
//   L4 glass     micro_um (30 to 100 um): plagioclase laths that glint in
//                the black glass; the fresh skin has a silver blue sheen.
// The skin moves with the melt (a pure translation inside each lobe), so
// every level slides without popping.

import { vec2, float, floor, fract, clamp, smoothstep, mix, mod, abs, cos } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { frame, fbm, vesicles, microlites } from './common.js';
import { radiance } from './heat.js';

export function buildPahoehoe( p, fp, u, t ) {

	const F = frame( p, u.angle );
	const L = u.scaleM, S = u.sizeM;
	// L0 lobes, longer along the flow.
	const lq = vec2( F.f.x.div( 1.4 ), F.f.y ).div( L ).add( fbm( p, L.mul( 0.5 ), fp, 2, 1 ).sub( 0.5 ).mul( 0.4 ) );
	const V = voronoi( mod( lq, 4096 ).add( u.seed.mul( 3.7 ) ), 0.8 );
	const lh = hash3( V.id1.add( 1.3 ) );
	const seamW = float( 0.0006 ).add( lh.x.mul( 0.0012 ) );
	const seam = clamp( seamW.sub( V.edge.mul( L ) ).div( fp ).add( 0.5 ), 0, 1 ).toVar();
	const lobe = smoothstep( 0.0, 0.35, V.edge );
	// Lobe frame: x along the flow from the lobe centre, y across.
	const c = V.toSeed.mul( vec2( 1.4, 1 ) ).mul( L );
	const across = c.y.div( L.mul( 0.5 ) );
	// The skin moves with the melt. The middle of a lobe ran ahead while the
	// ropes formed, so they are bent (a steady shape that slides along).
	const sx = c.x.sub( u.flow.mul( t ) );

	// L1 ropes: arcs convex downstream, wavy, of varying spacing.
	const bend = across.mul( across ).mul( L ).mul( 0.35 );
	const wob = fbm( vec2( sx, c.y ).add( lh.yz.mul( 0.2 ) ), S.mul( 5 ), fp, 2, 2 ).sub( 0.5 ).mul( S ).mul( 0.6 );
	const ph = sx.add( bend ).add( wob ).div( S );
	const fr = fract( ph );
	// Rope profile: round crest, narrow trough (skin pushed together).
	const rope = float( 0.5 ).sub( cos( fr.mul( 6.2832 ) ).mul( 0.5 ) ).pow( 0.7 );
	const wR = fadeIn( S, fp, 2.0, 6.0 );
	// Ropes grow toward the front of a lobe, die out at its rear.
	const amp = smoothstep( - 0.6, 0.4, c.x.div( L ) ).mul( lobe ).mul( 0.8 ).add( 0.2 );
	// Cracks on the crests: torn where stretched, in short runs.
	const run = valueNoise( vec2( c.y.div( S.mul( 1.5 ) ), floor( ph ).add( lh.z.mul( 50 ) ) ) );
	const crestD = abs( fr.sub( 0.5 ) ).mul( S );
	const cw = smoothstep( 0.45, 0.8, run ).mul( S ).mul( 0.04 ).mul( u.cover.oneMinus().mul( 2 ).add( 0.5 ) );
	const crack = clamp( cw.sub( crestD ).div( fp ).add( 0.5 ), 0, 1 ).mul( fadeIn( S, fp, 1.5, 4.0 ) ).toVar();

	// L2 wrinkles along the ropes, stretch marks across.
	const skinP = vec2( sx, c.y ).add( lh.xy.mul( 0.2 ) );
	const wn = fbm( vec2( ph.mul( S ).mul( 0.5 ), c.y ), u.featureM, fp, 3, 3 );
	const wW = fadeIn( u.featureM, fp, 1.5, 5.0 );
	const marks = fbm( vec2( skinP.x.mul( 4 ), skinP.y.mul( 0.5 ) ), u.featureM, fp, 2, 4 );

	// L3, L4.
	const Ve = vesicles( skinP, fp, u.cellM, 0.3, 31 );
	const Mi = microlites( skinP, fp, u.microM, 41, 0.15, 0.6 );

	// Height (meters): lobe domes, ropes, wrinkles. surfaceGradient turns it
	// into a slope; it is resolved wherever it shows (a few pixels wide).
	const h = lobe.mul( L ).mul( 0.03 )
		.add( rope.mul( amp ).mul( S ).mul( 0.22 ).mul( wR ) )
		.add( wn.mul( u.featureM ).mul( 0.25 ).mul( wW ) )
		.add( marks.mul( u.featureM ).mul( 0.05 ).mul( wW ) );
	const skin = float( 1 ).sub( crack.max( seam ) );
	const gl = Ve.slope.add( Mi.slope.mul( 0.5 ) ).mul( skin );
	const slope = surfaceGradient( h, p ).mul( skin ).add( F.toP( gl ) );

	// Colour: black glass, a silver blue sheen on the crests.
	const sheen = rope.mul( amp ).mul( wR ).add( valueNoise( skinP.div( S.mul( 2 ) ) ).mul( 0.4 ) ).clamp( 0, 1 );
	const tone = lh.y.sub( 0.5 ).mul( u.colorVar ).add( 1 );
	let col = mix( u.color, u.color2, sheen.mul( 0.6 ) ).mul( tone );
	col = col.mul( float( 1 ).sub( Ve.pit.mul( 0.6 ) ) ).add( Mi.on.mul( 0.01 ) );
	const color = mix( col, u.color.mul( 0.4 ), float( 1 ).sub( skin ) );

	// Light: the skin is hotter in the troughs (thicker melt beneath, less
	// cooling surface) and where it is thin: crests near a tear, broken
	// vesicles, the lobe seams. Melt in the tears at melt_k.
	const near = crestD.sub( cw ).max( 0 ).div( S.mul( 0.06 ) ).negate().exp().mul( smoothstep( 0.35, 0.6, run ) );
	const Ts = u.crustK.add( float( 1 ).sub( rope ).mul( wR ).mul( 50 ) ).add( fbm( skinP, S.mul( 2 ), fp, 2, 5 ).sub( 0.5 ).mul( 140 ) )
		.add( near.mul( u.meltK.sub( u.crustK ).mul( 0.4 ) ) );
	const Tm = u.meltK.sub( fbm( skinP, float( 0.004 ), fp, 2, 6 ).mul( 80 ) );
	const hot = crack.max( seam ).max( Ve.pit.mul( 0.06 ) );
	const emissive = mix( radiance( Ts, u ), radiance( Tm, u ), hot );

	return {
		color, slope, emissive,
		rough: mix( u.roughness, float( 0.12 ), float( 1 ).sub( skin ) ), s2: Ve.s2.add( Mi.s2 ).add( wW.oneMinus().mul( 0.006 ) ),
		cavity: float( 1 ).sub( rope ).mul( amp ).mul( 0.5 ).max( Ve.pit ).max( crack ),
	};

}
