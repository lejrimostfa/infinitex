// Soil states: dust and mud laid over any matter (core/states.js).
// Dust (dusty, dusty_um = mean mote size, about 40 um):
//   L0  dust falls, so faces turned up hold more; it drifts in patches of
//       a few cm and fills the grooves of the matter; a clean disc shows
//       where a vase stood (7 cm), with a soft rim of dust pushed aside
//   L1  grit (8 x mote, 0.3 mm), lint fibres (10 to 20 um thick, mm long)
//       and a few hairs (70 um thick, cm long)
//   L2  the motes: mineral specks, pale skin flakes; dust kills the gloss
// Mud (muddy, muddy_mm = splash spacing, about 30 mm):
//   L0  splashes thrown one way: big blobs and satellite drops, a dark wet
//       halo where the matter drank the water around each blob
//   L1  thick blobs dry from the rim (pale) and crack into plates of
//       2 to 3 mm; some are still wet at heart (dark, glossy)
//   L2  sand grains (0.25 mm, some glinting quartz) in a silt of 30 um
// Grains, fibres and fbm come from the ground family (ground/grains.js).

import { vec2, vec3, float, mix, smoothstep, step, clamp, normalWorld, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate } from './lod.js';
import { valueNoise } from './hash.js';
import { voronoi } from './voronoi.js';
import { grains, fibres, fbm, line } from '../families/ground/grains.js';
import { blobs, over, hero } from './states_shape.js';
import { lay } from './states.js';

// One layer of motes at cellM. Gated (core/lod.js): the grains run only
// while their fade w is above zero, and every use of them is weighted by w.
//   cw     cover x fade      col   the colour they show (look( G ))
//   slope  their bump, k x grad x cover x fade
const specks = ( p, cellM, fp, share, salt, k, look ) => {

	const w = fadeIn( cellM.mul( 0.5 ), fp, 1.0, 3.0 ).toVar();
	const S = gate( fadeOn( cellM.mul( 0.5 ), fp, 1.0 ), { cw: 0, col: { node: vec3( 0 ), size: 3 }, slope: [ 0, 0 ] }, () => {

		const G = grains( p, cellM, fp, salt, { gap: 0.1, radius: 0.42, round: 0.3, crown: 0.6, elong: 1.4, tilt: 0.6 } );
		const cover = G.body.mul( step( G.id.x, share ) );
		return { cw: cover.mul( w ), col: look( G ), slope: G.grad.mul( cover ).mul( w ).mul( k ) };

	}, [ p, fp, share, w ] );
	return { ...S, w };

};

