// Frosted state (core/states.js): hoar frost grown on a cold matter in a
// clear night (a coat, a scarf, a wooden rail). frosted_um: crystal size.
//   L0  frost grows where the surface radiates to the sky: tops of the
//       relief and faces turned up get more; it lies in patches of a few
//       cm and whitens the matter by its mean cover
//   L1  ice plates of frosted_um (0.1 to 0.5 mm), flat hexagonal facets
//       at random tilts that glint one by one (roughness 0.12)
//   L2  needles and feathers between the plates, 15 to 30 um thick and
//       up to 1 mm long, straight (needles grow along the c-axis,
//       Libbrecht 2005)
// Ice is clear: thin crystals tint the matter blue-white, piled crystals
// scatter white. It buries the fibre sheen.

import { vec3, float, mix, smoothstep, step, normalWorld } from 'three/tsl';
import { fadeIn, fadeOn, gate } from './lod.js';
import { grains, fibres, fbm } from '../families/ground/grains.js';
import { lay } from './states.js';

export function buildFrost( nodes, ctx ) {

	const { p, fp, s, cavity } = ctx;
	const g = s.frostM;
	// L0 where it grows.
	const up = smoothstep( - 0.6, 1.0, normalWorld.y ).mul( 0.6 ).add( 0.55 );
	const patch = smoothstep( 0.2, 0.8, fbm( p.div( 0.05 ).add( s.seed.mul( 3.1 ) ), 3 ) ).mul( 0.3 ).add( 0.7 );
	const top = float( 1 ).sub( cavity.mul( 0.75 ) );
	const den = s.frosted.mul( patch ).mul( up ).mul( top ).min( 1 ).toVar();

	// L1 plates, two layers so they overlap like a real rime, and L2
	// needles. One gate on the widest fade (w1, the big plates, from 1.5
	// px): every use of a crystal is weighted by on1, on2 or the needle,
	// which carry their fades. Off: no crystal, no edge, no tone, no slope.
	const w1 = fadeIn( g.mul( 0.6 ), fp, 1.5, 4.0 ).toVar();
	const X = gate( fadeOn( g.mul( 0.6 ), fp, 1.5 ), { on1: 0, on2: 0, needle: 0, edge: 0, tone: 0, slope: [ 0, 0 ] }, () => {

		const P1 = grains( p, g, fp, 2.7, { gap: 0.18, radius: 0.36, round: 0.12, crown: 0.0, elong: 2.0, tilt: 1.3, sizeVar: 0.8 } );
		const P2 = grains( p, g.mul( 0.55 ), fp, 5.3, { gap: 0.2, radius: 0.34, round: 0.12, crown: 0.0, elong: 2.0, tilt: 1.3 } );
		const w2 = fadeIn( g.mul( 0.35 ), fp, 1.5, 4.0 );
		const on1 = P1.body.mul( step( P1.id.x, den.mul( 0.35 ) ) ).mul( w1 ).toVar();
		const on2 = P2.body.mul( step( P2.id.x, den.mul( 0.3 ) ) ).mul( w2 ).mul( on1.oneMinus() ).toVar();
		const N = fibres( p, g.mul( 1.6 ), g.mul( 0.05 ), den.mul( 0.5 ), fp, 8.3, 0.04 );
		const wN = fadeIn( g.mul( 0.1 ), fp, 1.0, 3.0 );
		return {
			on1, on2, needle: N.fiber.mul( wN ),
			edge: smoothstep( 0.6, 0.0, P1.h ).mul( on1 ).max( smoothstep( 0.6, 0.0, P2.h ).mul( on2 ) ),
			tone: P1.id.y.mul( on1 ).add( P2.id.y.mul( on2 ) ),
			slope: P1.grad.mul( on1 ).add( P2.grad.mul( on2 ) ).mul( 0.7 ).add( N.slope.mul( wN ).mul( 0.6 ) ),
		};

	}, [ p, fp, den, w1 ] );
	const { on1, on2, needle } = X;

	// Mean cover of what is too small to see: the rime haze.
	const haze = den.mul( 0.22 ).mul( w1.oneMinus().mul( 0.75 ).add( 0.25 ) );
	const crystal = on1.max( on2 ).max( needle ).toVar();
	const cov = haze.max( crystal ).min( 1 ).toVar();
	// Thin plates are clear: they tint; edges and piles scatter white.
	const edge = X.edge;
	const clear = mix( nodes.colorNode.mul( vec3( 0.85, 0.95, 1.1 ) ).add( s.frostColor.mul( 0.35 ) ), s.frostColor, edge.mul( 0.7 ).add( 0.15 ) );
	const tone = X.tone.mul( 0.25 ).add( 0.85 );
	let color = mix( s.frostColor.mul( 0.88 ), clear.mul( tone ), on1.max( on2 ) );
	color = mix( color, s.frostColor, needle );

	const slope = X.slope;
	// Facets are smooth ice; the haze of unresolved crystals is matt but
	// sparkles, so its roughness stays mid.
	const rough = mix( float( 0.6 ), float( 0.12 ), on1.max( on2 ) );
	return lay( nodes, ctx, { cov, color, rough, slope, hide: float( 0.7 ), sheen: 0.1 } );

}
