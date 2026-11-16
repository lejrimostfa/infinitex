// Spongy bone and sea sponge: open lattices seen through their pores.
// Spongy (trabecular) bone, a cleaned cut face:
//   L0 cut       denser and looser regions over a few cm, ivory to tan,
//                some pores still brown with dried marrow
//   L1 lattice   trabeculae: rods and plates 0.1 to 0.3 mm thick around
//                pores of size_mm (0.5 to 1.5 mm); two deeper layers show
//                through the pores, darker as the light fades in the depth
//   L2 lamellae  each trabecula is made of thin lamellae along its length
//                (a few um apart, drawn as fine lines), with osteocyte
//                lacunae (cell_um, 10 to 20 um long dark ellipses)
// Sea sponge (bath sponge, spongin skeleton):
//   L0 body      tan to honey, oscula (exhalent holes) of 3 to 10 mm,
//                dark inside, scattered
//   L1 net       a net of spongin fibres (feature_mm apart, three depths),
//                its meshes the pores
//   L2 fibres    each fibre (fiber_um, 20 to 40 um) has growth layers
//                along it and fine grains of sand stuck on
// Returns { color, slope, cavity, rough, s2 }.
//
// Sponge: past the net's fade (1.5 px per mesh) only the oscula and the
// mean colour are computed; the loose fibres and the sand grains sit in
// gate()s of their own (core/lod.js).

import { vec2, vec3, float, fract, mix, smoothstep, step } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { valueNoise } from '../../core/hash.js';
import { bubbleField, capSlope } from '../ceramic/bubbles.js';
import { fbm, band, grains, fibres } from './common.js';
import { lattice } from './lattice.js';

// Three layers of lattice, the top one in front. Returns the colour
// share of each and the slope of the visible one.
function stack( p, g, fp, o, salt ) {

	const A = lattice( p, g, fp, salt, o );
	const B = lattice( p.add( vec2( 0.31, 0.57 ).mul( g ) ), g.mul( 0.8 ), fp, salt + 13, o );
	const C = lattice( p.add( vec2( 0.73, 0.19 ).mul( g ) ), g.mul( 0.65 ), fp, salt + 29, o );
	const top = A.strut, mid = B.strut.mul( top.oneMinus() ), deep = C.strut.mul( top.oneMinus() ).mul( B.strut.oneMinus() );
	const hole = top.oneMinus().mul( B.strut.oneMinus() ).mul( C.strut.oneMinus() );
	const slope = A.slope.add( B.slope.mul( mid ).mul( 0.6 ) ).add( C.slope.mul( deep ).mul( 0.4 ) );
	return { A, B, C, top, mid, deep, hole, slope };

}

export function buildBone( p, fp, u ) {

	const s = u.seed, g = u.sizeM;
	// L0: density drifts; looser where the noise is low.
	const dens = fbm( p.add( s ), float( 0.05 ), fp, 3, 2 );
	const width = dens.mul( 0.08 ).add( 0.05 ).mul( u.density.add( 0.5 ) );
	const L = stack( p, g, fp, { width, vary: 0.7, plate: 0.25 }, 3.3 );
	const wL = fadeIn( g, fp, 1.5, 4.0 );
	const tone = fbm( p.add( 4.1 ), float( 0.02 ), fp, 3, 5 ).sub( 0.5 ).mul( u.colorVar ).add( 1 );
	const bone = u.color.mul( tone );
	// Pores: dark, some with brown marrow left in them.
	const marrow = smoothstep( 0.5, 0.75, fbm( p.add( 7.7 ), float( 0.015 ), fp, 3, 8 ) ).mul( u.blush );
	const pore = mix( u.color3, u.color2, marrow );
	let color = bone.mul( L.top ).add( bone.mul( 0.6 ).mul( L.mid ) ).add( bone.mul( 0.35 ).mul( L.deep ) ).add( pore.mul( L.hole ) );
	// Far: the mean of struts and pores.
	const meanCov = width.mul( 2.6 ).min( 0.8 );
	color = mix( mix( pore, bone, meanCov.add( 0.15 ) ), color, wL );
	// L2: lamellae along each strut, lacunae.
	const lam = band( fract( L.A.e.div( L.A.wC ).mul( 4 ).add( L.A.along.mul( 0.2 ) ) ).sub( 0.5 ), float( 0.08 ), fp.div( g.mul( L.A.wC ).mul( 0.25 ) ) )
		.mul( fadeIn( g.mul( L.A.wC ).mul( 0.25 ), fp, 3.0, 8.0 ) ).mul( L.top );
	const La = grains( vec2( L.A.along.mul( g ), L.A.e.mul( g ).mul( 2.5 ) ), u.cellM, fp, 6.1, { gap: 0.25, radius: 0.3, round: 0.4, elong: 0.2 } );
	const lac = La.body.mul( step( 0.7, La.id.x ) ).mul( L.top ).mul( fadeIn( u.cellM, fp, 2.0, 5.0 ) );
	color = color.mul( float( 1 ).sub( lam.mul( 0.08 ) ) ).mul( float( 1 ).sub( lac.mul( 0.5 ) ) );
	const slope = L.slope.mul( wL ).mul( u.relief );
	const cavity = L.hole.mul( wL ).add( wL.oneMinus().mul( 0.4 ) ).max( L.deep.mul( 0.6 ) );
	const s2 = wL.oneMinus().mul( 0.1 ).mul( u.relief );
	return { color, slope, cavity, rough: u.roughness, s2 };

}

