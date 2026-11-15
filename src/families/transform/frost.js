// Frost forming on a cold window. The glass first fogs (droplets of a
// few um), then water vapour freezes straight into ice on nucleation
// seeds (dust, scratches), one every size_mm or so, each starting a little
// later than the last. Ice grows fastest along its six a-axes, so a stem
// shoots from the seed both ways and side branches sprout at 60 degrees
// once the tip has passed, then twigs on the branches, then needles:
//   L0 feathers  a stem per seed, 2 to 6 cm long, its tip moving out at
//                about 5 mm/s on the demo clock; neighbours meet
//   L1 branches  every 2 to 3 mm, they start when the tip passes and grow
//                at 0.6 of its speed, shorter toward the tip
//   L2 twigs     every 0.3 mm on each branch, same rule
//   L3 needles   every 40 um; between the ferns hoar grains (20 to 60 um)
//                fade in one by one as the glass gets colder
// Every tip is anti-aliased by the footprint, so the growth is smooth.
// Same geometry as ground/frost.js (a still fern), here grown over time.

import { vec2, float, floor, fract, mix, smoothstep, step, abs, cos, sin, clamp, mod } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { grains, line, fbm } from '../ground/grains.js';
import { beads } from './drops.js';

const SIN = Math.sin( Math.PI / 3 ), COT = 1 / Math.tan( Math.PI / 3 );

// Side branches of a stem along x (y across), spacing sp: a along the
// branch, b across it, base on the stem, a hash per branch.
function sideBranches( x, y, sp, salt ) {

	const ay = abs( y );
	const q = x.sub( ay.mul( COT ) ).div( sp );
	const k = floor( q );
	const h = hash3( vec2( mod( k, 4096 ), step( 0, y ).add( salt ) ) );
	const b = fract( q ).sub( 0.5 ).sub( h.x.sub( 0.5 ).mul( 0.35 ) ).mul( sp ).mul( SIN );
	return { a: ay.div( SIN ), b, base: k.add( 0.5 ).mul( sp ), h };

}

// A growing tip: 1 behind it, 0 past it, edge anti-aliased.
const tip = ( a, len, fp ) => clamp( len.sub( a ).div( fp ).add( 0.5 ), 0, 1 );

