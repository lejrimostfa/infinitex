// Mucus, slime: a clear gel spread on a dark wet surface.
//   L0 sheet    a sheet of gel of uneven thickness (0.2 to 2 mm), clear
//               where thin, milky and yellow green where thick (mucin
//               scatters light, Beer law for the tint); drawn-out strings
//               and cords (feature_mm wide) stretched along `angle`
//   L1 bubbles  air caught in the gel in three sizes (size_mm down to a
//               fifth of it): clear domes with a bright rim and a dark ring
//   L2 threads  mucin threads (fiber_um) and cell debris (cell_um) held in
//               the gel, micro bubbles of 30 to 80 um
// The whole surface is a liquid: a mirror clear coat, light through it.
// Returns { color, slope, cavity, rough, s2, coat, coatRough, glow }.

import { vec2, vec3, float, mix, smoothstep, step } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { valueNoise } from '../../core/hash.js';
import { bubbleField, capSlope } from '../ceramic/bubbles.js';
import { absorb } from '../ceramic/glaze.js';
import { rot2, fbm, ridged, fibres, grains, warp2 } from './common.js';

// Gel thickness in mm at a point (sheet plus cords), no derivatives.
function gel( q, fp, u ) {

	const a = rot2( q, u.angle );
	const sheet = fbm( q, float( 0.08 ), fp, 4, 2 ).sub( 0.3 ).max( 0 ).mul( 2.5 );
	const w = a.add( warp2( a, float( 0.04 ), 2.2 ).mul( 0.03 ) );
	const R = ridged( vec2( w.x.div( 3 ), w.y ), u.featureM.mul( 20 ), fp, 1, 6.6 );
	const cord = smoothstep( 0.9, 1.0, R.h ).mul( 1.0 ).mul( smoothstep( 0.4, 0.6, valueNoise( q.div( 0.05 ) ) ) );
	return sheet.add( cord ).add( 0.05 );

}

export function buildMucus( p, fp, u ) {

	const e = float( 2e-4 );
	const h = gel( p, fp, u ).toVar();
	const hx = gel( p.add( vec2( e, 0 ) ), fp, u ), hy = gel( p.add( vec2( 0, e ) ), fp, u );
	let slope = vec2( hx.sub( h ), hy.sub( h ) ).div( e ).mul( 1e-3 ).mul( u.relief );

	// The surface under the gel: dark, wet, a soft mottle.
	const under = u.color3.mul( fbm( p.add( 1.1 ), float( 0.03 ), fp, 4, 5 ).mul( 0.5 ).add( 0.75 ) );
	let color = absorb( under, u.color, h.min( 3 ) );
	// Mucin scatters: thick gel goes milky.
	color = mix( color, u.color2, smoothstep( 0.3, 2.0, h ).mul( u.translucency.oneMinus().mul( 0.6 ).add( 0.2 ) ) );

	// L1: bubbles in three sizes, more where the gel is thick.
	const thick = smoothstep( 0.1, 0.6, h );
	for ( const [ k, dens, sl ] of [ [ 1, 0.35, 3 ], [ 0.45, 0.5, 9 ], [ 0.2, 0.7, 21 ] ] ) {

		const B = bubbleField( p, fp, u.sizeM.mul( k ), u.bubbles.mul( dens ), sl );
		const on = B.inside.mul( thick );
		const spot = smoothstep( 0.3, 0.05, B.v.sub( vec2( - 0.35, 0.35 ) ).length() ).mul( on );
		color = color.mul( float( 1 ).add( on.mul( 0.25 ).sub( B.rim.mul( thick ).mul( 0.35 ) ).mul( B.fade ) ) ).add( spot.mul( B.fade ).mul( 0.3 ) );
		slope = slope.add( capSlope( B.v, B.d ).mul( 0.45 ).mul( on ).mul( B.fade ) );

	}

	// L2: mucin threads and debris, held in the gel (colour only).
	const T = fibres( p, u.fiberM.mul( 60 ), u.fiberM, float( 0.6 ), fp, 7.7, 0.6 );
	const Dg = grains( p, u.cellM, fp, 4.4, { gap: 0.3, radius: 0.35, round: 0.4 } );
	const deb = Dg.body.mul( step( 0.85, Dg.id.x ) ).mul( fadeIn( u.cellM, fp, 2.0, 5.0 ) );
	color = mix( color, u.color2.mul( 1.1 ), T.fiber.mul( 0.25 ).mul( thick ) );
	color = mix( color, u.color.mul( 0.6 ), deb.mul( 0.4 ) );
	const MB = bubbleField( p, fp, float( 2e-4 ), u.bubbles, 33 );
	color = color.mul( float( 1 ).add( MB.inside.mul( 0.15 ).sub( MB.rim.mul( 0.3 ) ).mul( MB.fade ).mul( thick ) ) );
	slope = slope.add( capSlope( MB.v, MB.d ).mul( 0.3 ).mul( MB.inside ).mul( MB.fade ) );
	const glow = mix( u.color, u.color2, 0.5 );
	return { color, slope, cavity: float( 0 ), rough: u.roughness, s2: float( 0 ), coat: float( 1 ), coatRough: float( 0.03 ), glow };

}
