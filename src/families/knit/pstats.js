// CPU statistics of the stitch patterns, the twin of stats.js for jersey:
// mean AO and mean squared slope over one repeat of the pattern, used once
// stitches shrink below a few pixels. Same pieces (elements.js, legs.js),
// same lifts as the TSL (patterns.js), sampled on a grid. Jitter and the
// cable shear are left out: their mean effect is small.

import { CANDIDATES, LEG, legShape } from './legs.js';
import { PURL, CROCHET, shapeCPU } from './elements.js';
import { stitchAOCPU, cavityAO } from './stats.js';

const SPREAD = 0.36;

// One bowed capsule. Mirrors legEval() in stitch.js, with its own arch.
function pieceCPU( x, y, sh, R, arch ) {

	const wx = x - sh.p0[ 0 ], wy = y - sh.p0[ 1 ];
	const proj = wx * sh.dir[ 0 ] + wy * sh.dir[ 1 ];
	const t = Math.min( 1, Math.max( 0, proj / sh.len ) );
	const off = wx * sh.dir[ 1 ] - wy * sh.dir[ 0 ] - sh.bow * Math.sin( Math.PI * t );
	const along = proj - t * sh.len;
	const rn = off / R, r2 = rn * rn + ( along / R ) ** 2;
	if ( r2 >= 1 ) return null;
	return { z: R * Math.sqrt( 1 - r2 ) + arch * R * Math.sin( Math.PI * t ), rn };

}

// Cell type and lift of a pattern, in JS. Mirrors patterns.js and cable.js.
function cellSpec( g, c, r, L ) {

	if ( g.mode === 'rib' ) {

		const k = ( ( c % ( g.ribK + g.ribP ) ) + g.ribK + g.ribP ) % ( g.ribK + g.ribP ) < g.ribK;
		return { type: k ? 'K' : 'P', lift: k ? L : - L };

	}

	if ( g.mode === 'garter' ) return r % 2 ? { type: 'P', lift: L } : { type: 'K', lift: - L };
	if ( g.mode === 'seed' ) return ( c + r ) % 2 ? { type: 'P', lift: - L } : { type: 'K', lift: L };
	if ( g.mode === 'crochet' ) return { type: 'C', lift: 0, odd: r % 2 };
	if ( g.mode === 'cable' ) {

		const X = c % ( g.cableW + g.ground ), x0 = g.ground / 2;
		if ( X < x0 || X >= x0 + g.cableW ) return { type: 'P', lift: 0 };
		const w = g.cableW / 2, xs = ( X - x0 ) % w + 0.5, rr = ( xs - w / 2 ) / ( w / 2 );
		return { type: 'K', lift: L + ( 1 - rr * rr ) * 0.35 * L };

	}

	return { type: 'K', lift: 0 };

}

function repeatOf( g ) {

	if ( g.mode === 'rib' ) return [ g.ribK + g.ribP, 1 ];
	if ( g.mode === 'garter' || g.mode === 'crochet' ) return [ 1, 2 ];
	if ( g.mode === 'seed' ) return [ 2, 2 ];
	if ( g.mode === 'cable' ) return [ g.cableW + g.ground, 1 ];
	return [ 1, 1 ];

}

// derived: { aspect, R }. n: samples per cell side.
export function patternStats( g, { aspect, R }, relief, n = 16 ) {

	const L = g.lift * relief;
	const legs = { '-1': legShape( - 1, aspect, SPREAD ), '1': legShape( 1, aspect, SPREAD ) };
	const purl = PURL.map( ( e ) => ( { e, sh: shapeCPU( e, aspect ) } ) );
	const cro = [ 0, 1 ].map( ( m ) => CROCHET.map( ( e ) => ( { e, sh: shapeCPU( e, aspect, m ) } ) ) );
	const [ nc, nr ] = repeatOf( g );
	let aoSum = 0, wSum = 0, cavSum = 0, s2Sum = 0, count = 0;
	for ( let cr = 0; cr < nr; cr ++ ) for ( let cc = 0; cc < nc; cc ++ ) {

		for ( let i = 0; i < n; i ++ ) for ( let j = 0; j < n; j ++ ) {

			const x = ( i + 0.5 ) / n, y = ( j + 0.5 ) / n * aspect;
			let best = null;
			const keep = ( r, lift ) => {

				if ( r && r.z + lift > ( best ? best.z + best.lift : - 1e9 ) ) best = { ...r, lift };

			};

			for ( let dr = - 1; dr <= 1; dr ++ ) for ( let dc = - 1; dc <= 1; dc ++ ) {

				const s = cellSpec( g, cc + dc + 1000 * nc, cr + dr + 1000 * nr, L );
				const qx = x - dc, qy = y - dr * aspect;
				if ( s.type === 'K' ) {

					for ( const [ kc, kr, side ] of CANDIDATES ) if ( kc === dc && kr === dr ) keep( pieceCPU( qx, qy, legs[ side ], R, LEG.archFactor ), s.lift );

				} else if ( s.type === 'P' ) {

					for ( const { e, sh } of purl ) keep( pieceCPU( qx, qy, sh, R * e.rScale, e.arch ), s.lift + e.lift );

				} else if ( s.type === 'C' ) {

					for ( const { e, sh } of cro[ s.odd ] ) keep( pieceCPU( qx, qy, sh, R * e.rScale, e.arch ), e.lift * relief );

				}

			}

			const zl = best ? best.z : - 10;
			const nz = best ? Math.sqrt( Math.max( 0, 1 - Math.min( 1, best.rn * best.rn ) ) ) : 1;
			const ao = stitchAOCPU( zl, R ), w = ( 1 + nz ) / 2; // weights: stats.js
			aoSum += ao * w;
			wSum += w;
			cavSum += ao * cavityAO( ao ) * w;
			s2Sum += best ? Math.min( 1, best.rn * best.rn ) : 0;
			count ++;

		}

	}

	return { meanAO: aoSum / wSum, meanCavityAO: cavSum / aoSum, slopeVar: s2Sum / count };

}
