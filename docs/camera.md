# Camera kit

`infinitex/camera` (`src/camera/`) is the camera of the demos, as a library. A game that uses Infinitex materials gets the same close-up camera in a few lines: walk keys, collisions, a macro lens with depth of field, ambient occlusion inside the lighting, sun shadows in cascades that follow the focus, and adaptive resolution. Each part can be turned off.

## Use it

```js
import * as THREE from 'three/webgpu';
import { createCameraStage, createCameraKit } from 'infinitex/camera';

const { renderer, camera, controls } = await createCameraStage();   // reversed depth, near 1 um
const scene = new THREE.Scene();
const kit = createCameraKit( { renderer, scene, camera, controls } );
kit.addEventListener( 'macroChanged', ( e ) => hud.classList.toggle( 'macro', e.detail.macro ) );

let last = performance.now();
renderer.setAnimationLoop( () => {

	const now = performance.now();
	kit.update( ( now - last ) / 1000 );   // walk, controls.update(), lens, AO radius, shadow cascades
	last = now;
	kit.render();                          // AO, hair pass, depth of field

} );
```

A game with its own renderer, camera and controls applies the settings instead of `createCameraStage()`:

```js
import { RENDERER_OPTIONS, applyCameraSettings } from 'infinitex/camera';

const renderer = new THREE.WebGPURenderer( { ...RENDERER_OPTIONS, antialias: true } );
applyCameraSettings( { renderer, camera, controls } );   // near 1e-6, far 100, controls limits
```

## The parts

