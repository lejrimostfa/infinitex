// Flyover film: a small craft glides over the character like a drone over a
// landscape, matter after matter. No roll, no loop: up is always world up.
// Keys come from the character config (cfg.flyover.keys):
//   { at: seconds, pos: [x, y, z], look: [x, y, z] }            a free shot
//   { at, ray: ( C, V ) => [ from, to ], alt: meters, caption }  over the surface
// A surface key sits on the triangle its ray hits first (any mesh). Each
// frame, the triangle is read in its animated pose; the camera hovers at
// `alt` above it, a little behind, looking ahead along the flight. Positions
// and look points are blended between keys with Catmull-Rom splines and an
// eased time, so the flight never cuts corners abruptly. Keys must rise
// between distant parts: a straight line between two low keys would go
// through the body.
// Same interface as film.js: pose( k ) returns the distance to the look
// point (for the scale bar), overlay( d ) draws captions and the bar.

import * as THREE from 'three/webgpu';

const BARS = [ 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 5e-3, 2e-3, 1e-3, 5e-4, 2e-4, 1e-4, 5e-5 ];
const label = ( m ) => m >= 0.01 ? `${ +( m * 100 ).toFixed( 1 ) } cm` : m >= 1e-3 ? `${ +( m * 1000 ).toFixed( 1 ) } mm` : `${ Math.round( m * 1e6 ) } µm`;
const ease = ( x ) => x * x * ( 3 - 2 * x );
const UPV = new THREE.Vector3( 0, 1, 0 );

function catmull( p0, p1, p2, p3, t, out ) {

	const t2 = t * t, t3 = t2 * t;
	return out.set( 0, 0, 0 )
		.addScaledVector( p0, - 0.5 * t3 + t2 - 0.5 * t )
		.addScaledVector( p1, 1.5 * t3 - 2.5 * t2 + 1 )
		.addScaledVector( p2, - 1.5 * t3 + 2 * t2 + 0.5 * t )
		.addScaledVector( p3, 0.5 * t3 - 0.5 * t2 );

}

