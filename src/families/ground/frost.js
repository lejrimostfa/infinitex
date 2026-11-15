// Frost on a cold, dark surface (window, car roof).
// Water vapour freezes straight into ice, and the crystal grows fastest
// along its six a-axes, so each branch sprouts side branches at 60
// degrees, which sprout their own: a fern, self similar over four levels.
//   L0 feathers  one feather per cell of 2 to 6 cm, from a nucleus,
//                stems wandering; neighbours meet along lines
//   L1 branches  side branches every 2 to 3 mm, shorter toward the tip
//   L2 twigs     sub branches every 0.3 mm on each branch
//   L3 needles   needles every 40 um; between the ferns, hoar grains
//                (20 to 60 um) frost the glass
// The glass stays dark and glossy where no ice covers it.
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, abs, cos, sin, clamp, mod } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { grains, line, fbm } from './grains.js';

const SIN = Math.sin( Math.PI / 3 ), COT = 1 / Math.tan( Math.PI / 3 );

// Side branches of a stem along x (y across), spacing sp. Returns the
// branch frame: a along the branch, b across it, the base on the stem,
// and a hash per branch.
function sideBranches( x, y, sp, salt ) {

	const ay = abs( y );
	const q = x.sub( ay.mul( COT ) ).div( sp );
	const k = floor( q );
	const h = hash3( vec2( mod( k, 4096 ), step( 0, y ).add( salt ) ) );
	const b = fract( q ).sub( 0.5 ).sub( h.x.sub( 0.5 ).mul( 0.35 ) ).mul( sp ).mul( SIN );
	return { a: ay.div( SIN ), b, base: k.add( 0.5 ).mul( sp ), h };

}

// One layer of feathers, one per Voronoi cell of size g.
function feathers( p, g, fp, u, salt ) {

	const V = voronoi( p.div( g ).add( u.seed.mul( 2.3 ) ).add( salt ), 0.85 );
	const id = hash3( V.id1.add( 3.9 + salt ) );
	const ang = id.x.mul( 6.2832 );
	const d = vec2( cos( ang ), sin( ang ) ), n = vec2( sin( ang ).negate(), cos( ang ) );
	const L = V.toSeed.mul( g );
	const xr = L.dot( d );
	const x = abs( xr ); // the stem grows both ways from the nucleus
	const yRaw = L.dot( n );
	const y = yRaw.sub( valueNoise( vec2( xr.div( g.mul( 0.15 ) ), id.y.mul( 40 ) ) ).sub( 0.5 ).mul( g.mul( 0.06 ) ) );
	const Lf = g.mul( id.z.mul( 0.3 ).add( 0.6 ) );
	const has = step( id.y, u.cover.mul( 0.8 ).add( 0.2 ) );
	const alive = smoothstep( Lf, Lf.mul( 0.85 ), x ).mul( has );

	// L0 stem.
	const sp1 = g.mul( 0.06 ), sp2 = sp1.mul( 0.13 ), sp3 = sp2.mul( 0.13 );
	const stem = line( y, g.mul( 0.004 ).mul( x.div( Lf ).oneMinus().max( 0.3 ) ), fp ).mul( alive );
	// L1 branches: length falls toward the feather tip.
	const B1 = sideBranches( x, y, sp1, id.z.mul( 50 ) );
	const L1 = g.mul( 0.38 ).mul( B1.base.div( Lf ).oneMinus().max( 0 ) ).mul( B1.h.y.mul( 0.5 ).add( 0.6 ) );
	const on1 = smoothstep( L1, L1.mul( 0.9 ), B1.a ).mul( alive );
	const br1 = line( B1.b, sp1.mul( 0.06 ).mul( B1.a.div( L1.max( 1e-6 ) ).oneMinus().max( 0.25 ) ), fp ).mul( on1 ).mul( fadeIn( sp1, fp, 2.0, 5.0 ) );
	// L2 twigs on each branch.
	const B2 = sideBranches( B1.a, B1.b, sp2, B1.h.z.mul( 30 ) );
	const L2 = sp1.mul( 0.42 ).mul( B2.base.div( L1.max( 1e-6 ) ).oneMinus().max( 0 ) ).mul( B2.h.y.mul( 0.5 ).add( 0.6 ) );
	const on2 = smoothstep( L2, L2.mul( 0.85 ), B2.a ).mul( on1 );
	const br2 = line( B2.b, sp2.mul( 0.09 ).mul( B2.a.div( L2.max( 1e-7 ) ).oneMinus().max( 0.3 ) ), fp ).mul( on2 ).mul( fadeIn( sp2, fp, 2.0, 5.0 ) );
	// L3 needles on each twig.
	const B3 = sideBranches( B2.a, B2.b, sp3, B2.h.z.mul( 30 ) );
	const L3 = sp2.mul( 0.45 ).mul( B3.base.div( L2.max( 1e-7 ) ).oneMinus().max( 0 ) ).mul( B3.h.y.mul( 0.8 ).add( 0.4 ) );
	const on3 = smoothstep( L3, L3.mul( 0.8 ), B3.a ).mul( on2 ).mul( step( 0.15, B3.h.z ) );
	// Needles taper to a point.
	const br3 = line( B3.b, sp3.mul( 0.13 ).mul( B3.a.div( L3.max( 1e-7 ) ).oneMinus().max( 0.15 ) ), fp ).mul( on3 ).mul( fadeIn( sp3, fp, 2.0, 5.0 ) );

	// What a pixel too coarse for a level sees: its mean cover.
	const fill1 = on1.mul( 0.35 ).mul( fadeIn( sp1, fp, 2.0, 5.0 ).oneMinus() );
	const fill2 = on2.mul( 0.45 ).mul( fadeIn( sp2, fp, 2.0, 5.0 ).oneMinus() ).mul( fadeIn( sp1, fp, 2.0, 5.0 ) );
	const fill3 = on3.mul( 0.5 ).mul( fadeIn( sp3, fp, 2.0, 5.0 ).oneMinus() ).mul( fadeIn( sp2, fp, 2.0, 5.0 ) );
	const ice = stem.max( br1 ).max( br2 ).max( br3 ).max( fill1 ).max( fill2 ).max( fill3 ).toVar();
	// Each feather leans its own way; stem and branches are ridges.
	const slope = n.mul( y.div( g.mul( 0.004 ) ).clamp( - 1, 1 ).mul( - 0.6 ).mul( stem ) )
		.add( vec2( id.y, id.z ).sub( 0.5 ).mul( 0.5 ).mul( ice ) );
	return { ice, slope, on1 };

}

