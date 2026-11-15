// Living skin preset -> uniforms. Physical units in the names.
// Colour from two pigments, as skin works: melanin sets the tone (very fair
// to very dark), hemoglobin the blood flush. Or keep the colours of a game
// texture and only add the relief (tone_override = 0).

import { Color, Vector2 } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';
import { STATES_DEFAULTS, createStatesUniforms, applyStatesPreset } from '../../core/states.js';

export const SKIN_DEFAULTS = {
	schema_version: 1,
	family: 'skin',
	intent: 'living human skin, face',
	seed: 1,
	meters_per_uv: 1.0,
	melanin: 0.25, // 0 very fair, 1 very dark
	hemoglobin: 0.5, // blood flush
	tone_override: 0, // 0 keep the image colours, 1 use melanin and hemoglobin
	freckles: 0.0,
	freckle_color: '#e1c9b8', // multiplies the skin in a spot (linear 0.74, 0.58, 0.48)
	freckle_mm: 2.4,
	color: null, // an animal skin colour instead of melanin and hemoglobin
	pore_dark: 0, // a hair in each follicle (beard, scalp)
	ridges: 0, // fingerprint or lip furrows
	ridge_mm: 0.45,
	ridge_mode: 'whorl', // 'whorl' fingertip, 'lips' vertical furrows
	ridge_center: [ 0.15, 0.15 ], // meters, in the surface coordinates
	creases: 0, // long folds: wrinkles, knuckles
	crease_mm: 3,
	crease_angle_deg: 90, // direction across the folds
	crease_radius_mm: 1e4, // large: straight folds; a few cm: arcs (knuckles)
	veins: 0,
	vein_mm: 40,
	scar: 0,
	scar_a: [ 0.07, 0.09 ], // meters
	scar_b: [ 0.23, 0.2 ],
	scar_mm: 4, // half width
	tattoo: 0,
	tattoo_color: '#141a24', // the ink colour seen through the skin
	tattoo_map: null, // a drawing (THREE.Texture, dark lines on white); null = procedural bands
	tattoo_size_mm: 120,
	tattoo_center: [ 0.15, 0.15 ], // meters
	lines_mm: 0.3, // spacing of the main skin lines (microrelief)
	lines_depth: 0.5,
	pore_mm: 0.4, // pore spacing
	pore_depth: 0.5,
	cell_um: 35, // corneocytes, the flat dead cells of the surface
	roughness: 0.45,
	scatter: 0.7, // light passing through (ears, nose, fingers against the light)
	...SURFACE_DEFAULTS,
	...STATES_DEFAULTS,
	gloss: 0.45, // skin oil: sparkles on the plateau tops
	// body hair lying flat (drawn in the skin shader)
	hair_density: 0.5, // share of cells with a hair
	hair_cell_mm: 4, // one hair per cell, about half a cell long
	hair_thickness_um: 40,
	hair_color: '#3a2a20',
	hair_stand_deg: 17, // 3D hair near the camera: root angle above the skin
	hair_pile: 0.15, // and its height, share of its length (stubble stands up)
	// standing vellus hair, drawn with the fuzz shells (optional)
	fuzz_layers: 12,
	fuzz_length_mm: 0.4, // height of the hair layer: body hair lies on the skin
	fuzz_hairs_per_mm2: 0.4,
	fuzz_lean: 10.0, // so each hair runs about 4 mm along the skin
	fuzz_curl: 0.1,
	fuzz_opacity: 1.0,
	fuzz_color: '#e8d2b8',
	hair_um: 30,
};

