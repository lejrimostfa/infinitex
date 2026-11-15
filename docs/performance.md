# Infinitex performance in a game

Question: if a game dressed **all** of its character and scenery with Infinitex, how much would it cost in memory, GPU time and CPU time? And on which machines can you aim for which frame rate?

Legend: **[M]** measured on the test machine, **[E]** estimated (the assumption is written next to it).

## In short (for a non-specialist)

A classic texture is a photo glued on the object. It takes memory. But drawing it is cheap: the graphics card reads the photo.

Infinitex stores no photo. The graphics card recomputes the material every frame, for every pixel. So there is almost no image memory, but a lot of computation.

What we measured on a MacBook Pro M1 Max, with a small game scene (a character with 5 materials, scenery with 8 materials):

- **Time per frame at 1080p**: about 10 ms with Infinitex everywhere, against 3 ms with classic textures. This machine therefore holds about 100 frames per second. Materials do three quarters of the work. **[M]**
- **Close-up** (a sweater filling the screen): about 14 ms, or 70 frames per second. **[M]**
- **Memory**: classic 2K textures for these 13 materials take 870 MB (220 MB compressed). In 4K: 3.5 GB (870 MB compressed). Infinitex: 0 MB of images, but about 185 MB of compiled shaders and 60 MB of JavaScript. **[M]** for Infinitex and 2K, **[E]** for the rest.
- **Other machines**: about 40 frames/s on a recent MacBook Air, 25 on a base M1 Mac, 100 to 140 on a PC with an RTX 3060, 20 on a laptop with integrated graphics. On a phone, it is not playable as is. **[E]**

For a real game, the right recipe is mixed. Infinitex serves what is close: the hero, the ground at their feet, the object being inspected. The distance gets a frozen version of the same material, baked into a texture.

## 1. Measurement conditions

| | |
|---|---|
| Machine | Apple M1 Max, 32-core GPU (10.4 TFLOPS FP32), 32 GB unified memory, macOS 26 |
| Browser | Chrome for Testing (Playwright, build 1234), headless, WebGPU on Metal |
| Engine | three.js r187, `WebGPURenderer`, TSL materials |
| Catalogue | 204 materials, 21 families (`demo/cubelist.js`) |
| Date | 14 November 2026 |

**Contention.** Other agents were using the GPU at the same time (ports 5211, 5234 to 5236). GPU occupancy, sampled every 5 s, had a median of 89% during the materials bench and 100% during the scene bench (`docs/perf/gpu_util_*.log`). It was 75% before our benches started. So each bench ran 3 times. The tables give the **minimum over the runs**, the best estimate of the real cost: contention only adds time. The median follows in parentheses when it matters. The spread between runs is large: ±50% on a single material (median relative spread). Read each number as an order of magnitude.

**Two timers.**
- Materials alone: GPU timestamp queries on a single pass, as in `tests/bench.mjs`.
- Game scene: wall-clock time between submitting the frame and the end of the GPU work (`queue.onSubmittedWorkDone`), frames in series. This is an upper bound of the GPU time. The fixed latency is 0.4 to 0.7 ms (empty frame). Timestamps are not reliable on a multi-pass frame on this Mac in headless mode: most come back broken, and their sum exceeds the wall-clock time.

**Reproduce.** With the dev server running, then:

```bash
IX_URL=http://localhost:5211/cubes.html node tests/perf_matters.mjs docs/perf/perf_matters.json 3 20
IX_URL=http://localhost:5211/game.html node tests/perf_game.mjs docs/perf/perf_game.json 3
IX_URL=http://localhost:5211/game.html node tests/perf_game_parts.mjs docs/perf/perf_game_parts.json 3
IX_URL=http://localhost:5211/game.html node tests/perf_game_sizes.mjs docs/perf/perf_game_sizes.json 4
```

The raw data is in `docs/perf/`. The game scene is `game.html` (`demo/game.js`). It needs a game model, so it is not in the public repository.

## 2. GPU cost per material **[M]**

Each material fills a 1920x1080 frame, seen face on at 30 cm (the whole face), 2 cm and 1.5 mm. Cost in ms above a gray cube in the same view. Fuzz and 3D hair included when the material has them. No post-processing.

| Distance | median | 75% | 90% | worst |
|---|---|---|---|---|
| 30 cm | 1.9 | 4.0 | 7.8 | 22.7 |
| 2 cm | 3.4 | 6.2 | 12.5 | 31.7 |
| 1.5 mm | 3.3 | 5.9 | 11.8 | 31.6 |

