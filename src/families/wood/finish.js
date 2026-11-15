// What happens to a board after the saw, in the order it happens:
//   saw      band saw marks across the grain, torn fibres (rough sawn)
//   weather  sun and rain turn wood silver grey and wash out the soft
//            earlywood, so the latewood stands in ridges (driftwood)
//   checks   drying cracks along the grain
//   paint    a coat that cracks along the latewood and flakes off in
//            patches stretched along the grain; bare grey wood beneath
//   char     shou sugi ban: the burnt face crazes into domed blocks with
//            deep cracks; brushing removes the soft char, latewood stays
// B: the board from board.js. Returns B with colour, slope, cavity and
// roughness updated. Checks, paint and char are compiled in only when the
// preset uses them (set() can tune them later, not add them).

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, abs, dFdx, dFdy } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

// Drying checks: tapered cracks along the grain, a little wavy, in rows
// 14 mm apart. cs: distance across the crack (m); cw: its half width (m).
export function checkField( x, y, u ) {

	const cy = 0.014, row = floor( y.div( cy ) );
	const cxx = x.div( 0.07 ).add( hash1( vec2( row, 4.4 ) ).mul( 5 ) );
	const ch = hash3( vec2( floor( cxx ), row ).add( u.seed ) );
	const ct = fract( cxx ).mul( 2 ).sub( 1 );
	const cs = fract( y.div( cy ) ).sub( 0.5 ).sub( ch.y.sub( 0.5 ).mul( 0.5 ) ).mul( cy ).add( valueNoise( vec2( x.div( 0.008 ), row ) ).sub( 0.5 ).mul( 0.0012 ) );
	const cw = float( 1 ).sub( ct.mul( ct ) ).max( 0 ).mul( ch.z.mul( 0.5 ).add( 0.25 ) ).mul( 0.0008 );
	return { cs, cw, on: step( ch.x, u.checks ) };

}

