// Drying mud flat.
//   L0 plates    the mud shrinks as it dries and cracks into polygons of
//                3 to 10 cm; cracks 1 to 5 mm wide, dark and deep. The
//                top dries first and shrinks more, so each plate curls up
//                at its edges. Edges dry pale; some plates are still wet
//                at heart (dark, glossy).
//   L1 crust     second-order cracks (1 to 2 cm cells, thin and shallow),
//                a craquelure of 3 to 5 mm on the dry crust, pinholes left
//                by air bubbles, a few sand grains
//   L2 silt      silt grains (10 to 50 um) and flat clay platelets that
//                catch the light
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { grains, fbm, line } from './grains.js';

export function buildMud( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	// Cracks wander: bend the coordinates before the cell search.
	const warp = vec2( fbm( p.div( g.mul( 0.5 ) ).add( s ), 2 ), fbm( p.div( g.mul( 0.5 ) ).add( s.add( 7.3 ) ), 2 ) ).sub( 0.5 ).mul( g.mul( 0.35 ) );
	const pw = p.add( warp );
	const V = voronoi( pw.div( g ).add( s.mul( 3.1 ) ), 0.9 );
	const id = hash3( V.id1.add( 1.9 ) );
	const eM = V.edge.mul( g ); // distance to the crack centre, meters
	// Crack width varies along each crack.
	const cw = u.crackM.mul( valueNoise( pw.div( g.mul( 0.15 ) ).add( 4.2 ) ).mul( 0.9 ).add( 0.4 ) ).mul( 0.5 );
	const crack = line( eM, cw, fp ).toVar();
	const wP = fadeIn( g, fp, 1.0, 3.0 );
	// Curl: the lip rises over the last 15 % of the plate, a soft dome inside.
	const lipW = g.mul( 0.15 );
	const lt = clamp( eM.sub( cw ).div( lipW ), 0, 1 );
	const lip = lt.oneMinus().pow( 2 ).mul( step( 0, eM.sub( cw ) ) );
	const dLip = lt.oneMinus().mul( 2 ).div( lipW ).mul( step( lt, 0.999 ) ).mul( step( 0, eM.sub( cw ) ) );
	const lift = u.curl.mul( id.x.mul( 0.6 ).add( 0.6 ) ).mul( u.relief ).mul( 0.06 ).mul( g ); // lip height, meters
	const slopePlate = V.dir.mul( dLip.mul( lift ) ).mul( wP );

	// Moisture: wet plates dark at heart, every edge dry and pale.
	const wetPlate = step( id.y, u.wet );
	const heart = smoothstep( 0.05, 0.3, V.edge );
	const moist = wetPlate.mul( heart ).mul( id.z.mul( 0.5 ).add( 0.5 ) ).toVar();
	let color = mix( u.color2, u.color, smoothstep( 0.02, 0.25, V.edge ).mul( 0.6 ) );
	color = mix( color, u.color.mul( 0.45 ), moist ).mul( id.x.mul( 0.15 ).add( 0.92 ) );
	color = color.mul( fbm( p.div( 0.02 ).add( 2.7 ), 2 ).sub( 0.5 ).mul( 0.2 ).add( 1 ) );

	// L1: second-order cracks, craquelure on the dry crust, pinholes.
	const V2 = voronoi( pw.div( g.mul( 0.3 ) ).add( 5.5 ), 0.9 );
	const c2 = line( V2.edge.mul( g.mul( 0.3 ) ), u.crackM.mul( 0.12 ), fp )
		.mul( smoothstep( 0.45, 0.6, valueNoise( pw.div( g.mul( 0.12 ) ).add( 1.1 ) ) ) ).mul( fadeIn( g.mul( 0.3 ), fp, 2.0, 5.0 ) );
	const V3 = voronoi( mod( pw.div( g.mul( 0.07 ) ), 4096 ).add( 8.8 ), 0.85 );
	const dry = moist.oneMinus().mul( smoothstep( 0.15, 0.02, V.edge ).mul( 0.6 ).add( 0.4 ) );
	const c3 = line( V3.edge.mul( g.mul( 0.07 ) ), g.mul( 3e-4 ), fp ).mul( dry ).mul( fadeIn( g.mul( 0.07 ), fp, 2.0, 6.0 ) ).mul( 0.7 );
	// Finer crazing of the skin, 0.5 to 1 mm cells.
	const V4 = voronoi( mod( pw.div( g.mul( 0.012 ) ), 4096 ).add( 6.1 ), 0.85 );
	const c4 = line( V4.edge.mul( g.mul( 0.012 ) ), g.mul( 1.2e-4 ), fp ).mul( dry ).mul( fadeIn( g.mul( 0.012 ), fp, 2.0, 6.0 ) )
		.mul( smoothstep( 0.35, 0.55, valueNoise( pw.div( g.mul( 0.03 ) ) ) ) );
	const pin = grains( p, g.mul( 0.012 ), fp, 2.2, { gap: 0.3, radius: 0.15, round: 0.15 } );
	const hole = step( 0.9, pin.id.x ).mul( pin.body ).mul( fadeIn( g.mul( 0.004 ), fp, 2.0, 5.0 ) );
	color = color.mul( float( 1 ).sub( c2.mul( 0.55 ) ).sub( c3.mul( 0.35 ) ).sub( c4.mul( 0.4 ) ).sub( hole.mul( 0.5 ) ) );

	// L2: silt grains and clay platelets.
	const wS = fadeIn( g.mul( 4e-4 ), fp, 2.0, 6.0 ).toVar();
	const S = voronoi( mod( p.div( g.mul( 4e-4 ) ), 4096 ).add( 3.3 ), 0.9 );
	const sh = hash3( S.id1.add( 2.2 ) );
	color = color.mul( sh.z.sub( 0.5 ).mul( 0.4 ).mul( wS ).add( 1 ) ).mul( float( 1 ).sub( smoothstep( 0.1, 0.0, S.edge ).mul( 0.3 ).mul( wS ) ) );
	const silt = fbm( p.div( g.mul( 1.5e-3 ) ), 3 );
	color = color.mul( silt.sub( 0.5 ).mul( 0.45 ).mul( fadeIn( g.mul( 1.5e-3 ), fp, 2.0, 6.0 ) ).add( 1 ) );

	// The crack: a dark slot under the lip.
	const deep = u.color3.mul( valueNoise( p.div( 0.002 ) ).mul( 0.4 ).add( 0.6 ) );
	// The lip shades the crust next to the crack.
	const shade = smoothstep( lipW.mul( 0.25 ), cw, eM ).mul( 0.35 );
	color = mix( color, deep, crack.max( shade ).mul( wP.mul( 0.7 ).add( 0.3 ) ) );

	const slope = slopePlate
		.add( vec2( valueNoise( p.div( g.mul( 0.02 ) ) ), valueNoise( p.div( g.mul( 0.02 ) ).add( 9.1 ) ) ).sub( 0.5 ).mul( 0.25 ).mul( fadeIn( g.mul( 0.02 ), fp, 2.0, 6.0 ) ) )
		.add( pin.grad.mul( - 0.3 ).mul( hole ) )
		.add( V3.dir.mul( smoothstep( 0.12, 0.0, V3.edge ) ).mul( 0.25 ).mul( dry ).mul( fadeIn( g.mul( 0.07 ), fp, 2.0, 6.0 ) ) )
		.add( sh.xy.sub( 0.5 ).mul( 0.6 ).mul( wS ) )
		.add( V4.dir.mul( smoothstep( 0.15, 0.0, V4.edge ) ).mul( 0.3 ).mul( c4.max( 0.001 ).sign() ).mul( dry ).mul( fadeIn( g.mul( 0.012 ), fp, 2.0, 6.0 ) ) );
	// Clay platelets lying flat shine a little.
	const flake = step( 0.85, sh.x ).mul( wS );
	const rough = mix( u.roughness, float( 0.25 ), moist.mul( 0.9 ) ).sub( flake.mul( 0.3 ) );
	const s2 = float( 0.01 ).add( wS.oneMinus().mul( 0.03 ) );
	const cavity = crack.max( c2.mul( 0.7 ) ).max( c3.mul( 0.4 ) ).max( c4.mul( 0.4 ) ).max( hole );
	return { color, slope, cavity, rough, s2 };

}
