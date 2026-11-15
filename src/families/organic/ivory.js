// Ivory and tortoiseshell: polished hard tissues, glossy under a coat.
// Ivory (elephant tusk, cut across):
//   L0 tusk      the face is a slice of a tusk whose centre sits below
//                the cube: concentric growth rings (feature_mm apart),
//                warm yellow patches of age (blush), a darker cementum rim
//   L1 Schreger  two sets of log spirals from the centre, crossing: a
//                checker of light and dark lozenges 2 to 4 mm wide, the
//                mark of true elephant ivory; age cracks along a few rings
//   L2 tubules   growth lines 0.1 to 0.2 mm apart, dentinal tubules as
//                wavy radial hairlines cell_um apart, polishing scratches
// Tortoiseshell (hawksbill scute, polished):
//   L0 blotches  dark brown blotches on clear amber, in two layers: the
//                deep one blurred by the keratin above it
//   L1 laminae   keratin laid in thin layers: wavy faint lines feature_mm
//                apart; blotch edges break into clusters of specks
//   L2 granules  melanin granules (cell_um) as fine dark dots in the
//                clear keratin, polishing scratches
// Returns { color, slope, cavity, rough, s2, coat, coatRough, glow }.

import { vec2, vec3, float, floor, mix, smoothstep, step, atan, log, fract } from 'three/tsl';
import { hash3, valueNoise } from '../../core/hash.js';
import { fadeIn } from '../../core/lod.js';
import { scratchMarks } from '../../core/marks.js';
import { fbm, band, grains, warp2 } from './common.js';

export function buildIvory( p, fp, u ) {

	const s = u.seed;
	const c = vec2( 0.17, - 0.08 ).add( s.mul( 0.003 ) );
	const d = p.sub( c ).add( warp2( p, float( 0.05 ), 2.2 ).mul( 0.006 ) );
	const r = d.length(), th = atan( d.y, d.x );
	// L0: growth rings, warm yellowing of age, darker cementum rim.
	const F = u.featureM;
	const ring = fbm( vec2( r.div( F ), th.mul( 3 ) ), float( 1 ), fp.div( F ), 3, 3 );
	let color = mix( u.color, u.color.mul( 0.93 ), smoothstep( 0.35, 0.7, ring ) );
	const age = smoothstep( 0.4, 0.75, fbm( p.add( 3.1 ), float( 0.06 ), fp, 4, 5 ) ).mul( u.blush );
	color = mix( color, u.color2, age.mul( 0.8 ) );
	color = mix( color, u.color3, smoothstep( 0.27, 0.29, r ).mul( 0.6 ) );
	// L1: Schreger pattern: two families of log spirals crossing; the
	// lozenges between them alternate light and dark.
	const N = float( 300 ).mul( u.density.add( 0.5 ) );
	const lr = log( r.max( 1e-3 ) ).mul( 1.2 );
	const tA = th.add( lr ).mul( N.div( 6.2832 ) ), tB = th.sub( lr ).mul( N.div( 6.2832 ) );
	const per = r.mul( 6.283 ).div( N );
	const wS = fadeIn( per, fp, 1.5, 4.0 );
	const sq = ( t ) => smoothstep( 0.1, 0.25, fract( t ).sub( 0.5 ).abs() ).mul( 2 ).sub( 1 );
	const chk = sq( tA ).mul( sq( tB ) ).mul( valueNoise( p.div( 0.01 ) ).mul( 0.6 ).add( 0.4 ) );
	color = color.mul( chk.mul( 0.13 ).mul( wS ).add( 1 ) );
	// Age cracks along a few rings, partial.
	const ri = floor( r.div( F.mul( 2 ) ) );
	const crk = band( fract( r.div( F.mul( 2 ) ) ).sub( 0.5 ).mul( F.mul( 2 ) ), float( 1.5e-5 ), fp )
		.mul( step( 0.75, hash3( vec2( ri, 7.7 ) ).x ) ).mul( smoothstep( 0.55, 0.65, valueNoise( vec2( th.mul( 30 ), ri ) ) ) );
	color = mix( color, u.color3.mul( 0.5 ), crk.mul( 0.8 ) );
	// L2: growth lines (0.1 to 0.2 mm), tubules, polishing scratches.
	const gl = band( fract( r.div( F.mul( 0.12 ) ).add( ring.mul( 2 ) ) ).sub( 0.5 ).mul( F.mul( 0.12 ) ), F.mul( 0.015 ), fp ).mul( fadeIn( F.mul( 0.12 ), fp, 2.0, 6.0 ) );
	const tw = valueNoise( vec2( r.div( u.cellM.mul( 8 ) ), th.mul( 200 ) ) ).mul( 0.6 );
	const tub = band( fract( th.mul( r ).div( u.cellM ).add( tw ) ).sub( 0.5 ).mul( u.cellM ), u.cellM.mul( 0.1 ), fp ).mul( fadeIn( u.cellM, fp, 2.5, 6.0 ) );
	const S = scratchMarks( p, fp, float( 0.002 ), float( 1.5e-6 ), 4.4, { density: 0.5 } );
	color = color.mul( float( 1 ).sub( tub.mul( 0.2 ) ).sub( gl.mul( 0.1 ) ) ).add( S.cov.mul( 0.05 ) );
	const slope = S.slope.mul( 0.3 ).add( vec2( chk, 0 ).mul( 0.003 ).mul( wS ) ).mul( u.relief );
	return { color, slope, cavity: tub.mul( 0.2 ).max( crk ), rough: u.roughness, s2: float( 0.003 ), coat: u.wax, coatRough: float( 0.06 ),
		glow: color.mul( vec3( 1.1, 1.0, 0.8 ) ) };

}

