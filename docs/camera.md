# Camera kit

`infinitex/camera` (`src/camera/`) is the camera of the demos, as a library. A game that uses Infinitex materials gets the same close-up camera in a few lines: walk keys, collisions, a macro lens with depth of field, adaptive resolution and ambient occlusion. Each part can be turned off.

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
	kit.update( ( now - last ) / 1000 );   // walk, controls.update(), lens, AO radius
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
| Speed scale | `speedScale` | Speed is 0.8 times the distance to the orbit target or to the surface ahead, whichever is smaller, per second, clamped to `minSpeed` and `maxSpeed`. The same keys walk a room or creep along a stitch. Off: `maxSpeed / 3` everywhere. | `walk.js` |
| Collision | `collide` | A ray along the move finds the surface ahead. Each frame covers at most `1 - e^(-4 dt)` of the room left, so the camera slows down and stops 0.1 mm from any surface. It never goes through. | `collide.js`, `skinned.js` |
| Macro lens | `macro` | The field of view follows the distance to the surface at the screen centre. Above `macroFrom` it is the camera's own. Between `macroFrom` and `macroFull` it narrows to `macroFov`, then holds. | `lens.js` |
| Depth of field | `dof` | three's `DepthOfFieldNode`, focused on the same surface. The sharp zone is 1 times the focus distance at 1 cm and 3 times at 3 m, as with a real lens. | `lens.js`, `post.js` |
| Adaptive resolution | `adaptive` | Lowers the pixel ratio by steps of 0.25 (down to 0.75) while the mean frame stays above 40 ms, raises it when the next step is predicted under 25 ms. | `adaptive.js` |
| AO | `ao` | GTAO at half resolution, its radius 12 % of the camera distance. 3D hair strands draw in a pass of their own over it. | `post.js` |

### The focus distance

The macro lens and the depth of field read one distance: the surface under the screen centre, found every frame by the collision BVH. When the centre ray hits nothing, the orbit target stands in, with a deeper and weaker blur. The distance eases in log space (time constant 0.18 s), like a focus pull. The field of view eases again (0.35 s). So a switch from a near object to a far one, or back, never jumps: at 60 fps the field of view moves 0.75 degree per frame at most.

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
| `minSpeed`, `maxSpeed` | `0.02`, `3` | m/s, before Shift |
| `macro` | `true` | macro field of view |
| `macroFov` | `22` | degrees at full macro |
| `macroFrom` | `0.12` | m: the macro starts below this distance |
| `macroFull` | `0.03` | m: full macro at and below this distance |
| `dof` | `true` | depth of field |
| `lensOn` | `! navigator.webdriver` | whether macro and depth of field start on |
| `lensKey` | `'KeyF'` | toggles the lens; `null` for none |
| `adaptive` | `true` | adaptive pixel ratio |
| `ao` | `true` | GTAO and hair pass. Off: `render()` draws the scene, through the depth of field if on |

`macro: false` and `dof: false` build no lens and cast no focus ray. `lensOn: false` builds them, off, and the F key turns them on.

## Methods and parts

- `kit.update( dt, { move = true, dist } )`: once per frame. Runs the adaptive resolution, the walk, `controls.update()`, the lens and the AO radius. `move: false` holds the walk and the controls during a scripted camera path. `dist` overrides the AO distance.
- `kit.render()`, `kit.renderAsync()`: draw the frame through the post pipeline. A page that draws itself (mirrors, waterlines) skips them and uses `ao: false, dof: false`.
- `kit.dispose()`: removes the key and pointer listeners.
- Parts, for tests and special cases: `kit.walk`, `kit.lens` (`enabled`, `macro` 0 to 1, `focusDistance`, `baseFov`), `kit.post` (`enabled`, `scenePass`), `kit.adaptive` (`max`, `hold`), `kit.collider( origin, dir, far )`.
- `kit.lens.baseFov`: the field of view outside macro. Set it when the game changes its own field of view.

## Events

The kit is an `EventTarget`. Every event is a `CustomEvent`; read `e.detail`. UI listens to these and never reads the parts.

