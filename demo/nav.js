// Links between the public demos, a loading note, and a warning on phones.
// The note is a small pill at the top: the scene stays visible while it loads.
// Imported first by main.js, character.js, cubes.js and aquarium.js. Hidden in film mode.
// The loading note goes away when the page sets window.__ix.ready.
//
// Event bus: none (polls window.__ix.ready, set by each page).

const PAGES = [
	[ 'character.html', 'Knit' ], // the riveraine; index.html (the concept mannequin) is in its picker
	[ 'cubes.html', 'All matters' ],
	[ 'aquarium.html', 'Water' ],
	[ 'livingroom.html', 'Room' ],
	[ 'beach.html', 'Beach' ],
];
const REPO = 'https://github.com/lejrimostfa/infinitex';

const css = `
#ix-nav { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; gap: 4px; padding: 4px;
	background: rgba(16,17,20,.82); border: 1px solid #2a2c31; border-radius: 9px; font: 13px system-ui, sans-serif; z-index: 10; }
#ix-nav a { color: #e8e6e3; text-decoration: none; padding: 5px 10px; border-radius: 6px; white-space: nowrap; }
#ix-nav a:hover { background: #2a2c31; }
#ix-nav a.on { background: #d9a441; color: #101114; font-weight: 600; }
#ix-note { position: fixed; left: 50%; top: 12px; transform: translateX(-50%); max-width: min(520px, calc(100vw - 32px)); text-align: center;
	color: #e8e6e3; font: 12px/1.4 system-ui, sans-serif; background: rgba(16,17,20,.72); border: 1px solid #2a2c31;
	border-radius: 8px; padding: 5px 12px; z-index: 11; pointer-events: none; }
#ix-note small { color: #9a9ca3; font-size: 11px; }
body.film #ix-nav, body.film #ix-note { display: none; }
@media (max-width: 720px) { #panel, #stats { display: none; } }
`;

const style = document.createElement( 'style' );
style.textContent = css;
document.head.appendChild( style );

const here = ( ( p ) => p === 'index.html' ? 'character.html' : p )( location.pathname.split( '/' ).pop() || 'index.html' ); // both knit pages light Knit
const nav = document.createElement( 'nav' );
nav.id = 'ix-nav';
nav.innerHTML = PAGES.map( ( [ href, label ] ) => `<a href="${ href }"${ href === here ? ' class="on"' : '' }>${ label }</a>` ).join( '' )
	+ `<a href="${ REPO }" target="_blank" rel="noopener">GitHub</a>`;
document.body.appendChild( nav );

const phone = matchMedia( '(pointer: coarse)' ).matches && Math.min( screen.width, screen.height ) < 820;
const note = document.createElement( 'div' );
note.id = 'ix-note';
note.innerHTML = '<span class="progress">Compiling the materials on your GPU…</span><br><small>'
	+ ( phone ? 'Phones are not fast enough yet: expect a slow frame rate. A desktop browser with WebGPU works best.'
		: here === 'cubes.html' && ! location.search.includes( 'family' )
			? 'The cubes light up as they compile. Scroll to zoom, drag to orbit.'
			: 'The first visit takes a few seconds. Scroll to zoom, drag to orbit.' ) + '</small>';
document.body.appendChild( note );

// Progress line under the loading note, for pages that compile in steps
// (cubes.js reveals its matters a few per frame).
export function setLoadingProgress( text ) {

	const head = document.querySelector( '#ix-note .progress' );
	if ( head ) head.textContent = text;

}

const poll = setInterval( () => { if ( window.__ix?.ready ) { clearInterval( poll ); note.remove(); } }, 200 );
