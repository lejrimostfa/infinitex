// Terrazzo: the template family of the material kit (docs/authoring.md).
// Copy it with `npm run new-family -- <name>` (bin/infinitex-new-family.mjs),
// then change params.js and levels.js. This file is the impl that
// registerFamily( name, impl ) takes, the same shape as a built-in.

import { TERRAZZO, TERRAZZO_SLIDERS } from './params.js';
import { buildTerrazzoNodes } from './shader.js';

export default {
	defaults: TERRAZZO.defaults,
	uniforms: TERRAZZO.uniforms,
	apply: TERRAZZO.apply,
	build: buildTerrazzoNodes,
	sliders: TERRAZZO_SLIDERS,
	// Micro detail under the finest level (core/micro.js). generic: zero-mean
	// noise. granular darkens grain borders with a non-zero mean, which goes
	// away as each octave fades: up to 6.9 % mean shift at 1 mm on a rough,
	// dark copy of this family (agglomerated cork, measured with the check).
	micro: [ 'generic', 8e-6 ],
	// kind: what the check page puts behind it (opaque, transmissive, emissive).
	kind: 'opaque',
};
