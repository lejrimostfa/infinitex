// Thin straight marks scattered over a surface: scratches, scuffs, lint.
// One segment per cell of `cellM`, its 3 x 3 neighbours searched, so a
// segment may reach 1.5 cells. Each mark tapers to its ends.
// The mark is widened to one pixel and dimmed by width / pixel, so a 2 um
// scratch seen from far still adds its share of light and never flickers.
// Returns { cov, slope }: coverage 0..1 and the slope of a V groove
// (dh/du, dh/dv), nonzero only where the groove is wider than a pixel.
// Same idea as the marks() of families/metal, shared here for new families.

import { vec2, float, floor, clamp, sin, cos, smoothstep } from 'three/tsl';
import { hash1, hash3, valueNoise } from './hash.js';
import { pick } from './lod.js';

// spread: 0 all marks in one direction (angle), 1 any direction.
export function scratchMarks( p, fp, cellM, widthM, seed, { angle = 0, spread = 1, length = 1, density = 1 } = {} ) {

	const x = p.div( cellM ).add( seed );
	const b = floor( x );
	let cov = float( 0 ), slope = vec2( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = b.add( vec2( ox, oy ) );
		const h = hash3( id );
		const a = float( angle ).add( h.z.sub( 0.5 ).mul( Math.PI ).mul( spread ) ).add( valueNoise( id.mul( 0.2 ) ).sub( 0.5 ).mul( 0.6 ) );
		const dir = vec2( cos( a ), sin( a ) );
		const w = x.sub( id.add( h.xy ) );
		const half = hash1( id.add( 7.7 ) ).mul( 0.35 ).add( 0.15 ).mul( length );
		const t = clamp( w.dot( dir ), half.negate(), half );
		const off = w.sub( dir.mul( t ) );
		const d = off.length().mul( cellM );
		const on = smoothstep( 0.0, 0.05, float( density ).sub( hash1( id.add( 3.1 ) ) ) );
		const r = widthM.mul( float( 1 ).sub( t.abs().div( half ) ).max( 0 ).sqrt() ).mul( hash1( id.add( 1.3 ) ).mul( 0.8 ).add( 0.4 ) ).mul( on );
		const rEff = r.max( fp );
		const c = clamp( rEff.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( r.div( rEff ) );
		// V groove: the wall faces away from the axis; only once it is resolved.
		const nrm = vec2( dir.y.negate(), dir.x );
		const side = clamp( off.dot( nrm ).mul( cellM ).div( r.max( 1e-9 ) ), - 1, 1 );
		const s = nrm.mul( side ).mul( 0.6 ).mul( c ).mul( smoothstep( 1.0, 3.0, r.div( fp ) ) );
		const top = clamp( c.sub( cov ).mul( 1e3 ), 0, 1 );
		slope = pick( top, s, slope ).toVar();
		cov = cov.max( c ).toVar();

	}

	return { cov, slope };

}
