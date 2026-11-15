// Solid wood, the anatomy of a board from the log down to the cell wall.
//   L0 rings   growth rings as a distance from the pith; the cut plane
//              decides what they look like: flat sawn (cathedral arches),
//              quarter sawn (straight lines), rotary peeled (broad flames).
//              Each ring: light earlywood, then dense dark latewood that
//              stops sharply where the next spring starts.
//   L0 knots   a branch cut across: its own rings, a dark rim, cracks; the
//              rings of the trunk bulge around it into an eye
//   L1 rays    ribbons of cells running from the pith outward, seen on a
//              flat-sawn face as short spindles along the grain
//   L1 pores   vessels cut open: grooves along the grain, gathered in the
//              earlywood (ring porous: oak, ash) or spread (maple)
//   L2 fibres  long cells side by side, each cut open, with pits on the walls
// Everything is in the grain frame: x along the grain, y across.
//
// Returns { color, slope, cavity, rough, s2, late, phase, F } for shader.js.

import { vec2, float, floor, fract, sqrt, mix, smoothstep, step, sin, cos, exp, clamp, abs, atan, mod, dFdx, dFdy } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';

export function grainFrame( p, u ) {

	const d = vec2( cos( u.angle ), sin( u.angle ) ), n = vec2( sin( u.angle ).negate(), cos( u.angle ) );
	// Slope in the grain frame (along, across) back to surface coordinates.
	return { d, n, x: p.dot( d ).toVar(), y: p.dot( n ).toVar(), toP: ( g ) => d.mul( g.x ).add( n.mul( g.y ) ) };

}

// Knots on a loose grid (one every 16 cm along, 11 cm across, at most).
// Returns the ring bulge (meters) and the nearest knot, in its own units.
export function knotField( x, y, u ) {

	const cx = 0.16, cy = 0.11;
	const q = vec2( x.div( cx ), y.div( cy ) ).add( u.seed.mul( 1.7 ) );
	const b = floor( q );
	let bump = float( 0 ), nd = float( 1e3 ), nrel = vec2( 0 ), nR = float( 1 ), nid = vec2( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = b.add( vec2( ox, oy ) );
		const h = hash3( id.add( 3.3 ) );
		const on = step( h.z, u.knots );
		const c = id.add( h.xy.mul( 0.6 ).add( 0.2 ) );
		// An oval: the branch leaves the trunk at an angle.
		const rel = vec2( q.x.sub( c.x ).mul( cx ).div( 1.5 ), q.y.sub( c.y ).mul( cy ) );
		const R = u.knotM.mul( hash1( id ).mul( 0.8 ).add( 0.6 ) );
		const dist = rel.length();
		bump = bump.add( on.mul( R ).mul( 1.4 ).mul( exp( dist.div( R.mul( 2.4 ) ).pow( 2 ).negate() ) ) );
		const dn = dist.div( R ).add( float( 1 ).sub( on ).mul( 1e3 ) );
		const closer = step( dn, nd );
		nd = pick( closer, dn, nd ).toVar(); nrel = pick( closer, rel, nrel ).toVar(); nR = pick( closer, R, nR ).toVar(); nid = pick( closer, id, nid ).toVar();

	}

	return { bump, nd, nrel, nR, nid };

}

// Ring count at a point (the phase): 1 per ring, from the pith.
export function ringPhase( x, y, u, bump ) {

	const s = u.seed;
	let r;
	if ( u.cut === 'quarter' ) {

		r = y.add( valueNoise( vec2( x.div( 0.3 ), y.div( 0.06 ) ).add( s ) ).sub( 0.5 ).mul( u.figure ).mul( u.ringM ).mul( 3 ) ).add( 1 );

	} else if ( u.cut === 'rotary' ) {

		// The knife follows a ring round a log that is never round.
		const w = valueNoise( vec2( x.div( 0.35 ), y.div( 0.12 ) ).add( s ) ).mul( 0.7 ).add( valueNoise( vec2( x.div( 0.12 ), y.div( 0.05 ) ).add( s.add( 4 ) ) ).mul( 0.3 ) );
		r = w.mul( u.ringM ).mul( u.figure.mul( 12 ).add( 3 ) ).add( y.mul( 0.02 ) ).add( 1 );

	} else {

		const z = u.cutDepthM.add( x.mul( u.cutTilt ) ).add( valueNoise( vec2( x.div( 0.4 ), y.div( 0.3 ) ).add( s ) ).sub( 0.5 ).mul( u.figure ).mul( u.ringM ).mul( 8 ) );
		const yy = y.sub( u.pithM );
		r = sqrt( yy.mul( yy ).add( z.mul( z ) ) );

	}

	r = r.add( bump ).add( valueNoise( vec2( x.div( 0.05 ), y.div( 0.02 ) ).add( s.add( 9 ) ) ).sub( 0.5 ).mul( u.figure ).mul( u.ringM ).mul( 0.6 ) );
	// Wide and narrow years.
	return r.div( u.ringM ).add( valueNoise( vec2( r.div( u.ringM.mul( 6 ) ), s ) ).sub( 0.5 ).mul( u.ringVar ).mul( 4 ) );

}

