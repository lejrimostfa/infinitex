// Layered stones. angle_deg sets the bedding or the cleavage trend.
// Sandstone: sand grains (grain_mm, 0.1 to 0.5 mm) cemented together.
//   L0 bedding  cross-bedded sets (layer_mm thick), each a stack of
//               inclined laminae 2 to 5 mm thick, coloured by iron
//   L1 grains   rounded quartz grains, a few pink feldspar and dark rock
//               fragments, cement and pores between them
//   L2 surface  frosted grain skins (wind and water pitted), iron coats
//   color = quartz grains, color2 = iron, color3 = cement, color4 = lithics
// Slate: clay squeezed until it splits along one plane (the cleavage).
//   L0 terraces  the split face breaks in steps (steps, layer_mm), each
//                riser a lighter fresh edge
//   L1 lineation streaks along the cleavage, faint colour bands
//   L2 sericite  mica flakes 10 to 30 um lying in the plane: a silky sheen
//                and tiny sparkles. Rare pyrite cubes with rust halos (pores)
//   color = slate, color2 = rust

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, mod, max, sin, sign } from 'three/tsl';
import { fadeIn, pick, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, grains, fbm } from './common.js';

function frame( p, u ) {

	const ax = dir2( u.angle ), ay = vec2( ax.y.negate(), ax.x );
	return { ax, ay, tx: p.dot( ax ).toVar(), ty: p.dot( ay ).toVar() };

}

export function buildSandstone( p, fp, u ) {

	const { tx, ty } = frame( p, u );
	const L = u.layerM, s = u.seed;
	// Sets: bounded by nearly planar erosion surfaces that cut the laminae.
	const sy = ty.add( fbm( vec2( tx.div( 4 ), ty ), L.mul( 2 ), fp, 3, 1 ).sub( 0.5 ).mul( L ).mul( 0.55 ) ).add( tx.mul( 0.04 ) ).div( L );
	const set = floor( sy );
	const hs = hash3( vec2( set, s ) );
	// Laminae inside a set: straight, parallel, leaning 6 to 20 degrees,
	// mostly with one current; a few sets are flat bedded.
	const lean = hs.x.mul( 0.25 ).add( 0.1 ).mul( step( 0.8, hs.y ).mul( - 2 ).add( 1 ) ).mul( step( 0.2, hs.z ) );
	const curve = float( 1 );
	const lam = L.mul( hs.z.mul( 0.05 ).add( 0.05 ) );
	const lph = ty.sub( tx.mul( lean ).mul( curve ) ).div( lam ).add( valueNoise( vec2( tx.div( 0.05 ), set ) ).mul( 0.25 ) ).toVar();
	const wLam = fadeIn( lam, fp, 1.5, 4.0 );
	// Iron varies smoothly from lamina to lamina; thin dark heavy-mineral
	// seams mark the base of some laminae.
	// Iron: each lamina its own stain, and whole sets bleached or red.
	const lamI = mix( float( 0.5 ), hash1( vec2( floor( lph ), set.add( 3.1 ) ) ).mul( 0.6 ).add( valueNoise( vec2( lph, set.mul( 7.1 ).add( s ) ) ).mul( 0.4 ) ), wLam );
	const iron = lamI.mul( 0.6 ).add( smoothstep( 0.3, 0.9, hash1( vec2( set, s.add( 9.3 ) ) ) ).mul( 0.7 ) ).mul( u.layers ).toVar();
	// The erosion surface itself: a thin darker drape at the set base.
	const drape = band( fract( sy ).sub( 0.5 ).abs().oneMinus().sub( 0.5 ).mul( L ), L.mul( 0.008 ), fp ).mul( fadeIn( L.mul( 0.02 ), fp, 1.0, 3.0 ) );
	const seamL = drape.max( band( fract( lph ).sub( 0.5 ).abs().oneMinus().sub( 0.5 ).mul( lam ), lam.mul( 0.04 ), fp ).mul( step( 0.6, hash1( vec2( floor( lph ), set ) ) ) ).mul( fadeIn( lam, fp, 3.0, 8.0 ) ) );

	// Grains.
	const gs = u.grainM;
	const G = grains( p, gs, fp, 0.1, 2 );
	const kind = G.h.y;
	const lith = step( 0.95, kind ), feld = step( 0.86, kind ).sub( lith );
	const frost = valueNoise( mod( p.div( 6e-6 ), 4096 ) ).sub( 0.5 ).mul( fadeIn( float( 6e-6 ), fp, 2.0, 5.0 ) );
	// Iron coats every grain thinly, thicker toward its rim.
	const coat = smoothstep( 0.12, 0.0, G.m ).mul( G.w ).mul( G.h.x.mul( 0.6 ).add( 0.4 ) );
	let gCol = u.color.mul( G.h.z.sub( 0.5 ).mul( u.colorVar ).mul( 2.5 ).add( 1 ) );
	gCol = mix( gCol, gCol.mul( 0.8 ).add( 0.1 ), step( 0.7, G.h.x ).mul( 0.5 ) ); // milky grains
	gCol = mix( gCol, mix( u.color, u.color2, 0.5 ).mul( 0.9 ), feld.mul( 0.7 ) );
	gCol = mix( gCol, u.color4, lith );
	gCol = mix( gCol, gCol.mul( u.color2 ).mul( 1.6 ), coat.mul( 0.5 ) ).mul( frost.mul( 0.25 ).add( 1 ) );
	const cement = u.color3.mul( valueNoise( mod( p.div( gs.mul( 0.15 ) ), 4096 ) ).mul( 0.3 ).add( 0.7 ) );
	let color = mix( cement, gCol, G.inside );
	// Iron paints whole laminae, grains and cement alike.
	color = mix( color, color.mul( u.color2 ).mul( 1.7 ), iron.mul( 0.6 ) ).mul( float( 1 ).sub( seamL.mul( 0.35 ) ) );
	color = color.mul( fbm( p, float( 0.05 ), fp, 2, 7 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) ).mul( fbm( p, float( 2e-3 ), fp, 3, 8 ).sub( 0.5 ).mul( 0.25 ).add( 1 ) );

	// Relief: domed grains, pores deep, laminae weather in ridges.
	const pore = G.inside.oneMinus().mul( G.w );
	const ridge = surfaceGradient( iron.mul( 6e-5 ).mul( wLam ), p );
	const slope = G.slope.mul( 0.7 ).add( ridge ).add( vec2( frost, frost.mul( - 0.7 ) ).mul( 0.3 ).mul( G.inside ) );
	const rough = u.roughness.add( pore.mul( 0.08 ) ).min( 1 );
	return { color: clamp( color, 0, 1 ), slope, cavity: pore.mul( 0.8 ), rough, s2: G.w.oneMinus().mul( 0.06 ) };

}

