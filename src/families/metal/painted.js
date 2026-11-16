// Metal mode `painted`: steel with a red oxide primer and a top coat.
//   L0 coat:     the colour, chalked a little by the sun in broad patches
//   L1 chips:    impacts knocked the coat off in ragged chips of about
//                chip_mm. Each chip shows its layers: a band of primer at
//                the rim (the coats are 90 um and 30 um thick, so the rim
//                is a double step), then bare steel. Around the chip, rust
//                creeps under the paint: the coat lifts and turns brown
//   L2 orange peel: the sprayed coat dried before it levelled, leaving
//                soft dimples 1 to 2 mm wide that ripple the reflections
//   L3 scratches: lines through the coat that show the primer
//   L4 microns:  pigment speckle in the coat, dust grains caught in it,
//                solvent pops (small craters); oxide grains in the rust
// The coat is a dielectric; only the bare steel is metallic.
//
// The orange peel and the microns sit in gate()s (core/lod.js) and run only
// where they show. The scratches run only where some coat is left, the
// oxide crust only where the bare steel rusts.

import { vec2, vec3, float, floor, smoothstep, step, mix, mod, clamp } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { marks } from './scratch.js';
import { oxideCrust } from './oxide.js';

const vn = valueNoise;
const aa = ( d, fp ) => clamp( d.div( fp ).add( 0.5 ), 0, 1 );

// One round speck per cell, present with probability `presence`, radius
// 0.04 to 0.08 cells: a dust grain (bump) or a solvent pop (crater).
// q: p / cellM + seed, taken by the caller before its gate.
function specks( q, fp, cellM, presence ) {

	const qc = mod( floor( q ), 4096 );
	const qh = hash3( qc );
	const qv = q.sub( floor( q ) ).sub( qh.xy.sub( 0.5 ).mul( 0.6 ).add( 0.5 ) );
	const R = qh.z.mul( 0.04 ).add( 0.04 );
	const t = float( 1 ).sub( qv.dot( qv ).div( R.mul( R ) ) ).max( 0 );
	const on = step( hash1( qc.add( 2.1 ) ), presence ).mul( fadeIn( cellM.mul( R ), fp, 1.5, 4.0 ) );
	return { cov: smoothstep( 0.0, 0.3, t ).mul( on ), slope: qv.mul( t.div( R ).mul( 0.6 ) ).mul( on ) };

}

