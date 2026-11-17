// Lava lake life for a page with a molten lake (the living room):
//   bubbles   thick, slow domes of glowing skin swell on the surface (2 to
//             5 s), wobble, then most burst; the others sink back
//   splash    a burst throws heavy, viscous blobs of lava: they fly low and
//             slow, stretch along their speed, cool from yellow to red,
//             and fall back
//   ripples   every blob that lands, and every burst, sends slow rings over
//             the lake (src/families/molten/ripples.js), so the shader of
//             the lake bends and glows with them
// Bubbles are born around the point of the lake the camera looks at, a
// little farther from it the higher the camera: from the room they dot the
// lake, from a bee over it they are right there.
// createLavaFx( { scene, height, bounds, toSurface } )
//   height     world y of the lake's top
//   bounds     { minX, maxX, minZ, maxZ }, world metres, where bubbles may rise
//   toSurface  ( x, z ) => [ u, v ]: world to the lake material's coordinates
// update( dt, t, camera ) once per frame; t is the material clock (setTime).
// Event bus: an EventTarget. It emits bubbleBurst { x, z, radius }.

import * as THREE from 'three/webgpu';
import { positionLocal, positionView, normalView, vec3, float, mix, smoothstep, sin, uniform } from 'three/tsl';
import { valueNoise } from '../src/core/hash.js';
import { addRipple } from '../src/families/molten/ripples.js';

const MAX_BUBBLES = 8, MAX_BLOBS = 240, G = 9.8;

