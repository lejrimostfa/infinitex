// Leather family: TSL node graph, four levels faded by pixel size.
//   L0 hide:    colour (preset or image), folds kept from the base normal map
//   L1 grain:   Voronoi pebbles with grooves, about 1 mm
//   L2 pores:   hair follicle dimples, about 0.3 mm apart
//   L3 finish:  micro cracks of the top coat, about 0.1 mm
//   cracks:     craquelure on part of a larger Voronoi net, showing the
//               lighter corium underneath, edges slightly lifted
// Slopes are summed in tangent space and put on top of the base normal.
// Every hard edge fades to its mean within a pixel (grooves, pore rims,
// cracks). Thin cracks are widened to a pixel and dimmed by the same ratio.
// Each level sits in a gate() (core/lod.js): it runs only where its fade is
// on, the cracks only in their patches, the flaking only when it is set.

import {
	uv, vec2, vec3, float, floor, fract, clamp, smoothstep, step, mix, sqrt,
	normalView, tangentView, bitangentView,
} from 'three/tsl';
import { footprint, fadeIn, fadeOn, gate, composeRoughness, specularAA, perturbNormal, pick } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { applySurface } from '../../core/surface.js';
import { applyStates } from '../../core/states.js';

const sstep = ( t ) => t.mul( t ).mul( t.mul( - 2 ).add( 3 ) );
const dsstep = ( t ) => t.mul( float( 1 ).sub( t ) ).mul( 6 );
// Rough slope variances of each level once faded (dimensionless, per unit
// depth squared). The leather gate will refine them.
const S2_GRAIN = 0.05, S2_PORE = 0.02, S2_FIBER = 0.006;

