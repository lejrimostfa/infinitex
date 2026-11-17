// Bloom and colour grade of the camera kit, on linear HDR colour. It runs
// inside a RenderPipeline's output node, so the pipeline's ACES tone
// mapping and sRGB conversion come once, after it. Three stages:
//   bloom     only the light above a luminance threshold glows (soft knee,
//             the excess only), so the bright water does not wash out:
//             surface glints, caustic lines, light shafts, bubble rims.
//             three's BloomNode, five mips from half resolution.
//   grade     contrast on the luminance around a pivot, in stops (ACES
//             adds the shoulder and the toe, so the whole curve is a
//             gentle S). Shadows tinted toward deep blue, highlights
//             toward warm gold. Vibrance: weak colours gain more than
//             strong ones, so a red fish does not clip.
//   vignette  soft corners, slightly blue
// The bloom is added before the grade: it is light of the scene, so it
// takes the same tints.
// water (0 to 1) moves the shadow tint from airShadows to shadows and the
// bloom threshold from airThreshold to threshold. The page sets 1 with the
// camera under water, 0 in the air (default 1). Every setting is a
// uniform in .uniforms, to tune from the console:
//   __ix.kit.post.grade.uniforms.bloom.value = 0.2
// Event bus: none.

import { Vector3 } from 'three/webgpu';
import { Fn, uniform, nodeObject, float, vec2, vec3, vec4, luminance, mix, smoothstep, clamp, max, min, pow, log2, length, screenUV, screenSize } from 'three/tsl';
import { bloom as bloomNode } from 'three/addons/tsl/display/BloomNode.js';

// Moderate on purpose: the lights and the water under it change, the look
// must hold over many frames, not one.
export const GRADE_DEFAULTS = Object.freeze( {
	// bloom: strength (0 builds no bloom pass), radius 0 to 1 (1: wide
	// mips weigh most). threshold: linear luminance where the glow starts
	// under water; airThreshold in the air, above diffuse white, so a
	// bright sky or a white wall does not glow. knee: soft start, as a
	// fraction of the threshold. cap: brighter pixels count as this bright.
	bloom: 0.35, bloomRadius: 0.75, threshold: 0.55, airThreshold: 1.1, knee: 0.6, cap: 12,
	// contrast: exponent on the luminance around pivot (1: none).
	contrast: 1.12, pivot: 0.14,
	// shadows: shadow tint strength under water, airShadows in the air.
	shadows: 0.45, airShadows: 0.1, shadowTint: [ 0.2, 0.45, 1 ],
	highlights: 0.15, highlightTint: [ 1, 0.92, 0.7 ],
	vibrance: 0.3,
	// vignette: strength in the corners. from, to: the radius where it
	// starts and where it is full, in frame heights (0.5: the top edge).
	vignette: 0.3, vignetteFrom: 0.4, vignetteTo: 0.95, vignetteTint: [ 0.55, 0.68, 0.9 ],
	water: 1,
} );

// Soft knee bright pass, in place of BloomNode's hard step: the light above
// the threshold, eased in over the knee. The input is capped first: one
// sun glint at 50 would flicker through the mips.
const brightPass = ( knee, cap ) => Fn( ( { input, threshold } ) => {

	const l = luminance( input.rgb );
	const lc = min( l, cap );
	const k = threshold.mul( knee ).add( 1e-4 );
	const soft = clamp( lc.sub( threshold ).add( k ), 0, k.mul( 2 ) );
	const excess = max( soft.mul( soft ).div( k.mul( 4 ) ), lc.sub( threshold ) );
	return vec4( input.rgb.mul( excess.div( max( l, 1e-4 ) ) ), 1 );

} );

