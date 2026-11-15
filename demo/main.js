// Knit demo: a mannequin in a knitted sweater, with fuzz shells.
// Panel, stats, SSAO, film and the loop live in app.js.
// URL flags: ?webgl (WebGL2 backend), ?nofuzz, ?film (recorder mode).

import { createMaterial } from '../src/index.js';
import { createScene } from './scene.js';
import { createFilm } from './film.js';
import { startApp } from './app.js';

const params = new URLSearchParams( location.search );
const forceWebGL = params.has( 'webgl' );
document.body.classList.toggle( 'film', params.has( 'film' ) );

const ix = createMaterial( { family: 'knit' } );
const ctx = await createScene( { forceWebGL, knitMaterial: ix.material } );
const { scene, camera, meshes, mannequin, swatch } = ctx;
const fuzz = params.has( 'nofuzz' ) ? [] : [ ...meshes, swatch ].map( ( m ) => ix.createFuzz( m ) );
const torso = meshes[ 0 ];
const { segS, segT } = torso.geometry.userData.grid;
const idx = Math.round( segS * 0.36 ) * ( segT + 1 ) + Math.round( segT * 0.45 ); // mid chest, front
const film = createFilm( {
	camera, scene,
	anchor: { mesh: torso, tri: [ idx, idx + 1, idx + segT + 1 ], uvName: 'uv', outward: new ctx.THREE.Vector3( 0, 0, 1 ) },
	farTarget: new ctx.THREE.Vector3( 0, 1.12, 0 ), farDir: new ctx.THREE.Vector3( 0.38, 0.14, 1 ).normalize(),
} );
ctx.gate.fuzz = fuzz;
ctx.gate.ix = ix;

startApp( { ctx, ix, meshes, fuzz, film, animate: ( t ) => mannequin.animate( t ), params } );
