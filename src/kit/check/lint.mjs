// Static lint of a family folder for the known traps (docs/authoring.md).
// Node only, no parser: comments are blanked, then calls are found with
// regexes and matched parentheses. Good enough for the house style; a
// false alarm can be silenced with a `// ix-lint-ok <rule>` comment on the line.
//   select       select() compiles to if/else and copies both subtrees
//   deriv-gate   dFdx, dFdy, fwidth, texture(), footprint(), specularAA()
//                or surfaceGradient() inside a gate() build, followed
//                through the functions of the folder it calls
//   footprint    no footprint() taken: nothing knows the pixel size
//   fade         no fadeIn(): levels pop instead of fading
//   gate         no gate(): faded levels still cost (warning)
//   fadeon       gate() without fadeOn() (warning)
//   shared       gate() without a `shared` list (warning)
//   roughness    neither composeRoughness() nor finishNodes() (warning)
//   specaa       neither specularAA() nor finishNodes() (warning)
//   sin-hash     fract( sin( ... ) ) hash: slow and wrong on some GPUs (warning)
//   size         file over 200 lines (warning, house rule)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DERIV = /\b(dFdx|dFdy|fwidth|texture|textureLoad|footprint|specularAA|surfaceGradient)\s*\(/g;

// Blank comments and strings, keep newlines (line numbers stay right).
function strip( src ) {

	return src.replace( /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, ( m ) => m.replace( /[^\n]/g, ' ' ) );

}

// Index of the parenthesis closing the one at `open`.
function close( s, open ) {

	let d = 0;
	for ( let i = open; i < s.length; i ++ ) {

		if ( s[ i ] === '(' || s[ i ] === '{' || s[ i ] === '[' ) d ++;
		else if ( s[ i ] === ')' || s[ i ] === '}' || s[ i ] === ']' ) { d --; if ( d === 0 ) return i; }

	}

	return s.length - 1;

}

// Top-level arguments of a call whose '(' is at `open`.
function args( s, open ) {

	const end = close( s, open ), out = [];
	let d = 0, start = open + 1;
	for ( let i = open + 1; i < end; i ++ ) {

		const c = s[ i ];
		if ( '({['.includes( c ) ) d ++;
		else if ( ')}]'.includes( c ) ) d --;
		else if ( c === ',' && d === 0 ) { out.push( { text: s.slice( start, i ), at: start } ); start = i + 1; }

	}

	out.push( { text: s.slice( start, end ), at: start } );
	return out.filter( ( a ) => a.text.trim() );

}

const lineOf = ( s, i ) => s.slice( 0, i ).split( '\n' ).length;

function listJs( dir ) {

	return readdirSync( dir ).flatMap( ( f ) => {

		const p = join( dir, f );
		return statSync( p ).isDirectory() ? listJs( p ) : /\.m?js$/.test( f ) ? [ p ] : [];

	} );

}

