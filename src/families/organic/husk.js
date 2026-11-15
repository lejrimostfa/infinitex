// Hard and fibrous husks: walnut shell and coconut fibre (coir).
// Walnut:
//   L0 shell    broad lobes (3 to 4 cm), a raised suture ridge where the
//               two halves meet (streaks), colour from tan to brown
//   L1 wrinkles a crumpled, brain-like relief about size_mm (3 to 6 mm)
//               across: knife-edged ridges (ridged noise, twice warped)
//               around deep shadowed pits; woody fibre streaks on the
//               ridge tops, polished where handled
//   L2 wood     sclereid stone cells (cell_um, 30 to 60 um) with pits,
//               tiny pores, a dusty grain
// Coir:
//   L0 mat      clumps of fibres, light and dark tufts, dark gaps between
//   L1 fibres   six layers of coarse fibres (fiber_um, 100 to 400 um
//               thick) crossing in all directions, gently bent, broken
//               into segments; lower layers sit in shadow
//   L2 surface  each fibre: longitudinal cells (striations, a tenth of the
//               fibre width) and rows of silica bodies in pits (10 um)
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, vec3, float, floor, mix, smoothstep, step, clamp, mod, fract } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { rot2, cells, fbm, band, warp2, grains } from './common.js';

export function buildWalnut( p, fp, u ) {

	const g = u.sizeM, s = u.seed;
	// L0: lobes and the suture ridge.
	const lobe = fbm( p.add( s ), float( 0.035 ), fp, 2, 1 );
	const a = rot2( p, u.angle );
	const sd = a.x.sub( 0.15 ).add( fbm( a, float( 0.05 ), fp, 2, 3 ).sub( 0.5 ).mul( 0.02 ) );
	const sutW = g.mul( 0.8 );
	const suture = smoothstep( sutW, 0, sd.abs() ).mul( u.streaks );
	const dSut = sd.div( sutW ).negate().mul( smoothstep( sutW, 0, sd.abs() ) ).mul( u.streaks ).mul( 1.2 );

	// L1: a crumpled relief: two octaves of ridged noise (sharp crests
	// where the noise crosses its middle) on twice warped coordinates.
	// Crests are knife-edged, the cells between them deep pits; slope by
	// finite differences, the pits darkened by occlusion.
	const q0 = p.add( warp2( p, g.mul( 3 ), 7.1 ).mul( g.mul( 2 ) ) );
	const q = q0.add( warp2( q0, g.mul( 1.1 ), 3.9 ).mul( g.mul( 0.7 ) ) );
	const w2 = fadeIn( g.mul( 0.8 ), fp, 1.5, 4.0 );
	const ridgeH = ( x ) => {

		const n1 = valueNoise( mod( x.div( g.mul( 2 ) ), 4096 ).add( 2.2 ) );
		const n2 = valueNoise( mod( x.div( g.mul( 0.8 ) ), 4096 ).add( 5.1 ) );
		const r1 = float( 1 ).sub( n1.mul( 2 ).sub( 1 ).abs() );
		const r2 = float( 1 ).sub( n2.mul( 2 ).sub( 1 ).abs() );
		return r1.pow( 1.5 ).mul( 0.7 ).add( r2.mul( r1.mul( 0.5 ).add( 0.5 ) ).mul( 0.3 ).mul( w2 ) ).add( w2.oneMinus().mul( 0.12 ) );

	};

	const e = g.mul( 0.01 );
	const h = ridgeH( q ).toVar();
	const dh = vec2( ridgeH( q.add( vec2( e, 0 ) ) ).sub( h ), ridgeH( q.add( vec2( 0, e ) ) ).sub( h ) ).div( e );
	const wR = fadeIn( g.mul( 0.4 ), fp, 1.0, 3.0 );
	const R = { h, slope: dh };
	const crest = h.mul( wR ).add( wR.oneMinus().mul( 0.45 ) );
	let color = mix( u.color, u.color2, smoothstep( 0.55, 0.95, crest ).mul( 0.6 ) );
	// Occlusion: pits deep and dark, crests in the open.
	color = color.mul( mix( float( 0.22 ), float( 1 ), smoothstep( 0.05, 0.55, crest ) ) );
	color = mix( color, u.color3, smoothstep( 0.25, 0.0, crest ).mul( 0.6 ) );
	color = color.mul( lobe.sub( 0.5 ).mul( 0.3 ).add( 1 ) ).mul( suture.mul( 0.15 ).add( 1 ) );
	const groove = smoothstep( 0.4, 0.0, crest ); // 1 in the pits
	// Woody fibres on the ridges: streaks 0.1 mm wide, 1 mm long, along
	// the shell; they wear through on the crests.
	const fa = rot2( q, u.angle );
	const fib = valueNoise( mod( vec2( fa.x.div( g.mul( 0.02 ) ), fa.y.div( g.mul( 0.2 ) ) ), 4096 ).add( 8.8 ) );
	const wF = fadeIn( g.mul( 0.02 ), fp, 1.5, 4.0 );
	color = color.mul( fib.sub( 0.5 ).mul( 0.35 ).mul( wF ).mul( smoothstep( 0.3, 0.7, crest ) ).add( 1 ) );
	const dFine = rot2( vec2( fib.sub( 0.5 ).mul( 0.4 ), 0 ), u.angle.negate() ).mul( wF );

	// L2: stone cells, pits in their walls, pores.
	const C = cells( p, u.cellM, fp, 3.3, { jitter: 0.9, crown: 0.4 } );
	const pit = smoothstep( 0.12, 0.04, C.V.toSeed.length() ).mul( step( 0.6, C.id.y ) ).mul( fadeIn( u.cellM.mul( 0.25 ), fp, 2.0, 5.0 ) );
	color = color.mul( C.id.x.sub( 0.5 ).mul( 0.4 ).mul( C.w ).add( 1 ) ).mul( float( 1 ).sub( C.wall.mul( 0.3 ) ) ).mul( float( 1 ).sub( pit.mul( 0.4 ) ) );
	const P = grains( p, u.cellM.mul( 6 ), fp, 5.5, { gap: 0.3, radius: 0.15, round: 0.3 } );
	const pore = step( 0.7, P.id.x ).mul( P.body ).mul( fadeIn( u.cellM.mul( 1.5 ), fp, 2.0, 5.0 ) );
	color = color.mul( float( 1 ).sub( pore.mul( 0.55 ) ) );

	const amp = u.relief.mul( g ).mul( 0.9 ); // pit depth, meters
	const slope = R.slope.mul( amp ).mul( wR ).add( dFine.mul( h ) )
		.add( rot2( vec2( dSut, 0 ), u.angle.negate() ) )
		.add( C.slope.mul( 0.2 ) ).add( P.grad.mul( - 0.3 ).mul( pore ) );
	// Ridges polished by handling, grooves dull and dusty.
	const rough = mix( u.roughness.sub( 0.15 ), float( 0.85 ), groove );
	const s2 = wR.oneMinus().mul( 0.08 ).mul( u.relief ).add( C.s2.mul( 0.15 ) );
	return { color, slope, cavity: groove.mul( wR ), rough, s2 };

}

