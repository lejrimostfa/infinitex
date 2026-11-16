// The ten matters of the living room (demo/livingroom.js). The GLB from
// blender/livingroom.py names one material slot per mesh, ix_<key>; each
// key gets one Infinitex preset here. UVs are in metres on every surface.
// rock is not a matter: the far ridges get a flat basalt (they sit in the
// haze, 200 m away).

export const MATTERS = {
	// Oak boards on the floor, the TV cabinet, the side table, the bowl.
	wood: { family: 'wood', intent: 'oiled oak floor strips', ring_mm: 4, figure: 0.6, knots: 0.02, roughness: 0.45, seed: 2 },
	// Walls and ceiling: trowelled plaster, warm white.
	plaster: { family: 'stone', mode: 'plaster', intent: 'trowelled lime plaster, warm', color: '#cfc4b0', color2: '#b3a892', trowel: 0.8, trowel_mm: 140, pores: 0.6, polish: 0.1, roughness: 0.85, color_variation: 0.08, seed: 7 },
	// A hand-knotted Persian rug.
	rug: { family: 'pile', mode: 'knot', rug_mm: 2600, knot_mm: 4.3, row_mm: 3, fiber_um: 32, angle_deg: 270, pile_height: 0.85, nap: 0.25, brush: 0.2, tuft_depth: 0.35, abrash: 0.6, fringe: 1, roughness: 0.8, sheen: 0.3, color_variation: 0.08, seed: 4 },
	// 80s beige moulded plastic: TV case, knobs, phone.
	plastic: { family: 'plastic', mode: 'solid', intent: 'beige ABS of an 80s TV, slightly yellowed', color: '#d7c9a8', color2: '#bfae88', roughness: 0.45, seed: 5 },
	// The picture tube.
	crt: { family: 'scifi', mode: 'crt', size_mm: 1.2, feature_mm: 0.45, color3: '#101411', roughness: 0.2, glow: 1.4, coat: 1, speed: 1, seed: 8 },
	// Cognac leather armchair.
	leather: { family: 'leather', color: '#6a3519', wear: 0.35, seed: 3 },
	// Oranges in the bowl.
	citrus: { family: 'organic', mode: 'citrus', intent: 'orange peel', size_mm: 1.1, cell_um: 25, color: '#d9620c', color2: '#b8800c', color3: '#7a4a1c', color_variation: 0.12, density: 0.5, wax: 0.5, relief: 1, translucency: 0.3, roughness: 0.4, seed: 2 },
	// The lava lake under the cliff. A real lake: crust plates of metres,
	// seams a few decimetres wide, so every size is scaled up from a hand
	// sample.
	lava: { family: 'molten', mode: 'lake', scale_mm: 24000, size_mm: 5000, feature_mm: 600, flow_mm_s: 120, seed: 3 },
	// The sun, low over the lake (molten photosphere): a disc facing the
	// eye, scale_mm its radius. Granules much larger than the real ones (1
	// Mm), so a few dozen show across a disc 150 px wide; deep orange haze.
	sun: { family: 'molten', mode: 'photosphere', shape: 'disc', scale_mm: 22000, size_mm: 1200, melt_k: 5772, crust_k: 4000, cover: 0.3, contrast: 1, haze: 3, glow: 0.2, speed: 1, seed: 3, relief: 0, micro: 0 },
};

// The sweater of the figure at the window.
export const SWEATER = { family: 'knit', stitch: 'cable', color: '#3d5a46', heather_color: '#2c4434', heather_fraction: 0.2, fuzz_color: '#4e6b56', seed: 6 };
