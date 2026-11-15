// Moss cushion seen from above, with lichen rosettes (lichen.js).
//   L0 cushion   mounds 3 to 6 cm; hollows darker and greener, tops
//                bleached yellow green; lichen rosettes on it
//   L1 shoots    packed leafy shoots (size_mm, about 1.8 mm): each a star
//                of two whorls of lance-shaped leaves that curve like a
//                pinwheel, keeled along the costa, pale tips (some end in
//                a white hair point); a second, deeper layer of shoots
//                shows in the gaps, then dark shadow
//   L1 capsules  spore capsules on red brown setae (stalks 3 to 4 mm),
//                each capsule 2.2 x 0.9 mm with a pale lid
//   L2 cells     leaf cells (cell_um, about 14 um), longer than wide,
//                pale walls, granular chloroplasts inside
// color = shoots, color2 = young tips, color3 = lichen, color4 = cups.

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod, fract, floor, atan, sin, cos, max } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, fbm } from './common.js';
import { lichen } from './lichen.js';

// One layer of shoots. Returns coverage, local leaf frame, slope, tone.
function shoots( p, fp, sizeM, seed ) {

	const V = voronoi( mod( p.div( sizeM ), 4096 ).add( seed ), 0.75 );
	const h = hash3( V.id1.add( 7.3 ) );
	const v = V.toSeed, r = v.length().max( 1e-4 );
	const dv = v.div( r ), tang = vec2( dv.y.negate(), dv.x );
	const R = h.y.mul( 0.25 ).add( 0.6 ); // shoot radius, cells
	const a = atan( v.y, v.x ).div( 6.2832 );
	let cov = float( 0 ), lat = float( 0 ), rr = float( 0 ), top = float( 0 ), lt = float( 0.5 ), rim = float( 0 );
	for ( let k = 0; k < 2; k ++ ) {

		// Outer whorl long, inner whorl short and higher; leaves curve.
		const Rk = R.mul( k ? 0.6 : 1 );
		const n = k ? 6 : 8;
		const phk = a.add( h.x ).add( k * 0.083 ).add( r.div( Rk ).mul( 0.09 ) ).mul( n );
		const flk = fract( phk ).sub( 0.5 );
		// Each leaf its own length and tone.
		const lh = hash3( vec2( mod( floor( phk ), n ), k * 3 + 1 ).add( V.id1.mul( 1.37 ) ) );
		const rk = r.div( Rk.mul( lh.x.mul( 0.45 ).add( 0.75 ) ) );
		const latk = flk.mul( r ).mul( 6.2832 / n ); // cells across the leaf
		// Lanceolate: widest at a third, pointed tip.
		const hw = rk.max( 0 ).sqrt().mul( float( 1 ).sub( rk ).max( 0 ).pow( 0.9 ) ).mul( Rk ).mul( 0.3 );
		const m = hw.sub( latk.abs() ).mul( sizeM );
		const c = clamp( m.div( fp ).add( 0.5 ), 0, 1 );
		// The inner whorl sits on top.
		lat = mix( lat, latk, c );
		rr = mix( rr, rk, c );
		top = mix( top, float( k ), c );
		lt = mix( lt, lh.y, c );
		rim = mix( rim, smoothstep( sizeM.mul( 0.03 ), float( 0 ), m ), c );
		cov = cov.max( c );

	}

	const bud = smoothstep( 0.16, 0.08, r.div( R ) );
	cov = cov.max( bud );
	// Slope: the shoot is a dome, each leaf keeled along its costa.
	const slope = dv.mul( - 0.7 ).add( tang.mul( lat.sign().mul( - 0.5 ) ) ).mul( cov );
	return { cov, lat, rr, top, lt, rim, bud, h, slope, id: V.id1, dv };

}

