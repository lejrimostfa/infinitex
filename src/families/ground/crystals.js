// Salt and sugar: a heap of small clear crystals.
//   L0 heap      grains of 0.3 to 3 mm too small to see one by one: a
//                white surface with shallow clumps and a sparkle
//   L1 crystals  salt: cubes, each lying tilted, so its top face and one
//                or two side faces show; sugar (cubic = 0): stubby
//                monoclinic grains with worn, rounded edges. Two layers:
//                the lower crystals show in the gaps, deep gaps are dark.
//                Clear crystals: faces facing away look grey blue (you see
//                into the heap), edges catch light (internal reflection).
//   L2 faces     hopper steps on salt faces (square terraces 20 to 60 um
//                apart), chips and dust of broken crystals in the gaps
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, float, mix, smoothstep, step, abs, max, cos, sin, clamp, mod, fract } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { fbm, line } from './grains.js';

// One crystal per Voronoi cell. q in cell units. Returns body (AA), face
// (1 top, 0 side), the face slope and the distance to the top face edge.
function crystal( p, cellM, fp, salt, u ) {

	const v = voronoi( mod( p.div( cellM ), 4096 ).add( salt ), 0.75 );
	const h = hash3( v.id1.add( salt * 1.3 ) );
	const h2 = hash3( v.id1.add( salt * 1.3 + 17.7 ) );
	const a = h.x.mul( 1.5708 );
	const c = cos( a ), s = sin( a );
	const rot = ( w ) => vec2( w.x.mul( c ).add( w.y.mul( s ) ), w.y.mul( c ).sub( w.x.mul( s ) ) );
	const unrot = ( w ) => vec2( w.x.mul( c ).sub( w.y.mul( s ) ), w.y.mul( c ).add( w.x.mul( s ) ) );
	const l = rot( v.toSeed );
	const half = h.y.mul( 0.12 ).add( 0.36 );
	// Sugar: rounded corners (an L4 norm in place of the max).
	const sq = ( w ) => mix( w.x.pow( 4 ).add( w.y.pow( 4 ) ).pow( 0.25 ), max( abs( w.x ), abs( w.y ) ), u.cubic );
	// The tilt shifts the top face; between the base and the top square the
	// side faces show.
	const tdir = h2.xy.sub( 0.5 ).normalize();
	const shift = tdir.mul( h2.z.mul( 0.45 ).add( 0.05 ) ).mul( half );
	const lt = l.sub( shift );
	const dTop = sq( lt ).sub( half );
	const dBase = sq( l ).sub( half );
	const d = dTop.min( dBase.add( 0.02 ) );
	const body = clamp( d.negate().mul( cellM ).div( fp ).add( 0.5 ), 0, 1 );
	const top = clamp( dTop.negate().mul( cellM ).div( fp ).add( 0.5 ), 0, 1 );
	// Side face normal: along the dominant axis of the offset to the top.
	const off = l.sub( shift.mul( 0.5 ) );
	const ax = step( abs( off.y ), abs( off.x ) );
	const sideN = unrot( vec2( ax.mul( off.x.sign() ), ax.oneMinus().mul( off.y.sign() ) ) ).mul( mix( float( 0.8 ), float( 1.6 ), u.cubic ) );
	const topN = unrot( tdir ).mul( h2.z.mul( 0.6 ) );
	// Sugar faces bulge: add a dome.
	const dome = v.toSeed.mul( - 1.2 ).mul( u.cubic.oneMinus() );
	const slope = pick( top, topN, sideN ).add( dome );
	return { body, top, slope, dTop, lt, h, half, edge: v.edge };

}

