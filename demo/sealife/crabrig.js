// A crab's legs and walk (crab.js draws it), a function of time only.
//   layout   four walking legs per side under the shell's rim, fanned
//            (front legs forward, back legs back), the middle ones longest;
//            each: coxa, merus, carpus, propodus, dactyl
//   IK       per leg, in the vertical plane through its hip and its foot:
//            the coxa turns toward the foot, then a two-bone solve, the
//            merus (knee up) and the rest as one rigid bent chain whose
//            chord reaches the foot tip
//   walk     a schedule over one period: pauses, a sideways walk, a turn
//            in place, the walk back, a turn back. It advances a progress
//            p (meters walked, plus the turn's arc at the feet).
//   feet     two groups of four (alternating tetrapod). A foot in stance
//            sits at its home point placed by the pose at the middle of
//            that stance: it does not move while the body goes over it.
//            In swing it arcs to the next footprint. Feet and body follow
//            the floor's height (ground( x, z )).
//
// Event bus: none (a pure helper; crab.js calls it once per frame).

import * as THREE from 'three/webgpu';

// Leg k (0 front) on side sx (+1 right): socket, fan angle, size.
export function legLayout( S ) {

	const legs = [];
	for ( const sx of [ 1, - 1 ] ) for ( let k = 0; k < 4; k ++ ) {

		const z = S * ( 0.12 - k * 0.115 ), fan = [ 0.62, 0.2, - 0.2, - 0.6 ][ k ], g = [ 0.95, 1.06, 1.02, 0.86 ][ k ];
		const socket = new THREE.Vector3( sx * S * ( 0.3 - k * 0.012 ), - S * 0.06, z );
		const reach = S * 0.58 * g;
		const home = new THREE.Vector3( socket.x + sx * Math.cos( fan ) * reach, 0, z + Math.sin( fan ) * reach );
		legs.push( { sx, k, socket, home, len: [ 0.07, 0.31, 0.15, 0.22, 0.2 ].map( ( l ) => l * S * g ), r: [ 0.04, 0.045, 0.04, 0.032, 0.022 ].map( ( r ) => r * S ),
			off: ( ( k + ( sx > 0 ? 0 : 1 ) ) % 2 ) * 0.5 + k * 0.04 } );

	}

	return legs;

}

const B1 = 0.3, B2 = 0.4; // fixed bends: carpus to propodus, propodus to dactyl (down)
// The dactyl's tip curves down by this share of its length (crab.js
// builds it so): the chord aims at that tip, the point that touches.
export const DACTYL_BEND = 0.12;
const DB = Math.atan( DACTYL_BEND ), DK = Math.hypot( 1, DACTYL_BEND );
const _o = new THREE.Vector3(), _j = new THREE.Vector3(), _d = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), UP = new THREE.Vector3( 0, 1, 0 );

// A segment's frame in the leg plane (out o, up): angle th above o.
function frame( out, o, th, at ) {

	_d.copy( o ).multiplyScalar( Math.cos( th ) ).addScaledVector( UP, Math.sin( th ) );
	_y.copy( o ).multiplyScalar( - Math.sin( th ) ).addScaledVector( UP, Math.cos( th ) );
	_z.crossVectors( _d, _y );
	return out.makeBasis( _d, _y, _z ).setPosition( at );

}

