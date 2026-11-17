// An ice surface melting. Out of the freezer the ice is dry and frosty
// (white, matte); warm air melts it from a few spots outward (size_mm
// apart), so a wet front spreads:
//   ahead   the frost grains melt into droplets that swell over a few mm
//           as the front comes (beads of feature_mm and a quarter of it)
//   front   the beads merge into a film; behind it the surface is glossy,
//           clear and darker (no frost left to scatter light, so the eye
//           sees into the ice); the film flows slowly (ripples advected)
//   behind  the relief rounds off: scratches and frost bumps fade over
//           front_mm; grain boundaries melt first and open into soft
//           grooves (thermal grooving), a few big beads stand on the film
// Ice levels: crystal grains of 5 to 15 mm, trapped air bubbles (white
// specks 0.2 to 1 mm), frost grains of 60 um on the dry part.

import { vec2, float, mix, smoothstep, step, mod } from 'three/tsl';
import { ixTime } from '../../core/clock.js';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { arrival, heroSeed, rough, ageMeters } from '../../core/front.js';
import { fbm } from '../stone/common.js';
import { grains } from '../ground/grains.js';
import { scratchMarks } from '../../core/marks.js';
import { beads } from './drops.js';

const vn = valueNoise;

export function buildMelt( p, fp, u, prog ) {

	const g = u.sizeM, s = u.seed;
	const t = ixTime.mul( u.speed );
	const q = p.div( g );
	const wq = vec2( vn( q.mul( 1.3 ).add( s ) ), vn( q.mul( 1.3 ).add( s.add( 4.1 ) ) ) ).sub( 0.5 ).mul( 0.5 );
	const A = arrival( q.add( wq ).add( s.mul( 0.71 ) ), { jitter: 0.8, delay: 0.6, salt: 8 } );
	const T = A.t1.add( 0.1 ).min( heroSeed( q.add( wq ), g, [ - 0.3, 0.25 ] ) )
		.add( rough( p, g, fp, { top: 0.15, amp: 0.22, oct: 10, minM: 2e-5, salt: 2 } ) ).toVar();
	const F = ageMeters( T, prog.mul( 1.3 ).sub( 0.25 ), g, p, fp );
	const age = F.age;
	const W = u.frontM;
	const wet = F.aa( float( 0 ) ).toVar();
	const smooth = smoothstep( float( 0 ), W, age ).toVar(); // relief melted away
	const ahead = smoothstep( W.mul( - 0.6 ), float( 0 ), age ).mul( wet.oneMinus() );

	// Ice body: grains, bubbles, frosty skin.
	const G = voronoi( wrapCoord( p.div( 0.01 ) ).add( s.mul( 1.3 ) ), 0.9 );
	const gid = hash3( G.id1.add( 2.2 ) );
	const gb = smoothstep( 0.12, 0.0, G.edge ).mul( fadeIn( 0.01, fp, 2.0, 6.0 ) ); // groove, 1.2 mm wide
	// Bubbles: round, 0.2 to 1 mm, in milky clouds where the water froze fast.
	const cloud = smoothstep( 0.5, 0.75, fbm( p, float( 0.04 ), fp, 3, 3 ) );
	// The bubbles fade under 1.25 mm per pixel: the gate skips them there.
	const Bb = gate( fadeOn( 2.5e-3, fp, 2.0 ), { b: 0 }, () => {

		const Bu = grains( p, float( 2.5e-3 ), fp, 9.1, { gap: 0.3, radius: 0.18, round: 0.6, crown: 0.9 } );
		return { b: Bu.body.mul( step( 0.55, Bu.id.x ) ).mul( fadeIn( 2.5e-3, fp, 2.0, 6.0 ) ) };

	}, [ p, fp ] );
	const bub = Bb.b.mul( 0.6 ).add( cloud.mul( 0.2 ) );
	// Frost grains of 60 um: only under 40 um per pixel.
	const wFr = fadeIn( 6e-5, fp, 1.5, 4.0 ).toVar();
	const Fg = gate( fadeOn( 6e-5, fp, 1.5 ), { body: 0, grad: [ 0, 0 ] }, () => {

		const Fr = grains( p, float( 6e-5 ), fp, 3.3, { gap: 0.15, radius: 0.4, round: 0.3, crown: 0.6, tilt: 0.5 } );
		return { body: Fr.body.mul( 0.08 ).mul( wFr ), grad: Fr.grad.mul( 0.5 ).mul( wFr ) };

	}, [ p, fp, wFr ] );
	// Scratches stay only where the relief has not melted away (keep > 0).
	const keep = smooth.oneMinus().toVar();
	const Sc = gate( keep.greaterThan( 0 ), { cov: 0, slope: [ 0, 0 ] }, () => {

		const sc = scratchMarks( p, fp, float( 0.012 ), float( 4e-5 ), 3.7, { spread: 1, length: 1.5 } );
		return { cov: sc.cov.mul( smooth.oneMinus() ).mul( 0.6 ), slope: sc.slope.mul( keep ) };

	}, [ p, fp, keep, smooth ] );

	// Beads: swell ahead of the front, merge into the film, a few stay.
	const kB = ahead.max( wet.mul( 0.9 ) );
	const B1 = beads( p, u.featureM, fp, kB, ahead.mul( 0.7 ).add( wet.mul( 0.25 ) ).add( 0.05 ), 1.7 );
	const B2 = beads( p.add( 3e-4 ), u.featureM.mul( 0.27 ), fp, ahead, ahead.mul( 0.8 ).mul( wet.oneMinus() ), 6.2 );
	const bead = B1.cover.max( B2.cover );

	// Colour: frosty white blue, wet clear deep blue, bubbles milky.
	const frosty = u.color.mul( fbm( p.add( 1.1 ), float( 0.02 ), fp, 4, 2 ).mul( 0.2 ).add( 0.9 ) ).mul( Fg.body.add( 0.96 ) );
	const deep = u.color2.mul( gid.x.mul( 0.15 ).add( 0.92 ) );
	let col = mix( frosty, deep, wet.mul( smoothstep( float( - 1e-3 ), W.mul( 0.5 ), age ).mul( 0.6 ).add( 0.4 ) ) );
	col = mix( col, u.color.mul( 1.05 ), bub.mul( wet.mul( 0.5 ).add( 0.1 ) ) );
	col = mix( col, u.color3, gb.mul( wet ).mul( 0.35 ) ); // open boundaries read darker
	col = mix( col, u.color.mul( 1.08 ), Sc.cov ); // frosted scratches
	const inBead = mix( u.color2.mul( 0.8 ), u.color3, B1.rim.mul( 0.7 ) ).add( B1.caustic.mul( 0.25 ) );
	col = mix( col, inBead, bead.mul( 0.85 ) );

	// Relief: frost bumps, scratches and boundaries round off behind the
	// front; grooves deepen where grains meet; the film flows.
	const gSlope = G.dir.mul( gb.mul( gb.oneMinus() ).mul( 2.2 ) ).mul( wet.mul( 0.8 ).add( 0.2 ) );
	const fq = wrapCoord( p.div( 6e-3 ) ).add( vec2( t.mul( 0.25 ), t.mul( - 0.4 ) ) );
	const flow = vec2( vn( fq ), vn( fq.add( 3.7 ) ) ).sub( 0.5 ).mul( 0.05 ).mul( wet ).mul( fadeIn( 6e-3, fp, 2.0, 6.0 ) );
	const slope = Fg.grad.mul( keep ).add( Sc.slope ).add( gSlope ).add( flow )
		.mul( bead.oneMinus() ).add( B1.slope ).add( B2.slope ).mul( u.relief );
	const rgh = mix( u.roughness, float( 0.04 ), wet.max( bead ) );
	const s2 = keep.mul( wFr.oneMinus() ).mul( 0.04 );
	return { color: col, slope, cavity: gb.mul( 0.5 ), rough: rgh, s2, coat: wet.max( bead ).mul( 0.9 ), coatRough: float( 0.03 ), coatSlope: flow.add( B1.slope ).add( B2.slope ) };

}
