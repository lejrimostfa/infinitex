// Jelly preset -> uniforms. Gelatinous living tissue seen through: a
// transmissive surface (three.js samples the scene behind it), with the
// organs inside drawn as less transparent, tinted parts. One mode for now:
//   medusa  a moon jellyfish (Aurelia) bell seen from above, one bell per
//           bell_mm repeat (medusa.js)

import { Color, Vector2 } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const JELLY_DEFAULTS = {
	schema_version: 1,
	family: 'jelly',
	intent: 'moon jellyfish bell',
	seed: 1,
	mode: 'medusa',
	bell_mm: 300, // repeat of the bell (on the demo cube: one bell per face)
	bell_offset: [ 0, 0 ], // shift of the bells, in bell units
	color: '#e6eef8', // jelly (mesoglea) tint, mostly water
	organ_color: '#c4a2e2', // gonads
	canal_color: '#efe2ee', // canals, rim, oral arms: milky
	glow_color: '#2bffa8', // bioluminescent dots (photocytes)
	glow: 1.5, // emission of the dots
	clarity: 0.93, // transmission of the plain jelly
	ior: 1.34,
	thickness_mm: 30,
	tint_mm: 400, // attenuation distance: thicker jelly tints more
	roughness: 0.06,
	...SURFACE_DEFAULTS,
};

export const JELLY_SLIDERS = [
	[ 'bell_mm', 30, 600, 1 ],
	[ 'glow', 0, 6, 0.05 ],
	[ 'clarity', 0.3, 1, 0.01 ],
	[ 'ior', 1, 1.6, 0.01 ],
	[ 'thickness_mm', 1, 100, 1 ],
	[ 'roughness', 0.02, 0.6, 0.01 ],
];

export function createJellyUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'medusa', // read when the graph is built
		seed: uniform( 1 ), bellM: uniform( 0.3 ), color: c(), organColor: c(), canalColor: c(), glowColor: c(), glow: uniform( 1.5 ), offset: uniform( new Vector2() ),
		clarity: uniform( 0.93 ), ior: uniform( 1.34 ), thicknessM: uniform( 0.03 ), tintM: uniform( 0.4 ), roughness: uniform( 0.06 ),
		surface: createSurfaceUniforms(),
	};

}

export function applyJellyPreset( u, preset ) {

	const p = { ...JELLY_DEFAULTS, ...preset };
	u.mode = p.mode;
	u.seed.value = p.seed;
	u.bellM.value = p.bell_mm * 1e-3;
	u.offset.value.set( p.bell_offset[ 0 ], p.bell_offset[ 1 ] );
	u.color.value.set( p.color );
	u.organColor.value.set( p.organ_color );
	u.canalColor.value.set( p.canal_color );
	u.glowColor.value.set( p.glow_color );
	u.glow.value = p.glow;
	u.clarity.value = p.clarity;
	u.ior.value = p.ior;
	u.thicknessM.value = p.thickness_mm * 1e-3;
	u.tintM.value = p.tint_mm * 1e-3;
	u.roughness.value = p.roughness;
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.bellM.value } };

}
