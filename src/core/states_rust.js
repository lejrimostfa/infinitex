// Rust state (core/states.js): rust breaking through a coat of paint or
// spreading on bare metal. rusty_mm: spacing of the spots (about 25 mm).
//   L0  rust spots (3 to 10 mm) where water got under the coat; under each
//       spot a run-off streak washed down by the rain, 2 to 4 cm long,
//       widening and fading as it goes (it follows world down, so a top
//       face gets no streak)
//   L1  around each spot the paint blisters into bubbles of 0.4 to 1 mm,
//       lifted by the oxide; the streak shows fine vertical striations
//   L2  the oxide crust of the metal family (metal/oxide.js): knobs,
//       lumps of 80 to 200 um, grains of 15 um with dark pores
// Oxide is a dielectric: metalness drops to 0 where it lies.

import { vec2, vec3, float, floor, mix, smoothstep, step, clamp, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate, pick } from './lod.js';
import { hash3, valueNoise, wrapCoord } from './hash.js';
import { grains, fbm } from '../families/ground/grains.js';
import { oxideCrust } from '../families/metal/oxide.js';
import { blobs, over, hero } from './states_shape.js';
import { lay } from './states.js';

// Run-off streaks under the spots of blobs( p, g, share, salt ): same
// cells, same centres, so each streak starts under its spot.
function streaks( p, g, share, salt, down ) {

	const dl = down.length();
	const dn = down.div( dl.max( 1e-4 ) ), nn = vec2( dn.y.negate(), dn.x );
	const q = wrapCoord( p.div( g ).add( salt ) );
	const c0 = floor( q );
	let best = float( 0 );
	for ( let oy = - 2; oy <= 2; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const cid = c0.add( vec2( ox, oy ) );
		const h = hash3( cid ), h2 = hash3( cid.add( 7.1 ) );
		const v = q.sub( cid.add( 0.5 ).add( h.xy.sub( 0.5 ).mul( 0.7 ) ) );
		const along = v.dot( dn ), across = v.dot( nn );
		const L = h.z.mul( 1.2 ).add( 0.8 );
		const w = h.z.mul( h.z ).mul( 0.14 ).add( 0.06 ).mul( along.max( 0 ).mul( 0.6 ).add( 1 ) );
		const striae = valueNoise( vec2( across.div( 0.012 ), along.mul( 3 ) ).add( h2.yz.mul( 50 ) ) );
		const k = float( 1 ).sub( clamp( along.div( L ), 0, 1 ) ).pow( 1.2 ).mul( step( 0, along ) )
			.mul( smoothstep( w, w.mul( 0.2 ), across.abs() ) ).mul( striae.mul( 0.7 ).add( 0.3 ) ).mul( step( h2.x, share ) );
		best = best.max( k ).toVar();

	}

	return best.mul( smoothstep( 0.15, 0.6, dl ) );

}