export function buildLeatherNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv().mul( u.metersPerUV ) ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );

	// L1 grain: a net of creases like skin, not polygons. Two octaves of
	// warped Voronoi; each border creases with its own strength, some not
	// at all, so the net breaks up.
	const crease = ( scale, depth, seed, W = 0.16 ) => {

		const w = fadeIn( u.grainM.mul( scale ), fp, 1.5, 4.0 ).toVar(); // early: detail shows from a few pixels
		// Skipped under 1.5 px per cell.
		return { ...gate( fadeOn( u.grainM.mul( scale ), fp, 1.5 ), { slope: [ 0, 0 ], fold: 0 }, () => creaseLevel( scale, depth, seed, W, w ), [ p, fp, w ] ), w };

	};
	const creaseLevel = ( scale, depth, seed, W, w ) => {

		const x = p.div( u.grainM.mul( scale ) ).add( u.seed.mul( seed ) );
		// Two warp octaves: the big one bends the net, the fine one makes
		// every border wiggle, so no straight segment shows up close.
		const warp = vec2( valueNoise( x.mul( 0.35 ) ), valueNoise( x.mul( 0.35 ).add( 19.3 ) ) ).sub( 0.5 ).mul( 1.4 )
			.add( vec2( valueNoise( x.mul( 2.7 ).add( 3.3 ) ), valueNoise( x.mul( 2.7 ).add( 8.1 ) ) ).sub( 0.5 ).mul( 0.22 ) )
			.add( vec2( valueNoise( x.mul( 9.1 ).add( 1.7 ) ), valueNoise( x.mul( 9.1 ).add( 6.2 ) ) ).sub( 0.5 ).mul( 0.06 ) );
		// Faux leather: an embossed print, too regular (little warp, every
		// border creased the same).
		const g = voronoi( x.add( warp.mul( float( 1 ).sub( u.regular.mul( 0.85 ) ) ) ), mix( float( 0.85 ), float( 0.45 ), u.regular ) );
		const strength = mix( smoothstep( 0.25, 0.7, hash1( g.id1.add( g.id2 ).mul( 0.91 ).add( seed ) ) ), float( 1 ), u.regular );
		const t = clamp( g.edge.div( W ), 0, 1 );
		const fold = float( 1 ).sub( sstep( t ) ).mul( strength );
		const D = u.grainDepth.mul( depth ).mul( strength );
		const aa = smoothstep( 0.0, 1.0, g.edge.mul( u.grainM ).mul( scale ).div( fp ) );
		const s = g.dir.mul( D.mul( dsstep( t ) ).div( W ).negate() ).mul( aa ).add( g.toSeed.mul( u.grainDepth.mul( depth * - 3 ) ) );
		return { slope: s.mul( w ), fold: fold.mul( w ) };

	};
	// Three octaves: wrinkles (4 mm, seen from mid range), grain creases,
	// fine creases.
	const c0 = crease( 3.2, 0.05, 7.7, 0.38 ), c1 = crease( 1.0, 0.06, 13.7 ), c2 = crease( 0.37, 0.035, 3.1 );
	const wG = c1.w.toVar();
	const groove = c0.fold.max( c1.fold ).max( c2.fold.mul( 0.7 ) ).toVar(); // 1 in a crease
	const sG = c0.slope.add( c1.slope ).add( c2.slope );

	// L2 pores, one per cell, a quarter of the cells empty. Skipped under
	// 1.5 px per pore: only their mean darkening is left (poreC).
	const meanPore = 0.75 * 0.5 * 0.08 * 0.08 * Math.PI;
	const wP = fadeIn( u.poreM, fp, 1.5, 4.0 ).toVar();
	const PO = gate( fadeOn( u.poreM, fp, 1.5 ), { poreC: meanPore, sP: [ 0, 0 ] }, () => {

		const q = p.div( u.poreM ).add( 71.3 );
		const pc = floor( q );
		const ph = hash3( pc.add( u.seed ) );
		const v = q.sub( pc.add( 0.5 ).add( ph.xy.sub( 0.5 ).mul( 0.6 ) ) );
		const rp = ph.z.mul( 0.04 ).add( 0.06 ); // small: follicles, not bumps
		const r2 = v.dot( v ).div( rp.mul( rp ) );
		const inPore = step( r2, 1 ).mul( step( ph.z, 0.75 ) );
		const rimAA = smoothstep( 0.0, 1.0, float( 1 ).sub( sqrt( r2 ) ).mul( rp ).mul( u.poreM ).div( fp ) );
		const pore = inPore.mul( float( 1 ).sub( r2 ) ); // dimple depth 0..1
		return {
			poreC: mix( float( meanPore ), pore, wP ),
			sP: v.mul( u.poreDepth.mul( 0.05 ).div( rp.mul( rp ) ) ).mul( inPore ).mul( rimAA ).mul( wP ),
		};

	}, [ p, fp, wP ] );
	const sP = PO.sP;

	// L3 finish: the top coat of the leather breaks into a very fine net of
	// micro cracks and hairline scratches, seen only up close.
	// Skipped under 2 px per crack cell.
	const fq = p.div( u.fiberM.mul( 3 ) ).toVar();
	const wF = fadeIn( u.fiberM.mul( 3 ), fp, 2.0, 6.0 ).toVar();
	const MF = gate( fadeOn( u.fiberM.mul( 3 ), fp, 2.0 ), { micro: 0, sF: [ 0, 0 ] }, () => {

		const m = voronoi( fq.add( vec2( valueNoise( fq.mul( 0.5 ) ), valueNoise( fq.mul( 0.5 ).add( 7.7 ) ) ).mul( 0.8 ) ) );
		const mPx = m.edge.mul( u.fiberM.mul( 3 ) ).div( fp );
		const micro = float( 1 ).sub( smoothstep( 0.0, 1.5, mPx ) ).mul( step( hash1( m.id1.add( m.id2 ) ), 0.55 ) ).mul( wF );
		return { micro, sF: m.dir.mul( micro.mul( 0.06 ) ) };

	}, [ fq, fp, wF ] );
	const micro = MF.micro.toVar(), sF = MF.sF;

	// Cracks.
	// Craquelure grows in patches (where the leather flexes most) and as
	// connected, wiggly nets: warp the cells, and decide per region, not per
	// border, with only a few borders left whole inside a patch.
	// Skipped outside the patches, where cracked is zero.
	const xc = p.div( u.crackM ).add( u.seed.mul( 5.3 ) ).toVar();
	const patch = valueNoise( xc.mul( 0.22 ).add( 31.7 ) ).toVar();
	const lo = float( 1 ).sub( u.crackAmount ).mul( 0.9 ).toVar();
	const CK = gate( patch.greaterThan( lo ), { crack: 0, sC: [ 0, 0 ], rim: 0 }, () => {

		const wc = vec2( valueNoise( xc.mul( 1.7 ) ), valueNoise( xc.mul( 1.7 ).add( 4.4 ) ) ).sub( 0.5 ).mul( 0.5 );
		const c = voronoi( xc.add( wc ), 0.9 );
		const pair = c.id1.add( c.id2 );
		const cracked = smoothstep( lo, lo.add( 0.12 ), patch )
			.mul( step( 0.2, hash1( pair.mul( 1.31 ) ) ) );
		const Wc = u.crackWidth.mul( 0.05 ).add( 0.02 ).mul( hash1( pair.mul( 0.73 ).add( 9.1 ) ).mul( 0.8 ).add( 0.6 ) );
		const pxPerCell = u.crackM.div( fp );
		const wPx = Wc.mul( pxPerCell ), ePx = c.edge.mul( pxPerCell );
		const rEff = wPx.max( 1 );
		const crack = clamp( rEff.sub( ePx ).add( 0.5 ), 0, 1 ).mul( wPx.div( rEff ) ).mul( cracked ).toVar();
		// Lifted, curled edges along the crack: they catch the light.
		const tc = clamp( c.edge.sub( Wc ).div( Wc.mul( 2 ) ), 0, 1 );
		const sC = c.dir.mul( dsstep( tc ).mul( 0.05 ).div( Wc.mul( 2 ) ) ).mul( cracked ).mul( smoothstep( 1.0, 3.0, wPx ) );
		const rim = float( 1 ).sub( tc ).mul( cracked ).mul( float( 1 ).sub( crack ) ).mul( smoothstep( 1.0, 3.0, wPx ) );
		return { crack, sC, rim };

	}, [ xc, patch, lo, fp ] );
	const crack = CK.crack.toVar(), sC = CK.sC, rim = CK.rim;

	// Micro relief of the finish: two fine noise octaves, so the surface is
	// never glassy smooth when the texture of the game is magnified 100x.
	// Skipped under 2 px per noise cell.
	const NZ = gate( fadeOn( u.fiberM, fp, 2.0 ), { sN: [ 0, 0 ], tone: 1 }, () => {

		const nq = p.div( u.fiberM );
		const nz = vec2( valueNoise( nq ), valueNoise( nq.add( 13.1 ) ) ).sub( 0.5 )
			.add( vec2( valueNoise( nq.mul( 3.1 ) ), valueNoise( nq.mul( 3.1 ).add( 5.9 ) ) ).sub( 0.5 ).mul( 0.5 ) );
		const wN = fadeIn( u.fiberM, fp, 2.0, 6.0 );
		return { sN: nz.mul( 0.08 ).mul( wN ), tone: nz.x.mul( 0.12 ).mul( wN ).add( 1 ) };

	}, [ p, fp ] );
	const sN = NZ.sN;

	// Faux leather flaking: the PU coat peels off in patches and shows its
	// woven backing; the torn coat edge is lifted.
	// Skipped when flaking is off: peel and lip are zero, so the backing is
	// never seen.
	const FL = gate( u.flaking.greaterThanEqual( 0.001 ), { peel: 0, lip: 0, sB: [ 0, 0 ], backing: [ 0, 0, 0 ] }, () => {

		const fq2 = p.div( u.crackM.mul( 2.5 ) ).add( 5.1 );
		const pn = valueNoise( fq2 ).mul( 0.7 ).add( valueNoise( fq2.mul( 4.3 ) ).mul( 0.3 ) );
		const pth = float( 1 ).sub( u.flaking.mul( 0.45 ) );
		const on = step( 0.001, u.flaking );
		// Antialiased border: the noise changes by about 1 per noise cell.
		const pxN = u.crackM.mul( 2.5 ).div( fp ).mul( 0.6 );
		const peel = clamp( pn.sub( pth ).mul( pxN ).add( 0.5 ), 0, 1 ).mul( on ).toVar();
		const lip = float( 1 ).sub( smoothstep( 0.0, 0.03, pth.sub( pn ) ) ).mul( float( 1 ).sub( peel ) ).mul( on );
		const bq = p.div( 4.5e-4 );
		const bfx = fract( bq.x ).sub( 0.5 ), bfy = fract( bq.y ).sub( 0.5 );
		const warpUp = step( 0.5, fract( floor( bq.x ).add( floor( bq.y ) ).mul( 0.5 ) ) );
		const wB = fadeIn( float( 4.5e-4 ), fp, 2.0, 5.0 );
		const sB = vec2( pick( warpUp, bfx.mul( - 1.2 ), float( 0 ) ), pick( warpUp, float( 0 ), bfy.mul( - 1.2 ) ) ).mul( wB );
		const backing = vec3( 0.55, 0.5, 0.42 ).mul( mix( float( 0.85 ), float( 1 ).sub( pick( warpUp, bfx.abs(), bfy.abs() ).mul( 0.6 ) ), wB ) );
		return { peel, lip, sB, backing };

	}, [ p, fp ] );
	const peel = FL.peel.toVar(), lip = FL.lip, sB = FL.sB, backing = FL.backing;

	const slope = mix( sG.add( sP ).add( sF ).add( sN ).mul( float( 1 ).sub( crack ) ).add( sC ), sB, peel );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, slope, tangentView, bitangentView ).toVar( 'ix_normal' );

	// Colour, cavity, roughness.
	const baseColor = opts.stitchColor ? opts.stitchColor.here : u.color;
	const meanGroove = 0.2;
	const grooveC = mix( float( meanGroove ), groove, wG );
	const poreC = PO.poreC.toVar();
	const ao = float( 1 ).sub( grooveC.mul( u.grainDepth ).mul( 0.75 ) ).mul( float( 1 ).sub( poreC.mul( u.poreDepth ).mul( 0.85 ) ) );
	const fiberTone = float( 1 ).sub( micro.mul( 0.25 ) ).mul( NZ.tone );
	// Crack: a dark gap (shadowed corium), a lighter lifted rim around it.
	const crackColor = u.under.mul( 0.22 );
	const coat = baseColor.mul( ao ).mul( fiberTone ).mul( mix( vec3( 1 ), u.under.mul( 1.35 ), rim.mul( 0.35 ) ) ).mul( mix( vec3( 1 ), crackColor, crack ) ).mul( lip.mul( 0.5 ).add( 1 ) );
	const colorNode = mix( coat, backing, peel );
	const cavity = grooveC.mul( u.grainDepth ).max( poreC ).max( crack );

	const s2 = float( 1 ).sub( wG ).mul( S2_GRAIN ).mul( u.grainDepth.mul( u.grainDepth ) )
		.add( float( 1 ).sub( wP ).mul( S2_PORE ).mul( u.poreDepth ) )
		.add( float( 1 ).sub( wF ).mul( S2_FIBER ) );
	// Tops are polished by use and shine, creases and pores stay matt.
	const rough = mix( mix( u.roughness.mul( mix( float( 0.75 ), float( 1.45 ), cavity ) ), float( 0.9 ), crack ), float( 0.9 ), peel );
	const roughnessNode = specularAA( composeRoughness( rough, s2 ), normalNode );

	const nodes = {
		colorNode, normalNode, roughnessNode,
		metalnessNode: float( 0 ),
		sheenNode: baseColor.mul( u.sheen ),
		sheenRoughnessNode: float( 0.5 ),
	};
	applySurface( nodes, u.surface, { cavity, flatNormal: base, porosity: 0.7 } );
	applyStates( nodes, u.states, { cavity, flatNormal: base, coords: p, fp } );
	nodes.debug = { fp, w1: wG, w2: wP, w3: wF, covered: float( 1 ) };
	return nodes;

}
