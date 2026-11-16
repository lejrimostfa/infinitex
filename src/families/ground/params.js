// Ground preset -> uniforms. One mode per graph, chosen when it is built:
//   soil     crumbs and clods, stones, root fibres, organic specks, silt
//   sand     ripples, then grains of quartz and darker minerals
//   gravel   packed pebbles of several rocks, shadowed gaps
//   mud      a mud flat cracked in polygons, edges curled as it dries
//   snow     soft drifts, sparkling grains, rounded and hexagonal crystals
//   frost    feathery frost: dendrites in fern patterns on a cold surface
//   ice      clear ice: bubbles at depth, white cracks, frosted scratches
//   crystals salt cubes or sugar grains, faceted and glinting
//   dust     a dust layer on a flat dark base: particles and fibres
// The same few names serve every mode (grain_mm is a sand grain, a pebble,
// a mud plate or a frost feather), so one slider set covers the family.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';

export const GROUND_DEFAULTS = {
	schema_version: 1,
	family: 'ground',
	intent: 'dry beach sand',
	seed: 1,
	mode: 'sand', // soil | sand | gravel | mud | snow | frost | ice | crystals | dust
	grain_mm: 0.35, // main element: grain, pebble, crumb, mud plate, frost feather, crystal
	size_variation: 0.5, // spread of the element sizes
	color: '#c9b08a', // main tone
	color2: '#8c7a62', // second tone (other minerals, dry crust, frost)
	color3: '#2e2a26', // dark tone (dark minerals, gaps, base under frost or dust)
	relief: 1, // height of the elements
	ripple_mm: 70, // sand: ripple wavelength; snow: drift size
	ripple: 0.6, // sand: ripple height; snow: drift height
	dune: 0, // sand: low mounds 4 ripples wide, for a displaced floor (read when the material is built)
	stones: 0.3, // soil: stones; gravel: sand in the gaps
	roots: 0.4, // soil: root fibres; dust: lint fibres
	specks: 0.5, // dark organic specks (soil), dark minerals (sand)
	crack_mm: 3, // mud and ice: crack width
	curl: 0.6, // mud: plate edges curled up as they dry
	wet: 0.5, // mud: share of wet dark plates
	sparkle: 0.5, // glints of facets (quartz, snow, salt, frost)
	bubbles: 0.5, // ice: trapped bubbles
	cracks: 0.4, // ice: white fractures
	scratches: 0.5, // ice: frosted skate scratches
	cover: 0.6, // dust: thickness of the layer; frost: how far the crystals reach
	cubic: 1, // crystals: 1 salt cubes, 0 sugar grains
	roughness: 0.8,
	...SURFACE_DEFAULTS,
};

export const GROUND_SLIDERS = [
	[ 'grain_mm', 0.02, 120, 0.01 ],
	[ 'size_variation', 0, 1, 0.01 ],
	[ 'relief', 0, 2, 0.01 ],
	[ 'ripple_mm', 5, 300, 1 ],
	[ 'ripple', 0, 2, 0.01 ],
	[ 'dune', 0, 2, 0.01 ],
	[ 'stones', 0, 1, 0.01 ],
	[ 'roots', 0, 1, 0.01 ],
	[ 'specks', 0, 1, 0.01 ],
	[ 'crack_mm', 0.2, 10, 0.1 ],
	[ 'curl', 0, 1, 0.01 ],
	[ 'wet', 0, 1, 0.01 ],
	[ 'sparkle', 0, 1, 0.01 ],
	[ 'bubbles', 0, 1, 0.01 ],
	[ 'cracks', 0, 1, 0.01 ],
	[ 'scratches', 0, 1, 0.01 ],
	[ 'cover', 0, 1, 0.01 ],
	[ 'roughness', 0.05, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createGroundUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'sand', // read when the graph is built
		seed: uniform( 1 ), grainM: uniform( 3.5e-4 ), sizeVar: uniform( 0.5 ),
		color: c(), color2: c(), color3: c(), relief: uniform( 1 ),
		rippleM: uniform( 0.07 ), ripple: uniform( 0.6 ), dune: uniform( 0 ), stones: uniform( 0.3 ), roots: uniform( 0.4 ), specks: uniform( 0.5 ),
		crackM: uniform( 3e-3 ), curl: uniform( 0.6 ), wet: uniform( 0.5 ), sparkle: uniform( 0.5 ),
		bubbles: uniform( 0.5 ), cracks: uniform( 0.4 ), scratches: uniform( 0.5 ), cover: uniform( 0.6 ), cubic: uniform( 1 ),
		roughness: uniform( 0.8 ),
		surface: createSurfaceUniforms(),
	};

}

export function applyGroundPreset( u, preset ) {

	const p = { ...GROUND_DEFAULTS, ...preset };
	u.mode = p.mode;
	const set = { seed: p.seed, sizeVar: p.size_variation, relief: p.relief, ripple: p.ripple, dune: p.dune, stones: p.stones, roots: p.roots,
		specks: p.specks, curl: p.curl, wet: p.wet, sparkle: p.sparkle, bubbles: p.bubbles, cracks: p.cracks,
		scratches: p.scratches, cover: p.cover, cubic: p.cubic, roughness: p.roughness };
	for ( const k in set ) u[ k ].value = set[ k ];
	u.grainM.value = p.grain_mm * 1e-3;
	u.rippleM.value = p.ripple_mm * 1e-3;
	u.crackM.value = p.crack_mm * 1e-3;
	u.color.value.set( p.color );
	u.color2.value.set( p.color2 );
	u.color3.value.set( p.color3 );
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.grainM.value } };

}