// One layer of parallel fibres at angle `ang`, bent by a slow warp,
// broken into segments. Returns cover, cross slope (surface frame),
// tone, the coordinate across the fibre (-1..1) and along it (meters).
function fibreLayer( p, fp, u, ang, salt ) {

	const w = u.fiberM;
	const sp = w.mul( 3.2 );
	const r = rot2( p, ang ).add( warp2( p, float( 0.02 ), salt ).mul( 0.006 ) ).add( warp2( p, float( 0.004 ), salt + 3 ).mul( 0.0008 ) );
	const k = floor( r.x.div( sp ) );
	const hk = hash3( vec2( mod( k, 4096 ), salt ) );
	const segL = u.featureM;
	const along = r.y.add( hk.x.mul( 0.5 ) );
	const seg = floor( along.div( segL ) );
	const hs = hash3( mod( vec2( k, seg ), 4096 ).add( salt * 1.7 ) );
	const ft = fract( along.div( segL ) );
	const end = smoothstep( 0.0, 0.08, ft ).mul( smoothstep( 1.0, 0.92, ft ) );
	const hw = w.mul( 0.5 ).mul( hs.x.mul( 0.8 ).add( 0.6 ) ).mul( end.mul( 0.5 ).add( 0.5 ) );
	const o = r.x.sub( k.add( 0.5 ).mul( sp ) ).sub( hk.y.sub( 0.5 ).mul( sp.mul( 0.3 ) ) );
	const present = step( hs.y, u.density.mul( 0.5 ).add( 0.3 ) ).mul( end );
	const wF = fadeIn( sp, fp, 2.0, 5.0 );
	const cover = band( o, hw, fp ).mul( present );
	const x = clamp( o.div( hw.max( 1e-7 ) ), - 1, 1 );
	const slope = rot2( vec2( x.mul( - 1.1 ), 0 ), ang.negate() ).mul( cover ).mul( wF );
	return { cover, slope, tone: hs.z, x, along, wF, share: present.mul( hw.mul( 2 ).div( sp ) ) };

}

