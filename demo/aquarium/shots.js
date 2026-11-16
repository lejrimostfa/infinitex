// The aquarium's camera places and film paths (demo/aquarium.js).
//   createShots( { camera, controls, LEVEL, TD } )
//   returns  { view( name ), dive( t ), glassPan( t, dur ) }
// ?view=above | below | floor | glass | lens.
//
// Event bus: none (called by the page and by the film script).

export function createShots( { camera, controls, LEVEL, TD } ) {

	const VIEWS = {
		above: { pos: [ 0.55, 0.95, 0.95 ], look: [ 0, 0.12, 0 ] },
		below: { pos: [ - 0.35, 0.12, 0.28 ], look: [ 0.1, 0.42, - 0.15 ] },
		floor: { pos: [ - 0.5, 0.06, 0.3 ], look: [ 0.2, 0.08, - 0.2 ] },
		glass: { pos: [ - 0.15, LEVEL - 0.02, TD / 2 + 0.35 ], look: [ 0.05, LEVEL - 0.05, 0 ] }, // the aquarium waterline
		lens: { pos: [ - 0.3, LEVEL + 0.004, 0.25 ], look: [ 0.25, LEVEL - 0.02, - 0.2 ] }, // camera half in
	};
	function view( name ) {

		const v = VIEWS[ name ] ?? VIEWS.above;
		camera.position.set( ...v.pos );
		controls.target.set( ...v.look );
		camera.lookAt( ...v.look );

	}

	// The dive (film): from above the tank down through the surface to the
	// driftwood post, slow and level, no turn of the camera. It lingers half
	// in the water (6 to 11 s): the port straddles the line, which rides the
	// waves across the frame.
	const ease = ( x ) => x * x * ( 3 - 2 * x );
	const seg = ( t, t0, t1, a, b ) => a + ( b - a ) * ease( Math.min( 1, Math.max( 0, ( t - t0 ) / ( t1 - t0 ) ) ) );
	function dive( t ) {

		const y = t < 6 ? seg( t, 0, 6, 0.62, LEVEL + 0.012 ) : t < 11 ? seg( t, 6, 11, LEVEL + 0.012, LEVEL - 0.012 ) : seg( t, 11, 16, LEVEL - 0.012, 0.16 );
		const k = seg( t, 0, 16, 0, 1 );
		camera.position.set( - 0.38 + 0.3 * k, y, 0.33 - 0.2 * k );
		controls.target.set( 0.3, 0.16 + 0.12 * Math.min( 1, Math.max( 0, ( 0.62 - y ) / 0.3 ) ), - 0.18 );
		camera.lookAt( controls.target );

	}

	// Along the glass (film, second shot): a slow sideways track at the
	// waterline, the camera never turns; the thick water top bends the tank.
	function glassPan( t, dur = 8 ) {

		const k = seg( t, 0, dur, 0, 1 );
		camera.position.set( - 0.32 + 0.5 * k, LEVEL + 0.004 - 0.008 * k, TD / 2 + 0.08 );
		controls.target.set( camera.position.x + 0.12, LEVEL - 0.01, 0 );
		camera.lookAt( controls.target );

	}

	return { view, dive, glassPan };

}
