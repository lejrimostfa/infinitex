// Sand, from the beach down to the grain surface.
//   L0 ripples   wind ripples, 5 to 10 cm apart, a gentle windward slope
//                and a steep lee; crests wander. Dark heavy minerals
//                gather in the troughs, damp patches darken the sand.
//   L1 grains    0.1 to 0.5 mm, packed in two sizes: mostly quartz (pale,
//                clear), some feldspar (pink to orange), a few dark grains
//                (magnetite, hornblende), rare white shell bits. Each grain
//                leans its own way, so polished ones glint.
//   L2 surface   grains rounded by the wind are frosted: pits of 5 to 20 um
//                and small conchoidal facets that catch the light; silt
//                fills the gaps.
// Returns { color, slope, cavity, rough, s2 } for shader.js.
//
// Each level sits in a gate() (core/lod.js): beyond the grains' fade only
// the ripples and the mean colour are computed, and the facets and pits run
// only where they show.

import { vec2, vec3, float, fract, mix, smoothstep, step, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate, pick } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { packed, fbm } from './grains.js';

export function ripples( p, u ) {

	const L = u.rippleM;
	const warp = fbm( p.div( L.mul( 2.5 ) ).add( u.seed ), 3 ).sub( 0.5 ).mul( 1.6 );
	const ph = p.y.div( L ).add( warp ).add( p.x.div( L.mul( 7 ) ) );
	const t = fract( ph );
	// Windward rise over 75 % of the period, lee drop over the rest.
	const wind = step( t, 0.75 );
	const x = pick( wind, t.div( 0.75 ), t.oneMinus().div( 0.25 ) );
	const prof = x.mul( x ).mul( x.mul( - 2 ).add( 3 ) );
	const dProf = x.mul( x.oneMinus() ).mul( 6 ).mul( pick( wind, float( 1 / 0.75 ), float( - 1 / 0.25 ) ) );
	const amp = u.ripple.mul( 0.1 );
	return { prof, trough: prof.oneMinus(), slope: vec2( 0, dProf.mul( amp ) ), amp };

}

// L2 facets: conchoidal facets on each grain, the polished ones glint.
// Fade: period 0.25 g, from 2 px. fq: the facet cells' coordinates, taken
// before the branches (computed inside one, they round differently and
// some facet borders move by a pixel).
function facets( fp, u, body, dark, fq ) {

	const g = u.grainM;
	const wF = fadeIn( g.mul( 0.25 ), fp, 2.0, 6.0 ).toVar();
	const F = voronoi( fq, 0.9 );
	const fh = hash3( F.id1.add( 5.5 ) );
	// Clear quartz with a fresh facet is glossy; frosted grains are not.
	const polish = step( 1 - 0.35, fh.z ).mul( u.sparkle ).mul( dark.oneMinus() );
	return { facet: fh.xy.sub( 0.5 ).mul( 0.35 ).mul( wF ).mul( body ), gloss: polish.mul( wF ), wF };

}

// L2 pits and silt. Fade: period 0.04 g, from 2 px.
function pitsLevel( p, fp, u ) {

	const g = u.grainM;
	const pits = valueNoise( p.div( g.mul( 0.04 ) ).add( 3.3 ) );
	const wP = fadeIn( g.mul( 0.04 ), fp, 2.0, 6.0 );
	return {
		dark: float( 1 ).sub( smoothstep( 0.6, 0.85, pits ).mul( 0.12 ).mul( wP ) ),
		silt: valueNoise( p.div( g.mul( 0.05 ) ).add( 8.1 ) ).mul( wP ),
		slope: vec2( pits.sub( 0.5 ), valueNoise( p.div( g.mul( 0.04 ) ).add( 6.6 ) ).sub( 0.5 ) ).mul( 0.25 ).mul( wP ),
	};

}

