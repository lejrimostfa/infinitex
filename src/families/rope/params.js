// Rope preset -> uniforms. A laid rope: strands twisted around the rope,
// yarns twisted the other way inside each strand, then fibers.
// Coordinates (meters): x along the rope, y around it (0 .. pi * diameter).

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const ROPE_DEFAULTS = {
	schema_version: 1,
	family: 'rope',
	intent: 'three strand hemp rope',
	seed: 1,
	diameter_mm: 10,
	strands: 3,
	lay_mm: 18, // length of one full turn of a strand
	yarns: 7, // yarns seen across one strand
	yarn_lay_mm: 6,
	fiber_um: 35,
	color: '#c9b48a',
	color_variation: 0.15,
	roughness: 0.85,
	sheen: 0.3,
	...SURFACE_DEFAULTS,
	// stray fibers, drawn with the fuzz shells
	fuzz_layers: 8,
	fuzz_length_mm: 1.5,
	fuzz_hairs_per_mm2: 1.2,
	fuzz_lean: 1.5,
	fuzz_curl: 0.4,
	fuzz_opacity: 1,
	fuzz_color: '#d8c49a',
	hair_um: 30,
};

export const ROPE_SLIDERS = [
	[ 'strands', 2, 6, 1 ],
	[ 'lay_mm', 5, 60, 0.5 ],
	[ 'yarns', 3, 15, 1 ],
	[ 'yarn_lay_mm', 2, 20, 0.5 ],
	[ 'color_variation', 0, 0.5, 0.01 ],
	[ 'roughness', 0.3, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
	[ 'fuzz_opacity', 0, 1.5, 0.05 ],
];

export function createRopeUniforms() {

	return {
		diameter: uniform( 0.01 ), seed: uniform( 1 ), strands: uniform( 3 ), layM: uniform( 0.018 ),
		yarns: uniform( 7 ), yarnLayM: uniform( 0.006 ), fiberM: uniform( 35e-6 ), color: uniform( new Color() ),
		colorVar: uniform( 0.15 ), roughness: uniform( 0.85 ), sheenAmt: uniform( 0.3 ),
		surface: createSurfaceUniforms(),
		// Fuzz shells read these (shared with the knit fuzz).
		metersPerUV: uniform( 1 ), fuzzOn: false, sheen: uniform( 0.3 ), sheenColor: uniform( new Color( 1, 1, 1 ) ), sheenRoughness: uniform( 0.6 ),
		fuzzLength: uniform( 1.5e-3 ), fuzzCell: uniform( 9e-4 ), fuzzLean: uniform( 1.5 ), fuzzCurl: uniform( 0.4 ),
		fuzzRadius: uniform( 15e-6 ), fuzzLayers: uniform( 8 ), fuzzOpacity: uniform( 1 ), fuzzColor: uniform( new Color() ), fuzzFlowM: uniform( 0.004 ),
	};

}

export function applyRopePreset( u, preset ) {

	const p = { ...ROPE_DEFAULTS, ...preset };
	u.diameter.value = p.diameter_mm * 1e-3;
	u.seed.value = p.seed;
	u.strands.value = p.strands;
	u.layM.value = p.lay_mm * 1e-3;
	u.yarns.value = p.yarns;
	u.yarnLayM.value = p.yarn_lay_mm * 1e-3;
	u.fiberM.value = p.fiber_um * 1e-6;
	u.color.value.set( p.color );
	u.colorVar.value = p.color_variation;
	u.roughness.value = p.roughness;
	u.sheenAmt.value = p.sheen;
	u.sheen.value = p.sheen;
	applySurfacePreset( u.surface, p );
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
