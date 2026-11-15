// Surface states, a layer any family puts over its result:
//   wetness  water darkens porous matter, fills fine relief, then pools in
//            the cavities as a mirror-smooth film
//   gloss    a varnish or wax coat (clear coat lobe)
//   wear     raised parts polish and lighten, cavities collect dirt
// The family hands in its own cavity signal (0 on the tops, 1 in the
// deepest grooves), so the same layer works for knit, leather, wood...
//
// Physics kept simple and cheap: wet albedo follows the well-known
// darkening of porous media (about 0.55 x when soaked), roughness and
// relief drop under the film, puddles need both wetness and a cavity.

import { uniform, float, mix, smoothstep, vec3 } from 'three/tsl';
import { Color } from 'three';

export const SURFACE_DEFAULTS = {
	wetness: 0, // 0 dry, 1 soaked
	gloss: 0, // 0 bare, 1 thick varnish
	wear: 0, // 0 new, 1 old
	wear_color: '#ffffff', // tint of polished tops (multiplies the albedo)
};

export function createSurfaceUniforms() {

	return { wetness: uniform( 0 ), gloss: uniform( 0 ), wear: uniform( 0 ), wearColor: uniform( new Color( 1, 1, 1 ) ) };

}

export function applySurfacePreset( s, p ) {

	s.wetness.value = p.wetness;
	s.gloss.value = p.gloss;
	s.wear.value = p.wear;
	s.wearColor.value.set( p.wear_color );

}

// nodes: { colorNode, roughnessNode, normalNode } of a family (view space
// normal). flatNormal: the normal without fine relief. cavity: 0..1.
// porosity: how much the material drinks (wool 1, varnished wood 0.2).
export function applySurface( nodes, s, { cavity, flatNormal, porosity = 1 } ) {

	const wet = s.wetness.mul( porosity );
	const pool = smoothstep( 0.55, 0.9, s.wetness ).mul( smoothstep( 0.35, 0.75, cavity ) );
	const film = s.wetness.max( pool );

	// Wear: tops polish, cavities darken with dirt.
	const top = float( 1 ).sub( cavity );
	const polish = s.wear.mul( top.mul( top ) );
	const dirt = s.wear.mul( cavity ).mul( 0.35 );
	let color = nodes.colorNode.mul( mix( vec3( 1 ), s.wearColor.mul( 1.15 ), polish.mul( 0.5 ) ) ).mul( float( 1 ).sub( dirt ) );
	color = color.mul( mix( float( 1 ), float( 0.55 ), wet ) );
	// A varnish or wax fills the pores (deeper, more saturated colour) and
	// the micro relief (smoother base). The coat itself reflects about 4 %.
	color = mix( color, color.mul( color ).mul( 1.6 ).min( color ), s.gloss.mul( 0.5 ) );

	let rough = nodes.roughnessNode.mul( float( 1 ).sub( polish.mul( 0.2 ) ) );
	rough = mix( rough, float( 0.12 ), film.mul( 0.8 ) );
	rough = mix( rough, float( 0.03 ), pool );
	rough = mix( rough, rough.min( 0.3 ), s.gloss.mul( 0.6 ) );

	const normal = mix( nodes.normalNode, flatNormal, film.mul( 0.45 ).max( pool ).max( s.gloss.mul( 0.3 ) ) ).normalize();

	// The cavity is also an occlusion: the floor of a pore or a crack sees
	// little sky, so its ambient light and its reflection go dark (three
	// applies aoNode to the indirect diffuse and as specular occlusion).
	// A film of water fills it: less occlusion where it pools.
	const ao = float( 1 ).sub( cavity.mul( 0.5 ).mul( float( 1 ).sub( pool ) ) );
	nodes.aoNode = nodes.aoNode ? nodes.aoNode.mul( ao ) : ao;

	nodes.colorNode = color;
	nodes.roughnessNode = rough;
	nodes.normalNode = normal;
	nodes.clearcoatNode = s.gloss.max( pool );
	nodes.clearcoatRoughnessNode = mix( float( 0.25 ), float( 0.03 ), s.gloss.max( pool ) );
	return nodes;

}
