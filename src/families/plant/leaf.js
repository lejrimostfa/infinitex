// Leaf: the upper side of a dicot leaf blade, the face of the cube is the
// blade (25 secondary spacings wide).
//   L0 midrib    1.2 mm wide, sunken, pale; it wanders a little
//   L0 seconds   pinnate veins every size_mm (about 18 mm), leaving the
//                midrib at about 45 degrees and bending toward the apex,
//                alternate on each side, 0.3 mm thinning to 0.1 mm
//   L1 net       tertiary veins on a 3.5 mm net, quaternary on 0.9 mm,
//                the last order (0.3 mm) encloses the areoles; each
//                areole bulges between its veins (bullate blade)
//   L2 cells     jigsaw pavement cells (cell_um, about 50 um) under a
//                smooth waxy cuticle; palisade cells (18 um) show green
//                through them; stomata: two guard cells (26 x 18 um,
//                green, they hold chloroplasts) around a dark slit
// Light crosses the blade (glow): yellow green, brighter on the veins.
// color = lamina, color2 = veins, color3 = dark mottle, color4 = wax.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, mod, sqrt, max } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, fbm, net, cells } from './common.js';

// Pinnate secondary veins on both sides of the midrib. Returns the
// distance to the nearest secondary (meters) and its half width.
function secondaries( tx, ty, sp, leafW, seed ) {

	const a = ty.abs(), side = step( 0, ty );
	const f = a.mul( 0.75 ).add( a.mul( a ).div( leafW ).mul( 3.2 ) ); // the vein bends toward the apex
	const df = a.mul( 6.4 ).div( leafW ).add( 0.75 );
	const s = tx.sub( f ).div( sp ).add( side.mul( 0.5 ) ).add( seed );
	// Spacing and course wander: a noise along the vein (a) and across (s).
	const s2 = s.add( valueNoise( vec2( s.mul( 0.55 ), side.mul( 7 ).add( seed ) ) ).sub( 0.5 ).mul( 0.6 ) )
		.add( valueNoise( vec2( s.mul( 0.8 ).add( 3.3 ), a.div( sp ).mul( 0.5 ) ) ).sub( 0.5 ).mul( 0.35 ) );
	const fr = fract( s2 ).sub( 0.5 );
	const d = fr.abs().mul( sp ).div( sqrt( df.mul( df ).add( 1 ) ) );
	const id = floor( s2 );
	// Thick near the midrib, thin toward the margin; each vein its own.
	const hw = mix( float( 1.6e-4 ), float( 5e-5 ), a.div( leafW.mul( 0.5 ) ).clamp( 0, 1 ) ).mul( hash1( vec2( id, side ) ).mul( 0.5 ).add( 0.75 ) );
	return { d, hw, id };

}