export function buildSlate( p, fp, u ) {

	const { tx, ty } = frame( p, u );
	const L = u.layerM, s = u.seed;
	// Terraces: a stretched noise cut in levels; a level edge is a step.
	const K = u.steps.mul( 9 ).add( 1 );
	const n = fbm( vec2( tx.div( 5 ), ty ).add( s ), L, fp, 4, 1 ).mul( K ).toVar();
	const lev = floor( n ), fr = fract( n );
	// Riser width in level units from the mean slope of n (K levels per
	// L): a per-pixel derivative here would be noisy and moire.
	const gn = K.div( L ).mul( 1.5 );
	const riserW = gn.mul( max( float( 4e-4 ), fp.mul( 1.2 ) ) ).min( 0.35 ); // risers 0.4 mm, at least a pixel
	const riser = smoothstep( float( 1 ).sub( riserW ), float( 1 ), fr ).toVar();
	const undul = fbm( vec2( tx.div( 2 ), ty ), float( 0.006 ), fp, 4, 5 ).mul( 1.5e-4 );
	// A riser under two pixels is a jump inside one 2 x 2 quad: its
	// gradient would sparkle, so it fades out and the level tilt remains.
	const wR = fadeIn( float( 6e-4 ), fp, 2.0, 5.0 );
	const slopeT = surfaceGradient( lev.add( riser ).mul( 3e-4 ).mul( u.steps ), p ).mul( wR ).add( surfaceGradient( undul, p ) );
	const edge = riser.mul( riser.oneMinus() ).mul( 4 ).mul( u.steps ); // the fresh riser face

	// Lineation and faint bands along the cleavage.
	const lin = valueNoise( vec2( tx.div( 6e-3 ), ty.div( 2.5e-4 ) ).add( s.mul( 3 ) ) ).sub( 0.5 ).mul( fadeIn( float( 2.5e-4 ), fp, 1.5, 4.0 ) );
	const lin2 = valueNoise( mod( vec2( tx.div( 4e-4 ), ty.div( 1.5e-5 ) ), 4096 ).add( 9 ) ).sub( 0.5 ).mul( fadeIn( float( 1.5e-5 ), fp, 1.5, 4.0 ) );
	const bands = valueNoise( vec2( ty.div( 0.02 ), s ) ).sub( 0.5 ).mul( u.layers );
	const lvTone = hash1( vec2( lev, s.add( 2.0 ) ) ).sub( 0.5 ).mul( 0.08 ); // each layer a slightly different shade
	const mott = fbm( p, float( 0.03 ), fp, 5, 9 ).sub( 0.5 );
	let color = u.color.mul( float( 1 ).add( bands.mul( u.colorVar ).mul( 2 ) ).add( mott.mul( u.colorVar ).mul( 1.5 ) ).add( lin.mul( 0.14 ) ).add( lin2.mul( 0.1 ) ).add( lvTone ) );
	color = mix( color, color.mul( 1.12 ).add( 0.01 ), edge );

	// Sericite flakes: tiny mirrors tilted a little out of the plane.
	const FV = voronoi( mod( vec2( tx.div( 3e-5 ), ty.div( 1.5e-5 ) ), 4096 ).add( 3.3 ), 0.9 );
	const fh = hash3( FV.id1.add( 1.3 ) );
	const flake = step( float( 1 ).sub( u.mica ), fh.z ).mul( smoothstep( 0.04, 0.12, FV.edge ) );
	const wFl = fadeIn( float( 2e-5 ), fp, 2.0, 5.0 );
	const tilt = fh.xy.sub( 0.5 ).mul( 0.25 ).mul( flake ).mul( wFl );
	color = color.mul( float( 1 ).add( flake.mul( wFl ).mul( 0.12 ) ) );

	// Pyrite: rare small cubes, brassy, a rust halo around.
	const Pq = p.div( 0.02 ).add( s.mul( 5 ) );
	const ph = hash3( floor( Pq ) );
	const pl = fract( Pq ).sub( ph.xy.mul( 0.6 ).add( 0.2 ) ).mul( 0.02 );
	const pr = ph.z.mul( 1.2e-3 ).add( 6e-4 );
	const pOn = step( float( 1 ).sub( u.pores.mul( 0.08 ) ), hash1( floor( Pq ).add( 7.7 ) ) );
	const cube = band( pl.x.abs().max( pl.y.abs() ), pr, fp ).mul( pOn );
	const rust = smoothstep( pr.mul( 4 ), pr, pl.length() ).mul( pOn ).mul( valueNoise( p.div( 1e-3 ) ).mul( 0.6 ).add( 0.4 ) );
	color = mix( color, color.mul( u.color2 ).mul( 2.2 ), rust.mul( 0.6 ) );
	// Pyrite: a brass mirror (metal). The face is a low pyramid of four
	// facets, each striated across (striations alternate on cube faces),
	// tarnished brown toward the rim.
	const q = pl.div( pr );
	const xDom = step( q.y.abs(), q.x.abs() );
	const facet = pick( xDom, vec2( sign( q.x ), 0 ), vec2( 0, sign( q.y ) ) ).mul( 0.18 );
	const stri = sin( pick( xDom, q.y, q.x ).mul( 70 ) ).mul( 0.12 ).mul( fadeIn( pr.mul( 0.09 ), fp, 2.0, 5.0 ) );
	const pyrSlope = facet.add( pick( xDom, vec2( 0, stri ), vec2( stri, 0 ) ) );
	const tarnish = smoothstep( 0.6, 1.0, q.x.abs().max( q.y.abs() ) );
	color = mix( color, mix( vec3( 0.86, 0.74, 0.42 ), vec3( 0.45, 0.32, 0.16 ), tarnish.mul( 0.7 ) ), cube );

	const rough = mix( u.roughness.add( edge.mul( 0.2 ) ).sub( flake.mul( wFl ).mul( 0.25 ) ), float( 0.14 ), cube ).clamp( 0.05, 1 );
	const lvTilt = hash3( vec2( lev, s.add( 5.5 ) ) ).xy.sub( 0.5 ).mul( 0.1 ).mul( u.steps ); // each layer split at its own slant
	const slope = mix( slopeT.add( tilt ).add( lvTilt ).add( vec2( lin2.mul( 0.04 ), 0 ) ), pyrSlope, cube );
	const sheen = color.mul( u.mica ).mul( 0.6 ).add( u.sheen );
	return { color: clamp( color, 0, 1 ), slope, cavity: edge.mul( 0.3 ), rough, s2: wFl.oneMinus().mul( u.mica ).mul( 0.01 ), sheen, metal: cube };

}
