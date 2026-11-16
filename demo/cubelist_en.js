// English labels for the cube wall (cubelist.js), so demo films can run in
// English. Keys are the French strings of cubelist.js, copied exactly.
// ROWS_EN: row title -> English title. CUBES_EN: matter name -> { name, zoom }.
// Two French names occur twice ('Poussière', 'Éponge'). So ZOOM_EN maps each
// French zoom caption to English too, and cubeEn() prefers it.

import { CUBES } from './cubelist.js';

export const ROWS_EN = {
	'1. Tricot': '1. Knit',
	'2. Tissé': '2. Woven',
	'3. Velours et poils': '3. Pile and velvet',
	'4. Non-tissé': '4. Non-woven',
	'5. Vannerie et tressage': '5. Basketry and braiding',
	'6. Cuir': '6. Leather',
	'7. Peau humaine': '7. Human skin',
	'8. Peau animale': '8. Animal skin',
	'9. Poils et plumes': '9. Hair and feathers',
	'10. Bois': '10. Wood',
	'11. Métal': '11. Metal',
	'12. Pierre et construction': '12. Stone and building',
	'13. Sols et grains': '13. Soils and grains',
	'14. Végétal': '14. Plant',
	'15. Plastiques': '15. Plastics',
	'16. Céramique et verre': '16. Ceramics and glass',
	'17. États de surface': '17. Surface states',
	'18. Peint et décoré': '18. Painted and decorated',
	'19. Science-fiction': '19. Science fiction',
	'20. Organique': '20. Organic',
	'21. Matière en fusion': '21. Molten matter',
	'22. Liquides et films': '22. Liquids and films',
	'23. Transformations': '23. Transformations',
	'24. Pixel art': '24. Pixel art',
	'25. Relief (pilote)': '25. Relief (pilot)',
	'26. Sous l’eau': '26. Underwater',
};

