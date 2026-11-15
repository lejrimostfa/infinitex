// Plant and organic preset -> uniforms. One mode per graph, chosen when it
// is built:
//   leaf   a leaf blade: vein orders, areoles, cuticle, jigsaw epidermal
//          cells, stomata; light passes through (leaf.js)
//   moss   a moss cushion of leafy shoots with lichen rosettes and cups
//          (moss.js, lichen.js)
//   gills  a mushroom cap seen from below: radial gills of four lengths,
//          stem, hymenium cells and spores (gills.js)
//   bone   compact bone: osteons with their canals, growth lines, a cut
//          showing spongy trabeculae (bone.js)
//   horn   keratin: streaks, growth bands, ridges, layer edges, cells;
//          translucent amber (horn.js)
//   nacre  mother of pearl: aragonite tablets under a thin film, growth
//          lines, an outer shell rim with ridges (nacre.js)
// The four colours mean different things per mode (see each file header).
// Wetness, wax and wear come from the shared surface states.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const PLANT_DEFAULTS = {
	schema_version: 1,
	family: 'plant',
	intent: 'green leaf, upper side',
	seed: 1,
	mode: 'leaf', // leaf | moss | gills | bone | horn | nacre
	angle_deg: 30, // midrib, bone axis, horn grain, nacre growth direction
	color: '#3e6a23', // leaf: lamina; moss: shoots; gills: gill face; bone: ivory; horn: amber; nacre: base
	color2: '#9aae4a', // leaf: veins; moss: shoot tips; gills: gill edge; bone: yellow stain; horn: dark streak; nacre: outer shell
	color3: '#27441a', // leaf: mottle; moss: lichen; gills: spores; bone: marrow; horn: growth band; nacre: shell ridges
	color4: '#c9cfb8', // leaf: cuticle wax; moss: lichen cups; gills: stem; bone: canal; horn: pale streak; nacre: prisms
	color_variation: 0.15,
	size_mm: 18, // leaf: secondary vein spacing; moss: shoot size; gills: cap radius; bone: osteon; horn: ridge spacing; nacre: growth line spacing
	cell_um: 50, // leaf: pavement cells; moss: leaf cells; gills: hymenium; bone: lacunae spacing; horn: squames; nacre: tablets
	veins: 0.8, // leaf: vein strength
	stomata: 0.5, // leaf: stomata density
	lichen: 0.3, // moss: lichen cover
	capsules: 0.3, // moss: spore capsules
	spores: 0.5, // gills: spore dust
	cut: 0.4, // bone: share of the face cut open (trabeculae)
	pores: 0.5, // bone: canal openings
	ridges: 0.5, // horn: longitudinal ridges; nacre: outer shell ridges
	bands: 0.5, // horn, bone: growth bands
	streaks: 0.5, // horn: pigment streaks
	shell: 0.25, // nacre: share of the face showing the outer shell
	polish: 0.7, // bone, horn, nacre: 1 polished
	iridescence: 0, // structural colour (nacre)
	iridescence_nm: [ 300, 700 ], // film thickness range
	scatter: 0, // light under the surface (leaf, horn, bone)
	roughness: 0.5,
	sheen: 0,
	...SURFACE_DEFAULTS,
};

export const PLANT_SLIDERS = [
	[ 'angle_deg', 0, 180, 1 ],
	[ 'size_mm', 0.3, 300, 0.1 ],
	[ 'cell_um', 3, 300, 1 ],
	[ 'color_variation', 0, 0.6, 0.01 ],
	[ 'veins', 0, 1, 0.01 ],
	[ 'stomata', 0, 1, 0.01 ],
	[ 'lichen', 0, 1, 0.01 ],
	[ 'capsules', 0, 1, 0.01 ],
	[ 'spores', 0, 1, 0.01 ],
	[ 'cut', 0, 1, 0.01 ],
	[ 'pores', 0, 1, 0.01 ],
	[ 'ridges', 0, 1, 0.01 ],
	[ 'bands', 0, 1, 0.01 ],
	[ 'streaks', 0, 1, 0.01 ],
	[ 'shell', 0, 1, 0.01 ],
	[ 'polish', 0, 1, 0.01 ],
	[ 'iridescence', 0, 1, 0.01 ],
	[ 'scatter', 0, 1, 0.01 ],
	[ 'roughness', 0.05, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'gloss', 0, 1, 0.02 ],
];

const NUM = { seed: 'seed', colorVar: 'color_variation', veins: 'veins', stomata: 'stomata', lichen: 'lichen', capsules: 'capsules',
	spores: 'spores', cut: 'cut', pores: 'pores', ridges: 'ridges', bands: 'bands', streaks: 'streaks', shell: 'shell', polish: 'polish',
	irid: 'iridescence', scatter: 'scatter', roughness: 'roughness', sheen: 'sheen' };
const COL = { color: 'color', color2: 'color2', color3: 'color3', color4: 'color4' };

export function createPlantUniforms() {

	const u = { mode: 'leaf', angle: uniform( 0 ), sizeM: uniform( 0.012 ), cellM: uniform( 5e-5 ),
		iridMin: uniform( 300 ), iridMax: uniform( 700 ), surface: createSurfaceUniforms() };
	for ( const k in NUM ) u[ k ] = uniform( 0 );
	for ( const k in COL ) u[ k ] = uniform( new Color() );
	return u;

}

export function applyPlantPreset( u, preset ) {

	const p = { ...PLANT_DEFAULTS, ...preset };
	u.mode = p.mode; // read when the graph is built
	for ( const k in NUM ) u[ k ].value = p[ NUM[ k ] ];
	for ( const k in COL ) u[ k ].value.set( p[ COL[ k ] ] );
	u.angle.value = p.angle_deg * Math.PI / 180;
	u.sizeM.value = p.size_mm * 1e-3;
	u.cellM.value = p.cell_um * 1e-6;
	u.iridMin.value = p.iridescence_nm[ 0 ];
	u.iridMax.value = p.iridescence_nm[ 1 ];
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.sizeM.value } };

}
