// In-page probe of the approach rules (src/camera/approach.js, walk.js),
// run by tests/camera_check.mjs. Frames are driven by hand (dt = 1/60 s).
//   keys    felt zoom while walking in: d ln( magnification ) / dt, with
//           magnification = 1 / ( distance * tan( fov / 2 ) ). It must stay
//           in a band from 1 m down to 3 times the stop distance (it used
//           to jump 4x near the end).
//   wheel   the orbit pivot is put up to 3 m behind the surface: the zoom must
//           not go through, and each wheel step must magnify by about the
//           same factor far and near.
//   orbit   1 mm from the surface, the pivot 5 cm behind it, drag up then
//           down: no frame may cross a surface (exact ray between positions).

import * as THREE from 'three/webgpu';
import { DT, setup } from './camera_probe_util.js';

export async function approachCheck( ix ) {

	const c = setup( ix );
	const { kit, camera, controls, renderer } = c;
	const el = renderer.domElement, r = el.getBoundingClientRect();
	const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
	c.pose( 1.0 );
	const dir = c.fwd();
	const hit0 = c.exact( camera.position, dir );
	if ( ! hit0 ) return { error: 'nothing at the screen centre' };
	const P = hit0.point.clone(), n = hit0.normal ?? dir.clone().negate();
	const h = () => { camera.updateMatrixWorld(); return c.exact( camera.position, c.fwd() )?.distance ?? Infinity; };
	const logM = () => - Math.log( h() ) - Math.log( Math.tan( THREE.MathUtils.degToRad( camera.fov ) / 2 ) );
	const settle = ( k = 40 ) => { for ( let i = 0; i < k; i ++ ) kit.update( DT ); };
	const out = {};

	// Keys: from 1 m, felt rate every 0.25 s while 1 m > distance > 0.3 mm.
	c.place( P.clone().addScaledVector( dir, - 1 ), dir, 0.5 );
	settle();
	dispatchEvent( new KeyboardEvent( 'keydown', { code: 'KeyW' } ) );
	const samples = [];
	let prev = logM();
	for ( let i = 1; i <= 60 * 20; i ++ ) {

		kit.update( DT );
		if ( i % 15 ) continue;
		const d = h(), m = logM();
		samples.push( [ d, ( m - prev ) / ( 15 * DT ) ] );
		prev = m;

	}

	dispatchEvent( new KeyboardEvent( 'keyup', { code: 'KeyW' } ) );
	// Before the gentle stop: farther than 3 times the stop distance.
	const stopAt = h(), felt = samples.filter( ( [ d ] ) => d < 0.9 && d > 3 * stopAt ).map( ( [ , v ] ) => v );
	out.keysFelt = { min: Math.min( ...felt ), max: Math.max( ...felt ), n: felt.length, stopAt };

	// Wheel: pivot up to 3 m behind the surface, 160 steps in at the screen centre.
	c.place( P.clone().addScaledVector( dir, - 1 ), dir, Math.min( 4, controls.maxDistance * 0.8 ) ); // pivot behind the surface, inside maxDistance
	settle();
	const steps = [];
	let crossed = false, minD = Infinity, last = logM();
	for ( let k = 0; k < 160; k ++ ) {

		el.dispatchEvent( new WheelEvent( 'wheel', { deltaY: - 100, clientX: cx, clientY: cy, bubbles: true, cancelable: true } ) );
		settle( 20 );
		const d = h();
		if ( ! ( d < 1.5 ) ) { crossed = true; break; }
		minD = Math.min( minD, d );
		const m = logM();
		if ( k > 0 ) steps.push( [ d, Math.exp( m - last ) ] );
		last = m;

	}

	const wsteps = steps.filter( ( [ d ] ) => d > 3 * minD ).map( ( [ , v ] ) => v );
	out.wheel = { crossed, minDist: minD, stepMin: Math.min( ...wsteps ), stepMax: Math.max( ...wsteps ) };

	// Orbit: 1 mm off the surface, looking at it at 45 degrees, pivot behind.
	const side = new THREE.Vector3().crossVectors( n, Math.abs( n.y ) < 0.9 ? new THREE.Vector3( 0, 1, 0 ) : new THREE.Vector3( 1, 0, 0 ) ).normalize();
	const look = n.clone().negate().add( side ).normalize();
	// A crossing: the exact ray from one frame's position to the next meets a
	// surface. Also the closest distance seen along the view and along -n.
	out.orbit = [];
	for ( const dy of [ - 8, 8 ] ) {

		c.place( P.clone().addScaledVector( n, 0.001 ), look, 0.05 );
		settle( 10 );
		let crossings = 0;
		const last = camera.position.clone();
		const step = ( k ) => {

			for ( let i = 0; i < k; i ++ ) {

				kit.update( DT );
				const seg = camera.position.clone().sub( last ), len = seg.length();
				if ( len > 1e-12 ) { const e = c.exact( last, seg.divideScalar( len ) ); if ( e && e.distance < len ) crossings ++; }
				last.copy( camera.position );

			}

		};
		const ev = ( type, y ) => new PointerEvent( type, { pointerId: 1, clientX: cx, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, isPrimary: true, pointerType: 'mouse' } );
		el.dispatchEvent( ev( 'pointerdown', cy ) );
		for ( let k = 1; k <= 60; k ++ ) {

			const before = camera.position.clone();
			el.dispatchEvent( ev( 'pointermove', cy + k * dy ) ); // OrbitControls moves the camera here
			const seg = camera.position.clone().sub( before ), len = seg.length();
			if ( len > 1e-12 ) { const e = c.exact( before, seg.divideScalar( len ) ); if ( e && e.distance < len ) crossings ++; }
			last.copy( camera.position );
			step( 3 );

		}

		el.dispatchEvent( ev( 'pointerup', cy + 60 * dy ) );
		step( 90 );
		out.orbit.push( crossings );

	}

	return out;

}
