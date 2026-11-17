// The submarine tour (tests/reel.mjs): about a minute and a half in the
// aquarium of the Water page. It opens outside (the sand seen through the
// surface, the post broken at the waterline, the meniscus on the front
// pane), then follows the toy submarine on a written path that skims the
// sand and the cubes, past the corals, the jellyfish, the kelp and the
// fish. Path, obstacles and camera: submarine_path.mjs. Nothing is steered
// by keys: setup() replaces the flyer's update, so every run is the same.
//   REEL_SECONDS  film length (default INTRO + TOUR + END)
import { buildTour, INTRO, TOUR, END } from './submarine_path.mjs';

export const url = '/aquarium.html?dof&fullres';
export const seconds = Number( process.env.REEL_SECONDS ?? INTRO + TOUR + END );
export const title = { text: 'The submarine tour', sub: 'An aquarium built in code. three.js, no texture files.', seconds: 4 };
export const end = { text: 'github.com/lejrimostfa/infinitex', sub: 'Open source, MIT. Press V in the live demo to steer it.', seconds: END };
export const captions = buildTour().captions;

export async function setup( ix ) {

	const { buildTour } = await import( '/tests/reels/submarine_path.mjs' );
	// The moving creatures, read live: the jellyfish (life.js order: school, silver, hero, jellies, crab) and the crab.
	const jellies = ix.life[ 3 ]?.group?.children ?? [], crab = ix.life.find( ( l ) => l.position && l.group );
	const tour = buildTour( { live: {
		jelly: ( i ) => jellies[ i ] ? jellies[ i ].position.toArray() : [ 0, 0.2, 0 ],
		crab: () => crab ? crab.position.toArray() : [ - 0.04, 0.03, 0.31 ],
	} } );
	window.__tour = tour;
	const v = ix.vehicle;
	if ( v ) v.update = ( dt, clock ) => {

		const s = tour.sub( tour.u ), g = v.model.group;
		v.position.set( ...s.p );
		g.position.set( ...s.p );
		g.rotation.set( s.pitch, s.yaw, s.roll, 'YXZ' );
		v.model.pose( clock, 0.5, 1 );

	};

}

export function pose( ix, t, dt ) {

	const { camera, controls } = ix, T = window.__tour;
	T.u = Math.max( 0, t - T.INTRO );
	const c = T.camera( t, dt );
	camera.position.set( ...c.p );
	controls.target.set( ...c.l );
	camera.lookAt( ...c.l );

}