At the worst of the three distances, 28% of materials cost less than 2 ms, 57% less than 4 ms, 81% less than 8 ms, 92% less than 16 ms.

The 10 most expensive (2 cm): Cactus 31.7. Rust 31.4. Cable knit 28.7. Wool felt 27.6. Boiled wool 23.2. Suede 22.9. Papier-mache 22.9. Paper 22.8. Synthetic felt 22.7. Corrugated cardboard 22.6.

The cheapest: Screen, Hologram, Varnished (rope), Nylon, under 1 ms.

### Per family (median of the family's materials, ms, full screen 1080p)

| Family | n | 30 cm | 2 cm | 1.5 mm | worst material |
|---|---|---|---|---|---|
| fibermat | 8 | 15.8 | 22.8 | 22.9 | Wool felt, 27.9 |
| knit (with fuzz) | 11 | 8.8 | 15.2 | 15.2 | Cable knit, 29.4 |
| metal | 10 | 5.7 | 9.2 | 8.8 | Rust, 31.4 |
| skin (with 3D hair) | 20 | 3.7 | 6.2 | 6.0 | Sweat, 9.0 |
| interlace | 3 | 2.3 | 4.3 | 3.8 | Caning, 4.9 |
| stone | 7 | 2.3 | 4.1 | 4.0 | Granite, 9.1 |
| leather | 8 | 1.9 | 3.8 | 3.6 | Mud, 15.6 |
| ground | 9 | 3.0 | 3.7 | 3.3 | Dust, 12.0 |
| woven | 18 | 1.8 | 3.3 | 3.1 | Burnt, 11.8 |
| rope | 2 | 2.0 | 3.3 | 3.1 | Hemp rope, 6.3 |
| plant | 6 | 1.8 | 3.0 | 3.2 | Moss, lichen, 4.7 |
| ceramic | 6 | 1.6 | 3.1 | 3.1 | Blown glass, 4.4 |
| organic | 36 | 1.2 | 2.4 | 2.7 | Cactus, 31.7 |
| plastic | 10 | 1.0 | 2.4 | 2.4 | Matte plastic, 8.5 |
| pile | 7 | 2.3 | 1.8 | 1.0 | Cut pile carpet, 5.4 |
| strands | 3 | 1.2 | 2.5 | 0.9 | Raw fleece, 3.0 |
| scales | 18 | 0.8 | 1.6 | 1.3 | Feathers, 12.5 |
| decor | 4 | 0.0 | 1.3 | 1.4 | Oil paint, 5.9 |
| wood | 10 | 0.7 | 1.3 | 1.3 | Dust, 19.3 |
| scifi | 7 | 0.0 | 1.2 | 1.3 | Iridescent sheet, 3.4 |

What to keep in mind:
- **Surface states are the hidden cost.** Bare wood costs 1.3 ms, dusty wood 19 ms. Median metal costs 9 ms, rusty metal 31 ms. Same for muddy leather (16 ms) and burnt cloth (12 ms).
- **The distant view is not free.** At 30 cm, a material still costs 55% of its cost at 2 cm. Faded detail levels are computed, then weighted by zero (`core/lod.js` does a fade, not a jump).
- **Fibermat and knit are the heavy families.** They stack several fiber scales. Knit also pays for its 8 transparent fuzz shells.

## 3. Game scene **[M]**

`game.html`: a character about 1.8 m tall and a scenery. Sun shadow (2048²), half-resolution GTAO, 3D hair pass (`demo/post.js`). 25 to 29 draw calls, 28,000 triangles (2.1 million when the 3D hair is displayed).

| Part | Material | Extra |
|---|---|---|
| head | Face (skin) | 3D hair |
| forearm, neck | Matte skin (skin) | 3D hair |
| sweater | Jersey (knit) | fuzz, 8 shells |
| trousers, boots | Full-grain leather | |
| belt, shoulder pad, bracelet | Brushed steel | |
| ground 30 x 30 m | Earth (ground) | |
| wall | Brick and mortar | |
| path | Concrete | |
| crates | Raw wood | |
| barrel | Rusted iron | |
| trash can | Worn, yellowed plastic | |
| pot | Terracotta | |
| rock | Granite | |

Three modes for the same frame: **Infinitex**, **flat** (one color per material, no texture: this is "the rest of the image"), **PBR 2K** (albedo, normal and ORM at 2048², RGBA8, mipmaps, anisotropy 8: a classic game).

### 1080p (1920x1080), post-processing included

Time per frame in ms. Minimum of the 3 runs, median in parentheses.

