// Flower petals (a rose), from a heap of petals down to the cells.
//   L0 petals   petals of size_mm (40 to 70 mm) overlap like loose tiles.
//               Each is cupped, its rim rolls back, it casts a soft shadow
//               on the petal under it. The base (claw) is paler, the rim
//               thin and translucent.
//   L1 veins    a fan of veins from the base, branching twice as the fan
//               widens, so they stay about feature_mm (0.3 to 0.8 mm)
//               apart. Veins carry more pigment and sit in shallow grooves.
//   L2 cells    conical epidermal cells (cell_um, 20 to 40 um). Each cone
//               acts as a lens: bright tip, dark walls. Unresolved, they
//               scatter light at grazing angles: the velvet sheen.
// Returns { color, slope, cavity, rough, s2, sheen, glow } for shader.js.

import { vec2, vec3, float, floor, mix, smoothstep, step, clamp, mod, atan, fract } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { rot2, cells, fbm, band } from './common.js';

const DX = 0.62, DY = 0.48; // petal lattice, in petal sizes

// Petal of lattice cell (col, row): local coordinates, radii, hash.
function petal( q, col, row ) {

	const id = mod( vec2( col, row ), 4096 );
	const h = hash3( id.add( 3.7 ) ), h2 = hash3( id.add( 9.1 ) );
	const odd = mod( row, 2 );
	const c = vec2( col.add( 0.5 ).add( odd.mul( 0.5 ) ).mul( DX ), row.add( 0.5 ).mul( DY ) ).add( h.xy.sub( 0.5 ).mul( 0.3 ) );
	const a = h.z.sub( 0.5 ).mul( 2.0 );
	const d = rot2( q.sub( c ), a );
	const A = h2.x.mul( 0.12 ).add( 0.46 ); // half length
	// Obovate: wider toward the tip, the rim a little wavy.
	const B = h2.y.mul( 0.08 ).add( 0.33 ).mul( d.y.div( A ).mul( 0.22 ).add( 0.85 ) );
	const wave = valueNoise( d.mul( 9 ).add( h.xy.mul( 40 ) ) ).sub( 0.5 ).mul( 0.06 );
	const rr = vec2( d.x.div( B ), d.y.div( A ) ).length().add( wave );
	return { d, A, B, rr, a, h, prio: h2.z };

}

