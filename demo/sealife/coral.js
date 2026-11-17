// Two corals built by code from recursive branches, in the Infinitex
// coral matter (organic family, mode coral: corallite cups packed on the
// skeleton, a porous lattice below them), seen here as fine polyp bumps.
//   branching  a staghorn coral: a few trunks from the sand, each forks
//              two or three times, thinner each time, toward the light;
//              rounded tips, paler where the coral grows (tint attribute)
//   fan        a sea fan (gorgonian): an oval net of thin branches on a
//              short stalk, the branches fuse where they meet; purple, on a
//              bowed sheet. It rocks gently in the current (seabed.js,
//              vertex stage).
// Branches are tubes with UVs in meters (around, along), so the cups keep
// their real size; a tube's end is capped by a half sphere. Beyond 90 cm a
// plain material of the same mean colour (seabed.js lod).
// update( t ) is a no-op.
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { attribute, positionLocal, uv, vec2, vec3, sin, cos } from 'three/tsl';
import { createMaterial } from '../../src/index.js';
import { tintUnderwater } from '../../src/core/underwater.js';
import { rng, rgb, current, lod, wetMaterial } from './seabed.js';

const V = THREE.Vector3;

// segs: [ { a, b, ra, rb, ta, tb, cap } ]: points, radii, tint 0..1 at
// each end. Returns a geometry with position, uv, tint (float).
function tubes( segs, sides, rows, capRows = 4 ) {

	const pos = [], uvs = [], tint = [], idx = [], T = new V(), N = new V(), B = new V(), P = new V();
	const ring = ( c, n, r, t, v, len ) => { for ( let j = 0; j <= sides; j ++ ) { const w = j / sides * 6.283; P.copy( c ).addScaledVector( N, Math.cos( w ) * r ).addScaledVector( B, Math.sin( w ) * r ); pos.push( P.x, P.y, P.z ); uvs.push( j / sides * 6.283 * r, v ); tint.push( t ); } };
	for ( const s of segs ) {

		T.subVectors( s.b, s.a );
		const len = T.length();
		T.normalize();
		N.crossVectors( T, Math.abs( T.y ) > 0.9 ? new V( 1, 0, 0 ) : new V( 0, 1, 0 ) ).normalize();
		B.crossVectors( T, N );
		const base = pos.length / 3, nc = s.cap ? capRows : 0;
		for ( let i = 0; i <= rows; i ++ ) { const f = i / rows; ring( new V().lerpVectors( s.a, s.b, f ), 0, s.ra + ( s.rb - s.ra ) * f, s.ta + ( s.tb - s.ta ) * f, s.v0 + f * len ); }
		for ( let i = 1; i <= nc; i ++ ) { const q = i / nc * Math.PI / 2; ring( s.b.clone().addScaledVector( T, Math.sin( q ) * s.rb ), 0, Math.max( Math.cos( q ) * s.rb, 1e-5 ), s.tb, s.v0 + len + q * s.rb ); }
		for ( let i = 0; i < rows + nc; i ++ ) for ( let j = 0; j < sides; j ++ ) { const a = base + i * ( sides + 1 ) + j, b = a + sides + 1; idx.push( a, b, a + 1, a + 1, b, b + 1 ); }

	}

	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	g.setAttribute( 'tint', new THREE.Float32BufferAttribute( tint, 1 ) );
	g.setIndex( idx );
	g.computeVertexNormals();
	g.computeTangents();
	return g;

}

// A staghorn coral about `size` high.
function staghorn( size, rnd ) {

	const segs = [], up = new V( 0, 1, 0 );
	const grow = ( a, dir, len, r, depth, v0 ) => {

		// Each branch bends a little toward the light along its length.
		const mid = a.clone().addScaledVector( dir, len * 0.5 );
		const d2 = dir.clone().lerp( up, 0.25 ).normalize(), b = mid.clone().addScaledVector( d2, len * 0.5 );
		const leaf = depth <= 0, rb = r * ( leaf ? 0.8 : 0.82 );
		const t0 = leaf ? 0.25 : depth === 1 ? 0.1 : 0, t1 = leaf ? 0.55 : t0, t2 = leaf ? 1 : t0;
		segs.push( { a, b: mid, ra: r, rb: ( r + rb ) / 2, ta: t0, tb: t1, v0, cap: false } );
		segs.push( { a: mid, b, ra: ( r + rb ) / 2, rb, ta: t1, tb: t2, v0: v0 + len * 0.5, cap: leaf } );
		if ( leaf ) return;
		const n = rnd() < 0.3 ? 3 : 2, axis = new V();
		for ( let k = 0; k < n; k ++ ) {

			axis.set( rnd() - 0.5, 0, rnd() - 0.5 ).cross( d2 ).normalize();
			const d = d2.clone().applyAxisAngle( axis, 0.35 + rnd() * 0.35 ).lerp( up, 0.15 ).normalize();
			grow( b.clone(), d, len * ( 0.72 + rnd() * 0.15 ), rb * 0.85, depth - 1 + ( rnd() < 0.2 ? - 1 : 0 ), v0 + len );

		}

	};
	for ( let k = 0; k < 5; k ++ ) {

		const az = k / 5 * 6.283 + rnd() * 0.6, tilt = 0.25 + rnd() * 0.45;
		const d = new V( Math.cos( az ) * Math.sin( tilt ), Math.cos( tilt ), Math.sin( az ) * Math.sin( tilt ) );
		grow( new V( Math.cos( az ) * 0.004, - 0.004, Math.sin( az ) * 0.004 ), d, size * 0.32, size * 0.065, 3, 0 );

	}

	return tubes( segs, 9, 3 );

}

