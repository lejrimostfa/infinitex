// Gravel: river pebbles of several rocks and sizes, packed.
//   L0 pebbles   10 to 30 mm, rounded by the water, packed in two sizes:
//                small ones sit lower in the gaps of the big ones. Deep
//                gaps fall into shadow; sand fills the lowest of them.
//                Each pebble is one rock: granite (grey, speckled), basalt
//                (near black), limestone or sandstone (beige), quartzite
//                (milky white), jasper (red); some carry a white vein.
//                Half are chipped: flat broken faces with sharp edges; some
//                are flat, some round. Water held in the gaps darkens them.
//   L1 crystals  the rock's own grains, 0.5 to 3 mm: granite shows black
//                biotite, pink feldspar and white quartz; others a fine mottle
//   L2 surface   mineral grains of 0.1 to 0.2 mm, each domed and its own
//                mineral (quartz, feldspar, biotite); mica and quartz glint,
//                micro pits between
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, vec3, float, mix, smoothstep, step, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { packed, grains, fbm, line } from './grains.js';

// Rock colour by type: t in [0, 1) picks the rock.
function rockColor( t, tone, u ) {

	const granite = u.color, basalt = u.color3.mul( 1.1 ), lime = u.color2;
	const quartz = vec3( 0.6, 0.58, 0.55 ), jasper = vec3( 0.36, 0.19, 0.14 );
	let c = granite;
	c = mix( c, basalt, step( 0.38, t ) );
	c = mix( c, lime, step( 0.58, t ) );
	c = mix( c, quartz, step( 0.8, t ) );
	c = mix( c, jasper, step( 0.93, t ) );
	return c.mul( tone.mul( 0.35 ).add( 0.55 ) );

}

