// Moon jellyfish bell (Aurelia), seen from above, one per bell_mm repeat.
// Sizes below are for a 30 cm bell. The jelly is 95 % water: almost all
// the light goes through; the organs scatter more and let less through.
//   L0 bell:    an eight lobed rim with a sense organ (rhopalium) in each
//               notch, four violet horseshoe gonads around the centre, the
//               oral arms under the stomach as a soft milky cross
//   L1 canals:  sixteen radial canals (0.7 mm) from the stomach to the ring
//               canal by the rim; every other one branches twice. The
//               coronal muscle shows as fine rings near the rim (0.6 mm),
//               the margin as a fringe of short tentacles
//   L1 dots:    white nematocyst warts (0.4 mm) on the top of the bell and
//               glowing photocytes (0.3 mm) along the rim and the canals
//   L2 tissue:  gonad folds dotted with eggs (0.15 mm); surface ripples
//   L3 cells:   the epidermis, cells about 12 um, nematocyst capsules
//               (about 20 um) packed in each wart; in the jelly, wandering cells
//               (8 um) and elastic fibres (4 um)
// Returns colour, slope, transmission share, emission, cavity.
//
// The warts, photocytes, eggs and the L3 cells sit in gate()s
// (core/lod.js): they run only where they show.

import { vec2, float, floor, fract, clamp, smoothstep, mix, abs, cos, atan, max, min, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash1, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

const TAU = Math.PI * 2;

export function buildMedusa( p, fp, u ) {

	const B = u.bellM;
	const cell = floor( p.div( B ).sub( u.offset ) );
	const q = fract( p.div( B ).sub( u.offset ) ).sub( 0.5 ); // bell units, centre at 0
	const r = q.length().max( 1e-5 ), th = atan( q.y, q.x );
	const fpB = fp.div( B ); // footprint in bell units
	// Solid mask and thin line with antialiasing, in bell units.
	const solid = ( d ) => clamp( d.negate().div( fpB ).add( 0.5 ), 0, 1 );
	const line = ( d, w ) => clamp( w.sub( abs( d ) ).div( fpB ).add( 0.5 ), 0, 1 ).mul( smoothstep( 1.0, 3.0, w.mul( 2 ).div( fpB ) ) );

	// L0 rim: eight lobes, notches with a rhopalium.
	const lobe = abs( cos( th.mul( 4 ) ) );
	const Rr = float( 0.455 ).sub( float( 1 ).sub( lobe ).pow( 3 ).mul( 0.018 ) );
	const inBell = solid( r.sub( Rr ) );
	const kN = floor( th.div( TAU / 8 ) ).add( 0.5 ).mul( TAU / 8 );
	const rho = solid( q.sub( vec2( cos( kN ), cos( kN.sub( Math.PI / 2 ) ) ).mul( Rr.sub( 0.006 ) ) ).length().sub( 0.0045 ) );
	const ringC = line( r.sub( Rr ).add( 0.016 ), float( 0.0014 ) );
	const fringeA = fract( th.div( TAU ).mul( 360 ) ).sub( 0.5 ).mul( r ).mul( TAU / 360 );
	const fringe = line( fringeA, float( 0.0004 ) ).mul( smoothstep( - 0.004, 0.0, r.sub( Rr ) ).mul( smoothstep( 0.03, 0.012, r.sub( Rr ) ) ) );
	const coronal = line( fract( r.div( 0.002 ) ).sub( 0.5 ).mul( 0.002 ), float( 0.0003 ) ).mul( smoothstep( 0.35, 0.39, r ) ).mul( smoothstep( 0.0, - 0.02, r.sub( Rr ).add( 0.02 ) ) ).mul( 0.5 );

	// L1 canals: 16 sectors, even ones branch.
	const S = TAU / 16;
	const kc = floor( th.div( S ).add( 0.5 ) );
	const dlt = abs( th.sub( kc.mul( S ) ) );
	const branched = fract( kc.mul( 0.5 ) ).mul( 2 ).oneMinus(); // 1 on even sectors
	const wob = valueNoise( vec2( r.mul( 40 ), kc.add( cell.x.mul( 17 ) ) ) ).sub( 0.5 ).mul( 0.004 );
	const ringR = Rr.sub( 0.016 );
	const inCanal = smoothstep( 0.115, 0.125, r ).mul( smoothstep( 0.0, 0.002, ringR.sub( r ) ) );
	const r1 = float( 0.24 ), r2 = float( 0.33 );
	const b1 = r.sub( r1 ).max( 0 ).mul( 0.45 ).div( r );
	const b2 = r.sub( r2 ).max( 0 ).mul( 0.3 ).div( r );
	const dMain = dlt.mul( r ).add( wob );
	const dB1 = abs( dlt.sub( b1 ) ).mul( r ).add( wob ).add( float( 1 ).sub( branched ) );
	const dB2 = min( abs( dlt.sub( b1 ).sub( b2 ) ), abs( dlt.sub( b1 ).add( b2 ) ) ).mul( r ).add( wob ).add( float( 1 ).sub( branched ) ).add( smoothstep( 0.0, 0.001, r2.sub( r ) ) );
	const canal = max( max( line( dMain, float( 0.0012 ) ), line( dB1, float( 0.001 ) ) ), line( dB2, float( 0.0009 ) ) ).mul( inCanal );

	// L0 gonads: four horseshoes, open toward the centre, frilly.
	let gonad = float( 0 ), gv = vec2( 0 );
	for ( let k = 0; k < 4; k ++ ) {

		const a = Math.PI / 4 + k * Math.PI / 2;
		const c = vec2( Math.cos( a ), Math.sin( a ) ).mul( 0.15 );
		const v = q.sub( c );
		const rv = v.length();
		const open = smoothstep( 0.55, 0.75, v.normalize().dot( c.normalize().negate() ) );
		const frill = valueNoise( vec2( atan( v.y, v.x ).mul( 6 ), k * 3.3 ).add( u.seed ) ).sub( 0.5 ).mul( 0.012 );
		const g = solid( abs( rv.sub( 0.068 ) ).sub( frill.add( 0.017 ) ) ).mul( float( 1 ).sub( open ) );
		gonad = max( gonad, g ).toVar();
		gv = mix( gv, v, g ).toVar();

	}

	// Oral arms: four frilly milky bands under the stomach, along the axes
	// (between the gonads), tapering to their tips.
	const armD = min( abs( q.x ), abs( q.y ) );
	const armW = smoothstep( 0.27, 0.03, r ).mul( 0.009 ).add( valueNoise( q.mul( 120 ) ).sub( 0.5 ).mul( 0.006 ) ).add( valueNoise( q.mul( 700 ) ).sub( 0.5 ).mul( 0.002 ) );
	const lip = line( armD.sub( armW ), float( 0.0012 ) ); // frilly rim of each arm
	const oral = solid( armD.sub( armW ) ).mul( smoothstep( 0.27, 0.2, r ) ).mul( valueNoise( q.mul( 160 ).add( 3.3 ) ).mul( 0.08 ).add( 0.08 ) )
		.max( lip.mul( smoothstep( 0.27, 0.2, r ) ).mul( 0.3 ) ).max( smoothstep( 0.025, 0.0, r ).mul( 0.25 ) );

	// L1 dots: nematocyst warts (white) and photocytes (glow). The warts,
	// and the L3 cells and capsules inside them, run only where the warts
	// span 1.5 px (their fade); the L3 level only where the capsules span
	// 2 px (the widest L3 fade).
	const wq = p.div( 0.003 ).add( 1.3 ).toVar();
	const cq = wrapCoord( p.div( 1.2e-5 ) ).add( 9.9 ).toVar(); // ids kept small for the hash
	const nq = wrapCoord( p.div( 3e-5 ) ).add( 5.5 ).toVar();
	const aq = p.div( 6e-5 ).add( 2.7 ).toVar();
	const inBellV = inBell.toVar();
	const off3 = { cellEdge: 0, sCell: [ 0, 0 ], caps: 0, capRim: 0, sCaps: [ 0, 0 ], amoe: 0, fibre: 0, wCap: 0 };
	const WT = gate( fadeOn( 4e-4, fp, 1.5 ), { wart: 0, ...off3 }, () => {

		const wv = voronoi( wq, 0.8 );
		const wartOn = smoothstep( 0.55, 0.6, hash1( wv.id1.add( 2.2 ) ) ).toVar();
		const wartD = wv.toSeed.length().mul( 0.003 ).toVar(); // meters
		const wW = fadeIn( 4e-4, fp, 1.5, 4.0 );
		const wart = clamp( float( 2e-4 ).sub( wartD ).div( fp ).add( 0.5 ), 0, 1 ).mul( wartOn ).mul( wW ).mul( inBellV );

		// L3: epidermal cells, nematocysts packed in the warts.
		const L3 = gate( fadeOn( 1.5e-5, fp, 2.0 ), off3, () => {

			const cv = voronoi( cq, 0.85 );
			const wC = fadeIn( 1.2e-5, fp, 2.0, 5.0 );
			const nemaZone = smoothstep( 2.3e-4, 1.7e-4, wartD ).mul( wartOn );
			const nv = voronoi( nq, 0.6 );
			const wCap = fadeIn( 1.5e-5, fp, 2.0, 5.0 ); // the wart resolves into its capsules
			const caps = smoothstep( 0.42, 0.28, nv.toSeed.mul( vec2( 1, 1.6 ) ).length() ).mul( nemaZone ).mul( wCap );
			// In the jelly itself: wandering cells (amoebocytes, about 8 um) and
			// elastic fibres (about 4 um wide), faint but enough to show depth.
			const av = voronoi( aq, 0.9 );
			const fq = p.div( 4e-4 );
			return {
				cellEdge: smoothstep( 0.08, 0.0, cv.edge ).mul( wC ), sCell: cv.toSeed.mul( - 0.3 ).mul( wC ),
				caps,
				// Capsules: bright, with a dark refracting rim.
				capRim: smoothstep( 0.26, 0.4, nv.toSeed.mul( vec2( 1, 1.6 ) ).length() ).mul( caps ),
				sCaps: nv.toSeed.mul( vec2( 1, 1.6 ) ).mul( - 1.2 ).mul( caps ),
				amoe: smoothstep( 0.2, 0.1, av.toSeed.length() ).mul( smoothstep( 0.8, 0.85, hash1( av.id1.add( 6.1 ) ) ) ).mul( fadeIn( 8e-6, fp, 2.0, 5.0 ) ),
				fibre: line( valueNoise( fq ).sub( 0.5 ).add( valueNoise( fq.mul( 2.3 ).add( 1.7 ) ).sub( 0.5 ).mul( 0.5 ) ).mul( 4e-4 ).div( B ), float( 2e-6 ).div( B ) )
					.mul( fadeIn( 4e-6, fp, 2.0, 5.0 ) ),
				wCap,
			};

		}, [ p, fp, cq, nq, aq, wartD, wartOn ] );
		return { wart, ...L3 };

	}, [ p, fp, wq, cq, nq, aq, inBellV ] );
	const wart = WT.wart, wCap = WT.wCap, caps = WT.caps, cellEdge = WT.cellEdge, amoe = WT.amoe, fibre = WT.fibre;

	// Photocytes: only where they span 1 px (their fade); farther, a mean
	// glow along the rim and the canals.
	const nearOrg = max( canal.mul( 0.8 ), smoothstep( 0.03, 0.0, abs( r.sub( Rr ).add( 0.006 ) ) ) ).toVar();
	const gq = p.div( 0.002 ).add( 7.1 ).toVar();
	const wG = fadeIn( 3e-4, fp, 1.0, 3.0 ).toVar();
	const GD = gate( fadeOn( 3e-4, fp, 1.0 ), { glowDot: 0 }, () => {

		const gvv = voronoi( gq, 0.9 );
		const glowOn = smoothstep( 0.6, 0.7, hash1( gvv.id1 ).add( nearOrg.mul( 0.5 ) ) );
		const gd = gvv.toSeed.length().mul( 0.002 );
		return { glowDot: smoothstep( 1.6e-4, 0.4e-4, gd ).mul( glowOn ).mul( inBellV ) };

	}, [ fp, gq, nearOrg, inBellV ] );
	const glowDot = GD.glowDot;
	// Far away, the dots melt into a faint mean glow along the rim and canals.
	const glow = mix( nearOrg.mul( 0.04 ), glowDot, wG );

	// L2: eggs in the gonads (only there, and where they span 2 px),
	// surface ripples.
	const eq = p.div( 1.5e-4 ).add( 3.3 ).toVar();
	const EG = gate( fadeOn( 1.5e-4, fp, 2.0 ).and( gonad.greaterThan( 0 ) ), { egg: 0 }, () => {

		const ev = voronoi( eq, 0.8 );
		const wE = fadeIn( 1.5e-4, fp, 2.0, 5.0 );
		return { egg: smoothstep( 0.45, 0.25, ev.toSeed.length() ).mul( wE ).mul( gonad ) };

	}, [ fp, eq, gonad ] );
	const egg = EG.egg;
	const rq = p.div( 0.006 );
	const sRip = vec2( valueNoise( rq ), valueNoise( rq.add( 4.4 ) ) ).sub( 0.5 ).mul( 0.03 ).mul( fadeIn( 0.006, fp, 2.0, 6.0 ) );

	// Organ density: how much the light is scattered here (0 clear jelly).
	const org = max( max( gonad.mul( 0.5 ), canal.mul( 0.6 ) ), max( max( ringC.mul( 0.6 ), rho.mul( 0.8 ) ), max( oral, fringe.mul( 0.5 ) ) ) )
		.max( wart.mul( 0.3 ).mul( float( 1 ).sub( wCap.mul( 0.8 ) ) ) ).max( coronal.mul( 0.25 ) ).max( caps.mul( 0.7 ) ).max( cellEdge.mul( 0.18 ) ).max( amoe.mul( 0.5 ) ).max( fibre.mul( 0.25 ) ).toVar();
	let color = mix( u.color, u.canalColor, max( canal, max( ringC, max( oral, max( fringe, max( wart.mul( float( 1 ).sub( wCap.mul( 0.7 ) ) ), max( caps, max( amoe, fibre ) ) ) ) ) ) ).min( 1 ) );
	color = mix( color, u.organColor.mul( float( 1 ).sub( egg.mul( 0.25 ) ) ), gonad );
	color = mix( color, vec2( 0.95, 0.85 ).xyy.mul( u.canalColor ), rho );
	// Capsules: bright, with a dark refracting rim.
	color = color.mul( float( 1 ).sub( cellEdge.mul( 0.2 ) ) ).mul( float( 1 ).sub( WT.capRim.mul( 0.6 ) ) );
	const outside = float( 1 ).sub( inBellV ).mul( 0.25 ); // jelly outside the bell is thinner, clearer
	const transmission = u.clarity.mul( float( 1 ).sub( org.mul( 0.7 ) ) ).add( outside.mul( float( 1 ).sub( u.clarity ) ) ).min( 0.99 );
	const slope = sRip.add( WT.sCell ).add( WT.sCaps ).add( vec2( valueNoise( p.div( 3e-4 ) ), valueNoise( p.div( 3e-4 ).add( 2.2 ) ) ).sub( 0.5 ).mul( 0.04 ).mul( gonad ).mul( fadeIn( 3e-4, fp, 2.0, 6.0 ) ) );
	color = mix( color, u.glowColor.mul( 0.5 ), glowDot.mul( wG ) );
	const emissive = u.glowColor.mul( glow.mul( u.glow ) );
	const cavity = gonad.mul( 0.3 ).add( cellEdge.mul( 0.2 ) );
	return { color, slope, transmission, emissive, cavity, rough: u.roughness, s2: float( 0 ) };

}
