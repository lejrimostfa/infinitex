// Hand-knotted rug. Each knot is a short length of dyed wool tied around
// two warps and cut, so its two ends stand up as one small tuft. Rows of
// knots are beaten down between wefts; the pile is clipped level (5 to
// 10 mm) and leans toward the end the weaver started from.
//   L0 design  one colour per knot from the cartoon (rugpattern.js), with
//              abrash: bands across the rug where a new dye lot started
//   L1 knots   2 to 3 mm wide, 2 to 2.5 mm per row (about 25 to 50 knots
//              per cm2). Each tuft is a soft blob shifted down the lean,
//              the knot above lies over its top; a faint seam splits the
//              two ends of the knot
//   L2 fibres  wool fibres (25 to 40 um) end as round dots
// Optional rug ends (fringe = 1): a flat-woven kilim band, then the warp
// threads left free as a fringe over the floor.

import { vec2, vec3, float, floor, fract, sqrt, mix, smoothstep, step, clamp, exp, mod, sin } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { fibreEnds } from './fibres.js';
import { rugColor } from './rugpattern.js';

const FRINGE = 0.012, KILIM = 0.007; // meters, for a 300 mm rug

export function buildKnot( p, fp, u, B ) {

	const k = vec2( u.knotM, u.rowM );
	const q = p.div( k );
	const kid = floor( q ), f = fract( q ).sub( 0.5 );
	const wK = fadeIn( u.knotM, fp, 1.5, 4.0 ).toVar();
	const s = u.rugM.div( 0.3 );
	const inset = u.fringe ? s.mul( FRINGE + KILIM ) : float( 0 );
	let col = vec3( 0 ), shade = float( 0.55 ), cov = float( 0 ), slope = vec2( 0 );
	// This knot, then the one above whose tuft leans down over it.
	for ( let j = 0; j <= 1; j ++ ) {

		const id = kid.add( vec2( 0, j ) );
		const h = hash3( id.add( u.seed.mul( 3 ) ) );
		const kc = id.add( 0.5 ).mul( k );
		// Abrash: the dye lot changes every 6 to 20 rows.
		const lot = floor( kc.y.div( u.rowM.mul( 13 ) ).add( valueNoise( vec2( kc.y.div( u.rowM.mul( 40 ) ), 1.3 ) ).mul( 2 ) ) );
		const abr = hash1( vec2( lot, 8.8 ) ).sub( 0.5 ).mul( u.abrash ).mul( 0.35 ).add( 1 );
		const c = rugColor( kc, u, inset ).mul( abr ).mul( h.x.sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
		const rel = f.sub( vec2( h.y.sub( 0.5 ).mul( 0.2 ), h.z.sub( 0.5 ).mul( 0.15 ).add( j - 0.25 ) ) );
		const e = rel.div( vec2( 0.64, 0.68 ) );
		const rr = e.length();
		// Wool tufts have fuzzy rims, about a quarter of a knot wide.
		const cv = clamp( float( 1 ).sub( rr ).mul( u.knotM.mul( 0.64 ) ).div( fp.max( u.knotM.mul( 0.25 ) ) ).add( 0.5 ), 0, 1 );
		const qd = rr.clamp( 0, 0.97 );
		const dome = sqrt( float( 1 ).sub( qd.mul( qd ) ) );
		const seam = float( 1 ).sub( exp( rel.x.mul( rel.x ).div( 0.0049 ).negate() ).mul( 0.1 ) );
		const sh = smoothstep( 0.0, 0.7, dome ).mul( 0.18 ).add( 0.82 ).mul( seam );
		col = j === 0 ? c : mix( col, c, cv );
		shade = mix( shade, sh, cv );
		slope = mix( slope, e.mul( 0.2 ).div( dome.max( 0.4 ) ), cv );
		cov = cov.max( cv );

	}

	// Wool texture inside a tuft: fibres in small locks, streaks along the
	// lean, a few fibres wide.
	const lat = vec2( B.dir.y.negate(), B.dir.x );
	const wl = u.strandW.mul( 2.5 );
	const wn = valueNoise( vec2( p.dot( B.dir ).div( wl.mul( 2.5 ) ), p.dot( lat ).div( wl ) ).add( u.seed.mul( 11 ) ) );
	const wool = wn.sub( 0.5 ).mul( 0.35 ).mul( fadeIn( wl, fp, 1.5, 4.0 ) ).mul( wK ).add( 1 );
	const F = fibreEnds( p, fp, B.dir, B.lean.mul( 0.5 ), u.strandW.mul( 1.5 ), u.strandW.mul( 0.5 ), u.seed );
	const fShade = mix( float( 0.62 ), F.shade.mul( 1.1 ).add( 0.1 ), F.w );
	const deep = float( 1 ).sub( u.lockDepth );
	const knotShade = mix( float( 0.82 ), mix( deep, shade, cov ), wK );
	let color = col.mul( knotShade ).mul( fShade.mul( 1.4 ) ).mul( wool ).mul( B.viewShade );
	let sl = slope.mul( wK ).add( F.slope.mul( F.w ) );
	let cavity = float( 1 ).sub( cov ).mul( wK );

	if ( u.fringe ) {

		// Rug ends along y: fringe (warp threads), then the kilim band.
		const yy = mod( p.y, u.rugM );
		const de = yy.min( u.rugM.sub( yy ) );
		const inFringe = step( de, s.mul( FRINGE ) );
		const inKilim = step( de, s.mul( FRINGE + KILIM ) ).sub( inFringe );
		// Kilim: tight weft stripes across, plain weave.
		const wy = de.div( u.rowM.mul( 0.25 ) );
		const kil = mix( u.ivory, u.red, step( 0.6, fract( de.div( s.mul( 0.0035 ) ) ) ) ).mul( sin( p.x.div( u.knotM.mul( 0.5 ) ).mul( Math.PI ) ).mul( sin( wy.mul( Math.PI ) ) ).mul( 0.15 ).mul( fadeIn( u.knotM, fp, 2, 5 ) ).add( 0.8 ) );
		// Fringe: pairs of warps every knot, twisted cotton over the floor.
		const fx = fract( p.x.div( u.knotM ) ).sub( 0.5 );
		const warpW = u.knotM.mul( 0.3 ).mul( valueNoise( vec2( floor( p.x.div( u.knotM ) ), de.div( 0.004 ) ) ).mul( 0.4 ).add( 0.8 ) );
		const wc = clamp( warpW.sub( fx.abs().mul( u.knotM ) ).div( fp ).add( 0.5 ), 0, 1 );
		const tw = sin( de.div( u.knotM.mul( 0.4 ) ).add( fx.mul( 6 ) ).mul( Math.PI ) ).mul( 0.12 ).mul( fadeIn( u.knotM.mul( 0.4 ), fp, 2, 5 ) ).add( 0.85 );
		const fr = mix( vec3( 0.035 ), u.ivory.mul( tw ).mul( sqrt( float( 1 ).sub( fx.mul( fx ).div( 0.09 ) ).max( 0 ) ).mul( 0.35 ).add( 0.65 ) ), wc );
		const fringeCol = mix( u.ivory.mul( 0.45 ), fr, fadeIn( u.knotM, fp, 1.5, 4 ) );
		color = mix( mix( color, kil, inKilim ), fringeCol, inFringe );
		sl = sl.mul( float( 1 ).sub( inFringe.add( inKilim ) ) ).add( vec2( fx.mul( - 1.2 ).mul( wc ), 0 ).mul( inFringe ) );
		cavity = mix( cavity, float( 1 ).sub( wc ), inFringe );

	}

	const s2 = float( 1 ).sub( wK ).mul( 0.08 ).add( float( 1 ).sub( F.w ).mul( 0.05 ) );
	return { color, slope: sl, s2, cavity, rough: u.roughness, sheenColor: u.ivory.mul( 0.6 ) };

}

