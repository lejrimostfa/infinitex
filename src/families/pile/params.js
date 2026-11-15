// Pile preset -> uniforms. Fabrics whose face is made of yarn ends or loops
// standing up from a ground. One mode per graph, chosen when it is built:
//   cut     cut-pile carpet: twisted yarn tufts cut open at the top
//   loop    berber: tight loops of flecked yarn in rows
//   velvet  short dense pile, its shade turns with the view and the brush
//   cord    corduroy: ribs (wales) of velvet, cut channels between them
//   terry   towel: loose loops of soft cotton yarn over a woven ground
//   knot    hand-knotted rug: one colour per knot, a Persian design
//   fur     faux fur: long even synthetic fibres (the strands graph)
//
// The uniforms are a superset of the strands family: the same object is the
// spec of the 3D strands (core/hair3d.js) and, in fur mode, the input of
// buildStrandsNodes. Tufts are the hair "locks": tuft_mm is lockM, so the
// painted tufts sit where the 3D tufts gather.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const PILE_DEFAULTS = {
	schema_version: 1,
	family: 'pile',
	intent: 'beige cut-pile carpet',
	seed: 1, // an integer: the tuft lattice is shared with the 3D strands
	mode: 'cut', // cut | loop | velvet | cord | terry | knot | fur
	angle_deg: 90, // lean of the pile, direction of the rows and wales
	color: '#b9a586',
	tip_color: '#cdb998', // fibre tips (velvet, carpet, faux fur)
	color2: '#3a3026', // flecks (berber), ground (terry, cord channels)
	color_variation: 0.12,
	pile_mm: 9, // fibre length of the 3D strands; cut pile: the free fibre ends above the twisted yarn bundle (the surface is the top of the bundles)
	fiber_um: 40,
	tuft_mm: 3, // tuft spacing (cut, velvet), loop length (loop, terry)
	row_mm: 4, // row spacing (loop, terry), knot row height (knot)
	tuft_depth: 0.6, // how dark the gaps between tufts are
	plies: 2,
	twist_mm: 4, // one turn of the plies
	fleck: 0, // share of dark fleck segments in the yarn (berber)
	nap: 0.3, // shade change with the view along the lean
	brush: 0.4, // crushed patches: the lean turns, radians / 2
	brush_mm: 40,
	wale_mm: 2.8, // corduroy rib pitch
	channel: 0.18, // corduroy channel width, share of the pitch
	// knotted rug
	knot_mm: 2.2, // knot width along a row
	rug_mm: 300, // the design repeats every rug_mm (one rug)
	abrash: 0.5, // colour bands of hand-dyed wool lots
	fringe: 0, // 1: kilim ends and warp fringe at both ends of the rug
	rug_red: '#7e1d1b', rug_blue: '#1d2b4f', rug_ivory: '#d9cdb0',
	rug_gold: '#b9873e', rug_dark: '#24170f', rug_green: '#4d6047',
	// faux fur (strands names)
	flow_amount: 0.4,
	lock_mm: 2,
	guard: 0,
	guard_color: '#1a120c',
	anisotropy: 0.6,
	// 3D strands near the camera (createHair)
	density_cm2: 2000, // fibres per cm^2
	stand_deg: 80, // root angle above the surface
	pile_height: 0.96, // height of the fibre layer, share of the length
	clump: 0.7, // fibres of a tuft gather
	roughness: 0.75,
	sheen: 0.4,
	...SURFACE_DEFAULTS,
};

export const PILE_SLIDERS = [
	[ 'angle_deg', 0, 180, 1 ],
	[ 'pile_mm', 0.5, 40, 0.1 ],
	[ 'fiber_um', 8, 80, 1 ],
	[ 'tuft_mm', 0.2, 8, 0.05 ],
	[ 'tuft_depth', 0, 1, 0.01 ],
	[ 'nap', 0, 1, 0.01 ],
	[ 'brush', 0, 1.5, 0.01 ],
	[ 'fleck', 0, 0.5, 0.01 ],
	[ 'abrash', 0, 1, 0.01 ],
	[ 'roughness', 0.1, 1, 0.01 ],
	[ 'sheen', 0, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createPileUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'cut', fringe: 0, // read when the graph is built
		seed: uniform( 1 ), angle: uniform( Math.PI / 2 ), color: c(), tipColor: c(), color2: c(), colorVar: uniform( 0.12 ),
		lengthM: uniform( 9e-3 ), strandW: uniform( 4e-5 ), lockM: uniform( 3e-3 ), rowM: uniform( 4e-3 ), lockDepth: uniform( 0.6 ),
		plies: uniform( 2 ), twistM: uniform( 4e-3 ), fleck: uniform( 0 ), nap: uniform( 0.3 ),
		flowM: uniform( 0.04 ), flowAmt: uniform( 0.4 ), waleM: uniform( 2.8e-3 ), channel: uniform( 0.18 ),
		knotM: uniform( 2.2e-3 ), rugM: uniform( 0.3 ), abrash: uniform( 0.5 ),
		red: c(), blue: c(), ivory: c(), gold: c(), dark: c(), green: c(),
		// strands spec (hair3d, fur mode)
		crimp: uniform( 0 ), crimpM: uniform( 1e-3 ), bands: uniform( 0 ), bandColor: c(), guard: uniform( 0 ), guardColor: c(),
		aniso: uniform( 0.6 ), density: uniform( 2e7 ), stand: uniform( 1.4 ), pile: uniform( 0.96 ), clump: uniform( 0.7 ),
		roughness: uniform( 0.75 ), sheen: uniform( 0.4 ),
		surface: createSurfaceUniforms(),
	};

}

export function applyPilePreset( u, preset ) {

	const p = { ...PILE_DEFAULTS, ...preset };
	u.mode = p.mode;
	u.fringe = p.fringe;
	const set = { seed: Math.round( p.seed ), colorVar: p.color_variation, lockDepth: p.tuft_depth, plies: p.plies, fleck: p.fleck,
		nap: p.nap, channel: p.channel, abrash: p.abrash, guard: p.guard, aniso: p.anisotropy, pile: p.pile_height,
		clump: p.clump, roughness: p.roughness, sheen: p.sheen };
	for ( const k in set ) u[ k ].value = set[ k ];
	const mm = { lengthM: p.pile_mm, rowM: p.row_mm, twistM: p.twist_mm, flowM: p.brush_mm, waleM: p.wale_mm, knotM: p.knot_mm, rugM: p.rug_mm };
	for ( const k in mm ) u[ k ].value = mm[ k ] * 1e-3;
	// Faux fur locks come from lock_mm, every other pile from its tufts.
	u.lockM.value = ( p.mode === 'fur' ? p.lock_mm : p.tuft_mm ) * 1e-3;
	u.flowAmt.value = p.mode === 'fur' ? p.flow_amount : p.brush;
	u.strandW.value = p.fiber_um * 1e-6;
	u.angle.value = p.angle_deg * Math.PI / 180;
	u.stand.value = p.stand_deg * Math.PI / 180;
	u.density.value = p.density_cm2 * 1e4;
	const col = { color: p.color, tipColor: p.tip_color, color2: p.color2, bandColor: p.color, guardColor: p.guard_color,
		red: p.rug_red, blue: p.rug_blue, ivory: p.rug_ivory, gold: p.rug_gold, dark: p.rug_dark, green: p.rug_green };
	for ( const k in col ) u[ k ].value.set( col[ k ] );
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.lockM.value } };

}
