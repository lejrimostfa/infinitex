// Knit preset -> uniform values. The preset is the JSON an author (or the
// prompt tool) writes. Physical units live in the names.
//
// Uniforms are created once per material. apply() updates them in place, so
// sliders never recompile the shader.

import { Color, Vector2 } from 'three';
import { uniform } from 'three/tsl';
import { legShape, yarnRadius } from './legs.js';
import { stitchStats } from './stats.js';
import { patternStats } from './pstats.js';
import { PATTERN_DEFAULTS, patternSettings } from './pparams.js';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';
import { STATES_DEFAULTS, createStatesUniforms, applyStatesPreset } from '../../core/states.js';

export const KNIT_DEFAULTS = {
	schema_version: 1,
	family: 'knit',
	intent: 'plain beige worsted wool, stockinette',
	seed: 1,
	meters_per_uv: 1.0, // surface meters covered by one UV unit
	stitches_per_10cm: 20,
	rows_per_10cm: 28,
	yarn_fill: 0.92, // 1 = legs touch
	ply_count: 3,
	ply_twist_per_cm: 2.2,
	twist: 'S',
	ply_definition: 0.5, // depth of the grooves between plies, 0..1
	fiber_diameter_um: 21,
	fiber_angle_deg: 12,
	fiber_wiggle: 0.6,
	irregularity: 1.0, // hand-knit unevenness: stitch tension, row wobble, twist drift, fiber crimp
	parallax: 1.0, // yarn depth seen through the flat surface, 0 = off
	color: '#c8b49a',
	heather_color: '#9c8a72',
	heather_fraction: 0.15,
	stitch_variation: 0.06,
	fiber_variation: 0.35,
	roughness: 0.6,
	specular_variance_scale: 0.3,
	sheen: 0.7,
	sheen_color: '#ffffff',
	sheen_roughness: 0.65,
	// L4 fuzz (only drawn when a fuzz mesh is attached, see index.js)
	fuzz_layers: 8, // fixed when the fuzz mesh is created
	fuzz_length_mm: 1.2,
	fuzz_hairs_per_mm2: 4,
	fuzz_lean: 2.6, // halo fibers lie close to the yarn // horizontal reach of a hair tip / its height
	fuzz_curl: 1.0,
	fuzz_opacity: 1.0,
	fuzz_color: '#d2c1a8',
	...SURFACE_DEFAULTS,
	...STATES_DEFAULTS,
	fuzz_sheen_keep: 0.85, // base sheen kept when fuzz is on: the fuzz carries the rest (gate: sheen check)
	...PATTERN_DEFAULTS,
};

