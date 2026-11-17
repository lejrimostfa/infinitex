// Terrazzo, from the floor down to the micro pits.
//   L0 chips     large marble chips (chip_mm) of three stones, irregular
//                and of varied size, veined inside; the cement wears a
//                little deeper than the chips (edge_um): a soft step
//   L0b fines    fine chips, a third of the size, in the cement (fines)
//   L1 grains    sand grains in the cement, calcite grains in the chips
//                (grain_mm, 0.6 mm), air voids (pores)
//   L2 crystals  calcite crystals with twin lamellae, silt (fine_um, 90 um)
//   L3 scratches grinding scratches (polish_um, 40 um)
//   L3 pits      plucked crystals and capillary pores (pit_um, 15 um)
// The fine levels are in fine.js. Under L3, core/micro.js carries on
// (impl.micro). Returns W = { color, slope, cavity, rough, s2 }.
//
// The rules of docs/authoring.md, in order:
//   - each level fades in with fadeIn( period, fp ) and sits in a gate()
//     on fadeOn( period, fp, lo ) with the same lo: it runs only where it shows
//   - cell coordinates are a .toVar() taken before the gate, passed in `shared`
//   - when a level is off, its gate returns what the level averages to
//     (colour, cavity, roughness), and its slope variance goes to s2:
//     the far view keeps the mean look of the near view
//   - pick() never select(); no dFdx, dFdy or texture() inside a gate

import { vec2, float, mix, smoothstep, step, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate, pick, hash3, valueNoise, voronoi } from '../../kit.js';
import { grains, crystals, scratches, pits, PIT_COVER, VOID_COVER, S2F } from './fine.js';
import { wrapCoord } from '../../core/hash.js';

const FINE = 0.3; // fine chips: size against the large ones
const S2 = { chips: 0.004, edge: 0.001 }; // slope variance of L0
const cells = ( p, size, off ) => wrapCoord( p.div( size ) ).add( off ).toVar(); // before a gate

// What the whole matter averages to. Exact for the colour: each stone is
// a third of the chips, every tone has zero mean, the chip, void and pit
// coverages are measured (params.js COVER, fine.js).
function means( u ) {

	const m = u.matrix.clamp( 0.05, 0.85 ), f = u.fines.clamp( 0.1, 0.8 );
	const cp = u.pores.mul( VOID_COVER );
	const pit = u.pits.mul( PIT_COVER );
	const stones = u.color.add( u.color2 ).add( u.color3 ).div( 3 );
	const between = mix( u.matrixColor.mul( float( 1 ).sub( cp.mul( 0.6 ) ) ), stones, f );
	return {
		f, cp, stones,
		color: mix( stones, between, m ).mul( float( 1 ).sub( pit.mul( 0.5 ) ) ),
		cavity: m.mul( f.oneMinus().mul( cp.mul( 0.6 ).add( 0.25 ) ).add( f.mul( 0.08 ) ) ).add( pit.mul( 0.5 ) ),
		rough: mix( u.roughness, mix( u.matrixRoughness, u.roughness, f ), m ),
		s2: float( S2.chips + S2.edge + S2F.grains + S2F.crystals + S2F.pits ).add( u.scratches.mul( S2F.scratches ) ),
	};

}

// One field of chips on cells of cellM metres. q: cell coordinates (a
// .toVar()). gap: border kept free, in cells (params.js gapFor).
function chips( q, fp, cellM, gap, u ) {

	const qw = q.add( vec2( valueNoise( q.mul( 1.7 ).add( 3.1 ) ), valueNoise( q.mul( 1.7 ).add( 8.3 ) ) ).sub( 0.5 ).mul( 0.35 ) );
	const V = voronoi( qw, 0.9 );
	const h = hash3( V.id1.add( 1.7 ) );
	const gi = gap.mul( h.z.mul( 1.2 ).add( 0.4 ) ); // each chip its own size
	const aa = fp.div( cellM ).mul( 0.75 );
	const chip = smoothstep( gi.sub( aa ), gi.add( aa ), V.edge );
	const stone = pick( step( h.x, 1 / 3 ), u.color, pick( step( h.x, 2 / 3 ), u.color2, u.color3 ) );
	const vein = valueNoise( qw.mul( 2.5 ).add( h.yz.mul( 97 ) ) ).sub( 0.5 ).mul( u.veins ).mul( 0.5 ).add( 1 );
	const color = stone.mul( h.y.sub( 0.5 ).mul( 0.16 ).add( 1 ) ).mul( vein );
	// The step at the border: a rounded edge 0.02 cells wide, edge_um high.
	const ew = 0.02, t = V.edge.sub( gi ).div( ew ).clamp( 0, 1 );
	const wE = fadeIn( cellM.mul( ew ), fp, 2.0, 6.0 );
	const slope = V.dir.negate().mul( u.edgeM.div( cellM.mul( ew ) ) ).mul( t.mul( t.oneMinus() ).mul( 6 ) ).mul( wE );
	return { chip, color, slope, wE };

}

