# Infinitex: procedural materials with near-infinite zoom for three.js

Status: research done 2026-11-12. Phase 1 (core + knit L0 to L3) done 2026-11-13. Phase 2 (fuzz on a skinned mannequin, zoom film) done 2026-11-13. Gate passed on WebGPU and WebGL2. See `README.md`.
Target: three.js r187+, TSL node materials, WebGPU with WebGL2 fallback.
Working name: `infinitex`. Code lives in this repository.

## 1. Goal

- Fully procedural materials. No photo in the runtime.
- The closer the camera, the more detail appears: wool down to plies and fibers, soil down to sand grains.
- A family of "depth" materials: 2D surfaces that read as having parallax and light inside (holographic or car paint).
- A text prompt, and optionally a photo, calibrates a JSON preset. The game loads only the JSON.
- Usable in any browser game: `createMaterial(preset)` returns a node material.

## 2. Research conclusions

Four parallel literature searches, one per axis. Items marked [U] were not verified by the agents and must be checked before coding.

### 2.1 Infinite zoom: no single paper solves it in real time

The proven recipe has four parts.

1. **Footprint-driven octave stack.** `fp = max(length(dFdx(p)), length(dFdy(p)))`. `nOct = log2(baseWavelength / (2 fp))`. The loop always runs to `Nmax` with per-octave weights, because WGSL forbids derivatives in non-uniform control flow. The last octave fades by `fract(nOct)`, so nothing pops.
2. **Dropped octaves are replaced by their statistics.** This keeps the far view equal to the average of the near view.
   - Slope variance goes into roughness: `alpha^2 += sum(sigma_slope_i^2)` (Toksvig 2005, LEAN, Olano and Baker 2010, LEADR 2013).
   - Value variance goes into the sigma of a colour-ramp LUT `E[ramp(N(mu, sigma))]` (Heitz et al., I3D 2013).
   - Non-zero-mean octaves (ridged, Worley) must add their mean back.
   - Survey: Bruneton and Neyret, TVCG 2012.
3. **Precision.** f32 cannot cover 1 m down to 10 um. WGSL has no f64.
   - Integer cell plus fractional offset, rebased on the CPU in f64.
   - Integer hash pcg3d (Jarzynski and Olano, JCGT 2020). Never `fract(sin(x) * big)`.
4. **Scale-wrapped semantic layers.** 3 to 5 layers (stitch, ply, fiber, fuzz). Only two adjacent layers are live at a time, cross-faded by `log2(fp)`. Same idea as Generative Powers of Ten (CVPR 2024) and Neyret's "Infinite fall" Shadertoy.

Extras:
- Geometric specular anti-aliasing on the final normal (Tokuyoshi and Kaplanyan 2019, 2021). About 10 ALU.
- Phasor noise (Tricard et al. 2019) for oscillating knit and weave patterns.
- Hex tiling (Mikkelsen 2022, Burley 2019 weights) only if an exemplar texture is ever needed at mid scale.
- Neural decoders (Weinreich 2024, NVIDIA NTC 2023) and diffusion (Infinite Texture 2024) are offline or research tier. Not in the runtime path.

Gap: three.js ships `mx_noise_*` and `tsl-textures` exists, but nothing is footprint-aware with roughness compensation. That is the niche.

Budget: about 600 to 900 ALU per pixel at full tier. A quality knob controls `Nmax` and the live layer count.

### 2.2 Wool and knit: geometry down to plies, fibers only statistical

Architecture taken from Montazeri et al. 2020 and 2021 (ply-based woven and knitted models) and Zhu et al. 2023 (surface cloth BSDF with ply detail).

- Yarn model: Zhao, Luan, Bala 2016. Plies twist around the yarn. Fibers are helices with migration. Flyaways come as loops and hairs. Equations [U]: copy them from the paper.
- Knit tile: stitch meshes (Yuksel et al. 2012), periodic yarn tiles (Leaf et al. 2018). In the shader, one stitch is one UV tile with two V-shaped legs.
- Far view: three.js built-in Charlie sheen (`sheen`, `sheenColor`, `sheenRoughness`). Reuse it.
- Fuzz: Lengyel et al. 2001 shells plus fins. Wu and Yuksel 2017 core fibers plus a sparse outer layer.
- Real-time knit on deforming characters, state of the art: Huang et al., TOG 2025.
- Shader to study: Simon Thommes "Knittr" Blender node graph.

