// Any matter under water (a stone, a hull, a pool tile): what the water
// above does to it. One body of water per scene (waterBody, world space),
// set by the app. Below its level, on a material built with underwater:
//   caustics   the sun comes through the rippled surface: the net of
//              bright lines (core/caustics.js), read at the point of the
//              surface the refracted sun ray came through, so it slides
//              over sloped and vertical faces as it does in a pool
//   light      sunlight loses each colour on its way down: pure water
//              absorbs red in metres, blue in tens of metres
//              (absorb, 1/m), plus turbidity that takes all colours
//   view       the path from the surface to the eye tints the matter the
//              same way, and the water's own scattered light (inscatter)
//              fills in what is lost: far objects fade into blue-green
//   wet band   a few millimetres above the line, the matter is darker
//              (capillary rise, splashes)
// The light terms multiply the albedo: the sky light is dimmed with the
// sun. Simple, and right for the main light. Cost: about 12 waves per
// pixel under water, nothing above it.

import { Vector3, Color } from 'three';
import { vec2, vec3, float, uniform, exp, smoothstep, step, mix, positionWorld, cameraPosition } from 'three/tsl';
import { footprint } from './lod.js';
import { ixTime } from './clock.js';
import { causticLight } from './caustics.js';
import { reliefLight } from './relief.js';
import { waveField } from '../families/liquid/waves.js';

export const waterBody = {
	level: uniform( 0.2 ), // world y of the still surface (m)
	sizeM: uniform( 0.4 ), featureM: uniform( 0.08 ), // longest and shortest ripple
	amount: uniform( 0.8 ), speed: uniform( 0.5 ), seed: uniform( 3 ), angle: uniform( 0.35 ),
	absorb: uniform( new Vector3( 0.45, 0.07, 0.02 ) ), // 1/m at 650, 550, 450 nm: above pure water (Pope and Fry 1997: about 0.34, 0.057, 0.009), as natural water with dissolved matter
	turbidity: uniform( 0.12 ), // scattering, 1/m, all colours
	inscatter: uniform( new Color( '#2a8f96' ) ), // colour of the light the water scatters
	caustics: uniform( 1 ),
	eyeUnder: uniform( - 1 ), // -1: from the camera height; 0 or 1: forced (split shots at the waterline)
	depthScale: uniform( 10 ), // the demo's cubes stand for a scene 10 times larger
};

export function applyUnderwater( nodes, W = waterBody ) {

	const P = positionWorld;
	const d = W.level.sub( P.y ); // depth below the still surface (m)
	const under = smoothstep( - 0.0005, 0.0005, d );
	const D = d.max( 0 ).mul( W.depthScale );

	// The sun ray in the water: refracted toward the vertical (n = 1.33).
	const L = reliefLight.normalize();
	const lt = vec2( L.x, L.z ).div( 1.33 );
	const ly = float( 1 ).sub( lt.dot( lt ) ).max( 0.05 ).sqrt();
	// Where it crossed the surface, and how far it went in the water.
	const Q = vec2( P.x, P.z ).add( lt.mul( d.max( 0 ).div( ly ) ) );
	const fq = footprint( vec2( P.x, P.z ) );
	const t = ixTime.mul( W.speed );
	const wf = waveField( Q.mul( W.depthScale ), fq.mul( W.depthScale ), {
		lmax: W.sizeM, lmin: W.featureM, angle: W.angle, steep: W.amount.mul( 0.14 ), t, rate: W.speed, seed: W.seed, count: 12, spreadDeg: 180,
	} );
	const C = mix( float( 1 ), causticLight( wf.hess, D, { blur: 0.1 } ).mul( 0.75 ).add( 0.15 ), W.caustics );
	const sigma = W.absorb.add( W.turbidity );
	const down = exp( sigma.negate().mul( D.div( ly ) ) );

	// Eye path inside the water: from the surface (camera above) or from
	// the camera (camera below), scaled like the depth.
	const V = P.sub( cameraPosition );
	const camUnder = mix( smoothstep( 0.0005, - 0.0005, cameraPosition.y.sub( W.level ) ), W.eyeUnder, step( 0, W.eyeUnder ) );
	const fromSurface = d.max( 0 ).div( V.normalize().y.abs().max( 0.08 ) );
	const path = mix( fromSurface, V.length(), camUnder ).mul( W.depthScale );
	const T = exp( sigma.negate().mul( path ) );
	const glow = W.inscatter.mul( float( 1 ).sub( T.dot( vec3( 1 / 3 ) ) ) ).mul( exp( W.absorb.negate().mul( D ) ) ).mul( 0.3 );

	const lit = nodes.colorNode.mul( down ).mul( C ).mul( T );
	const wet = smoothstep( 0.004, 0.0, d.negate() ).mul( float( 1 ).sub( under ) ).mul( 0.25 );
	nodes.colorNode = mix( nodes.colorNode.mul( float( 1 ).sub( wet ) ), lit, under );
	nodes.emissiveNode = ( nodes.emissiveNode ?? vec3( 0 ) ).add( glow.mul( under ) );
	return nodes;

}
