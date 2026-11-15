// Ceramic and glass preset -> uniforms. One mode per graph, chosen when it
// is built:
//   glaze   a glass coat fired on a clay body (porcelain, faience): crackle
//           in generations, inked or not, bubbles in the coat, pinholes,
//           pooling, a hand-painted cobalt motif
//   clay    unglazed fired clay (terracotta): grog, pores, tool marks,
//           salt bloom
//   glass   a block of glass seen through (transmission): frosted by sand
//           blasting, or blown with seed bubbles, cords and waviness
//   enamel  vitreous enamel fused on steel: deep glossy colour, bubbles in
//           the layer, chips that show the ground coat and the steel
// Gloss of the glazes comes from their own clear coat, not from the shared
// surface state (which stays free for wetness and wear).

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const CERAMIC_DEFAULTS = {
	schema_version: 1,
	family: 'ceramic',
	intent: 'crackle glazed porcelain',
	seed: 1,
	mode: 'glaze', // glaze | clay | glass | enamel
	body_color: '#e9e4d6', // clay body (glaze: seen where the coat is thin)
	glaze_color: '#dcd8c8', // glaze, enamel colour
	color_variation: 0.1,
	glaze_roughness: 0.06, // roughness of the coat surface
	orange_peel: 0.4, // soft waviness of a fired coat
	pooling: 0.4, // glaze thickness changes: thin spots show the body
	crackle: 0, // net of cracks in the coat, 0..1
	crackle_mm: 16, // first generation cell size
	crackle_fine: 1, // weight of the second and third generations
	ink: 1, // ink rubbed into the cracks (0: plain crazing)
	ink_color: '#1c1a18', // first generation
	ink2_color: '#a07a48', // second generation (gold thread)
	bubbles: 0.5, // bubbles held in the coat
	bubble_um: 80,
	pinholes: 0, // bubbles burst at the surface
	specks: 0, // dark grains of iron or dust in the coat
	paint: 0, // hand-painted motif under the glaze
	paint_color: '#1d3c8c',
	motif_mm: 100, // motif repeat
	// clay
	grog: 0.6, // crushed fired clay mixed in
	grog_mm: 1.2,
	grog_color: '#d89a76',
	pores: 0.5,
	tool_marks: 0.5, // scraping and throwing marks
	tool_mm: 3,
	angle_deg: 0, // direction of the tool marks, the glass flow
	efflorescence: 0, // white salt bloom
	efflorescence_color: '#ece8e0',
	// glass
	frost: 0, // sand-blasted pits
	frost_um: 50,
	seeds: 0, // bubbles inside the glass
	seed_mm: 1.2,
	cords: 0, // streaks of other glass
	wave: 0, // surface waviness of blown glass
	clear_mm: 0, // frosted: width of clear bands left unblasted (0: none)
	clear_every_mm: 75,
	ior: 1.5,
	tint_color: '#eef4ee', // attenuation colour
	tint_mm: 400, // attenuation distance
	thickness_mm: 60, // light path for refraction
	// enamel
	chips: 0,
	chip_mm: 5,
	panel_mm: 0, // size of the enamelled panel (uv square); its edges chip
	ground_color: '#2a2e3a', // ground coat between steel and colour coat
	steel_color: '#3c3d40',
	roughness: 0.5,
	sheen: 0,
	...SURFACE_DEFAULTS,
};

