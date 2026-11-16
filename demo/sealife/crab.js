// A crab built by code, in the Infinitex matter of a crab's shell: one
// skinned mesh, one draw call, every part a rigid bone (no blending).
//   body     crabshape.js: a toothed carapace wider than long, domed,
//            grooved, pale below; eyes on stalks, mouth plates
//   legs     four per side, five segments each, tapering, darker at the
//            joints, pointed dactyls; placed by IK (crabrig.js)
//   claws    an arm, a wrist, a swollen palm with a toothed fixed finger,
//            a moving finger; the right claw a little larger
//   walk     sideways along the segment from -> to, feet planted while the
//            body passes over them, pauses with the claws raised and
//            snapping, a turn in place at each end (crabrig.js)
//   ground   ( x, z ) => floor height: the body and every foot follow it
//            (seafloor.js gives the aquarium's displaced sand)
//   scale    `size` is the width of the shell in meters
// update( t ) once per frame. position: where the crab is (world).
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { uv } from 'three/tsl';
import { createMaterial } from '../../src/index.js';
import { COLORS, createBuilder, shell, segment, ball, tube, palm, toGeometry } from './crabshape.js';
import { legLayout, solveLeg, createWalk, DACTYL_BEND } from './crabrig.js';

export function createCrab( { size = 0.06, from, to, y = 0, ground = () => y, period = 26, preset = {} } ) {

	const S = size, B = createBuilder(), legs = legLayout( S );
	shell( B, S );
	for ( const sx of [ - 1, 1 ] ) {

		// Eyes on stalks in the sockets, mouth plates below. No antennae: seen
		// from the front they read as a line across the face.
		const st = [ sx * S * 0.12, S * 0.03, S * 0.33 ], tip = [ sx * S * 0.15, S * 0.1, S * 0.37 ];
		tube( B, 0, st, tip, S * 0.02, S * 0.015, COLORS.shell );
		ball( B, 0, tip, S * 0.024, COLORS.eye );
		tube( B, 0, [ sx * S * 0.035, - S * 0.065, S * 0.28 ], [ sx * S * 0.04, - S * 0.08, S * 0.32 ], S * 0.03, S * 0.024, COLORS.under, 0.35 );

	}

	legs.forEach( ( L, i ) => {

		const b = 1 + i * 5, [ lc, a, c, p, d ] = L.len, r = L.r;
		segment( B, b, lc, r[ 0 ], r[ 0 ] * 0.9, { knob: 0.2 } );
		segment( B, b + 1, a, r[ 1 ], r[ 1 ] * 0.85, { flat: 0.55 } );
		segment( B, b + 2, c, r[ 2 ], r[ 2 ] * 0.9, { knob: 0.25 } );
		segment( B, b + 3, p, r[ 3 ], r[ 3 ] * 0.75, { flat: 0.6 } );
		segment( B, b + 4, d, r[ 4 ], r[ 4 ] * 0.05, { tip: COLORS.tip, bend: DACTYL_BEND, knob: 0 } );

	} );

	const claws = [ 1, - 1 ].map( ( sx, i ) => {

		const b = 41 + i * 4, cs = S * ( sx > 0 ? 1.12 : 1 );
		segment( B, b, cs * 0.3, cs * 0.045, cs * 0.05, { flat: 0.7, knob: 0.04 } );
		segment( B, b + 1, cs * 0.14, cs * 0.05, cs * 0.052, { knob: 0.12, flat: 0.8 } );
		palm( B, b + 2, cs );
		segment( B, b + 3, cs * 0.24, cs * 0.036, cs * 0.004, { tip: COLORS.tip, bend: 0.14, knob: 0, flat: 0.7 } );
		return { sx, b, cs, socket: new THREE.Vector3( sx * S * 0.27, - S * 0.04, S * 0.22 ) };

	} );

	// The shell matter: fine warts and mottles over the vertex colours.
	const ix = createMaterial( { family: 'scales', mode: 'quill', holes: 0, scale_mm: 0.9, size_variation: 0.6, depth: 0.5, wrinkles: 0.3, color: '#f2ece6', groove_color: '#a89488', color_variation: 0.15,
		pattern: 0.5, pattern_color: '#d8c4b4', pattern_mm: 6, roughness: 0.35, gloss: 0.45, seed: 38, underwater: 1, micro: 0, ...preset }, { coords: uv() } );
	ix.material.vertexColors = true;
	const mesh = new THREE.SkinnedMesh( toGeometry( B ), ix.material );
	const bones = Array.from( { length: 49 }, () => { const b = new THREE.Bone(); b.matrixAutoUpdate = false; mesh.add( b ); return b; } );
	mesh.bind( new THREE.Skeleton( bones, bones.map( () => new THREE.Matrix4() ) ), new THREE.Matrix4() );
	mesh.frustumCulled = false;
	mesh.castShadow = true;

	const walk = createWalk( { from, to, period, turnR: S * 0.6 } );
	const stand = S * 0.27, Ls = S * 0.4, duty = 0.55, lift = S * 0.13;
	const Mb = new THREE.Matrix4(), Mi = new THREE.Matrix4(), mats = Array.from( { length: 5 }, () => new THREE.Matrix4() ), M = new THREE.Matrix4();
	const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), F = new THREE.Vector3(), F2 = new THREE.Vector3(), pos = new THREE.Vector3();
	const ease = ( u ) => u * u * ( 3 - 2 * u );
	// Where leg L's foot stands in its stance number c (world).
	const print = ( L, c, out ) => {

		const P = walk.pose( ( c + duty / 2 - L.off ) * Ls ), yaw = walk.baseYaw + P.yaw, cs = Math.cos( yaw ), sn = Math.sin( yaw );
		out.set( P.x + L.home.x * cs + L.home.z * sn, 0, P.z - L.home.x * sn + L.home.z * cs );
		out.y = ground( out.x, out.z );
		return out;

	};
	// A frame for a claw segment along dir, its top toward up.
	const aim = ( dir, at ) => { X.copy( dir ).normalize(); Y.set( 0, 1, 0 ).addScaledVector( X, - X.y ).normalize(); Z.crossVectors( X, Y ); return M.makeBasis( X, Y, Z ).setPosition( at ); };
	const set = ( i, m ) => { bones[ i ].matrix.multiplyMatrices( Mb, m ); bones[ i ].matrixWorldNeedsUpdate = true; };

	return {
		group: mesh, material: ix, position: pos,
		update( t ) {

			const p = walk.progress( t ), moving = Math.min( 1, Math.abs( walk.progress( t + 0.05 ) - walk.progress( t - 0.05 ) ) / 0.1 / ( S * 0.4 ) );
			const P = walk.pose( p ), yaw = walk.baseYaw + P.yaw, cs = Math.cos( yaw ), sn = Math.sin( yaw );
			// The body over the floor: height and tilt from four samples.
			const at = ( lx, lz ) => ground( P.x + lx * cs + lz * sn, P.z - lx * sn + lz * cs ), e = S * 0.35;
			const hR = at( e, 0 ), hL = at( - e, 0 ), hF = at( 0, e ), hB = at( 0, - e );
			X.set( cs, ( hR - hL ) / ( 2 * e ), - sn ).normalize();
			Z.set( sn, ( hF - hB ) / ( 2 * e ), cs ).normalize();
			Y.crossVectors( Z, X ).normalize();
			Z.crossVectors( X, Y );
			const bob = moving * S * 0.012 * Math.sin( p / Ls * Math.PI * 4 ) + ( 1 - moving ) * S * 0.006 * Math.sin( t * 1.3 );
			pos.set( P.x, ( hR + hL + hF + hB ) / 4 + stand + bob, P.z );
			Mb.makeBasis( X, Y, Z ).setPosition( pos );
			Mi.copy( Mb ).invert();
			bones[ 0 ].matrix.copy( Mb );
			bones[ 0 ].matrixWorldNeedsUpdate = true;

			for ( let i = 0; i < legs.length; i ++ ) {

				const L = legs[ i ], ph = p / Ls + L.off, c = Math.floor( ph ), f = ph - c;
				print( L, c, F );
				if ( f >= duty ) {

					const w = ( f - duty ) / ( 1 - duty );
					print( L, c + 1, F2 );
					F.lerp( F2, ease( w ) );
					F.y = ground( F.x, F.z ) + lift * Math.sin( Math.PI * w ) * moving;

				}

				solveLeg( L, F.applyMatrix4( Mi ), mats );
				for ( let s = 0; s < 5; s ++ ) set( 1 + i * 5 + s, mats[ s ] );

			}

			// Claws: low and folded while walking; raised and snapping at rest.
			for ( const C of claws ) {

				const rest = 1 - moving, raise = rest * ( 0.65 + 0.35 * Math.sin( t * 1.7 + C.sx ) ), sx = C.sx;
				const j = C.socket.clone();
				const d1 = new THREE.Vector3( sx * 0.5, - 0.3 + 1.0 * raise, 0.8 ), d2 = new THREE.Vector3( - sx * 0.2, - 0.05 + 0.7 * raise, 1 ), d3 = new THREE.Vector3( - sx * 0.62, 0.05 + 0.6 * raise, 0.75 + 0.2 * raise );
				for ( const [ k, d, len ] of [ [ 0, d1, C.cs * 0.3 ], [ 1, d2, C.cs * 0.14 ], [ 2, d3, 0 ] ] ) {

					set( C.b + k, aim( d, j ) );
					j.addScaledVector( X, len );

				}

				// The moving finger, hinged at the top of the palm's front.
				const open = - 0.1 + rest * 0.45 * Math.max( 0, Math.sin( t * 2.6 + sx * 1.3 ) );
				M.multiply( new THREE.Matrix4().makeRotationZ( open ).setPosition( C.cs * 0.24, C.cs * 0.045, 0 ) );
				set( C.b + 3, M );

			}

		},
	};

}
