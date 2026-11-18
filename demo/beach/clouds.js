// Cut paper clouds over the beach (demo/beach.js): cards cut out of one
// painted sheet (paper_beach_01/assets/clouds, 6 clouds, rects in
// clouds.json), standing up in layers from 500 m to 1.6 km, each facing
// the beach with a small random turn, like the cut-outs of a diorama.
//   matter   Infinitex paper (beach/props.js) multiplied by the painting,
//            cut by its alpha: lit by the sun, shaded under the ship
//   drift    each card slides slowly along the shore and sways
//   push     the ship parts them: a card near its path is pushed away
//            from it, sideways and up, and turns as it goes (the hull is
//            about 400 m wide at 1 km up; reach 900 m)
// createClouds( { tex, rects, scene, count } ) -> { group, update( t, shipPos ) }.
//
// Event bus: none (the page calls update each frame).

import * as THREE from 'three/webgpu';
import { uv, texture, vec2 } from 'three/tsl';
import { createMaterial } from '../../src/index.js';

const PAPER = { family: 'fibermat', intent: 'paper', color: '#ffffff', color2: '#f2f4f6', color_variation: 0.03, fiber_um: 25, fiber_mm: 2, curl: 0.1, flatten: 0.1, contrast: 0.3, formation: 0.4, formation_mm: 8, lumps: 0.05, roughness: 0.9, sheen: 0.1 };
const REACH = 900, PUSH = 1100;

export function createClouds( { tex, rects, scene, count = 48, seed = 7 } ) {

	let k = seed * 9301 + 49297;
	const rnd = () => ( k = ( k * 233280 + 49297 ) % 2147483647 ) / 2147483647;
	tex.colorSpace = THREE.SRGBColorSpace;
	const group = new THREE.Group();
	group.name = 'clouds';
	scene.add( group );

	// One material per rect: the card's UVs map into its part of the sheet.
	const mats = rects.map( ( [ u0, v0, u1, v1 ] ) => {

		const coords = uv().mul( 40 ); // paper fibres at the card's scale do not show from a kilometre; cheap coords
		const m = createMaterial( { ...PAPER, micro: 0 }, { coords } ).material;
		const t = texture( tex, vec2( uv().x.mul( u1 - u0 ).add( u0 ), uv().y.mul( v1 - v0 ).add( v0 ) ) );
		// Mostly their own light: a cloud is bright from every side. Lit like
		// the props, the water mirrored their dim side as brown cut-outs.
		m.colorNode = m.colorNode.mul( t.rgb ).mul( 0.35 );
		m.emissiveNode = t.rgb.mul( 0.85 );
		m.opacityNode = t.a;
		m.alphaTest = 0.5;
		m.side = THREE.DoubleSide;
		return { m, aspect: ( u1 - u0 ) / ( v1 - v0 ) * ( tex.image.width / tex.image.height ) };

	} );

	const cards = [];
	const plane = new THREE.PlaneGeometry( 1, 1 );
	for ( let i = 0; i < count; i ++ ) {

		const r = Math.floor( rnd() * mats.length );
		const w = 250 + rnd() * 650;
		const mesh = new THREE.Mesh( plane, mats[ r ].m );
		mesh.scale.set( w, w / mats[ r ].aspect, 1 );
		const home = new THREE.Vector3( ( rnd() - 0.5 ) * 7000, 500 + rnd() * 1100, 300 + rnd() * 6000 );
		mesh.position.copy( home );
		mesh.rotation.set( 0, Math.PI + ( rnd() - 0.5 ) * 0.5, 0 ); // faces the beach (-z), a little turned
		mesh.castShadow = true; // cloud shadows on the bay (inside the sun cascades only)
		mesh.frustumCulled = false;
		group.add( mesh );
		cards.push( { mesh, home, off: new THREE.Vector3(), phase: rnd() * 6.28, yaw: mesh.rotation.y } );

	}

	const d = new THREE.Vector3();
	function update( t, ship = null ) {

		for ( const c of cards ) {

			// Drift along the shore, wrapped over 7 km, and a slow sway.
			const x = ( ( c.home.x + t * 6 + 3500 ) % 7000 + 7000 ) % 7000 - 3500;
			let px = x, py = c.home.y + Math.sin( t * 0.2 + c.phase ) * 8, pz = c.home.z, turn = 0;
			if ( ship ) {

				// Push: away from the ship, measured across its path (x) and in height.
				d.set( px - ship.x, ( py - ship.y ) * 1.5, pz - ship.z );
				const dist = d.length();
				const f = Math.max( 0, 1 - dist / REACH );
				const s = f * f * ( 3 - 2 * f );
				const side = Math.sign( px - ship.x || 1 );
				c.off.x += ( side * PUSH * s - c.off.x ) * 0.04;
				c.off.y += ( 250 * s - c.off.y ) * 0.04;
				turn = side * 0.6 * s;

			} else c.off.multiplyScalar( 0.98 );
			c.mesh.position.set( px + c.off.x, py + c.off.y, pz );
			c.mesh.rotation.y = c.yaw + turn;

		}

	}

	return { group, cards, update };

}
