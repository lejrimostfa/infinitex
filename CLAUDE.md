# Infinitex: rules for this repository

## Every demo page uses the full lighting pipeline

Decided on 2026-11-18. A new demo page, or a rework of an old one, ships with all of this. A page without it is not finished.

Reference: Ben Houston, "Building the AAA Lighting Pipeline in Three.js" (https://ben3d.ca/blog/building-the-aaa-lighting-pipeline-in-threejs). What we use of it is in `docs/camera.md` (options table) and `docs/references.md` (aquarium mood).

| Stage | How | Where |
|---|---|---|
| Camera | `createDemoKit()`: walk, collisions, lens on damped springs (`focusTime`, `macroTime`), adaptive resolution | `demo/camerakit.js`, `src/camera/` |
| Occlusion | GTAO inside the lighting (`aoLit`, the kit default). Keep it when SSGI is on | `src/camera/post.js` |
| Temporal AA | `taa: true`. It replaces the scene pass's MSAA and averages the AO and SSGI noise | `src/camera/post.js` |
| Bounce light | `gi: true` for any interior, or any scene with a bright emitter. SSGI at half size, bounce only, gain `post.bounce` from 0.2 | `src/camera/post.js` |
| Sun shadows | cascades that follow the focus (`shadows`, the kit default) | `src/camera/shadows.js` |
| Bloom and grade | `grade: { ... }` on a page that draws its own frame (target mode) | `src/camera/grade.js` |
| Reflections in a box | a cube probe filled once, box-projected, for glass, mirrors or a polished floor | `demo/aquarium/tank.js`, `fillProbe` in `demo/aquarium.js` |
| Water | haze by direction, warm caustics, blue fill, rim light, shafts, marine snow | `src/core/underwater.js`, `shafts.js`, `snow.js` |

Rules that go with it:

- Each stage has a URL flag that turns it off (`?nogi`, `?notaa`, `?nograde`, `?nomood`, `?nomirror`). The cost is measured with the flag, never guessed.
- Measure the GPU cost with batches of draws between two `device.queue.onSubmittedWorkDone()`, several variants round robin, fastest batch. Frame times from `requestAnimationFrame` are useless when another program uses the GPU.
- Check both backends (`?webgl`), run `npm run gate` and `node tests/camera_check.mjs <page>` before a merge.
- Traps already met are in the header comments of the files above. Read them before changing a stage.

Not usable yet in three r187, do not build on them: Hi-Z tracing, the coverage cascade, pluggable indirect specular, the reflection probe system, DDGI visibility, bent normals. SSR (`SSRNode`) is in three but not wired here yet.
