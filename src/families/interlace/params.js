// Interlace preset -> uniforms. Open structures of strands or rings that
// pass over and under each other, with holes between them. One mode per
// graph, chosen when it is built:
//   cane   chair cane webbing, seven step: pairs of flat glossy cane
//          strands one way and the other, single diagonals both ways,
//          octagonal holes (cane.js)
//   braid  three strand plaits laid side by side, each segment a twisted
//          cord (braid.js)
//   mail   chain mail, European 4 in 1: butted steel rings, each linked
//          to four others (mail.js)
// The holes are cut out (opacity), so the far face of a cube shows through.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';
import { caneCoverage } from './cane.js';
import { mailCoverage } from './mail.js';

export const INTERLACE_DEFAULTS = {
	schema_version: 1,
	family: 'interlace',
	intent: 'chair cane webbing',
	seed: 1,
	mode: 'cane',
	pitch_mm: 12, // cane: pattern repeat; braid: plait width; mail: ring outer diameter
	strand_mm: 2.6, // cane strand width; mail wire diameter
	irregularity: 0.5, // strands wander, rings sit unevenly
	color: '#c99a55',
	color2: '#8a6034', // second tint (cane nodes, braid second strand, mail rust)
	color3: '#3e4a5a', // braid third strand
	color_variation: 0.15,
	twist_mm: 1.2, // braid: width of one yarn in a strand
	fiber_um: 18, // braid fibres, cane vascular lines
	rust: 0, // mail: rust in the crevices and patches
	roughness: 0.35,
	sheen: 0,
	...SURFACE_DEFAULTS,
};

export const INTERLACE_SLIDERS = [
	[ 'pitch_mm', 3, 60, 0.5 ],
	[ 'strand_mm', 0.4, 8, 0.05 ],
	[ 'irregularity', 0, 1, 0.01 ],
	[ 'color_variation', 0, 0.5, 0.01 ],
	[ 'rust', 0, 1, 0.01 ],
	[ 'roughness', 0.05, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createInterlaceUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'cane', // read when the graph is built
		seed: uniform( 1 ), pitchM: uniform( 0.012 ), strandM: uniform( 0.0026 ), irregular: uniform( 0.5 ),
		color: c(), color2: c(), color3: c(), colorVar: uniform( 0.15 ), twistM: uniform( 0.003 ), fiberM: uniform( 18e-6 ),
		coverage: uniform( 1 ), // share of the area under matter, for the far view
		rust: uniform( 0 ), roughness: uniform( 0.35 ), sheen: uniform( 0 ),
		surface: createSurfaceUniforms(),
	};

}

export function applyInterlacePreset( u, preset ) {

	const p = { ...INTERLACE_DEFAULTS, ...preset };
	u.mode = p.mode;
	u.seed.value = p.seed;
	u.pitchM.value = p.pitch_mm * 1e-3;
	u.strandM.value = p.strand_mm * 1e-3;
	u.irregular.value = p.irregularity;
	u.color.value.set( p.color );
	u.color2.value.set( p.color2 );
	u.color3.value.set( p.color3 );
	u.colorVar.value = p.color_variation;
	u.twistM.value = p.twist_mm * 1e-3;
	u.fiberM.value = p.fiber_um * 1e-6;
	const cover = { cane: () => caneCoverage( p.strand_mm / p.pitch_mm ), mail: () => mailCoverage( p.strand_mm / p.pitch_mm ) }[ p.mode ];
	u.coverage.value = cover ? cover() : 1;
	u.rust.value = p.rust;
	u.roughness.value = p.roughness;
	u.sheen.value = p.sheen;
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.pitchM.value } };

}