// hero: one feather at a given place and angle instead of a Voronoi field.
function feathers( p, g, fp, u, prog, salt, hero = null ) {

	const V = hero ? { toSeed: p.sub( vec2( ...hero.at ) ).div( g ), id1: vec2( 7, 3 ) }
		: voronoi( mod( p.div( g ), 4096 ).add( u.seed.mul( 2.3 ) ).add( salt ), 0.85 );
	const id = hash3( V.id1.add( 3.9 + salt ) );
	const ang = hero ? float( hero.ang ) : id.x.mul( 6.2832 );
	const d = vec2( cos( ang ), sin( ang ) ), n = vec2( sin( ang ).negate(), cos( ang ) );
	const L = V.toSeed.mul( g );
	const xr = L.dot( d );
	const x = abs( xr );
	const y = L.dot( n ).sub( valueNoise( vec2( xr.div( g.mul( 0.15 ) ), id.y.mul( 40 ) ) ).sub( 0.5 ).mul( g.mul( 0.06 ) ) );
	const Lf = g.mul( id.z.mul( 0.3 ).add( 0.6 ) );
	const has = hero ? float( 1 ) : step( id.y, u.density.mul( 0.8 ).add( 0.2 ) );
	// Growth: each seed starts at its own time, the tip slows as it goes.
	const start = hero ? float( 0.05 ) : id.y.mul( 0.35 );
	const G = clamp( prog.sub( start ).div( 0.6 ), 0, 1 );
	const Ln = Lf.mul( G.pow( 0.75 ) ).toVar();
	const sp1 = g.mul( 0.06 ), sp2 = sp1.mul( 0.13 ), sp3 = sp2.mul( 0.13 );
	const f1 = fadeIn( sp1, fp, 2.0, 5.0 ), f2 = fadeIn( sp2, fp, 2.0, 5.0 ), f3 = fadeIn( sp3, fp, 2.0, 5.0 );
	const alive = tip( x, Ln, fp ).mul( has ).toVar();
	const stem = line( y, g.mul( 0.004 ).mul( x.div( Lf ).oneMinus().max( 0.3 ) ), fp ).mul( alive );
	// L1: a branch at `base` starts once the tip passed it.
	const B1 = sideBranches( x, y, sp1, id.z.mul( 50 ) );
	const L1 = g.mul( 0.38 ).mul( B1.base.div( Lf ).oneMinus().max( 0 ) ).mul( B1.h.y.mul( 0.5 ).add( 0.6 ) )
		.mul( valueNoise( vec2( B1.base.div( sp1.mul( 4 ) ), id.z.mul( 30 ).add( step( 0, y ).mul( 9 ) ) ) ).mul( 0.9 ).add( 0.35 ) );
	const L1n = L1.min( Ln.sub( B1.base ).max( 0 ).mul( 0.6 ) ).toVar();
	const on1 = tip( B1.a, L1n, fp ).mul( step( B1.base, Lf ) ).mul( has );
	const br1 = line( B1.b, sp1.mul( 0.06 ).mul( B1.a.div( L1.max( 1e-6 ) ).oneMinus().max( 0.25 ) ), fp ).mul( on1 ).mul( f1 );
	// L2 twigs.
	const B2 = sideBranches( B1.a, B1.b, sp2, B1.h.z.mul( 30 ) );
	const L2 = sp1.mul( 0.42 ).mul( B2.base.div( L1.max( 1e-6 ) ).oneMinus().max( 0 ) ).mul( B2.h.y.mul( 0.5 ).add( 0.6 ) );
	const L2n = L2.min( L1n.sub( B2.base ).max( 0 ).mul( 0.6 ) ).toVar();
	const on2 = tip( B2.a, L2n, fp ).mul( on1 );
	const br2 = line( B2.b, sp2.mul( 0.09 ).mul( B2.a.div( L2.max( 1e-7 ) ).oneMinus().max( 0.3 ) ), fp ).mul( on2 ).mul( f2 );
	// L3 needles, tapered.
	const B3 = sideBranches( B2.a, B2.b, sp3, B2.h.z.mul( 30 ) );
	const L3 = sp2.mul( 0.45 ).mul( B3.base.div( L2.max( 1e-7 ) ).oneMinus().max( 0 ) ).mul( B3.h.y.mul( 0.8 ).add( 0.4 ) );
	const L3n = L3.min( L2n.sub( B3.base ).max( 0 ).mul( 0.6 ) );
	const on3 = tip( B3.a, L3n, fp ).mul( on2 ).mul( step( 0.15, B3.h.z ) );
	const br3 = line( B3.b, sp3.mul( 0.13 ).mul( B3.a.div( L3.max( 1e-7 ) ).oneMinus().max( 0.15 ) ), fp ).mul( on3 ).mul( f3 );

	// A pixel too coarse for a level sees its mean cover.
	const fill1 = on1.mul( 0.22 ).mul( valueNoise( mod( p.div( sp1 ), 4096 ).add( 4.4 ) ).mul( 0.8 ).add( 0.6 ) ).mul( f1.oneMinus() );
	const fill2 = on2.mul( 0.45 ).mul( f2.oneMinus() ).mul( f1 );
	const fill3 = on3.mul( 0.5 ).mul( f3.oneMinus() ).mul( f2 );
	const ice = stem.max( br1 ).max( br2 ).max( br3 ).max( fill1 ).max( fill2 ).max( fill3 ).toVar();
	const slope = n.mul( y.div( g.mul( 0.004 ) ).clamp( - 1, 1 ).mul( - 0.6 ).mul( stem ) )
		.add( vec2( id.y, id.z ).sub( 0.5 ).mul( 0.5 ).mul( ice ) );
	return { ice, slope };

}

