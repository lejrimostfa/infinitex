// Scifi preset -> uniforms. One mode per graph, chosen when it is built:
//   carpaint  metallic car paint: pigment, aluminium flakes, clear coat
//   opal      precious opal: milky body, patches of spectral fire
//   hologram  embossed diffraction foil (security seal, sticker)
//   foil      crinkled iridescent foil, thin film colours
//   lc        liquid crystal between crossed polarisers (schlieren)
//   screen    an LCD screen: image far, pixels, RGB subpixels near
//   crt       a CRT tube: pixel art image, beam lines, slot mask, grains
//   energy    an emissive energy panel: plasma lines, hex grid
// Their colour depends on the view (core/optics.js). The same few names
// serve every mode (size_mm is a flake, a fire patch, a facet, a pixel or
// a hex cell), so one slider set covers the family.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const SCIFI_DEFAULTS = {
	schema_version: 1,
	family: 'scifi',
	intent: 'blue metallic car paint',
	seed: 1,
	mode: 'carpaint',
	angle_deg: 0, // main direction (grating, stripes)
	size_mm: 0.5, // main element: coarse flake, fire patch, facet, pixel pitch, hex cell
	feature_mm: 0.1, // second element: fine flake, striation, wrinkle, subpixel detail
	color: '#0b2a6b', // main tone (pigment, body, foil, glow)
	color2: '#6f9be0', // second tone (flake, highlight, second glow)
	color3: '#03081a', // dark tone (flop, background, panel)
	color_variation: 0.1,
	amount: 0.6, // flake density, fire, grating strength, film strength
	relief: 1,
	glow: 1, // emission (screen, energy, backlit cell)
	speed: 1, // animation (energy, screen)
	film_nm: [ 250, 650 ], // thin film thickness or birefringent retardation range
	roughness: 0.3,
	coat: 1, // clear coat on top
	...SURFACE_DEFAULTS,
};

export const SCIFI_SLIDERS = [
	[ 'angle_deg', 0, 180, 1 ],
	[ 'size_mm', 0.02, 50, 0.01 ],
	[ 'feature_mm', 0.005, 10, 0.005 ],
	[ 'amount', 0, 1, 0.01 ],
	[ 'relief', 0, 2, 0.01 ],
	[ 'glow', 0, 4, 0.01 ],
	[ 'speed', 0, 4, 0.01 ],
	[ 'roughness', 0.02, 1, 0.01 ],
	[ 'coat', 0, 1, 0.01 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createScifiUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'carpaint', // read when the graph is built
		seed: uniform( 1 ), angle: uniform( 0 ), sizeM: uniform( 5e-4 ), featureM: uniform( 1e-4 ),
		color: c(), color2: c(), color3: c(), colorVar: uniform( 0.1 ),
		amount: uniform( 0.6 ), relief: uniform( 1 ), glow: uniform( 1 ), speed: uniform( 1 ),
		filmMin: uniform( 250 ), filmMax: uniform( 650 ), roughness: uniform( 0.3 ), coat: uniform( 1 ),
		surface: createSurfaceUniforms(),
	};

}

export function applyScifiPreset( u, preset ) {

	const p = { ...SCIFI_DEFAULTS, ...preset };
	u.mode = p.mode;
	const set = { seed: p.seed, colorVar: p.color_variation, amount: p.amount, relief: p.relief, glow: p.glow, speed: p.speed,
		roughness: p.roughness, coat: p.coat };
	for ( const k in set ) u[ k ].value = set[ k ];
	u.angle.value = p.angle_deg * Math.PI / 180;
	u.sizeM.value = p.size_mm * 1e-3;
	u.featureM.value = p.feature_mm * 1e-3;
	u.filmMin.value = p.film_nm[ 0 ];
	u.filmMax.value = p.film_nm[ 1 ];
	u.color.value.set( p.color );
	u.color2.value.set( p.color2 );
	u.color3.value.set( p.color3 );
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.sizeM.value } };

}
