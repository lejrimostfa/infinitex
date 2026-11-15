// Scales preset -> uniforms. Exotic leathers now, living reptiles and fish
// later. One mode per graph, chosen when the material is built:
//   tiles    crocodile, alligator: square scutes in rows, deep grooves, a
//            sense pit on each scute
//   overlap  snake, fish: scales laid like roof tiles, free edge on top,
//            an optional keel
//   quill    ostrich: smooth hide with raised quill bumps, a hole in each
//   beads    stingray (galuchat): tiny round beads packed side by side

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const SCALES_DEFAULTS = {
	schema_version: 1,
	family: 'scales',
	intent: 'crocodile belly leather',
	seed: 1,
	mode: 'tiles',
	scale_mm: 12, // scute, scale, quill spacing or bead size
	aspect: 1.25, // width / height of a scute or a scale
	size_variation: 0.35,
	depth: 0.7, // relief, 0..1
	groove: 0.12, // groove width, share of a scale
	keel: 0, // ridge along each scale (overlap)
	polish: 0, // sanded flat tops (galuchat)
	rings: 0, // growth rings on each scute (tortoise)
	holes: 1, // a hole in each bump (ostrich quills); 0 for warts and papillae
	wrinkles: 0.5, // fine wrinkles on the skin
	wrinkle_mm: 0.6,
	color: '#5a3a24',
	groove_color: '#22140c', // multiplies in the grooves
	color_variation: 0.18,
	pattern: 0, // blotches made of whole scales (python)
	pattern_color: '#2a1d12',
	pattern_mm: 40,
	pattern_shape: 'blotch', // blotch (python saddles) or ocelli (rainbow boa), pattern.js
	roughness: 0.4,
	sheen: 0.1,
	iridescence: 0, // structural colour (rainbow boa, sunbeam snake, fish)
	iridescence_nm: [ 250, 650 ], // film thickness range, nanometers
	ridge_um: 6, // micro ridges along the scales (overlap mode)
	...SURFACE_DEFAULTS,
	gloss: 0.3,
};

export const SCALES_SLIDERS = [
	[ 'scale_mm', 0.3, 40, 0.1 ],
	[ 'aspect', 0.5, 2.5, 0.01 ],
	[ 'size_variation', 0, 1, 0.01 ],
	[ 'depth', 0, 1, 0.01 ],
	[ 'groove', 0.02, 0.4, 0.01 ],
	[ 'keel', 0, 1, 0.01 ],
	[ 'polish', 0, 1, 0.01 ],
	[ 'wrinkles', 0, 1, 0.01 ],
	[ 'pattern', 0, 1, 0.01 ],
	[ 'iridescence', 0, 1, 0.01 ],
	[ 'roughness', 0.1, 1, 0.01 ],
	[ 'gloss', 0, 1, 0.02 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createScalesUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'tiles', patternShape: 'blotch', // read when the graph is built
		seed: uniform( 1 ), scaleM: uniform( 0.012 ), aspect: uniform( 1.25 ), sizeVar: uniform( 0.35 ), depth: uniform( 0.7 ),
		groove: uniform( 0.12 ), keel: uniform( 0 ), polish: uniform( 0 ), rings: uniform( 0 ), holes: uniform( 1 ), wrinkles: uniform( 0.5 ), wrinkleM: uniform( 6e-4 ),
		color: c(), grooveColor: c(), colorVar: uniform( 0.18 ), pattern: uniform( 0 ), patternColor: c(), patternM: uniform( 0.04 ),
		roughness: uniform( 0.4 ), sheen: uniform( 0.1 ), irid: uniform( 0 ), iridMin: uniform( 250 ), iridMax: uniform( 650 ), ridgeM: uniform( 6e-6 ),
		surface: createSurfaceUniforms(),
	};

}

export function applyScalesPreset( u, preset ) {

	const p = { ...SCALES_DEFAULTS, ...preset };
	u.mode = p.mode;
	u.patternShape = p.pattern_shape;
	u.seed.value = p.seed;
	u.scaleM.value = p.scale_mm * 1e-3;
	u.aspect.value = p.aspect;
	u.sizeVar.value = p.size_variation;
	u.depth.value = p.depth;
	u.groove.value = p.groove;
	u.keel.value = p.keel;
	u.polish.value = p.polish;
	u.rings.value = p.rings;
	u.holes.value = p.holes;
	u.wrinkles.value = p.wrinkles;
	u.wrinkleM.value = p.wrinkle_mm * 1e-3;
	u.color.value.set( p.color );
	u.grooveColor.value.set( p.groove_color );
	u.colorVar.value = p.color_variation;
	u.pattern.value = p.pattern;
	u.patternColor.value.set( p.pattern_color );
	u.patternM.value = p.pattern_mm * 1e-3;
	u.roughness.value = p.roughness;
	u.sheen.value = p.sheen;
	u.irid.value = p.iridescence;
	u.iridMin.value = p.iridescence_nm[ 0 ];
	u.iridMax.value = p.iridescence_nm[ 1 ];
	u.ridgeM.value = p.ridge_um * 1e-6;
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.scaleM.value } };

}
