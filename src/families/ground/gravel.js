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
//
// Levels sit in gate() (core/lod.js): past the pebbles' fade the colour is
// the mean and the crystals, chips and mineral grains are skipped; the sand
// in the gaps, the crystals, the mineral grains and the pits each run only
// where they show. The pebbles themselves always run: their hash sets s2
// (flat or round pebble), so the far view has no exact mean.

import { vec2, vec3, float, mix, smoothstep, step, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate } from '../../core/lod.js';
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

// L1: crystals of the rock, in the pebble's own frame (a pebble keeps
// its pattern, the next one has another). Fade: period 0.09 g, from 1.5 px.
function crystalLevel( q, cq, id, fp, u ) {

	const g = u.grainM;
	const isGranite = step( id.y, 0.38 );
	const C = voronoi( cq, 0.9 );
	const ch = hash3( C.id1.add( 6.6 ) );
	const wC = fadeIn( g.mul( 0.09 ), fp, 1.5, 4.0 ).toVar();
	const mineral = mix( vec3( ch.z.mul( 0.2 ).add( 0.9 ) ), mix( vec3( 1.2, 1.18, 1.15 ), vec3( 0.3, 0.29, 0.28 ), step( 0.86, ch.x ) ), step( 0.6, ch.x ) );
	const feldspar = mix( vec3( 1 ), vec3( 1.15, 0.97, 0.9 ), step( 0.8, ch.y ).mul( isGranite ) );
	const mottle = fbm( q.div( g.mul( 0.12 ) ), 2 ).sub( 0.5 ).mul( 0.35 ).add( 1 );
	const crystals = mix( vec3( mottle ), mineral.mul( feldspar ), isGranite.mul( 0.85 ) );
	return { tint: mix( vec3( 1 ), crystals, wC ) };

}

// L2: worn mineral faces, each its own tone and tilt, fine seams between
// them. Fade: period 0.01 g, from 2 px.
function mineralLevel( mq, fp, u, dry ) {

	const g = u.grainM;
	const M = voronoi( mq, 0.9 );
	const mh = hash3( M.id1.add( 3.1 ) );
	const wM = fadeIn( g.mul( 0.01 ), fp, 2.0, 6.0 ).toVar();
	// Each small grain is one mineral: grey glassy quartz, milky or pink
	// feldspar, black biotite flakes.
	const minM = mix( mix( vec3( 0.85, 0.87, 0.9 ), vec3( 1.2, 1.08, 1.0 ), step( 0.55, mh.y ) ), vec3( 0.25, 0.23, 0.2 ), step( 0.93, mh.y ) );
	return {
		tint: mix( vec3( 1 ), minM, wM.mul( 0.7 ) ),
		tone: mh.z.sub( 0.5 ).mul( 0.3 ).mul( wM ).add( 1 ),
		seam: line( M.edge.mul( g.mul( 0.01 ) ), g.mul( 1.5e-4 ), fp ).mul( wM ),
		faces: M.toSeed.mul( - 0.3 ).mul( wM ).mul( dry ),
		tilt: mh.xy.sub( 0.5 ).mul( 0.25 ).mul( wM ).mul( dry ),
		glint: step( 0.8, mh.z ).mul( wM ).mul( dry ),
	};

}

// L2: micro pits and a weathering mottle. Fade: period 0.002 g, from 2 px.
function pitLevel( p, fp, u ) {

	const g = u.grainM;
	const wP = fadeIn( g.mul( 0.002 ), fp, 2.0, 6.0 );
	return {
		pits: smoothstep( 0.68, 0.88, valueNoise( p.div( g.mul( 0.002 ) ) ) ).mul( wP ),
		weath: fbm( p.div( g.mul( 0.004 ) ).add( 1.9 ), 3 ).sub( 0.5 ).mul( 0.3 ).mul( wP ).add( 1 ),
		slope: vec2( valueNoise( p.div( g.mul( 0.002 ) ).add( 2.2 ) ), valueNoise( p.div( g.mul( 0.002 ) ).add( 5.5 ) ) ).sub( 0.5 ).mul( 0.3 ).mul( wP ),
	};

}

