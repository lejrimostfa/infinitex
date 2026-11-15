// Soil life: mould colonies and compost.
// Mould (colonies on bread, Rhizopus and Penicillium):
//   L0 colonies  round colonies (size_mm, 10 to 40 mm) on a brown
//                substrate: a white fluffy rim that grows outward, an
//                older centre gone blue green (spores) or grey black
//   L1 fuzz      a felt of aerial hyphae, denser toward the centre,
//                sparse threads running out past the rim
//   L2 hyphae    single hyphae (fiber_um, 5 to 10 um) crossing, and
//                spore heads (feature_mm, 50 to 150 um): dark spheres
// Compost (mature, crumbly):
//   L0 heap      dark brown humus, damp patches, a few pale fragments
//   L1 crumbs    packed crumbs (size_mm), flat leaf fragments with veins,
//                twigs and fibres, white fungal threads in patches
//   L2 grains    mineral grains, fine fibres and hyphae (cell_um)
// Returns { color, slope, cavity, rough, s2, sheen }.

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { fbm, band, grains, packed, fibres } from './common.js';

export function buildMould( p, fp, u ) {

	const s = u.seed, g = u.sizeM;
	// The substrate (bread crumb): pores and grains of its own.
	// Soft crumb relief: a noise height, its slope from the surface gradient.
	const crumb = fbm( p.add( 1.9 ), float( 1.2e-3 ), fp, 4, 4 );
	const Bslope = surfaceGradient( crumb.mul( 4e-4 ), p );
	const sub = u.color3.mul( fbm( p.add( s ), float( 0.01 ), fp, 4, 3 ).mul( 0.5 ).add( 0.75 ) ).mul( crumb.mul( 0.5 ).add( 0.75 ) );
	// L0: colonies, one per Voronoi cell, some cells empty.
	const V = voronoi( mod( p.div( g ), 4096 ).add( s.mul( 0.37 ) ), 0.9 );
	const k = hash3( V.id1.add( 1.7 ) );
	const on = step( k.z, u.density.mul( 0.6 ).add( 0.3 ) );
	const fbmR = fbm( p.add( 2.2 ), g.mul( 0.3 ), fp, 3, 5 );
	const rr = V.toSeed.length().div( k.x.mul( 0.25 ).add( 0.35 ) ).add( fbmR.sub( 0.5 ).mul( 0.3 ) );
	const cover = smoothstep( 1.05, 0.85, rr ).mul( on );
	const old = smoothstep( 0.75, 0.35, rr ).mul( on );
	// Spore colour: blue green (Penicillium) or grey black (Rhizopus).
	const spore = mix( u.color2, vec3( 0.08, 0.08, 0.08 ), step( 0.6, k.y ) );
	const white = u.color.mul( fbm( p.add( 4.4 ), g.mul( 0.08 ), fp, 3, 6 ).mul( 0.25 ).add( 0.85 ) );
	// Concentric growth rings in the old centre.
	const ring = smoothstep( 0.3, 0.7, fbm( vec2( rr.mul( 8 ), k.x.mul( 9 ) ), float( 1 ), fp.div( g ), 2, 4 ) );
	let color = mix( sub, white, cover );
	color = mix( color, spore.mul( ring.mul( 0.4 ).add( 0.7 ) ), old.mul( 0.85 ) );
	// L1: hyphae felt, runners past the rim; L2: single hyphae.
	const H1 = fibres( p, u.fiberM.mul( 40 ), u.fiberM.mul( 0.5 ), float( 0.8 ), fp, 3.3, 0.8 );
	const H2 = fibres( p, u.fiberM.mul( 15 ), u.fiberM.mul( 0.5 ), float( 0.7 ), fp, 7.9, 0.8 );
	const near = smoothstep( 1.4, 0.9, rr ).mul( on ).max( 0.2 );
	const thread = H1.fiber.max( H2.fiber ).mul( near );
	color = mix( color, white.mul( 1.05 ), thread.mul( 0.9 ) );
	// Spore heads: dark spheres on stalks, over the old centre.
	const S = grains( p, u.featureM, fp, 6.1, { gap: 0.35, radius: 0.3, round: 0.5, crown: 0.8 } );
	const head = S.body.mul( step( 0.4, S.id.x ) ).mul( old.max( cover.mul( 0.3 ) ) ).mul( fadeIn( u.featureM, fp, 1.5, 4.0 ) );
	color = mix( color, spore.mul( S.h.mul( 0.5 ).add( 0.5 ) ), head.mul( 0.9 ) );
	const slope = H1.slope.add( H2.slope ).mul( near ).mul( 0.4 ).add( Bslope.mul( cover.oneMinus() ) ).add( S.grad.mul( 0.6 ).mul( head ) ).mul( u.relief );
	const s2 = cover.mul( 0.1 ).mul( fadeIn( u.fiberM.mul( 15 ), fp, 1.0, 3.0 ).oneMinus() );
	return { color, slope, cavity: cover.oneMinus().mul( 0.3 ), rough: mix( u.roughness, float( 0.95 ), cover ), s2, sheen: white.mul( u.sheen ).mul( cover ), sheenRough: float( 0.5 ) };

}

