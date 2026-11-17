// Three strand plaits laid side by side along v (a braided wool rug, a
// plaited band). pitch_mm is the width of one plait (about 30 mm). Levels:
//   L0 plait:   the outer strand of each side crosses over the middle in
//               turn, left, right, left. Seen from above: two rows of
//               curved segments meeting in a chevron; each segment rises
//               from the edge, crosses the middle and dives under the next
//               one with a round tip. The crossings cycle through the three
//               strands, so three colours repeat every three segments
//   L1 strand:  each strand is a soft round bundle of yarns (twist_mm wide,
//               about 1.2 mm) that follow its curve; dark creases between
//               the segments and in the sewn seam between plaits
//   L2 yarn:    each yarn is round, its plies twisted at about 20 degrees
//   L3 fibres:  wool fibres along the plies (fiber_um), light and dark
// Returns colour, slope, cavity. No holes: the plaits are sewn together.

import { vec2, float, floor, fract, clamp, smoothstep, step, sqrt, mix, abs, mod } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash1, valueNoise, wrapCoord } from '../../core/hash.js';

const pm = ( x, n ) => x.sub( floor( x.div( n ) ).mul( n ) );
const K = 0.9; // slant of the segments, along per across (half widths)
const CV = 0.35; // curve of the segments
const PD = 1.0; // segment spacing along the plait, in half widths

// Round profile of a band, phase f in 0..1: height and d height / d f.
function roundBand( f ) {

	const x = f.mul( 2 ).sub( 1 ).clamp( - 0.96, 0.96 );
	const h = sqrt( float( 1 ).sub( x.mul( x ) ) );
	return { h, d: x.div( h ).negate().mul( 2 ).clamp( - 4, 4 ) };

}

