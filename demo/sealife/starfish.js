// Starfish built by code, lying on the sand, in the Infinitex scales
// matter (mode beads: packed calcium granules, like a lizard's skin).
//   body     a polar grid over the star: five tapered arms, a domed back
//            that falls to the edge, which sinks a millimetre into the sand
//            (no underside to draw). Each arm bends a little sideways and
//            its tip lifts or droops, so the star lies on the ground.
//   relief   small tubercles all over the back (a jittered grid of domes),
//            and, when knobs > 0, a row of big knobs along each arm and a
//            ring of them on the disc (a chocolate-chip star)
//   colour   a knob attribute darkens the knobs; the matter gives the
//            granules. UVs: the plane x z in meters. Three levels of
//            detail (seabed.js lod).
// update( t ) is a no-op: starfish move too slowly to see.
//
// Event bus: none (driven by the page's frame loop).

import * as THREE from 'three/webgpu';
import { attribute, uv, mix } from 'three/tsl';
import { createMaterial } from '../../src/index.js';
import { rng, rgb, lod, wetMaterial } from './seabed.js';

// Ra: arm length (m), from the centre. ground( x, z ): the sand under a
// point of the star, relative to its centre, so every arm lies on it.
// pose: { bend, lift } of the five arms. k: the grid's density.
function starGeometry( Ra, knobs, pose, ground, k ) {

	const NT = Math.round( 260 * k ), NR = Math.round( 46 * k ), rc = Ra * 0.3, Hc = Ra * 0.26, { bend, lift } = pose;
	// Tubercles: one per cell of a jittered grid, 2.4 mm.
	const cell = 0.0024, jit = ( i, j ) => { const h = Math.sin( i * 127.1 + j * 311.7 ) * 43758.5453; return [ h - Math.floor( h ), ( h * 7.13 ) - Math.floor( h * 7.13 ) ]; };
	const tubercle = ( x, z ) => {

		let b = 0;
		const ci = Math.floor( x / cell ), cj = Math.floor( z / cell );
		for ( let i = ci - 1; i <= ci + 1; i ++ ) for ( let j = cj - 1; j <= cj + 1; j ++ ) {

			const [ a, c ] = jit( i, j ), d2 = ( ( i + a ) * cell - x ) ** 2 + ( ( j + c ) * cell - z ) ** 2, r2 = ( cell * 0.45 ) ** 2;
			b = Math.max( b, Math.max( 0, 1 - d2 / r2 ) ** 2 );

		}

		return b;

	};
	// Knobs: along each arm and a ring between the arms, in star coordinates.
	const K = [];
	if ( knobs ) for ( let k = 0; k < 5; k ++ ) {

		const a = k / 5 * 6.283;
		for ( const f of [ 0.18, 0.34, 0.5, 0.65, 0.8 ] ) K.push( [ Math.cos( a ) * f * Ra, Math.sin( a ) * f * Ra, Ra * 0.075 * ( 1.15 - f * 0.6 ) ] );
		K.push( [ Math.cos( a + 0.628 ) * rc * 0.75, Math.sin( a + 0.628 ) * rc * 0.75, Ra * 0.07 ] );

	}

	const pos = [], uvs = [], knob = [], idx = [];
	for ( let i = 0; i <= NR; i ++ ) {

		const u = i / NR;
		for ( let j = 0; j <= NT; j ++ ) {

			const th = j / NT * 6.283, arm = Math.round( th / 6.283 * 5 ) % 5, c = Math.abs( Math.cos( th * 2.5 ) );
			const R = rc + ( Ra - rc ) * Math.pow( c, 2.2 ), r = u * R, s = r / Ra;
			// Star coordinates (straight arms), for the knobs and the relief.
			const sx = Math.cos( th ) * r, sz = Math.sin( th ) * r;
			let kb = 0;
			for ( const [ kx, kz, kr ] of K ) kb = Math.max( kb, Math.max( 0, 1 - ( ( sx - kx ) ** 2 + ( sz - kz ) ** 2 ) / ( kr * kr ) ) );
			const dome = Hc * ( 1 - 0.62 * s ) * Math.sqrt( Math.max( 0, 1 - u * u ) );
			const y = dome + ( tubercle( sx, sz ) * 0.0005 + Math.sqrt( kb ) * Ra * 0.05 ) * Math.min( 1, ( 1 - u ) * 6 ) + lift[ arm ] * s ** 3 * c - 0.0012;
			// Bent arms: the angle turns with the distance, on the arm only.
			const a2 = th + bend[ arm ] * s * s * Math.pow( c, 4 );
			pos.push( Math.cos( a2 ) * r, y + ground( Math.cos( a2 ) * r, Math.sin( a2 ) * r ), Math.sin( a2 ) * r );
			uvs.push( Math.cos( a2 ) * r, Math.sin( a2 ) * r );
			knob.push( Math.min( 1, kb * 1.6 ) );

		}

	}

	for ( let i = 0; i < NR; i ++ ) for ( let j = 0; j < NT; j ++ ) { const a = i * ( NT + 1 ) + j, b = a + NT + 1; idx.push( a, a + 1, b, a + 1, b + 1, b ); }
	const g = new THREE.BufferGeometry();
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	g.setAttribute( 'knob', new THREE.Float32BufferAttribute( knob, 1 ) );
	g.setIndex( idx );
	g.computeVertexNormals();
	g.computeTangents();
	return g;

}

// list: [ { x, z, Ra, ry, knobs, color, groove, knobColor } ] (hex colours).
export function createStarfish( { list, floor = () => 0, seed = 61 } ) {

	const rnd = rng( seed ), group = new THREE.Group();
	for ( const s of list ) {

		const ix = createMaterial( { family: 'scales', mode: 'beads', scale_mm: 0.8, size_variation: 0.5, depth: 0.85, groove: 0.14, wrinkles: 0.2, color: s.color, groove_color: s.groove ?? '#3a1206',
			color_variation: 0.15, roughness: 0.45, seed: 29 + group.children.length, underwater: 1 }, { coords: uv() } );
		const k = attribute( 'knob', 'float' );
		if ( s.knobs ) ix.material.colorNode = mix( ix.material.colorNode, ix.material.colorNode.mul( rgb( s.knobColor ?? '#5a2418' ) ), k );
		const ry = s.ry ?? rnd() * 6.283, y0 = floor( s.x, s.z ), cs = Math.cos( ry ), sn = Math.sin( ry );
		const ground = ( x, z ) => floor( s.x + x * cs + z * sn, s.z - x * sn + z * cs ) - y0; // three's rotation about y
		const pose = { bend: Array.from( { length: 5 }, () => ( rnd() - 0.5 ) * 0.7 ), lift: Array.from( { length: 5 }, () => ( rnd() - 0.4 ) * s.Ra * 0.06 ) };
		// Full grid up close, half beyond 40 cm, plain matter beyond 90 cm.
		let mean = rgb( s.color ).mul( 0.75 );
		if ( s.knobs ) mean = mix( mean, mean.mul( rgb( s.knobColor ?? '#5a2418' ) ), k );
		const half = starGeometry( s.Ra, s.knobs, pose, ground, 0.5 );
		const mesh = lod( [ [ starGeometry( s.Ra, s.knobs, pose, ground, 1 ), ix.material, 0 ], [ half, ix.material, 0.4 ], [ half, wetMaterial( { color: mean, roughness: 0.45 } ), 0.9 ] ] );
		mesh.position.set( s.x, y0, s.z );
		mesh.rotation.y = ry;
		group.add( mesh );

	}

	return { group, update() {} };

}
