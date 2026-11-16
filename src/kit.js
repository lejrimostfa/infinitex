// Material kit: everything a family needs, from one import.
//   in this repository   import { ... } from '../../kit.js';
//   in a game project    import { ... } from 'infinitex/kit';
// A family built only on these helpers gets the Infinitex behaviour for
// free: footprint LOD, fades, real branches, roughness from faded slopes,
// specular anti-aliasing, surface states. Rules and numbers: docs/authoring.md.

export { footprint, fadeIn, fadeOn, gate, pick, composeRoughness, specularAA, perturbNormal, surfaceGradient, UP } from './core/lod.js';
export { applySurface, SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from './core/surface.js';
export { hash1, hash3, valueNoise, wrapId, WRAP } from './core/hash.js';
export { voronoi } from './core/voronoi.js';
export { ixTime } from './core/clock.js';
export { defineParams } from './kit/params.js';
export { finishNodes } from './kit/finish.js';
export { registerFamily, listFamilies, familyEvents } from './registry.js';
