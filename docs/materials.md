# Infinitex material catalogue

The list of matters the library should cover, grouped by generator family. A family is one TSL graph with its parameters; many matters are presets of the same family. For each matter, the right column says what the zoom reveals.

Status: **done**, *in progress*, or nothing (to do).

## 1. Knit (done)

Family `knit` (`src/families/knit/`). The preset key `stitch` picks the fabric, read when the graph is built:
- `jersey` (default, stitch.js): V legs, plies, fibres, cuticle scales, parallax; the jacquard reads one colour per stitch from an image. This path is untouched by the patterns.
- `rib`, `garter`, `seed` (patterns.js, pieces.js, cells.js): each cell is a knit V or a purl stitch. A purl stitch is the back of the V: the head of the loop (a frown over the column) and the sinker loop (a smile between columns), drawn as two bowed capsules (elements.js). Raised stitches get a lift, so rib columns stand out and garter ridges sit over sunk knit rows. A macro relief (height and AO by pattern period) keeps ribs and ridges readable once single stitches are below a pixel.
- `cable` (cable.js): two 3 stitch strands per 6 stitch panel cross every 8 rows, always the left one in front (rope). Knit legs are evaluated in the frame of each strand, so they lean as it travels; the ground is reverse stockinette. Strands are lifted and domed; the back strand sinks at the cross and the rope pinches there.
- `lace` (lace.js): eyelets every other row in a diamond (10 stitches by 16 rows). A radial warp pushes the stitches away from each hole, a yarn over arches over its top, the backing colour (`backing_color`) shows through. Far away each eyelet becomes a soft dark disc of the same area.
- `crochet` (patterns.js, elements.js): single crochet, five pieces per stitch (two loops lying on top as a sideways V chain, a post of two strands, a yarn over around it), odd rows mirrored, holes between posts.
- `fleece` (fleece.js): its own graph. Mottled pile, rounded brushed tufts (about 1.6 mm) with soft crevices, three layers of curly 14 um polyester fibres, pills with a lumpy soft outline, tangled fibres and their own shadow. The fuzz shells add the loose fibres above.
Every pattern reuses the ply and fibre levels (yarn.js) and the fuzz shells. Far views use CPU means of AO and slope over one pattern repeat (pstats.js, the twin of stats.js).

| Matter | Zoom |
|---|---|
| **Jersey** (sweater, t-shirt) | V stitches, plies, fibers, scales |
| **Jacquard from a texture** (game character) | one colour per stitch |
| **Rib (2 x 2)** | raised V columns, sunk purl bumps, plies, fibers |
| **Garter** | a ridge of purl bumps every two rows |
| **Seed stitch** | knit and purl alternate: a pebbly check |
| **Cables (Aran)** | crossed raised strands on a purl ground |
| **Crochet** | loop chains, posts, holes between posts |
| **Lace** | round eyelets, yarn overs, the backing through the holes |
| **Fleece** | brushed tufts, curly fibres, pills |

Limits: patterns skip the parallax probe of jersey (cost). Lace eyelets show a backing colour, not the scene behind. The cable macro AO mean is estimated, not computed. Rib columns are not drawn in, so purl columns are wider than in a relaxed rib.

## 2. Woven

Family `woven` (`src/families/woven/`). Two optional layers, compiled only when the preset uses them:
- `brocade: 1` (brocade.js): a half drop floral repeat (`motif_mm`, a six petal flower on a waving stem with two leaves, a four petal filler) woven in floats of a gold weft. The motif is read at the middle of each gold row (`gold_picks_per_cm`), so its edge steps from row to row as in a real loom. A binding warp ties each float every `binding` ends, two ends further on each row (a twill line). Each row holds two gold threads: a flat gilt strip wound around a yellow silk core, the core seen in the narrow gaps between the wraps; rolling lines on the strip, the gilt rubbed off to silver on the highest points. Petal veins, an inner outline and leaf ribs are lines of ground left between the floats; the ground is shaded along the edge of the gold.
- `sheer: 1` (sheer.js): the gaps between threads are holes and a thread lets light through (`thread_opacity`). Drawn blended and two sided, so the far face of the cube shows through. Far away the opacity is the mean of the cell: open area (1 - fill)^2, two layers where threads cross.

| Matter | Zoom |
|---|---|
| Linen | irregular slubby yarns, flat ribbon fibers |
| Cotton (shirt, canvas) | plain weave, twisted yarns, twisted fibers |
| Denim | diagonal twill, blue warp, white weft |
| Silk, satin | long shiny floats, smooth translucent fibers |
| Tweed, herringbone | mottled yarns, zigzag |
| Burlap, canvas | coarse hairy yarns, gaps |
| Tartan | crossed colour bands |
| **Brocade**, damask | gold floral motif, floats tied in a twill line, gilt strip wound on a silk core |
| **Voile, organza**, gauze | open, see-through, fine smooth threads |
| Carbon fiber | twill under a deep clear coat |

## 3. Pile (cut and looped) (*in progress*: family written, first review)

Family `pile` (`src/families/pile/`), one mode per graph. The uniforms are a superset of the strands ones, so the same object is the spec of the 3D strands (`hair: (u) => u`) and, in fur mode, the input of the strands graph. Tufts are the hair locks: `tuft_mm` is `lockM`, and the painted tufts use the same jittered lattice as `core/hair3d.js`, so near the camera the 3D tufts stand where they were painted.
- shared (fibres.js): the brush field (lean of the pile, turned by crushed patches, the same flow as the 3D strands) and the view along it (camera on the tip side: dark depth of the pile; on the root side: light fibre sides); fibre ends as short round streaks along the lean, two layers; a twisted yarn seen from the side (helix ply bands, fibre lanes, optional crossing fibres for loose yarn).
- `cut` (cut.js): tufts every 3 mm, each the cut end of a 2-ply yarn (two round ply ends, a pinwheel of fibres), shadow between tufts, fibre ends. 3D strands near the camera: the free fibre ends above the yarn bundles (`pile_mm` 3), gathered by tuft (`clump`).
- `loop` (loops.js): berber loops in rows (alternate rows shifted half a loop, loops not quite level), 3-ply yarn, flecks as patches where a share of the fibres is dark.
- `terry` (loops.js): loose loops in three layers, rings of soft yarn seen at every tilt, their roots hidden, a dark ground in the gaps; crossing fibres for the fuzzy cotton.
- `velvet`, `cord` (velvet.js): soft tuft clusters (0.45 mm), fibre ends, crushed patches (lighter, shinier), nap shading with the view, strong sheen; 3D strands near the camera. Corduroy: rounded wales with a cut channel showing the ground weave, no 3D strands.
- `knot` (knot.js, rugpattern.js): one colour per knot from a small Persian design (selvedge, guards, main border with rosettes and vine, field lattice, lobed medallion with pendants, spandrels, a dark outline one knot wide), abrash bands, fuzzy tufts leaning down the rug, wool texture, fibre ends; `fringe: 1` adds a kilim band and the warp fringe at both ends.
- `fur`: faux fur through the strands graph (even fibres, frosted glossy tips) and 3D strands.

| Matter | Zoom |
|---|---|
| Cut-pile carpet | standing tufts, two twisted plies cut open, fibre ends (3D) |
| Loop carpet (berber) | tight loops in rows, plies, flecks, fibres |
| Velvet | crushed patches, tuft clusters, fibre ends (3D) |
| Corduroy | wales, cut channels, ground weave, fibre ends |
| Terry (towel) | loose loops, soft plies, crossing cotton fibres |
| Knotted rug (Persian) | design in knots, abrash, wool fibre ends, kilim and fringe |
| Faux fur | long even synthetic hairs, light tips (3D) |

Limits:
- The demo AO pass (GTAO) darkens the window of 3D strands at mid distance (each strand writes depth); without it the window matches the painted pile. The strands family has the same issue.
- The 3D tufts use the square jittered lock lattice of hair3d: no tufts in strict rows. Corduroy and the rug get no 3D strands: hair3d has no root mask (channels) and one colour per spec (knots).
- At the closest zoom the camera sits inside long pile (faux fur, like the strands fur).
- Loops are painted with a parallax-free height: at grazing views they do not occlude each other.

## 4. Non-woven

Felt and boiled wool, paper, cardboard and corrugated board, papier-mache.

## 5. Basketry and braiding

Wicker, raffia, bamboo and tatami are `woven` presets; rope is family `rope`. Family `interlace` (`src/families/interlace/`) draws the open or plaited structures, one mode per graph:
- `cane` (cane.js): seven step chair cane. Vertical pairs on x = i, horizontal pairs on y = i + 1/2, single diagonals both ways on x +- y = k, in units of the repeat (`pitch_mm`). A pair and both diagonals cross at each star (six branches); the diamonds left between the diagonals, cut by the pairs, are the octagonal holes. The highest strand wins; the crimp has flat levels (over, between, under) so the edge of the strand on top stays straight, and a strand casts a shadow on the one it passes over. Flat glossy binder cane (2 to 3 mm), its cut fibrous edges lighter, rattan nodes every 20 cm, vascular streaks (80 and 20 um), dull scuffs.
- `braid` (braid.js): three strand plaits (`pitch_mm` wide) sewn side by side. Curved segments from each side cross the middle in turn and dive under the next one with a round tip; the crossings cycle through the three strands, so three colours repeat every three segments. Each strand is a bundle of round yarns (`twist_mm` wide) following its curve, each yarn twisted in plies at 20 degrees, fibres along the plies.
- `mail` (mail.js): European 4 in 1. Rings (`pitch_mm` outer diameter, `strand_mm` wire) are tilted tori seen as ellipses of round wire; each row leans the other way, so a ring passes over a ring of the next row at one crossing and under it at the other. The ring above shadows the one below. Butted joints, drawing lines along the wire, pliers dents, oxide patches, the odd bright replaced ring, rust in the crevices.
Cane and mail cut their holes (blended opacity, two sided); far away the opacity is the mean coverage, measured once in JS on the same geometry.

| Matter | Zoom |
|---|---|
| Wicker, rattan | round strands over and under, knots, bark |
| Raffia, straw, rush | flat dried leaf strips, veins |
| Woven bamboo | flat slats, long fibers |
| **Cane webbing** (chair) | six-way star mesh, octagonal holes, glossy rattan skin |
| Mat, tatami | tight rush, binding threads |
| **Rope** (game character mask) | twisted strands, hemp fibers |
| **Braid** (three strand plaits) | interlaced strands, twisted yarns, fibres |
| **Chain mail** | interlinked butted rings, 4 in 1, drawing lines |

## 6. Leather (tanned, dead skin) (*in progress*)

| Matter | Zoom |
|---|---|
| **Full grain** (game character apron) | wrinkles, crease grain, craquelure, pores, finish micro cracks |
| Cracked, aged | crack patches, worn edges |
| Patent, shiny | thick varnish, sharp reflections |
| Wet | darkened, water film |
| Suede, nubuck | short fiber nap that shifts shade |
| Exotic (crocodile, snake, ostrich, stingray) | scutes, scales, quill bumps, shagreen beads |
| Faux leather, PU | too regular printed grain, fabric backing, flaking |
| Parchment | thin translucent skin, fibers |