export function buildRustState( nodes, ctx ) {

	const { p, fp, s, down } = ctx;
	const g = s.rustM, share = s.rusty.mul( 0.7 );
	const B = over( blobs( p, fp, g, share, 1.9, { rMin: 0.06, rMax: 0.2, wobble: 0.6 } ), hero( p, fp, vec2( 0.152, 0.1535 ), 0.004, [ 0.5, 0.5, 0.5 ], 0.6 ) );
	const bcov = B.cov.toVar(), rho = B.rho.toVar(), rad = B.rad.toVar();
	// Not gated: `down` comes from the tangent frame, which three derives
	// from screen derivatives on a mesh without tangents, and no derivative
	// may run inside a branch.
	const run = streaks( p, g, share, 1.9, down ).mul( bcov.oneMinus() ).toVar();
	// Blister ring: 0 at the spot edge, out to 0.8 R.
	const ringD = B.sd.negate().div( B.R.mul( 1.4 ) );
	const ring = smoothstep( 1.0, 0.2, ringD ).mul( step( 0, ringD ) ).toVar();
	// L1 bubbles, gated on their fade wB.
	const Bu = gate( fadeOn( float( 7e-4 ), fp, 1.5 ), { bubble: 0, crown: 0, slope: [ 0, 0 ] }, () => {

		const Gb = grains( p, float( 6e-4 ), fp, 3.3, { gap: 0.06, radius: 0.46, round: 0.8, crown: 0.6, sizeVar: 0.6 } );
		const wB = fadeIn( float( 7e-4 ), fp, 1.5, 4.0 );
		const bubble = Gb.body.mul( step( Gb.id.x, ring ) ).mul( wB ).toVar();
		// Bubbles: lifted paint, cracked at the top where the oxide shows.
		const crown = smoothstep( 0.5, 0.95, Gb.h ).mul( bubble ).mul( step( 0.5, Gb.id.y ) );
		return { bubble, crown, slope: Gb.grad.mul( bubble ).mul( 0.07 ) };

	}, [ p, fp, ring ] );
	const bubble = Bu.bubble;

	// Streak and ring tint the paint: orange-brown, dulled.
	const stain = run.mul( 0.95 ).max( ring.mul( 0.5 ) ).max( bubble.mul( 0.4 ) ).mul( fbm( p.div( 0.004 ), 2 ).mul( 0.5 ).add( 0.6 ) ).min( 1 );
	nodes.colorNode = mix( nodes.colorNode, nodes.colorNode.mul( 0.3 ).add( s.rustColor.mul( 0.6 ) ), stain );
	nodes.roughnessNode = mix( nodes.roughnessNode, float( 0.7 ), stain.mul( 0.7 ) );
	if ( nodes.clearcoatNode ) nodes.clearcoatNode = nodes.clearcoatNode.mul( stain.oneMinus() );

	// The spot: oxide crust, orange to near black, pits. lay() weighs its
	// colour and the slope below by cov: gated on cov > 0, and the crust
	// on the widest fade of oxideCrust (its knobs, 6e-4 from 2 px). Off,
	// the crust's tone is 1, its dark share and slope 0.
	const cov = bcov.max( Bu.crown.mul( 0.9 ) ).toVar();
	const Sp = gate( cov.greaterThan( 0 ), { col: { node: vec3( 0 ), size: 3 }, slope: [ 0, 0 ] }, () => {

		const G = gate( fadeOn( 6e-4, fp, 2.0 ), { tone: 1, dark: 0, slope: [ 0, 0 ] }, () => oxideCrust( p, fp, { rustGrainM: float( 1.5e-5 ) } ), [ p, fp ] );
		const n = valueNoise( p.div( g.mul( 0.05 ) ).add( 3.7 ) );
		const ochre = s.rustColor.mul( vec3( 1.25, 1.1, 0.6 ) );
		let col = mix( mix( s.rustColor, ochre, smoothstep( 0.6, 0.9, n ).mul( 0.5 ) ), s.rustColor.mul( vec3( 0.3, 0.22, 0.18 ) ), smoothstep( 0.85, 0.2, rho ).mul( 0.85 ) );
		col = mix( col, s.rustColor.mul( 0.2 ), G.dark ).mul( G.tone );
		const slope = pick( step( 0.5, bcov ), G.slope.add( rad.mul( smoothstep( 0.7, 1.0, rho ) ).mul( 0.25 ) ), G.slope.mul( 0.5 ) ).mul( cov );
		return { col, slope };

	}, [ p, fp, bcov, rho, rad, cov ] );
	const slope = Sp.slope.add( Bu.slope )
		.add( vec2( 0, valueNoise( p.div( vec2( 1.5e-4, 3e-3 ) ) ).sub( 0.5 ).mul( 0.15 ) ).mul( run ).mul( fadeIn( float( 1.5e-4 ), fp, 2.0, 6.0 ) ) );
	return lay( nodes, ctx, { cov, color: Sp.col, rough: float( 0.92 ), slope, hide: float( 0.9 ) } );

}
