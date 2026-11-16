// Knit L1: the stitch level. Finds the topmost V leg at this point, fades
// every hard edge (leg border, crease) within one pixel, and returns the
// prefiltered yarn normal. Used by shader.js.
//
// No branches: every candidate is evaluated and chosen with pick() (a mix by
// a 0/1 step). TSL compiles select() to if/else, which re-emits whole
// subtrees per branch: the shader grew to 117k lines and killed WebGL2.

import {
	vec2, vec3, float, floor, smoothstep, step, sin, cos, asin, sqrt, max, clamp, mix, PI,
	positionView, normalView, tangentView, bitangentView,
} from 'three/tsl';
import { pick } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { CANDIDATES } from './legs.js';
import { AO_BACKGROUND, AO_MIN } from './stats.js';

// A knitter's tension is never even: each stitch gets its own small shift,
// yarn thickness and bow. Zero mean, so the CPU statistics (stats.js) hold.
export function jitterLeg( u, sh, R, id, side ) {

	const j = hash3( id.add( vec2( side * 0.37, u.seed ) ) ).sub( 0.5 ).mul( u.irregular );
	const k = hash3( id.add( vec2( 13.1 + side, u.seed.add( 7 ) ) ) ).sub( 0.5 ).mul( u.irregular );
	const shJ = {
		p0: sh.p0.add( vec2( j.x.mul( 0.10 ), j.y.mul( 0.08 ) ) ),
		dir: sh.dir, len: sh.len,
		bow: sh.bow.mul( k.x.mul( 1.2 ).add( 1 ) ),
	};
	return { sh: shJ, R: R.mul( j.z.mul( 0.18 ).add( 1 ) ), arch: k.y.mul( 0.5 ) };

}

// One leg at local point q. Mirrors legEvalCPU() in legs.js.
export function legEval( q, sh, R, arch ) {

	const w = q.sub( sh.p0 );
	const proj = w.dot( sh.dir );
	const t = clamp( proj.div( sh.len ), 0, 1 );
	const perp = vec2( sh.dir.y, sh.dir.x.negate() );
	const off = w.dot( perp ).sub( sh.bow.mul( sin( PI.mul( t ) ) ) );
	const along = proj.sub( t.mul( sh.len ) );
	const rn = off.div( R );
	const al = along.div( R );
	const r2 = rn.mul( rn ).add( al.mul( al ) );
	const core = sqrt( max( float( 0 ), float( 1 ).sub( r2 ) ) );
	const zEdge = arch.mul( R ).mul( sin( PI.mul( t ) ) );
	const inside = step( r2, 1 ); // 1 when r2 <= 1
	const z = pick( inside, R.mul( core ).add( zEdge ), float( - 10 ) ).toVar();
	// Signed distance to the leg border, in stitch widths (< 0 inside).
	const edge = sqrt( r2 ).sub( 1 ).mul( R ).toVar();
	return { z, rn: rn.toVar(), t: t.toVar(), core: core.toVar(), zEdge: zEdge.toVar(), edge };

}

// Mirrors stitchAOCPU() in stats.js.
export function stitchAO( z, R, arch ) {

	const top = R.mul( arch.add( 1 ) );
	const k = clamp( z.add( R.mul( 0.2 ) ).div( top.add( R.mul( 0.2 ) ) ), 0, 1 );
	return pick( step( - 1, z ), mix( float( AO_MIN ), float( 1 ), k.pow( 0.8 ) ), float( AO_BACKGROUND ) );

}

// Height of the topmost leg at p (stitch widths), for the parallax probe.
function topHeight( u, p ) {

	const col = floor( p.x ), row = floor( p.y.div( u.aspect ) );
	const local = vec2( p.x.sub( col ), p.y.sub( row.mul( u.aspect ) ) ).toVar();
	let bz = float( - 10 );
	for ( const [ dc, dr, side ] of CANDIDATES ) {

		const q = local.sub( vec2( float( dc ), u.aspect.mul( dr ) ) );
		const jl = jitterLeg( u, side < 0 ? u.left : u.right, u.R, vec2( col.add( dc ), row.add( dr ) ), side );
		bz = bz.max( legEval( q, jl.sh, jl.R, u.arch.add( jl.arch ) ).z ).toVar();

	}

	return bz;

}

