// Liquid family: TSL node graph. The mode (params.js) picks the matter,
// one file per matter:
//   water (water.js), rain (rain.js), runoff (runoff.js), oil (oil.js),
//   soap (soap.js), foam (foam.js)
// Each returns colour, a surface slope, a cavity signal and a roughness,
// and optionally: spec (an RGB reflectance at normal incidence, the
// colour of a thin film) and transmission (soap: the film is seen
// through). Everything moves with ixTime (core/clock.js) times `speed`.
// Water reflects 2 % face on: ior 1.33 sets the Fresnel of the material.
// Optional `wet`: where the surface is liquid and mirrors the sky (sky.js).

import { uv, float, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildWater } from './water.js';
import { buildRain } from './rain.js';
import { buildRunoff } from './runoff.js';
import { buildOil } from './oil.js';
import { buildSoap } from './soap.js';
import { buildFoam } from './foam.js';
import { skyReflection } from './sky.js';

const MODES = { water: buildWater, rain: buildRain, runoff: buildRunoff, oil: buildOil, soap: buildSoap, foam: buildFoam };
const F0_WATER = 0.02; // ((1.33 - 1) / (1.33 + 1))^2

export function buildLiquidNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const build = MODES[ u.mode ];
	if ( ! build ) throw new Error( `infinitex liquid: unknown mode "${ u.mode }"` );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const W = build( p, fp, u, base );

	const normalNode = perturbNormal( base, W.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( W.rough, W.s2 ), normalNode );
	const nodes = { colorNode: W.color, normalNode, roughnessNode, metalnessNode: float( 0 ), iorNode: float( 1.33 ) };
	applySurface( nodes, u.surface, { cavity: W.cavity, flatNormal: base, porosity: float( 0 ) } );
	// The overcast sky it reflects, where the surface is liquid (W.wet).
	const F0 = W.spec ?? float( F0_WATER );
	nodes.emissiveNode = skyReflection( normalNode, base, F0, u.sky ).mul( W.wet ?? float( 1 ) ).mul( float( 1 ).sub( W.rough.mul( 1.5 ) ).clamp( 0, 1 ) );
	if ( W.spec ) {

		// A thin film: its reflectance replaces the 2 % of bare water.
		nodes.specularColorNode = W.spec.div( F0_WATER );
		nodes.specularIntensityNode = float( 1 );

	}

	if ( W.transmission ) {

		// A film a few hundred nm thick: no refraction offset, no tint.
		nodes.transmissionNode = W.transmission;
		nodes.thicknessNode = float( 0 );

	}

	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