// Panel sliders: [ key, min, max, step ].
export const KNIT_SLIDERS = [
	[ 'stitches_per_10cm', 8, 40, 1 ],
	[ 'rows_per_10cm', 10, 56, 1 ],
	[ 'yarn_fill', 0.6, 1.1, 0.01 ],
	[ 'ply_count', 2, 4, 1 ],
	[ 'ply_twist_per_cm', 0.8, 5, 0.1 ],
	[ 'ply_definition', 0, 1, 0.05 ],
	[ 'fiber_diameter_um', 12, 40, 1 ],
	[ 'fiber_wiggle', 0, 2, 0.05 ],
	[ 'heather_fraction', 0, 0.6, 0.01 ],
	[ 'fiber_variation', 0, 0.8, 0.01 ],
	[ 'roughness', 0.2, 1, 0.01 ],
	[ 'specular_variance_scale', 0, 1, 0.02 ],
	[ 'sheen', 0, 1.5, 0.05 ],
	[ 'sheen_roughness', 0.2, 1, 0.01 ],
	[ 'fuzz_length_mm', 0.3, 4, 0.1 ],
	[ 'fuzz_hairs_per_mm2', 0.5, 12, 0.5 ],
	[ 'fuzz_lean', 0.3, 3, 0.1 ],
	[ 'fuzz_curl', 0, 2, 0.05 ],
	[ 'fuzz_opacity', 0, 1.5, 0.05 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'gloss', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

const SPREAD = 0.36; // horizontal reach of a leg, in stitch widths

export function createKnitUniforms() {

	const shape = () => ( { p0: uniform( new Vector2() ), dir: uniform( new Vector2() ), len: uniform( 1 ), bow: uniform( 0 ) } );
	return {
		metersPerUV: uniform( 1 ), stitchW: uniform( 0.005 ), aspect: uniform( 0.7 ), R: uniform( 0.2 ),
		arch: uniform( 0.6 ), left: shape(), right: shape(),
		plyCount: uniform( 3 ), plyTwistPerM: uniform( 220 ), twistSign: uniform( 1 ), plyDepth: uniform( 0.15 ),
		fiberDiam: uniform( 21e-6 ), fiberTan: uniform( 0.2 ), fiberWiggle: uniform( 0.6 ),
		color: uniform( new Color() ), heather: uniform( new Color() ), heatherFrac: uniform( 0.1 ),
		stitchVar: uniform( 0.06 ), fiberVar: uniform( 0.3 ), seed: uniform( 1 ),
		roughness: uniform( 0.6 ), specVarScale: uniform( 0.3 ),
		sheen: uniform( 0.7 ), sheenColor: uniform( new Color() ), sheenRoughness: uniform( 0.6 ),
		meanAO: uniform( 0.7 ), stitchSlopeVar: uniform( 0.3 ),
		sheenKeep: uniform( 1 ), fuzzOn: false, surface: createSurfaceUniforms(), states: createStatesUniforms(), irregular: uniform( 1 ), parallax: uniform( 1 ),
		fuzzLength: uniform( 0.0016 ), fuzzCell: uniform( 5e-4 ), fuzzLean: uniform( 1.3 ), fuzzCurl: uniform( 0.6 ),
		fuzzRadius: uniform( 10e-6 ), fuzzLayers: uniform( 12 ), fuzzOpacity: uniform( 1 ), fuzzColor: uniform( new Color() ), fuzzFlowM: uniform( 0.004 ),
		stitch: 'jersey', pattern: null, relief: uniform( 1 ), backing: uniform( new Color() ),
		pileM: uniform( 0.0016 ), pillCell: uniform( 0.02 ), pillM: uniform( 0.0016 ),
	};

}

function setShape( target, s ) {

	target.p0.value.set( s.p0[ 0 ], s.p0[ 1 ] );
	target.dir.value.set( s.dir[ 0 ], s.dir[ 1 ] );
	target.len.value = s.len;
	target.bow.value = s.bow;

}

// Writes a preset into the uniforms. Returns the derived stitch statistics.
export function applyKnitPreset( u, preset ) {

	const p = { ...KNIT_DEFAULTS, ...preset };
	const stitchW = 0.1 / p.stitches_per_10cm;
	const aspect = ( 0.1 / p.rows_per_10cm ) / stitchW;
	const R = yarnRadius( p.yarn_fill, SPREAD, aspect );

	u.metersPerUV.value = p.meters_per_uv;
	u.stitchW.value = stitchW;
	u.aspect.value = aspect;
	u.R.value = R;
	setShape( u.left, legShape( - 1, aspect, SPREAD ) );
	setShape( u.right, legShape( 1, aspect, SPREAD ) );

	u.plyCount.value = p.ply_count;
	u.plyTwistPerM.value = p.ply_twist_per_cm * 100;
	u.twistSign.value = p.twist === 'Z' ? - 1 : 1;
	u.plyDepth.value = 0.3 * p.ply_definition;
	u.fiberDiam.value = p.fiber_diameter_um * 1e-6;
	u.fiberTan.value = Math.tan( p.fiber_angle_deg * Math.PI / 180 );
	u.fiberWiggle.value = p.fiber_wiggle;
	u.irregular.value = p.irregularity;
	applySurfacePreset( u.surface, p );
	applyStatesPreset( u.states, p );
	u.parallax.value = p.parallax;

	u.color.value.set( p.color );
	u.heather.value.set( p.heather_color );
	u.heatherFrac.value = p.heather_fraction;
	u.stitchVar.value = p.stitch_variation;
	u.fiberVar.value = p.fiber_variation;
	u.seed.value = p.seed;
	u.roughness.value = p.roughness;
	u.specVarScale.value = p.specular_variance_scale;
	u.sheen.value = p.sheen;
	u.sheenColor.value.set( p.sheen_color );
	u.sheenRoughness.value = p.sheen_roughness;
	u.sheenKeep.value = u.fuzzOn ? p.fuzz_sheen_keep : 1;

	u.fuzzLength.value = p.fuzz_length_mm * 1e-3;
	u.fuzzCell.value = 1e-3 / Math.sqrt( p.fuzz_hairs_per_mm2 );
	u.fuzzLean.value = p.fuzz_lean;
	u.fuzzCurl.value = p.fuzz_curl;
	u.fuzzRadius.value = p.fiber_diameter_um * 0.5e-6;
	u.fuzzLayers.value = p.fuzz_layers;
	u.fuzzOpacity.value = p.fuzz_opacity;
	u.fuzzColor.value.set( p.fuzz_color );

	// Stitch pattern (patterns.js): read when the graph is built.
	u.stitch = p.stitch;
	u.pattern = patternSettings( p, aspect );
	u.relief.value = p.relief;
	u.backing.value.set( p.backing_color );
	u.pileM.value = p.pile_mm * 1e-3;
	u.pillCell.value = 0.01 / Math.sqrt( Math.max( 1e-3, p.pills_per_cm2 ) );
	u.pillM.value = p.pill_mm * 1e-3;

	const counted = [ 'rib', 'garter', 'seed', 'cable', 'crochet' ].includes( p.stitch );
	const stats = counted ? patternStats( u.pattern, { aspect, R }, p.relief ) : stitchStats( { aspect, spread: SPREAD, R } );
	u.meanAO.value = stats.meanAO;
	u.stitchSlopeVar.value = stats.slopeVar;
	return { preset: p, stats, derived: { stitchW, aspect, R } };

}
