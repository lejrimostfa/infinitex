// Rain on a puddle over asphalt. Moderate rain (5 mm/h of 2 mm drops)
// is about 300 drops per m2 per second, 30 on a 30 cm face.
//   L0  puddle     water fills the low ground (depth_mm, density = share
//                  of the face under water); stone tops break the edges
//   L0  drops      each cell of size_mm (10 cm) of three shifted grids
//                  gets a drop every 0.6 s at a random place (amount =
//                  chance of each): about 400 drops per m2 per second
//   L1  rings      the crater collapses and sends a ring of ripples out:
//                  a packet of feature_mm capillary waves (6 mm: crests
//                  at 30 cm/s, the packet at 45 cm/s, gravity capillary
//                  dispersion, waves.js). Amplitude falls as 1/sqrt(r)
//                  and in 0.25 s, so a ring dies 7 to 10 cm out; a faster
//                  train of shorter wavelets (2.4 mm) leads it. The
//                  first 0.1 s a jet stands where the drop hit, a crown
//                  of 12 droplets flies out and one droplet bounces up.
//                  Small drops leave short lived dimples (3 mm)
//   L2  bubbles    some drops trap air: bubbles of 1 to 3 mm float a few
//                  seconds, then pop
//   L2  ground     the asphalt, darker wet, seen through the water
// Time runs at `speed` (0.2: slow motion; at full speed the rings run
// too fast to follow and fade into a shimmer, waves.js flickerFade).

import { vec2, vec3, float, floor, fract, exp, mod, mix, clamp, smoothstep, step, atan, cos, sin } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';
import { ixTime } from '../../core/clock.js';
import { fbm } from '../stone/common.js';
import { capSlope } from '../ceramic/bubbles.js';
import { omega, groupSpeed, flickerFade } from './waves.js';
import { buildAsphalt } from './asphalt.js';

// One packet of ring waves of length lam: slope (vector) at offset dv
// (meters) from the impact, tau seconds after it.
function packet( dv, r, tau, lam, A, fp, rate, life ) {

	const k = float( 2 * Math.PI ).div( lam ), w = omega( k ), cg = groupSpeed( k );
	const R = cg.mul( tau );
	const inner = exp( R.sub( r ).max( 0 ).div( lam.mul( 1.2 ) ).negate() ); // 2 or 3 crests trail behind the front
	const outer = exp( r.sub( R ).max( 0 ).div( lam.mul( 0.5 ) ).pow( 2 ).negate() );
	const amp = float( A ).mul( exp( tau.div( life ).negate() ) ).div( r.div( lam ).add( 1 ).sqrt() );
	const env = inner.mul( outer ).mul( amp );
	const ph = k.mul( r ).sub( w.mul( tau ) );
	const lod = fadeIn( lam, fp, 2.0, 4.0 ).mul( flickerFade( w, rate ) );
	const dir = dv.div( r.max( 1e-5 ) );
	return { slope: dir.mul( env.mul( ph.sin() ).mul( lod ).negate() ), s2: env.mul( env ).mul( 0.5 ).mul( lod.oneMinus() ) };

}

const PERIOD = 0.6; // seconds between two drops in a cell

function drops( p, fp, u, t, layer ) {

	const C = u.sizeM;
	const x = p.div( C ).add( layer * 0.5 + 0.21 );
	const cell = floor( x );
	let slope = vec2( 0 ), s2 = float( 0 ), jet = float( 0 ), drop = float( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = mod( cell.add( vec2( ox, oy ) ), 4096 );
		const hc = hash3( id.add( layer * 13.7 ) );
		const tc = t.div( PERIOD ).add( hc.x );
		const n = floor( tc ), tau = fract( tc ).mul( PERIOD );
		const hd = hash3( mod( id.add( vec2( n.mul( 17.31 ), n.mul( 7.17 ) ) ), 4096 ).add( layer * 5.3 + 1.1 ) );
		const on = step( hd.z, u.amount );
		const c0 = id.add( 0.5 ).add( hd.xy.sub( 0.5 ).mul( 0.9 ) );
		const dv = mod( x.sub( c0 ).add( 2048 ), 4096 ).sub( 2048 ).mul( C );
		const r = dv.length();
		// Rings fade before they leave the 3 x 3 cells around the impact.
		const keep = smoothstep( C, C.mul( 0.55 ), r ).mul( on ).mul( smoothstep( 0, 0.015, tau ) ).mul( smoothstep( PERIOD, PERIOD * 0.7, tau ) );
		const big = hd.y.mul( 0.6 ).add( 0.7 );
		const P1 = packet( dv, r, tau, u.featureM, big.mul( 1.1 ), fp, u.speed, float( 0.3 ) );
		const P2 = packet( dv, r, tau, u.featureM.mul( 0.4 ), big.mul( 0.4 ), fp, u.speed, float( 0.06 ) );
		slope = slope.add( P1.slope.add( P2.slope ).mul( keep ) );
		s2 = s2.add( P1.s2.add( P2.s2 ).mul( keep ) );
		// The jet: a dome 3 mm wide for the first tenth of a second.
		const rj = float( 0.0016 ).mul( big );
		const hj = exp( r.div( rj ).pow( 2 ).negate() ).mul( exp( tau.div( 0.04 ).negate() ) ).mul( on );
		slope = slope.sub( dv.div( rj ).mul( hj ).mul( 1.4 ).mul( fadeIn( rj.mul( 2 ), fp, 1, 3 ) ) );
		jet = jet.max( hj );
		// The crown: a ring of 12 droplets thrown out in the first 0.1 s,
		// 2 to 5 mm out; then one droplet bounces up from the jet tip.
		const a = atan( dv.y, dv.x ).div( Math.PI * 2 / 12 );
		const ca = floor( a ).add( 0.5 ).mul( Math.PI * 2 / 12 );
		const rc = float( 0.002 ).add( tau.mul( 0.03 ) ).mul( big );
		const cd = dv.sub( vec2( cos( ca ), sin( ca ) ).mul( rc ) ).length();
		const live = smoothstep( 0.1, 0.06, tau ).mul( on );
		const crown = smoothstep( 4.5e-4, 2e-4, cd ).mul( live ).mul( fadeIn( float( 9e-4 ), fp, 1, 3 ) );
		const bounce = smoothstep( 6e-4, 3e-4, r ).mul( smoothstep( 0.03, 0.05, tau ) ).mul( smoothstep( 0.18, 0.14, tau ) ).mul( on ).mul( fadeIn( float( 1.2e-3 ), fp, 1, 3 ) );
		drop = drop.max( crown ).max( bounce );

	}

	return { slope, s2, jet, drop };

}

