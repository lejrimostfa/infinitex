// Sunspots on the photosphere (photosphere.js). A spot is where a bundle
// of magnetic field pierces the surface and stops the convection, so the
// gas there cools: a dark umbra (about 4000 K, crust_k) inside a lighter
// penumbra (about 5200 K) made of radial filaments. Gas flows outward
// along the filaments (the Evershed flow), so they drift away from the
// umbra. Spots are rare: one candidate per grid cell of 50 granules,
// kept with a probability set by `cover`. The centre stays inside the
// middle 40 % of its cell and the penumbra is at most 11 granules wide,
// so a spot never crosses a cell border and one cell lookup is enough.
//
// Sizes in surface meters, S = granule size. Returns coverages (anti
// aliased by the footprint), the filament noise and its fade weight, the
// radius ratio inside the umbra, and a halo around each spot where the
// faculae gather (active regions).

import { vec2, floor, clamp, smoothstep, step } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, wrapId } from '../../core/hash.js';
import { fbm } from './common.js';

export function sunspots( q, fp, S, cover, t, seed ) {

	const G = S.mul( 50 );
	const cell = floor( q.div( G ) ).toVar();
	const id = wrapId( cell.add( vec2( seed.mul( 7.1 ), seed.mul( 3.3 ) ) ) );
	const h = hash3( id ), k = hash3( id.add( 17.3 ) );
	// cover 1 puts a spot in about one cell in three.
	const on = step( h.z, cover.mul( 0.35 ) );
	const c = cell.add( h.xy.mul( 0.4 ).add( 0.3 ) ).mul( G );
	// Small spots are far more common than big ones. A third of them are
	// pores: an umbra without a penumbra.
	const Ru = S.mul( k.x.mul( k.x ).mul( 8 ).add( 3 ) ).mul( k.y.mul( 0.12 ).add( 0.38 ) );
	const Rp = Ru.div( k.y.mul( 0.12 ).add( 0.38 ) ).mul( step( 0.3, k.z ) ).max( Ru.mul( 1.05 ) );
	const v = q.sub( c );
	const r = v.length().toVar();
	const dir = v.div( r.max( 1e-6 ) );

	// Ragged borders: the field bundle is not a clean tube.
	const rag = fbm( q, S.mul( 2 ), fp, 2, 31 ).sub( 0.5 ).mul( S ).mul( 2.5 );
	const pen = clamp( Rp.add( rag ).sub( r ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
	const um = clamp( Ru.add( rag.mul( 0.4 ) ).sub( r ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );

	// Filaments: noise sampled on a circle, stretched 8 times along the
	// radius, so streaks run outward and converge toward the umbra. The
	// radius term moves outward with time (Evershed flow, 0.04 granule/s).
	// Near the centre the streaks are narrower than their period at the
	// rim, so the footprint is scaled by Rp / r before the fade.
	const s = Rp.add( r.sub( S.mul( 0.04 ).mul( t ) ).mul( 0.12 ) );
	const fpF = fp.mul( Rp.div( r.max( Ru ) ) );
	const fil = fbm( dir.mul( s ), S.mul( 0.4 ), fpF, 3, 33 );
	const wF = fadeIn( S.mul( 0.4 ), fpF, 1.5, 4.0 );

	// Inside the umbra, 0 at the centre and 1 at its border.
	const ru = r.div( Ru ).clamp( 0, 1 );
	const halo = smoothstep( Rp, Rp.mul( 3.5 ), r ).oneMinus().mul( on );
	return { pen, um, fil, wF, ru, halo };

}