## 7. Living skin, human (*in progress*: family written, waiting for a character that shows skin)

Living skin differs from leather: light enters it (subsurface scattering, three.js `MeshSSSNodeMaterial`), blood colours it, it is moist and oily, and fine hair grows on it.

| Matter | Zoom |
|---|---|
| Skin tones, very fair to very dark | colour from two pigments: melanin (tone) and hemoglobin (blood flush), not a single tint |
| Face | larger pores on the nose and cheeks, fine lines, vellus hair, oily sheen |
| Lips | vertical furrows, wet, more translucent |
| Palms, fingertips | ridges and fingerprints, sweat pores along the ridges |
| Knuckles, elbows | deep folds, darker, drier |
| Scalp, beard area | follicles, stubble |
| Freckles, moles, veins | spots, blue veins under thin skin |
| Age | wrinkles, thinner skin, spots |
| Scars, burns | smooth shiny tissue, no pores |
| Tattoo | ink under the skin, blurred by the dermis |
| States | sweat, wet, cold (goosebumps), sunburn, blush, make-up, dirt, blood |

## 8. Living skin, animals

Living snake: a `scales` overlap preset with keels, iridescence (micro ridges, thin film) and a rainbow boa pattern (`pattern_shape: 'ocelli'`, scales/pattern.js: dark rings around a heart of the ground colour, small spots between, read per scale). Jellyfish: family `jelly` (`src/families/jelly/`), mode `medusa` (medusa.js). A transmissive surface (ior 1.34): a moon jellyfish bell per `bell_mm` with an eight lobed rim and rhopalia, four violet horseshoe gonads, frilly oral arms, sixteen radial canals (every other one branching twice), ring canal, coronal muscle rings and a tentacle fringe; nematocyst warts (0.4 mm) and glowing photocytes along the rim and the canals (emission); at the loupe, eggs in the gonads, the epidermis (12 um cells), capsules packed in each wart, wandering cells and elastic fibres. Organs let less light through, so they read as milky or violet shapes inside the clear body.

| Group | Matter | Zoom |
|---|---|---|
| Hairless mammals | elephant, rhinoceros | deep wrinkle net, cracked dry skin, bristles |
| | pig | thin pink skin, sparse bristles |
| | hippopotamus | moist, oily, pink secretion |
| | whale, dolphin | smooth rubbery skin, fine ridges, scars |
| Furred mammals | cat, dog, horse, bear, sheep | fur coat (undercoat and guard hairs, family 9) over the skin |
| Reptiles | **snake** | overlapping scales, keels, iridescence, shed skin |
| | crocodile | bony scutes (osteoderms), soft folds between |
| | lizard, chameleon | granular scales, colour cells (chromatophores) |
| | turtle, tortoise | shell plates with growth rings, scaly skin |
| Amphibians | frog | moist, glandular, slimy shine |
| | toad | warts, dry |
| | salamander | smooth, wet, spots |
| Fish | scaled fish | overlapping scales, silvery guanine shine, mucus |
| | shark, ray | dermal denticles: tiny teeth, sandpaper to the touch |
| Birds | feet | scutes and small scales |
| | bare skin (comb, wattle, neck) | wrinkled, red, bumpy |
| | feathers | rachis, barbs, barbules (family 9) |
| Arthropods | beetle | chitin, iridescent colour from nanostructure |
| | crab, lobster | shell, spines, pits |
| Molluscs | octopus | colour cells, papillae, suckers |
| | snail, slug | mucus, wrinkled foot |
| Others | **jellyfish** | translucent jelly, canals, gonads, glowing dots, cells |

## 9. Hair, fur, feathers

Hair (strands, hair, cuticle scales), animal fur (undercoat and guard hairs), feathers (rachis, barbs, barbules, a true fractal), raw fleece.

Hair, fur, fleece and body hair have three levels:
- far: painted strands in the surface (strands family, skin hair);
- near: real 3D strands that grow out of the surface along its normal (`core/hair3d.js`, `InfinitexMaterial.createHair`).

The 3D strands live in a window around the point the camera looks at. Each root comes from a hash of its cell, so a strand always comes back at the same place. The cost stays bounded: one instanced draw of 128 x 128 strands at most. When the window must grow, the grid coarsens by powers of two, and each coarse cell keeps one of its children: coarse levels are subsets of finer ones, so strands thin out instead of popping. On skin, the painted hairs fill in for the strands the coarse levels leave out.
Per preset: `density_cm2`, `stand_deg` (root angle), `pile` (layer height / length), `clump` (tips of a lock meet). Skin: `hair_stand_deg`, `hair_pile`. Wool crimp is drawn in the fragment stage, inside a wider ribbon.
Light in the hair (`core/hair3d_shade.js`, a lighting model per light):
- self-shadow: light reaching a strand crossed the strands above it, transmittance exp(-tau depth / cos), tau from density, length and width (deep opacity, analytic since the layer is a slab); below the surface the body blocks it;
- occlusion: the same depth darkens the ambient light;
- depth tint: deep strands come out darker and more saturated (light scattered many times);
- translucency: the TT lobe of Marschner's fibre model, so backlit hair glows;
- a second, coloured highlight along the strand (TRT, Marschner 2003; shifted twin highlights after Scheuermann 2004).
Shadows on the surface (`core/hair3d_shadow.js`): each strand projected along the main light onto the tangent plane, drawn black and alpha blended, sharp at the root. Only the sharp part is drawn, and only at fine levels: wide soft shadows of thousands of strands cost up to 60 ms.
Cost at 1920x1080 (M-series, WebGPU): fur and hair add 2 to 5 ms, crimped fleece up to 10 ms; the shadows add 0 to 1.5 ms.
Limits: the surface under the window is its tangent plane (exact on flat faces); strands do not shadow each other one by one (statistical self-shadow only); shadows come from the brightest directional light.
Pile fabrics (family 3) use it too: cut carpet, velvet, faux fur. Next: grass.

## 10. Wood (*in progress*: family written, first review)

Family `wood` (`src/families/wood/`), one mode per graph:
- `board` (board.js): growth rings as a distance from the pith, so the cut decides the figure: `flat` (cathedral arches), `quarter` (straight lines, ray flakes), `rotary` (plywood face, broad flames). Each year has its own latewood width and darkness. Knots bend the rings into an eye and show their own rings, a dark rim and cracks. Then rays, vessel pores (ring porous or diffuse), streaks along the grain, and fibres cut open with pits on their walls.
- finishes (finish.js): saw marks, weathering (grey, earlywood washed out, latewood ridges), drying checks, paint that cracks along the latewood and flakes in long patches, char (domed blocks, crazing, brushed variant). Checks, paint and char are compiled in only when the preset uses them.
- `chips` and `cork` (composite.js): particle board (coarse slivers in two directions over fine particles, glue seams, voids); agglomerated cork (granules, gaps, lenticels, cork cells).
- `bark` (bark.js): plates long along the trunk, V-shaped fissures, striations, lichen, cork cells.
Varnish and wetness come from the surface states (`gloss`, `wetness`).

| Matter | Zoom |
|---|---|
| Raw (rough sawn oak) | saw marks, rings, rays, oak pores, fibres |
| Sanded, varnished (walnut) | deep coat, filled pores |
| Painted, peeling (pine) | paint cracked along the grain, grey wood beneath |
| Driftwood | eroded earlywood, latewood ridges, checks |
| Charred (shou sugi ban) | domed char blocks, fine crazing |
| Plywood (birch, rotary) | broad flames, pin knots |
| Particle board | pressed chips, glue, voids |
| Cork | granules, lenticels, cell honeycomb (30 to 40 um) |
| Bark | plates, fissures, lichen |

## 11. Metal (*in progress*: family written, first review)

Family `metal` (`src/families/metal/`), one mode per graph:
- `hammered` (hammered.js): copper alloys and gold. Hammer craters packed side by side, tarnish film, verdigris crust with pits, scratches on three scales (scratch.js `marks`), crystal grains.
- `rust` (rust.js, oxide.js): two oxide layers. A thick porous scale (0.25 mm) broken into ragged flakes of `flake_mm`: part fell, part lifted into blisters, free edges curl up, hairline cracks between flakes. Under it a thin dark compact layer in smaller flakes; where it fell too, bare dark iron. Ledges cast a thin shadow. Pits of 0.1 to 0.6 mm with fresh orange rust at the bottom. Fine crust (oxide.js): tubercles of 0.6 mm, lumps of 0.14 mm with a few open borders, oxide grains of 18 um with pores, dark magnetite patches.
- `brushed` (brushed.js): belt passes seen from afar (long bands), parallel grooves on four scales (rows 400, 120, 35 and 10 um apart, scratch.js `grooves`), stretched highlight across the grooves (`anisotropyNode`, which also stands for the sub-micron scratches), rolled grains stretched along the sheet, manganese sulfide stringers.
- `chrome` (chrome.js): a mirror. Slow waviness of the polished base, buffing swirls (short arcs, rows 250, 80 and 25 um apart), plating pits of 20 to 80 um with a rim, microcrack network (cells of 250 um), nodules of 6 um. The faded levels hand almost no variance to the roughness, so the far view stays a mirror.
- `painted` (painted.js): red oxide primer and a top coat. Ragged chips from a fractal field; its gradient (finite differences) turns the field into a distance in meters, so the rims are anti-aliased by the footprint and bevelled per pixel: coat step (90 um), primer band (30 um), bare steel. Rust creeps under the coat around each chip (brown, lifted, blistered). Orange peel (1.4 and 0.35 mm), scratches to the primer, wiping marks, pigment mottle, dust grains and solvent pops; the oxide crust of oxide.js on the rusty steel.
Wetness, gloss and wear come from the surface states.

| Matter | Zoom |
|---|---|
| Hammered bronze, copper and patina, brass, polished gold | craters, verdigris crust and pits, scratches, crystal grains |
| Rusted iron | layered flakes, blisters, pits, bare iron, oxide lumps and grains |
| Brushed steel | belt bands, parallel grooves on four scales, stretched highlight, stringers |
| Chrome | mirror; buffing arcs, plating pits, microcracks, nodules |
| Painted steel | orange peel, chips down to primer and steel, rust creep, dust, pops |

Limits: the demo film has depth of field and a pre-blurred room environment, so the chrome mirror reflects soft shapes; the brushed highlight is stretched by three.js anisotropy, whose lobe grows fast (alphaT = mix(r^2, 1, a^2)), so presets keep `anisotropy` near 0.3. The oxide lumps still show their Voronoi outline in places. Hash ids wrap at 4096 cells, so the micron levels (nodules, grains) have a seam every 25 to 75 mm.

