// The parts of a crab built by code, for one skinned mesh (crab.js):
// every vertex belongs to one bone (rigid parts), with a vertex colour.
//   shell     the carapace: an outline wider than long, a straight front
//             between the eye sockets, five teeth along each front side
//             (the last one a sharp lateral spine), the sides converging to
//             a narrower back. A dome over it with a rounded rim, a groove
//             across (cervical) and down the middle, a flat pale underside.
//   segment   a leg segment along +x: flattened (taller than thick),
//             tapering, a little swollen, darker at both joints, paler
//             below; the dactyl ends in a curved point
//   claw, eyes, stalks: crabparts.js
// S is the width of the shell (m). Coordinates: x to the crab's right,
// y up, z forward (where the eyes are).
//
// Event bus: none (a pure geometry helper).

import * as THREE from 'three/webgpu';

export const COLORS = { shell: [ 0.7, 0.16, 0.05 ], shellDark: [ 0.3, 0.05, 0.02 ], under: [ 0.95, 0.82, 0.6 ], leg: [ 0.78, 0.22, 0.07 ], tip: [ 0.06, 0.03, 0.02 ], eye: [ 0.02, 0.02, 0.02 ] };

export function createBuilder() {

	return { pos: [], uv: [], col: [], bone: [], idx: [] };

}

export const mix3 = ( a, b, t ) => a.map( ( c, i ) => c + ( b[ i ] - c ) * t );
export const sstep = ( a, b, x ) => { const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) ); return t * t * ( 3 - 2 * t ); };

// A grid of rows of points (each row a closed ring of n) into the builder.
export function rings( B, rows, n, bone, close = true ) {

	const base = B.pos.length / 3;
	for ( const row of rows ) for ( const v of row ) { B.pos.push( ...v.p ); B.uv.push( ...v.uv ); B.col.push( ...v.c ); B.bone.push( bone ); }
	const m = close ? n : n - 1;
	for ( let i = 0; i < rows.length - 1; i ++ ) for ( let j = 0; j < m; j ++ ) {

		const a = base + i * n + j, b = base + i * n + ( j + 1 ) % n, c = a + n, d = b + n;
		B.idx.push( a, b, c, b, d, c );

	}

}

// The shell's outline in the top view at angle f from the front (+z)
// toward the right (+x): [ x, z ], and how far out a tooth pushes it.
function outline( f, S ) {

	const W = S * 0.5, Lf = S * 0.36, Lb = S * 0.34;
	const sx = Math.sin( f ), cz = Math.cos( f ), af = Math.abs( ( ( f + Math.PI ) % ( Math.PI * 2 ) ) - Math.PI );
	let x = W * Math.sign( sx ) * Math.abs( sx ) ** 0.8 * ( 1 + 0.06 * cz ) * ( 1 - 0.4 * Math.max( 0, - cz ) ** 1.3 );
	let z = ( cz > 0 ? Lf : Lb ) * Math.sign( cz ) * Math.abs( cz ) ** 0.75;
	// Teeth: five along each front side, the fifth the lateral spine.
	let tooth = 0;
	const t = ( af - 0.36 ) / ( 1.5 - 0.36 );
	if ( t > 0 && t < 1 ) { const q = t * 5, fr = q - Math.floor( q ), k = Math.floor( q ); tooth = ( fr < 0.3 ? fr / 0.3 : ( ( 1 - fr ) / 0.7 ) ** 1.5 ) * S * ( k === 4 ? 0.075 : 0.03 ); }
	// Small lobes on the front between the sockets; the sockets notch in.
	if ( af < 0.2 ) tooth += Math.abs( Math.sin( af / 0.2 * Math.PI * 1.5 ) ) * S * 0.012;
	tooth -= Math.exp( - ( ( ( af - 0.27 ) / 0.045 ) ** 2 ) ) * S * 0.035;
	const r = Math.hypot( x, z ) || 1;
	return [ x + x / r * tooth, z + z / r * tooth, tooth ];

}