export function finishBoard( B, p, fp, u ) {

	const { x, y } = B.F;
	let { color, cavity, rough } = B;
	let slope = B.slope;

	// Saw marks: shallow grooves across the grain, each pass a little off.
	const sq = x.div( u.sawM ).add( valueNoise( vec2( y.div( 0.06 ), u.seed ) ).mul( 0.8 ) );
	const sAmp = valueNoise( vec2( floor( sq ), y.div( 0.03 ) ) ).mul( 0.7 ).add( 0.3 );
	const wSaw = fadeIn( u.sawM, fp, 2.0, 6.0 ).mul( u.saw );
	const sf = fract( sq );
	slope = slope.add( B.F.toP( vec2( sf.sub( 0.5 ).mul( 0.5 ).mul( sAmp ).mul( wSaw ), 0 ) ) );
	color = color.mul( float( 1 ).sub( smoothstep( 0.35, 0.5, abs( sf.sub( 0.5 ) ) ).mul( sAmp ).mul( wSaw ).mul( 0.12 ) ) );
	rough = mix( rough, rough.add( 0.15 ).min( 1 ), u.saw );

	// Weather: silver grey, earlywood washed out.
	const grey = u.weatherColor.mul( valueNoise( p.div( 0.02 ).add( 7.1 ) ).mul( 0.25 ).add( 0.85 ) ).mul( mix( float( 1.08 ), float( 0.78 ), B.late ) );
	const bare = mix( color, grey, u.weather.max( 0.7 ) ); // under paint the bare wood has weathered too
	color = mix( color, grey, u.weather );
	const erosion = float( 1 ).sub( B.late ).mul( u.weather ).mul( u.ringM ).mul( 0.06 ).mul( B.wR );
	slope = slope.add( surfaceGradient( erosion.negate(), p ) );
	cavity = cavity.max( float( 1 ).sub( B.late ).mul( u.weather ).mul( 0.6 ) );

	// The finishes below are compiled only when the preset uses them.
	if ( u.checks.value > 0 ) {

		// Checks: drying cracks along the grain, tapered, a little wavy.
		const { cs, cw, on } = checkField( x, y, u );
		const check = clamp( cw.sub( cs.abs() ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
		color = color.mul( float( 1 ).sub( check.mul( 0.8 ) ) );
		cavity = cavity.max( check );

	}

	if ( u.paint.value > 0 ) {

		// Paint: islands stretched along the grain flake off; the coat
		// cracks along the latewood lines.
		// Long along the grain, jagged at the ends.
		const pn = valueNoise( vec2( x.div( u.flakeM.mul( 4 ) ), y.div( u.flakeM.mul( 0.7 ) ) ).add( u.seed.mul( 4 ) ) ).mul( 0.6 )
			.add( valueNoise( vec2( x.div( u.flakeM.mul( 1.2 ) ), y.div( u.flakeM.mul( 0.2 ) ) ).add( 3.3 ) ).mul( 0.28 ) )
			.add( valueNoise( p.div( u.flakeM.mul( 0.08 ) ).add( 8.8 ) ).mul( 0.12 ) );
		const th = float( 0.8 ).sub( u.flaking.mul( 0.45 ) );
		const e = abs( dFdx( pn ) ).add( abs( dFdy( pn ) ) ).max( 1e-4 );
		const coat = smoothstep( th.add( e ), th.sub( e ), pn ).mul( u.paint ).toVar();
		const crackLine = smoothstep( 0.012, 0.0, abs( fract( B.phase ).sub( 0.985 ) ).mul( B.wR ).add( B.wR.oneMinus() ) )
			.mul( smoothstep( 0.45, 0.6, valueNoise( vec2( x.div( 0.01 ), B.phase.mul( 0.5 ) ) ) ) ).mul( coat );
		const paintCol = u.paintColor.mul( valueNoise( p.div( 0.004 ).add( 1.7 ) ).mul( 0.15 ).add( 0.92 ) ).mul( float( 1 ).sub( crackLine.mul( 0.7 ) ) );
		color = mix( mix( color, bare, coat.oneMinus() ), paintCol, coat );
		slope = slope.mul( float( 1 ).sub( coat.mul( 0.85 ) ) ).add( surfaceGradient( coat.mul( 1.5e-4 ), p ) );
		rough = mix( rough, float( 0.5 ), coat );
		cavity = cavity.mul( float( 1 ).sub( coat.mul( 0.7 ) ) ).max( crackLine ).max( coat.oneMinus().mul( 0.3 ) );

	}

	if ( u.char.value > 0 ) {

		// Char: crazed blocks, longer along the grain, domed, deep cracks;
		// a finer crazing on each block.
		const cv = voronoi( vec2( x.div( u.charM.mul( 1.5 ) ), y.div( u.charM ) ).add( u.seed.mul( 5 ) ), 0.8 );
		const crack = clamp( float( 0.0006 ).sub( cv.edge.mul( u.charM ) ).div( fp ).add( 0.5 ), 0, 1 );
		const dome = smoothstep( 0.0, 0.4, cv.edge );
		// Down toward the crack: the height falls along dir (seed to neighbour).
		const g = cv.dir.mul( smoothstep( 0.4, 0.0, cv.edge ) ).mul( - 0.22 ).mul( fadeIn( u.charM, fp, 2.0, 6.0 ) );
		const fv = voronoi( p.div( u.charM.mul( 0.22 ) ).add( 9.1 ), 0.9 );
		const craze = clamp( float( 0.00012 ).sub( fv.edge.mul( u.charM ).mul( 0.22 ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( fadeIn( u.charM.mul( 0.22 ), fp, 2.0, 6.0 ) );
		const soot = vec3( 0.022, 0.02, 0.019 ).mul( valueNoise( p.div( 0.003 ) ).mul( 0.5 ).add( 0.75 ) ).mul( dome.mul( 0.5 ).add( 0.6 ) );
		// Brushed: the soft earlywood char is gone, latewood ridges stay black.
		const brushedCol = mix( u.earlyColor.mul( 0.28 ), vec3( 0.03 ), B.late );
		const charCol = mix( soot, brushedCol, u.brushed ).mul( float( 1 ).sub( crack.max( craze.mul( 0.6 ) ).mul( mix( float( 0.9 ), float( 0.4 ), u.brushed ) ) ) );
		color = mix( color, charCol, u.char );
		const ridges = surfaceGradient( float( 1 ).sub( B.late ).mul( u.ringM ).mul( 0.05 ).mul( B.wR ).negate(), p ).mul( u.brushed );
		const blocks = B.F.toP( vec2( g.x.div( 1.5 ), g.y ) ).mul( float( 1 ).sub( u.brushed.mul( 0.7 ) ) );
		slope = slope.mul( float( 1 ).sub( u.char.mul( 0.8 ) ) ).add( blocks.add( ridges ).mul( u.char ) );
		rough = mix( rough, mix( float( 0.62 ), float( 0.8 ), crack ), u.char );
		cavity = mix( cavity, crack.max( craze.mul( 0.5 ) ), u.char );

	}

	return { ...B, color, slope, cavity, rough };

}
