// A fish outline built by code: one geometry factory, three looks
// (FISH_SHAPES: the school, the small silver fish, the red hero fish).
//   body     rings from the nose to the tail root. The back and the belly
//            have their own curves (the belly fuller), the head is blunt,
//            the tail root (peduncle) narrow and a little flared at its
//            end, where a cap closes it. UVs in meters: around the body
//            from the top midline (mirrored on both sides, so no seam),
//            and toward the nose, so the scales lap toward the tail.
//   fins     thin two-sided sheets (fishfins.js): a forked
//            tail, a dorsal, an anal, two pectorals, two pelvics.
//   eyes     a low dome on each side, its radius kept for the shader.
// Attribute `fish` (vec4), read by the material (fishlook.js):
//   x kind: 0 body, 1 fin, 2 eye
//   body: y = s (0 nose, 1 tail root), z = height on the ring (cos, +1 top)
//   fin:  y = across the rays times their count, z = 0 root to 1 edge
//   eye:  y = 0 at the centre to 1 at the rim
//   w    pectoral flap weight: signed distance from the fin root (m)
// The fish lies along x, nose at +0.4 L, back up (+y), its left side +z.
//
// Event bus: none (a pure geometry factory).

import * as THREE from 'three/webgpu';
import { addFins } from './fishfins.js';

// Proportions are shares of the total length L. tail.len is the caudal
// fin; the body runs from the nose to the tail root over the rest.
export const FISH_SHAPES = {
	school: {
		depth: 0.27, width: 0.12, back: 0.44, backPeak: 0.32, bellyPeak: 0.42, pedStart: 0.8, ped: 0.075, pedWidth: 0.03, blunt: 0.55,
		tail: { len: 0.21, span: 0.15, fork: 0.5 }, dorsal: { from: 0.3, to: 0.62, height: 0.12, rays: 11, spiny: 0.4 },
		anal: { from: 0.6, to: 0.8, height: 0.08, rays: 8 }, pectoral: { s: 0.27, y: - 0.3, len: 0.15, width: 0.06 }, pelvic: { s: 0.4, len: 0.08 },
		eye: { s: 0.1, y: 0.3, r: 0.042 }, gill: 0.22, rings: 30, around: 16,
	},
	silver: {
		depth: 0.21, width: 0.1, back: 0.45, backPeak: 0.36, bellyPeak: 0.44, pedStart: 0.82, ped: 0.06, pedWidth: 0.026, blunt: 0.3,
		tail: { len: 0.22, span: 0.15, fork: 0.42 }, dorsal: { from: 0.42, to: 0.6, height: 0.09, rays: 8, spiny: 0 },
		anal: { from: 0.66, to: 0.82, height: 0.06, rays: 7 }, pectoral: { s: 0.25, y: - 0.35, len: 0.13, width: 0.045 }, pelvic: { s: 0.45, len: 0.06 },
		eye: { s: 0.1, y: 0.25, r: 0.045 }, gill: 0.21, rings: 18, around: 10,
	},
	hero: {
		depth: 0.36, width: 0.13, back: 0.47, backPeak: 0.34, bellyPeak: 0.44, pedStart: 0.78, ped: 0.1, pedWidth: 0.035, blunt: 0.7,
		tail: { len: 0.22, span: 0.17, fork: 0.72 }, dorsal: { from: 0.2, to: 0.76, height: 0.15, rays: 17, spiny: 0.8 },
		anal: { from: 0.58, to: 0.78, height: 0.11, rays: 9 }, pectoral: { s: 0.29, y: - 0.25, len: 0.17, width: 0.07 }, pelvic: { s: 0.36, len: 0.12 },
		eye: { s: 0.1, y: 0.32, r: 0.045 }, gill: 0.24, rings: 34, around: 18,
	},
};

// One side of the outline: rises from the nose to its peak (blunt: a
// quarter ellipse, else a parabola), falls by a cosine to the peduncle.
function lobe( s, A, pk, pe, P, blunt ) {

	if ( s < pk ) { const x = s / pk, c = 1 - ( 1 - x ) ** 2; return A * ( ( 1 - blunt ) * c + blunt * Math.sqrt( c ) ); }
	if ( s < pe ) return P + ( A - P ) * ( 0.5 + 0.5 * Math.cos( Math.PI * ( s - pk ) / ( pe - pk ) ) );
	return P;

}

// The body's outline in meters at s: { x, top, bot, w } (bot > 0, below).
export function outline( sh, L ) {

	const xN = 0.4 * L, Lb = L * ( 1 - sh.tail.len );
	const flare = ( s ) => 1 + 0.4 * Math.max( 0, ( s - 0.9 ) / 0.1 ) ** 2;
	return ( s ) => ( {
		x: xN - s * Lb,
		top: L * lobe( s, sh.depth * sh.back, sh.backPeak, sh.pedStart, sh.ped / 2, sh.blunt ) * flare( s ),
		bot: L * lobe( s, sh.depth * ( 1 - sh.back ), sh.bellyPeak, sh.pedStart, sh.ped / 2, sh.blunt * 0.7 ) * flare( s ),
		w: L * lobe( s, sh.width / 2, 0.28, sh.pedStart, sh.pedWidth / 2, 0.8 ),
	} );

}

