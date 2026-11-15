// Chain mail, European 4 in 1. pitch_mm is the outer diameter of a ring
// (about 9 mm), strand_mm the wire (about 1.2 mm). Levels:
//   L0 sheet:   rows of rings, 0.42 diameters apart; in a row the rings
//               sit 0.68 diameters apart and lean the same way, like coins
//               stacked on their side; each row leans the other way, so a
//               ring passes over a ring of the next row at one crossing and
//               under it at the other: the links. Patches of darker oxide
//               and the odd bright replaced ring
//   L1 ring:    a torus seen tilted: an ellipse of round wire. The ring
//               above casts a shadow on the one below; through the holes the
//               far side of the object shows. Each ring is butted: a small
//               gap where its two ends meet
//   L2 wire:    drawing lines along the wire (a few um apart), small dents
//               from the pliers, rust in the crevices (rust > 0)
// Returns colour, slope, metal, cavity, alpha.

import { vec2, float, floor, fract, clamp, smoothstep, step, sqrt, mix, abs, cos, sin, atan, max } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';

const SX = 0.68, SY = 0.42, TILT = 0.8, LEAN = 0.35; // diameters, radians
const pm = ( x, n ) => x.sub( floor( x.div( n ) ).mul( n ) );

// Share of the area covered by wire, for the far view (JS, once).
export function mailCoverage( wireOverOD ) {

	const R = ( 1 - wireOverOD ) / 2, rw = wireOverOD / 2;
	let n = 0;
	const N = 30000; // 200 x 150 grid
	for ( let k = 0; k < N; k ++ ) {

		const x = ( k % 200 + 0.5 ) / 200 * SX * 2, y = ( Math.floor( k / 200 ) + 0.5 ) / 150 * SY * 2;
		let on = false;
		for ( let j = - 1; j <= 3 && ! on; j ++ ) for ( let i = - 2; i <= 4 && ! on; i ++ ) {

			const sg = j % 2 === 0 ? 1 : - 1, psi = sg > 0 ? LEAN : Math.PI - LEAN;
			const cx = ( i + ( ( j % 2 + 2 ) % 2 ) * 0.5 ) * SX, cy = j * SY;
			const dx = x - cx, dy = y - cy;
			const vx = dx * Math.cos( psi ) + dy * Math.sin( psi ), vy = - dx * Math.sin( psi ) + dy * Math.cos( psi );
			const a = R * Math.cos( TILT ), b = R;
			const e = Math.hypot( vx / a, vy / b ), g = Math.hypot( vx / ( a * a ), vy / ( b * b ) ) / Math.max( e, 1e-6 );
			on = Math.abs( ( e - 1 ) / Math.max( g, 1e-6 ) ) < rw;

		}

		if ( on ) n ++;

	}

	return n / N;

}