export function buildGravel( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	const G = packed( p.add( s.mul( 0.37 ) ), g, fp, 1.7, { gap: 0.04, round: 0.45, crown: 0.25, radius: 0.55, elong: 0.9, sizeVar: u.sizeVar, ratio: 0.5, lift: 0.18 } );
	const wG = fadeIn( g, fp, 1.0, 4.0 ).toVar();
	const id = G.id, t = id.y;
	const isGranite = step( t, 0.38 );

	// L1: crystals of the rock, in the pebble's own frame (a pebble keeps
	// its pattern, the next one has another).
	const q = p.add( id.xz.mul( 0.37 ) );
	const C = voronoi( mod( q.div( g.mul( 0.09 ) ), 4096 ).add( 2.2 ), 0.9 );
	const ch = hash3( C.id1.add( 6.6 ) );
	const wC = fadeIn( g.mul( 0.09 ), fp, 1.5, 4.0 ).toVar();
	const mineral = mix( vec3( ch.z.mul( 0.2 ).add( 0.9 ) ), mix( vec3( 1.2, 1.18, 1.15 ), vec3( 0.3, 0.29, 0.28 ), step( 0.86, ch.x ) ), step( 0.6, ch.x ) );
	const feldspar = mix( vec3( 1 ), vec3( 1.15, 0.97, 0.9 ), step( 0.8, ch.y ).mul( isGranite ) );
	const mottle = fbm( q.div( g.mul( 0.12 ) ), 2 ).sub( 0.5 ).mul( 0.35 ).add( 1 );
	const crystals = mix( vec3( mottle ), mineral.mul( feldspar ), isGranite.mul( 0.85 ) );
	let rock = rockColor( t, id.z, u ).mul( mix( vec3( 1 ), crystals, wC ) );
	// A white quartz vein across some pebbles.
	const vn = vec2( id.x.sub( 0.5 ), id.z.sub( 0.5 ) ).normalize();
	const vein = line( G.toSeed.dot( vn ).sub( id.x.sub( 0.5 ).mul( 0.4 ) ).mul( g ), g.mul( id.z.mul( 0.03 ).add( 0.01 ) ), fp )
		.mul( step( 0.75, hash3( id.xy.mul( 91 ) ).x ) ).mul( wG );
	rock = mix( rock, vec3( 0.82, 0.8, 0.76 ), vein.mul( 0.85 ) );

	// Chipped pebbles: broken faces, flat planes with sharp edges, still
	// leaning away from the pebble's centre so it stays convex.
	const ph = hash3( id.xy.mul( 91 ) );
	const chipped = step( 0.45, ph.y );
	const F = voronoi( mod( q.div( g.mul( 0.3 ) ), 4096 ).add( 7.3 ), 0.9 );
	const fh = hash3( F.id1.add( id.yz.mul( 17 ) ) );
	const fEdge = line( F.edge.mul( g.mul( 0.3 ) ), g.mul( 0.006 ), fp ).mul( chipped ).mul( fadeIn( g.mul( 0.3 ), fp, 2.0, 5.0 ) ).mul( step( 0.05, G.h ) );
	rock = rock.mul( float( 1 ).add( fEdge.mul( 0.25 ) ) ).mul( chipped.mul( fh.z.sub( 0.5 ).mul( 0.18 ) ).add( 1 ) );
	// Flat and round pebbles: each its own height.
	const flat = ph.z.mul( 0.8 ).add( 0.35 );

	// Sand in the lowest gaps.
	const S = grains( p, float( 6e-4 ), fp, 8.8, { gap: 0.04, round: 0.35, tilt: 0.3 } );
	const wS = fadeIn( float( 6e-4 ), fp, 1.5, 5.0 );
	const sandCol = mix( u.color2.mul( 0.9 ), u.color2.mul( S.id.x.mul( 0.5 ).add( 0.7 ) ).mul( S.body.mul( 0.5 ).add( 0.5 ) ), wS );
	const sandy = smoothstep( - 0.05, - 0.2, G.h ).mul( u.stones );
	// Shadow: the deeper, the darker (light reaches the gaps poorly).
	const ao = smoothstep( - 0.45, 0.35, G.h ).mul( 0.85 ).add( 0.15 );
	const pebbleCol = mix( rock, sandCol, sandy ).mul( ao );
	const meanCol = mix( mix( u.color, u.color3, 0.25 ), u.color2, 0.3 ).mul( 0.62 );
	let color = mix( meanCol, pebbleCol, wG );

	// L2: worn mineral faces, each its own tone and tilt, fine seams
	// between them; micro pits and a weathering mottle.
	const M = voronoi( mod( q.div( g.mul( 0.01 ) ), 4096 ).add( 4.4 ), 0.9 );
	const mh = hash3( M.id1.add( 3.1 ) );
	const wM = fadeIn( g.mul( 0.01 ), fp, 2.0, 6.0 ).toVar();
	const seam = line( M.edge.mul( g.mul( 0.01 ) ), g.mul( 1.5e-4 ), fp ).mul( wM );
	const wP = fadeIn( g.mul( 0.002 ), fp, 2.0, 6.0 );
	const pits = smoothstep( 0.68, 0.88, valueNoise( p.div( g.mul( 0.002 ) ) ) ).mul( wP );
	const weath = fbm( p.div( g.mul( 0.004 ) ).add( 1.9 ), 3 ).sub( 0.5 ).mul( 0.3 ).mul( wP ).add( 1 );
	// Each small grain is one mineral: grey glassy quartz, milky or pink
	// feldspar, black biotite flakes.
	const minM = mix( mix( vec3( 0.85, 0.87, 0.9 ), vec3( 1.2, 1.08, 1.0 ), step( 0.55, mh.y ) ), vec3( 0.25, 0.23, 0.2 ), step( 0.93, mh.y ) );
	color = color.mul( mix( vec3( 1 ), minM, wM.mul( 0.7 ) ) );
	color = color.mul( float( 1 ).sub( pits.mul( 0.35 ) ).sub( seam.mul( 0.3 ) ) ).mul( mh.z.sub( 0.5 ).mul( 0.3 ).mul( wM ).add( 1 ) ).mul( weath );

	const amp = u.relief.mul( 0.6 ).mul( flat );
	const facetSlope = G.grad.mul( 0.3 ).add( fh.xy.sub( 0.5 ).mul( 2.2 ) ).add( G.toSeed.mul( - 0.8 ) ).mul( step( 0.02, G.h ) );
	const pebbleSlope = mix( G.grad, facetSlope, chipped.mul( fadeIn( g.mul( 0.3 ), fp, 1.5, 4.0 ) ) );
	const slope = pebbleSlope.mul( amp ).mul( wG ).mul( sandy.oneMinus() )
		.add( M.toSeed.mul( - 0.3 ).mul( wM ).mul( sandy.oneMinus() ) )
		.add( S.grad.mul( 0.4 ).mul( wS ).mul( sandy ) )
		.add( mh.xy.sub( 0.5 ).mul( 0.25 ).mul( wM ).mul( sandy.oneMinus() ) )
		.add( vec2( valueNoise( p.div( g.mul( 0.002 ) ).add( 2.2 ) ), valueNoise( p.div( g.mul( 0.002 ) ).add( 5.5 ) ) ).sub( 0.5 ).mul( 0.3 ).mul( wP ) );
	const glint = step( 0.8, mh.z ).mul( wM ).mul( sandy.oneMinus() );
	// Water held in the gaps: dark and glossy.
	const damp = smoothstep( 0.05, - 0.25, G.h ).mul( wG ).mul( 0.7 );
	color = color.mul( float( 1 ).sub( damp.mul( 0.35 ) ) );
	const rough = mix( mix( u.roughness, float( 0.25 ), glint.mul( 0.8 ) ).add( pits.mul( 0.1 ) ), float( 0.2 ), damp );
	const s2 = wG.oneMinus().mul( 0.12 ).mul( amp ).add( wM.oneMinus().mul( 0.01 ) );
	const cavity = smoothstep( 0.2, - 0.3, G.h ).mul( wG ).max( pits.mul( 0.4 ) ).max( seam.mul( 0.5 ) );
	return { color, slope, cavity, rough, s2 };

}
