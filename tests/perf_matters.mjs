// Cost of every lit matter of the cube wall, WebGPU only, repeated runs.
// Adds what tests/bench.mjs leaves out: pipeline compile time, WGSL size,
// GPU memory as three.js counts it, JS heap, CPU submit time of the whole
// wall, and the CPU cost of the 3D hair window (raycast) per hairy host.
// Needs the dev server. Other GPU users inflate the times: run it several
// times and keep the spread (docs/performance.md).
//   IX_URL=http://localhost:5240/cubes.html node tests/perf_matters.mjs out.json [runs] [frames]

import { writeFileSync } from 'node:fs';
import { launchBrowser } from './chromium.mjs';

const out = process.argv[ 2 ] ?? 'perf_matters.json';
const RUNS = + ( process.argv[ 3 ] ?? 3 );
const FRAMES = + ( process.argv[ 4 ] ?? 20 );
const BASE = process.env.IX_URL ?? 'http://localhost:5211/cubes.html';

const browser = await launchBrowser();
const page = await browser.newPage( { viewport: { width: 1280, height: 720 } } );
page.on( 'pageerror', ( e ) => console.error( 'page error:', e.message ) );
const cdp = await page.context().newCDPSession( page );
await cdp.send( 'Performance.enable' );
const heap = async () => {

	const { metrics } = await cdp.send( 'Performance.getMetrics' );
	const m = Object.fromEntries( metrics.map( ( x ) => [ x.name, x.value ] ) );
	return { jsHeapUsedMB: + ( m.JSHeapUsedSize / 1e6 ).toFixed( 1 ), jsHeapTotalMB: + ( m.JSHeapTotalSize / 1e6 ).toFixed( 1 ) };

};

// three.js classes taken from live objects: a bare import would load a
// second copy of three. RenderTarget comes from the post pass.
await page.addInitScript( () => {

	window.__ixTHREE = () => ( {
		RenderTarget: window.__ix.post.hairPass.renderTarget.constructor,
		Mesh: window.__ix.meshes[ 0 ].constructor,
		MeshStandardMaterial: window.__ix.scene.children.find( ( o ) => o.isMesh && o.material.isMeshStandardMaterial ).material.constructor,
		HalfFloatType: 1016,
	} );

} );
const t0 = Date.now();
await page.goto( `${ BASE }?film` );
await page.waitForFunction( () => window.__ix?.ready, null, { timeout: 180000 } );
const result = { loadToReadyMs: Date.now() - t0, heapAfterBuild: await heap() };

// Compile each lit cube (with its fuzz and hair children) in view, then
// read its WGSL. The bench target format (rgba16float) is used so the bench
// reuses these pipelines.
Object.assign( result, await page.evaluate( async () => {

	const { renderer, scene, camera, meshes } = window.__ix;
	const THREE = window.__ixTHREE();
	const mem = () => ( { ...renderer.info.memory } );
	const mem0 = mem();
	const rt = new THREE.RenderTarget( 1920, 1080, { type: THREE.HalfFloatType } );
	renderer.setRenderTarget( rt );
	camera.aspect = 16 / 9;
	camera.updateProjectionMatrix();
	const per = [];
	for ( const m of meshes ) {

		const P = m.position;
		camera.position.set( P.x, P.y, P.z + 0.15 + 0.6 );
		camera.lookAt( P.x, P.y, P.z );
		camera.updateMatrixWorld();
		const p0 = renderer.info.memory.programs;
		const t = performance.now();
		await renderer.compileAsync( m, camera, scene );
		const ms = performance.now() - t;
		const sh = await renderer.debug.getShaderAsync( scene, camera, m );
		per.push( {
			name: m.name, family: m.userData.ix.family, compileMs: + ms.toFixed( 1 ),
			programs: renderer.info.memory.programs - p0,
			fragKB: + ( sh.fragmentShader.length / 1024 ).toFixed( 1 ), vertKB: + ( sh.vertexShader.length / 1024 ).toFixed( 1 ),
			fragLines: sh.fragmentShader.split( '\n' ).length,
			hair: !! m.userData.ix.hair, fuzz: !! m.userData.ix.fuzzMaterial,
		} );

	}

	renderer.setRenderTarget( null );
	rt.dispose();
	return { compile: per, memoryBefore: mem0, memoryAfterCompile: mem() };

} ) );
result.heapAfterCompile = await heap();
console.log( `compiled ${ result.compile.length } matters, load ${ result.loadToReadyMs } ms` );

