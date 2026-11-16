// Metal mode `chrome`: bright chrome plate over polished nickel.
//   L0 mirror:     a near perfect mirror (roughness about 0.04); only a
//                  slow waviness of the polished base, 2 cm long, bends
//                  the reflections a little
//   L1 swirls:     the buffing wheel leaves arcs of hairline scratches
//                  around many centres, rows 250, 80 and 25 um apart, 1 to 5 um
//                  wide; seen as faint rings in the highlights
//   L2 pits:       sparse plating pits 20 to 80 um wide, dark, with a rim
//   L3 cracks:     the chrome layer (0.3 to 1 um) cracks as it plates: a
//                  network of cells about 250 um wide, lines about 1 um
//   L4 nodules:    the deposit grows in nodules of about 6 um, each a low
//                  dome; their tilt is tiny, so far away they do not dull
//                  the mirror
// Chrome is bluish white, about 55 to 60 % reflectance.
//
// The swirl rows, the microcracks and the nodules sit in gate()s
// (core/lod.js) and run only where they show.

import { vec2, float, floor, clamp, smoothstep, step, mix, mod, atan } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { grooves } from './scratch.js';

const vn = valueNoise;
const aa = ( d, fp ) => clamp( d.div( fp ).add( 0.5 ), 0, 1 );