export function buildTortoise( p, fp, u ) {

	const s = u.seed;
	const w = p.add( warp2( p, float( 0.06 ), 1.1 ).mul( 0.03 ) );
	// L0: deep blurred blotches and sharper near ones.
	const deep = smoothstep( 0.45, 0.62, fbm( w.add( s ), float( 0.07 ), fp, 2, 2 ) );
	const nb = fbm( w.add( 3.3 ), u.sizeM, fp, 5, 4 );
	const near = smoothstep( 0.52, 0.56, nb );
	// L1: blotch edges break into specks; laminae lines.
	const G = grains( p, u.featureM.mul( 0.5 ), fp, 7.3, { gap: 0.25, radius: 0.35, round: 0.4 } );
	const edge = smoothstep( 0.44, 0.52, nb ).mul( near.oneMinus() );
	const speck = G.body.mul( smoothstep( 0.3, 0.9, edge.add( G.id.x.mul( 0.4 ) ).sub( 0.3 ) ) ).mul( fadeIn( u.featureM.mul( 0.5 ), fp, 1.5, 4.0 ) );
	const lamT = w.y.add( fbm( w, float( 0.02 ), fp, 2, 7 ).mul( 0.01 ) );
	const lam = band( fract( lamT.div( u.featureM ) ).sub( 0.5 ).mul( u.featureM ), u.featureM.mul( 0.04 ), fp ).mul( fadeIn( u.featureM, fp, 3.0, 8.0 ) );
	const amber = u.color.mul( fbm( p.add( 6.1 ), float( 0.03 ), fp, 3, 6 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	let color = mix( amber, u.color2, deep.mul( 0.75 ) );
	color = mix( color, u.color3, near.max( speck.mul( 0.8 ) ) );
	color = color.mul( float( 1 ).sub( lam.mul( 0.15 ) ) );
	// L2: melanin granules, darker in the blotches.
	const M = grains( p, u.cellM, fp, 2.9, { gap: 0.3, radius: 0.3, round: 0.4 } );
	const gr = M.body.mul( fadeIn( u.cellM, fp, 2.0, 5.0 ) ).mul( deep.mul( 0.4 ).add( edge ).min( 1 ) );
	color = mix( color, u.color3, gr.mul( 0.5 ) );
	const S = scratchMarks( p, fp, float( 0.003 ), float( 2e-6 ), 6.6, { density: 0.4 } );
	color = color.add( S.cov.mul( 0.04 ) );
	const glow = mix( u.color.mul( vec3( 1.2, 0.8, 0.4 ) ), u.color3, near.max( deep.mul( 0.6 ) ) );
	return { color, slope: S.slope.mul( 0.3 ).mul( u.relief ), cavity: float( 0 ), rough: u.roughness, s2: float( 0.002 ), coat: float( 1 ), coatRough: float( 0.04 ), glow };

}
