// Vitreous enamel: glass powder fused on steel at 800 C, in two coats:
// a dark ground coat that grips the steel (0.1 mm), then the colour coat
// (0.2 to 0.3 mm). Level by level:
//   L0 coat     a deep, saturated colour, darker where it is thick
//   L1 peel     soft waves of 1 to 3 mm in the fired surface
//   L1 chips    a knock flakes the glass off in shells of 2 to 10 mm, most
//               of them on the edges (panel_mm: the edges of the panel):
//               the colour coat breaks in a steep glassy wall, a band of
//               ground coat with shell ripples, then bare steel, grey and
//               metallic, rusting brown from the edge of the chip
//   L2 bubbles  gas held in the coat, 20 to 120 um, lighter specks
//   L3 steel    grain and grinding lines on the bare metal
// The colour coat is a clear coat lobe over its pigment; chips have none.
//
// Returns { color, slope, cavity, rough, s2, metal, coat, coatRough, coatSlope }.

import { vec2, vec3, float, mix, smoothstep, step, clamp, exp, sin, mod } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { orangePeel, coatBubbles, specks } from './glaze.js';

export function buildEnamel( p, fp, u ) {

	const s = u.seed;
	const tone = valueNoise( p.div( 0.05 ).add( s ) ).mul( 0.7 ).add( valueNoise( p.div( 0.008 ).add( s.add( 2 ) ) ).mul( 0.3 ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 );
	const thick = valueNoise( p.div( 0.06 ).add( s.add( 4 ) ) ).mul( 0.7 ).add( valueNoise( p.div( 0.02 ).add( s.add( 5 ) ) ).mul( 0.3 ) );
	let color = u.glazeColor.mul( tone );
	color = mix( color, color.mul( color ).mul( 1.3 ).min( color ), smoothstep( 0.3, 0.9, thick ).mul( u.pooling ).mul( 0.4 ) );
	if ( u.specks.value > 0 ) color = specks( color, p, fp, u.specks );
	if ( u.bubbles.value > 0 ) color = coatBubbles( color, p, fp, u.bubbleM, u.bubbles, 5 );

	const peel = orangePeel( p, fp, u.orangePeel.mul( 2 ), 0.003 );
	let slope = peel.slope, coatSlope = peel.slope, cavity = float( 0 ), metal = float( 0 ), coat = float( 1 ), rough = u.roughness;

	if ( u.chips.value > 0 ) {

		const c = u.chipM;
		const warp = vec2( valueNoise( p.div( c.mul( 0.5 ) ).add( s ) ), valueNoise( p.div( c.mul( 0.5 ) ).add( s.add( 5.5 ) ) ) ).sub( 0.5 ).mul( c ).mul( 0.6 );
		const V = voronoi( wrapCoord( p.add( warp ).div( c ) ).add( s.mul( 5 ) ), 0.85 );
		const hc = hash3( V.id1.add( 2.2 ) );
		// Distance of the chip centre to the nearest panel edge.
		const P = u.panelM, cpos = V.p1.sub( s.mul( 5 ) ).mul( c );
		const dE = cpos.x.min( P.sub( cpos.x ) ).min( cpos.y ).min( P.sub( cpos.y ) ).max( 0 );
		const edgy = exp( dE.div( c.mul( 0.9 ) ).negate() ).mul( step( 1e-4, P ) );
		const on = step( hc.z, u.chips.mul( edgy.mul( 0.95 ).add( 0.006 ) ) );
		// Signed distance into the chip, meters; edge chips reach further.
		const t = hc.y.mul( 0.22 ).add( 0.12 ).sub( edgy.mul( 0.1 ) );
		const sd = V.edge.sub( t ).mul( c ).add( valueNoise( p.div( 3e-4 ).add( 1.1 ) ).sub( 0.5 ).mul( 1.2e-4 ) );
		const chip = clamp( sd.div( fp ).add( 0.5 ), 0, 1 ).mul( on ).toVar();
		const wg = hc.x.mul( 4e-4 ).add( 2.5e-4 ); // ground band width
		const steel = clamp( sd.sub( wg ).div( fp ).add( 0.5 ), 0, 1 ).mul( on ).toVar();
		const wall = smoothstep( - 1.2e-4, 0, sd ).mul( float( 1 ).sub( chip ) ).mul( on );

		// Ground coat: dark glass, shell ripples parallel to the break.
		const ripple = sin( sd.div( 6e-5 ).mul( 6.28 ) ).mul( 0.5 ).add( 0.5 ).mul( fadeIn( float( 6e-5 ), fp, 2.0, 5.0 ) );
		const ground = u.groundColor.mul( ripple.mul( 0.25 ).add( 0.85 ) );
		// Steel: grain, grinding lines, rust from the edge inward.
		const grind = valueNoise( vec2( p.x.div( 4e-4 ), wrapCoord( p.y.div( 1.2e-5 ) ) ).add( 3.3 ) ).mul( fadeIn( float( 1.2e-5 ), fp, 1.5, 4.0 ) );
		const grain = hash3( wrapCoord( V.id1 ) ).x; // each chip its own metal tone
		const rust = smoothstep( 1.5e-3, 0, sd.sub( wg ) ).mul( valueNoise( p.div( 8e-4 ).add( 6.1 ) ) ).mul( 1.4 ).clamp( 0, 1 ).mul( hc.x.mul( 0.8 ).add( 0.2 ) );
		const steelCol = u.steelColor.mul( grind.mul( 0.3 ).add( 0.85 ) ).mul( grain.mul( 0.2 ).add( 0.9 ) );
		const rustCol = vec3( 0.25, 0.1, 0.04 ).mul( valueNoise( p.div( 1e-4 ) ).mul( 0.4 ).add( 0.8 ) );
		const bare = mix( steelCol, rustCol, rust );
		color = mix( color, mix( ground, bare, steel ), chip );
		color = mix( color, color.mul( 1.35 ).add( 0.04 ), wall.mul( 0.6 ) ); // the broken wall scatters

		// Heights: colour coat 0, ground -0.25 mm, steel -0.35 mm.
		const h = chip.mul( - 2.5e-4 ).sub( steel.mul( 1e-4 ) ).sub( wall.mul( 1.5e-4 ) );
		const chipSlope = surfaceGradient( h, p ).mul( fadeIn( c.mul( 0.2 ), fp, 1.0, 3.0 ) ).add( vec2( grind.sub( 0.5 ).mul( 0.1 ), 0 ).mul( steel ) );
		slope = mix( slope, chipSlope, chip.max( wall ) );
		coatSlope = mix( coatSlope, chipSlope, wall );
		metal = steel.mul( float( 1 ).sub( rust ) );
		rough = mix( rough, mix( float( 0.25 ), float( 0.42 ), steel ), chip ).add( rust.mul( steel ).mul( 0.4 ) ).min( 1 );
		coat = float( 1 ).sub( chip );
		cavity = chip.mul( 0.7 );

	}

	return { color, slope, cavity, rough, s2: peel.s2, metal, coat, coatRough: u.glazeRough, coatSlope, coatS2: peel.s2 };

}