export function buildFrost( p, fp, u, prog ) {

	const g = u.sizeM, s = u.seed;
	const A = feathers( p, g, fp, u, prog, 0 );
	const B = feathers( p, g.mul( 0.55 ), fp, u, prog.sub( 0.12 ), 17.1 );
	const H = feathers( p, g.mul( 0.7 ), fp, u, prog, 31, { at: [ 0.137, 0.1515 ], ang: 0.12 } );
	const AB = { ice: A.ice.max( B.ice ), slope: pick( step( B.ice, A.ice ), A.slope, B.slope ) };
	const ice = A.ice.max( B.ice ).max( H.ice ).toVar();

	// The glass fogs first (breath figure: droplets of 5 to 20 um), the
	// droplets freeze, then hoar grains fade in one by one.
	const fog = smoothstep( 0.0, 0.25, prog ).mul( smoothstep( 0.3, 0.7, fbm( p.div( g.mul( 0.5 ) ).add( 2.6 ), 3 ) ).mul( 0.6 ).add( 0.4 ) ).toVar();
	const D1 = beads( p, float( 4e-5 ), fp, fog.mul( 0.9 ).add( 0.1 ), fog, 2.9 );
	const D2 = beads( vec2( p.x.mul( 0.8 ).sub( p.y.mul( 0.6 ) ), p.x.mul( 0.6 ).add( p.y.mul( 0.8 ) ) ), float( 1.7e-5 ), fp, fog, fog.mul( 0.8 ), 7.4 );
	const D = { cover: D1.cover.max( D2.cover ), rim: D1.rim.max( D2.rim ), caustic: D1.caustic.max( D2.caustic ), slope: D1.slope.add( D2.slope ) };
	const frozen = smoothstep( 0.3, 0.8, prog );
	const Hg = grains( p, g.mul( 8e-4 ), fp, 4.7, { gap: 0.25, radius: 0.3, round: 0.15, crown: 0, elong: 1.5, tilt: 0.45 } );
	const wH = fadeIn( g.mul( 8e-4 ), fp, 1.5, 4.0 );
	const hoarDen = smoothstep( 0.35, 0.75, fbm( p.div( g.mul( 0.5 ) ).add( 6.1 ), 3 ) ).mul( u.density ).mul( 0.7 ).mul( smoothstep( 0.15, 0.9, prog ) );
	const th = float( 1 ).sub( hoarDen );
	const hoarOn = smoothstep( th, th.add( 0.08 ), Hg.id.x );
	const hoar = Hg.body.mul( hoarOn ).mul( wH ).add( hoarDen.mul( 0.12 ).mul( wH.oneMinus() ) );

	// Glass dark; droplets a grey veil, whiter once frozen; ice white and blue.
	const glass = u.color3.mul( valueNoise( p.div( 0.03 ).add( s ) ).mul( 0.3 ).add( 0.85 ) );
	const drop = mix( glass.mul( 1.6 ).add( D.caustic.mul( 0.15 ) ), u.color2.mul( 0.7 ), frozen ).mul( D.rim.mul( 0.5 ).oneMinus() );
	let color = mix( glass, drop, D.cover.mul( 0.8 ) );
	color = mix( color, mix( u.color2, u.color, Hg.id.y ), hoar.mul( 0.85 ) );
	const iceCol = mix( u.color2, u.color, ice.mul( 0.6 ).add( 0.4 ) );
	color = mix( color, iceCol, ice );

	const slope = pick( step( H.ice, AB.ice ), AB.slope, H.slope ).add( Hg.grad.mul( 0.4 ).mul( hoarOn ).mul( wH ) )
		.add( D.slope.mul( 0.5 ).mul( ice.oneMinus() ) ).mul( u.relief );
	const rgh = mix( mix( float( 0.05 ), float( 0.3 ), D.cover.mul( frozen ) ), u.roughness, ice.max( hoar ) );
	return { color, slope, cavity: float( 0 ), rough: rgh, s2: float( 0.02 ).mul( ice ).add( D.cover.mul( 0.02 ) ) };

}
