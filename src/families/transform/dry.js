// A thick coat of paint drying. Solvent leaves first where the coat is
// thin, so drying fronts spread from a few places (size_mm apart). By
// time since the front passed (age, meters behind it):
//   wet      glossy (clear coat lobe), deeper colour, brush ridges still
//            levelling, a slow sag flowing in the film
//   matte    the surface loses its gloss over a few mm and lightens a
//            little as the binder sinks and pigment shows
//   wrinkle  the skin dries before the paint under it; it shrinks and
//            buckles into wrinkles about feature_mm apart that grow in
//            height over front_mm
//   cracks   the shrinking film tears into a craquelure net: cells of
//            4 to 8 feature_mm, cracks opening from a hairline to 0.3 mm
//            as it ages, then a second net inside the cells; the dark
//            ground shows through, cell edges curl up
// Fine levels: pigment grain (20 um), dust in the film.

import { vec2, float, mix, smoothstep, clamp, mod } from 'three/tsl';
import { ixTime } from '../../core/clock.js';
import { fadeIn, gate } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { arrival, heroSeed, rough, ageMeters } from '../../core/front.js';
import { fbm } from '../stone/common.js';
import { ridged } from '../organic/common.js';

const vn = valueNoise;

// A crack net of cell size cM, crack half width w (meters, a node that
// grows with age). Width under a pixel is widened and dimmed (mean kept).
function cracks( p, cM, w, fp, salt ) {

	const wq = vec2( vn( p.div( cM.mul( 0.7 ) ).add( salt ) ), vn( p.div( cM.mul( 0.7 ) ).add( salt + 7.3 ) ) ).sub( 0.5 ).mul( 0.5 )
		.add( vec2( vn( p.div( cM.mul( 0.15 ) ).add( salt + 2.1 ) ), vn( p.div( cM.mul( 0.15 ) ).add( salt + 5.9 ) ) ).sub( 0.5 ).mul( 0.1 ) );
	const V = voronoi( wrapCoord( p.div( cM ) ).add( wq ).add( salt ), 0.9 );
	const open = vn( wrapCoord( p.div( cM.mul( 1.5 ) ) ).add( salt + 4.4 ) ).mul( 0.8 ).add( 0.5 );
	const ww = w.mul( open );
	const d = V.edge.max( 0 ).mul( cM );
	const wE = ww.max( fp.mul( 0.6 ) );
	const cov = clamp( wE.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( ww.div( wE ) ).mul( fadeIn( cM, fp, 1.5, 4.0 ) );
	// Curl: the cell edge lifts toward the crack, over a fifth of the cell.
	const k = smoothstep( cM.mul( 0.2 ), float( 0 ), d );
	const slope = V.dir.mul( k.mul( 0.6 ) ).mul( fadeIn( cM.mul( 0.2 ), fp, 2.0, 6.0 ) );
	return { cov, slope, V, k };

}

export function buildDry( p, fp, u, prog ) {

	const g = u.sizeM, s = u.seed, f = u.featureM;
	const t = ixTime.mul( u.speed );
	const q = p.div( g );
	const wq = vec2( vn( q.mul( 1.6 ).add( s ) ), vn( q.mul( 1.6 ).add( s.add( 2.9 ) ) ) ).sub( 0.5 ).mul( 0.4 );
	const A = arrival( q.add( wq ).add( s.mul( 1.1 ) ), { jitter: 0.8, delay: 0.5, salt: 21 } );
	const T = A.t1.add( 0.1 ).min( heroSeed( q.add( wq ), g, [ 0.15, - 0.3 ] ) )
		.add( rough( p, g, fp, { top: 0.15, amp: 0.25, oct: 10, minM: 3e-5, salt: 7 } ) ).toVar();
	// The age runs past the front_mm scale so every stage gets its turn.
	const F = ageMeters( T, prog.mul( 1.7 ).sub( 0.2 ), g, p, fp );
	const age = F.age, W = u.frontM;

	const dry = F.aa( float( 0 ) ).toVar();
	const matte = smoothstep( float( 0 ), W.mul( 0.3 ), age ).toVar();
	const wrinkle = smoothstep( W.mul( 0.2 ), W, age ).toVar();
	const open = smoothstep( W, W.mul( 4 ), age ).toVar();

	// Wet film: brush ridges along x levelling, a slow sag.
	const bq = vec2( p.x.div( 0.04 ), p.y.div( 1.2e-3 ) );
	const brush = vec2( 0, vn( bq.add( 3.3 ) ).sub( 0.5 ).mul( 0.12 ).mul( fadeIn( 1.2e-3, fp, 2.0, 6.0 ) ) ).mul( matte.mul( 0.5 ).oneMinus() );
	const sq = wrapCoord( p.div( 0.012 ) ).add( vec2( 0, t.mul( - 0.08 ) ) );
	const sag = vec2( vn( sq ), vn( sq.add( 4.1 ) ) ).sub( 0.5 ).mul( 0.03 ).mul( dry.oneMinus() );

	// Wrinkles: ridged noise stretched one way per region.
	// They start 0.2 front_mm behind the front: the gate skips them ahead.
	const Wr = gate( wrinkle.greaterThan( 0 ), { wrS: [ 0, 0 ], wrH: 0 }, () => {

		const R = ridged( p.add( vec2( p.y.mul( 0.6 ), 0 ) ), f.mul( 2 ), fp, 4, 3 );
		return { wrS: R.slope.mul( f.mul( 0.15 ) ).mul( wrinkle ), wrH: R.h.sub( 0.5 ).mul( 0.25 ).mul( wrinkle ) };

	}, [ p, fp, wrinkle ] );
	const wrS = Wr.wrS;

	// Craquelure: two nets, the second opens later inside the cells.
	// Both count only once the cracks open (age past front_mm, and 2.5
	// front_mm for the second): the gates skip them before.
	const open2 = smoothstep( W.mul( 2.5 ), W.mul( 6 ), age ).toVar();
	const Cr = gate( open.greaterThan( 0 ), { crack: 0, k: 0, c1S: [ 0, 0 ], c2S: [ 0, 0 ] }, () => {

		const C1 = cracks( p, f.mul( 6 ), open.mul( 7e-5 ), fp, 1.3 );
		const id1 = C1.V.id1.toVar();
		const C2 = gate( open2.greaterThan( 0 ), { cov: 0, slope: [ 0, 0 ] }, () => {

			const C2 = cracks( p.add( hash3( id1 ).xy.mul( 0.01 ) ), f.mul( 2.2 ), open2.mul( 3e-5 ), fp, 8.8 );
			return { cov: C2.cov, slope: C2.slope };

		}, [ p, fp, open2, id1 ] );
		return { crack: C1.cov.mul( open.min( 1 ).mul( dry ) ).max( C2.cov.mul( open2 ) ), k: C1.k, c1S: C1.slope.mul( open ), c2S: C2.slope.mul( open2 ).mul( 0.6 ) };

	}, [ p, fp, open, open2, dry ] );
	const C1 = { k: Cr.k };
	const crack = Cr.crack.toVar();

	// Colour.
	const pg = vn( wrapCoord( p.div( 2e-5 ) ).add( 6.2 ) ).sub( 0.5 ).mul( fadeIn( 2e-5, fp, 2.0, 6.0 ) );
	const base = u.color.mul( fbm( p.add( 1.4 ), float( 0.03 ), fp, 3, 4 ).mul( 0.12 ).add( 0.94 ) ).mul( pg.mul( 0.1 ).add( 1 ) );
	const wetC = base.mul( 0.82 ); // wet: deeper
	const dryC = mix( base, u.color2, 0.15 );
	let col = mix( wetC, dryC, matte );
	col = col.mul( Wr.wrH.add( 1 ) );
	// The cut edge of the film shows paler beside the crack; inside it,
	// the dark ground.
	const lip = smoothstep( 0.0, 0.5, C1.k ).mul( smoothstep( 1.0, 0.85, C1.k ) ).mul( open ).mul( fadeIn( f.mul( 0.3 ), fp, 2.0, 6.0 ) );
	col = mix( col, dryC.mul( 1.12 ), lip.mul( 0.4 ) );
	col = mix( col, u.color3, crack );
	col = col.mul( float( 1 ).sub( C1.k.mul( open ).mul( 0.1 ) ) ); // edges catch dirt and shade

	const slope = brush.add( sag ).add( wrS ).add( Cr.c1S ).add( Cr.c2S ).mul( crack.oneMinus() ).mul( u.relief );
	const rgh = mix( float( 0.06 ), u.roughness, matte );
	const s2 = wrinkle.mul( fadeIn( f.mul( 2 ), fp, 2.0, 6.0 ).oneMinus() ).mul( 0.05 );
	return { color: col, slope, cavity: crack, rough: rgh, s2, coat: matte.oneMinus(), coatRough: float( 0.02 ), coatSlope: brush.add( sag ) };

}
