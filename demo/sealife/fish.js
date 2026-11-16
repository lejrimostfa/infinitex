// Fish built by code: one InstancedMesh per school, in the Infinitex
// fish-scale matter. Three looks from one code path, by `shape`:
//   'school'  the main school, blue-grey back, a dark lateral stripe
//   'silver'  small slender fish, mirror sides, for the far school
//   'hero'    a deep-bodied red and orange fish, spiny dorsal, alone
//   body     fishshape.js (outline, fins in fishfins.js, eyes)
//   look     fishlook.js (scales behind the gill line, countershading,
//            rayed fins, eyes, the swim wave in the vertex stage)
//   motion   fishswim.js (a loop, lanes that wander, surges, separation,
//            bank and bend in turns), a function of time only
// createSchool( { count, length, loop, period, shape, look, ... } ):
//   loop     { centre, radii } an ellipse, or { centre, half, radius,
//            bob } a stadium; given by the page, clear of its objects
//   arc      share of the loop the school spreads over (0..1)
//   lanes    [ across, up ] half sizes of its cross-section (m)
// Returns { mesh, material, update( t ) }.
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { fishGeometry, FISH_SHAPES } from './fishshape.js';
import { fishMaterial } from './fishlook.js';
import { createSwimmers } from './fishswim.js';

export function createSchool( { count = 14, length = 0.06, loop, period = 26, shape = 'school', look = shape, preset = {}, seed = 3,
	arc = 0.16, lanes = [ 0.045, 0.025 ], size = [ 0.8, 1.2 ], surge = 0.6, bankG = 0.12, pec = [ 1.4, 0.35 ] } ) {

	let k = seed * 7919 + 13;
	const rnd = () => ( k = ( k * 16807 ) % 2147483647 ) / 2147483647;
	const sh = typeof shape === 'string' ? FISH_SHAPES[ shape ] : shape;
	const geometry = fishGeometry( length, sh );
	const motion = new THREE.InstancedInterleavedBuffer( new Float32Array( count * 8 ), 8 ).setUsage( THREE.DynamicDrawUsage );
	const ix = fishMaterial( { L: length, sh, look, motion, pecAmp: pec[ 1 ], preset } );
	const mesh = new THREE.InstancedMesh( geometry, ix.material, count );
	mesh.frustumCulled = false; // the instances move; the tank is always in view anyway
	mesh.castShadow = true;
	const update = createSwimmers( mesh, motion, { count, length, size, path: loop, period, arc, lanes, surge, bankG, pec: pec[ 0 ] }, rnd );
	update( 0 );

	return { mesh, material: ix, update };

}
