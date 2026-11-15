// Light from a hot matter: the colour of a black body at K kelvin (T. Helland's
// fit of Charity's blackbody colour table, 1000 to 4000 K, scaled to 0..1) and its
// brightness. Visible radiance climbs very fast with the temperature
// (Wien), so a cherry 800 K ember is dim and a 1100 K one bright orange.
// Below about 700 K nothing glows. Kept moderate for ACES tone mapping.

import { vec3, float, log, clamp, smoothstep } from 'three/tsl';

export function blackbody( K ) {

	const t = K.div( 100 );
	const g = clamp( log( t ).mul( 0.3901 ).sub( 0.6318 ), 0, 1 );
	const b = clamp( log( t.sub( 10 ).max( 1e-3 ) ).mul( 0.5432 ).sub( 1.1962 ), 0, 1 ).mul( smoothstep( 19, 21, t ) );
	return vec3( 1, g, b );

}

// Emitted light of a black body at K, times `power` (an ember of 1000 K
// emits about 2.5).
export function glowAt( K, power = 1 ) {

	const r = K.div( 1000 );
	return blackbody( K ).mul( r.pow( 6 ).mul( 2.5 ).mul( smoothstep( 680, 820, K ) ) ).mul( float( power ) );

}
