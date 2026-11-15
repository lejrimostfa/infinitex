// Metal preset -> uniforms. Physical units in the names. One mode per
// graph, chosen when it is built (shader.js):
//   hammered  worked copper alloys and gold: hammer craters, patina
//   rust      rusted iron: flaking scale in two layers, blisters, pits
//   brushed   brushed steel: parallel grooves, stretched highlight
//   chrome    polished chrome plate: swirls, pits, nodules, microcracks
//   painted   painted steel: orange peel, chips, primer, rust creep
// The metal sets the reflectance colour (F0, sRGB hex). Patina is the
// non-metallic crust that grows on it (verdigris on copper alloys, rust on
// iron); tarnish is the thin dark oxide film.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';
import { STATES_DEFAULTS, createStatesUniforms, applyStatesPreset } from '../../core/states.js';

export const METALS = {
	copper: '#f7c2a6',
	bronze: '#d8a26b',
	brass: '#e6c98f',
	gold: '#ffe09a',
	silver: '#f6f4ef',
	iron: '#c6c8c8',
	steel: '#d0d3d6',
	chrome: '#dfe3e8',
};

export const METAL_DEFAULTS = {
	schema_version: 1,
	family: 'metal',
	intent: 'old bronze, hammered, green patina in the hollows',
	seed: 1,
	meters_per_uv: 1.0,
	mode: 'hammered', // hammered | rust | brushed | chrome | painted
	metal: 'bronze',
	color_from_map: 0, // 1: tint the metal with the image colours
	roughness: 0.28,
	tarnish: 0.5, // dark oxide film, 0..1
	patina: 0.45, // verdigris or rust crust, 0..1
	patina_color: '#3f7f6c',
	hammer_mm: 6, // spacing of the hammer craters
	hammer_depth: 0.6,
	scratches: 0.7,
	scratch_mm: 7, // length of the long scratches
	pitting: 0.4, // corrosion pits in the patina
	grain_um: 60, // metal crystal grains
	// rust
	rust_color: '#8e4a22', // fresh orange scale
	rust_dark: '#3c1e12', // old, compact dark brown scale
	flake_mm: 5, // size of the flakes of the thick scale
	flaking: 0.5, // share of the top scale fallen off
	bare: 0.35, // share of the lower scale fallen too: bare iron
	blisters: 0.3, // share of the flakes lifted into blisters
	rust_grain_um: 18, // oxide grains of the scale
	// brushed and chrome
	brush_deg: 0, // direction of the grooves on the surface
	anisotropy: 0.3, // stretched highlight across the grooves
	streaks: 0.5, // belt passes seen from afar
	swirls: 0.5, // chrome: buffing arcs
	cracks: 0.5, // chrome: microcrack network of the plate
	// painted
	paint_color: '#35596b',
	primer_color: '#6a3024', // red oxide primer
	chip_mm: 5,
	chips: 0.35, // share of the paint chipped off
	creep: 0.6, // rust creeping under the paint from the chips
	orange_peel: 0.5,
	...SURFACE_DEFAULTS,
	...STATES_DEFAULTS,
	wear: 0.4, // polished high points
};

export const METAL_SLIDERS = [
	[ 'roughness', 0.05, 0.8, 0.01 ],
	[ 'tarnish', 0, 1, 0.02 ],
	[ 'patina', 0, 1, 0.02 ],
	[ 'hammer_mm', 2, 30, 0.5 ],
	[ 'hammer_depth', 0, 1, 0.02 ],
	[ 'scratches', 0, 1, 0.02 ],
	[ 'pitting', 0, 1, 0.02 ],
	[ 'grain_um', 15, 200, 1 ],
	[ 'flaking', 0, 1, 0.02 ],
	[ 'bare', 0, 1, 0.02 ],
	[ 'blisters', 0, 1, 0.02 ],
	[ 'flake_mm', 1, 20, 0.5 ],
	[ 'brush_deg', 0, 180, 1 ],
	[ 'anisotropy', 0, 1, 0.02 ],
	[ 'streaks', 0, 1, 0.02 ],
	[ 'swirls', 0, 1, 0.02 ],
	[ 'cracks', 0, 1, 0.02 ],
	[ 'chips', 0, 1, 0.02 ],
	[ 'creep', 0, 1, 0.02 ],
	[ 'orange_peel', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'gloss', 0, 1, 0.02 ],
];

export function createMetalUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'hammered', // read when the graph is built
		metersPerUV: uniform( 1 ), seed: uniform( 1 ), f0: uniform( new Color() ), fromMap: uniform( 0 ),
		roughness: uniform( 0.28 ), tarnish: uniform( 0.5 ), patina: uniform( 0.45 ), patinaColor: uniform( new Color() ),
		hammerM: uniform( 9e-3 ), hammerDepth: uniform( 0.4 ), scratches: uniform( 0.5 ), scratchM: uniform( 7e-3 ),
		pitting: uniform( 0.4 ), grainM: uniform( 60e-6 ),
		rustColor: c(), rustDark: c(), flakeM: uniform( 5e-3 ), flaking: uniform( 0.5 ), bare: uniform( 0.35 ), blisters: uniform( 0.3 ), rustGrainM: uniform( 18e-6 ),
		brush: uniform( 0 ), aniso: uniform( 0.3 ), streaks: uniform( 0.5 ), swirls: uniform( 0.5 ), cracks: uniform( 0.5 ),
		paintColor: c(), primerColor: c(), chipM: uniform( 5e-3 ), chips: uniform( 0.35 ), creep: uniform( 0.6 ), orangePeel: uniform( 0.5 ),
		surface: createSurfaceUniforms(), states: createStatesUniforms(),
	};

}

export function applyMetalPreset( u, preset ) {

	const p = { ...METAL_DEFAULTS, ...preset };
	u.mode = p.mode;
	u.metersPerUV.value = p.meters_per_uv;
	u.seed.value = p.seed;
	u.f0.value.set( METALS[ p.metal ] ?? p.metal );
	u.fromMap.value = p.color_from_map;
	u.roughness.value = p.roughness;
	u.tarnish.value = p.tarnish;
	u.patina.value = p.patina;
	u.patinaColor.value.set( p.patina_color );
	u.hammerM.value = p.hammer_mm * 1e-3;
	u.hammerDepth.value = p.hammer_depth;
	u.scratches.value = p.scratches;
	u.scratchM.value = p.scratch_mm * 1e-3;
	u.pitting.value = p.pitting;
	u.grainM.value = p.grain_um * 1e-6;
	const set = { flaking: p.flaking, bare: p.bare, blisters: p.blisters, aniso: p.anisotropy, streaks: p.streaks, swirls: p.swirls,
		cracks: p.cracks, chips: p.chips, creep: p.creep, orangePeel: p.orange_peel };
	for ( const k in set ) u[ k ].value = set[ k ];
	u.flakeM.value = p.flake_mm * 1e-3;
	u.chipM.value = p.chip_mm * 1e-3;
	u.rustGrainM.value = p.rust_grain_um * 1e-6;
	u.brush.value = p.brush_deg * Math.PI / 180;
	const col = { rustColor: p.rust_color, rustDark: p.rust_dark, paintColor: p.paint_color, primerColor: p.primer_color };
	for ( const k in col ) u[ k ].value.set( col[ k ] );
	applySurfacePreset( u.surface, p );
	applyStatesPreset( u.states, p );
	return { preset: p, stats: {}, derived: {} };

}