// w1: fadeIn( stitchW, fp, 4, 12 ) as a variable, from shader.js.
export function stitchLevel( u, uvm, fp, w1 ) {

	const R = u.R, arch = u.arch;
	// Rows and columns wander a little, like hand knitting.
	const p0 = uvm.div( u.stitchW );
	const wob = vec2( valueNoise( p0.div( 7 ) ), valueNoise( p0.div( 7 ).add( 37.7 ) ) ).sub( 0.5 ).mul( u.irregular.mul( 0.35 ) );
	const pw = p0.add( wob ).toVar();
	// Parallax: the fabric surface is the top of the yarn, the grooves lie
	// below it. Probe the height once, then shift along the view ray, so
	// grooves slide behind the yarn as the camera moves. One probe is
	// enough for this shallow relief (about a third of a stitch).
	const rd = positionView.normalize();
	const vt = vec3( rd.dot( tangentView ), rd.dot( bitangentView ), rd.dot( normalView ).min( - 0.35 ) );
	const zTop = R.mul( arch.add( 1 ) );
	const depth = zTop.sub( topHeight( u, pw ) ).clamp( 0, zTop.add( R.mul( 0.3 ) ) );
	// One probe is only right at moderate angles. At grazing views the
	// shift grows past a stitch, the probe height no longer matches the
	// shifted point, and stitches fold into swirling contours that morph as
	// the camera moves. So fade the parallax out at grazing angles and cap
	// the shift at a third of a stitch.
	const facing = smoothstep( 0.3, 0.65, rd.dot( normalView ).negate() );
	const shift = vt.xy.div( vt.z.negate() ).mul( depth );
	const shiftCapped = shift.mul( float( 0.33 ).div( shift.length().max( 0.33 ) ) );
	// Up close the probe's error shows: the shift jumps between legs, so
	// plies and fibers get kinks that slide as the camera moves. Parallax
	// only helps while a stitch spans tens of pixels: fade it out once a
	// stitch is wider than about 120 px.
	const stitchPx = u.stitchW.div( fp );
	const macro = float( 1 ).sub( smoothstep( 120.0, 400.0, stitchPx ) );
	const p = pw.add( shiftCapped.mul( w1 ).mul( u.parallax ).mul( facing ).mul( macro ) ).toVar();
	const col = floor( p.x ).toVar();
	const row = floor( p.y.div( u.aspect ) ).toVar();
	const local = vec2( p.x.sub( col ), p.y.sub( row.mul( u.aspect ) ) ).toVar();

	let bz = float( - 10 ), brn = float( 0 ), bt = float( 0 ), bcore = float( 1 );
	let bside = float( - 1 ), bcol = col, brow = row, bedge = float( - 1 ), z2 = float( - 10 );
	const legs = [];
	for ( const [ dc, dr, side ] of CANDIDATES ) {

		const q = local.sub( vec2( float( dc ), u.aspect.mul( dr ) ) );
		const jl = jitterLeg( u, side < 0 ? u.left : u.right, R, vec2( col.add( dc ), row.add( dr ) ), side );
		const r = legEval( q, jl.sh, jl.R, arch.add( jl.arch ) );
		const win = float( 1 ).sub( step( r.z, bz ) ).toVar(); // 1 when r.z > bz
		z2 = z2.max( r.z.min( bz ) ).toVar(); // second highest surface
		bz = pick( win, r.z, bz ).toVar();
		brn = pick( win, r.rn, brn ).toVar();
		bt = pick( win, r.t, bt ).toVar();
		bcore = pick( win, r.core, bcore ).toVar();
		bside = pick( win, float( side ), bside ).toVar();
		bcol = pick( win, col.add( dc ), bcol ).toVar();
		brow = pick( win, row.add( dr ), brow ).toVar();
		bedge = pick( win, r.edge, bedge ).toVar();
		legs.push( r );

	}

	// Edge anti-aliasing. Distance, in pixels, to the nearest visible border:
	// the border of the winning leg, or the border of a leg that just misses
	// this point and would lie on top of it.
	let outEdge = float( 1e3 );
	for ( const r of legs ) {

		const occludes = step( 0, r.edge ).mul( float( 1 ).sub( step( r.zEdge, bz ) ) );
		outEdge = pick( occludes, r.edge.min( outEdge ), outEdge ).toVar();

	}

	const edgePx = bedge.negate().max( 0 ).min( outEdge ).mul( u.stitchW ).div( fp );
	const covered = step( - 1, bz ).toVar();
	// Where two legs interpenetrate (bz close to z2) the surface has a crease.
	// Height gap / slope (about 1) gives the distance to it.
	const creasePx = bz.sub( z2 ).mul( u.stitchW ).div( fp );
	const edgeFade = pick( covered, smoothstep( 0.0, 1.0, edgePx.min( creasePx ) ), smoothstep( 0.0, 1.0, outEdge.mul( u.stitchW ).div( fp ) ) ).toVar();
	const isLeft = step( bside, 0 ).toVar();
	const dir = pick( isLeft, u.left.dir, u.right.dir ).toVar();
	const len = pick( isLeft, u.left.len, u.right.len ).toVar();
	const perp = vec2( dir.y, dir.x.negate() );
	const core = max( bcore, 0.05 );
	const archSlope = arch.mul( R ).mul( PI ).mul( cos( PI.mul( bt ) ) ).div( len );

	// Prefiltered yarn normal: average the cylinder profile (rn, sqrt(1-rn^2))
	// over the pixel footprint, in closed form. Near the yarn border the normal
	// otherwise swings 90 degrees within a pixel and shimmers. The length the
	// averaged normal loses goes into roughness (Toksvig).
	const Rm = R.mul( u.stitchW );
	const kr = fp.div( Rm ).mul( 0.5 ).max( 1e-4 );
	const ra = clamp( brn.sub( kr ), - 1, 1 ), rb = clamp( brn.add( kr ), - 1, 1 );
	const F = ( x ) => x.mul( sqrt( max( float( 0 ), float( 1 ).sub( x.mul( x ) ) ) ) ).add( asin( x ) ).mul( 0.5 );
	const span = rb.sub( ra ).max( 1e-4 );
	const mx = ra.add( rb ).mul( 0.5 );
	const mz = F( rb ).sub( F( ra ) ).div( span );
	const nYarnAvg = vec3( perp.mul( mx ).sub( dir.mul( archSlope ).mul( mz ) ), mz );
	const yarnLen = nYarnAvg.length().clamp( 0.2, 1 );
	const s2Yarn = float( 1 ).sub( yarnLen ).div( yarnLen ).mul( covered ).mul( w1 ).toVar();
	const nYarnRaw = nYarnAvg.div( yarnLen );
	const nYarn = mix( vec3( 0, 0, 1 ), nYarnRaw, edgeFade.mul( 0.8 ).add( 0.2 ) ).normalize();

	return { bz, brn, bt, bside, bcol, brow, covered, edgeFade, dir, len, perp, core, Rm, w1, nYarn, s2Yarn };

}