// Everything drawn on a resolved pebble: crystals, vein, chips, sand in
// the gaps, mineral grains, pits, water. X holds the nodes shared with
// buildGravel.
function pebbleLevels( X, fp, u ) {

	const { p, G, id, ph, q, cq, fq, mq, wG, amp, sandy, sandCol, sandSlope } = X;
	const g = u.grainM, t = id.y;
	// L1: crystals, skipped under 1.5 px per 0.09 g.
	const C = gate( fadeOn( g.mul( 0.09 ), fp, 1.5 ), { tint: [ 1, 1, 1 ] }, () => crystalLevel( q, cq, id, fp, u ), [ fp, q, cq, id ] );
	let rock = rockColor( t, id.z, u ).mul( C.tint );
	// A white quartz vein across some pebbles.
	const vn = vec2( id.x.sub( 0.5 ), id.z.sub( 0.5 ) ).normalize();
	const vein = line( G.toSeed.dot( vn ).sub( id.x.sub( 0.5 ).mul( 0.4 ) ).mul( g ), g.mul( id.z.mul( 0.03 ).add( 0.01 ) ), fp )
		.mul( step( 0.75, ph.x ) ).mul( wG );
	rock = mix( rock, vec3( 0.82, 0.8, 0.76 ), vein.mul( 0.85 ) );

	// Chipped pebbles: broken faces, flat planes with sharp edges, still
	// leaning away from the pebble's centre so it stays convex. The face
	// tint has no fade, so the faces run on every resolved pebble.
	const chipped = step( 0.45, ph.y );
	const F = voronoi( fq, 0.9 );
	const fh = hash3( F.id1.add( id.yz.mul( 17 ) ) );
	const fEdge = line( F.edge.mul( g.mul( 0.3 ) ), g.mul( 0.006 ), fp ).mul( chipped ).mul( fadeIn( g.mul( 0.3 ), fp, 2.0, 5.0 ) ).mul( step( 0.05, G.h ) );
	rock = rock.mul( float( 1 ).add( fEdge.mul( 0.25 ) ) ).mul( chipped.mul( fh.z.sub( 0.5 ).mul( 0.18 ) ).add( 1 ) );

	// Shadow: the deeper, the darker (light reaches the gaps poorly).
	const ao = smoothstep( - 0.45, 0.35, G.h ).mul( 0.85 ).add( 0.15 );
	const pebbleCol = mix( rock, sandCol, sandy ).mul( ao );
	const meanCol = mix( mix( u.color, u.color3, 0.25 ), u.color2, 0.3 ).mul( 0.62 );
	let color = mix( meanCol, pebbleCol, wG );

	// L2: mineral faces and seams, skipped under 2 px per 0.01 g; pits and
	// weathering, skipped under 2 px per 0.002 g.
	const dry = sandy.oneMinus().toVar();
	const M = gate( fadeOn( g.mul( 0.01 ), fp, 2.0 ), { tint: [ 1, 1, 1 ], tone: 1, seam: 0, faces: [ 0, 0 ], tilt: [ 0, 0 ], glint: 0 }, () => mineralLevel( mq, fp, u, dry ), [ fp, mq, dry ] );
	const P = gate( fadeOn( g.mul( 0.002 ), fp, 2.0 ), { pits: 0, weath: 1, slope: [ 0, 0 ] }, () => pitLevel( p, fp, u ), [ p, fp ] );
	color = color.mul( M.tint );
	color = color.mul( float( 1 ).sub( P.pits.mul( 0.35 ) ).sub( M.seam.mul( 0.3 ) ) ).mul( M.tone ).mul( P.weath );

	const facetSlope = G.grad.mul( 0.3 ).add( fh.xy.sub( 0.5 ).mul( 2.2 ) ).add( G.toSeed.mul( - 0.8 ) ).mul( step( 0.02, G.h ) );
	const pebbleSlope = mix( G.grad, facetSlope, chipped.mul( fadeIn( g.mul( 0.3 ), fp, 1.5, 4.0 ) ) );
	const slope = pebbleSlope.mul( amp ).mul( wG ).mul( dry )
		.add( M.faces )
		.add( sandSlope.mul( sandy ) )
		.add( M.tilt )
		.add( P.slope );
	// Water held in the gaps: dark and glossy.
	const damp = smoothstep( 0.05, - 0.25, G.h ).mul( wG ).mul( 0.7 );
	color = color.mul( float( 1 ).sub( damp.mul( 0.35 ) ) );
	const rough = mix( mix( u.roughness, float( 0.25 ), M.glint.mul( 0.8 ) ).add( P.pits.mul( 0.1 ) ), float( 0.2 ), damp );
	const cavity = smoothstep( 0.2, - 0.3, G.h ).mul( wG ).max( P.pits.mul( 0.4 ) ).max( M.seam.mul( 0.5 ) );
	return { color, slope, cavity, rough };

}