export function createLavaFx( { scene, height, bounds, toSurface } ) {

	const bus = new EventTarget();
	const clock = uniform( 0 );

	// The bubble skin: glowing through, brightest where it is thinnest (the
	// top, and facing the eye), dark and thick at the base and at grazing
	// view, with chilled grey flakes and cracks drifting over it.
	const skin = new THREE.MeshStandardNodeMaterial( { roughness: 0.3, metalness: 0 } );
	const q = positionLocal.mul( 7 ).add( vec3( clock.mul( 0.12 ), 0, clock.mul( 0.07 ) ) );
	const n = valueNoise( q.xz.add( q.y.mul( 0.7 ) ).add( 7.3 ) ).mul( 0.65 ).add( valueNoise( q.xz.mul( 2.3 ).add( q.y ).add( 1.1 ) ).mul( 0.35 ) );
	// Thin dark veins where the chilled skin wrinkles (the iso-line of a noise).
	const veins = float( 1 ).sub( smoothstep( 0.0, 0.035, n.sub( 0.5 ).abs() ) );
	const thin = smoothstep( 0.0, 0.95, positionLocal.y );
	const facing = normalView.dot( positionView.normalize().negate() ).clamp( 0, 1 );
	skin.colorNode = vec3( 0.08, 0.02, 0.015 );
	skin.emissiveNode = mix( vec3( 0.45, 0.03, 0.005 ), vec3( 0.95, 0.22, 0.025 ), thin.mul( facing ) )
		.mul( float( 1 ).sub( veins.mul( 0.8 ) ) ).mul( thin.mul( 2.4 ).add( 0.6 ) ).mul( facing.mul( 0.6 ).add( 0.4 ) );
	const dome = new THREE.SphereGeometry( 1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2 );
	const bubbles = new THREE.InstancedMesh( dome, skin, MAX_BUBBLES );

	// The blobs: hotter than the surface when thrown.
	// The blobs: a little hotter than the skin when thrown, darker as they
	// cool in the air (each one's age drives its brightness, below).
	const hot = new THREE.MeshStandardNodeMaterial( { roughness: 0.3 } );
	hot.colorNode = vec3( 0.1, 0.025, 0.015 );
	hot.emissiveNode = vec3( 0.9, 0.17, 0.02 ).mul( sin( positionLocal.y.mul( 5 ).add( clock.mul( 3 ) ) ).mul( 0.12 ).add( 1.2 ) );
	const blobs = new THREE.InstancedMesh( new THREE.SphereGeometry( 1, 14, 10 ), hot, MAX_BLOBS );

	for ( const m of [ bubbles, blobs ] ) {

		m.count = 0;
		m.frustumCulled = false;
		m.userData.noFocus = true; // the lens and the walk do not test them
		m.castShadow = m.receiveShadow = false;
		scene.add( m );

	}

	const live = [], flying = [];
	const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Sv = new THREE.Vector3(), P = new THREE.Vector3(), up = new THREE.Vector3( 0, 1, 0 ), dir = new THREE.Vector3();
	const ray = new THREE.Ray(), plane = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), - height ), aim = new THREE.Vector3();
	let wait = 0.5;
	const ease = ( k ) => k * k * ( 3 - 2 * k );

	// Where the camera looks on the lake, and how far from it to scatter.
	function spawnPoint( camera ) {

		camera.getWorldDirection( dir );
		ray.set( camera.position, dir );
		// The lake point under the gaze, at most 60 m out along it (looking at
		// the horizon, or up, the point straight ahead at that range).
		const hit = dir.y < - 0.01 ? ray.intersectPlane( plane, aim ) : null;
		const range = hit ? Math.min( 60, Math.hypot( hit.x - camera.position.x, hit.z - camera.position.z ) ) : 60;
		const h = Math.hypot( dir.x, dir.z ) || 1;
		const c = aim.set( camera.position.x + dir.x / h * range, height, camera.position.z + dir.z / h * range );
		const spread = THREE.MathUtils.clamp( Math.abs( camera.position.y - height ) * 4, 1.5, 45 );
		const a = Math.random() * Math.PI * 2, r = Math.sqrt( Math.random() ) * spread;
		return [ THREE.MathUtils.clamp( c.x + Math.cos( a ) * r, bounds.minX, bounds.maxX ), THREE.MathUtils.clamp( c.z + Math.sin( a ) * r, bounds.minZ, bounds.maxZ ) ];

	}

	function burst( b, t ) {

		const n = Math.round( 6 + b.R * 10 );
		for ( let i = 0; i < n && flying.length < MAX_BLOBS; i ++ ) {

			const a = Math.random() * Math.PI * 2, out = ( 0.4 + Math.random() * 1.4 ) * Math.sqrt( b.R ), upv = ( 1.2 + Math.random() * 2.6 ) * Math.sqrt( b.R );
			const r0 = b.R * ( 0.25 + Math.random() * 0.6 );
			flying.push( {
				p: new THREE.Vector3( b.x + Math.cos( a ) * r0, height + b.R * 0.5, b.z + Math.sin( a ) * r0 ),
				v: new THREE.Vector3( Math.cos( a ) * out, upv, Math.sin( a ) * out ),
				r: b.R * ( 0.04 + Math.random() * 0.07 ),
			} );

		}

		addRipple( ...toSurface( b.x, b.z ), t, b.R * 0.9 );
		bus.dispatchEvent( new CustomEvent( 'bubbleBurst', { detail: { x: b.x, z: b.z, radius: b.R } } ) );

	}

	bus.update = ( dt, t, camera ) => {

		dt = Math.min( dt, 0.1 );
		clock.value = t;
		wait -= dt;
		if ( wait <= 0 && live.length < MAX_BUBBLES ) {

			const [ x, z ] = spawnPoint( camera );
			// Bigger seen from higher up: metres from the room, a hand over it from a bee.
			const scale = THREE.MathUtils.clamp( Math.abs( camera.position.y - height ) / 3, 1, 3 );
			live.push( { x, z, t0: t, R: ( 0.25 + Math.random() ** 2 * 0.9 ) * scale, grow: 2 + Math.random() * 3, bursts: Math.random() < 0.7, ph: Math.random() * 6, end: null } );
			wait = ( 0.4 + Math.random() * 1.2 ) / Math.sqrt( scale ); // more of them over a wider view

		}

		// Bubbles: swell, wobble, then burst (gone) or sink back over a second.
		let n = 0;
		for ( let i = live.length - 1; i >= 0; i -- ) {

			const b = live[ i ];
			const k = Math.min( 1, ( t - b.t0 ) / b.grow );
			let s = ease( k );
			if ( k >= 1 && b.bursts ) { burst( b, t ); live.splice( i, 1 ); continue; }
			if ( k >= 1 ) {

				b.end ??= t;
				s = 1 - ( t - b.end );
				if ( s <= 0 ) { addRipple( ...toSurface( b.x, b.z ), t, b.R * 0.5 ); live.splice( i, 1 ); continue; }

			}

			const wob = 1 + Math.sin( t * 2.2 + b.ph ) * 0.05;
			Sv.set( b.R * Math.sqrt( s ) * wob, b.R * 1.05 * s / wob, b.R * Math.sqrt( s ) * wob );
			M.compose( P.set( b.x, height - b.R * 0.12, b.z ), Q.identity(), Sv );
			bubbles.setMatrixAt( n ++, M );

		}

		bubbles.count = n;
		bubbles.instanceMatrix.needsUpdate = true;

		// Blobs: heavy and slow (drag), stretched along their speed.
		n = 0;
		for ( let i = flying.length - 1; i >= 0; i -- ) {

			const f = flying[ i ];
			f.v.y -= G * dt;
			f.v.multiplyScalar( 1 - 0.6 * dt );
			f.p.addScaledVector( f.v, dt );
			if ( f.p.y < height ) { addRipple( ...toSurface( f.p.x, f.p.z ), t, f.r * 2.5 ); flying.splice( i, 1 ); continue; }
			const sp = f.v.length();
			Q.setFromUnitVectors( up, dir.copy( f.v ).divideScalar( Math.max( sp, 1e-6 ) ) );
			Sv.set( f.r, f.r * ( 1.3 + sp * 0.7 ), f.r ); // viscous: drawn out along its path
			M.compose( f.p, Q, Sv );
			blobs.setMatrixAt( n ++, M );

		}

		blobs.count = n;
		blobs.instanceMatrix.needsUpdate = true;

	};

	// A bubble at a given place (a demo, a test): radius R metres, swelling
	// for grow seconds, then bursting or sinking back.
	bus.spawn = ( x, z, R, grow = 3, bursts = true ) => { if ( live.length < MAX_BUBBLES ) live.push( { x, z, t0: clock.value, R, grow, bursts, ph: Math.random() * 6, end: null } ); };
	bus.bubbles = bubbles;
	bus.blobs = blobs;
	return bus;

}
