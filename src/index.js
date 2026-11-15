// Infinitex public API.
//
//   const ix = createMaterial( { family: 'knit', color: '#7a2030' } );
//   mesh.material = ix.material;
//   ix.addEventListener( 'paramsChanged', e => ui.refresh( e.detail ) );
//   ix.set( { stitches_per_10cm: 24 } );   // no recompile, uniforms only
//
// Event bus: each InfinitexMaterial is an EventTarget.
//   materialReady  { family, preset, stats }  once, after the node graph is built
//   paramsChanged  { family, preset, stats }  after every set()
//   fuzzAttached   { family, preset, stats }  after createFuzz()
//   hairAttached   { family, preset, stats }  after createHair()
// UI code listens to these events and never reads the uniforms directly.

import { MeshPhysicalNodeMaterial, MeshSSSNodeMaterial, Mesh, SkinnedMesh, FrontSide } from 'three/webgpu';
import { float, uv, mix } from 'three/tsl';
import { createStitchColor } from './core/colormap.js';
import { createKnitUniforms, applyKnitPreset, KNIT_DEFAULTS, KNIT_SLIDERS } from './families/knit/params.js';
import { createLeatherUniforms, applyLeatherPreset, LEATHER_DEFAULTS, LEATHER_SLIDERS } from './families/leather/params.js';
import { buildLeatherNodes } from './families/leather/shader.js';
import { createSkinUniforms, applySkinPreset, SKIN_DEFAULTS, SKIN_SLIDERS, skinHairSpec } from './families/skin/params.js';
import { buildSkinNodes } from './families/skin/shader.js';
import { createMetalUniforms, applyMetalPreset, METAL_DEFAULTS, METAL_SLIDERS } from './families/metal/params.js';
import { buildMetalNodes } from './families/metal/shader.js';
import { createRopeUniforms, applyRopePreset, ROPE_DEFAULTS, ROPE_SLIDERS } from './families/rope/params.js';
import { buildRopeNodes } from './families/rope/shader.js';
import { createWovenUniforms, applyWovenPreset, WOVEN_DEFAULTS, WOVEN_SLIDERS } from './families/woven/params.js';
import { buildWovenNodes } from './families/woven/shader.js';
import { createFibermatUniforms, applyFibermatPreset, FIBERMAT_DEFAULTS, FIBERMAT_SLIDERS } from './families/fibermat/params.js';
import { buildFibermatNodes } from './families/fibermat/shader.js';
import { createScalesUniforms, applyScalesPreset, SCALES_DEFAULTS, SCALES_SLIDERS } from './families/scales/params.js';
import { buildScalesNodes } from './families/scales/shader.js';
import { createStrandsUniforms, applyStrandsPreset, STRANDS_DEFAULTS, STRANDS_SLIDERS } from './families/strands/params.js';
import { buildStrandsNodes } from './families/strands/shader.js';
import { createWoodUniforms, applyWoodPreset, WOOD_DEFAULTS, WOOD_SLIDERS } from './families/wood/params.js';
import { buildWoodNodes } from './families/wood/shader.js';
import { woodHeight } from './families/wood/height.js';
import { waterHeight } from './families/liquid/water.js';
import { createCeramicUniforms, applyCeramicPreset, CERAMIC_DEFAULTS, CERAMIC_SLIDERS } from './families/ceramic/params.js';
import { buildCeramicNodes } from './families/ceramic/shader.js';
import { createPlasticUniforms, applyPlasticPreset, PLASTIC_DEFAULTS, PLASTIC_SLIDERS } from './families/plastic/params.js';
import { buildPlasticNodes } from './families/plastic/shader.js';
import { createStoneUniforms, applyStonePreset, STONE_DEFAULTS, STONE_SLIDERS } from './families/stone/params.js';
import { buildStoneNodes, stoneMaterialKind } from './families/stone/shader.js';
import { createGroundUniforms, applyGroundPreset, GROUND_DEFAULTS, GROUND_SLIDERS } from './families/ground/params.js';
import { buildGroundNodes } from './families/ground/shader.js';
import { createPileUniforms, applyPilePreset, PILE_DEFAULTS, PILE_SLIDERS } from './families/pile/params.js';
import { buildPileNodes } from './families/pile/shader.js';
import { createOrganicUniforms, applyOrganicPreset, ORGANIC_DEFAULTS, ORGANIC_SLIDERS, organicHairSpec } from './families/organic/params.js';
import { buildOrganicNodes, organicMaterialKind } from './families/organic/shader.js';
import { createScifiUniforms, applyScifiPreset, SCIFI_DEFAULTS, SCIFI_SLIDERS } from './families/scifi/params.js';
import { buildScifiNodes } from './families/scifi/shader.js';
import { createDecorUniforms, applyDecorPreset, DECOR_DEFAULTS, DECOR_SLIDERS } from './families/decor/params.js';
import { buildDecorNodes } from './families/decor/shader.js';
import { createPlantUniforms, applyPlantPreset, PLANT_DEFAULTS, PLANT_SLIDERS } from './families/plant/params.js';
import { buildPlantNodes, plantMaterialKind } from './families/plant/shader.js';
import { createInterlaceUniforms, applyInterlacePreset, INTERLACE_DEFAULTS, INTERLACE_SLIDERS } from './families/interlace/params.js';
import { buildInterlaceNodes } from './families/interlace/shader.js';
import { createJellyUniforms, applyJellyPreset, JELLY_DEFAULTS, JELLY_SLIDERS } from './families/jelly/params.js';
import { buildJellyNodes } from './families/jelly/shader.js';
import { createTransformUniforms, applyTransformPreset, TRANSFORM_DEFAULTS, TRANSFORM_SLIDERS } from './families/transform/params.js';
import { buildTransformNodes } from './families/transform/shader.js';
import { createMoltenUniforms, applyMoltenPreset, MOLTEN_DEFAULTS, MOLTEN_SLIDERS } from './families/molten/params.js';
import { buildMoltenNodes } from './families/molten/shader.js';
import { createLiquidUniforms, applyLiquidPreset, LIQUID_DEFAULTS, LIQUID_SLIDERS } from './families/liquid/params.js';
import { buildLiquidNodes } from './families/liquid/shader.js';
import { buildKnitNodes } from './families/knit/shader.js';
import { buildFuzzNodes, createShellGeometry } from './families/knit/fuzz.js';
import { createHair3D } from './core/hair3d.js';
import { buildPixel } from './core/pixel.js';
import { buildRelief } from './core/relief.js';
import { applyUnderwater } from './core/underwater.js';
import { applyMicro } from './core/micro.js';
import { addMicroShadow } from './core/microshadow.js';
import { addSlopeLight } from './core/slopelight.js';
import { footprint } from './core/lod.js';
export { setTime, ixTime } from './core/clock.js';

