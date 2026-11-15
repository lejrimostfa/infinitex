// Knit L2 and L3: plies twisted around the winning leg, then fibers inside
// each ply. Both perturb the yarn normal from stitch.js and fade in by
// pixel size. Each V groove fades to its mean within one pixel.

import {
	vec2, vec3, float, floor, smoothstep, step, fract, cos, asin, sqrt, clamp, PI,
	mx_cell_noise_float, mx_noise_float,
} from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';

export function plyLevel( u, s, fp ) {

	const { brn, bt, bside, bcol, brow, len, dir, perp, core, Rm, covered, w1, nYarn } = s;
	const alongM = bt.mul( len ).mul( u.stitchW );
	const phi = asin( clamp( brn, - 0.999, 0.999 ) );
	const legHash = mx_cell_noise_float( vec3( bcol, brow.add( bside.mul( 0.5 ) ), u.seed ) ).toVar();
	// Twist is never even: it drifts along the yarn (about every 3 mm).
	const twistDrift = valueNoise( vec2( alongM.div( 0.003 ), legHash.mul( 50 ) ) ).sub( 0.5 ).mul( u.irregular.mul( 0.5 ) );
	const plyCoord = alongM.mul( u.plyTwistPerM ).add( u.twistSign.mul( phi ).div( PI.mul( 2 ) ) ).add( legHash ).add( twistDrift ).mul( u.plyCount );
	const v = fract( plyCoord ).toVar();
	const plyIdx = floor( plyCoord ).add( legHash.mul( 97 ) ).toVar();
	const dvda = u.plyCount.mul( u.plyTwistPerM );
	const dvds = u.twistSign.mul( u.plyCount ).div( PI.mul( 2 ).mul( Rm ) );
	const gl = sqrt( dvda.mul( dvda ).add( dvds.mul( dvds ) ) );
	const plyPeriod = float( 1 ).div( gl );
	const w2 = fadeIn( plyPeriod, fp ).mul( covered ).mul( w1 ).toVar();
	const plyDepthM = u.plyDepth.mul( Rm );
	// Crease anti-aliasing: the groove between two plies is a V crease, so
	// within one pixel of it the perturbation fades to its average (zero).
	const plyEdge = smoothstep( 0.0, 1.0, v.min( float( 1 ).sub( v ) ).mul( plyPeriod ).div( fp ) ).toVar();
	const kPly = plyDepthM.mul( PI ).mul( cos( PI.mul( v ) ) ).mul( plyEdge );
	const along3 = vec3( dir, 0 );
	const around3 = vec3( perp.mul( core ), brn.negate() );
	const nPly = nYarn.sub( along3.mul( dvda ).add( around3.mul( dvds ) ).mul( kPly ).mul( w2 ) ).normalize();
	const s2Ply = plyDepthM.mul( PI ).mul( gl ).pow( 2 ).mul( 0.5 );

	return { alongM, phi, v, plyIdx, dvda, dvds, gl, plyPeriod, w2, plyEdge, along3, around3, nPly, s2Ply };

}

// Fibers: round profile across, tapered tips, so the mean width is below 1.
// MEAN_W is the mean of 0.35 + 0.65 * taper over a segment (computed offline).
const FIBER_AMP = 0.3 * Math.PI;
const MEAN_W = 0.922 * 0.975; // taper times the mean diameter factor 0.75 + 0.45 U
const E_DEPTH2 = 0.8 * 0.8 + 0.8 * 0.8 / 12; // depth uniform in [0.4, 1.2]
// Cuticle scales: sawtooth slope along the fiber, one edge every ~9 um.
const SCALE_AMP = 0.35;
export const S2_SCALE = SCALE_AMP ** 2 / 12 * MEAN_W;
// Across: x uniform in [-1, 1] over a fraction MEAN_W, so E[x^2] = MEAN_W / 3.
export const S2_FIBER = FIBER_AMP ** 2 * E_DEPTH2 * MEAN_W / 3 + S2_SCALE;
// Mean of the fiber gap darkening: 1 - 0.3 * depth * (1 - profile).
export const AO_FIBER_MEAN = 1 - 0.3 * 0.8 * ( 1 - MEAN_W * Math.PI / 4 );

