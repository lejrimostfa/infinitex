// The waterline on a pane of glass: an aquarium wall, or the port of a
// camera half in the water. The scene is drawn twice, once as seen from
// the air (waterBody.eyeUnder = 0) and once from the water (= 1); each
// pixel takes one or the other by where its ray crosses the glass.
//   glass     a vertical pane z = glassZ (world), x and y bounds; rays
//             that miss it see the air pass (over the rim of the tank)
//   lens      a port lensD in front of the camera (lens: true): every
//             ray crosses it, so the frame splits along the waterline
//   level     the still level plus the ripples at that point, so the
//             line moves. True height by default (calm water: a few mm);
//             `boost` > 1 for a choppy sea slapping the glass
//   meniscus  core/meniscus.js, from the surface tension and the wall:
//             a film climbing glass (about 3 mm, concave), or on a pane
//             the water does not wet a convex edge dipping at it.
//             Just under it, the surface seen from below mirrors (total
//             internal reflection): the silver band of every aquarium,
//             drawn by the water pass itself.
// render() draws to the screen; tone mapping comes with the final quad.

import { RenderTarget, HalfFloatType, QuadMesh, NodeMaterial, Matrix4, Vector2, Vector3 } from 'three/webgpu';
import { vec2, vec3, vec4, float, uniform, texture, uv, mix, step, sign } from 'three/tsl';
import { waterBody } from './underwater.js';
import { ixTime } from './clock.js';
import { surfaceWaves } from './watersurface.js';
import { refractSurface, refractPlane, refractOff } from './refraction.js';
import { WALL_CONTACT, meniscusHeight, capillaryLength, wettingFilm, dippingBead } from './meniscus.js';

export { WALL_CONTACT, meniscusHeight } from './meniscus.js';

// meniscus: signed height (m), > 0 climbs, < 0 dips; by default from
// tension and contactDeg (the wall, core/meniscus.js). reach: how far
// the scene mirrored by a dipping edge lies (m).
export function createWaterline( renderer, scene, camera, { lens = false, glassZ = 0, xMin = - 1, xMax = 1, yMin = 0, yMax = 1, lensD = 0.03, tension = 0.072, contactDeg = WALL_CONTACT.glass, meniscus = meniscusHeight( { tension, contactDeg } ), reach = 0.5, boost = 1, power = 5, prepare = null } = {}, W = waterBody ) {

	const size = renderer.getDrawingBufferSize( new Vector2() );
	const opts = { type: HalfFloatType };
	const fwd = new Vector3(), port = new Vector3(), paneN = new Vector3(), paneP = new Vector3();
	const rtA = new RenderTarget( size.x, size.y, opts ), rtB = new RenderTarget( size.x, size.y, opts );
	const projInv = uniform( new Matrix4() ), camWorld = uniform( new Matrix4() ), camPos = uniform( new Vector3() ), viewProj = uniform( new Matrix4() );

	// The pixel's ray in the world.
	const s = uv();
	const ndc = vec4( s.x.mul( 2 ).sub( 1 ), s.y.mul( 2 ).sub( 1 ).negate(), 0.5, 1 );
	const vp = projInv.mul( ndc );
	const dir = camWorld.mul( vec4( vp.xyz.div( vp.w ), 0 ) ).xyz.normalize();
	// Where it crosses the interface.
	let G, hit;
	if ( lens ) {

		G = camPos.add( dir.mul( lensD ) );
		hit = float( 1 );

	} else {

		const t = float( glassZ ).sub( camPos.z ).div( dir.z );
		G = camPos.add( dir.mul( t.max( 0 ) ) );
		hit = step( 0, t ).mul( step( xMin, G.x ) ).mul( step( G.x, xMax ) ).mul( step( yMin, G.y ) ).mul( step( G.y, yMax ) );

	}

	const tt = ixTime.mul( W.speed );
	// The same sea as the surface mesh, so the line meets its edge.
	const wf = surfaceWaves( vec2( G.x, G.z ), float( 1e-5 ), W );
	const waterY = W.level.add( wf.h.div( W.depthScale ).mul( boost ) );
	// The meniscus (core/meniscus.js): a film climbing the pane, or a
	// convex edge dipping at it. Off the pane, the eye's side.
	const h = Math.max( Math.abs( meniscus ), 1e-5 );
	const wallN = lens ? camWorld.mul( vec4( 0, 0, 1, 0 ) ).xyz.normalize() : vec3( 0, 0, sign( camPos.z.sub( glassZ ) ) );
	const men = meniscus >= 0
		? wettingFilm( { s, G, hit, waterY, wf, tt, rtB, h, power } )
		: dippingBead( { s, G, dir, hit, waterY, rtA, rtB, h, lc: capillaryLength( tension ), wallN, viewProj, reach } );
	const under = men.under.add( float( 1 ).sub( hit ).mul( step( camPos.y, W.level ) ) );
	const A = texture( rtA.texture, s ).rgb;
	const B = texture( rtB.texture, s ).rgb;
	let col = men.shade( mix( A, B, under ) );
	// The glass itself: a faint green tint and a few percent of reflection.
	col = mix( col, col.mul( vec3( 0.93, 0.98, 0.96 ) ), hit.mul( lens ? 0 : 1 ) );

	const mat = new NodeMaterial();
	mat.fragmentNode = vec4( col, 1 );
	const quad = new QuadMesh( mat );

	return {
		rtA, rtB,
		setSize( w, h ) { rtA.setSize( w, h ); rtB.setSize( w, h ); },
		render() {

			camera.updateMatrixWorld();
			projInv.value.copy( camera.projectionMatrixInverse );
			camWorld.value.copy( camera.matrixWorld );
			camPos.value.copy( camera.position );
			viewProj.value.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse );
			const prev = W.eyeUnder.value, y = camera.position.y, L = W.level.value;
			// Lens: the port reaches 3 cm ahead, so it can dip in while the
			// camera is still above (or the reverse). The air pass always
			// sees from above the surface, the water pass from under it,
			// else the surface itself would hide that side (a grey mirror).
			const side = ( above ) => {

				if ( ! lens ) return;
				camera.position.y = above ? Math.max( y, L + 0.006 ) : Math.min( y, L - 0.006 );
				camera.updateMatrixWorld();

			};
			// prepare( camera ): the app's mirrors, before each pass.
			// Refraction (core/refraction.js): the air pass sees the water
			// through its surface when the eye is above it; the water pass
			// through the pane, or through the port 3 cm ahead of the lens.
			side( true ); W.eyeUnder.value = 0; prepare?.( camera );
			if ( camera.position.y > L ) refractSurface( camera.position, L ); else refractOff();
			renderer.setRenderTarget( rtA ); renderer.render( scene, camera );
			side( false ); W.eyeUnder.value = 1; prepare?.( camera );
			if ( lens ) {

				camera.getWorldDirection( fwd );
				refractPlane( camera.position, port.copy( camera.position ).addScaledVector( fwd, lensD ), fwd.negate() );

			} else refractPlane( camera.position, paneP.set( 0, 0, glassZ ), paneN.set( 0, 0, Math.sign( camera.position.z - glassZ ) || 1 ) );
			renderer.setRenderTarget( rtB ); renderer.render( scene, camera );
			refractOff();
			camera.position.y = y; camera.updateMatrixWorld();
			W.eyeUnder.value = prev;
			renderer.setRenderTarget( null );
			quad.render( renderer );

		},
	};

}
