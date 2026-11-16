// Shared demo shell: panel, buttons, stats, film and test hooks, and the
// render loop. Used by main.js (mannequin), cubes.js and character.js.
// The camera (walk, collisions, lens, adaptive resolution, SSAO) is the
// camera kit (src/camera, through camerakit.js).
// UI wiring goes through events:
//   sliders -> ix.set() -> 'paramsChanged' -> panel and stats refresh.
//   SSAO button <- the kit's post.enabled (a button state, not an event).

import * as TSL from 'three/tsl';
import { buildPanel } from './panel.js';
import { setTime } from '../src/core/clock.js';
import { createStats } from './stats.js';
import { createDemoKit } from './camerakit.js';

const { vec3 } = TSL;

// animate( t ): poses the scene at time t (seconds).
export function startApp( { ctx, ix, meshes, fuzz, film, animate: poseScene, params, panel = null, statsLevels = true } ) {

	// Every animation step also moves the shared material clock (core/clock.js).
	const animate = ( t ) => { setTime( t ); poseScene( t ); };

	const { renderer, scene, camera, controls, updateClip } = ctx;
	const forceWebGL = params.has( 'webgl' );
	const filmMode = params.has( 'film' );
	const keep = ( drop ) => { const q = new URLSearchParams( params ); for ( const k of drop ) q.delete( k ); return q; };

	const albedoNode = ix.material.colorNode;
	const levelNode = vec3( ix.debug.w1, ix.debug.w2, ix.debug.w3 );
	let levelView = false;
	function setLevelView( on ) {

		levelView = on;
		ix.material.colorNode = on ? levelNode : albedoNode;
		ix.material.needsUpdate = true;

	}

	buildPanel( panel ?? ix );
	document.getElementById( 'debug' ).onclick = () => setLevelView( ! levelView );
	const backendBtn = document.getElementById( 'backend' );
	backendBtn.textContent = forceWebGL ? 'Use WebGPU' : 'Use WebGL2';
	backendBtn.onclick = () => { const q = keep( [ 'webgl' ] ); if ( ! forceWebGL ) q.set( 'webgl', '' ); location.search = q.toString(); };
	const fuzzBtn = document.getElementById( 'fuzz' );
	fuzzBtn.textContent = fuzz.length ? 'Fuzz off' : 'Fuzz on';
	fuzzBtn.onclick = () => { const q = keep( [ 'nofuzz' ] ); if ( fuzz.length ) q.set( 'nofuzz', '' ); location.search = q.toString(); };

	// Zoom button: plays the film camera path in real time.
	let dolly = null;
	document.getElementById( 'dolly' ).onclick = () => { dolly = { t0: performance.now(), dur: 24000 }; };

	// The camera kit: walk, collisions, lens, adaptive resolution, SSAO
	// (src/camera). The walk and the controls hold still during the dolly.
	const kit = createDemoKit( { renderer, scene, camera, controls, params } );
	const { post, adaptive, walk, lens } = kit;
	const stats = createStats( { renderer, camera, ix, fuzz, meshes, post, adaptive, backend: forceWebGL ? 'WebGL2' : 'WebGPU', levels: statsLevels } );
	const aoBtn = document.getElementById( 'ssao' );
	const aoLabel = () => { aoBtn.textContent = post.enabled ? 'SSAO off' : 'SSAO on'; };
	aoBtn.onclick = () => { post.enabled = ! post.enabled; aoLabel(); };
	aoLabel();
	if ( params.has( 'noao' ) ) { post.enabled = false; aoLabel(); }

	// Animation clock in seconds. The film recorder sets it per frame.
	let animT = 0, last = performance.now();
	let loop;

	// Test and film hooks for Playwright (tests/).
	window.__ix = {
		ix, renderer, camera, scene, meshes, fuzz, setLevelView, TSL, film, post, animate, adaptive, kit, walk, lens, controls,
		ready: true,
		async runGate( heights ) {

			if ( ! ctx.gate ) throw new Error( 'this demo has no gate swatch' );
			const { runGate } = await import( '../tests/gate.js' );
			renderer.setAnimationLoop( null );
			try {

				return await runGate( ctx, heights );

			} finally {

				renderer.setAnimationLoop( loop );

			}

		},
		// Frame time at 1920x1080 with the wool filling the screen. Each frame
		// reads one pixel back, which waits for the GPU: an upper bound that
		// includes the readback round trip.
		async perf( frames = 60 ) {

			const { perfRun } = await import( '../tests/perf.js' );
			renderer.setAnimationLoop( null );
			try {

				return await perfRun( ctx, film, frames );

			} finally {

				renderer.setAnimationLoop( loop );

			}

		},
		// Recorder: pose and render one frame of the film.
		async filmFrame( k, t ) {

			renderer.setAnimationLoop( null );
			animate( t );
			const d = film.pose( k );
			film.overlay( d );
			post.update( d );
			await post.renderAsync();

		},
	};

	camera.lookAt( controls.target );
	loop = () => {

		const now = performance.now();
		const dt = ( now - last ) / 1000;
		animT += Math.min( 0.1, dt );
		last = now;
		animate( animT );

		let dist = null;
		const scripted = !! dolly;
		if ( dolly ) {

			const k = Math.min( 1, ( now - dolly.t0 ) / dolly.dur );
			dist = film.pose( k );
			if ( k >= 1 ) {

				dolly = null;
				controls.target.copy( camera.position ).addScaledVector( camera.getWorldDirection( new ctx.THREE.Vector3() ), dist );

			}

		}

		kit.update( dt, { move: ! scripted, dist } );
		dist ??= updateClip();
		stats.beginFrame();
		// The frame draws to the screen. A background compile (demo/warmup.js,
		// three r187 compileAsync) leaves its own target and MRT set while it
		// yields: a frame drawn then built a pipeline for the wrong targets.
		renderer.setRenderTarget( null );
		renderer.setMRT( null );
		kit.render();
		stats.endFrame( dist );

	};
	if ( ! filmMode ) renderer.setAnimationLoop( loop );
	return window.__ix;

}