// Latewood share across a ring, 0 to 1: dense dark wood at the end of each
// year, stopping sharply where the next spring starts. Each year its own
// width and darkness. f: position in the ring.
export function latewoodProfile( phase, u ) {

	const f = fract( phase );
	const hy = hash3( vec2( floor( phase ), u.seed.add( 0.5 ) ) );
	const L = u.latewood.mul( hy.x.mul( 0.9 ).add( 0.55 ) ).min( 0.9 );
	const late = smoothstep( float( 1 ).sub( L ), float( 1 ).sub( L.mul( 0.35 ) ), f ).mul( float( 1 ).sub( smoothstep( 0.975, 1.0, f ) ) ).mul( hy.y.mul( 0.45 ).add( 0.6 ) );
	return { f, late };

}

// Vessels cut open: grooves along the grain in staggered rows. ps: distance
// across the groove in radii; taper: half width in radii (0 at the ends);
// on: this groove exists (gathered in the earlywood when ring porous).
export function poreField( x, y, f, u ) {

	const pr = u.poreM;
	const pcy = pr.mul( 3.5 ), row = floor( y.div( pcy ) );
	const pxx = x.div( pr.mul( 22 ) ).add( hash1( vec2( row, 1.3 ) ).mul( 7 ) );
	const ph = hash3( vec2( floor( pxx ), row ).add( u.seed ) );
	const pt = fract( pxx ).mul( 2 ).sub( 1 );
	const ps = fract( y.div( pcy ) ).sub( 0.5 ).sub( ph.y.sub( 0.5 ).mul( 0.4 ) ).mul( pcy ).div( pr.mul( 0.5 ) );
	const earlyBand = step( f, 0.22 ).mul( 0.95 ).add( 0.05 );
	const on = step( ph.x, u.pores.mul( mix( float( 0.45 ), earlyBand, u.ringPorous ) ) ).mul( step( 1e-6, pr ) );
	return { ps, taper: float( 1 ).sub( pt.pow( 8 ) ).max( 0 ), on, earlyBand };

}