export function buildPetal( p, fp, u ) {

	const S = u.sizeM, s = u.seed;
	const q = rot2( p, u.angle ).div( S ).add( s.mul( 1.37 ) );
	const row0 = floor( q.y.div( DY ) );
	// Pass 1: the petal on top among the 3 x 3 candidates.
	let best = float( - 1 ), d = vec2( 0 ), A = float( 0.5 ), B = float( 0.35 ), rr = float( 2 ), ang = float( 0 ), hh = vec3( 0 );
	const cands = [];
	for ( let oy = - 1; oy <= 1; oy ++ ) {

		const row = row0.add( oy );
		const col0 = floor( q.x.div( DX ).sub( mod( row, 2 ).mul( 0.5 ) ) );
		for ( let ox = - 1; ox <= 1; ox ++ ) cands.push( [ col0.add( ox ), row ] );

	}

	for ( const [ col, row ] of cands ) {

		const P = petal( q, col, row );
		const take = step( P.rr, 1 ).mul( step( best, P.prio ) );
		best = pick( take, P.prio, best ).toVar();
		d = pick( take, P.d, d ).toVar();
		A = pick( take, P.A, A ).toVar();
		B = pick( take, P.B, B ).toVar();
		rr = pick( take, P.rr, rr ).toVar();
		ang = pick( take, P.a, ang ).toVar();
		hh = pick( take, P.h, hh ).toVar();

	}

	// Pass 2: petals lying above this one shade it near their rim.
	let shade = float( 0 );
	for ( const [ col, row ] of cands ) {

		const P = petal( q, col, row );
		shade = shade.max( smoothstep( 1.22, 1.0, P.rr ).mul( step( best.add( 1e-4 ), P.prio ) ) ).toVar();

	}

	const covered = step( 0, best );
	// Distance to the rim in meters, for an anti-aliased edge.
	const rimM = rr.oneMinus().mul( B ).mul( S );
	const edgeAA = clamp( rimM.div( fp ).add( 0.5 ), 0, 1 ).mul( covered );

	// L0: colour over the petal: pale claw, body, translucent rim.
	const base = d.sub( vec2( 0, A.negate() ) ); // from the petal base, petal units
	const R = base.length().mul( S ); // meters
	const claw = smoothstep( 0.45, 0.0, base.length().div( A.mul( 2 ) ) );
	const tone = hh.x.sub( 0.5 ).mul( u.colorVar ).add( 1 );
	const mottle = fbm( p, S.mul( 0.3 ), fp, 3, 2 ).sub( 0.5 ).mul( 0.25 ).add( 1 );
	let color = mix( u.color, u.color2, claw.mul( 0.8 ) ).mul( tone ).mul( mottle );
	const rim = smoothstep( 0.86, 1.0, rr );
	color = mix( color, u.color2.mul( 1.1 ), rim.mul( 0.45 ) );

	// L1: veins, a fan from the base, branching as it widens.
	const phi = atan( base.x, base.y );
	const wob = valueNoise( vec2( R.div( u.featureM.mul( 6 ) ), hh.y.mul( 60 ) ) ).sub( 0.5 ).mul( 0.12 );
	let vein = float( 0 ), vslope = float( 0 );
	for ( let k = 0; k < 3; k ++ ) {

		const N = 22 * ( 1 << k );
		const t = phi.mul( N / Math.PI ).add( wob.mul( k * 0.7 + 0.4 ) ).add( hh.z.mul( 3 ) );
		const off = fract( t ).sub( 0.5 );
		const spacing = R.mul( Math.PI / N );
		const dM = off.mul( spacing );
		const halfW = u.featureM.mul( 0.09 / ( 1 + k * 0.3 ) );
		const on = k === 0 ? float( 1 ) : smoothstep( 0.5, 1.0, spacing.div( u.featureM ) );
		const vis = on.mul( fadeIn( spacing, fp, 2.0, 5.0 ) );
		const v = band( dM, halfW.add( fp.mul( 0.25 ) ), fp ).mul( vis ).mul( 1 - k * 0.2 );
		vein = vein.max( v );
		// Groove: walls tilt toward the vein axis.
		vslope = vslope.add( smoothstep( halfW.mul( 3 ), 0, dM.abs() ).mul( step( 0, dM ).mul( 2 ).sub( 1 ) ).mul( vis ).mul( 0.12 ) );

	}

	color = mix( color, u.color3, vein.mul( 0.4 ) );
	// Fine wrinkles along the veins (cell rows), 0.1 mm.
	const wr = fbm( rot2( base.mul( S ), phi ), u.featureM.mul( 0.25 ), fp, 2, 7 ).sub( 0.5 );

	// L2: conical cells; tip bright (lens), walls dark.
	const C = cells( p, u.cellM, fp, 5.3, { cone: 1, crown: 0.3, jitter: 0.75 } );
	color = color.mul( C.id.x.sub( 0.5 ).mul( 0.16 ).mul( C.w ).add( 1 ) )
		.mul( C.h.sub( 0.55 ).mul( 0.35 ).mul( C.w ).add( 1 ) )
		.mul( float( 1 ).sub( C.wall.mul( 0.25 ) ) );

	// Shadow of the petal above, the gap between petals deep and dark.
	color = mix( color, color.mul( u.color3 ).mul( 0.6 ), shade.mul( 0.8 ) );
	const gap = u.color3.mul( 0.25 );
	color = mix( gap, color, edgeAA );

	// Slopes: cupped petal and its rolled rim, veins, wrinkles, cells.
	const cup = vec2( d.x.div( B.mul( B ) ), d.y.div( A.mul( A ) ) ).mul( - 0.12 ).mul( u.relief );
	const roll = vec2( d.x.div( B.mul( B ) ), d.y.div( A.mul( A ) ) ).mul( rim.mul( 0.5 ) ).mul( u.relief );
	const across = vec2( base.y, base.x.negate() ).div( base.length().max( 1e-4 ) );
	const local = cup.add( roll ).add( across.mul( vslope ).mul( u.relief ) )
		.add( vec2( wr, wr.mul( 0.4 ) ).mul( 0.15 ).mul( u.relief ) );
	const back = rot2( local, ang.negate().sub( u.angle ) ).mul( edgeAA );
	const slope = back.add( C.slope.mul( 0.45 ).mul( u.relief ) );

	const cavity = vein.mul( 0.4 ).max( shade.mul( 0.6 ) ).max( edgeAA.oneMinus() );
	// Velvet: the cones scatter at grazing angles.
	const sheen = mix( u.color2, color, 0.5 ).mul( u.sheen );
	// Thin rim and the petal body let light through.
	const glow = color.mul( rim.mul( 0.8 ).add( 0.6 ) ).mul( edgeAA );
	return { color, slope, cavity, rough: u.roughness, s2: C.s2.mul( 0.4 ).mul( u.relief ), sheen, glow };

}