Scale hierarchy (worsted wool, about 20 stitches and 28 rows per 10 cm):

| Level | Renders | Size | Fade-in |
|---|---|---|---|
| L0 garment | Charlie sheen over diffuse, wrap or fuzz term, colourwork from the stitch grid | > 5 cm | always on |
| L1 stitch | analytic 2D stitch tile, two legs, yarn height `sqrt(1 - (r/Ry)^2)`, normal, cavity AO, neighbour search over 2 to 4 cells, topmost leg wins | 3 to 5 mm | 2 to 6 px per period |
| L2 ply | 2 to 4 plies, S or Z twist, twisted highlight (Irawan and Marschner 2012) | 0.5 to 1 mm | 2 to 6 px |
| L3 fiber | hashed striations along the fiber helix, Kajiya-Kay or Marschner-lite lobe on the fiber tangent | 20 to 100 um | 2 to 6 px |
| L4 fuzz | 8 to 16 shells with hashed hair coverage, fins at silhouettes | 0.5 to 3 mm long | shells when the garment covers > 100 px |

Below 2 px a level is never dropped. It is replaced by its mean albedo, its normal variance in roughness and its self-shadowing in AO.

At 1080p and 50 degrees FOV, one pixel covers about 17 um at 2 cm. So single fibers resolve only at macro distance.

### 2.3 Holographic depth: layers under a refracting clear coat

- The Unreal demo was not identified for sure. Most likely: Substrate layered car paint with glints in UE 5.7 (free automotive pack, March 2026), or the BMW M8 Substrate reveal (GDC 2023). Flakes sit at several depths under a varnish. The depth is perceived, not raymarched.
- Since the true surface is the flat coat, silhouettes never break.
- Recipe:
  1. Refract V, and L per light, into the coat with Snell (n about 1.5) in tangent space.
  2. 3 to 5 hashed flake layers. Layer i is offset by `d_i * t.xy / |t.z|`. Deep layers move less. That is the hologram cue.
  3. Glints: Deliot and Belcour 2023 (hash-driven, stable cost, no LUT [U]). Fallback Zirr and Kaplanyan 2016. Chermain 2020 needs a LUT dictionary (Unreal uses it).
  4. Light through layers: Beer-Lambert `exp(-sigma d / |t.z|)`, `(1 - F)^2` transmission, upper coverage occludes lower layers.
  5. Optional holo foil: Stam 1999 diffraction grating per flake.
  6. Optional high tier: raymarched emissive slab (8 to 16 steps), interior mapping cells.
- Reuse from three.js: clearcoat, iridescence (Belcour and Barla 2017), anisotropy, sheen, `MeshSSSNodeMaterial` translucency.
- Write ourselves: refraction into the coat. The three.js clearcoat does not refract the base. Pattern: subclass `MeshPhysicalNodeMaterial` with a custom `LightingModel.direct()`, like `MeshSSSNodeMaterial`.

### 2.4 Prompt and photo to parameters

The literature (MATch 2020, DiffMat v2 2023, VLMaterial ICLR 2025, MultiMat ICLR 2026) agrees: fixed procedural families with an exposed parameter set. Free graph or GLSL generation by an LLM is fragile.

Pipeline (authoring machine only):

