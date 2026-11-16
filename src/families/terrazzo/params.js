// Terrazzo preset -> uniforms. Marble chips cast in cement, ground flat
// and polished (floors, stairs, counters). Not in the catalogue before the
// kit: no other family has hard chips of several stones flush in a binder.
// Sizes: chips 3 to 25 mm (Venetian up to 40), fine chips a third of that,
// sand and calcite grains 0.2 to 1 mm, calcite crystals 50 to 200 um,
// polishing scratches 20 to 60 um, plucked pits and pores 5 to 30 um.
// defineParams (src/kit/params.js) names the uniforms from the keys:
// chip_mm -> u.chipM (metres), matrix_color -> u.matrixColor, ...

import { uniform } from 'three/tsl';
import { defineParams } from '../../kit.js';

const P = defineParams( {
	schema_version: 1,
	family: 'terrazzo',
	intent: 'polished Venetian terrazzo floor',
	seed: 1,
	chip_mm: 9, // mean size of the large chips
	matrix: 0.55, // share of the floor between the large chips, 0.05 to 0.85
	fines: 0.3, // share of that space taken by fine chips, 0.1 to 0.8
	color: '#ebe6da', // chips, white Carrara
	color2: '#a8644c', // chips, red Verona
	color3: '#6b706b', // chips, grey Bardiglio
	matrix_color: '#d6cfc1', // cement and marble dust
	veins: 0.5, // veining and mottling inside the chips
	grain_mm: 0.6, // sand grains in the cement, calcite grains in the chips
	pores: 0.4, // air voids in the cement
	fine_um: 90, // calcite crystals inside the grains, silt in the cement
	polish_um: 40, // polishing scratch width
	scratches: 0.5,
	pit_um: 15, // micro pits: plucked crystals, capillary pores
	pits: 0.6,
	edge_um: 15, // the cement sits this much lower than the chips
	roughness: 0.16, // polished chips
	matrix_roughness: 0.42,
} );

// Share of a cell covered by its chip, against the chip's gap to the cell
// border (cells, Voronoi jitter 0.9, warp 0.35, size 0.4 to 1.6 per chip).
// Measured on 200k samples per row (error about 0.002). apply() reads the
// gap for the wanted coverage here, so the far colour (levels.js means())
// is the true average of the near view.
const COVER = [ [ 0, 1 ], [ 0.025, 0.9031 ], [ 0.05, 0.817 ], [ 0.075, 0.7303 ], [ 0.1, 0.6531 ], [ 0.125, 0.5812 ], [ 0.15, 0.5174 ], [ 0.175, 0.4568 ], [ 0.2, 0.4042 ], [ 0.225, 0.3534 ], [ 0.25, 0.3111 ], [ 0.275, 0.2731 ], [ 0.3, 0.2423 ], [ 0.325, 0.2113 ], [ 0.35, 0.184 ], [ 0.375, 0.1617 ], [ 0.4, 0.1428 ], [ 0.425, 0.1241 ], [ 0.45, 0.1095 ], [ 0.475, 0.0971 ], [ 0.5, 0.0844 ] ];
export function gapFor( cover ) {

	const c = Math.min( 1, Math.max( 0.0844, cover ) );
	for ( let i = 1; i < COVER.length; i ++ ) {

		const [ g0, c0 ] = COVER[ i - 1 ], [ g1, c1 ] = COVER[ i ];
		if ( c >= c1 ) return g0 + ( g1 - g0 ) * ( c0 - c ) / ( c0 - c1 );

	}

	return 0.5;

}

export const TERRAZZO = {
	defaults: P.defaults,
	uniforms: () => ( { ...P.uniforms(), gap: uniform( 0 ), gapFine: uniform( 0 ) } ),
	apply( u, preset ) {

		const state = P.apply( u, preset );
		const p = state.preset;
		u.gap.value = gapFor( 1 - Math.min( 0.85, Math.max( 0.05, p.matrix ) ) );
		u.gapFine.value = gapFor( Math.min( 0.8, Math.max( 0.1, p.fines ) ) );
		return state;

	},
};

export const TERRAZZO_SLIDERS = [
	[ 'chip_mm', 3, 40, 0.5 ],
	[ 'matrix', 0.05, 0.85, 0.01 ],
	[ 'fines', 0.1, 0.8, 0.01 ],
	[ 'veins', 0, 1, 0.01 ],
	[ 'grain_mm', 0.2, 2, 0.01 ],
	[ 'pores', 0, 1, 0.01 ],
	[ 'fine_um', 30, 300, 1 ],
	[ 'scratches', 0, 1, 0.01 ],
	[ 'pits', 0, 1, 0.01 ],
	[ 'edge_um', 0, 60, 1 ],
	[ 'roughness', 0.03, 0.8, 0.01 ],
	[ 'matrix_roughness', 0.05, 0.95, 0.01 ],
	[ 'gloss', 0, 1, 0.02 ],
	[ 'wetness', 0, 1, 0.02 ],
	[ 'wear', 0, 1, 0.02 ],
];
