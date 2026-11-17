// Acorn barnacles crowding a dark hull.
//   L0 crowd     cones of size_mm (5 to 12 mm) and a second crop of small
//                ones in the gaps; crowded cones lose their round base and
//                take the shape of their cell. Some are dead: an empty
//                cone, a black hole at the top. Green slime between them
//   L1 cone      six wall plates, each a slightly different shade, a
//                step where one overlaps the next; radial ribs; a
//                diamond opening closed by four beaked opercular plates
//                (a slit along the long axis, a seam across)
//   L2 shell     growth lines round the cone (feature_mm apart), chalky
//                pits, fine purple streaks on some
// The cone rises from the base to the rim of the opening, about 0.6 of
// its base radius high: its slope and an occlusion toward the base give
// the volume. Returns { color, slope, cavity, rough, s2 }.

import { vec2, vec3, float, fract, floor, mix, smoothstep, step, clamp, atan, abs, mod, cos, sin } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash3, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { fbm, band, grains } from './common.js';

const R0 = 0.36; // radius of the opening rim, share of the base radius

function cone( p, g, fp, salt, u ) {

	const V = voronoi( wrapCoord( p.div( g ) ).add( salt ), 0.8 );
	const k = hash3( V.id1.add( salt ) ), k2 = hash3( V.id1.add( salt + 9.1 ) );
	const t = V.toSeed;
	const tl = t.length().max( 1e-4 );
	// Base radius, pressed flat by the neighbours.
	const Rb = k.x.mul( 0.1 ).add( 0.4 ).min( tl.add( V.edge ).mul( 0.96 ) );
	const rr = tl.div( Rb );
	const body = clamp( float( 1 ).sub( rr ).mul( Rb ).mul( g ).div( fp ).add( 0.5 ), 0, 1 );
	// Opening: a diamond in its own frame.
	const a = k.y.mul( 6.283 );
	const l = vec2( t.x.mul( cos( a ) ).add( t.y.mul( sin( a ) ) ), t.y.mul( cos( a ) ).sub( t.x.mul( sin( a ) ) ) ).div( Rb );
	const dia = abs( l.x ).mul( 0.75 ).add( abs( l.y ).mul( 1.3 ) );
	const hole = smoothstep( R0 * 0.85, R0 * 0.75, dia );
	const h = clamp( float( 1 ).sub( rr ).div( 1 - R0 ), 0, 1 ).mul( hole.oneMinus() ).add( hole.mul( 0.7 ) );
	const dir = t.div( tl );
	const onCone = step( R0, rr ).mul( body );
	const slopeC = dir.mul( - 0.6 / ( 1 - R0 ) ).mul( onCone ).mul( hole.oneMinus() );
	return { V, k, k2, t, dir, rr, Rb, body, l, dia, hole, h, slopeC, live: step( k.z, u.density.mul( 0.4 ).add( 0.55 ) ) };

}

