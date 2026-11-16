# Make your own material

How to add a matter to Infinitex that zooms like the built-in ones: stable from 10 m down to 1 um, fast, and checked. Numbers marked [M] were measured on an Apple M1 Max (WebGPU, Chrome), see `docs/performance.md`.

## 1. First try a preset

A new family is a few hundred lines of TSL. A preset is ten lines of JSON. Most requests are a preset.

- 25 families and 241 ready presets. The catalogue with real sizes: `docs/materials.md`. Ready presets: `demo/cubelist.js`, English names in `demo/cubelist_en.js`.
- Every family's parameters and defaults: `import { families } from 'infinitex'; families.stone`.
- Surface states go on top of any preset: `wetness`, `gloss`, `wear`, `dusty`, `rusty`, `burnt`... (README, "Layers on top of any preset").
- Change a preset live with `ix.set( { ... } )`: uniforms only, no recompile.

Write a family only when no family has the structure of the matter: what its levels are made of, not its colour. Terrazzo got a family because no family had hard chips of several stones flush in a binder. A red granite is a stone preset.

## 2. What kind of matter

| Kind | Examples | Path |
|---|---|---|
| Opaque surface | stone, cloth, bark, plastic, terrazzo | a family on `finishNodes` (section 5) |
| Translucent (SSS) | skin, marble, wax, fruit flesh | a family with `material: 'sss'` and `W.sss` (section 6.1) |
| Transmissive surface | glass, jelly, soap film, ice | presets of `ceramic` (glass), `jelly`, `liquid` (soap), `ground` (ice); else a family with `W.transmission` (section 6.2) |
| Liquid in a container | a glass of wine, a bottle, a vat, a pool | `createLiquidVolume` (section 6.3) |
| Liquid surface | puddle, rain, runoff, oil slick, sea foam | presets of `liquid` |
| Box tank seen through glass | aquarium | the water tools of `demo/aquarium.js` (README, "Water, mirrors and the waterline") |
| Emissive, molten | lava, embers, molten steel, screens | presets of `molten` or `scifi`; else a family with `W.emissive` (section 6.4) |

## 3. Workflow

1. Scaffold: `npm run new-family -- <name>` here, `npx infinitex-new-family <name>` in a game. It copies the template (terrazzo) with the kit imports fixed. The copy already passes the check.
2. Write `params.js`: real sizes, in `_mm` or `_um` keys. `defineParams` turns them into uniforms in metres.
3. Write the levels coarsest first: the shape levels in `levels.js`, the fine ones in `fine.js` (one function each, gated from `levels.js`). After each level, run the check.

   The template shows how a matter keeps revealing structure down to the micrometre. Each level is its own fade and gate:

   | Level | Period | Shows from (camera height, gate view) |
   |---|---|---|
   | L0 chips, three stones, veined | 9 mm | 1.6 m |
   | L0b fine chips in the cement | 2.7 mm | 50 cm |
   | L1 sand grains, calcite grains, air voids | 0.6 mm | 6 cm |
   | L2 calcite crystals with twin lamellae, silt | 90 um | 1 cm |
   | L3 grinding scratches | 40 um | 4 mm |
   | L3 plucked pits, capillary pores | 15 um | 2 mm |
   | micro detail (core/micro.js) | 6 um and finer | under 1 mm |

   Every fine tone has zero mean (a centred hash, a sine, a mask minus its measured mean of 0.0779). Pits and voids hand their coverage to the far colour. So the far look does not move when the fine levels are added.
4. Check: `npm run check-family -- src/families/<name>` here, `npx infinitex-check families/<name>` in a game. Fix until it passes on WebGPU and WebGL2.
5. Register and use:

```js
import { registerFamily, createMaterial } from 'infinitex';
import cork from './families/cork/index.js';
registerFamily( 'cork', cork );
const ix = createMaterial( { family: 'cork', chip_mm: 4 }, { coords: uv().mul( metersPerUV ) } );
```

6. Look at it: `check.html?family=/src/families/<name>/index.js` here (orbit, zoom to 0.2 mm). From a game, the check writes a contact sheet at every height.

## 4. The impl

`registerFamily( name, impl )` takes the same shape as the built-in table in `src/index.js`. It validates each field and throws a clear error. It emits `familyRegistered` on `familyEvents`.

