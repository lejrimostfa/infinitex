// Eggshell and pearl: calcium carbonate, matte crust or stacked nacre.
// Eggshell (a brown hen egg):
//   L0 shell     a soft mottle of the brown pigment (protoporphyrin), dark
//                speckles of 0.2 to 2 mm, a paler wash here and there
//   L1 crust     a matte calcite crust, gently bumpy (mammillary knobs,
//                size_mm, 0.2 to 0.4 mm); pores of 10 to 30 um, about
//                one every feature_mm (0.8 to 1 mm), each a dark pit with
//                a pale halo
//   L2 crystals  calcite crystal faces (cell_um, 20 to 50 um) under a thin
//                cuticle: tiny flat facets, each its own tilt
// Pearl (nacre, a saltwater pearl seen close):
//   L0 lustre    white with a pink or green overtone (the orient), soft
//                broad tone waves, a few blemishes (spots, pits)
//   L1 waves     very low waves of the surface (feature_mm), like a
//                fingerprint under the light
//   L2 terraces  edges of the aragonite tablets: contour lines cell_um
//                apart, each a tiny step; the stack of 0.4 um layers
//                interferes: the colour shifts with the angle (thin film)
// Returns { color, slope, cavity, rough, s2, irid, iridThick }.

import { vec3, float, fract, mix, smoothstep, clamp, mod, cos } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { fbm, cells, band } from './common.js';

export function buildEggshell( p, fp, u ) {

	const s = u.seed;
	// L0: mottle, wash, speckles.
	const m = fbm( p.add( s ), float( 0.05 ), fp, 4, 2 );
	let color = mix( u.color, u.color2, smoothstep( 0.35, 0.75, m ) );
	color = color.mul( fbm( p.add( 4.4 ), float( 0.006 ), fp, 3, 3 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	const sp1 = smoothstep( 0.72, 0.76, fbm( p.add( 8.8 ), float( 0.004 ), fp, 3, 9 ) );
	const sp2 = smoothstep( 0.74, 0.78, fbm( p.add( 1.9 ), float( 0.0012 ), fp, 2, 6 ) );
	color = mix( color, u.color3, sp1.max( sp2.mul( 0.8 ) ).mul( u.density ) );
	// L1: bumpy crust, pores.
	const B = cells( p, u.sizeM, fp, 2.7, { jitter: 0.9, crown: 0.8 } );
	const V = voronoi( mod( p.div( u.featureM ), 4096 ).add( 5.5 ), 0.9 );
	const d = V.toSeed.length().mul( u.featureM );
	const rM = hash3( V.id1 ).x.mul( 10e-6 ).add( 10e-6 );
	const rE = rM.max( fp.mul( 0.6 ) );
	const pore = clamp( rE.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( rM.div( rE ) ).mul( fadeIn( u.featureM, fp, 2.0, 5.0 ) );
	const halo = smoothstep( rM.mul( 4 ), rM, d ).mul( fadeIn( rM.mul( 4 ), fp, 1.0, 3.0 ) );
	color = color.mul( float( 1 ).sub( pore.mul( 0.7 ) ) ).mul( halo.mul( 0.08 ).add( 1 ) );
	// L2: crystal facets, flat and tilted.
	const X = voronoi( mod( p.div( u.cellM ), 4096 ).add( 9.9 ), 0.9 );
	const xk = hash3( X.id1 );
	const wX = fadeIn( u.cellM, fp, 2.0, 5.0 );
	const facet = xk.xy.sub( 0.5 ).mul( 0.35 ).mul( wX );
	const seam = band( X.edge.mul( u.cellM ), u.cellM.mul( 0.02 ), fp ).mul( wX );
	color = color.mul( xk.z.sub( 0.5 ).mul( 0.08 ).mul( wX ).add( 1 ) ).mul( float( 1 ).sub( seam.mul( 0.15 ) ) );
	const slope = B.slope.mul( 0.08 ).add( facet ).add( V.toSeed.mul( - 1.5 ).mul( halo ).mul( 0.2 ) ).mul( u.relief );
	const s2 = B.s2.mul( 0.05 ).add( wX.oneMinus().mul( 0.06 ) );
	return { color, slope, cavity: pore.max( seam.mul( 0.3 ) ), rough: u.roughness, s2 };

}

export function buildPearl( p, fp, u ) {

	const s = u.seed;
	// L0: lustre and overtone, broad tone waves, blemishes.
	const w0 = fbm( p.add( s ), float( 0.06 ), fp, 3, 2 );
	let color = mix( u.color, u.color2, smoothstep( 0.3, 0.8, w0 ).mul( 0.7 ) );
	const blem = smoothstep( 0.78, 0.82, fbm( p.add( 6.6 ), float( 0.005 ), fp, 3, 7 ) ).mul( u.density );
	color = mix( color, u.color3, blem.mul( 0.5 ) );
	// L1: low waves, a height from slow noise (surface gradient).
	const F = u.featureM;
	const hW = valueNoise( p.div( F ).add( 3.3 ) ).mul( fadeIn( F, fp, 2.0, 6.0 ) ).add( valueNoise( p.div( F.mul( 0.4 ) ).add( 7.1 ) ).mul( 0.4 ).mul( fadeIn( F.mul( 0.4 ), fp, 2.0, 6.0 ) ) );
	const sW = surfaceGradient( hW.mul( F ).mul( 0.12 ), p );
	// L2: tablet terraces: contour lines of a warped noise.
	const n = fbm( p.add( 2.2 ), u.cellM.mul( 40 ), fp, 3, 5 );
	const t = n.mul( 40 );
	// L1 also: the same fingerprint at a coarser step, faint.
	const n1 = fbm( p.add( 5.2 ), F.mul( 3 ), fp, 3, 8 );
	const c1 = fract( n1.mul( 30 ) );
	const w1 = fadeIn( F.mul( 3 ).div( 30 ), fp, 2.0, 6.0 );
	color = color.mul( smoothstep( 0.0, 0.15, c1 ).mul( smoothstep( 1.0, 0.85, c1 ) ).oneMinus().mul( - 0.1 ).mul( w1 ).add( 1 ) );
	const fr = fract( t );
	const wT = fadeIn( u.cellM, fp, 2.0, 6.0 );
	const step1 = smoothstep( 0.0, 0.08, fr ).mul( smoothstep( 1.0, 0.92, fr ) );
	color = color.mul( float( 1 ).sub( step1.oneMinus().mul( 0.12 ).mul( wT ) ) );
	const sT = surfaceGradient( fr.mul( u.cellM ).mul( 0.02 ).mul( wT ), p );
	const slope = sW.add( sT ).mul( u.relief );
	const s2 = wT.oneMinus().mul( 0.004 );
	// Orient: thin film, thickness drifting over the pearl and per terrace.
	const film = w0.mul( 0.6 ).add( n.mul( 0.4 ) );
	// A faint body tint of the same film (the orient seen in diffuse light).
	const hue = film.mul( 9 );
	color = color.mul( vec3( cos( hue ), cos( hue.add( 2.1 ) ), cos( hue.add( 4.2 ) ) ).mul( 0.06 ).add( 0.97 ) );
	const irid = u.sheen.add( 0.4 ).min( 1 ).mul( float( 1 ).sub( blem ) );
	return { color, slope, cavity: blem.mul( 0.3 ), rough: u.roughness, s2, irid, iridThick: mix( float( 250 ), float( 750 ), film ), iridIOR: float( 1.68 ), coat: float( 0.6 ), coatRough: float( 0.05 ) };

}