export const CUBES_EN = {
	// 1. Knit
	'Jersey': { name: 'Jersey', zoom: 'V stitches, plies, fibres, scales' },
	'Jacquard depuis une texture': { name: 'Jacquard from a texture', zoom: 'One colour per stitch, read from an image' },
	'Côtes': { name: 'Rib', zoom: 'Raised columns of Vs, recessed purl bumps' },
	'Point mousse': { name: 'Garter stitch', zoom: 'A ridge of purl bumps every two rows' },
	'Point de riz': { name: 'Seed stitch', zoom: 'Knit and purl alternate: a checkerboard of bumps' },
	'Torsades': { name: 'Cables', zoom: 'Raised crossed strands on a purl ground' },
	'Crochet': { name: 'Crochet', zoom: 'Trebles, chains, gaps between the stitches' },
	'Dentelle': { name: 'Lace', zoom: 'Round eyelets (yarn-overs), the backing shows through' },
	'Polaire': { name: 'Fleece', zoom: 'Brushed tufts, curly fibres, pills' },
	// 2. Woven
	'Lin': { name: 'Linen', zoom: 'Uneven slubbed yarns, flat fibres' },
	'Coton': { name: 'Cotton', zoom: 'Plain weave, plied yarns, twisted fibres' },
	'Toile de jean': { name: 'Denim', zoom: 'Twill: indigo warp, white weft' },
	'Soie, satin': { name: 'Silk, satin', zoom: 'Long smooth floats, translucent fibres' },
	'Tweed': { name: 'Tweed', zoom: 'Heathered yarns, flecks of colour' },
	'Chevrons': { name: 'Herringbone', zoom: 'The twill reverses direction: zigzag' },
	'Toile de jute': { name: 'Hessian', zoom: 'Thick hairy yarns, gaps between them' },
	'Tartan': { name: 'Tartan', zoom: 'Crossed bands of colour, one yarn at a time' },
	'Brocart': { name: 'Brocade', zoom: 'Gold floats bound by the warp, gilt strip wound on a silk core' },
	'Voile, organza': { name: 'Voile, organza', zoom: 'Fine smooth yarns with gaps between: you can see through' },
	'Fibre de carbone': { name: 'Carbon fibre', zoom: 'Filament tows under a thick clear coat' },
	// 3. Pile and velvet
	'Moquette coupée': { name: 'Cut-pile carpet', zoom: 'Cut tufts, two plied strands, fibre ends' },
	'Moquette bouclée': { name: 'Loop-pile carpet', zoom: 'Tight loops in rows, flecked plies, fibres' },
	'Velours': { name: 'Velvet', zoom: 'Short dense pile, laid fibre ends' },
	'Velours côtelé': { name: 'Corduroy', zoom: 'Velvet wales, cut channels, ground fabric' },
	'Tapis noué': { name: 'Knotted rug', zoom: 'One knot, one colour, wool ends' },
	'Fausse fourrure': { name: 'Faux fur', zoom: 'Even synthetic fibres, glossy tips' },
	// 4. Non-woven
	'Feutre de laine': { name: 'Wool felt', zoom: 'Dense tangled wool fibres, scales and all' },
	'Feutre synthétique': { name: 'Synthetic felt', zoom: 'Bonded polyester fibres: melted beads at the crossings' },
	'Laine bouillie': { name: 'Boiled wool', zoom: 'Crushed stitches under coarse fibres' },
	'Papier': { name: 'Paper', zoom: 'Cellulose ribbons, cloudy formation' },
	'Carton ondulé': { name: 'Corrugated cardboard', zoom: 'Flutes under the liner, kraft fibres' },
	'Papier mâché': { name: 'Papier-mâché', zoom: 'Torn pieces glued down, printed text' },
	// 5. Basketry and braiding
	'Osier, rotin': { name: 'Wicker, rattan', zoom: 'Round strands over and under, wood fibres' },
	'Raphia, paille': { name: 'Raffia, straw', zoom: 'Strips of dried leaf, veins' },
	'Bambou tressé': { name: 'Woven bamboo', zoom: 'Flat slats in twill, long fibres' },
	'Cannage': { name: 'Caning', zoom: 'Six-pointed stars, octagonal holes, glossy rattan skin' },
	'Natte, tatami': { name: 'Mat, tatami', zoom: 'Tight rush, binding threads' },
	'Corde de chanvre': { name: 'Hemp rope', zoom: 'Strands, yarns, hemp fibres' },
	'Tresse': { name: 'Braid', zoom: 'Three strands crossing in turn, twisted yarns, fibres' },
	'Cotte de mailles': { name: 'Chain mail', zoom: 'Butted rings, each through four others, wire-drawing marks' },
	// 6. Leather
	'Cuir pleine fleur': { name: 'Full-grain leather', zoom: 'Grain, pores, micro-cracks in the finish' },
	'Cuir craquelé, vieilli': { name: 'Cracked, aged leather', zoom: 'Crazed plates, the dermis in the cracks' },
	'Cuir verni': { name: 'Patent leather', zoom: 'A thick varnish over the grain' },
	'Cuir mouillé': { name: 'Wet leather', zoom: 'Water darkens the leather and fills the grain' },
	'Daim, nubuck': { name: 'Suede, nubuck', zoom: 'Sanded nap of collagen fibres' },
	'Crocodile': { name: 'Crocodile', zoom: 'Square scales, deep furrows, sensory pores' },
	'Serpent': { name: 'Snakeskin', zoom: 'Domed overlapping scales, patterns made of whole scales' },
	'Autruche': { name: 'Ostrich', zoom: 'Quill bumps where feathers were plucked, a hole in each' },
	'Galuchat': { name: 'Shagreen', zoom: 'Tight calcium beads, tops sanded white' },
	'Simili cuir': { name: 'Faux leather', zoom: 'Printed grain, too regular, fabric under the plastic' },
	'Parchemin': { name: 'Parchment', zoom: 'Thin translucent skin, clouding, dermal fibres' },
	// 7. Human skin
	'Peau très claire': { name: 'Very fair skin', zoom: 'Skin lines, pores, cells' },
	'Peau mate': { name: 'Olive skin', zoom: 'Melanin and blood under translucent skin' },
	'Peau très foncée': { name: 'Very dark skin', zoom: 'Sebum shining on the plateaus' },
	'Visage': { name: 'Face', zoom: 'Large nose pores, shining sebum' },
	'Lèvres': { name: 'Lips', zoom: 'Vertical furrows, moist, translucent' },
	'Paume, empreintes': { name: 'Palm, fingerprints', zoom: 'Whorled ridges, sweat pores on the ridges' },
	'Articulations': { name: 'Knuckles', zoom: 'Deep arched creases, darker, drier skin' },
	'Cuir chevelu, barbe': { name: 'Scalp, beard', zoom: 'Shaved hairs, one per follicle' },
	'Taches de rousseur': { name: 'Freckles', zoom: 'Melanin spots on fair skin' },
	'Veines': { name: 'Veins', zoom: 'Blue veins under thin skin' },
	'Peau âgée': { name: 'Aged skin', zoom: 'Wrinkles, deep lines, age spots' },
	'Cicatrice': { name: 'Scar', zoom: 'Smooth shiny tissue, no pores, no hair' },
	'Tatouage': { name: 'Tattoo', zoom: 'Ink in the dermis, blurred edges' },
	// 8. Animal skin
	'Éléphant': { name: 'Elephant', zoom: 'A network of deep wrinkles, dry cracked skin' },
	'Rhinocéros': { name: 'Rhinoceros', zoom: 'Thick plates, folds, bumps' },
	'Cochon': { name: 'Pig', zoom: 'Thin pink skin, sparse bristles' },
	'Hippopotame': { name: 'Hippopotamus', zoom: 'Moist oily skin, pinkish secretion' },
	'Baleine, dauphin': { name: 'Whale, dolphin', zoom: 'Smooth rubbery skin, fine ridges, scars' },
	'Serpent vivant': { name: 'Live snake', zoom: 'Keeled scales, micro-ridges that split light: iridescence' },
	'Crocodile vivant': { name: 'Live crocodile', zoom: 'Bumpy scales, wet skin between them' },
	'Lézard': { name: 'Lizard', zoom: 'Granular scales, spots' },
	'Caméléon': { name: 'Chameleon', zoom: 'Granules of colour: the chromatophores' },
	'Tortue': { name: 'Tortoise', zoom: 'Shell scutes, growth rings' },
	'Grenouille': { name: 'Frog', zoom: 'Glandular skin, glossy mucus' },
	'Crapaud': { name: 'Toad', zoom: 'Pustules and warts, dry skin' },
	'Salamandre': { name: 'Salamander', zoom: 'Smooth wet skin, yellow spots' },
	'Poisson à écailles': { name: 'Scaly fish', zoom: 'Silver scales (guanine), mucus' },
	'Requin, raie': { name: 'Shark, ray', zoom: 'Denticles: tiny teeth, sandpaper skin' },
	'Patte d’oiseau': { name: 'Bird foot', zoom: 'Horny scales in rows' },
	'Peau nue d’oiseau': { name: 'Bare bird skin', zoom: 'Comb and wattles: red, wrinkled, bumpy' },
	'Scarabée': { name: 'Beetle', zoom: 'Chitin: structural colour, punctures' },
	'Crabe, homard': { name: 'Crab, lobster', zoom: 'Carapace, tubercles, small pits' },
	'Pieuvre': { name: 'Octopus', zoom: 'Papillae, colour cells, wet skin' },
	'Escargot, limace': { name: 'Snail, slug', zoom: 'Wrinkled foot under the mucus' },
	'Méduse': { name: 'Jellyfish', zoom: 'Clear jelly, canals, eggs, nematocysts, cells' },
	// 9. Hair and feathers
	'Cheveux': { name: 'Hair', zoom: 'Styled locks, stretched highlight, round hairs' },
	'Fourrure': { name: 'Fur', zoom: 'Banded (agouti) hairs, darker guard hairs' },
	'Plumes': { name: 'Feathers', zoom: 'Rachis, slanted barbs, barbules' },
	'Toison brute': { name: 'Raw fleece', zoom: 'Crimped wool locks, lanolin, dirty tips' },
	// 10. Wood
	'Bois brut': { name: 'Rough-sawn wood', zoom: 'Saw marks, growth rings, rays, oak pores, fibres' },
	'Bois poncé verni': { name: 'Sanded, varnished wood', zoom: 'Deep varnish, filled pores, fibres under the coat' },
	'Bois peint écaillé': { name: 'Peeling painted wood', zoom: 'Paint split along the grain, grey wood beneath' },
	'Bois flotté': { name: 'Driftwood', zoom: 'Eroded earlywood, raised latewood, checks' },
	'Bois brûlé': { name: 'Charred wood', zoom: 'Domed charcoal scales, fine crazing' },
	'Contreplaqué': { name: 'Plywood', zoom: 'Rotary-cut veneer: large flames, small knots' },
	'Aggloméré': { name: 'Particleboard', zoom: 'Pressed chips, glue, voids, the fibres of each chip' },
	'Liège': { name: 'Cork', zoom: 'Granules, lenticels, honeycomb of cells' },
	'Écorce': { name: 'Bark', zoom: 'Plates and fissures, lichen, cork cells' },
	// 11. Metal
	'Bronze martelé': { name: 'Hammered bronze', zoom: 'Hammer craters, verdigris, alloy grains' },
	'Cuivre et patine': { name: 'Copper and patina', zoom: 'Patina crust, corrosion pits' },
	'Laiton': { name: 'Brass', zoom: 'Scratches at three scales, crystals' },
	'Or poli': { name: 'Polished gold', zoom: 'Fine scratches, metal grains' },
	'Fer rouillé': { name: 'Rusted iron', zoom: 'Layered rust flakes, blisters, pits, oxide grains' },
	'Acier brossé': { name: 'Brushed steel', zoom: 'Parallel scratches at four scales, steel grains' },
	'Chrome': { name: 'Chrome', zoom: 'Polishing arcs, pits, nodules and microcracks in the plating' },
	'Métal peint': { name: 'Painted metal', zoom: 'Orange peel, chips down to the primer, rust under the paint' },
	// 12. Stone and building
	'Granit': { name: 'Granite', zoom: 'Twinned feldspar, cracked quartz with inclusions, sheets of mica' },
	'Marbre': { name: 'Marble', zoom: 'Twinned calcite crystals, fine-grained veins' },
	'Grès': { name: 'Sandstone', zoom: 'Rounded sand grains, cement, frosted skin' },
	'Ardoise': { name: 'Slate', zoom: 'Cleavage steps, sericite flakes' },
	'Béton': { name: 'Concrete', zoom: 'Aggregate, sand, bubbles, cement grains' },
	'Brique et mortier': { name: 'Brick and mortar', zoom: 'Chipped edges, sand and grog, clay' },
	'Plâtre': { name: 'Plaster', zoom: 'Trowel passes, pinholes, gypsum needles' },
	'Granito (terrazzo)': { name: 'Terrazzo', zoom: 'Twinned calcite crystals, sand grains, polishing pits' },
	// 13. Soils and grains
	'Terre': { name: 'Soil', zoom: 'Clods, mineral grains, silt, filaments' },
	'Sable': { name: 'Sand', zoom: 'Frosted quartz grains, glinting facets' },
	'Gravier': { name: 'Gravel', zoom: 'Rock crystals, sand between the pebbles' },
	'Boue craquelée': { name: 'Cracked mud', zoom: 'Curled edges, fine silt, clay flakes' },
	'Neige': { name: 'Snow', zoom: 'Rounded grains, hexagonal crystals' },
	'Givre': { name: 'Frost', zoom: 'Fern-like dendrites, branches at 60 degrees' },
	'Glace': { name: 'Ice', zoom: 'Trapped bubbles, white cracks, scratches' },
	'Sel, sucre': { name: 'Salt, sugar', zoom: 'Salt cubes, growth steps' },
	// 'Poussière' occurs in rows 13 and 17. Row 13 zoom here, row 17 in ZOOM_EN.
	'Poussière': { name: 'Dust', zoom: 'Particles, fibres, pollen on black' },
	// 14. Plant
	'Feuille': { name: 'Leaf', zoom: 'Jigsaw-puzzle cells, stomata: two guard cells' },
	'Mousse, lichen': { name: 'Moss, lichen', zoom: 'Moss leaves, cells full of chloroplasts' },
	'Champignon': { name: 'Mushroom', zoom: 'Hymenium: basidia and spores (6 µm)' },
	'Os': { name: 'Bone', zoom: 'Osteons: Haversian canal, lamellae, lacunae' },
	'Corne, ongle': { name: 'Horn, nail', zoom: 'Keratin layers, flattened cells' },
	'Nacre, coquillage': { name: 'Nacre, seashell', zoom: 'Aragonite tablets stacked in terraces' },
	// 15. Plastics
	'Plastique moulé': { name: 'Moulded plastic', zoom: 'EDM texture: craters with raised rims' },
	'Plastique brillant': { name: 'Glossy plastic', zoom: 'Fine scratches, wipe marks, dust' },
	'Plastique mat': { name: 'Matt plastic', zoom: 'Microbeads: tight round dimples' },
	'Plastique usé, jauni': { name: 'Worn, yellowed plastic', zoom: 'Grime-filled cracks, chalky surface' },
	'Caoutchouc, pneu': { name: 'Rubber, tyre', zoom: 'Abrasion waves, carbon black grains' },
	'Silicone': { name: 'Silicone', zoom: 'Air bubbles at several depths, stuck lint' },
	'Mousse': { name: 'Foam', zoom: 'Cell skeleton: struts, membranes' },
	'Nylon': { name: 'Nylon', zoom: 'Ripstop grid, flat yarns, smooth filaments' },
	'Impression 3D': { name: '3D print', zoom: '0.2 mm beads, nozzle trails' },
	'Vinyle': { name: 'Vinyl record', zoom: 'V-shaped groove, walls modulated by the sound' },
	// 16. Ceramics and glass
	'Porcelaine craquelée': { name: 'Crackle porcelain', zoom: 'Ink lines and gold lines, bubbles in the glaze' },
	'Faïence': { name: 'Faience', zoom: 'Cobalt grains, crazing, pinholes' },
	'Terre cuite': { name: 'Terracotta', zoom: 'Grog, pores, silt, mica flakes' },
	'Verre dépoli': { name: 'Frosted glass', zoom: 'Conchoidal chips left by the sand' },
	'Verre soufflé': { name: 'Blown glass', zoom: 'Stretched bubbles at several depths, striae' },
	'Émail': { name: 'Enamel', zoom: 'A chip: ground coat, steel, rust. Bubbles' },
	// 17. Surface states
	'Mouillé (laine)': { name: 'Wet (wool)', zoom: 'Water sticks the fibres together and darkens the wool' },
	'Verni (corde)': { name: 'Varnished (rope)', zoom: 'A coat of varnish over the fibres' },
	'Usé (bronze)': { name: 'Worn (bronze)', zoom: 'Polished high points, dirt in the hollows' },
	'Boue': { name: 'Mud', zoom: 'Cracked crust, sand grains, wet halo' },
	'Brûlé': { name: 'Burnt', zoom: 'Charred fibres, ash at the edge of the hole' },
	'Rouille': { name: 'Rust', zoom: 'Paint blisters, oxide crust, streaks' },
	'Givre sur': { name: 'Frost on', zoom: 'Ice plates and needles on the fibres' },
	'Sang': { name: 'Blood', zoom: 'Domed drops, dark ring, stained threads' },
	'Sueur': { name: 'Sweat', zoom: 'Lens-shaped droplets, beads at the pores' },
	'Graisse': { name: 'Grease', zoom: 'Soaked fibres, darker, no sheen' },
	// 18. Painted and decorated
	'Peinture à l’huile': { name: 'Oil paint', zoom: 'Brush-hair furrows, canvas, crazing, pigments' },
	'Broderie': { name: 'Embroidery', zoom: 'Straight stitches of glossy thread, twisted plies' },
	'Sérigraphie': { name: 'Screen print', zoom: 'Cracked ink, screen mesh, fabric beneath' },
	'Tatouage sur tissu': { name: 'Tattoo on fabric', zoom: 'The ink dyes the fibres, some stay white' },
	// 19. Science fiction
	'Peinture à paillettes': { name: 'Metallic flake paint', zoom: 'Tilted aluminium flakes under the clear coat' },
	'Opale': { name: 'Opal', zoom: 'A mosaic of domains, colour changes with angle' },
	'Hologramme': { name: 'Hologram', zoom: 'Matrix dots, each with its own grating' },
	'Feuille irisée': { name: 'Iridescent foil', zoom: 'Fine creases, scratches on the film' },
	'Cristaux liquides': { name: 'Liquid crystals', zoom: 'Defects and dark brushes, smaller and smaller' },
	'Écran': { name: 'Screen', zoom: 'Red, green, blue subpixels, a transistor in the corner' },
	'Énergie': { name: 'Energy', zoom: 'Plasma filaments, emitter grid' },
	// 20. Organic
	'Pétale': { name: 'Petal', zoom: 'Velvety conical cells, fanned veins' },
	'Peau d’orange': { name: 'Orange peel', zoom: 'Oil glands under the dimples, stomata' },
	'Peau de pomme': { name: 'Apple skin', zoom: 'Pale lenticels, cells under the wax' },
	'Fraise': { name: 'Strawberry', zoom: 'Achenes in their pits, fine hairs, cells' },
	'Pêche': { name: 'Peach', zoom: 'Fuzz of fine laid hairs, red speckles' },
	'Croûte de pain': { name: 'Bread crust', zoom: 'Blisters, pores, flour and starch grains' },
	'Mie de pain': { name: 'Bread crumb', zoom: 'Open cells, thin walls, starch' },
	'Cactus': { name: 'Cactus', zoom: 'Woolly areoles, spines, sunken stomata' },
	'Coque de noix': { name: 'Walnut shell', zoom: 'Deep furrows, stone cells of the shell' },
	'Fibre de coco': { name: 'Coir', zoom: 'Tangled coarse fibres, striations, silica bodies' },
	'Algue': { name: 'Seaweed', zoom: 'Cells in rows, brown plastids, bubbles' },
	'Pollen': { name: 'Pollen', zoom: 'Spherical grains bristling with spines, pores' },
	'Cocon de soie': { name: 'Silk cocoon', zoom: 'Loops of one continuous thread, sericin gum' },
	'Toile d’araignée': { name: 'Spider web', zoom: 'Radial threads and spiral, glue droplets' },
	'Nid d’abeille': { name: 'Honeycomb', zoom: 'Cell rims, wax cappings, bubbles in the honey' },
	'Cire d’abeille': { name: 'Beeswax', zoom: 'Needle-like bloom, shrinkage dimples, pollen' },
	'Coquille d’œuf': { name: 'Eggshell', zoom: 'Pores, calcite bumps, crystal facets' },
	'Perle': { name: 'Pearl', zoom: 'Terraced aragonite tablets, iridescent orient' },
	'Ivoire, dent': { name: 'Ivory, tooth', zoom: 'Schreger lines, dentine tubules' },
	'Écaille de tortue': { name: 'Tortoiseshell', zoom: 'Keratin lamellae, melanin granules' },
	'Aile de papillon': { name: 'Butterfly wing', zoom: 'Overlapping scales, teeth, ridges that make the blue' },
	'Œil d’insecte': { name: 'Insect eye', zoom: 'Lens facets, a pseudopupil that follows your gaze' },
	'Viande crue': { name: 'Raw meat', zoom: 'Fibre bundles, pale sheaths, marbled fat' },
	'Graisse animale': { name: 'Animal fat', zoom: 'Lobules between septa, glistening fat cells' },
	'Sang frais': { name: 'Fresh blood', zoom: 'Meniscus, bubbles, settled red cells' },
	'Sang séché': { name: 'Dried blood', zoom: 'Crust split into flakes, fine cracks' },
	'Mucus': { name: 'Mucus', zoom: 'Bubbles caught in the gel, mucin strands' },
	'Os spongieux': { name: 'Spongy bone', zoom: 'Trabeculae and plates, lamellae, osteocyte lacunae' },
	'Ambre': { name: 'Amber', zoom: 'Bubbles, trapped debris, disc-shaped fractures' },
	'Bois pétrifié': { name: 'Petrified wood', zoom: 'Growth rings in jasper, quartz pockets, cells in chalcedony' },
	'Charbon': { name: 'Coal', zoom: 'Conchoidal shells, ribs, striations, pyrite' },
	'Corail': { name: 'Coral', zoom: 'Calices and septa, porous skeleton' },
	// 'Éponge' is also the terry towel of row 3 (see ZOOM_EN).
	'Tissu éponge': { name: 'Terry towelling', zoom: 'Loose cotton loops, fluffy fibres' },
	'Éponge': { name: 'Sponge', zoom: 'Network of spongin fibres, sand grains' },
	'Bernacles': { name: 'Barnacles', zoom: 'Six ribbed plates, growth lines, diamond-shaped operculum' },
	'Mycélium, moisissure': { name: 'Mycelium, mould', zoom: 'Interwoven hyphae, spore heads' },
	'Compost': { name: 'Compost', zoom: 'Crumbs, leaf debris, filaments, grains' },
	// 21. Molten matter
	'Lave pahoehoe': { name: 'Pahoehoe lava', zoom: 'Ropes of glassy skin, vesicles, microlites' },
	'Lave aa': { name: 'Aa lava', zoom: 'Jagged blocks, spines, vesicles, oxides' },
	'Croûte de lave': { name: 'Lava crust', zoom: 'Plates pulling apart, glowing seams, wrinkles, vesicles' },
	'Braises': { name: 'Embers', zoom: 'Split charcoal blocks, ash, wood fibres' },
	'Métal en fusion': { name: 'Molten metal', zoom: 'Wrinkled oxide skin, tears, slag grains' },
	'Laitier': { name: 'Slag', zoom: 'Black glass, vesicles, crystals, a fading glow' },
	// 22. Liquids and films
	'Surface d’eau': { name: 'Water surface', zoom: 'Sand grains under the caustics, floating pollen and bubbles' },
	'Pluie sur une flaque': { name: 'Rain on a puddle', zoom: 'Rings of capillary waves, bubbles, gravel under the water' },
	'Eau qui ruisselle': { name: 'Running water', zoom: 'Meandering rivulets, sliding drops, meniscus' },
	'Nappe d’huile': { name: 'Oil slick', zoom: 'Interference fringes around the grains' },
	'Bulle de savon': { name: 'Soap bubble', zoom: 'Swirls of colour, black film, rising spots' },
	'Écume': { name: 'Froth', zoom: 'Bubbles of every size, Plateau borders, iridescent films' },
	// 23. Transformations
	'Papier qui brûle': { name: 'Burning paper', zoom: 'Embers on the fibres, cracked carbon, ash' },
	'Givre qui se forme': { name: 'Frost forming', zoom: 'Needles growing at the tips of the branches' },
	'Glace qui fond': { name: 'Melting ice', zoom: 'Water beads swelling, frost melting' },
	'Rouille qui gagne': { name: 'Spreading rust', zoom: 'Blisters under the paint, oxide crust' },
	'Encre qui diffuse': { name: 'Spreading ink', zoom: 'Ink fingers along the fibres, pigment grains' },
	'Peinture qui sèche': { name: 'Drying paint', zoom: 'The skin wrinkles, cracks open' },
	'Moisissure qui pousse': { name: 'Growing mould', zoom: 'Hyphae ahead of the front, spore heads' },
	// 24. Pixel art
	'Pixel : fer rouillé': { name: 'Pixel: rusted iron', zoom: 'Each texel splits into 4: crust, pits, grains' },
	'Pixel : métal peint': { name: 'Pixel: painted metal', zoom: 'Paint chips, then scratches, in texels' },
	'Pixel : bronze': { name: 'Pixel: bronze', zoom: 'Hammer craters, then verdigris, in texels' },
	'Pixel : cuir': { name: 'Pixel: leather', zoom: 'Cracks, then grain, then pores' },
	'Pixel : brique': { name: 'Pixel: brick', zoom: 'Bricks, then chips, then sand' },
	'Pixel : bois peint': { name: 'Pixel: painted wood', zoom: 'Paint flakes, then growth rings, then fibres' },
	'Pixel : tricot': { name: 'Pixel: knit', zoom: 'Cables, then stitches, then plies' },
	'Écran CRT': { name: 'CRT screen', zoom: 'Scan lines, RGB slot mask, phosphor grains' },
	// 25. Relief (pilot)
	'Relief : bois flotté': { name: 'Relief: driftwood', zoom: 'Earlywood canyons, latewood ridges, deep checks' },
	'Relief : bois brûlé': { name: 'Relief: charred wood', zoom: 'Domed charcoal blocks, crevasses between them' },
	'Relief : écorce': { name: 'Relief: bark', zoom: 'Plates overhanging fissures several millimetres deep' },
	'Relief : surface d’eau': { name: 'Relief: water surface', zoom: 'Ripple crests hide the next trough, a distorted bed' },
	'Caustiques : fond de piscine': { name: 'Caustics: pool floor', zoom: 'A network of light lines on the sand, moving with the waves' },
	// 26. Underwater
	'Sous l’eau : granit': { name: 'Underwater: granite', zoom: 'Caustics on the crystals, red absorbed with depth' },
	'Sous l’eau : marbre': { name: 'Underwater: marble', zoom: 'A network of light, water turning bluer with depth' },
	'Sous l’eau : bois flotté': { name: 'Underwater: driftwood', zoom: 'Caustics on the growth rings, a wet band at the waterline' },
	'Sous l’eau : bronze': { name: 'Underwater: bronze', zoom: 'Metal reflections tinted by the water' },
	'Sous l’eau : brique': { name: 'Underwater: brick', zoom: 'Bricks turning brown-green underwater' },
};

