# Cost of each matter

Measured with `node tests/bench.mjs` on the cube wall (`cubes.html`), Apple M-series GPU, headless Chromium.
Each matter fills a 1920x1080 frame (2.07 Mpx), seen straight on at 30 cm (the whole face), 2 cm and 1.5 mm.
Times are GPU time from timestamp queries, in ms per frame, above the baseline (a grey cube in the same views), SSAO off.

| Matter | WebGPU 30 cm | 2 cm | 1.5 mm | WebGL2 30 cm | 2 cm | 1.5 mm |
|---|---|---|---|---|---|---|
| baseline (grey cube) | 0.77 | 0.74 | 0.74 | 1.64 | 0.97 | 0.96 |
| Jersey (with fuzz) | 5.58 | 8.31 | 7.87 | 8.75 | 9.43 | 9.69 |
| Jacquard from a texture (with fuzz) | 5.49 | 7.55 | 7.55 | 8.74 | 9.66 | 9.44 |
| Hemp rope (with fuzz) | 4.70 | 6.56 | 5.77 | 6.20 | 9.10 | 9.20 |
| Full grain leather | 3.19 | 5.94 | 5.57 | 6.25 | 8.98 | 8.93 |
| Cracked, aged leather | 4.26 | 5.63 | 6.42 | 6.75 | 8.63 | 8.45 |
| Patent leather | 4.18 | 5.47 | 5.15 | 6.64 | 8.56 | 8.53 |
| Wet leather | 4.94 | 5.40 | 6.09 | 6.58 | 8.93 | 8.70 |
| Skin, very fair | 4.31 | 6.15 | 5.73 | 4.01 | 6.63 | 5.79 |
| Skin, medium | 4.66 | 4.96 | 5.44 | 5.44 | 5.94 | 6.17 |
| Skin, very dark | 4.25 | 5.69 | 5.98 | 3.97 | 6.32 | 6.32 |
| Hammered bronze | 6.04 | 8.80 | 8.80 | 7.85 | 9.63 | 9.83 |
| Copper and patina | 6.13 | 8.80 | 8.81 | 7.85 | 9.56 | 9.66 |
| Brass | 6.16 | 8.80 | 8.83 | 7.39 | 9.55 | 9.60 |
| Polished gold | 6.15 | 8.81 | 8.81 | 9.05 | 9.74 | 9.45 |
| Wet wool (no fuzz) | 2.52 | 3.88 | 3.90 | 5.96 | 9.16 | 8.78 |
| Varnished rope (no fuzz) | 0.00 | 0.00 | 0.20 | 0.74 | 0.69 | 0.00 |
| Worn bronze | 6.02 | 8.78 | 8.77 | 10.61 | 16.81 | 15.79 |

The whole wall seen from above (203 cubes, 17 lit, each a few pixels): 0.46 ms WebGPU, 1.22 ms WebGL2.

What it says:
- The cost is per covered pixel, not per object. 200 cubes far away cost less than one face filling the screen.
- Far views are only about 30 % cheaper (30 cm column). The faded levels are still computed, then weighted by zero. Branching them out is the next optimisation.
- The metal is the most expensive surface (three scratch scales, each a 3x3 cell search). The rope surface is almost free: on the hemp rope, the 4 to 5 ms are the fuzz shells.
- WebGL2 costs 1 to 2 ms more than WebGPU on the same matter.
- One matter filling a 1080p screen costs 3 to 9 ms: fine at 60 fps alone, too much for a whole scene of them at once. A game would use one or two close matters and plain materials far away.

Older numbers above in this repo (readback timing) were capped by the display cadence; use these.
