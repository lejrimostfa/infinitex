// Stitch pattern settings (patterns.js). `stitch` is read when the graph is
// built: changing it needs a new material. The other numbers are read at
// build time too, except relief and backing (uniforms).

export const PATTERN_DEFAULTS = {
	stitch: 'jersey', // jersey | rib | garter | seed | cable | lace | crochet | fleece
	relief: 1.0, // height of the pattern (raised ribs, ridges, cables), 0..2
	rib_knit: 2, // knit columns per rib
	rib_purl: 2, // purl columns per rib
	cable_stitches: 6, // stitches in a cable panel (two strands)
	cable_ground: 6, // purl stitches between two cables
	cable_rows: 8, // rows between two crossings
	backing_color: '#1c1a24', // what lace eyelets show
	// Fleece (fleece.js)
	pile_mm: 1.6, // tuft size of the brushed pile
	pills_per_cm2: 0.25, // pilling balls
	pill_mm: 1.6, // their size
};

// Lift (stitch widths) of the raised stitches, far AO of the sunk ones.
const LIFT = { rib: 0.13, garter: 0.08, seed: 0.03, cable: 0.3, lace: 0, crochet: 0 };
const MACRO_AO = { rib: 0.35, garter: 0.22, cable: 1 };

// Build-time settings, kept on the uniforms as plain numbers.
export function patternSettings( p, aspect ) {

	const mode = p.stitch;
	const g = {
		mode, lift: LIFT[ mode ] ?? 0, macroAO: MACRO_AO[ mode ] ?? 0,
		ribK: p.rib_knit, ribP: p.rib_purl,
		cableW: p.cable_stitches, ground: p.cable_ground, cableRows: p.cable_rows,
	};
	// Macro period (stitch widths) and mean macro AO over a period.
	if ( mode === 'rib' ) {

		g.macroPeriod = g.ribK + g.ribP;
		g.macroMeanAO = 1 - g.macroAO * g.ribP / g.macroPeriod;

	} else if ( mode === 'garter' ) {

		g.macroPeriod = 2 * aspect;
		g.macroMeanAO = 1 - g.macroAO * 0.5;

	} else {

		g.macroPeriod = g.cableW + g.ground;
		g.macroMeanAO = 0.9; // cable: ground shade beside the strands (estimated from shots)

	}

	return g;

}
