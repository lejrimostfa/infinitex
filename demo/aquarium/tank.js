// The aquarium's tank (demo/aquarium.js): a sand floor with dunes, one
// marble wall at the back, three panes of glass (front and sides), a
// marble base, and a few cubes of Infinitex matter.
//   buildTank( { scene, tank, params, sky, TW, TD, TH, LEVEL } )
//   tank     the ClippingGroup of what stands in the water (the mirrors
//            draw it); the glass and the marble shell go in the scene
//   returns  { sand, marble, GLASS, RIM }: the presets, the glass (m,
//            index) and how far the sand's rim goes down (m)
// ?flat (no dunes), ?seg (floor segments, mm).
//
// Event bus: none (built once by the page).

import * as THREE from 'three/webgpu';
import { uv, vec2, vec3, float, positionLocal, positionWorld, normalLocal, cameraPosition, attribute, reflect, mix } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { createMaterial } from '../../src/index.js';
import { waterBody, hazeColor } from '../../src/core/underwater.js';
import { refractedVertex } from '../../src/core/refraction.js';

// A plane with UVs in metres, facing +z before it is placed.
// A rim folded down around a plane (in place): the border vertices again,
// and one under each, `drop` below the plane, flagged `skirt` = 1. Both
// rows keep the plane's normal: the fold is lit like the top, so the eye
// reads one surface that turns down (an outward normal made it a dark
// or a white band, by the light it caught). A slab whose
// vertices are displaced lifts the upper row with its surface and keeps
// the lower one, so its edge is a closed face down to its base. `tall`:
// about how high the fold stands (m), for the texture that runs down it.
function addSkirt( g, w, h, drop, tall = 0.025 ) {

	const nx = g.parameters.widthSegments, ny = g.parameters.heightSegments, n0 = g.attributes.position.count;
	const P = g.attributes.position, U = g.attributes.uv;
	const at = ( i, j ) => i + j * ( nx + 1 );
	const ring = [];
	for ( let i = 0; i < nx; i ++ ) ring.push( at( i, 0 ) );
	for ( let j = 0; j < ny; j ++ ) ring.push( at( nx, j ) );
	for ( let i = nx; i > 0; i -- ) ring.push( at( i, ny ) );
	for ( let j = ny; j > 0; j -- ) ring.push( at( 0, j ) );
	const pos = Array.from( P.array ), uvs = Array.from( U.array ), nor = Array.from( g.attributes.normal.array ), idx = Array.from( g.index.array ), flag = new Array( n0 ).fill( 0 );
	for ( const v of ring ) {

		const x = P.getX( v ), y = P.getY( v );
		// The texture goes on down the fold.
		const ox = Math.abs( Math.abs( x ) - w / 2 ) < 1e-6 ? Math.sign( x ) : 0, oy = Math.abs( Math.abs( y ) - h / 2 ) < 1e-6 ? Math.sign( y ) : 0;
		pos.push( x, y, 0, x, y, - drop ); uvs.push( U.getX( v ), U.getY( v ), U.getX( v ) + ox * tall / w, U.getY( v ) + oy * tall / h ); nor.push( 0, 0, 1, 0, 0, 1 ); flag.push( 0, 1 );

	}

	// The plane's border runs clockwise seen from +z: these faces look out.
	const N = ring.length;
	for ( let k = 0; k < N; k ++ ) { const a = n0 + 2 * k, b = n0 + 2 * ( ( k + 1 ) % N ); idx.push( a, b, a + 1, b, b + 1, a + 1 ); }
	g.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
	g.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
	g.setAttribute( 'normal', new THREE.Float32BufferAttribute( nor, 3 ) );
	g.setAttribute( 'skirt', new THREE.Float32BufferAttribute( flag, 1 ) );
	g.setIndex( idx );

}

function slab( tank, w, h, preset, place, seg = 0.02, skirt = 0 ) {

	// 2 cm segments: refraction moves vertices (core/refraction.js). A line
	// seen through a flat interface bends gently; 1 cm gave 4 times the
	// triangles for no visible gain.
	const g = new THREE.PlaneGeometry( w, h, Math.ceil( w / seg ), Math.ceil( h / seg ) );
	if ( skirt ) addSkirt( g, w, h, skirt );
	g.computeTangents();
	const ix = createMaterial( { ...preset, underwater: 1 }, { coords: uv().mul( vec2( w, h ) ) } );
	// The height the family gives, applied straight up (whatever the
	// normal), and not at all on the fold's lower row.
	if ( skirt && ix.material.positionNode ) ix.material.positionNode = positionLocal.add( vec3( 0, 0, 1 ).mul( ix.material.positionNode.sub( positionLocal ).dot( normalLocal ) ).mul( float( 1 ).sub( attribute( 'skirt', 'float' ) ) ) );
	const m = new THREE.Mesh( g, ix.material );
	place( m );
	tank.add( m );
	return m;

}