export const SKIN_SLIDERS = [
	[ 'melanin', 0, 1, 0.01 ],
	[ 'hemoglobin', 0, 1, 0.01 ],
	[ 'tone_override', 0, 1, 0.01 ],
	[ 'freckles', 0, 1, 0.01 ],
	[ 'lines_depth', 0, 1, 0.02 ],
	[ 'pore_mm', 0.15, 1, 0.01 ],
	[ 'pore_depth', 0, 1, 0.02 ],
	[ 'roughness', 0.2, 0.8, 0.01 ],
	[ 'scatter', 0, 1, 0.02 ],
	[ 'gloss', 0, 1, 0.02 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'hair_density', 0, 1, 0.02 ],
	[ 'hair_thickness_um', 10, 80, 1 ],
];

export function createSkinUniforms() {

	return {
		metersPerUV: uniform( 1 ), seed: uniform( 1 ),
		melanin: uniform( 0.25 ), hemoglobin: uniform( 0.5 ), toneOverride: uniform( 0 ), freckles: uniform( 0 ),
		linesM: uniform( 4.5e-4 ), linesDepth: uniform( 0.5 ), poreM: uniform( 4e-4 ), poreDepth: uniform( 0.5 ),
		cellM: uniform( 35e-6 ), roughness: uniform( 0.45 ), scatter: uniform( 0.7 ),
		hairDensity: uniform( 0.5 ), hairCellM: uniform( 4e-3 ), hairR: uniform( 20e-6 ), hairColor: uniform( new Color() ),
		hairStand: uniform( 0.3 ), hairPile: uniform( 0.15 ),
		paintedShare: uniform( 1 ), // lowered by the 3D hair near the camera (core/hair3d.js)
		freckleColor: uniform( new Color() ), freckleM: uniform( 2.4e-3 ), customColor: uniform( new Color() ), useColor: uniform( 0 ),
		poreDark: uniform( 0 ), ridges: uniform( 0 ), ridgeM: uniform( 4.5e-4 ), ridgeMode: uniform( 0 ), ridgeCenter: uniform( new Vector2( 0.15, 0.15 ) ),
		creases: uniform( 0 ), creaseM: uniform( 3e-3 ), creaseAngle: uniform( Math.PI / 2 ), creaseR: uniform( 10 ),
		veins: uniform( 0 ), veinM: uniform( 0.04 ), scar: uniform( 0 ), scarA: uniform( new Vector2( 0.07, 0.09 ) ), scarB: uniform( new Vector2( 0.23, 0.2 ) ), scarW: uniform( 4e-3 ),
		tattoo: uniform( 0 ), tattooColor: uniform( new Color() ), tattooMap: null, tattooSize: uniform( 0.12 ), tattooCenter: uniform( new Vector2( 0.15, 0.15 ) ),
		surface: createSurfaceUniforms(), states: createStatesUniforms(),
		// Fuzz (vellus hair) and sheen slots used by the shared fuzz shells.
		fuzzOn: false, sheen: uniform( 0 ), sheenColor: uniform( new Color( 1, 1, 1 ) ), sheenRoughness: uniform( 0.5 ),
		fuzzLength: uniform( 8e-4 ), fuzzCell: uniform( 8e-4 ), fuzzLean: uniform( 3 ), fuzzCurl: uniform( 0.5 ),
		fuzzRadius: uniform( 4e-6 ), fuzzLayers: uniform( 6 ), fuzzOpacity: uniform( 0.6 ), fuzzColor: uniform( new Color() ), fuzzFlowM: uniform( 0.03 ),
	};

}

