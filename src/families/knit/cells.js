// Knit patterns L1: the topmost yarn piece among a list of candidates.
// Same job as stitchLevel() in stitch.js (which stays the jersey path),
// but every candidate brings its own shape, radius, arch, lift and mask,
// so knit legs, purl bumps, crochet posts and yarn overs mix in one fabric.
//
// A candidate: { q, cell, sh, R, arch, lift, mask, side, shear }
//   q     point in the candidate's cell frame (stitch widths)
//   cell  vec2 id of its stitch (hashes, colour)
//   sh    shape { p0, dir, len, bow } (elements.js, or u.left / u.right)
//   lift  height added to the piece (stitch widths): raised rib columns,
//         garter ridges, cables over the ground
//   mask  1 where this stitch exists (a purl cell has no knit legs)
//   shear dx/dy of a cable frame: legs follow the strand as it travels
// No branches: every candidate is evaluated and kept with pick().

import { vec2, vec3, float, smoothstep, step, sqrt, asin, cos, max, clamp, mix, PI } from 'three/tsl';
import { pick } from '../../core/lod.js';
import { jitterLeg, legEval } from './stitch.js';

export function topPiece( u, items, fp, w1 ) {

	let bz = float( - 10 ), brn = float( 0 ), bt = float( 0 ), bcore = float( 1 ), bside = float( - 1 );
	let bcell = vec2( 0 ), bedge = float( - 1 ), z2 = float( - 10 ), blift = float( 0 );
	let bdir = vec2( 0, 1 ), blen = float( 1 ), bR = u.R, barch = u.arch;
	const evals = [];
	for ( const it of items ) {

		const jl = jitterLeg( u, it.sh, it.R, it.cell, it.side );
		const arch = it.arch.add( jl.arch );
		const r = legEval( it.q, jl.sh, jl.R, arch );
		const on = it.mask;
		const z = pick( on, r.z.add( it.lift ), float( - 10 ) ).toVar();
		const edge = pick( on, r.edge, float( 1e3 ) );
		const zEdge = pick( on, r.zEdge.add( it.lift ), float( - 10 ) );
		const dir = it.shear ? vec2( it.sh.dir.x.add( it.shear.mul( it.sh.dir.y ) ), it.sh.dir.y ).normalize() : it.sh.dir;
		const win = float( 1 ).sub( step( z, bz ) ).toVar(); // 1 when z > bz
		z2 = z2.max( z.min( bz ) ).toVar();
		bz = pick( win, z, bz ).toVar();
		brn = pick( win, r.rn, brn ).toVar();
		bt = pick( win, r.t, bt ).toVar();
		bcore = pick( win, r.core, bcore ).toVar();
		bside = pick( win, float( it.side ), bside ).toVar();
		bcell = pick( win, it.cell, bcell ).toVar();
		bedge = pick( win, r.edge, bedge ).toVar();
		blift = pick( win, it.lift, blift ).toVar();
		bdir = pick( win, dir, bdir ).toVar();
		blen = pick( win, it.sh.len, blen ).toVar();
		bR = pick( win, it.R, bR ).toVar();
		barch = pick( win, arch, barch ).toVar();
		evals.push( { edge, zEdge } );

	}

	// Edge anti-aliasing, as in stitch.js: the border of the winner, or of
	// a piece that just misses this point and would lie on top of it.
	let outEdge = float( 1e3 );
	for ( const e of evals ) {

		const occludes = step( 0, e.edge ).mul( float( 1 ).sub( step( e.zEdge, bz ) ) );
		outEdge = pick( occludes, e.edge.min( outEdge ), outEdge ).toVar();

	}

	const edgePx = bedge.negate().max( 0 ).min( outEdge ).mul( u.stitchW ).div( fp );
	const covered = step( - 1, bz ).toVar();
	const creasePx = bz.sub( z2 ).mul( u.stitchW ).div( fp );
	const edgeFade = pick( covered, smoothstep( 0.0, 1.0, edgePx.min( creasePx ) ), smoothstep( 0.0, 1.0, outEdge.mul( u.stitchW ).div( fp ) ) ).toVar();
	const perp = vec2( bdir.y, bdir.x.negate() );
	const core = max( bcore, 0.05 );
	const archSlope = barch.mul( bR ).mul( PI ).mul( cos( PI.mul( bt ) ) ).div( blen );

	// Prefiltered yarn normal over the pixel footprint (see stitch.js).
	const Rm = bR.mul( u.stitchW ).toVar();
	const kr = fp.div( Rm ).mul( 0.5 ).max( 1e-4 );
	const ra = clamp( brn.sub( kr ), - 1, 1 ), rb = clamp( brn.add( kr ), - 1, 1 );
	const F = ( x ) => x.mul( sqrt( max( float( 0 ), float( 1 ).sub( x.mul( x ) ) ) ) ).add( asin( x ) ).mul( 0.5 );
	const span = rb.sub( ra ).max( 1e-4 );
	const mx = ra.add( rb ).mul( 0.5 );
	const mz = F( rb ).sub( F( ra ) ).div( span );
	const nYarnAvg = vec3( perp.mul( mx ).sub( bdir.mul( archSlope ).mul( mz ) ), mz );
	const yarnLen = nYarnAvg.length().clamp( 0.2, 1 );
	const s2Yarn = float( 1 ).sub( yarnLen ).div( yarnLen ).mul( covered ).mul( w1 ).toVar();
	const nYarn = mix( vec3( 0, 0, 1 ), nYarnAvg.div( yarnLen ), edgeFade.mul( 0.8 ).add( 0.2 ) ).normalize();

	return {
		bz, brn, bt, bside, bcol: bcell.x, brow: bcell.y, covered, edgeFade, dir: bdir, len: blen, perp, core, Rm, w1, nYarn, s2Yarn,
		blift, local: bz.sub( blift ),
	};

}
