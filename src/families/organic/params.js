// Organic preset -> uniforms. One mode per graph, chosen when it is built.
// Plant matters (this file lists the modes; shader.js maps them to files):
//   petal    velvety cone cells, fan veins, a translucent edge
//   citrus   orange peel: dimples over oil glands, wax, stomata
//   apple    glossy skin, lenticels, red streaks over yellow green, bloom
//   berry    strawberry: red flesh, achenes in pits, tiny hairs
//   peach    a fuzz of fine hairs over a blushed skin
//   crust    bread crust: blisters, browning, flour, cracks
//   crumb    bread crumb: open air cells, thin glossy walls, starch
//   cactus   waxy ribs, areoles with spine clusters
//   walnut   walnut shell: deep convoluted wrinkles, woody cells
//   coir     coconut fibre: coarse brown fibres matted
//   seaweed  a translucent slimy blade, cells in rows, bubbles
//   pollen   a layer of spiky pollen grains on a dark surface
// The same few names serve every mode (size_mm is a petal, a gland, a
// blister or a rib), so one slider set covers the family. Animal matters
// of row 20 add their modes here and in shader.js.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const ORGANIC_DEFAULTS = {
	schema_version: 1,
	family: 'organic',
	intent: 'red rose petal',
	seed: 1,
	mode: 'petal',
	angle_deg: 0, // main direction (veins, streaks, ribs, blade axis)
	size_mm: 40, // main element: petal, gland, lenticel, achene, blister, air cell, rib, wrinkle
	feature_mm: 0.6, // second element: vein, pore, hair length, fibre length, bubble
	cell_um: 30, // cells at the deepest zoom (cone cells, flavedo, starch, pollen grain)
	fiber_um: 12, // hair, spine or fibre width
	color: '#b0122a', // main tone
	color2: '#e04a5e', // second tone (edge, streak, crust peak, rib)
	color3: '#4a0410', // dark tone (veins, gaps, pits, base)
	color_variation: 0.15,
	relief: 1, // height of the relief
	density: 0.5, // how many glands, lenticels, achenes, spines, grains
	blush: 0.5, // apple and peach: red over the ground colour
	streaks: 0.5, // apple: red stripes; walnut: suture ridge
	wax: 0.4, // bloom of wax (matt, pale) or a waxy shine
	fuzz: 0, // hairs (peach, strawberry, cactus areoles)
	dust: 0, // flour on crust, pollen cover
	bubbles: 0, // seaweed air bubbles
	translucency: 0.5, // light through the matter (SSS material)
	roughness: 0.5,
	sheen: 0,
	...SURFACE_DEFAULTS,
};

export const ORGANIC_SLIDERS = [
	[ 'angle_deg', 0, 180, 1 ],
	[ 'size_mm', 0.2, 120, 0.1 ],
	[ 'feature_mm', 0.05, 20, 0.01 ],
	[ 'cell_um', 5, 400, 1 ],
	[ 'relief', 0, 2, 0.01 ],
	[ 'density', 0, 1, 0.01 ],
	[ 'blush', 0, 1, 0.01 ],
	[ 'streaks', 0, 1, 0.01 ],
	[ 'wax', 0, 1, 0.01 ],
	[ 'fuzz', 0, 1, 0.01 ],
	[ 'dust', 0, 1, 0.01 ],
	[ 'bubbles', 0, 1, 0.01 ],
	[ 'translucency', 0, 1, 0.01 ],
	[ 'roughness', 0.05, 1, 0.01 ],
	[ 'sheen', 0, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createOrganicUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'petal', // read when the graph is built
		seed: uniform( 1 ), angle: uniform( 0 ), sizeM: uniform( 0.04 ), featureM: uniform( 6e-4 ), cellM: uniform( 3e-5 ), fiberM: uniform( 1.2e-5 ),
		color: c(), color2: c(), color3: c(), colorVar: uniform( 0.15 ), relief: uniform( 1 ),
		density: uniform( 0.5 ), blush: uniform( 0.5 ), streaks: uniform( 0.5 ), wax: uniform( 0.4 ), fuzz: uniform( 0 ),
		dust: uniform( 0 ), bubbles: uniform( 0 ), translucency: uniform( 0.5 ), roughness: uniform( 0.5 ), sheen: uniform( 0 ),
		paintedShare: uniform( 1 ), // lowered by the 3D hair near the camera (core/hair3d.js)
		surface: createSurfaceUniforms(),
	};

}

export function applyOrganicPreset( u, preset ) {

	const p = { ...ORGANIC_DEFAULTS, ...preset };
	u.mode = p.mode;
	const set = { seed: p.seed, colorVar: p.color_variation, relief: p.relief, density: p.density, blush: p.blush, streaks: p.streaks,
		wax: p.wax, fuzz: p.fuzz, dust: p.dust, bubbles: p.bubbles, translucency: p.translucency, roughness: p.roughness, sheen: p.sheen };
	for ( const k in set ) u[ k ].value = set[ k ];
	u.angle.value = p.angle_deg * Math.PI / 180;
	u.sizeM.value = p.size_mm * 1e-3;
	u.featureM.value = p.feature_mm * 1e-3;
	u.cellM.value = p.cell_um * 1e-6;
	u.fiberM.value = p.fiber_um * 1e-6;
	u.color.value.set( p.color );
	u.color2.value.set( p.color2 );
	u.color3.value.set( p.color3 );
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.sizeM.value } };

}

// 3D strands near the camera (core/hair3d.js), for the fuzzy modes: the
// peach trichomes, about featureM long and fiberM thick, half lying down.
// Density matches the painted fuzz (berry.js: four layers of hair cells
// about 0.3 to 0.45 featureM wide); the painted hairs thin out by
// paintedShare where the 3D ones grow.
export function organicHairSpec( u ) {

	const length = uniform( 0 ), strandW = uniform( 0 ), density = uniform( 0 );
	const color = uniform( new Color() ), tip = uniform( new Color() );
	const sync = () => {

		const L = u.featureM.value;
		length.value = L * 0.5;
		strandW.value = u.fiberM.value;
		density.value = u.fuzz.value * 4 / ( ( L * 0.38 ) ** 2 );
		color.value.copy( u.color2.value ).lerp( new Color( 0.8, 0.72, 0.58 ), 0.4 );
		tip.value.set( 0.85, 0.8, 0.7 );

	};

	sync();
	return {
		sync, seed: u.seed, strandW, lengthM: length, density, paintedShare: u.paintedShare,
		angle: u.angle, flowM: uniform( 0.01 ), flowAmt: uniform( 1.2 ),
		stand: uniform( 0.6 ), pile: uniform( 0.35 ), clump: uniform( 0 ), lockM: uniform( 1e-3 ),
		crimp: uniform( 0 ), crimpM: uniform( 1e-3 ), color, tipColor: tip, colorVar: uniform( 0.15 ),
		bands: uniform( 0 ), bandColor: color, guard: uniform( 0 ), guardColor: color, roughness: uniform( 0.45 ),
	};

}
