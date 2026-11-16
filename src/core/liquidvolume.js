// A liquid filling any closed shape: a glass, a bottle, a vat, a mesh.
//
//   const wine = createLiquidVolume( { cavity: innerGeometry, fill: 0.6, liquid: 'wine' } );
//   glassMesh.add( wine.object );             // follows the container
//   wine.addEventListener( 'levelChanged', ( e ) => ui.show( e.detail.volume_m3 ) );
//   wine.setFill( 0.3 );                       // CPU rebuild, about 2 ms for 10k triangles
//   wine.set( { ripple: 0.5 } );               // uniforms only
//
// What it sets up: the body (core/fillgeometry.js), the free surface with
// its meniscus rings (core/fillcap.js), refraction and absorption by depth
// (core/liquidshading.js), ripples faded with the footprint. For opaque or
// glowing liquids (molten metal, lava, mud, milk with a family look) pass
// `surface`: any material, e.g. createMaterial( { family: 'molten' } ).material;
// both meshes then carry uv in metres (cap: x, z; body: x + z, y).
//
// Event bus (EventTarget): volumeReady once, levelChanged after
// setLevel() or setFill(), paramsChanged after set(). detail: { liquid,
// level, fill, volume_m3, area_m2, chord_m }.
// Limits (docs/authoring.md): the level is horizontal in the container's
// local frame; caustics cast through the container, objects inside the
// liquid and a camera inside it are not handled here.

import { Group, Mesh, Vector2, Vector3, Color } from 'three';
import { uniform } from 'three/tsl';
import { prepareCavity, clipCavity, bodyGeometry, liquidMeasures, signedVolume } from './fillgeometry.js';
import { capGeometry, netArea } from './fillcap.js';
import { floorMap, addUV } from './fillmaps.js';
import { capillaryLength, meniscusHeight } from './meniscus.js';
import { liquidBodyMaterial, liquidCapMaterial } from './liquidshading.js';

// absorb: 1/m at 650, 550, 450 nm. Sources in docs/authoring.md.
export const LIQUIDS = {
	water: { ior: 1.333, absorb: [ 0.45, 0.07, 0.02 ], transmission: 1, roughness: 0.02, tension: 0.072, density: 998, contact_deg: 25, ripple: 0.25 },
	wine: { ior: 1.35, absorb: [ 230, 920, 690 ], transmission: 1, roughness: 0.02, tension: 0.05, density: 990, contact_deg: 20, ripple: 0.2 },
	oil: { ior: 1.467, absorb: [ 2, 4, 60 ], transmission: 1, roughness: 0.02, tension: 0.032, density: 911, contact_deg: 10, ripple: 0.08 },
	honey: { ior: 1.49, absorb: [ 6, 25, 120 ], transmission: 1, roughness: 0.01, tension: 0.05, density: 1420, contact_deg: 30, ripple: 0 },
	juice: { ior: 1.35, absorb: [ 1, 10, 60 ], transmission: 0.85, roughness: 0.03, tension: 0.06, density: 1040, contact_deg: 25, ripple: 0.2, tint: '#fff3dc' },
	milk: { ior: 1.35, absorb: [ 0, 0, 0 ], transmission: 0, roughness: 0.08, tension: 0.045, density: 1030, contact_deg: 30, ripple: 0.15, tint: '#f3f0e8' },
};
const BASE = { tint: '#ffffff', glow: '#000000', ripple_mm: 40, feature_mm: 3, speed: 1, angle_deg: 0, seed: 1 };

export class LiquidVolume extends EventTarget {

