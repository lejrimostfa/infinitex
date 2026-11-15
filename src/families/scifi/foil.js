// Crinkled iridescent foil (holographic gift wrap, mylar with an oxide
// film). A polymer film 12 to 25 um thick, aluminised, under a clear
// layer of 250 to 700 nm: light reflected at its top and bottom
// interferes, so the colour is a thin film colour that changes with the
// angle and with the film thickness. Crumpling breaks the sheet into flat
// facets with sharp creases, so neighbouring facets show other colours.
//   L1 facets   size_mm (10 to 20 mm): big flat facets, steep tilts
//   L2 facets   a third of that: creases inside each facet
//   L3 wrinkles feature_mm (0.5 to 1 mm): fine crinkles, gentle tilts
//   L4 marks    rubbing scratches of 1 to 3 um on the film
// The film thickness drifts over the sheet and differs per facet (it was
// stretched differently). The thin film itself is the iridescence lobe of
// the physical material (Belcour and Barla), on an aluminium base.

import { vec2, float, clamp, mod, mix } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { scratchMarks } from '../../core/marks.js';
import { fbm } from '../stone/common.js';

// One level of facets: a constant tilt per cell, blended across the
// crease over a pixel (or a fiftieth of a cell when wider), a dark crease.
function facets( p, fp, S, amp, salt ) {

	// A warp makes the facets uneven polygons, some long, some small.
	const wq = p.div( S.mul( 1.7 ) ).add( salt );
	const warp = vec2( valueNoise( wq ), valueNoise( wq.add( 9.1 ) ) ).sub( 0.5 ).mul( 0.9 );
	const V = voronoi( mod( p.div( S ).add( warp ), 4096 ).add( salt ), 1.0 );
	const a = hash3( V.id1.add( salt.mul( 0.31 ) ) ), b = hash3( V.id2.add( salt.mul( 0.31 ) ) );
	const w = fadeIn( S, fp, 1.5, 4.0 );
	const dM = V.edge.mul( S );
	const t = clamp( dM.div( fp.max( S.mul( 0.02 ) ) ).add( 0.5 ), 0, 1 );
	const tilt = ( h ) => h.xy.sub( 0.5 ).mul( 2 ).mul( amp );
	// Each facet also bulges a little: the reflection slides across it.
	const slope = mix( tilt( b ), tilt( a ), t ).add( V.toSeed.mul( amp * 0.35 ) ).mul( w );
	const crease = clamp( S.mul( 0.012 ).sub( dM ).div( fp ).add( 0.5 ), 0, 1 ).mul( fadeIn( S, fp, 3.0, 8.0 ) );
	return { slope, crease, id: a, w, s2: float( amp * amp * 0.66 ).mul( float( 1 ).sub( w ) ) };

}

export function buildFoil( p, fp, u ) {

	const s = u.seed;
	const F1 = facets( p, fp, u.sizeM, 0.5, s.mul( 3 ).add( 1 ) );
	const F2 = facets( p, fp, u.sizeM.mul( 0.25 ), 0.1, s.mul( 5 ).add( 7 ) );
	const F3 = facets( p, fp, u.featureM, 0.04, s.mul( 7 ).add( 13 ) );
	const M = scratchMarks( p, fp, float( 2e-3 ), float( 1.2e-6 ), s.add( 21 ), { spread: 1, length: 1.6, density: 0.7 } );
	const slope = F1.slope.add( F2.slope ).add( F3.slope ).mul( u.relief ).add( M.slope.mul( 0.4 ) );
	const crease = F1.crease.max( F2.crease.mul( 0.5 ) ).max( F3.crease.mul( 0.15 ) );

	// Film thickness: a drift over the sheet, a step per facet.
	const drift = fbm( p, 0.12, fp, 3, 4 );
	const t = clamp( drift.mul( 0.85 ).add( F1.id.z.mul( 0.12 ) ).add( F2.id.z.mul( 0.04 ).mul( F2.w ) ), 0, 1 );
	const nm = mix( u.filmMin, u.filmMax, t );
	const color = u.color.mul( float( 1 ).sub( crease.mul( 0.45 ) ) ).mul( float( 1 ).sub( M.cov.mul( 0.2 ) ) );
	return {
		color, metal: float( 1 ), slope, rough: u.roughness.add( M.cov.mul( 0.2 ) ), cavity: crease,
		s2: F1.s2.add( F2.s2 ).add( F3.s2 ).mul( u.relief ).mul( u.relief ),
		irid: u.amount.mul( float( 1 ).sub( crease.mul( 0.5 ) ) ), iridNm: nm, iridIOR: float( 2.0 ),
	};

}