export function buildFrost( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	// Two layers: big feathers, and smaller ones that fill between them.
	const A = feathers( p, g, fp, u, 0 );
	const B = feathers( p, g.mul( 0.55 ), fp, u, 17.1 );
	const ice = A.ice.max( B.ice ).toVar();

	// Hoar between the ferns: tiny grains, denser near the ice.
	const Hg = grains( p, g.mul( 8e-4 ), fp, 4.7, { gap: 0.25, radius: 0.3, round: 0.15, crown: 0, elong: 1.5, tilt: 0.45 } );
	const wH = fadeIn( g.mul( 8e-4 ), fp, 1.5, 4.0 );
	const hoarDen = smoothstep( 0.35, 0.75, fbm( p.div( g.mul( 0.5 ) ).add( 6.1 ), 3 ) ).mul( u.cover ).mul( 0.7 );
	const hoarOn = step( float( 1 ).sub( hoarDen ), Hg.id.x );
	const hoar = Hg.body.mul( hoarOn ).mul( wH ).add( hoarDen.mul( 0.12 ).mul( wH.oneMinus() ) );

	// Glass: dark, a faint fog of condensation; ice white and blue.
	const glass = u.color3.mul( valueNoise( p.div( 0.03 ).add( s ) ).mul( 0.3 ).add( 0.85 ) );
	const fog = mix( glass, u.color2.mul( 0.3 ), hoarDen.mul( 0.25 ) );
	const iceCol = mix( u.color2, u.color, ice.mul( 0.6 ).add( 0.4 ) );
	let color = mix( fog, mix( u.color2, u.color, Hg.id.y ), hoar.mul( 0.85 ) );
	color = mix( color, iceCol, ice );

	const slope = pick( step( B.ice, A.ice ), A.slope, B.slope )
		.add( Hg.grad.mul( 0.4 ).mul( hoarOn ).mul( wH ) );
	const rough = mix( float( 0.08 ), u.roughness, ice.max( hoar ) );
	const s2 = float( 0.02 ).mul( ice );
	return { color, slope, cavity: float( 0 ), rough, s2 };

}
