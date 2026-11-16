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
//   meniscus  water climbs the glass by capillarity. Its height comes from
//             the surface tension and the wall (meniscusHeight below):
//             about 3 mm on ordinary glass, 1 mm on acrylic. Through it: total internal reflection on the curved
//             surface, so the world under the water, inverted and
//             squeezed, bright; a bright rim at the top, a dark contact
//             line at the foot.
//             Just under it, the surface seen from below mirrors (total
//             internal reflection): the silver band of every aquarium,
//             drawn by the water pass itself.
// render() draws to the screen; tone mapping comes with the final quad.

import { RenderTarget, HalfFloatType, QuadMesh, NodeMaterial, Matrix4, Vector2, Vector3 } from 'three/webgpu';
import { vec2, vec3, vec4, float, uniform, texture, uv, smoothstep, mix, exp, step, sign, dFdy } from 'three/tsl';
import { waterBody } from './underwater.js';
import { ixTime } from './clock.js';
import { valueNoise } from './hash.js';
import { surfaceWaves } from './watersurface.js';

// Contact angle of water on a wall (degrees). Small: the water wets the
// wall and climbs high. Typical lab values; dirt and grease raise them.
export const WALL_CONTACT = { cleanGlass: 10, glass: 25, acrylic: 70 };

// Height (m) the water climbs a flat vertical wall. Capillary length
// lc = sqrt( tension / ( density g ) ), 2.7 mm for water at 20 C. The
// exact solution for a plane wall: h = lc sqrt( 2 ( 1 - sin theta ) ).
// tension N/m (0.072 water, about 0.05 with soap or oil on it), density
// kg/m3. A wall the water does not wet (theta 90 or more) makes it dip
// instead: not drawn here, so it gives 0.
export function meniscusHeight( { tension = 0.072, contactDeg = WALL_CONTACT.glass, density = 998, g = 9.81 } = {} ) {

	const lc = Math.sqrt( tension / ( density * g ) );
	const th = Math.min( contactDeg, 90 ) * Math.PI / 180;
	return lc * Math.sqrt( 2 * ( 1 - Math.sin( th ) ) );

}

// meniscus: height (m); by default from tension and contactDeg (the wall).
export function createWaterline( renderer, scene, camera, { lens = false, glassZ = 0, xMin = - 1, xMax = 1, yMin = 0, yMax = 1, lensD = 0.03, tension = 0.072, contactDeg = WALL_CONTACT.glass, meniscus = meniscusHeight( { tension, contactDeg } ), boost = 1, power = 5, prepare = null } = {}, W = waterBody ) {

	const size = renderer.getDrawingBufferSize( new Vector2() );
	const opts = { type: HalfFloatType };
	const rtA = new RenderTarget( size.x, size.y, opts ), rtB = new RenderTarget( size.x, size.y, opts );
	const projInv = uniform( new Matrix4() ), camWorld = uniform( new Matrix4() ), camPos = uniform( new Vector3() );

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
	// Height over the water line, in meniscus heights: < 0 under water,
	// 0..1 the film climbing the glass, > 1 dry glass.
	const m = G.y.sub( waterY ).div( meniscus );
	const under = smoothstep( 1.05, 0.95, m ).mul( hit ).add( float( 1 ).sub( hit ).mul( step( camPos.y, W.level ) ) );

	const A = texture( rtA.texture, s ).rgb;
	const B = texture( rtB.texture, s ).rgb;
	let col = mix( A, B, under );
	// The meniscus (0 < m < 1). A ray through the glass there enters the
	// wedge of water stuck to the pane and meets the curved water surface
	// from below, nearly grazing: total internal reflection. It turns down
	// into the water. So the film shows the world under the water,
	// upside down, squeezed by the curved mirror (more and more toward the
	// top, where the surface turns vertical), and bright: a total
	// reflection loses no light. A mirror does not split colours. The
	// ripples and a slow drift along the line make the squeeze uneven.
	const along = vec2( G.x.add( G.z ).div( 0.012 ), tt.mul( 0.15 ) ).add( 300 );
	const nz = valueNoise( along );
	const dmdv = dFdy( m ).div( dFdy( s.y ) );
	const dm = dmdv.abs().max( 1e-3 ).mul( sign( dmdv ).add( 0.001 ).sign() );
	const mm = m.clamp( 0, 1 );
	const F = float( power ).mul( mm.mul( 2 ).add( 1 ) ).mul( nz.mul( 0.5 ).add( 0.75 ).add( wf.slope.y.mul( 2 ) ) );
	const mSrc = mm.mul( F ).negate(); // mirrored under the line
	const sM = vec2( s.x.add( wf.slope.x.mul( 0.01 ) ), s.y.add( mSrc.sub( m ).div( dm ) ) ).clamp( 0.001, 0.999 );
	const film = texture( rtB.texture, sM ).rgb.mul( 1.15 ).add( vec3( 0.04, 0.06, 0.06 ) );
	const filmW = smoothstep( - 0.02, 0.08, m ).mul( smoothstep( 1.0, 0.9, m ) ).mul( hit );
	col = mix( col, film, filmW );
	// Light: a bright rim at the top, where the surface turns vertical and
	// lets the sky in; a dark hairline at the foot, the contact line where
	// the curvature flips and sends the rays away from the eye.
	const rim = exp( m.sub( 0.94 ).div( 0.05 ).pow( 2 ).negate() ).mul( hit );
	const foot = exp( m.div( 0.05 ).pow( 2 ).negate() ).mul( hit );
	col = col.mul( float( 1 ).sub( foot.mul( 0.45 ) ) ).add( vec3( 0.85, 0.92, 1.0 ).mul( rim.mul( 0.7 ) ) );
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
			side( true ); W.eyeUnder.value = 0; prepare?.( camera ); renderer.setRenderTarget( rtA ); renderer.render( scene, camera );
			side( false ); W.eyeUnder.value = 1; prepare?.( camera ); renderer.setRenderTarget( rtB ); renderer.render( scene, camera );
			camera.position.y = y; camera.updateMatrixWorld();
			W.eyeUnder.value = prev;
			renderer.setRenderTarget( null );
			quad.render( renderer );

		},
	};

}
