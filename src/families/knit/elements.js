// Yarn pieces of the stitch patterns, shared by the TSL graph (cells.js)
// and the CPU statistics (pstats.js). Each piece is a bowed capsule, like a
// knit leg (legs.js): it dips at both ends, where it goes under its
// neighbours. Units: x in stitch widths, y and bow in rows (times aspect).
//
// Purl stitch: the back of a knit V. One sees the head of the loop (a
// frown over the column centre) and the sinker loop (a smile between two
// columns). Head and sinker of one row form a wavy horizontal bump,
// about 0.8 stitch long, so purl reads as rows of pebbles.
//
// Crochet (single crochet, about 7 mm a stitch): each stitch is a post
// of two strands, wrapped by a yarn over, under a chain of two loops lying
// on top of the row. Holes open between posts. Rows turn, so odd rows are
// mirrored.
// The yarn over of lace is built around its hole (lace.js).

import { vec2, float, mix } from 'three/tsl';

// side: id for hashes (knit legs use -1 and 1). lift: in stitch widths.
export const PURL = [
	{ side: 2, x0: 0.10, y0: 0.50, x1: 0.90, y1: 0.50, bow: - 0.17, rScale: 1.12, arch: 0.55, lift: 0 }, // head
	{ side: 3, x0: 0.62, y0: 0.50, x1: 1.38, y1: 0.50, bow: 0.17, rScale: 1.05, arch: 0.55, lift: - 0.025 }, // sinker
];

export const CROCHET = [
	// The two loops on top meet at the right end: a chain of V's lying on
	// their side, one per stitch.
	{ side: 4, x0: 0.02, y0: 0.76, x1: 0.94, y1: 0.86, bow: - 0.03, rScale: 0.9, arch: 0.75, lift: 0.02 }, // front loop
	{ side: 5, x0: 0.06, y0: 1.04, x1: 0.96, y1: 0.92, bow: 0.03, rScale: 0.85, arch: 0.6, lift: - 0.04 }, // back loop
	{ side: 6, x0: 0.26, y0: 0.04, x1: 0.42, y1: 0.70, bow: 0.04, rScale: 0.85, arch: 0.5, lift: - 0.02 }, // post, left strand
	{ side: 7, x0: 0.74, y0: 0.04, x1: 0.58, y1: 0.70, bow: - 0.04, rScale: 0.85, arch: 0.5, lift: - 0.02 }, // post, right strand
	{ side: 8, x0: 0.24, y0: 0.50, x1: 0.76, y1: 0.30, bow: 0.05, rScale: 0.75, arch: 0.6, lift: 0.03 }, // yarn over around the post
];

// Shape on the CPU, same fields as legShape() in legs.js. mirror: 1 flips x.
export function shapeCPU( e, aspect, mirror = 0 ) {

	const fx = ( x ) => mirror ? 1 - x : x;
	const p0 = [ fx( e.x0 ), e.y0 * aspect ];
	const dx = fx( e.x1 ) - p0[ 0 ], dy = e.y1 * aspect - p0[ 1 ];
	const len = Math.hypot( dx, dy );
	return { p0, len, dir: [ dx / len, dy / len ], bow: e.bow * aspect * ( mirror ? - 1 : 1 ) };

}

// Shape in TSL. aspect is a uniform, so sliders keep working. mirror: a
// 0/1 node (crochet row parity) or a number. A mirror flips the bow too.
export function shapeTSL( e, aspect, mirror = 0 ) {

	const m = float( mirror );
	const x0 = mix( float( e.x0 ), float( 1 - e.x0 ), m );
	const dx = mix( float( e.x1 - e.x0 ), float( e.x0 - e.x1 ), m );
	const dy = aspect.mul( e.y1 - e.y0 );
	const d = vec2( dx, dy );
	const len = d.length();
	return { p0: vec2( x0, aspect.mul( e.y0 ) ), dir: d.div( len ), len, bow: aspect.mul( e.bow ).mul( m.mul( - 2 ).add( 1 ) ) };

}
