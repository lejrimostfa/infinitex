// Marble: limestone recrystallised by heat and pressure into calcite
// grains; impurities squeezed into veins.
//   L0 clouds   soft grey drifts a few cm wide (dispersed graphite, clay)
//   L0 veins    a network that branches and wanders: main veins (vein_mm,
//               about 1 to 5 mm) on a warped Voronoi net 8 cm wide, finer
//               branches on a 2 cm net, wisps along the trend (angle_deg)
//   L1 grains   calcite crystals (grain_mm, 0.2 to 2 mm), each its own
//               tone and polish; faint seams between them; veins are made
//               of finer dark grains
//   L2 micro    twin lamellae (15 to 30 um), rhombohedral cleavage cracks,
//               pits where polishing plucked a grain, polishing scratches
// Light enters the calcite and comes out a few mm away: the SSS material
// (scatter) softens the whole look. color = base, color2 = cloud.
//
// The grains and the micro levels sit in gate()s (core/lod.js) and run only
// where they show; the noise octaves too (fbmGated).

import { vec2, float, floor, mix, smoothstep, step, clamp, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, lines, scratches, fbmGated as fbm } from './common.js';
import { crystals } from './crystals.js';

// A warped Voronoi net: line coverage and a halo, widths in meters.
function veinNet( p, fp, cellM, widthM, seed, amount, warpM ) {

	const q = p.add( warpM ).div( cellM ).add( seed );
	const V = voronoi( q, 0.9 );
	const segH = hash1( V.id1.add( V.id2 ).mul( 0.73 ).add( seed ) ); // one value per border segment
	const on = smoothstep( 0.0, 0.25, amount.sub( segH ) ); // some borders carry no vein
	const wv = valueNoise( q.mul( 3.0 ).add( 4.4 ) ).mul( 1.3 ).add( 0.2 ); // width wanders along the vein
	const d = V.edge.mul( cellM );
	const line = band( d, widthM.mul( wv ).mul( 0.5 ).add( fp.mul( 0.15 ) ), fp ).mul( on );
	const halo = smoothstep( widthM.mul( 12 ), widthM.mul( 0.5 ), d ).mul( on );
	return { line, halo, tone: segH };

}

