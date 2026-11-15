// Metal mode `rust`: iron left out in the rain for years.
//   L0 mottling:  wide patches more or less corroded, 2 to 7 cm
//   L1 scale:     two layers of oxide. The top one is thick (about 0.25
//                 mm), porous, orange to brown, broken into flakes of
//                 about flake_mm with ragged edges; part of them fell, part
//                 lifted into blisters, some edges curl up. Under it, a
//                 thin compact dark brown layer (0.08 mm) that fell in
//                 smaller flakes too: there the bare iron shows, dark grey.
//                 Each ledge casts a thin shadow on the layer below.
//   L2 pits:      corrosion pits 0.1 to 0.6 mm wide in the iron and the
//                 lower scale, dark, with fresh orange rust at the bottom
//   L3 cracks:    hairline cracks between flakes that still hold
//   L4 crust:     the oxide grows in lumps of 80 to 200 um made of grains
//                 of 10 to 30 um with dark pores between (oxide.js); the
//                 iron shows its ferrite crystals (grain_um)
// Oxide is a dielectric (metalness 0); only the bare iron is metallic.

import { vec2, vec3, float, floor, clamp, smoothstep, step, mix, mod, max } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { oxideCrust } from './oxide.js';

const aa = ( d, fp ) => clamp( d.div( fp ).add( 0.5 ), 0, 1 );
const vn = valueNoise;

// A corrosion pit per cell (present with probability `presence`): a bowl
// of radius 0.1 to 0.28 cells. Returns coverage, slope and the depth 0..1.
function pits( p, fp, cellM, presence, seed ) {

	const q = p.div( cellM ).add( seed );
	const qc = mod( floor( q ), 4096 );
	const qh = hash3( qc );
	const qv = q.sub( floor( q ) ).sub( qh.xy.sub( 0.5 ).mul( 0.4 ).add( 0.5 ) );
	const R = qh.z.mul( 0.18 ).add( 0.1 );
	const t = float( 1 ).sub( qv.dot( qv ).div( R.mul( R ) ) ).max( 0 );
	const on = step( hash1( qc.add( 3.3 ) ), presence );
	const cov = aa( R.sub( qv.length() ).mul( cellM ), fp ).mul( on );
	const slope = qv.mul( t.mul( 0.6 ).div( R ) ).mul( on ).mul( fadeIn( cellM, fp, 3.0, 9.0 ) );
	return { cov, slope, depth: t.mul( on ) };

}

