// Camera kit check (src/camera) on every demo page, WebGPU and WebGL2.
//   IX_URL=http://localhost:5212/ node tests/camera_check.mjs [page ...]
// Per page and backend:
//   load     no page error; a plain load keeps the lens off and the fov fixed
//   walk     W held into the surface at the screen centre: the camera stops
//            1e-4 m from it, perpendicular to the surface (exact three.js raycast, 5 % tolerance); cost
//            of walk.update (BVH collision included) per frame
//   lens     (?dof) fov unchanged at 1 m and 30 cm, 22 deg at 3 cm, back
//            without a jump; near-to-far switch with no jump; cost of the
//            focus ray per frame; frame cost with depth of field on and off
// Writes tests/camera-report.json, exits 1 on a failed assertion.

import { writeFileSync } from 'node:fs';
import { launchBrowser } from './chromium.mjs';

const BASE = process.env.IX_URL ?? 'http://localhost:5212/';
const PAGES = process.argv.slice( 2 ).length ? process.argv.slice( 2 ) : [ 'index.html', 'cubes.html?family=10', 'character.html', 'livingroom.html', 'aquarium.html' ];
const MARGIN = 1e-4, STEP_MAX = 1; // m; degrees per frame at 60 fps

const browser = await launchBrowser();
const report = {};
const fails = [];
const check = ( ok, what ) => { if ( ! ok ) fails.push( what ); return ok ? 'ok' : 'FAIL'; };
const url = ( p, extra ) => BASE + p + ( extra ? ( p.includes( '?' ) ? '&' : '?' ) + extra : '' );

async function open( p, extra ) {

	const page = await browser.newPage( { viewport: { width: 1280, height: 720 } } );
	const errors = [];
	page.on( 'pageerror', ( e ) => errors.push( e.message ) );
	await page.goto( url( p, extra ) );
	await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 300000 } );
	await page.waitForTimeout( 3000 ); // the collider builds its trees in idle time from 1 s
	return { page, errors };

}

const probe = ( page, fn, arg, file = '/tests/camera_probe.js' ) => page.evaluate( async ( [ fn, arg, file ] ) => ( await import( file ) )[ fn ]( window.__ix, arg ), [ fn, arg, file ] );