| Field | Required | What |
|---|---|---|
| `defaults` | yes | every preset key with its default. `family` absent or equal to the name |
| `uniforms()` | yes | the uniforms of one material |
| `apply( u, preset )` | yes | writes the uniforms, returns `{ preset, stats, derived }`. Called by `ix.set()`: no recompile |
| `build( u, opts )` | yes | the TSL graph. `opts.coords` (surface metres), `opts.baseNormal` |
| `sliders` | no | `[ [ key, min, max, step ], ... ]` for a panel |
| `material` | no | `'sss'`, or `( u ) => 'sss' | 'physical'` when it depends on the preset |
| `micro` | no | `[ kind, finest_m ]`: the micro detail under the finest level (`core/micro.js`) |
| `kind` | no | `opaque`, `transmissive` or `emissive`: what the check puts behind it |
| `height`, `fuzz`, `hair` | no | relief, fibre shells, 3D strands, as the built-in families |

Materials of a registered family behave like the built-ins: `materialReady` once, `paramsChanged` after each `set()`, and `pixel`, `relief`, `underwater` and the surface states work.

## 5. The rules, and why

Each rule has bitten a built-in family. The template follows all of them; the check lints for most of them.

1. **Surface metres.** Work on `p = uv * metersPerUV`, the same scale in u and v. Real sizes (a stitch 3 mm, a fibre 15 um) are what make every level appear at the right zoom.
2. **Footprint once, before any branch.** `const fp = footprint( p ).toVar()` at the top of `build`. It uses screen derivatives, and WGSL forbids derivatives in non-uniform control flow. Lint: `footprint`, `deriv-gate`.
3. **Fade every level in.** `fadeIn( period, fp, 2, 6 )`: 0 under 2 pixels per period, 1 over 6. Under 2 px a pattern aliases, so it shimmers and the mean drifts. Lint: `fade`.
4. **A faded level hands over its average.** When a level is off, put back what it averaged to: its mean colour, mean cavity, mean roughness. The far view must equal the blur of the near view. That is the gate's mean shift (limit 5 %). In terrazzo the far colour is exact because the chip coverage was measured (400k samples, error 0.002) and tabulated in `params.js`.
5. **Its slopes go to the roughness.** Sum the slope variance of the faded levels into `s2`. `composeRoughness( rough, s2 )` widens the lobe (Toksvig, LEAN). Without it the far view turns glossy. `finishNodes` does it. Lint: `roughness`.
6. **Real branches.** Wrap each level in `gate( fadeOn( period, fp, lo ), off, build, shared )`, with the same `lo` as its `fadeIn`. The GPU then skips a faded level instead of computing it times zero. [M] soil ground at 10 m: 6.9 ms to 1.5 ms; game scene wide shot 11.0 to 6.0 ms. A level of one or two value noises does not pay: frost got slower gated. Lint: `gate`, `fadeon`.
7. **`shared` and cell coordinates.** Pass the `.toVar()` nodes a build reads (`p`, `fp`, cell coordinates) in `shared`. Take cell coordinates (`mod( p.div( size ), 4096 )`) as a `.toVar()` just before the gate. Computed inside, a node is computed twice, and cell borders can move by a pixel (seen on the sand facets). Lint: `shared`.
8. **No derivative inside a gate.** No `dFdx`, `dFdy`, `fwidth`, `texture()` with implicit mips, `footprint()`, `specularAA()` in a gate build or a function it calls. Take them before. Lint: `deriv-gate`, followed through the folder's functions.
9. **`pick()`, never `select()`.** TSL compiles `select` to if/else and copies both subtrees per branch. `pick( t, a, b )` is a `mix`. Lint: `select`.
10. **Hashes without sine.** `hash1`, `hash3`, `valueNoise`, `voronoi` from the kit. Fold big coordinates with `mod( q, 4096 )`: the hashes are exact and seamless there. Lint: `sin-hash`.
11. **Antialias edges with the footprint.** A sharp border: `smoothstep( e - aa, e + aa, d )` with `aa = fp / size * 0.75` in the units of `d`.
12. **Specular anti-aliasing.** `specularAA( roughness, normal )` widens roughness where the normal changes fast between pixels. About 10 ALU. In `finishNodes`. Lint: `specaa`.
13. **Surface states.** `applySurface` (in `finishNodes`) lays wetness, gloss and wear over the result. Hand it a cavity (0 on tops, 1 in the deepest grooves): it becomes ambient occlusion and micro-shadowing for the key light. `porosity` says how much the matter drinks (glass 0, felt 1).
14. **Micro detail.** Under the finest level `core/micro.js` adds octaves down to 1 um. Pick the kind with `impl.micro`. Trap: `granular` darkens grain borders with a non-zero mean, which vanishes as each octave fades. [M] 6.9 % mean shift at 1 mm on a rough, dark copy of the template (agglomerated cork); 0.2 % with `generic`. The check prints this hint when only the finest heights fail.
15. **Parameters.** `defineParams( defaults )` names uniforms from the keys: `chip_mm` gives `u.chipM` in metres, `matrix_color` gives `u.matrixColor`, `angle_deg` radians. A string key (a `mode`) is read when the graph is built: changing it needs a new material. Everything else is a uniform: `set()` never recompiles. [M] one material compiles in 0.53 s (median), up to 2.6 s.
16. **Files under 200 lines.** One file per level or per mode, as the built-ins. Lint: `size`.

