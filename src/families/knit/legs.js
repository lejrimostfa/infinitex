// Knit stitch geometry, shared by the TSL shader and the CPU statistics.
//
// Units: one stitch width = 1. A row is `aspect` stitch widths tall.
// A stockinette stitch is a V made of two yarn legs. Each leg is a capsule
// from the bottom tip of the V to an upper corner, bowed outward. Its height
// above the fabric plane is the yarn cylinder plus an arch, so the leg dips
// at both ends, where it passes under the neighbouring loops.

export const LEG = {
	bottomY: -0.12, // bottom tip, in rows
	topY: 1.30, // upper end, in rows
	bow: 0.06, // outward bow, in stitch widths
	archFactor: 0.6, // arch amplitude, in yarn radii
};

// Leg geometry for one side. side = -1 left leg, +1 right leg.
export function legShape( side, aspect, spread ) {

	const p0 = [ 0.5, LEG.bottomY * aspect ];
	const p1 = [ 0.5 + side * spread, LEG.topY * aspect ];
	const dx = p1[ 0 ] - p0[ 0 ], dy = p1[ 1 ] - p0[ 1 ];
	const len = Math.hypot( dx, dy );
	return { p0, p1, len, dir: [ dx / len, dy / len ], bow: LEG.bow * side };

}

// Candidate legs that can cover a point of cell (column, row):
// both legs of the three rows around it, plus the right leg of the left
// neighbour and the left leg of the right neighbour (they spill a little).
// Each entry: [ columnOffset, rowOffset, side ].
export const CANDIDATES = [];
for ( const dr of [ - 1, 0, 1 ] ) {

	CANDIDATES.push( [ 0, dr, - 1 ], [ 0, dr, 1 ], [ - 1, dr, 1 ], [ 1, dr, - 1 ] );

}

// Yarn radius in stitch widths so that two legs fill one stitch width.
export function yarnRadius( fill, spread, aspect ) {

	const angle = Math.atan2( spread, ( LEG.topY - LEG.bottomY ) * aspect );
	return fill * 0.25 * Math.cos( angle );

}

// CPU evaluation of one leg at local point (x, y). Mirrors legEval in TSL.
export function legEvalCPU( x, y, shape, R ) {

	const wx = x - shape.p0[ 0 ], wy = y - shape.p0[ 1 ];
	const t = Math.min( 1, Math.max( 0, ( wx * shape.dir[ 0 ] + wy * shape.dir[ 1 ] ) / shape.len ) );
	const px = shape.dir[ 1 ], py = - shape.dir[ 0 ];
	const off = wx * px + wy * py - shape.bow * Math.sin( Math.PI * t );
	// capsule: distance to the clamped point along the axis
	const along = ( wx * shape.dir[ 0 ] + wy * shape.dir[ 1 ] ) - t * shape.len;
	const rn = off / R;
	const r2 = rn * rn + ( along / R ) * ( along / R );
	const core = Math.sqrt( Math.max( 0, 1 - r2 ) );
	const z = r2 < 1 ? R * core + LEG.archFactor * R * Math.sin( Math.PI * t ) : - 10;
	return { z, rn, t, core };

}
