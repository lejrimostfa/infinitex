// CPU check of the liquid volume geometry (core/fillgeometry.js,
// core/fillcap.js): volumes against closed forms, timing. No GPU.
//   node tests/kit_volume.mjs
import { LatheGeometry, SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { prepareCavity, clipCavity, signedVolume } from '../src/core/fillgeometry.js';
import { capGeometry, netArea } from '../src/core/fillcap.js';

const vol = ( cav, y ) => { const { tris, loops, level } = clipCavity( cav, y ); return signedVolume( tris ) + level * netArea( loops ) / 3; };
const cases = [];
// A closed cylinder (lathe of the inner profile, closed at both ends), r 3 cm, 10 cm high, half full.
const r = 0.03, H = 0.1;
const cyl = prepareCavity( new LatheGeometry( [ new Vector2( 0, 0 ), new Vector2( r, 0 ), new Vector2( r, H ), new Vector2( 0, H ) ], 96 ) );
cases.push( [ 'cylinder half', vol( cyl, H / 2 ), Math.PI * r * r * H / 2 * ( Math.sin( 2 * Math.PI / 96 ) / ( 2 * Math.PI / 96 ) ) ] );
// A sphere bottle, R 5 cm, filled to y = 0 (half) and y = 0.025.
const R = 0.05, sph = prepareCavity( new SphereGeometry( R, 128, 96 ) );
const cap = ( h ) => Math.PI * h * h * ( 3 * R - h ) / 3;
cases.push( [ 'sphere half', vol( sph, 0 ), cap( R ) ] );
cases.push( [ 'sphere 3/4 height', vol( sph, 0.025 ), cap( 0.075 ) ] );
// A torus lying flat, cut through its tube: two loops, one a hole.
const T = prepareCavity( new TorusGeometry( 0.05, 0.015, 48, 96 ).rotateX( Math.PI / 2 ) );
cases.push( [ 'torus half', vol( T, 0 ), Math.PI * Math.PI * 0.05 * 0.015 * 0.015 ] );
let bad = 0;
for ( const [ name, got, want ] of cases ) {

	const err = Math.abs( got - want ) / want;
	bad += err > 0.01;
	console.log( `${ name.padEnd( 20 ) } ${ ( got * 1e6 ).toFixed( 2 ).padStart( 9 ) } cm3  expected ${ ( want * 1e6 ).toFixed( 2 ).padStart( 9 ) }  error ${ ( err * 100 ).toFixed( 2 ) }%${ err > 0.01 ? '  FAIL' : '' }` );

}

const t0 = performance.now();
const { loops } = clipCavity( sph, 0.01 );
const c = capGeometry( loops, 0.01, [ 0.0007, 0.0016, 0.0033, 0.006, 0.0095 ] );
const ms = performance.now() - t0;
console.log( `sphere ${ sph.index.count / 3 } triangles: clip + cap ${ ms.toFixed( 1 ) } ms, cap ${ c.geometry.index.count / 3 } triangles, ${ loops.length } loop` );
const tl = clipCavity( T, 0 ).loops;
const tc = capGeometry( tl, 0, [ 0.0007, 0.0016 ] );
console.log( `torus: ${ tl.length } loops, cap ${ tc.geometry.index.count / 3 } triangles` );
process.exit( bad ? 1 : 0 );