export function buildTerrazzo( p, fp, u ) {

	const g = u.chipM, s = u.seed;
	const M = means( u );
	const far = { color: { node: M.color, size: 3 }, slope: [ 0, 0 ], cavity: M.cavity, rough: M.rough, s2: M.s2 };
	const q0 = cells( p, g, s.mul( 7.1 ) );
	return gate( fadeOn( g, fp, 1.0 ), far, () => {

		const wC = fadeIn( g, fp, 1.0, 4.0 );
		const C = chips( q0, fp, g, u.gap, u );
		const chip = C.chip.toVar();

		// L0b: fine chips in the cement.
		const gf = g.mul( FINE );
		const qf = cells( p, gf, s.mul( 3.9 ).add( 17 ) );
		const F = gate( fadeOn( gf, fp, 1.0 ), { sc: M.f, col: { node: M.stones, size: 3 }, slope: [ 0, 0 ] }, () => {

			const c = chips( qf, fp, gf, u.gapFine, u );
			const w = fadeIn( gf, fp, 1.0, 4.0 );
			return { sc: mix( M.f, c.chip, w ), col: mix( M.stones, c.color, w ), slope: c.slope.mul( w ) };

		}, [ qf, fp ] );
		const stone = chip.add( chip.oneMinus().mul( F.sc ) ).toVar();

		// L1 to L3, each gated on its own fade.
		const q1 = cells( p, u.grainM, s.mul( 2.3 ) ), q2 = cells( p, u.fineM, s.mul( 4.7 ) ), q3 = cells( p, u.pitM, s.mul( 6.1 ) );
		const G = gate( fadeOn( u.grainM, fp, 1.5 ), { tone: 1, slope: [ 0, 0 ], pore: M.cp }, () => grains( q1, fp, u, stone, M.cp ), [ q1, fp, stone ] );
		const X = gate( fadeOn( u.fineM, fp, 1.5 ), { tone: 1, slope: [ 0, 0 ] }, () => crystals( q2, fp, u, stone ), [ q2, fp, stone ] );
		const L = gate( fadeOn( u.polishM, fp, 2.0 ), { slope: [ 0, 0 ], tone: 0 }, () => scratches( p, fp, u, stone ), [ p, fp, stone ] );
		const K = gate( fadeOn( u.pitM, fp, 1.5 ), { pit: u.pits.mul( PIT_COVER ), slope: [ 0, 0 ] }, () => pits( q3, fp, u ), [ q3, fp ] );

		const wG = fadeIn( u.grainM, fp, 1.5, 5.0 ), wX = fadeIn( u.fineM, fp, 1.5, 5.0 );
		const wS = fadeIn( u.polishM, fp, 2.0, 6.0 ), wK = fadeIn( u.pitM, fp, 1.5, 5.0 );
		const cement = u.matrixColor.mul( valueNoise( p.div( g.mul( 0.6 ) ).add( 11.3 ) ).sub( 0.5 ).mul( 0.12 ).add( 1 ) );
		const voids = G.pore.mul( F.sc.oneMinus() );
		const between = mix( cement.mul( float( 1 ).sub( voids.mul( 0.6 ) ) ), F.col, F.sc );
		const near = mix( between, C.color, chip ).mul( G.tone ).mul( X.tone ).mul( L.tone.add( 1 ) ).mul( float( 1 ).sub( K.pit.mul( 0.5 ) ) );
		const cavity = chip.oneMinus().mul( F.sc.oneMinus().mul( G.pore.mul( 0.6 ).add( 0.25 ) ).add( F.sc.mul( 0.08 ) ) ).add( K.pit.mul( 0.5 ) );
		return {
			color: mix( M.color, near, wC ),
			slope: C.slope.add( F.slope.mul( chip.oneMinus() ) ).add( G.slope ).add( X.slope ).add( L.slope ).add( K.slope ).mul( wC ),
			cavity: mix( M.cavity, cavity, wC ),
			rough: mix( M.rough, mix( mix( u.matrixRoughness, u.roughness, F.sc ), u.roughness, chip ), wC ),
			s2: wC.oneMinus().mul( S2.chips ).add( C.wE.oneMinus().mul( S2.edge ) ).add( wG.oneMinus().mul( S2F.grains ) ).add( wX.oneMinus().mul( S2F.crystals ) )
				.add( wS.oneMinus().mul( u.scratches ).mul( S2F.scratches ) ).add( wK.oneMinus().mul( S2F.pits ) ),
		};

	}, [ q0, p, fp ] );

}
