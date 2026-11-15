// Links between the public demos, a loading note, and a warning on phones.
// Imported first by main.js, cubes.js and aquarium.js. Hidden in film mode.
// The loading note goes away when the page sets window.__ix.ready.
//
// Event bus: none (polls window.__ix.ready, set by each page).

const PAGES = [
	[ 'index.html', 'Knit' ],
	[ 'cubes.html', 'All matters' ],
	[ 'aquarium.html', 'Water' ],
];
const REPO = 'https://github.com/lejrimostfa/infinitex';

const css = `
#ix-nav { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; gap: 4px; padding: 4px;
	background: rgba(16,17,20,.82); border: 1px solid #2a2c31; border-radius: 9px; font: 13px system-ui, sans-serif; z-index: 10; }
#ix-nav a { color: #e8e6e3; text-decoration: none; padding: 5px 10px; border-radius: 6px; white-space: nowrap; }
#ix-nav a:hover { background: #2a2c31; }
#ix-nav a.on { background: #d9a441; color: #101114; font-weight: 600; }
#ix-note { position: fixed; left: 50%; top: 45%; transform: translate(-50%,-50%); max-width: 360px; text-align: center;
	color: #e8e6e3; font: 14px/1.5 system-ui, sans-serif; background: rgba(16,17,20,.9); border: 1px solid #2a2c31;
	border-radius: 10px; padding: 14px 18px; z-index: 11; }
#ix-note small { color: #9a9ca3; }
body.film #ix-nav, body.film #ix-note { display: none; }
@media (max-width: 720px) { #panel, #stats { display: none; } }
`;

const style = document.createElement( 'style' );
style.textContent = css;
document.head.appendChild( style );

const here = location.pathname.split( '/' ).pop() || 'index.html';
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
			? 'The cubes appear as their materials compile: up to a minute or two on the first visit. Then scroll to zoom, drag to orbit.'
			: 'The first visit takes a few seconds. Scroll to zoom, drag to orbit.' ) + '</small>';
document.body.appendChild( note );

// Progress line under the loading note, for pages that compile in steps
// (cubes.js reveals its matters a few per frame).
export function setLoadingProgress( text ) {

	const head = document.querySelector( '#ix-note .progress' );
	if ( head ) head.textContent = text;

}

const poll = setInterval( () => { if ( window.__ix?.ready ) { clearInterval( poll ); note.remove(); } }, 200 );
