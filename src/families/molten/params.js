// Molten preset -> uniforms. One mode per graph, chosen when it is built:
//   pahoehoe  smooth ropy lava: a glassy skin folds into ropes as it drags
//   aa        rough clinker: jagged blocks tumbling over a glowing core
//   lake      lava lake: black crust plates spreading from glowing seams
//   embers    charred wood crazed into blocks, glow breathing in the cracks
//   steel     molten steel: white hot melt, oxide skin wrinkling, slag specks
//   slag      cooling slag: glassy crust, vesicles, a red glow dying out
// Every mode is animated by the shared clock (core/clock.js) times speed.
// The same size names serve every mode, from the largest structure to the
// microns: scale_mm (lobe, conveyor, log, convection cell), size_mm
// (rope, block, plate, char block, oxide patch), feature_mm (wrinkle,
// facet, crazing), cell_um (vesicles), micro_um (microlites, grains).
// Temperatures are in kelvin: emission is a blackbody (heat.js).

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const MOLTEN_DEFAULTS = {
	schema_version: 1,
	family: 'molten',
	intent: 'basalt lava lake, crust plates over glowing seams',
	seed: 1,
	mode: 'lake', // pahoehoe | aa | lake | embers | steel | slag
	angle_deg: 0, // flow direction on the surface
	scale_mm: 160,
	size_mm: 35,
	feature_mm: 4,
	cell_um: 900,
	micro_um: 60,
	crust_k: 750, // skin or crust temperature (basalt crust 600 to 900 K)
	melt_k: 1400, // melt seen in cracks (basalt 1300 to 1450 K, steel 1800 K)
	cover: 0.6, // share of the surface under crust or skin
	flow_mm_s: 4, // drift of the crust
	speed: 1, // time multiplier
	glow: 1, // emission multiplier
	contrast: 0.3, // camera compression of the radiance range (1 = physical)
	color: '#0d0c0c', // crust, char, oxide
	color2: '#2c2c30', // second tone (glassy sheen, oxidised clinker, ash under the glow)
	color3: '#c9c4bb', // ash, slag specks, devitrified glass
	color_variation: 0.15,
	relief: 1,
	roughness: 0.6, // crust roughness; the melt is always smooth
	...SURFACE_DEFAULTS,
};

export const MOLTEN_SLIDERS = [
	[ 'angle_deg', 0, 360, 1 ],
	[ 'size_mm', 1, 200, 0.5 ],
	[ 'feature_mm', 0.2, 30, 0.1 ],
	[ 'crust_k', 400, 1400, 10 ],
	[ 'melt_k', 900, 2200, 10 ],
	[ 'cover', 0, 1, 0.01 ],
	[ 'flow_mm_s', 0, 30, 0.1 ],
	[ 'speed', 0, 4, 0.01 ],
	[ 'glow', 0, 4, 0.01 ],
	[ 'contrast', 0.1, 1, 0.01 ],
	[ 'relief', 0, 2, 0.01 ],
	[ 'roughness', 0.05, 1, 0.01 ],
];

export function createMoltenUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'lake', // read when the graph is built
		seed: uniform( 1 ), angle: uniform( 0 ),
		scaleM: uniform( 0.16 ), sizeM: uniform( 0.035 ), featureM: uniform( 0.004 ), cellM: uniform( 9e-4 ), microM: uniform( 6e-5 ),
		crustK: uniform( 750 ), meltK: uniform( 1400 ), cover: uniform( 0.6 ), flow: uniform( 0.004 ), speed: uniform( 1 ),
		glow: uniform( 1 ), contrast: uniform( 0.3 ),
		color: c(), color2: c(), color3: c(), colorVar: uniform( 0.15 ), relief: uniform( 1 ), roughness: uniform( 0.6 ),
		surface: createSurfaceUniforms(),
	};

}

export function applyMoltenPreset( u, preset ) {

	const p = { ...MOLTEN_DEFAULTS, ...preset };
	u.mode = p.mode;
	const set = { seed: p.seed, crustK: p.crust_k, meltK: p.melt_k, cover: p.cover, speed: p.speed, glow: p.glow,
		contrast: p.contrast, colorVar: p.color_variation, relief: p.relief, roughness: p.roughness };
	for ( const k in set ) u[ k ].value = set[ k ];
	u.angle.value = p.angle_deg * Math.PI / 180;
	u.scaleM.value = p.scale_mm * 1e-3;
	u.sizeM.value = p.size_mm * 1e-3;
	u.featureM.value = p.feature_mm * 1e-3;
	u.cellM.value = p.cell_um * 1e-6;
	u.microM.value = p.micro_um * 1e-6;
	u.flow.value = p.flow_mm_s * 1e-3;
	u.color.value.set( p.color );
	u.color2.value.set( p.color2 );
	u.color3.value.set( p.color3 );
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.sizeM.value } };

}