export function buildSponge( p, fp, u ) {

	const s = u.seed, g = u.featureM;
	const tone = fbm( p.add( s ), float( 0.04 ), fp, 4, 3 ).sub( 0.5 ).mul( u.colorVar ).add( 1 );
	const col = mix( u.color, u.color2, fbm( p.add( 2.2 ), float( 0.015 ), fp, 3, 6 ) ).mul( tone ).toVar();
	const meanCol = mix( u.color3, col, 0.62 ).toVar();
	// L0: oscula, round dark holes with a lip.
	const O = bubbleField( p, fp, u.sizeM, u.density, 7 );
	const osc = O.inside;
	const lip = smoothstep( 0.8, 1.0, O.d ).mul( smoothstep( 1.25, 1.0, O.d ) ).mul( O.on );
	// Loose curly fibres lie on top here and there. They fade out under
	// 0.7 px of fiberM (fibres(): wide).
	const F = gate( fadeOn( u.fiberM, fp, 0.7 ), { fiber: 0, slope: [ 0, 0 ] }, () => {

		const R = fibres( p, g.mul( 1.5 ), u.fiberM.mul( 0.5 ), float( 0.35 ), fp, 9.9, 0.8 );
		return { fiber: R.fiber, slope: R.slope };

	}, [ p, fp ] );
	const fiber = F.fiber.toVar();
	// L1 and L2, skipped past the net's fade (1.5 px per mesh) while the
	// growth layers and the sand weigh 0 too (from 3 and 4 px of fiberM):
	// then the colour is the mean.
	const N = gate( fadeOn( g, fp, 1.5 ).or( fadeOn( u.fiberM, fp, 3.0 ) ), { net: { node: meanCol, size: 3 }, glTop: 1, sand: 0, sandTone: 0, slope: [ 0, 0 ], cav: 0.45, wL: 0 }, () => {

		// L1: the fibre net, three depths. Width from the fibre size.
		const wid = u.fiberM.div( g ).mul( 0.5 );
		const L = stack( p, g, fp, { width: wid, vary: 0.5, plate: 0.05, jitter: 1 }, 5.5 );
		const wL = fadeIn( g, fp, 1.5, 4.0 );
		const top = L.top.max( fiber ).toVar();
		const net = col.mul( top ).add( col.mul( 0.55 ).mul( L.mid.mul( fiber.oneMinus() ) ) ).add( col.mul( 0.3 ).mul( L.deep.mul( fiber.oneMinus() ) ) )
			.add( u.color3.mul( L.hole.mul( fiber.oneMinus() ) ) );
		// L2: growth layers along each fibre, grains of sand.
		const gl = valueNoise( vec2( L.A.along.mul( 12 ), L.A.e.div( L.A.wC ).mul( 3 ) ) ).sub( 0.5 ).mul( 0.25 ).mul( fadeIn( u.fiberM, fp, 3.0, 8.0 ) );
		const Sd = gate( fadeOn( u.fiberM.mul( 0.5 ), fp, 2.0 ), { sand: 0, tone: 0, grad: [ 0, 0 ] }, () => {

			const G = grains( p, u.fiberM.mul( 0.5 ), fp, 3.7, { gap: 0.3, radius: 0.3, round: 0.4, crown: 0.6 } );
			return { sand: G.body.mul( step( 0.8, G.id.x ) ).mul( top ).mul( fadeIn( u.fiberM.mul( 0.5 ), fp, 2.0, 5.0 ) ), tone: G.id.y, grad: G.grad };

		}, [ p, fp, top ] );
		return {
			net: mix( meanCol, net, wL ), glTop: gl.mul( top ).add( 1 ), sand: Sd.sand, sandTone: Sd.tone,
			slope: L.slope.mul( wL ).add( Sd.grad.mul( 0.4 ).mul( Sd.sand ) ),
			cav: L.hole.mul( wL ).add( wL.oneMinus().mul( 0.45 ) ), wL,
		};

	}, [ p, fp, col, meanCol, fiber ] );
	let color = mix( N.net, u.color3.mul( 0.5 ), osc.mul( 0.85 ) ).mul( lip.mul( 0.15 ).add( 1 ) );
	color = color.mul( N.glTop );
	color = mix( color, vec3( 0.75, 0.7, 0.6 ).mul( N.sandTone.mul( 0.3 ).add( 0.8 ) ), N.sand.mul( 0.8 ) );
	const slope = N.slope.add( F.slope.mul( 0.5 ) ).add( capSlope( O.v, O.d ).mul( - 0.4 ).mul( osc ).mul( O.fade ) ).mul( u.relief );
	const cavity = N.cav.max( osc );
	return { color, slope, cavity, rough: u.roughness, s2: N.wL.oneMinus().mul( 0.12 ).mul( u.relief ) };

}
