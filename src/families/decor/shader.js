// Decor family: TSL node graph. The mode (params.js) picks the matter:
//   oil (oil.js)           a whole surface: paint over its own canvas
//   embroidery (embroidery.js), screenprint (screenprint.js), tattoo
//   (print.js)             a layer over a woven ground
// The ground is the woven family itself (woven/shader.js), built from
// u.ground. A layer returns cover (where it hides the ground), its colour,
// slope, roughness, sheen and cavity, and optionally:
//   conform      how much of the weave relief and shading shows through
//   groundShade  a shadow it casts on the ground
//   tint         a dye that multiplies the ground colour (prints)
// The layer gets the shared surface states before it is laid on the ground
// (the ground got them from its own build).

import { uv, vec3, float, mix, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { applySurface } from '../../core/surface.js';
import { buildWovenNodes } from '../woven/shader.js';
import { buildOil } from './oil.js';
import { buildEmbroidery } from './embroidery.js';
import { buildScreenprint } from './screenprint.js';
import { buildPrint } from './print.js';

const LAYERS = { embroidery: buildEmbroidery, screenprint: buildScreenprint, tattoo: buildPrint };

export function buildDecorNodes( u, opts = {} ) {

	if ( u.mode === 'oil' ) return buildOilNodes( u, opts );
	const build = LAYERS[ u.mode ];
	if ( ! build ) throw new Error( `infinitex decor: unknown mode "${ u.mode }"` );

	const G = buildWovenNodes( u.ground, { coords: opts.coords, baseNormal: opts.baseNormal } );
	delete G.debug;
	// The woven graph names its own vars (ix_*): ours are dx_*.
	const p = ( opts.coords ?? uv() ).toVar( 'dx_coords' );
	const fp = footprint( p ).toVar( 'dx_fp' );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'dx_base_normal' );
	const L = build( p, fp, u );

	let groundColor = G.colorNode;
	if ( L.tint ) groundColor = groundColor.mul( L.tint );
	if ( L.groundShade ) groundColor = groundColor.mul( L.groundShade );
	if ( L.tint || L.cover.value === 0 ) {

		// A dye only: the ground keeps its own relief and lobes.
		G.colorNode = groundColor;
		G.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
		return G;

	}

	let layerNormal = perturbNormal( base, L.slope, tangentView, bitangentView );
	let layerColor = L.color;
	if ( L.conform ) {

		// Thin ink drapes over the threads: their slope and shading show.
		layerNormal = mix( layerNormal, G.normalNode, L.conform ).normalize();
		const lum = ( c ) => c.dot( vec3( 0.3, 0.55, 0.15 ) );
		layerColor = layerColor.mul( mix( float( 1 ), lum( G.colorNode ).div( lum( u.ground.warpColor ).max( 0.05 ) ).clamp( 0.3, 1.2 ), L.conform ) );

	}

	const layer = {
		colorNode: layerColor, normalNode: layerNormal.toVar( 'dx_normal' ),
		roughnessNode: specularAA( composeRoughness( L.rough, L.s2 ), layerNormal ),
	};
	applySurface( layer, u.surface, { cavity: L.cavity, flatNormal: base, porosity: 0.4 } );
	const c = L.cover;
	const nodes = {
		colorNode: mix( groundColor, layer.colorNode, c ),
		normalNode: mix( G.normalNode, layer.normalNode, c ).normalize(),
		roughnessNode: mix( G.roughnessNode, layer.roughnessNode, c ),
		metalnessNode: float( 0 ),
		sheenNode: mix( G.sheenNode ?? vec3( 0 ), L.sheen ?? vec3( 0 ), c ), sheenRoughnessNode: float( 0.45 ),
		clearcoatNode: mix( G.clearcoatNode ?? float( 0 ), layer.clearcoatNode, c ),
		clearcoatRoughnessNode: mix( G.clearcoatRoughnessNode ?? float( 0.2 ), layer.clearcoatRoughnessNode, c ),
	};
	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: c };
	return nodes;

}

function buildOilNodes( u, opts ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const O = buildOil( p, fp, u );
	const normalNode = perturbNormal( base, O.slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( O.rough, O.s2 ), normalNode );
	const nodes = { colorNode: O.color, normalNode, roughnessNode, metalnessNode: float( 0 ) };
	applySurface( nodes, u.surface, { cavity: O.cavity, flatNormal: base, porosity: float( 0.3 ) } );
	nodes.clearcoatNode = nodes.clearcoatNode.max( O.coat );
	nodes.clearcoatRoughnessNode = O.coatRough;
	nodes.debug = { fp, w1: float( 1 ), w2: float( 1 ), w3: float( 1 ), covered: float( 1 ) };
	return nodes;

}
