// Ripstop nylon (kites, tents, jackets). x across the warp, y along it.
//   L0 grid    every gridM (5 mm) a pair of threads is woven as one, in
//              both directions: a raised square grid that stops tears; it
//              reads as a fine sheen grid from afar
//   L1 weave   plain weave of flat multifilament yarns (pitch threadM,
//              about 140 um, 70 denier); each thread on top arches over
//              its crossing and dips at its ends
//   L2 filaments 20 to 30 smooth filaments side by side (filM, 15 to 20 um)
//              in each flat yarn; each one a tiny bright cylinder. The
//              highlight is stretched across the threads (anisotropy).
// Returns { color, slope, cavity, rough, s2, aniso } for shader.js.

import { vec2, float, floor, fract, mix, smoothstep, step, clamp, abs, sqrt, mod } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';

export function buildRipstop( p, fp, u ) {

	const s = u.seed, t = u.threadM;
	// Threads are never ruled lines: a slow wander.
	const wx = valueNoise( vec2( p.y.div( 0.004 ), p.x.div( 0.02 ) ).add( s ) ).sub( 0.5 ).mul( 0.5 );
	const wy = valueNoise( vec2( p.x.div( 0.004 ), p.y.div( 0.02 ) ).add( s.add( 3 ) ) ).sub( 0.5 ).mul( 0.5 );
	const cx = p.x.div( t ).add( wx ), cy = p.y.div( t ).add( wy );
	const i = floor( cx ), j = floor( cy ), fx = fract( cx ), fy = fract( cy );
	const N = floor( u.gridM.div( t ) ).max( 4 );
	// Reinforcement pairs: threads 0 and 1 of every N.
	const ripI = step( mod( i, N ), 1.5 ), ripJ = step( mod( j, N ), 1.5 );
	// A pair works as one thread: both take the parity of the first.
	const ii = i.sub( ripI.mul( mod( i, N ) ) ), jj = j.sub( ripJ.mul( mod( j, N ) ) );
	const warpUp = step( 0.5, mod( ii.add( jj ), 2 ) ).oneMinus();
	// A reinforcement thread crossing a plain one stays on top.
	const top = clamp( warpUp.add( ripI.mul( ripJ.oneMinus() ) ).sub( ripJ.mul( ripI.oneMinus() ) ), 0, 1 ).toVar();
	const across = pick( top, fx, fy ), along = pick( top, fy, fx );
	const tid = pick( top, i, j.add( 7919 ) );
	const rip = pick( top, ripI, ripJ );
	const w1 = fadeIn( t, fp, 2.0, 6.0 ).toVar();

	// Flat yarn: round only near its edges; arched along its float.
	const a = across.mul( 2 ).sub( 1 );
	const fill = float( 0.985 );
	const ax = a.abs().div( fill );
	const inside = clamp( float( 1 ).sub( ax ).mul( t ).mul( 0.5 ).div( fp ).add( 0.5 ), 0, 1 );
	const edgeS = smoothstep( 0.7, 1.0, ax ).mul( a.sign() ).negate().mul( 0.5 );
	const arch = along.sub( 0.5 ).mul( - 2 ).mul( mix( float( 0.12 ), float( 0.3 ), rip ) );
	const dirA = pick( top, vec2( 1, 0 ), vec2( 0, 1 ) ), dirL = pick( top, vec2( 0, 1 ), vec2( 1, 0 ) );
	let slope = dirA.mul( edgeS ).add( dirL.mul( arch ) ).mul( inside ).mul( w1 );

	// Filaments.
	const nf = t.div( u.filM );
	const fa = across.mul( nf ).add( hash1( vec2( tid, 1.7 ) ) );
	const ff = fract( fa );
	const fid = floor( fa );
	const w2 = fadeIn( u.filM, fp, 2.0, 6.0 ).mul( w1 ).toVar();
	const fxx = ff.mul( 2 ).sub( 1 ).clamp( - 0.95, 0.95 );
	const fh = sqrt( float( 1 ).sub( fxx.mul( fxx ) ) );
	slope = slope.add( dirA.mul( fxx.div( fh ).negate().mul( 0.25 ).clamp( - 1, 1 ) ).mul( w2 ).mul( inside ) );

	// Colour: reinforcement threads a touch paler; edges and dips shaded.
	const tint = hash1( vec2( tid, 9.7 ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 )
		.mul( hash1( vec2( fid, tid ) ).sub( 0.5 ).mul( 0.1 ).mul( w2 ).add( 1 ) );
	const yarn = mix( u.color, u.color.mul( 1.06 ).add( 0.01 ), rip.mul( 0.6 ) ).mul( tint );
	const shade = float( 1 ).sub( smoothstep( 0.7, 1.0, ax ).mul( 0.2 ) ).mul( float( 1 ).sub( abs( along.sub( 0.5 ) ).mul( 0.15 ) ) )
		.mul( fh.mul( 0.25 ).add( 0.75 ).sub( 1 ).mul( w2 ).add( 1 ) );
	const cell = mix( u.color.mul( 0.35 ), yarn.mul( shade ), inside );
	// Far: the mean colour, with the grid as faint lines (a pair is about
	// two threads wide, so its coverage is 2 / N).
	const gx = abs( fract( p.x.div( u.gridM ) ).sub( 0.5 ) ).mul( u.gridM ).sub( u.gridM.mul( 0.5 ) ).abs();
	const gy = abs( fract( p.y.div( u.gridM ) ).sub( 0.5 ) ).mul( u.gridM ).sub( u.gridM.mul( 0.5 ) ).abs();
	const halfW = t.max( fp );
	const line = clamp( halfW.sub( gx.min( gy ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( t.div( halfW ) );
	const far = mix( u.color.mul( 0.92 ), u.color.mul( 1.0 ).add( 0.01 ), line );
	const color = mix( far, cell, w1 );

	const rough = mix( u.roughness, u.roughness.mul( 0.8 ), rip.mul( w1 ).max( line.mul( w1.oneMinus() ) ) );
	const cavity = inside.oneMinus().mul( 0.8 ).add( abs( along.sub( 0.5 ) ).mul( 0.4 ) ).mul( w1 );
	// Highlight stretched across the yarn: the filaments run along it.
	const aniso = dirL.mul( u.aniso ).mul( w1 );
	const s2 = w1.oneMinus().mul( 0.03 ).add( w2.oneMinus().mul( 0.01 ) );
	return { color, slope, cavity, rough, s2, aniso };

}
