// Knitted lace: stockinette with eyelets.
//   L0 motif: an eyelet (yarn over) every other row, laid out as a diamond
//      10 stitches wide and 16 rows tall (4 x 5 cm on a 26 stitch yarn),
//      with one eyelet in its centre. Seen from afar, the eyelets are dark
//      dots on the backing.
//   L1 eyelet: a round hole about a stitch wide (1.5 to 2 mm here). The
//      stitches around it are pushed away from its centre (a radial warp
//      of the stitch grid), the loose yarn over arches over its top, and
//      the backing shows through.
// Each hole is a disc of radius about RH, a little irregular. Outside it
// the warp maps [RH, R2] onto [RHO, R2]: the stitches next to the hole are
// squeezed against it, those beyond R2 do not move.

import { vec2, float, floor, step, abs, clamp, atan, sin } from 'three/tsl';
import { pick } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';
import { knitItems, posmod } from './pieces.js';

const RH = 0.46; // hole radius, stitch widths
const RHO = 0.2; // where the hole border lands in the stitch grid
const R2 = 1.4; // the warp fades out at this distance

// 1 for an eyelet cell. Eyelets on even rows: |cc - 5| + |rr / 2 - 4| = 4,
// plus the centre of the diamond.
export function isHole( c ) {

	const cc = posmod( c.x, 10 ), rr = posmod( c.y, 16 );
	const even = float( 1 ).sub( posmod( rr, 2 ) );
	const d = abs( cc.sub( 5 ) ).add( abs( rr.div( 2 ).sub( 4 ) ) );
	const ring = step( abs( d.sub( 4 ) ), 0.25 );
	const centre = step( abs( cc.sub( 5 ) ).add( abs( rr.sub( 8 ) ) ), 0.25 );
	return ring.add( centre ).min( 1 ).mul( even );

}

const centreOf = ( u, c ) => vec2( c.x.add( 0.5 ), c.y.add( 0.4 ).mul( u.aspect ) );

// Push the grid away from the eyelets around. Returns the warped point,
// the vector from the nearest eyelet centre and its radius.
function warp( u, p ) {

	const col = floor( p.x ), row = floor( p.y.div( u.aspect ) );
	let disp = vec2( 0 ), dmin = float( 9 ), vmin = vec2( 9 ), cmin = vec2( 0 );
	for ( const dr of [ - 2, - 1, 0, 1, 2 ] ) for ( const dc of [ - 1, 0, 1 ] ) {

		const c = vec2( col.add( dc ), row.add( dr ) );
		const on = isHole( c );
		const v = p.sub( centreOf( u, c ) );
		const r = v.length().max( 1e-4 );
		const k = clamp( r.sub( RH ).div( R2 - RH ), 0, 1 );
		const target = pick( step( r, RH ), r.mul( RHO / RH ), k.mul( R2 - RHO ).add( RHO ).add( r.sub( R2 ).max( 0 ) ) );
		disp = disp.add( v.div( r ).mul( r.sub( target ) ).mul( on ) );
		const closer = on.mul( step( r, dmin ) );
		dmin = pick( closer, r, dmin );
		vmin = pick( closer, v, vmin );
		cmin = pick( closer, c, cmin );

	}

	// Hand-made holes are never perfect circles.
	const h = hash3( cmin.add( u.seed ) );
	const ang = atan( vmin.y, vmin.x );
	const radius = sin( ang.mul( 2 ).add( h.x.mul( 6.3 ) ) ).mul( 0.06 ).add( sin( ang.mul( 3 ).add( h.y.mul( 6.3 ) ) ).mul( 0.04 ) ).add( 1 ).mul( RH ).mul( h.z.mul( 0.15 ).add( 0.92 ) );
	return { p: p.sub( disp ).toVar(), dist: dmin.toVar(), v: vmin.toVar(), cell: cmin.toVar(), radius: radius.toVar() };

}

export function laceLevel( u, f ) {

	// The stitch under a yarn over stays: the disc punches the hole.
	const items = knitItems( u, f, () => float( 1 ), () => float( 0 ) );
	// The yarn over: a loose strand arching over the top of the hole.
	const w = f.pre;
	const rho = w.radius.add( u.R.mul( 0.55 ) );
	const sh = { p0: vec2( rho.negate(), u.R.mul( - 0.3 ) ), dir: vec2( 1, 0 ), len: rho.mul( 2 ), bow: rho.negate().mul( 0.95 ) };
	items.push( {
		q: w.v, cell: w.cell, sh, R: u.R.mul( 0.95 ), arch: float( 0.25 ),
		mask: step( w.dist, 1.5 ), lift: float( 0.16 ), side: 9,
	} );
	return { items, macro: null, hole: { dist: w.dist, radius: w.radius } };

}

laceLevel.warp = warp;
