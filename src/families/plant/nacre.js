// Mother of pearl: the inner layer of a shell, polished, with patches of
// the outer shell left on one side (like a polished abalone).
//   L0 nacre     a thin film whose thickness drifts in broad flames along
//                the growth contours (arcs round the umbo, 25 cm away up
//                the angle), so the colour shifts as the view turns
//   L0 shell     on `shell` share of the face, the outer shell: brown
//                periostracum (color2) on growth ridges (size_mm apart,
//                irregular), darker in the grooves (color3), faint radial
//                ribs; a band of white prismatic layer (color4) at the lip
//   L1 contours  growth lines every 0.1 to 0.3 mm, wavy: the edges of the
//                stacked layers, each a small shift of the film colour
//   L2 tablets   aragonite tablets (cell_um, about 8 um) in terraces 20 um
//                wide: each terrace a new layer of tablets, thin organic
//                seams between them, each tablet its own film thickness;
//                calcite prisms (30 um) in the worn prismatic band
// color = nacre body, color2 = outer shell, color3 = ridges, color4 = prisms.
//
// The tablets, the prismatic band and the outer shell sit in gate()s
// (core/lod.js): they run only where they show.

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod, fract, floor, cos } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, fbm, cells } from './common.js';

export function buildNacre( p, fp, u ) {

	const s = u.seed, cm = u.cellM;
	const ax = dir2( u.angle );
	const c = mod( p, 0.3 ).sub( vec2( 0.15 ) ).add( ax.mul( 0.25 ) ); // from the umbo
	const r = c.length().toVar();
	const dr = c.div( r ).toVar(), tang = vec2( dr.y.negate(), dr.x );
	const ang = c.dot( vec2( ax.y.negate(), ax.x ) ).div( r ).toVar(); // sine of the angle round the umbo

	// Growth contour coordinate: r with slow waves (growth disturbances).
	const z = r.add( fbm( p, float( 0.05 ), fp, 3, 2 ).sub( 0.5 ).mul( 0.01 ) ).add( valueNoise( vec2( ang.mul( 60 ), r.div( 0.02 ) ) ).sub( 0.5 ).mul( 0.0015 ) ).toVar();

	// Where the outer shell remains: beyond a ragged line far from the umbo.
	const rs = float( 0.4 ).sub( u.shell.mul( 0.3 ) );
	const lipD = r.sub( rs ).add( fbm( p, float( 0.06 ), fp, 4, 5 ).sub( 0.5 ).mul( 0.05 ) ); // > 0: outer shell
	const shellM = clamp( lipD.sub( 0.003 ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( 0.01, u.shell ) ).toVar();
	const prism = clamp( lipD.div( fp ).add( 0.5 ), 0, 1 ).mul( float( 1 ).sub( shellM ) ).mul( step( 0.01, u.shell ) ).toVar();

	// Nacre: film thickness in flames along the contours.
	const flame = fbm( vec2( z.div( 0.004 ), ang.mul( 3 ) ).mul( 0.01 ).add( 5 ), float( 0.01 ), fp, 4, 7 );
	const cq = z.div( 1.8e-4 );
	const cq2 = cq.add( valueNoise( wrapCoord( vec2( cq.mul( 0.3 ), ang.mul( 400 ) ) ) ).mul( 0.8 ) );
	const wC = fadeIn( float( 1.8e-4 ), fp, 3.0, 8.0 );
	const contour = fract( cq2 );
	const cline = band( float( 0.5 ).sub( contour.sub( 0.5 ).abs() ).mul( 1.8e-4 ), float( 4e-6 ), fp ).mul( wC );

	// Tablets in terraces: each terrace a new layer, its own tablet seed.
	// They and the terrace edges run only where the tablets or the
	// terraces span 3 px (their widest fades).
	const T = gate( fadeOn( cm, fp, 3.0 ).or( fadeOn( 2e-5, fp, 3.0 ) ), { wall: 0, tone: 0, sT: [ 0, 0 ], tEdge: 0 }, () => {

		const tk = floor( z.div( 2e-5 ).add( valueNoise( wrapCoord( p.div( 6e-5 ) ) ).mul( 0.8 ) ) );
		const tkm = mod( tk, 512 );
		const C = cells( p.add( vec2( hash1( vec2( tkm, 1.1 ) ), hash1( vec2( tkm, 2.3 ) ) ).mul( cm.mul( 7 ) ) ), fp, cm, cm.mul( 0.03 ), s.mul( 3.3 ), 0, 0.02 );
		const ht = hash3( C.V.id1.add( tkm.mul( 0.37 ) ) );
		return {
			wall: C.wall, tone: ht.x.sub( 0.5 ).mul( 0.2 ).mul( C.w ), sT: ht.yz.sub( 0.5 ).mul( 0.012 ).mul( C.w ),
			tEdge: band( fract( z.div( 2e-5 ).add( valueNoise( wrapCoord( p.div( 6e-5 ) ) ).mul( 0.8 ) ) ).sub( 0.5 ).abs().sub( 0.5 ).mul( 2e-5 ), float( 6e-7 ), fp ).mul( fadeIn( float( 2e-5 ), fp, 3.0, 8.0 ) ),
		};

	}, [ p, fp, z ] );
	const tEdge = T.tEdge;

	const film = flame.mul( 0.8 ).add( contour.mul( 0.15 ).mul( wC ) ).add( T.tone ).clamp( 0, 1 );
	const tint = mix( vec3( 1.0, 0.96, 0.97 ), vec3( 0.94, 1.0, 0.98 ), flame );
	let nacre = u.color.mul( tint ).mul( fbm( p, float( 0.02 ), fp, 3, 9 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	// Light comes back from hundreds of stacked layers, so even the diffuse
	// part carries pastel interference colours (the film lobe adds the
	// view-dependent part).
	const hue = cos( film.mul( 1.6 ).add( vec3( 0, 0.33, 0.67 ) ).mul( 6.2832 ) ).mul( 0.5 ).add( 0.5 );
	nacre = mix( nacre, nacre.mul( hue.mul( 0.8 ).add( 0.45 ) ), u.irid.mul( 0.45 ) );
	nacre = nacre.mul( float( 1 ).sub( cline.mul( 0.1 ) ) ).mul( float( 1 ).sub( T.wall.mul( 0.25 ) ) ).mul( float( 1 ).sub( tEdge.mul( 0.2 ) ) );
	const sNacre = dr.mul( contour.sub( 0.5 ).mul( 0.02 ).mul( wC ) ).add( T.sT ).add( dr.mul( tEdge.mul( - 0.15 ) ) );

	// Prismatic band: white calcite prisms seen end on. Only on the band
	// (prism > 0).
	const pq = wrapCoord( p.div( 3e-5 ) ).add( 7.7 ).toVar();
	const P = gate( prism.greaterThan( 0 ), { color: [ 0, 0, 0 ], slope: [ 0, 0 ] }, () => {

		const C = cells( p, fp, float( 3e-5 ), 1e-6, 7.7, 0.1, 0.15, pq );
		return { color: u.color4.mul( hash1( C.V.id1 ).mul( 0.15 ).add( 0.92 ) ).mul( float( 1 ).sub( C.wall.mul( 0.35 ) ) ), slope: C.slope.mul( 0.4 ) };

	}, [ p, fp, pq ] );

	// Outer shell: growth ridges, irregular, with fine lines between. Only
	// where it shows (shellM > 0).
	const S = gate( shellM.greaterThan( 0 ), { color: [ 0, 0, 0 ], slope: [ 0, 0 ], ridgeH: 0, crust: 0, wG: 0 }, () => {

		const sm = u.sizeM;
		const gq = z.div( sm );
		const gq2 = gq.add( valueNoise( vec2( gq.mul( 0.5 ), ang.mul( 4 ) ) ).mul( 1.2 ) );
		const gf = fract( gq2 );
		const wG = fadeIn( sm, fp, 2.0, 5.0 );
		// A ridge: steep toward the umbo, gentle away (the new shell overlaps).
		const ridgeH = smoothstep( 0.0, 0.15, gf ).mul( smoothstep( 1.0, 0.3, gf ) );
		const sRidge = dr.mul( mix( float( 1.4 ), float( - 0.35 ), step( 0.15, gf ) ) ).mul( ridgeH.max( 0.2 ) ).mul( u.ridges ).mul( 0.6 ).mul( wG );
		const fine = fract( z.div( sm.mul( 0.12 ) ) ).sub( 0.5 ).mul( fadeIn( sm.mul( 0.12 ), fp, 3.0, 8.0 ) );
		const rib = valueNoise( vec2( ang.mul( 120 ), r.div( 0.05 ) ) ).sub( 0.5 );
		let shellC = u.color2.mul( fbm( p, float( 0.015 ), fp, 4, 11 ).sub( 0.5 ).mul( 0.5 ).add( 1 ) ).mul( rib.mul( 0.2 ).add( 1 ) );
		shellC = mix( shellC, u.color3, float( 1 ).sub( ridgeH ).mul( u.ridges ).mul( 0.6 ).mul( wG ).add( float( 1 ).sub( wG ).mul( 0.3 ) ) );
		shellC = shellC.mul( fine.mul( 0.15 ).add( 1 ) );
		// Lime crust and worn spots on the old shell.
		// Lime crust: small chalky specks in the grooves.
		const crust = smoothstep( 0.66, 0.74, fbm( p, float( 0.006 ), fp, 4, 13 ) ).mul( float( 1 ).sub( ridgeH ) );
		shellC = mix( shellC, u.color4.mul( 0.85 ), crust.mul( 0.6 ) );
		const sShell = sRidge.add( dr.mul( fine.mul( 0.1 ) ) ).add( tang.mul( rib.mul( 0.15 ) ) );
		return { color: shellC, slope: sShell, ridgeH, crust, wG };

	}, [ p, fp, z, r, dr, ang ] );

	let color = mix( nacre, P.color, prism );
	color = mix( color, S.color, shellM );
	const slope = mix( mix( sNacre, P.slope, prism ), S.slope, shellM );
	const onNacre = float( 1 ).sub( prism ).mul( float( 1 ).sub( shellM ) );
	const rough = mix( mix( u.roughness.add( T.wall.mul( 0.1 ) ), float( 0.4 ), prism ), float( 0.65 ).sub( S.crust.mul( - 0.15 ) ), shellM );
	const cavity = float( 1 ).sub( S.ridgeH ).mul( shellM ).mul( 0.6 ).max( T.wall.mul( 0.3 ).mul( onNacre ) );
	const s2 = float( 1 ).sub( wC ).mul( 0.0005 ).mul( onNacre ).add( float( 1 ).sub( S.wG ).mul( 0.05 ).mul( shellM ) );
	const irid = { amount: u.irid.mul( onNacre ), thickness: mix( u.iridMin, u.iridMax, film ) };
	return { color: clamp( color, 0, 1 ), slope, cavity, rough, s2, irid };

}
