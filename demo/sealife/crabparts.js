// Small parts of a crab built by code (crab.js), on the builder of
// crabshape.js: every vertex on one bone, with a vertex colour.
//   ball   an eye at the tip of its stalk
//   tube   a stalk or a mouth plate between two points
//   palm   a claw's swollen palm with the fixed finger below it, toothed
//          on its inner edge, dark at the tip; the moving finger is a
//          segment of its own (crab.js)
//
// Event bus: none (a pure geometry helper).

import * as THREE from 'three/webgpu';
import { COLORS, rings, segment, mix3, sstep } from './crabshape.js';

// A sphere (eyes) on bone, at c, radius r.
export function ball( B, bone, c, r, col ) {

	const rows = [];
	for ( let i = 0; i <= 6; i ++ ) {

		const v = i / 6 * Math.PI, row = [];
		for ( let j = 0; j < 10; j ++ ) { const a = j / 10 * Math.PI * 2; row.push( { p: [ c[ 0 ] + Math.sin( v ) * Math.cos( a ) * r, c[ 1 ] + Math.cos( v ) * r, c[ 2 ] + Math.sin( v ) * Math.sin( a ) * r ], uv: [ a * r, v * r ], c: col } ); }
		rows.push( row );

	}

	rings( B, rows, 10, bone );

}

// A tube from a to b on bone (stalks, mouth plates).
export function tube( B, bone, a, b, r0, r1, col, flat = 1 ) {

	const d = new THREE.Vector3( ...b ).sub( new THREE.Vector3( ...a ) ), len = d.length();
	const X = d.clone().normalize(), Y = Math.abs( X.y ) > 0.9 ? new THREE.Vector3( 1, 0, 0 ) : new THREE.Vector3( 0, 1, 0 );
	const Z = new THREE.Vector3().crossVectors( X, Y ).normalize();
	Y.crossVectors( Z, X );
	const start = B.pos.length / 3;
	segment( B, bone, len, r0, r1, { flat, col, n: 6, nu: 3, knob: 0 } );
	const M = new THREE.Matrix4().makeBasis( X, Y, Z ).setPosition( ...a ), v = new THREE.Vector3();
	for ( let i = start; i < B.pos.length / 3; i ++ ) { v.fromArray( B.pos, i * 3 ).applyMatrix4( M ); v.toArray( B.pos, i * 3 ); }

}

// The palm and fixed finger of a claw along +x, its moving finger apart.
// cs: the claw's size (m). The palm swells, the finger tapers to a point
// with a few teeth on its inner (upper) edge, dark at the tip.
export function palm( B, bone, cs ) {

	const rows = [], n = 12, NU = 10;
	for ( let i = 0; i <= NU; i ++ ) {

		const u = i / NU, x = u * cs * 0.3, h = cs * 0.092 * Math.sqrt( Math.max( 0.02, 1 - ( 2 * u - 0.9 ) ** 2 ) ) * ( u < 0.1 ? 0.6 + 4 * u : 1 ), w = h * 0.68, row = [];
		for ( let j = 0; j < n; j ++ ) { const a = j / n * Math.PI * 2; row.push( { p: [ x, Math.cos( a ) * h, Math.sin( a ) * w ], uv: [ x, a * h ], c: mix3( COLORS.leg, COLORS.under, sstep( 0.3, - 0.9, Math.cos( a ) ) * 0.6 ) } ); }
		rows.push( row );

	}

	rings( B, rows, n, bone );
	// Fixed finger: from the lower front of the palm, curving up a little.
	const fr = [], NF = 8;
	for ( let i = 0; i <= NF; i ++ ) {

		const u = i / NF, x = cs * ( 0.23 + 0.23 * u ), r = cs * 0.04 * ( 1 - u ) + cs * 0.004, yc = - cs * 0.04 + cs * 0.035 * u * u, row = [];
		const teeth = u > 0.1 && u < 0.8 ? Math.max( 0, Math.sin( u * Math.PI * 7 ) ) * cs * 0.012 : 0;
		for ( let j = 0; j < 8; j ++ ) { const a = j / 8 * Math.PI * 2, cy = Math.cos( a ); row.push( { p: [ x, yc + cy * ( r + ( cy > 0.5 ? teeth : 0 ) ), Math.sin( a ) * r * 0.75 ], uv: [ x, a * r ], c: mix3( COLORS.leg, COLORS.tip, sstep( 0.35, 0.8, u ) ) } ); }
		fr.push( row );

	}

	rings( B, fr, 8, bone );

}
