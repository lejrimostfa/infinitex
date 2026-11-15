// A mannequin wearing a knitted sweater, built in code (no asset, no cost).
// The sweater is three skinned tubes (torso, two sleeves) on a 12-bone
// skeleton. UVs are in surface meters with the wales (v) running along each
// tube, as a knitter would make it. Seams sit at the back and under the arms.
// animate( t ) poses the skeleton from a time in seconds: deterministic, so
// the film renderer can step it frame by frame.

import * as THREE from 'three/webgpu';
import { tube, ellipsePerimeter, sstep } from './tube.js';

// Rest pose, world positions. Arms hang 12 degrees out from vertical.
const ARM = 12 * Math.PI / 180;
const BONES = [
	[ 'root', - 1, [ 0, 0, 0 ] ],
	[ 'hips', 0, [ 0, 0.95, 0 ] ],
	[ 'spine', 1, [ 0, 1.12, 0 ] ],
	[ 'chest', 2, [ 0, 1.30, 0 ] ],
	[ 'neck', 3, [ 0, 1.47, 0 ] ],
	[ 'head', 4, [ 0, 1.56, 0 ] ],
];
for ( const [ side, sx ] of [ [ 'L', 1 ], [ 'R', - 1 ] ] ) {

	const sh = [ sx * 0.19, 1.40, 0 ];
	const d = [ sx * Math.sin( ARM ), - Math.cos( ARM ), 0 ];
	const el = sh.map( ( x, k ) => x + d[ k ] * 0.30 );
	const wr = el.map( ( x, k ) => x + d[ k ] * 0.26 );
	BONES.push( [ `upperArm${ side }`, 3, sh ], [ `forearm${ side }`, BONES.length, el ], [ `hand${ side }`, BONES.length + 1, wr ] );

}

