// A sheet of paper burning. The flame front starts from a few ignition
// points (size_mm apart, each lit a little later) and creeps outward,
// slowed or sped by draughts (a slow warp) and ragged at every scale (a
// fractal wiggle). Zones by distance behind the front:
//   ahead    the heat browns the paper over a few mm: cream, tan, brown,
//            near black just before the flame (pyrolysis)
//   ember    a glowing line about feature_mm wide, 1100 K at the front
//            falling to 750 K; it flickers and crawls (noise advected
//            with the clock), single fibres glow brighter
//   char     black char over front_mm, glassy (roughness 0.35); it shrinks,
//            so it wrinkles (3 mm and 1 mm) and crazes into 1 to 2 mm
//            plates; near the hole it curls up
//   ash      grey white ash, mottled, with crumbs of 0.15 mm and a few
//            sparks still crawling on it
//   hole     where the sheet is gone: cut out (opacity), frayed edge
// Paper levels from paper.js (flocs, fibres, fibrils).

import { vec2, vec3, float, mix, smoothstep, mod, clamp } from 'three/tsl';
import { ixTime } from '../../core/clock.js';
import { fadeIn, surfaceGradient, gate } from '../../core/lod.js';
import { valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { arrival, heroSeed, rough, ageMeters } from '../../core/front.js';
import { fbm } from '../stone/common.js';
import { grains } from '../ground/grains.js';
import { ridged } from '../organic/common.js';
import { paper } from './paper.js';
import { glowAt } from './heat.js';

const vn = valueNoise;

export function buildBurn( p, fp, u, prog ) {

	const g = u.sizeM, s = u.seed;
	const t = ixTime.mul( u.speed );
	const q = p.div( g );
	const wq = vec2( vn( q.mul( 1.7 ).add( s ) ), vn( q.mul( 1.7 ).add( s.add( 9.1 ) ) ) ).sub( 0.5 ).mul( 0.35 );
	const A = arrival( q.add( wq ).add( s.mul( 1.37 ) ), { jitter: 0.8, delay: 0.7, salt: 3 } );
	const T = A.t1.add( 0.15 ).min( heroSeed( q.add( wq ), g, [ 0.3, - 0.25 ] ) )
		.add( rough( p, g, fp, { top: 0.12, amp: 0.3, oct: 11, minM: 1.5e-5, salt: 5 } ) ).toVar();
	const F = ageMeters( T, prog.mul( 1.3 ).sub( 0.25 ), g, p, fp );
	const age = F.age;

	// Zone widths in meters, changing along the front.
	const E = u.featureM.mul( 0.6 );
	const nW = fbm( p.add( 3.3 ), float( 0.03 ), fp, 3, 2 );
	const charW = u.frontM.mul( nW.mul( 1.2 ).add( 0.4 ) ).toVar();
	const ashW = u.frontM.mul( 0.5 ).mul( fbm( p.add( 7.1 ), float( 0.02 ), fp, 3, 4 ).add( 0.3 ) );
	const holeW = charW.add( ashW ).add( u.frontM.mul( 3 ).mul( smoothstep( 0.45, 0.75, fbm( p.add( 1.7 ), float( 0.05 ), fp, 2, 6 ) ) ).mul( u.density.oneMinus() ) ).toVar();
	const scorchW = u.frontM.mul( 0.7 );

	const P = paper( p, fp, u );
	const reached = F.aa( float( 0 ) ).toVar();
	const sc = smoothstep( scorchW.negate(), float( 0 ), age ).mul( P.fib.mul( 0.15 ).add( 0.9 ) ).min( 1 );
	const charM = F.aa( E.mul( 0.4 ) ).toVar();
	// Ash: zero up to charW behind the front. The gate skips its mottle,
	// crumbs and colour where it is zero (the paper ahead, the char band).
	const ashA = smoothstep( charW, charW.add( ashW.mul( 0.6 ) ), age ).toVar();
	const Ash = gate( ashA.greaterThan( 0 ), { ashM: 0, ashCol: [ 0, 0, 0 ], ashS: [ 0, 0 ] }, () => {

		const ashM = ashA.mul( smoothstep( 0.35, 0.6, fbm( p.add( 5.5 ), float( 4e-3 ), fp, 4, 8 ) ).mul( 0.7 ).add( 0.3 ) );
		// Ash: grey white, mottled, crumbs.
		const C = grains( p, float( 1.5e-4 ), fp, 2.9, { gap: 0.3, radius: 0.35, round: 0.4, crown: 0.6 } );
		const wC = fadeIn( 1.5e-4, fp, 1.5, 4.0 );
		const ashCol = u.color3.mul( fbm( p.add( 2.2 ), float( 2e-3 ), fp, 4, 9 ).mul( 0.6 ).add( 0.7 ) ).mul( C.body.mul( C.id.x.mul( 0.4 ) ).mul( wC ).add( 1 ) );
		return { ashM, ashCol, ashS: C.grad.mul( 0.3 ).mul( ashM ).mul( wC ) };

	}, [ p, fp, ashA ] );
	const ashM = Ash.ashM.toVar();
	const hole = F.aa( holeW ).toVar();
	const keepFlat = ashM.mul( 0.5 ).oneMinus().toVar();

	// Colours: paper browning ahead of the flame.
	let col = u.color.mul( P.tone );
	col = mix( col, col.mul( vec3( 0.93, 0.78, 0.52 ) ), smoothstep( 0.0, 0.45, sc ) );
	col = mix( col, u.color4.mul( P.tone ), smoothstep( 0.35, 0.8, sc ) );
	col = mix( col, u.color4.mul( 0.22 ), smoothstep( 0.75, 1.0, sc ) );
	// Char: zero ahead of the front. The gate skips the plates, cracks,
	// pores and wrinkles there (and the whole sheet before it burns).
	const Ch = gate( charM.greaterThan( 0 ), { charCol: [ 0, 0, 0 ], crack: 0, poS: [ 0, 0 ], rwS: [ 0, 0 ] }, () => {

		// Char: shrinking plates with dark gaps, a faint blue grey glint.
		const cq = p.div( 1.6e-3 );
		const CV = voronoi( mod( cq.add( vec2( vn( cq.mul( 0.6 ) ), vn( cq.mul( 0.6 ).add( 3.3 ) ) ).mul( 0.9 ) ), 4096 ).add( 4.4 ), 0.95 );
		const wCr = fadeIn( 1.6e-3, fp, 2.0, 6.0 );
		const cw = vn( cq.mul( 0.9 ).add( 7.7 ) ).mul( 5e-5 ).add( 5e-6 );
		const crack = clamp( cw.sub( CV.edge.mul( 1.6e-3 ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( wCr ).mul( smoothstep( E, E.mul( 4 ), age ) );
		// The char keeps the fibres it was made of: they stand out a little
		// greyer and glint.
		// Its surface is porous: blisters of escaped gas, 30 to 80 um.
		const Po = grains( p, float( 6e-5 ), fp, 7.3, { gap: 0.2, radius: 0.35, round: 0.5, crown: 0.7 } );
		const wPo = fadeIn( 6e-5, fp, 1.5, 4.0 );
		const charCol = u.color2.mul( vn( p.div( 2e-3 ).add( 6.6 ) ).mul( 0.5 ).add( 0.75 ) ).mul( P.fib.mul( 0.6 ).add( 1 ) ).mul( float( 1 ).sub( crack.mul( 0.8 ) ) )
			.mul( Po.body.mul( 0.25 ).mul( wPo ).add( 0.85 ) );
		// Relief: char wrinkles as it shrinks.
		const Rw = ridged( p.add( vec2( p.y.mul( 0.4 ), 0 ) ), float( 5e-3 ), fp, 4, 2 );
		return { charCol, crack, poS: Po.grad.mul( 0.25 ).mul( wPo ).mul( charM ), rwS: Rw.slope.mul( 2.2e-4 ).mul( charM ).mul( keepFlat ) };

	}, [ p, fp, age, charM, P.fib, keepFlat ] );
	const charCol = Ch.charCol, crack = Ch.crack, ashCol = Ash.ashCol;
	col = mix( col, charCol, charM );
	col = mix( col, ashCol, ashM );

	// Ember line: temperature falls behind the front; flicker crawls.
	const fl = vn( mod( p.div( 5e-3 ), 4096 ).add( vec2( t.mul( 0.9 ), t.mul( - 0.6 ) ) ) )
		.add( vn( mod( p.div( 1.2e-3 ), 4096 ).add( vec2( t.mul( - 1.7 ), t.mul( 1.3 ) ) ) ).mul( 0.5 ) ).sub( 0.75 );
	const x = clamp( age.div( E ), 0, 1 );
	const K = float( 1150 ).sub( x.mul( 400 ) ).add( fl.mul( 160 ) ).add( P.fib.mul( 60 ) );
	const band = reached.sub( F.aa( E ) ).max( 0 );
	// Sparks on the ash rim: hot specks that come and go.
	const sp = smoothstep( 0.72, 0.9, vn( mod( p.div( 1.5e-3 ), 4096 ).add( vec2( t.mul( 0.5 ), 2.1 ) ) ) )
		.mul( smoothstep( holeW.sub( 3e-3 ), holeW, age ) ).mul( hole.oneMinus() ).mul( fadeIn( 1.5e-3, fp, 1.0, 3.0 ).mul( 0.7 ).add( 0.3 ) );
	const emissive = glowAt( K, u.glow ).mul( band ).add( glowAt( float( 900 ), u.glow ).mul( sp.mul( 0.5 ) ) );

	// Relief: char wrinkles as it shrinks, curls up near the hole.
	const w1 = fadeIn( 3e-3, fp, 2.0, 6.0 );
	const curl = smoothstep( holeW.sub( 4e-3 ), holeW, age ).mul( 4e-4 );
	const slope = surfaceGradient( charM.mul( curl ).mul( keepFlat ), p ).add( Ch.rwS ).mul( u.relief )
		.add( P.slope.mul( charM.mul( 0.4 ).oneMinus() ) ).add( Ch.poS ).add( Ash.ashS );
	const s2 = P.s2.add( charM.mul( w1.oneMinus() ).mul( 0.04 ) );

	const rgh = mix( mix( u.roughness, float( 0.35 ), charM ), float( 0.95 ), ashM );
	return { color: col, slope, cavity: crack.mul( charM ), rough: rgh, s2, emissive, alpha: hole.oneMinus() };

}