export function buildTank( { scene, tank, params, sky, TW, TD, TH, LEVEL } ) {

	const RIM = 0.012; // how far the sand's folded rim goes down (m); the panes' waterline pass starts there too
	const sand = { family: 'ground', mode: 'sand', grain_mm: 0.35, color: '#d6bd92', color2: '#b8804f', color3: '#2b2622', ripple_mm: 90, ripple: 0.5, specks: 0.4, sparkle: 0.5, roughness: 0.8, seed: 2 };
	const marble = { family: 'stone', mode: 'marble', intent: 'white marble tank wall', color: '#d9d6cf', color2: '#8c8c88', roughness: 0.35, seed: 4 };
	// The floor: the sand's ripples and low mounds move its vertices
	// (preset.displace; ?flat keeps the plane, same normals), so
	// it gets 5 mm segments: the lee side of a ripple is 2 cm wide. Measured:
	// the finer floor and its displacement cost under 0.2 ms per frame.
	slab( tank, TW, TD, { ...sand, dune: 1, displace: params.has( 'flat' ) ? 0 : 1 }, ( m ) => { m.rotation.x = - Math.PI / 2; }, ( + params.get( 'seg' ) || 5 ) * 1e-3, RIM ); // ?seg=20: the former 2 cm, to compare
	// The displaced sand stands about 2 cm over its plane. Without the folded
	// rim (addSkirt) the eye at floor height looked under it through a pane,
	// and saw the marble base as a second, white floor. The rim goes RIM
	// down, past the top of the base (which stands a hair inside the panes, so
	// the two never share a plane): no slit under the sand from any height.
	slab( tank, TW, TH, marble, ( m ) => { m.position.set( 0, TH / 2, - TD / 2 ); } );
	// Front and both sides: panes of glass (drawn by the waterline pass,
	// core/waterline.js). They have no mesh. Seen from inside the water, a
	// pane shows the water's own haze, not the room: a plane of that colour
	// up to the level, facing inwards (so culled from outside, where the
	// eye looks through the glass). The walk and the focus go through it.
	for ( const [ w, x, z, ry ] of [ [ TW, 0, TD / 2, Math.PI ], [ TD, - TW / 2, 0, Math.PI / 2 ], [ TD, TW / 2, 0, - Math.PI / 2 ] ] ) {

		const hm = new THREE.MeshBasicNodeMaterial();
		hm.colorNode = hazeColor( positionWorld.sub( cameraPosition ).normalize() ).mul( 0.55 ); // lighter up, deeper down, as the water in front of it
		hm.vertexNode = refractedVertex();
		const m = new THREE.Mesh( new THREE.PlaneGeometry( w, LEVEL, Math.ceil( w / 0.02 ), Math.ceil( LEVEL / 0.02 ) ), hm );
		m.position.set( x, LEVEL / 2, z );
		m.rotation.y = ry;
		m.userData.noFocus = true;
		tank.add( m );

	}

	// The panes themselves: 8 mm of ordinary glass (n = 1.52), outside the
	// water. A box each, without its face on the water's side. Its wide face
	// mirrors the sky by Fresnel's law (4 % face on, all of it at a grazing
	// angle); its edges, where the eye looks through centimetres of glass,
	// show the green of soda-lime glass. Blended after the opaque scene, no
	// depth written: the effects (AO, depth of field) see through it. What the
	// plate does to the picture behind (it comes 2.7 mm nearer) is not drawn:
	// the waterline pass can do it (`glass`), but each pane then shifts the
	// tank along its own normal, and at a grazing angle that opened a wedge
	// in the corners, between the true corner and the shifted floor.
	// The walk and the focus go through it, like the water.
	const GLASS = { thickness: 0.008, ior: 1.52 };
	const paneMeshes = [];
	{

		const GT = GLASS.thickness, F0 = ( ( GLASS.ior - 1 ) / ( GLASS.ior + 1 ) ) ** 2, Y0 = - 0.021;
		// thin: the axis across the pane; inner: the box face on the water's side (BoxGeometry order +x -x +y -y +z -z).
		const pane = ( w, h, d, x, z, thin, inner ) => {

			const g = new THREE.BoxGeometry( w, h, d );
			const edge = new Float32Array( 24 ), idx = [];
			for ( let f = 0; f < 6; f ++ ) {

				const wide = ( f >> 1 ) === ( thin === 'x' ? 0 : 2 );
				edge.fill( wide ? 0 : 1, f * 4, f * 4 + 4 );
				if ( f !== inner ) for ( let k = 0; k < 6; k ++ ) idx.push( g.index.array[ f * 6 + k ] );

			}

			g.setAttribute( 'edge', new THREE.BufferAttribute( edge, 1 ) );
			g.setIndex( idx );
			const m = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false } );
			const V = positionWorld.sub( cameraPosition ).normalize();
			const N = normalLocal; // the box is not turned: its own normal is the world's
			const fres = float( F0 ).add( float( 1 - F0 ).mul( float( 1 ).sub( V.dot( N ).abs() ).pow( 5 ) ) );
			const e = attribute( 'edge', 'float' );
			// Two faces mirror on a wide side, 2 F / ( 1 + F ) with the bounces
			// between them; an edge is a deep, bright green.
			const a = mix( fres.mul( 2 ).div( fres.add( 1 ) ), float( 0.82 ), e );
			m.colorNode = mix( sky( reflect( V, N ) ), vec3( 0.42, 0.72, 0.6 ).mul( fres.mul( 3 ).add( 0.75 ) ), e );
			m.opacityNode = a;
			const mesh = new THREE.Mesh( g, m );
			mesh.position.set( x, Y0 + h / 2, z );
			mesh.renderOrder = 20; // after the water's surface
			mesh.userData.noFocus = true;
			scene.add( mesh );
			paneMeshes.push( mesh );

		};
		pane( TW + 2 * GT, TH - Y0, GT, 0, TD / 2 + GT / 2, 'z', 5 ); // front, over both corners
		for ( const sx of [ - 1, 1 ] ) pane( GT, TH - Y0, TD + 0.021, sx * ( TW / 2 + GT / 2 ), - 0.021 / 2, 'x', sx > 0 ? 1 : 0 );

	}

	// The tank seen from outside: the slabs above face inwards only, so from
	// behind the tank the back wall was culled and the eye fell into the
	// void (and the light shafts drew there in blocks). A marble shell gives
	// the back wall and the floor their thickness. It stays 1 mm behind the
	// slabs (no depth fight), and in the scene, not in the tank group: it is
	// dry, and the water's mirrors do not need it.
	{

		const T = 0.02, GAP = 0.001;
		const block = ( w, h, d, x, y, z ) => {

			const g = new THREE.BoxGeometry( w, h, d );
			g.computeTangents();
			const m = new THREE.Mesh( g, createMaterial( marble, { coords: uv().mul( vec2( Math.max( w, d ), Math.max( h, Math.min( w, d ) ) ) ) } ).material );
			m.position.set( x, y, z );
			m.castShadow = m.receiveShadow = true;
			scene.add( m );

		};
		block( TW, TH + T, T, 0, ( TH - T ) / 2, - TD / 2 - GAP - T / 2 ); // back, down to under the floor
		const IN = 0.0003; // inside the three panes, behind the sand's rim
		block( TW - 2 * IN, T, TD + GAP - IN, 0, - GAP - T / 2, - ( GAP + IN ) / 2 ); // under the sand

	}

	// Cubes of matter; the tall one breaks the surface.
	const cube = ( size, h, preset, x, z, ry ) => {

		let g = new RoundedBoxGeometry( size, h, size, 4, 0.012 );
		g.deleteAttribute( 'uv1' );
		// Its flat faces are single quads: cut them to about 2 cm, so the part
		// under water can bend (core/refraction.js).
		g = new TessellateModifier( 0.02, 10 ).modify( g.toNonIndexed() );
		g = mergeVertices( g );
		g.computeTangents();
		const ix = createMaterial( { ...preset, underwater: 1 }, { coords: uv().mul( vec2( size, h ) ) } );
		const m = new THREE.Mesh( g, ix.material );
		m.position.set( x, h / 2, z );
		m.rotation.y = ry;
		tank.add( m );

	};

	cube( 0.16, 0.16, { family: 'stone', mode: 'granite', color: '#a8807a', color2: '#2a2626', color3: '#d8d0c8', roughness: 0.3, seed: 3 }, - 0.25, - 0.12, 0.4 );
	cube( 0.12, 0.12, { family: 'metal', metal: 'bronze', seed: 7 }, 0.12, 0.15, - 0.3 );
	cube( 0.14, 0.48, { family: 'wood', intent: 'driftwood', ring_mm: 5, figure: 1, knots: 0.3, weather: 1, weather_color: '#8e8a82', checks: 0.6, roughness: 0.85, seed: 4 }, 0.3, - 0.18, 0.2 );

	return { sand, marble, GLASS, RIM };

}
