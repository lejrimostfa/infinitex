// Bone: the outer face of a long bone, partly sawn open.
//   L0 surface   ivory compact bone, yellow stains and grease (color2),
//                growth lines across the axis, fine striation along it
//   L0 cut       on part of the face (cut) the bone is sawn: a band of
//                compact cortex (4 to 6 mm), then spongy bone: struts
//                (trabeculae, 0.2 to 0.5 mm) around marrow cavities of
//                1 to 2 mm, dark red brown (color3)
//   L1 canals    nutrient foramina (0.5 mm) and vascular canal openings
//                (0.1 mm), long along the axis; the struts show here
//   L2 osteons   size_mm (about 0.22 mm): each a Haversian canal (50 um,
//                color4) inside concentric lamellae (5 um), cut obliquely
//                so long along the axis; cement lines between them;
//                osteocyte lacunae (cell_um apart, 10 x 4 um) on the rings
// color = ivory, color2 = yellow stain, color3 = marrow, color4 = canal.

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod, floor, fract, max } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, lines, fbm, scratches } from './common.js';

export function buildBone( p, fp, u ) {

	const s = u.seed, ost = u.sizeM;
	const ax = dir2( u.angle ), ay = vec2( ax.y.negate(), ax.x );
	const tx = p.dot( ax ), ty = p.dot( ay );
	// Bone frame: long along the axis, so stretch across before cells.
	const q = vec2( tx.mul( 0.35 ), ty ).add( 1 );

	// Where the face is sawn: a ragged line across the bone axis.
	const cutX = float( 0.3 ).mul( float( 1 ).sub( u.cut ) );
	const edgeN = fbm( vec2( ty.add( 7 ), s ), float( 0.03 ), fp, 3, 2 ).sub( 0.5 ).mul( 0.02 );
	const dc = p.x.sub( cutX ).add( edgeN ); // > 0 inside the cut
	const cutM = clamp( dc.div( fp ).add( 0.5 ), 0, 1 ).mul( step( 0.01, u.cut ) );
	const cortexW = float( 0.005 ).add( fbm( vec2( ty.add( 3 ), s ), float( 0.04 ), fp, 2, 4 ).mul( 0.003 ) );
	const spongy = smoothstep( cortexW, cortexW.add( 0.0015 ), dc ).mul( cutM );

	// Outer surface: stains, growth lines, striation, foramina.
	const stain = smoothstep( 0.45, 0.85, fbm( p, float( 0.08 ), fp, 4, 3 ) );
	const growth = lines( tx.add( fbm( p, float( 0.05 ), fp, 2, 6 ).mul( 0.01 ) ), float( 0.004 ), 4e-4, fp, 2.0, 6.0 ).mul( u.bands );
	const striaN = valueNoise( mod( vec2( tx.add( 1 ).div( 0.004 ), ty.add( 1 ).div( 1.2e-4 ) ), 4096 ) ).sub( 0.5 ).mul( fadeIn( float( 1.2e-4 ), fp, 2.0, 5.0 ) );
	const F = voronoi( mod( q.div( 0.004 ), 4096 ).add( s ), 0.8 );
	const hf = hash3( F.id1.add( 5.5 ) );
	const fv = F.toSeed.mul( 0.004 );
	const fr = hf.x.mul( 1.5e-4 ).add( 4e-5 ); // half width across the axis
	const fe = fv.x.div( fr.mul( 3 ).mul( 0.35 ) ).pow( 2 ).add( fv.y.div( fr ).pow( 2 ) );
	const foramen = clamp( float( 1 ).sub( fe ).mul( fr ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( hf.y, u.pores.mul( 0.6 ) ) ).mul( fadeIn( fr, fp, 1.0, 3.0 ) );
	const foramenRim = smoothstep( 2.2, 1.0, fe ).mul( float( 1 ).sub( foramen ) ).mul( step( hf.y, u.pores.mul( 0.6 ) ) );

	// Osteons (Haversian systems), everywhere on the compact bone.
	const O = voronoi( mod( q.div( ost ), 4096 ).add( s.mul( 2.1 ) ), 0.85 );
	const ho = hash3( O.id1.add( 1.1 ) );
	const ov = O.toSeed.mul( ost );
	const or = ov.length(); // in the squeezed frame: rings 3 x longer along the axis
	const wO = fadeIn( ost, fp, 2.5, 6.0 );
	const canR = ho.x.mul( 2e-5 ).add( 1.6e-5 );
	const canal = clamp( canR.sub( or ).div( fp ).add( 0.5 ), 0, 1 ).mul( wO ).mul( fadeIn( canR.mul( 2 ), fp, 2.0, 5.0 ) );
	const lam = lines( or, float( 6e-6 ), 1.2e-6, fp, 2.0, 5.0 ).mul( wO ).mul( smoothstep( 0.02, 0.12, O.edge ) );
	const cement = band( O.edge.mul( ost ), 1.5e-6, fp ).mul( wO );
	// Lacunae: tiny dark lens shapes on the rings.
	const lc = u.cellM;
	const L = voronoi( mod( q.div( lc ), 4096 ).add( 3.3 ), 0.7 );
	// Each lacuna lies along the ring it sits on (tangent of the osteon).
	const lv = L.toSeed.mul( lc ), on = ov.div( or.max( 1e-7 ) );
	const la = lv.dot( vec2( on.y.negate(), on.x ) ), lr = lv.dot( on );
	const lac = clamp( float( 1 ).sub( la.div( lc.mul( 0.18 ) ).pow( 2 ).add( lr.div( lc.mul( 0.07 ) ).pow( 2 ) ) ).mul( lc.mul( 0.07 ) ).div( fp ).add( 0.5 ), 0, 1 )
		.mul( step( hash1( L.id1 ), 0.6 ) ).mul( fadeIn( lc.mul( 0.3 ), fp, 2.0, 5.0 ) ).mul( float( 1 ).sub( canal ) );

	// Spongy bone: struts around cavities, two scales of holes.
	const tq = mod( p.div( 1.8e-3 ), 4096 ).add( s.mul( 3.7 ) );
	const T = voronoi( tq.add( vec2( valueNoise( tq.mul( 1.7 ) ), valueNoise( tq.mul( 1.7 ).add( 5.3 ) ) ).sub( 0.5 ).mul( 0.7 ) ), 0.9 );
	const T2 = voronoi( mod( p.div( 6e-4 ), 4096 ).add( 9.2 ), 0.9 );
	const strutW = hash1( T.id1.add( T.id2 ) ).mul( 0.12 ).add( 0.05 ).mul( valueNoise( tq.mul( 3.1 ).add( 2.2 ) ).mul( 0.8 ).add( 0.6 ) );
	const strut = clamp( strutW.sub( T.edge ).mul( 1.8e-3 ).div( fp ).add( 0.5 ), 0, 1 );
	const hole2 = clamp( T2.toSeed.length().sub( 0.28 ).mul( - 6e-4 ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( hash1( T2.id1 ), 0.3 ) );
	const bone2 = strut;
	const depth = smoothstep( strutW, strutW.add( 0.35 ), T.edge ); // deeper toward a cavity centre
	// Struts are round: lit on top, shaded toward their flanks.
	const strutTop = float( 1 ).sub( T.edge.div( strutW.max( 0.01 ) ).clamp( 0, 1 ).pow( 2 ).mul( 0.35 ) );
	const marrow = u.color3.mul( float( 1 ).sub( depth.mul( 0.85 ) ) ).mul( float( 1 ).sub( hole2.mul( 0.6 ) ) ).mul( valueNoise( mod( p.div( 2e-4 ), 4096 ) ).mul( 0.4 ).add( 0.8 ) );
	const wT = fadeIn( float( 1.8e-3 ), fp, 2.0, 5.0 );

	// Colour.
	let ivory = u.color.mul( fbm( p, float( 0.02 ), fp, 4, 8 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	ivory = mix( ivory, u.color2, stain.mul( 0.55 ) ).mul( float( 1 ).sub( growth.mul( 0.05 ) ) ).mul( striaN.mul( 0.08 ).add( 1 ) );
	// Each osteon its own shade (mineral age), rings and cement lines.
	let surf = ivory.mul( ho.z.sub( 0.5 ).mul( 0.06 ).mul( wO ).add( 1 ) ).mul( float( 1 ).sub( cement.mul( 0.25 ) ) ).mul( float( 1 ).sub( lam.mul( 0.1 ) ) );
	// Canal: dark lumen, a pale rim of the newest lamella.
	const canRim = band( or.sub( canR.mul( 1.25 ) ), canR.mul( 0.2 ), fp ).mul( wO );
	surf = mix( surf, surf.mul( 1.08 ), canRim );
	surf = mix( surf, u.color4.mul( ho.y.mul( 0.5 ).add( 0.3 ) ), canal.mul( 0.9 ) );
	surf = mix( surf, u.color4.mul( 0.4 ), lac.mul( 0.8 ) );
	surf = mix( surf, surf.mul( 0.8 ), foramenRim.mul( 0.4 ) );
	surf = mix( surf, u.color4.mul( 0.25 ), foramen );
	// Cut: compact band (same osteons, a little greyer), spongy inside.
	// The saw cuts through the stains: the cut is cleaner and whiter.
	const cutCol = mix( surf, surf.div( ivory.max( vec3( 0.05 ) ) ).mul( u.color ).mul( 1.06 ), 0.8 );
	const sp = mix( marrow, cutCol.mul( strutTop ), bone2 );
	const spF = mix( mix( marrow, cutCol, 0.45 ), sp, wT );
	let color = mix( surf, cutCol, cutM );
	// The cut edge: a thin chamfer line where the saw left the surface.
	color = color.mul( float( 1 ).sub( band( dc, float( 1.5e-4 ), fp ).mul( 0.3 ).mul( step( 0.01, u.cut ) ) ) );
	color = mix( color, spF, spongy );

	// Relief: the surface is smooth with sunken pores; the cut is flat
	// with deep cavities; saw marks across the cut.
	const sawn = lines( p.dot( dir2( 1.4 ) ), float( 3e-4 ), 6e-5, fp, 2.0, 6.0 ).mul( cutM ).mul( u.polish.oneMinus() );
	const h = foramen.mul( - 1e-4 ).sub( foramenRim.mul( 2e-5 ) ).sub( canal.mul( 3e-6 ) ).sub( growth.mul( 1e-5 ) ).add( sawn.mul( 3e-6 ) );
	const sCav = T.dir.mul( depth.mul( 0.8 ) ).mul( float( 1 ).sub( bone2 ) ).mul( spongy ).mul( wT );
	const slope = surfaceGradient( h, p ).add( sCav ).add( vec2( 0, striaN.mul( 0.08 ) ) ).add( ax.mul( valueNoise( mod( p.div( 0.02 ), 4096 ) ).sub( 0.5 ).mul( 0.06 ) ) );
	const scr = scratches( p, fp, float( 4e-4 ), 1e-6, u.polish.mul( 0.5 ), 5 );
	color = color.mul( scr.mul( 0.06 ).add( 1 ) );
	const rough = mix( float( 0.6 ), float( 0.25 ), u.polish ).add( spongy.mul( float( 1 ).sub( bone2 ) ).mul( 0.3 ) ).add( stain.mul( - 0.08 ) ).mul( u.roughness.div( 0.45 ) ).clamp( 0.08, 1 );
	const cavity = foramen.max( canal ).max( spongy.mul( float( 1 ).sub( bone2 ) ) ).max( lac.mul( 0.6 ) );
	const s2 = float( 1 ).sub( wO ).mul( 0.002 ).add( spongy.mul( float( 1 ).sub( wT ) ).mul( 0.1 ) );
	// Light through thin bone: warm, blood-free ivory.
	const glow = u.color.mul( vec3( 1.0, 0.85, 0.6 ) ).mul( float( 1 ).sub( spongy.mul( 0.5 ) ) );
	return { color: clamp( color, 0, 1 ), slope, cavity, rough, s2, glow };

}
