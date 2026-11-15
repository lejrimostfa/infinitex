// Strands preset -> uniforms. Hair, fur and fleece seen lying on a surface:
// layers of long strands that follow a combed flow, grouped in locks.
//   flow      the comb direction bends slowly over flow_mm
//   locks     strands gather in locks with shadow between them
//   crimp     wool waves along each fibre (raw fleece)
//   bands     agouti fur: dark root, light band, dark tip along each hair
//   stand, pile  3D strands near the camera: root angle, layer height
//   guard     a share of longer, thicker, darker guard hairs over the undercoat
// The highlight is anisotropic: stretched across the strands.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const STRANDS_DEFAULTS = {
	schema_version: 1,
	family: 'strands',
	intent: 'brown human hair, combed',
	seed: 1,
	angle_deg: 90, // comb direction on the surface
	strand_um: 70,
	length_mm: 60,
	flow_mm: 25, // the flow bends over this distance
	flow_amount: 0.5,
	lock_mm: 3,
	lock_depth: 0.6,
	crimp: 0, // wool waves, 0..1
	crimp_mm: 1.5,
	color: '#3a2416',
	tip_color: '#5a3a22',
	color_variation: 0.15,
	bands: 0, // agouti banding, 0..1
	band_color: '#c8a878',
	guard: 0, // share of guard hairs
	guard_color: '#1a120c',
	anisotropy: 0.85,
	roughness: 0.35,
	sheen: 0.2,
	// 3D strands near the camera (createHair): they grow out of the surface
	density_cm2: 200, // roots per cm^2
	stand_deg: 25, // root angle above the surface
	pile: 0.04, // height of the hair layer, share of the hair length
	clump: 0.5, // tips of one lock gather, 0..1
	...SURFACE_DEFAULTS,
};

export const STRANDS_SLIDERS = [
	[ 'angle_deg', 0, 180, 1 ],
	[ 'strand_um', 10, 200, 1 ],
	[ 'flow_amount', 0, 1.5, 0.01 ],
	[ 'lock_mm', 0.5, 20, 0.1 ],
	[ 'lock_depth', 0, 1, 0.01 ],
	[ 'crimp', 0, 1, 0.01 ],
	[ 'bands', 0, 1, 0.01 ],
	[ 'guard', 0, 0.5, 0.01 ],
	[ 'anisotropy', 0, 1, 0.01 ],
	[ 'roughness', 0.1, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
];

export function createStrandsUniforms() {

	const c = () => uniform( new Color() );
	return {
		seed: uniform( 1 ), angle: uniform( Math.PI / 2 ), strandW: uniform( 7e-5 ), lengthM: uniform( 0.06 ),
		flowM: uniform( 0.025 ), flowAmt: uniform( 0.5 ), lockM: uniform( 3e-3 ), lockDepth: uniform( 0.6 ),
		crimp: uniform( 0 ), crimpM: uniform( 1.5e-3 ), color: c(), tipColor: c(), colorVar: uniform( 0.15 ),
		bands: uniform( 0 ), bandColor: c(), guard: uniform( 0 ), guardColor: c(),
		aniso: uniform( 0.85 ), roughness: uniform( 0.35 ), sheen: uniform( 0.2 ),
		density: uniform( 2e6 ), stand: uniform( 0.44 ), pile: uniform( 0.04 ), clump: uniform( 0.5 ),
		surface: createSurfaceUniforms(),
	};

}

export function applyStrandsPreset( u, preset ) {

	const p = { ...STRANDS_DEFAULTS, ...preset };
	u.seed.value = p.seed;
	u.angle.value = p.angle_deg * Math.PI / 180;
	u.strandW.value = p.strand_um * 1e-6;
	u.lengthM.value = p.length_mm * 1e-3;
	u.flowM.value = p.flow_mm * 1e-3;
	u.flowAmt.value = p.flow_amount;
	u.lockM.value = p.lock_mm * 1e-3;
	u.lockDepth.value = p.lock_depth;
	u.crimp.value = p.crimp;
	u.crimpM.value = p.crimp_mm * 1e-3;
	u.color.value.set( p.color );
	u.tipColor.value.set( p.tip_color );
	u.colorVar.value = p.color_variation;
	u.bands.value = p.bands;
	u.bandColor.value.set( p.band_color );
	u.guard.value = p.guard;
	u.guardColor.value.set( p.guard_color );
	u.aniso.value = p.anisotropy;
	u.roughness.value = p.roughness;
	u.sheen.value = p.sheen;
	u.density.value = p.density_cm2 * 1e4;
	u.stand.value = p.stand_deg * Math.PI / 180;
	u.pile.value = p.pile;
	u.clump.value = p.clump;
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.lockM.value } };

}
