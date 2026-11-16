// The surface of a body of water (waterBody, core/underwater.js), seen
// from both sides. Unlit material on a horizontal plane at the water level.
//   ripples    the same wave field as the caustics below (one sea for
//              both), so every bright line on the floor sits under a lens
//   above      Fresnel (2 % face on, all at grazing): a planar mirror of
//              the scene (walls, posts, sky), pushed by the ripples, mixed
//              with the scene below, read from the screen and pushed by the
//              slope (refraction)
//   below      Snell's window: light from the air reaches the eye only
//              inside a cone of about 97.5 degrees (48.75 each side of
//              vertical, for n = 1.33).
//              Inside it, the sky and the shore, wobbling (read from the
//              screen behind the surface: not squeezed into the cone, a
//              cheap stand-in); outside, total internal reflection: a
//              planar mirror of the pool, rippled.
//   shape      the plane is displaced by the same waves (vertex stage,
//              waves shorter than the mesh spacing faded out), so its edge
//              on a pane follows the meniscus (core/waterline.js) instead
//              of reading as a flat plate under it. Give it segments.
//   refraction through a pane or a port, bent like the matter behind it
// mirrors: { up, down } from core/mirror.js, rendered by the app.
// sky(dir) is the app's sky (the same function draws the background), so
// reflections and the window match what is above.

import { MeshBasicNodeMaterial, DoubleSide } from 'three/webgpu';
import { vec2, vec3, vec4, float, positionWorld, positionLocal, modelWorldMatrix, modelWorldMatrixInverse, cameraPosition, cameraProjectionMatrix, cameraViewMatrix, reflect, mix, smoothstep, step, sqrt, viewportSharedTexture, screenUV } from 'three/tsl';
import { ixTime } from './clock.js';
import { footprint } from './lod.js';
import { waterBody } from './underwater.js';
import { waveField } from '../families/liquid/waves.js';
import { refractedVertex } from './refraction.js';

const N_WATER = 1.33;

// The sea of a water body at world xz q (m), waves under the footprint fq
// (m) faded. One sea for the surface, its shape, the caustics and the
// waterline. h / W.depthScale is the height in world metres.
export function surfaceWaves( q, fq, W = waterBody ) {

	const t = ixTime.mul( W.speed );
	return waveField( q.mul( W.depthScale ), fq.mul( W.depthScale ), {
		lmax: W.sizeM, lmin: W.featureM, angle: W.angle, steep: W.amount.mul( 0.14 ), t, rate: W.speed, seed: W.seed, count: 12, spreadDeg: 180,
	} );

}

