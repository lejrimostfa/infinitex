// Liquid preset -> uniforms. Moving liquids and films, all animated by
// ixTime (core/clock.js) times `speed`. One mode per graph:
//   water   calm water: wind ripples, capillary waves, sand and caustics
//           seen through it (water.js)
//   rain    a puddle on asphalt under rain: ring ripples (rain.js)
//   runoff  water running down a stone wall: rivulets, sheets, beads
//           (runoff.js); the wall is the stone family (`wall` sub-preset)
//   oil     an oil slick on a wet asphalt puddle: thin film colours (oil.js)
//   soap    a soap film, seen through: draining colours (soap.js)
//   foam    sea foam on dark water: packed bubbles that pop (foam.js)
// The same few names serve every mode (see the comments).

import { Color, Vector2 } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';
import { createStoneUniforms, applyStonePreset } from '../stone/params.js';

export const LIQUID_DEFAULTS = {
	schema_version: 1,
	family: 'liquid',
	intent: 'calm shallow water over sand',
	seed: 1,
	mode: 'water', // water | rain | runoff | oil | soap | foam
	speed: 1, // time scale of every motion (1 = real time)
	angle_deg: 0, // wind (water, foam), main swirl (oil)
	spread_deg: 50, // water: spread of the ripple directions round the wind (180: from everywhere, a pool)
	size_mm: 60, // water: longest ripple; rain: drop cell; runoff: rivulet spacing; oil: swirl; soap: film height; foam: lace
	feature_mm: 3, // water: shortest ripple; rain: ring wavelength; runoff: rivulet width; oil, soap: eddy; foam: biggest bubble
	depth_mm: 60, // water depth (water, rain, oil puddle)
	amount: 0.6, // ripple steepness, rain rate, water flow, oil cover, film turbulence, foam cover
	density: 0.5, // floating specks, puddle share, beads, foam bubble fill
	color: '#0e3b3c', // water seen deep, puddle tint, foam
	color2: '#b49c74', // bottom sand, asphalt stones, water of the foam
	color3: '#121214', // dark: bitumen, specks
	film_nm: [ 0, 900 ], // thin film thickness range (oil, soap, foam bubbles)
	clarity: 0.12, // water: light path (m) over which it takes its own colour
	sky: 1, // radiance of the overcast sky the liquid reflects (sky.js)
	roughness: 0.02,
	wall: { mode: 'slate', color: '#4a4f55', color2: '#7a5a3a', angle_deg: 80, layer_mm: 70, steps: 0.5, mica: 0.3, layers: 0.4, pores: 0.2, polish: 0, roughness: 0.65, color_variation: 0.12 },
	...SURFACE_DEFAULTS,
};

export const LIQUID_SLIDERS = [
	[ 'speed', 0, 4, 0.01 ],
	[ 'angle_deg', 0, 360, 1 ],
	[ 'size_mm', 1, 400, 0.5 ],
	[ 'feature_mm', 0.1, 50, 0.1 ],
	[ 'depth_mm', 1, 300, 1 ],
	[ 'amount', 0, 1.5, 0.01 ],
	[ 'density', 0, 1, 0.01 ],
	[ 'clarity', 0.01, 1, 0.01 ],
	[ 'sky', 0, 3, 0.01 ],
	[ 'roughness', 0.01, 0.5, 0.01 ],
];

export function createLiquidUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'water', spread: 50, // read when the graph is built
		seed: uniform( 1 ), speed: uniform( 1 ), angle: uniform( 0 ), sizeM: uniform( 0.06 ), featureM: uniform( 3e-3 ), depthM: uniform( 0.06 ),
		amount: uniform( 0.6 ), density: uniform( 0.5 ), color: c(), color2: c(), color3: c(),
		film: uniform( new Vector2( 0, 900 ) ), clarity: uniform( 0.12 ), sky: uniform( 1 ), roughness: uniform( 0.02 ),
		wall: createStoneUniforms(), surface: createSurfaceUniforms(),
	};

}

export function applyLiquidPreset( u, preset ) {

	const p = { ...LIQUID_DEFAULTS, ...preset, wall: { ...LIQUID_DEFAULTS.wall, ...( preset.wall ?? {} ) } };
	u.mode = p.mode;
	u.spread = p.spread_deg;
	const set = { seed: p.seed, speed: p.speed, amount: p.amount, density: p.density, clarity: p.clarity, sky: p.sky, roughness: p.roughness };
	for ( const k in set ) u[ k ].value = set[ k ];
	u.angle.value = p.angle_deg * Math.PI / 180;
	u.sizeM.value = p.size_mm * 1e-3;
	u.featureM.value = p.feature_mm * 1e-3;
	u.depthM.value = p.depth_mm * 1e-3;
	u.film.value.set( p.film_nm[ 0 ], p.film_nm[ 1 ] );
	u.color.value.set( p.color );
	u.color2.value.set( p.color2 );
	u.color3.value.set( p.color3 );
	applyStonePreset( u.wall, { seed: p.seed, ...p.wall } );
	applySurfacePreset( u.surface, p );
	return { preset: p, stats: {}, derived: { stitchW: u.featureM.value } };

}
