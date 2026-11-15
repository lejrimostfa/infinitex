// Decor preset -> uniforms. One mode per graph, chosen when it is built:
//   oil          oil painting on canvas: a painted landscape in brush
//                strokes, impasto, canvas weave, varnish craquelure
//   embroidery   satin, stem and fishbone stitches of floss over a woven
//                ground (a flower spray)
//   screenprint  plastisol ink pressed through a screen onto a woven
//                ground: flat colours, mesh marks, misregistration, cracks
//   tattoo       a tattoo flash printed on cotton: dye in the fibres
// The woven ground (embroidery, screenprint, tattoo) is the woven family
// itself, built from the `ground` sub-preset (woven/params.js keys).

import { Color, Vector2 } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';
import { createWovenUniforms, applyWovenPreset } from '../woven/params.js';

export const DECOR_DEFAULTS = {
	schema_version: 1,
	family: 'decor',
	intent: 'oil painting of a landscape',
	seed: 1,
	mode: 'oil',
	size_mm: 10, // main element: brush stroke length, motif tile, print design
	feature_mm: 0.4, // second element: floss width, bristle groove, screen mesh
	color: '#b0182a', // main ink or floss colour
	color2: '#e8b830', // second colour
	color3: '#1f5a3a', // third colour (leaves, outline)
	color_variation: 0.12,
	relief: 1, // impasto, stitch and ink height
	amount: 0.5, // craquelure, ink cracks, misregistration
	varnish: 0.5, // oil: yellowed varnish and its gloss
	design_map: null, // tattoo: a drawing (THREE.Texture, dark lines on white)
	tattoo_map: null, // alias of design_map (the cube demo hands this name)
	design_size_mm: 240,
	design_center: [ 0.15, 0.15 ], // meters
	roughness: 0.6,
	ground: { ends_per_cm: 20, picks_per_cm: 18, warp_color: '#e9e2d2', weft_color: '#e3dccb', fill: 0.9, irregularity: 0.6 },
	...SURFACE_DEFAULTS,
};

export const DECOR_SLIDERS = [
	[ 'size_mm', 1, 60, 0.1 ],
	[ 'feature_mm', 0.05, 2, 0.01 ],
	[ 'relief', 0, 2, 0.01 ],
	[ 'amount', 0, 1, 0.01 ],
	[ 'varnish', 0, 1, 0.01 ],
	[ 'color_variation', 0, 0.4, 0.01 ],
	[ 'roughness', 0.05, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createDecorUniforms() {

	const c = () => uniform( new Color() );
	return {
		mode: 'oil', designMap: null, // read when the graph is built
		seed: uniform( 1 ), sizeM: uniform( 0.01 ), featureM: uniform( 4e-4 ),
		color: c(), color2: c(), color3: c(), colorVar: uniform( 0.12 ),
		relief: uniform( 1 ), amount: uniform( 0.5 ), varnish: uniform( 0.5 ),
		designSize: uniform( 0.24 ), designCenter: uniform( new Vector2( 0.15, 0.15 ) ), roughness: uniform( 0.6 ),
		surface: createSurfaceUniforms(),
		ground: createWovenUniforms(),
	};

}

export function applyDecorPreset( u, preset ) {

	const p = { ...DECOR_DEFAULTS, ...preset, ground: { ...DECOR_DEFAULTS.ground, ...( preset.ground ?? {} ) } };
	u.mode = p.mode;
	u.designMap = p.design_map ?? p.tattoo_map;
	const set = { seed: p.seed, colorVar: p.color_variation, relief: p.relief, amount: p.amount, varnish: p.varnish, roughness: p.roughness };
	for ( const k in set ) u[ k ].value = set[ k ];
	u.sizeM.value = p.size_mm * 1e-3;
	u.featureM.value = p.feature_mm * 1e-3;
	u.designSize.value = p.design_size_mm * 1e-3;
	u.designCenter.value.set( ...p.design_center );
	u.color.value.set( p.color );
	u.color2.value.set( p.color2 );
	u.color3.value.set( p.color3 );
	applySurfacePreset( u.surface, p );
	applyWovenPreset( u.ground, { seed: p.seed, wetness: p.wetness, wear: p.wear, ...p.ground } );
	return { preset: p, stats: {}, derived: { stitchW: u.sizeM.value } };

}