// Five matrices (crab local) for leg L reaching foot F (crab local).
export function solveLeg( L, F, mats ) {

	const [ lc, a, c, p, d ] = L.len;
	const o = _o.set( F.x - L.socket.x, 0, F.z - L.socket.z ).normalize(), j = _j.copy( L.socket );
	frame( mats[ 0 ], o, - 0.25, j );
	j.addScaledVector( o, lc * Math.cos( 0.25 ) ).addScaledVector( UP, - lc * Math.sin( 0.25 ) );
	// The distal chain's chord, in the carpus frame.
	const cx = c + p * Math.cos( B1 ) + d * DK * Math.cos( B1 + B2 + DB ), cy = - p * Math.sin( B1 ) - d * DK * Math.sin( B1 + B2 + DB );
	const b = Math.hypot( cx, cy ), gam = Math.atan2( cy, cx );
	const fh = ( F.x - j.x ) * o.x + ( F.z - j.z ) * o.z, fv = F.y - j.y;
	const D = Math.min( a + b - 1e-4, Math.max( Math.abs( a - b ) + 1e-4, Math.hypot( fh, fv ) ) );
	const m = Math.atan2( fv, fh ) + Math.acos( Math.min( 1, Math.max( - 1, ( a * a + D * D - b * b ) / ( 2 * a * D ) ) ) );
	frame( mats[ 1 ], o, m, j );
	j.addScaledVector( o, a * Math.cos( m ) ).addScaledVector( UP, a * Math.sin( m ) );
	const kh = ( F.x - j.x ) * o.x + ( F.z - j.z ) * o.z, kv = F.y - j.y;
	let th = Math.atan2( kv, kh ) - gam;
	for ( const [ k, len, bend ] of [ [ 2, c, B1 ], [ 3, p, B2 ], [ 4, d, 0 ] ] ) {

		frame( mats[ k ], o, th, j );
		j.addScaledVector( o, len * Math.cos( th ) ).addScaledVector( UP, len * Math.sin( th ) );
		th -= bend;

	}

	return mats;

}

// The walk over one period: [ duration, move ] with move null (pause),
// { walk: share 0..1 of the way from A to B or back }, { turn: radians }.
const PLAN = [ [ 1.5 ], [ 8, { walk: 1 } ], [ 1.5 ], [ 1.6, { turn: 0.6 } ], [ 1.2 ], [ 8, { walk: - 1 } ], [ 1.5 ], [ 1.6, { turn: - 0.6 } ], [ 1.1 ] ];

export function createWalk( { from, to, period, turnR } ) {

	const A = new THREE.Vector3( ...from ), Bp = new THREE.Vector3( ...to ), dir = Bp.clone().sub( A ), len = dir.length();
	const dur = PLAN.reduce( ( s, [ d ] ) => s + d, 0 ), k = period / dur;
	// Moves in progress order: each knows its start pose and its length.
	const moves = [];
	let p = 0, t = 0, x = 0, yaw = 0;
	for ( const [ d, mv ] of PLAN ) {

		const m = { t0: t, t1: t + d * k, p0: p, x0: x, yaw0: yaw, mv };
		if ( mv?.walk ) { m.len = len; x += mv.walk; }
		else if ( mv?.turn ) { m.len = Math.abs( mv.turn ) * turnR; yaw += mv.turn; }
		else m.len = 0;
		p += m.len;
		t = m.t1;
		moves.push( m );

	}

	const total = p, ease = ( u ) => u * u * ( 3 - 2 * u );
	// Progress at time t.
	const progress = ( t ) => {

		const n = Math.floor( t / period ), tt = t - n * period;
		const m = moves.find( ( q ) => tt < q.t1 ) ?? moves[ moves.length - 1 ];
		return n * total + m.p0 + m.len * ease( Math.min( 1, Math.max( 0, ( tt - m.t0 ) / ( m.t1 - m.t0 ) ) ) );

	};
	// Pose at progress p: { x, z, yaw } (world xz, yaw about y from the path).
	const out = { x: 0, z: 0, yaw: 0 };
	const pose = ( pp ) => {

		const q = pp - Math.floor( pp / total ) * total;
		let m = moves[ 0 ];
		for ( const c of moves ) if ( c.len > 0 && q >= c.p0 ) m = c;
		const u = m.len > 0 ? Math.min( 1, ( q - m.p0 ) / m.len ) : 0;
		const s = m.x0 + ( m.mv?.walk ?? 0 ) * u;
		out.x = A.x + dir.x * s;
		out.z = A.z + dir.z * s;
		out.yaw = m.yaw0 + ( m.mv?.turn ?? 0 ) * u;
		return out;

	};
	return { progress, pose, baseYaw: Math.atan2( - dir.z, dir.x ) };

}