export function buildBraid( p, fp, u ) {

	const Wb = u.pitchM, half = Wb.mul( 0.5 );
	const b = floor( p.x.div( Wb ) );
	const s = fract( p.x.div( Wb ) ).sub( 0.5 ).mul( 2 );
	const wav = valueNoise( vec2( p.y.div( Wb.mul( 2 ) ), b.mul( 3.1 ) ) ).sub( 0.5 ).mul( u.irregular ).mul( 0.25 );
	const t = p.y.div( half ).add( hash1( vec2( b, 1.3 ) ).mul( 7 ) ).add( wav );
	// Curved segments: the phase bends with s^2 (banana shapes).
	const bend = s.mul( s ).mul( CV );
	const phL = t.sub( s.mul( K ) ).add( bend ).div( PD ), phR = t.add( s.mul( K ) ).add( bend ).div( PD ).add( 0.5 );
	const nL = floor( phL ), nR = floor( phR );
	const oL = nL.mul( 2 ), oR = nR.mul( 2 ).sub( 1 );
	// Each segment ends in a round tip where it dives under the next one.
	const xL = fract( phL ).mul( 2 ).sub( 1 ), xR = fract( phR ).mul( 2 ).sub( 1 );
	const vL = step( s, xL.mul( xL ).mul( - 0.3 ).add( 0.36 ) ), vR = step( xR.mul( xR ).mul( 0.3 ).sub( 0.36 ), s );
	const winL = vL.mul( float( 1 ).sub( vR ).add( vR.mul( step( oR.add( 0.5 ), oL ) ) ) ).toVar();
	const f = pick( winL, fract( phL ), fract( phR ) ).toVar();
	const o = pick( winL, oL, oR );
	const sg = pick( winL, float( - 1 ), float( 1 ) );
	// Height along the segment: low at the outer edge and at the tip.
	const z = s.sub( sg.mul( 0.33 ) ).div( 0.7 ).clamp( - 0.97, 0.97 );
	const lh = sqrt( float( 1 ).sub( z.mul( z ) ) ), ld = z.div( lh ).negate().div( 0.7 ).clamp( - 3, 3 );
	const band = roundBand( f );
	const g = vec2( sg.mul( K ).add( s.mul( 2 * CV ) ), 1 ).div( half.mul( PD ) ); // grad of the phase
	const acrossDir = g.normalize(), alongDir = vec2( acrossDir.y, acrossDir.x.negate() );
	const Th = Wb.mul( 0.12 ); // relief, meters
	const w1 = fadeIn( Wb.mul( 0.3 ), fp, 2.0, 6.0 ).toVar();
	const sL0 = vec2( ld.div( half ), 0 ).mul( 0.6 ).add( g.mul( band.d.mul( 0.4 ) ) ).mul( Th ).mul( w1 );

	// L1 yarns along the segment: lanes across it.
	const bandM = float( 1 ).div( g.length() ); // meters per segment, across
	const sid = o.add( b.mul( 101 ) );
	const yl = f.mul( bandM ).div( u.twistM ).add( hash1( vec2( sid, 2.2 ) ) );
	const yf = fract( yl );
	const yarn = roundBand( yf );
	const yid = floor( yl ).add( sid.mul( 13 ) );
	const w2 = fadeIn( u.twistM, fp, 2.0, 6.0 ).mul( w1 ).toVar();
	const edge2 = smoothstep( 0.0, 1.0, yf.min( float( 1 ).sub( yf ) ).mul( u.twistM ).div( fp ) );
	const sYarn = acrossDir.mul( yarn.d.mul( 0.3 ).mul( edge2 ) ).mul( w2 );

	// L2 plies on each yarn, at 20 degrees.
	const plyM = u.twistM.mul( 1.6 );
	const al = p.dot( alongDir );
	const r = al.add( yf.mul( u.twistM ).mul( 2.7 ) ).div( plyM ).add( hash1( vec2( yid, 4.4 ) ) );
	const rf = fract( r );
	const ply = roundBand( rf );
	const plyDir = alongDir.add( acrossDir.mul( 2.7 ) ).normalize();
	const w3 = fadeIn( plyM.mul( 0.35 ), fp, 2.0, 6.0 ).mul( w2 ).toVar();
	const sPly = plyDir.mul( ply.d.mul( 0.2 ) ).mul( w3 ).mul( yarn.h );

	// L3 fibres along the ply.
	const fd2 = alongDir.add( acrossDir.mul( 0.36 ) ).normalize(); // fibres lie at 20 degrees
	const fn = vec2( fd2.y.negate(), fd2.x );
	const lane = wrapCoord( p.dot( fn ).div( u.fiberM ) ); // ids kept small for the hash
	const seg = p.dot( fd2 ).div( u.fiberM.mul( 60 ) ).add( hash1( vec2( floor( lane ), yid ) ) );
	const fl = fract( lane.add( hash1( vec2( floor( seg ), floor( lane ) ) ).sub( 0.5 ).mul( 0.8 ) ) );
	const w4 = fadeIn( u.fiberM, fp, 2.0, 6.0 ).mul( w3 ).toVar();
	const fib = roundBand( fl );
	const sFib = fn.mul( fib.d.mul( 0.12 ) ).mul( w4 ).mul( smoothstep( 0.0, 1.0, fl.min( float( 1 ).sub( fl ) ).mul( u.fiberM ).div( fp ) ) );
	const fid = floor( lane ).add( floor( seg ).mul( 0.37 ) );

	const slope = sL0.add( sYarn ).add( sPly ).add( sFib );
	// Colour: the strand's colour, round shading, creases, sewn seams.
	const strand = pm( o.add( 3000 ), float( 3 ) );
	const strandCol = mix( mix( u.color, u.color2, step( 0.5, strand ) ), u.color3, step( 1.5, strand ) );
	const farCol = u.color.add( u.color2 ).add( u.color3 ).div( 3 );
	const tint = hash1( vec2( sid, 5.5 ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 )
		.add( hash1( vec2( yid, 3.3 ) ).sub( 0.5 ).mul( u.colorVar ).mul( w2 ) )
		.add( hash1( vec2( fid, 1.1 ) ).sub( 0.5 ).mul( u.colorVar.mul( 2.5 ) ).mul( w4 ) );
	const H = lh.mul( 0.5 ).add( band.h.mul( 0.5 ) );
	const round = band.h.mul( 0.65 ).add( 0.35 ).mul( lh.mul( 0.45 ).add( 0.55 ) );
	const ao = mix( float( 0.72 ), round, w1 ).mul( mix( float( 1 ), yarn.h.mul( 0.35 ).add( 0.65 ), w2 ) ).mul( mix( float( 1 ), ply.h.mul( 0.2 ).add( 0.8 ), w3 ) );
	const seam = smoothstep( 0.9, 0.99, abs( s ) ).mul( fadeIn( Wb.mul( 0.05 ), fp, 1.5, 4.0 ) );
	const color = mix( farCol, strandCol.mul( tint ), w1 ).mul( ao ).mul( float( 1 ).sub( seam.mul( 0.7 ) ) );
	const rough = u.roughness.add( float( 1 ).sub( H ).mul( 0.1 ) ).min( 1 );
	const s2 = float( 1 ).sub( w1 ).mul( 0.15 ).add( float( 1 ).sub( w2 ).mul( 0.05 ) ).add( float( 1 ).sub( w3 ).mul( 0.02 ) ).add( float( 1 ).sub( w4 ).mul( 0.01 ) );
	const cavity = clamp( float( 1 ).sub( H ).mul( 0.7 ).add( seam ), 0, 1 ).mul( w1 );
	return { color, slope, rough, s2, cavity };

}
