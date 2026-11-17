// Silk: a cocoon wall and an orb spider web.
// Silk cocoon (Bombyx mori):
//   L0 wall      off white, a soft bumpy wall (the larva laid the thread
//                in waves, size_mm 2 to 4 mm), floss looser in patches
//   L1 loops     one continuous thread laid in loops and figure eights
//                (feature_mm, 0.5 to 1 mm across), three layers deep,
//                the lower ones in shadow
//   L2 thread    the bave (fiber_um, 10 to 15 um), two brins glued by
//                sericin gum: small glossy blobs where loops cross
// Spider web (orb web, cut out: the rest of the face is empty):
//   L0 web       radial threads from a hub, a capture spiral size_mm apart
//                between the hub and the frame, a few frame threads
//   L2 droplets  glue droplets strung on the spiral (feature_mm apart,
//                10 to 30 um), each a tiny bright lens
// Threads thinner than a pixel are widened to one and dimmed.
// Returns { color, slope, cavity, rough, s2, sheen, opacity }.

import { vec2, float, floor, fract, mix, smoothstep, step, clamp, mod, atan, cos, sin } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash3, wrapCoord } from '../../core/hash.js';
import { fbm, ridged } from './common.js';

// One layer of loops: an ellipse per cell, 3 x 3 cells searched.
function loops( p, cellM, w, fp, salt ) {

	const q = wrapCoord( p.div( cellM ) ).add( salt );
	const c0 = floor( q );
	let cov = float( 0 ), slope = vec2( 0 ), cross = float( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = c0.add( vec2( ox, oy ) );
		const h = hash3( id ), h2 = hash3( id.add( 17.1 ) );
		const a = h.z.mul( 6.283 );
		const d = q.sub( id.add( h.xy ) );
		const l = vec2( d.x.mul( cos( a ) ).add( d.y.mul( sin( a ) ) ), d.y.mul( cos( a ) ).sub( d.x.mul( sin( a ) ) ) );
		// A figure eight for some cells: the radius pinches twice.
		const ang = atan( l.y, l.x );
		const R = h2.x.mul( 0.4 ).add( 0.45 ).mul( float( 1 ).sub( step( 0.6, h2.y ).mul( cos( ang.mul( 2 ) ).mul( 0.35 ) ) ) );
		const e = vec2( l.x, l.y.mul( h2.z.mul( 0.8 ).add( 1.0 ) ) ).length().sub( R ).mul( cellM );
		const wE = w.max( fp.mul( 0.5 ) );
		const f = clamp( wE.sub( e.abs() ).div( fp ).add( 0.5 ), 0, 1 ).mul( w.div( wE ).sqrt() );
		cross = cross.add( f );
		const on = step( cov, f );
		cov = cov.max( f );
		slope = pick( on, l.normalize().mul( e.div( wE ).clamp( - 1, 1 ) ).mul( - 0.8 ).mul( f ), slope );

	}

	return { cov, slope, cross };

}

