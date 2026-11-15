// The sky a liquid reflects. Outdoors, what makes water read is the
// reflection of a bright sky over a dark ground: puddles are mirrors,
// ripples are seen as wobbles of the sky, an oil slick shows its colours
// against it. The demo room is mostly dark, so the liquid adds the
// reflection of an overcast sky as emission:
//   L(z) = (1 + 2 z) / 3   (CIE overcast: the zenith three times the
//   horizon), dark below an uneven skyline of roofs and trees (10 to 30
//   degrees), with soft clouds.
// The sky stands above the surface itself (along its flat normal), as
// if each liquid lay flat outdoors: on a vertical face it still shows.
// The reflected ray follows the rippled normal, so every wave, ring and
// bead moves the sky; the Fresnel factor (Schlick, from the reflectance
// F0 face on: water 2 %, a film its interference colour) brightens it
// at grazing views.

import { float, vec2, vec3, smoothstep, positionView, positionViewDirection, tangentView, bitangentView } from 'three/tsl';
import { valueNoise } from '../../core/hash.js';

// n: rippled view-space normal; flat: the normal without relief.
// F0: reflectance face on (float or RGB). sky: radiance of the zenith.
export function skyReflection( n, flat, F0, sky ) {

	const V = positionViewDirection;
	const cosI = n.dot( V ).max( 0 );
	const r = n.mul( cosI.mul( 2 ) ).sub( V ); // reflected view ray
	const z = r.dot( flat );
	// Clouds on a deck above: brighter and darker billows, so a tilt of
	// the surface shows as a shift of the sky (a ring, a ripple).
	// Three octaves, each turned, so the lattice of the value noise never
	// shows (a close camera sweeps many cells of this sky).
	const c = vec2( r.dot( tangentView ), r.dot( bitangentView ) ).div( z.max( 0.2 ) ).mul( 4 );
	const c2 = vec2( c.x.mul( 0.8 ).sub( c.y.mul( 0.6 ) ), c.x.mul( 0.6 ).add( c.y.mul( 0.8 ) ) ).mul( 2.1 );
	const c3 = vec2( c.x.mul( 0.28 ).add( c.y.mul( 0.96 ) ), c.y.mul( 0.28 ).sub( c.x.mul( 0.96 ) ) ).mul( 4.3 );
	const cloud = valueNoise( c.add( 3.1 ) ).mul( 0.5 ).add( valueNoise( c2.add( 8.3 ) ).mul( 0.3 ) ).add( valueNoise( c3.add( 1.7 ) ).mul( 0.2 ) );
	// A skyline of roofs and trees, 10 to 30 degrees high by direction:
	// a steep ripple flank reflects it, so rings and waves draw dark
	// lines across the bright sky.
	const az = vec2( r.dot( tangentView ), r.dot( bitangentView ) ).normalize(); // direction round the horizon, no seam
	const hz = valueNoise( az.mul( 1.6 ).add( 7 ) ).mul( 0.25 ).add( valueNoise( az.mul( 7 ).add( 3 ) ).mul( 0.08 ) ).add( 0.12 );
	const skyline = smoothstep( hz.sub( 0.02 ), hz.add( 0.02 ), z ).mul( 0.94 ).add( 0.06 );
	const L = z.max( 0 ).mul( 2 ).add( 1 ).div( 3 ).mul( skyline ).mul( smoothstep( 0.2, 0.8, cloud ).mul( 0.6 ).add( 0.7 ) );
	// Face on, the mirror shows the viewer: a head or a camera hides part
	// of the sky around the ray back to the eye. Kept faint: a dark disc
	// would read as a defect.
	const d = positionView.length();
	const cosA = d.div( d.mul( d ).add( 0.0009 ).sqrt() );
	const viewer = smoothstep( cosA.sub( 0.04 ), cosA.add( 0.01 ), r.dot( V ) ).mul( 0.12 );
	const f = float( 1 ).sub( cosI ).pow( 5 );
	const F = vec3( F0 ).add( vec3( 1 ).sub( F0 ).mul( f ) );
	return F.mul( L ).mul( float( 1 ).sub( viewer ) ).mul( sky ).mul( vec3( 0.92, 0.96, 1.0 ) );

}
