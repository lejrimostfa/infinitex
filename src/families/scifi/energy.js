// An energy panel: plasma held behind hexagonal glass cells in a dark
// metal frame. Level by level:
//   L0 arcs     plasma filaments at five scales, 80 mm down to 0.3 mm,
//               each a contour line of a flowing, warped noise: a white
//               hot core inside a coloured halo; they drift with time
//   L1 hexes    cells of size_mm (20 to 30 mm) across: a groove in the
//               frame, a thin glowing line in it, pulses running outward
//   L2 frame    a second, finer hex net of feature_mm etched in the glass
//               (the field emitter grid), faint
//   L3 metal    grain and pits of the frame metal; the finest filaments
//               (0.3 mm) at the deepest zoom
// Every filament has a width proportional to its scale; below a few
// pixels it fades to its mean glow, so nothing flickers far away.

import { vec2, vec3, float, floor, fract, clamp, smoothstep, mix, mod, abs, max } from 'three/tsl';
import { ixTime as time } from '../../core/clock.js';
import { fadeIn, pick } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { fbm } from '../stone/common.js';

const pm = ( x, n ) => x.sub( n.mul( floor( x.div( n ) ) ) );

// Hexagonal cells of width S (flat to flat). Returns the distance to the
// cell border in meters, the cell id and the offset from its centre.
function hexes( p, S ) {

	const q = p.div( S );
	const R = vec2( 1, 1.7320508 ), H = R.mul( 0.5 );
	const a = pm( q, R ).sub( H ), b = pm( q.sub( H ), R ).sub( H );
	const g = pick( clamp( b.dot( b ).sub( a.dot( a ) ).mul( 1e4 ), 0, 1 ), a, b );
	const e = float( 0.5 ).sub( max( abs( g.x ).mul( 0.5 ).add( abs( g.y ).mul( 0.8660254 ) ), abs( g.x ) ) );
	return { d: e.mul( S ), id: q.sub( g ), g };

}

// One scale of filaments: contour 0.5 of a warped, flowing noise.
function filaments( p, fp, S, t, salt ) {

	const q = p.div( S ).add( salt );
	const wq = vec2( valueNoise( q.mul( 0.6 ).add( vec2( t.mul( 0.15 ), 1.3 ) ) ), valueNoise( q.mul( 0.6 ).add( vec2( 5.1, t.mul( - 0.12 ) ) ) ) ).sub( 0.5 ).mul( 1.6 );
	const n = valueNoise( q.add( wq ).add( vec2( t.mul( 0.08 ), 0 ) ) );
	const d = abs( n.sub( 0.5 ) ).mul( S ).mul( 1.4 ); // about meters from the line
	const w = S.mul( 0.012 );
	const core = clamp( w.sub( d ).div( fp ).add( 0.5 ), 0, 1 );
	const halo = w.div( d.add( w ) ).pow( 2 );
	const fade = fadeIn( S.mul( 0.25 ), fp, 2.0, 6.0 );
	const flick = valueNoise( vec2( q.x.mul( 3 ).add( t.mul( 2 ) ), q.y.mul( 3 ) ) ).mul( 0.7 ).add( 0.5 );
	return { core: core.mul( fade ).mul( flick ), halo: mix( float( 0.05 ), halo, fade ).mul( flick ) };

}

export function buildEnergy( p, fp, u ) {

	const s = u.seed;
	const t = time.mul( u.speed );
	let core = float( 0 ), halo = float( 0 );
	const scales = [ 0.08, 0.02, 0.005, 0.0012, 0.0003 ];
	scales.forEach( ( S, i ) => {

		const F = filaments( p, fp, float( S ), t.mul( 1 + i * 0.6 ), s.mul( 3 ).add( i * 7.7 ) );
		const a = Math.pow( 0.8, i );
		core = core.max( F.core.mul( a ) );
		halo = halo.add( F.halo.mul( a * 0.5 ) );

	} );
	const plasma = u.color.mul( halo.mul( 1.4 ) ).add( mix( u.color, vec3( 1 ), 0.35 ).mul( core.mul( 1.3 ) ) );

	// L1 hex frame: a metal web 1.2 mm wide, a glowing line in its groove.
	const Hx = hexes( p, u.sizeM );
	const frameW = float( 0.0012 );
	const frame = clamp( frameW.sub( Hx.d ).div( fp ).add( 0.5 ), 0, 1 );
	const lineW = float( 0.00018 );
	const lineCov = clamp( lineW.max( fp.mul( 0.7 ) ).sub( Hx.d ).div( fp ).add( 0.5 ), 0, 1 ).mul( lineW.div( lineW.max( fp.mul( 0.7 ) ) ) );
	const r = Hx.id.mul( u.sizeM ).sub( vec2( 0.15 ) ).length();
	const pulse = smoothstep( 0.7, 1.0, fract( r.div( 0.06 ).sub( t.mul( 0.5 ) ) ) ).mul( 1.5 ).add( 0.35 );
	const hexGlow = u.color2.mul( lineCov ).mul( pulse );
	// Each cell glows a little on its own, brighter near its border.
	const ch = hash3( wrapCoord( floor( Hx.id.mul( 2 ) ) ).add( s ) );
	const cellTone = ch.x.mul( 0.5 ).add( 0.75 ).mul( smoothstep( 0.0, 0.5, Hx.d.div( u.sizeM ) ).mul( - 0.3 ).add( 1 ) );

	// L2 emitter grid in the glass.
	const E = hexes( p, u.featureM );
	const eLine = clamp( u.featureM.mul( 0.03 ).sub( E.d ).div( fp ).add( 0.5 ), 0, 1 ).mul( fadeIn( u.featureM, fp, 3.0, 8.0 ) );

	// L3 metal of the frame: grain and pits.
	const grain = fbm( p, 2e-4, fp, 3, 5 );
	const metalCol = u.color3.mul( grain.mul( 0.5 ).add( 0.75 ) );
	const glass = plasma.mul( cellTone ).mul( float( 1 ).sub( eLine.mul( 0.5 ) ) );
	const emissive = mix( glass, hexGlow, frame ).mul( u.glow );
	// Frame relief: walls fall into the groove; glass flat.
	const g = Hx.g.div( Hx.g.length().max( 1e-4 ) );
	const wall = smoothstep( 0.0, 1.0, frame ).mul( smoothstep( 0, 1, Hx.d.div( frameW ) ) );
	const slope = g.mul( wall ).mul( 0.4 ).mul( fadeIn( frameW, fp, 1.5, 4.0 ) ).mul( u.relief );
	const color = mix( u.color3.mul( 0.4 ), metalCol, frame );
	return {
		color, emissive, metal: frame.mul( 0.8 ), slope, rough: mix( float( 0.08 ), u.roughness, frame ), s2: float( 0.001 ),
		cavity: frame.mul( float( 1 ).sub( wall ) ).mul( 0.5 ), coat: float( 1 ).sub( frame ), coatRough: float( 0.03 ),
	};

}