## 12. Stone and building (*in progress*: family written, first review)

Family `stone` (`src/families/stone/`), one mode per graph:
- `granite` (granite.js): interlocked crystals on an anisotropic Voronoi (crystals.js: each seed its own size, length and angle). Pink K-feldspar and milky plagioclase laths, clusters of smoky quartz and black mica flakes between them. Inside: plagioclase twin stripes, perthite, zoning, cleavage cracks, alteration dust; quartz healed fractures and fluid inclusion trails; mica sheets, each flake a tilted mirror that flashes. `polish` 1 polished (scratches up close), 0 flamed (frosted feldspar, spalled quartz).
- `marble` (marble.js): grey clouds, feathery wisps along the trend, a branching vein net on a warped Voronoi with halos; calcite crystals with seams, twin lamellae, cleavage and plucked pits. The only mode on the SSS material (`scatter`): index.js now accepts `material` as a function of the uniforms.
- `sandstone` (sediment.js): cross-bedded sets of inclined laminae, iron banding, heavy-mineral seams; rounded grains (quartz, feldspar, lithics) in cement, iron rims, frosted skins.
- `slate` (sediment.js): cleavage terraces with risers and a tilt per layer, lineation, sericite flakes (sheen and sparkles), rare pyrite cubes (metal) with rust halos.
- `concrete` (concrete.js): board formwork (joints, wood grain print), mottled paste, air bubbles in two sizes, worn patches with gravel and sand cut flat, cement grains and capillary pores.
- `brick` (brick.js): running or English bond, recessed tooled mortar, firing colour per brick with flashed ends, chipped arrises, sand, grog, iron specks, silt and pores.
- `plaster` (plaster.js): trowel strokes (tilt, burnish, lip), drag lines, pinholes, filler grains, gypsum needles.
Shared blocks in common.js: fbm with footprint fade, anti-aliased bands and line sets, packed grains, polishing scratches. Wetness and wax come from the surface states.

| Matter | Zoom |
|---|---|
| Granite (pink, polished) | twinned feldspar, cracked quartz with inclusions, mica sheets |
| Marble (Carrara, polished) | clouds and wisps, twinned calcite grains, veins of fine grains |
| Sandstone (buff, cross-bedded) | laminae, rounded grains, cement, frosted skins |
| Slate (split) | cleavage steps, sericite sparkles, pyrite |
| Concrete (board formed, worn) | aggregate, sand, bubbles, cement grains |
| Brick and mortar | bond, chipped edges, sand and grog, clay |
| Plaster (trowelled) | trowel passes, pinholes, gypsum needles |

Polish pass: granite crystals use a box metric in each crystal's frame (`square` in crystals.js), so faces are straight and laths angular; feldspar carries mica and apatite inclusions; polished granite and marble get a clear coat lobe (`polish`) that reflects the room. Marble has a third, feathered vein net and a vein tone from grey to dark grey; each calcite grain tilts on its own, so the grain sparkles. Concrete prints the board grain in colour and relief, with fines, pinholes and craze cracks; plaster has sweep arcs and a second crop of pits. Sandstone laminae are straight sets cut by inclined erosion surfaces with a drape, iron per lamina and per set. Grain outlines wobble, so touching grains no longer read as one disc. Pyrite is a striated four-facet pyramid in metal.

Limits: the cube light (sun 2.2, ACES) still lifts white matters, so plaster strokes read mostly by relief. Granite from afar is a dense speckle, closer to a coarse granite than a fine one. Big marble veins can look like thin dark cracks at the 4 cm view. Sandstone laminae seams are evenly spaced lines. Brick sand grains are still a little bright up close.

## 12b. Terrazzo (*in progress*: family written, first review; the template of the material kit)

Family `terrazzo` (`src/families/terrazzo/`). Marble chips cast in cement, ground flat and polished: floors, stairs, counters. It got a family because no other one has hard chips of several stones flush in a binder (granite is interlocked crystals, concrete is aggregate cut by chance). It is also the template that `npm run new-family` copies, so it follows every rule of `docs/authoring.md` in a few short files (params.js, levels.js, shader.js, index.js).
- L0 chips: three stones (`color`, `color2`, `color3`), irregular cells with a size of their own, veined inside; the cement (`matrix` share) sits `edge_um` lower, a rounded step at each border.
- L0b fines: chips a third of the size in the cement (`fines` share).
- L1 grains: sand grains in the cement, calcite grains in the chips (`grain_mm`), air voids (`pores`).
- L2 crystals: inside each grain a mosaic of calcite crystals, half of them twinned (lamellae a quarter of a crystal wide); silt in the cement (`fine_um`).
- L3 scratches: grinding scratches (`polish_um`) in patches of one direction.
- L3 pits: plucked crystals on the chips, capillary pores in the cement (`pit_um`, `pits`).
- Under them the generic micro detail, from 8 um.
The far colour is exact: the chip coverage was measured on 400k samples and tabulated (params.js), the fine tones have zero mean, pits and voids hand their coverage to the mean. Check: mean shift 0.35 % at worst, shimmer 1.21 at worst, 2.4 to 3.2 ms at 1080p (WebGPU), WebGPU and WebGL2. On the cube wall in row 12.

| Matter | Zoom |
|---|---|
| Venetian terrazzo (white, red, grey chips) | chips and fines, sand and calcite grains, twinned crystals and silt, scratches, plucked pits |

## 13. Ground and grains (*in progress*: family written, first review)

Family `ground` (`src/families/ground/`), one mode per graph. Shared blocks in `grains.js`: packed rounded grains (a Voronoi cell blended with an ellipse by a smooth min, analytic slope; two layers so small grains show in the gaps), curved fibres (one per cell, 3 x 3 search, faded out below two pixels), fbm.
- `soil` (soil.js): clods with shadowed voids, stones, crumbs of crumbs, dark organic specks, sand grains, root fibres; silt and fungal hyphae up close.
- `sand` (sand.js): wind ripples (gentle windward, steep lee, dark minerals in the troughs), packed grains of quartz, feldspar, dark minerals and shell, each leaning its own way; frosted pits and conchoidal facets that glint.
- `gravel` (gravel.js): two sizes of pebbles of five rocks, flat or round, half of them chipped into flat faces with sharp edges, quartz veins, deep damp gaps filled with sand; rock crystals (granite speckle), then domed mineral grains (quartz, feldspar, biotite) and pits.
- `mud` (mud.js): polygon plates with wandering cracks, lips curled up, edges dry and pale, wet dark hearts; second-order cracks, craquelure, crazing, pinholes; silt and shiny clay platelets.
- `snow` (snow.js): sastrugi and sun cups with blue hollows, a granular crust; clear sintered grains bonded by necks (blue green cores, thin bright rims, a few glints), hexagonal plates with six arms up close.
- `frost` (frost.js): fern feathers on dark glass, four self-similar levels of branches at 60 degrees (two layers of feathers), hoar grains between.
- `ice` (ice.js): parallax layers along the refracted view ray fake the depth (no transmission): clouds, fracture planes with feathered side cracks, bubbles at two depths, strings of tiny bubbles, frosted skate scratches; a clear coat on top.
- `crystals` (crystals.js): tilted salt cubes showing top and side faces, hopper terraces, bright edges; `cubic: 0` gives rounded sugar grains. Crystal dust in the gaps.
- `dust` (dust.js): a layer on black lacquer, thicker on faces turned up (world normal), drifts and thin patches, a finger swipe (clean stroke, streaks along it, soft piled edges); grit, motes, skin flakes, pollen, dyed lint and hairs; dust kills the gloss.

| Matter | Zoom |
|---|---|
| Soil | clods, crumbs, roots, silt, hyphae |
| Sand | ripples, quartz and dark grains, frosted facets |
| Gravel | pebbles of several rocks, crystals, worn faces |
| Cracked mud | curled plates, craquelure, silt, clay platelets |
| Snow | rounded ice grains, hexagonal plates |
| Frost | fern dendrites, branches at 60 degrees, hoar |
| Ice | bubbles, white cracks, scratches |
| Salt, sugar | tilted cubes, hopper steps |
| Dust | particles, fibres, pollen on a black base |

Limits: salt looks plain white from afar and nothing glitters at far views (it would flicker); the gravel mineral grains up close are a fairly even mosaic; ice depth is a parallax trick, it does not show what is behind; the dust swipe sits at a fixed place on each face (uv 0..1).

## 14. Organic, plants (*in progress*: family written, first review)

Family `plant` (`src/families/plant/`), one mode per graph:
- `leaf` (leaf.js): the face is one big blade (30 cm). Sunken pale midrib, pinnate secondaries every `size_mm` that leave it at about 45 degrees and bend toward the apex, then three orders of reticulate veins on warped Voronoi nets (3.5 mm, 0.9 mm, 0.3 mm), the last enclosing bulging areoles. Under a waxy cuticle: jigsaw pavement cells (`cell_um`), palisade cells seen through them, stomata (two green guard cells, a dark slit with pale lips) on their own grid and never on veins. SSS material: backlit, the blade glows yellow green and the veins brighter.
- `moss` (moss.js, lichen.js): cushion mounds, then three layers of leafy shoots (stars of lance-shaped leaves in two whorls, curved like a pinwheel, keeled, pale tips, some white hair points), dead brown shoots in the shadow below; leaf cells with pale walls and packed chloroplasts. Spore capsules on red setae. Lichen rosettes gathered in patches: lobed margins, forking lobes split by clefts, brown or orange apothecia cups with a rim, cortex cracks and isidia.
- `gills` (gills.js): a cap seen from below, off centre in each 30 cm tile. Cut stem with hyphae, a striate ring, a dark collar, then 256 full gills and lamellulae of three lengths that start where the spacing doubles (rounded inner ends, spacing 0.6 to 1.3 mm everywhere). Each gill a pale crenulate edge, a lit face and a narrow dark slot; radial spore streaks. Up close the hymenium (basidia, `cell_um`) with dark spores (6 x 4 um).
- `bone` (bone.js): ivory compact bone with stains, growth lines and striation; nutrient foramina; a sawn part (`cut`) with a clean cortex band, then spongy bone (warped struts around red brown marrow cavities). Up close: osteons long along the axis, each a Haversian canal with a pale rim, concentric lamellae, cement lines, and osteocyte lacunae lying along the rings. SSS material (weak).
- `horn` (horn.js): translucent amber keratin (SSS) with dark melanin and pale streaks that fray into fibres, wavy growth bands, irregular longitudinal ridges, horn tubules, wavy lamella steps (analytic slope), squames and melanin granules, polishing scratches.
- `nacre` (nacre.js): mother of pearl. A thin film (`iridescenceNode`, IOR 1.68) whose thickness follows broad flames along the growth contours round an umbo off the face; the diffuse part also carries a pastel interference hue, so colours read under any light. Growth contour lines, then aragonite tablets (`cell_um`) in 20 um terraces, each terrace a new layer and each tablet its own film thickness. On `shell` share of the face the outer shell remains: a white prismatic lip (calcite prisms), brown periostracum on irregular growth ridges, radial ribs, chalky specks.
Shared blocks in common.js (plus stone/common.js): warped vein nets with an analytic relief slope, bulging cells (polygons or jigsaw pieces), a ridge profile. Wetness, wax and wear come from the surface states.

