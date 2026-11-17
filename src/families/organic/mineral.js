// Plant matter turned to mineral: petrified wood and coal.
// Petrified wood (a polished slab cut across a log, Arizona like):
//   L0 slab      the rings of the log survive (feature_mm apart, round a
//                pith off the face) but the colours are those of the
//                silica: zones of red, yellow, brown and grey jasper with
//                sharp borders that ignore the rings; radial checks and
//                a few pockets filled with white and clear quartz
//   L1 rings     each ring ends in a thin dark line of latewood; rays run
//                out from the pith; the quartz pockets have a white
//                chalcedony rind and crystals growing inward
//   L2 cells     tracheids turned to chalcedony (cell_um) in radial rows,
//                quartz crystal faces in the pockets; glassy polish
// Coal (bituminous, a broken face):
//   L0 bands     bright glassy vitrain and dull grey durain in bands a
//                few mm thick; cleat cracks run across them
//   L1 shells    conchoidal fracture: smooth curved shells of size_mm,
//                each a shallow bowl round its origin, ribs (arcs) on the
//                side away from it, curved sharp edges between shells
//   L2 hackles   fine radial striae near the shell edges, hairline
//                cracks, rare pyrite (metallic)
// Returns { color, slope, cavity, rough, s2, coat, metal }.

import { vec2, vec3, float, fract, floor, mix, smoothstep, step, sin, atan, mod, clamp } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { crystals } from '../stone/crystals.js';
import { fbm, band, cells, grains, warp2 } from './common.js';

// Sharp zone border: 1 above the level t, AA in m units by its slope.
const zone = ( m, t, dm ) => clamp( m.sub( t ).div( dm ).add( 0.5 ), 0, 1 );

