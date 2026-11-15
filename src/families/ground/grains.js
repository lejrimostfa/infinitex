// Shared blocks of the ground family.
//   grains   one layer of packed rounded grains on a Voronoi net: each
//            grain a dome that rounds off at its border, a gap between
//            neighbours, an analytic slope, a hash per grain
//   packed   two layers: small grains sit lower and show in the gaps of
//            the big ones, so the pack never looks like one tiling
//   fbm      a few octaves of value noise
//   line     a line of half width w, anti-aliased by the footprint
//   fibres   loose curved fibres lying on the surface, one per cell at most
// Heights are in units of the grain size; slopes are dh/dp in meters per
// meter, so a level hands them straight to perturbNormal.

import { vec2, float, clamp, mod, step, floor, sin, cos } from 'three/tsl';
import { pick, fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

export const line = ( d, w, fp ) => clamp( w.sub( d.abs() ).div( fp ).add( 0.5 ), 0, 1 );

export function fbm( q, octaves = 3 ) {

	let s = float( 0 ), a = 0.5, f = q;
	for ( let i = 0; i < octaves; i ++ ) {

		s = s.add( valueNoise( f ).mul( a ) );
		f = f.mul( 2.03 ).add( 5.17 );
		a *= 0.5;

	}

	return s.div( 1 - a * 2 );

}

// o: { gap, radius, elong, round, crown, tilt, sizeVar, jitter }.
// gap: empty border around each grain (cells), larger for some grains
// when sizeVar > 0; radius, elong: the ellipse that rounds the cell;
// round: width over which the border rounds off; crown: how domed the
// top is; tilt: a random lean per grain (facets that glint).
export function grains( p, sizeM, fp, salt, o = {} ) {

	const jitter = o.jitter ?? 0.9, round = float( o.round ?? 0.3 ), crown = float( o.crown ?? 0.3 );
	// mod: hashes stay exact far from the origin (core/hash.js).
	const v = voronoi( mod( p.div( sizeM ), 4096 ).add( salt ), jitter );
	const id = hash3( v.id1.add( salt * 1.37 ) ).toVar();
	const gap = float( o.gap ?? 0.05 ).add( id.x.mul( o.sizeVar ?? 0 ).mul( 0.18 ) );
	const ea = v.edge.sub( gap );
	// Rounded grain: the cell border blended (smooth min) with an ellipse
	// around the seed, so the outline is round and has no crease.
	const ax = id.yz.sub( 0.5 ).normalize();
	const k = float( o.elong ?? 0.6 ).mul( id.z );
	const ts = v.toSeed.add( ax.mul( v.toSeed.dot( ax ).mul( k ) ) );
	const r = ts.length().max( 1e-4 );
	const eb = float( o.radius ?? 0.6 ).sub( gap ).sub( r );
	const sk = 0.05;
	const xa = ea.negate().div( sk ).exp(), xb = eb.negate().div( sk ).exp();
	const e = xa.add( xb ).log().mul( - sk ).toVar();
	const wa = xa.div( xa.add( xb ) );
	const dE = v.dir.negate().mul( wa ).sub( ts.add( ax.mul( ts.dot( ax ).mul( k ) ) ).div( r ).mul( wa.oneMinus() ) );
	// Profile: steep flanks, round top (1 - (1 - s)^3).
	const s = clamp( e.div( round ), 0, 1 );
	const s1 = s.oneMinus();
	const prof = float( 1 ).sub( s1.mul( s1 ).mul( s1 ) );
	const inRamp = step( 0, e ).mul( step( e, round ) );
	const dProf = dE.mul( s1.mul( s1 ).mul( 3 ).div( round ).mul( inRamp ) );
	const r2 = v.toSeed.dot( v.toSeed );
	const cap = float( 1 ).sub( crown.mul( r2 ) ).max( 0 );
	const dCap = v.toSeed.mul( crown.mul( - 2 ) ).mul( step( 0, cap ) );
	const tilt = id.yz.sub( 0.5 ).mul( o.tilt ?? 0 ).mul( step( 0, e ) );
	// Outside the grain the height keeps falling into the gap, so a lower
	// layer (packed) can show there.
	const out = e.min( 0 );
	const h = prof.mul( cap ).add( out.mul( 2 ) ).toVar();
	const grad = dProf.mul( cap ).add( dCap.mul( prof ) ).add( tilt ).add( dE.mul( step( e, 0 ).mul( 2 ) ) );
	// Grain body, anti-aliased at its border; 0 in the gap.
	const body = clamp( e.mul( sizeM ).div( fp ).add( 0.5 ), 0, 1 );
	return { v, id, h, grad, body, e };

}

// Two layers of grains, the small one lower. Returns the grain on top.
// lift: how far below the big grains the small ones sit (grain units).
export function packed( p, sizeM, fp, salt, o = {} ) {

	const A = grains( p, sizeM, fp, salt, o );
	const ratio = o.ratio ?? 0.55;
	const B = grains( p.add( vec2( 0.37, 0.71 ).mul( sizeM ) ), sizeM.mul( ratio ), fp, salt + 17.3, o );
	const hB = B.h.mul( ratio ).sub( o.lift ?? 0.25 );
	const top = step( hB, A.h ).toVar();
	const h = pick( top, A.h, hB ).max( - 0.4 ).toVar();
	return {
		top, h,
		id: pick( top, A.id, B.id ).toVar(),
		grad: pick( top, A.grad, B.grad ),
		body: pick( top, A.body, B.body.mul( 0.8 ) ),
		toSeed: pick( top, A.v.toSeed, B.v.toSeed ),
		A, B,
	};

}

// Fibres (roots, lint, hyphae): each cell of a grid may hold one curved
// fibre through its centre, any direction, about two cells long, so the
// 3 x 3 neighbours are searched. share: how many cells hold one. Returns
// the cover (0..1, AA), a cross slope that rounds the fibre, and a hash.
export function fibres( p, cellM, w, share, fp, salt, curl = 0.35 ) {

	const q = mod( p.div( cellM ), 4096 );
	const c0 = floor( q );
	let cover = float( 0 ), slope = vec2( 0 ), tone = float( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = c0.add( vec2( ox, oy ) );
		const h = hash3( id.add( salt ) );
		const h2 = hash3( id.add( salt + 31.7 ) );
		const ang = h.x.mul( 6.2832 );
		const dir = vec2( cos( ang ), sin( ang ) ), nrm = vec2( sin( ang ).negate(), cos( ang ) );
		const lp = q.sub( id.add( 0.5 ).add( h.yz.sub( 0.5 ).mul( 0.6 ) ) );
		const t = lp.dot( dir );
		const len = h2.y.mul( 0.7 ).add( 0.5 );
		const bend = valueNoise( vec2( t.mul( 1.3 ), h2.z.mul( 50 ) ) ).sub( 0.5 ).mul( curl * 2 );
		const d = lp.dot( nrm ).sub( bend ).mul( cellM );
		const taper = clamp( float( 1 ).sub( t.div( len ).pow( 2 ) ), 0, 1 ).sqrt();
		const ww = w.mul( taper ).mul( h2.x.mul( 0.6 ).add( 0.6 ) );
		const f = line( d, ww, fp ).mul( step( h2.x, share ) ).toVar();
		const on = step( cover, f );
		cover = cover.max( f );
		slope = pick( on, nrm.mul( d.div( ww.max( 1e-9 ) ).clamp( - 1, 1 ) ).mul( - 0.9 ).mul( f ), slope );
		tone = pick( on, h2.z, tone );

	}

	// A fibre thinner than a pixel or two fades out instead of aliasing.
	const wide = fadeIn( w.mul( 2 ), fp, 0.7, 2.0 );
	return { fiber: cover.mul( wide ), slope: slope.mul( wide ), tone };

}
