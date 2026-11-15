// Raw meat and animal fat, cut faces.
// Raw meat (a beef steak cut along the grain, angle = fibre direction):
//   L0 marbling  intramuscular fat in thin veins and flecks (feature_mm
//                apart), one broad seam of intermuscular fat, red that
//                drifts from cherry to darker, browner patches (oxidised)
//   L1 bundles   fascicles of size_mm (1 to 3 mm) stretched along the
//                fibres, each its own shade, a thin pale sheath of
//                perimysium between them, each bulging a little
//   L2 fibres    muscle fibres of cell_um (50 to 80 um) side by side, each
//                a rounded rod, a dark film of endomysium at its sides;
//                a wet film over all (clear coat), light through the red
// Fat (beef suet, pork back fat):
//   L0 lobes     creamy white to yellow, smears of pink, a few blood
//                vessels winding through
//   L1 lobules   lobules of size_mm (2 to 6 mm) bulge between thin
//                translucent septa
//   L2 cells     adipocytes of cell_um (60 to 120 um): glossy polygonal
//                drops of lipid packed in a net of bright thin walls
// Returns { color, slope, cavity, rough, s2, coat, coatRough, glow }.

import { vec2, vec3, float, floor, fract, mix, smoothstep } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { rot2, cells, fbm, band, fibres, grains, warp2 } from './common.js';

const STRETCH = 5; // fascicles are this many times longer than wide

// A net of fat veins: Voronoi borders, warped, of uneven width, many
// borders missing, so it reads as a web of streaks, never as tiles.
function marbling( a, fp, F, salt, density ) {

	const q = vec2( a.x.div( 1.6 ), a.y ).add( warp2( a, F.mul( 2.5 ), salt ).mul( F.mul( 1.4 ) ) );
	const V = voronoi( q.div( F.mul( 3 ) ).add( salt ), 0.95 );
	const keep = smoothstep( 0.6, 0.7, valueNoise( V.p1.add( V.p2 ).mul( 0.5 ).add( salt * 3.1 ) ).add( density.sub( 0.5 ).mul( 0.6 ) ) )
		.mul( smoothstep( 0.4, 0.6, valueNoise( q.div( F.mul( 12 ) ).add( salt * 1.9 ) ) ) );
	const wid = F.mul( 0.12 ).mul( valueNoise( q.div( F.mul( 0.7 ) ).add( salt ) ).mul( 1.4 ).add( 0.1 ) );
	return band( V.edge.mul( F.mul( 3 ) ), wid, fp ).mul( keep ).mul( fadeIn( F.mul( 3 ), fp, 1.5, 4.0 ) ).add( fadeIn( F.mul( 3 ), fp, 1.5, 4.0 ).oneMinus().mul( density.mul( 0.15 ) ) );

}

export function buildMeat( p, fp, u ) {

	const s = u.seed;
	const a = rot2( p, u.angle ).add( s.mul( 0.07 ) );
	// L0: marbling at two scales, a few flecks, one broad seam of fat.
	const F = u.featureM;
	const am = a.add( warp2( a, float( 0.03 ), 3.1 ).mul( 0.01 ) );
	const v1 = marbling( am, fp, F, 1.7, u.density );
	const v2 = marbling( am.add( 0.37 ), fp, F.mul( 0.45 ), 5.3, u.density.mul( 0.5 ).sub( 0.15 ) );
	const fleck = smoothstep( 0.74, 0.8, fbm( vec2( am.x.div( 2.5 ), am.y ), F.mul( 0.8 ), fp, 3, 8 ) ).mul( u.density );
	const seamD = am.y.sub( 0.21 ).add( fbm( am, float( 0.06 ), fp, 3, 2 ).sub( 0.5 ).mul( 0.05 ) );
	const seam = band( seamD, float( 0.004 ).add( valueNoise( am.div( 0.03 ) ).mul( 0.005 ) ), fp );
	const fat = v1.max( v2.mul( 0.7 ) ).max( fleck ).max( seam ).min( 1 ).toVar();

	// L1: fascicles in stretched coordinates, soft and low.
	const st = vec2( a.x.div( STRETCH ), a.y );
	const C = cells( st, u.sizeM, fp, 3.3, { jitter: 0.9, crown: 0.6, wallM: u.sizeM.mul( 0.02 ) } );
	const tone = fbm( p, float( 0.05 ), fp, 3, 4 );
	const ox = smoothstep( 0.55, 0.8, fbm( p.add( 1.3 ), float( 0.09 ), fp, 3, 6 ) ).mul( u.colorVar.mul( 2 ) ).min( 1 );
	let red = mix( u.color, u.color.mul( vec3( 0.7, 0.55, 0.55 ) ), tone.sub( 0.3 ).max( 0 ).mul( 1.5 ) );
	red = mix( red, u.color3, ox.mul( 0.5 ) );
	red = red.mul( C.id.x.sub( 0.5 ).mul( 0.25 ).mul( C.w ).add( 1 ) );
	// Perimysium: a pale sheath, here and there, never a full outline.
	const sheath = C.wall.mul( smoothstep( 0.35, 0.7, valueNoise( st.div( u.sizeM.mul( 1.5 ) ).add( 9.1 ) ) ) );
	red = mix( red, u.color2.mul( vec3( 0.85, 0.6, 0.58 ) ), sheath.mul( 0.4 ) );

	// L2: fibres, rods along x, cell_um across, wobbling a little.
	const fy = a.y.div( u.cellM ).add( valueNoise( vec2( a.x.div( u.cellM.mul( 25 ) ), a.y.div( u.cellM.mul( 4 ) ) ) ).mul( 0.6 ) );
	const fid = floor( fy ), ff = fract( fy ).sub( 0.5 );
	const wF = fadeIn( u.cellM, fp, 2.0, 5.0 );
	const film = smoothstep( 0.36, 0.5, ff.abs() );
	red = red.mul( hash1( vec2( fid, C.id.y.mul( 50 ) ) ).sub( 0.5 ).mul( 0.25 ).mul( wF ).add( 1 ) )
		.mul( float( 1 ).sub( film.mul( 0.3 ).mul( wF ) ) );

	// Fat: creamy, faint pink where thin.
	const fatTone = fbm( p.add( 7.1 ), F.mul( 0.8 ), fp, 3, 9 );
	const fatCol = mix( u.color2, u.color2.mul( vec3( 0.95, 0.75, 0.7 ) ), smoothstep( 0.3, 0.8, fatTone ).mul( 0.7 ) );
	const color = mix( red, fatCol, fat );

	// Relief: bundles bulge a little, fibres round, fat stands proud.
	const back = ( v ) => rot2( vec2( v.x.div( STRETCH ), v.y ), u.angle.negate() );
	const fS = vec2( 0, ff.mul( - 0.8 ) ).mul( wF ).mul( fat.oneMinus() );
	const slope = back( C.slope.mul( 0.05 ) ).add( rot2( fS, u.angle.negate() ) ).mul( u.relief );
	const cavity = sheath.mul( 0.3 ).max( film.mul( wF ).mul( 0.3 ) ).mul( fat.oneMinus() );
	const glow = mix( u.color.mul( vec3( 1.0, 0.3, 0.3 ) ), fatCol.mul( 0.7 ), fat );
	const rough = mix( u.roughness, u.roughness.add( 0.1 ), fat );
	return { color, slope, cavity, rough, s2: C.s2.mul( 0.05 ).add( wF.oneMinus().mul( 0.02 ) ), coat: u.wax, coatRough: float( 0.15 ), glow };

}