| Part | Option | What it does | File |
|---|---|---|---|
| Walk | `walk` | Arrows, or WASD by physical key (ZQSD on AZERTY), move along the view direction. Looking down, forward goes down. Space and C rise and sink, Shift goes 3 times faster. A click (not a drag) on a mesh glides the camera to it in 0.7 s. Camera and orbit target move together. | `walk.js` |
| Speed scale | `speedScale` | Speed is 0.8 times the distance to the orbit target or to the surface ahead, whichever is smaller, per second. So the distance shrinks by the same share each second, far or at a stitch: the approach feels the same at every scale. `minSpeed` applies only when no surface is ahead (a floor made the last 2 cm four times faster). In the macro band the step shrinks by `lens.zoomGain`, the share the narrowing field already adds. Off: `maxSpeed / 3` everywhere. | `walk.js`, `lens.js` |
| Side limit | `speedScale` | The ray along the move misses a surface the camera slides along: a strafe over the floor, a walk beside a wall or another object. So the nearest other object in any direction (BVH closest point, `kit.collider.near( point, far, skip )`) also limits the speed to 0.8 of its distance per second. The object the ray hits is skipped: walking into it keeps the felt speed above. Only the part of the move that does not leave that object is limited, so backing away is never slowed. | `walk.js`, `nearest.js` |
| Collision | `collide` | A ray along the move finds the surface ahead. Each frame covers at most `1 - e^(-4 dt)` of the room left, so the camera slows down and stops 0.1 mm from any surface, measured perpendicular to it (a slanted approach stops sooner along the view). A guard checks every kit move and every OrbitControls gesture (orbit, wheel, pan) with a ray from the last safe position: nothing the user does goes through a surface. View buttons and page scripts may jump. | `collide.js`, `skinned.js`, `approach.js` |
| Wheel zoom | `collide` | Before each wheel step the orbit target slides along the view axis to the depth of the surface under the cursor. Each step then magnifies by the same factor (1.086 measured) far or near, wherever the target was. Without this, a target in front of the surface made the zoom crawl and stop in the air, and a target behind it made the zoom speed up and go through. | `approach.js` |
| Macro lens | `macro` | The field of view follows the distance to the surface at the screen centre. Above `macroFrom` it is the camera's own. Between `macroFrom` and `macroFull` it narrows to `macroFov`, then holds. | `lens.js` |
| Depth of field | `dof` | three's `DepthOfFieldNode`, focused on the nearest surface of a small autofocus area around the centre. The sharp zone is 1 times the focus distance at 1 cm and 3 times at 3 m, as with a real lens. | `lens.js`, `dof.js` |
| Adaptive resolution | `adaptive` | Lowers the pixel ratio by steps of 0.25 (down to 0.75) while the mean frame stays above 40 ms, raises it when the next step is predicted under 25 ms. | `adaptive.js` |
| AO | `ao`, `aoLit` | GTAO at half resolution, its radius 12 % of the subject distance. With `aoLit` the materials read the AO while they are lit: it dims the ambient light in full, then 55 % of it also dims the finished colour, which grounds objects in full sun. That ambient AO is the one of the frame before: a still frame must be drawn twice (`renderAsync( 2 )`). 3D hair strands draw in a pass of their own over it. | `post.js` |
| Sun shadows | `shadows` | The sun's shadow map in three cascades (three's `CSMShadowNode`, 2048 texels each): up to 2.5 times the subject distance, up to 10 times, then the rest to `shadowFar`. They move with the focus, so the fine one is always on the subject: at 40 cm from a fruit a texel is about half a millimetre. Rebuilt when the distance moves by 12 %. | `shadows.js` |
| Target mode | `target` | For a page that draws its own frame into a target with a depth texture (the aquarium's waterline mixes two scene passes). `render( rt )` applies GTAO from that depth (strength 0.8), the `shafts` light, then the depth of field. | `targetpost.js` |
| Bloom and grade | `grade` | Target mode only. After the depth of field: bloom of what exceeds a threshold, contrast, blue shadows and warm highlights, vibrance, vignette. `{}` is the default look, `null` none. Uniforms in `kit.post.grade.uniforms`; `water` (0 or 1) switches between the look in the air and under water. About 0.33 ms at 1080p. | `grade.js` |
| Bounce light | `gi` | SSGI (three's `SSGINode`) at half size: the light bounced from what is on screen, taken by the diffuse colour (an extra MRT target), added to the GTAO-shaded frame. Its own AO is not used: GTAO keeps the contacts. Gain `kit.post.bounce` (0.2: the frame is HDR, a sunset sky is many times a wall). About 2 to 3 ms at 1080p with `taa`. | `post.js` |
| Temporal AA | `taa` | TRAA (three's `TRAANode`): a sub-pixel jitter each frame, history reprojected by velocity (an extra MRT target). Smooth edges, and the SSGI and GTAO noise averaged in time. The scene pass then has no MSAA (TRAA copies its depth), so it costs nothing measurable. | `post.js` |

### The focus distance and the macro distance

Every frame the lens casts five rays through the collision BVH: the screen centre and four points 0.16 (in NDC) around it, as a camera's autofocus area. Hits beyond `maxFocus` (30 m) do not count.

- **Focus distance**: the nearest of the five hits. A figure a little off centre wins over the landscape behind it. It drives the depth of field, and the kit uses it as the subject distance for the AO radius and the shadow cascades.
- **Macro distance**: the centre ray only. The field of view adapts to the observed surface, not to something at the edge of the area.

When the rays hit nothing, the orbit target stands in, with a deeper and weaker blur. Both distances follow their target in log space with a critically damped spring (`focusTime` 0.4 s, `macroTime` 0.45 s), like a focus puller: the move starts slowly, travels, and lands slowly. The field of view is followed again (0.3 s). So a switch from a near object to a far one, or back, neither jumps nor kicks: at 60 fps the field of view moves under 0.5 degree per frame, and a full change takes about 2 s. Before 17 November 2026 these were one-pole eases, which leave at full speed the frame the target changes. `focusArea: false` casts the centre ray only.

### Collisions on skinned meshes

A plain three.js raycast poses every vertex: 52 ms per frame in front of the 115 000 triangle knit character. A BVH refit costs 25 ms or more. So each bone gets a BVH over the triangles it moves (weight 0.1 or more). A bone moves its triangles rigidly, so the trees never change: a cast uses the bone's current matrix. Within 5 cm of the camera the candidate triangles are posed exactly the way three skins them. Trees build in idle time from 1 s after the kit starts; a mesh added later is built on its first ray.

Skipped by the walk, the click and the focus: invisible meshes, meshes with `userData.noFocus` (a water surface over what is under it) and meshes moved on the GPU (`material.positionNode`: fuzz shells, hair strands), whose CPU geometry is not what is drawn.

## Options

`createCameraKit( { renderer, scene, camera, controls, dom = renderer.domElement, options } )`

| Option | Default | |
|---|---|---|
| `walk` | `true` | keys and click to glide (needs `controls`) |
| `collide` | `true` | stop 0.1 mm from surfaces |
| `speedScale` | `true` | speed follows the distances |
| `minSpeed`, `maxSpeed` | `0.02`, `3` | m/s, before Shift. `minSpeed` only with no surface ahead |
| `macro` | `true` | macro field of view |
| `macroFov` | `22` | degrees at full macro |
| `macroFrom` | `0.12` | m: the macro starts below this distance |
| `macroFull` | `0.03` | m: full macro at and below this distance |
| `dof` | `true` | depth of field |
| `lensOn` | `! navigator.webdriver` | whether macro and depth of field start on |
| `lensKey` | `'KeyF'` | toggles the lens; `null` for none |
| `adaptive` | `true` | adaptive pixel ratio |
| `maxFocus` | `30` | m: farther hits do not count for the focus |
| `focusArea` | `true` | five rays around the centre for the focus; `false`: the centre only |
| `ao` | `true` | GTAO and hair pass. Off: `render()` draws the scene, through the depth of field if on |
| `aoLit` | `true` | AO inside the lighting; `false`: AO over the finished colour |
| `shadows` | `true` | sun shadows in cascades that follow the focus |
| `sun` | first shadow-casting directional light of the scene | the light that gets the cascades |
| `shadowFar` | `40` | m: end of the last cascade |
| `target` | `null` | a target with a depth texture: target mode (see above) |
| `shafts` | `null` | in target mode, light added before the blur: any `{ sample( uv ), render( depthTexture ) }`, such as `createShafts()` of `src/core/shafts.js` |

`macro: false` and `dof: false` build no lens and cast no focus ray. `lensOn: false` builds them, off, and the F key turns them on.

## Methods and parts

- `kit.update( dt, { move = true, dist } )`: once per frame. Runs the adaptive resolution, the walk, `controls.update()`, the lens, then `prepare()`. `move: false` holds the walk and the controls during a scripted camera path. `dist` (a number, or a function read after the lens) replaces the subject distance; the demos pass the orbit distance on the knit pages.
- `kit.prepare( dist )`: AO radius and shadow cascades for a subject distance. A still frame (a film) calls it, then `renderAsync( 2 )`.
- `kit.subject`: the subject distance of the last update.
- `kit.render()`, `kit.renderAsync( times )`: draw the frame through the post pipeline. In target mode, `kit.render( rt )` with the frame the page drew (colour and depth).
- `kit.lens.bokehScale`: a factor on the blur, set by the page (the aquarium halves it under water).
- `kit.dispose()`: removes the key and pointer listeners.
- Parts, for tests and special cases: `kit.walk`, `kit.lens` (`enabled`, `macro` 0 to 1, `focusDistance`, `baseFov`), `kit.post` (`enabled`, `scenePass`, `aoPass`), `kit.cascades` (`csm`), `kit.adaptive` (`max`, `hold`), `kit.collider( origin, dir, far )`, `kit.collider.near( point, far, skip )`.
- `kit.lens.baseFov`: the field of view outside macro. Set it when the game changes its own field of view.

## Events

The kit is an `EventTarget`. Every event is a `CustomEvent`; read `e.detail`. UI listens to these and never reads the parts.

| Event | Detail | When |
|---|---|---|
| `focusStarted` | `{ object, point }` | a click starts a glide |
| `focusEnded` | `{ object }` | the glide arrives |
| `focusChanged` | `{ distance, object }` | the focused object changes, or the focus distance moves by 5 % |
| `fovChanged` | `{ fov }` | the macro lens changed the field of view |
| `macroChanged` | `{ macro }` | the macro lens goes in (past half way) or out |
| `dofToggled` | `{ enabled }` | the lens goes on or off (F key or `kit.lens.enabled`) |
| `pixelRatioChanged` | `{ ratio, max }` | the adaptive resolution changed the pixel ratio |

## Costs

Measured by `tests/camera_check.mjs` (headless Chromium, Apple M1 Max, 1280x720, pixel ratio 1). The browser timer is coarse (0.1 ms): the mean resolves smaller costs than the median.

CPU per frame: the walk (`walk.update`, collision ray included) and the focus (`lens.update`, five rays of the autofocus area). Mean, then 99th percentile and max, in ms. Same numbers on both backends.

| Page | Walk | Focus (five rays) |
|---|---|---|
| `index.html` (skinned knit mannequin) | 0.10 (0.3, 0.6) | 0.38 (0.9, 1.7) |
| `character.html` (skinned, 115 000 triangles) | 0.12 (0.3, 3.0) | 0.37 (0.8, 1.7) |
| `cubes.html?family=10` | 0.06 (0.2, 0.6) | 0.24 (0.4, 1.0) |
| `livingroom.html` | 0.013 (0.1, 0.2) | 0.046 (0.2, 0.5) |
| `aquarium.html` | 0.007 (0.1, 0.1) | 0.019 (0.1, 1.4) |

With the centre ray only (`focusArea: false`) the focus cost about a fifth of that (0.08 on the mannequin). The walk with the character animated every frame costs the same (0.09 mean, 0.5 max). The first walk call after the idle build is about 1 ms. Without the idle build, the first ray on the mannequin built its trees in 51 ms.

Frame with the depth of field off, then on (median ms, 1280x720, the camera 30 cm from the surface, AO inside the lighting and shadow cascades on, waiting for the GPU each frame):

| Page | WebGPU | WebGL2 |
|---|---|---|
| `index.html` | 5.4, 6.2 | 6.9, 8.3 |
| `character.html` | 4.9 (3.9 again), 5.6 | 4.6, 6.4 |
| `cubes.html?family=10` | 6.2, 7.9 | 6.0, 8.4 (noisy) |
| `livingroom.html` | 4.3 (3.9 again), 5.4 | 5.0, 5.3 |
| `aquarium.html` (target mode, after the waterline) | 6.5, 7.2 | 6.5, 7.3 |

So the depth of field costs about 0.7 to 1.7 ms at 720p. With the lens off its passes are not drawn at all. The costs of AO inside the lighting, the cascades and the depth of field at 1080p are in [performance.md](performance.md) (demo effects).

The quality gate (`npm run gate`) gives the same numbers as main: every metric within 3.3e-5, sheen ratios equal. Automated browsers get the lens off. Screenshots of every demo page, kit against main at the same camera and time, are identical in the 3D view (lens off, and lens on with `?dof`: at most 0.07 % of pixels differ by more than 8 levels, on edges in the living room, from the focus easing).

## Traps

- **Reversed depth is required for a near plane of 1e-6.** With a normal depth buffer, 1e-6 to 100 m leaves no precision far away and the depth test breaks. `RENDERER_OPTIONS` sets `reversedDepthBuffer: true`; it is a constructor option, so it cannot be added later. `applyCameraSettings()` warns and keeps the near plane at 1 mm when it is missing.
- **Do not place the near plane by raycast.** A raycast against the skinned sweater to move the near plane cost 50 ms of CPU per frame. Reversed depth keeps it fixed.
- **AO inside the lighting is one frame late.** The ambient AO a material reads is the one of the frame before. A moving camera hides it. A still frame (a film) calls `prepare( dist )` then `renderAsync( 2 )`.
- **Automated browsers get the plain image.** The lens starts off under `navigator.webdriver`, so the quality gate, the films and the benches are unchanged. The demos also turn it off with `?nodof` and in film mode, and on with `?dof`.
- **Headless or hidden tabs may not run the animation loop.** Drive `kit.update( dt )` by hand. Outside `setAnimationLoop`, three never advances its node frame: call `renderer._nodes.nodeFrame.update()` before each manual render, or the post passes skip every frame after the first.
- **Skinned bounds.** A skinned mesh's bounding sphere is computed once, in the first pose, and grown by 25 %. A pose that leaves it is missed. Call `mesh.computeBoundingSphere()` after a big change of pose.
- **The camera's field of view belongs to the lens while macro is on.** A game that changes it sets `kit.lens.baseFov` instead.
- **The first ray on a new mesh builds its tree.** On the knit mannequin that was a one-off 51 ms. The idle build from 1 s avoids it for meshes present at start. With the lens on, the focus ray runs from the first frame, so a page may pay it once while it loads.
- **OrbitControls moves the camera inside its own handlers.** Pointer and wheel handlers call `controls.update()` themselves, outside `kit.update()`. So the guard also listens to 'start', 'change' and 'end'. A guard that only wraps the kit's update let an orbit drag put the camera 8 cm under the floor.
- **Margin along the path is not enough.** A grazing orbit stopped 0.1 mm along its path came within 0.4 um of the floor, under the 1 um near plane. The margin is divided by the cosine of the incidence angle (the collider returns the hit normal; skinned meshes do not, they keep the margin along the path).
- **Displaced surfaces collide by their bound.** A material with `preset.displace` moves its vertices on the GPU, so the CPU mesh is flat. The collider uses that flat mesh padded by the family's `displaceMax` (aquarium sand with mounds: about 3.7 cm). So the camera stops that far above the ripple troughs. An exact stop would need the height on the CPU. Meshes moved on the GPU without a bound (fuzz, hair, a water surface) are not collided with.
- **The walk does not push back.** A character that moves toward a still camera can come closer than 0.1 mm (3e-5 m measured on the animated mannequin). It never passes through on a walk.
