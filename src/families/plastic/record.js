// A 12 inch vinyl record (30 cm), its centre low on the face so that the
// grooves fill the middle and the label rises from the bottom edge.
//   L0 disc    spindle hole (7.2 mm), paper label (100 mm) with print,
//              run-out area and its lock groove, six tracks split by
//              bands where the spiral runs wide and silent, lead-in at the
//              rim, then the raised edge. From afar the grooves are a
//              stretched highlight across them (anisotropy): the radial
//              streak every record shows.
//   L1 grooves one spiral, pitch groove_um (about 110 um, wider when the
//              music is loud); a V of 90 degrees, 50 to 70 um wide,
//              with a rounded bottom (4 um)
//   L2 walls   each wall carries one stereo channel: it swings left and
//              right with the sound, wavelengths from 3 mm (bass) to 50 um
//              (treble) at this speed, louder and softer with the music
//   L3         dust specks and fine hairline scratches on the land
// Returns { color, slope, cavity, rough, s2, aniso } for shader.js.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, abs, sin, cos, atan, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';
import { scratchMarks } from '../../core/marks.js';

const R_OUT = 0.146, R_IN = 0.06, R_LABEL = 0.05, R_EDGE = 0.1495;
const GAPS = [ 0.131, 0.117, 0.101, 0.088, 0.074 ]; // bands between tracks
const GAP_W = 0.0012;

