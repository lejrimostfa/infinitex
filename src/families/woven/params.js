// Woven preset -> uniforms. Warp threads run along v, weft threads along u.
// A weave is one rule: in cell ( i, j ) the warp is on top when
// ( i * shift + j ) mod repeat < up. Plain: repeat 2, up 1. Twill 3/1:
// repeat 4, up 3. Satin 5: repeat 5, shift 2, up 4. Herringbone: a twill
// whose shift flips every `herringbone` warp threads.

import { Color } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../../core/surface.js';
import { STATES_DEFAULTS, createStatesUniforms, applyStatesPreset } from '../../core/states.js';

export const WEAVES = {
	plain: { repeat: 2, shift: 1, up: 1 },
	twill21: { repeat: 3, shift: 1, up: 2 },
	twill22: { repeat: 4, shift: 1, up: 2 },
	twill31: { repeat: 4, shift: 1, up: 3 },
	satin5: { repeat: 5, shift: 2, up: 4 },
};

export const WOVEN_DEFAULTS = {
	schema_version: 1,
	family: 'woven',
	intent: 'cotton shirting, plain weave',
	seed: 1,
	weave: 'plain',
	herringbone: 0, // warp threads per zigzag band, 0 = off
	ends_per_cm: 30, // warp density
	picks_per_cm: 26, // weft density
	fill: 0.92, // thread width / spacing; below 1 the gaps open
	warp_fill: -1, // the warp's own fill (thin binding threads of a mat); -1 = fill
	flatten: 0.45, // round 1, flat ribbon 0
	round_shade: 0.45, // shadow on the flanks of each thread
	irregularity: 0.4, // threads wander and their edges waver
	fray: 1, // frayed fiber ends along the edges (0 for smooth canes and slats)
	slub: 0.1, // thick and thin places along the thread (linen)
	slub_mm: 6,
	twist_ratio: 0.9, // ply period along the thread, in thread widths
	twist_deg: 30, // angle of the plies and fibers to the thread axis (carbon: about 0)
	fiber_um: 15,
	warp_color: '#ece6da',
	weft_color: '#e4ddd0',
	heather_color: '#ffffff', // flecks among the fibers (tweed)
	heather_fraction: 0,
	color_variation: 0.08,
	tartan: 0, // 1: warp and weft take the sett colours below
	sett: 24, // threads per colour repeat
	tartan_a: '#1d3b2a',
	tartan_b: '#1f2c55',
	tartan_c: '#9a1f24',
	roughness: 0.75,
	sheen: 0.45,
	sheer: 0, // 1: the gaps are holes and the threads let light through (voile, organza)
	thread_opacity: 0.6, // opacity of one sheer thread
	brocade: 0, // 1: a floral motif in floats of a gold weft (brocade.js)
	motif_mm: 110, // width of the motif repeat (half drop, 1.3 times as tall)
	gold_picks_per_cm: 13, // rows of gold floats
	binding: 6, // ground ends between two ties of a gold float
	gold_color: '#f2cc7c', // gilt strip (metal F0)
	core_color: '#a8781e', // yellow silk core seen between the wraps
	...SURFACE_DEFAULTS,
	...STATES_DEFAULTS,
	fuzz_layers: 6,
	fuzz_length_mm: 0.6,
	fuzz_hairs_per_mm2: 1.5,
	fuzz_lean: 2.0,
	fuzz_curl: 0.5,
	fuzz_opacity: 0.8,
	fuzz_color: '#e8e2d6',
	fuzz_flow_mm: 4, // the hairs turn over this distance; pile has one nap direction (large)
	hair_um: 15,
};

