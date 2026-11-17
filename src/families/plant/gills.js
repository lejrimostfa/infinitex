// Mushroom gills seen from below (an agaric, like Agaricus or a parasol).
// One cap per 30 cm tile, a little off centre; size_mm is the cap radius.
//   L0 cap      cut stem (16 mm radius) in the middle, a membranous ring
//               around it, a dark collar (free gills), then the gills to
//               the margin; radial streaks of spore colour
//   L1 gills    2048 positions round the cap: 256 full gills from the
//               collar, then lamellulae of three shorter lengths that
//               start where the spacing doubles (at 2, 4 and 8 times the
//               collar radius), so the spacing stays
//               about 0.6 to 1.3 mm; they wave a little; each gill a
//               pale thin edge, a face that ends in a narrow dark slot;
//               short gills end rounded
//   L2 hymenium the gill face is a palisade of basidia (cell_um, about
//               7 um) carrying spores: ellipsoids 6 x 4 um, dark brown
// color = gill face, color2 = gill edge, color3 = spores, color4 = stem.
//
// The stem flesh sits in a gate() (core/lod.js): it runs only on the stem.

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod, floor, fract, atan, min, max } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, fbm, cells } from './common.js';

const N = 2048; // gill positions round the cap
const TWO_PI = 6.2832;

