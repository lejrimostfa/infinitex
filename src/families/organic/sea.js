// Sea life: a coral skeleton.
// Coral (a bleached massive coral, Favia-like):
//   L0 colony    cream to pale ochre, darker where algae stained it
//   L1 cups      corallites (size_mm, 3 to 6 mm) packed on a Voronoi
//                net: a raised wall, a deep cup, septa as radial blades
//                (24 of them, every other one shorter) and a spongy
//                columella in the middle
//   L2 skeleton  the coenosteum and the blades are porous: a fine open
//                lattice (cell_um) with spinules
// Barnacles: barnacle.js.
// Returns { color, slope, cavity, rough, s2 }.

import { vec2, float, fract, mix, smoothstep, step, atan, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { fbm } from './common.js';
import { lattice } from './lattice.js';

export function buildCoral( p, fp, u ) {

	const s = u.seed, g = u.sizeM;
	const tone = fbm( p.add( s ), float( 0.05 ), fp, 4, 2 );
	const base = mix( u.color, u.color2, smoothstep( 0.4, 0.7, tone ) );
	// L1: corallites. Cup radius 0.36 cells, a wall ring around it.
	const V = voronoi( wrapCoord( p.div( g ) ).add( 2.2 ), 0.8 );
	const k = hash3( V.id1 );
	const t = V.toSeed;
	const r = t.length().div( k.x.mul( 0.08 ).add( 0.34 ) );
	const wG = fadeIn( g, fp, 1.5, 4.0 );
	// Height: wall crest at r = 1, cup falls inside, valley between cups.
	const cup = smoothstep( 0.15, 1.0, r ).mul( smoothstep( 1.35, 1.0, r ) );
	const ang = atan( t.y, t.x );
	const sep = fract( ang.mul( 24 / 6.2832 ) ).sub( 0.5 ).abs();
	const long = step( 0.5, fract( ang.mul( 12 / 6.2832 ) ) );
	const blade = smoothstep( 0.16, 0.06, sep ).mul( smoothstep( mix( float( 0.55 ), float( 0.25 ), long ), 0.9, r ) ).mul( step( r, 1.15 ) );
	const colu = smoothstep( 0.22, 0.1, r );
	const h = cup.max( blade.mul( 0.85 ) ).max( colu.mul( 0.5 ) );
	// Shading of depth: the cup floor is dark.
	const depth = smoothstep( 0.9, 0.2, r ).mul( blade.oneMinus() ).mul( colu.oneMinus() );
	let color = base.mul( float( 1 ).sub( depth.mul( 0.55 ) ) ).mul( h.mul( 0.15 ).add( 0.9 ) );
	color = mix( base.mul( 0.85 ), color, wG );
	// L2: porous skeleton everywhere.
	const L = lattice( p, u.cellM, fp, 4.4, { width: 0.16, vary: 0.6, plate: 0.3 } );
	color = color.mul( mix( float( 0.82 ), L.strut.mul( 0.3 ).add( 0.72 ), L.w ) );
	const dir = t.div( t.length().max( 1e-4 ) );
	const across = vec2( dir.y.negate(), dir.x );
	const slopeCup = dir.mul( smoothstep( 1.0, 0.3, r ).mul( 1.2 ).sub( smoothstep( 1.0, 1.3, r ).mul( 1.2 ) ) )
		.add( across.mul( fract( ang.mul( 24 / 6.2832 ) ).sub( 0.5 ) ).mul( blade ).mul( - 2 ) );
	const slope = slopeCup.mul( wG ).mul( 0.6 ).add( L.slope.mul( 0.5 ) ).mul( u.relief );
	return { color, slope, cavity: depth.mul( wG ).max( L.strut.oneMinus().mul( L.w ).mul( 0.3 ) ), rough: u.roughness, s2: wG.oneMinus().mul( 0.1 ).add( L.w.oneMinus().mul( 0.05 ) ) };

}
