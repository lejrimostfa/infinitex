// infinitex/camera: the camera kit. See docs/camera.md.
//   createCameraKit( { renderer, scene, camera, controls, dom, options } )
//   createCameraStage( options ), applyCameraSettings( { renderer, camera, controls } )
// The parts are exported too, for a game that wants only one of them.

export { createCameraKit, KIT_DEFAULTS, lensDefault } from './kit.js';
export { createCameraStage, applyCameraSettings, RENDERER_OPTIONS, CAMERA_SETTINGS } from './stage.js';
export { createWalk } from './walk.js';
export { createCollider } from './collide.js';
export { createLens } from './lens.js';
export { createAdaptiveResolution } from './adaptive.js';
export { createPost } from './post.js';
export { createDofPipeline, withDof, followLens } from './dof.js';
export { createTargetPost } from './targetpost.js';
export { createSunCascades } from './shadows.js';