export function buildMoss( p, fp, u ) {

	const s = u.seed, sm = u.sizeM, cm = u.cellM;

	// Cushion mounds.
	const mound = fbm( p, float( 0.05 ), fp, 4, 2 );
	const hollow = smoothstep( 0.55, 0.3, mound );
	const sMound = surfaceGradient( mound.mul( 0.004 ), p );

	const w1 = fadeIn( sm, fp, 2.0, 5.0 );
	const A = shoots( p, fp, sm, s.mul( 3.1 ) );
	const B = shoots( p.add( vec2( 0.37, 0.71 ).mul( sm ) ), fp, sm.mul( 0.8 ), s.mul( 5.7 ).add( 11 ) );

	// Shoot colour: tips paler, inner whorl and young shoots yellower.
	const tone = A.h.z.sub( 0.5 ).mul( u.colorVar ).mul( 2 ).add( 1 );
	const young = smoothstep( 0.6, 0.95, valueNoise( mod( p.div( 0.012 ), 4096 ).add( 3.3 ) ) );
	// Bases sit deep in the shoot (darker), tips catch the light.
	const leafC = mix( u.color, u.color2, A.rr.mul( 0.5 ).add( A.top.mul( 0.2 ) ).add( young.mul( 0.35 ) ).min( 1 ) ).mul( tone )
		.mul( A.lt.sub( 0.5 ).mul( 0.25 ).add( 1 ) ).mul( smoothstep( 0.0, 0.5, A.rr ).mul( 0.45 ).add( 0.55 ) ).mul( float( 1 ).sub( A.rim.mul( 0.3 ) ) );
	const hairPt = step( 0.72, A.h.x ).mul( smoothstep( 0.78, 0.95, A.rr ) ).mul( float( 1 ).sub( A.top ) );
	let shootC = mix( leafC, vec3( 0.78, 0.8, 0.72 ), hairPt.mul( 0.85 ) );
	shootC = mix( shootC, u.color2.mul( 1.1 ), A.bud.mul( 0.6 ) );
	const costa = band( A.lat.mul( sm ), sm.mul( 0.018 ), fp ).mul( smoothstep( 0.9, 0.6, A.rr ) ).mul( A.cov ).mul( fadeIn( sm.mul( 0.08 ), fp, 2.0, 5.0 ) );
	shootC = shootC.mul( float( 1 ).sub( costa.mul( 0.25 ) ) );
	// Lower layer, a third one of old brown shoots, then shadow.
	const lowC = mix( u.color, u.color2, B.rr.mul( 0.4 ) ).mul( B.rr.mul( 0.3 ).add( 0.25 ) ).mul( B.lt.sub( 0.5 ).mul( 0.3 ).add( 1 ) );
	const C = shoots( p.add( vec2( 0.81, 0.23 ).mul( sm ) ), fp, sm.mul( 0.65 ), s.mul( 2.3 ).add( 23 ) );
	const oldC = mix( vec3( 0.05, 0.035, 0.015 ), vec3( 0.06, 0.07, 0.02 ), C.lt ).mul( C.rr.mul( 0.6 ).add( 0.4 ) );
	const deep = mix( mix( vec3( 0.006, 0.006, 0.003 ), oldC, C.cov ), lowC, B.cov );
	let color = mix( deep, shootC, A.cov );
	// Leaf cells, long along the leaf, on whichever leaf is on top.
	const tRr = mix( mix( C.rr, B.rr, B.cov ), A.rr, A.cov ), tLat = mix( mix( C.lat, B.lat, B.cov ), A.lat, A.cov );
	const tH = mix( mix( C.h.xy, B.h.xy, B.cov ), A.h.xy, A.cov );
	const lc = vec2( tRr.mul( sm ).div( cm.mul( 2 ) ), tLat.mul( sm ).div( cm ) ).add( tH.mul( 50 ) ).add( 100 );
	const LC = voronoi( mod( lc, 4096 ), 0.7 );
	const wC = fadeIn( cm, fp, 2.5, 6.0 );
	const wall = band( LC.edge.mul( cm ), cm.mul( 0.1 ), fp ).mul( wC );
	// Chloroplasts: discs of 4 um packed in each cell.
	const CH = voronoi( mod( p.div( cm.mul( 0.3 ) ), 4096 ).add( 2.2 ), 0.8 );
	const chl = smoothstep( 0.05, 0.25, CH.edge ).sub( 0.5 ).mul( fadeIn( cm.mul( 0.3 ), fp, 2.5, 6.0 ) );
	const leafOn = A.cov.max( B.cov ).max( C.cov );
	color = mix( color, mix( color.mul( chl.mul( 0.45 ).add( 1 ) ), color.mul( 1.3 ).add( vec3( 0.03, 0.035, 0.015 ) ), wall.mul( 0.7 ) ), leafOn );
	// Far: the mean of the shoot pattern.
	const far = mix( u.color, u.color2, 0.3 ).mul( 0.7 );
	color = mix( far, color, w1 );
	color = color.mul( mix( float( 1 ), float( 0.7 ), hollow ) ).mul( mound.sub( 0.5 ).mul( 0.4 ).add( 1 ) );
	color = mix( color, color.mul( vec3( 1.15, 1.1, 0.75 ) ), smoothstep( 0.6, 0.8, mound ).mul( 0.6 ) );
	let slope = A.slope.add( B.slope.mul( float( 1 ).sub( A.cov ) ).mul( 0.6 ) ).mul( w1 ).add( sMound );
	let cavity = float( 1 ).sub( A.cov ).mul( w1 ).mul( 0.8 ).add( hollow.mul( 0.2 ) );
	let rough = float( 0.65 ).add( float( 1 ).sub( A.cov ).mul( 0.3 ) ).mul( u.roughness.div( 0.75 ) );

	// Spore capsules on setae, above the shoots.
	const kc = sm.mul( 4 );
	const q = mod( p.div( kc ), 4096 ).add( s.mul( 1.7 ) );
	const hc = hash3( floor( q ).add( 9.9 ) );
	const has = step( hc.x, u.capsules.mul( 0.5 ) ).mul( fadeIn( kc.mul( 0.15 ), fp, 2.0, 5.0 ) );
	const sd = dir2( hc.y.mul( 6.283 ) );
	const lv = fract( q ).sub( hc.yz.mul( 0.2 ).add( 0.25 ) ).mul( kc );
	const along = lv.dot( sd ), across = lv.dot( vec2( sd.y.negate(), sd.x ) );
	const L = kc.mul( 0.22 );
	const setaW = sm.mul( 0.05 );
	const seta = band( across, setaW, fp ).mul( step( 0, along ) ).mul( step( along, L ) ).mul( has );
	const ca = sm.mul( 0.6 ), cb = sm.mul( 0.26 );
	const cv = vec2( along.sub( L ).sub( ca ), across );
	const ce = cv.x.div( ca ).pow( 2 ).add( cv.y.div( cb ).pow( 2 ) );
	const cap = clamp( float( 1 ).sub( ce ).mul( cb ).div( fp ).add( 0.5 ), 0, 1 ).mul( has );
	const lid = smoothstep( 0.55, 0.65, cv.x.div( ca ) ).mul( cap );
	// The seta is a round stalk: lit along one side.
	const setaC = vec3( 0.34, 0.1, 0.04 ).mul( smoothstep( 1.0, - 0.6, across.div( setaW ) ).mul( 0.8 ).add( 0.4 ) );
	color = mix( color, setaC, seta.mul( 0.95 ) );
	color = mix( color, mix( vec3( 0.36, 0.2, 0.07 ), vec3( 0.6, 0.45, 0.22 ), lid ).mul( float( 1 ).sub( ce.mul( 0.4 ) ) ), cap );
	const capS = sd.mul( cv.x.div( ca ) ).add( vec2( sd.y.negate(), sd.x ).mul( cv.y.div( cb ) ) ).mul( - 0.8 );
	slope = mix( slope, capS, cap );
	rough = mix( rough, float( 0.35 ), cap );
	cavity = cavity.mul( float( 1 ).sub( max( cap, seta ) ) );

	// Lichens on top.
	const Li = lichen( p, fp, u );
	color = mix( color, Li.color, Li.cover );
	slope = mix( slope, Li.slope, Li.cover );
	cavity = mix( cavity, Li.cavity, Li.cover );
	rough = mix( rough, Li.rough, Li.cover );
	const s2 = float( 1 ).sub( w1 ).mul( 0.12 ).mul( float( 1 ).sub( Li.cover ) );
	return { color: clamp( color, 0, 1 ), slope, cavity, rough: rough.clamp( 0.1, 1 ), s2, sheen: u.color2.mul( 0.15 ) };

}
