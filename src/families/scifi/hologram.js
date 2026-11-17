// Embossed hologram foil (security seal, sticker). Aluminised film whose
// surface carries diffraction gratings of 0.8 to 1.5 um period. A grating
// of period d sends wavelength lambda = d |(L + V) . g| / m (order m) to
// the eye, so each region shows the colour its grating direction g and
// the view pick, and the rainbow slides as the view turns.
//   L0 layout   rosettes of size_mm (20 to 30 mm): circular gratings
//               around each centre, the classic rainbow "propeller"; a
//               seal in the middle of the face: a star with a linear
//               grating, two rings with radial gratings
//   L1 micro    micro stars of 3.5 mm over the background, guilloche
//               lines (0.5 mm) of plain foil in the disc of the seal
//   L1 emboss   the image is pressed into the foil: raised edges 2 to
//               4 um high catch the light as thin lines
//   L2 dots     a dot matrix master: dots of feature_mm (30 to 50 um),
//               each with a slightly turned grating and a dark seam
//   grating     always under a pixel: only its colour is seen (moire free)
// The foil is metal: the diffracted colour is its reflectance (F0), so it
// tints the room reflection; a little is also emission to keep it vivid.

import { vec2, float, floor, fract, clamp, smoothstep, mod, mix, atan, cos, sin, abs, max } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3, wrapCoord } from '../../core/hash.js';
import { spectral, viewTangent, upTangent } from '../../core/optics.js';

const fill = ( sd, fp ) => clamp( sd.div( fp ).add( 0.5 ), 0, 1 );

// Signed distance (positive inside) of a five point star, radius R.
function star( q, R ) {

	const a = atan( q.y, q.x ), r = q.length();
	const k = abs( fract( a.div( Math.PI * 2 / 5 ) ).sub( 0.5 ) ).mul( 2 ); // 0 at a tip, 1 between
	return mix( R, R.mul( 0.45 ), k ).sub( r ).mul( 0.8 );

}

export function buildHologram( p, fp, u ) {

	const s = u.seed;
	const V = viewTangent(), L = upTangent();
	const k = vec2( V.x.add( L.x ), V.y.add( L.y ) );
	const T = u.sizeM;

	// L0: rosettes on a staggered grid.
	const rq = p.div( T ).add( vec2( s.mul( 0.37 ), 0.5 ) );
	const row = floor( rq.y );
	const rc = vec2( fract( rq.x.add( row.mul( 0.5 ) ) ), fract( rq.y ) ).sub( 0.5 );
	const radial = rc.div( rc.length().max( 1e-4 ) );
	// Seal at the middle of the face (coords run 0 to 0.3).
	const c = p.sub( vec2( 0.15 ) );
	const r = c.length();
	const cdir = c.div( r.max( 1e-5 ) );
	const sStar = star( c.div( 0.05 ), float( 1 ) ).mul( 0.05 );
	const starIn = fill( sStar, fp );
	const ring = ( r0, w ) => fill( w.sub( abs( r.sub( r0 ) ) ), fp );
	const ringIn = max( ring( 0.075, float( 0.008 ) ), ring( 0.098, float( 0.004 ) ) );
	const discIn = fill( float( 0.104 ).sub( r ), fp );
	// Grating direction per region: tangent around rosettes (circular
	// grooves), radial in the rings, fixed in the star, and the disc
	// behind the seal turned by angle_deg.
	const tang = vec2( radial.y.negate(), radial.x );
	let g = mix( tang, vec2( cos( u.angle ), sin( u.angle ) ), discIn );
	g = mix( g, cdir, ringIn );
	g = mix( g, vec2( cos( u.angle.add( 1.1 ) ), sin( u.angle.add( 1.1 ) ) ), starIn );
	// L1 micro stars of 3.5 mm in the background, their own grating.
	const mc = fract( p.div( 0.0035 ) ).sub( 0.5 );
	const mini = fill( star( mc, float( 0.32 ) ).mul( 0.0035 ), fp ).mul( float( 1 ).sub( discIn ) ).mul( fadeIn( float( 0.0035 ), fp, 3.0, 8.0 ) );
	g = mix( g, vec2( cos( u.angle.add( 2.2 ) ), sin( u.angle.add( 2.2 ) ) ), mini );
	// L1 guilloche in the disc: wavy lines 0.5 mm apart, plain foil.
	const ga = atan( c.y, c.x );
	const gl = abs( fract( r.div( 5e-4 ).add( sin( ga.mul( 12 ) ).mul( 2.5 ) ) ).sub( 0.5 ) );
	const guil = smoothstep( 0.2, 0.12, gl ).mul( discIn ).mul( float( 1 ).sub( ringIn ) ).mul( fadeIn( float( 5e-4 ), fp, 2.5, 6.0 ) );
	// L2: dot matrix, each dot turns its grating a little.
	const dq = p.div( u.featureM );
	const dh = hash3( wrapCoord( floor( dq ) ).add( s ) );
	const w2 = fadeIn( u.featureM, fp, 2.0, 5.0 );
	const turn = dh.x.sub( 0.5 ).mul( 0.5 ).mul( w2 );
	g = vec2( g.x.mul( cos( turn ) ).sub( g.y.mul( sin( turn ) ) ), g.x.mul( sin( turn ) ).add( g.y.mul( cos( turn ) ) ) ).normalize();
	const df = fract( dq ).sub( 0.5 ).abs();
	const seam = smoothstep( 0.42, 0.5, max( df.x, df.y ) ).mul( w2 );

	// Period per region (nm), so neighbouring regions differ in hue.
	const per = mix( mix( float( 1100 ), float( 900 ), discIn ), float( 1350 ), max( starIn, ringIn ) ).add( dh.y.sub( 0.5 ).mul( 40 ).mul( w2 ) );
	const proj = abs( k.dot( g ) ).mul( per );
	const order = ( m, a ) => spectral( proj.div( m ) ).mul( a );
	const rainbow = order( 1, 1.0 ).add( order( 2, 0.45 ) ).add( order( 3, 0.2 ) ).mul( float( 1 ).sub( guil.mul( 0.8 ) ) );

	// L1: emboss heights (m). The die edge is a ramp about 20 um wide, so
	// the rims stay soft lines when the pixel is smaller than that.
	const ramp = ( sd ) => clamp( sd.div( fp.max( 2e-5 ) ).add( 0.5 ), 0, 1 );
	const rRing = ( r0, w ) => ramp( w.sub( abs( r.sub( r0 ) ) ) );
	const h = ramp( sStar ).mul( 4e-6 ).add( max( rRing( 0.075, float( 0.008 ) ), rRing( 0.098, float( 0.004 ) ) ).mul( 3e-6 ) )
		.add( ramp( float( 0.104 ).sub( r ) ).mul( 1.5e-6 ) ).mul( u.relief );
	const slope = surfaceGradient( h, p ).clamp( - 1, 1 );

	// Zero order: plain aluminium, each dot a touch brighter or darker.
	const base = mix( float( 0.6 ), float( 0.66 ), dh.z.mul( w2 ) ).mul( float( 1 ).sub( u.amount.mul( 0.6 ) ) );
	const color = clamp( rainbow.mul( u.amount ).add( base ), 0, 1 ).mul( float( 1 ).sub( seam.mul( 0.5 ) ) );
	return {
		color, metal: float( 1 ), slope, rough: u.roughness, s2: float( 0 ), cavity: seam.mul( 0.5 ),
		emissive: rainbow.mul( u.amount ).mul( u.glow ).mul( 0.12 ),
	};

}