export function buildBoard( p, fp, u ) {

	const F = grainFrame( p, u );
	const { x, y } = F;
	const K = knotField( x, y, u );
	const phase = ringPhase( x, y, u, K.bump ).toVar();

	// Earlywood to latewood, faded to its mean when rings get under a pixel.
	// Each year its own latewood width and darkness.
	const { f, late: lateRaw } = latewoodProfile( phase, u );
	const wR = float( 1 ).sub( smoothstep( 0.12, 0.45, abs( dFdx( phase ) ).add( abs( dFdy( phase ) ) ) ) );
	const late = mix( u.latewood.mul( 0.6 ), lateRaw, wR ).toVar();

	// Knot: its own rings around its centre, a dark rim, radial cracks.
	// The knot outline is never a circle.
	const ang = atan( K.nrel.y, K.nrel.x );
	const wob = valueNoise( vec2( cos( ang ), sin( ang ) ).mul( 1.6 ).add( K.nid.mul( 3.1 ) ) ).sub( 0.5 ).mul( 0.35 );
	const nd = K.nd.mul( float( 1 ).sub( wob ) );
	const kIn = clamp( float( 1 ).sub( nd ).mul( K.nR ).div( fp ).add( 0.5 ), 0, 1 ).toVar();
	const kph = nd.mul( K.nR ).div( u.ringM.mul( 0.4 ) ).add( wob.mul( 3 ) );
	const kLate = smoothstep( 0.55, 0.9, fract( kph ) ).mul( fadeIn( u.ringM.mul( 0.4 ), fp, 1.0, 3.0 ) );
	const kCrack = smoothstep( 0.992, 1.0, cos( ang.mul( 3 ).add( hash1( K.nid ).mul( 6.28 ) ) ) ).mul( smoothstep( 0.25, 0.8, nd ) );
	const kRim = smoothstep( 0.82, 0.97, nd ).mul( kIn );
	const halo = smoothstep( 2.2, 1.0, nd ).mul( float( 1 ).sub( kIn ) ).mul( 0.22 );

	// Rays: short spindles along the grain on a flat-sawn face, broad
	// flakes across it on a quarter-sawn one.
	const quarter = u.cut === 'quarter' ? 1 : 0;
	const rl = quarter ? u.rayM.mul( 0.35 ) : u.rayM, rw = quarter ? u.rayM.mul( 2.5 ) : u.rayM.mul( 0.12 );
	const rq = vec2( x.div( rl.mul( 1.7 ) ), y.div( rw.mul( 4 ) ) ).add( u.seed.mul( 5.3 ) );
	const rh = hash3( floor( rq ) );
	const rloc = fract( rq ).sub( 0.5 ).sub( rh.xy.sub( 0.5 ).mul( 0.3 ) );
	const rt = rloc.x.div( 0.42 );
	const rhw = float( 1 ).sub( rt.mul( rt ) ).max( 0 ).mul( 0.125 ); // half width, cells
	const ray = clamp( rhw.sub( rloc.y.abs() ).mul( rw.mul( 4 ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( rh.z, u.rays ) ).mul( fadeIn( rw, fp, 1.0, 3.0 ) ).toVar();

	// Pores: vessel grooves along the grain, staggered rows.
	const pr = u.poreM;
	const { ps, taper, on: pOn, earlyBand } = poreField( x, y, f, u );
	const wP = fadeIn( pr, fp, 1.5, 4.0 ).toVar();
	const pore = clamp( taper.sub( ps.abs() ).mul( pr.mul( 0.5 ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( pOn ).mul( wP ).toVar();
	const sPore = vec2( 0, ps.clamp( - 1, 1 ).mul( 0.7 ) ).mul( pore );

	// Fibres: cells side by side, cut open, staggered ends, pits on the walls.
	const fw = u.fiberM;
	const fcol = floor( y.div( fw ) ), fy = fract( y.div( fw ) );
	const fxx = x.div( fw.mul( 60 ) ).add( hash1( vec2( mod( fcol, 4093 ), 2.7 ) ).mul( 3 ) );
	const ftone = hash1( vec2( mod( fcol, 4093 ), floor( fxx ) ) ).sub( 0.5 ).mul( 0.12 );
	const wF = fadeIn( fw, fp, 2.0, 6.0 ).toVar();
	const wall = float( 1 ).sub( smoothstep( 0.0, 0.1, fy.min( float( 1 ).sub( fy ) ) ) ).mul( fadeIn( fw.mul( 0.2 ), fp, 2.5, 6.0 ) ); // thin: needs pixels, else moire
	const sFib = vec2( 0, sin( fy.mul( Math.PI * 2 ) ).mul( - 0.3 ) ).mul( wF ); // cut-open lumen, smooth across the walls
	const pq = vec2( x.div( fw.mul( 0.55 ) ), fy.sub( 0.5 ).mul( 1.8 ) );
	const pd = vec2( fract( pq.x ).sub( 0.5 ), pq.y ).length();
	const pit = smoothstep( 0.32, 0.26, pd ).mul( smoothstep( 0.12, 0.18, pd ) ).mul( step( hash1( vec2( floor( pq.x ), mod( fcol, 4093 ) ) ), 0.5 ) ).mul( fadeIn( fw.mul( 0.15 ), fp, 2.0, 5.0 ) );

	// Colour.
	const tone = valueNoise( vec2( x.div( 0.2 ), y.div( 0.08 ) ).add( u.seed.mul( 2 ) ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 );
	// Streaks along the grain: the fibres of one bundle share a shade.
	const st1 = valueNoise( vec2( x.div( 0.04 ), y.div( 0.0018 ) ).add( u.seed.mul( 6 ) ) );
	const st2 = valueNoise( vec2( x.div( 0.012 ), y.div( 0.0005 ) ).add( 3.7 ) ).mul( fadeIn( float( 0.0005 ), fp, 1.5, 4.0 ) );
	const streak = st1.sub( 0.5 ).mul( 0.16 ).add( st2.sub( 0.5 ).mul( 0.1 ) ).add( 1 );
	let color = mix( u.earlyColor, u.lateColor, late ).mul( tone ).mul( streak );
	color = color.mul( ftone.mul( wF ).add( 1 ) ).mul( float( 1 ).sub( wall.mul( 0.12 ) ) ).mul( float( 1 ).sub( pit.mul( 0.25 ) ) );
	color = mix( color, color.mul( 1.12 ).add( 0.02 ), ray.mul( 0.6 ) );
	color = color.mul( float( 1 ).sub( pore.mul( 0.55 ) ) ).mul( float( 1 ).sub( wP.oneMinus().mul( u.pores ).mul( earlyBand ).mul( 0.12 ) ) );
	const knotCol = u.knotColor.mul( mix( float( 1.2 ), float( 0.65 ), kLate ) ).mul( smoothstep( 0.0, 0.5, nd ).mul( 0.35 ).add( 0.75 ) ); // darker heart
	color = mix( color.mul( float( 1 ).sub( halo ) ), knotCol, kIn );
	color = color.mul( float( 1 ).sub( kRim.mul( 0.6 ) ) ).mul( float( 1 ).sub( kCrack.mul( kIn ).mul( 0.8 ) ) );

	const slope = F.toP( sPore.add( sFib ).mul( float( 1 ).sub( kIn.mul( 0.7 ) ) ) );
	const cavity = pore.max( kCrack.mul( kIn ) ).max( wall.mul( 0.3 ) );
	const rough = u.roughness.mul( mix( float( 1 ), float( 0.8 ), ray ) );
	const s2 = wP.oneMinus().mul( u.pores ).mul( 0.02 ).add( wF.oneMinus().mul( 0.015 ) );
	return { color, slope, cavity, rough, s2, late, phase, F, kIn, wR };

}