for ( const p of PAGES ) for ( const backend of [ 'webgpu', 'webgl' ] ) {

	const tag = `${ p } ${ backend }`;
	const be = backend === 'webgl' ? 'webgl' : '';
	const r = report[ tag ] = {};
	try {

		// Plain load: what the gate, films and benches see.
		let { page, errors } = await open( p, be );
		r.plain = await probe( page, 'plainCheck' );
		r.plain.check = check( r.plain.lensOn !== true && Math.abs( r.plain.fov - r.plain.base ) < 1e-6, `${ tag }: plain load changed the fov or turned the lens on` );
		r.walk = await probe( page, 'walkCheck' );
		const sd = r.walk.stopDist;
		// MARGIN perpendicular to the surface (static meshes: the kit knows the
		// normal), or along the view (skinned meshes); never closer than that.
		// A displaced surface (sand) is measured to its flat mesh: add its bound.
		const pad = r.walk.pad ?? 0, cl = r.walk.clearance === null ? null : r.walk.clearance - pad;
		const near = ( x ) => x !== null && Math.abs( x - MARGIN ) / MARGIN < 0.05;
		r.walk.check = check( sd !== null && sd > MARGIN * 0.95 && cl <= MARGIN * 1.05 && ( near( cl ) || near( sd - pad ) ), `${ tag }: walk stopped at ${ sd } m (clearance ${ cl } m)` );
		if ( r.walk.animatedMinDist !== undefined ) r.walk.animatedCheck = check( r.walk.animatedMinDist > 0, `${ tag }: went through the animated character` );
		r.errorsPlain = errors;
		check( ! errors.length, `${ tag }: page errors (plain): ${ errors.join( ' | ' ) }` );
		await page.close();

		// With the lens asked for.
		( { page, errors } = await open( p, [ be, 'dof' ].filter( Boolean ).join( '&' ) ) );
		const L = r.lens = await probe( page, 'lensCheck' );
		if ( ! L.error ) {

			const same = ( a ) => Math.abs( a.fov - L.baseFov ) < 0.01;
			L.check = [
				check( same( L.at1m ) && L.at1m.maxStep < 0.01, `${ tag }: fov moved at 1 m (${ L.at1m.fov })` ),
				check( same( L.at30cm ) && L.at30cm.maxStep < 0.01, `${ tag }: fov moved at 30 cm (${ L.at30cm.fov })` ),
				check( Math.abs( L.at3cm.fov - 22 ) < 0.1 && L.at3cm.maxStep < STEP_MAX, `${ tag }: fov at 3 cm ${ L.at3cm.fov }, step ${ L.at3cm.maxStep }` ),
				check( same( L.back1m ) && L.back1m.maxStep < STEP_MAX, `${ tag }: fov back at 1 m ${ L.back1m.fov }, step ${ L.back1m.maxStep }` ),
				check( same( L.nearToFar ) && L.nearToFar.maxStep < STEP_MAX, `${ tag }: near to far fov ${ L.nearToFar.fov }, step ${ L.nearToFar.maxStep }` ),
			].join( ' ' );

		} else check( false, `${ tag }: lens ${ L.error }` );

		// Felt approach speed, wheel through a surface, orbit at a surface.
		const A = r.approach = await probe( page, 'approachCheck', null, '/tests/camera_probe_approach.js' );
		if ( ! A.error ) A.check = [
			check( A.keysFelt.max < 1.3 && A.keysFelt.min > 0.3, `${ tag }: walk felt speed ${ A.keysFelt.min.toFixed( 2 ) } to ${ A.keysFelt.max.toFixed( 2 ) } per s` ),
			check( ! A.wheel.crossed && A.wheel.stepMax / A.wheel.stepMin < 1.15, `${ tag }: wheel crossed ${ A.wheel.crossed }, step ${ A.wheel.stepMin.toFixed( 3 ) } to ${ A.wheel.stepMax.toFixed( 3 ) }` ),
			check( A.orbit.every( ( x ) => x === 0 ), `${ tag }: orbit crossed a surface ${ A.orbit.join( ', ' ) } times` ),
		].join( ' ' );
		else check( false, `${ tag }: approach ${ A.error }` );

		r.errorsLens = errors;
		check( ! errors.length, `${ tag }: page errors (lens): ${ errors.join( ' | ' ) }` );
		await page.close();

	} catch ( e ) {

		r.error = e.message.slice( 0, 300 );
		check( false, `${ tag }: ${ r.error }` );

	}

	const w = r.walk ?? {}, L = r.lens ?? {};
	console.log( `\n${ tag }` );
	console.log( `  plain   lens ${ r.plain?.lensOn } fov ${ r.plain?.fov } ${ r.plain?.check }` );
	console.log( `  walk    ${ w.surface } from ${ w.startDist } m, stop ${ w.stopDist?.toExponential( 4 ) } m (clearance ${ w.clearance?.toExponential( 3 ) } m, pad ${ ( w.pad ?? 0 ).toExponential( 2 ) } m) in ${ w.frames } frames ${ w.check }; first call ${ w.firstMs } ms; ms/frame ${ JSON.stringify( w.staticMs ) }` );
	if ( w.animatedMs ) console.log( `  walk animated  ms/frame ${ JSON.stringify( w.animatedMs ) }, closest ${ w.animatedMinDist?.toExponential( 3 ) } m ${ w.animatedCheck }` );
	if ( L.at1m ) {

		console.log( `  fov     base ${ L.baseFov }: 1 m ${ L.at1m.fov }, 30 cm ${ L.at30cm.fov }, 3 cm ${ L.at3cm.fov } (step ${ L.at3cm.maxStep }), back ${ L.back1m.fov } (step ${ L.back1m.maxStep }), near to far ${ L.nearToFar.fov } (step ${ L.nearToFar.maxStep }, far ${ L.nearToFar.farDist }) ${ L.check }` );
		console.log( `  focus   ms/frame ${ JSON.stringify( L.lensMs ) }` );
		const A = r.approach;
		if ( A && ! A.error ) console.log( `  approach walk felt ${ A.keysFelt.min.toFixed( 2 ) } to ${ A.keysFelt.max.toFixed( 2 ) } /s; wheel step ${ A.wheel.stepMin.toFixed( 3 ) } to ${ A.wheel.stepMax.toFixed( 3 ) }, crossed ${ A.wheel.crossed }, closest ${ A.wheel.minDist.toExponential( 2 ) } m; orbit crossings ${ A.orbit.join( ', ' ) } ${ A.check }` );
		console.log( `  dof     ${ JSON.stringify( L.dofMs ) }` );

	}

	if ( r.error || L.error ) console.log( `  error   ${ r.error ?? L.error }` );

}

await browser.close();
writeFileSync( new URL( './camera-report.json', import.meta.url ), JSON.stringify( { fails, report }, null, 2 ) );
console.log( fails.length ? `\nCAMERA CHECK FAILED\n  ${ fails.join( '\n  ' ) }` : '\nCAMERA CHECK PASSED' );
process.exit( fails.length ? 1 : 0 );
