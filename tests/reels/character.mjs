// The character showcase (tests/reel.mjs): the flyover of the bronze-mask
// character (characters/chef.js, a private game model: needs it on disk), from the whole figure down to
// the wool fibres, the pores of the leather and the grains of the brass.
const T0 = 4, FLIGHT = 51, KEYS = 81; // the flight starts after the title; 81 s of keys in 51 s
export const url = '/character.html?c=chef&fly&dof&fullres';
export const seconds = Number( process.env.REEL_SECONDS ?? T0 + FLIGHT + 4 );
export const title = { text: 'Infinitex', sub: 'Zoom into a game character. No textures.', seconds: T0 };
export const end = { text: 'github.com/lejrimostfa/infinitex', sub: 'Procedural materials for three.js. Open source, MIT.', seconds: 4 };
const at = ( s ) => T0 + s * FLIGHT / KEYS;
export const captions = [
	[ at( 8 ), at( 13 ), 'A long wool coat' ],
	[ at( 13.5 ), at( 18 ), 'Twill weave, frost on the yarn' ],
	[ at( 18.5 ), at( 23 ), 'Wool fibres and ice crystals' ],
	[ at( 27 ), at( 31.5 ), 'A leather belt' ],
	[ at( 31.5 ), at( 36 ), 'Grain, creases and cracks' ],
	[ at( 39.5 ), at( 43.5 ), 'Leather edging on the hem' ],
	[ at( 47 ), at( 52 ), 'The pores of the leather' ],
	[ at( 55 ), at( 60.5 ), 'A brass helmet' ],
	[ at( 60.5 ), at( 65.5 ), 'Hammer marks and tarnish' ],
	[ at( 65.5 ), at( 70.5 ), 'Scratches and the grains of the alloy' ],
	[ at( 74 ), at( 81 ), 'From the character down to the fibres' ],
];
export function setup() {}
export const virtual = false; // filmFrame renders the frame itself
// The page's own film path, posed and rendered by its recorder hook (app.js).
export const pose = new Function( 'ix', 't', `return ix.filmFrame( Math.min( 1, Math.max( 0, ( t - ${ T0 } ) / ${ FLIGHT } ) ), t );` );