export const WOVEN_SLIDERS = [
	[ 'ends_per_cm', 2, 80, 0.5 ],
	[ 'picks_per_cm', 2, 80, 0.5 ],
	[ 'fill', 0.5, 1.05, 0.01 ],
	[ 'flatten', 0, 1, 0.01 ],
	[ 'slub', 0, 1, 0.01 ],
	[ 'irregularity', 0, 1.5, 0.01 ],
	[ 'heather_fraction', 0, 0.5, 0.01 ],
	[ 'color_variation', 0, 0.4, 0.01 ],
	[ 'roughness', 0.1, 1, 0.01 ],
	[ 'sheen', 0, 1, 0.01 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];

export function createWovenUniforms() {

	const c = () => uniform( new Color() );
	return {
		seed: uniform( 1 ), repeat: uniform( 2 ), shift: uniform( 1 ), up: uniform( 1 ), herring: uniform( 0 ),
		warpM: uniform( 1e-3 ), weftM: uniform( 1e-3 ), fill: uniform( 0.92 ), warpFill: uniform( 0.92 ), flatten: uniform( 0.45 ), roundShade: uniform( 0.45 ), irregular: uniform( 0.4 ), fray: uniform( 1 ),
		slub: uniform( 0.1 ), slubM: uniform( 6e-3 ), twistRatio: uniform( 0.9 ), twistTan: uniform( 1.73 ), fiberM: uniform( 15e-6 ),
		warpColor: c(), weftColor: c(), heatherColor: c(), heather: uniform( 0 ), colorVar: uniform( 0.08 ),
		tartan: uniform( 0 ), sett: uniform( 24 ), tA: c(), tB: c(), tC: c(),
		roughness: uniform( 0.75 ), sheenAmt: uniform( 0.45 ),
		sheerOn: false, threadOpacity: uniform( 0.6 ), brocadeOn: false, // build-time switches
		motifM: uniform( 0.11 ), goldPickM: uniform( 7.7e-4 ), binding: uniform( 7 ), goldColor: c(), coreColor: c(),
		surface: createSurfaceUniforms(), states: createStatesUniforms(),
		// Fuzz shells read these (shared with the knit fuzz).
		metersPerUV: uniform( 1 ), fuzzOn: false, sheen: uniform( 0.45 ), sheenColor: uniform( new Color( 1, 1, 1 ) ), sheenRoughness: uniform( 0.6 ),
		fuzzLength: uniform( 6e-4 ), fuzzCell: uniform( 8e-4 ), fuzzLean: uniform( 2 ), fuzzCurl: uniform( 0.5 ),
		fuzzRadius: uniform( 7.5e-6 ), fuzzLayers: uniform( 6 ), fuzzOpacity: uniform( 0.8 ), fuzzColor: c(), fuzzFlowM: uniform( 0.004 ),
	};

}

export function applyWovenPreset( u, preset ) {

	const p = { ...WOVEN_DEFAULTS, ...preset };
	const w = WEAVES[ p.weave ] ?? WEAVES.plain;
	u.seed.value = p.seed;
	u.repeat.value = w.repeat;
	u.shift.value = w.shift;
	u.up.value = w.up;
	u.herring.value = p.herringbone;
	u.warpM.value = 0.01 / p.ends_per_cm;
	u.weftM.value = 0.01 / p.picks_per_cm;
	u.fill.value = p.fill;
	u.warpFill.value = p.warp_fill < 0 ? p.fill : p.warp_fill;
	u.flatten.value = p.flatten;
	u.roundShade.value = p.round_shade;
	u.irregular.value = p.irregularity;
	u.fray.value = p.fray;
	u.slub.value = p.slub;
	u.slubM.value = p.slub_mm * 1e-3;
	u.twistRatio.value = p.twist_ratio;
	u.twistTan.value = 1 / Math.tan( Math.max( 1, p.twist_deg ) * Math.PI / 180 );
	u.fiberM.value = p.fiber_um * 1e-6;
	u.warpColor.value.set( p.warp_color );
	u.weftColor.value.set( p.weft_color );
	u.heatherColor.value.set( p.heather_color );
	u.heather.value = p.heather_fraction;
	u.colorVar.value = p.color_variation;
	u.tartan.value = p.tartan;
	u.sett.value = p.sett;
	u.tA.value.set( p.tartan_a );
	u.tB.value.set( p.tartan_b );
	u.tC.value.set( p.tartan_c );
	u.roughness.value = p.roughness;
	u.sheenAmt.value = p.sheen;
	u.sheen.value = p.sheen;
	u.sheerOn = p.sheer > 0;
	u.threadOpacity.value = p.thread_opacity;
	u.brocadeOn = p.brocade > 0;
	u.motifM.value = p.motif_mm * 1e-3;
	u.goldPickM.value = 0.01 / p.gold_picks_per_cm;
	u.binding.value = p.binding;
	u.goldColor.value.set( p.gold_color );
	u.coreColor.value.set( p.core_color );
	applySurfacePreset( u.surface, p );
	applyStatesPreset( u.states, p );
	u.fuzzLength.value = p.fuzz_length_mm * 1e-3;
	u.fuzzCell.value = 1e-3 / Math.sqrt( p.fuzz_hairs_per_mm2 );
	u.fuzzLean.value = p.fuzz_lean;
	u.fuzzCurl.value = p.fuzz_curl;
	u.fuzzRadius.value = p.hair_um * 0.5e-6;
	u.fuzzLayers.value = p.fuzz_layers;
	u.fuzzOpacity.value = p.fuzz_opacity;
	u.fuzzColor.value.set( p.fuzz_color );
	u.fuzzFlowM.value = p.fuzz_flow_mm * 1e-3;
	return { preset: p, stats: {}, derived: { stitchW: u.warpM.value } };

}
