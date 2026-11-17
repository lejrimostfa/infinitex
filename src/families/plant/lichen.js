// Lichen rosettes on the moss (foliose, like Parmelia and Xanthoria).
//   L0 rosettes  one per 30 mm cell at most (lichen = share), gathered in
//                patches, 3 to 15 mm in radius, lobed margin; grey green
//                (color3) or orange
//   L1 lobes     flat lobes radiate and fork outward (more lobes at the
//                rim), split by dark narrow clefts, each lobe convex
//   L1 cups      apothecia near the centre: discs 0.5 to 0.9 mm wide,
//                concave, brown orange (color4), with a raised pale rim
//   L2 cortex    the upper cortex cracks into areolae (0.25 mm); isidia
//                granules (60 um) bulge on it
// Returns cover (0..1), colour, slope, cavity and roughness.
//
// All but the cover sit in a gate() (core/lod.js): off the rosettes they
// are skipped, and the cups and cortex run only where they show.

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod, fract, floor, atan, cos, sin } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { band, net, cells } from './common.js';

export function lichen( p, fp, u ) {

	const cell = 0.03;
	const V = voronoi( wrapCoord( p.div( cell ) ).add( u.seed.mul( 4.1 ) ), 0.7 );
	const h = hash3( V.id1.add( 1.3 ) );
	// Rosettes gather in patches (wetter, older parts of the cushion).
	const patch = smoothstep( 0.35, 0.7, valueNoise( wrapCoord( p.div( 0.11 ) ).add( u.seed.mul( 2.3 ) ) ) );
	const on = step( h.x, u.lichen.mul( patch ).mul( 2.2 ) );
	const v = V.toSeed.mul( cell ), r = v.length();
	const dv = v.div( r.max( 1e-7 ) );
	const R = h.y.mul( h.y ).mul( 0.011 ).add( 0.004 );
	// Lobed margin: noise around the circle (no seam at +-pi).
	const lobeN = valueNoise( dv.mul( 2.5 ).add( h.xz.mul( 40 ) ) ).mul( 0.65 ).add( valueNoise( dv.mul( 7 ).add( h.yz.mul( 30 ) ) ).mul( 0.35 ) );
	const rEdge = R.mul( lobeN.mul( 0.8 ).add( 0.45 ) );
	const cover = clamp( rEdge.sub( r ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
	// Off the rosettes (cover 0) the moss reads none of the rest: it is
	// skipped.
	const coverV = cover.toVar();
	const L = gate( coverV.greaterThan( 0 ), { color: [ 0, 0, 0 ], slope: [ 0, 0 ], cavity: 0, rough: 0 }, () => {

		const rr = r.div( rEdge ).clamp( 0, 1 ).toVar();

		// Lobes: angular bands that fork outward (doubling past mid radius).
		const ang = atan( v.y, v.x ).div( 6.2832 ).add( 0.5 );
		const nL = mix( float( 9 ), float( 18 ), step( 0.55, rr ) ).add( floor( h.z.mul( 4 ) ) );
		const ph = ang.mul( nL ).add( valueNoise( vec2( r.div( 0.002 ), h.x.mul( 9 ) ) ).mul( 0.4 ) );
		const fl = fract( ph ).sub( 0.5 );
		const lat = fl.mul( r ).mul( 6.2832 ).div( nL ); // meters across the lobe
		const wL = fadeIn( r.mul( 6.2832 ).div( nL ), fp, 3.0, 8.0 );
		const cleft = band( lat, float( 2.5e-5 ).mul( rr.add( 0.3 ) ), fp ).mul( wL ).mul( smoothstep( 0.15, 0.3, rr ) );
		const tang = vec2( dv.y.negate(), dv.x );
		// Convex lobes, a lifted rim at the margin.
		const sLobe = tang.mul( fl.mul( - 0.8 ) ).mul( wL ).add( dv.mul( smoothstep( 0.8, 1.0, rr ).mul( 0.6 ) ) );

		// Apothecia near the centre, then the cortex cracks and isidia:
		// they run only where the cups span 2 px (the widest fade).
		const cm = 0.0026;
		const aq = wrapCoord( p.div( cm ) ).add( 7.7 ).toVar();
		const ccq = wrapCoord( p.div( 2.5e-4 ) ).add( 3.3 ).toVar();
		const icq = wrapCoord( p.div( 6e-5 ) ).add( 8.8 ).toVar();
		const D = gate( fadeOn( cm, fp, 2.0 ), { disc: 0, rim: 0, tint: 0, sCup: [ 0, 0 ], line: 0, sC: [ 0, 0 ], wall: 0, sI: [ 0, 0 ] }, () => {

			const A = voronoi( aq, 0.6 );
			const ha = hash3( A.id1.add( 2.6 ) );
			const ar = ha.x.mul( 0.15 ).add( 0.18 ); // radius in cells
			const ad = A.toSeed.length();
			const hasCup = step( ha.y, 0.55 ).mul( smoothstep( 0.7, 0.5, rr ) ).mul( coverV ).mul( fadeIn( cm, fp, 2.0, 5.0 ) );
			const disc = clamp( ar.mul( 0.78 ).sub( ad ).mul( cm ).div( fp ).add( 0.5 ), 0, 1 ).mul( hasCup );
			const rim = band( ad.sub( ar.mul( 0.88 ) ).mul( cm ), ar.mul( cm ).mul( 0.12 ), fp ).mul( hasCup );
			const sCup = A.toSeed.normalize().mul( disc.mul( 0.5 ).sub( rim.mul( 0.4 ).mul( ad.sub( ar.mul( 0.88 ) ).sign() ) ) );

			// Cortex cracks and isidia: only where the cracks span 3 px.
			const K = gate( fadeOn( 2.5e-4, fp, 3.0 ), { line: 0, sC: [ 0, 0 ], wall: 0, sI: [ 0, 0 ] }, () => {

				const C = net( p, fp, float( 2.5e-4 ), 5e-6, 3.3, 0.5, 3.0, 9.0, ccq );
				const I = cells( p, fp, float( 6e-5 ), 3e-6, 8.8, 0, 0.5, icq );
				return { line: C.line, sC: C.dir.mul( C.g.mul( - 1.5e-6 ) ), wall: I.wall, sI: I.slope.mul( 0.4 ) };

			}, [ p, fp, ccq, icq ] );
			return { disc, rim, tint: ha.z.mul( 0.3 ).add( 0.75 ), sCup, ...K };

		}, [ p, fp, aq, ccq, icq, rr, coverV ] );

		// Colour: grey green or orange per rosette, paler at the growing rim.
		const orange = step( 0.65, h.z );
		const thallus = mix( u.color3, mix( u.color4, vec3( 0.9, 0.55, 0.1 ), 0.7 ), orange );
		let color = thallus.mul( mix( float( 0.85 ), float( 1.12 ), smoothstep( 0.5, 1.0, rr ) ) ).mul( hash1( V.id1.add( floor( ph ) ) ).sub( 0.5 ).mul( 0.12 ).add( 1 ) );
		color = color.mul( float( 1 ).sub( cleft.mul( 0.45 ) ) ).mul( float( 1 ).sub( D.line.mul( 0.35 ) ) ).mul( float( 1 ).sub( D.wall.mul( 0.2 ) ) );
		const cupCol = mix( u.color4, u.color4.mul( vec3( 1.2, 0.7, 0.3 ) ), orange );
		color = mix( color, cupCol.mul( D.tint ), D.disc );
		color = mix( color, thallus.mul( 1.15 ), D.rim.mul( 0.8 ) );
		const slope = sLobe.add( D.sCup ).add( D.sI ).add( D.sC );
		const cavity = cleft.max( D.line.mul( 0.5 ) ).max( D.disc.mul( 0.4 ) );
		return { color: clamp( color, 0, 1 ), slope: slope.mul( coverV ), cavity, rough: float( 0.85 ).sub( D.disc.mul( 0.25 ) ) };

	}, [ p, fp, coverV ] );
	return { cover: coverV, ...L };

}