export function buildPainted( p, fp, u ) {

	const C = u.chipM;
	// L1 chips: a fractal field; chipped where it passes a threshold. Its
	// gradient (finite differences, 10 um apart) turns the field into a
	// distance in meters, so edges are anti-aliased by the footprint and
	// the rim relief is smooth per pixel.
	const field = ( q ) => vn( q.div( C.mul( 3 ) ).add( u.seed.mul( 2.1 ) ) ).mul( 0.5 ).add( vn( q.div( C ).add( 3.3 ) ).mul( 0.3 ) )
		.add( vn( q.div( C.mul( 0.3 ) ).add( 7.1 ) ).mul( 0.13 ) ).add( vn( q.div( C.mul( 0.08 ) ).add( 1.9 ) ).mul( 0.07 ) );
	const pn = field( p ).toVar();
	const D = 1e-5;
	const g = vec2( field( p.add( vec2( D, 0 ) ) ), field( p.add( vec2( 0, D ) ) ) ).sub( pn ).div( D ).toVar();
	const gl = g.length().max( 1 );
	const th = float( 0.8 ).sub( u.chips.mul( 0.32 ) );
	const dz = pn.sub( th ).toVar();
	const dm = dz.div( gl ).toVar(), dm2 = dz.sub( 0.025 ).div( gl ).toVar(); // meters into the chip, past the primer band
	const chip = aa( dm, fp ).toVar(); // coat gone
	const bare = aa( dm2, fp ).toVar(); // primer gone too
	// Relief: the rim is bevelled over about 60 um; coat 90 um, primer 30 um.
	const bev = fp.max( 6e-5 );
	const ramp = ( x ) => clamp( x.div( bev ).mul( 0.5 ).add( 0.5 ), 0, 1 );
	const dRamp = ( x ) => { const t = ramp( x ); return t.mul( t.oneMinus() ).mul( 3 ).div( bev ); };
	// Rust creep: a band outside the chip where the coat has lifted.
	const creepW = u.creep.mul( 0.05 ).add( 1e-3 );
	const creepN = vn( p.div( C.mul( 0.15 ) ).add( 4.4 ) );
	const cLo = creepW.negate().mul( creepN.mul( 0.8 ).add( 0.6 ) );
	const creep = smoothstep( cLo, float( - 0.003 ), dz ).mul( float( 1 ).sub( chip ) ).mul( step( 0.001, u.creep ) ).toVar();
	const ct = clamp( dz.sub( cLo ).div( cLo.negate() ), 0, 1 );
	const dCreep = ct.mul( ct.oneMinus() ).mul( 6 ).div( cLo.negate() ).mul( float( 1 ).sub( chip ) ).mul( step( 0.001, u.creep ) ); // per field unit
	const sRim = g.div( gl ).mul( dRamp( dm ).mul( - 9e-5 ).sub( dRamp( dm2 ).mul( 3e-5 ) ) )
		.add( g.mul( dCreep.mul( creepN ).mul( 2.5e-5 ) ) );
	// Rust on the bare steel: patches, and along the primer edge.
	const rustOn = bare.mul( clamp( smoothstep( 0.3, 0.6, vn( p.div( C.mul( 0.35 ) ).add( 5.2 ) ) ).add( smoothstep( 0.06, 0.0, dz.sub( 0.025 ) ) ), 0, 1 ) )
		.mul( u.creep.mul( 0.8 ).add( 0.2 ) ).toVar();
	const wC = fadeIn( C.mul( 0.3 ), fp, 1.0, 4.0 );

	// L2 orange peel, two octaves, and the blisters of the creep band.
	// Widest fade: the peel (1.4 mm, from 2 px).
	const wOP = fadeIn( 1.4e-3, fp, 2.0, 6.0 ).toVar();
	const OP = gate( fadeOn( 1.4e-3, fp, 2.0 ), { sOP: [ 0, 0 ], sBlister: [ 0, 0 ] }, () => {

		const oq = p.div( 1.4e-3 ).add( 2.7 );
		const op = vec2( vn( oq ), vn( oq.add( 5.2 ) ) ).sub( 0.5 ).add( vec2( vn( oq.mul( 2.9 ).add( 1.1 ) ), vn( oq.mul( 2.9 ).add( 8.3 ) ) ).sub( 0.5 ).mul( 0.4 ) );
		// A finer ripple, 0.35 mm, and the blisters: the coat lifts over the
		// rust. Widest fade: the blisters (0.5 mm, from 2 px).
		const F = gate( fadeOn( 5e-4, fp, 2.0 ), { op2: [ 0, 0 ], sBlister: [ 0, 0 ] }, () => {

			const oq2 = p.div( 3.5e-4 ).add( 9.1 );
			const bq = p.div( 5e-4 ).add( 3.7 );
			return {
				op2: vec2( vn( oq2 ), vn( oq2.add( 2.6 ) ) ).sub( 0.5 ).mul( fadeIn( 3.5e-4, fp, 2.0, 6.0 ) ),
				sBlister: vec2( vn( bq ), vn( bq.add( 6.1 ) ) ).sub( 0.5 ).mul( 0.25 ).mul( creep ).mul( fadeIn( 5e-4, fp, 2.0, 6.0 ) ),
			};

		}, [ p, fp, creep ] );
		return { sOP: op.mul( 0.1 ).add( F.op2.mul( 0.035 ) ).mul( u.orangePeel ).mul( wOP ), sBlister: F.sBlister };

	}, [ p, fp, creep, wOP ] );
	const sOP = OP.sOP, sBlister = OP.sBlister;

	// L3 scratches through the coat, and marring from wiping: hairlines in
	// the coat itself, 2 um wide. Both weighted by 1 - chip: skipped where
	// the coat is gone.
	const S = gate( chip.lessThan( 1 ), { scr: 0, mar: 0 }, () => ( {
		scr: marks( p, fp, C.mul( 1.6 ), float( 2.5e-5 ), 2.3 ).max( marks( p, fp, C.mul( 0.5 ), float( 8e-6 ), 6.1 ).mul( 0.7 ) )
			.mul( u.scratches ).mul( float( 1 ).sub( chip ) ),
		mar: marks( p, fp, float( 6e-4 ), float( 1.5e-6 ), 3.9 ).mul( float( 1 ).sub( chip ) ).mul( u.scratches ),
	} ), [ p, fp, chip ] );
	const scr = S.scr.toVar(), mar = S.mar;

	// L4 microns: pigment speckle, dust grains, solvent pops, primer grain.
	// Widest fade: the pops (up to 56 um, from 1.5 px).
	const dq = p.div( 4e-4 ).add( 1.7 ).toVar(), pq = p.div( 7e-4 ).add( 8.9 ).toVar();
	const M = gate( fadeOn( 5.6e-5, fp, 1.5 ), { sp: 0, sMicro: [ 0, 0 ], dust: 0, dustS: [ 0, 0 ], pop: 0, popS: [ 0, 0 ], pr: 0 }, () => {

		// Two octaves on turned lattices, so no grid shows.
		const tq = mod( vec2( p.x.mul( 0.8 ).sub( p.y.mul( 0.6 ) ), p.x.mul( 0.6 ).add( p.y.mul( 0.8 ) ) ).div( 3e-5 ), 4096 );
		const sp = vn( tq ).add( vn( mod( p.div( 1.1e-5 ), 4096 ).add( 4.1 ) ) ).sub( 1 ).mul( 0.5 ).mul( fadeIn( 3e-5, fp, 2.0, 6.0 ) );
		const sMicro = vec2( vn( tq.add( 2.2 ) ), vn( tq.add( 9.7 ) ) ).sub( 0.5 ).mul( 0.03 ).mul( fadeIn( 3e-5, fp, 2.0, 6.0 ) );
		const dust = specks( dq, fp, float( 4e-4 ), 0.25 );
		const pop = specks( pq, fp, float( 7e-4 ), 0.18 );
		const pr = vn( mod( p.div( 8e-6 ), 4096 ).add( 3.9 ) ).sub( 0.5 ).mul( fadeIn( 8e-6, fp, 2.0, 6.0 ) );
		return { sp, sMicro, dust: dust.cov, dustS: dust.slope, pop: pop.cov, popS: pop.slope, pr };

	}, [ p, fp, dq, pq ] );
	const sp = M.sp, sMicro = M.sMicro, pr = M.pr;
	const dust = { cov: M.dust, slope: M.dustS }, pop = { cov: M.pop.toVar(), slope: M.popS };

	// Rust on the bare steel: the oxide crust and its colour, weighted by
	// rustOn, skipped where it is zero.
	const R = gate( rustOn.greaterThan( 0 ), { rustC: [ 0, 0, 0 ], slope: [ 0, 0 ], s2: 0 }, () => {

		const G = oxideCrust( p, fp, u );
		const rustC = mix( mix( u.rustColor, u.rustDark, vn( p.div( C.mul( 0.25 ) ).add( 2.2 ) ) ), u.rustDark.mul( 0.5 ), G.dark ).mul( G.tone );
		return { rustC, slope: G.slope.mul( rustOn ), s2: float( 1 ).sub( G.w ).mul( 0.06 ).mul( rustOn ) };

	}, [ p, fp, rustOn ] );

	// Colour.
	const coat = u.paintColor.mul( vn( p.div( 0.05 ).add( 6.3 ) ).mul( 0.14 ).add( 0.93 ) ).mul( sp.mul( 0.16 ).add( 1 ) )
		.mul( float( 1 ).sub( dust.cov.mul( 0.25 ) ) ).mul( float( 1 ).sub( pop.cov.mul( 0.2 ) ) );
	const stained = mix( coat, mix( u.rustDark, u.rustColor, creepN ).mul( 0.9 ), creep.mul( creepN.mul( 0.4 ).add( 0.45 ) ) );
	const primer = u.primerColor.mul( pr.mul( 0.25 ).add( 1 ) ).mul( vn( p.div( C.mul( 0.2 ) ).add( 9.9 ) ).mul( 0.2 ).add( 0.9 ) );
	const steel = u.f0.mul( 0.3 ).mul( vn( p.div( 2e-4 ).add( 1.4 ) ).mul( 0.2 ).add( 0.9 ) );
	const bareC = mix( steel, R.rustC, rustOn );
	let color = mix( stained, primer.mul( 1.1 ), scr );
	color = mix( mix( color, primer, chip ), bareC, bare );
	// The rim of the coat casts a thin dark line on the primer.
	const rimShade = smoothstep( 8e-5, 0.0, dm ).mul( chip ).mul( float( 1 ).sub( bare ) ).mul( wC );
	color = color.mul( float( 1 ).sub( rimShade.mul( 0.35 ) ) ).mul( mar.mul( 0.3 ).add( 1 ) );
	const metal = bare.mul( float( 1 ).sub( rustOn ) );

	// Relief: coat and primer steps, the lifted creep band, then the rest.
	const slope = sRim.mul( wC ).add( sBlister ).add( sMicro.mul( float( 1 ).sub( chip ) ) )
		.add( sOP.mul( float( 1 ).sub( chip ) ).mul( float( 1 ).sub( creep.mul( 0.5 ) ) ) )
		.add( dust.slope.mul( - 1 ).add( pop.slope ).mul( float( 1 ).sub( chip ) ) )
		.add( R.slope );

	const rCoat = u.roughness.add( creep.mul( 0.12 ) ).add( mar.mul( 0.2 ) ).add( scr.mul( 0.3 ) ).add( pop.cov.mul( 0.1 ) );
	const rough = mix( mix( rCoat, float( 0.8 ), chip ), mix( float( 0.5 ), float( 0.88 ), rustOn ), bare );
	const s2 = float( 1 ).sub( wOP ).mul( u.orangePeel ).mul( 1e-3 ).add( R.s2 );

	return {
		color, slope, rough, s2, metalness: metal,
		cavity: scr.max( rimShade ).max( chip.mul( 0.4 ) ).max( creep.mul( 0.3 ) ).max( rustOn.mul( 0.6 ) ),
		porosity: mix( mix( float( 0.1 ), float( 0.6 ), chip ), float( 0.9 ), rustOn ),
		debug: { w1: wC, w2: wOP, w3: fadeIn( u.rustGrainM, fp, 2.0, 6.0 ) },
	};

}