export function buildCoir( p, fp, u ) {

	const s = u.seed;
	// L0: tufts, dark gaps between them.
	const tuft = fbm( p.add( s ), float( 0.018 ), fp, 3, 2 );
	const gapsDark = u.color3.mul( 0.35 );
	let color = gapsDark.mul( tuft.mul( 0.8 ).add( 0.6 ) );
	let slope = vec2( 0 );
	let top = float( 0 ), coverAll = float( 0 ), stri = float( 0 ), x = float( 0 ), along = float( 0 );
	const N = 6;
	for ( let i = 0; i < N; i ++ ) {

		const ang = float( i * 2.4 + 0.3 ).add( s.mul( 0.7 ) ).add( fbm( p, float( 0.06 ), fp, 2, i * 3 ).sub( 0.5 ).mul( 1.4 ) );
		const F = fibreLayer( p, fp, u, ang, 11.3 + i * 5.1 );
		// Lower layers darker; tone per fibre segment, lighter in the tufts.
		const depth = ( i + 1 ) / N;
		const fcol = mix( u.color, u.color2, F.tone ).mul( F.tone.sub( 0.5 ).mul( u.colorVar.mul( 2 ) ).add( 1 ) )
			.mul( tuft.mul( 0.4 ).add( 0.8 ) ).mul( 0.45 + 0.55 * depth );
		// Shading across the round fibre.
		const shade = float( 1 ).sub( F.x.mul( F.x ).mul( 0.45 ) ).add( F.x.mul( - 0.15 ) );
		const c = F.cover.mul( F.wF );
		// Far: the layer's mean cover tints the mat.
		color = mix( color, fcol, F.wF.oneMinus().mul( F.share.mul( 1.3 ).min( 0.9 ) ) );
		color = mix( color, fcol.mul( shade ), c );
		slope = pick( c, F.slope, slope );
		top = pick( step( 0.5, c ), F.tone, top );
		x = pick( step( 0.5, c ), F.x, x );
		along = pick( step( 0.5, c ), F.along, along );
		coverAll = coverAll.max( c );

	}

	// L2: striations along the fibre, silica bodies in rows.
	const cw = u.fiberM.mul( 0.1 );
	const sx = x.mul( u.fiberM.mul( 0.5 ) );
	const wS = fadeIn( cw, fp, 2.0, 5.0 ).mul( coverAll );
	const stripe = valueNoise( vec2( sx.div( cw ), along.div( cw.mul( 8 ) ) ).add( top.mul( 50 ) ) );
	color = color.mul( stripe.sub( 0.5 ).mul( 0.7 ).mul( wS ).add( 1 ) );
	const dots = smoothstep( 0.35, 0.15, vec2( fract( sx.div( cw.mul( 1.5 ) ) ), fract( along.div( cw.mul( 1.5 ) ) ) ).sub( 0.5 ).length() )
		.mul( step( 0.55, valueNoise( vec2( sx.div( cw.mul( 1.5 ) ), along.div( cw.mul( 6 ) ) ).add( 3.3 ) ) ) ).mul( wS );
	color = color.mul( dots.mul( 0.5 ).add( 1 ) );
	slope = slope.mul( u.relief ).add( vec2( stripe.sub( 0.5 ), 0 ).mul( 0.6 ).mul( wS ) );
	const rough = mix( float( 0.95 ), u.roughness, coverAll );
	const s2 = float( 0.06 );
	return { color, slope, cavity: coverAll.oneMinus(), rough, s2 };

}
