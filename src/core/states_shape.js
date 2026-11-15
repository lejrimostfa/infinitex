// Shapes shared by the surface states (core/states.js).
//   blobs   splashes, spots and drops: one blob per cell, present with
//           probability `share`, radius rMin..rMax cells, the edge
//           wobbled by noise (and by thread-aligned noise for stains that
//           wick into a fabric). 3 x 3 neighbours searched, so a blob may
//           reach past its cell and two blobs merge into one outline.
//   dome    slope of a liquid cap h = k R (1 - rho^2) over a blob
//   lens    the optics of a clear drop seen from above: a dark rim (the
//           steep edge refracts the dark surroundings) and a bright
//           caustic on the side away from the light (the drop is a lens)
// Every blob returns its signed distance in meters (> 0 inside), so a
// state can draw rings, halos and holes at real widths.

import { vec2, vec3, float, floor, mod, step, clamp, smoothstep, mix, cos, sin } from 'three/tsl';
import { pick, fadeIn } from './lod.js';
import { hash3, valueNoise } from './hash.js';

// o: { rMin, rMax, wobble, wick, elong, angle, jitter }. elong stretches
// each blob along `angle` (radians) or a random angle when absent.
export function blobs( p, fp, cellM, share, salt, o = {} ) {

	const rMin = o.rMin ?? 0.15, rMax = o.rMax ?? 0.45, elong = o.elong ?? 0;
	const q = mod( p.div( cellM ).add( salt ), 4096 );
	const c0 = floor( q );
	// Ragged edge: two octaves of noise in meters, so it does not scale
	// with the blob; wicking adds thin fingers along the threads.
	let wob = valueNoise( p.div( cellM.mul( 0.1 ) ).add( salt ) ).sub( 0.5 ).mul( 0.7 )
		.add( valueNoise( p.div( cellM.mul( 0.03 ) ).add( salt + 3.3 ) ).sub( 0.5 ).mul( 0.3 ) ).mul( o.wobble ?? 0.25 );
	if ( o.wick ) {

		const t = cellM.mul( 0.004 ), l = cellM.mul( 0.05 );
		const wx = valueNoise( vec2( p.x.div( l ), p.y.div( t ) ).add( salt + 1.1 ) );
		const wy = valueNoise( vec2( p.x.div( t ), p.y.div( l ) ).add( salt + 2.7 ) );
		wob = wob.add( wx.max( wy ).sub( 0.55 ).max( 0 ).mul( o.wick ) );

	}

	let best = float( - 1e3 ), rho = float( 2 ), rad = vec2( 0, 1 ), id = vec3( 0 ), Rc = float( 0.1 ), vv = vec2( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const cid = c0.add( vec2( ox, oy ) );
		const h = hash3( cid ), h2 = hash3( cid.add( 7.1 ) );
		const on = step( h2.x, share );
		const v = q.sub( cid.add( 0.5 ).add( h.xy.sub( 0.5 ).mul( o.jitter ?? 0.7 ) ) );
		let w = v;
		if ( elong ) {

			const a = o.angle !== undefined ? float( o.angle ).add( h2.y.sub( 0.5 ).mul( 0.6 ) ) : h2.y.mul( 6.2832 );
			const d = vec2( cos( a ), sin( a ) ), n = vec2( sin( a ).negate(), cos( a ) );
			w = vec2( v.dot( d ).div( h2.z.mul( elong ).add( 1 ) ), v.dot( n ) );

		}

		const R = float( rMin ).add( h.z.mul( h.z ).mul( rMax - rMin ) ).mul( wob.add( 1 ) );
		const d = w.length().max( 1e-5 );
		const sd = R.sub( d ).mul( on ).sub( on.oneMinus().mul( 10 ) );
		const better = step( best, sd );
		best = pick( better, sd, best ).toVar();
		rho = pick( better, d.div( R ), rho ).toVar();
		rad = pick( better, v.div( v.length().max( 1e-5 ) ), rad ).toVar();
		vv = pick( better, v, vv ).toVar();
		id = pick( better, h2, id ).toVar();
		Rc = pick( better, R, Rc ).toVar();

	}

	const sd = best.mul( cellM ).toVar();
	return { sd, cov: clamp( sd.div( fp ).add( 0.5 ), 0, 1 ), rho, rad, v: vv, id, R: Rc.mul( cellM ) };

}

// Slope of a liquid cap of height k R (1 - rho^2): dh/dr = -2 k rho
// along the outward radius. Faded in once the drop spans a few pixels;
// below that it is a mean gloss handled by the caller.
export function dome( B, fp, k ) {

	const s = B.rad.mul( B.rho.min( 1 ).mul( - 2 ).mul( k ) ).mul( B.cov ).mul( fadeIn( B.R.mul( 2 ), fp, 2.0, 6.0 ) );
	return s;

}

// Albedo factor of a clear drop: dark rim, bright caustic toward `down`
// (light comes from above, the lens focuses it on the far side).
export function lens( B, down, fp, strength = 1 ) {

	const w = fadeIn( B.R.mul( 2 ), fp, 3.0, 8.0 ).mul( B.cov ).mul( strength );
	const rim = smoothstep( 0.62, 0.95, B.rho );
	const dl = down.length();
	const dn = down.div( dl.max( 1e-4 ) ).mul( smoothstep( 0.1, 0.5, dl ) );
	const off = B.rad.mul( B.rho ).sub( dn.mul( 0.38 ) );
	const caustic = smoothstep( 0.42, 0.12, off.length() ).mul( float( 1 ).sub( rim ) );
	return mix( float( 1 ), float( 1 ).sub( rim.mul( 0.6 ) ).add( caustic.mul( 0.7 ) ), w );

}

// The blob on top of two (largest signed distance).
export function over( A, B ) {

	const t = step( B.sd, A.sd );
	return {
		sd: A.sd.max( B.sd ), cov: A.cov.max( B.cov ), rho: mix( B.rho, A.rho, t ), rad: mix( B.rad, A.rad, t ),
		R: mix( B.R, A.R, t ), id: mix( B.id, A.id, t ), v: mix( B.v, A.v, t ),
	};

}

// A featured mark of radius R meters at c (surface meters), shaped like a
// blob. One per state, near the middle of a 30 cm face, so the deepest
// zoom of the demo falls on the edge of a mark. id: its fixed hash.
export function hero( p, fp, c, R, id, wobble = 0.25 ) {

	const v = p.sub( c );
	const wob = valueNoise( p.div( R * 0.35 ).add( 4.2 ) ).sub( 0.5 ).mul( 0.7 )
		.add( valueNoise( p.div( R * 0.1 ).add( 1.7 ) ).sub( 0.5 ).mul( 0.3 ) ).mul( wobble );
	const Rw = wob.add( 1 ).mul( R );
	const d = v.length().max( 1e-7 );
	const sd = Rw.sub( d ).toVar();
	return { sd, cov: clamp( sd.div( fp ).add( 0.5 ), 0, 1 ), rho: d.div( Rw ), rad: v.div( d ), v: v.div( R ), id: vec3( ...id ), R: Rw };

}