| Event | Detail | When |
|---|---|---|
| `focusStarted` | `{ object, point }` | a click starts a glide |
| `focusEnded` | `{ object }` | the glide arrives |
| `focusChanged` | `{ distance, object }` | the object under the screen centre changes, or the focus distance moves by 5 % |
| `fovChanged` | `{ fov }` | the macro lens changed the field of view |
| `macroChanged` | `{ macro }` | the macro lens goes in (past half way) or out |
| `dofToggled` | `{ enabled }` | the lens goes on or off (F key or `kit.lens.enabled`) |
| `pixelRatioChanged` | `{ ratio, max }` | the adaptive resolution changed the pixel ratio |

## Costs

Measured by `tests/camera_check.mjs` (headless Chromium, Apple M1 Max, 1280x720, pixel ratio 1). The browser timer is coarse (0.1 ms): the mean resolves smaller costs than the median.

CPU per frame: the walk (`walk.update`, collision ray included) and the focus ray (`lens.update`). Mean, then 99th percentile and max, in ms. Same numbers on both backends.

| Page | Walk | Focus ray |
|---|---|---|
| `index.html` (skinned knit mannequin) | 0.10 (0.2, 0.8) | 0.08 (0.3, 0.6) |
| `character.html` (skinned, 115 000 triangles) | 0.11 (0.3, 1.7) | 0.08 (0.3, 0.8) |
| `cubes.html?family=10` | 0.06 (0.2, 0.6) | 0.05 (0.2, 0.7) |
| `livingroom.html` | 0.013 (0.1, 0.1) | 0.014 (0.1, 0.2) |
| `aquarium.html` | 0.007 (0.1, 0.2) | 0.007 (0.1, 0.2) |

The walk with the character animated every frame costs the same (0.09 mean, 0.3 max). The first walk call after the idle build is about 1 ms. Without the idle build, the first ray on the mannequin built its trees in 51 ms.

GPU frame with the depth of field off, then on (median ms, 1280x720, the camera 30 cm from the surface):

| Page | WebGPU | WebGL2 |
|---|---|---|
| `index.html` | 5.2, 5.7 | 6.5, 7.3 |
| `character.html` | 3.8, 4.3 | 4.2, 5.1 |
| `cubes.html?family=10` | 3.6, 4.0 | noisy (4.2 to 5.6 both ways) |
| `livingroom.html` | 2.5, 3.2 | noisy (4.4 off, 9.1 on) |

So the depth of field costs about 0.5 to 0.7 ms on WebGPU and about 1 ms on WebGL2 at 720p. With the lens off its passes are not drawn at all.

The quality gate (`npm run gate`) gives the same numbers as before the kit: every metric within 3.3e-5, sheen ratios equal. Automated browsers get the lens off.

## Traps

- **Reversed depth is required for a near plane of 1e-6.** With a normal depth buffer, 1e-6 to 100 m leaves no precision far away and the depth test breaks. `RENDERER_OPTIONS` sets `reversedDepthBuffer: true`; it is a constructor option, so it cannot be added later. `applyCameraSettings()` warns and keeps the near plane at 1 mm when it is missing.
- **Do not place the near plane by raycast.** A raycast against the skinned sweater to move the near plane cost 50 ms of CPU per frame. Reversed depth keeps it fixed.
- **Automated browsers get the plain image.** The lens starts off under `navigator.webdriver`, so the quality gate, the films and the benches are unchanged. The demos also turn it off with `?nodof` and in film mode, and on with `?dof`.
- **Headless or hidden tabs may not run the animation loop.** Drive `kit.update( dt )` by hand. Outside `setAnimationLoop`, three never advances its node frame: call `renderer._nodes.nodeFrame.update()` before each manual render, or the post passes skip every frame after the first.
- **Skinned bounds.** A skinned mesh's bounding sphere is computed once, in the first pose, and grown by 25 %. A pose that leaves it is missed. Call `mesh.computeBoundingSphere()` after a big change of pose.
- **The camera's field of view belongs to the lens while macro is on.** A game that changes it sets `kit.lens.baseFov` instead.
- **The first ray on a new mesh builds its tree.** On the knit mannequin that was a one-off 51 ms. The idle build from 1 s avoids it for meshes present at start. With the lens on, the focus ray runs from the first frame, so a page may pay it once while it loads.
- **The walk does not push back.** A character that moves toward a still camera can come closer than 0.1 mm (3e-5 m measured on the animated mannequin). It never passes through on a walk.
