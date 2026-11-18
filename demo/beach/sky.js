// The paper beach's sky (demo/beach.js): a tropical afternoon. The
// aquarium's daySky (core/watersurface.js) is a pale temperate sky,
// bright at the horizon: the sea mirrors it at grazing angles, so the
// lagoon read white from the sand. Here the horizon is a light cyan and the
// zenith a saturated blue, a little darker overall.
// Same signature as daySky: sky( dir ) for the background, the water's
// mirror fallback and the window seen from under the surface.
//
// Event bus: none.

import { vec3, mix, smoothstep } from 'three/tsl';

export function tropicalSky( sunDir, { gain = 1.0 } = {} ) {

	return ( dir ) => {

		const d = dir.normalize();
		const up = d.y.max( 0 );
		let c = mix( vec3( 0.52, 0.76, 0.93 ), vec3( 0.06, 0.27, 0.78 ), up.pow( 0.45 ) ).mul( gain );
		const s = d.dot( sunDir.normalize() ).max( 0 );
		c = c.add( vec3( 1.0, 0.95, 0.82 ).mul( s.pow( 1200 ).mul( 40 ).add( s.pow( 10 ).mul( 0.35 ) ) ) );
		// A thin bright band right at the horizon, the haze over the sea.
		c = c.add( vec3( 0.25, 0.3, 0.32 ).mul( smoothstep( 0.12, 0.0, up ) ) );
		const ground = vec3( 0.12, 0.2, 0.22 );
		return mix( ground, c, smoothstep( - 0.02, 0.01, d.y ) );

	};

}