// spacing: the mesh's segment size (m), the shortest wave it can carry.
export function createWaterSurface( sky, mirrors = {}, W = waterBody, { spacing = 0.005 } = {} ) {

	const P = positionWorld;
	const q = vec2( P.x, P.z );
	const fq = footprint( q );
	const wf = surfaceWaves( q, fq, W );
	const n = vec3( wf.slope.x.negate(), 1, wf.slope.y.negate() ).normalize(); // up, rippled
	const V = cameraPosition.sub( P ).normalize(); // toward the eye
	const above = mix( step( W.level, cameraPosition.y ), float( 1 ).sub( W.eyeUnder ), step( 0, W.eyeUnder ) ); // eyeUnder forces a side

	// Two planar mirrors of the scene (core/mirror.js), rendered by the
	// app: one seen from above (walls, posts, sky), one from below (the
	// pool itself). Without them, the sky alone and a dim tint.
	const shift = vec2( wf.slope.x, wf.slope.y.negate() ).mul( 0.06 );
	const mshift = shift.mul( vec2( - 1, 1 ) );
	// Where this point of the surface would be on screen unbent. The
	// mirrors are drawn from the true scene, so the surface reads them
	// there: bent by a pane or a port (core/refraction.js), it carries its
	// reflection along. Without refraction, the pixel itself.
	const clip = cameraProjectionMatrix.mul( cameraViewMatrix.mul( vec4( P, 1 ) ) );
	const ndc = clip.xy.div( clip.w );
	const trueUV = vec2( ndc.x.mul( 0.5 ).add( 0.5 ), float( 0.5 ).sub( ndc.y.mul( 0.5 ) ) );

	// From above: the mirror by Fresnel, the scene below pushed by the slope.
	const cosA = n.dot( V ).max( 0 );
	const Fa = float( 0.02 ).add( float( 0.98 ).mul( float( 1 ).sub( cosA ).pow( 5 ) ) );
	const Rr = reflect( V.negate(), n );
	const skyR = mirrors.up ? mirrors.up.sampleAt( trueUV, mshift ).rgb : sky( vec3( Rr.x, Rr.y.max( 0.03 ), Rr.z ) );
	const under = viewportSharedTexture( screenUV.add( shift ) ).rgb;
	const fromAbove = mix( under.mul( vec3( 0.9, 0.97, 1.0 ) ), skyR, Fa );

	// From below: the normal faces down to the eye. Snell: the ray leaves
	// into the air when sin(i) < 1 / n.
	const nb = n.negate();
	const cosB = nb.dot( V ).max( 0 );
	const sin2T = float( 1 ).sub( cosB.mul( cosB ) ).mul( N_WATER * N_WATER );
	const leaves = smoothstep( 1.0, 0.96, sin2T ); // 1 inside the window, 0 beyond (TIR)
	const cosT = sqrt( float( 1 ).sub( sin2T ).max( 0 ) );
	// Refracted ray into the air: eta = 1.33, toward -nb... i.e. upward.
	const I = V.negate();
	const Tdir = I.mul( N_WATER ).add( nb.mul( cosB.mul( N_WATER ).sub( cosT ) ) ).normalize();
	const r0 = ( N_WATER - 1 ) / ( N_WATER + 1 );
	const Fb = float( r0 * r0 ).add( float( 1 - r0 * r0 ).mul( float( 1 ).sub( cosT ).pow( 5 ) ) );
	// Inside the window: what is above the water, from the screen behind
	// the surface (sky and shore drawn already), pushed by the ripples and
	// lit a little more toward the refracted sun. Beyond: the mirror of
	// the water itself, dim and tinted, rippled.
	const air = viewportSharedTexture( screenUV.add( shift.mul( 3 ) ) ).rgb.mul( 0.85 ).add( sky( Tdir ).mul( 0.15 ) ).mul( float( 1 ).sub( Fb ) );
	// Beyond the window, total internal reflection: a perfect mirror of
	// the pool (walls, floor, posts), rippled. The silver band of every
	// aquarium is this mirror seen through the glass.
	const mirror = mirrors.down ? mirrors.down.sampleAt( trueUV, mshift ).rgb : W.inscatter.mul( 0.5 );
	const fromBelow = mix( mirror, air, leaves.mul( float( 1 ).sub( Fb ) ) );

	const m = new MeshBasicNodeMaterial( { side: DoubleSide, transparent: false } );
	// Shape: lift each vertex by the wave height, world up taken to local.
	const wp = modelWorldMatrix.mul( vec4( positionLocal, 1 ) );
	const hv = surfaceWaves( vec2( wp.x, wp.z ), float( spacing ), W ).h.div( W.depthScale );
	m.positionNode = positionLocal.add( modelWorldMatrixInverse.mul( vec4( 0, hv, 0, 0 ) ).xyz );
	// Seen through a pane or a port the surface is beyond it too, so it
	// bends with the rest (core/refraction.js); seen from above it is the
	// interface itself and stays put.
	m.vertexNode = refractedVertex();
	m.colorNode = vec4( mix( fromBelow, fromAbove, above ), 1 );
	m.toneMapped = true;
	return m;

}

// A clear day sky: horizon pale, zenith deep blue, a sun and its glow, a
// dark ground below the horizon. dir: world direction (normalized).
export function daySky( sunDir ) {

	return ( dir ) => {

		const d = dir.normalize();
		const up = d.y.max( 0 );
		let c = mix( vec3( 0.78, 0.86, 0.95 ), vec3( 0.12, 0.33, 0.78 ), up.pow( 0.6 ) ).mul( 1.4 );
		const s = d.dot( sunDir.normalize() ).max( 0 );
		c = c.add( vec3( 1.0, 0.95, 0.85 ).mul( s.pow( 900 ).mul( 40 ).add( s.pow( 12 ).mul( 0.5 ) ) ) );
		const ground = vec3( 0.18, 0.16, 0.13 );
		return mix( ground, c, smoothstep( - 0.02, 0.01, d.y ) );

	};

}