export function createMannequin( knitMaterial ) {

	const bones = [];
	for ( const [ name, parent, p ] of BONES ) {

		const b = new THREE.Bone();
		b.name = name;
		const pp = parent >= 0 ? BONES[ parent ][ 2 ] : [ 0, 0, 0 ];
		b.position.set( p[ 0 ] - pp[ 0 ], p[ 1 ] - pp[ 1 ], p[ 2 ] - pp[ 2 ] );
		if ( parent >= 0 ) bones[ parent ].add( b );
		bones.push( b );

	}

	const B = Object.fromEntries( bones.map( ( b, i ) => [ b.name, i ] ) );
	const group = new THREE.Group();

	// Torso: half-width a (x), half-depth b (z) along the height.
	const prof = new THREE.CatmullRomCurve3( [
		[ 0.150, 0.84, 0.104 ], [ 0.146, 1.00, 0.100 ], [ 0.162, 1.20, 0.114 ], [ 0.182, 1.34, 0.110 ],
		[ 0.172, 1.41, 0.098 ], [ 0.105, 1.458, 0.074 ], [ 0.062, 1.478, 0.058 ],
	].map( ( q ) => new THREE.Vector3( ...q ) ) );
	const X = new THREE.Vector3( 1, 0, 0 ), Z = new THREE.Vector3( 0, 0, 1 );
	const torsoRing = ( s ) => {

		const q = prof.getPoint( s );
		return { c: new THREE.Vector3( 0, q.y, 0.004 * Math.sin( Math.PI * s ) ), a: q.x, b: q.z, e1: X, e2: Z };

	};

	const torsoW = ( s ) => {

		const y = torsoRing( s ).c.y;
		const up = sstep( 1.05, 1.22, y ), hi = sstep( 1.22, 1.36, y );
		return [ [ B.hips, 1 - up ], [ B.spine, up * ( 1 - hi ) ], [ B.chest, hi ] ];

	};

	const torso = tube( torsoRing, torsoW, 120, 240, ellipsePerimeter( 0.155, 0.105 ) );

	const parts = [ torso ];
	for ( const [ side, sx ] of [ [ 'L', 1 ], [ 'R', - 1 ] ] ) {

		const sh = new THREE.Vector3( ...BONES[ B[ `upperArm${ side }` ] ][ 2 ] );
		const d = new THREE.Vector3( sx * Math.sin( ARM ), - Math.cos( ARM ), 0 );
		const out = new THREE.Vector3().crossVectors( Z, d ).multiplyScalar( - sx ).normalize(); // away from the body
		const start = sh.clone().addScaledVector( d, - 0.05 ).addScaledVector( out, - 0.035 );
		const len = 0.30 + 0.26 + 0.04;
		const ring = ( s ) => {

			const r = 0.064 - 0.014 * sstep( 0, 0.55, s ) - 0.006 * sstep( 0.55, 1, s ) + 0.004 * sstep( 0.94, 1, s );
			const c = start.clone().addScaledVector( d, s * len );
			// Seam under the arm (toward the body): angle 0 is along -e2.
			return { c, a: r, b: r * 0.94, e1: Z, e2: out };

		};

		const w = ( s ) => {

			const k = sstep( 0.50, 0.62, s );
			return [ [ B[ `upperArm${ side }` ], 1 - k ], [ B[ `forearm${ side }` ], k ] ];

		};

		parts.push( tube( ring, w, 120, 120, 2 * Math.PI * 0.052 ) );

	}

	const skeleton = new THREE.Skeleton( bones );
	const meshes = parts.map( ( g, i ) => {

		const m = new THREE.SkinnedMesh( g, knitMaterial );
		m.name = [ 'torso', 'sleeveL', 'sleeveR' ][ i ];
		if ( i === 0 ) m.add( bones[ 0 ] );
		m.bind( skeleton );
		m.frustumCulled = false;
		group.add( m );
		return m;

	} );

	// Mannequin body: plain parts parented to the bones.
	const skin = new THREE.MeshStandardMaterial( { color: 0xb9b4ad, roughness: 0.55 } );
	const dark = new THREE.MeshStandardMaterial( { color: 0x2b2d33, roughness: 0.8 } );
	const add = ( bone, geo, mat, p, s = [ 1, 1, 1 ], r = [ 0, 0, 0 ] ) => {

		const m = new THREE.Mesh( geo, mat );
		m.position.set( ...p );
		m.scale.set( ...s );
		m.rotation.set( ...r );
		bones[ B[ bone ] ].add( m );
		return m;

	};

	const sphere = new THREE.SphereGeometry( 1, 48, 32 );
	add( 'head', sphere, skin, [ 0, 0.09, 0.01 ], [ 0.085, 0.112, 0.098 ] );
	add( 'neck', new THREE.CylinderGeometry( 0.048, 0.054, 0.14, 32 ), skin, [ 0, 0.0, 0 ] );
	for ( const side of [ 'L', 'R' ] ) {

		const sx = side === 'L' ? 1 : - 1;
		add( `hand${ side }`, sphere, skin, [ sx * 0.012, - 0.075, 0.005 ], [ 0.03, 0.08, 0.045 ], [ 0, 0, sx * ARM ] );
		add( 'hips', new THREE.CapsuleGeometry( 0.075, 0.78, 8, 24 ), dark, [ sx * 0.085, - 0.5, 0 ] );

	}

	add( 'hips', sphere, dark, [ 0, - 0.09, 0 ], [ 0.138, 0.10, 0.092 ] );

	// Seconds -> pose. Slow idle: breathing, a turn of the torso, arm sway.
	function animate( t ) {

		const b = ( n ) => bones[ B[ n ] ];
		b( 'spine' ).rotation.set( 0, 0.10 * Math.sin( 0.30 * t ), 0.025 * Math.sin( 0.45 * t ) );
		b( 'chest' ).rotation.set( - 0.02 * Math.sin( 1.3 * t ), 0.04 * Math.sin( 0.30 * t + 0.6 ), 0 );
		b( 'head' ).rotation.set( 0.05 * Math.sin( 0.4 * t ), 0.35 * Math.sin( 0.22 * t ), 0 );
		for ( const [ side, sx, ph ] of [ [ 'L', 1, 0 ], [ 'R', - 1, Math.PI ] ] ) {

			const sw = Math.sin( 0.5 * t + ph );
			b( `upperArm${ side }` ).rotation.set( 0.30 * sw, 0, sx * ( 0.10 + 0.05 * Math.sin( 0.6 * t + ph ) ) );
			b( `forearm${ side }` ).rotation.set( - ( 0.35 + 0.25 * ( 0.5 + 0.5 * Math.sin( 0.5 * t + ph + 1 ) ) ), 0, 0 );

		}

	}

	animate( 0 );
	return { group, meshes, skeleton, bones, animate };

}
