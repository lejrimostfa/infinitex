// Honeycomb and beeswax.
// Honeycomb (a frame of comb seen face on):
//   L0 comb      cells of size_mm (5.2 to 5.4 mm worker cells) on a
//                hexagonal net; whole patches capped with pale wax, others
//                full of honey, a few empty and deep. The net bends a
//                little: bees never build a perfect lattice
//   L1 cells     walls 0.07 mm thick, thickened to a rounded rim (the
//                coping, 0.2 to 0.3 mm). Honey: a glossy amber pool with a
//                meniscus climbing the walls. Empty: the walls go dark
//                toward the bottom. Caps: domed, matte, wrinkled
//   L2 wax       wax scales and tool marks of the mandibles on the caps
//                (cell_um), micro bubbles in the honey
// Beeswax (a cast block):
//   L0 block     warm yellow, darker where it cooled slowly, light through
//                it (SSS); white bloom in patches (feature_mm)
//   L1 casting   shrink dimples and flow ripples of the mould
//   L2 bloom     needles of crystallised esters on the bloom (cell_um),
//                pollen specks and debris held in the wax
// Returns { color, slope, cavity, rough, s2, coat, glow }.
//
// Beeswax: the bloom needles, the crystal cells and the specks sit in
// gate()s (core/lod.js) and run only where they show.

import { vec2, vec3, float, mix, smoothstep, step, clamp } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { scratchMarks } from '../../core/marks.js';
import { bubbleField, capSlope } from '../ceramic/bubbles.js';
import { fbm, cells, grains, warp2 } from './common.js';
import { hexNet } from './hex.js';

