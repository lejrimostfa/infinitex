// Furrowed bark (oak, pine, poplar): the outer bark splits as the trunk
// grows, so plates long along the trunk stand between deep fissures.
//   L0 plates    long Voronoi cells along the trunk, domed, stacked flakes
//                that break across the plate in steps
//   L0 fissures  V-shaped valleys between plates, darker and redder
//   L1 lichen    grey-green patches on the plate tops, with tiny cups
//   L2 cells     cork cells on every face, fibres along the fissures
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, float, floor, fract, mix, smoothstep, step, clamp, mod } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { grainFrame } from './board.js';

// Plates and fissures. height: metres above the fissure floor, at most
// R * (0.25 fissure + 0.046). No screen derivatives: the relief march
// calls it in a loop.
export function barkPlates( p, u, fp ) {

	const R = u.ridgeM, s = u.seed;
	const { x, y } = grainFrame( p, u );
	// Plates: three times longer along the trunk, a meandering split.
	const wq = vec2( x.div( R.mul( 3 ) ), y.div( R ) );
	const warp = vec2( 0, valueNoise( wq.mul( vec2( 2, 1 ) ).add( s ) ).sub( 0.5 ).mul( 0.5 ) );
	const V = voronoi( wq.add( warp ).add( s.mul( 3 ) ), 0.85 );
	const hp = hash3( V.id1.add( 6.6 ) );
	// Valley profile: V-shaped, its width varies along the fissure.
	const fw = valueNoise( vec2( x.div( R.mul( 0.8 ) ), V.id1.y ) ).mul( 0.12 ).add( 0.1 );
	const t = smoothstep( 0.0, fw.add( 0.1 ), V.edge ); // 0 in the fissure, 1 on the plate
	// Flakes: layers that break across the plate in steps.
	const fl = valueNoise( vec2( x.div( R.mul( 0.6 ) ), y.div( R.mul( 0.25 ) ) ).add( hp.xy.mul( 9 ) ) );
	// Fibrous striations along the trunk on every plate.
	const stria = valueNoise( vec2( x.div( R.mul( 1.5 ) ), y.div( R.mul( 0.04 ) ) ).add( hp.xy.mul( 5 ) ) ).mul( fadeIn( R.mul( 0.04 ), fp, 1.5, 4.0 ) );

	const height = t.mul( R ).mul( 0.25 ).mul( u.fissure ).add( fl.mul( R ).mul( 0.04 ).mul( t ) ).add( stria.mul( R ).mul( 0.006 ) );
	return { V, hp, t, fl, stria, height };

}

export function buildBark( p, fp, u ) {

	const F = grainFrame( p, u );
	const { x, y } = F;
	const R = u.ridgeM, s = u.seed;
	const B = barkPlates( p, u, fp );
	const { V, hp, t, fl, stria } = B;
	const height = B.height.toVar();
	const wPl = fadeIn( R, fp, 1.5, 4.0 );
	const wFl = fadeIn( R.mul( 0.25 ), fp, 2.0, 6.0 );
	const slope = surfaceGradient( height, p ).mul( wPl ); // already in surface coordinates

	// Colour: weathered grey-brown tops, red-brown fissures.
	const tone = hp.x.mul( 0.2 ).add( 0.9 ).mul( valueNoise( p.div( R.mul( 0.15 ) ) ).mul( 0.2 ).add( 0.9 ) );
	let color = mix( u.lateColor, u.earlyColor.mul( tone ), t.mul( wPl ).add( wPl.oneMinus().mul( 0.6 ) ) );
	color = color.mul( stria.sub( 0.5 ).mul( 0.2 ).add( 1 ) ).mul( fl.mul( 0.25 ).add( 0.85 ).mul( wFl ).add( wFl.oneMinus() ) );
	// Lichen on the tops: patches with tiny cups.
	const ln = valueNoise( p.div( R.mul( 0.5 ) ).add( s.mul( 2 ) ) ).mul( 0.7 ).add( valueNoise( p.div( R.mul( 0.12 ) ) ).mul( 0.3 ) );
	const lich = smoothstep( 0.62, 0.66, ln.add( u.lichen.mul( 0.45 ) ).sub( 0.3 ) ).mul( t ).mul( step( 0.001, u.lichen ) );
	const cups = voronoi( p.div( R.mul( 0.02 ) ).add( 3.1 ), 0.9 );
	const cup = smoothstep( 0.35, 0.1, cups.toSeed.length() ).mul( fadeIn( R.mul( 0.02 ), fp, 2.0, 6.0 ) );
	color = mix( color, u.lichenColor.mul( cup.mul( 0.25 ).add( 0.85 ) ), lich );
	// Cork cells everywhere, fibres along the fissures.
	const C = voronoi( mod( p.div( u.cellM ), 4096 ).add( 1.7 ), 0.6 ); // mod: hashes stay exact
	const wC = fadeIn( u.cellM, fp, 2.0, 6.0 );
	const cw = float( 1 ).sub( smoothstep( 0.03, 0.1, C.edge ) ).mul( wC );
	const fib = hash1( vec2( floor( y.div( u.fiberM.mul( 3 ) ) ), floor( x.div( u.fiberM.mul( 80 ) ) ) ) ).sub( 0.5 ).mul( fadeIn( u.fiberM.mul( 3 ), fp, 2.0, 6.0 ) ).mul( t.oneMinus() ).mul( 0.3 );
	color = color.mul( float( 1 ).sub( cw.mul( 0.15 ) ) ).mul( fib.add( 1 ) );

	const cavity = t.oneMinus().mul( wPl ).max( cw.mul( 0.3 ) );
	const rough = u.roughness.mul( mix( float( 1 ), float( 0.85 ), lich ) );
	return { color, slope: slope.add( C.toSeed.mul( 0.15 ).mul( wC ) ), cavity, rough, s2: wPl.oneMinus().mul( 0.06 ).mul( u.fissure ) };

}
