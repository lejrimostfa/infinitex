// Glowing embers: charcoal of a burnt log at 900 to 1250 K, crazed into
// blocks like the char of shou sugi ban (wood/finish.js), white ash on the
// tops. Level by level:
//   L0 bed       scale_mm (60 to 150 mm): hot and cooler regions of the bed;
//                the glow breathes over seconds as air reaches it (two
//                flowing noises, periods 4 and 9 s); the ash does not breathe.
//   L1 blocks    size_mm (10 to 25 mm), longer along the grain: domed char
//                blocks parted by deep cracks; the cracks glow brightest
//                (less ash, more air, the walls see each other).
//   L2 crazing   feature_mm (2 to 5 mm): a finer crazing on each block,
//                glowing faintly; ash flakes on the tops (insulating: the
//                glow under ash is weak).
//   L3 fibres    cell_um (25 to 60 um): the charcoal keeps the wood cells,
//                fine lines along the grain, faded under a few pixels.
//   L4 ash       micro_um (10 to 40 um): ash grains on the white patches.
// Embers do not move; only their glow does, so the motion is a temperature
// field in time, smooth by construction.

import { vec2, float, clamp, smoothstep, mix, mod } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { lines } from '../stone/common.js';
import { frame, fbm, flowFbm } from './common.js';
import { radiance } from './heat.js';

