// Where the paper props stand on the beach (demo/beach.js), after the
// concept painting (paper_beach_01/concept/beach.png): the hut on its
// stilts behind the sand, the pier from the shore into the lagoon with the
// canoe moored at its end, palms around the hut and along the beach, the
// parasol and its chair, a surfboard in the sand, tiki torches, rocks,
// shells by the water and a crab. x along the shore, d metres from the
// shore line (beach/terrain.js: < 0 on land, > 0 at sea).
// The props face +z (the sea) unless turned (yaw, radians).
//
// Event bus: none.

import { shoreZ, sandHeight } from './terrain.js';

// x, d -> world x, z.
const at = ( x, d ) => [ x, shoreZ( x ) + d ];

export const LAYOUT = [
	{ name: 'hut', x: - 16, d: - 13, yaw: 0.25 },
	{ name: 'pier', x: - 8, d: 5.5, yaw: 0, y: 0 },
	{ name: 'canoe', x: - 5.4, d: 9.5, yaw: Math.PI / 2 + 0.15, y: - 0.12 },
	{ name: 'palm', x: - 22, d: - 9, yaw: 0.4, s: 1.1 },
	{ name: 'palm', x: - 11, d: - 17, yaw: 2.1, s: 0.95 },
	{ name: 'palm', x: - 26, d: - 18, yaw: 4.0, s: 1.2 },
	{ name: 'palm', x: 3, d: - 11, yaw: 5.1, s: 1.0 },
	{ name: 'palm', x: 14, d: - 15, yaw: 1.2, s: 1.15 },
	{ name: 'palm', x: 24, d: - 9, yaw: 3.3, s: 0.9 },
	{ name: 'palm', x: - 34, d: - 12, yaw: 0.9, s: 1.0 },
	{ name: 'parasol', x: 4, d: - 6, yaw: - 0.4 },
	{ name: 'surfboard', x: 0.5, d: - 6.5, yaw: 0.3 },
	{ name: 'torch', x: - 6, d: - 7, yaw: 0 },
	{ name: 'torch', x: - 1.5, d: - 9, yaw: 1 },
	{ name: 'torch', x: 8, d: - 8, yaw: 2 },
	{ name: 'rocks', x: - 30, d: - 2, yaw: 0.5, s: 1.4 },
	{ name: 'rocks', x: 18, d: - 4, yaw: 2.5, s: 1.0 },
	{ name: 'rocks', x: 30, d: 1, yaw: 4.4, s: 1.8 },
	{ name: 'shells', x: - 1, d: - 2, yaw: 0.8 },
	{ name: 'shells', x: 9, d: - 2.5, yaw: 3.1 },
	{ name: 'crab', x: 2, d: - 3, yaw: 1.4 },
];

// The grove behind the beach: tall palms in a band 18 to 70 m from the
// shore, small ones (a third the size, fan palms in the undergrowth)
// between them and right to the edge of the sand. Seeded: the same grove
// every load. Kept off the hut, the parasol and the camera paths near x 0.
function grove( seed = 11 ) {

	let k = seed * 9301 + 49297;
	const rnd = () => ( k = ( k * 233280 + 49297 ) % 2147483647 ) / 2147483647;
	const out = [];
	const clear = ( x, d ) => ! ( Math.abs( x + 16 ) < 6 && d > - 20 ) && ! ( x > - 9 && x < 12 && d > - 16 );
	for ( let i = 0; i < 110; i ++ ) {

		const x = - 260 + rnd() * 520, d = - 18 - Math.pow( rnd(), 0.7 ) * 52;
		if ( clear( x, d ) ) out.push( { name: 'palm', x, d, yaw: rnd() * 6.28, s: 0.8 + rnd() * 0.55 } );

	}

	for ( let i = 0; i < 160; i ++ ) {

		const x = - 260 + rnd() * 520, d = - 13 - rnd() * 55;
		if ( clear( x, d ) ) out.push( { name: 'palm', x, d, yaw: rnd() * 6.28, s: 0.22 + rnd() * 0.18 } );

	}

	return out;

}

// Each entry with its world x, z and ground height.
export function placements( { dense = true } = {} ) {

	return ( dense ? [ ...LAYOUT, ...grove() ] : LAYOUT ).map( ( e ) => { const [ x, z ] = at( e.x, e.d ); return { ...e, x, z, ground: ( a, b ) => Math.max( sandHeight( a, b ), e.y ?? - 99 ) }; } );

}
