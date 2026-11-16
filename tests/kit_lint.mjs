// The family lint (src/kit/check/lint.mjs) must catch each known trap.
// Copies the template family into a temporary folder, breaks one thing
// per copy, and checks that the lint names the right rule.
//   node tests/kit_lint.mjs
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintFamily } from '../src/kit/check/lint.mjs';

const TEMPLATE = new URL( '../src/families/terrazzo', import.meta.url ).pathname;
const root = mkdtempSync( join( tmpdir(), 'ix-lint-' ) );
const edit = ( dir, file, from, to ) => {

	const p = join( dir, file ), s = readFileSync( p, 'utf8' );
	if ( ! s.includes( from ) ) throw new Error( `kit_lint: "${ from }" not found in ${ file }` );
	writeFileSync( p, s.replace( from, to ) );

};

// [ name, expected rule, level, mutation ]
const CASES = [
	[ 'clean template', null, null, () => {} ],
	[ 'select()', 'select', 'error', ( d ) => edit( d, 'levels.js', 'const stone = pick( step( h.x, 1 / 3 ), u.color,', 'const stone = select( step( h.x, 1 / 3 ).greaterThan( 0 ), u.color,' ) ],
	[ 'dFdx in a gate build', 'deriv-gate', 'error', ( d ) => edit( d, 'levels.js', 'const w = fadeIn( gf, fp, 1.0, 4.0 );', 'const w = fadeIn( gf, fp, 1.0, 4.0 ).mul( dFdx( p.x ).add( 1 ) );' ) ],
	[ 'dFdy via a called function', 'deriv-gate', 'error', ( d ) => edit( d, 'fine.js', 'const w = fadeIn( P, fp, 2.0, 6.0 );', 'const w = fadeIn( P, fp, 2.0, 6.0 ).mul( dFdy( p.y ).add( 1 ) );' ) ],
	[ 'texture() in a gate build', 'deriv-gate', 'error', ( d ) => edit( d, 'fine.js', 'const V = voronoi( q1, J1 );', 'const V = voronoi( q1.add( texture( u.map, q1 ).x ), J1 );' ) ],
	[ 'footprint() in a gate build', 'deriv-gate', 'error', ( d ) => edit( d, 'fine.js', 'const aa = fp.div( u.grainM ).mul( 0.75 );', 'const aa = footprint( q1 ).div( u.grainM ).mul( 0.75 );' ) ],
	[ 'no footprint', 'footprint', 'error', ( d ) => edit( d, 'shader.js', 'const fp = footprint( p ).toVar( \'ix_fp\' );', 'const fp = float( 1e-4 );' ) ],
	[ 'no fades', 'fade', 'error', ( d ) => { for ( const f of [ 'levels.js', 'fine.js' ] ) { const p = join( d, f ); writeFileSync( p, readFileSync( p, 'utf8' ).replaceAll( 'fadeIn(', 'myWeight(' ) ); } } ],
	[ 'gate without fadeOn', 'fadeon', 'warn', ( d ) => edit( d, 'levels.js', 'gate( fadeOn( u.polishM, fp, 2.0 ),', 'gate( u.scratches.greaterThan( 0 ),' ) ],
	[ 'gate without shared', 'shared', 'warn', ( d ) => edit( d, 'levels.js', '() => scratches( p, fp, u, stone ), [ p, fp, stone ] );', '() => scratches( p, fp, u, stone ) );' ) ],
	[ 'sin hash', 'sin-hash', 'warn', ( d ) => edit( d, 'fine.js', 'const a = valueNoise(', 'const a = fract( sin( p.x.mul( 12.9 ) ).mul( 43758.5 ) ).add( valueNoise(' ) ],
];

let bad = 0;
console.log( 'case                          expected       found' );
for ( const [ name, rule, level, mutate ] of CASES ) {

	const dir = join( root, name.replace( /\W+/g, '_' ) );
	cpSync( TEMPLATE, dir, { recursive: true } );
	mutate( dir );
	const { issues } = lintFamily( dir );
	const hit = rule ? issues.find( ( i ) => i.rule === rule && i.level === level ) : null;
	const ok = rule ? !! hit : issues.length === 0;
	bad += ! ok;
	console.log( `${ name.padEnd( 30 ) }${ ( rule ? `${ rule } (${ level })` : 'nothing' ).padEnd( 22 ) }${ ok ? 'yes' : 'NO' }${ hit ? `  ${ hit.file }:${ hit.line ?? '' }` : rule ? '' : `  ${ issues.length } issues` }` );

}

rmSync( root, { recursive: true, force: true } );
console.log( bad ? `\n${ bad } traps missed` : '\nall traps caught' );
process.exit( bad ? 1 : 0 );
