// Terrazzo, from the floor down to the polish.
//   L0 chips    large marble chips (chip_mm) of three stones, irregular and
//               of varied size, veined inside; the cement wears a little
//               deeper than the chips (edge_um): a soft step at each border
//   L0b fines   fine chips, a third of the size, in the cement (fines)
//   L1 grains   sand grains in the cement, calcite crystals in the chips
//               (grain_mm); air voids in the cement (pores)
//   L2 polish   fine scratches of the grinding stones (polish_um), in
//               patches of one direction
// Under L2, core/micro.js carries on (granular, impl.micro).
// Returns W = { color, slope, cavity, rough, s2 } for shader.js.
//
// The rules of docs/authoring.md, in order:
//   - each level fades in with fadeIn( period, fp ) and sits in a gate()
//     on fadeOn( period, fp, lo ) with the same lo: it runs only where it shows
//   - cell coordinates are a .toVar() taken before the gate, passed in `shared`
//   - when a level is off, its gate returns what the level averages to
//     (colour, cavity, roughness), and its slope variance goes to s2:
//     the far view keeps the mean look of the near view
//   - pick() never select(); no dFdx, dFdy or texture() inside a gate

import { vec2, float, mix, smoothstep, step, mod, cos, sin } from 'three/tsl';
import { fadeIn, fadeOn, gate, pick, hash3, valueNoise, voronoi } from '../../kit.js';

const PORE_R = 0.2, J1 = 0.6; // void radius and jitter of L1 (cells): a void never crosses its cell
const FINE = 0.3; // fine chips: size against the large ones
const S2 = { chips: 0.004, edge: 0.001, grains: 0.002, polish: 0.0015 }; // slope variance of each level

