// The waterline on a pane of glass: an aquarium wall, or the port of a
// camera half in the water. The scene is drawn twice, once as seen from
// the air (waterBody.eyeUnder = 0) and once from the water (= 1); each
// pixel takes one or the other by where its ray crosses the glass.
//   glass     a vertical pane z = glassZ (world), x and y bounds; rays
//             that miss it see the air pass (over the rim of the tank)
//   panes     or several panes of one tank: [ { axis: 'x' | 'z', at,
//             min, max (along the other axis), out: 1 | -1 (the side of
//             the air) } ]. The eye sees two of them at most (a corner):
//             each gets its own water pass, bent at its own plane, and
//             a pixel takes the pane its ray enters first. One pane in
//             view costs what it did; a corner costs one more pass.
//   glass     { thickness (m), ior } of the panes: what is behind comes
//             nearer by thickness ( 1 - 1 / ior ) (core/refraction.js).
//             The pane itself (edges, reflections) is the page's mesh
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
// compose() draws the same picture into a target with a depth buffer
// (rtC): each pixel keeps the depth of the pass it took. A page that
// adds depth-based effects after the waterline (ambient occlusion, depth
// of field: src/camera/targetpost.js) reads rtC instead of calling render().

import { RenderTarget, DepthTexture, HalfFloatType, AlwaysDepth, QuadMesh, NodeMaterial, Matrix4, Vector2, Vector3 } from 'three/webgpu';
import { vec2, vec3, vec4, float, uniform, texture, uv, mix, step, sign } from 'three/tsl';
import { waterBody } from './underwater.js';
import { ixTime } from './clock.js';
import { surfaceWaves } from './watersurface.js';
import { underwaterLens } from './underlens.js';
import { refractSurface, refractPlane, refractOff } from './refraction.js';
import { WALL_CONTACT, meniscusHeight, capillaryLength, wettingFilm, dippingBead } from './meniscus.js';

export { WALL_CONTACT, meniscusHeight } from './meniscus.js';

