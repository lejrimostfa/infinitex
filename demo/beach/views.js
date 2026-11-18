// Preset cameras of the paper beach (demo/beach.js). Each puts the eye at
// a height above the ground or the water, and looks at a target.
//   beach   standing on the sand, looking out over the lagoon
//   sea     from the water, 1 m up, looking back at the beach
//   under   diving in the lagoon, 1.2 m down, toward the reef
//   props   by the water, looking at the hut, the pier and the palms
//   high    a wide view from 60 m, the whole bay
//
// Event bus: none (the page calls view( name )).

export function createViews( { camera, controls, sandHeight } ) {

	const at = ( x, z, up ) => [ x, Math.max( sandHeight( x, z ), 0 ) + up, z ];
	const VIEWS = {
		beach: { eye: at( - 6, - 12, 1.7 ), target: [ 4, 0.5, 30 ] },
		sea: { eye: [ 2, 1.0, 30 ], target: [ - 4, 1.5, - 8 ] },
		under: { eye: [ 0, - 1.2, 20 ], target: [ 4, - 1.8, 40 ] },
		props: { eye: at( 6, - 1, 2.2 ), target: [ - 12, 2, - 12 ] },
		high: { eye: [ - 70, 60, - 60 ], target: [ 0, 0, 30 ] },
	};

	function view( name ) {

		const v = VIEWS[ name ] ?? VIEWS.beach;
		camera.position.set( ...v.eye );
		controls.target.set( ...v.target );
		camera.lookAt( controls.target );
		controls.update();

	}

	return { view, VIEWS };

}