// Dimples: the many small drops (0.5 mm) leave a pit 3 mm wide for a
// twentieth of a second, one per 1.2 cm cell every 0.2 s.
function dimples( p, fp, t ) {

	const C = 0.012, x = mod( p.div( C ), 4096 ), cell = floor( x );
	const tc = t.div( 0.2 ).add( hash3( cell.add( 4.4 ) ).x );
	const n = floor( tc ), tau = fract( tc ).mul( 0.2 );
	const h = hash3( mod( cell.add( vec2( n.mul( 5.3 ), n.mul( 2.9 ) ) ), 4096 ).add( 8.8 ) );
	const dv = x.sub( cell.add( 0.5 ).add( h.xy.sub( 0.5 ).mul( 0.4 ) ) ).mul( C ); // kept 2.4 radii from the cell edge: no cut
	const rd = float( 1.5e-3 );
	const pit = exp( dv.dot( dv ).div( rd.mul( rd ) ).negate() ).mul( exp( tau.div( 0.05 ).negate() ) ).mul( step( h.z, 0.7 ) );
	return dv.div( rd ).mul( pit ).mul( 1.6 ).mul( fadeIn( rd.mul( 2 ), fp, 1, 3 ) ); // a pit rises outward

}

// Bubbles a drop trapped: one candidate per 9 mm cell, a few seconds
// each, a new place every life.
function bubbles( p, fp, u, t ) {

	const C = 0.009;
	const x = mod( p.div( C ), 4096 );
	const cell = floor( x );
	const hc = hash3( cell.add( 31.3 ) );
	const life = hc.x.mul( 4 ).add( 2 );
	const tc = t.div( life ).add( hc.y );
	const n = floor( tc ), ph = fract( tc );
	const h = hash3( mod( cell.add( vec2( n.mul( 3.7 ), n.mul( 9.1 ) ) ), 4096 ) );
	const on = step( h.z, u.amount.mul( 0.5 ) ).mul( step( ph, 0.85 ) );
	const rn = h.x.mul( h.x ).mul( 0.13 ).add( 0.05 ).mul( smoothstep( 0, 0.04, ph ) );
	const c0 = cell.add( 0.5 ).add( h.xy.sub( 0.5 ).mul( 0.5 ) );
	const v = x.sub( c0 ).div( rn.max( 1e-3 ) );
	const d = v.length(), rm = rn.mul( C );
	const inside = clamp( float( 1 ).sub( d ).mul( rm ).div( fp ).add( 0.5 ), 0, 1 ).mul( on ).mul( fadeIn( rm.mul( 2 ), fp, 1, 3 ) );
	return { inside, slope: capSlope( v, d ).mul( inside ).mul( - 1.5 ) }; // a dome

}

export function buildRain( p, fp, u ) {

	const t = ixTime.mul( u.speed );
	const D0 = drops( p, fp, u, t, 0 ), D1 = drops( p, fp, u, t.add( 0.25 ), 1 ), D2 = drops( p, fp, u, t.add( 0.45 ), 2 );
	const B = bubbles( p, fp, u, t );
	const ring = D0.slope.add( D1.slope ).add( D2.slope ).add( dimples( p, fp, t ) ).toVar();
	const drop = D0.drop.max( D1.drop ).max( D2.drop );

	// The ground seen through the water, shifted by the ring slopes.
	const A = buildAsphalt( p, fp, u );
	const level = fbm( p, 0.14, fp, 3, 5 ).sub( 0.5 ).mul( 2.4 ).add( u.density.mul( 2 ).sub( 1 ) ).mul( u.depthM );
	const Dw = level.sub( A.h ).toVar();
	const water = smoothstep( 0.0, 2.5e-4, Dw ).toVar();
	// Under water the road is dark: the puddle is a black mirror.
	const wet = A.color.mul( 0.5 );
	const tint = float( 1 ).sub( exp( Dw.max( 0 ).div( 0.006 ).negate() ) );
	let color = mix( wet, mix( wet.mul( 0.7 ), u.color, tint.mul( 0.5 ) ), water );
	color = mix( color, vec3( 0.5, 0.52, 0.55 ), D0.jet.max( D1.jet ).max( D2.jet ).mul( 0.3 ).mul( water ) );
	color = mix( color, color.mul( 0.7 ), B.inside.mul( water ) );
	// Crown droplets and the bounce: bright beads in the air.
	color = mix( color, vec3( 0.75, 0.78, 0.82 ), drop );
	const slope = mix( A.slope.mul( 0.8 ), ring.add( B.slope ), water );
	const s2 = mix( A.s2, D0.s2.add( D1.s2 ).add( D2.s2 ), water );
	const rough = mix( float( 0.32 ), u.roughness, water );
	return { color, slope, cavity: A.cavity.mul( water.oneMinus() ), rough, s2, wet: float( 1 ) };

}