export function buildChrome( p, fp, u ) {

	// L0 slow waviness of the polished base.
	const wq = p.div( 0.02 ).add( u.seed.mul( 2.3 ) );
	const sWave = vec2( vn( wq ), vn( wq.add( 4.1 ) ) ).sub( 0.5 ).mul( 0.012 );

	// L1 swirl arcs around the seeds of 25 mm cells, in short arcs.
	const SW = 0.025;
	const sv = voronoi( p.div( SW ).add( 7.7 ), 0.9 );
	const rr = sv.toSeed.length().max( 1e-4 ).toVar();
	const radial = sv.toSeed.div( rr );
	const ang = atan( sv.toSeed.y, sv.toSeed.x ).add( hash1( sv.id1 ).mul( 6.28 ) ).toVar();
	const ring = ( P, seed, density ) => {

		const w = fadeIn( P, fp, 1.5, 4.0 );
		const g = grooves( ang.mul( rr ).mul( SW * 3 ), rr.mul( SW ), fp, float( P ), seed, density, 0.03, 0.12 );
		return { s: g.s.mul( w ), cov: g.cov.mul( w ) };

	};
	// Each row size in its gate, the finer ones nested: a row skipped once
	// faded, and every finer one with it. The slope sum keeps its order.
	const rows = [ [ 250e-6, 1.7, 0.4 ], [ 80e-6, 3.1, 0.5 ], [ 25e-6, 6.7, 0.35 ] ];
	const swirlRows = ( i, cov, s ) => {

		if ( i >= rows.length ) return { cov, s };
		const [ P, seed, k ] = rows[ i ];
		const c0 = cov.isVarNode ? cov : cov.toVar(), s0 = s.isVarNode ? s : s.toVar();
		return gate( fadeOn( P, fp, 1.5 ), { cov: c0, s: s0 }, () => {

			const r = ring( P, seed, u.swirls.mul( k ) );
			return swirlRows( i + 1, c0.max( r.cov ), s0.add( r.s ) );

		}, [ fp, ang, rr, c0, s0 ] );

	};
	const SR = swirlRows( 0, float( 0 ), float( 0 ) );
	const swirl = SR.cov;
	const sSwirl = radial.mul( SR.s );

	// L2 plating pits.
	const PC = 3e-4;
	const q = p.div( PC ).add( 13.7 );
	const qc = mod( floor( q ), 4096 );
	const qh = hash3( qc );
	const qv = q.sub( floor( q ) ).sub( qh.xy.sub( 0.5 ).mul( 0.6 ).add( 0.5 ) );
	const R = qh.z.mul( 0.1 ).add( 0.03 ); // cells: 9 to 40 um radius
	const on = step( hash1( qc.add( 1.9 ) ), u.pitting.mul( 0.25 ) );
	const dq = qv.length();
	const pitR = R.mul( PC ), pitRE = pitR.max( fp );
	const pit = aa( pitRE.sub( dq.mul( PC ) ), fp ).mul( pitR.div( pitRE ).pow( 2 ) ).mul( on ).toVar();
	const rim = aa( pitRE.mul( 1.35 ).sub( dq.mul( PC ) ), fp ).sub( pit ).max( 0 ).mul( on ).mul( fadeIn( pitR, fp, 2.0, 5.0 ) );
	const sPit = qv.div( dq.max( 1e-4 ) ).mul( rim.mul( - 0.5 ).add( pit.mul( 0.8 ) ) ).mul( fadeIn( pitR, fp, 2.0, 5.0 ) );

	// L3 microcrack network.
	// Skipped past its fade (250 um, from 4 px).
	const CC = 2.5e-4;
	const crack = gate( fadeOn( CC, fp, 4.0 ), { crack: 0 }, () => {

		const cq = p.div( CC ).add( vec2( vn( p.div( CC * 0.7 ) ), vn( p.div( CC * 0.7 ).add( 3.3 ) ) ).mul( 0.4 ) );
		const cv = voronoi( mod( cq, 4096 ).add( 1.2 ), 0.9 );
		const cw = float( 8e-7 ).mul( hash1( cv.id1.add( cv.id2 ) ).add( 0.5 ) ), cwE = cw.max( fp );
		return { crack: aa( cwE.sub( cv.edge.mul( CC ) ), fp ).mul( cw.div( cwE ) ).mul( u.cracks )
			.mul( smoothstep( 0.3, 0.6, hash1( cv.id1.add( cv.id2.mul( 1.7 ) ) ).add( 0.3 ) ) ).mul( fadeIn( CC, fp, 4.0, 12.0 ) ) };

	}, [ p, fp ] ).crack.toVar();

	// L4 nodules.
	// Skipped past their fade (6 um, from 2 px).
	const NC = 6e-6;
	const nq = mod( p.div( NC ), 4096 ).add( 9.4 ).toVar();
	const wN = fadeIn( NC, fp, 2.0, 6.0 ).toVar();
	const N = gate( fadeOn( NC, fp, 2.0 ), { sNod: [ 0, 0 ], nodTone: 1 }, () => {

		const nv = voronoi( nq, 0.9 );
		const nh = hash3( nv.id1 );
		return {
			sNod: nv.toSeed.mul( - 0.035 ).mul( wN ),
			nodTone: nh.z.sub( 0.5 ).mul( 0.04 ).add( 1 ).mul( float( 1 ).sub( smoothstep( 0.0, 0.15, nv.edge ).oneMinus().mul( 0.08 ) ) ).sub( 1 ).mul( wN ).add( 1 ),
		};

	}, [ nq, wN ] );
	const sNod = N.sNod, nodTone = N.nodTone;

	// Pits are dark (light trapped), cracks a little.
	const color = u.f0.mul( nodTone ).mul( float( 1 ).sub( pit.mul( 0.85 ) ) ).mul( float( 1 ).sub( crack.mul( 0.8 ) ) )
		.mul( float( 1 ).add( swirl.mul( 0.08 ) ) );
	const rough = u.roughness.add( pit.mul( 0.4 ) ).add( crack.mul( 0.3 ) ).add( swirl.mul( 0.04 ) );
	// Only a sliver of the faded relief reaches the far roughness: the
	// mirror stays a mirror.
	const s2 = float( 1 ).sub( wN ).mul( 1e-5 ).add( float( 1 ).sub( fadeIn( 250e-6, fp, 1.5, 4.0 ) ).mul( 1e-5 ).mul( u.swirls ) );

	return {
		color, rough, s2,
		slope: sWave.add( sSwirl ).add( sPit ).add( sNod ),
		metalness: float( 1 ).sub( pit.mul( 0.3 ) ),
		cavity: pit.max( crack ),
		porosity: float( 0.02 ),
		debug: { w1: fadeIn( 80e-6, fp, 1.5, 4.0 ), w2: fadeIn( CC, fp, 4.0, 12.0 ), w3: wN },
	};

}
