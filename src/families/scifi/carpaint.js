// Metallic car paint: a base coat of pigment holding aluminium flakes,
// under a clear coat 40 to 50 um thick. Level by level:
//   L0 colour  the pigment, darker at grazing views (the flop: flakes lie
//              flat, so they mirror the light back only near face on);
//              soft clouds of 2 to 4 cm where the flakes settled unevenly
//   L1 coarse  big flakes (size_mm, 0.3 to 1 mm, "metal flake" paint):
//              each tilted a little, so a few catch the sun and sparkle
//              even from a metre away
//   L2 medium  flakes a quarter of that (100 to 150 um), denser
//   L3 fine    flakes of 25 to 40 um, the usual automotive aluminium;
//              each a "cornflake" with a ragged rim
//   L4 binder  pigment grains between the flakes, a few um
//   coat       orange peel of the sprayed clear coat (1 to 3 mm waves)
// Each flake has its own normal: it is a tiny mirror. A flake level too
// small to draw hands its tilts to the roughness, so the far view keeps a
// broad metallic glow where the sparkle was.

import { vec2, float, floor, fract, clamp, step, mod, mix } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { viewTangent } from '../../core/optics.js';
import { orangePeel } from '../ceramic/glaze.js';

// One flake per cell, inside its cell. Returns coverage (the mean when too
// small to draw), its tilt (a slope), a tone and the slope variance it
// hands to the roughness once faded.
function flakes( p, fp, cellM, density, tilt, salt, lo = 1.0, hi = 3.0 ) {

	const q = p.div( cellM ).add( salt );
	const c = mod( floor( q ), 4096 );
	const h = hash3( c.add( salt.mul( 0.37 ) ) ), g = hash3( c.add( salt.add( 17.3 ) ) );
	const r = h.z.mul( 0.14 ).add( 0.26 ); // radius, cells
	const ctr = vec2( 0.5 ).add( h.xy.sub( 0.5 ).mul( float( 1 ).sub( r.mul( 2.2 ) ).max( 0 ) ) );
	const d = fract( q ).sub( ctr );
	// A cornflake: the rim wanders with the direction from the centre.
	const wob = valueNoise( d.div( d.length().max( 1e-4 ) ).mul( 1.6 ).add( g.xy.mul( 40 ) ) ).sub( 0.5 ).mul( 0.4 ).add( 1 );
	const sd = r.mul( wob ).sub( d.length() ).mul( cellM );
	const present = step( g.z, density );
	const w = fadeIn( cellM, fp, lo, hi );
	const mean = density.mul( 0.22 );
	const inside = mix( mean, clamp( sd.div( fp ).add( 0.5 ), 0, 1 ).mul( present ), w );
	const slope = g.xy.sub( 0.5 ).mul( 2 ).mul( tilt ).mul( w );
	return { inside, slope, w, tone: h.x, s2: mean.mul( tilt ).mul( tilt ).mul( float( 1 ).sub( w ) ).mul( 0.6 ) };

}

export function buildCarPaint( p, fp, u ) {

	const s = u.seed;
	const ndv = viewTangent().z.clamp( 0, 1 );
	// Settling clouds: more or fewer flakes over a few cm.
	const cloud = valueNoise( p.div( 0.03 ).add( s ) ).mul( 0.6 ).add( valueNoise( p.div( 0.011 ).add( 3.3 ) ).mul( 0.4 ) );
	const dens = u.amount.mul( cloud.sub( 0.5 ).mul( 0.5 ).add( 1 ) );

	// Fine first: the coarse flakes lie over them.
	const F3 = flakes( p, fp, u.featureM.mul( 0.3 ), dens.min( 1 ), float( 0.35 ), s.mul( 3 ).add( 31 ), 1.5, 4.0 );
	const F2 = flakes( p, fp, u.sizeM.mul( 0.25 ), dens.mul( 0.8 ).min( 1 ), float( 0.45 ), s.mul( 5 ).add( 13 ), 1.0, 3.0 );
	const F1 = flakes( p, fp, u.sizeM, dens.mul( 0.5 ), float( 0.55 ), s.mul( 7 ).add( 3 ), 0.8, 2.5 );

	// Binder: pigment, darker at grazing (flop), grains under the loupe.
	const grain = valueNoise( mod( p.div( 4e-6 ), 4096 ) ).sub( 0.5 ).mul( fadeIn( float( 4e-6 ), fp, 1.5, 4.0 ) ).mul( 0.25 ).add( 1 );
	const binder = mix( u.color3, u.color, ndv.pow( 0.6 ) ).mul( grain ).mul( cloud.sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	// Flakes: aluminium seen through the tinted binder.
	const flakeCol = ( F ) => u.color2.mul( F.tone.mul( F.tone ).mul( 0.9 ).add( 0.3 ) );
	let color = binder, metal = float( 0 ), slope = vec2( 0 ), rough = u.roughness;
	for ( const F of [ F3, F2, F1 ] ) {

		color = mix( color, flakeCol( F ), F.inside );
		metal = mix( metal, float( 1 ), F.inside );
		slope = mix( slope, F.slope, F.inside.mul( F.w ) );
		rough = mix( rough, float( 0.12 ), F.inside.mul( F.w ) );

	}

	const peel = orangePeel( p, fp, u.relief, 0.0024 );
	return {
		color, slope, metal, rough, cavity: float( 0 ),
		s2: F1.s2.add( F2.s2 ).add( F3.s2 ),
		coat: u.coat, coatRough: float( 0.03 ), coatSlope: peel.slope,
	};

}
