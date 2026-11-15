// Wood preset -> uniforms. One mode per graph, chosen when it is built:
//   board  solid wood: growth rings (earlywood, latewood), knots, rays,
//          pores, fibres; the cut (flat, quarter, rotary) shapes the rings
//   chips  particle board: pressed wood chips of many sizes
//   cork   agglomerated cork: granules, cells, lenticels
//   bark   furrowed bark: plates, fissures, flakes, lichen
// Finishes over a board: saw marks, weathering and checks (driftwood),
// paint that flakes along the grain, char (shou sugi ban). Varnish and
// wetness come from the shared surface states (gloss, wetness).

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';
import { STATES_DEFAULTS, createStatesUniforms, applyStatesPreset } from '../../core/states.js';

export const WOOD_DEFAULTS = {
	schema_version: 1,
	family: 'wood',
	intent: 'raw oak board, flat sawn',
	seed: 1,
	mode: 'board', // board | chips | cork | bark
	cut: 'flat', // board: flat (cathedral arches), quarter (straight lines), rotary (plywood face)
	angle_deg: 0, // grain direction on the surface
	ring_mm: 4, // growth ring width
	ring_variation: 0.4, // wide and narrow years
	latewood: 0.35, // share of a ring that is dense and dark
	figure: 0.5, // waviness of the rings
	pith_mm: 140, // pith distance across the board (flat sawn)
	cut_depth_mm: 70, // distance from the pith to the cut plane
	cut_tilt: 0.06, // the plane leaves the log axis: arches along the board
	early_color: '#c99c66',
	late_color: '#8a5a32',
	color_variation: 0.15,
	knots: 0.5, // share of knot cells holding a knot
	knot_mm: 14,
	knot_color: '#5a3418',
	rays: 0.4,
	ray_mm: 0.8, // ray height along the grain (oak 10+, maple 0.5)
	pores: 0.6,
	pore_um: 180, // vessel diameter (oak 250, maple 80, pine 0: no vessels)
	ring_porous: 1, // vessels gathered in the earlywood (oak, ash) or spread (maple)
	fiber_um: 30, // fibre and tracheid diameter
	saw: 0, // band saw marks across the grain (rough sawn)
	saw_mm: 2.5,
	weather: 0, // grey, earlywood eroded (driftwood, old fences)
	weather_color: '#a19d94',
	checks: 0, // drying cracks along the grain
	paint: 0, // paint coat, 0..1
	paint_color: '#3f6d8a',
	flaking: 0.5, // share of the paint that has flaked off
	flake_mm: 10,
	char: 0, // burnt surface (shou sugi ban)
	char_mm: 14, // block size of the char crazing
	brushed: 0, // soft char brushed out, latewood stands
	// other modes
	chip_mm: 4, // chips: size of the coarse chips
	granule_mm: 3, // cork: granule size
	cell_um: 40, // cork: cell size
	ridge_mm: 25, // bark: width of a plate
	fissure: 0.7, // bark: depth of the fissures
	lichen: 0, // bark: lichen cover
	lichen_color: '#9aa47a',
	roughness: 0.6,
	sheen: 0,
	...SURFACE_DEFAULTS,
	...STATES_DEFAULTS,
};

