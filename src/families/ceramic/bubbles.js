// Round things scattered in a layer: gas bubbles held in a glaze or an
// enamel (10 to 300 um), seed bubbles in glass (0.2 to 3 mm), pinholes
// where a bubble burst at the surface, pores in fired clay. One candidate
// per grid cell, kept inside its cell, so one lookup per octave and no
// overlap. Most bubbles are small, a few large (radius ~ hash squared).
//
// q: coordinates in meters (pre-stretched by the caller for elongated
// bubbles). Returns, for the bubble of this cell:
//   inside  coverage of the disc, anti-aliased by the footprint
//   rim     a ring at the edge (dark or bright outline seen in a bubble)
//   v       vector from the centre in radii (|v| = 1 on the edge)
//   fade    1 when the bubble is at least a few pixels wide
//   h       its hash (tone, depth...)

import { float, floor, clamp, step, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';

export function bubbleField( q, fp, cellM, density, salt = 0 ) {

	const x = mod( q.div( cellM ), 4096 ).add( salt ); // mod: hashes stay exact
	const cell = floor( x );
	const h = hash3( cell.add( salt * 1.37 ) );
	const on = step( h.z, density );
	const rn = h.x.mul( h.x ).mul( 0.3 ).add( 0.08 ); // radius, cells
	const c = cell.add( 0.5 ).add( h.xy.sub( 0.5 ).mul( float( 1 ).sub( rn.mul( 2 ) ) ).mul( 0.95 ) );
	const v = x.sub( c ).div( rn );
	const d = v.length();
	const rm = rn.mul( cellM );
	const fade = fadeIn( rm.mul( 2 ), fp, 1.0, 3.0 ).mul( on );
	const inside = clamp( float( 1 ).sub( d ).mul( rm ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
	// Ring half a tenth of the radius wide, widened to a pixel and dimmed.
	const rw = rm.mul( 0.12 ), rEff = rw.max( fp );
	const rim = clamp( rEff.sub( d.sub( 0.88 ).abs().mul( rm ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( rw.div( rEff ) ).mul( on );
	return { inside, rim, v, d, fade, h, rm, on };

}

// Slope of a sphere cap seen from above (a bubble dome or a pit), in
// meters per meter, limited at the rim so the normal stays sane.
export function capSlope( v, d ) {

	const t = d.min( 0.95 );
	return v.mul( float( 1 ).sub( t.mul( t ) ).max( 0.0975 ).sqrt().reciprocal() );

}