export function buildDust( nodes, ctx ) {

	const { p, fp, s, cavity } = ctx;
	const g = s.dustM;
	const up = smoothstep( - 0.3, 1.0, normalWorld.y ).mul( 0.9 ).add( 0.45 );
	const drift = smoothstep( 0.25, 0.75, fbm( p.div( 0.06 ).add( s.seed ), 3 ) ).mul( 0.65 ).add( 0.35 )
		.mul( smoothstep( 0.2, 0.6, fbm( p.div( 0.012 ).add( 3.3 ), 2 ) ).mul( 0.4 ).add( 0.6 ) );
	// The vase: a clean disc, dust pushed into a soft ring around it.
	const r = p.sub( vec2( 0.2, 0.1 ) ).length().add( fbm( p.div( 0.004 ), 2 ).sub( 0.5 ).mul( 0.002 ) );
	const clean = smoothstep( 0.0352, 0.0345, r );
	const ring = smoothstep( 0.041, 0.036, r ).mul( clean.oneMinus() );
	const den = s.dusty.mul( drift ).mul( up ).mul( clean.oneMinus() ).mul( ring.mul( 0.8 ).add( 1 ) )
		.add( cavity.mul( 0.35 ).mul( s.dusty ) ).min( 1 ).toVar();

	const tone = ( G ) => mix( s.dustColor, s.dustColor.mul( vec3( 1.25, 1.22, 1.18 ) ), G.id.y ).mul( G.id.z.mul( 0.6 ).add( 0.6 ) );
	const M = specks( p, g, fp, den, 3.3, 0.3, tone );
	const F = specks( p, g.mul( 3 ), fp, den.mul( 0.5 ).toVar(), 7.1, 0.4,
		( G ) => mix( tone( G ), s.dustColor.mul( 1.4 ), step( 0.75, G.id.y ).mul( 0.7 ) ) );
	const C = specks( p, g.mul( 12 ), fp, den.mul( 0.25 ).toVar(), 11.9, 0.6, ( G ) => tone( G ).mul( 0.65 ) );
	// Haze: what the unresolved motes add, by their mean cover. Its grain
	// is gated on its own fade.
	const gq = p.div( g.mul( 3 ) ).add( 2.2 ).toVar(); // lattice coordinates, taken before the gate
	const grain = gate( fadeOn( g.mul( 3 ), fp, 2.0 ), { v: 0 }, () => ( { v: fbm( gq, 2 ).mul( fadeIn( g.mul( 3 ), fp, 2.0, 6.0 ) ) } ), [ gq, fp ] );
	const grainy = grain.v.sub( 0.5 ).mul( 0.8 ).add( 1 );
	const haze = den.mul( 0.6 ).mul( M.w.oneMinus().mul( 0.6 ).add( 0.4 ) ).mul( grainy ).min( 1 );
	let color = mix( nodes.colorNode, s.dustColor.mul( 0.85 ), haze );
	color = mix( color, M.col, M.cw.mul( 0.8 ) );
	color = mix( color, F.col, F.cw.mul( 0.85 ) );
	color = mix( color, C.col, C.cw );
	// Lint (thin, curly, some dyed) and hairs. Gated on their fades: the
	// lint on wT (from 1 px), the hairs on the fibre's own width fade.
	const T = gate( fadeOn( g.mul( 0.7 ), fp, 1.0 ), { fw: 0, col: { node: vec3( 0 ), size: 3 }, slope: [ 0, 0 ] }, () => {

		const T = fibres( p, g.mul( 40 ), g.mul( 0.35 ), den.mul( 0.6 ), fp, 5.5, 0.6 );
		const wT = fadeIn( g.mul( 0.7 ), fp, 1.0, 3.0 );
		const col = mix( s.dustColor.mul( 1.3 ), mix( vec3( 0.12, 0.2, 0.5 ), vec3( 0.5, 0.1, 0.1 ), step( 0.9, T.tone ) ), step( 0.8, T.tone ) );
		return { fw: T.fiber.mul( wT ), col, slope: T.slope.mul( wT ).mul( 0.6 ) };

	}, [ p, fp, den ] );
	color = mix( color, T.col, T.fw.mul( 0.85 ) );
	const H = gate( fadeOn( g.mul( 0.9 ).mul( 2 ), fp, 0.7 ), { fiber: 0, col: { node: vec3( 0 ), size: 3 }, slope: [ 0, 0 ] }, () => {

		const H = fibres( p, g.mul( 600 ), g.mul( 0.9 ), den.mul( 0.15 ), fp, 9.4, 0.3 );
		return { fiber: H.fiber, col: mix( vec3( 0.03, 0.022, 0.016 ), s.dustColor.mul( 0.9 ), step( 0.6, H.tone ) ), slope: H.slope.mul( 0.8 ) };

	}, [ p, fp, den ] );
	color = mix( color, H.col, H.fiber );
	nodes.colorNode = color;

	const slope = M.slope.add( F.slope ).add( C.slope ).add( T.slope ).add( H.slope );
	const any = haze.max( M.cw ).max( F.cw ).max( C.cw ).max( T.fw ).max( H.fiber ).min( 1 );
	return lay( nodes, ctx, { cov: any, rough: float( 0.85 ), slope, hide: float( 0.2 ) } );

}