export function fiberLevel( u, s, ply, fp ) {

	const { Rm } = s;
	const { alongM, phi, v, plyIdx, dvda, dvds, gl, plyPeriod, w2, along3, around3, nPly } = ply;
	const fd = u.fiberDiam;
	const g = vec2( dvda, dvds ).div( gl );
	const sM = phi.mul( Rm );
	const alongPly = alongM.mul( g.y.negate() ).add( sM.mul( g.x ) );
	const uf = v.mul( plyPeriod ).div( fd );
	// Organic lanes: slow wandering (wiggle), wool crimp (short waves) and
	// uneven spacing. Every offset varies slowly across the ply: offsets that
	// change fast across lanes squeeze them into wood-grain contours.
	const wig = mx_noise_float( vec3( alongPly.div( fd.mul( 30 ) ), uf.mul( 0.1 ), plyIdx ) ).mul( u.fiberWiggle );
	const crimp = mx_noise_float( vec3( alongPly.div( fd.mul( 9 ) ), uf.mul( 0.06 ), plyIdx.add( 3 ) ) ).mul( u.irregular.mul( 0.3 ) );
	const spacing = valueNoise( vec2( uf.mul( 0.12 ), alongPly.div( fd.mul( 150 ) ).add( plyIdx.mul( 7 ) ) ) ).sub( 0.5 ).mul( u.irregular.mul( 0.6 ) );
	const across0 = uf.add( u.fiberTan.mul( alongPly ).div( fd ) ).add( wig ).add( crimp ).add( spacing );
	// Fibers are finite: split each lane into segments of random length and
	// shift every segment sideways, so fibers end, overlap and stagger.
	const lane = floor( across0 );
	const laneH = hash1( vec2( lane, plyIdx ) );
	const segCoord = alongPly.div( fd.mul( laneH.mul( 50 ).add( 35 ) ) ).add( mx_cell_noise_float( vec3( lane, plyIdx, 3 ) ) );
	const seg = floor( segCoord );
	const sf = fract( segCoord );
	const shift = mx_cell_noise_float( vec3( lane, seg, plyIdx ) ).sub( 0.5 ).mul( 0.9 );
	// Each fiber segment has its own small angle, so neighbours cross.
	const segLen = laneH.mul( 50 ).add( 35 );
	const tilt = hash1( vec2( seg.add( 0.5 ), lane.add( plyIdx.mul( 0.31 ) ) ) ).sub( 0.5 ).mul( u.irregular.mul( 0.035 ) );
	const acrossF = across0.add( shift ).add( tilt.mul( sf.sub( 0.5 ) ).mul( segLen ) );
	const fl = fract( acrossF ).toVar();
	const fIdx = floor( acrossF ).add( seg.mul( 0.137 ) ).toVar();
	const fDepth = mx_cell_noise_float( vec3( fIdx, plyIdx, 11 ) ).mul( 0.8 ).add( 0.4 ); // mean 0.8
	const w3 = fadeIn( fd, fp ).mul( w2 ).toVar();
	// Tapered tips: a fiber narrows over the last 12 % of its segment.
	const diam = hash1( vec2( fIdx, plyIdx.add( 5 ) ) ).mul( 0.45 ).add( 0.75 ); // 17 to 25 um for 21 um
	const width = smoothstep( 0, 0.12, sf ).mul( smoothstep( 1, 0.88, sf ) ).mul( 0.65 ).add( 0.35 ).mul( diam );
	const x = fl.sub( 0.5 ).div( width.mul( 0.5 ) ).toVar(); // -1..1 inside the fiber
	const inside = step( x.abs(), 1 );
	// Prefilter across the fiber over the pixel footprint, in closed form:
	// the round profile sqrt(1 - x^2) and the slope -x, averaged over
	// [x - k, x + k] (zero outside the fiber). Fading to the global mean near
	// the edges instead made thin fibers read too bright: the border is darker
	// than the mean.
	const k = fp.div( fd.mul( width ) ).max( 1e-4 ); // half footprint in x units
	const xa = clamp( x.sub( k ), - 1, 1 ), xb = clamp( x.add( k ), - 1, 1 );
	const F = ( q ) => q.mul( sqrt( float( 1 ).sub( q.mul( q ) ).max( 0 ) ) ).add( asin( q ) ).mul( 0.5 );
	const profile = F( xb ).sub( F( xa ) ).div( k.mul( 2 ) ).toVar();
	const slopeAvg = xb.mul( xb ).sub( xa.mul( xa ) ).mul( 0.5 ).div( k.mul( 2 ) ).negate();
	// Lane border: a different fiber starts there, its depth jumps.
	const fiberEdge = smoothstep( 0.0, 1.0, fl.min( float( 1 ).sub( fl ) ).mul( fd ).div( fp ) ).toVar();
	const acrossDir3 = along3.mul( g.x ).add( around3.mul( g.y ) );
	const alongDir3 = along3.mul( g.y.negate() ).add( around3.mul( g.x ) );
	// Cuticle scales: irregular rings along the fiber, faded by their own size.
	const scaleCoord = alongPly.div( fd.mul( 0.43 ) ).add( mx_noise_float( vec3( alongPly.div( fd.mul( 2 ) ), fIdx, 7 ) ).mul( 0.6 ) ).add( x.mul( 0.25 ) );
	const st = fract( scaleCoord );
	const w4 = fadeIn( fd.mul( 0.43 ), fp ).mul( w3 ).toVar();
	const scaleEdge = smoothstep( 0.0, 1.0, st.min( float( 1 ).sub( st ) ).mul( fd.mul( 0.43 ) ).div( fp ) );
	const tiltAlong = st.sub( 0.5 ).mul( SCALE_AMP ).mul( inside ).mul( w4 ).mul( scaleEdge );
	const tiltAcross = slopeAvg.mul( fDepth ).mul( FIBER_AMP ).mul( w3 ).mul( fiberEdge );
	const nFiber = nPly.sub( acrossDir3.mul( tiltAcross ) ).sub( alongDir3.mul( tiltAlong ) ).normalize();

	return { fl, fIdx, fDepth, profile, w3, w4, fiberEdge, nFiber };

}