export function createFlyover( { camera, scene, keys, C, V, ignore = () => false, targets = null } ) {

	scene.updateMatrixWorld( true );
	const ray = new THREE.Raycaster();
	// Resolve surface keys to a triangle of a mesh (first real hit).
	const K = keys.map( ( k ) => {

		if ( ! k.ray ) return { ...k, free: true, P: V( ...k.pos ), L: V( ...k.look ) };
		const [ from, to ] = k.ray( C, V );
		ray.set( from, to.clone().sub( from ).normalize() );
		// With targets, only them (not their children): the cube wall cast
		// 600 rays through 241 cubes and their fuzz shells, 14 s at startup.
		const hit = ray.intersectObjects( targets ?? scene.children, ! targets ).find( ( h ) => h.object.isMesh && ! ignore( h.object ) );
		if ( ! hit ) throw new Error( `flyover: key at ${ k.at } s hits nothing` );
		const tri = [ hit.face.a, hit.face.b, hit.face.c ];
		return { ...k, mesh: hit.object, tri, side: hit.face.normal.clone().transformDirection( hit.object.matrixWorld ).dot( ray.ray.direction ) < 0 ? 1 : - 1, P: new THREE.Vector3(), N: new THREE.Vector3(), L: new THREE.Vector3() };

	} );

	const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
	function surface( k ) {

		k.mesh.getVertexPosition( k.tri[ 0 ], a );
		k.mesh.getVertexPosition( k.tri[ 1 ], b );
		k.mesh.getVertexPosition( k.tri[ 2 ], c );
		k.mesh.localToWorld( a );
		k.mesh.localToWorld( b );
		k.mesh.localToWorld( c );
		k.P.copy( a ).add( b ).add( c ).divideScalar( 3 );
		k.N.copy( b ).sub( a ).cross( c.clone().sub( a ) ).normalize().multiplyScalar( k.side );

	}

	// Every key as ( P ground point, N up from the ground, alt, T flight
	// direction ). A free shot is a key whose ground is its look point and
	// whose altitude is its distance. Between keys, P follows a Catmull-Rom
	// curve, N and T are blended, the altitude is blended in log space (a
	// dive from 5 cm to 2 mm takes as long per decade at each step). One
	// spline through camera positions overshot wildly between 2.6 m and
	// 5 cm and flew through the floor and the body.
	function layout() {

		scene.updateMatrixWorld( true );
		for ( const k of K ) {

			if ( k.free ) {

				k.G = k.L.clone();
				k.U = k.P.clone().sub( k.L );
				k.h = k.U.length();
				k.U.normalize();

			} else {

				surface( k );
				k.G = k.P.clone();
				k.U = k.N.clone();
				k.h = k.alt;

			}

		}

		const surf = K.filter( ( k ) => ! k.free );
		for ( const k of K ) {

			const j = surf.indexOf( k );
			const prev = surf[ Math.max( 0, j - 1 ) ] ?? k, next = surf[ Math.min( surf.length - 1, j + 1 ) ] ?? k;
			k.T = next.G.clone().sub( prev.G );
			k.T.addScaledVector( k.U, - k.T.dot( k.U ) );
			if ( k.free || k.T.lengthSq() < 1e-10 ) k.T.set( 0, 0, 0 ); // free shots look straight at their target
			else k.T.normalize();

		}

	}

	const duration = K[ K.length - 1 ].at;
	let now = 0;
	const G = new THREE.Vector3(), U = new THREE.Vector3(), T = new THREE.Vector3();
	const S = new THREE.Vector3(), N = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3();
	const hitRay = new THREE.Raycaster();

	// Which keys frame time `now`, and the eased blend between them.
	function span( tNow ) {

		let i = 0;
		while ( i < K.length - 2 && K[ i + 1 ].at <= tNow ) i ++;
		const t = ease( Math.min( 1, Math.max( 0, ( tNow - K[ i ].at ) / Math.max( 1e-6, K[ i + 1 ].at - K[ i ].at ) ) ) );
		return { i, t };

	}

	// The whole flight is solved once, on the pose of the first frame, then
	// smoothed. Solving it frame by frame on the animated character made the
	// camera shake: at 1 mm, the breathing of the idle moved the ground point,
	// and the flight direction, taken from that motion, swung every frame.
	// At render time the camera only follows the drift of the key triangles.
	const FPS = 30;
	let path = null;
	function solve() {

		layout();
		for ( const k of K ) k.rest = k.free ? null : k.P.clone();
		const n = Math.max( 2, Math.ceil( duration * FPS ) + 1 );
		const P = [];
		let lastDir = null, lastS = null;
		for ( let f = 0; f < n; f ++ ) {

			const tNow = f / ( n - 1 ) * duration;
			const { i, t } = span( tNow );
			const A = K[ i ], B = K[ i + 1 ];
			catmull( K[ Math.max( 0, i - 1 ) ].G, A.G, B.G, K[ Math.min( K.length - 1, i + 2 ) ].G, t, G );
			U.copy( A.U ).lerp( B.U, t ).normalize();
			T.copy( A.T ).lerp( B.T, t );
			const h = Math.exp( Math.log( A.h ) * ( 1 - t ) + Math.log( B.h ) * t );

			// The real ground under the craft: a ray from outside along -U.
			S.copy( G );
			N.copy( U );
			const near = 1 - ease( Math.min( 1, Math.max( 0, ( h - 0.08 ) / 0.22 ) ) );
			if ( near > 0 && targets ) {

				hitRay.set( tmp.copy( G ).addScaledVector( U, 0.6 ), tmp2.copy( U ).negate() );
				const hit = hitRay.intersectObjects( targets, false )[ 0 ];
				if ( hit ) {

					const hn = tmp3.copy( hit.face.normal ).transformDirection( hit.object.matrixWorld );
					if ( hn.dot( U ) < 0 ) hn.negate();
					S.lerp( hit.point, near );
					N.lerp( hn.add( U ).normalize(), near ).normalize();

				}

			}

			// Flight direction: near the surface the craft glides sideways,
			// level, along the wall (the horizontal tangent), always the same
			// way round. Taking it from the craft's motion swung the camera
			// by 90 degrees during slow dives. Far away it just looks at its
			// target (T = 0).
			const ref = tmp.crossVectors( N, UPV );
			if ( ref.length() > 0.2 ) {

				ref.normalize();
				if ( lastDir ? ref.dot( lastDir ) < 0 : ref.x < 0 ) ref.negate();
				lastDir = ref.clone();

			}

			T.copy( lastDir ?? ref.set( 1, 0, 0 ) ).multiplyScalar( near );
			lastS = S.clone();
			P.push( { S: S.clone(), N: N.clone(), T: T.clone(), h } );

		}

		// Smooth directions over about half a second, the ground a little.
		const smooth = ( key, sigma, unit ) => {

			const r = Math.ceil( sigma * FPS * 2.5 ), out = [];
			for ( let f = 0; f < n; f ++ ) {

				const v = new THREE.Vector3();
				let wsum = 0;
				for ( let d = - r; d <= r; d ++ ) {

					const g = f + d;
					if ( g < 0 || g >= n ) continue;
					const w = Math.exp( - 0.5 * ( d / ( sigma * FPS ) ) ** 2 );
					v.addScaledVector( P[ g ][ key ], w );
					wsum += w;

				}

				out.push( unit ? v.normalize() : v.divideScalar( wsum ) );

			}

			out.forEach( ( v, f ) => { P[ f ][ key ] = v; } );

		};
		smooth( 'N', 0.3, true );
		smooth( 'T', 0.5, false );
		smooth( 'S', 0.1, false );
		return P;

	}

	const pos = new THREE.Vector3(), tgt = new THREE.Vector3(), drift = new THREE.Vector3(), dA = new THREE.Vector3(), dB = new THREE.Vector3();
	function pose( k ) {

		now = Math.min( 1, Math.max( 0, k ) ) * duration;
		if ( ! path ) path = solve();
		const x = now / duration * ( path.length - 1 ), f0 = Math.floor( x ), f1 = Math.min( path.length - 1, f0 + 1 ), a = x - f0;
		const p0 = path[ f0 ], p1 = path[ f1 ];
		S.copy( p0.S ).lerp( p1.S, a );
		N.copy( p0.N ).lerp( p1.N, a ).normalize();
		T.copy( p0.T ).lerp( p1.T, a );
		const h = p0.h + ( p1.h - p0.h ) * a;
		T.addScaledVector( N, - T.dot( N ) ); // length = how much it glides (0 far, 1 near)

		// Drift of the animated character: how far the key triangles moved
		// from the solved pose, blended like the keys. Rigid, so no shake.
		scene.updateMatrixWorld( true );
		const { i, t } = span( now );
		const move = ( key, out ) => {

			if ( key.free ) return out.set( 0, 0, 0 );
			surface( key );
			return out.copy( key.P ).sub( key.rest );

		};
		drift.copy( move( K[ i ], dA ) ).lerp( move( K[ i + 1 ], dB ), t );
		S.add( drift );

		// Hover above the ground, a little behind, looking ahead.
		pos.copy( S ).addScaledVector( N, h ).addScaledVector( T, - h * 0.7 );
		tgt.copy( S ).addScaledVector( T, h * 0.9 );
		// Never look straight up or down: with world up, a vertical view spins.
		tmp.copy( tgt ).sub( pos );
		const dist = tmp.length();
		tmp.normalize();
		if ( Math.abs( tmp.y ) > 0.85 ) {

			const hy = Math.sign( tmp.y ) * 0.85, hz = Math.sqrt( 1 - hy * hy );
			const flat = tmp2.set( tmp.x, 0, tmp.z );
			if ( flat.lengthSq() < 1e-8 ) flat.set( T.x, 0, T.z );
			if ( flat.lengthSq() < 1e-8 ) flat.set( 0, 0, 1 );
			flat.normalize().multiplyScalar( hz );
			tmp.set( flat.x, hy, flat.z );
			tgt.copy( pos ).addScaledVector( tmp, dist );

		}

		camera.position.copy( pos );
		camera.up.set( 0, 1, 0 );
		camera.lookAt( tgt );
		camera.near = 1e-6;
		camera.far = 100;
		camera.updateProjectionMatrix();
		return pos.distanceTo( tgt );

	}

	const cap = document.getElementById( 'film-cap' );
	const bar = document.getElementById( 'film-bar' );
	function overlay( d ) {

		// Caption of the last key passed, faded in over 0.8 s and out before the next key.
		let html = '';
		K.forEach( ( k, i ) => {

			if ( ! k.caption ) return;
			const end = K[ i + 1 ]?.at ?? duration + 10; // a caption ends with its shot
			const o = Math.min( 1, Math.max( 0, ( now - k.at + 0.4 ) / 0.8 ), Math.max( 0, ( end - now ) / 0.8 ) );
			if ( o > 0.01 ) html += `<div style="opacity:${ o.toFixed( 3 ) }">${ k.caption }</div>`;

		} );
		cap.innerHTML = html;
		const H = 2 * d * Math.tan( camera.fov * Math.PI / 360 );
		const pxPerM = innerHeight / H;
		const m = BARS.find( ( x ) => x * pxPerM <= innerWidth * 0.2 ) ?? BARS[ BARS.length - 1 ];
		bar.innerHTML = `<i style="width:${ ( m * pxPerM ).toFixed( 1 ) }px"></i><span>${ label( m ) }</span>`;

	}

	return { pose, overlay, duration, keys: K };

}
