// The capital ship of the paper beach (demo/beach.js): the folded paper
// ship (paper_beach_01/assets/ship, 30 m) scaled to 3 km, flying in from
// the sea over the beach at about a kilometre up.
//   path     t in [ 0, 1 ]: from far out at sea, hidden in the haze and the
//            clouds, over the bay, to its stop behind the beach. Eased: it slows
//            down as it arrives
//   shadow   the sun's cascades cover 120 m around the eye, a kilometre
//            down is out of their reach. So a proxy casts it: the same
//            mesh, flattened along the sun onto a plane 15 m up (a shear,
//            one matrix), invisible to the camera. A parallel light draws
//            the same shadow from both. Beyond the cascades the page dims
//            the sun with `cover` (how much of the bay is under the hull)
//   haze     the scene's fog takes the ship's colour toward the sky with
//            distance, which tells its size
// createShip( prop, scene, sunDir ) -> { group, update( t ), cover }.
//
// Event bus: none (the page drives update( t ) from its timeline).

import * as THREE from 'three/webgpu';

const SCALE = 100, ALT = 1050, PROXY_Y = 15;
// It stops behind the beach: the sun is behind it too, so only there does
// the hull's shadow fall on the sand (it sweeps in from the lagoon).
const FROM = new THREE.Vector3( 600, ALT + 250, 6500 ), TO = new THREE.Vector3( - 600, ALT, - 650 ); // its shadow centre then lands near x 0, z 25

// Projection along the light L onto the plane y = h: P' = P - L ( P.y - h ) / L.y
function shearOnto( L, h ) {

	const k = 1 / L.y;
	return new THREE.Matrix4().set(
		1, - L.x * k, 0, L.x * k * h,
		0, 0, 0, h,
		0, - L.z * k, 1, L.z * k * h,
		0, 0, 0, 1 );

}

export function createShip( prop, scene, sunDir ) {

	const group = new THREE.Group();
	group.name = 'ship';
	const model = prop.scene.clone( true );
	model.scale.setScalar( SCALE );
	model.rotation.y = Math.PI; // its nose is +z in the GLB: it flies toward the land (-z)
	model.traverse( ( o ) => { if ( o.isMesh ) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false; } } );
	group.add( model );
	scene.add( group );

	// The shadow proxy: a second copy whose world matrix is set by hand.
	const proxy = prop.scene.clone( true );
	const hidden = new THREE.MeshBasicNodeMaterial( { colorWrite: false, depthWrite: false } );
	proxy.traverse( ( o ) => { if ( o.isMesh ) { o.material = hidden; o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } } );
	proxy.matrixAutoUpdate = false;
	scene.add( proxy );
	const shear = shearOnto( sunDir.clone().normalize(), PROXY_Y );

	const api = { group, model, proxy, cover: 0, t: 0 };
	api.update = ( t ) => {

		api.t = t;
		const e = 1 - Math.pow( 1 - Math.min( 1, Math.max( 0, t ) ), 3 ); // eases out: it brakes on arrival
		group.position.lerpVectors( FROM, TO, e );
		group.visible = t > 0;
		proxy.visible = t > 0;
		group.updateMatrixWorld( true );
		// The proxy copies each part's world matrix, sheared onto the plane.
		model.updateMatrixWorld( true );
		proxy.matrix.multiplyMatrices( shear, model.matrixWorld );
		proxy.updateMatrixWorld( true );
		// Cover: how far the shadow's centre has come over the bay (0 out at
		// sea, 1 when the hull's middle shades the beach).
		const L = sunDir.clone().normalize();
		const gx = group.position.x - L.x * group.position.y / L.y, gz = group.position.z - L.z * group.position.y / L.y;
		api.cover = THREE.MathUtils.smoothstep( - Math.hypot( gx, gz ), - 1900, - 300 );

	};

	api.update( 0 );
	return api;

}
