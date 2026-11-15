// Plastic preset -> uniforms. One mode per graph, chosen when it is built:
//   solid    a moulded part: mould texture (spark eroded grain, bead
//            blast), flow lines, parting line, ejector pins; then its life:
//            scratches, swirl marks, fingerprints, dust, UV yellowing,
//            chalk, crazing, scuffs. Silicone is a solid with translucency and bubbles.
//   tyre     rubber tread: blocks, grooves, sipes, mould vents, abrasion
//   foam     open-cell polyurethane: struts, windows, cells in depth
//   ripstop  woven nylon with a grid of reinforcement threads
//   print    FDM 3D print: layer lines, wobble, seam, infill where worn
//   record   vinyl record: spiral grooves with modulated walls, label
// Optional layers are compiled only when the preset uses them (> 0).

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const PLASTIC_DEFAULTS = {
	schema_version: 1,
	family: 'plastic',
	intent: 'textured black ABS housing',
	seed: 1,
	mode: 'solid', // solid | tyre | foam | ripstop | print | record
	color: '#2a2b2e',
	color2: '#c9a24a', // yellowing, label, reinforcement or infill tint
	color_variation: 0.06,
	roughness: 0.5,
	// solid: the mould
	grain: 0, // spark eroded (EDM) texture depth
	grain_um: 60, // crater size of the spark grain
	blast: 0, // bead blasted texture depth
	blast_um: 45, // dimple size of the bead blast
	flow: 0, // flow lines from the gate
	parting: 0, // parting line across the part
	ejectors: 0, // ejector pin rings
	pin_mm: 6,
	orange_peel: 0, // long waviness of a glossy face
	// solid: its life
	scratches: 0,
	swirl: 0, // circular wiping marks
	dust: 0,
	yellowing: 0, // UV yellowing in patches (color2)
	chalk: 0, // chalky, powdery surface
	crazing: 0, // network of fine cracks
	craze_mm: 1.2,
	scuffs: 0,
	prints: 0, // fingerprints (share of 6 cm cells holding one)
	// silicone
	translucency: 0,
	bubbles: 0,
	bubble_um: 180,
	tack: 0, // tacky sheen, lint stuck to it
	// tyre
	block_mm: 30,
	groove_mm: 8,
	worn: 0.5,
	// foam
	cell_um: 600,
	// ripstop
	thread_um: 140, // thread pitch
	grid_mm: 5, // reinforcement grid
	filament_um: 18,
	anisotropy: 0.6,
	// print
	layer_um: 200,
	wobble: 0.4,
	wobble_mm: 8,
	infill: 1, // a worn spot where the infill shows
	// record
	groove_um: 110, // groove pitch
	sheen: 0,
	...SURFACE_DEFAULTS,
};

export const PLASTIC_SLIDERS = [
	[ 'roughness', 0.02, 1, 0.01 ],
	[ 'grain', 0, 1, 0.01 ],
	[ 'blast', 0, 1, 0.01 ],
	[ 'flow', 0, 1, 0.01 ],
	[ 'scratches', 0, 1, 0.01 ],
	[ 'swirl', 0, 1, 0.01 ],
	[ 'dust', 0, 1, 0.01 ],
	[ 'yellowing', 0, 1, 0.01 ],
	[ 'chalk', 0, 1, 0.01 ],
	[ 'crazing', 0, 1, 0.01 ],
	[ 'translucency', 0, 1, 0.01 ],
	[ 'worn', 0, 1, 0.01 ],
	[ 'wobble', 0, 1, 0.01 ],
	[ 'anisotropy', 0, 1, 0.01 ],
	[ 'gloss', 0, 1, 0.02 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

// preset key -> [ uniform name, scale to SI ].
const SCALARS = {
	seed: [ 'seed', 1 ], color_variation: [ 'colorVar', 1 ], roughness: [ 'roughness', 1 ],
	grain: [ 'grain', 1 ], grain_um: [ 'grainM', 1e-6 ], blast: [ 'blast', 1 ], blast_um: [ 'blastM', 1e-6 ],
	flow: [ 'flow', 1 ], parting: [ 'parting', 1 ], ejectors: [ 'ejectors', 1 ], pin_mm: [ 'pinM', 1e-3 ], orange_peel: [ 'peel', 1 ],
	scratches: [ 'scratches', 1 ], swirl: [ 'swirl', 1 ], dust: [ 'dust', 1 ], yellowing: [ 'yellowing', 1 ], chalk: [ 'chalk', 1 ],
	crazing: [ 'crazing', 1 ], craze_mm: [ 'crazeM', 1e-3 ], scuffs: [ 'scuffs', 1 ], prints: [ 'prints', 1 ],
	translucency: [ 'transl', 1 ], bubbles: [ 'bubbles', 1 ], bubble_um: [ 'bubbleM', 1e-6 ], tack: [ 'tack', 1 ],
	block_mm: [ 'blockM', 1e-3 ], groove_mm: [ 'grooveM', 1e-3 ], worn: [ 'worn', 1 ], cell_um: [ 'cellM', 1e-6 ],
	thread_um: [ 'threadM', 1e-6 ], grid_mm: [ 'gridM', 1e-3 ], filament_um: [ 'filM', 1e-6 ], anisotropy: [ 'aniso', 1 ],
	layer_um: [ 'layerM', 1e-6 ], wobble: [ 'wobble', 1 ], wobble_mm: [ 'wobbleM', 1e-3 ], infill: [ 'infill', 1 ],
	groove_um: [ 'grooveP', 1e-6 ], sheen: [ 'sheen', 1 ],
};

export function createPlasticUniforms() {

	const u = { mode: 'solid', color: uniform( new Color() ), color2: uniform( new Color() ), surface: createSurfaceUniforms() };
	for ( const k in SCALARS ) u[ SCALARS[ k ][ 0 ] ] = uniform( PLASTIC_DEFAULTS[ k ] * SCALARS[ k ][ 1 ] );
	return u;

}

export function applyPlasticPreset( u, preset ) {

	const p = { ...PLASTIC_DEFAULTS, ...preset };
	u.mode = p.mode;
	for ( const k in SCALARS ) u[ SCALARS[ k ][ 0 ] ].value = p[ k ] * SCALARS[ k ][ 1 ];
	u.color.value.set( p.color );
	u.color2.value.set( p.color2 );
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.grainM.value } };

}