export function buildEmbers( p, fp, u, t ) {

	const F = frame( p, u.angle );
	const x = F.f.x, y = F.f.y;
	const S = u.sizeM;

	// L0: hot regions, and the breathing glow.
	const bed = fbm( p.add( u.seed.mul( 0.13 ) ), u.scaleM, fp, 3, 1 );
	const b1 = flowFbm( p, vec2( 0.002, 0.001 ), t, 4, u.scaleM.mul( 0.4 ), fp, 2, 2 );
	const b2 = flowFbm( p, vec2( - 0.001, 0.0015 ), t, 9, u.scaleM.mul( 0.8 ), fp, 2, 3 );
	const breath = b1.mul( 0.6 ).add( b2.mul( 0.4 ) ).sub( 0.5 ).mul( 2.2 ).add( 0.5 ).clamp( 0, 1 ).toVar();
	// Heat: the hot regions of the bed, brightened and dimmed by the breath.
	// Ash follows the lasting heat of the bed (it does not breathe).
	const warm = smoothstep( 0.2, 0.65, bed ).toVar();
	const heat = warm.mul( breath.mul( 0.6 ).add( 0.55 ) ).add( breath.sub( 0.5 ).mul( 0.2 ) ).clamp( 0, 1 ).toVar();

	// L1: char blocks, longer along the grain, domed, deep cracks.
	const cv = voronoi( mod( vec2( x.div( S.mul( 1.6 ) ), y.div( S ) ), 4096 ).add( u.seed.mul( 5 ) ), 0.8 );
	const bh = hash3( cv.id1.add( 2.1 ) );
	const cw = float( 0.0002 ).add( bh.x.mul( bh.x ).mul( 0.0013 ) );
	const crack = clamp( cw.sub( cv.edge.mul( S ) ).div( fp ).add( 0.5 ), 0, 1 ).toVar();
	const dome = smoothstep( 0.0, 0.45, cv.edge );
	const wB = fadeIn( S, fp, 2.0, 6.0 );

	// L2: fine crazing, ash on the tops.
	const fv = voronoi( mod( p.div( u.featureM ), 4096 ).add( 9.1 ), 0.9 );
	const wC = fadeIn( u.featureM, fp, 2.0, 6.0 );
	const craze = clamp( float( 0.00012 ).sub( fv.edge.mul( u.featureM ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( wC );
	const fdome = smoothstep( 0.0, 0.3, fv.edge );
	const ashN = fbm( p, u.featureM.mul( 2 ), fp, 3, 4 );
	const ash = smoothstep( 0.66, 0.8, dome.mul( 0.15 ).add( ashN.mul( 0.6 ) ).add( float( 1 ).sub( warm ).mul( 0.45 ) ).add( u.cover.sub( 0.5 ).mul( 0.6 ) ) )
		.mul( float( 1 ).sub( crack ) ).toVar();

	// L3 wood fibres along the grain, L4 ash grains.
	const fib = lines( y.add( fbm( vec2( x.mul( 0.3 ), y ), u.cellM.mul( 8 ), fp, 3, 5 ).mul( u.cellM ).mul( 3 ) ), u.cellM, u.cellM.mul( 0.2 ), fp, 4.0, 10.0 )
		.mul( smoothstep( 0.35, 0.55, fbm( vec2( x.mul( 0.04 ), y ), u.cellM.mul( 0.8 ), fp, 2, 7 ) ) );
	// A third crazing, finer, on the char between the cracks.
	const gv = voronoi( mod( p.div( u.featureM.mul( 0.25 ) ), 4096 ).add( 5.5 ), 0.9 );
	const wG = fadeIn( u.featureM.mul( 0.25 ), fp, 2.0, 6.0 );
	const craze2 = clamp( float( 0.00003 ).sub( gv.edge.mul( u.featureM ).mul( 0.25 ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( wG );
	const gdome = smoothstep( 0.0, 0.3, gv.edge );
	const grains = fbm( p, u.microM, fp, 2, 6 );

	// Height (meters): domed blocks, crazing domes, ash flakes standing a
	// little proud.
	const h = dome.mul( S ).mul( 0.08 ).mul( wB ).add( fdome.mul( u.featureM ).mul( 0.06 ).mul( wC ) )
		.add( gdome.mul( u.featureM ).mul( 0.012 ).mul( wG ) ).add( ash.mul( u.featureM ).mul( 0.04 ) ).add( fib.mul( u.cellM ).mul( - 0.3 ).mul( float( 1 ).sub( ash ) ) );
	const slope = surfaceGradient( h, p ).mul( float( 1 ).sub( crack ) );

	// Colour: soot black char with a satin sheen, white grey ash.
	const char = mix( u.color, u.color2, fdome.mul( 0.3 ) ).mul( bh.y.sub( 0.5 ).mul( u.colorVar ).add( 1 ) ).mul( float( 1 ).sub( fib.mul( 0.3 ) ) ).mul( float( 1 ).sub( craze.max( craze2 ).mul( 0.5 ) ) );
	const ashCol = u.color3.mul( grains.mul( 0.35 ).add( 0.75 ) ).mul( mix( float( 0.75 ), float( 1.0 ), ashN ) );
	// A thin grey dusting on the cooler block faces, thick flakes on tops.
	const dust = dome.mul( float( 1 ).sub( warm ) ).mul( 0.3 ).mul( grains.mul( 0.5 ).add( 0.75 ) );
	let color = mix( char, ashCol, ash.max( dust ) );
	color = mix( color, u.color.mul( 0.3 ), crack );

	// Light: the char surface glows where air reaches it, the cracks more;
	// ash insulates (only a faint glow through thin ash).
	// Block faces glow only where the bed is hot; the crack walls see each
	// other and lose less heat, so the cracks and the block rims next to
	// them glow wherever the bed is warm.
	const Ts0 = mix( u.crustK, u.meltK.mul( 0.88 ), smoothstep( 0.55, 1.0, heat ) ).add( bh.z.sub( 0.5 ).mul( 60 ) );
	const lip = cv.edge.mul( S ).sub( cw ).max( 0 ).div( 0.0015 ).negate().exp().mul( smoothstep( 0.1, 0.7, heat ) );
	const Ts = mix( Ts0, u.meltK.mul( 0.9 ), lip.mul( 0.7 ) );
	// Inside a crack: brightest in the middle, grainy (the wall is char).
	const mid = float( 1 ).sub( cv.edge.mul( S ).div( cw ).clamp( 0, 1 ) );
	const grit = fbm( p, float( 0.0006 ), fp, 3, 8 );
	// The crack floor is char too, crazed into granules (0.3 mm) whose
	// joints are a little cooler.
	const kv = voronoi( mod( p.div( 0.0003 ), 4096 ).add( 1.7 ), 0.9 );
	const joint = clamp( float( 0.000012 ).sub( kv.edge.mul( 0.0003 ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( fadeIn( float( 0.0003 ), fp, 2.0, 6.0 ) );
	const Tk = mix( u.crustK.add( 120 ), u.meltK, smoothstep( 0.05, 0.6, heat ) ).sub( grit.mul( 140 ) ).sub( float( 1 ).sub( mid ).mul( 60 ) ).sub( joint.mul( 130 ) );
	const Tz = mix( Ts, Tk, 0.5 );
	let emissive = radiance( Ts, u ).mul( float( 1 ).sub( ash.mul( 0.85 ) ) );
	emissive = mix( emissive, radiance( Tz, u ), craze.max( craze2.mul( 0.5 ) ).mul( float( 1 ).sub( ash ) ).mul( heat ) );
	emissive = mix( emissive, radiance( Tk, u ), crack );

	return {
		color, slope, emissive, porosity: 0.6,
		rough: mix( u.roughness, float( 0.95 ), ash ), s2: wC.oneMinus().mul( 0.02 ).add( wB.oneMinus().mul( 0.02 ) ),
		cavity: crack.max( craze.mul( 0.5 ) ),
	};

}