const FAMILIES = {
	knit: { defaults: KNIT_DEFAULTS, uniforms: createKnitUniforms, apply: applyKnitPreset, build: buildKnitNodes, fuzz: buildFuzzNodes, sliders: KNIT_SLIDERS },
	skin: { defaults: SKIN_DEFAULTS, uniforms: createSkinUniforms, apply: applySkinPreset, build: buildSkinNodes, fuzz: buildFuzzNodes, hair: skinHairSpec, sliders: SKIN_SLIDERS, material: 'sss' },
	metal: { defaults: METAL_DEFAULTS, uniforms: createMetalUniforms, apply: applyMetalPreset, build: buildMetalNodes, sliders: METAL_SLIDERS },
	rope: { defaults: ROPE_DEFAULTS, uniforms: createRopeUniforms, apply: applyRopePreset, build: buildRopeNodes, fuzz: buildFuzzNodes, sliders: ROPE_SLIDERS },
	woven: { defaults: WOVEN_DEFAULTS, uniforms: createWovenUniforms, apply: applyWovenPreset, build: buildWovenNodes, fuzz: buildFuzzNodes, sliders: WOVEN_SLIDERS },
	fibermat: { defaults: FIBERMAT_DEFAULTS, uniforms: createFibermatUniforms, apply: applyFibermatPreset, build: buildFibermatNodes, fuzz: buildFuzzNodes, sliders: FIBERMAT_SLIDERS },
	scales: { defaults: SCALES_DEFAULTS, uniforms: createScalesUniforms, apply: applyScalesPreset, build: buildScalesNodes, sliders: SCALES_SLIDERS },
	strands: { defaults: STRANDS_DEFAULTS, uniforms: createStrandsUniforms, apply: applyStrandsPreset, build: buildStrandsNodes, hair: ( u ) => u, sliders: STRANDS_SLIDERS },
	// Pile uniforms are a superset of the strands ones: the same object is the 3D strand spec.
	pile: { defaults: PILE_DEFAULTS, uniforms: createPileUniforms, apply: applyPilePreset, build: buildPileNodes, hair: ( u ) => u, sliders: PILE_SLIDERS },
	wood: { defaults: WOOD_DEFAULTS, uniforms: createWoodUniforms, apply: applyWoodPreset, build: buildWoodNodes, height: woodHeight, sliders: WOOD_SLIDERS },
	ceramic: { defaults: CERAMIC_DEFAULTS, uniforms: createCeramicUniforms, apply: applyCeramicPreset, build: buildCeramicNodes, sliders: CERAMIC_SLIDERS },
	plastic: { defaults: PLASTIC_DEFAULTS, uniforms: createPlasticUniforms, apply: applyPlasticPreset, build: buildPlasticNodes, sliders: PLASTIC_SLIDERS },
	stone: { defaults: STONE_DEFAULTS, uniforms: createStoneUniforms, apply: applyStonePreset, build: buildStoneNodes, sliders: STONE_SLIDERS, material: stoneMaterialKind },
	ground: { defaults: GROUND_DEFAULTS, uniforms: createGroundUniforms, apply: applyGroundPreset, build: buildGroundNodes, sliders: GROUND_SLIDERS },
	organic: { defaults: ORGANIC_DEFAULTS, uniforms: createOrganicUniforms, apply: applyOrganicPreset, build: buildOrganicNodes, hair: organicHairSpec, sliders: ORGANIC_SLIDERS, material: organicMaterialKind },
	leather: { defaults: LEATHER_DEFAULTS, uniforms: createLeatherUniforms, apply: applyLeatherPreset, build: buildLeatherNodes, sliders: LEATHER_SLIDERS },
	decor: { defaults: DECOR_DEFAULTS, uniforms: createDecorUniforms, apply: applyDecorPreset, build: buildDecorNodes, sliders: DECOR_SLIDERS },
	scifi: { defaults: SCIFI_DEFAULTS, uniforms: createScifiUniforms, apply: applyScifiPreset, build: buildScifiNodes, sliders: SCIFI_SLIDERS },
	plant: { defaults: PLANT_DEFAULTS, uniforms: createPlantUniforms, apply: applyPlantPreset, build: buildPlantNodes, sliders: PLANT_SLIDERS, material: plantMaterialKind },
	interlace: { defaults: INTERLACE_DEFAULTS, uniforms: createInterlaceUniforms, apply: applyInterlacePreset, build: buildInterlaceNodes, sliders: INTERLACE_SLIDERS },
	jelly: { defaults: JELLY_DEFAULTS, uniforms: createJellyUniforms, apply: applyJellyPreset, build: buildJellyNodes, sliders: JELLY_SLIDERS },
	transform: { defaults: TRANSFORM_DEFAULTS, uniforms: createTransformUniforms, apply: applyTransformPreset, build: buildTransformNodes, sliders: TRANSFORM_SLIDERS },
	molten: { defaults: MOLTEN_DEFAULTS, uniforms: createMoltenUniforms, apply: applyMoltenPreset, build: buildMoltenNodes, sliders: MOLTEN_SLIDERS },
	liquid: { defaults: LIQUID_DEFAULTS, uniforms: createLiquidUniforms, apply: applyLiquidPreset, build: buildLiquidNodes, height: waterHeight, sliders: LIQUID_SLIDERS },
};