export function buildHoneycomb( p, fp, u ) {

	const g = u.sizeM, s = u.seed;
	const q = p.add( warp2( p, float( 0.04 ), 1.3 ).mul( g.mul( 0.6 ) ) ).div( g ).add( s.mul( 3.1 ) );
	const H = hexNet( q );
	const k = hash3( H.id.add( 7.7 ) );
	// Caps and honey come in patches of cells.
	const patch = valueNoise( H.id.mul( 0.18 ).add( s ) );
	const capped = step( float( 1 ).sub( u.density ), patch.add( k.x.sub( 0.5 ).mul( 0.15 ) ) );
	const empty = step( k.y, float( 0.12 ) ).mul( capped.oneMinus() );
	const honey = capped.oneMinus().mul( empty.oneMinus() );
	const wG = fadeIn( g, fp, 1.5, 4.0 );
	// L1: walls with a rounded coping rim.
	const rimC = float( 0.045 );
	const eM = H.edge.mul( g );
	const wall = clamp( rimC.mul( g ).sub( eM ).div( fp ).add( 0.5 ), 0, 1 ).mul( wG );
	const t = H.edge.div( rimC ).min( 1 );
	const rimSlope = H.n.mul( t.mul( 1.2 ) ).mul( wall );
	// Inside a cell: radial position 0 centre, 1 wall.
	const r = H.d.mul( 2 ).min( 1 );
	const wax = u.color2.mul( k.z.sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	// Caps: a low dome, matte, wrinkled; a few with a darker centre.
	const C = cells( p, u.cellM, fp, 3.3, { jitter: 0.9, crown: 0.5 } );
	const capCol = wax.mul( vec3( 1.0, 0.92, 0.75 ) ).mul( float( 1 ).sub( r.mul( r ).mul( 0.15 ) ) ).mul( C.h.mul( 0.1 ).mul( C.w ).add( 0.95 ) );
	const capSlope2 = H.g.mul( - 0.25 ).add( C.slope.mul( 0.15 ) );
	// Honey: amber, deeper and darker in the middle, a bright meniscus.
	const menis = smoothstep( 0.75, 1.0, r );
	const honeyCol = mix( u.color.mul( 0.55 ), u.color.mul( 1.25 ), menis.mul( 0.7 ) ).mul( fbm( p, float( 0.03 ), fp, 3, 4 ).mul( 0.4 ).add( 0.8 ) );
	const honeySlope = H.g.mul( menis.mul( menis ).mul( 1.6 ) );
	// Empty: dark toward the bottom, the walls lit on one side.
	const emptyCol = mix( u.color3, wax.mul( 0.6 ), r.pow( 3 ) ).mul( H.g.dot( vec2( 0.6, 0.8 ) ).mul( 0.6 ).add( 1 ) );
	let color = capCol.mul( capped ).add( honeyCol.mul( honey ) ).add( emptyCol.mul( empty ) );
	// Far: mean of cells and walls.
	const far = mix( u.color.mul( 0.8 ), u.color2, u.density.mul( 0.8 ) );
	color = mix( far, color, wG );
	color = mix( color, wax.mul( 1.1 ), wall );
	// L2: micro bubbles in the honey.
	const B = bubbleField( p, fp, float( 4e-4 ), u.bubbles, 19 );
	color = color.mul( float( 1 ).add( B.inside.mul( 0.25 ).sub( B.rim.mul( 0.3 ) ).mul( B.fade ).mul( honey ) ) );
	const slope = capSlope2.mul( capped ).add( honeySlope.mul( honey ) ).add( capSlope( B.v, B.d ).mul( 0.3 ).mul( B.inside ).mul( B.fade ).mul( honey ) )
		.mul( wall.oneMinus() ).add( rimSlope ).mul( wG ).mul( u.relief );
	const cavity = empty.mul( r.oneMinus() ).mul( wG );
	const rough = mix( u.roughness, float( 0.06 ), honey.mul( wall.oneMinus() ).mul( wG ) );
	const coat = honey.mul( wall.oneMinus() ).mul( wG );
	return { color, slope, cavity, rough, s2: wG.oneMinus().mul( 0.08 ), coat, coatRough: float( 0.03 ), glow: mix( u.color, u.color2, capped ) };

}

export function buildBeeswax( p, fp, u ) {

	const s = u.seed;
	// L0: tone and bloom.
	const tone = fbm( p.add( s ), float( 0.08 ), fp, 4, 2 );
	let color = mix( u.color, u.color3, smoothstep( 0.45, 0.8, tone ).mul( 0.6 ) );
	color = color.mul( fbm( p.add( 3.3 ), float( 0.01 ), fp, 3, 5 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	const bloom = smoothstep( 0.5, 0.7, fbm( p.add( 9.1 ), u.featureM.mul( 10 ), fp, 4, 7 ) ).mul( u.dust ).toVar();
	// L1: shrink dimples and flow ripples.
	const D = bubbleField( p, fp, u.sizeM, u.density, 11 );
	const rip = fbm( vec2( p.x.div( 4 ), p.y ), u.sizeM.mul( 0.6 ), fp, 3, 3 );
	const e = u.sizeM.mul( 0.05 );
	const rip2 = fbm( vec2( p.x.div( 4 ), p.y.add( e ) ), u.sizeM.mul( 0.6 ), fp, 3, 3 );
	let slope = capSlope( D.v, D.d ).mul( - 0.15 ).mul( D.inside ).mul( D.fade ).add( vec2( 0, rip2.sub( rip ).div( e ).mul( u.sizeM.mul( 0.01 ) ) ) );
	// L2: bloom needles and specks. The needles are read only on the
	// bloom, their cover from 2 px of cellM and their slope from about
	// 1 px of their width (scratchMarks()), far finer: one gate.
	const N = gate( bloom.greaterThan( 0 ).and( fadeOn( u.cellM, fp, 2.0 ) ), { cov: 0, slope: [ 0, 0 ] }, () => {

		const M = scratchMarks( p, fp, u.cellM.mul( 3 ), u.cellM.mul( 0.15 ), 5.5, { density: 0.9, length: 0.6 } );
		return { cov: M.cov.mul( fadeIn( u.cellM, fp, 2.0, 5.0 ) ), slope: M.slope };

	}, [ p, fp ] );
	const Cr = gate( fadeOn( u.cellM.mul( 4 ), fp, 2.0 ), { tint: 1, slope: [ 0, 0 ] }, () => {

		const C = cells( p, u.cellM.mul( 4 ), fp, 8.1, { jitter: 0.9, crown: 0.6 } );
		return { tint: C.id.x.sub( 0.5 ).mul( 0.1 ).mul( C.w ).add( 1 ), slope: C.slope };

	}, [ p, fp ] );
	color = color.mul( Cr.tint );
	const bl = bloom.mul( N.cov.mul( 0.5 ).add( 0.6 ) ).min( 1 );
	color = mix( color, vec3( 0.86, 0.8, 0.66 ), bl.mul( 0.5 ) );
	const { speck } = gate( fadeOn( u.featureM, fp, 1.5 ), { speck: 0 }, () => {

		const G = grains( p, u.featureM, fp, 4.2, { gap: 0.35, radius: 0.25, round: 0.4 } );
		return { speck: G.body.mul( step( 0.92, G.id.x ) ).mul( fadeIn( u.featureM, fp, 1.5, 4.0 ) ) };

	}, [ p, fp ] );
	color = mix( color, u.color3.mul( 0.4 ), speck.mul( 0.7 ) );
	slope = slope.add( N.slope.mul( bloom ) ).add( Cr.slope.mul( 0.05 ) ).mul( u.relief );
	const rough = mix( u.roughness, float( 0.85 ), bloom );
	return { color, slope, cavity: D.inside.mul( 0.3 ).mul( D.fade ), rough, s2: float( 0.01 ), glow: u.color.mul( vec3( 1.1, 0.8, 0.4 ) ) };

}