export function buildCocoon( p, fp, u ) {

	const s = u.seed;
	const W = ridged( p.add( s ), u.sizeM, fp, 3, 2.2 );
	const floss = smoothstep( 0.5, 0.7, fbm( p.add( 3.3 ), float( 0.04 ), fp, 3, 4 ) );
	const base = u.color.mul( fbm( p.add( 1.1 ), float( 0.02 ), fp, 3, 6 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	const w = u.fiberM.mul( 0.5 );
	const A = loops( p, u.featureM, w, fp, 1.3 );
	const B = loops( p.add( 0.37e-3 ), u.featureM.mul( 0.8 ), w, fp, 7.1 );
	const C = loops( p.add( 0.71e-3 ), u.featureM.mul( 1.2 ), w, fp, 13.9 );
	const wL = fadeIn( u.featureM, fp, 1.0, 3.0 );
	// Depth: what shows between threads of the top layers is in shadow.
	const top = A.cov, mid = B.cov.mul( top.oneMinus() ), low = C.cov.mul( top.oneMinus() ).mul( B.cov.oneMinus() );
	const gap = top.oneMinus().mul( B.cov.oneMinus() ).mul( C.cov.oneMinus() );
	let color = base.mul( top.add( mid.mul( 0.8 ) ).add( low.mul( 0.65 ) ).add( gap.mul( 0.45 ) ) );
	color = mix( base.mul( 0.8 ), color, wL );
	color = color.mul( W.h.mul( 0.35 ).add( 0.8 ) ).mul( floss.mul( 0.08 ).add( 1 ) );
	// Sericin blobs where threads cross: a touch yellower, glossy.
	const gum = smoothstep( 1.2, 2.0, A.cross.add( B.cross ) ).mul( fadeIn( u.fiberM.mul( 2 ), fp, 1.5, 4.0 ) );
	color = mix( color, u.color2, gum.mul( 0.5 ) );
	const slope = W.slope.mul( u.sizeM.mul( 0.3 ) ).add( A.slope.add( B.slope.mul( mid ) ).mul( fadeIn( u.fiberM, fp, 1.5, 4.0 ) ) ).mul( u.relief );
	const rough = mix( u.roughness, float( 0.25 ), gum );
	return { color, slope, cavity: gap.mul( wL ).mul( 0.6 ), rough, s2: wL.oneMinus().mul( 0.05 ), sheen: u.color.mul( u.sheen ), sheenRough: float( 0.3 ) };

}

export function buildWeb( p, fp, u ) {

	const s = u.seed;
	const c = vec2( 0.15, 0.16 ).add( vec2( s.mul( 0.0071 ), s.mul( 0.0043 ) ).sub( 0.03 ).fract().mul( 0.03 ) );
	const d = p.sub( c );
	const r = d.length(), th = atan( d.y, d.x );
	const w = u.fiberM.mul( 0.5 );
	const line = ( dist, ww ) => {

		const wE = ww.max( fp.mul( 0.6 ) );
		return clamp( wE.sub( dist.abs() ).div( fp ).add( 0.5 ), 0, 1 ).mul( ww.div( wE ).sqrt() );

	};

	// Radials: N threads, each slightly off its even angle.
	const N = 28;
	const k = th.div( 6.2832 ).mul( N ).add( 0.5 );
	const ki = floor( k );
	const jit = hash3( vec2( mod( ki, N ), 3.3 ) ).x.sub( 0.5 ).mul( 0.3 );
	const radial = line( fract( k ).sub( 0.5 ).sub( jit ).mul( r.mul( 6.2832 / N ) ), w ).mul( step( 0.004, r ) );
	// Capture spiral between hub and frame, sagging a bit between radials.
	const S = u.sizeM;
	const sag = fract( k ).sub( 0.5 ).mul( fract( k ).sub( 0.5 ) ).mul( S.mul( 0.4 ) );
	const sp = r.add( sag ).sub( th.div( 6.2832 ).mul( S ) );
	const spd = fract( sp.div( S ) ).sub( 0.5 ).mul( S );
	const zone = step( 0.02, r ).mul( step( r, 0.135 ) );
	const spiral = line( spd, w.mul( 1.2 ) ).mul( zone );
	// Hub: a dense mat of silk; frame threads: a few long lines.
	const hub = smoothstep( 0.004, 0.002, r ).mul( 0.35 );
	const f1 = line( d.dot( vec2( 0.96, 0.28 ) ).add( 0.135 ), w.mul( 2 ) ).max( line( d.dot( vec2( - 0.2, 0.98 ) ).sub( 0.14 ), w.mul( 2 ) ) );
	// Glue droplets on the spiral (only the spiral is sticky).
	const along = th.mul( r ).div( u.featureM );
	const bead = vec2( fract( along ).sub( 0.5 ).mul( u.featureM ), spd ).length();
	const bR = u.featureM.mul( 0.12 ).mul( hash3( vec2( floor( along ), floor( sp.div( S ) ) ) ).x.mul( 0.8 ).add( 0.6 ) );
	const drop = clamp( bR.sub( bead ).div( fp ).add( 0.5 ), 0, 1 ).mul( zone ).mul( fadeIn( u.featureM, fp, 2.0, 5.0 ) );
	const cov = radial.max( spiral ).max( hub ).max( f1 ).max( drop ).min( 1 );
	const color = mix( u.color, u.color2, drop );
	const lens = vec2( fract( along ).sub( 0.5 ).mul( u.featureM ), spd ).div( bR.max( 1e-7 ) ).mul( drop ).mul( - 1.2 );
	return { color, slope: lens.mul( u.relief ), cavity: float( 0 ), rough: mix( u.roughness, float( 0.05 ), drop ), s2: float( 0 ),
		sheen: u.color.mul( u.sheen ), opacity: cov };

}
