// Stats panel, top left. Reads the renderer's counters once per frame and
// refreshes the text four times a second. Listens to 'paramsChanged' to
// know the current preset (stitch, ply and fiber sizes).
//
//   fps and CPU frame time   from requestAnimationFrame timing
//   GPU time                 WebGPU timestamp queries, when available
//   draw calls, triangles    renderer.info, reset by hand once per frame
//   triangles split          knit surface vs fuzz shells
//   levels                   pixels per period of each detail level

const bar = ( px ) => {

	const w = Math.min( 1, Math.max( 0, ( px - 2 ) / 4 ) );
	return `<span class="bar"><i style="width:${ ( w * 100 ).toFixed( 0 ) }%"></i></span>`;

};
const fmtN = ( n ) => n >= 1e6 ? `${ ( n / 1e6 ).toFixed( 2 ) } M` : n >= 1e3 ? `${ ( n / 1e3 ).toFixed( 1 ) } k` : `${ n }`;
const fmtLen = ( m ) => m >= 0.01 ? `${ ( m * 100 ).toFixed( 1 ) } cm` : m >= 1e-3 ? `${ ( m * 1000 ).toFixed( 2 ) } mm` : `${ ( m * 1e6 ).toFixed( 1 ) } um`;

export function createStats( { renderer, camera, ix, fuzz, meshes, post, backend } ) {

	const el = document.getElementById( 'stats' );
	renderer.info.autoReset = false;
	const tris = ( list ) => list.reduce( ( s, m ) => s + ( m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count ) / 3, 0 );
	const knitTris = tris( meshes ), fuzzTris = tris( fuzz );
	let frames = 0, t0 = performance.now(), last = t0, cpuMs = 0, fps = 0, gpuMs = null, nextText = 0;
	let preset = ix.preset, derived = ix.state.derived;
	ix.addEventListener( 'paramsChanged', ( e ) => { preset = e.detail.preset; derived = e.detail.derived; } );

	function beginFrame() {

		renderer.info.reset();

	}

	function endFrame( dist ) {

		const now = performance.now();
		cpuMs = cpuMs * 0.9 + ( now - last ) * 0.1;
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
		const info = renderer.info.render;
		const pxSize = 2 * dist * Math.tan( camera.fov * Math.PI / 360 ) / ( innerHeight * renderer.getPixelRatio() );
		const knit = preset.family === 'knit';
		const plyPeriod = knit ? 1 / ( preset.ply_count * preset.ply_twist_per_cm * 100 ) : 0;
		const level = ( name, period ) => `<div>${ name } ${ bar( period / pxSize ) } ${ ( period / pxSize ).toFixed( 1 ) } px</div>`;
		const w = renderer.domElement.width, h = renderer.domElement.height;
		el.innerHTML = `
			<div class="big">${ fps.toFixed( 0 ) } fps</div>
			<div>CPU frame ${ cpuMs.toFixed( 1 ) } ms${ gpuMs !== null ? `, GPU ${ gpuMs.toFixed( 1 ) } ms` : '' }</div>
			<div>triangles ${ fmtN( info.triangles ) }, draw calls ${ info.drawCalls }</div>
			<div class="dim">surface ${ fmtN( knitTris ) } + fuzz shells ${ fmtN( fuzzTris ) }</div>
			<div class="dim">${ w } x ${ h }, ${ backend }, SSAO ${ post.enabled ? 'on' : 'off' }</div>
			<hr>
			<div>distance ${ fmtLen( dist ) }, pixel ${ fmtLen( pxSize ) }</div>
			${ knit ? level( 'stitch', derived.stitchW ) + level( 'ply&nbsp;&nbsp;&nbsp;', plyPeriod ) + level( 'fiber&nbsp;', preset.fiber_diameter_um * 1e-6 ) + level( 'scales', preset.fiber_diameter_um * 0.43e-6 ) : `<div class="dim">${ preset.family }</div>` }`;

	}

	return { beginFrame, endFrame };

}
