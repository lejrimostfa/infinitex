// Fiber mat preset -> uniforms. Non-woven matter: fibers laid at random and
// pressed together (felt, boiled wool, paper, cardboard, papier-mache).
//   formation  cloudy density of the mat, seen through paper against light
//   flutes     the wavy inner layer of corrugated board, seen through the liner
//   patches    torn pieces glued on top of each other (papier-mache), some printed

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const FIBERMAT_DEFAULTS = {
	schema_version: 1,
	family: 'fibermat',
	intent: 'grey wool felt',
	seed: 1,
	color: '#7d7a76',
	color2: '#6a6662', // second fiber colour (heather)
	color_variation: 0.18,
	fiber_um: 25, // fiber width
	fiber_mm: 4, // fiber length
	curl: 0.6, // fibers bend; paper fibers stay straight
	flatten: 0.8, // round fiber 1, flat ribbon 0 (paper)
	contrast: 1, // how much single fibers show (paper: low)
	density: 1, // fibers per layer (felt is packed tight)
	scales: 0, // cuticle scales on the fibers (wool: 1)
	bonds: 0, // share of fused drops (thermo-bonded synthetic felt)
	knit_ghost: 0, // the shrunk knit under boiled wool
	knit_mm: 2.5, // stitch width of that knit
	formation: 0.3, // cloudy density
	formation_mm: 6,
	lumps: 0.4, // soft bumps of the mat (felt)
	lumps_mm: 3,
	flute_mm: 0, // corrugation period, 0 = none
	flute_depth: 0.3,
	patches: 0, // papier-mache pieces, 0 = none
	patch_mm: 25,
	print: 0, // share of pieces with printed text lines
	roughness: 0.85,
	sheen: 0.4,
	...SURFACE_DEFAULTS,
	fuzz_layers: 8,
	fuzz_length_mm: 1.0,
	fuzz_hairs_per_mm2: 2,
	fuzz_lean: 2.0,
	fuzz_curl: 0.8,
	fuzz_opacity: 0.9,
	fuzz_color: '#8a8682',
	fuzz_flow_mm: 4,
	hair_um: 25,
};

export const FIBERMAT_SLIDERS = [
	[ 'fiber_um', 5, 80, 1 ],
	[ 'fiber_mm', 0.5, 20, 0.1 ],
	[ 'curl', 0, 1, 0.01 ],
	[ 'contrast', 0, 1.5, 0.01 ],
	[ 'formation', 0, 1, 0.01 ],
	[ 'lumps', 0, 1, 0.01 ],
	[ 'flute_depth', 0, 1, 0.01 ],
	[ 'print', 0, 1, 0.01 ],
	[ 'roughness', 0.2, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createFibermatUniforms() {

	const c = () => uniform( new Color() );
	return {
		seed: uniform( 1 ), color: c(), color2: c(), colorVar: uniform( 0.18 ),
		fiberW: uniform( 25e-6 ), fiberL: uniform( 4e-3 ), curl: uniform( 0.6 ), flatten: uniform( 0.8 ), contrast: uniform( 1 ), density: uniform( 1 ), scales: uniform( 0 ), bonds: uniform( 0 ), knitGhost: uniform( 0 ), knitM: uniform( 2.5e-3 ),
		formation: uniform( 0.3 ), formationM: uniform( 6e-3 ), lumps: uniform( 0.4 ), lumpsM: uniform( 3e-3 ),
		fluteM: uniform( 0 ), fluteDepth: uniform( 0.3 ), patches: uniform( 0 ), patchM: uniform( 0.025 ), print: uniform( 0 ),
		roughness: uniform( 0.85 ), sheenAmt: uniform( 0.4 ),
		surface: createSurfaceUniforms(),
		metersPerUV: uniform( 1 ), fuzzOn: false, sheen: uniform( 0.4 ), sheenColor: uniform( new Color( 1, 1, 1 ) ), sheenRoughness: uniform( 0.6 ),
		fuzzLength: uniform( 1e-3 ), fuzzCell: uniform( 7e-4 ), fuzzLean: uniform( 2 ), fuzzCurl: uniform( 0.8 ),
		fuzzRadius: uniform( 12.5e-6 ), fuzzLayers: uniform( 8 ), fuzzOpacity: uniform( 0.9 ), fuzzColor: c(), fuzzFlowM: uniform( 0.004 ),
	};

}

export function applyFibermatPreset( u, preset ) {

	const p = { ...FIBERMAT_DEFAULTS, ...preset };
	u.seed.value = p.seed;
	u.color.value.set( p.color );
	u.color2.value.set( p.color2 );
	u.colorVar.value = p.color_variation;
	u.fiberW.value = p.fiber_um * 1e-6;
	u.fiberL.value = p.fiber_mm * 1e-3;
	u.curl.value = p.curl;
	u.flatten.value = p.flatten;
	u.contrast.value = p.contrast;
	u.density.value = p.density;
	u.scales.value = p.scales;
	u.bonds.value = p.bonds;
	u.knitGhost.value = p.knit_ghost;
	u.knitM.value = p.knit_mm * 1e-3;
	u.formation.value = p.formation;
	u.formationM.value = p.formation_mm * 1e-3;
	u.lumps.value = p.lumps;
	u.lumpsM.value = p.lumps_mm * 1e-3;
	u.fluteM.value = p.flute_mm * 1e-3;
	u.fluteDepth.value = p.flute_depth;
	u.patches.value = p.patches;
	u.patchM.value = p.patch_mm * 1e-3;
	u.print.value = p.print;
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
	u.fuzzFlowM.value = p.fuzz_flow_mm * 1e-3;
	return { preset: p, stats: {}, derived: { stitchW: u.fiberL.value } };

}
