// Fossil resin: amber.
// Amber (polished Baltic amber, seen through: transmission):
//   L0 resin     honey to cognac, flow bands of a darker tint where
//                successive flows of resin set; a few sun spangles
//                (disc cracks of size_mm with a golden rim)
//   L1 debris    trapped bits: plant hairs, dark specks, bubbles of
//                0.2 to 1 mm (bright rim, clear inside)
//   L2 polish    micro bubbles (cell_um), polishing scratches
// Petrified wood and coal: mineral.js.
// Returns { color, slope, cavity, rough, s2, coat, transmission... }.

import { vec2, vec3, float, mix, smoothstep, step } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { scratchMarks } from '../../core/marks.js';
import { bubbleField, capSlope } from '../ceramic/bubbles.js';
import { fbm, fibres, grains, warp2 } from './common.js';

export function buildAmber( p, fp, u ) {

	const s = u.seed;
	const w = p.add( warp2( p, float( 0.08 ), 2.1 ).mul( 0.04 ) );
	const flow = fbm( vec2( w.x.div( 3 ), w.y ), float( 0.05 ), fp, 4, 3 );
	let color = mix( u.color, u.color2, smoothstep( 0.35, 0.7, flow ) );
	// Sun spangles: disc cracks with a bright golden rim.
	const Sg = bubbleField( p.add( s.mul( 0.01 ) ), fp, u.sizeM.mul( 4 ), u.density.mul( 0.4 ), 5 );
	const spangle = Sg.inside.mul( smoothstep( 0.2, 1.0, Sg.d ) ).mul( 0.6 ).add( Sg.rim.mul( 0.3 ) ).min( 1 );
	color = mix( color, vec3( 1.0, 0.75, 0.35 ), spangle.mul( 0.6 ) );
	// L1: debris and bubbles.
	const H = fibres( p, u.featureM.mul( 4 ), u.fiberM, u.dust, fp, 9.1, 0.8 );
	const G = grains( p, u.featureM, fp, 4.7, { gap: 0.35, radius: 0.22, round: 0.4 } );
	const speck = G.body.mul( step( 1 - 0.1, G.id.x ) ).mul( u.dust.mul( 2 ).min( 1 ) ).mul( fadeIn( u.featureM, fp, 1.0, 3.0 ) );
	const debris = H.fiber.max( speck );
	color = mix( color, u.color3, debris.mul( 0.9 ) );
	let slope = vec2( 0 );
	for ( const [ k, dens, sl ] of [ [ 2, 0.3, 3 ], [ 0.6, 0.5, 13 ], [ 0.15, 0.7, 23 ] ] ) {

		const B = bubbleField( p, fp, u.featureM.mul( k ), u.bubbles.mul( dens ), sl );
		color = color.mul( float( 1 ).add( B.inside.mul( 0.2 ).sub( B.rim.mul( 0.5 ) ).mul( B.fade ) ) );

	}

	const S = scratchMarks( p, fp, float( 0.003 ), float( 2e-6 ), 2.2, { density: 0.4 } );
	slope = slope.add( S.slope.mul( 0.3 ) ).add( capSlope( Sg.v, Sg.d ).mul( 0.03 ).mul( Sg.inside ) );
	const transmission = float( 1 ).sub( debris ).mul( float( 1 ).sub( spangle.mul( 0.4 ) ) ).mul( u.translucency );
	return { color, slope: slope.mul( u.relief ), cavity: float( 0 ), rough: u.roughness, s2: float( 0.001 ), coat: float( 1 ), coatRough: float( 0.03 ),
		transmission, thickness: float( 0.03 ), ior: float( 1.54 ), attenColor: u.color2, attenDist: float( 0.015 ) };

}
