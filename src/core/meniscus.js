// The meniscus on a vertical pane, seen through it (core/waterline.js
// splits the frame; this draws the few millimetres at the line).
//   height   from the surface tension and the wall: capillary length
//            lc = sqrt( tension / ( density g ) ), 2.7 mm for water; on a
//            plane wall the water meets it lc sqrt( 2 ( 1 - sin theta ) )
//            away from the still level. theta is the contact angle.
//   wetting  theta < 90 (glass, acrylic): the water climbs the pane, a
//            concave film. A ray through it meets the curved surface
//            from below, grazing: total internal reflection. The film
//            shows the world under the water, inverted and squeezed.
//   bead     theta > 90 (PTFE, wax, rain-repellent glass): the water dips
//            at the pane and its edge rolls over, convex. Over the
//            contact line the ray crosses air and meets that rounded
//            edge from above: Fresnel reflection of the world above (a
//            mirror at the top, where the edge is flat and grazing; the
//            sky higher up as it steepens), the rest refracted into the
//            water. A dark contact line at its foot.
// Each returns { under, shade( col ) }: under picks the water pass,
// shade draws the meniscus over the split.

import { vec2, vec3, vec4, float, texture, smoothstep, mix, exp, sign, dFdy, reflect, sqrt } from 'three/tsl';
import { valueNoise } from './hash.js';

// Contact angle of water on a wall (degrees). Typical lab values; dirt
// and grease move them toward 90.
export const WALL_CONTACT = { cleanGlass: 10, glass: 25, acrylic: 70, coatedGlass: 105, ptfe: 110 };

export function capillaryLength( tension = 0.072, density = 998, g = 9.81 ) {

	return Math.sqrt( tension / ( density * g ) );

}

// Signed height (m) of the water at the pane over the still level:
// > 0 it climbs (wetting), < 0 it dips (bead).
export function meniscusHeight( { tension = 0.072, contactDeg = WALL_CONTACT.glass, density = 998, g = 9.81 } = {} ) {

	const th = contactDeg * Math.PI / 180;
	const h = capillaryLength( tension, density, g ) * Math.sqrt( 2 * ( 1 - Math.sin( th ) ) );
	return contactDeg < 90 ? h : - h;

}

// Pixels per unit of x along the screen's v, never 0, sign kept.
function perV( x, s ) {

	const d = dFdy( x ).div( dFdy( s.y ) );
	return d.abs().max( 1e-3 ).mul( sign( d ).add( 0.001 ).sign() );

}

// c: { s, G, hit, waterY, wf, tt, rtB, h, power }
export function wettingFilm( c ) {

	const { s, G, hit, waterY, wf, tt, rtB, h, power } = c;
	// Height over the line, in meniscus heights: < 0 under water, 0..1
	// the film, > 1 dry glass.
	const m = G.y.sub( waterY ).div( h );
	const under = smoothstep( 1.05, 0.95, m ).mul( hit );
	const shade = ( col ) => {

		// Squeezed more toward the top, where the surface turns vertical;
		// bright (a total reflection loses no light, splits no colour). The
		// ripples and a slow drift along the line make the squeeze uneven.
		const nz = valueNoise( vec2( G.x.add( G.z ).div( 0.012 ), tt.mul( 0.15 ) ).add( 300 ) );
		const mm = m.clamp( 0, 1 );
		const F = float( power ).mul( mm.mul( 2 ).add( 1 ) ).mul( nz.mul( 0.5 ).add( 0.75 ).add( wf.slope.y.mul( 2 ) ) );
		const sM = vec2( s.x.add( wf.slope.x.mul( 0.01 ) ), s.y.add( mm.mul( F ).negate().sub( m ).div( perV( m, s ) ) ) ).clamp( 0.001, 0.999 );
		const film = texture( rtB.texture, sM ).rgb.mul( 1.15 ).add( vec3( 0.04, 0.06, 0.06 ) );
		col = mix( col, film, smoothstep( - 0.02, 0.08, m ).mul( smoothstep( 1.0, 0.9, m ) ).mul( hit ) );
		// A bright rim at the top, where the surface turns vertical and lets
		// the sky in; a dark hairline at the foot, where the curvature flips.
		const rim = exp( m.sub( 0.94 ).div( 0.05 ).pow( 2 ).negate() ).mul( hit );
		const foot = exp( m.div( 0.05 ).pow( 2 ).negate() ).mul( hit );
		return col.mul( float( 1 ).sub( foot.mul( 0.45 ) ) ).add( vec3( 0.85, 0.92, 1.0 ).mul( rim.mul( 0.7 ) ) );

	};

	return { under, shade };

}