export function buildRust( p, fp, u ) {

	const F = u.flakeM;
	// L0 mottling: some zones lost more scale than others.
	const big = vn( p.div( 0.07 ).add( u.seed.mul( 1.3 ) ) ).mul( 0.6 ).add( vn( p.div( 0.02 ).add( 3.1 ) ).mul( 0.4 ) ).toVar();
	const big2 = vn( p.div( 0.03 ).add( 21.7 ) ).mul( 0.7 ).add( vn( p.div( 0.009 ).add( 2.4 ) ).mul( 0.3 ) );
	// Warped cells and ragged edges: flakes break along no straight line.
	const wq = vec2( vn( p.div( F.mul( 1.7 ) ).add( 1.1 ) ), vn( p.div( F.mul( 1.7 ) ).add( 5.9 ) ) ).sub( 0.5 ).mul( 1.2 );
	const rag = vn( p.div( F.mul( 0.12 ) ).add( 4.4 ) ).sub( 0.5 ).mul( 0.3 ).add( vn( p.div( F.mul( 0.03 ) ).add( 9.9 ) ).sub( 0.5 ).mul( 0.1 ) );

	// L1 top scale: flake present or fallen, soft ledge for the relief.
	const A = voronoi( p.div( F ).add( wq ).add( u.seed.mul( 3.7 ) ), 0.9 );
	const hA1 = hash3( A.id1 ), hA2 = hash3( A.id2 );
	const lossA = clamp( u.flaking.add( big.sub( 0.5 ).mul( 1.4 ) ), 0, 1 );
	const onA1 = step( lossA, hA1.x ), onA2 = step( lossA, hA2.x );
	const eA = A.edge.add( rag ).mul( F ).toVar(); // meters, > 0 inside the flake
	const tA = 2.5e-4;
	const covA = mix( onA2, onA1, aa( eA, fp ) ).toVar();
	const hA = mix( onA2, onA1, aa( eA, max( fp, tA * 1.5 ) ) ).mul( tA );
	const wF = fadeIn( F, fp, 2.0, 6.0 ).toVar();
	const cw = hA1.z.mul( 3e-5 ).add( 1.5e-5 ), cwE = cw.max( fp );
	const crack = onA1.mul( onA2 ).mul( aa( cwE.sub( eA.abs() ), fp ) ).mul( cw.div( cwE ) ).mul( wF );
	const shadow = float( 1 ).sub( onA1 ).mul( onA2 ).mul( smoothstep( tA * 3, 0, eA ) ).mul( float( 1 ).sub( covA ) );
	// Blisters dome up and fall toward the edge; free edges curl up.
	const blister = onA1.mul( step( hA1.y, u.blisters ) );
	const curl = onA1.mul( float( 1 ).sub( onA2 ) ).mul( step( hA1.z, 0.6 ) );
	const sLift = A.dir.mul( smoothstep( 0.45, 0.0, A.edge ).mul( - 0.18 ).mul( blister )
		.add( smoothstep( 0.12, 0.0, A.edge ).mul( 0.3 ).mul( curl ) ) ).mul( wF ).mul( covA );

	// L1 lower scale: thinner, smaller flakes; bare iron where it fell.
	const FB = F.mul( 0.45 );
	const B = voronoi( p.div( FB ).add( wq.mul( 0.6 ) ).add( 13.3 ), 0.9 );
	const lossB = clamp( u.bare.add( big2.sub( 0.5 ).mul( 1.4 ) ), 0, 1 );
	const onB1 = step( lossB, hash1( B.id1 ) ), onB2 = step( lossB, hash1( B.id2 ) );
	const eB = B.edge.add( rag.mul( 0.8 ) ).mul( FB );
	const tB = 8e-5;
	const covB = mix( onB2, onB1, aa( eB, fp ) );
	const hB = mix( onB2, onB1, aa( eB, max( fp, tB * 1.5 ) ) ).mul( tB );
	const showB = float( 1 ).sub( covA ).mul( covB ).toVar();
	const showI = float( 1 ).sub( covA ).mul( float( 1 ).sub( covB ) ).toVar();

	// L2 pits, two sizes, where the top scale is gone.
	const P1 = pits( p, fp, float( 1.6e-3 ), u.pitting.mul( 0.6 ), 5.3 );
	const P2 = pits( p, fp, float( 4e-4 ), u.pitting.mul( 0.5 ), 8.1 );
	const open = float( 1 ).sub( covA );
	const pit = P1.cov.max( P2.cov ).mul( open ).toVar();
	const pitDeep = P1.depth.max( P2.depth ).mul( open );

	// L4 grains: oxide crust, and ferrite crystals in the bare iron.
	const G = oxideCrust( p, fp, u );
	const iv = voronoi( mod( p.div( u.grainM ), 4096 ).add( 4.4 ) );
	const wI = fadeIn( u.grainM, fp, 2.0, 6.0 );
	const ih = hash3( iv.id1 );
	const ironTone = ih.z.sub( 0.5 ).mul( 0.12 ).mul( wI ).add( 1 ).mul( float( 1 ).sub( smoothstep( 0.0, 0.05, iv.edge ).oneMinus().mul( 0.3 ).mul( wI ) ) );

	// Colour. Top scale: orange to dark brown per flake, ochre streaks.
	const nA = vn( p.div( F.mul( 0.8 ) ).add( 3.7 ) ).mul( 0.6 ).add( hA1.z.mul( 0.4 ).mul( wF ) ).add( big.sub( 0.5 ).mul( 0.5 ) );
	const ochre = u.rustColor.mul( vec3( 1.2, 1.1, 0.62 ) );
	const colA = mix( u.rustColor, u.rustDark, smoothstep( 0.25, 0.85, nA ) )
		.mul( vn( p.div( 0.04 ).add( 7.2 ) ).mul( 0.35 ).add( 0.82 ) );
	const colA2 = mix( mix( colA, ochre, smoothstep( 0.68, 0.9, vn( p.div( 0.012 ).add( 5.5 ) ) ).mul( 0.6 ) ), u.rustDark.mul( 0.5 ), G.dark )
		.mul( G.tone ).mul( float( 1 ).sub( crack.mul( 0.7 ) ) ).mul( blister.mul( 0.12 ).mul( wF ).add( 1 ) );
	const colB = mix( u.rustDark.mul( vec3( 0.8, 0.68, 0.64 ) ), u.rustDark.mul( 0.4 ), G.dark ).mul( vn( p.div( FB.mul( 0.5 ) ).add( 9.1 ) ).mul( 0.4 ).add( 0.8 ) ).mul( G.tone );
	const iron = mix( u.f0.mul( 0.28 ), vec3( 0.06, 0.055, 0.05 ), smoothstep( 0.2, 0.8, vn( p.div( 0.003 ).add( 1.7 ) ) ).mul( 0.7 ) ).mul( ironTone );
	// Pits: dark walls, fresh orange rust at the bottom.
	const pitCol = mix( u.rustDark.mul( 0.35 ), u.rustColor.mul( 0.8 ), smoothstep( 0.5, 0.95, pitDeep ) );
	let color = colA2.mul( covA ).add( colB.mul( showB ) ).add( iron.mul( showI ) );
	color = mix( color, pitCol, pit ).mul( float( 1 ).sub( shadow.mul( 0.65 ) ) );
	const metalness = showI.mul( float( 1 ).sub( pit ) ).mul( 0.9 );

	// Relief: ledges from the stacked heights, then lifted flakes, pits, grains.
	const sLedge = surfaceGradient( hA.add( hB ), p ).mul( fadeIn( F.mul( 0.25 ), fp, 1.0, 4.0 ) ).clamp( - 2, 2 );
	const slope = sLedge.add( sLift ).add( P1.slope.add( P2.slope ).mul( open ) )
		.add( G.slope.mul( float( 1 ).sub( showI ) ) ).add( ih.xy.sub( 0.5 ).mul( 0.03 ).mul( wI ).mul( showI ) );

	const rough = covA.mul( 0.9 ).add( showB.mul( 0.72 ) ).add( showI.mul( u.roughness.add( 0.15 ) ) ).add( pit.mul( 0.1 ) ).min( 1 );
	const s2 = float( 1 ).sub( G.wK ).mul( 0.06 ).add( float( 1 ).sub( G.wL ).mul( 0.08 ) ).add( float( 1 ).sub( G.w ).mul( 0.05 ) ).mul( float( 1 ).sub( showI ) ).add( float( 1 ).sub( wF ).mul( 0.02 ) );
	return {
		color, slope, rough, s2, metalness,
		cavity: pit.max( shadow ).max( crack ).max( showB.mul( 0.3 ) ).max( showI.mul( 0.5 ) ).max( G.pore.mul( 0.5 ) ),
		porosity: mix( float( 0.15 ), float( 0.9 ), float( 1 ).sub( showI ) ),
		debug: { w1: wF, w2: wI, w3: G.w },
	};

}