export function buildBarnacle( p, fp, u ) {

	const s = u.seed, g = u.sizeM;
	const hull = u.color3.mul( fbm( p.add( s ), float( 0.03 ), fp, 4, 3 ).mul( 0.5 ).add( 0.75 ) );
	const slime = smoothstep( 0.45, 0.7, fbm( p.add( 5.5 ), float( 0.02 ), fp, 3, 7 ) );
	const A = cone( p, g, fp, 9.3, u );
	const B = cone( p.add( vec2( 0.37, 0.71 ).mul( g ) ), g.mul( 0.42 ), fp, 21.7, u );
	// The small crop shows only where the big cones leave hull.
	const useB = A.body.oneMinus().mul( B.body );
	const C = {};
	for ( const key of [ 'dir', 'rr', 'Rb', 'hole', 'h', 'slopeC', 'live', 'l' ] ) C[ key ] = pick( useB, B[ key ], A[ key ] );
	C.k = pick( useB, B.k, A.k );
	C.k2 = pick( useB, B.k2, A.k2 );
	const gC = pick( useB, g.mul( 0.42 ), g );
	const body = A.body.max( B.body );
	const ang = atan( C.dir.y, C.dir.x ).add( C.k.y.mul( 6.283 ) );
	// Six plates: a shade each, a step where they overlap.
	const pl = ang.mul( 6 / 6.2832 );
	const pid = floor( pl ), pf = fract( pl );
	const plateTone = hash3( vec2( mod( pid, 6 ), C.k.x.mul( 50 ) ) ).x.sub( 0.5 ).mul( 0.16 ).add( 1 );
	const wP = fadeIn( gC.mul( 0.05 ), fp, 1.5, 4.0 );
	const step1 = smoothstep( 0.0, 0.06, pf ).mul( wP );
	const suture = band( pf.sub( 0.5 ).abs().sub( 0.5 ).mul( C.rr ).mul( C.Rb ).mul( gC ).mul( 6.2832 / 6 ), gC.mul( 0.006 ), fp ).mul( wP );
	// Radial ribs and growth lines.
	const ribs = ang.mul( 36 / 6.2832 );
	const rib = fract( ribs ).sub( 0.5 ).abs().mul( 2 );
	const wRb = fadeIn( C.rr.mul( C.Rb ).mul( gC ).mul( 6.2832 / 36 ), fp, 2.0, 5.0 );
	const F = u.featureM;
	const gl = fract( C.rr.mul( C.Rb ).mul( gC ).div( F ) );
	const wG = fadeIn( F, fp, 2.0, 5.0 );
	const growth = smoothstep( 0.25, 0.0, gl.sub( 0.5 ).abs().sub( 0.25 ).abs() ).mul( wG );
	const stripe = smoothstep( 0.6, 0.9, fract( ang.mul( 12 / 6.2832 ) ) ).mul( u.streaks ).mul( step( 0.5, C.k2.x ) );
	let shell = mix( u.color, u.color2, stripe.mul( 0.7 ) ).mul( C.k2.y.sub( 0.5 ).mul( u.colorVar ).add( 1 ) ).mul( plateTone );
	// Light: higher is brighter (occlusion toward the base).
	shell = shell.mul( C.h.mul( 0.45 ).add( 0.6 ) ).mul( float( 1 ).sub( growth.mul( 0.12 ) ) ).mul( rib.mul( 0.12 ).mul( wRb ).add( 0.94 ) );
	shell = shell.mul( float( 1 ).sub( suture.mul( 0.5 ) ) );
	// Opening: live ones closed by four plates, dead ones a black hole.
	const slit = band( C.l.y.mul( C.Rb ).mul( gC ), gC.mul( 0.008 ), fp ).max( band( C.l.x.mul( C.Rb ).mul( gC ), gC.mul( 0.005 ), fp ).mul( 0.6 ) );
	const oper = mix( u.color.mul( 0.55 ), u.color.mul( 0.75 ), smoothstep( 0.0, 0.3, C.l.y.abs() ) ).mul( float( 1 ).sub( slit.mul( 0.8 ) ) );
	const open = mix( vec3( 0.02, 0.02, 0.02 ), oper, C.live );
	shell = mix( shell, open, C.hole );
	const scarPit = grains( p, F.mul( 0.4 ), fp, 2.9, { gap: 0.3, radius: 0.25, round: 0.4 } );
	shell = shell.mul( float( 1 ).sub( scarPit.body.mul( step( 0.85, scarPit.id.x ) ).mul( 0.25 ) ) );
	let color = mix( hull, vec3( 0.18, 0.24, 0.1 ), slime.mul( 0.7 ) );
	color = mix( color, shell, body );
	const across = vec2( C.dir.y.negate(), C.dir.x );
	const slope = C.slopeC.add( across.mul( rib.sub( 0.5 ) ).mul( 0.25 ).mul( wRb ) ).add( across.mul( step1.oneMinus() ).mul( 0.3 ) )
		.add( C.dir.mul( growth ).mul( - 0.15 ) ).mul( body ).mul( u.relief );
	const cavity = body.oneMinus().mul( 0.6 ).max( C.hole.mul( C.live.oneMinus() ) ).max( C.h.oneMinus().mul( 0.4 ).mul( body ) ).max( suture.mul( 0.5 ) );
	return { color, slope, cavity, rough: u.roughness, s2: fadeIn( g, fp, 1.5, 4.0 ).oneMinus().mul( 0.15 ) };

}
