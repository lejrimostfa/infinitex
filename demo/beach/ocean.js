// The beach's sea (demo/beach.js): the aquarium's water surface
// (core/watersurface.js) on an open sea, plus foam where the sand comes
// near the surface (beach/terrain.js).
//   near     a fine patch over the lagoon and the reef (1 m segments):
//            the swell moves its vertices
//   far      a ring of coarse quads out to the horizon, the near patch cut
//            out of it, so the two never overlap
//   foam     on the shore, a band that runs up and back with the swash;
//            on the reef crest, white water that pulses with the swell.
//            Broken by noise, so it reads as foam and not as a stripe
// Both meshes are returned for the page to put in its clipping group, and
// in its mirrors' hide lists (the surface reads the screen).
//
// Event bus: none (built once by the page).

import * as THREE from 'three/webgpu';
import { vec2, vec3, vec4, float, sin, mix, smoothstep, positionWorld } from 'three/tsl';
import { createWaterSurface } from '../../src/core/watersurface.js';
import { valueNoise, wrapCoord } from '../../src/core/hash.js';
import { ixTime } from '../../src/core/clock.js';
import { sandHeightNode, REEF } from './terrain.js';

const NEAR = { x: [ - 320, 320 ], z: [ - 40, 200 ] }; // the fine patch (m), on the far ring's 20 m lattice: a quad is wholly in or out, no gap at the seam

function foamed( m, W ) {

	const P = positionWorld;
	const xz = vec2( P.x, P.z );
	const depth = W.level.sub( sandHeightNode( xz ) ); // > 0 over sand under water
	const t = ixTime;
	const n1 = valueNoise( wrapCoord( xz.mul( 0.9 ).add( vec2( t.mul( 0.15 ), 0 ) ) ) );
	const n2 = valueNoise( wrapCoord( xz.mul( 3.7 ).sub( vec2( 0, t.mul( 0.3 ) ) ).add( 7.1 ) ) );
	const breakup = n1.mul( 0.6 ).add( n2.mul( 0.4 ) );
	// Swash: the line of foam runs up the sand and back, about every 7 s.
	const swash = sin( t.mul( 0.9 ).add( P.x.mul( 0.04 ) ) ).mul( 0.5 ).add( 0.5 );
	const shore = smoothstep( 0.12, 0.0, depth.sub( swash.mul( 0.1 ) ) ).mul( smoothstep( 0.25, 0.55, breakup.add( swash.mul( 0.2 ) ) ) );
	// Reef: the swell breaks where the crest is shallow.
	const swell = sin( t.mul( 0.55 ).sub( P.z.mul( 0.12 ) ).add( P.x.mul( 0.01 ) ) ).mul( 0.5 ).add( 0.5 );
	const reef = smoothstep( 0.7, 0.3, depth ).mul( swell.pow( 3 ) ).mul( smoothstep( 0.35, 0.7, breakup ) ).mul( smoothstep( REEF - 30, REEF - 10, P.z ) );
	const foam = shore.max( reef ).clamp( 0, 1 ).mul( 0.9 );
	m.colorNode = vec4( mix( m.colorNode.rgb, vec3( 0.93, 0.95, 0.94 ), foam ), 1 );
	return m;

}

// A grid over [ x0, x1 ] x [ z0, z1 ] at y = 0, triangles inside `hole`
// dropped.
export function grid( x0, x1, z0, z1, step, hole = null ) {

	const g = new THREE.PlaneGeometry( x1 - x0, z1 - z0, Math.round( ( x1 - x0 ) / step ), Math.round( ( z1 - z0 ) / step ) );
	g.rotateX( - Math.PI / 2 );
	g.translate( ( x0 + x1 ) / 2, 0, ( z0 + z1 ) / 2 );
	if ( hole ) {

		const P = g.attributes.position, I = g.index.array, keep = [];
		for ( let k = 0; k < I.length; k += 3 ) {

			const cx = ( P.getX( I[ k ] ) + P.getX( I[ k + 1 ] ) + P.getX( I[ k + 2 ] ) ) / 3;
			const cz = ( P.getZ( I[ k ] ) + P.getZ( I[ k + 1 ] ) + P.getZ( I[ k + 2 ] ) ) / 3;
			if ( cx > hole.x[ 0 ] && cx < hole.x[ 1 ] && cz > hole.z[ 0 ] && cz < hole.z[ 1 ] ) continue;
			keep.push( I[ k ], I[ k + 1 ], I[ k + 2 ] );

		}

		g.setIndex( keep );

	}

	return g;

}

export function createOcean( { sky, mirrors, W } ) {

	const near = new THREE.Mesh( grid( NEAR.x[ 0 ], NEAR.x[ 1 ], NEAR.z[ 0 ], NEAR.z[ 1 ], 1 ), foamed( createWaterSurface( sky, mirrors, W, { spacing: 1 } ), W ) );
	// The far ring: 20 m quads out to 3 km; the near patch is cut out.
	const R = 3000, S = 20;
	const far = new THREE.Mesh( grid( - R, R, - R, R, S, NEAR ), createWaterSurface( sky, mirrors, W, { spacing: S } ) );
	for ( const m of [ near, far ] ) {

		m.position.y = W.level.value;
		m.renderOrder = 10; // after the opaque scene: it reads the screen
		m.userData.noFocus = true;
		m.frustumCulled = false;

	}

	return { near, far };

}
