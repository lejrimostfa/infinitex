#!/usr/bin/env node
// Scaffold a new material family from the template (src/families/terrazzo).
//   npm run new-family -- <name>                  in this repository: src/families/<name>
//   npx infinitex-new-family <name> [--dir d]     in a game project: ./families/<name>
// The copy imports the kit from '../../kit.js' here, from 'infinitex/kit'
// in a game. It is a working family (the terrazzo levels) that passes the
// check: change params.js and levels.js level by level, checking as you go
// (docs/authoring.md). Then register it:
//   import myMatter from './families/<name>/index.js';
//   registerFamily( '<name>', myMatter );

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );
const TEMPLATE = join( pkgRoot, 'src/families/terrazzo' );
const BUILTIN = readdirSync( join( pkgRoot, 'src/families' ) );
const args = process.argv.slice( 2 );
const name = args.find( ( a ) => ! a.startsWith( '--' ) && args[ args.indexOf( a ) - 1 ] !== '--dir' );
const dirOpt = args.includes( '--dir' ) ? args[ args.indexOf( '--dir' ) + 1 ] : null;

if ( ! name || ! /^[a-z][a-z0-9_]{1,31}$/.test( name ) ) {

	console.error( 'usage: infinitex-new-family <name> [--dir parent]\n  name: 2 to 32 characters, lower case letters, digits or _, starting with a letter' );
	process.exit( 2 );

}

if ( BUILTIN.includes( name ) ) { console.error( `infinitex-new-family: "${ name }" is a built-in family, pick another name` ); process.exit( 2 ); }

const inRepo = ( p ) => { const r = relative( pkgRoot, p ); return ! r.startsWith( '..' ) && ! isAbsolute( r ); };
const parent = resolve( process.cwd(), dirOpt ?? ( inRepo( process.cwd() ) ? join( pkgRoot, 'src/families' ) : 'families' ) );
const dest = join( parent, name );
if ( existsSync( dest ) ) { console.error( `infinitex-new-family: ${ dest } exists already` ); process.exit( 2 ); }

const kit = inRepo( dest ) ? relative( dest, join( pkgRoot, 'src/kit.js' ) ).split( '\\' ).join( '/' ) : 'infinitex/kit';
const Name = name.replace( /(^|_)([a-z0-9])/g, ( _, __, c ) => c.toUpperCase() );
const NAME = name.toUpperCase();
const head = `// Scaffolded from the terrazzo template (bin/infinitex-new-family.mjs).\n// The levels below are terrazzo's: replace them with those of ${ name },\n// coarse to fine, and run the check after each one (docs/authoring.md).\n`;

mkdirSync( dest, { recursive: true } );
for ( const f of readdirSync( TEMPLATE ).filter( ( f ) => f.endsWith( '.js' ) ) ) {

	let s = readFileSync( join( TEMPLATE, f ), 'utf8' );
	s = s.replaceAll( '../../kit.js', kit ).replaceAll( 'TERRAZZO', NAME ).replaceAll( 'Terrazzo', Name ).replaceAll( 'terrazzo', name );
	s = s.replace( "intent: 'polished Venetian terrazzo floor'", `intent: 'describe ${ name } in one line'` );
	writeFileSync( join( dest, f ), head + s );

}

const show = relative( process.cwd(), dest ) || '.';
console.log( `Created ${ show } (${ readdirSync( dest ).join( ', ' ) }), kit imported from '${ kit }'.

Next:
  1. Register it where you build materials:
       import ${ name } from './${ relative( process.cwd(), join( dest, 'index.js' ) ).split( '\\' ).join( '/' ) }';
       import { registerFamily, createMaterial } from '${ kit === 'infinitex/kit' ? 'infinitex' : relative( process.cwd(), join( pkgRoot, 'src/index.js' ) ).split( '\\' ).join( '/' ) }';
       registerFamily( '${ name }', ${ name } );
       const ix = createMaterial( { family: '${ name }' }, { coords: uv().mul( metersPerUV ) } );
  2. Edit params.js (real sizes in _mm or _um) and levels.js, one level at a time.
  3. Check it: ${ inRepo( dest ) ? `npm run check-family -- ${ show }` : `npx infinitex-check ${ show }` }` );
