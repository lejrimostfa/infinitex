// Old plastic, years of sun and handling (ABS, polystyrene, PVC).
//   yellowing  UV breaks the polymer and the flame retardant: the colour
//              drifts to color2 in patches of 2 to 10 cm, strongest where
//              the light fell, with a soft mottle inside each patch
//   chalk      the top microns turn to powder: paler, flatter colour, a
//              matte surface; up close pits of 5 to 12 um and loose grains
//   crazing    stress and UV open a net of fine cracks, cells of about a
//              mm, long in one direction; 3 to 10 um wide, dirt inside;
//              a finer net (0.3 mm) between them
// W: { color, slope, cavity, rough, s2 }, returned updated.
//
// The chalk pits, the crazing outside its patches and each crack net sit
// in gate()s (core/lod.js): they run only where they show.

import { vec2, vec3, float, mix, smoothstep, clamp, step, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

// A net of cracks from Voronoi borders, anisotropic. halfW in meters.
// Skipped under 2 px per cell, where only the mean share of cracked
// surface shows. Returns the line, and for the lips the direction and
// smoothstep( 3e-5, 4e-6, edge ) * wN.
function crackNet( p, fp, cellM, halfW, stretch, off ) {

	// Faded: the mean share of cracked surface.
	const mean = halfW.mul( 2 ).div( cellM ).mul( 1.6 );
	const q = vec2( p.x.div( cellM.mul( stretch ) ), p.y.div( cellM ) ).add( off ).toVar();
	return gate( fadeOn( cellM, fp, 2.0 ), { line: mean, dir: [ 0, 0 ], lip: 0 }, () => {

		const v = voronoi( q, 0.9 );
		const dM = v.edge.mul( cellM ); // about right: y is the short axis
		const h = hash1( v.id1.add( v.id2 ) );
		const w = halfW.mul( h.mul( 0.8 ).add( 0.6 ) ).mul( step( 0.15, h ) ); // a few borders never opened
		const wEff = w.max( fp );
		const line = clamp( wEff.sub( dM ).div( fp ).add( 0.5 ), 0, 1 ).mul( w.div( wEff ) );
		const wN = fadeIn( cellM, fp, 2.0, 6.0 );
		return { line: mix( mean, line, wN ), dir: v.dir, lip: smoothstep( 3e-5, 4e-6, dM ).mul( wN ) };

	}, [ fp, q ] );

}

export function applyAged( W, p, fp, u ) {

	let { color, slope, cavity, rough, s2 } = W;
	const s = u.seed;

	if ( u.yellowing.value > 0 ) {

		const n = valueNoise( p.div( 0.09 ).add( s.mul( 3 ) ) ).mul( 0.55 ).add( valueNoise( p.div( 0.03 ).add( s.add( 8 ) ) ).mul( 0.3 ) ).add( valueNoise( p.div( 0.007 ).add( 2.1 ) ).mul( 0.15 ) );
		const y = smoothstep( 0.25, 0.75, n ).mul( 0.5 ).add( 0.5 ).mul( u.yellowing ); // all over, deeper in patches
		// Yellowing keeps the lightness and changes the hue: tint, not paint.
		const lum = color.dot( vec3( 0.3, 0.55, 0.15 ) );
		const tint = u.color2.div( u.color2.dot( vec3( 0.3, 0.55, 0.15 ) ).max( 0.02 ) ).mul( lum ).mul( 0.92 );
		color = mix( color, tint, y );

	}

	if ( u.chalk.value > 0 ) {

		const c = u.chalk;
		const lum = color.dot( vec3( 0.3, 0.55, 0.15 ) );
		const mottle = valueNoise( p.div( 0.004 ).add( s.mul( 5 ) ) ).mul( 0.6 ).add( valueNoise( p.div( 6e-4 ).add( 1.7 ) ).mul( 0.4 ) );
		// Powder: paler and greyer, in a mottle of mm.
		color = mix( color, mix( vec3( lum ), color, 0.6 ).mul( 1.08 ).add( 0.04 ), c.mul( mottle.mul( 0.6 ).add( 0.4 ) ) );
		// Pits and loose grains, 3 to 8 um. Skipped under 2 px per 20 um.
		const wP = fadeIn( float( 2e-5 ), fp, 2.0, 6.0 ).toVar();
		const pq = wrapCoord( p.div( 2e-5 ) ).add( s.mul( 2 ) ).toVar(); // mod: hashes stay exact
		const P = gate( fadeOn( float( 2e-5 ), fp, 2.0 ), { sP: [ 0, 0 ], pit: 0, grain: 0 }, () => {

			const pv = voronoi( pq, 0.9 );
			const ph = hash3( pv.id1 );
			const pr = pv.toSeed.length();
			const pit = smoothstep( ph.x.mul( 0.15 ).add( 0.2 ), ph.x.mul( 0.15 ).add( 0.1 ), pr ).mul( step( ph.y, 0.35 ) );
			const grain = smoothstep( 0.32, 0.22, pr ).mul( step( 0.8, ph.y ) );
			return { sP: pv.toSeed.mul( pit.mul( 1.5 ).sub( grain.mul( 1.2 ) ) ).mul( wP ).mul( c ), pit: pit.mul( wP ), grain: grain.mul( wP ) };

		}, [ pq, wP ] );
		slope = slope.mul( float( 1 ).sub( c.mul( 0.3 ) ) ).add( P.sP );
		color = color.mul( float( 1 ).sub( P.pit.mul( 0.12 ).mul( c ) ) ).mul( P.grain.mul( 0.08 ).mul( c ).add( 1 ) );
		rough = mix( rough, float( 0.88 ), c );
		s2 = s2.add( wP.oneMinus().mul( 0.02 ).mul( c ) );
		cavity = cavity.max( P.pit.mul( c ) );

	}

	if ( u.crazing.value > 0 ) {

		const k = u.crazing;
		// Cracks open where the stress is: patches. Skipped outside them.
		const where = smoothstep( 0.3, 0.6, valueNoise( p.div( 0.05 ).add( s.mul( 7 ) ) ) ).mul( k ).toVar();
		const N = gate( where.greaterThan( 0 ), { crack: 0, slope: [ 0, 0 ] }, () => {

			const A = crackNet( p, fp, u.crazeM, float( 6e-6 ), 3, s.mul( 3.3 ) );
			const B = crackNet( p, fp, u.crazeM.mul( 0.3 ), float( 2.5e-6 ), 2, s.add( 17.1 ) );
			// Their lips catch the light.
			const lip = A.lip.mul( where ).mul( float( 1 ).sub( A.line ) );
			return { crack: A.line.max( B.line.mul( 0.6 ) ).mul( where ), slope: A.dir.mul( lip ).mul( 0.25 ) };

		}, [ p, fp, where ] );
		const crack = N.crack;
		// Dirt in the cracks.
		color = mix( color, vec3( 0.07, 0.06, 0.05 ), crack.min( 1 ).mul( 0.85 ) ); // grime
		slope = slope.add( N.slope );
		cavity = cavity.max( crack );
		rough = rough.add( crack.mul( 0.2 ) );

	}

	return { ...W, color, slope, cavity, rough: rough.min( 1 ), s2 };

}
