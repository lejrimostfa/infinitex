// Transform preset -> uniforms. Processes: a surface that changes over
// time. One mode per graph, chosen when it is built:
//   burn   a sheet of paper burning: browning, ember front, char, ash, holes
//   frost  frost ferns growing over a cold window from nucleation seeds
//   melt   an ice surface melting: wet film, rounded edges, beads of water
//   rust   rust spreading from scratches over painted steel, blisters ahead
//   ink    an ink drop spreading in wet paper: fingers, dark rim
//   dry    wet paint drying to matte, wrinkling, then cracking
//   mould  mould colonies spreading on bread: rings, spores behind
// Each reads a progress 0..1: by default it loops on the material clock
// (core/clock.js) over period_s seconds; set progress >= 0 to drive it.
// The same names serve every mode, so one slider set covers the family.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const TRANSFORM_DEFAULTS = {
	schema_version: 1,
	family: 'transform',
	intent: 'sheet of paper burning',
	seed: 1,
	mode: 'burn', // burn | frost | melt | rust | ink | dry | mould
	progress: - 1, // < 0: loops on the clock; 0..1: fixed state
	speed: 1, // clock multiplier
	period_s: 12, // one play of the process
	phase_s: 0, // shifts the loop: a film can arrive mid-process
	hold: 0.1, // share of the period held at each end
	size_mm: 120, // spacing of the seeds (ignitions, nuclei, drops, colonies)
	front_mm: 8, // width of the main zone behind the front (char, wet film, ring)
	feature_mm: 1, // second element: branch, bead, blister, crack cell, ring
	fiber_um: 25, // paper fibres, hyphae
	color: '#ddd5c2', // the matter before
	color2: '#141110', // what it turns into (char, ice, rust, ink, dry paint, spores)
	color3: '#8f8a84', // third tone (ash, glass, steel, wet paper, substrate)
	color4: '#7a4a22', // front tone (scorch, fresh rust, mycelium)
	density: 0.6,
	relief: 1,
	glow: 1, // emission (embers)
	roughness: 0.7,
	...SURFACE_DEFAULTS,
};

export const TRANSFORM_SLIDERS = [
	[ 'progress', - 1, 1, 0.005 ],
	[ 'speed', 0, 4, 0.01 ],
	[ 'period_s', 2, 60, 0.5 ],
	[ 'size_mm', 10, 400, 1 ],
	[ 'front_mm', 0.5, 40, 0.1 ],
	[ 'feature_mm', 0.05, 10, 0.01 ],
	[ 'density', 0, 1, 0.01 ],
	[ 'relief', 0, 2, 0.01 ],
	[ 'glow', 0, 4, 0.01 ],
	[ 'roughness', 0.02, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
];

export function createTransformUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'burn', // read when the graph is built
		seed: uniform( 1 ), phase: uniform( 0 ), progress: uniform( - 1 ), speed: uniform( 1 ), period: uniform( 12 ), hold: uniform( 0.1 ),
		sizeM: uniform( 0.12 ), frontM: uniform( 8e-3 ), featureM: uniform( 1e-3 ), fiberM: uniform( 2.5e-5 ),
		color: c(), color2: c(), color3: c(), color4: c(),
		density: uniform( 0.6 ), relief: uniform( 1 ), glow: uniform( 1 ), roughness: uniform( 0.7 ),
		surface: createSurfaceUniforms(),
	};

}

export function applyTransformPreset( u, preset ) {

	const p = { ...TRANSFORM_DEFAULTS, ...preset };
	u.mode = p.mode;
	const set = { seed: p.seed, phase: p.phase_s, progress: p.progress, speed: p.speed, period: Math.max( 0.1, p.period_s ), hold: p.hold,
		density: p.density, relief: p.relief, glow: p.glow, roughness: p.roughness };
	for ( const k in set ) u[ k ].value = set[ k ];
	u.sizeM.value = p.size_mm * 1e-3;
	u.frontM.value = p.front_mm * 1e-3;
	u.featureM.value = p.feature_mm * 1e-3;
	u.fiberM.value = p.fiber_um * 1e-6;
	for ( const k of [ 'color', 'color2', 'color3', 'color4' ] ) u[ k ].value.set( p[ k ] );
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.featureM.value } };

}
