// A planar mirror at a horizontal level, for water seen from above or from
// below. three's reflector cuts the scene with an oblique near plane, which
// assumes a standard depth buffer; with a reversed depth buffer (the demos,
// for microns to metres) it cuts everything away. So: a mirrored camera
// (position, view and up reflected through the plane, as a lookAt camera,
// hence the flipped x) and a real clipping plane on a ClippingGroup that
// holds the scene's content. side +1: the mirror seen from above shows what
// is above the level; side -1: seen from below, what is below it.
// sample( offset ) gives the mirror colour at this pixel, offset in screen
// UV (ripples). render( renderer, camera ) before the frame that uses it.

import { RenderTarget, HalfFloatType, PerspectiveCamera, Plane, Vector2, Vector3 } from 'three/webgpu';
import { texture, screenUV } from 'three/tsl';

export function createMirror( { group, level, side = 1, resolutionScale = 0.5, hide = [] } ) {

	const rt = new RenderTarget( 1, 1, { type: HalfFloatType } );
	const cam = new PerspectiveCamera();
	const plane = new Plane( new Vector3( 0, side, 0 ), - side * level );
	const size = new Vector2(), fwd = new Vector3(), up = new Vector3(), target = new Vector3();
	const map = texture( rt.texture );

	return {
		rt,
		sample: ( offset ) => texture( rt.texture, screenUV.flipX().add( offset ) ),
		map,
		// Renders when the camera is on the mirror's side; else keeps the
		// last image (it is not seen).
		render( renderer, camera ) {

			if ( Math.sign( camera.position.y - level ) !== side ) return;
			renderer.getDrawingBufferSize( size );
			const w = Math.max( 1, Math.floor( size.x * resolutionScale ) ), h = Math.max( 1, Math.floor( size.y * resolutionScale ) );
			if ( rt.width !== w || rt.height !== h ) rt.setSize( w, h );
			cam.copy( camera );
			cam.position.y = 2 * level - camera.position.y;
			camera.getWorldDirection( fwd );
			fwd.y = - fwd.y;
			up.copy( camera.up ).applyQuaternion( camera.quaternion );
			up.y = - up.y;
			cam.up.copy( up );
			cam.lookAt( target.copy( cam.position ).add( fwd ) );
			cam.updateMatrixWorld();
			for ( const o of hide ) o.visible = false;
			const prevPlanes = group.clippingPlanes, prevRT = renderer.getRenderTarget();
			group.clippingPlanes = [ plane ];
			renderer.setRenderTarget( rt );
			renderer.render( group.parent ?? group, cam );
			renderer.setRenderTarget( prevRT );
			group.clippingPlanes = prevPlanes;
			for ( const o of hide ) o.visible = true;

		},
	};

}