// What the whole matter averages to. Exact for the colour: each stone is
// a third of the chips, the tone noises have zero mean, the coverages are
// the measured ones (params.js COVER).
function means( u ) {

	const m = u.matrix.clamp( 0.05, 0.85 ), f = u.fines.clamp( 0.1, 0.8 );
	const cp = u.pores.mul( 0.5 * Math.PI * PORE_R * PORE_R ); // share of cement in voids
	const stones = u.color.add( u.color2 ).add( u.color3 ).div( 3 );
	const between = mix( u.matrixColor.mul( float( 1 ).sub( cp.mul( 0.6 ) ) ), stones, f );
	return {
		f, cp, stones,
		color: mix( stones, between, m ),
		cavity: m.mul( f.oneMinus().mul( cp.mul( 0.6 ).add( 0.25 ) ).add( f.mul( 0.08 ) ) ),
		rough: mix( u.roughness, mix( u.matrixRoughness, u.roughness, f ), m ),
		s2: float( S2.chips + S2.edge + S2.grains ).add( u.scratches.mul( S2.polish ) ),
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

// L1: grains and crystals, voids. stone: 1 on any chip, 0 in the cement.
function grains( q1, fp, u, stone, cp ) {

	const V = voronoi( q1, J1 );
	const h = hash3( V.id1.add( u.seed.mul( 3.3 ) ) );
	const w = fadeIn( u.grainM, fp, 1.5, 5.0 );
	const tone = mix( h.x.sub( 0.5 ).mul( 0.4 ), h.x.sub( 0.5 ).mul( 0.14 ), stone ).mul( w ).add( 1 );
	const slope = V.dir.mul( smoothstep( 0.06, 0.0, V.edge ) ).mul( mix( float( 0.05 ), float( 0.01 ), stone ) ).mul( w );
	const aa = fp.div( u.grainM ).mul( 0.75 );
	const pore = smoothstep( aa.add( PORE_R ), float( PORE_R ).sub( aa ), V.toSeed.length() ).mul( step( h.z, u.pores.mul( 0.5 ) ) );
	return { tone, slope, pore: mix( cp, pore, w ) };

}

// L2: polishing scratches, one direction per patch of 2 cm.
function polish( p, fp, u ) {

	const P = u.polishM;
	const w = fadeIn( P, fp, 2.0, 6.0 );
	const a = valueNoise( p.div( 0.02 ).add( u.seed.mul( 5.1 ) ) ).mul( Math.PI * 2 );
	const ca = cos( a ), sa = sin( a );
	const r = vec2( p.x.mul( ca ).add( p.y.mul( sa ) ), p.y.mul( ca ).sub( p.x.mul( sa ) ) );
	const q = mod( vec2( r.x.div( P.mul( 40 ) ), r.y.div( P ) ), 4096 );
	const line = smoothstep( 0.72, 0.92, valueNoise( q ) ).mul( u.scratches ).mul( w );
	// Across the scratch: down one side, up the other (zero mean slope).
	const across = valueNoise( q.add( vec2( 0, 0.5 ) ) ).sub( valueNoise( q.sub( vec2( 0, 0.5 ) ) ) );
	return { slope: vec2( sa.negate(), ca ).mul( across.mul( line ).mul( 0.08 ) ), tone: line.mul( 0.05 ) };

}

export function buildTerrazzo( p, fp, u ) {

	const g = u.chipM, s = u.seed;
	const M = means( u );
	const far = { color: { node: M.color, size: 3 }, slope: [ 0, 0 ], cavity: M.cavity, rough: M.rough, s2: M.s2 };
	const q0 = mod( p.div( g ), 4096 ).add( s.mul( 7.1 ) ).toVar(); // L0 cells, before the gate
	return gate( fadeOn( g, fp, 1.0 ), far, () => {

		const wC = fadeIn( g, fp, 1.0, 4.0 );
		const C = chips( q0, fp, g, u.gap, u );
		const chip = C.chip.toVar();

		// L0b: fine chips in the cement.
		const gf = g.mul( FINE );
		const qf = mod( p.div( gf ), 4096 ).add( s.mul( 3.9 ).add( 17 ) ).toVar();
		const F = gate( fadeOn( gf, fp, 1.0 ), { sc: M.f, col: { node: M.stones, size: 3 }, slope: [ 0, 0 ] }, () => {

			const c = chips( qf, fp, gf, u.gapFine, u );
			const w = fadeIn( gf, fp, 1.0, 4.0 );
			return { sc: mix( M.f, c.chip, w ), col: mix( M.stones, c.color, w ), slope: c.slope.mul( w ) };

		}, [ qf, fp ] );
		const stone = chip.add( chip.oneMinus().mul( F.sc ) ).toVar();

		// L1 and L2, each gated on its own fade.
		const q1 = mod( p.div( u.grainM ), 4096 ).add( s.mul( 2.3 ) ).toVar();
		const G = gate( fadeOn( u.grainM, fp, 1.5 ), { tone: 1, slope: [ 0, 0 ], pore: M.cp }, () => grains( q1, fp, u, stone, M.cp ), [ q1, fp, stone ] );
		const L = gate( fadeOn( u.polishM, fp, 2.0 ), { slope: [ 0, 0 ], tone: 0 }, () => polish( p, fp, u ), [ p, fp ] );

		const wG = fadeIn( u.grainM, fp, 1.5, 5.0 ), wS = fadeIn( u.polishM, fp, 2.0, 6.0 );
		const cement = u.matrixColor.mul( valueNoise( p.div( g.mul( 0.6 ) ).add( 11.3 ) ).sub( 0.5 ).mul( 0.12 ).add( 1 ) );
		const voids = G.pore.mul( F.sc.oneMinus() );
		const between = mix( cement.mul( float( 1 ).sub( voids.mul( 0.6 ) ) ), F.col, F.sc );
		const near = mix( between, C.color, chip ).mul( G.tone ).mul( L.tone.mul( stone ).add( 1 ) );
		const cavity = chip.oneMinus().mul( F.sc.oneMinus().mul( G.pore.mul( 0.6 ).add( 0.25 ) ).add( F.sc.mul( 0.08 ) ) );
		return {
			color: mix( M.color, near, wC ),
			slope: C.slope.add( F.slope.mul( chip.oneMinus() ) ).add( G.slope ).add( L.slope ).mul( wC ),
			cavity: mix( M.cavity, cavity, wC ),
			rough: mix( M.rough, mix( mix( u.matrixRoughness, u.roughness, F.sc ), u.roughness, chip ), wC ),
			s2: wC.oneMinus().mul( S2.chips ).add( C.wE.oneMinus().mul( S2.edge ) ).add( wG.oneMinus().mul( S2.grains ) ).add( wS.oneMinus().mul( u.scratches ).mul( S2.polish ) ),
		};

	}, [ q0, p, fp ] );

}
