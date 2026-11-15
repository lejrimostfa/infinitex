// Small blocks the plant modes share, on top of stone/common.js (fbm with
// footprint fade, anti-aliased bands and lines, polishing scratches).
//   net      a warped Voronoi net of lines: leaf veins, lichen cracks,
//            nacre tablet seams; fades in when its cells span a few pixels
//   cells    packed cells that bulge (epidermis, hymenium, squames): a
//            Voronoi with lobed walls, a dome slope per cell
//   ridge    a soft ridge profile and its slope, at least one pixel wide
// All sizes in surface meters.

import { vec2, float, mod, smoothstep } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { band } from '../stone/common.js';

export { dir2, band, lines, fbm, scratches } from '../stone/common.js';

// Lines on the borders of a warped Voronoi net of cell cellM, half width
// halfW. Returns the line coverage (faded), a soft profile (for relief)
// with its slope (g along dir), the Voronoi and the fade weight.
export function net( p, fp, cellM, halfW, seed, warp = 0.35, lo = 3.0, hi = 9.0 ) {

	const q = mod( p.div( cellM ), 4096 ).add( seed );
	const wq = vec2( valueNoise( q.mul( 1.3 ).add( 3.1 ) ), valueNoise( q.mul( 1.3 ).add( 8.7 ) ) ).sub( 0.5 ).mul( warp );
	const V = voronoi( q.add( wq ), 0.9 );
	const d = V.edge.mul( cellM );
	const w = fadeIn( cellM, fp, lo, hi );
	const line = band( d, halfW, fp ).mul( w );
	// Soft profile smoothstep( W, 0, d ) and its analytic gradient: g * dir
	// is d(soft)/dp toward the border (a surfaceGradient would jump where
	// the second nearest seed changes).
	const W = float( halfW ).mul( 2.5 ).add( fp );
	const t = float( 1 ).sub( d.div( W ) ).clamp( 0, 1 );
	const soft = t.mul( t ).mul( t.mul( - 2 ).add( 3 ) ).mul( w );
	const g = t.mul( float( 1 ).sub( t ) ).mul( 6 ).div( W ).mul( w );
	return { line, soft, g, dir: V.dir, V, d, w };

}

// Packed bulging cells of size cellM. lobes 0 gives polygons, 0.5 jigsaw
// pieces (the walls wander). Returns the Voronoi, wall coverage of half
// width wallM, a dome slope (meters per meter, scaled by bulge) and the
// fade weight.
export function cells( p, fp, cellM, wallM, seed, lobes = 0, bulge = 0.3 ) {

	const q = mod( p.div( cellM ), 4096 ).add( seed );
	let x = q;
	if ( lobes > 0 ) {

		// Two octaves of warp: long meanders and the small lobes on them.
		const a = vec2( valueNoise( q.mul( 1.6 ).add( 2.3 ) ), valueNoise( q.mul( 1.6 ).add( 9.1 ) ) ).sub( 0.5 );
		const b = vec2( valueNoise( q.mul( 4.1 ).add( 5.7 ) ), valueNoise( q.mul( 4.1 ).add( 1.9 ) ) ).sub( 0.5 );
		x = q.add( a.mul( lobes ) ).add( b.mul( lobes * 0.55 ) );

	}

	const V = voronoi( x, 0.85 );
	const w = fadeIn( cellM, fp, 3.0, 8.0 );
	const wall = band( V.edge.mul( cellM ), wallM, fp ).mul( w );
	// Dome: the top is flat-ish, the rim drops toward the wall.
	const rim = smoothstep( 0.35, 0.0, V.edge );
	const slope = V.toSeed.mul( - bulge ).mul( rim.mul( 1.5 ).add( 0.4 ) ).mul( w );
	return { V, wall, slope, w, rim };

}

// Soft ridge of half width halfW at distance d (signed, meters): height
// 1 on the crest. The slope is dh/dd; multiply by the direction of d.
export function ridge( d, halfW, fp ) {

	const hw = float( halfW ).add( fp.mul( 0.5 ) );
	const t = d.div( hw ).clamp( - 1, 1 );
	const h = float( 1 ).sub( t.mul( t ) ).pow( 2 );
	const dh = t.mul( float( 1 ).sub( t.mul( t ) ) ).mul( - 4 ).div( hw );
	return { h, dh };

}
