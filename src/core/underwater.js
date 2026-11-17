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
//   refraction drawn where the eye sees it through the surface, a pane or
//              a camera port (core/refraction.js, off unless the app sets it)
//   mood       optional, all off by default (the picture is then the
//              physical one above). The water's light takes a colour by the
//              direction the eye looks in (hazeColor): bright towards the
//              surface, `deep` level and down, a glow around the sun. `fill`
//              lights the shadows with the water's colour, so they read
//              blue and not grey. `causticTint` warms the bright lines of
//              the caustic net. `rim` (rimLight) is the light from the
//              surface that wraps the edge of a body seen against the haze.
// The light terms multiply the albedo: the sky light is dimmed with the
// sun. Simple, and right for the main light. Cost: about 12 waves per
// pixel under water, nothing above it.

import { Vector3, Color } from 'three';
import { vec2, vec3, float, uniform, exp, smoothstep, step, mix, positionWorld, normalWorld, cameraPosition } from 'three/tsl';
import { footprint } from './lod.js';
import { ixTime } from './clock.js';
import { causticLight } from './caustics.js';
import { reliefLight } from './relief.js';
import { waveField } from '../families/liquid/waves.js';
import { refractedVertex } from './refraction.js';

export const waterBody = {
	level: uniform( 0.2 ), // world y of the still surface (m)
	sizeM: uniform( 0.4 ), featureM: uniform( 0.08 ), // longest and shortest ripple
	amount: uniform( 0.8 ), speed: uniform( 0.5 ), seed: uniform( 3 ), angle: uniform( 0.35 ),
	absorb: uniform( new Vector3( 0.45, 0.07, 0.02 ) ), // 1/m at 650, 550, 450 nm: above pure water (Pope and Fry 1997: about 0.34, 0.057, 0.009), as natural water with dissolved matter
	turbidity: uniform( 0.12 ), // scattering, 1/m, all colours
	inscatter: uniform( new Color( '#2a8f96' ) ), // colour of the light the water scatters
	deep: uniform( new Color( '#2a8f96' ) ), // that light seen level or downwards (hazeColor); the same colour: no gradient
	sunTint: uniform( new Color( '#fff0cc' ) ), sunGlow: uniform( 0 ), // the halo around the sun in the water, and its strength
	fill: uniform( 0 ), // the water's light on the matter's shadows, 0 for none
	causticTint: uniform( new Color( '#ffffff' ) ), // colour of the focused sunlight (the bright lines of the net); white: none
	rim: uniform( 0 ), // strength of the edge light (rimLight), 0 for none
	snow: uniform( 1 ), // brightness of the floating specks (core/snow.js)
	shaftCut: uniform( 1 ), // caustic light a shaft starts at: 1 the mean (a veil), higher for separate beams
	caustics: uniform( 1 ),
	shafts: uniform( 1 ), // strength of the light shafts (core/shafts.js), 0 for none
	lens: uniform( 1 ), // the eye's own share under water (core/underlens.js): sway, softness, specks, vignette; 0 for a still, crisp picture
	eyeUnder: uniform( - 1 ), // -1: from the camera height; 0 or 1: forced (split shots at the waterline)
	depthScale: uniform( 10 ), // the demo's cubes stand for a scene 10 times larger
};

// The sun's direction in the water (n = 1.33), pointing up to the surface.
function sunInWater() {

	const L = reliefLight.normalize();
	const lt = vec2( L.x, L.z ).div( 1.33 );
	const ly = float( 1 ).sub( lt.dot( lt ) ).max( 0.05 ).sqrt();
	return vec3( lt.x, ly, lt.y );

}

// The colour of the light the water scatters, by where the eye looks.
// dir: world direction from the eye, unit. Up: the lit water under the
// surface (inscatter). Level and down: the long path, `deep`. Around the
// sun: light scattered forward, a soft halo (sunGlow).
export function hazeColor( dir, W = waterBody ) {

	const base = mix( W.deep, W.inscatter, smoothstep( - 0.35, 0.65, dir.y ) );
	const halo = dir.dot( sunInWater() ).max( 0 ).pow( 6 ).mul( W.sunGlow );
	return base.add( W.sunTint.mul( halo ) );

}

// The light of the surface on the edge of a body: where the matter turns
// away from the eye and its normal still looks up, it shows a bright line
// against the haze. An emissive node; it fades with the water above the
// point and between the point and the eye. strength: of this matter.
export function rimLight( strength = 1, W = waterBody ) {

	const P = positionWorld;
	const toEye = cameraPosition.sub( P );
	const edge = float( 1 ).sub( normalWorld.dot( toEye.normalize() ).abs() ).pow( 4 );
	const top = smoothstep( - 0.3, 0.6, normalWorld.y );
	const d = W.level.sub( P.y );
	const water = d.max( 0 ).add( toEye.length() ).mul( W.depthScale );
	const lost = exp( W.absorb.add( W.turbidity ).negate().mul( water ) );
	return mix( W.inscatter, W.sunTint, 0.5 ).mul( edge ).mul( top ).mul( lost ).mul( smoothstep( - 0.0005, 0.0005, d ) ).mul( W.rim ).mul( strength );

}

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
	const glow = hazeColor( V.normalize(), W ).mul( float( 1 ).sub( T.dot( vec3( 1 / 3 ) ) ) ).mul( exp( W.absorb.negate().mul( D ) ) ).mul( 0.3 );
	// The water's own light on the matter, sun or shade: without it a shadow
	// under water is the grey of the sky light. Not cut by the caustics.
	const fill = nodes.colorNode.mul( mix( W.deep, W.inscatter, 0.5 ) ).mul( T ).mul( W.fill );

	// Where the surface focuses the sun the light takes causticTint: warm
	// lines on a floor whose shade is the water's blue.
	const lit = nodes.colorNode.mul( down ).mul( mix( vec3( 1 ), W.causticTint, smoothstep( 0.7, 1.8, C ) ).mul( C ) ).mul( T );
	const wet = smoothstep( 0.004, 0.0, d.negate() ).mul( float( 1 ).sub( under ) ).mul( 0.25 );
	nodes.colorNode = mix( nodes.colorNode.mul( float( 1 ).sub( wet ) ), lit, under );
	nodes.emissiveNode = ( nodes.emissiveNode ?? vec3( 0 ) ).add( glow.add( fill ).mul( under ) );
	nodes.waterFillNode = fill.mul( under ); // kept for tintUnderwater
	nodes.vertexNode = refractedVertex();
	return nodes;

}

// A tint put on a matter after applyUnderwater. The lit colour takes it by
// a product, since the underwater terms are linear in the colour. The fill
// is in the emissive, added for the colour before the tint: it takes the
// tint here. Without this a red fish in blue fill turned pink.
// m: the material. tint: a vec3 or float node.
export function tintUnderwater( m, tint ) {

	m.colorNode = m.colorNode.mul( tint );
	if ( m.waterFillNode ) m.emissiveNode = m.emissiveNode.add( m.waterFillNode.mul( vec3( tint ).sub( 1 ) ) );

}