// settings: GRADE_DEFAULTS overrides ({} is the default look).
export function createGrade( settings = {} ) {

	const s = { ...GRADE_DEFAULTS, ...settings };
	const v3 = ( c ) => uniform( new Vector3( ...c ) );
	const u = {
		bloom: uniform( s.bloom ), bloomRadius: uniform( s.bloomRadius ), threshold: uniform( s.threshold ), airThreshold: uniform( s.airThreshold ), knee: uniform( s.knee ), cap: uniform( s.cap ),
		contrast: uniform( s.contrast ), pivot: uniform( s.pivot ),
		shadows: uniform( s.shadows ), airShadows: uniform( s.airShadows ), shadowTint: v3( s.shadowTint ),
		highlights: uniform( s.highlights ), highlightTint: v3( s.highlightTint ),
		vibrance: uniform( s.vibrance ),
		vignette: uniform( s.vignette ), vignetteFrom: uniform( s.vignetteFrom ), vignetteTo: uniform( s.vignetteTo ), vignetteTint: v3( s.vignetteTint ),
		water: uniform( s.water ),
	};

	// One bloom for every colour node it is applied to: apply() points it at
	// the node in use (the sharp frame or the blurred one). The pipeline
	// rebuilds on that swap, so the bloom's bright pass is rebuilt too.
	const glow = s.bloom > 0 ? bloomNode( vec4( 0 ), u.bloom, u.bloomRadius, mix( u.airThreshold, u.threshold, u.water ) ) : null;
	if ( glow ) glow.highPassFn = brightPass( u.knee, u.cap );

	const finish = ( colour, uvNode ) => {

		let c = colour.rgb;
		if ( glow ) c = c.add( nodeObject( glow ).rgb );
		// Contrast on the luminance, in stops from the pivot. The hue and the
		// saturation stay; vibrance handles the saturation below.
		const l = max( luminance( c ), 1e-6 );
		const stops = log2( l.div( u.pivot ) );
		c = c.mul( pow( l.div( u.pivot ), u.contrast ).mul( u.pivot ).div( l ) );
		// Split toning, by the stops before the contrast. Tints are scaled to
		// a luminance of 1, so they move the hue, not the exposure.
		const shadowW = float( 1 ).sub( smoothstep( - 3.5, 0.5, stops ) ).mul( mix( u.airShadows, u.shadows, u.water ) );
		const highW = smoothstep( 0, 3, stops ).mul( u.highlights );
		c = c.mul( mix( vec3( 1 ), u.shadowTint.div( luminance( u.shadowTint ) ), shadowW ) );
		c = c.mul( mix( vec3( 1 ), u.highlightTint.div( luminance( u.highlightTint ) ), highW ) );
		// Vibrance: push the saturation by vibrance times what is left of it.
		const hi = max( c.r, max( c.g, c.b ) ), lo = min( c.r, min( c.g, c.b ) );
		const sat = hi.sub( lo ).div( max( hi, 1e-5 ) );
		c = max( mix( vec3( luminance( c ) ), c, float( 1 ).add( u.vibrance.mul( float( 1 ).sub( sat ) ) ) ), vec3( 0 ) );
		// Vignette: half the frame's aspect counts, so the dark corners reach
		// a little along the long sides.
		const p = uvNode.sub( 0.5 ).mul( vec2( mix( 1, screenSize.x.div( screenSize.y ), 0.5 ), 1 ) );
		const edge = smoothstep( u.vignetteFrom, u.vignetteTo, length( p ) );
		c = c.mul( mix( vec3( 1 ), u.vignetteTint, edge.mul( u.vignette ) ) );
		return vec4( c, 1 );

	};

	const built = new Map(); // colour node: its finished node
	return {
		uniforms: u, bloomNode: glow, settings: s,
		// colour: a vec4 node of linear HDR colour. uvNode: where it is in
		// the frame (the vignette). Returns the finished vec4 node.
		apply( colour, uvNode = screenUV ) {

			if ( glow ) glow.inputNode = colour;
			if ( ! built.has( colour ) ) built.set( colour, finish( colour, uvNode ) );
			return built.get( colour );

		},
		dispose() { glow?.dispose(); },
	};

}