// GPU time per matter, repeated. Same views as __ix.bench() in
// demo/cubes.js (30 cm, 2 cm, 1.5 mm, 1920x1080 target, timestamp queries),
// with its own grey baseline cube: the wall has no grey cube left.
const benchOnce = ( frames ) => page.evaluate( async ( frames ) => {

	const { renderer, scene, camera, meshes } = window.__ix;
	const THREE = window.__ixTHREE();
	const SIZE = 0.3, dists = [ 0.3, 0.02, 0.0015 ];
	const rt = new THREE.RenderTarget( 1920, 1080, { type: THREE.HalfFloatType } );
	camera.aspect = 1920 / 1080;
	camera.updateProjectionMatrix();
	renderer.setRenderTarget( rt );
	camera.layers.enable( 7 ); // HAIR_LAYER
	const greyMat = new THREE.MeshStandardMaterial( { color: 0x3b3d43, roughness: 0.85 } );
	const greyCube = new THREE.Mesh( meshes[ 0 ].geometry, greyMat );
	greyCube.position.set( -6, SIZE / 2, 6 );
	scene.add( greyCube );
	const one = async () => {

		await renderer.renderAsync( scene, camera );
		return renderer.resolveTimestampsAsync( 'render' );

	};
	const median = async () => {

		for ( let i = 0; i < 4; i ++ ) await one();
		const times = [];
		for ( let i = 0; i < frames; i ++ ) times.push( await one() );
		times.sort( ( a, b ) => a - b );
		return + times[ times.length >> 1 ].toFixed( 3 );

	};
	const measure = async ( P, d ) => {

		camera.position.set( P.x + d * 0.15, P.y + d * 0.25, P.z + SIZE / 2 + d );
		camera.up.set( 0, 1, 0 );
		camera.lookAt( P.x, P.y, P.z + SIZE / 2 );
		return median();

	};
	const out = { dists, baseline: [], matters: [] };
	for ( const d of dists ) out.baseline.push( await measure( greyCube.position, d ) );
	for ( const m of meshes ) {

		const ms = [];
		for ( const d of dists ) ms.push( await measure( m.position, d ) );
		out.matters.push( { name: m.name, family: m.userData.ix.family, ms } );

	}

	// The whole wall in view, from above.
	const c = camera.position.clone().set( 0, 0, 0 );
	meshes.forEach( ( m ) => c.add( m.position ) );
	c.multiplyScalar( 1 / meshes.length );
	camera.position.set( c.x, 12, c.z + 16 );
	camera.lookAt( c.x, 0, c.z );
	out.wall = await median();
	scene.remove( greyCube );
	greyMat.dispose();
	renderer.setRenderTarget( null );
	camera.layers.disable( 7 );
	rt.dispose();
	return out;

}, frames );

const save = () => writeFileSync( out, JSON.stringify( result, null, 1 ) );
save();
result.bench = [];
for ( let r = 0; r < RUNS; r ++ ) {

	const tb = Date.now();
	result.bench.push( await benchOnce( FRAMES ) );
	save();
	console.log( `bench run ${ r + 1 }/${ RUNS }: ${ ( ( Date.now() - tb ) / 1000 ).toFixed( 0 ) } s` );

}

result.memoryAfterBench = await page.evaluate( () => ( { ...window.__ix.renderer.info.memory } ) );
result.heapAfterBench = await heap();