// L1 and L2: the grains, their facets, pits and silt. Returns the colour
// before the damp patches and tone, the slope with the ripples, and the
// gloss of the polished facets.
function grainLevels( p, fp, u, trough, rippleSlope, meanCol, amp ) {

	const g = u.grainM;
	// L1: packed grains, two sizes.
	const G = packed( p, g, fp, 3.1, { gap: 0.03, round: 0.35, crown: 0.4, tilt: 0.25, sizeVar: u.sizeVar, lift: 0.3 } );
	const wG = fadeIn( g, fp, 1.5, 5.0 ).toVar();
	const id = G.id;
	const body = G.body.toVar();
	// Minerals: dark grains more common in the ripple troughs.
	const darkP = u.specks.mul( 0.12 ).mul( trough.mul( 1.4 ).add( 0.3 ) );
	const dark = step( id.y, darkP ).toVar();
	const feld = step( 0.78, id.y ).mul( dark.oneMinus() );
	const shell = step( 0.97, id.z ).mul( dark.oneMinus() );
	const quartz = mix( u.color, u.color.mul( vec3( 1.12, 1.1, 1.05 ) ), id.z );
	let grainCol = mix( quartz, u.color2, feld.mul( 0.8 ) );
	grainCol = mix( grainCol, u.color3.mul( id.z.mul( 0.6 ).add( 0.7 ) ), dark );
	grainCol = mix( grainCol, vec3( 0.86, 0.84, 0.8 ), shell ).mul( id.x.mul( 0.22 ).add( 0.86 ) );
	// Inside a grain: iron stains and a clear core seen through the frost.
	const stain = valueNoise( G.toSeed.mul( 3 ).add( id.xy.mul( 50 ) ) );
	grainCol = grainCol.mul( mix( vec3( 1 ), vec3( 0.92, 0.78, 0.62 ), stain.mul( id.z ).mul( 0.6 ) ) )
		.mul( float( 0.85 ).add( G.toSeed.length().mul( 0.35 ) ) );
	// Shading inside the pack: gaps fall into shadow, small grains sit lower.
	const ao = smoothstep( - 0.35, 0.5, G.h ).mul( 0.6 ).add( 0.4 );
	let color = mix( meanCol, grainCol.mul( ao ), wG );

	// Facet cells' coordinates, before the facets' branch (see facets()).
	const fq = mod( p.div( g.mul( 0.22 ) ), 4096 ).add( 9.3 ).toVar();
	// L2: frosted pits and conchoidal facets on each grain, silt in gaps.
	// Facets skipped under 2 px per 0.25 g, pits and silt under 2 px per 0.04 g.
	const F = gate( fadeOn( g.mul( 0.25 ), fp, 2.0 ), { facet: [ 0, 0 ], gloss: 0, wF: 0 }, () => facets( fp, u, body, dark, fq ), [ fp, body, dark, fq ] );
	const P = gate( fadeOn( g.mul( 0.04 ), fp, 2.0 ), { dark: 1, silt: 0, slope: [ 0, 0 ] }, () => pitsLevel( p, fp, u ), [ p, fp ] );
	color = color.mul( P.dark );
	color = mix( color, u.color.mul( 0.22 ).mul( P.silt.mul( 0.4 ).add( 0.8 ) ), body.oneMinus().mul( wG ).mul( 0.7 ) );

	return {
		color,
		slope: rippleSlope.add( G.grad.mul( amp ).mul( wG ) ).add( F.facet ).add( P.slope ),
		gloss: F.gloss,
		s2: wG.oneMinus().mul( 0.08 ).mul( amp ).add( F.wF.oneMinus().mul( 0.02 ) ),
		cavity: smoothstep( 0.3, - 0.3, G.h ).mul( wG ),
	};

}

export function buildSand( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	const R = ripples( p, u );
	const trough = R.trough.toVar(), rippleSlope = R.slope.toVar();
	// Damp patches and drifts of colour over a few cm.
	const patch = fbm( p.div( 0.05 ).add( s.mul( 3 ) ), 3 );
	const damp = smoothstep( 0.5, 0.8, patch ).mul( 0.3 );
	const tone = fbm( p.div( 0.012 ).add( 4.4 ), 2 ).sub( 0.5 ).mul( 0.25 ).add( 1 );
	const amp = u.relief.mul( 0.5 );
	// Far: the average of the same mix, troughs a little darker.
	const meanCol = mix( u.color.mul( 1.04 ), u.color2, 0.18 ).mul( 0.7 ).mul( float( 1 ).sub( trough.mul( u.specks ).mul( 0.12 ) ) );

	// Past the grains' fade (under 1.5 px per grain) only the ripples and
	// the mean colour remain: the grains, facets and pits are skipped.
	const far = { color: { node: meanCol, size: 3 }, slope: { node: rippleSlope, size: 2 }, gloss: 0, s2: amp.mul( 0.08 ).add( 0.02 ), cavity: 0 };
	const L = gate( fadeOn( g, fp, 1.5 ), far, () => grainLevels( p, fp, u, trough, rippleSlope, meanCol, amp ), [ p, fp, trough, rippleSlope ] );

	const color = L.color.mul( float( 1 ).sub( damp ) ).mul( tone );
	const rough = mix( u.roughness, float( 0.22 ), L.gloss ).add( damp.mul( - 0.2 ) );
	const cavity = L.cavity.max( trough.mul( 0.2 ) );
	return { color, slope: L.slope, cavity, rough, s2: L.s2 };

}