export function applySkinPreset( u, preset ) {

	const p = { ...SKIN_DEFAULTS, ...preset };
	u.metersPerUV.value = p.meters_per_uv;
	u.seed.value = p.seed;
	u.melanin.value = p.melanin;
	u.hemoglobin.value = p.hemoglobin;
	u.toneOverride.value = p.tone_override;
	u.freckles.value = p.freckles;
	u.poreDark.value = p.pore_dark;
	u.freckleColor.value.set( p.freckle_color );
	u.freckleM.value = p.freckle_mm * 1e-3;
	u.useColor.value = p.color ? 1 : 0;
	if ( p.color ) u.customColor.value.set( p.color );
	u.ridges.value = p.ridges;
	u.ridgeM.value = p.ridge_mm * 1e-3;
	u.ridgeMode.value = p.ridge_mode === 'lips' ? 1 : 0;
	u.ridgeCenter.value.set( ...p.ridge_center );
	u.creases.value = p.creases;
	u.creaseM.value = p.crease_mm * 1e-3;
	u.creaseAngle.value = p.crease_angle_deg * Math.PI / 180;
	u.creaseR.value = p.crease_radius_mm * 1e-3;
	u.veins.value = p.veins;
	u.veinM.value = p.vein_mm * 1e-3;
	u.scar.value = p.scar;
	u.scarA.value.set( ...p.scar_a );
	u.scarB.value.set( ...p.scar_b );
	u.scarW.value = p.scar_mm * 1e-3;
	u.tattoo.value = p.tattoo;
	u.tattooColor.value.set( p.tattoo_color );
	u.tattooMap = p.tattoo_map; // read when the graph is built
	u.tattooSize.value = p.tattoo_size_mm * 1e-3;
	u.tattooCenter.value.set( ...p.tattoo_center );
	u.linesM.value = p.lines_mm * 1e-3;
	u.linesDepth.value = p.lines_depth;
	u.poreM.value = p.pore_mm * 1e-3;
	u.poreDepth.value = p.pore_depth;
	u.cellM.value = p.cell_um * 1e-6;
	u.roughness.value = p.roughness;
	u.scatter.value = p.scatter;
	u.hairDensity.value = p.hair_density;
	u.hairCellM.value = p.hair_cell_mm * 1e-3;
	u.hairR.value = p.hair_thickness_um * 0.5e-6;
	u.hairColor.value.set( p.hair_color );
	u.hairStand.value = p.hair_stand_deg * Math.PI / 180;
	u.hairPile.value = p.hair_pile;
	applySurfacePreset( u.surface, p );
	applyStatesPreset( u.states, p );
	u.fuzzLength.value = p.fuzz_length_mm * 1e-3;
	u.fuzzCell.value = 1e-3 / Math.sqrt( p.fuzz_hairs_per_mm2 );
	u.fuzzLean.value = p.fuzz_lean;
	u.fuzzCurl.value = p.fuzz_curl;
	u.fuzzRadius.value = p.hair_um * 0.5e-6;
	u.fuzzLayers.value = p.fuzz_layers;
	u.fuzzOpacity.value = p.fuzz_opacity;
	u.fuzzColor.value.set( p.fuzz_color );
	return { preset: p, stats: {}, derived: {} };

}

// Body hair as 3D strands near the camera (InfinitexMaterial.createHair):
// the same hairs as the painted ones, standing a little off the skin.
export function skinHairSpec( u ) {

	const tip = uniform( new Color() ), length = uniform( 0 ), strandW = uniform( 0 ), density = uniform( 0 );
	const sync = () => {

		tip.value.copy( u.hairColor.value ).multiplyScalar( 1.35 );
		length.value = u.hairCellM.value * 0.7;
		strandW.value = u.hairR.value * 2;
		density.value = u.hairDensity.value / ( u.hairCellM.value * u.hairCellM.value );

	};
	sync();
	return {
		sync, seed: u.seed, strandW, lengthM: length, density, paintedShare: u.paintedShare,
		angle: uniform( 1.2 ), flowM: uniform( 0.03 ), flowAmt: uniform( 1.2 ),
		stand: u.hairStand, pile: u.hairPile, clump: uniform( 0 ), lockM: uniform( 1e-3 ),
		crimp: uniform( 0 ), crimpM: uniform( 1e-3 ), color: u.hairColor, tipColor: tip, colorVar: uniform( 0.2 ),
		bands: uniform( 0 ), bandColor: u.hairColor, guard: uniform( 0 ), guardColor: u.hairColor, roughness: uniform( 0.4 ),
	};

}
