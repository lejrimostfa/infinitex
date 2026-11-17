// Scratch helpers shared by the metal modes.
//   marks    short straight scratches in every direction, one per cell
//            (handling marks on bronze, brass, gold, paint)
//   grooves  long parallel grooves, one per row across a direction
//            (abrasive belt on brushed steel, buffing arcs on chrome)
// Both widen a mark thinner than a pixel to the pixel and dim it by the
// same ratio, so a sub-pixel line keeps its average weight and never
// flickers.

import { vec2, float, floor, fract, clamp, step, sin, cos, mod } from 'three/tsl';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';

// Thin straight marks, one per cell. Returns the coverage of the nearest
// mark, widened to a pixel and dimmed (energy conserving).
export function marks( p, fp, cellM, widthM, seed ) {

	const x = p.div( cellM ).add( seed );
	const b = floor( x );
	let cov = float( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = b.add( vec2( ox, oy ) );
		const h = hash3( id );
		const a = h.z.mul( Math.PI ).add( valueNoise( id.mul( 0.2 ) ).mul( 1.2 ) ); // a common direction, more or less
		const dir = vec2( cos( a ), sin( a ) );
		const w = x.sub( id.add( h.xy ) );
		const half = hash1( id.add( 7.7 ) ).mul( 0.35 ).add( 0.15 );
		const t = clamp( w.dot( dir ), half.negate(), half );
		const d = w.sub( dir.mul( t ) ).length().mul( cellM );
		const r = widthM.mul( float( 1 ).sub( t.abs().div( half ) ).max( 0 ).sqrt() );
		const rEff = r.max( fp );
		cov = cov.max( clamp( rEff.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( r.div( rEff ) ) ).toVar();

	}

	return cov;

}

// Parallel grooves. a: coordinate along the grooves, c: across (meters).
// P: row spacing across. Each row holds one groove at a random offset,
// cut in segments 40 to 200 rows long that taper at both ends; `density`
// is the share of segments present. half: groove half width, in rows.
// Returns cov (0..1) and s, the slope across the groove (dh/dc), for a
// rounded groove of wall slope k.
export function grooves( a, c, fp, P, seed, density, half = 0.12, k = 0.3 ) {

	const r = c.div( P ).add( seed );
	const row = wrapCoord( floor( r ) );
	const h = hash3( vec2( row, seed ) );
	const d = fract( r ).sub( h.x.mul( 0.5 ).add( 0.25 ) ).mul( P ); // meters from the groove axis
	const seg = a.div( P.mul( h.y.mul( 160 ).add( 40 ) ) ).add( h.z.mul( 17 ) );
	const hs = hash3( vec2( row, wrapCoord( floor( seg ) ) ).add( seed * 1.7 ) );
	const t = fract( seg );
	const taper = t.mul( float( 1 ).sub( t ) ).mul( 4 ).sqrt();
	const on = step( hs.x, density );
	const w = P.mul( hs.y.mul( 0.7 ).add( 0.3 ) ).mul( half ).mul( taper );
	const wE = w.max( fp );
	const cov = clamp( wE.sub( d.abs() ).div( fp ).add( 0.5 ), 0, 1 ).mul( w.div( wE ) ).mul( on );
	const s = clamp( d.div( wE ), - 1, 1 ).mul( cov ).mul( hs.z.mul( 0.6 ).add( 0.7 ) ).mul( k );
	return { cov, s, depth: hs.z };

}