export function buildMarble( p, fp, u ) {

	const s = u.seed, vw = u.veinM, g = u.grainM;
	const ax = dir2( u.angle ), ay = vec2( ax.y.negate(), ax.x );
	const tx = p.dot( ax ), ty = p.dot( ay );

	// Clouds: soft drifts stretched along the trend.
	const cl = fbm( vec2( tx.div( 2.5 ), ty ), float( 0.04 ), fp, 5, 1 );
	const cloud = smoothstep( 0.4, 0.75, cl ).toVar();

	// One warp field so wisps, veins and branches all follow the flow.
	const warp = vec2( fbm( p, float( 0.06 ), fp, 4, 2 ), fbm( p, float( 0.06 ), fp, 4, 3 ) ).sub( 0.5 ).mul( 0.05 );
	// Wisps: crests of a turbulent noise stretched along the trend, the
	// grey threads that make the Carrara look. Width follows a second noise.
	const wq = vec2( tx.div( 3 ), ty ).add( warp.mul( 0.5 ) );
	const wn = fbm( wq, float( 0.025 ), fp, 5, 4 );
	// Feathery edges: a fine noise frays the crest.
	const crest = wn.sub( 0.5 ).abs().mul( 0.025 ).add( fbm( p, float( 1.2e-3 ), fp, 4, 7 ).sub( 0.5 ).mul( vw ).mul( 0.8 ) ).max( 0 ); // meters, roughly
	const wW = vw.mul( fbm( p, float( 0.03 ), fp, 2, 6 ).mul( 1.6 ).add( 0.1 ) );
	const wisp = smoothstep( wW.mul( 0.6 ).add( fp ), wW.mul( 0.1 ), crest ).mul( 0.6 ).add( smoothstep( wW.mul( 4 ), wW.mul( 0.3 ), crest ).mul( 0.35 ) ).mul( u.veins ).min( 1 );
	const big = veinNet( p, fp, float( 0.09 ), vw.mul( 1.5 ), s.mul( 3 ), u.veins.mul( 0.5 ), warp );
	const mid = veinNet( p, fp, float( 0.025 ), vw.mul( 0.35 ), s.mul( 5 ).add( 7 ), u.veins.mul( 0.4 ), warp.mul( 0.5 ) );
	// Feathered branches: a fine net, short segments only.
	const fine = veinNet( p, fp, float( 0.008 ), vw.mul( 0.13 ), s.mul( 7 ).add( 3 ), u.veins.mul( 0.45 ), warp.mul( 0.25 ) );
	const vein = big.line.max( mid.line.mul( 0.85 ) ).max( fine.line.mul( 0.6 ).mul( mid.halo.max( big.halo ).mul( 1.5 ).min( 1 ) ) ).max( wisp.mul( 0.9 ) ).toVar();
	// Vein tone: grey to dark grey, per segment and along the vein.
	const vTone = mix( big.tone, mid.tone, step( big.line, mid.line ) ).mul( 0.6 ).add( fbm( p, float( 0.02 ), fp, 3, 9 ).mul( 0.6 ) ).add( 0.35 );
	const halo = big.halo.mul( 0.7 ).max( mid.halo.mul( 0.3 ) ).mul( u.veins );

	// Calcite grains, with the twins and cleavage inside them: skipped past
	// the fade of the grains and of the cleavage (90 um, from 3 px), which
	// outlives the grains when they are under 60 um.
	const gq = mod( p.div( g ), 4096 ).add( s.mul( 9.1 ) ).toVar();
	const wG = fadeIn( g, fp, 2.0, 6.0 ).toVar();
	const GR = gate( fadeOn( g, fp, 2.0 ).or( fadeOn( 9e-5, fp, 3.0 ) ), { seamG: 0, gTone: 1, twin: 0, clv: 0, sTilt: [ 0, 0 ], rTilt: 0 }, () => {

		const G = crystals( gq, { elong: 0.5, size: 0.35 } );
		const hg = hash3( G.id1.add( 3.7 ) );
		// Inside each grain: twins and cleavage at the grain's own angle.
		const ga = dir2( hg.y.mul( 3.1416 ) ), gb = dir2( hg.y.mul( 3.1416 ).add( 1.31 ) );
		return {
			seamG: band( G.gap.mul( g ).mul( 0.5 ), 4e-6, fp ).mul( wG ),
			gTone: hg.x.sub( 0.5 ).mul( 0.12 ).mul( wG ).add( 1 ),
			twin: lines( p.dot( ga ), hg.z.mul( 1.5e-5 ).add( 1.5e-5 ), 1.2e-6, fp ).mul( step( 0.4, hg.z ) ),
			clv: lines( p.dot( gb ), float( 9e-5 ), 1e-6, fp ).mul( smoothstep( 0.55, 0.7, valueNoise( mod( p.div( 1.5e-4 ), 4096 ).add( hg.xy.mul( 30 ) ) ) ) ),
			// Sugary sparkle: each calcite grain reflects at its own small tilt.
			sTilt: hg.xy.sub( 0.5 ).mul( 0.09 ).mul( wG ),
			rTilt: hg.z.mul( 0.04 ).mul( wG ),
		};

	}, [ p, fp, gq, wG ] );
	const seamG = GR.seamG.toVar(), gTone = GR.gTone, twin = GR.twin, clv = GR.clv;
	// Vein matter: finer dark grains, 40 um.
	const vg = hash1( floor( mod( p.div( 4e-5 ), 4096 ) ) ).sub( 0.5 ).mul( fadeIn( float( 4e-5 ), fp, 2.0, 5.0 ) );

	// Plucked grains: rare pits a few tens of um wide, and polishing
	// scratches. Skipped past the fade of the widest pit (20 um, from 1.5 px).
	const pq = mod( p.div( 2.5e-4 ), 4096 ).add( 5.5 ).toVar();
	const PS = gate( fadeOn( 2e-5, fp, 1.5 ), { pit: 0, scr: 0 }, () => {

		const P = voronoi( pq, 0.8 );
		const pitR = hash1( P.id1 ).mul( 1.5e-5 ).add( 5e-6 );
		return {
			pit: band( P.toSeed.length().mul( 2.5e-4 ), pitR, fp ).mul( step( 0.93, hash1( P.id1.add( 2.2 ) ) ) ).mul( fadeIn( pitR, fp, 1.5, 4.0 ) ).mul( u.pores.mul( 2 ).min( 1 ) ),
			scr: scratches( p, fp, float( 1.5e-4 ), 7e-7, u.polish.mul( 0.4 ), 3 ).add( scratches( p, fp, float( 5e-4 ), 1e-6, u.polish.mul( 0.25 ), 4 ) ).min( 1 ),
		};

	}, [ p, fp, pq ] );
	const pit = PS.pit.toVar(), scr = PS.scr.toVar();

	// Colour.
	const base = u.color.mul( fbm( p, float( 0.01 ), fp, 3, 6 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	let color = mix( base, u.color2, cloud.mul( 0.7 ) );
	color = mix( color, mix( color, u.veinColor, 0.3 ), halo );
	color = mix( color, u.veinColor.mul( vTone ).mul( vg.mul( 0.7 ).add( 1 ) ), vein.mul( 0.85 ) );
	color = color.mul( gTone ).mul( float( 1 ).sub( seamG.mul( 0.16 ) ) ).mul( float( 1 ).sub( twin.mul( 0.08 ) ) ).mul( float( 1 ).sub( clv.mul( 0.2 ) ) );
	color = color.mul( float( 1 ).sub( pit.mul( 0.5 ) ) );

	color = color.mul( float( 1 ).add( scr.mul( 0.08 ) ) );

	// Relief: polished nearly flat; grains a hair proud of the seams,
	// veins (softer matter) a hair low; honed (polish 0) is a fine matte.
	const height = seamG.mul( - 4e-7 ).sub( vein.mul( 1.5e-6 ) ).sub( pit.mul( 4e-6 ) );
	// Sugary sparkle: each calcite grain reflects at its own small tilt.
	const slope = surfaceGradient( height, p ).add( GR.sTilt );
	const rough = mix( float( 0.42 ), float( 0.06 ), u.polish ).add( GR.rTilt ).add( scr.mul( 0.15 ) ).add( pit.mul( 0.4 ) ).mul( u.roughness.div( 0.7 ) ).clamp( 0.03, 1 );
	const cavity = pit.max( seamG.mul( 0.3 ) ).max( vein.mul( 0.2 ) );
	return { color: clamp( color, 0, 1 ), slope, cavity, rough, s2: u.polish.oneMinus().mul( 0.02 ) };

}