1. **Classify.** LLM or VLM picks the family and writes a one-line `intent`.
2. **Draft.** Structured output against the family JSON Schema, 5 to 10 presets as few-shot examples.
3. **Measure the photo** (numpy, scikit-image). OKLab k-means palette, FFT or autocorrelation scale, structure-tensor orientation, granulometry. These override the LLM guesses.
4. **Fit.** CMA-ES in normalized log space on the real TSL shader rendered headless (Playwright, WebGPU), 2 to 3 zooms, 3 seeds, 200 to 800 evaluations. Loss: sliced-Wasserstein on VGG features (Heitz et al. 2021), plus OKLab histogram, plus radial power spectrum, plus a small DINOv2 term.
5. **Critique.** VLM picks among the top 4 or flips an enum. At most two rounds.
6. **Save.** JSON with `schema_version`, family, params, seed, `scale_reference`, provenance.

Rules:
- Never pixel, LPIPS or SSIM loss on stochastic textures. They fit seed phase.
- Discrete params are enumerated outside the optimizer.
- 8 to 20 exposed params per family, physical units in names (`yarn_width_mm`, `grain_d50_mm`, `flake_size_um`).
- A photo has no absolute size. Ask for it.

Gap: commercial tools (Substance Sampler) output pixel maps. Nobody ships text to procedural params.

## 3. Library architecture

```
infinitex/
  src/core/        footprint, octave stack, cell+offset coords, pcg3d, roughness compensation, spec AA
  src/families/    knit, woven, granular, veined, cellular, depthPaint (one TSL graph + schema each)
  src/presets/     JSON presets, few-shot examples for the LLM
  src/index.js     createMaterial(preset), events (materialReady, qualityChanged, lodLayerChanged)
  authoring/       prompt-to-preset CLI, photo stats, CMA-ES fit (Python + Playwright)
  demo/            zoom demo, preset editor with sliders
  tests/           cross-scale consistency, shimmer, perf
```

Rules:
- Fixed-count, branchless loops. No `If().and()` inside `Loop`, which was reported broken in WGSL.
- Derivatives computed once, before any branch.
- Coordinates in rest-pose space or UV with a jacobian, so the pattern sticks to a skinned garment.
- Tangents required (`computeTangents()` or MikkTSpace in the GLB).
- Every family test runs on WebGPU and WebGL2.

## 4. Quality gate (automatic)

- **Cross-scale consistency.** At log2-spaced distances from 1 m to 10 um, compare the shader at 1 spp with a 16 to 64 spp reference downsampled to the same size. Metrics: FLIP (Andersson et al. 2020), per-channel mean and variance, luminance histogram.
- **Temporal shimmer.** FLIP between consecutive frames of a slow dolly.
- **Perf.** GPU frame time at 1080p for 1, 10 and 50 garments, on WebGPU and WebGL2.

## 5. Roadmap

| Phase | Content | Done when |
|---|---|---|
| 0 Research | this document | done |
| 1 Core + knit pilot | core LOD module, L0 to L3 knit levels, zoom demo from 1 m to the fiber | done: meanShift 2.7 % max, shimmer 1.52 max, 3.6 ms at 1080p |
| 2 Fuzz + look | L4 shells on a skinned mannequin, tapered fibers with cuticle scales, zoom film recorder | done: sheen ratio 0.99 to 1.00, meanShift 2.8 % max, shimmer 1.38 max, both backends. Fins skipped: slab shells already hold at silhouettes |
| 2b Look + game texture | organic knit, yarn parallax, anchored fuzz, SSAO, stats panel; knit from a game character's atlas (riveraine) | done: gate passes, stretch within 10 % after relaxation |
| 3 Granular | soil to pebbles to sand grains, glints | same gate |
| 4 Depth paint | refracted flake layers, glints, thin film, holo foil | same gate |
| 5 Authoring | schemas, prompt-to-preset CLI, photo stats, CMA-ES fit | a prompt gives a usable preset |
| 6 Package | npm package, docs, public demo | install in a fresh three.js project in under 5 minutes |

## 6. Open checks before coding

- Zhao 2016 fiber equations, from the paper.
- Whether Deliot and Belcour 2023 needs a LUT.
- TSL `fwidth`, `dFdx`, `dFdy` and the `Loop` behaviour in r187, on both backends.
- Licences of Infinigen, VLMaterial, Chermain and Deliot code. Reimplement from papers in any case.