export function buildLeaf( p, fp, u ) {

	const s = u.seed, sp = u.sizeM, leafW = float( 0.3 ); // a big leaf: catalpa, fig
	const ax = dir2( u.angle ), ay = vec2( ax.y.negate(), ax.x );
	const c = mod( p, leafW ).sub( leafW.mul( 0.5 ) );
	const tx = c.dot( ax );
	const ty = c.dot( ay ).add( fbm( vec2( tx.add( 50 ), s ), float( 0.12 ), fp, 2, 3 ).sub( 0.5 ).mul( 0.012 ) );

	// Midrib and secondaries.
	const midHW = float( 6e-4 );
	const mid = band( ty, midHW, fp );
	const midSoft = smoothstep( midHW.mul( 2.2 ).add( fp ), float( 0 ), ty.abs() );
	const S = secondaries( tx, ty, sp, leafW, s );
	const wSec = fadeIn( sp, fp, 3.0, 8.0 );
	const sec = band( S.d, S.hw, fp ).mul( wSec ).mul( smoothstep( midHW.mul( 0.3 ), midHW.mul( 0.9 ), ty.abs() ) );
	const secSoft = smoothstep( S.hw.mul( 2.5 ).add( fp ), float( 0 ), S.d ).mul( wSec );

	// Vein net: tertiary, quaternary, areole borders.
	const N3 = net( p, fp, sp.mul( 0.3 ), 5e-5, s.mul( 3.3 ).add( 1 ), 0.45 );
	const N4 = net( p, fp, sp.mul( 0.075 ), 2.4e-5, s.mul( 5.1 ).add( 2 ), 0.4 );
	const N5 = net( p, fp, sp.mul( 0.028 ), 1.1e-5, s.mul( 7.7 ).add( 3 ), 0.35 );
	const v5 = N5.line.mul( step( 0.25, hash1( N5.V.id1.add( N5.V.id2 ).mul( 0.61 ) ) ) ); // some veinlets end freely
	const vein = max( mid, sec ).max( N3.line.mul( 0.7 ) ).max( N4.line.mul( 0.45 ) ).max( v5.mul( 0.28 ) ).mul( u.veins ).toVar();

	// Relief: veins sunken, areoles bulge between them.
	const h = midSoft.mul( - 2.2e-4 ).sub( secSoft.mul( 7e-5 ) ).mul( u.veins );
	const sNet = N3.dir.mul( N3.g.mul( - 2.2e-5 ) ).add( N4.dir.mul( N4.g.mul( - 8e-6 ) ) ).add( N5.dir.mul( N5.g.mul( - 2.5e-6 ) ) ).mul( u.veins );
	const puff = N4.V.toSeed.mul( - 0.06 ).mul( N4.w ).add( N5.V.toSeed.mul( - 0.05 ).mul( N5.w ) );

	// Epidermis: jigsaw pavement cells under the cuticle.
	const cm = u.cellM;
	const E = cells( p, fp, cm, 1.4e-6, s.mul( 11.3 ), 0.8, 0.12 );
	const he = hash3( E.V.id1.add( 4.4 ) );
	// Stomata on their own jittered grid (1.6 cells apart), not over veins:
	// two kidney guard cells, green, around a dark slit with pale lips.
	const gq = mod( p.div( cm.mul( 1.6 ) ), 4096 ).add( s.mul( 2.9 ) );
	const gid = floor( gq ), hs = hash3( gid.add( 4.4 ) );
	const isSt = step( hs.x, u.stomata.mul( 0.45 ) ).mul( float( 1 ).sub( vein.mul( 5 ) ).max( 0 ) ).mul( fadeIn( cm.mul( 0.5 ), fp, 3.0, 9.0 ) );
	const so = dir2( hs.y.mul( 6.283 ) );
	const v = fract( gq ).sub( hs.yz.mul( 0.3 ).add( 0.35 ) ).mul( cm.mul( 1.6 ) );
	const vx = v.dot( so ), vy = v.dot( vec2( so.y.negate(), so.x ) );
	const ga = cm.mul( 0.27 ), gb = cm.mul( 0.2 );
	const e = vx.div( ga ).pow( 2 ).add( vy.div( gb ).pow( 2 ) );
	const guard = clamp( float( 1 ).sub( e ).mul( gb ).mul( 0.5 ).div( fp ).add( 0.5 ), 0, 1 ).mul( isSt );
	const halo = smoothstep( 1.9, 1.1, e ).mul( isSt ); // subsidiary zone: no pavement walls
	const pore = band( vy, cm.mul( 0.022 ).mul( smoothstep( 0.7, 0.2, vx.abs().div( ga ) ) ), fp ).mul( smoothstep( 0.7, 0.55, vx.abs().div( ga ) ) ).mul( guard );
	const lip = band( vy.abs().sub( cm.mul( 0.035 ) ), cm.mul( 0.01 ), fp ).mul( smoothstep( 0.7, 0.5, vx.abs().div( ga ) ) ).mul( guard );
	const gRim = band( e.sqrt().sub( 1 ).mul( gb ), cm.mul( 0.012 ), fp ).mul( isSt );
	// Each guard cell is a sausage: it bulges away from the pore.
	const across = vy.abs().div( gb ).sub( 0.5 ).mul( 2 );
	const gSl = vec2( vx.div( ga ).mul( - 0.25 ), vy.sign().mul( across ).mul( - 0.35 ) ).mul( guard );
	const gS = so.mul( gSl.x ).add( vec2( so.y.negate(), so.x ).mul( gSl.y ) );
	const slit = pore;

	// Palisade cells under the epidermis: soft green discs, 18 um.
	const P = voronoi( mod( p.div( cm.mul( 0.36 ) ), 4096 ).add( 6.6 ), 0.8 );
	const wP = fadeIn( cm.mul( 0.36 ), fp, 2.0, 5.0 );
	const pal = smoothstep( 0.1, 0.4, P.edge ).sub( 0.5 ).mul( wP );

	// Colour.
	const big = fbm( p, float( 0.06 ), fp, 3, 5 );
	const mott = smoothstep( 0.35, 0.75, fbm( p, float( 0.018 ), fp, 3, 9 ) );
	let lam = u.color.mul( big.sub( 0.5 ).mul( u.colorVar ).mul( 2 ).add( 1 ) );
	lam = mix( lam, u.color3, mott.mul( 0.35 ) );
	// Areole hearts a touch darker: more mesophyll under the bulge.
	lam = lam.mul( float( 1 ).sub( smoothstep( 0.0, 0.4, N4.V.edge ).mul( 0.08 ).mul( N4.w ) ) );
	let color = mix( lam, u.color2, vein.mul( 0.85 ) );
	color = color.mul( pal.mul( 0.12 ).add( 1 ) ).mul( he.z.sub( 0.5 ).mul( 0.04 ).mul( E.w ).add( 1 ) );
	const wall = E.wall.mul( float( 1 ).sub( halo ) );
	color = color.mul( float( 1 ).sub( wall.mul( 0.25 ) ) );
	color = mix( color, mix( u.color, u.color2, 0.35 ).mul( 1.1 ), guard.mul( 0.75 ) );
	color = mix( color, color.mul( 0.55 ), gRim.mul( 0.6 ) );
	color = mix( color, color.mul( 1.35 ), lip.mul( 0.6 ) );
	color = mix( color, vec3( 0.015, 0.02, 0.01 ), slit.mul( 0.9 ) );

	const slope = surfaceGradient( h, p ).add( sNet ).add( puff ).add( E.slope.mul( float( 1 ).sub( halo ) ).mul( 0.5 ) ).add( gS );
	const rough = u.roughness.add( vein.mul( 0.08 ) ).add( slit.mul( 0.4 ) ).clamp( 0.05, 1 );
	const s2 = float( 1 ).sub( E.w ).mul( 0.004 ).add( float( 1 ).sub( N5.w ).mul( 0.002 ) );
	const cavity = vein.mul( 0.5 ).max( wall.mul( 0.3 ) ).max( slit );
	// Transmitted light: chlorophyll keeps green and some red out of the
	// blue; thin veins pass more light.
	const glow = mix( u.color.mul( vec3( 1.3, 1.6, 0.35 ) ), u.color2.mul( vec3( 1.2, 1.3, 0.5 ) ), vein.mul( 0.7 ) );
	return { color: clamp( color, 0, 1 ), slope, cavity, rough, s2, glow, sheen: u.color4.mul( u.sheen ) };

}