export const CERAMIC_SLIDERS = [
	[ 'crackle', 0, 1, 0.01 ],
	[ 'crackle_mm', 2, 60, 0.5 ],
	[ 'crackle_fine', 0, 1, 0.01 ],
	[ 'ink', 0, 1, 0.01 ],
	[ 'bubbles', 0, 1, 0.01 ],
	[ 'pinholes', 0, 1, 0.01 ],
	[ 'specks', 0, 1, 0.01 ],
	[ 'pooling', 0, 1, 0.01 ],
	[ 'orange_peel', 0, 1, 0.01 ],
	[ 'grog', 0, 1, 0.01 ],
	[ 'pores', 0, 1, 0.01 ],
	[ 'tool_marks', 0, 1, 0.01 ],
	[ 'efflorescence', 0, 1, 0.01 ],
	[ 'frost', 0, 1, 0.01 ],
	[ 'seeds', 0, 1, 0.01 ],
	[ 'cords', 0, 1, 0.01 ],
	[ 'wave', 0, 1, 0.01 ],
	[ 'chips', 0, 1, 0.01 ],
	[ 'glaze_roughness', 0.02, 0.6, 0.01 ],
	[ 'roughness', 0.1, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createCeramicUniforms() {

	const c = () => uniform( new Color() ), f = ( v ) => uniform( v );
	return {
		mode: 'glaze', // read when the graph is built
		seed: f( 1 ), bodyColor: c(), glazeColor: c(), colorVar: f( 0.1 ), glazeRough: f( 0.06 ), orangePeel: f( 0.4 ), pooling: f( 0.4 ),
		crackle: f( 0 ), crackleM: f( 0.016 ), crackleFine: f( 1 ), ink: f( 1 ), inkColor: c(), ink2Color: c(),
		bubbles: f( 0.5 ), bubbleM: f( 8e-5 ), pinholes: f( 0 ), specks: f( 0 ), paint: f( 0 ), paintColor: c(), motifM: f( 0.1 ),
		grog: f( 0.6 ), grogM: f( 1.2e-3 ), grogColor: c(), pores: f( 0.5 ), toolMarks: f( 0.5 ), toolM: f( 3e-3 ), angle: f( 0 ),
		efflor: f( 0 ), efflorColor: c(),
		frost: f( 0 ), frostM: f( 5e-5 ), seeds: f( 0 ), seedM: f( 1.2e-3 ), cords: f( 0 ), wave: f( 0 ), clearM: f( 0 ), clearEvery: f( 0.075 ),
		ior: f( 1.5 ), tintColor: c(), tintM: f( 0.4 ), thicknessM: f( 0.06 ),
		chips: f( 0 ), chipM: f( 5e-3 ), panelM: f( 0 ), groundColor: c(), steelColor: c(),
		roughness: f( 0.5 ), sheen: f( 0 ),
		surface: createSurfaceUniforms(),
	};

}

export function applyCeramicPreset( u, preset ) {

	const p = { ...CERAMIC_DEFAULTS, ...preset };
	u.mode = p.mode;
	const set = { seed: p.seed, colorVar: p.color_variation, glazeRough: p.glaze_roughness, orangePeel: p.orange_peel, pooling: p.pooling,
		crackle: p.crackle, crackleFine: p.crackle_fine, ink: p.ink, bubbles: p.bubbles, pinholes: p.pinholes, specks: p.specks, paint: p.paint,
		grog: p.grog, pores: p.pores, toolMarks: p.tool_marks, efflor: p.efflorescence,
		frost: p.frost, seeds: p.seeds, cords: p.cords, wave: p.wave, ior: p.ior, chips: p.chips, roughness: p.roughness, sheen: p.sheen };
	for ( const k in set ) u[ k ].value = set[ k ];
	const mm = { crackleM: p.crackle_mm, motifM: p.motif_mm, grogM: p.grog_mm, toolM: p.tool_mm, seedM: p.seed_mm,
		tintM: p.tint_mm, thicknessM: p.thickness_mm, clearM: p.clear_mm, clearEvery: p.clear_every_mm, chipM: p.chip_mm, panelM: p.panel_mm };
	for ( const k in mm ) u[ k ].value = mm[ k ] * 1e-3;
	u.bubbleM.value = p.bubble_um * 1e-6;
	u.frostM.value = p.frost_um * 1e-6;
	u.angle.value = p.angle_deg * Math.PI / 180;
	const col = { bodyColor: p.body_color, glazeColor: p.glaze_color, inkColor: p.ink_color, ink2Color: p.ink2_color, paintColor: p.paint_color,
		grogColor: p.grog_color, efflorColor: p.efflorescence_color, tintColor: p.tint_color, groundColor: p.ground_color, steelColor: p.steel_color };
	for ( const k in col ) u[ k ].value.set( col[ k ] );
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.crackleM.value } };

}