// A sea fan `size` high: an oval net on a short stalk, in the x y plane,
// bowed in z. All tips grow one step in turn, turning up as they go; a tip
// throws a side shoot where there is room, stops at the oval, and fuses
// into a branch it meets (gorgonian branches do): that makes the net.
function seaFan( size, rnd ) {

	const segs = [], pts = [], step = size * 0.024, cy = size * 0.56, rx = size * 0.56, ry = size * 0.44;
	const bow = ( x, y ) => new V( x, y, ( x / size ) ** 2 * size * 0.3 + Math.sin( y / size * 4 ) * size * 0.03 );
	const inside = ( p ) => ( p.x / rx ) ** 2 + ( ( p.y - cy ) / ry ) ** 2 < 1;
	const near = ( q, d, id ) => pts.find( ( e ) => e.id !== id && e.p.distanceTo( q ) < d );
	const stalk = bow( 0, size * 0.14 );
	segs.push( { a: bow( 0, - 0.004 ), b: stalk, ra: size * 0.02, rb: size * 0.016, ta: 0, tb: 0, v0: 0, cap: false } );
	let ids = 0;
	const tips = [ - 1.1, - 0.4, 0.4, 1.1 ].map( ( ang ) => ( { p: stalk, ang, r: size * 0.009, v0: size * 0.14, id: ids ++ } ) );
	while ( tips.length && segs.length < 1600 ) {

		const t = tips.shift();
		t.ang = t.ang * 0.96 + ( rnd() - 0.5 ) * 0.22;
		const q = bow( t.p.x + Math.sin( t.ang ) * step, t.p.y + Math.cos( t.ang ) * step );
		const hit = t.v0 > size * 0.25 && near( q, size * 0.012, t.id );
		if ( hit ) { segs.push( { a: t.p, b: hit.p, ra: t.r, rb: t.r, ta: 0.2, tb: 0.2, v0: t.v0, cap: false } ); continue; }
		const out = ! inside( q );
		segs.push( { a: t.p, b: q, ra: t.r, rb: t.r * 0.975, ta: 0, tb: out ? 1 : 0, v0: t.v0, cap: out } );
		if ( out ) continue;
		pts.push( { p: q, id: t.id } );
		Object.assign( t, { p: q, r: Math.max( t.r * 0.975, size * 0.0028 ), v0: t.v0 + step } );
		tips.push( t );
		const side = t.ang + ( rnd() < 0.5 ? - 1 : 1 ) * ( 0.6 + rnd() * 0.4 );
		const probe = new V( q.x + Math.sin( side ) * step * 1.5, q.y + Math.cos( side ) * step * 1.5, q.z );
		if ( rnd() < 0.6 && ! near( probe, size * 0.028, - 1 ) ) tips.push( { p: q, ang: side, r: t.r * 0.85, v0: t.v0, id: ids ++ } );

	}

	return tubes( segs, 5, 1, 2 );

}

// list: [ { kind: 'branching' | 'fan', x, z, size, ry } ].
export function createCorals( { list, floor = () => 0, seed = 31 } ) {

	const rnd = rng( seed ), group = new THREE.Group(), mats = {};
	const material = ( kind ) => {

		if ( mats[ kind ] ) return mats[ kind ];
		const fan = kind === 'fan';
		const ix = createMaterial( { family: 'organic', mode: 'coral', intent: fan ? 'purple sea fan' : 'living staghorn coral', size_mm: fan ? 0.7 : 1.6, cell_um: fan ? 60 : 110,
			color: fan ? '#8c2c8c' : '#b05a7a', color2: fan ? '#b04aa8' : '#c08098', color3: fan ? '#3a0c3a' : '#40142a', color_variation: 0.12, relief: 1, roughness: 0.8, seed: fan ? 41 : 37, underwater: 1 }, { coords: uv() } );
		const t = attribute( 'tint', 'float' );
		// Growing tips are paler (a staghorn's axial corallite).
		const tint = vec3( 1 ).add( vec3( fan ? 0.5 : 1.3, fan ? 0.45 : 1.25, fan ? 0.5 : 1.45 ).mul( t ) );
		tintUnderwater( ix.material, tint );
		// Far away (seabed.js lod): the matter's mean colour, plain.
		const far = wetMaterial( { color: rgb( fan ? '#80307e' : '#9c5a72' ).mul( tint ), roughness: 0.8 } );
		for ( const m of [ ix.material, far ] ) {

			m.side = fan ? THREE.DoubleSide : THREE.FrontSide;
			if ( ! fan ) continue;
			// The fan rocks in the current, more at the top: the push across
			// its sheet. fan = ( x, z, size, turn ), the same on every vertex.
			const p = positionLocal, F = attribute( 'fan', 'vec4' );
			const push = current( F.xy ).dot( vec2( sin( F.w ), cos( F.w ) ) ).mul( 0.12 ).mul( F.z );
			m.positionNode = p.add( vec3( 0, 0, push.mul( p.y.div( F.z ).pow( 2 ) ) ) );

		}

		return ( mats[ kind ] = [ ix.material, far ] );

	};

	for ( const c of list ) {

		const g = c.kind === 'fan' ? seaFan( c.size, rnd ) : staghorn( c.size, rnd );
		if ( c.kind === 'fan' ) g.setAttribute( 'fan', new THREE.Float32BufferAttribute( new Float32Array( g.getAttribute( 'position' ).count * 4 ).map( ( _, i ) => [ c.x, c.z, c.size, c.ry ?? 0 ][ i % 4 ] ), 4 ) );
		const [ near, far ] = material( c.kind );
		const mesh = lod( [ [ g, near, 0 ], [ g, far, 0.9 ] ] );
		mesh.position.set( c.x, floor( c.x, c.z ) - 0.002, c.z );
		mesh.rotation.y = c.ry ?? 0;
		group.add( mesh );

	}

	return { group, update() {} };

}