export function buildCrystals( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	const A = crystal( p.add( s.mul( 0.011 ) ), g, fp, 2.3, u );
	const B = crystal( p.add( g.mul( 0.43 ) ), g.mul( 0.75 ), fp, 9.7, u );
	const wG = fadeIn( g, fp, 1.5, 5.0 ).toVar();
	const onA = A.body, onB = B.body.mul( A.body.oneMinus() );
	const gap = float( 1 ).sub( onA ).sub( onB ).max( 0 );

	// Faces: top bright, sides grey blue, edge lines bright.
	const faceCol = ( C, depth ) => {

		const tone = C.h.z.mul( 0.15 ).add( 0.85 ).mul( depth );
		const edge = line( C.dTop.mul( g ), g.mul( 0.01 ), fp ).mul( wG );
		// Hopper steps: square terraces on salt faces.
		const terr = fract( C.dTop.negate().div( 0.035 ) );
		const steps = smoothstep( 0.85, 1.0, terr ).mul( u.cubic ).mul( C.top ).mul( fadeIn( g.mul( 0.035 ), fp, 2.0, 6.0 ) ).mul( 0.25 );
		// Inside a clear crystal: cloudy inclusions and a gradient where the
		// light passes through toward its lower side.
		const cloud = valueNoise( C.lt.mul( 6 ).add( C.h.xy.mul( 40 ) ) ).mul( 0.25 ).add( 0.8 );
		const grad = C.lt.dot( vec2( 0.7, 0.7 ) ).div( C.half ).mul( 0.12 ).add( 1 );
		return mix( u.color2.mul( 0.45 ), u.color.mul( cloud ).mul( grad ), C.top ).mul( tone ).add( edge.mul( 0.25 ) ).sub( steps.mul( u.color2 ) );

	};

	let color = faceCol( A, 1 ).mul( onA ).add( faceCol( B, 0.6 ).mul( onB ) ).add( mix( u.color3.mul( 0.5 ), u.color2.mul( 0.35 ), valueNoise( p.div( g.mul( 0.2 ) ) ) ).mul( gap ) );
	// Far: the mean of faces and gaps; clumps of a few cm.
	const meanCol = mix( u.color, u.color2.mul( 0.6 ), 0.4 ).mul( 0.8 );
	// The heap: clumps and hollows of a few mm to cm.
	const heap = fbm( p.div( 0.015 ).add( s.mul( 2 ) ), 3 );
	color = mix( meanCol, color, wG );
	color = color.mul( heap.sub( 0.5 ).mul( 0.15 ).add( 1 ) );

	// L2: crystal dust in the gaps, chips on faces.
	const D = voronoi( mod( p.div( g.mul( 0.035 ) ), 4096 ).add( 3.7 ), 0.9 );
	const dh = hash3( D.id1 );
	const wD = fadeIn( g.mul( 0.035 ), fp, 2.0, 6.0 );
	const dust = step( 0.8, dh.x ).mul( smoothstep( 0.05, 0.15, D.edge ) ).mul( gap ).mul( wD );
	color = mix( color, u.color2.mul( dh.y.mul( 0.4 ).add( 0.4 ) ), dust );
	const micro = valueNoise( p.div( g.mul( 0.01 ) ) ).sub( 0.5 ).mul( fadeIn( g.mul( 0.01 ), fp, 2.0, 6.0 ) );

	const slope = pick( step( 0.5, onA ), A.slope, B.slope ).mul( float( 1 ).sub( gap ) ).mul( u.relief ).mul( wG )
		.add( dh.xy.sub( 0.5 ).mul( dust ) )
		.add( vec2( fbm( p.div( 0.006 ).add( 1.1 ), 2 ), fbm( p.div( 0.006 ).add( 6.1 ), 2 ) ).sub( 0.5 ).mul( 0.5 ) )
		.add( vec2( micro, micro.mul( - 0.7 ) ).mul( 0.15 ).mul( u.cubic.oneMinus().add( 0.3 ) ) );
	const topAny = A.top.mul( onA ).add( B.top.mul( onB ) );
	const rough = mix( u.roughness, float( 0.06 ), topAny.mul( u.sparkle ).mul( u.cubic.mul( 0.6 ).add( 0.4 ) ) );
	const s2 = wG.oneMinus().mul( 0.3 ).mul( u.relief );
	const cavity = gap.mul( wG ).mul( 0.8 );
	return { color, slope, cavity, rough, s2 };

}