| View | Infinitex | flat | PBR 2K | material cost | material share |
|---|---|---|---|---|---|
| 10 m, wide shot | 8.3 (12.3) | 1.7 (2.9) | 1.9 (3.3) | 6.6 | 84% |
| 5 m | 9.1 (13.5) | 2.6 (3.8) | 2.9 (4.4) | 6.5 | 75% |
| 2.8 m, third person | 9.7 (14.1) | 2.9 (4.6) | 3.2 (5.2) | 6.8 | 73% |
| face at 37 cm | 7.7 (10.5) | 3.6 (4.3) | 4.6 (4.6) | 4.1 | 56% |
| sweater at 6 cm, full screen | 13.7 (20.3) | 4.2 (7.7) | 4.4 (7.8) | 9.5 | 71% |
| forearm at 4 cm, 3D hair | 10.5 (15.5) | 4.3 (7.6) | 4.9 (7.5) | 6.2 | 61% |

Without post-processing, in third person: Infinitex 10.0 ms, flat 1.2 ms. So post-processing (GTAO and hair pass) costs about 1.7 ms.

**Who costs what.** We switch on one part at a time in Infinitex, the rest flat (`tests/perf_game_parts.mjs`). The Earth ground dominates: +5.1 ms at 2.8 m and +8.5 ms at 10 m, on its own. It covers half the screen, seen at a grazing angle. It then costs more than seen face on, full screen (3.3 to 3.7 ms). At 10 m, the wall, the path and the rock each add 1.7 to 2.7 ms. The character's five materials each add less than 1 ms, under the measurement noise. They cover few pixels at these distances.

### 1440p (2560x1440)

The full 1440p run happened under 100% GPU occupancy by other agents: even the flat mode was 2.5 to 3.8 times slower there than at 1080p. A second bench alternates 1080p and 1440p in the same page, so contention hits both sizes the same way (`tests/perf_game_sizes.mjs`). The 1440p to 1080p ratio there is 1.6 to 2.0 for Infinitex. This is the pixel ratio (1.78). So the cost follows the number of pixels. Estimate 1440p = 1080p x 1.78 **[E]**:

| View | Infinitex | flat | PBR 2K |
|---|---|---|---|
| 2.8 m | 17 | 5 | 6 |
| sweater full screen | 24 | 7.5 | 8 |

## 4. Memory

### What the scene allocates **[M]**

three.js counters (`renderer.info.memory`), footprint of Chrome's GPU process (macOS `footprint`), JavaScript heap (CDP `Performance.getMetrics`). Page at 1080p, each view drawn once.

| | without Infinitex (`?noix`) | 13 Infinitex materials | with PBR 2K added |
|---|---|---|---|
| Textures (three.js) | 130 MB | 130 MB | 1,002 MB |
| Geometry buffers | 0.2 MB | 5.0 MB | 5.0 MB |
| WGSL programs (text) | 21, 0.08 MB | 71, 3.4 MB | 79, 3.4 MB |
| GPU process (footprint) | 538 MB | 723 MB | 2,182 MB |
| JavaScript heap | 25 MB | 83 MB | |

Details:
- **Textures.** The 130 MB are render targets: the scene pass (color and normals in half-float, depth), the hair pass, the half-resolution GTAO, the shadow map, the environment. Infinitex adds none. Only optional inputs add some (a jacquard or tattoo image). At 1440p, the targets rise to 201 MB.
- **Buffers.** The 5 MB come mostly from the 3D hair: each hairy host creates two `InstancedMesh` of 128 x 128 instances (strands and shadows). Their instance matrices (2 x 1 MB per host) are useless: the position of each strand is computed from `instanceIndex`. The sweater's fuzz adds 8 copies of its geometry.
- **Compiled shaders.** +185 MB in the GPU process for 13 materials, or about 14 MB per material with its fuzz and hair. This is the real memory cost of Infinitex.
- **JavaScript.** +58 MB for 13 materials: the TSL node graphs and the node compiler state. The wall of 204 materials fits in 158 MB, because many presets of the same family share the same program.

### Comparison with classic textures

Set of 3 textures per material (albedo, normal, ORM), mipmaps included, for 13 materials. MB = 10⁶ bytes.

| Format | per 2K texture | 13 materials in 2K | per 4K texture | 13 materials in 4K |
|---|---|---|---|---|
| RGBA8, uncompressed | 22 MB | 872 MB **[M]** | 89 MB | 3.5 GB **[E]** |
| BC7 (PC) or ASTC 4x4 (Apple, mobile) | 5.6 MB | 218 MB **[E]** | 22 MB | 872 MB **[E]** |
| ASTC 6x6 (mobile) | 2.5 MB | 97 MB **[E]** | 9.9 MB | 388 MB **[E]** |
| Infinitex | 0 | 0 MB of textures, +185 MB of shaders, +58 MB of JS **[M]** | 0 | same |