export function buildMail( p, fp, u ) {

	const OD = u.pitchM, rw = u.strandM.mul( 0.5 ), R = OD.sub( u.strandM ).mul( 0.5 );
	const Sx = OD.mul( SX ), Sy = OD.mul( SY );
	const j0 = floor( p.y.div( Sy ).add( 0.5 ) );
	const tanT = Math.tan( TILT );
	let best = float( - 1e3 ), tau = float( 0 ), gdir = vec2( 0 ), tdir = vec2( 0 ), zt = float( 0 ), id = vec2( 0 ), ang = float( 0 );
	let cover = float( 0 ), zNear = float( - 1e3 );
	for ( let dj = - 1; dj <= 1; dj ++ ) {

		const j = j0.add( dj );
		const odd = pm( j, float( 2 ) );
		const i0 = floor( p.x.div( Sx ).sub( odd.mul( 0.5 ) ).add( 0.5 ) );
		for ( let di = - 1; di <= 1; di ++ ) {

			const i = i0.add( di );
			const hq = hash3( vec2( i, j ).add( u.seed.mul( 13.1 ) ) );
			const c = vec2( i.add( odd.mul( 0.5 ) ).mul( Sx ), j.mul( Sy ) ).add( hq.xy.sub( 0.5 ).mul( OD ).mul( u.irregular.mul( 0.05 ) ) );
			const psi = mix( float( LEAN ), float( Math.PI - LEAN ), odd ).add( hq.z.sub( 0.5 ).mul( u.irregular.mul( 0.25 ) ) );
			const t = vec2( cos( psi ), sin( psi ) );
			const d = p.sub( c );
			const vx = d.dot( t ), vy = d.dot( vec2( t.y.negate(), t.x ) );
			const a = R.mul( Math.cos( TILT ) ), b = R;
			const e = vec2( vx.div( a ), vy.div( b ) ).length().max( 1e-4 );
			const ge = vec2( vx.div( a.mul( a ) ), vy.div( b.mul( b ) ) ).div( e );
			const gl = ge.length().max( 1e-6 );
			const dist = e.sub( 1 ).div( gl ); // meters to the wire axis
			const an = atan( vy.div( b ), vx.div( a ) );
			// Butted joint: a gap of about 0.3 mm at a random angle.
			const rel = fract( an.div( Math.PI * 2 ).sub( hq.x ).add( 0.5 ) ).sub( 0.5 );
			const open = clamp( abs( rel ).mul( R.mul( Math.PI * 2 ) ).sub( u.strandM.mul( 0.12 ) ).div( fp ).add( 0.5 ), 0, 1 );
			const z = vx.mul( - tanT ); // plane of the ring, meters
			const ax = abs( dist ).div( rw );
			const inT = clamp( rw.sub( abs( dist ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( open );
			const h = z.add( sqrt( float( 1 ).sub( ax.min( 1 ).mul( ax.min( 1 ) ) ) ).mul( rw ) ).sub( step( 1, ax ).mul( 1 ) ).sub( float( 1 ).sub( open ).mul( 1 ) );
			const win = step( best, h );
			const gd = ge.x.mul( t ).add( ge.y.mul( vec2( t.y.negate(), t.x ) ) ).div( gl ); // outward, surface coords
			best = max( best, h ).toVar();
			tau = pick( win, dist.div( rw ), tau ).toVar();
			gdir = pick( win, gd, gdir ).toVar();
			tdir = pick( win, t, tdir ).toVar();
			zt = pick( win, z, zt ).toVar();
			id = pick( win, vec2( i, j ), id ).toVar();
			ang = pick( win, an.mul( R ), ang ).toVar();
			cover = cover.max( inT ).toVar();
			// Wire of another ring passing just beside and above: shadow.
			zNear = max( zNear, z.sub( smoothstep( rw, rw.mul( 3 ), abs( dist ) ).mul( 1 ) ) ).toVar();

		}

	}

	// The rings stay readable while the wire is a pixel or two wide (its
	// edges are antialiased by the footprint); only then the mean takes over.
	const wR = fadeIn( u.strandM, fp, 0.6, 1.6 ).toVar();
	const tc = tau.clamp( - 0.96, 0.96 );
	const hz = sqrt( float( 1 ).sub( tc.mul( tc ) ) );
	const T2 = vec2( gdir.y.negate(), gdir.x );
	const zg = tdir.mul( - tanT );
	const sRing = gdir.mul( tc.div( hz ).negate().clamp( - 3, 3 ) ).add( T2.mul( zg.dot( T2 ) ) );
	// L2: drawing lines along the wire, pliers dents.
	const lines = valueNoise( vec2( tau.mul( rw ).div( 6e-6 ), ang.div( 8e-4 ) ).add( id ) );
	const wL = fadeIn( 6e-6, fp, 2.0, 6.0 ).mul( wR );
	const dent = valueNoise( vec2( ang.div( 3e-4 ), tau.mul( 2 ) ).add( id.mul( 1.7 ) ) );
	const wD = fadeIn( 3e-4, fp, 2.0, 6.0 ).mul( wR );
	const slope = sRing.add( gdir.mul( lines.sub( 0.5 ).mul( 0.12 ).mul( wL ) ) ).add( T2.mul( dent.sub( 0.5 ).mul( 0.25 ).mul( wD ) ) ).mul( wR );

	const shadow = smoothstep( 0.0, rw.mul( 1.5 ), zNear.sub( zt ) ).mul( wR );
	const ring = hash1( id.add( 4.4 ) );
	const patch = valueNoise( p.div( 0.05 ).add( u.seed ) );
	const oxide = smoothstep( 0.4, 0.75, patch ).mul( 0.35 ).add( ring.sub( 0.5 ).mul( u.colorVar ).mul( wR ) );
	const bright = step( 0.97, ring ).mul( wR ); // replaced rings
	const rustAmt = u.rust.mul( smoothstep( 0.3, 0.8, valueNoise( p.div( 0.002 ) ).add( shadow.mul( 0.6 ) ).add( float( 1 ).sub( hz ).mul( 0.3 ) ) ) );
	let color = u.color.mul( float( 1 ).sub( oxide ).max( 0.4 ) ).mul( mix( float( 1 ), float( 1.15 ), bright ) );
	color = color.mul( float( 1 ).sub( shadow.mul( 0.75 ) ) ).mul( mix( float( 0.8 ), float( 1 ), wR ) );
	color = mix( color, u.color2, rustAmt );
	const metal = float( 1 ).sub( rustAmt );
	const rough = u.roughness.add( oxide.mul( 0.25 ) ).sub( bright.mul( 0.1 ) ).add( rustAmt.mul( 0.5 ) ).clamp( 0.05, 1 );
	const s2 = float( 1 ).sub( wR ).mul( 0.25 ).add( float( 1 ).sub( wL ).mul( 0.003 ) );
	const alpha = mix( u.coverage, cover, wR );
	const cavity = shadow.max( float( 1 ).sub( hz ).mul( 0.5 ) ).mul( wR );
	return { color, slope, rough, s2, cavity, metal, alpha };

}