// A point on the ring at s, angle a from the top (a in [0, 2 pi)).
export function ringPoint( o, a ) {

	const c = Math.cos( a ), sn = Math.sin( a );
	return [ o.x, c > 0 ? o.top * c : o.bot * c, o.w * sn * ( 1 - 0.12 * c ) ];

}

export function fishGeometry( L, shape = 'school' ) {

	const sh = typeof shape === 'string' ? FISH_SHAPES[ shape ] : shape;
	const at = outline( sh, L );
	const B = { pos: [], uv: [], fish: [], idx: [] };
	const NS = sh.rings, NA = sh.around;
	const Lb = L * ( 1 - sh.tail.len );
	// Rings closer together at the head: the round snout and the gill line.
	for ( let i = 0; i <= NS; i ++ ) {

		const q = i / NS, s = 0.45 * q + 0.55 * q * q, o = at( s );
		// Arc length from the top midline down one side: the UV around.
		let arc = 0, prev = ringPoint( o, 0 );
		const arcs = [ 0 ];
		for ( let j = 1; j <= NA / 2; j ++ ) { const p = ringPoint( o, j / NA * Math.PI * 2 ); arc += Math.hypot( p[ 1 ] - prev[ 1 ], p[ 2 ] - prev[ 2 ] ); arcs.push( arc ); prev = p; }
		for ( let j = 0; j < NA; j ++ ) {

			const a = j / NA * Math.PI * 2;
			B.pos.push( ...ringPoint( o, a ) );
			B.uv.push( arcs[ Math.min( j, NA - j ) ], ( 1 - s ) * Lb );
			B.fish.push( 0, s, Math.cos( a ), 0 );

		}

	}

	for ( let i = 0; i < NS; i ++ ) for ( let j = 0; j < NA; j ++ ) {

		const a = i * NA + j, b = i * NA + ( j + 1 ) % NA, c = a + NA, d = b + NA;
		B.idx.push( a, c, b, b, c, d );

	}

	// Cap at the tail root: a fan to its centre.
	const last = NS * NA, centre = B.pos.length / 3, oE = at( 1 );
	B.pos.push( oE.x, 0, 0 );
	B.uv.push( 0, 0 );
	B.fish.push( 0, 1, 0, 0 );
	for ( let j = 0; j < NA; j ++ ) B.idx.push( last + j, centre, last + ( j + 1 ) % NA );

	addFins( B, sh, L, at );
	addEyes( B, sh, L, at );

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( B.pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( B.uv, 2 ) );
	g.setAttribute( 'fish', new THREE.Float32BufferAttribute( B.fish, 4 ) );
	g.setIndex( B.idx );
	g.computeVertexNormals();
	g.computeTangents();
	g.userData.xNose = 0.4 * L;
	return g;

}

// Eyes: a low dome on each side, facing out and a little forward.
function addEyes( B, sh, L, at ) {

	const o = at( sh.eye.s ), R = sh.eye.r * L, NR = 4, NT = 14, rr = [ 0, 0.45, 0.7, 0.86, 1 ];
	for ( const side of [ 1, - 1 ] ) {

		const a = Math.acos( sh.eye.y );
		const p = ringPoint( o, side > 0 ? a : Math.PI * 2 - a );
		const n = new THREE.Vector3( 0.3, sh.eye.y * 0.4, side ).normalize();
		const u = new THREE.Vector3( 0, 1, 0 ).addScaledVector( n, - n.y ).normalize(), v = new THREE.Vector3().crossVectors( n, u );
		const base = B.pos.length / 3;
		for ( let i = 0; i <= NR; i ++ ) for ( let j = 0; j < NT; j ++ ) {

			const r = rr[ i ], t = j / NT * Math.PI * 2, h = R * ( 0.32 * ( 1 - r * r ) + 0.06 );
			B.pos.push( p[ 0 ] + n.x * h + ( u.x * Math.cos( t ) + v.x * Math.sin( t ) ) * r * R, p[ 1 ] + n.y * h + ( u.y * Math.cos( t ) + v.y * Math.sin( t ) ) * r * R, p[ 2 ] + n.z * h + ( u.z * Math.cos( t ) + v.z * Math.sin( t ) ) * r * R );
			B.uv.push( r * R, t * R );
			B.fish.push( 2, r, 0, 0 );

		}

		for ( let i = 0; i < NR; i ++ ) for ( let j = 0; j < NT; j ++ ) {

			const a0 = base + i * NT + j, a1 = base + i * NT + ( j + 1 ) % NT;
			B.idx.push( a0, a0 + NT, a1, a1, a0 + NT, a1 + NT ); // outward on both sides: v = n x u turns with n

		}

	}

}