// Where mask = 0 the base material shows, where mask = 1 the family.
function blendWithBase( nodes, base, mask ) {

	nodes.colorNode = mix( base.color, nodes.colorNode, mask );
	nodes.normalNode = mix( base.normal, nodes.normalNode, mask ).normalize();
	nodes.roughnessNode = mix( base.roughness, nodes.roughnessNode, mask );
	nodes.metalnessNode = mix( base.metalness, nodes.metalnessNode ?? float( 0 ), mask );
	if ( nodes.sheenNode ) nodes.sheenNode = nodes.sheenNode.mul( mask );
	if ( nodes.clearcoatNode ) nodes.clearcoatNode = nodes.clearcoatNode.mul( mask );
	if ( nodes.thicknessColorNode ) nodes.thicknessColorNode = nodes.thicknessColorNode.mul( mask );
	// A game material lit by its own colour (toon look) keeps that glow
	// outside the mask only: the family is lit physically.
	if ( base.emissive ) nodes.emissiveNode = base.emissive.mul( float( 1 ).sub( mask ) );

}

export class InfinitexMaterial extends EventTarget {

	// options (all optional), to wear the material over part of a textured mesh:
	//   coords    node, knit coordinates in meters (see tools/knitCoords.js)
	//   colorMap  { map: Texture, uv: node }: stitches take the image colours
	//   mask      node 0..1: where the family replaces the base material
	//   base      { color, normal, roughness, metalness } nodes of the base
	//             material (core/basematerial.js), shown where mask = 0
	constructor( preset = {}, options = {} ) {

		super();
		const family = preset.family ?? 'knit';
		const impl = FAMILIES[ family ];
		if ( ! impl ) throw new Error( `infinitex: unknown family "${ family }"` );

		this.family = family;
		this.impl = impl;
		this.uniforms = impl.uniforms();
		this.state = impl.apply( this.uniforms, preset );

		this.options = options;
		const coords = options.coords ?? null;
		const stitchColor = options.colorMap && coords
			? createStitchColor( { map: options.colorMap.map, mapUV: options.colorMap.uv ?? uv(), coords } ) : null;
		this.stitchColor = stitchColor;
		// base.under === false: the base is another matter side by side, not a
		// surface under this one, so the family does not build on its normal.
		const buildOpts = { coords, stitchColor, baseNormal: options.base?.under === false ? null : options.base?.normal ?? null };
		// preset.pixel: the same matter drawn as pixel art (core/pixel.js).
		// preset.relief: real relief up close, for families with a height (core/relief.js).
		const nodes = preset.pixel ? buildPixel( impl, this.uniforms, buildOpts, preset )
			: preset.relief ? buildRelief( impl, this.uniforms, buildOpts, preset ) : impl.build( this.uniforms, buildOpts );
		// Micro detail under the family's finest level, down to 1 um
		// (core/micro.js). preset.micro: a gain, 0 turns it off.
		if ( ! preset.pixel && preset.micro !== 0 ) {

			const mp = coords ?? uv();
			applyMicro( nodes, family, mp, footprint( mp ), { angle: this.uniforms.angle ?? 0, amount: preset.micro ?? 1, seed: this.uniforms.seed?.value ?? 0 } );

		}

		this.debug = nodes.debug;
		const slopeLight = nodes.slopeLight;
		delete nodes.debug;
		delete nodes.slopeLight;
		if ( options.base && options.mask ) blendWithBase( nodes, options.base, options.mask );
		// preset.underwater: caustics and absorption below the scene's water (core/underwater.js).
		if ( preset.underwater ) applyUnderwater( nodes );
		// Families with light passing through (skin, marble) need the SSS
		// material. `material` is a kind, or a function of the uniforms when
		// it depends on the preset (stone: marble only).
		const kind = typeof impl.material === 'function' ? impl.material( this.uniforms ) : impl.material;
		this.material = kind === 'sss' ? new MeshSSSNodeMaterial() : new MeshPhysicalNodeMaterial();
		Object.assign( this.material, nodes );
		addMicroShadow( this.material ); // pores and cracks shadow the key light (core/microshadow.js)
		addSlopeLight( this.material, slopeLight ); // faded slopes get the light of their normals (core/slopelight.js)

		queueMicrotask( () => this.#emit( 'materialReady' ) );

	}

	get preset() {

		return this.state.preset;

	}

	set( partial ) {

		this.state = this.impl.apply( this.uniforms, { ...this.state.preset, ...partial } );
		this.hairSpec?.sync?.();
		this.#emit( 'paramsChanged' );

	}

	// Fuzz shells over a mesh that already wears this material. Returns the
	// shell mesh, added as a child of `mesh` (same skeleton when skinned).
	// One draw call per mesh. The base sheen drops to fuzz_sheen_keep, since
	// the fuzz now carries part of the grazing light: no double counting.
	// opts.triangles: Uint8Array, 1 for the triangles that grow fuzz.
	createFuzz( mesh, opts = {} ) {

		if ( ! this.impl.fuzz ) throw new Error( `infinitex: family "${ this.family }" has no fuzz` );
		if ( ! this.fuzzMaterial ) {

			const o = this.options;
			const nodes = this.impl.fuzz( this.uniforms, {
				coords: o.coords ?? null,
				color: this.stitchColor ? this.stitchColor.here.mul( 1.12 ) : null,
				mask: o.mask ?? null,
			} );
			// Physical with sheen: stray fibers are what sheen models, so the
			// shells carry the sheen the base gives up (sheenKeep).
			const m = new MeshPhysicalNodeMaterial( { transparent: true, depthWrite: false, side: FrontSide } );
			Object.assign( m, nodes );
			m.roughnessNode = float( 0.9 );
			m.metalnessNode = float( 0 );
			m.sheenNode = ( this.stitchColor ? this.stitchColor.here : this.uniforms.sheenColor ).mul( this.uniforms.sheen );
			m.sheenRoughnessNode = this.uniforms.sheenRoughness;
			this.fuzzMaterial = m;
			this.uniforms.fuzzOn = true;
			this.state = this.impl.apply( this.uniforms, this.state.preset );

		}

		const geo = createShellGeometry( mesh.geometry, this.state.preset.fuzz_layers, opts.triangles ?? null );
		let shell;
		if ( mesh.isSkinnedMesh ) {

			shell = new SkinnedMesh( geo, this.fuzzMaterial );
			shell.bind( mesh.skeleton, mesh.bindMatrix );

		} else {

			shell = new Mesh( geo, this.fuzzMaterial );

		}

		shell.frustumCulled = mesh.frustumCulled;
		shell.renderOrder = 1;
		shell.name = `${ mesh.name }_fuzz`;
		mesh.add( shell );
		this.#emit( 'fuzzAttached' );
		return shell;

	}

	// 3D strands growing out of `mesh` near the camera (core/hair3d.js).
	// Added as a child of `mesh`. opts.metersPerUV: coords = uv * metersPerUV.
	// opts.grid: G, the hair draws G x G strands at most.
	createHair( mesh, opts = {} ) {

		if ( ! this.impl.hair ) throw new Error( `infinitex: family "${ this.family }" has no 3D hair` );
		const spec = this.impl.hair( this.uniforms );
		this.hairSpec = spec;
		const hair = createHair3D( spec, { host: mesh, metersPerUV: opts.metersPerUV ?? 1, grid: opts.grid, segments: opts.segments ?? 16 } );
		mesh.add( hair.mesh );
		this.hair = hair;
		this.#emit( 'hairAttached' );
		return hair.mesh;

	}

	dispose() {

		this.material.dispose();
		this.hair?.mesh.material.dispose();
		this.hair?.shadow.material.dispose();
		this.fuzzMaterial?.dispose();

	}

	#emit( type ) {

		this.dispatchEvent( new CustomEvent( type, { detail: { family: this.family, ...this.state } } ) );

	}

}

export function createMaterial( preset, options ) {

	return new InfinitexMaterial( preset, options );

}

export const families = Object.fromEntries( Object.entries( FAMILIES ).map( ( [ k, v ] ) => [ k, v.defaults ] ) );