export function lintFamily( dir ) {

	const files = listJs( dir ).map( ( path ) => {

		const raw = readFileSync( path, 'utf8' );
		return { path, name: relative( dir, path ), raw, src: strip( raw ), lines: raw.split( '\n' ) };

	} );
	const issues = [];
	const add = ( rule, level, f, i, msg ) => {

		const line = i == null ? null : lineOf( f.src, i );
		if ( line && new RegExp( `ix-lint-ok\\b[^\\n]*\\b${ rule }\\b` ).test( f.lines[ line - 1 ] ) ) return;
		issues.push( { rule, level, file: f.name, line, msg } );

	};

	// Functions declared in the folder: name -> { file, body }.
	const fns = {};
	for ( const f of files ) {

		for ( const m of f.src.matchAll( /function\s+(\w+)\s*\(/g ) ) {

			const b = f.src.indexOf( '{', close( f.src, m.index + m[ 0 ].length - 1 ) );
			fns[ m[ 1 ] ] = { f, body: f.src.slice( b, close( f.src, b ) + 1 ) };

		}

		for ( const m of f.src.matchAll( /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g ) ) {

			let k = m.index + m[ 0 ].length;
			while ( /\s/.test( f.src[ k ] ?? '' ) ) k ++;
			const nl = f.src.indexOf( '\n', k );
			const end = '{('.includes( f.src[ k ] ) ? close( f.src, k ) + 1 : nl < 0 ? f.src.length : nl;
			const start = k;
			fns[ m[ 1 ] ] = { f, body: f.src.slice( start, end ) };

		}

	}

	// Derivatives in a gate build, through the folder's own calls (depth 4).
	const scan = ( text, chain, depth, seen, report ) => {

		for ( const m of text.matchAll( DERIV ) ) report( m[ 1 ], chain );
		if ( depth === 0 ) return;
		for ( const m of text.matchAll( /\b(\w+)\s*\(/g ) ) {

			const fn = fns[ m[ 1 ] ];
			if ( fn && ! seen.has( m[ 1 ] ) ) { seen.add( m[ 1 ] ); scan( fn.body, [ ...chain, m[ 1 ] ], depth - 1, seen, report ); }

		}

	};

	let all = '';
	for ( const f of files ) {

		all += f.src;
		for ( const m of f.src.matchAll( /\bselect\s*\(/g ) ) add( 'select', 'error', f, m.index, 'select() compiles to if/else and duplicates both subtrees: use pick( t, a, b ) from the kit' );
		for ( const m of f.src.matchAll( /\bfract\s*\(\s*sin\s*\(/g ) ) add( 'sin-hash', 'warn', f, m.index, 'fract( sin( x ) * big ) hash: use hash1, hash3 or valueNoise from the kit' );
		for ( const m of f.src.matchAll( /\bgate\s*\(/g ) ) {

			if ( /function\s+$/.test( f.src.slice( Math.max( 0, m.index - 10 ), m.index ) ) ) continue;
			const a = args( f.src, m.index + m[ 0 ].length - 1 );
			if ( a.length < 3 ) continue;
			if ( ! /\bfadeOn\s*\(/.test( a[ 0 ].text ) ) add( 'fadeon', 'warn', f, m.index, 'gate() condition without fadeOn( period, fp, lo ): the branch may not match the fade of its level' );
			if ( a.length < 4 ) add( 'shared', 'warn', f, m.index, 'gate() without a shared list: coordinates and footprint first met inside are computed twice' );
			const seen = new Set();
			scan( a[ 2 ].text, [], 4, seen, ( what, chain ) => add( 'deriv-gate', 'error', f, a[ 2 ].at, `${ what }() inside a gate() build${ chain.length ? ` (through ${ chain.join( ' -> ' ) })` : '' }: derivatives are undefined in non-uniform control flow. Take it before the gate and pass it in shared` ) );

		}

		if ( f.lines.length > 200 ) add( 'size', 'warn', f, null, `${ f.lines.length } lines: split it (house rule, 200)` );

	}

	const anyFile = files[ 0 ] ?? { name: dir, src: '', lines: [] };
	if ( ! files.length ) issues.push( { rule: 'files', level: 'error', file: dir, line: null, msg: 'no .js file in this folder' } );
	if ( ! /\bfootprint\s*\(/.test( all ) ) add( 'footprint', 'error', anyFile, null, 'no footprint( p ) taken: take it once in the shader, before any branch' );
	if ( ! /\bfadeIn\s*\(/.test( all ) ) add( 'fade', 'error', anyFile, null, 'no fadeIn(): every detail level must fade in with the footprint, or it shimmers and pops' );
	if ( ! /\bgate\s*\(/.test( all ) ) add( 'gate', 'warn', anyFile, null, 'no gate(): faded levels are computed and weighted by zero (soil: 6.9 ms against 1.5 ms at 10 m)' );
	const finish = /\bfinishNodes\s*\(/.test( all );
	if ( ! finish && ! /\bcomposeRoughness\s*\(/.test( all ) ) add( 'roughness', 'warn', anyFile, null, 'no composeRoughness(): faded slopes are lost, the far view turns too glossy' );
	if ( ! finish && ! /\bspecularAA\s*\(/.test( all ) ) add( 'specaa', 'warn', anyFile, null, 'no specularAA(): specular highlights sparkle on fine relief' );
	return { files: files.map( ( f ) => f.name ), issues };

}
