// Plaster: gypsum or lime paste spread with a steel trowel, set hard.
//   L0 strokes  each pass of the trowel (trowel_mm) leaves a patch at its
//               own tilt, a little burnished (smoother, lighter), with a
//               soft lip where it overlaps the last pass (trowel)
//   L1 drag     faint striations along the stroke where fine grains were
//               dragged; pinholes 50 to 300 um where air escaped (pores)
//   L2 crystals gypsum needles 10 to 40 um tangled in the set paste; the
//               chalky matte comes from them
// color = plaster, color2 = burnished tint.

import { vec2, float, fract, mix, smoothstep, step, clamp, mod } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, scratches, fbm, grains } from './common.js';

export function buildPlaster( p, fp, u ) {

	const s = u.seed, T = u.trowelM;
	// Strokes: arcs swept by the hand, so warp the stroke cells strongly.
	const warp = vec2( fbm( p, T.mul( 1.2 ), fp, 3, 1 ), fbm( p, T.mul( 1.2 ), fp, 3, 2 ) ).sub( 0.5 ).mul( T ).mul( 0.9 );
	const V = voronoi( p.add( warp ).div( T ).add( s.mul( 4.4 ) ), 0.9 );
	const h = hash3( V.id1.add( 1.1 ) ).toVar();
	const wS = fadeIn( T, fp, 1.5, 4.0 );
	const tr = u.trowel;
	// Each stroke tilts a little and is burnished in places.
	const tilt = h.xy.sub( 0.5 ).mul( 0.08 ).mul( tr );
	const burnish = smoothstep( 0.45, 0.8, valueNoise( p.div( T.mul( 0.35 ) ).add( h.xz.mul( 20 ) ) ) ).mul( h.z ).mul( tr ).toVar();
	// The lip: the newer stroke (higher hash) ends in a soft ridge.
	const newer = step( hash1( V.id2.add( 1.1 ) ), h.x );
	const lipW = float( 1.2e-3 );
	const lip = band( V.edge.mul( T ).sub( lipW ), lipW, fp.max( 4e-4 ) ).mul( smoothstep( 0, lipW.mul( 2 ), V.edge.mul( T ) ).oneMinus().mul( 0.3 ).add( 0.7 ) ).mul( newer ).mul( tr ).mul( wS );
	// Drag lines along the stroke direction.
	const sd = dir2( h.y.mul( 6.283 ) );
	const along = p.dot( sd ), across = p.dot( vec2( sd.y.negate(), sd.x ) );
	const drag = valueNoise( wrapCoord( vec2( along.div( 0.01 ), across.div( 1.5e-4 ) ) ).add( h.xy.mul( 30 ) ) ).sub( 0.5 ).mul( fadeIn( float( 1.5e-4 ), fp, 1.5, 4.0 ) ).mul( tr );

	// Sweep arcs: the blade turns about the wrist, leaving faint chatter
	// arcs around a centre one stroke length away.
	const ctr = V.p1.add( dir2( h.x.mul( 6.283 ) ).mul( 1.6 ) );
	const arcR = p.add( warp ).div( T ).add( s.mul( 4.4 ) ).sub( ctr ).length();
	const arcs = fract( arcR.div( 0.07 ).add( valueNoise( vec2( arcR.mul( 8 ), h.y.mul( 40 ) ) ).mul( 0.5 ) ) );
	const chatter = smoothstep( 0.0, 0.5, arcs ).mul( smoothstep( 1.0, 0.5, arcs ) ).sub( 0.5 ).mul( fadeIn( T.mul( 0.07 ), fp, 2.0, 5.0 ) ).mul( tr ).mul( h.z.mul( 0.7 ).add( 0.3 ) );

	// Pinholes, and a finer crop of pits 10 to 40 um.
	const P = voronoi( wrapCoord( p.div( 1.2e-3 ) ).add( 3.7 ), 0.85 );
	const pr = hash1( P.id1 ).pow( 2 ).mul( 1.3e-4 ).add( 2.5e-5 );
	const P2 = voronoi( wrapCoord( p.div( 2.5e-4 ) ).add( 8.1 ), 0.85 );
	const pr2 = hash1( P2.id1 ).mul( 1.5e-5 ).add( 5e-6 );
	const pin = band( P.toSeed.length().mul( 1.2e-3 ), pr, fp ).mul( step( float( 1 ).sub( u.pores.mul( 0.6 ) ), hash1( P.id1.add( 6.6 ) ) ) ).mul( fadeIn( pr.mul( 2 ), fp, 1.0, 3.0 ) )
		.max( band( P2.toSeed.length().mul( 2.5e-4 ), pr2, fp ).mul( step( float( 1 ).sub( u.pores.mul( 0.4 ) ), hash1( P2.id1.add( 2.6 ) ) ) ).mul( fadeIn( pr2.mul( 2 ), fp, 1.0, 3.0 ) ) ).toVar();

	// Gypsum needles, two tangled layers.
	const needle = scratches( p, fp, float( 5e-5 ), 2.5e-6, 0.8, 5 ).add( scratches( p, fp, float( 3e-5 ), 1.8e-6, 0.7, 6 ) ).min( 1 );
	// Filler grains (calcite, fine sand) 30 to 80 um, a faint mosaic.
	const Fg = grains( p, float( 6e-5 ), fp, 0.08, 3, 0.95 );
	const chalk = valueNoise( wrapCoord( p.div( 5e-6 ) ) ).sub( 0.5 ).mul( fadeIn( float( 5e-6 ), fp, 2.0, 5.0 ) );

	const mott = fbm( p, float( 0.06 ), fp, 4, 3 ).sub( 0.5 ).mul( u.colorVar ).add( 1 );
	let color = u.color.mul( mott ).mul( h.z.sub( 0.5 ).mul( u.colorVar ).mul( wS ).add( 1 ) );
	color = mix( color, u.color2, burnish.mul( 0.7 ) );
	color = color.mul( float( 1 ).add( drag.mul( 0.2 ) ).sub( lip.mul( 0.12 ) ).add( chatter.mul( 0.08 ) ).add( Fg.h.z.sub( 0.5 ).mul( 0.12 ).mul( Fg.soft ).mul( Fg.w ) ) ).mul( float( 1 ).sub( pin.mul( 0.6 ) ) );
	color = color.mul( float( 1 ).add( needle.mul( 0.3 ) ).add( chalk.mul( 0.18 ) ) );

	const height = lip.mul( 1.5e-4 ).add( chatter.mul( 1.5e-5 ) ).sub( pin.mul( 6e-5 ) ).add( drag.mul( 3e-6 ) ).add( needle.mul( 6e-7 ) );
	const slope = surfaceGradient( height, p ).add( tilt.mul( wS ) ).add( Fg.slope.mul( 0.15 ) );
	const rough = u.roughness.sub( burnish.mul( 0.45 ) ).add( pin.mul( 0.1 ) ).clamp( 0.1, 1 );
	const cavity = pin.max( drag.abs().mul( 0.5 ) );
	return { color: clamp( color, 0, 1 ), slope, cavity, rough, s2: fadeIn( float( 1.5e-4 ), fp, 1.5, 4.0 ).oneMinus().mul( 0.004 ) };

}
