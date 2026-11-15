// Leather preset -> uniforms. Physical units in the names.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';
import { STATES_DEFAULTS, createStatesUniforms, applyStatesPreset } from '../../core/states.js';

export const LEATHER_DEFAULTS = {
	schema_version: 1,
	family: 'leather',
	intent: 'brown full-grain cowhide, a little worn',
	seed: 1,
	meters_per_uv: 1.0,
	color: '#5c3b25', // used when no colour map is given
	grain_mm: 1.3, // pebble size of the grain
	grain_depth: 0.6, // 0..1
	pore_mm: 0.3, // spacing of hair follicle pores
	pore_depth: 0.5,
	fiber_um: 45, // collagen bundles under the grain
	crack_mm: 7, // craquelure cell size
	crack_amount: 0.35, // share of cell borders that are cracked, 0 = none
	crack_width: 0.5, // 0..1
	underlayer_color: '#b08a66', // corium seen in the cracks (multiplies the colour)
	roughness: 0.36, // finished leather: a satin top coat
	sheen: 0.12,
	regular: 0, // faux leather: an embossed grain, too even
	flaking: 0, // faux leather: the coat peels and shows the fabric backing
	...SURFACE_DEFAULTS,
	...STATES_DEFAULTS,
	gloss: 0.3, // the finish coat
	wear: 0.35,
};

export const LEATHER_SLIDERS = [
	[ 'grain_mm', 0.3, 4, 0.05 ],
	[ 'grain_depth', 0, 1, 0.05 ],
	[ 'pore_mm', 0.1, 1, 0.02 ],
	[ 'pore_depth', 0, 1, 0.05 ],
	[ 'crack_mm', 2, 25, 0.5 ],
	[ 'crack_amount', 0, 1, 0.05 ],
	[ 'crack_width', 0, 1, 0.05 ],
	[ 'roughness', 0.1, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'gloss', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createLeatherUniforms() {

	return {
		metersPerUV: uniform( 1 ), seed: uniform( 1 ), color: uniform( new Color() ),
		grainM: uniform( 1.3e-3 ), grainDepth: uniform( 0.6 ), poreM: uniform( 3e-4 ), poreDepth: uniform( 0.5 ),
		fiberM: uniform( 45e-6 ), crackM: uniform( 7e-3 ), crackAmount: uniform( 0.35 ), crackWidth: uniform( 0.5 ),
		under: uniform( new Color() ), roughness: uniform( 0.5 ), sheen: uniform( 0.12 ), regular: uniform( 0 ), flaking: uniform( 0 ),
		surface: createSurfaceUniforms(), states: createStatesUniforms(),
	};

}

export function applyLeatherPreset( u, preset ) {

	const p = { ...LEATHER_DEFAULTS, ...preset };
	u.metersPerUV.value = p.meters_per_uv;
	u.seed.value = p.seed;
	u.color.value.set( p.color );
	u.grainM.value = p.grain_mm * 1e-3;
	u.grainDepth.value = p.grain_depth;
	u.poreM.value = p.pore_mm * 1e-3;
	u.poreDepth.value = p.pore_depth;
	u.fiberM.value = p.fiber_um * 1e-6;
	u.crackM.value = p.crack_mm * 1e-3;
	u.crackAmount.value = p.crack_amount;
	u.crackWidth.value = p.crack_width;
	u.under.value.set( p.underlayer_color );
	u.roughness.value = p.roughness;
	u.sheen.value = p.sheen;
	u.regular.value = p.regular;
	u.flaking.value = p.flaking;
	applySurfacePreset( u.surface, p );
	applyStatesPreset( u.states, p );
	return { preset: p, stats: {}, derived: {} };

}