// meniscus: signed height (m), > 0 climbs, < 0 dips; by default from
// tension and contactDeg (the wall, core/meniscus.js). reach: how far
// the scene mirrored by a dipping edge lies (m).
export function createWaterline( renderer, scene, camera, { lens = false, glassZ = 0, xMin = - 1, xMax = 1, panes = [ { axis: 'z', at: glassZ, min: xMin, max: xMax, out: 0 } ], yMin = 0, yMax = 1, lensD = 0.03, glass = null, tension = 0.072, contactDeg = WALL_CONTACT.glass, meniscus = meniscusHeight( { tension, contactDeg } ), reach = 0.5, boost = 1, power = 5, prepare = null } = {}, W = waterBody ) {

	const size = renderer.getDrawingBufferSize( new Vector2() );
	const opts = { type: HalfFloatType };
	const fwd = new Vector3(), port = new Vector3(), paneP = new Vector3();
	const target = () => new RenderTarget( size.x, size.y, { ...opts, depthTexture: new DepthTexture( size.x, size.y ) } );
	const rtA = target(), rtB = target(), rtC = target();
	const rtB2 = ! lens && panes.length > 1 ? target() : null; // the second pane of a corner
	// The two panes in view: normal toward the eye, n . P on the plane, the
	// axis along the pane and its bounds, and whether the slot is in use.
	const slot = [ 0, 1 ].map( () => ( { n: uniform( new Vector3( 0, 0, 1 ) ), at: uniform( 0 ), along: uniform( new Vector3( 1, 0, 0 ) ), min: uniform( - 1 ), max: uniform( 1 ), on: uniform( 0 ) } ) );
	const aspect = uniform( size.x / size.y );
	const projInv = uniform( new Matrix4() ), camWorld = uniform( new Matrix4() ), camPos = uniform( new Vector3() ), viewProj = uniform( new Matrix4() );

	// The pixel's ray in the world.
	const s = uv();
	const ndc = vec4( s.x.mul( 2 ).sub( 1 ), s.y.mul( 2 ).sub( 1 ).negate(), 0.5, 1 );
	const vp = projInv.mul( ndc );
	const dir = camWorld.mul( vec4( vp.xyz.div( vp.w ), 0 ) ).xyz.normalize();
	// Where it crosses the interface.
	let G, hit, second = float( 0 ), paneN = vec3( 0, 0, 1 );
	if ( lens ) {

		G = camPos.add( dir.mul( lensD ) );
		hit = float( 1 );

	} else {

		const cross = ( p ) => {

			const t = p.at.sub( p.n.dot( camPos ) ).div( p.n.dot( dir ) );
			const g = camPos.add( dir.mul( t.max( 0 ) ) ), u = p.along.dot( g );
			return { t, g, hit: p.on.mul( step( 0, t ) ).mul( step( p.min, u ) ).mul( step( u, p.max ) ).mul( step( yMin, g.y ) ).mul( step( g.y, yMax ) ) };

		};
		const c0 = cross( slot[ 0 ] ), c1 = cross( slot[ 1 ] );
		// A ray may cross both rectangles (in by one pane, out by the
		// other): the nearer one is the pane it looks through.
		second = c1.hit.mul( float( 1 ).sub( c0.hit.mul( step( c0.t, c1.t ) ) ) );
		G = mix( c0.g, c1.g, second );
		hit = c0.hit.max( c1.hit );
		paneN = mix( slot[ 0 ].n, slot[ 1 ].n, second );

	}

	// The water pass of the pane the pixel looks through.
	const sampleB = ( q ) => rtB2 ? mix( texture( rtB.texture, q ).rgb, texture( rtB2.texture, q ).rgb, second ) : texture( rtB.texture, q ).rgb;

	const tt = ixTime.mul( W.speed );
	// The same sea as the surface mesh, so the line meets its edge.
	const wf = surfaceWaves( vec2( G.x, G.z ), float( 1e-5 ), W );
	const waterY = W.level.add( wf.h.div( W.depthScale ).mul( boost ) );
	// The meniscus (core/meniscus.js): a film climbing the pane, or a
	// convex edge dipping at it. Off the pane, the eye's side.
	const h = Math.max( Math.abs( meniscus ), 1e-5 );
	const wallN = lens ? camWorld.mul( vec4( 0, 0, 1, 0 ) ).xyz.normalize() : paneN;
	const men = meniscus >= 0
		? wettingFilm( { s, G, hit, waterY, wf, tt, rtB, sampleB, h, power } )
		: dippingBead( { s, G, dir, hit, waterY, rtA, rtB, sampleB, h, lc: capillaryLength( tension ), wallN, viewProj, reach } );
	const under = men.under.add( float( 1 ).sub( hit ).mul( step( camPos.y, W.level ) ) );
	const A = texture( rtA.texture, s ).rgb;
	// A camera port: the water side is seen by an eye in the water
	// (core/underlens.js: sway, softness, vignette).
	// Through an aquarium pane the eye is in the air: the plain pass.
	const B = lens ? underwaterLens( rtB.texture, s, ixTime, { amount: W.lens, tint: W.inscatter, aspect } ) : sampleB( s );
	let col = men.shade( mix( A, B, under ) );
	// The glass itself: a faint green tint and a few percent of reflection.
	col = mix( col, col.mul( vec3( 0.93, 0.98, 0.96 ) ), hit.mul( lens ? 0 : 1 ) );

	const mat = new NodeMaterial();
	mat.fragmentNode = vec4( col, 1 );
	const quad = new QuadMesh( mat );
	// The same picture with its depth, for compose().
	const matC = new NodeMaterial();
	matC.fragmentNode = vec4( col, 1 );
	matC.depthNode = mix( texture( rtA.depthTexture, s ).r, rtB2 ? mix( texture( rtB.depthTexture, s ).r, texture( rtB2.depthTexture, s ).r, second ) : texture( rtB.depthTexture, s ).r, under.clamp( 0, 1 ) );
	matC.depthFunc = AlwaysDepth;
	const quadC = new QuadMesh( matC );

	return {
		rtA, rtB, rtC,
		setSize( w, h ) { rtA.setSize( w, h ); rtB.setSize( w, h ); rtB2?.setSize( w, h ); rtC.setSize( w, h ); aspect.value = w / h; },
		render() { this.passes(); renderer.setRenderTarget( null ); quad.render( renderer ); },
		// Colour and depth into rtC, linear (no tone mapping).
		compose() { this.passes(); renderer.setRenderTarget( rtC ); quadC.render( renderer ); renderer.setRenderTarget( null ); return rtC; },
		// The two scene passes, into rtA (air) and rtB (water).
		passes() {

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

				renderer.setRenderTarget( rtB ); renderer.render( scene, camera );

			} else {

				// The panes whose air side holds the eye, two at most. None
				// (the eye behind its only pane): that pane, from its side.
				let seen = panes.filter( ( p ) => p.out && ( camera.position[ p.axis ] - p.at ) * p.out > 0 ).slice( 0, rtB2 ? 2 : 1 );
				if ( ! seen.length ) seen = [ panes[ 0 ] ];
				slot.forEach( ( u, i ) => {

					const p = seen[ i ];
					u.on.value = p ? 1 : 0;
					if ( ! p ) return;
					const sg = p.out || Math.sign( camera.position[ p.axis ] - p.at ) || 1;
					if ( p.axis === 'z' ) { u.n.value.set( 0, 0, sg ); u.along.value.set( 1, 0, 0 ); paneP.set( 0, 0, p.at ); } else { u.n.value.set( sg, 0, 0 ); u.along.value.set( 0, 0, 1 ); paneP.set( p.at, 0, 0 ); }
					u.at.value = sg * p.at; u.min.value = p.min; u.max.value = p.max;
					refractPlane( camera.position, paneP, u.n.value, glass );
					renderer.setRenderTarget( i ? rtB2 : rtB ); renderer.render( scene, camera );

				} );

			}

			refractOff();
			camera.position.y = y; camera.updateMatrixWorld();
			W.eyeUnder.value = prev;

		},
	};

}