The measured PBR 2K costs +1.46 GB of footprint in the GPU process for 872 MB of texels: Chrome keeps transfer copies. Infinitex wins clearly against uncompressed textures and against 4K. Against a 2K texture compressed in BC7, the two are about equal (about 220 MB against 245 MB). Infinitex's advantage is not there: it is unlimited detail when zooming, for the same memory price. A 2K texture, seen at 6 cm, has only 0.5 mm per texel left.

### Loading and compilation **[M]**

| | |
|---|---|
| Compiling one material (WebGPU pipeline) | median 0.53 s, 90% under 0.96 s, worst 2.6 s (Worn plastic, Rust) |
| Size of the WGSL fragment shader | median 103 KB (1,215 lines), worst 365 KB (3,768 lines, Rust) |
| All 204 materials | 96 s of compilation, 298 programs (vertex and fragment) |
| Game scene, first frame | 7.0 s cold, 1.5 s when Chrome already has the shaders in cache |

Presets of the same family that differ only by uniforms share a single program. Changing a parameter (`ix.set()`) recompiles nothing. The Metal shader cache can stay warm from one session to the next. So the very first launch on a new machine can be slower.

## 5. CPU per frame **[M]**

| Measure | ms per frame |
|---|---|
| Game scene, frame submit, Infinitex | 0.65 to 1.1 |
| Same scene, flat materials | 0.45 to 0.8 |
| Wall of 204 visible cubes, Infinitex, 20 hairy hosts, fuzz | 3.4 |
| Same wall, gray cubes (343 draw calls) | 1.5 |
| 3D hair window, static host (960 triangles) | 0.10 per targeted host |
| Same in the wall (also walks 600 objects to find the sun) | 0.25 per targeted host |
| **3D hair window, skinned host, a game character (11,135 triangles)** | **6.1 per targeted host** |
| **Same, torso of the skinned mannequin (57,600 triangles)** | **22 per targeted host** |

The CPU cost of materials is low: about 9 µs per material per frame. This includes updating nodes and uniforms. Except for one point. Each hairy host casts a ray from the camera every frame (`core/hair3d_window.js`). On a skinned mesh, three.js skins every tested vertex on the CPU, with no acceleration structure. So an animated game character with 3D hair costs 6 to 22 ms of CPU per frame, as soon as the camera moves while aiming at it. This is the main CPU risk (trap 15 in the README, in larger scale).

## 6. Why: the trade-off

**Compute against bandwidth.** A texture costs memory and bandwidth: a few reads per pixel, served by the cache. Infinitex costs compute (ALU): hundreds of operations per pixel (noises, 3x3 cell lookups, several fiber scales). On a modern GPU, compute is plentiful and bandwidth is scarce. But our shaders are so long that compute dominates: 3 to 4 times the cost of a classic PBR frame.

**The cost follows covered pixels.** An object that covers 1% of the screen costs 1% of its full-screen cost. 200 distant cubes cost less than one face filling the screen. The character, small on screen, costs little. The ground, which covers half the image, costs the most.

**The cost follows the finest visible level, but not enough.** `core/lod.js` fades each level in according to pixel size. Faded levels are still computed. So the distance costs only 45% less than the near view.

**Overdraw.** Fuzz adds 8 transparent shells on top of the knit. 3D hair adds up to 2 million thin triangles in a separate pass. Each pixel covered several times pays several times.

**WebGPU against native.** On the GPU side, WGSL is translated to MSL, HLSL or SPIR-V. The final shader looks like a native shader. We estimate the gap at 10 to 20% **[E]**: no half precision (fp16) by default, no subgroup operations, checked memory accesses. On the CPU side, a WebGPU draw call costs several times more than in native. Here it does not matter: 25 to 30 calls per frame. Compilation, for its part, happens at load time in the browser. A native engine precompiles its shaders offline.

## 7. How to reduce the cost

Estimated gains **[E]**, to be validated by measurement.