export const WOOD_SLIDERS = [
	[ 'angle_deg', 0, 180, 1 ],
	[ 'ring_mm', 0.5, 20, 0.1 ],
	[ 'latewood', 0.05, 0.8, 0.01 ],
	[ 'figure', 0, 2, 0.01 ],
	[ 'knots', 0, 1, 0.01 ],
	[ 'rays', 0, 1, 0.01 ],
	[ 'pores', 0, 1, 0.01 ],
	[ 'saw', 0, 1, 0.01 ],
	[ 'weather', 0, 1, 0.01 ],
	[ 'checks', 0, 1, 0.01 ],
	[ 'paint', 0, 1, 0.01 ],
	[ 'flaking', 0, 1, 0.01 ],
	[ 'char', 0, 1, 0.01 ],
	[ 'brushed', 0, 1, 0.01 ],
	[ 'roughness', 0.1, 1, 0.01 ],
	[ 'gloss', 0, 1, 0.02 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createWoodUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'board', cut: 'flat', // read when the graph is built
		seed: uniform( 1 ), angle: uniform( 0 ), ringM: uniform( 4e-3 ), ringVar: uniform( 0.4 ), latewood: uniform( 0.35 ), figure: uniform( 0.5 ),
		pithM: uniform( 0.14 ), cutDepthM: uniform( 0.07 ), cutTilt: uniform( 0.06 ),
		earlyColor: c(), lateColor: c(), colorVar: uniform( 0.15 ),
		knots: uniform( 0.5 ), knotM: uniform( 0.014 ), knotColor: c(),
		rays: uniform( 0.4 ), rayM: uniform( 8e-4 ), pores: uniform( 0.6 ), poreM: uniform( 1.8e-4 ), ringPorous: uniform( 1 ), fiberM: uniform( 3e-5 ),
		saw: uniform( 0 ), sawM: uniform( 2.5e-3 ), weather: uniform( 0 ), weatherColor: c(), checks: uniform( 0 ),
		paint: uniform( 0 ), paintColor: c(), flaking: uniform( 0.5 ), flakeM: uniform( 0.01 ),
		char: uniform( 0 ), charM: uniform( 0.014 ), brushed: uniform( 0 ),
		chipM: uniform( 4e-3 ), granuleM: uniform( 3e-3 ), cellM: uniform( 4e-5 ), ridgeM: uniform( 0.025 ), fissure: uniform( 0.7 ),
		lichen: uniform( 0 ), lichenColor: c(),
		roughness: uniform( 0.6 ), sheen: uniform( 0 ),
		surface: createSurfaceUniforms(), states: createStatesUniforms(),
	};

}

export function applyWoodPreset( u, preset ) {

	const p = { ...WOOD_DEFAULTS, ...preset };
	u.mode = p.mode;
	u.cut = p.cut;
	const set = { seed: p.seed, ringVar: p.ring_variation, latewood: p.latewood, figure: p.figure, cutTilt: p.cut_tilt, colorVar: p.color_variation,
		knots: p.knots, rays: p.rays, pores: p.pores, ringPorous: p.ring_porous, saw: p.saw, weather: p.weather, checks: p.checks,
		paint: p.paint, flaking: p.flaking, char: p.char, brushed: p.brushed, fissure: p.fissure, lichen: p.lichen,
		roughness: p.roughness, sheen: p.sheen };
	for ( const k in set ) u[ k ].value = set[ k ];
	const mm = { ringM: p.ring_mm, pithM: p.pith_mm, cutDepthM: p.cut_depth_mm, knotM: p.knot_mm, rayM: p.ray_mm, sawM: p.saw_mm,
		flakeM: p.flake_mm, charM: p.char_mm, chipM: p.chip_mm, granuleM: p.granule_mm, ridgeM: p.ridge_mm };
	for ( const k in mm ) u[ k ].value = mm[ k ] * 1e-3;
	u.poreM.value = p.pore_um * 1e-6;
	u.fiberM.value = p.fiber_um * 1e-6;
	u.cellM.value = p.cell_um * 1e-6;
	u.angle.value = p.angle_deg * Math.PI / 180;
	const col = { earlyColor: p.early_color, lateColor: p.late_color, knotColor: p.knot_color, weatherColor: p.weather_color,
		paintColor: p.paint_color, lichenColor: p.lichen_color };
	for ( const k in col ) u[ k ].value.set( col[ k ] );
	applySurfacePreset( u.surface, p );
	applyStatesPreset( u.states, p );
	return { preset: p, stats: {}, derived: { stitchW: u.ringM.value } };

}