| Matter | Zoom |
|---|---|
| Leaf | vein orders, areoles, jigsaw cells, stomata with guard cells |
| Moss, lichen | leafy shoots, capsules, leaf cells and chloroplasts; lichen lobes, cups, cortex cracks |
| Mushroom (gills) | gills of four lengths, pale edges, hymenium and spores |
| Bone | osteons, Haversian canals, lamellae, lacunae; spongy trabeculae in the cut |
| Horn, nail | streaks, growth bands, ridges, lamella steps, squames |
| Mother of pearl, shell | iridescent flames, growth lines, tablet terraces; outer shell ridges, prisms |

Limits: moss is painted (no 3D shoots near the camera; `core/hair3d.js` draws strands without leaves). The moss and lichen leaves are flat colour shapes up close, a little graphic. Gills and nacre place their centre (stem, umbo) per 30 cm tile, so they assume cube-like coords. The horn is plain at the 4 mm view (polished keratin has little there). Nacre is pastel and soft at mid zoom; the tablets read as fine speckle at 4 mm.

## 15. Plastic and synthetics (*in progress*: family written, first review)

Family `plastic` (`src/families/plastic/`), one mode per graph:
- `solid` (solid.js): a moulded part. Masterbatch mottling, flow lines around a gate, parting line (ridge, flash, 20 um step), ejector pin discs with lathe rings, orange peel. Mould textures in three octaves: spark eroded grain (craters with a recast rim) or bead blast (smooth dimples, uneven passes).
- its life (life.js): scratches on three scales, swirl marks (bands of concentric hairlines, read as hazy arcs from afar), fingerprints (grease ridges), dust grains and lint, scuffs. Its age (aged.js): UV yellowing toward `color2`, chalk (pale, matte, pits), crazing (two nets of cracks with grime). Silicone (silicone.js): milky at grazing angles, saturated face on, air bubbles in three layers drawn with parallax, lint stuck on the tacky skin. Each layer is compiled only when the preset uses it.
- `tyre` (tyre.js): ribs, slanted staggered blocks, wear bars, zigzag sipes, mould vent stubs, Schallamach abrasion waves, filler grit.
- `foam` (foam.js): open cells, three layers of struts with parallax, Plateau borders, a few closed windows, cut gas pockets.
- `ripstop` (ripstop.js): plain weave of flat multifilament yarns, a raised grid of paired threads, filaments, anisotropic highlight.
- `print` (print3d.js): FDM beads, Z wobble, seam, nozzle drag lines and extrusion ripples, a worn spot sanded through to the gyroid infill.
- `record` (record.js): a 12 inch LP centred low on the face. One spiral groove (V of 90 degrees), track bands, stereo walls modulated in four frequency bands, label with print, radial streak from anisotropy at a distance.
Shared helper: `core/marks.js` (scratch segments, AA by pixel coverage).

| Matter | Zoom |
|---|---|
| Moulded (textured black ABS) | spark eroded craters, recast rims, finer craters |
| Glossy (red ABS) | swirl arcs, hairline scratches, dust and lint |
| Matte (bead blasted) | packed round dimples, fingerprints |
| Worn, yellowed | crazing with grime, chalky pits |
| Rubber, tyre | blocks, sipes, vents, abrasion waves, grit |
| Silicone | bubbles at three depths, lint |
| Foam | strut skeleton, windows, cells behind cells |
| Nylon (ripstop) | reinforcement grid, flat yarns, filaments |
| 3D print | layer beads, ripples, infill under a worn spot |
| Vinyl record | grooves, modulated walls |

Limits: the matte cube is plain at the 4 cm view (the dimples are under 2 pixels there). The record walls at roughness under 0.3 picked out the environment map texels, so walls are kept at 0.38. Swirl marks show by scatter only, not as a true holographic highlight. Ripstop has no coating layer. Silicone fakes translucency in the albedo (no transmission).

## 16. Ceramic and glass (*in progress*: family written, first review)

Family `ceramic` (`src/families/ceramic/`), one mode per graph:
- `glaze` (glaze.js): a glass coat on a clay body. Colour thinner in places (the body shows through), deeper where it pooled; orange peel waves (1 to 3 mm) on its own clear coat normal. Optional layers, compiled only when used: crackle (crackle.js, three generations of Voronoi nets, each shifted by its parent cell id so new cracks end on old ones; inked cracks are a soft stain with a sharp thread in the middle), a hand-painted cobalt motif (motif.js, Delft-like, soft pigment edges, brush streaks, cobalt grains), bubbles held in the coat, pinholes, iron specks. Pigment and ink absorb light (Beer law), so a thin wash stays a clean light blue.
- `clay` (clay.js): terracotta. Kiln mottle and flashing, tool grooves and drag furrows, angular grog grains with a shrinkage gap, pores, a silt matrix with quartz specks and mica glints, salt bloom (efflorescence) in patches and hollows.
- `glass` (glass.js): real transmission (three.js copies the opaque scene once per frame into a mip chain). Frosted: overlapping conchoidal pits (50 um and a third of that, fracture ripples, rare coarse pits); unresolved pits go into the roughness, which also blurs what is seen through. Optional clear bands left unblasted. Blown: waviness and cords as a height that bends the view behind; seed bubbles stretched along the flow at four depths, with parallax from the refracted view ray.
- `enamel` (enamel.js): deep glossy colour under a clear coat, bubbles, specks; chips concentrated on the edges of the panel (`panel_mm`: the uv square), showing the glassy broken wall, the dark ground coat with shell ripples, then metallic steel rusting from the edge of the chip.
Cost (WebGPU, 1920x1080, M-series, above the grey cube): 0 to 3 ms for every matter at 30 cm, 2 cm and 1.5 mm. Transmission costs no more than the glazes, so it is kept real.

| Matter | Zoom |
|---|---|
| Crackle porcelain | black ink cracks, gold thread cracks, hairlines, bubbles in the glaze |
| Faience | cobalt motif, brush streaks, cobalt grains, crazing, pinholes, specks |
| Terracotta | flashing, salt bloom, tool marks, grog, pores, silt, mica |
| Frosted glass | clear bands, blast passes, conchoidal pits, fracture ripples |
| Blown glass | seed bubbles at several depths, cords, waviness |
| Enamel on steel | edge chips: ground coat, steel, rust; bubbles, specks |

Limits: seed bubbles read a little like drops on the surface in still images (the parallax shows they are inside when the camera moves). The glass is one transmissive surface: no back face, no inner reflections. Enamel chips need `panel_mm` to know where the edges are. The motif is one built-in Delft pattern (no image input yet).

## 17. Surface states (done, every family)

Two layers, laid over the result of any family.

First layer, `core/surface.js` (`applySurface`, every family): wetness, gloss (varnish, wax), wear.

Second layer, `core/states.js` (`applyStates`, right after `applySurface`): what lies on the matter or happened to it. Each state has an amount key (an adjective, since plastic, organic and ceramic already use `dust` and `frost` for their own matter) and compiles only when that amount is above 0 when the graph is built.

| Key | Detail keys | Levels | File |
|---|---|---|---|
| `dusty` | `dusty_color`, `dusty_um` | drifts, faces turned up, a clean disc where a vase stood; grit, lint, hairs; motes and skin flakes; kills the gloss | states_soil.js |
| `muddy` | `muddy_color`, `muddy_mm` | splashes and satellites thrown one way, dark wet halo; dry pale rims, crust cracked in 2 to 3 mm plates, wet hearts; sand and silt | states_soil.js |
| `burnt` | `burnt_mm` | scorch wash, burn marks (brown halo, char ring, hole); crazed char plates, spark holes, curled fibre ends; ash crumbs | states_burnt.js |
| `rusty` | `rusty_color`, `rusty_mm` | spots and run-off streaks (they follow world down); blistered paint ring; oxide crust of the metal family | states_rust.js |
| `frosted` | `frosted_color`, `frosted_um` | rime on the tops and faces turned up; ice plates that glint; needles | states_frost.js |
| `bloody` | `bloody_color`, `bloody_mm`, `bloody_age` | soaked stains with a tide line, wicked along the threads; beaded drops and satellites, glossy when fresh, matt and cracked when dried | states_drops.js |
| `sweaty` | `sweaty_mm` | damp film; droplets as lenses (highlight on their own clear-coat normal, dark rim, caustic on the side away from the light); micro beads | states_drops.js |
| `greasy` | `greasy_color`, `greasy_mm` | stains and finger wipes; tide line, thread fingers; each thread and fibre soaked by its share, oil beads; darker, saturated, no fibre sheen | states_stain.js |

Shared shapes in `core/states_shape.js`: `blobs` (splashes, spots, drops, stains: one per cell, 3 x 3 search, ragged or wicked edges, signed distance in meters), `dome` (slope of a liquid cap), `lens` (drop optics), `over`, `hero`. `hero` puts one mark near the middle of a 30 cm face so the deepest zoom of the demo lands on a mark edge; on a real asset it is one mark at that coordinate.

Families wired: wood, leather, woven, metal, knit (not fleece), skin. To opt in another family:
1. In params.js: import `STATES_DEFAULTS, createStatesUniforms, applyStatesPreset` from `core/states.js`; add `...STATES_DEFAULTS` to the defaults, `states: createStatesUniforms()` to the uniforms, `applyStatesPreset( u.states, p )` after `applySurfacePreset`.
2. In shader.js, after `applySurface`: `applyStates( nodes, u.states, { cavity, flatNormal: base, coords: p, fp } );`

| Matter (cube) | Base |
|---|---|
| Dust | varnished walnut board |
| Mud | brown leather |
| Burnt | linen |
| Rust | painted steel |
| Frost on | navy wool jersey |
| Blood | white cotton |
| Sweat | skin |
| Grease | khaki canvas twill |

Limits: amounts at 0 when the material is built stay out of the graph (set() cannot switch a state on later). Streaks and drips use the world down of the tangent frame, so meshes need tangents. The drop lens fakes refraction in the albedo (no transmission). Burnt holes show a dark colour, not a real cut-out. Frost far away reads as a grey veil on the dark wool; sweat is subtle at 30 cm (gloss only). Blood drops stay a little bead-like.

## 18. Painted and decorated (*in progress*: family written, first review)