// CPU: submit time of the whole wall in view (every cube on screen), with
// the Infinitex materials, then with every lit cube grey. And the 3D hair
// window update per hairy host, near (strands on) and far.
result.cpu = await page.evaluate( async () => {

	const { renderer, scene, camera, meshes } = window.__ix;
	const THREE = window.__ixTHREE();
	const rt = new THREE.RenderTarget( 1920, 1080, { type: THREE.HalfFloatType } );
	renderer.setRenderTarget( rt );
	const c = camera.position.clone().set( 0, 0, 0 );
	meshes.forEach( ( m ) => c.add( m.position ) );
	c.multiplyScalar( 1 / meshes.length );
	camera.position.set( c.x, 9, c.z + 14 );
	camera.lookAt( c.x, 0, c.z );
	const submit = async ( n = 60 ) => {

		const ts = [];
		renderer.info.autoReset = true;
		for ( let i = 0; i < n + 5; i ++ ) {

			camera.position.x = c.x + Math.sin( i ) * 0.01; // defeat the hair window cache
			const t = performance.now();
			renderer.render( scene, camera );
			const dt = performance.now() - t;
			await renderer.readRenderTargetPixelsAsync( rt, 0, 0, 1, 1 );
			if ( i >= 5 ) ts.push( dt );

		}

		ts.sort( ( a, b ) => a - b );
		return { medianMs: + ts[ ts.length >> 1 ].toFixed( 3 ), p90Ms: + ts[ Math.floor( ts.length * 0.9 ) ].toFixed( 3 ), drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles };

	};

	const out = { wall: await submit() };
	// Hair window update cost, per hairy host.
	const hairy = meshes.filter( ( m ) => m.userData.ix.hair );
	const time = ( fn, n = 200 ) => { const t = performance.now(); for ( let i = 0; i < n; i ++ ) fn( i ); return ( performance.now() - t ) / n; };
	const near = [], far = [];
	for ( const m of hairy ) {

		const P = m.position, h = m.userData.ix.hair;
		near.push( time( ( i ) => { camera.position.set( P.x + 1e-4 * Math.sin( i ), P.y, P.z + 0.15 + 0.02 ); camera.lookAt( P.x, P.y, P.z ); camera.updateMatrixWorld(); h.update( renderer, scene, camera ); } ) );
		far.push( time( ( i ) => { camera.position.set( P.x + 1e-3 * Math.sin( i ), P.y + 1, P.z + 5 ); camera.lookAt( P.x, P.y, P.z ); camera.updateMatrixWorld(); h.update( renderer, scene, camera ); } ) );

	}

	const med = ( a ) => a.slice().sort( ( x, y ) => x - y )[ a.length >> 1 ];
	out.hairHosts = hairy.length;
	out.hairUpdateNearMs = + med( near ).toFixed( 4 );
	out.hairUpdateFarMs = + med( far ).toFixed( 4 );
	out.hairUpdateNearMaxMs = + Math.max( ...near ).toFixed( 4 );
	out.cubeTriangles = meshes[ 0 ].geometry.index.count / 3;
	// Same wall, every lit cube grey: what the Infinitex materials add to
	// the CPU side (node updates, uniform groups, hair windows).
	camera.position.set( c.x, 9, c.z + 14 );
	camera.lookAt( c.x, 0, c.z );
	const grey = new THREE.MeshStandardMaterial( { color: 0x3b3d43, roughness: 0.85 } );
	const saved = meshes.map( ( m ) => [ m, m.material, [ ...m.children ] ] );
	for ( const [ m ] of saved ) { m.material = grey; m.children.forEach( ( k ) => { k.visible = false; } ); }
	out.wallGrey = await submit();
	for ( const [ m, mat, kids ] of saved ) { m.material = mat; kids.forEach( ( k ) => { k.visible = true; } ); }
	renderer.setRenderTarget( null );
	rt.dispose();
	return out;

} );

await browser.close();
writeFileSync( out, JSON.stringify( result, null, 1 ) );
console.log( `wrote ${ out }` );
