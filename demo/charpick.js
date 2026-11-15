// Character picker: the concept mannequin (index.html) and the game
// characters (character.html?c=<name>). A game character is listed only
// when its list and its model are there: neither is published, so the
// public build shows no picker at all.
//
// Event bus: none. Picking a character loads its page (each one builds its
// own materials and shaders, so a reload is the clean switch).

const CONCEPT = { id: 'concept', label: 'Concept mannequin', href: 'index.html' };
// The game characters live in characters/list.js, which is not published:
// the glob finds nothing there and the picker stays hidden.
const lists = import.meta.glob( './characters/list.js' );

// current: id of the character on this page. Adds a <select> under the
// panel title once the available models are known.
export async function addCharacterPicker( current ) {

	const games = await Promise.all( Object.values( lists ).map( ( load ) => load().then( ( m ) => m.default ) ) );
	const CHARACTERS = [ CONCEPT, ...games.flat() ];
	const avail = await Promise.all( CHARACTERS.map( async ( c ) => {

		if ( ! c.model ) return true;
		try {

			const r = await fetch( c.model, { method: 'HEAD' } );
			return r.ok && ! ( r.headers.get( 'content-type' ) ?? '' ).includes( 'text/html' );

		} catch {

			return false;

		}

	} ) );
	const list = CHARACTERS.filter( ( c, i ) => avail[ i ] );
	if ( list.length < 2 ) return;

	const sel = document.createElement( 'select' );
	sel.id = 'ix-character';
	sel.style.cssText = 'width:100%;margin:0 0 8px;background:#2a2c31;color:inherit;border:1px solid #3a3d44;border-radius:5px;padding:4px 6px;font:inherit';
	for ( const c of list ) sel.add( new Option( c.label, c.id, false, c.id === current ) );
	sel.onchange = () => {

		const c = list.find( ( x ) => x.id === sel.value );
		location.href = c.href;

	};
	const title = document.querySelector( '#panel h1' );
	title.after( sel );

}
