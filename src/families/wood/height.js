// Height of wood for the relief march (core/relief.js), in metres below
// the top surface. Only what the preset uses is compiled in:
//   rings   sun and rain wash out the soft earlywood; the latewood stands
//           in ridges about 25 percent of a ring high (1 mm on 4 mm
//           rings). Brushed char does the same.
//   pores   vessels cut open: round-bottomed grooves, 60 percent of the
//           vessel diameter deep (about 150 um in oak)
//   checks  drying cracks, V-shaped, up to 2.5 mm deep
//   char    crazed blocks of charcoal, domed, with cracks between them
//   bark    plates and fissures from bark.js (centimetres deep)
// No screen derivatives here: this runs inside the march loop. The knot
// bulge is taken once at the pixel: it changes over centimetres, far more
// than the parallax shift.

import { vec2, float, fract, smoothstep, clamp } from 'three/tsl';
import { valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { grainFrame, knotField, ringPhase, latewoodProfile, poreField } from './board.js';
import { checkField } from './finish.js';
import { barkPlates } from './bark.js';

export function woodHeight( u, p, fp ) {

	if ( u.mode === 'bark' ) {

		const H = u.ridgeM.mul( u.fissure.mul( 0.25 ).add( 0.046 ) );
		return { H, h: ( q ) => barkPlates( q, u, fp ).height.sub( H ) };

	}

	if ( u.mode !== 'board' ) return null;
	const rings = u.weather.value > 0 || ( u.char.value > 0 && u.brushed.value > 0 );
	const pores = u.pores.value > 0 && u.poreM.value > 0;
	const checks = u.checks.value > 0, char = u.char.value > 0;
	if ( ! rings && ! pores && ! checks && ! char ) return null;

	const P0 = grainFrame( p, u );
	const bump = knotField( P0.x, P0.y, u ).bump.toVar( 'ix_wood_bump' );
	const aR = u.ringM.mul( 0.25 ).mul( u.weather.add( u.char.mul( u.brushed ) ).min( 1 ) );
	const aP = u.poreM.mul( 0.6 ).mul( u.pores.min( 1 ) );
	const aC = float( 2.5e-3 ), aK = u.charM.mul( 0.06 ).mul( u.char );
	let H = float( 1e-9 );
	if ( rings ) H = H.add( aR );
	if ( pores ) H = H.add( aP );
	if ( checks ) H = H.add( aC );
	if ( char ) H = H.add( aK );

	const h = ( q ) => {

		const { x, y } = grainFrame( q, u );
		let z = float( 0 );
		const phase = rings || pores ? ringPhase( x, y, u, bump ) : null;
		if ( rings ) {

			// Earlywood carved out, its floor a little uneven along the grain.
			const late = latewoodProfile( phase, u ).late;
			z = z.sub( late.oneMinus().mul( valueNoise( vec2( x.div( 0.004 ), y.div( 0.0006 ) ) ).mul( 0.3 ).add( 0.7 ) ).mul( aR ) );

		}

		if ( pores ) {

			const P = poreField( x, y, fract( phase ), u );
			const g = clamp( float( 1 ).sub( P.ps.div( P.taper.max( 1e-3 ) ).pow( 2 ) ), 0, 1 ).sqrt().mul( P.on );
			z = z.sub( g.mul( aP ) );

		}

		if ( checks ) {

			const C = checkField( x, y, u );
			z = z.sub( clamp( float( 1 ).sub( C.cs.abs().div( C.cw.max( 1e-6 ) ) ), 0, 1 ).mul( C.on ).mul( aC ) );

		}

		if ( char ) {

			const cv = voronoi( vec2( x.div( u.charM.mul( 1.5 ) ), y.div( u.charM ) ).add( u.seed.mul( 5 ) ), 0.8 );
			const crack = clamp( float( 1 ).sub( cv.edge.mul( u.charM ).div( 6e-4 ) ), 0, 1 );
			z = z.sub( smoothstep( 0.0, 0.4, cv.edge ).oneMinus().mul( aK.mul( 0.6 ) ) ).sub( crack.mul( aK.mul( 0.4 ) ) );

		}

		return z.max( H.negate() );

	};

	return { H, h };

}
