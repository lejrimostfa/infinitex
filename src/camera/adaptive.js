// Adaptive resolution, a part of the camera kit (kit.js). Infinitex shades every pixel, so the
// cost follows the pixel count: on a Retina screen (pixel ratio 2) a heavy
// matter filling the screen took 110 to 220 ms per frame, against 8 ms at
// pixel ratio 1. This lowers the pixel ratio by steps while frames are
// slow, and raises it back when the next step up is predicted to stay fast.
//
//   max    min( devicePixelRatio, cap ), the starting ratio. cap 2 by
//          default; a page that does not need Retina density lowers it
//          (the beach: 1.25, with FXAA for the edges)
//   min    0.75
//   down   mean frame over 0.5 s above 40 ms: one step of 0.25
//   up     mean frame times (next / current)^2 under 25 ms for 1.5 s
//
// Gaps longer than 2 s are ignored (hidden tab). A shader compile stall
// may cost one step, which comes back once frames are fast. The demos
// turn it off with ?fullres and in film mode. Film and bench hooks stop
// the render loop, so they never call frame() and keep the full ratio.
//
// Event bus: dispatches 'pixelRatioChanged' { ratio, max } on the returned
// object; the kit forwards it. The aquarium listens to resize its
// waterline targets; the stats panel reads the ratio from the renderer.

export function createAdaptiveResolution( renderer, { enabled = true, cap = 2 } = {} ) {

	const max = Math.min( devicePixelRatio, cap ), min = Math.min( 0.75, max ), STEP = 0.25;
	if ( renderer.getPixelRatio() > max ) renderer.setPixelRatio( max ); // the stage starts at min( devicePixelRatio, 2 )
	const DOWN_MS = 40, UP_MS = 25, WINDOW_MS = 500, UP_HOLD_MS = 1500, SKIP = 3;
	const bus = new EventTarget();
	let ratio = max, last = 0, sum = 0, n = 0, windowStart = 0, fastSince = 0, skip = SKIP;

	function set( r ) {

		ratio = r;
		renderer.setPixelRatio( r );
		skip = SKIP; // the resize itself makes the next frames slow
		sum = n = 0;
		fastSince = 0;
		bus.dispatchEvent( new CustomEvent( 'pixelRatioChanged', { detail: { ratio: r, max } } ) );

	}

	// Call once per displayed frame, from the page's render loop.
	function frame() {

		const now = performance.now();
		const dt = now - last;
		last = now;
		if ( ! enabled || bus.hold || dt > 2000 || dt <= 0 ) { windowStart = now; return; }
		if ( skip > 0 ) { skip --; windowStart = now; return; }
		sum += dt;
		n ++;
		if ( now - windowStart < WINDOW_MS ) return;
		const mean = sum / n;
		sum = n = 0;
		windowStart = now;
		if ( mean > DOWN_MS && ratio > min ) { set( Math.max( min, ratio - STEP ) ); return; }
		const next = Math.min( max, ratio + STEP );
		if ( next > ratio && mean * ( next / ratio ) ** 2 < UP_MS ) {

			if ( ! fastSince ) fastSince = now;
			else if ( now - fastSince >= UP_HOLD_MS ) set( next );

		} else fastSince = 0;

	}

	// hold = true while a page compiles its shaders (slow frames that say
	// nothing about the steady cost).
	bus.hold = false;
	return Object.assign( bus, { frame, max, enabled } );

}
