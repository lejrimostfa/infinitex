---
name: infinitex-optimize
description: Make a three.js game or page built with Infinitex lighter on the GPU and CPU without changing its image. Audits a frame (draw calls per pass, repeated meshes, shadow maps drawn twice, uncullable casters, heavy grids, pixel ratio, post stages that do nothing), applies each fix, and proves with stills that the picture did not change and with a bench that the frame got faster. Use when the user says the game is slow, heavy, too many draw calls, too many polygons, the GPU fan spins, "optimise my scene", "performance", "fps", "bake", or in French "c'est trop lourd", "optimise", "trop de draw calls", "ça rame", "la carte graphique chauffe".
---

# Infinitex optimize

You make a game that uses Infinitex cheaper to draw, with the same image. Every fix is measured before it is kept: a change that saves milliseconds but changes the picture is reported to the user and only kept if they say yes.

In a game project the package is `node_modules/infinitex/`. The tools:
- `infinitex/perf` (`src/perf/`): `auditFrame`, `createInstances`, `skinParts`.
- `npx infinitex-perf` (`bin/infinitex-perf.mjs`): audit and frame time per view, stills, pixel compare. Needs `npm i -D playwright-core` and a Chromium (`npx playwright install chromium`).
- The camera kit (`infinitex/camera`) already does two things for every game: sun shadow maps once per frame (`createSunCascades`) and the `gi` lift without a pass. Check the game uses the kit, or copies these.

## 0. Let the tools see the game

The page must expose `window.__ix = { renderer, scene, camera, ready: true }` once loaded. Add, when the game has them:
- `draw()`: the game's own frame (mirrors, waterline, its post). Without it the tool renders `scene` with `camera`, or calls `kit.renderAsync()`.
- `kit`: the camera kit. `view( name )`: preset cameras. `setTime( s )`: a fixed clock, so stills repeat.

The render loop must be `renderer.setAnimationLoop`: three advances its frame counter only there, and per-frame work (shadow maps) keys on it.

## 1. Baseline

```bash
npx infinitex-perf "http://localhost:5173/?fullres" --views a,b,c
npx infinitex-perf "http://localhost:5173/?fullres" --views a,b,c --shots perf/before
```

Pick 3 to 6 views that cover the game: wide, close to props, under water, the sky. Run the stills twice and compare them (`--compare perf/before perf/before2`): it must read 0.00 %. If not, the page is not deterministic (time, random, physics): fix the clock first, or nothing below can be proven.

## 2. Fixes, in this order

Apply one, then run step 3, then the next.

1. **Pixel ratio.** Above 1.5 every pass shades 2.6 times the pixels of 1.25. Kit options `maxPixelRatio: 1.25` and `fxaa: true` (target mode) or `taa: true` (post mode). This one changes the image on purpose: compare zoomed crops of thin edges (leaves, poles, wires) at full size against the old ratio, and show them to the user. Without antialiasing the edges stair-step.
2. **Shadow maps drawn twice** (`shadow-repeat`). Use the kit's cascades, or for another light `shadow.autoUpdate = false` and `shadow.needsUpdate = true` once per frame.
3. **Repeated meshes** (`instance`): `createInstances( source, parent )`. Give each copy an empty stand-in placed as the copy was; the game moves the stand-ins as before; call `sync()` once a frame before drawing, and after every move. A stand-in hidden by `visible = false` draws nothing.
4. **Casters never culled** (`shadow-nocull`): set `frustumCulled` back to true, or `castShadow = false` for what is far from the shadowed area (clouds, sky cards). Check first where its shadow would fall: if outside the cascades, the shadow was never seen.
5. **Parts of one object** (`parts`): `skinParts( root )` when they move (bones keep the part names, so animation code is unchanged), else merge them.
6. **Post stages that do nothing.** For each stage (AO, GI, shafts, bloom, depth of field), take stills with its flag off. 0.00 % means it does nothing visible: remove it, or tune it until it does and ask the user. Read the stage's render target back (`renderer.readRenderTargetPixelsAsync`) when in doubt: a target all white or all zero is a dead stage. Seen on the paper beach: SSGI read its AO texture (white) and never bounced light; the shafts' cut was above every caustic and drew zero. Both cost milliseconds.
7. **Heavy meshes** (`heavy`, `nocull`): a mesh over 100 k triangles drawn in several passes. Hide it from passes that cannot show it (a mirror above the water does not need the deep floor), cull it in tiles, or a coarser grid far from the eye.
8. **Materials.** Infinitex computes every pixel. Measure each matter by swapping it for a plain `MeshStandardNodeMaterial` in a bench: the ones that cost most and fill the screen far away are the ones to bake into textures (`docs/performance.md`, the mixed recipe). Baking changes the image: show it.

## 3. Prove each fix

```bash
npx infinitex-perf "http://localhost:5173/?fullres" --views a,b,c --shots perf/after
npx infinitex-perf --compare perf/before perf/after
```

- **0.00 % of pixels over 8 levels**: the same image. Keep the fix.
- **Anything else**: look at the stills side by side, then at a full-size crop of the difference. If it is not the intended change, find the cause before going on: revert files one by one and take stills again (bisect). Traps met on the beach:
  - instance matrices written once and never after a move: the copies freeze (call `sync()` after every move);
  - a new option whose default rebuilt something (an environment probe built again without the old lower half): the shaded sides of every object darkened;
  - a removed stage that left speckles before: the new image is cleaner, which is a change too. Say so.
- Frame time: run the bench before and after in turns (before, after, before, after). Another program on the GPU makes single runs lie by 50 %.
- Run the game's own tests.

## 4. Report

A table per view: frame ms and draws before and after, what was done, what changed in the image (nothing, or the crops the user approved). Then what is left: the audit's remaining findings and the stages not yet measured.
