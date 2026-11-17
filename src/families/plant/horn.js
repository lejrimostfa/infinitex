// Horn and nail: hard keratin grown in layers from the base.
//   L0 streaks   pigment streaks long along the grain (angle_deg): dark
//                melanin (color2), pale cream (color4) on translucent
//                amber (color); fuzzy edges, fibrous inside
//   L0 bands     growth bands across the grain every 8 to 15 mm, wavy,
//                darker (color3), a low ridge where not polished away
//   L1 ridges    longitudinal ridges (size_mm, about 0.4 mm), like the
//                ridges of a nail; horn tubules (60 um) as fine fibres
//   L1 layers    the edges of keratin lamellae cross the grain as wavy
//                steps 0.6 to 2 mm apart (shingled); polish flattens them
//   L2 cells     flat dead cells (squames, cell_um about 35 um, longer
//                along the grain) with faint borders; melanin granules
//                (1 to 2 um) in the dark streaks; polishing scratches
// Light crosses the keratin: amber glow (SSS material).

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod, fract, floor } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, valueNoise, wrapCoord } from '../../core/hash.js';
import { dir2, band, lines, fbm, scratches, cells } from './common.js';

export function buildHorn( p, fp, u ) {

	const s = u.seed, rs = u.sizeM, cm = u.cellM;
	const ax = dir2( u.angle ), ay = vec2( ax.y.negate(), ax.x );
	// Along (x) and across (y) the grain, kept positive for the noises.
	const g = vec2( p.dot( ax ), p.dot( ay ) ).add( 1 );
	const flow = fbm( p, float( 0.08 ), fp, 3, 2 ).sub( 0.5 ).mul( 0.005 ); // the grain bends a little
	const gy = g.y.add( flow );

	// Streaks: noise stretched 25 x along the grain, two scales.
	const st = fbm( vec2( g.x.div( 40 ), gy ), float( 0.012 ), fp, 4, 3 );
	const st2 = fbm( vec2( g.x.div( 30 ), gy ), float( 0.0025 ), fp, 3, 7 );
	// Fibres: the same noise much finer across, so streak edges fray.
	const fib = fbm( vec2( g.x.div( 30 ), gy ), float( 0.0012 ), fp, 4, 13 );
	const dark = smoothstep( 0.5, 0.62, st.mul( 0.7 ).add( st2.mul( 0.18 ) ).add( fib.mul( 0.12 ) ) ).mul( u.streaks );
	const pale = smoothstep( 0.6, 0.72, fbm( vec2( g.x.div( 25 ), gy ), float( 0.02 ), fp, 4, 11 ) ).mul( u.streaks ).mul( float( 1 ).sub( dark ) );

	// Growth bands across the grain, wavy, irregular spacing.
	const bx = g.x.add( fbm( vec2( gy.mul( 3 ), s ), float( 0.05 ), fp, 3, 5 ).mul( 0.01 ) );
	const bq = bx.div( 0.011 );
	const bq2 = bq.add( valueNoise( vec2( bq.mul( 0.5 ), 2.2 ) ).mul( 1.3 ) );
	const bf = fract( bq2 );
	const bandM = smoothstep( 0.0, 0.25, bf ).mul( smoothstep( 0.75, 0.3, bf ) ).mul( fadeIn( float( 0.011 ), fp, 2.0, 5.0 ) ).mul( u.bands );
	// Saw-tooth relief: each band overlaps the next (slope of the ramp).
	const sBand = ax.mul( float( - 0.8e-4 ).mul( u.bands ).mul( 1 / 0.011 ) ).mul( fadeIn( float( 0.011 ), fp, 2.0, 5.0 ) );

	// Ridges along the grain and tubule fibres.
	const rq = gy.div( rs ).add( valueNoise( vec2( gy.div( rs.mul( 3 ) ), g.x.div( 0.02 ) ) ).mul( 1.2 ) );
	const rId = floor( rq );
	const rf = fract( rq ).sub( 0.5 );
	const wR = fadeIn( rs, fp, 3.0, 8.0 );
	const ridgeH = hash1( vec2( rId, 3.3 ) ).mul( 0.6 ).add( 0.4 );
	const sRidge = ay.mul( rf.mul( - 2 ).mul( ridgeH ).mul( 0.05 ) ).mul( wR ).mul( u.ridges );
	const tub = valueNoise( wrapCoord( vec2( g.x.div( 2e-3 ), gy.div( 6e-5 ) ) ) ).sub( 0.5 ).mul( fadeIn( float( 6e-5 ), fp, 2.0, 5.0 ) );

	// Layer edges: wavy steps across the grain.
	const lq0 = g.x.add( valueNoise( vec2( gy.div( 1.5e-3 ), 5.5 ) ).mul( 6e-4 ) ).div( 1.2e-3 );
	const lq = lq0.add( valueNoise( vec2( lq0.mul( 0.4 ), gy.div( 3e-3 ) ) ).mul( 0.9 ) );
	const lf = fract( lq );
	const wL = fadeIn( float( 1.2e-3 ), fp, 5.0, 12.0 );
	const stepE = band( float( 0.5 ).sub( lf.sub( 0.5 ).abs() ).mul( 1.2e-3 ), float( 3e-6 ), fp ).mul( wL );
	const unpol = u.polish.oneMinus();
	// Each lamella ends in a small step (analytic: a surface gradient
	// would flash on the wrap of fract).
	const stepSoft = smoothstep( 0.12, 0.0, float( 0.5 ).sub( lf.sub( 0.5 ).abs() ) ).mul( wL );
	const sLayer = ax.mul( stepSoft.mul( lf.sub( 0.5 ).sign() ).mul( 0.12 ) ).mul( unpol.mul( 0.8 ).add( 0.2 ) );

	// Squames and melanin granules.
	const C = cells( vec2( g.x.mul( 0.6 ), gy ), fp, cm.mul( 0.6 ), cm.mul( 0.02 ), s.mul( 3.9 ), 0.15, 0.06 );
	const mel = step( 0.8, hash1( floor( wrapCoord( p.div( 1.5e-6 ) ) ) ) ).mul( fadeIn( float( 3e-6 ), fp, 2.0, 5.0 ) ).mul( dark );

	// Colour.
	let color = u.color.mul( fbm( p, float( 0.03 ), fp, 3, 9 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	color = mix( color, u.color4, pale.mul( 0.7 ) );
	color = mix( color, u.color3, bandM.mul( 0.2 ) );
	color = mix( color, u.color2.mul( st2.mul( 0.6 ).add( 0.7 ) ), dark );
	color = color.mul( tub.mul( 0.25 ).add( 1 ) ).mul( fib.sub( 0.5 ).mul( 0.25 ).add( 1 ) ).mul( float( 1 ).sub( stepE.mul( 0.15 ) ) ).mul( float( 1 ).sub( C.wall.mul( 0.15 ) ) );
	color = color.mul( float( 1 ).sub( mel.mul( 0.5 ) ) );
	const scr = scratches( p, fp, float( 3e-4 ), 8e-7, u.polish.mul( 0.4 ), 2 ).add( scratches( p, fp, float( 1e-3 ), 2e-6, u.polish.mul( 0.25 ), 6 ) ).min( 1 );
	color = color.mul( scr.mul( 0.1 ).add( 1 ) );

	const slope = sLayer.add( sBand.mul( unpol.mul( 0.8 ).add( 0.2 ) ) ).add( sRidge.mul( unpol.mul( 0.7 ).add( 0.3 ) ) )
		.add( C.slope.mul( unpol.mul( 0.5 ).add( 0.1 ) ) ).add( ay.mul( tub.mul( 0.04 ) ) );
	const rough = mix( float( 0.55 ), float( 0.1 ), u.polish ).add( scr.mul( 0.15 ) ).mul( u.roughness.div( 0.25 ) ).clamp( 0.05, 1 );
	const cavity = stepE.mul( 0.4 ).max( bandM.mul( 0.2 ).mul( unpol ) );
	const s2 = float( 1 ).sub( wR ).mul( 0.002 ).mul( unpol ).add( float( 1 ).sub( wL ).mul( 0.002 ).mul( unpol ) );
	// Translucent keratin: the light that crossed it comes out amber;
	// melanin streaks block it.
	const glow = u.color.mul( vec3( 1.2, 0.85, 0.45 ) ).mul( float( 1 ).sub( dark.mul( 0.9 ) ) ).add( u.color4.mul( pale ).mul( 0.4 ) );
	return { color: clamp( color, 0, 1 ), slope, cavity, rough, s2, glow };

}
