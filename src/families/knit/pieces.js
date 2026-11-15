// Candidate lists for cells.js: knit legs, purl bumps, crochet pieces.
// A frame is { local, col, row }: the point inside its stitch cell, in
// stitch widths, and the cell ids. mask( cell ) and lift( cell ) are TSL
// functions of a vec2 cell id, given by the pattern (patterns.js).

import { vec2, float, floor, step } from 'three/tsl';
import { pick } from '../../core/lod.js';
import { CANDIDATES } from './legs.js';
import { PURL, CROCHET, shapeTSL } from './elements.js';

// Positive modulo (WGSL % truncates toward zero).
export const posmod = ( x, n ) => x.sub( floor( x.div( n ) ).mul( n ) );

// Twelve knit legs around the point, as in stitch.js.
export function knitItems( u, f, mask, lift, extra = {} ) {

	const items = [];
	for ( const [ dc, dr, side ] of CANDIDATES ) {

		const cell = vec2( f.col.add( dc ), f.row.add( dr ) );
		items.push( {
			q: f.local.sub( vec2( float( dc ), u.aspect.mul( dr ) ) ), cell,
			sh: side < 0 ? u.left : u.right, R: u.R, arch: u.arch,
			mask: mask( cell ), lift: lift( cell ), side: side + ( extra.sideOffset ?? 0 ), shear: extra.shear,
		} );

	}

	return items;

}

// Nearest neighbour column and row: pieces never reach further.
function near( u, f ) {

	return {
		nc: pick( step( 0.5, f.local.x ), float( 1 ), float( - 1 ) ),
		nr: pick( step( u.aspect.mul( 0.5 ), f.local.y ), float( 1 ), float( - 1 ) ),
	};

}

// Purl bumps: heads over the own and nearest column, sinkers from the own
// and left column (a sinker spans the border to the right of its cell).
export function purlItems( u, f, mask, lift ) {

	const { nc, nr } = near( u, f );
	const items = [];
	for ( const dr of [ float( 0 ), nr ] ) {

		for ( const [ e, dcs ] of [ [ PURL[ 0 ], [ float( 0 ), nc ] ], [ PURL[ 1 ], [ float( 0 ), float( - 1 ) ] ] ] ) {

			for ( const dc of dcs ) {

				const cell = vec2( f.col.add( dc ), f.row.add( dr ) );
				items.push( {
					q: f.local.sub( vec2( dc, u.aspect.mul( dr ) ) ), cell,
					sh: shapeTSL( e, u.aspect ), R: u.R.mul( e.rScale ), arch: float( e.arch ),
					mask: mask( cell ), lift: lift( cell ).add( e.lift ), side: e.side,
				} );

			}

		}

	}

	return items;

}

// Crochet: five pieces per stitch, own and nearest column and row. Odd
// rows are mirrored (the work turns at each row).
export function crochetItems( u, f ) {

	const { nc, nr } = near( u, f );
	const items = [];
	for ( const dr of [ float( 0 ), nr ] ) for ( const dc of [ float( 0 ), nc ] ) {

		const cell = vec2( f.col.add( dc ), f.row.add( dr ) );
		const odd = posmod( cell.y, 2 );
		for ( const e of CROCHET ) {

			items.push( {
				q: f.local.sub( vec2( dc, u.aspect.mul( dr ) ) ), cell,
				sh: shapeTSL( e, u.aspect, odd ), R: u.R.mul( e.rScale ), arch: float( e.arch ),
				mask: float( 1 ), lift: float( e.lift ).mul( u.relief ), side: e.side,
			} );

		}

	}

	return items;

}
