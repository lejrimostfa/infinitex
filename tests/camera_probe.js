// In-page probe of the camera kit (src/camera), run by tests/camera_check.mjs.
// The page's render loop is stopped and every frame is driven by hand
// (dt = 1/60 s), so a hidden or headless tab gives the same numbers.
// Distances are checked with an exact three.js raycast (every triangle,
// skinned vertices posed by three), not with the kit's BVH (see setup in
// camera_probe_util.js).

import * as THREE from 'three/webgpu';
import { DT, stats, setup, dofCost } from './camera_probe_util.js';

// Walk forward (W held) into the surface at the screen centre.
export async function walkCheck( ix ) {

	const c = setup( ix );
	const { kit, camera, controls } = c;
	c.pose( 1.0 );
	const dir = c.fwd();
	const hit0 = c.exact( camera.position, dir );
	if ( ! hit0 ) return { error: 'nothing at the screen centre' };
	// Start at most 1 m from the surface, the orbit target 0.5 m ahead.
	const start = hit0.point.clone().addScaledVector( dir, - Math.min( 1, hit0.distance ) );
	c.place( start, dir, 0.5 );
	const key = ( type ) => dispatchEvent( new KeyboardEvent( type, { code: 'KeyW' } ) );
	key( 'keydown' );
	const times = [];
	let still = 0, frames = 0;
	for ( ; frames < 2000 && still < 30; frames ++ ) {

		const before = camera.position.clone();
		const t0 = performance.now();
		kit.walk.update( DT );
		times.push( performance.now() - t0 );
		still = camera.position.distanceTo( before ) < 1e-10 ? still + 1 : 0;

	}

	key( 'keyup' );
	camera.updateMatrixWorld();
	const end = c.exact( camera.position, dir );
	const out = { surface: hit0.name, startDist: + Math.min( 1, hit0.distance ).toFixed( 4 ), frames, stopDist: end ? end.distance : null, firstMs: + times[ 0 ].toFixed( 2 ), staticMs: stats( times.slice( 1 ) ) };

	// Same walk with the scene animated every frame (skinned characters move):
	// from 20 cm, 600 frames. The pose is set outside the timed call.
	if ( c.skinned.length ) {

		c.place( hit0.point.clone().addScaledVector( dir, - 0.2 ), dir, 0.5 );
		key( 'keydown' );
		const animTimes = [];
		let minDist = Infinity;
		for ( let i = 0; i < 600; i ++ ) {

			c.pose( 1.0 + i * DT );
			const t0 = performance.now();
			kit.walk.update( DT );
			animTimes.push( performance.now() - t0 );
			camera.updateMatrixWorld();
			if ( i % 20 === 19 ) { const h = c.exact( camera.position, dir ); if ( h ) minDist = Math.min( minDist, h.distance ); }

		}

		key( 'keyup' );
		out.animatedMs = stats( animTimes );
		out.animatedMinDist = minDist;

	}

	return out;

}

// Lens: the field of view at 1 m, 30 cm, 3 cm and back, then from a near
// surface to a far view; the focus ray cost; the depth of field frame cost.
export async function lensCheck( ix, { frames = 30 } = {} ) {

	const c = setup( ix );
	const { kit, camera } = c;
	const lens = kit.lens;
	if ( ! lens ) return { error: 'no lens' };
	lens.enabled = true;
	c.pose( 1.0 );
	const base = lens.baseFov;
	const dir = c.fwd();
	const hit = c.exact( camera.position, dir );
	if ( ! hit ) return { error: 'nothing at the screen centre' };
	const P = hit.point;
	const fovs = [];
	const lensTimes = [];
	const settle = ( n = 150 ) => {

		let maxStep = 0;
		for ( let i = 0; i < n; i ++ ) {

			const f0 = camera.fov;
			const t0 = performance.now();
			lens.update( DT );
			lensTimes.push( performance.now() - t0 );
			maxStep = Math.max( maxStep, Math.abs( camera.fov - f0 ) );
			fovs.push( camera.fov );

		}

		return { fov: + camera.fov.toFixed( 3 ), maxStep: + maxStep.toFixed( 3 ) };

	};
	// The orbit target sits 2 m beyond, so the fov can only come from the centre ray.
	const at = ( D, n ) => { c.place( P.clone().addScaledVector( dir, - D ), dir, D + 2 ); return settle( n ); };
	const out = { baseFov: base, surface: hit.name };
	out.at1m = at( 1 );
	out.at30cm = at( 0.3 );
	out.at3cm = at( 0.03 );
	out.back1m = at( 1, 300 );
	at( 0.03 );
	// From the near surface to a far view: the direction among a few whose
	// centre ray goes farthest (or hits nothing).
	const cands = [ dir.clone().negate(), new THREE.Vector3( 0, 1, 0 ), new THREE.Vector3( 0, - 1, 0 ), new THREE.Vector3( 1, 0.3, 0 ).normalize(), new THREE.Vector3( - 1, 0.3, 0 ).normalize(), new THREE.Vector3( 0, 0.3, 1 ).normalize() ];
	// A real far object (hit beyond 30 cm) is preferred to empty sky.
	let far = null, farD = - 1;
	for ( const d of cands ) { const h = c.exact( camera.position, d ); if ( h && h.distance > 0.3 && h.distance > farD ) { farD = h.distance; far = d; } }
	if ( ! far ) { far = cands[ 0 ]; farD = 1e9; }
	c.place( camera.position.clone(), far, 1 );
	out.nearToFar = { ...settle( 300 ), farDist: farD >= 1e9 ? 'nothing' : + farD.toFixed( 3 ) };
	out.lensMs = stats( lensTimes );

	// Depth of field cost: same view (30 cm), lens on then off. Each frame
	// waits for the GPU (queue done on WebGPU, a pixel read on WebGL2).
	out.dofMs = kit.lens.hasDof && ( kit.post || kit.options.dof ) ? await dofCost( c, P, dir, frames ) : 'no depth of field on this page';
	lens.enabled = false;
	return out;

}

// Plain load (no ?dof in an automated browser): the lens stays off and the
// field of view stays the page's own, even 3 cm from a surface.
export function plainCheck( ix ) {

	const c = setup( ix );
	const { kit, camera, controls } = c;
	c.pose( 1.0 );
	const base = camera.fov;
	const dir = c.fwd();
	const keep = { p: camera.position.clone(), t: controls.target.clone() };
	const hit = c.exact( camera.position, dir );
	if ( hit ) c.place( hit.point.clone().addScaledVector( dir, - 0.03 ), dir, 0.03 );
	for ( let i = 0; i < 120; i ++ ) kit.update( DT, { move: false } );
	const out = { lensOn: kit.lens ? kit.lens.enabled : 'no lens', fov: camera.fov, base };
	camera.position.copy( keep.p );
	controls.target.copy( keep.t );
	camera.lookAt( keep.t );
	camera.updateMatrixWorld();
	return out;

}
