// Parts shared by the toys built in code (helicopter.js, submarine.js):
// shapes ready for an Infinitex matter (UVs in meters, tangents), and the
// toy plastics of the wall (the plastic family). Sizes in meters.
// Event bus: none, building blocks.

import * as THREE from 'three/webgpu';
import { createMaterial } from '../../src/index.js';
import { uvToMeters } from '../scene.js';

// Geometry ready for an Infinitex matter: UVs in meters, tangents.
export function ready( g, metersU, metersV ) {

	uvToMeters( g, metersU, metersV );
	g.computeTangents();
	return g;

}

export const ellipsoid = ( a, b, c ) => ready( new THREE.SphereGeometry( 1, 32, 22 ).scale( a, b, c ), 2 * Math.PI * Math.max( a, c ), Math.PI * b );
export const tube = ( r0, r1, len, seg = 16 ) => ready( new THREE.CylinderGeometry( r1, r0, len, seg, 1 ), 2 * Math.PI * Math.max( r0, r1 ), len );
export const blade = ( len, wide, thick ) => ready( new THREE.BoxGeometry( wide, thick, len ).translate( 0, 0, len / 2 ), len, wide );

// Glossy moulded toy plastic of a colour (the wall's "glossy plastic").
// extra: preset overrides (underwater: 1 for a toy in the aquarium).
export const glossy = ( color, seed, extra = {} ) => createMaterial( { family: 'plastic', intent: 'glossy ABS toy', color, roughness: 0.08, orange_peel: 0.5, scratches: 0.4, swirl: 0.4, prints: 0.3, dust: 0.3, seed, ...extra } );

// Textured black moulded plastic (the wall's "moulded plastic").
export const moulded = ( seed, extra = {} ) => createMaterial( { family: 'plastic', intent: 'textured black ABS', color: '#202124', grain: 1, grain_um: 200, flow: 0.4, parting: 1, ejectors: 0, roughness: 0.55, seed, ...extra } );
