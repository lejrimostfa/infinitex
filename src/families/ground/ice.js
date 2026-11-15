// Clear lake ice, seen into its depth.
// True transmission would need the scene behind; the cube is solid, so
// the depth is faked: each layer under the surface is drawn with a
// parallax offset along the refracted view ray (n = 1.31), so bubbles and
// cracks slide against the surface as the camera moves.
//   L0 body      dark blue green depth, milky clouds; white fracture
//                planes 2 to 8 cm apart, some with a glowing plane beside
//                them; frosted skate scratches, long arcs 0.2 to 1 mm wide
//   L1 bubbles   air trapped as the water froze: round bubbles 0.3 to 3 mm
//                at 3 and 8 mm depth, a dark refracting rim, a bright core
//   L2 strings   lines of tiny bubbles (20 to 100 um) frozen in columns;
//                fine scratches (5 to 20 um) on the surface
// Returns { color, slope, cavity, rough, s2, coat, coatRough } for shader.js.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, mod, positionView, tangentView, bitangentView, normalView } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { fbm, fibres, line } from './grains.js';

// One bubble per cell at most (cell: spacing, meters). Returns cover and
// the look of a bubble in water ice: dark rim (light bent away), bright
// core and a small highlight.
function bubbles( q, cell, share, rMax, fp, salt ) {

	const c = mod( q.div( cell ), 4096 );
	const id = floor( c );
	const h = hash3( id.add( salt ) );
	const ctr = id.add( 0.5 ).add( h.xy.sub( 0.5 ).mul( 0.4 ) );
	const r = h.z.mul( h.z ).mul( rMax - 0.05 ).add( 0.05 ).mul( cell );
	const dv = c.sub( ctr ).mul( cell );
	const d = dv.length();
	const on = step( hash3( id.add( salt + 9.1 ) ).x, share );
	const disc = clamp( r.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
	const t = d.div( r.max( 1e-9 ) ).clamp( 0, 1 );
	const rim = smoothstep( 0.55, 0.95, t ).mul( disc );
	const spot = smoothstep( 0.3, 0.0, dv.sub( r.mul( vec2( - 0.3, 0.35 ) ) ).length().div( r.max( 1e-9 ) ) ).mul( disc );
	return { disc, rim, spot, wide: fadeIn( r.mul( 2 ), fp, 1.0, 3.0 ) };

}

export function buildIce( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	// Refracted view ray in the surface frame.
	const vd = positionView.normalize().negate();
	const vt = vec3( vd.dot( tangentView ), vd.dot( bitangentView ), vd.dot( normalView ).max( 0.2 ) );
	const shift = ( depth ) => p.sub( vt.xy.div( vt.z ).mul( depth / 1.31 ) );

	// L0: depth colour and milky clouds.
	const cloud = smoothstep( 0.45, 0.8, fbm( shift( 0.01 ).div( 0.06 ).add( s ), 3 ) );
	let color = mix( u.color3, u.color.mul( 0.4 ), cloud.mul( 0.3 ) );

	// Fracture planes at 5 mm depth.
	const pc = shift( 0.005 );
	const V = voronoi( pc.div( 0.05 ).add( s.mul( 4.7 ) ), 0.9 );
	const eM = V.edge.mul( 0.05 );
	const crackOn = smoothstep( 0.5, 0.62, fbm( pc.div( 0.05 ).add( 2.2 ), 2 ) ).mul( u.cracks.mul( 1.4 ) ).min( 1 );
	const crack = line( eM, u.crackM.mul( 0.25 ), fp ).mul( crackOn );
	const plane = smoothstep( u.crackM.mul( 4 ), 0, eM ).pow( 2 ).mul( step( 0.5, hash3( V.id1 ).x ) ).mul( crackOn ).mul( 0.3 );
	// Feathered edges: small side fractures along the main crack.
	const side = line( fract( pc.dot( V.dir.yx.mul( vec2( 1, - 1 ) ) ).div( u.crackM.mul( 1.5 ) ) ).sub( 0.5 ).mul( u.crackM.mul( 1.5 ) ), u.crackM.mul( 0.08 ), fp )
		.mul( smoothstep( u.crackM.mul( 2.5 ), 0, eM ) ).mul( crackOn ).mul( fadeIn( u.crackM, fp, 2.0, 5.0 ) );
	color = mix( color, u.color2, crack.max( plane ).max( side.mul( 0.7 ) ) );

	// L1: bubbles at two depths.
	const B1 = bubbles( shift( 0.008 ), g.mul( 3 ), u.bubbles.mul( 0.35 ), 0.3, fp, 1.3 );
	const B2 = bubbles( shift( 0.003 ), g, u.bubbles.mul( 0.5 ), 0.28, fp, 5.9 );
	for ( const B of [ B1, B2 ] ) {

		const look = mix( u.color.mul( 0.6 ), u.color3.mul( 0.4 ), B.rim ).add( B.spot.mul( 0.8 ) );
		color = mix( color, mix( u.color.mul( 0.5 ), look, B.wide ), B.disc );

	}

	// L2: strings of tiny bubbles, frozen in vertical columns.
	const ps = shift( 0.0015 );
	const colW = g.mul( 0.4 );
	const col = floor( ps.x.div( colW ) );
	const ch = hash3( vec2( mod( col, 4096 ), floor( ps.y.div( g.mul( 8 ) ) ) ).add( s ) );
	const inCol = step( ch.x, u.bubbles.mul( 0.25 ) );
	const B3 = bubbles( vec2( ps.x.sub( col.mul( colW ) ).add( colW.mul( 0.5 ) ).sub( colW.mul( ch.y ) ), ps.y ), g.mul( 0.06 ), float( 0.9 ), 0.35, fp, 7.7 );
	const str = B3.disc.mul( inCol ).mul( step( ps.x.sub( col.mul( colW ) ).sub( colW.mul( ch.y ) ).abs(), g.mul( 0.04 ) ) );
	color = mix( color, mix( u.color.mul( 0.6 ), u.color3.mul( 0.5 ), B3.rim ).add( B3.spot.mul( 0.6 ) ), str );

	// Scratches on the surface: frosted, white, rough.
	const S1 = fibres( p, float( 0.06 ), u.crackM.mul( 0.3 ), u.scratches.mul( 0.6 ), fp, 3.3, 0.08 );
	// A skate cut is not clean: frost chips break it into grains.
	const chips = smoothstep( 0.3, 0.7, fbm( p.div( u.crackM.mul( 0.15 ) ).add( 4.1 ), 2 ) ).mul( fadeIn( u.crackM.mul( 0.15 ), fp, 2.0, 5.0 ) );
	const S2 = fibres( p, float( 0.004 ), float( 1.2e-5 ), u.scratches, fp, 8.1, 0.05 );
	const wS2 = fadeIn( float( 2.4e-5 ), fp, 1.0, 3.0 );
	const scratch = S1.fiber.mul( float( 0.8 ).sub( chips.mul( 0.45 ) ) ).max( S2.fiber.mul( wS2 ).mul( 0.7 ) ).max( wS2.oneMinus().mul( u.scratches ).mul( 0.06 ) );
	color = mix( color, u.color2.mul( 0.85 ), scratch );

	const melt = vec2( fbm( p.div( 0.03 ).add( 1.7 ), 2 ), fbm( p.div( 0.03 ).add( 8.3 ), 2 ) ).sub( 0.5 ).mul( 0.04 );
	const slope = melt.add( S1.slope.mul( 0.3 ) ).add( S2.slope.mul( 0.3 ).mul( wS2 ) );
	const rough = mix( u.roughness, float( 0.55 ), scratch );
	const s2 = float( 0.002 ).add( wS2.oneMinus().mul( u.scratches ).mul( 0.01 ) );
	return { color, slope, cavity: crack.mul( 0.3 ), rough, s2, coat: float( 1 ).sub( scratch.mul( 0.7 ) ), coatRough: mix( float( 0.03 ), float( 0.4 ), scratch ) };

}
