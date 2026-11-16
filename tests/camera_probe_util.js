// Shared pieces of tests/camera_probe.js: scene setup with an exact
// raycast, timing statistics, and the depth of field frame cost.

import * as THREE from 'three/webgpu';

export const DT = 1 / 60;
export const stats = ( a ) => {

	const s = [ ...a ].sort( ( x, y ) => x - y );
	const q = ( p ) => s[ Math.min( s.length - 1, Math.floor( p * s.length ) ) ];
	const mean = s.reduce( ( x, y ) => x + y, 0 ) / s.length; // the timer is coarse (0.1 ms): the mean resolves more
	return { median: + q( 0.5 ).toFixed( 4 ), mean: + mean.toFixed( 4 ), p99: + q( 0.99 ).toFixed( 4 ), max: + s[ s.length - 1 ].toFixed( 4 ), n: s.length };

};

export function setup( ix ) {

	const { renderer, scene, camera, kit } = ix;
	const controls = ix.controls;
	renderer.setAnimationLoop( null );
	const skinned = [];
	scene.traverse( ( o ) => { if ( o.isSkinnedMesh ) skinned.push( o ); } );
	// Pose the scene at time t as a frame would: matrices and bone palettes.
	const pose = ( t ) => {

		if ( ix.animate ) ix.animate( t );
		else ix.setTime?.( t );
		scene.updateMatrixWorld();
		for ( const m of skinned ) m.skeleton.update();

	};
	const visible = ( o ) => { for ( let p = o; p; p = p.parent ) if ( ! p.visible ) return false; return true; };
	const solid = ( o ) => o.isMesh && visible( o ) && ! o.userData.noFocus && ! o.userData.hairStrands && [ o.material ].flat().every( ( m ) => ! m?.positionNode || m.userData?.ixDisplaceMax ); // a displaced surface counts by its flat mesh (pad: its bound)
	const ray = new THREE.Raycaster();
	const exact = ( origin, dir ) => {

		ray.set( origin, dir );
		ray.near = 0;
		ray.far = Infinity;
		const hit = ray.intersectObjects( scene.children, true ).find( ( h ) => solid( h.object ) );
		return hit ? { distance: hit.distance, point: hit.point.clone(), name: hit.object.name || hit.object.type, normal: hit.face ? hit.face.normal.clone().transformDirection( hit.object.matrixWorld ) : null, pad: [ hit.object.material ].flat()[ 0 ]?.userData?.ixDisplaceMax?.() ?? 0 } : null;

	};
	const fwd = () => camera.getWorldDirection( new THREE.Vector3() );
	const place = ( pos, dir, targetDist ) => {

		camera.position.copy( pos );
		controls.target.copy( pos ).addScaledVector( dir, targetDist );
		camera.lookAt( controls.target );
		camera.updateMatrixWorld();

	};
	return { ix, renderer, scene, camera, controls, kit, pose, exact, fwd, place, skinned };

}

export async function dofCost( c, P, dir, frames ) {

	const { renderer, kit } = c;
	c.place( P.clone().addScaledVector( dir, - 0.3 ), dir, 0.3 );
	const nodeFrame = renderer._nodes.nodeFrame;
	const gl = renderer.backend.gl, device = renderer.backend.device;
	const px = new Uint8Array( 4 );
	const one = async () => {

		nodeFrame.update();
		const t0 = performance.now();
		if ( c.ix.draw ) c.ix.draw(); else await kit.renderAsync(); // the aquarium draws its own frame (waterline, then the kit's target post)
		if ( device ) await device.queue.onSubmittedWorkDone();
		else gl.readPixels( 0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px );
		return performance.now() - t0;

	};
	const run = async ( on ) => {

		kit.lens.enabled = on;
		for ( let i = 0; i < 30; i ++ ) kit.lens.update( 1 / 60 );
		for ( let i = 0; i < 6; i ++ ) await one();
		const t = [];
		for ( let i = 0; i < frames; i ++ ) t.push( await one() );
		return stats( t );

	};
	const size = renderer.getDrawingBufferSize( new THREE.Vector2() );
	const off1 = await run( false ), on = await run( true ), off2 = await run( false );
	return { size: `${ size.x }x${ size.y }`, off: off1, on, offAgain: off2 };

}