export function shell( B, S ) {

	const N = 160, H = S * 0.19, K = 11, top = [], under = [], C = COLORS;
	// Top: rings from the rim (k = 0) to the crown.
	for ( let k = 0; k <= K; k ++ ) {

		const s = 1 - ( k / K ) ** 1.2, row = [];
		for ( let j = 0; j < N; j ++ ) {

			const [ ox, oz, tooth ] = outline( j / N * Math.PI * 2, S ), r = Math.hypot( ox, oz ) || 1;
			const fade = tooth * ( 1 - sstep( 0.86, 1, s ) ); // the teeth only at the rim
			const x = ( ox - ox / r * fade ) * s, z = ( oz - oz / r * fade ) * s + ( 1 - s ) * S * 0.03;
			// Grooves: across at the cervical line, down the middle in front.
			const g = Math.exp( - ( ( ( z - ( - S * 0.02 + 0.8 * x * x / S ) ) / ( S * 0.025 ) ) ** 2 ) ) * sstep( 0.05, 0.25, Math.abs( x ) / S ) * sstep( 0.95, 0.7, s )
				+ 0.5 * Math.exp( - ( ( x / ( S * 0.025 ) ) ** 2 ) ) * sstep( 0.03, 0.12, z / S ) * sstep( 0.85, 0.6, s );
			const y = H * Math.sqrt( 1 - s * s ) * ( 1 + 0.12 * z / S ) - g * S * 0.006;
			const c = mix3( C.shell, C.shellDark, Math.min( 1, g * 0.8 + sstep( 0.95, 1, s ) * Math.max( 0, tooth ) / ( S * 0.04 ) * 0.6 ) );
			row.push( { p: [ x, y, z ], uv: [ x, z ], c } );

		}

		top.push( row );

	}

	rings( B, top, N, 0 ); // rim to crown: faces out
	// Rim lip and the flat underside, pale.
	for ( const [ s, y ] of [ [ 1, 0 ], [ 0.985, - S * 0.025 ], [ 0.93, - S * 0.05 ], [ 0.6, - S * 0.075 ], [ 0.25, - S * 0.085 ], [ 0, - S * 0.09 ] ] ) {

		const row = [];
		for ( let j = 0; j < N; j ++ ) {

			const [ ox, oz ] = outline( j / N * Math.PI * 2, S );
			row.push( { p: [ ox * s, y, oz * s ], uv: [ ox * s, oz * s + S ], c: s === 1 ? C.shell : mix3( C.shell, C.under, s > 0.95 ? 0.5 : 1 ) } );

		}

		under.push( row );

	}

	rings( B, under.reverse(), N, 0 ); // centre to rim: faces out, below

}

// A segment along +x from 0 to len, radius r0 to r1 (height), thinner
// across (flat); bend: the tip curves down by this share of len.
export function segment( B, bone, len, r0, r1, { flat = 0.65, col = COLORS.leg, tip = null, bend = 0, n = 8, nu = 7, knob = 0.12 } = {} ) {

	const rows = [];
	const us = [ - 0.07, - 0.03 ];
	for ( let i = 0; i <= nu; i ++ ) us.push( i / nu );
	us.push( 1.03, 1.06 );
	for ( const u of us ) {

		const uc = Math.min( 1, Math.max( 0, u ) );
		let r = ( r0 + ( r1 - r0 ) * uc ) * ( 1 + knob * Math.sin( Math.PI * uc ) );
		if ( u < 0 ) r *= u < - 0.05 ? 0.15 : 0.7;
		if ( u > 1 ) r *= u > 1.05 ? 0.15 : 0.75;
		const joint = Math.max( sstep( 0.14, 0, u ), sstep( 0.86, 1, u ) );
		const row = [];
		for ( let j = 0; j < n; j ++ ) {

			const a = j / n * Math.PI * 2, cy = Math.cos( a ), sz = Math.sin( a );
			let c = mix3( col, COLORS.under, sstep( 0.2, - 0.8, cy ) * 0.55 );
			c = c.map( ( v ) => v * ( 1 - 0.4 * joint ) );
			if ( tip ) c = mix3( c, tip, sstep( 0.55, 0.95, u ) );
			row.push( { p: [ u * len, cy * r - bend * len * uc * uc, sz * r * flat ], uv: [ u * len, a * r ], c } );

		}

		rows.push( row );

	}

	rings( B, rows, n, bone );

}

export function toGeometry( B ) {

	const g = new THREE.BufferGeometry();
	const n = B.pos.length / 3, si = new Uint16Array( n * 4 ), sw = new Float32Array( n * 4 );
	for ( let i = 0; i < n; i ++ ) { si[ i * 4 ] = B.bone[ i ]; sw[ i * 4 ] = 1; }
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( B.pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( B.uv, 2 ) );
	g.setAttribute( 'color', new THREE.Float32BufferAttribute( B.col, 3 ) );
	g.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( si, 4 ) );
	g.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( sw, 4 ) );
	g.setIndex( B.idx );
	g.computeVertexNormals();
	g.computeTangents();
	return g;

}