export function buildPetrified( p, fp, u ) {

	const s = u.seed;
	const c = vec2( 0.11, 0.23 ).add( s.mul( 0.002 ) );
	const d = p.sub( c ).add( warp2( p, float( 0.06 ), 4.1 ).mul( 0.01 ) );
	const r = d.length(), th = atan( d.y, d.x );
	const F = u.featureM;
	// L0: silica zones, sharp. dm: the width of a pixel in m units.
	const mw = p.add( warp2( p, float( 0.03 ), 6.6 ).mul( 0.02 ) );
	const m = fbm( mw.add( 7.7 ), float( 0.09 ), fp, 5, 5 ).toVar();
	const dm = surfaceGradient( m, p ).length().mul( fp ).max( 1e-4 ).mul( 1.5 );
	const z1 = zone( m, float( 0.36 ), dm ), z2 = zone( m, float( 0.52 ), dm ), z3 = zone( m, float( 0.6 ), dm );
	let color = mix( vec3( 0.42, 0.4, 0.38 ), u.color2, z1 );
	color = mix( color, u.color, z2 );
	color = mix( color, u.color3, z3 );
	// A thin pale line where zones meet (a film of chalcedony).
	const rim = band( m.sub( 0.52 ), dm.mul( 0.6 ), dm ).max( band( m.sub( 0.36 ), dm.mul( 0.6 ), dm ) );
	// Agate banding: thin bands parallel to the zone borders.
	const ab = fract( m.mul( 45 ) );
	// Band period in meters: 1/45 of m over its gradient (dm / 1.5 fp).
	const wA = fadeIn( fp.mul( 1.5 ).div( dm.mul( 45 ) ), fp, 2.0, 5.0 );
	color = color.mul( smoothstep( 0.2, 0.5, ab ).mul( smoothstep( 1.0, 0.7, ab ) ).mul( 0.16 ).mul( wA ).add( 0.9 ) );
	color = color.mul( fbm( p.add( 8.3 ), float( 0.004 ), fp, 3, 9 ).sub( 0.5 ).mul( 0.25 ).add( 1 ) );
	color = mix( color, vec3( 0.82, 0.78, 0.7 ), rim.mul( 0.5 ) );
	// Rings: tone across each ring and a sharp latewood line.
	const phase = r.div( F ).add( fbm( p, float( 0.05 ), fp, 3, 2 ).mul( 3 ) );
	const fr = fract( phase );
	const wR = fadeIn( F, fp, 1.5, 4.0 );
	const late = band( fr.sub( 0.92 ).mul( F ), F.mul( 0.04 ), fp ).mul( wR );
	color = color.mul( fr.mul( 0.12 ).add( 0.94 ).mul( wR ).add( wR.oneMinus() ) ).mul( float( 1 ).sub( late.mul( 0.4 ) ) );
	color = color.mul( fbm( p.add( 2.9 ), float( 0.01 ), fp, 3, 3 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	// Radial checks filled with white quartz.
	const ck = fract( th.mul( 5 ).add( valueNoise( vec2( r.div( 0.02 ), 3.3 ) ).mul( 0.3 ) ) ).sub( 0.5 ).mul( r.mul( 6.283 / 5 ) );
	const check = band( ck, float( 8e-4 ).mul( valueNoise( vec2( r.div( 0.01 ), th.mul( 5 ) ) ).add( 0.2 ) ).mul( smoothstep( 0.02, 0.06, r ) ), fp );
	color = mix( color, vec3( 0.86, 0.84, 0.8 ), check );
	// Quartz pockets: rind, then crystals growing inward.
	const Q = voronoi( wrapCoord( p.div( 0.03 ) ).add( 4.4 ), 0.8 );
	const qk = hash3( Q.id1 );
	const qd = Q.toSeed.length().div( qk.x.mul( 0.15 ).add( 0.12 ) ).add( valueNoise( Q.toSeed.mul( 6 ).add( qk.yz.mul( 9 ) ) ).mul( 0.3 ) );
	const pocket = step( qk.z, u.density.mul( 0.3 ) ).mul( clamp( float( 1 ).sub( qd ).mul( 0.006 ).div( fp ).add( 0.5 ), 0, 1 ) );
	const rind = pocket.mul( smoothstep( 0.7, 0.85, qd ) );
	const X = crystals( p.div( 6e-4 ).add( 2.2 ), { elong: 0.8, size: 0.4, square: 0.5 } );
	const xk = hash3( X.id1 );
	const wX = fadeIn( float( 6e-4 ), fp, 2.0, 5.0 );
	const quartz = vec3( 0.62, 0.62, 0.64 ).mul( xk.x.mul( 0.3 ).mul( wX ).add( 0.8 ) ).mul( float( 1 ).sub( smoothstep( 0.06, 0.0, X.gap ).mul( 0.3 ).mul( wX ) ) );
	color = mix( color, quartz, pocket );
	color = mix( color, vec3( 0.88, 0.86, 0.82 ), rind );
	// L1: rays. L2: cells in radial rows.
	const ray = band( fract( th.mul( r ).div( F.mul( 0.4 ) ) ).sub( 0.5 ).mul( F.mul( 0.4 ) ), F.mul( 0.015 ), fp ).mul( fadeIn( F.mul( 0.4 ), fp, 3.0, 8.0 ) );
	color = color.mul( float( 1 ).sub( ray.mul( 0.15 ).mul( pocket.oneMinus() ) ) );
	const C = cells( vec2( r, th.mul( r ) ), u.cellM, fp, 6.6, { jitter: 0.4, crown: 0.4 } );
	color = color.mul( float( 1 ).sub( C.wall.mul( 0.3 ).mul( pocket.oneMinus() ) ) ).mul( C.id.x.sub( 0.5 ).mul( 0.12 ).mul( C.w ).add( 1 ) );
	const slope = C.slope.mul( 0.01 ).add( xk.xy.sub( 0.5 ).mul( 0.1 ).mul( pocket ).mul( wX ) ).mul( u.relief );
	return { color, slope, cavity: C.wall.mul( 0.1 ), rough: u.roughness, s2: float( 0.002 ), coat: float( 1 ), coatRough: float( 0.04 ) };

}

export function buildCoal( p, fp, u ) {

	const s = u.seed, g = u.sizeM;
	// L0: bands and cleats.
	const by = p.y.add( fbm( p, float( 0.08 ), fp, 3, 2 ).mul( 0.01 ) );
	const bright = smoothstep( 0.45, 0.55, valueNoise( vec2( by.div( 0.005 ), s ) ) ).toVar();
	const cx = p.x.div( 0.04 ).add( valueNoise( vec2( p.y.div( 0.03 ), 1.1 ) ).mul( 0.25 ) );
	const cleat = band( fract( cx ).sub( 0.5 ).mul( 0.04 ), float( 1.2e-4 ).mul( step( 0.3, hash3( vec2( floor( cx ), floor( by.div( 0.02 ) ) ) ).x ) ), fp );
	// L1: shells. Strongly warped cells: their borders curve.
	const w = p.add( warp2( p, g.mul( 1.5 ), 3.3 ).mul( g.mul( 0.9 ) ) );
	const V = voronoi( wrapCoord( w.div( g ) ).add( 3.3 ), 0.9 );
	const k = hash3( V.id1 );
	const o = V.toSeed.add( k.xy.sub( 0.5 ).mul( 0.8 ) ); // origin of the shell, off centre
	const ro = o.length();
	const wV = fadeIn( g, fp, 1.0, 3.0 );
	// Bowl: a smooth curved face, tilted as a whole.
	const bowl = o.mul( k.z.mul( 0.25 ).add( 0.15 ) );
	const tilt = k.yx.sub( 0.5 ).mul( 0.35 );
	// Ribs: arcs round the origin, only on the far side, fading out.
	const side = smoothstep( - 0.2, 0.7, o.dot( k.yz.sub( 0.5 ).normalize() ).div( ro.max( 1e-3 ) ) );
	const ribF = ro.mul( 10 ).add( valueNoise( o.mul( 3 ).add( k.xz.mul( 20 ) ) ).mul( 1.5 ) );
	const rib = sin( ribF.mul( 6.283 ) ).mul( side ).mul( smoothstep( 0.1, 0.4, ro ) ).mul( fadeIn( g.mul( 0.1 ), fp, 4.0, 10.0 ) );
	const er = o.div( ro.max( 1e-3 ) );
	let slope = bowl.add( tilt ).add( er.mul( rib ).mul( 0.05 ) ).mul( wV );
	const edge = band( V.edge.mul( g ), g.mul( 0.004 ), fp ).mul( wV );
	// L2: hackle striae near the shell edge, radial to the origin.
	const ang = atan( o.y, o.x );
	const hk = band( fract( ang.mul( 120 / 6.283 ) ).sub( 0.5 ).mul( ro.mul( g ).mul( 6.283 / 120 ) ), g.mul( 0.0015 ), fp )
		.mul( smoothstep( 0.12, 0.0, V.edge ) ).mul( fadeIn( ro.mul( g ).mul( 6.283 / 120 ), fp, 3.0, 8.0 ) );
	slope = slope.add( vec2( er.y.negate(), er.x ).mul( hk ).mul( 0.15 ) );
	const P = grains( p, u.featureM, fp, 5.5, { gap: 0.3, radius: 0.25, round: 0.3, tilt: 1 } );
	const pyr = P.body.mul( step( 0.97, P.id.x ) ).mul( u.dust ).mul( fadeIn( u.featureM, fp, 1.0, 3.0 ) );
	let color = mix( u.color, u.color2, bright ).mul( k.z.sub( 0.5 ).mul( 0.15 ).mul( wV ).add( 1 ) );
	color = color.add( edge.mul( 0.04 ) ).mul( float( 1 ).sub( cleat.mul( 0.7 ) ) );
	color = mix( color, vec3( 0.75, 0.62, 0.3 ), pyr );
	// Vitrain is glassy, durain dull and a little grainy.
	const dull = fbm( p.add( 5.1 ), float( 3e-4 ), fp, 2, 7 ).sub( 0.5 ).mul( 0.6 ).mul( bright.oneMinus() );
	slope = slope.add( vec2( dull, dull.mul( 0.7 ) ).mul( 0.3 ) );
	const rough = mix( u.roughness.add( 0.35 ), u.roughness, bright ).sub( pyr.mul( 0.1 ) ).max( 0.08 );
	return { color, slope: slope.mul( u.relief ), cavity: cleat.max( edge.mul( 0.3 ) ), rough, s2: wV.oneMinus().mul( 0.08 ), metal: pyr };

}