export function buildRecord( p, fp, u ) {

	const s = u.seed, P = u.grooveP;
	const rel = p.sub( vec2( 0.15, 0.035 ) ); // low on the face: the grooves fill its middle
	const r = rel.length().max( 1e-5 );
	const er = rel.div( r ), et = vec2( er.y.negate(), er.x );
	const theta = atan( rel.y, rel.x );

	// Groove count from the rim. In the bands the spiral runs six times
	// wider; loud passages widen the pitch a little everywhere.
	let phi = float( R_OUT ).sub( r ).div( P ).add( valueNoise( vec2( r.div( 0.004 ), s ) ).mul( 0.25 * 0.004 ).div( P ) );
	let inGap = float( 0 );
	for ( const g of GAPS ) {

		const lo = g - GAP_W / 2;
		phi = phi.sub( clamp( float( lo + GAP_W ).sub( r ), 0, GAP_W ).mul( 5 / 6 ).div( P ) );
		inGap = inGap.max( smoothstep( GAP_W * 0.6, GAP_W * 0.4, abs( r.sub( g ) ) ) );

	}
	const prog = smoothstep( R_IN, R_IN + 5e-4, r ).mul( smoothstep( R_OUT + 5e-4, R_OUT, r ) );
	const pitch = mix( P, P.mul( 6 ), inGap );
	const gq = phi.add( theta.div( Math.PI * 2 ) );
	const k = floor( gq );
	const a = fract( gq ).sub( 0.5 ).mul( pitch ).negate(); // m across, outward
	// Along the groove: Uf, the fraction of the turn (falls as theta grows).
	// Wave counts per turn are whole numbers, fixed per groove, so the
	// phase is fract( Uf C ) with no large float in it.
	const Uf = theta.div( Math.PI * 2 ).negate();

	// The sound: four bands, each with its own loudness envelope.
	const track = GAPS.reduce( ( t, g ) => t.add( step( r, g ) ), float( 0 ) );
	const T = k.sub( theta.div( Math.PI * 2 ) ); // the same, unwrapped: coarse but enough for loudness
	const env = ( rate, off ) => valueNoise( vec2( T.mul( rate ), track.add( off ) ) );
	let mL = float( 0 ), mR = float( 0 ), dL = float( 0 ), dR = float( 0 );
	const bands = [ [ 3e-3, 0.18 ], [ 8e-4, 0.08 ], [ 2e-4, 0.035 ], [ 5e-5, 0.012 ] ];
	bands.forEach( ( [ lam, amp ], i ) => {

		const C = floor( hash1( vec2( mod( k, 4093 ), i + 0.5 ) ).mul( 0.4 ).add( 0.8 ).mul( 0.6 / lam ) ); // waves per turn
		const ph = fract( Uf.mul( C ) ).mul( Math.PI * 2 );
		const A = env( 2.5 + i, i * 3.1 ).pow( 2 ).mul( amp ).mul( P ).mul( inGap.oneMinus() );
		const aR = A.mul( hash1( vec2( track, i ) ).mul( 0.6 ).add( 0.6 ) );
		const off = hash1( vec2( track, i + 9 ) ).mul( 1.5 );
		mL = mL.add( A.mul( sin( ph ) ) );
		mR = mR.add( aR.mul( sin( ph.add( off ) ) ) );
		// d m / d s along the groove, s = r theta, U falls as theta grows.
		dL = dL.add( A.mul( cos( ph ) ).mul( - Math.PI * 2 ).div( lam ) );
		dR = dR.add( aR.mul( cos( ph.add( off ) ) ).mul( - Math.PI * 2 ).div( lam ) );

	} );

	// The V: walls at 45 degrees, a rounded bottom.
	const half = mix( P.mul( 0.27 ), P.mul( 0.2 ), inGap );
	const lo = half.negate().add( mL ), hi = half.add( mR );
	const mid = lo.add( hi ).mul( 0.5 );
	const inG = clamp( a.sub( lo ).min( hi.sub( a ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( prog ).toVar();
	const dhda = clamp( a.sub( mid ).div( fp.max( 4e-6 ) ), - 1, 1 );
	const lowSide = step( a, mid );
	const dhds = mix( dR.negate(), dL, lowSide ).clamp( - 2, 2 );
	const wG = fadeIn( P, fp, 2.0, 6.0 ).toVar();
	// a grows outward: d a / d r = 1.
	let slope = er.mul( dhda ).add( et.mul( dhds ) ).mul( inG ).mul( wG );
	const depthN = a.sub( lo ).min( hi.sub( a ) ).div( half ).clamp( 0, 1 ).mul( inG );

	// Fine groove noise on the walls (the cutter is not perfect).
	const nq = vec2( Uf.mul( r ).mul( Math.PI * 2 ).div( 3e-6 ), a.div( 3e-6 ) ).mod( 4096 );
	const wN = fadeIn( float( 3e-6 ), fp, 2.0, 6.0 ).mul( inG );
	slope = slope.add( vec2( valueNoise( nq ), valueNoise( nq.add( 7.7 ) ) ).sub( 0.5 ).mul( 0.2 ).mul( wN ) );

	// Dust and hairline scratches.
	const sc = scratchMarks( p, fp, float( 0.003 ), float( 1.2e-6 ), s.add( 4.2 ), { density: 0.35, length: 1.3 } );
	const dq = p.div( 4e-4 ).add( 3.3 );
	const dh = hash1( floor( dq ) );
	const speck = smoothstep( 0.05, 0.01, fract( dq ).sub( 0.5 ).length().mul( valueNoise( dq.mul( 12 ) ).mul( 0.8 ).add( 0.6 ) ) ).mul( step( 0.96, dh ) ).mul( fadeIn( float( 4e-4 ), fp, 2.0, 5.0 ) );
	slope = slope.add( sc.slope.mul( 0.5 ) );

	// Colour: black vinyl, grooves deeper black; the label, the hole.
	const vinyl = u.color.mul( valueNoise( p.div( 0.01 ) ).mul( 0.2 ).add( 0.9 ) );
	let color = vinyl.mul( float( 1 ).sub( mix( prog.mul( 0.2 ), depthN.mul( 0.5 ), wG ) ) ); // grooves under a pixel: their mean
	color = mix( color, vec3( 0.3, 0.29, 0.27 ), speck.max( sc.cov.mul( 0.5 ) ) );
	const labelIn = clamp( float( R_LABEL ).sub( r ).div( fp ).add( 0.5 ), 0, 1 );
	// Print on the label: two rings of text, a thin ring near its edge.
	const ang = theta.div( Math.PI * 2 ).add( 0.5 );
	const text = ( r0, h, n ) => step( abs( r.sub( r0 ) ), h ).mul( step( 0.4, hash1( vec2( floor( ang.mul( n ) ), r0 * 1000 ) ) ) ).mul( step( 0.18, fract( ang.mul( n ) ) ) ).mul( step( 0.15, abs( ang.sub( 0.75 ) ) ) );
	const ink = text( 0.038, 0.0022, 70 ).max( text( 0.028, 0.0015, 90 ) ).max( step( abs( r.sub( 0.046 ) ), 0.0004 ) );
	const paper = u.color2.mul( valueNoise( p.div( 4e-5 ).mod( 4096 ) ).mul( 0.1 ).mul( fadeIn( float( 4e-5 ), fp, 2.0, 6.0 ) ).add( 0.95 ) );
	const label = mix( paper, vec3( 0.92, 0.88, 0.75 ), ink.mul( 0.85 ) );
	color = mix( color, label, labelIn );
	const hole = clamp( float( 0.0036 ).sub( r ).div( fp ).add( 0.5 ), 0, 1 );
	const outside = clamp( r.sub( R_EDGE ).div( fp ).add( 0.5 ), 0, 1 );
	color = mix( color, vec3( 0.015 ), hole.max( outside ) );
	// Raised rim between lead-in and edge.
	const rimT = smoothstep( R_EDGE - 0.002, R_EDGE, r ).sub( smoothstep( R_EDGE - 0.0004, R_EDGE, r ) );
	slope = slope.add( er.mul( rimT.mul( 0.15 ) ) ).mul( labelIn.oneMinus() );

	// The walls are steep mirrors: a little rougher, or they pick out the
	// texels of the environment map.
	const rough = mix( mix( u.roughness.max( mix( u.roughness, float( 0.38 ), inG.mul( wG ) ) ), float( 0.85 ), labelIn ), float( 0.7 ), outside ).add( speck.mul( 0.5 ) ).add( sc.cov.mul( 0.3 ) );
	const cavity = depthN.mul( wG ).max( hole );
	// From afar the grooves stretch the highlight across them.
	const aniso = et.mul( u.aniso ).mul( prog ).mul( wG.oneMinus().mul( 0.7 ).add( 0.3 ) ).mul( labelIn.oneMinus() );
	const s2 = wG.oneMinus().mul( prog ).mul( 0.01 );
	return { color, slope, cavity, rough, s2, aniso };

}