export function buildCompost( p, fp, u ) {

	const s = u.seed, g = u.sizeM;
	const tone = fbm( p.add( s ), float( 0.05 ), fp, 4, 2 );
	const damp = smoothstep( 0.5, 0.7, tone );
	const humus = u.color.mul( tone.mul( 0.5 ).add( 0.75 ) ).mul( float( 1 ).sub( damp.mul( 0.3 ) ) );
	// L1: crumbs, packed in two sizes.
	const C = packed( p, g, fp, 4.1, { gap: 0.12, round: 0.45, crown: 0.5, sizeVar: 0.8, elong: 0.6, tilt: 0.3, ratio: 0.5 } );
	const wC = fadeIn( g, fp, 1.5, 4.0 );
	let color = humus.mul( C.id.x.sub( 0.5 ).mul( u.colorVar ).mul( wC ).add( 1 ) ).mul( mix( float( 0.8 ), C.h.mul( 0.4 ).add( 0.6 ).max( 0.3 ), wC ) );
	// Leaf fragments: flat plates of a paler brown with veins.
	const L = voronoi( mod( p.div( g.mul( 3 ) ), 4096 ).add( 7.3 ), 0.9 );
	const lk = hash3( L.id1.add( 2.2 ) );
	const lw = L.edge.sub( 0.12 ).add( fbm( p.add( 1.3 ), g.mul( 0.6 ), fp, 2, 9 ).sub( 0.5 ).mul( 0.25 ) );
	const leaf = clamp( lw.mul( g.mul( 3 ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( lk.x, u.density.mul( 0.35 ) ) );
	const vein = band( L.toSeed.dot( vec2( lk.y.sub( 0.5 ), lk.z.sub( 0.5 ) ).normalize() ).mul( g.mul( 3 ) ), g.mul( 0.03 ), fp ).mul( leaf );
	const leafCol = mix( u.color2.mul( 0.7 ), u.color.mul( 1.2 ), lk.y ).mul( fbm( p.add( 9.1 ), g.mul( 0.5 ), fp, 3, 4 ).mul( 0.4 ).add( 0.8 ) );
	color = mix( color, leafCol, leaf );
	color = mix( color, leafCol.mul( 0.7 ), vein.mul( 0.6 ) );
	// Twigs and fibres; white fungal threads in patches.
	const T = fibres( p, g.mul( 2 ), g.mul( 0.06 ), float( 0.35 ), fp, 5.5, 0.4 );
	color = mix( color, u.color2.mul( 0.8 ), T.fiber );
	const fungus = smoothstep( 0.62, 0.75, fbm( p.add( 3.7 ), float( 0.03 ), fp, 3, 8 ) ).mul( u.fuzz );
	const Hy = fibres( p, u.cellM.mul( 20 ), u.cellM.mul( 0.25 ), float( 0.8 ), fp, 8.8, 0.9 );
	color = mix( color, vec3( 0.8, 0.78, 0.72 ), Hy.fiber.mul( fungus ).add( fungus.mul( 0.15 ).mul( fadeIn( u.cellM.mul( 20 ), fp, 2.0, 5.0 ).oneMinus() ) ) );
	// L2: mineral grains.
	const M = grains( p, u.cellM.mul( 4 ), fp, 2.6, { gap: 0.2, radius: 0.35, round: 0.4, crown: 0.6 } );
	const min = M.body.mul( step( 0.75, M.id.x ) ).mul( fadeIn( u.cellM.mul( 4 ), fp, 1.5, 4.0 ) ).mul( leaf.oneMinus() );
	color = mix( color, vec3( 0.5, 0.45, 0.38 ).mul( M.id.y.mul( 0.5 ).add( 0.6 ) ), min.mul( 0.8 ) );
	const slope = C.grad.mul( 0.6 ).mul( wC ).mul( leaf.oneMinus() ).add( T.slope.mul( 0.5 ) ).add( M.grad.mul( 0.4 ).mul( min ) ).mul( u.relief );
	const cavity = C.h.oneMinus().mul( 0.5 ).mul( wC ).add( wC.oneMinus().mul( 0.3 ) );
	return { color, slope, cavity, rough: mix( u.roughness, float( 0.5 ), damp ), s2: wC.oneMinus().mul( 0.12 ) };

}
