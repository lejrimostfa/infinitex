// Surface states, second layer: what lies on a matter or has happened to
// it, over the family's own result and after applySurface (wet, gloss, wear).
//   dusty    settled dust: haze, specks, lint                (states_soil.js)
//   muddy    splashes of mud, cracked crust, wet halo         (states_soil.js)
//   burnt    scorch halos, charred rings, holes               (states_burnt.js)
//   rusty    rust spots, blistered paint, run-off streaks     (states_rust.js)
//   frosted  hoar on the tops, ice plates and needles         (states_frost.js)
//   bloody   soaked stains with a tide line, beaded drops     (states_drops.js)
//   sweaty   beaded droplets and a thin film                  (states_drops.js)
//   greasy   dark saturated stains, wicked along the threads (states_stain.js)
// The keys are adjectives: plastic, organic and ceramic already use
// `dust` and `frost` for their own matter.
//
// A family opts in with three lines in params.js (STATES_DEFAULTS in its
// defaults, `states: createStatesUniforms()`, applyStatesPreset) and one
// call in its shader, right after applySurface:
//   applyStates( nodes, u.states, { cavity, flatNormal: base, coords: p, fp } );
// Each state compiles only when the preset gives it a non-zero amount (the
// amount is read when the graph is built; set() can then tune it, but a
// state at 0 at build time stays out of the graph).

import { uniform, float, mix, tangentView, bitangentView, tangentWorld, bitangentWorld, vec2 } from 'three/tsl';
import { Color } from 'three';
import { perturbNormal } from './lod.js';
import { buildDust, buildMud } from './states_soil.js';
import { buildBurnt } from './states_burnt.js';
import { buildRustState } from './states_rust.js';
import { buildFrost } from './states_frost.js';
import { buildBlood, buildSweat } from './states_drops.js';
import { buildGrease } from './states_stain.js';

export const STATES_DEFAULTS = {
	dusty: 0, dusty_color: '#8f877c', dusty_um: 40, // mean mote size
	muddy: 0, muddy_color: '#5b4530', muddy_mm: 30, // splash spacing
	burnt: 0, burnt_mm: 60, // spacing of the burn marks
	rusty: 0, rusty_color: '#8a3d12', rusty_mm: 25, // spacing of the rust spots
	frosted: 0, frosted_color: '#eef4fa', frosted_um: 250, // ice crystal size
	bloody: 0, bloody_color: '#5e0b0b', bloody_mm: 10, bloody_age: 0.3, // 0 fresh, 1 dried brown
	sweaty: 0, sweaty_mm: 1.2, // mean droplet diameter
	greasy: 0, greasy_color: '#3b2c18', greasy_mm: 35, // stain spacing
};

const KEYS = [ 'dusty', 'muddy', 'burnt', 'rusty', 'frosted', 'bloody', 'sweaty', 'greasy' ];
const COLORS = { dusty_color: 'dustColor', muddy_color: 'mudColor', rusty_color: 'rustColor', frosted_color: 'frostColor', bloody_color: 'bloodColor', greasy_color: 'greaseColor' };
const SIZES = { dusty_um: [ 'dustM', 1e-6 ], muddy_mm: [ 'mudM', 1e-3 ], burnt_mm: [ 'burntM', 1e-3 ], rusty_mm: [ 'rustM', 1e-3 ],
	frosted_um: [ 'frostM', 1e-6 ], bloody_mm: [ 'bloodM', 1e-3 ], sweaty_mm: [ 'sweatM', 1e-3 ], greasy_mm: [ 'greaseM', 1e-3 ] };

export function createStatesUniforms() {

	const s = { seed: uniform( 1 ), bloodAge: uniform( 0.3 ) };
	for ( const k of KEYS ) s[ k ] = uniform( 0 );
	for ( const k in COLORS ) s[ COLORS[ k ] ] = uniform( new Color() );
	for ( const k in SIZES ) s[ SIZES[ k ][ 0 ] ] = uniform( 1e-3 );
	return s;

}

export function applyStatesPreset( s, p ) {

	s.seed.value = p.seed ?? 1;
	s.bloodAge.value = p.bloody_age ?? 0.3;
	for ( const k of KEYS ) s[ k ].value = p[ k ] ?? 0;
	for ( const k in COLORS ) s[ COLORS[ k ] ].value.set( p[ k ] ?? STATES_DEFAULTS[ k ] );
	for ( const k in SIZES ) s[ SIZES[ k ][ 0 ] ].value = ( p[ k ] ?? STATES_DEFAULTS[ k ] ) * SIZES[ k ][ 1 ];

}

const BUILDERS = { dusty: buildDust, muddy: buildMud, burnt: buildBurnt, rusty: buildRustState, frosted: buildFrost, bloody: buildBlood, sweaty: buildSweat, greasy: buildGrease };

// Lays one covering layer L over the nodes:
//   cov    0..1, where the layer hides the matter
//   color, rough   what the layer shows there (color may be left out
//          when the state already wrote nodes.colorNode itself)
//   slope  its own relief (dh/du, dh/dv, already weighted by cov)
//   hide   how much of the matter's relief the layer buries (0..1)
//   sheen  how much fibre sheen survives under it (default 0)
// A layer kills metalness and the clear coat where it lies.
export function lay( nodes, ctx, L ) {

	const c = L.cov;
	if ( L.color ) nodes.colorNode = mix( nodes.colorNode, L.color, c );
	nodes.roughnessNode = mix( nodes.roughnessNode, L.rough, c );
	if ( nodes.metalnessNode ) nodes.metalnessNode = nodes.metalnessNode.mul( c.oneMinus() );
	if ( nodes.clearcoatNode ) nodes.clearcoatNode = nodes.clearcoatNode.mul( c.oneMinus() );
	if ( nodes.sheenNode ) nodes.sheenNode = nodes.sheenNode.mul( mix( float( 1 ), float( L.sheen ?? 0 ), c ) );
	bend( nodes, ctx, L.slope, c.mul( L.hide ?? 0 ) );
	return nodes;

}

// Adds a slope to the current normal; `hide` first pulls it toward the
// flat normal (a layer that buries the relief beneath).
export function bend( nodes, ctx, slope, hide = float( 0 ) ) {

	const n = mix( nodes.normalNode, ctx.flatNormal, hide ).normalize();
	nodes.normalNode = perturbNormal( n, slope, tangentView, bitangentView );
	return nodes;

}

// nodes: the family's nodes after applySurface. cavity: 0 on the tops,
// 1 in the grooves. coords, fp: the family's surface meters and footprint.
export function applyStates( nodes, s, { cavity, flatNormal, coords, fp } ) {

	// World down in surface coordinates: runs and drips follow it.
	const down = vec2( tangentWorld.y, bitangentWorld.y ).negate();
	const ctx = { p: coords, fp, cavity: cavity ?? float( 0 ), flatNormal, down, s };
	for ( const k of KEYS ) if ( s[ k ].value > 0 ) BUILDERS[ k ]( nodes, ctx );
	return nodes;

}
