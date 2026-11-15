// Stone preset -> uniforms. One mode per graph, chosen when it is built:
//   granite    interlocked crystals: feldspar, quartz, mica (granite.js)
//   marble     calcite crystals, branching veins, light inside (marble.js)
//   sandstone  cemented sand grains, cross bedded laminae (sediment.js)
//   slate      cleavage terraces with steps, mica sheen (sediment.js)
//   concrete   cement paste, aggregates, bubbles, formwork (concrete.js)
//   brick      a bond of fired bricks in recessed mortar (brick.js)
//   plaster    trowelled gypsum, pores, chalky (plaster.js)
// The four colours mean different things per mode (see each file header).
// Wetness, wax and wear come from the shared surface states.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const STONE_DEFAULTS = {
	schema_version: 1,
	family: 'stone',
	intent: 'pink granite, polished',
	seed: 1,
	mode: 'granite', // granite | marble | sandstone | slate | concrete | brick | plaster
	angle_deg: 0, // bedding, cleavage, vein trend or brick courses
	color: '#c99a8a', // granite: K-feldspar; marble, slate, concrete, plaster: base; sandstone: grains; brick: brick
	color2: '#e6e0d6', // granite: plagioclase; marble: cloud; sandstone: iron bands; slate: rust; concrete: coarse aggregate; brick: dark firing
	color3: '#6f6c6a', // granite: quartz; sandstone: cement; concrete: second aggregate; brick: mortar
	color4: '#1c1a19', // granite: mica; sandstone: dark lithic grains; concrete: sand; brick: grog
	color_variation: 0.15,
	grain_mm: 5, // crystal, grain or aggregate size
	polish: 1, // 1 polished, 0 flamed or raw
	quartz: 0.3, // granite: quartz share
	mica: 0.1, // granite: mica share; slate: sericite flakes
	pink: 0.6, // granite: share of feldspar that is pink K-feldspar
	veins: 0.6, // marble: vein strength
	vein_mm: 1.5, // marble: main vein width
	vein_color: '#6d6a68',
	layer_mm: 40, // sandstone: cross set thickness; slate: terrace size
	layers: 0.5, // contrast of the laminae
	steps: 0.6, // slate: height of the cleavage steps
	bubbles: 0.5, // concrete: air bubbles
	aggregate: 0.3, // concrete: worn area where aggregate shows
	formwork: 0.5, // concrete: board marks
	board_mm: 100, // concrete: board width
	brick_mm: 215, // brick length
	course_mm: 65, // brick height
	joint_mm: 10, // mortar joint
	recess_mm: 4, // how deep the mortar sits
	bond: 0, // 0 running (stretcher), 1 English (header courses)
	chips: 0.5, // brick: chipped edges
	trowel: 0.6, // plaster: trowel marks
	trowel_mm: 120, // plaster: size of a stroke
	pores: 0.4, // pits and voids
	scatter: 0, // light under the surface (marble)
	roughness: 0.7,
	sheen: 0,
	...SURFACE_DEFAULTS,
};

export const STONE_SLIDERS = [
	[ 'angle_deg', 0, 180, 1 ],
	[ 'grain_mm', 0.05, 30, 0.05 ],
	[ 'color_variation', 0, 0.6, 0.01 ],
	[ 'polish', 0, 1, 0.01 ],
	[ 'veins', 0, 1, 0.01 ],
	[ 'layers', 0, 1, 0.01 ],
	[ 'steps', 0, 1, 0.01 ],
	[ 'bubbles', 0, 1, 0.01 ],
	[ 'aggregate', 0, 1, 0.01 ],
	[ 'formwork', 0, 1, 0.01 ],
	[ 'chips', 0, 1, 0.01 ],
	[ 'trowel', 0, 1, 0.01 ],
	[ 'pores', 0, 1, 0.01 ],
	[ 'scatter', 0, 1, 0.01 ],
	[ 'roughness', 0.05, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

const NUM = { seed: 'seed', colorVar: 'color_variation', polish: 'polish', quartz: 'quartz', mica: 'mica', pink: 'pink', veins: 'veins',
	layers: 'layers', steps: 'steps', bubbles: 'bubbles', aggregate: 'aggregate', formwork: 'formwork', bond: 'bond', chips: 'chips',
	trowel: 'trowel', pores: 'pores', scatter: 'scatter', roughness: 'roughness', sheen: 'sheen' };
const MM = { grainM: 'grain_mm', veinM: 'vein_mm', layerM: 'layer_mm', boardM: 'board_mm', brickM: 'brick_mm', courseM: 'course_mm',
	jointM: 'joint_mm', recessM: 'recess_mm', trowelM: 'trowel_mm' };
const COL = { color: 'color', color2: 'color2', color3: 'color3', color4: 'color4', veinColor: 'vein_color' };

export function createStoneUniforms() {

	const u = { mode: 'granite', angle: uniform( 0 ), surface: createSurfaceUniforms() };
	for ( const k in NUM ) u[ k ] = uniform( 0 );
	for ( const k in MM ) u[ k ] = uniform( 1e-3 );
	for ( const k in COL ) u[ k ] = uniform( new Color() );
	return u;

}

export function applyStonePreset( u, preset ) {

	const p = { ...STONE_DEFAULTS, ...preset };
	u.mode = p.mode; // read when the graph is built
	for ( const k in NUM ) u[ k ].value = p[ NUM[ k ] ];
	for ( const k in MM ) u[ k ].value = p[ MM[ k ] ] * 1e-3;
	for ( const k in COL ) u[ k ].value.set( p[ COL[ k ] ] );
	u.angle.value = p.angle_deg * Math.PI / 180;
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.grainM.value } };

}