// Zoom captions whose French name is shared with another cube.
const ZOOM_EXTRA = {
	// 17. Surface states, 'Poussière' on varnish.
	'Grains, peluches, cheveux sur le vernis terni': 'Grains, lint, hairs on the dulled varnish',
	// 3. Pile, terry towel ('Éponge' in the pile row).
	'Boucles lâches de coton, fibres duveteuses': 'Loose cotton loops, fluffy fibres',
};

// French zoom caption -> English, for every cube of cubelist.js.
export const ZOOM_EN = { ...ZOOM_EXTRA };
for ( const row of CUBES ) {
	for ( const it of row.items ) {
		const e = typeof it.name === 'string' ? CUBES_EN[ it.name ] : null;
		if ( it.zoom && ! ( it.zoom in ZOOM_EN ) && e && e.zoom ) ZOOM_EN[ it.zoom ] = e.zoom;
	}
}
// ZOOM_EXTRA wins over the name lookup for the shared names.
Object.assign( ZOOM_EN, ZOOM_EXTRA );

// English label of one cube item: { name, zoom }. Falls back to the French.
export function cubeEn( item ) {
	const terry = item.zoom === 'Boucles lâches de coton, fibres duveteuses';
	const fr = typeof item.name === 'string' ? item.name : 'Éponge';
	const e = CUBES_EN[ fr ];
	const name = terry ? 'Terry towelling' : ( e ? e.name : fr );
	const zoom = item.zoom ? ( ZOOM_EN[ item.zoom ] || item.zoom ) : undefined;
	return { name, zoom };
}

// English row title. Falls back to the French.
export const rowEn = ( title ) => ROWS_EN[ title ] || title;
