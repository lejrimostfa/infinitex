// Stats panel, top left, collapsible. Shared by every demo page (knit,
// character, all matters, water). Reads the renderer's counters once per
// frame and refreshes the text four times a second.
//
//   fps and frame time       from requestAnimationFrame timing
//   GPU time                 WebGPU timestamp queries, when available
//   draw calls, triangles    renderer.info, reset by hand once per frame
//   resolution, pixel ratio  the canvas size actually shaded
//   distance, pixel size     camera to the orbit target, one pixel in meters
//   detail levels            knit only (opts.levels): pixels per period
//
// The header always shows the fps. A click on it folds the rest away; the
// choice is kept per browser.
//
// Event bus: listens to the material's 'paramsChanged' (when ix is given)
// to know the current preset. The page calls beginFrame / endFrame( dist )
// around each render.

const bar = ( px ) => {

	const w = Math.min( 1, Math.max( 0, ( px - 2 ) / 4 ) );
	return `<span class="bar"><i style="width:${ ( w * 100 ).toFixed( 0 ) }%"></i></span>`;

};
const fmtN = ( n ) => n >= 1e6 ? `${ ( n / 1e6 ).toFixed( 2 ) } M` : n >= 1e3 ? `${ ( n / 1e3 ).toFixed( 1 ) } k` : `${ n }`;
const fmtLen = ( m ) => m >= 0.01 ? `${ ( m * 100 ).toFixed( 1 ) } cm` : m >= 1e-3 ? `${ ( m * 1000 ).toFixed( 2 ) } mm` : `${ ( m * 1e6 ).toFixed( 1 ) } um`;

const CSS = `
#stats .head { display: flex; align-items: baseline; gap: 8px; cursor: pointer; user-select: none; }
#stats .head .fold { margin-left: auto; color: #9a9ca3; font-size: 11px; }
#stats.closed { min-width: 0; }
#stats.closed .body { display: none; }
`;
const KEY = 'ix-stats-closed';
const load = () => { try { return localStorage.getItem( KEY ) === '1'; } catch { return false; } };
const save = ( v ) => { try { localStorage.setItem( KEY, v ? '1' : '0' ); } catch { /* private window: no memory */ } };

export function createStats( { renderer, camera, ix = null, fuzz = [], meshes = [], post = null, backend, levels = true } ) {

	const el = document.getElementById( 'stats' );
	el.style.display = '';
	const style = document.createElement( 'style' );
	style.textContent = CSS;
	document.head.appendChild( style );
	el.innerHTML = '<div class="head"><span class="big"></span><span class="ms dim"></span><span class="fold"></span></div><div class="body"></div>';
	const head = el.querySelector( '.head' ), bigEl = el.querySelector( '.big' ), msEl = el.querySelector( '.ms' );
	const foldEl = el.querySelector( '.fold' ), body = el.querySelector( '.body' );
	const setClosed = ( c ) => { el.classList.toggle( 'closed', c ); foldEl.textContent = c ? 'details ▸' : 'hide ▾'; };
	setClosed( load() );
	head.onclick = () => { const c = ! el.classList.contains( 'closed' ); setClosed( c ); save( c ); };

	renderer.info.autoReset = false;
	const tris = ( list ) => list.reduce( ( s, m ) => s + ( m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count ) / 3, 0 );
	const meshTris = tris( meshes ), fuzzTris = tris( fuzz );
	let frames = 0, t0 = performance.now(), last = t0, frameMs = 0, worstMs = 0, fps = 0, gpuMs = null, nextText = 0;
	let preset = ix?.preset, derived = ix?.state.derived;
	ix?.addEventListener( 'paramsChanged', ( e ) => { preset = e.detail.preset; derived = e.detail.derived; } );

	function beginFrame() {

		renderer.info.reset();

	}

	function endFrame( dist ) {

		const now = performance.now();
		const dt = now - last;
		frameMs = frameMs * 0.9 + dt * 0.1;
		worstMs = Math.max( worstMs, dt );
		last = now;
		frames ++;
		if ( now - t0 > 500 ) {

			fps = frames * 1000 / ( now - t0 );
			frames = 0;
			t0 = now;
			if ( renderer.backend.trackTimestamp ) {

				renderer.resolveTimestampsAsync( 'render' ).then( ( ms ) => { if ( ms ) gpuMs = ms; } ).catch( () => {} );

			}

		}

		if ( now < nextText ) return;
		nextText = now + 250;
		bigEl.textContent = `${ fps.toFixed( 0 ) } fps`;
		msEl.textContent = `${ frameMs.toFixed( 1 ) } ms`;
		const slowest = worstMs;
		worstMs = 0;
		if ( el.classList.contains( 'closed' ) ) return;

		const info = renderer.info.render;
		const pr = renderer.getPixelRatio();
		const pxSize = 2 * dist * Math.tan( camera.fov * Math.PI / 360 ) / ( innerHeight * pr );
		const w = renderer.domElement.width, h = renderer.domElement.height;
		const knit = levels && preset?.family === 'knit';
		const plyPeriod = knit ? 1 / ( preset.ply_count * preset.ply_twist_per_cm * 100 ) : 0;
		const level = ( name, period ) => `<div>${ name } ${ bar( period / pxSize ) } ${ ( period / pxSize ).toFixed( 1 ) } px</div>`;
		const gpu = gpuMs !== null && gpuMs >= 0 && gpuMs < 1e4 ? `, GPU ${ gpuMs.toFixed( 1 ) } ms` : '';
		body.innerHTML = `
			<div>frame ${ frameMs.toFixed( 1 ) } ms${ gpu }</div>
			<div class="dim">slowest frame (0.25 s) ${ slowest.toFixed( 0 ) } ms</div>
			<div>triangles ${ fmtN( info.triangles ) }, draw calls ${ info.drawCalls }</div>
			${ meshTris ? `<div class="dim">Infinitex meshes ${ fmtN( meshTris ) }${ fuzzTris ? ` + fuzz shells ${ fmtN( fuzzTris ) }` : '' }</div>` : '' }
			<div class="dim">${ w } x ${ h } (pixel ratio ${ pr }), ${ backend }${ post ? `, SSAO ${ post.enabled ? 'on' : 'off' }` : '' }</div>
			<hr>
			<div>distance ${ fmtLen( dist ) }, pixel ${ fmtLen( pxSize ) }</div>
			${ knit ? level( 'stitch', derived.stitchW ) + level( 'ply&nbsp;&nbsp;&nbsp;', plyPeriod ) + level( 'fiber&nbsp;', preset.fiber_diameter_um * 1e-6 ) + level( 'scales', preset.fiber_diameter_um * 0.43e-6 ) : '' }`;

	}

	return { beginFrame, endFrame };

}