// Sand in the lowest gaps. Grains of 0.6 mm, fade from 1.5 px.
function sandLevel( p, fp, u ) {

	const S = grains( p, float( 6e-4 ), fp, 8.8, { gap: 0.04, round: 0.35, tilt: 0.3 } );
	const wS = fadeIn( float( 6e-4 ), fp, 1.5, 5.0 );
	return {
		col: mix( u.color2.mul( 0.9 ), u.color2.mul( S.id.x.mul( 0.5 ).add( 0.7 ) ).mul( S.body.mul( 0.5 ).add( 0.5 ) ), wS ),
		slope: S.grad.mul( 0.4 ).mul( wS ),
	};

}

export function buildGravel( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	const G = packed( p.add( s.mul( 0.37 ) ), g, fp, 1.7, { gap: 0.04, round: 0.45, crown: 0.25, radius: 0.55, elong: 0.9, sizeVar: u.sizeVar, ratio: 0.5, lift: 0.18 } );
	const wG = fadeIn( g, fp, 1.0, 4.0 ).toVar();
	const id = G.id;
	// The pebble's frame and the cells of its crystals, chips and mineral
	// grains, before any branch (computed inside one, they round
	// differently and some cell borders move by a pixel).
	const q = p.add( id.xz.mul( 0.37 ) ).toVar();
	const cq = mod( q.div( g.mul( 0.09 ) ), 4096 ).add( 2.2 ).toVar();
	const fq = mod( q.div( g.mul( 0.3 ) ), 4096 ).add( 7.3 ).toVar();
	const mq = mod( q.div( g.mul( 0.01 ) ), 4096 ).add( 4.4 ).toVar();
	// Flat and round pebbles: each its own height.
	const ph = hash3( id.xy.mul( 91 ) ).toVar();
	const flat = ph.z.mul( 0.8 ).add( 0.35 );
	const amp = u.relief.mul( 0.6 ).mul( flat ).toVar();
	const sandy = smoothstep( - 0.05, - 0.2, G.h ).mul( u.stones ).toVar();

	// Sand in the gaps: its own size, so its own gate (under 1.5 px per
	// 0.6 mm grain it is skipped).
	const S = gate( fadeOn( float( 6e-4 ), fp, 1.5 ), { col: { node: u.color2.mul( 0.9 ), size: 3 }, slope: [ 0, 0 ] }, () => sandLevel( p, fp, u ), [ p, fp ] );
	const sandCol = S.col.toVar(), sandSlope = S.slope.toVar();

	// Past the pebbles' fade (under 1 px per pebble) the colour is the mean
	// and only the sand still tilts the normal: the crystals, chips,
	// mineral grains and pits are skipped.
	const meanCol = mix( mix( u.color, u.color3, 0.25 ), u.color2, 0.3 ).mul( 0.62 );
	const far = { color: { node: meanCol, size: 3 }, slope: { node: sandSlope.mul( sandy ), size: 2 }, cavity: 0, rough: u.roughness };
	const X = { p, G, id, ph, q, cq, fq, mq, wG, amp, sandy, sandCol, sandSlope };
	const L = gate( fadeOn( g, fp, 1.0 ), far, () => pebbleLevels( X, fp, u ), [ p, fp, id, G.h, ph, q, cq, fq, mq, wG, amp, sandy, sandCol, sandSlope ] );

	const s2 = wG.oneMinus().mul( 0.12 ).mul( amp ).add( fadeIn( g.mul( 0.01 ), fp, 2.0, 6.0 ).oneMinus().mul( 0.01 ) );
	return { color: L.color, slope: L.slope, cavity: L.cavity, rough: L.rough, s2 };

}
