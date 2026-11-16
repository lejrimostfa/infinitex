---
name: infinitex-material
description: Make a new procedural material, texture or matter with Infinitex (three.js TSL, detail that grows when the camera zooms in), including liquids, gels, glass, translucent and glowing matters. Use when the user asks to "make a material", "a new texture", "a new matter", "a material that looks like this photo", "fill a glass / bottle with a liquid", "make it look like cork / terrazzo / lava / honey", or in French "fais-moi un matériau", "une nouvelle matière", "une texture procédurale", "remplis ce verre". Tries a preset of an existing family first, then a liquid volume, and only then scaffolds, writes, checks and registers a new family.
---

# Infinitex material

You make a matter for a three.js game that uses Infinitex. The rules, the numbers and the API are in `docs/authoring.md` of the Infinitex package. Read it before writing any TSL. In a game project the package is `node_modules/infinitex/`.

Where things are:
- Library entry: `infinitex` (`src/index.js`): `createMaterial`, `registerFamily`, `listFamilies`, `familyEvents`, `createLiquidVolume`, `LIQUIDS`, `thinGlassMaterial`.
- Kit for family code: `infinitex/kit` (`src/kit.js`): `footprint`, `fadeIn`, `fadeOn`, `gate`, `pick`, `finishNodes`, `defineParams`, hashes, `voronoi`.
- Catalogue: `docs/materials.md`. Ready presets: `demo/cubelist.js`.
- Commands: `npx infinitex-new-family <name>`, `npx infinitex-check <folder>` (in the Infinitex repository: `npm run new-family -- <name>`, `npm run check-family -- <folder>`).

## Steps

### 1. Understand the matter

From the text or the photo, write down in one short list:
- what it is made of, coarsest to finest, with real sizes (a photo has no scale: ask for one, or say what you assumed);
- its kind: opaque surface, translucent (light goes through and scatters: skin, wax, marble), transmissive (you see through it: glass, gel), liquid or volume in a container, emissive (glows: lava, embers, screens);
- where it will be seen from (a floor at 2 m, an object inspected at 5 cm).

### 2. Try what exists, in this order

1. **A preset of an existing family.** Search `docs/materials.md` and `demo/cubelist.js` for the structure, not the colour. Copy the closest preset, change sizes and colours, add surface states (`wetness`, `wear`, `dusty`...). Show it. If the user is satisfied, stop here.
2. **Liquids and volumes** go through presets of `liquid` (flat surfaces: puddle, rain, runoff, oil, soap, foam), `jelly` (gels), `molten` (lava, molten metal), or `createLiquidVolume` for any closed container (glass, bottle, vat, a mesh): `LIQUIDS` has water, wine, oil, honey, juice, milk; an opaque or glowing liquid takes `surface: createMaterial( { family: 'molten', ... } ).material`. Read `docs/authoring.md` section 6.3 for what it does not handle and tell the user.
3. **A new family** only when no family has the structure. Say why in one line.

### 3. Scaffold

`npx infinitex-new-family <name>` (lower case, digits, `_`). It copies the template (terrazzo) with working imports. Run the check once on the untouched copy: it must pass. That proves the setup (vite, playwright-core, Chromium). If it fails to start, read its message: `npm i -D vite playwright-core`, `npx playwright install chromium` or `IX_CHROMIUM=<path>`.

### 4. Write it, coarse to fine

- `params.js`: one key per real parameter, sizes in `_mm` or `_um`, colours as `'#rrggbb'`. Keep `defineParams`. Sliders for what a user will tune.
- `levels.js` (coarse levels) and `fine.js` (fine levels): one function per level, coarsest first. Keep adding levels until the contact sheet shows structure at 1 mm. For each level:
  - its period in metres, `w = fadeIn( period, fp, lo, hi )`;
  - a `gate( fadeOn( period, fp, lo ), off, build, shared )` with the same `lo`;
  - `off` is the level's average (colour, cavity, roughness), not zero;
  - its slope variance goes into `s2` when faded;
  - cell coordinates `.toVar()` before the gate, listed in `shared`;
  - no `dFdx`, `dFdy`, `texture()`, `footprint()` inside a gate; `pick()`, never `select()`.
- `shader.js`: keep `footprint` at the top and `finishNodes` at the end. Set `porosity`.
- `index.js`: `micro` kind (`generic` unless the matter needs another and the check passes with it), `kind`, `material: 'sss'` for translucent matters.
- Non-opaque kinds: `W.transmission`, `W.thickness`, `W.ior`, `W.attenuationColor`, `W.attenuationDistance` (transmissive); `W.sss` (translucent); `W.emissive` (glowing). Section 6 of the guide.

Run the check after each level, not at the end.

### 5. Check until it passes

`npx infinitex-check families/<name>` runs the lint, the quality gate (mean shift under 5 %, shimmer under 1.6, at 10 heights from 0.5 m to 1 mm), the frame cost (fail over 16 ms) on WebGPU and WebGL2, and writes a contact sheet. Read the sheet image yourself: does each height show the right level, nothing tiling, nothing flat?

When it fails, follow its hint:
- lint error: fix the line it names;
- fails only under 2 mm: non-zero mean in the finest level or the micro detail. Try `--preset '{"micro":0}'`; if that passes, set `micro: [ 'generic', ... ]`;
- mean shift elsewhere: a gate's `off` value or a faded level is not the level's average;
- shimmer: a level shows under 2 px per period (raise `lo`), or an edge has no footprint antialiasing;
- cost: gate the expensive level, drop an octave, or drop a surface state.

Do not raise the thresholds. Do not report success before `CHECK PASSED` on both backends.

### 6. Register and show

```js
import { registerFamily, createMaterial } from 'infinitex';
import cork from './families/cork/index.js';
registerFamily( 'cork', cork );
const ix = createMaterial( { family: 'cork' }, { coords: uv().mul( metersPerUV ) } ); // geometry.computeTangents() first
```

Show it in the game's own scene, or on the check page: in the Infinitex repository `check.html?family=/src/families/<name>/index.js`; the contact sheet otherwise. A liquid volume: `check.html?volume=1&liquid=<name>`.

### 7. Report

In a few lines: the matter and its kind, preset or new family and why, the levels with their sizes, the check table (worst mean shift, worst shimmer, cost at 2 cm, both backends), the contact sheet path, what is not handled (for liquids, section 6.3), and the one line of code that uses it.

## Never

- Never write a family when a preset does it.
- Never put a texture or a photo in the runtime: everything is computed.
- Never call a paid image or 3D API to make a material.
- Never edit the built-in families of the package to make a game's material: register a new one.
