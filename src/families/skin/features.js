// Living skin, local features layered over the generic skin (shader.js):
//   ridges   fingerprint whorls (mode 0) or lip furrows (mode 1), with
//            sweat pores along the ridge tops
//   creases  long folds: age wrinkles (straight) or knuckle folds (arcs)
//   veins    blue branches seen through thin skin
//   scar     a healed band: smooth, shiny, paler, no pores or hair
//   tattoo   ink in the dermis, its edges blurred by the skin
// Each returns slopes and colour terms; the skin shader composes them.
// p: coordinates in meters, fp: pixel footprint.

import { vec2, vec3, float, floor, fract, clamp, smoothstep, step, mix, sin, cos, atan, exp, texture } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

const TAU = Math.PI * 2;

export function skinFeatures( u, p, fp ) {

	// Ridges. Whorl: rings around a centre, a little elongated and warped,
	// with a slow spiral. Lips: near vertical furrows that wander.
	const pw = p.add( vec2( valueNoise( p.div( u.ridgeM.mul( 9 ) ) ), valueNoise( p.div( u.ridgeM.mul( 9 ) ).add( 4.4 ) ) ).sub( 0.5 ).mul( u.ridgeM ).mul( 3 ) );
	const v = pw.sub( u.ridgeCenter ).mul( vec2( 1, 0.78 ) );
	const r = v.length().max( 1e-6 );
	const ang = atan( v.y, v.x );
	const phW = r.div( u.ridgeM ).add( ang.div( TAU ).mul( 0.6 ) );
	const gW = v.div( r ).mul( vec2( 1, 0.78 ) ).div( u.ridgeM );
	const phL = pw.x.div( u.ridgeM ).add( valueNoise( vec2( pw.y.div( u.ridgeM.mul( 6 ) ), 2.2 ) ).mul( 2.5 ) );
	const gL = vec2( float( 1 ).div( u.ridgeM ), 0 );
	const lips = step( 0.5, u.ridgeMode );
	const ph = mix( phW, phL, lips ), gph = mix( gW, gL, lips );
	const f = fract( ph );
	const wR = fadeIn( u.ridgeM, fp, 1.5, 4.0 ).mul( u.ridges );
	// Lip furrows are narrow grooves; fingerprint ridges are round crests.
	const crest = cos( f.mul( TAU ) ).mul( 0.5 ).add( 0.5 );
	const dCrest = sin( f.mul( TAU ) ).mul( - Math.PI ); // d crest / d phase
	const sR = gph.mul( dCrest ).mul( u.ridgeM ).mul( 0.16 ).mul( wR );
	// Sweat pores on the ridge tops, one every ridge period along it.
	const alongR = mix( ang.mul( r ), pw.y, lips ).div( u.ridgeM ).add( floor( ph ).mul( 0.37 ) );
	const poreD = vec2( fract( alongR.add( hash1( vec2( floor( ph ), 1.1 ) ) ) ).sub( 0.5 ), f.sub( 0.5 ).abs().sub( 0.5 ) ).length();
	const sweat = float( 1 ).sub( smoothstep( 0.1, 0.16, poreD ) ).mul( step( hash1( vec2( floor( ph ), floor( alongR ) ) ), 0.6 ) )
		.mul( fadeIn( u.ridgeM.mul( 0.3 ), fp, 1.5, 4.0 ) ).mul( u.ridges ).mul( float( 1 ).sub( lips ) );

	// Creases: long folds, distance to rings around a far centre (age: very
	// far, so nearly straight; knuckle: a few cm, so arcs).
	const cn = vec2( cos( u.creaseAngle ), sin( u.creaseAngle ) );
	const C = vec2( 0.15, 0.15 ).sub( cn.mul( u.creaseR ) );
	const cv = p.sub( C );
	const cr = cv.length();
	const sc = cr.div( u.creaseM ).add( valueNoise( vec2( cv.dot( vec2( cn.y.negate(), cn.x ) ).div( u.creaseM.mul( 4 ) ), 3.3 ) ).sub( 0.5 ).mul( 0.8 ) );
	const cf = fract( sc ).sub( 0.5 );
	const cstr = smoothstep( 0.3, 0.7, valueNoise( vec2( cv.dot( vec2( cn.y.negate(), cn.x ) ).div( u.creaseM.mul( 3 ) ), floor( sc ).mul( 1.7 ) ) ) );
	const cw = float( 0.12 );
	const valley = exp( cf.div( cw ).pow( 2 ).negate() ).mul( cstr ).mul( u.creases );
	const wCr = fadeIn( u.creaseM, fp, 1.0, 3.0 );
	const sCr = cv.div( cr.max( 1e-6 ) ).mul( cf.div( cw.mul( cw ) ).mul( valley ).mul( 2 ) ).mul( 0.06 ).mul( wCr );

	// Veins: iso lines of a warped noise, two octaves for the branches.
	const vq = p.div( u.veinM ).mul( vec2( 0.3, 1 ) ); // stretched: veins run along the limb
	const vn = valueNoise( vq ).mul( 0.7 ).add( valueNoise( vq.mul( 2.3 ).add( 7.7 ) ).mul( 0.3 ) );
	// Seen through the skin, a vein is a soft blue band, wider than sharp.
	const vein = float( 1 ).sub( smoothstep( 0.0, 0.09, vn.sub( 0.5 ).abs() ) ).pow( 1.3 ).mul( u.veins );

	// Scar: a tapered band between two points, its border wandering.
	const ab = u.scarB.sub( u.scarA );
	const tS = p.sub( u.scarA ).dot( ab ).div( ab.dot( ab ) ).clamp( 0, 1 );
	const dS = p.sub( u.scarA.add( ab.mul( tS ) ) ).length().add( valueNoise( vec2( tS.mul( 30 ), 5.5 ) ).sub( 0.5 ).mul( u.scarW ).mul( 0.8 ) );
	const wS = u.scarW.mul( float( 1 ).sub( tS.mul( 2 ).sub( 1 ).pow( 2 ) ).max( 0 ).sqrt() );
	const scar = clamp( wS.sub( dS ).div( u.scarW.mul( 0.25 ).add( fp ) ), 0, 1 ).mul( u.scar );
	// Collagen lines along the scar.
	const sdir = ab.normalize();
	const sn = vec2( sdir.y.negate(), sdir.x );
	const scLines = sin( p.dot( sn ).div( 1.5e-4 ).mul( TAU ).add( valueNoise( vec2( p.dot( sdir ).div( 2e-3 ), 1.0 ) ).mul( 6 ) ) );
	const sSc = sn.mul( scLines.mul( 0.04 ) ).mul( scar ).mul( fadeIn( float( 1.5e-4 ), fp, 2.0, 5.0 ) );

	// Tattoo: curved tribal bands; the ink sits in the dermis, so its edge
	// is soft and, under the loupe, grainy.
	const tq = p.div( 0.035 ).add( 1.7 );
	const t1 = valueNoise( tq ).mul( 0.75 ).add( valueNoise( tq.mul( 2.1 ) ).mul( 0.25 ) );
	const t2 = valueNoise( tq.mul( 0.55 ).add( 9.9 ) );
	const grain = voronoi( p.div( 3e-5 ) ).edge.mul( fadeIn( float( 3e-5 ), fp, 1.5, 4.0 ) );
	const edge = float( 0.06 ).add( grain.mul( 0.05 ) );
	let ink;
	if ( u.tattooMap ) {

		// A drawing (dark lines on white): the ink follows it, blurred by the
		// dermis (a coarser mip level), its edge grainy under the loupe.
		const tuv = p.sub( u.tattooCenter ).div( u.tattooSize ).add( 0.5 );
		const inside = step( 0, tuv.x ).mul( step( tuv.x, 1 ) ).mul( step( 0, tuv.y ) ).mul( step( tuv.y, 1 ) );
		const s = texture( u.tattooMap, tuv ).bias( 1.5 );
		const dark = float( 1 ).sub( s.rgb.dot( vec3( 0.2126, 0.7152, 0.0722 ) ) ).mul( s.a );
		ink = smoothstep( float( 0.15 ).add( grain.mul( 0.5 ) ), float( 0.6 ), dark ).mul( inside ).mul( u.tattoo );

	} else {

		ink = float( 1 ).sub( smoothstep( edge.sub( 0.025 ), edge, t1.sub( 0.5 ).abs() ) )
			.max( float( 1 ).sub( smoothstep( 0.03, 0.05, t2.sub( 0.5 ).abs() ) ) ).mul( u.tattoo );

	}

	const slope = sR.add( sCr.negate() ).add( sSc );
	// Colour multiplier: creases a little darker, veins bluish, scar paler
	// and pinker, ink dark under the skin.
	const tint = mix( vec3( 1 ), vec3( 0.78, 0.7, 0.68 ), valley.mul( wCr ).mul( 0.6 ) )
		.mul( mix( vec3( 1 ), vec3( 0.5, 0.72, 0.9 ), vein.mul( 0.75 ) ) ) // blue-green: the skin above filters the red
		.mul( mix( vec3( 1 ), vec3( 1.12, 0.98, 0.96 ), scar ) )
		.mul( float( 1 ).sub( sweat.mul( 0.35 ) ) );
	// Fingertip ridges and scars replace the generic skin lines.
	const smooth = wR.mul( 0.85 ).max( scar );
	return { slope, tint, smooth, scar, ink, vein, cavity: valley.mul( wCr ).max( sweat ).max( float( 1 ).sub( crest ).mul( wR ).mul( 0.6 ) ) };

}
