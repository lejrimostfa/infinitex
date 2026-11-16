// The aquarium's life (demo/aquarium.js), all built by code (demo/sealife).
//   createLife( { scene, tank, params, sand, sun, water, hideUp, TW, TD } )
//   sand     the floor's preset: plants and feet stand on its dunes
//   hideUp   the list the air-side mirror skips: what lives under the level
//   returns  { life, flora }: lists of things with update( t ), once per frame
// ?nolife (nothing), ?noflora (no plants, corals, starfish), ?noshadow,
// ?flat (a flat floor).
//
// Event bus: none (driven by the page's frame loop).

import { createSchool } from '../sealife/fish.js';
import { createJellies } from '../sealife/jelly.js';
import { createCrab } from '../sealife/crab.js';
import { sandAt } from '../sealife/seabed.js';
import { createSeagrass } from '../sealife/grass.js';
import { createKelp } from '../sealife/kelp.js';
import { createAnemones } from '../sealife/anemone.js';
import { createCorals } from '../sealife/coral.js';
import { createBrainCorals } from '../sealife/brain.js';
import { createStarfish } from '../sealife/starfish.js';
import { sandFloor } from '../sealife/seafloor.js';

export function createLife( { scene, tank, params, sand, sun, water, hideUp, TW, TD } ) {

	// The fixed life of the floor, built by code (demo/sealife): seagrass
	// meadows, two kelps, anemones, three corals and two starfish, in the free
	// floor clear of the cubes and of the crab's lane (z = 0.31). All stand on
	// the displaced sand (seabed.js sandAt) and below the level. ?noflora.
	const flora = [];
	if ( ! params.has( 'nolife' ) && ! params.has( 'noflora' ) ) {

		const floor = sandAt( params.has( 'flat' ) ? null : { ...sand, dune: 1 }, TW, TD );
		const grass = createSeagrass( { floor, meadows: [
			{ x: - 0.46, z: - 0.18, r: 0.09, shoots: 36, h: [ 0.08, 0.13 ], w: [ 0.004, 0.006 ] },
			{ x: - 0.5, z: 0.12, r: 0.08, shoots: 26, h: [ 0.1, 0.16 ], w: [ 0.004, 0.006 ] },
			{ x: - 0.07, z: - 0.31, r: 0.09, shoots: 30, h: [ 0.08, 0.14 ], w: [ 0.004, 0.0065 ] },
			{ x: - 0.04, z: 0.02, r: 0.05, shoots: 14, h: [ 0.07, 0.12 ], w: [ 0.0035, 0.005 ] },
			{ x: 0.46, z: 0.3, r: 0.08, shoots: 24, h: [ 0.09, 0.15 ], w: [ 0.004, 0.006 ] },
		] } );
		tank.add( grass.mesh );
		const kelp = createKelp( { floor, spots: [ [ 0.5, - 0.3, 0.19 ], [ 0.16, - 0.33, 0.17 ] ] } ); // [ x, z, height of the stem ]: the leaves reach 10 cm over it and must stay under the level
		tank.add( kelp.group );
		const anemones = createAnemones( { floor, list: [
			{ x: - 0.2, z: 0.12, R: 0.022, H: 0.035, count: 130, column: '#a04a5c', base: '#e0508c', tip: '#fff0f6' },
			{ x: 0.33, z: 0.12, R: 0.016, H: 0.028, count: 84, column: '#3e5e2e', base: '#4caa58', tip: '#d070e8' },
			{ x: - 0.52, z: - 0.02, R: 0.028, H: 0.04, count: 150, column: '#a04018', base: '#f06a1c', tip: '#ffe0a0' },
		] } );
		tank.add( anemones.group );
		const corals = createCorals( { floor, list: [
			{ kind: 'branching', x: 0.5, z: 0.11, size: 0.1 },
			{ kind: 'fan', x: - 0.27, z: - 0.355, size: 0.14, ry: 0 },
		] } );
		const brains = createBrainCorals( { floor, list: [ { x: 0.26, z: - 0.005, R: 0.05 } ] } );
		const stars = createStarfish( { floor, list: [
			{ x: - 0.04, z: 0.19, Ra: 0.04, knobs: 1, color: '#e0a060', knobColor: '#3a1a10', groove: '#5a2a10' },
			{ x: 0.48, z: - 0.04, Ra: 0.048, knobs: 0, color: '#3a6ae0', groove: '#0c1a50' },
		] } );
		tank.add( corals.group, brains.group, stars.group );
		flora.push( grass, kelp, anemones, corals, brains, stars );
		hideUp.push( grass.mesh, kelp.group, anemones.group, corals.group, brains.group, stars.group );
		// Sharp sun shadows: the stage has a shadow map, but nothing in the tank
		// received it. The map now covers the tank only (2048 texels over 1.5 m:
		// 0.7 mm each, a quarter of the stage's 4096 map to fill), the
		// sand, the walls and the cubes take shadows, the cubes cast them too.
		// The map is drawn once per frame: each water mirror is another camera,
		// which would draw it again. ?noshadow.
		if ( ! params.has( 'noshadow' ) ) {

			const S = sun.shadow.camera;
			S.left = S.bottom = - 0.75; S.right = S.top = 0.75; S.near = 2.4; S.far = 4.4;
			S.updateProjectionMatrix();
			sun.shadow.mapSize.set( 2048, 2048 );
			for ( const o of tank.children ) if ( o.isMesh && o !== water && ! o.isInstancedMesh ) { o.receiveShadow = true; o.castShadow ||= o.geometry.type !== 'PlaneGeometry'; }
			sun.shadow.autoUpdate = false;
			flora.push( { update() { sun.shadow.needsUpdate = true; } } );

		}

	}

	// Life, built by code (demo/sealife): a school of fish that circles above
	// the low cubes, small silver fish milling around the driftwood post just
	// under the surface, one red fish on a slow loop by the front glass (under
	// the school, in front of the bronze cube), four jellyfish in the free
	// corners, a crab that walks along the front of the floor. ?nolife. The
	// fish and the crab are in the tank group, so the water's mirrors show them.
	const life = [];
	if ( ! params.has( 'nolife' ) ) {

		const school = createSchool( { count: 16, length: 0.045, loop: { centre: [ - 0.12, 0.25, 0.1 ], radii: [ 0.32, 0.025, 0.17 ] }, lanes: [ 0.045, 0.018 ] } );
		const silver = createSchool( { count: 64, length: 0.022, shape: 'silver', seed: 7, period: 15, arc: 0.6, lanes: [ 0.022, 0.012 ], size: [ 0.85, 1.1 ], bankG: 0.08, pec: [ 2.5, 0.3 ],
			loop: { centre: [ 0.3, 0.305, - 0.17 ], radii: [ 0.16, 0.006, 0.15 ] } } );
		const hero = createSchool( { count: 1, length: 0.1, shape: 'hero', seed: 11, period: 42, arc: 0, lanes: [ 0, 0 ], size: [ 1, 1 ], surge: 0.4, bankG: 0.1, pec: [ 1.3, 0.5 ],
			loop: { centre: [ - 0.02, 0.155, 0.3 ], half: 0.24, radius: 0.07, bob: 0.006 } } );
		tank.add( school.mesh, silver.mesh, hero.mesh );
		const jellies = createJellies( { spots: [ [ 0.5, 0.2, 0.0 ], [ - 0.5, 0.17, - 0.28 ], [ 0.05, 0.22, - 0.32 ], [ 0.47, 0.16, 0.3 ] ] } );
		scene.add( jellies.group );
		// The crab stands on the displaced sand: its height, on the CPU, by the
		// same formula as the floor's vertices (sealife/seafloor.js); ?flat: 0.
		const ground = params.has( 'flat' ) ? () => 0 : sandFloor( { ...sand, dune: 1 }, { width: TW, depth: TD } );
		const crab = createCrab( { size: 0.055, from: [ - 0.3, 0, 0.31 ], to: [ 0.22, 0, 0.31 ], ground } );
		tank.add( crab.group );
		life.push( school, silver, hero, jellies, crab );
		silver.mesh.castShadow = false; // 64 fish of 2 cm: their shadows are specks, and a pass of 160 k triangles
		hideUp.push( school.mesh, silver.mesh, hero.mesh, crab.group );

	}

	return { life, flora };

}