export function buildMud( nodes, ctx ) {

	const { p, fp, s } = ctx;
	const g = s.mudM;
	const zone = smoothstep( 0.3, 0.7, fbm( p.div( 0.08 ).add( s.seed.mul( 1.7 ) ), 2 ) ).mul( 0.6 ).add( 0.4 );
	const share = s.muddy.mul( zone );
	// Splashes thrown upward and a little sideways; satellites smaller.
	const A = over( blobs( p, fp, g, share.mul( 0.8 ), 2.3, { rMin: 0.12, rMax: 0.55, wobble: 0.45, elong: 1.2, angle: 1.35 } ), hero( p, fp, vec2( 0.158, 0.149 ), 0.007, [ 0.7, 0.8, 0.9 ], 0.5 ) );
	const S = blobs( p, fp, g.mul( 0.22 ), share.mul( 0.7 ), 6.1, { rMin: 0.08, rMax: 0.3, wobble: 0.2, elong: 1.5, angle: 1.35 } );
	const top = step( S.sd, A.sd );
	const sd = A.sd.max( S.sd ).toVar();
	// The edge frays at 0.2 mm: grains and silt left at the splash front.
	const fray = valueNoise( p.div( 1.5e-4 ).add( 3.9 ) ).sub( 0.5 ).mul( 3e-4 );
	const cov = clamp( sd.add( fray ).div( fp ).add( 0.5 ), 0, 1 ).toVar();
	const B = { rho: mix( S.rho, A.rho, top ).toVar(), id: mix( S.id, A.id, top ).toVar(), rad: mix( S.rad, A.rad, top ).toVar(), R: mix( S.R, A.R, top ).toVar() };
	const { rho, id, rad, R } = B;
	// Thickness: thin rim, thicker heart, big blobs thicker.
	const thick = smoothstep( 1.0, 0.35, B.rho ).mul( B.id.z.mul( 0.6 ).add( 0.4 ) ).mul( smoothstep( 0.002, 0.008, R ).mul( 0.6 ).add( 0.4 ) ).toVar();
	// Halo: the matter drank the water, 1 to 4 mm around each blob.
	const halo = smoothstep( R.mul( - 0.35 ).min( - 0.001 ), float( 0 ), sd ).mul( cov.oneMinus() ).mul( 0.8 );
	nodes.colorNode = nodes.colorNode.mul( mix( float( 1 ), float( 0.55 ), halo ) );
	nodes.roughnessNode = mix( nodes.roughnessNode, nodes.roughnessNode.mul( 0.6 ), halo );

	// The mud itself (colour, roughness, relief) only shows where it lies:
	// lay() weighs all three by cov, so the block is gated on cov > 0, and
	// each finer level inside it on its own fade.
	const L = gate( cov.greaterThan( 0 ), { color: { node: vec3( 0 ), size: 3 }, rough: 0, slope: [ 0, 0 ] }, () => {

		// Wet at heart for some blobs; dry rims pale.
		const wet = step( id.y, 0.45 ).mul( smoothstep( 0.75, 0.2, rho ) ).toVar();
		let color = mix( s.mudColor.mul( 1.35 ), s.mudColor, thick ).mul( id.x.mul( 0.3 ).add( 0.85 ) );
		color = mix( color, s.mudColor.mul( 0.45 ), wet.mul( 0.8 ) );
		// L1 craquelure of the dry thick crust, gated on its fade wC.
		const dry = thick.mul( wet.oneMinus() ).mul( smoothstep( 0.35, 0.6, thick ) ).toVar();
		const K = gate( fadeOn( g.mul( 0.08 ), fp, 2.0 ), { crack: 0, plate: 0, slope: [ 0, 0 ] }, () => {

			const wC = fadeIn( g.mul( 0.08 ), fp, 2.0, 6.0 );
			const V = voronoi( mod( p.div( g.mul( 0.08 ) ), 4096 ).add( 4.4 ), 0.85 );
			// Cracks open wider where the crust is thicker; each plate its own tone.
			const cw = g.mul( 0.004 ).mul( valueNoise( p.div( g.mul( 0.03 ) ).add( 2.2 ) ).mul( 1.2 ).add( 0.2 ) ).mul( thick );
			return {
				crack: line( V.edge.mul( g.mul( 0.08 ) ), cw, fp ).mul( dry ).mul( wC ),
				plate: valueNoise( V.id1.mul( 0.61 ) ).sub( 0.5 ).mul( 0.25 ).mul( dry ).mul( wC ),
				slope: V.dir.mul( smoothstep( 0.1, 0.0, V.edge ) ).mul( 0.35 ).mul( dry ).mul( wC ),
			};

		}, [ p, fp, thick, dry ] );
		color = color.mul( K.plate.add( 1 ) ).mul( float( 1 ).sub( K.crack.mul( 0.75 ) ) );
		// L2 sand and silt, each gated on its fade.
		const G = gate( fadeOn( float( 2.5e-4 ), fp, 1.5 ), { sand: 0, quartz: 0, slope: [ 0, 0 ] }, () => {

			const Gs = grains( p, float( 2.5e-4 ), fp, 8.8, { gap: 0.25, radius: 0.33, round: 0.3, crown: 0.6, tilt: 0.5 } );
			const sand = Gs.body.mul( step( 0.7, Gs.id.x ) ).mul( fadeIn( float( 2.5e-4 ), fp, 1.5, 4.0 ) );
			return { sand, quartz: step( 0.6, Gs.id.y ), slope: Gs.grad.mul( sand ).mul( 0.6 ) };

		}, [ p, fp ] );
		color = mix( color, mix( s.mudColor.mul( 1.6 ), vec3( 0.62, 0.58, 0.52 ), G.quartz ), G.sand.mul( 0.8 ) );
		const S = gate( fadeOn( float( 3e-5 ), fp, 2.0 ), { tone: 0, slope: [ 0, 0 ] }, () => {

			const wS = fadeIn( float( 3e-5 ), fp, 2.0, 6.0 );
			const silt = fbm( p.div( 3e-5 ), 2 );
			return {
				tone: silt.sub( 0.5 ).mul( 0.9 ).mul( wS ),
				slope: vec2( valueNoise( p.div( 3e-5 ).add( 1.3 ) ), valueNoise( p.div( 3e-5 ).add( 6.1 ) ) ).sub( 0.5 ).mul( 0.5 ).mul( wS ),
			};

		}, [ p, fp ] );
		color = color.mul( S.tone.add( 1 ) )
			.mul( fbm( p.div( 0.004 ).add( 5.1 ), 2 ).sub( 0.5 ).mul( 0.3 ).add( 1 ) );
		const N = gate( fadeOn( float( 4e-4 ), fp, 2.0 ), { slope: [ 0, 0 ] }, () => ( {
			slope: vec2( valueNoise( p.div( 4e-4 ) ), valueNoise( p.div( 4e-4 ).add( 7.7 ) ) ).sub( 0.5 ).mul( 0.3 ).mul( fadeIn( float( 4e-4 ), fp, 2.0, 6.0 ) ),
		} ), [ p, fp ] );

		// Relief: a soft dome per blob (0.3 to 1 mm high), plates, grains.
		const k = id.z.mul( 0.25 ).add( 0.2 );
		const slope = rad.mul( smoothstep( 0.5, 1.0, rho ).mul( k ).mul( - 1.5 ) ).mul( fadeIn( R, fp, 2.0, 6.0 ) )
			.add( K.slope ).add( G.slope ).add( S.slope ).add( N.slope )
			.mul( cov );
		const rough = mix( float( 0.88 ), float( 0.22 ), wet ).sub( G.sand.mul( G.quartz ).mul( 0.4 ) );
		return { color, rough, slope };

	}, [ p, fp, cov, rho, id, rad, R, thick ] );
	return lay( nodes, ctx, { cov, color: L.color, rough: L.rough, slope: L.slope, hide: thick.mul( 0.6 ).add( 0.4 ) } );

}