export function buildGills( p, fp, u ) {

	const R = u.sizeM, s = u.seed;
	// Off centre, so the middle of the tile shows gills, not the stem.
	const c = mod( p, 0.3 ).sub( vec2( 0.105, 0.112 ) );
	const r = c.length().max( 1e-6 ).toVar();
	const dv = c.div( r ), tang = vec2( dv.y.negate(), dv.x );
	const stipeR = float( 0.016 ), ringR = stipeR.add( 0.006 );

	// Gills wave: the angle drifts with a noise along the radius.
	const wave = valueNoise( dv.mul( 30 ).add( vec2( r.div( 0.007 ), s ) ) ).sub( 0.5 ).mul( 0.5e-3 ).div( r );
	const th = atan( c.y, c.x ).add( wave ).div( TWO_PI ); // turns

	// Distance to the nearest gill of each length class.
	let dmin = float( 1 ), dSigned = float( 0 ), spacing = r.mul( TWO_PI * 8 / N ), gid = float( 0 );
	const r0 = float( 0.026 );
	for ( let L = 0; L < 4; L ++ ) {

		const m = 8 >> L;
		const g = th.mul( N / m );
		// Level 0: every multiple of 8; level L: the odd multiples of m only.
		const k = L === 0 ? floor( g.add( 0.5 ) ) : floor( g.sub( 1 ).mul( 0.5 ).add( 0.5 ) ).mul( 2 ).add( 1 );
		const dS = g.sub( k ).mul( r ).mul( TWO_PI * m / N ); // meters, signed
		const idx = mod( k.mul( m ), N );
		const start = r0.mul( 1 << L ).mul( hash1( vec2( idx, L + 0.5 ) ).mul( 0.35 ).add( L === 0 ? 0.9 : 0.85 ) );
		const ex = smoothstep( start, start.mul( 1.1 ), r );
		// Distance to the gill as a segment: its inner end is rounded.
		const d = vec2( dS, start.sub( r ).max( 0 ) ).length();
		const near = step( d, dmin );
		dSigned = mix( dSigned, dS, near );
		gid = mix( gid, idx, near );
		dmin = min( dmin, d );
		if ( L > 0 ) spacing = spacing.mul( mix( float( 1 ), float( 0.5 ), ex ) );

	}

	const half = spacing.mul( 0.5 );
	const w = fadeIn( spacing, fp, 2.5, 7.0 );
	const t = dmin.div( half ).clamp( 0, 1 ); // 0 on a gill edge, 1 mid crevice
	const hg = hash3( vec2( gid, 3.3 ) );
	// Gill edge: a thin pale band, a little crenulate.
	const edgeW = float( 6e-5 ).mul( valueNoise( vec2( r.div( 4e-4 ), gid ) ).add( 0.6 ) );
	const edge = band( dmin, edgeW, fp ).mul( w );
	// Face falls into the crevice; one side lit, the other in shade.
	// Seen from below the faces fill most of the view; only a narrow
	// slot between two gills stays dark.
	const prof = float( 1 ).sub( smoothstep( 0.55, 1.0, t ).mul( 0.75 ) ).mul( float( 1 ).sub( t.mul( 0.35 ) ) );
	const side = dSigned.sign();
	const slope = tang.mul( side.mul( - 0.7 ).mul( smoothstep( 0.0, 0.3, t ) ) ).mul( w );

	// Hymenium cells and spores.
	const cm = u.cellM;
	const H = cells( p, fp, cm, cm.mul( 0.06 ), s.mul( 4.4 ), 0, 0.4 );
	const sq = wrapCoord( p.div( cm.mul( 1.3 ) ) ).add( s.mul( 1.9 ) );
	const hs = hash3( floor( sq ) );
	const sd = dir2( hs.y.mul( 6.283 ) );
	const sv = fract( sq ).sub( hs.yz.mul( 0.4 ).add( 0.3 ) ).mul( cm.mul( 1.3 ) );
	const sa = cm.mul( 0.42 ), sb = cm.mul( 0.28 );
	const se = sv.dot( sd ).div( sa ).pow( 2 ).add( sv.dot( vec2( sd.y.negate(), sd.x ) ).div( sb ).pow( 2 ) );
	const spore = clamp( float( 1 ).sub( se ).mul( sb ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( hs.x, u.spores.mul( 0.6 ) ) ).mul( fadeIn( sa, fp, 2.0, 5.0 ) ).mul( prof.mul( 2 ).min( 1 ) );
	const sporeS = sv.mul( - 0.8 ).div( sa ).mul( spore );

	// Colour. Spores darken the gills in radial streaks, more near the stem.
	const streak = valueNoise( dv.mul( 90 ).add( vec2( r.div( 0.05 ), 7.7 ) ) );
	const dust = smoothstep( 0.35, 0.8, streak.mul( 0.6 ).add( fbm( p, float( 0.02 ), fp, 3, 5 ).mul( 0.4 ) ) ).mul( u.spores );
	let face = u.color.mul( hg.x.sub( 0.5 ).mul( u.colorVar ).add( 1 ) ).mul( mix( float( 0.85 ), float( 1.1 ), r.div( R ).clamp( 0, 1 ) ) );
	face = mix( face, u.color3, dust.mul( 0.45 ) );
	face = face.mul( H.wall.mul( - 0.3 ).add( 1 ) ).mul( H.rim.mul( - 0.12 ).mul( H.w ).add( 1 ) ).mul( mix( float( 0.75 ), float( 1.15 ), step( 0, side ) ).mul( w ).add( float( 1 ).sub( w ) ) );
	const crevice = u.color.mul( 0.12 );
	let gillC = mix( crevice, face, prof );
	gillC = mix( gillC, u.color2, edge.mul( 0.8 ) );
	gillC = mix( gillC, u.color3.mul( 0.6 ), spore.mul( 0.9 ) );
	// Far: the mean of the gill profile.
	gillC = mix( mix( crevice, face, 0.8 ), gillC, w );

	// Stem, ring and collar.
	const stem = smoothstep( stipeR.add( fp ), stipeR, r ).toVar();
	const ring = smoothstep( ringR.add( fp ), ringR, r ).mul( float( 1 ).sub( stem ) );
	const collar = smoothstep( r0.mul( 0.9 ), r0.mul( 0.8 ), r ).mul( float( 1 ).sub( ring ) ).mul( float( 1 ).sub( stem ) );
	// Stem flesh: hyphae cut across, round cells of 30 um. Only on the
	// stem (stem > 0).
	const yq = wrapCoord( p.div( 3e-5 ) ).add( 6.1 ).toVar();
	const FL = gate( stem.greaterThan( 0 ), { flesh: [ 0, 0, 0 ], slope: [ 0, 0 ] }, () => {

		const Hy = cells( p, fp, float( 3e-5 ), 1.5e-6, 6.1, 0.3, 0.3, yq );
		return {
			flesh: u.color4.mul( fbm( p, float( 0.004 ), fp, 4, 9 ).sub( 0.5 ).mul( 0.25 ).add( 1 ) )
				.mul( mix( float( 1 ), float( 0.8 ), smoothstep( stipeR.mul( 0.8 ), stipeR, r ) ) )
				.mul( float( 1 ).sub( Hy.wall.mul( 0.12 ) ) ),
			slope: Hy.slope.mul( stem ).mul( 0.3 ),
		};

	}, [ p, fp, yq, r, stem ] );
	const stria = fract( th.mul( 480 ) ).sub( 0.5 ).abs().mul( fadeIn( r.mul( TWO_PI / 480 ), fp, 3.0, 8.0 ) );
	const ringC = u.color4.mul( 0.92 ).mul( float( 1 ).sub( stria.mul( 0.25 ) ) ).mul( smoothstep( ringR, stipeR, r ).mul( 0.3 ).add( 0.7 ) );
	let color = mix( gillC, crevice.mul( 0.6 ), collar );
	color = mix( color, ringC, ring );
	color = mix( color, FL.flesh, stem );
	// Beyond the margin: the dark underside of the cap rim.
	const outside = smoothstep( R, R.add( 0.004 ), r );
	color = mix( color, u.color.mul( 0.25 ), outside );

	const gillMask = float( 1 ).sub( max( stem, ring ).max( collar ) ).mul( float( 1 ).sub( outside ) );
	const sl = slope.add( H.slope.mul( prof ).mul( 0.3 ) ).add( sporeS ).mul( gillMask ).add( dv.mul( ring.mul( 0.4 ) ) ).add( FL.slope );
	const cavity = t.mul( gillMask ).max( collar );
	const rough = u.roughness.sub( spore.mul( 0.25 ) ).add( t.mul( 0.15 ) );
	const s2 = float( 1 ).sub( w ).mul( 0.25 ).mul( gillMask );
	return { color: clamp( color, 0, 1 ), slope: sl, cavity, rough, s2 };

}
