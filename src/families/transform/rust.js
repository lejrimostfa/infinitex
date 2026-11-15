// Rust spreading over painted steel. Corrosion starts where the coat is
// broken: scratches down to the steel (segments, size_mm apart) and
// pinholes (points), each starting at its own time. It then creeps under
// the paint, so the front runs ragged (filiform fingers) ahead of the
// rust that shows. Zones by distance to the front:
//   ahead    the coat lifts over the oxide that grows under it: blisters
//            of feature_mm (0.5 to 2 mm) rise over a band of a few mm, a
//            brown shadow shows through their thin tops
//   front    the coat cracks and flakes off; a few paint islands stay
//            behind, curled, casting a thin shadow
//   behind   bright orange fresh rust (lepidocrocite) near the front,
//            darker brown oxide (goethite, magnetite) as it ages over
//            front_mm; the crust of metal/oxide.js (tubercles, lumps,
//            grains of 20 um, pores)
// Before the front reaches it, a scratch is bare shiny steel. Paint
// levels: colour mottle, orange peel (ceramic/glaze.js), pigment grain.

import { vec2, float, mix, smoothstep, clamp, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { valueNoise } from '../../core/hash.js';
import { arrival, heroSeed, rough, ageMeters } from '../../core/front.js';
import { fbm } from '../stone/common.js';
import { grains } from '../ground/grains.js';
import { oxideCrust } from '../metal/oxide.js';
import { orangePeel } from '../ceramic/glaze.js';

const vn = valueNoise;

export function buildRust( p, fp, u, prog ) {

	const g = u.sizeM, s = u.seed;
	const q = p.div( g );
	const wq = vec2( vn( q.mul( 2.1 ).add( s ) ), vn( q.mul( 2.1 ).add( s.add( 3.3 ) ) ) ).sub( 0.5 ).mul( 0.25 );
	const S = arrival( q.add( wq ).add( s.mul( 0.53 ) ), { jitter: 0.5, delay: 0.35, len: 0.55, salt: 4 } );
	const P = arrival( q.mul( 2.5 ).add( s.mul( 1.9 ) ), { jitter: 0.8, delay: 1.6, salt: 9 } );
	const T = S.t1.min( P.t1.div( 2.5 ).add( 0.12 ) ).min( heroSeed( q, g, [ 0.17, 0.12 ] ).add( 0.05 ) )
		.add( rough( p, g, fp, { top: 0.1, amp: 0.4, oct: 11, minM: 1.5e-5, salt: 6 } ) ).toVar();
	const F = ageMeters( T, prog.mul( 0.75 ).sub( 0.08 ), g, p, fp );
	const age = F.age, W = u.frontM;

	// The scratches themselves: 0.1 to 0.25 mm wide grooves to the steel.
	const sw = vn( q.mul( 30 ).add( 2.2 ) ).mul( 1e-4 ).add( 5e-5 );
	const scratch = clamp( sw.sub( S.d.mul( g ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( sw.div( sw.max( fp.mul( 0.7 ) ) ) ).toVar();

	// Zones.
	const reached = F.aa( float( 0 ) ).toVar();
	const bW = W.mul( 0.45 );
	const lift = smoothstep( bW.negate(), float( 0 ), age ).mul( reached.oneMinus() ).toVar();
	const isleN = vn( mod( p.div( 2.5e-3 ), 4096 ).add( 7.7 ) ).add( vn( mod( p.div( 7e-4 ), 4096 ).add( 1.2 ) ).sub( 0.5 ).mul( 0.12 ) ).toVar();
	const isle = smoothstep( 0.6, 0.62, isleN ).mul( smoothstep( W.mul( 0.8 ), float( 0 ), age ) ).mul( reached );
	const rust = reached.mul( isle.oneMinus() ).max( scratch.mul( reached ) ).toVar();
	const fresh = smoothstep( W, float( 0 ), age );

	// Blisters ahead of the front.
	const Bl = grains( p, u.featureM, fp, 5.1, { gap: 0.1, radius: 0.45, round: 0.6, crown: 0.5, sizeVar: 0.6, elong: 0 } );
	const wB = fadeIn( u.featureM, fp, 1.5, 4.0 );
	const blister = Bl.body.mul( smoothstep( 0.3, 0.0, Bl.id.x.sub( lift.mul( 1.3 ) ) ) ).mul( lift ).toVar();

	// Paint.
	const OP = orangePeel( p, fp, float( 1 ) );
	const pg = vn( mod( p.div( 3e-5 ), 4096 ).add( 1.3 ) ).sub( 0.5 ).mul( fadeIn( 3e-5, fp, 2.0, 6.0 ) );
	let paint = u.color.mul( fbm( p.add( 4.4 ), float( 0.05 ), fp, 3, 2 ).mul( 0.16 ).add( 0.92 ) ).mul( pg.mul( 0.12 ).add( 1 ) );
	paint = mix( paint, paint.mul( u.color4 ).mul( 1.6 ), lift.mul( 0.2 ).add( blister.mul( Bl.h ).mul( 0.3 ) ) );
	// Rust: orange to brown, with its crust.
	const G = oxideCrust( p, fp, { rustGrainM: float( 2e-5 ) } );
	// Old rust darkens and roughens in patches; fresh orange along the front
	// and in streaks.
	const patchy = fbm( p.add( 3.1 ), float( 0.015 ), fp, 4, 3 );
	const rc = mix( mix( u.color2, u.color4.mul( 0.7 ), smoothstep( 0.4, 0.75, patchy ).mul( 0.7 ) ), u.color4, fresh.mul( 0.6 ) );
	const rustC = mix( rc, u.color2.mul( 0.45 ), G.dark ).mul( G.tone );
	const steel = u.color3.mul( vn( mod( p.div( 2e-4 ), 4096 ).add( 1.4 ) ).mul( 0.2 ).add( 0.9 ) );
	let col = mix( paint, steel, scratch.mul( reached.oneMinus() ) );
	col = mix( col, rustC, rust );
	// Shadow under the curled edge of a paint island.
	const edge = smoothstep( 0.54, 0.6, isleN ).mul( smoothstep( 0.6, 0.62, isleN ).oneMinus() ).mul( smoothstep( W.mul( 0.8 ), float( 0 ), age ) );
	col = col.mul( float( 1 ).sub( edge.mul( reached ).mul( 0.5 ) ) );

	// Relief: peel and blisters on the coat, crust on the rust, a step at
	// the front where the oxide swells past the coat.
	const coat = rust.oneMinus();
	const slope = OP.slope.mul( coat ).add( Bl.grad.mul( 0.07 ).mul( blister ).mul( wB ) )
		.add( G.slope.mul( 0.8 ).mul( rust ) )
		.mul( u.relief );
	const rgh = mix( mix( float( 0.3 ), float( 0.2 ), scratch ), mix( float( 0.75 ), float( 0.95 ), fresh ), rust );
	const s2 = OP.s2.mul( coat ).add( rust.mul( float( 1 ).sub( G.w ) ).mul( 0.08 ) ).add( lift.mul( wB.oneMinus() ).mul( 0.02 ) );
	return { color: col, slope, cavity: G.pore.mul( rust ).add( edge.mul( 0.5 ) ), rough: rgh, s2, metal: scratch.mul( reached.oneMinus() ) };

}