	constructor( { cavity, level = null, fill = 0.7, liquid = 'water', inset = 3e-4, surface = null, ...over } ) {

		super();
		if ( ! cavity?.isBufferGeometry ) throw new Error( 'infinitex createLiquidVolume: `cavity` must be a closed BufferGeometry (the inside of the container)' );
		const base = typeof liquid === 'string' ? LIQUIDS[ liquid ] : liquid;
		if ( ! base ) throw new Error( `infinitex createLiquidVolume: unknown liquid "${ liquid }", use one of ${ Object.keys( LIQUIDS ).join( ', ' ) } or an object` );
		this.liquid = typeof liquid === 'string' ? liquid : 'custom';
		this.params = { ...BASE, ...base, ...over };
		this.cavity = prepareCavity( cavity, inset );
		this.cavity.computeBoundingBox();
		const bb = this.cavity.boundingBox;
		this.yMin = bb.min.y;
		this.yMax = bb.max.y;
		const p = this.params;
		const lc = capillaryLength( p.tension, p.density );
		this.U = {
			ior: uniform( 1.33 ), absorb: uniform( new Vector3() ), tint: uniform( new Color() ), glow: uniform( new Color() ), transmission: uniform( 1 ),
			roughness: uniform( 0.02 ), ripple: uniform( 0 ), sizeM: uniform( 0.04 ), featureM: uniform( 0.003 ), speed: uniform( 1 ), angle: uniform( 0 ), seed: uniform( 1 ),
			h0: uniform( meniscusHeight( { tension: p.tension, density: p.density, contactDeg: p.contact_deg } ) ), lc: uniform( lc ), ringMax: uniform( lc * 3.5 ),
			chord: uniform( 0.05 ), level: uniform( 0 ),
		};
		this.rings = [ 0.25, 0.6, 1.2, 2.2, 3.5 ].map( ( k ) => k * lc );
		this.floor = { min: uniform( new Vector2( bb.min.x, bb.min.z ) ), size: uniform( new Vector2( bb.max.x - bb.min.x, bb.max.z - bb.min.z ) ), map: null };
		this.floor.map = floorMap( [], this.floor.min.value, this.floor.size.value, 0 );
		this.surface = surface;
		this.object = new Group();
		this.object.name = 'ix_liquid';
		this.body = new Mesh( undefined, surface ?? liquidBodyMaterial( this.U ) );
		this.cap = new Mesh( undefined, surface ?? liquidCapMaterial( this.U, this.floor ) );
		this.object.add( this.body, this.cap );
		this.#apply();
		if ( level !== null ) this.setLevel( level, true ); else this.setFill( fill, true );
		queueMicrotask( () => this.#emit( 'volumeReady' ) );

	}

	// Volume under a flat level, no cap built. Divergence theorem: the
	// closed surface is the body plus a cap facing up, whose share is
	// level * (net area) / 3.
	volumeAt( level ) {

		const { tris, loops, level: y } = clipCavity( this.cavity, level );
		return signedVolume( tris ) + y * netArea( loops ) / 3;

	}

	setFill( f, quiet = false ) {

		const full = this.volumeAt( this.yMax - 1e-6 );
		let lo = this.yMin, hi = this.yMax;
		for ( let i = 0; i < 26; i ++ ) { const m = ( lo + hi ) / 2; if ( this.volumeAt( m ) < f * full ) lo = m; else hi = m; }
		this.setLevel( ( lo + hi ) / 2, quiet );

	}

	setLevel( level, quiet = false ) {

		const y = Math.min( this.yMax - 1e-5, Math.max( this.yMin + 1e-5, level ) );
		const h0 = this.U.h0.value;
		const { tris, loops } = clipCavity( this.cavity, Math.min( this.yMax - 1e-5, y + h0 ) );
		const cap = capGeometry( loops, y, this.rings );
		const body = bodyGeometry( tris );
		if ( this.surface ) { addUV( body, false ); addUV( cap.geometry, true ); }
		this.body.geometry?.dispose();
		this.cap.geometry?.dispose();
		this.body.geometry = body;
		this.cap.geometry = cap.geometry;
		// Volume at the still level: the body is cut at the contact line
		// (level + h0), so body and flat cap do not close; volumeAt() does.
		const m = liquidMeasures( tris, cap.tris );
		this.level = y;
		this.volume = this.volumeAt( y );
		this.area = m.area;
		this.fill = this.volume / Math.max( 1e-12, this.volumeAt( this.yMax - 1e-6 ) );
		this.U.level.value = y;
		this.U.chord.value = 4 * this.volume / Math.max( 1e-9, m.area );
		const old = this.floor.map;
		this.floor.map = floorMap( tris, this.floor.min.value, this.floor.size.value, y );
		old.image.data = this.floor.map.image.data; // the material keeps its texture object
		old.needsUpdate = true;
		this.floor.map = old;
		if ( ! quiet ) this.#emit( 'levelChanged' );

	}

	set( partial ) {

		Object.assign( this.params, partial );
		this.#apply();
		this.#emit( 'paramsChanged' );

	}

	#apply() {

		const p = this.params, U = this.U;
		U.ior.value = p.ior;
		U.absorb.value.set( ...p.absorb );
		U.tint.value.set( p.tint );
		U.glow.value.set( p.glow );
		U.transmission.value = p.transmission;
		U.roughness.value = p.roughness;
		U.ripple.value = p.ripple;
		U.sizeM.value = p.ripple_mm * 1e-3;
		U.featureM.value = p.feature_mm * 1e-3;
		U.speed.value = p.speed;
		U.angle.value = p.angle_deg * Math.PI / 180;
		U.seed.value = p.seed;

	}

	dispose() {

		this.body.geometry?.dispose();
		this.cap.geometry?.dispose();
		if ( ! this.surface ) { this.body.material.dispose(); this.cap.material.dispose(); }
		this.floor.map.dispose();

	}

	#emit( type ) {

		this.dispatchEvent( new CustomEvent( type, { detail: { liquid: this.liquid, level: this.level, fill: this.fill, volume_m3: this.volume, area_m2: this.area, chord_m: this.U.chord.value } } ) );

	}

}

export function createLiquidVolume( options ) {

	return new LiquidVolume( options );

}