Budget [M]: the catalogue costs 1.9 ms at 30 cm, 3.4 ms at 2 cm and 3.3 ms at 1.5 mm (median, full 1080p frame, above a grey frame). 81 % of the matters stay under 8 ms at their worst distance, 92 % under 16. The check warns over 8 ms and fails over 16. Surface states are the hidden cost: bare wood 1.3 ms, dusty wood 19 ms.

## 6. Kinds that are not opaque

### 6.1 Translucent (SSS)

Set `material: 'sss'` in the impl (or a function of the uniforms: stone is SSS for marble only). The material becomes a `MeshSSSNodeMaterial`. Return `W.sss = { color, distortion, ambient, power, scale, attenuation }`; `finishNodes` maps it to the `thickness*` nodes. `color` is the light that comes through (red for skin). Example: `src/families/skin/shader.js`. Cost: the SSS lobe per light, small next to the levels.

### 6.2 Transmissive surfaces

Return `W.transmission` (0 to 1), `W.thickness` (m), `W.ior`, and `W.attenuationColor` with `W.attenuationDistance` (the colour left after that distance, Beer-Lambert). three.js copies the opaque scene once per frame and the material samples it, bent by the normal.

Traps:
- A transmissive material sees the **opaque** scene only (three r187, `viewportOpaqueMipTexture` for front faces). Two transmissive objects one behind the other: the far one vanishes. A container in front of a liquid must be blended, not transmissive: `thinGlassMaterial()`.
- They compile on their first draw: `renderer.compileAsync` copies the screen during the compile (demo/warmup.js).
- The check puts a grey backdrop 2 cm under the swatch, so the transmitted light has something to carry. The gate metrics are the same.

### 6.3 Liquids and volumes

Flat liquid surfaces (a puddle, water over sand, rain, oil, soap, foam): presets of `liquid`. A gel: `jelly`. A box tank seen through a pane: the aquarium tools (waterBody, createWaterSurface, createMirror, createWaterline, core/refraction.js). Those assume flat interfaces: a horizontal surface and a flat pane.

Any closed container: `createLiquidVolume`.

```js
import { createLiquidVolume, thinGlassMaterial, LIQUIDS } from 'infinitex';
const glass = new Mesh( new LatheGeometry( outerProfile, 96 ), thinGlassMaterial() );
glass.renderOrder = 2;                                   // blended over the liquid
const wine = createLiquidVolume( { cavity: new LatheGeometry( innerProfile, 96 ), fill: 0.55, liquid: 'wine' } );
glass.add( wine.object );                                // follows the container
wine.addEventListener( 'levelChanged', ( e ) => hud.show( e.detail.volume_m3 ) );
wine.setFill( 0.3 );                                     // or setLevel( y ), local y
wine.set( { ripple: 0.5, absorb: [ 200, 900, 700 ] } );  // uniforms only
```

- `cavity`: a closed geometry of the inside, in the container's local frame. A lathe of the inner profile closed on the axis, a sphere, any watertight mesh. The winding is fixed if inside out. `inset` (0.3 mm) pulls it in so it does not fight the glass.
- `liquid`: `water`, `wine`, `oil`, `honey`, `juice`, `milk`, or an object with the same keys. `absorb` is per metre at 650, 550 and 450 nm. Water: Pope and Fry 1997 plus dissolved matter, as `waterBody`. Wine: a young red, absorbance in a 1 mm cell A420 0.3, A520 0.4, A620 0.1 (Glories colour intensity), so about 230, 920 and 690 per metre: black in the glass, ruby at the rim. Oil, honey and juice: estimates [E].
- `surface`: any material instead of the clear-liquid look, for opaque or glowing liquids: `createMaterial( { family: 'molten', mode: 'steel' }, { coords: uv() } ).material`. Both meshes then carry uv in metres.
- Events: `volumeReady`, `levelChanged`, `paramsChanged`, detail `{ liquid, level, fill, volume_m3, area_m2, chord_m }`.