Family `decor` (`src/families/decor/`), one mode per graph:
- `oil` (oil.js, landscape.js): a landscape laid in with brush strokes of `size_mm`. Each stroke takes one colour from the picture near its centre and follows the forms (`brushFlow`); later strokes cover earlier ones (painter's order by hash, 3 x 3 cells). Impasto: paint pushed up along both edges, a blob where the brush lifted or a thin dry tail. Bristle grooves along the stroke (`feature_mm`), linen canvas showing where the paint is thin, craquelure (reuses `ceramic/crackle.js`), yellowed varnish, pigment grains.
- `embroidery` (embroidery.js): a flower spray every `size_mm` over a woven ground. Petals in long and short satin (shading steps staggered per stitch), leaves in fishbone, stem in stem stitch, French knots in the heart. Each stitch is a round floss band with twisted strands; the stitched area is padded and shadows the cloth.
- `screenprint` (screenprint.js): plastisol badge in two screens, each shifted (misregistration), halftone dots at the bottom of the sun, mesh bumps and saw-tooth edges, cracks gathered in stretched zones; the weave shows through the ink (`conform`).
- `tattoo` (print.js): the flash drawing (`design_map`, or `tattoo_map` from the cube demo) printed as a dye: it multiplies the woven ground, so the threads keep their relief; old school fills (red, yellow, green) laid by the compass geometry; fibres the spray missed stay pale.
The woven ground is the woven family itself (`buildWovenNodes` on `u.ground`, preset key `ground` with woven keys). The layer gets the surface states; the ground gets wetness and wear forwarded.

| Matter | Zoom |
|---|---|
| Oil painting | strokes, impasto ridges, bristle grooves, canvas, craquelure |
| Embroidery | satin, stem and fishbone stitches, French knots, floss strands |
| Screen print | flat ink, misregistration, halftone, cracks, mesh marks |
| Tattoo on fabric | dye in the threads, missed fibres |

Limits: the oil picture and the badge are one fixed design each. Oil craquelure reads as dashed lines at the 3 mm view. Embroidery has no needle holes in the ground.

## 19. Science fiction (*in progress*: family written, first review)

Family `scifi` (`src/families/scifi/`), one mode per graph. View-dependent colours use `core/optics.js`: `spectral` (wavelength to RGB), `viewTangent` and `upTangent` (view and room light in the surface frame), `interference` (Michel-Levy colours).
- `carpaint` (carpaint.js): pigment darker at grazing views, aluminium flakes at three sizes (coarse sparkle, medium, 25 to 40 um cornflakes), each a tilted mirror; faded levels widen the roughness. Clear coat with orange peel.
- `opal` (opal.js): milky body, potch zones, angular patches each with its own lattice tilt and sphere spacing; Bragg colour from the view angle, brightness from the light the planes mirror; stacking bands and pinfire sub-domains.
- `hologram` (hologram.js): aluminium foil, grating colour lambda = d |(L + V) . g| / m, orders 1 to 3, as the metal reflectance. Rosettes of circular gratings, a seal (star, radial rings), micro stars, guilloche, dot matrix (40 um dots, each grating turned). The grating itself is never drawn (always under a pixel).
- `foil` (foil.js): crumpled film: warped facets in three sizes with creases and a bulge, rubbing scratches; the physical iridescence lobe with a film thickness that drifts and steps per facet.
- `lc` (crystal.js): director field from octaves of a vector noise, its zeros are the defects (two or four dark brushes); retardation from cell thickness, lower in the cores, longer at a slant; dust and bubbles. Backlit: the colour is emitted. Cores whose direction turns faster than a pixel take the mean.
- `screen` (screen.js): a retro sunset with a scrolling grid floor (time uniform), drawn at the screen resolution; pixel rows, then RGB stripes with black matrix and TFT notch, faded to the pixel colour when under a few pixels; anti-glare grain.
- `energy` (energy.js): plasma filaments at five scales (contour lines of a flowing warped noise, time uniform), hex frame with a pulsing groove line, emitter hex grid, frame metal grain. Emissive.

| Matter | Zoom |
|---|---|
| Car paint flakes | flakes at three sizes under the clear coat |
| Opal | patches, stacking bands, pinfire mosaic |
| Hologram | seal, micro stars, guilloche, dot matrix |
| Iridescent foil | facets, creases, fine wrinkles, scratches |
| Liquid crystal | schlieren brushes, smaller defects, bubbles |
| Screen | image, pixels, RGB subpixels, TFT notch |
| Energy | plasma filaments, hex frame, emitter grid |

Limits: the light for opal and hologram is assumed from above (world up), not read from the scene lights. Car paint sparkle is faint at 30 cm (coarse flakes near one pixel). The foil far view is still close to a mosaic. The liquid crystal 3 mm view is mostly a smooth colour. Close up the screen exposes at half, so subpixels keep pure colours under ACES. Mother of pearl is not done (see row 20).

## 20. More organic matter (*in progress*: every matter written, first review)

Family `organic` (`src/families/organic/`), one mode per graph, one file per group of matters. The mode table in `shader.js` (MODES, POROSITY, SSS) is the only place to touch when a matter is added; the animal matters of this row go there too. Light enters the soft tissues (petal, fruit skins, cactus, seaweed): `organicMaterialKind` gives them the SSS material.
- `petal` (petal.js): petals of 40 to 110 mm overlap like loose tiles, each cupped with a rolled translucent rim, a paler claw and a soft shadow on the petal under it. A fan of veins from the base branches twice as it widens, so veins stay `feature_mm` apart. Conical epidermal cells (30 um): bright tip, dark walls; unresolved, they are the velvet sheen.
- `citrus` and `apple` (peel.js): orange peel as round domes over the oil glands (1 mm), a dark dimple over each gland, flavedo cells, stomata, blemish specks, wax coat. Apple: a smooth blush gradient over a yellow green ground, soft short stripes only where the blush is partial, a faint matt wax bloom, lenticels (pale corky dots with a crater), epidermal cells and flat wax plates with cracks.
- `berry` and `peach` (berry.js): strawberry achenes on a staggered net, each in a teardrop pit, flesh bulging and glossy between them, sparse trichomes, bulging epidermis cells. Peach: a smooth blush gradient, tiny freckles where it fades, four layers of combed painted hairs (`hairs.js`), a grainy haze and a strong sheen when they are too thin to draw, and real 3D strands near the camera (`organicHairSpec` in params.js, `core/hair3d.js`; the painted hairs thin out by `paintedShare`).
- `crust` and `crumb` (bread.js): crust browning from gold to dark brown, a ragged score, a cooling crackle, flour patches; blisters and micro blisters, pores, starch, flour grains. Crumb: round bowls cut in three sizes of cells plus a few big holes, stretched along the rise; a sharp lit rim, deep shadowed bottoms, starch granules in the gluten film.
- `cactus` (cactus.js): ribs with rounded crests and steep furrows, swollen tubercles, areoles with grey wool, nine radial and two central spines (straw with brown tips, a soft shadow), sun scars, sunken stomata.
- `walnut` and `coir` (husk.js): walnut as a crumpled relief: two octaves of ridged noise on twice warped coordinates, knife-edged ridges around deep pits darkened by occlusion, woody fibre streaks on the ridge tops, a suture ridge, woody roughness, sclereid stone cells with pits and pores. Coir: six layers of coarse fibres (280 um) crossing at random angles, bent, broken in segments, lower layers in shadow; striations and silica bodies on each fibre.
- `seaweed` and `pollen` (algae.js): a smooth kelp blade with slow ruffles, fine longitudinal lines and a few veins, faint spore patches, a slime coat with sparse air bubbles in two sizes (clear domes with a bright rim), cortical cells in rows with brown plastids. Pollen: a dusting on a dark petal that thins across the face, small heaps (3 to 8 mm) with a halo of stray grains, a grainy speckle where grains are about a pixel, two layers of 40 um spheres with spines and pores.

| Matter | Zoom |
|---|---|
| Petal (rose) | overlapping petals, fan veins, conical cells |
| Orange peel | domes over oil glands, dimples, stomata |
| Apple skin | streaks, wax bloom, lenticels, cells under the wax |
| Strawberry | achenes in pits, trichomes, glossy cells |
| Peach | blush, freckles, combed hairs |
| Bread crust | blisters, crackle, flour, pores, starch |
| Bread crumb | open cells in three sizes, lit rims, starch granules |
| Cactus | ribs, areoles, spine clusters, stomata |
| Walnut shell | winding ridges, suture, stone cells |
| Coir | coarse crossing fibres, striations, silica bodies |
| Seaweed | bullations, slime bubbles, cells in rows |
| Pollen | spiky grains in clumps on a dark petal |

Limits: cactus spines are painted (no 3D strands). The walnut relief is still soft at the 2 cm view. Pollen spines only show below a 1.5 mm view (grains are 40 um). The peach 3D strands are a little too bright and opaque. Petal veins are a fan per petal, so a petal seen whole looks a bit regular.

Animal, fossil, sea and soil matters (second part, first review). Their modes live in `animal.js` (ANIMAL_MODES, ANIMAL_POROSITY, ANIMAL_SSS), which `shader.js` spreads into its tables. `extras.js` adds optional outputs: `irid` (thin film, nacre and insects), `transmission` (amber), `opacity` (the web: transparent, double sided), `metal` (pyrite). Shared helpers: `hex.js` (hexagonal net), `lattice.js` (open Voronoi lattice of round struts, stacked in depth). Reused from other families: `ceramic/bubbles.js` (bubbles, drops, pits), `ceramic/glaze.js` `absorb` (Beer law tint), `core/marks.js` (scratches, bloom needles), `ground/grains.js` (grains, packed crumbs, fibres).
- `meat` and `fat` (flesh.js): marbling as a broken net of fat veins in two sizes plus flecks and one fat seam; fascicles stretched along the grain with a patchy pale sheath; muscle fibres (70 um) as rods. Fat: soft lobes with pink membranes and vessels, rounded lobules, adipocytes.
- `blood` and `driedblood` (blood.js): one spill (pools, streaky smears, satellite drops) gives a thickness; the colour is the floor seen through it (Beer law), the relief its gradient. Fresh: mirror coat, meniscus, bubbles, settled red cells. Dried: crust cracked into flakes whose cracks widen with thickness, curled edges, lost flakes, coffee ring, hairline cracks.
- `mucus` (mucus.js): gel sheet with cords, milky where thick, bubbles in three sizes, mucin threads, debris, micro bubbles.
- `bone` and `sponge` (bone.js): three stacked lattices, the deeper ones darker; bone trabeculae with plates, lamellae, lacunae, marrow stains. Sponge: spongin fibre net, loose fibres, oscula, sand grains.
- `honeycomb` and `beeswax` (hive.js): hexagonal cells in patches of caps, honey (glossy meniscus, bubbles) and empty cells, rounded coping rim. Wax block: bloom with crystal needles, shrink dimples, flow ripples, specks.
- `eggshell` and `pearl` (shell.js): pigment mottle and speckles, mammillary bumps, pores with halos, tilted calcite facets. Pearl: thin film orient, fingerprint contours at two scales (tablet terraces), blemishes.
- `ivory` and `tortoise` (ivory.js): tusk rings round a centre below the face, warm age patches, Schreger checker from two log spirals (lozenges 2 to 4 mm), age cracks along rings, growth lines, wavy tubules. Tortoiseshell: blurred deep blotches and sharp ones, speckled blotch edges, laminae, melanin granules, polish scratches.
- `butterfly` and `insecteye` (insect.js): a morpho upper side with its base at a corner of the face: veins fan out and bend, a cross vein, a scalloped black margin with white spots, a dark base. Scales in rows across the veins like roof tiles (two rows searched), toothed tips, shadow of the scale above, dark membrane in the slits, one pattern colour per scale, ridges; the blue is a strong thin film over dark scales. Eyes: sphere caps packed on dark cuticle; the pseudopupil is computed from the view vector and the dome normal, so the black spot follows the camera; hexagonal lens facets (60 um) with their own highlight, a grain when unresolved, faint bands, hairs.
- `cocoon` and `web` (silk.js): loops and figure eights of one thread in three layers, sericin blobs at crossings, bumpy wall. Web: radials, sagging capture spiral, hub, frame threads, glue droplets; cut out by opacity.
- `amber` (fossil.js): transmission, flow bands, sun spangles, trapped hairs and specks, bubbles.
- `petrified` and `coal` (mineral.js): petrified wood keeps its rings (sharp latewood lines) and rays, but its colours are jasper zones with sharp antialiased borders (width from the surface gradient of the zone noise), agate bands parallel to them, quartz checks and quartz pockets with a chalcedony rind and crystals (`stone/crystals.js`), cells in radial rows, glassy polish. Coal: vitrain and durain bands, staggered cleats, conchoidal shells on strongly warped cells (curved edges), each a shallow bowl with rib arcs on one side, hackle striae near the edges, pyrite. The wood ring field of `wood/board.js` is not exported, so the rings are a simpler field of their own.
- `coral` (sea.js): corallites with wall, septa (long and short) and columella over a porous lattice.
- `barnacle` (barnacle.js): two crops of cones (big, and small in the gaps), bases pressed by their neighbours, six plates each its own shade with an overlap step, radial ribs, growth lines, a diamond opening closed by four plates (slit and seam), dead ones an open black hole, occlusion toward the base, slime between.
- `mould` and `compost` (soil.js): colonies with a white rim, spore centre (blue green or black) and growth rings, hyphae felt and runners, spore heads, on a bread substrate. Compost: packed crumbs, leaf fragments with a vein, twigs, fungal threads in patches, mineral grains.

| Matter | Zoom |
|---|---|
| Raw meat | fat net, fascicles, muscle fibres |
| Fat | lobules, membranes, adipocytes |
| Fresh blood | pools, smears, drops, bubbles, red cells |
| Dried blood | cracked flakes, coffee ring, hairline cracks |
| Mucus | cords, bubbles, mucin threads |
| Spongy bone | trabeculae in three depths, lamellae, lacunae |
| Honeycomb | caps, honey, coping rims, bubbles |
| Beeswax | bloom needles, dimples, specks |
| Eggshell | speckles, bumps, pores, calcite facets |
| Pearl | orient, terrace contours |
| Ivory | rings, Schreger checker, growth lines |
| Tortoiseshell | blotches at two depths, laminae, granules |
| Butterfly wing | roof tile scales, ridges, structural blue |
| Insect eye | bands, lens facets, hairs |
| Silk cocoon | thread loops, sericin |
| Spider web | radials, spiral, glue droplets |
| Amber | flow bands, spangles, debris, bubbles |
| Petrified wood | rings, quartz checks, cells |
| Coal | bands, conchoidal ripples, pyrite |
| Coral | corallites, septa, porous skeleton |
| Sponge | fibre net, oscula, sand |
| Barnacles | plates, ridges, opening |
| Mould | colonies, hyphae, spore heads |
| Compost | crumbs, leaves, threads, grains |

Limits (second part): the barnacle cones are still a little pale and flat lit. Eye domes are clipped where two cells meet. The coal far view is busy with reflections, its 3 mm view is mostly the dull band grain. Beeswax is plain at the 3 mm view. Petrified wood zones are still large flat areas from afar. Meat fascicles read a little like tiles at 3 cm. The fat lobules are faceted. The web is one web per face, centred, with a seam where the spiral angle wraps. Amber has no depth parallax for its inclusions. The pearl is a flat nacre face (no sphere). Sponge oscula are evenly round dots from afar.

The whole row:

| Group | Matter | Zoom |
|---|---|---|
| Plants | flower petals | velvety cone cells that scatter light, veins |
| | fruit skins: orange peel, apple, strawberry, peach | oil glands, wax bloom, seeds in pits, fuzz |
| | bread crust, crumb | blistered crust, air cells, starch |
| | cactus, succulent | waxy skin, spines from areoles |
| | seeds, nut shells, coconut fibre | wrinkled shell, fibrous husk |
| | seaweed, algae | translucent, slimy, cells in rows |
| | pollen, dust of spores | spiky grains, 20 to 50 um |
| Animal products | silk cocoon, spider web | continuous thread, droplets on the web |
| | honeycomb, beeswax | hexagonal cells, wax sheen |
| | eggshell | pores, matt calcite crust |
| | pearl, mother of pearl | iridescent stacked layers |
| | ivory, teeth, tusk | growth lines, enamel prisms |
| | tortoiseshell | layered keratin, amber blotches |
| | butterfly wing | overlapping scales like roof tiles, colour from structure |
| | insect eye | hexagonal facets |
| Flesh and fluids (games) | raw meat, muscle | fibre bundles, fat marbling, wet sheen |
| | fat | soft yellow, glossy |
| | blood (fresh, dried) | liquid film, then cracked dark crust |
| | mucus, slime | stringy, glossy, bubbles |
| | bone cut, marrow | spongy trabecular bone, canals |
| Fossil and resin | amber | warm translucent, bubbles, trapped insects |
| | petrified wood | wood cells turned to stone |
| | coal, peat | fibrous plant matter, glossy coal |
| Sea | coral | polyp cups, porous skeleton |
| | sponge | open fibre net |
| | barnacles, shells on a hull | cone plates, growth ridges |
| Soil life | mycelium, mould | white thread nets, spore heads |
| | compost, humus | dark fibres, crumbs |

## 21. Molten matter (*in progress*: family written, first review, animated)

Family `molten` (`src/families/molten/`), one mode per graph, one file per matter. Every mode is animated by the shared clock (`core/clock.js` `ixTime`) times `speed`, never by TSL `time`, so a film rendered frame by frame is reproducible. Motion is seamless: patterns that ride the flow are translations (or live in the crust frame of a conveyor), patterns that change shape are flowing noises (`flowFbm` in common.js: two copies half a period apart, each restarted and reseeded while its weight is zero, crossfaded by a triangle, contrast kept).
- Light (heat.js): a blackbody at a temperature in kelvin. Colour fitted on the CIE table (green/red = 1.55 exp(-3680 / T)), brightness from Wien's law at 620 nm relative to 1400 K. Between a 750 K crust and a 1400 K crack the radiance spans six decades; `contrast` is the exponent a camera applies to that range (1 physical, 0.3 default keeps the dull red of a warm crust). Callers mix radiances by coverage, never temperatures, so thin cracks that fade by the footprint keep the right mean glow. Emissivity is applied where it matters (steel 0.35, its oxide 0.85).
- Shared blocks (common.js): flow frame, `flowFbm`, `vesicles` (two octaves of `ceramic/bubbles.js` pits with a rim), `microlites` (laths from `stone/crystals.js`, each a tilted mirror). Octaves come from `stone/common.js` `fbm`.
- `pahoehoe` (pahoehoe.js): lobes (toes) with glowing breakout seams; ropes bent into arcs convex downstream, round crests, tight troughs, amplitude growing toward the lobe front; tears on the stretched crests open to the melt, the skin next to a tear is hotter; wrinkles and stretch marks; vesicles, a few faintly glowing; plagioclase laths. The skin slides at `flow_mm_s` inside each lobe.
- `aa` (aa.js): two layers of angular blocks (`stone/crystals.js` with a box metric) with ragged edges over the core, which glows in the gaps, breathing where the clinker is thin. Each block tumbles (its tilt turns in time), block rims next to a gap are hotter. Two sizes of broken faces, red brown oxide, granular spines, torn vesicles, laths.
- `lake` (lake.js): wavy spreading lines (bright seams) and sinks (duller seams where the crust dives). The crust pattern lives in its own frame, `s = flow t - distance to the line`, so plates are born at the seam, drift, and dive at the sink. Crust age sets its temperature (thin and red near the seam, black after); plates tear with jagged edges and the tears widen with age; a hot lip beside each crack; the melt in a crack is hottest in its middle, streaked, with chilled grey film flakes; wrinkles, hair cracks glowing on young crust, vesicles, laths.
- `embers` (embers.js): char blocks longer along the grain (the shou sugi ban crazing of `wood/finish.js`), domed, deep cracks of varied width; two finer crazings; wood fibres in broken streaks. A hot bed region and a breathing glow (two flowing noises, 4 and 9 s); the block faces glow only where it is hot, the cracks and their rims wherever it is warm; the crack floor is crazed into 0.3 mm granules. White grey ash and a dusting follow the lasting heat, not the breath, so they never flicker.
- `steel` (steel.js): a liquid metal (metalness 1, reflectance about 0.6, emissivity 0.35) at 1800 K under convection cells. Oxide islands ride the surface (translation) and change shape slowly; thicker in the cell lanes, torn along glowing lines; a lace of thin, hotter oxide filaments follows the faster outward flow; ragged slag specks drift; skin wrinkles and grain; ripples change the melt emissivity a little so they show.
- `slag` (slag.js): black green glass in broad frozen folds, contraction cracks into slabs, flow bands, grey spherulites, a faint iridescent tarnish (thin film). Hot zones wander very slowly (25 s noise): there the surface glows dull red and the cracks, wider, glow brighter; open vesicles show the hot glass. Dense vesicles in two sizes, needle crystals.
- `photosphere` (photosphere.js, sunspot.js): the Sun at `melt_k`, HDR emission (12 x `glow`). Evolving granules (`size_mm`), limb darkening per channel, faculae near the limb, rare spots (`cover`, umbra at `crust_k`), `haze` reddening. `shape`: `disc` (CircleGeometry uv, radius `scale_mm`) or `sphere` (metric coords).

| Matter | Zoom |
|---|---|
| Pahoehoe lava | lobes, ropes and crest tears, wrinkles, vesicles, laths in the glass |
| Aa lava | tumbling clinker blocks over the glowing core, spines, oxide, vesicles |
| Lava crust (lava lake) | spreading seams, drifting plates, glowing cracks, wrinkles, vesicles |
| Embers | crazed char blocks, glowing cracks that breathe, ash, wood fibres |
| Molten steel | oxide islands and lace, glowing tears, slag specks, skin grain |
| Slag | glassy crust, contraction cracks, vesicles, spherulites, a dying red glow |
| Photosphere | limb darkening, faculae, sunspots and penumbra filaments, granules |

Limits: the crust coordinates grow with time (flow times t), so after hours of animation the micron levels lose float precision; reset the clock between shots. The pahoehoe ropes keep one steady bend (they slide, they do not fold further). The aa 3 mm view is a plain granular rock. Lobes, conveyors and convection cells do not move. No sparks above the embers.

## 22. Liquids and films (*in progress*: family written, first review)

Family `liquid` (`src/families/liquid/`), one mode per graph, all animated by `ixTime` (`core/clock.js`) times `speed`. Motion is seamless: plane waves, rings born and faded inside a cycle, patterns carried by a curl flow with two phases crossfaded (flow.js), beads and spots riding moving lanes. Shared parts:
- waves.js: travelling plane waves with the gravity capillary dispersion w^2 = g k + (sigma / rho) k^3 (the 17 mm ripple is the slowest, 23 cm/s; shorter ones run faster), wave groups so the sum never reads as a plaid, gusts (cat's paws) that drift with the wind. Each wave fades by its length in pixels and by its frequency: a wave turning faster than about 15 times a second at the playback rate fades into the roughness, so short capillary waves do not strobe.
- `core/thinfilm.js` (new): reflectance of a thin film (soap, oil on water, a bubble cap) from nine wavelengths weighted by `core/optics.js` `spectral`. High orders wash out to white, fringes closer than a pixel average out (`opdBlur`). The colour goes into the specular colour of the material.
- sky.js: the demo room is dark, so each liquid adds the reflection of an overcast sky (zenith three times the horizon, soft clouds) along its rippled normal, with Fresnel. An uneven skyline of roofs and trees (10 to 30 degrees) is what steep ripple flanks reflect: rings and waves draw dark lines on the bright sky. Face on, the viewer dims the sky a little around the ray back to the eye. `sky` sets its radiance.
- asphalt.js: crushed stone in bitumen, the ground of rain and oil.

Modes:
- `water` (water.js): calm shallow water over sand. 20 waves from 6 cm to 3 mm. The bottom lies 1.5 to 10 cm down, seen through the bent ray (parallax and wobble), its detail faded by its own footprint. Caustics come from the wave curvature where the ray lands: 1 / (1 + D (1 - 1/n) curvature). The water takes its colour over the light path (clarity). Floating bubbles and pollen drift downwind. Shown in slow motion (speed 0.3).
- `rain` (rain.js): a puddle over asphalt. Drops fall in two shifted grids (one per 10 cm cell every 0.6 s). Each sends a packet of 6 mm capillary waves (2 or 3 crests, steep enough to reflect the skyline): crests at the phase speed inside a packet at the group speed, 1/sqrt(r) spreading, a faster train of shorter wavelets, the jet, a crown of 12 droplets and one bouncing droplet. Small drops leave short-lived dimples. Some trap bubbles that float, then pop. Slow motion (speed 0.2).
- `runoff` (runoff.js): water down a wall from the stone family (`wall` sub-preset, slate by default). Meandering rivulets whose path drifts, surges running down at 12 to 20 cm/s, sheets with wavelets, beads sliding on lanes with a wet trail and a light crescent, pinned drops, mist droplets, bubbles carried in the rivulets.
- `oil` (oil.js): a puddle and the wet road around it, very dark, under a motor oil film (1.47 on 1.33) mostly 200 to 600 nm thick (the most saturated orders), marbled and swirled by slow eddies, with whorls down to 0.2 mm. The film climbs the stones that break the water and thins over grain tops, so fringes ring them.
- `soap` (soap.js): a draining soap film seen through (transmission 1, no refraction). Log thickness from 1.6 um at the bottom to black film at the top (a sharp step to 8 nm below 30 nm), marbled by eddies, whorls down to 0.1 mm, thin spots rising from the lower half.
- `foam` (foam.js): sea foam in patches and a net of strands on dark rippled water, drifting. Four layers of round bubbles (6 mm to 0.27 mm), each no wider than the gap to its neighbour: the big ones on top with clear caps, a bright film wall at the outline and a dark ring inside it, white Plateau borders between them. Gaps in the foam are water with a scum of drawn-out streaks and lone bubbles near the edge. Each bubble lives 4 to 14 s, then pops and shows the smaller ones. Thin film colours on the big caps.

| Matter | Zoom |
|---|---|
| **Water surface** | ripples, caustics on sand grains, floating pollen and bubbles |
| **Rain on a puddle** | capillary ring packets, bubbles, aggregate under the water |
| **Running water** | meandering rivulets, sliding beads, mist droplets, the meniscus |
| **Oil slick** | swirling bands, fringes around the grains |
| **Soap film** | coloured whorls, black film, rising thin spots |
| **Foam** | bubbles of every size, popping, iridescent caps |

Limits: the sky reflection is an emission added over the room reflection, so a liquid indoors would look too bright. Caustics use the curvature of 10 waves at the landing point, not a traced light path. Oil colours stay pastel next to photos: oil on water has a low interference contrast. Foam bubbles ride the drift, not the lace eddies. Down is -v on every face, top included (runoff, soap). At 3 mm the water and rain views mostly show the bottom and the sky, few surface features.


## 23. Transformations (*in progress*: family written, first review)

Family `transform` (`src/families/transform/`): processes, a surface that changes over time. One mode per graph. Each reads a `progress` 0..1. By default it loops on the material clock (`ixTime`, `period_s` 12 s, `speed`): hold at 0, grow, hold at 1, then a short smooth rewind, so the loop never jumps. Set `progress` >= 0 to drive the state from an app.

Shared tool, `core/front.js`: a growth front. `arrival` gives an arrival time T from seeds that start at different times (an additively weighted Voronoi; seeds are points or short segments). `rough` adds a fractal wiggle whose amplitude follows the period of each octave, so the front stays ragged at every zoom; octaves under a few pixels fade out. `ageMeters` turns `Tth - T` into the distance behind the front in meters, with the pixel size in the same units from the screen derivatives of T: every zone (ember, char, rim, blisters) is a band of age, anti-aliased while it moves. `heroSeed` puts one seed near the middle of a 30 cm face, so the deep zoom of the demo sees the front pass.
- `burn` (burn.js, paper.js, heat.js): paper browning ahead of the flame, an ember line at 750 to 1150 K (black body colour, flicker advected with the clock, fibres hotter), black char that wrinkles, crazes into plates and keeps its fibres and gas pores, grey ash with crumbs and sparks, then holes cut out (opacity, two sided).
- `frost` (frost.js, drops.js): the glass fogs (two layers of 5 to 20 um droplets), the droplets freeze, fern feathers grow from nuclei: the stem tip moves out, branches start when it passes, then twigs and needles, every tip anti-aliased; hoar grains fade in one by one. Same fern geometry as ground/frost.js.
- `melt` (melt.js, drops.js): dry frosty ice (frost grains, scratches, bubbles, crystal grains) melts from warm spots: beads swell ahead of the front, merge into a glossy film behind it (clear coat, flowing ripples), relief rounds off, grain boundaries open into grooves.
- `rust` (rust.js): rust starts at scratches (bare steel lines) and pinholes, creeps under the coat: blisters rise ahead, the coat flakes (a few curled islands stay), fresh orange rust turns dark brown; crust from metal/oxide.js, orange peel from ceramic/glaze.js.
- `ink` (ink.js, paper.js): ink drops in wet paper, radius growing as the square root of time; the front runs ahead along the fibres (fingers), a water halo leads, pigment piles at the rim (coffee ring), faint tide lines, pigment grains; colour by Beer-Lambert.
- `dry` (dry.js): wet glossy paint (brush ridges, slow sag) dries to matte, the skin wrinkles, then a craquelure net opens in two generations, cell edges curl, the cut edge of the film shows paler.
- `mould` (mould.js): colonies on bread crumb (organic/bread.js): hyphae run ahead, a white felt fringe, spore colour behind (Penicillium blue green or Rhizopus grey black), growth rings at fixed radii, a bare line where colonies meet, spore heads.

| Matter | Zoom |
|---|---|
| Burning paper | browning fibres, ember line, crazed char with pores, ash crumbs, holes |
| Frost forming | fern stems, branches, twigs and needles growing; frozen droplets, hoar |
| Melting ice | beads swelling, glossy film, opened grain boundaries, frost grains |
| Rust spreading | scratches, blisters ahead, flaking coat, oxide crust |
| Ink diffusing | fingers along fibres, dark rim, tide lines, pigment grains |
| Paint drying | gloss to matte, wrinkles, craquelure opening |
| Mould growing | runner hyphae, white fringe, spore colour and heads, rings |

Limits: the 3 x 3 search of `arrival` can cut a front where a far seed would win (rare, late in the cycle). The rewind plays the process backward for about 1 s. Burn holes show the far face of the cube (two sided), not the scene. The frost far view still shows some diamond-shaped feathers. The rust crust keeps the blocky look of metal/oxide.js at the 3 cm view. The mould fringe at 3 mm reads as a plain white felt (hyphae faint). The ink tide lines are not mean-conserving under a pixel.
## 24. Pixel art (*in progress*: first review)

Any preset becomes pixel art with `pixel: 1` (`src/core/pixel.js`). The look follows textured retro 3D games: square texels with a mottled colour each, smooth light.

| Level | What it does |
|---|---|
| Grid | Square art pixels, a power of two in surface meters, sized from the screen footprint (`pixel_px` 14: 7 to 14 screen pixels each). Zoom in by 2 and every texel splits into 4. Near the end of a step, coarse texels split one by one in random order: no seam line, one evaluation of the graph. |
| Matter | The family is built on the texel centres, with the texel as its footprint (`withFootprint` in lod.js). Detail under a texel is averaged by the family's own LOD, so the drawing gains structure with zoom and never flickers. |
| Mottle | Each texel gets a random tone and hue shift (`pixel_jitter` 0.12). |
| Palette | Albedo quantized to `pixel_colors` (16) levels per channel, random dither per texel. |
| Light | Smooth by default. `pixel_levels` > 0 posterizes the lit colour into steps (outputNode). |

Limits: relief computed from screen derivatives (`surfaceGradient`) is off in pixel mode, since derivatives are zero inside a texel. Analytic slopes still work, one normal per texel. Fuzz shells and 3D hair are not pixelized.

**CRT screen** (scifi `mode: 'crt'`, `src/families/scifi/crt.js`): a pixel art picture in video pixels of `size_mm` (1.5), 6 levels per channel; Gaussian beam lines, wider on bright lines; slot mask of RGB phosphors, triad pitch `feature_mm` (0.6); phosphor grains of 15 um; darker corners and a slow rolling band. Every level fades to its mean when under a few view pixels.

## 25. Relief up close (*pilot*: wood)

`relief: 1` on a preset marches the view ray through the family's height field (`src/core/relief.js`, parallax occlusion mapping). The family is then drawn where the ray hits. Canyon floors slide behind ridges as the camera moves, ridges hide part of the floor and cast shadows into it.

| Step | What it does |
|---|---|
| Gate | Runs only where the relief spans 1 to 4 pixels or more (depth / footprint). Far views keep the plain bump and pay nothing. |
| March | 40 linear steps down to the deepest point, stopped at the first one inside, then 6 bisections. |
| Normal | Central differences of the height at the hit, one footprint apart. |
| Shadow | 12 steps from the hit toward the key light (`reliefLight`, world direction). Shadowed floors lose 85 percent of their albedo; deep floors get ambient occlusion. |

A family opts in with `height( u, p, fp ) -> { H, h }` in FAMILIES. `h(q)` gives metres below the top, without screen derivatives (it runs in a loop). Wood (`families/wood/height.js`): eroded earlywood (25 percent of a ring deep), pores (60 percent of the vessel diameter), checks (2.5 mm), char blocks, bark plates and fissures (centimetres).

Water (`waterHeight` in `families/liquid/water.js`): the ripple field, 8 waves, with crests made sharp by the Stokes second harmonic (in `waves.js`, so every liquid gets it). Row 25 shows choppy ripples (amount 1.8): crests hide the next trough at grazing views, and the bottom is bent by the waves (refraction offset d (1 - 1/n) slope). Pebbles on the bottom are now round and domed.

Caustics (`src/core/caustics.js`): light on the bottom is 1 / |det J| with J = I + D (1 - 1/n) Hess(h), from the full curvature of the ripples (`waveField` returns `hess`). Bright lines appear where rays cross, sharp near the focus depth. `spread_deg` (liquid) spreads the ripple directions: 180 gives the net of a pool (row 25, "Caustiques : fond de piscine"). The bottom seen through the water is placed with `viewInCoords` (optics.js), exact even on sheared UVs, and offset by half a metre so the mod(.., 4096) cell wrap of the shared helpers never meets 0 (it made straight seams on deep, oblique views).

Limits: the shadow darkens the albedo, not the key light alone. Silhouettes stay flat (no geometry moves). Cost not measured yet: 40 to 60 height evaluations per close pixel.

## 26. Under water (*in progress*: first review)

`underwater: 1` on any preset applies the scene's body of water (`src/core/underwater.js`, `waterBody` uniforms in world space: level, ripples, absorption, turbidity, inscatter colour, depthScale) below its level:

| Term | What it does |
|---|---|
| Caustics | The ripple net (core/caustics.js) read where the refracted sun ray crossed the surface. On vertical faces it stretches into streaks, as on pool walls. |
| Light | Sunlight absorbed per colour on the way down (pure water 0.45, 0.07, 0.02 per metre), plus turbidity. |
| View | The path from the surface (or from a camera under water) tints the matter; the water's scattered light fills in. |
| Wet band | 4 mm above the line the matter is darker. |

`depthScale` 10: the 30 cm demo cubes stand for 3 m objects, so the cells and the colour loss read as in a pool. Limits: the light terms multiply the albedo (sky light is dimmed with the sun). The water surface itself: `src/core/watersurface.js` (`createWaterSurface( sky )`), the same ripples as the caustics. From above, Fresnel mixes the sky reflection and the scene below, read from the screen and pushed by the slope. From below, Snell's window: inside the 97 degree cone the shore and sky (from the screen behind the surface, not squeezed into the cone: a stand-in), beyond it total internal reflection, a dim rippled mirror. `daySky( sunDir )` draws the background and feeds both. Demo: `aquarium.html` (?view=above, below, floor): a tank of sand and marble with granite, bronze and driftwood cubes. With `spread_deg` 180 the ripple directions follow the golden angle, so no two long waves line up into a grid.

Refraction at a flat interface: `src/core/refraction.js`. Each vertex of matter beyond the interface is drawn where the eye sees it: the crossing point on the plane is solved by Snell (n 1.33, bisection, 18 steps) and the vertex is placed along the first leg of the broken ray (`material.vertexNode`), so only the screen position moves; light, caustics and shadows keep the true one. `applyUnderwater` and the water surface carry it; it is off until the app sets an interface: `refractSurface( eye, level )` (seen from above or below the water), `refractPlane( eye, point, normal )` (a pane, a camera port; everything beyond is bent). waterline.js sets it per pass: the air pass through the surface, the water pass through the pane or the port. Only the camera at `refraction.eye` is bent: mirrors and shadow maps draw true positions, and the water surface reads its mirrors at the screen point of its true position, so a bent surface carries its reflection along. Effects: a floor seen from above looks 3/4 of its depth face on, a post breaks at the surface, through a pane or a port the water looks a third closer and larger. Meshes need segments (2 cm in the aquarium; its rounded cubes are cut with three's TessellateModifier): the triangles between moved vertices stay straight. Checks: `tests/refraction_check.mjs` (Snell residual 1e-6, apparent depth 0.4 / 1.33, a pane's paraxial magnification, the crossing point against an independent solve) and `tests/refraction_gpu.mjs` (a 1.2 cm marker in the aquarium lands within 1 px of the JS prediction through the surface, the pane and the port, flat water). `refraction.strength` 0 draws the true positions: the 5 preset views then match the code without it (0.016 % of pixels at most). Cost: 126 k triangles in the tank instead of 80 k, 360 k drawn per frame instead of 173 k (mirrors and two passes). Limits: the ripples are not in it (the surface still pushes what is under it by their slope); the second bend, through the surface after a pane or a port, is not modelled; from below, the sky in Snell's window is still not squeezed into the cone.

Waterline on glass: `src/core/waterline.js` (`createWaterline( renderer, scene, camera, opts )`). The scene is drawn twice, from the air and from the water (`waterBody.eyeUnder`), and each pixel takes one by where its ray crosses the glass: an aquarium pane (`glassZ` and bounds) or a camera port (`lens: true`, 3 cm ahead). A tank with several panes passes `panes: [ { axis, at, min, max, out } ]`: the eye sees two at most (a corner), each gets its own water pass bent at its own plane, and a pixel takes the pane its ray enters first. One pane in view costs what it did, a corner costs one more scene pass. The aquarium has three panes (front and sides) and one marble wall at the back. The panes are 8 mm of glass, n = 1.52 (`glass: { thickness, ior }`): parallel faces do not turn a ray, they shift it, so what is behind comes nearer by thickness ( 1 - 1 / ior ), 2.7 mm (`refractPlane( eye, point, normal, plate )`). The pane meshes are the page's: a Fresnel mirror of the sky on the wide faces, green edges. The level there follows the ripples (boosted, a wave running up the glass). On the line: the meniscus (water climbs the glass by capillarity: `meniscusHeight( { tension, contactDeg } )`, about 2.9 mm on ordinary glass, 1 mm on acrylic, `WALL_CONTACT` lists walls) as a bright rim over a darker, magnified strip; under it the silver band of the surface seen from below (total internal reflection, watersurface.js). Views `?view=glass` and `?view=lens`; `window.__ix.dive( t )` is the 16 s dive film path. Mirrors: `src/core/mirror.js`, a mirrored camera and a ClippingGroup plane (three's reflector clips with an oblique near plane that breaks under a reversed depth buffer). From above the surface reflects the scene; from below, beyond Snell's window, it is a true mirror of the pool. The meniscus on the glass: a ray through it meets the curved water surface from below, nearly grazing, so it is totally reflected down into the water. The film therefore shows the world under the water, inverted, squeezed more toward the top, and bright (no light lost; no colour split, it is a mirror), with a bright rim at the top and a dark contact line at the foot. The aquarium pane is ordinary glass (contact angle 25 degrees). A pane the water does not wet (`?wall=ptfe` or `coatedGlass`, angle over 90) makes the water dip at it with a convex edge: over the contact line the ray crosses air and meets the rounded edge from above, so it shows a Fresnel mirror of the world above (`src/core/meniscus.js`). Limit: with the eye a hair under the level, looking into that air gap, the air pass shows the surface edge-on as a dark line. Limits: no drops or running film on the port when it leaves the water.

## Micro detail (all solid families)

`src/core/micro.js`, applied in `createMaterial` after the family (off with `micro: 0`, or a gain). Under each family's finest level it adds one octave per halving of the zoom, down to 1 um (visible light cannot resolve finer). Each octave fades in with the footprint; far views are unchanged (the family roughness already stands for it). Kinds by family (`MICRO_KINDS`): fibrous streaks (wood, cloth, rope, wool), granular facets (stone, soil, ceramic), polishing scratches (metal, plastic), cells within cells (leather, skin, plants, organic, scales), generic noise. The slopes scale with roughness: a polished matter has a shallow micro relief. Liquids, molten matter and screens stay smooth.

## Light realism pass

- Demo light: a real sky (CC0 Poly Haven HDRI `demo/assets/hdri/kloppenheim_06_2k.hdr`, overcast field) as environment by default; `?env=room` keeps the synthetic studio. The sun casts shadows (PCF soft, 4096 map fitted to the built cubes).
- Cavity occlusion (`core/surface.js`): every family's cavity signal also becomes `aoNode` (1 - 0.5 cavity, less where water pools), which three applies to the indirect light and as specular occlusion: pore and crack floors stop shining.
- Micro-shadowing (`core/microshadow.js`, every material): the key light reaches a closed point only when it comes nearly along the normal, clamp( |N.L| + 2 a^2 - 1 ) with a softened ao (Chan 2018). Normal-map relief now shadows itself.

## Shared generators

Many families reuse the same blocks:
- **Yarn** (plies, fibers, scales): knit, woven, pile, rope, basketry, hair.
- **Voronoi nets** (`core/voronoi.js`): leather grain and cracks, animal scales and scutes, char blocks, chips, cork granules and cells, bark plates, glaze crackle, grog, frosted glass pits, enamel chips, stone crystals (anisotropic variant in `families/stone/crystals.js`), aggregates and grains, leaf veins and cells, lichen cracks, osteons, nacre tablets.
- **Growth fronts** (`core/front.js`): arrival time from seeds, fractal edge, age in meters, looping progress: every process of the transform family.
- **Blackbody glow** (`families/molten/heat.js` `radiance`): emission from a temperature in kelvin; **flowing noise** (`families/molten/common.js` `flowFbm`): seamless animated value noise for any matter that churns.
- **Thin films** (`core/thinfilm.js`): soap, oil on water, bubble caps (liquid family).
- **Surface gradient** (`core/lod.js` `surfaceGradient`): relief from a per-pixel height (paint edges, eroded rings, chip steps).
- **3D hair** (`core/hair3d.js`): strands, skin body hair, pile fabrics; next grass.
- **Skin**: leather plus subsurface scattering, pores and fine hair, colour from melanin and hemoglobin. Covers human and animal skin.
- **Surface states** (`core/surface.js`): every family. Second layer (`core/states.js`): dust, mud, burnt, rust, frost, blood, sweat, grease, opt-in per family.
