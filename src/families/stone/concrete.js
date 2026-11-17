// Concrete: gravel and sand bound by hydrated cement paste, cast in a
// form. angle_deg turns the formwork boards.
//   L0 form     board marks (board_mm wide): each board a little proud or
//               sunk, a ridge of paste where two boards met, the grain of
//               the wood printed faintly into the skin
//   L0 mottle   cloudy patches where the paste set at different speeds
//   L0 worn     where the skin is gone (aggregate), the stones show cut
//               flat: gravel 5 to 20 mm (grain_mm) and sand 0.5 to 2 mm
//   L1 bubbles  air trapped against the form: pits 0.2 to 6 mm, dark inside
//   L2 paste    sand grains faint under the skin, unhydrated cement grains
//               (10 to 40 um, dark), capillary pores (2 to 5 um)
// color = paste, color2 and color3 = gravel, color4 = sand.
//
// The bubbles, craze cracks and paste details sit in gate()s (core/lod.js)
// and run only where they show.

import { vec2, float, floor, mix, smoothstep, step, clamp, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, grains, fbm } from './common.js';

// Bubbles on a Voronoi of cellM: a share `amount` of cells hold one.
// q: p / cellM + seed, taken by the caller before its gate.
function bubbles( q, fp, cellM, rMin, rMax, amount, seed ) {

	const V = voronoi( q, 0.8 );
	const h = hash3( V.id1.add( seed ) );
	const r = h.x.pow( 2 ).mul( rMax - rMin ).add( rMin ); // many small, few big
	const d = V.toSeed.length().mul( cellM );
	const on = step( h.y, amount );
	const hole = clamp( r.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( on ).mul( fadeIn( r.mul( 2 ), fp, 1.0, 3.0 ) );
	const depth = d.div( r ).min( 1 ); // 0 at the bottom, 1 at the rim
	// Concave: the wall rises away from the centre.
	const slope = V.toSeed.normalize().mul( depth.pow( 3 ).mul( 1.2 ) ).mul( hole );
	return { hole, depth, slope };

}

export function buildConcrete( p, fp, u ) {

	const s = u.seed, A = u.grainM;
	const ax = dir2( u.angle ), ay = vec2( ax.y.negate(), ax.x );
	const tx = p.dot( ax ), ty = p.dot( ay );

	// Formwork boards.
	const by = ty.div( u.boardM ).add( 0.37 );
	const board = floor( by );
	const hb = hash3( vec2( board, s ) );
	const jd = by.sub( board.add( 0.5 ) ).abs().oneMinus().sub( 0.5 ).mul( u.boardM ); // distance to the nearest joint, m
	const joint = smoothstep( float( 1.5e-3 ).mul( hb.z.add( 0.5 ) ), 0, jd ).mul( u.formwork );
	const grainW = valueNoise( vec2( tx.div( 0.09 ), ty.div( 0.0025 ) ).add( hb.xy.mul( 50 ) ) ).mul( 0.7 )
		.add( valueNoise( vec2( tx.div( 0.02 ), ty.div( 6e-4 ) ).add( hb.yz.mul( 30 ) ) ).mul( 0.3 ) )
		.add( valueNoise( wrapCoord( vec2( tx.div( 0.006 ), ty.div( 1.5e-4 ) ) ).add( hb.xz.mul( 20 ) ) ).sub( 0.5 ).mul( 0.25 ).mul( fadeIn( float( 1.5e-4 ), fp, 1.5, 4.0 ) ) );
	const formH = hb.x.sub( 0.5 ).mul( 8e-4 ).add( grainW.mul( 3e-4 ) ).add( joint.mul( 1.2e-4 ) ).mul( u.formwork );

	// Worn patches: the skin is gone, aggregate shows.
	const wear = fbm( p, float( 0.08 ), fp, 4, 3 ).add( u.aggregate.mul( 0.7 ) ).sub( 0.35 );
	const exposed = smoothstep( 0.47, 0.5, wear.add( fbm( p, float( 4e-3 ), fp, 3, 5 ).sub( 0.5 ).mul( 0.12 ) ) ).mul( step( 0.01, u.aggregate ) ).toVar();

	// Gravel: rounded stones cut flat, each its own rock and speckle.
	const pw = p.add( vec2( valueNoise( p.div( A.mul( 0.7 ) ) ), valueNoise( p.div( A.mul( 0.7 ) ).add( 4.1 ) ) ).sub( 0.5 ).mul( A ).mul( 0.5 ) );
	const Gr = grains( pw, A, fp, 0.2, 4, 0.95 );
	const rock = Gr.h.y;
	const speck = valueNoise( wrapCoord( p.div( 3e-4 ) ).add( Gr.h.xz.mul( 40 ) ) ).mul( fadeIn( float( 3e-4 ), fp, 1.5, 4.0 ) );
	const stoneCol = mix( u.color2, u.color3, step( 0.5, rock ) ).mul( Gr.h.z.mul( 0.5 ).add( 0.75 ) ).mul( speck.sub( 0.5 ).mul( 0.35 ).add( 1 ) );
	// Sand between stones and under the skin.
	const Sd = grains( p, A.mul( 0.08 ), fp, 0.15, 6 );
	const sandCol = u.color4.mul( Sd.h.z.mul( 0.6 ).add( 0.7 ) );

	// Paste: mottle, then cement grains and pores.
	const mottle = fbm( p, float( 0.05 ), fp, 4, 1 ).sub( 0.5 ).mul( u.colorVar ).mul( 1.6 ).add( fbm( p, float( 1.5e-3 ), fp, 4, 2 ).sub( 0.5 ).mul( 0.25 ) ).add( 1 );
	// Skipped past the clinker's fade (20 um, from 2 px).
	const clq = wrapCoord( p.div( 4e-5 ) ).add( 2.2 ).toVar();
	const CP = gate( fadeOn( 2e-5, fp, 2.0 ), { clinker: 0, capP: 0 }, () => {

		const CL = voronoi( clq, 0.9 );
		const pq = wrapCoord( p.div( 8e-6 ) );
		return {
			clinker: smoothstep( 0.15, 0.25, CL.edge ).mul( step( 0.85, hash1( CL.id1 ) ) ).mul( fadeIn( float( 2e-5 ), fp, 2.0, 5.0 ) ),
			capP: step( 0.93, hash1( floor( pq ) ) ).mul( smoothstep( 0.35, 0.2, pq.sub( floor( pq ) ).sub( 0.5 ).length() ) ).mul( fadeIn( float( 4e-6 ), fp, 1.5, 4.0 ) ),
		};

	}, [ p, fp, clq ] );
	const clinker = CP.clinker, capP = CP.capP.toVar();
	let paste = u.color.mul( mottle ).mul( grainW.sub( 0.5 ).mul( 0.15 ).mul( u.formwork ).add( 1 ) ).mul( float( 1 ).sub( joint.mul( 0.15 ) ) ).mul( hb.y.sub( 0.5 ).mul( 0.08 ).mul( u.formwork ).add( 1 ) );
	paste = mix( paste, sandCol, Sd.soft.mul( Sd.w ).mul( 0.22 ) ); // sand faint under the skin
	// Fines (0.1 to 0.3 mm) in the skin, a grainy mosaic seen close, and
	// pinholes 30 to 150 um. Skipped past the widest pinhole's fade (150 um,
	// from 1 px).
	const phq = wrapCoord( p.div( 6e-4 ) ).add( 4.9 ).toVar();
	const FP = gate( fadeOn( 1.5e-4, fp, 1.0 ), { fines: 1, sFines: [ 0, 0 ], pinh: 0 }, () => {

		const Fn = grains( p, float( 2e-4 ), fp, 0.05, 8 );
		const PH = voronoi( phq, 0.8 );
		const phR = hash1( PH.id1 ).pow( 2 ).mul( 1.2e-4 ).add( 3e-5 );
		return {
			fines: Fn.h.z.sub( 0.5 ).mul( 0.22 ).mul( Fn.soft ).mul( Fn.w ).add( 1 ),
			sFines: Fn.slope.mul( 0.12 ),
			pinh: band( PH.toSeed.length().mul( 6e-4 ), phR, fp ).mul( step( 0.85, hash1( PH.id1.add( 1.3 ) ) ) ).mul( fadeIn( phR, fp, 1.0, 3.0 ) ),
		};

	}, [ p, fp, phq ] );
	paste = paste.mul( FP.fines );
	const pinh = FP.pinh.toVar();
	// Craze cracks of the skin (cells 5 to 10 mm), skipped past their fade.
	const craze = gate( fadeOn( 7e-3, fp, 3.0 ), { craze: 0 }, () => {

		const CZ = voronoi( p.div( 7e-3 ).add( vec2( fbm( p, float( 3e-3 ), fp, 2, 6 ), 0 ).mul( 0.6 ) ).add( s ), 0.9 );
		return { craze: band( CZ.edge.mul( 7e-3 ), 8e-6, fp ).mul( step( 0.5, hash1( CZ.id1.add( CZ.id2 ) ) ) ).mul( fadeIn( float( 7e-3 ), fp, 3.0, 8.0 ) ) };

	}, [ p, fp ] ).craze.toVar();
	paste = paste.mul( float( 1 ).sub( pinh.mul( 0.6 ) ) ).mul( float( 1 ).sub( craze.mul( 0.35 ) ) );
	paste = paste.mul( float( 1 ).sub( clinker.mul( 0.45 ) ) ).mul( float( 1 ).sub( capP.mul( 0.5 ) ) );

	// Worn: gravel over sand over a darker, rougher paste.
	const wornPaste = mix( paste.mul( 0.85 ), sandCol, Sd.inside.mul( 0.7 ) );
	const worn = mix( wornPaste, stoneCol, Gr.inside );
	let color = mix( paste, worn, exposed );

	// Bubbles: big ones on the form face, many small ones. Each size is
	// skipped past the fade of its widest bubble (8 mm and 1.4 mm across,
	// from 1 px); the depth of a missing bubble is never read.
	const bq1 = p.div( 0.018 ).add( 3.3 ).toVar(), bq2 = p.div( 0.004 ).add( 8.8 ).toVar();
	const BB = gate( fadeOn( 8e-3, fp, 1.0 ), { hole1: 0, depth1: 0, slope1: [ 0, 0 ], hole2: 0, depth2: 0, slope2: [ 0, 0 ] }, () => {

		const b1 = bubbles( bq1, fp, float( 0.018 ), 6e-4, 4e-3, u.bubbles.mul( 0.35 ), 3.3 );
		const b2 = gate( fadeOn( 1.4e-3, fp, 1.0 ), { hole: 0, depth: 0, slope: [ 0, 0 ] }, () => bubbles( bq2, fp, float( 0.004 ), 1.5e-4, 7e-4, u.bubbles.mul( 0.45 ), 8.8 ), [ fp, bq2 ] );
		return { hole1: b1.hole, depth1: b1.depth, slope1: b1.slope, hole2: b2.hole, depth2: b2.depth, slope2: b2.slope };

	}, [ fp, bq1, bq2 ] );
	const B1 = { hole: BB.hole1, depth: BB.depth1, slope: BB.slope1 }, B2 = { hole: BB.hole2, depth: BB.depth2, slope: BB.slope2 };
	const hole = B1.hole.max( B2.hole ).toVar();
	const shade = mix( B2.depth, B1.depth, step( B2.hole, B1.hole ) ).mul( 0.6 ).add( 0.25 );
	color = mix( color, color.mul( shade ), hole );

	const h = formH.mul( exposed.oneMinus() ).sub( exposed.mul( 6e-4 ) ).add( Gr.inside.mul( exposed ).mul( 4e-4 ) );
	const slope = surfaceGradient( h.sub( pinh.mul( 3e-5 ) ).sub( craze.mul( 1e-5 ) ), p ).add( B1.slope ).add( B2.slope ).add( Sd.slope.mul( mix( float( 0.05 ), float( 0.5 ), exposed ) ) ).add( FP.sFines );
	const rough = u.roughness.add( exposed.mul( 0.05 ) ).sub( exposed.mul( Gr.inside ).mul( 0.25 ) ).add( hole.mul( 0.1 ) ).clamp( 0.05, 1 );
	const cavity = hole.max( exposed.mul( Gr.inside.oneMinus() ).mul( 0.5 ) ).max( capP.mul( 0.3 ) ).max( pinh ).max( craze.mul( 0.6 ) );
	return { color: clamp( color, 0, 1 ), slope, cavity, rough, s2: Sd.w.oneMinus().mul( 0.03 ) };

}