// c: { s, G, dir, hit, waterY, rtA, rtB, h (depth, > 0), lc, wallN
// (the pane's normal toward the eye), viewProj, reach (m, how far the
// mirrored scene lies; the tank's size) }
export function dippingBead( c ) {

	const { s, G, dir, hit, waterY, rtA, rtB, h, lc, wallN, viewProj, reach } = c;
	// Depth under the still level, in dip depths: 0 the level, 1 the
	// contact line on the pane, > 1 under water.
	const k = waterY.sub( G.y ).div( h );
	const under = smoothstep( 0.95, 1.05, k ).mul( hit );
	const shade = ( col ) => {

		// Where a level ray meets the edge, at depth z, the surface leans
		// psi toward the pane: z^2 = 2 lc^2 ( 1 - cos psi ) (plane meniscus).
		const z = k.clamp( 0, 1 ).mul( h );
		const cosP = float( 1 ).sub( z.mul( z ).div( 2 * lc * lc ) ).clamp( 0, 1 );
		const sinP = sqrt( float( 1 ).sub( cosP.mul( cosP ) ) );
		const n = vec3( 0, 1, 0 ).mul( cosP ).add( wallN.mul( sinP ) ).normalize();
		// Reflected: up by about 2 psi. The world above, from the air pass,
		// at the point the ray reaches after `reach` metres.
		const Q = G.add( reflect( dir, n ).mul( reach ) );
		const clip = viewProj.mul( vec4( Q, 1 ) );
		const q = clip.xy.div( clip.w.max( 1e-4 ) );
		const refl = texture( rtA.texture, vec2( q.x.mul( 0.5 ).add( 0.5 ), q.y.mul( - 0.5 ).add( 0.5 ) ).clamp( 0.001, 0.999 ) ).rgb;
		// Refracted: bent down into the water, the water just under the line.
		const sR = vec2( s.x, s.y.add( float( 1.25 ).sub( k ).div( perV( k, s ) ) ) ).clamp( 0.001, 0.999 );
		const refr = texture( rtB.texture, sR ).rgb.mul( 0.9 );
		const cosI = dir.dot( n ).abs();
		const Fr = float( 0.02 ).add( float( 0.98 ).mul( float( 1 ).sub( cosI ).pow( 5 ) ) );
		const bead = mix( refr, refl, Fr );
		// From a little over the level: there the mesh of the surface (its
		// waves sampled per vertex) may poke over the true line by a
		// fraction of a millimetre, and the far surface is a grazing mirror.
		col = mix( col, bead, smoothstep( - 0.45, - 0.15, k ).mul( smoothstep( 1.02, 0.96, k ) ).mul( hit ) );
		// A soft sheen where the edge curves most, near the pane; the
		// contact line under it, dark.
		const sheen = exp( k.sub( 0.85 ).div( 0.1 ).pow( 2 ).negate() ).mul( hit );
		const foot = exp( k.sub( 1 ).div( 0.05 ).pow( 2 ).negate() ).mul( hit );
		return col.mul( float( 1 ).sub( foot.mul( 0.5 ) ) ).add( vec3( 0.85, 0.92, 1.0 ).mul( sheen.mul( 0.25 ) ) );

	};

	return { under, shade };

}