| Lever | Expected effect |
|---|---|
| Real branches on the pixel footprint, instead of fades weighted by zero | Distance falls back to the cost of the coarse level. The ground at 10 m would go from +8.5 ms to 1 or 2 ms. Biggest gain for a game scene. |
| Bake the distance: the same material rendered once into a texture (512² to 1K, BC7) at load time, Infinitex only within a radius around the camera | Cost of a PBR scene (about 3 ms) beyond 2 to 3 m. 1.4 MB per 1K BC7 texture. |
| Graph tiers (near, mid, far): 2 or 3 compiled variants per material, chosen by size on screen | Distant cost divided by 2 to 5. Shader compilation and memory multiplied by 2 or 3. |
| Surface states (rust, dust, mud, burnt) baked, or reserved for the near view | Up to -20 ms on the affected materials. |
| Dynamic resolution, or rendering at 75% and upscaling | -44% on everything that follows pixels. |
| 3D hair reserved for the hero and close-ups. Ray on a low-resolution proxy, or BVH (`three-mesh-bvh`), or window updated every 2 to 4 frames | From 6 to 22 ms of CPU down to under 0.2 ms. |
| Remove the useless instance matrices of the 3D hair | -2 MB per hairy host. |
| Fuzz: fewer shells in the distance, none under a few pixels | Less overdraw on knits. |
| Precompile at load (`renderer.compileAsync`) | No hitches in game. 0.5 to 1 s per distinct material on M1 Max, behind a loading screen. |
| Half precision (`shader-f16`) on the computations that tolerate it | Up to 2x ALU on Apple and mobile. Not on coordinates (trap 8 in the README). |

## 8. Target machines **[E]**

**Assumption.** The scene is limited by GPU compute. So GPU time varies inversely with the effective FP32 throughput. Measured reference: M1 Max, 10.4 TFLOPS. Game scene at 1080p: 9.2 ms in third person and 13.2 ms for the full-screen sweater, latency removed. The throughputs are the manufacturers' public values, corrected when the advertised figure counts a double rate that our shaders do not use (Ampere, RDNA 3). Uncertainty: ±50%.

| Machine | relative throughput | 1080p, 3rd person | 1080p, close-up | Suggested setting |
|---|---|---|---|---|
| Apple M1, 8-core GPU | 0.25 | 37 ms, 27 fps | 53 ms, 19 fps | 720p, baked distance |
| Apple M2, 10-core GPU | 0.35 | 26 ms, 38 fps | 38 ms, 26 fps | 900p, baked distance |
| Apple M3 or M4, 10-core GPU | 0.4 to 0.45 | 21 ms, 45 fps | 30 ms, 33 fps | baked distance for 60 fps |
| Apple M1 Pro or M2 Pro | 0.5 to 0.65 | 14 to 18 ms, 55 to 70 fps | 20 to 26 ms | 1080p |
| **Apple M1 Max (measured)** | **1** | **9.2 ms, about 100 fps** | **13.2 ms, 75 fps** | 1080p or 1440p |
| Apple M3 Max or M4 Max, 40 cores | 1.5 to 1.7 | 5.5 to 6 ms | 8 to 9 ms | 1440p |
| PC, RTX 3060 (desktop) | 1.0 to 1.3 | 7 to 9 ms, 110 to 140 fps | 10 to 13 ms | 1080p. 1440p at 60 fps |
| PC, RTX 4070 | about 2 | 4.6 ms | 6.6 ms | 1440p |
| Laptop, Intel Iris Xe (96 EU) | 0.2 | 46 ms, 22 fps | 66 ms | 720p, baked distance, no 3D hair |
| Laptop, AMD Radeon 780M | 0.4 | 23 ms, 43 fps | 33 ms | 900p, baked distance |
| iPhone 15 Pro or 16 Pro (WebGPU in Safari 26) | 0.12 under sustained load | 77 ms at 2 Mpx, 38 ms at 1 Mpx | | not playable as is |
| High-end Android (Adreno 750) | 0.15 to 0.2 | 46 to 61 ms at 2 Mpx | | not playable as is |
| Mid-range phone | under 0.05 | | | no |

The CPU is not the limit on any of these machines: under 1 ms per frame. There is one exception: 3D hair on a skinned character (section 5).

On a phone, a playable version would need baked distance, a single Infinitex material at a time (the inspected object), rendering at about 1 Mpx and half precision.

## TLDR

On an M1 Max, a game scene entirely in Infinitex (13 materials) costs about 10 ms per frame at 1080p, against 3 ms with classic textures. That is about 100 fps on this machine, 40 on a recent MacBook Air, 25 on a base M1, and nothing playable on a phone as is. In memory, Infinitex has no textures, but its compiled shaders and its JavaScript weigh about 245 MB. That is as much as a set of compressed 2K textures, 3.5 times less than compressed 4K and 14 times less than raw 4K. For a game, keep Infinitex for the near view, bake the distance into textures, skip the faded levels instead of weighting them by zero, and fix the CPU ray of the 3D hair on skinned characters (6 to 22 ms).