What it builds:
- **Body**: the cavity cut at the level (`core/fillgeometry.js`). Transmission with `ior`, absorption over the mean chord 4 V / S (Cauchy: the mean path of a random line through a convex body). One number per volume: right on average, not per pixel.
- **Surface**: the cut outline, triangulated with its holes (`core/fillcap.js`). Rings of vertices near the walls carry the **meniscus** (`core/meniscus.js`: water climbs ordinary glass about 2.9 mm, decaying over the capillary length 2.7 mm). Ripples from `families/liquid/waves.js`, faded with the footprint, their variance in the roughness. Absorption over the true depth under each point (a 48 x 48 floor map of the cavity), along the refracted ray.
- [M] volumes against closed forms (`tests/kit_volume.mjs`): cylinder 0.00 %, sphere 0.07 %, torus (two loops, one a hole) 0.35 %. Cutting a 24k-triangle sphere and building its surface: 8 ms of CPU, once per level change, never per frame. `setFill()` finds the level by bisection on the volume (26 cuts).

Not handled, say so to the user:
- The level is horizontal in the container's frame: a tilted bottle tilts its liquid.
- No caustics cast through the container on the table, no objects inside the liquid (their `underwater` flag reads the scene's single `waterBody`), no camera inside the liquid.
- Refraction is three's screen-space transmission: right for the look, not a traced ray. The exact vertex refraction of `core/refraction.js` and the waterline split of `core/waterline.js` need flat interfaces.
- A non-watertight cavity gives open loops: the surface has holes.
- Milk is drawn opaque: its scattering is not simulated.

The family check has no flat swatch for a volume. `check.html?volume=1` (wine glass and flask, `?liquid=`, `?fill=`, `?view=close`) shows one; a test page loads it headless and fails on any page error.

### 6.4 Emissive and molten

Return `W.emissive` (linear RGB, can exceed 1). Animate with `ixTime` (`core/clock.js`): films render frame by frame and come out the same. Fade glowing detail like any level: a glowing crack thinner than a pixel must hand its mean glow to the far view, or the far view darkens. The gate measures luminance with the emission in it. Examples: `src/families/molten/`.

## 7. The check

`infinitex-check <folder>`: lint, then for WebGPU and WebGL2:

| Measure | How | Limit |
|---|---|---|
| mean shift | top-down at 0.5 m to 1 mm, 1 sample per pixel against 64, mean luminance | 5 % (`tests/gate-limits.js`) |
| shimmer | change between d and 1.01 d after a 2x blur, against the reference's | 1.6 |
| frame cost | 1920x1080 filled at 30 cm, 2 cm, 1.5 mm, minus a grey frame | warn 8 ms, fail 16 ms |
| page errors | any error while loading, registering or rendering | none |

Plus a contact sheet per backend (`infinitex-check/<name>/sheet-<backend>.png`) and `report.json`. On WebGL2 the pixel readback waits about 8 ms, so frame costs read 0 there: trust the WebGPU numbers. The tool prints a hint for each kind of failure:
- fails only under 2 mm: the finest level or the micro detail has a non-zero mean (rule 14);
- mean shift elsewhere: a gate or a fade does not return the level's average (rule 4);
- shimmer: a level shows under 2 px per period, or an edge is not antialiased (rules 3, 11).

## 8. From a game project

```bash
npm i github:lejrimostfa/infinitex three
npm i -D vite playwright-core          # for the check only
npx playwright install chromium        # or IX_CHROMIUM=/path/to/chrome
npx infinitex-new-family cork          # ./families/cork, imports 'infinitex/kit'
npx infinitex-check families/cork
```

The check starts its own Vite server on the Infinitex package and serves your family under `/@fs/`. If you link Infinitex from a local path (`npm i ../infinitex`), your own Vite needs `resolve: { dedupe: [ 'three' ] }` and `server.fs.allow` for that path: two copies of three do not mix TSL nodes.

The Claude Code skill that runs this workflow: `.claude/skills/infinitex-material/`. Copy that folder into your project's `.claude/skills/`.
