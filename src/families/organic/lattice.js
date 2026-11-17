// An open lattice of struts (trabecular bone, sponge fibres, the porous
// skeleton of coral): the borders of a Voronoi net of cellM, each border a
// rounded rod of uneven width, thicker where it widens into a plate. The
// cell interiors are the pores. Several lattices, shifted and darker,
// stack to give the depth of a 3D foam seen through its pores.
// Returns { strut (0..1, AA), h (0..1 across the rod), slope (dh/dp for a
// rod as high as half its width), along (coordinate along the strut, in
// cells, for lamellae), V, w (fade) }.

import { vec2, float, clamp, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

// width: half width of a strut in cells; vary: how uneven (0..1); plate:
// share of borders that widen into plates.
export function lattice( p, cellM, fp, salt, { width = 0.08, vary = 0.6, plate = 0.2, jitter = 0.95 } = {} ) {

	const x = wrapCoord( p.div( cellM ) ).add( salt );
	const V = voronoi( x, jitter );
	// Width along the strut: a slow noise; plates on some borders.
	const mid = V.p1.add( V.p2 ).mul( 0.5 );
	const n = valueNoise( x.mul( 2.3 ).add( salt * 1.3 ) );
	const pl = clamp( valueNoise( mid.mul( 1.7 ).add( salt * 2.1 ) ).sub( 1 - plate ).mul( 6 ), 0, 1 );
	const W = float( width );
	const wC = W.mul( n.sub( 0.5 ).mul( vary * 1.6 ).add( 1 ) ).add( pl.mul( W ).mul( 2.5 ) ).max( W.mul( 0.25 ) );
	const e = V.edge;
	const wM = wC.mul( cellM );
	const w = fadeIn( wM.mul( 2 ), fp, 1.0, 3.0 );
	// Coverage: a strut thinner than a pixel is widened and dimmed.
	const wEff = wM.max( fp.mul( 0.7 ) );
	const strut = clamp( wEff.sub( e.mul( cellM ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( wM.div( wEff ) );
	// Round rod: h = sqrt(1 - (e/w)^2), slope along the border normal.
	const t = e.div( wC ).min( 0.97 );
	const h = float( 1 ).sub( t.mul( t ) ).max( 0 ).sqrt().mul( strut );
	const slope = V.dir.mul( t.div( float( 1 ).sub( t.mul( t ) ).max( 0.06 ).sqrt() ) ).mul( 0.5 ).mul( strut ).mul( w );
	// Along the border: lamellae and fibres run this way.
	const along = x.sub( mid ).dot( vec2( V.dir.y.negate(), V.dir.x ) );
	return { strut, h, slope, along, e, wC, V, w, pl };

}