export function buildFat( p, fp, u ) {

	const s = u.seed;
	// L0: creamy tone, big soft lobes, pink membranes, blood vessels.
	const tone = fbm( p.add( s ), float( 0.06 ), fp, 4, 2 );
	const lobes = voronoi( p.div( 0.03 ).add( s ), 0.9 );
	const mem = band( lobes.edge.mul( 0.03 ), float( 1.2e-3 ).mul( valueNoise( p.div( 0.01 ) ).add( 0.2 ) ), fp ).mul( fadeIn( float( 0.03 ), fp, 1.5, 4.0 ) );
	const pink = smoothstep( 0.55, 0.8, fbm( p.add( 3.3 ), float( 0.03 ), fp, 3, 5 ) ).mul( u.blush );
	const V = fibres( p, u.featureM.mul( 8 ), u.featureM.mul( 0.04 ), u.density.mul( 0.5 ), fp, 4.1, 0.6 );
	// L1: lobules, rounded domes in creases. L2: adipocytes, round drops.
	const L = grains( p, u.sizeM, fp, 6.2, { gap: 0.06, radius: 0.46, round: 0.5, crown: 0.8, elong: 0.4, sizeVar: 0.4 } );
	const A = grains( p, u.cellM, fp, 9.4, { gap: 0.04, radius: 0.5, round: 0.5, crown: 0.6, elong: 0.3 } );
	const wL = fadeIn( u.sizeM, fp, 1.5, 4.0 ), wA = fadeIn( u.cellM, fp, 1.5, 4.0 );

	let color = mix( u.color, u.color2, tone.sub( 0.2 ).max( 0 ).mul( 1.2 ).min( 1 ) );
	color = mix( color, u.color.mul( vec3( 1.0, 0.72, 0.68 ) ), pink.mul( 0.6 ) );
	color = color.mul( L.id.x.sub( 0.5 ).mul( u.colorVar ).mul( wL ).add( 1 ) ).mul( hash1( lobes.id1 ).sub( 0.5 ).mul( 0.16 ).add( 1 ) );
	// Creases between lobules and membranes: translucent, greyer, pinker.
	const crease = L.body.oneMinus().mul( wL );
	color = mix( color, color.mul( vec3( 0.78, 0.66, 0.62 ) ), crease.mul( 0.6 ).max( mem.mul( 0.7 ) ) );
	color = mix( color, u.color3, V.fiber.mul( 0.8 ) );
	// Cells: drops a touch darker inside (light goes in), walls bright.
	color = color.mul( A.h.mul( 0.08 ).add( 0.94 ).mul( wA ).add( wA.oneMinus() ) ).add( vec3( 0.04 ).mul( A.body.oneMinus() ).mul( wA ) );

	const slope = L.grad.mul( 0.12 ).mul( wL ).add( A.grad.mul( 0.3 ).mul( wA ) ).add( V.slope.mul( 0.2 ) ).mul( u.relief );
	const cavity = crease.mul( 0.6 ).max( mem.mul( 0.5 ) ).max( A.body.oneMinus().mul( wA ).mul( 0.2 ) );
	const glow = color.mul( vec3( 1.1, 0.85, 0.6 ) );
	const s2 = wL.oneMinus().mul( 0.03 ).add( wA.oneMinus().mul( 0.02 ) ).mul( u.relief );
	return { color, slope, cavity, rough: u.roughness, s2, coat: u.wax, coatRough: float( 0.15 ), glow };

}
