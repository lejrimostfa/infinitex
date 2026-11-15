// A moulded plastic part, as the mould left it.
//   L0 colour   masterbatch mottling: the pigment never mixes perfectly
//   L0 flow     flow lines: shallow ripples (2 to 4 mm apart) frozen in the
//               skin as the melt front advanced from the gate
//   L0 parting  where the two mould halves met: a hairline ridge with a
//               little flash, and a 20 um step between the halves
//   L0 pins     ejector pin marks: discs (5 to 8 mm) a little sunk, a dark
//               gap ring, a ground face with lathe rings, no grain
//   L0 peel     orange peel: a long waviness (mm) seen in glossy reflections
//   L1 grain    spark eroded (EDM) mould texture: overlapping craters of
//               30 to 100 um, each with a raised recast rim
//   L1 blast    bead blasted texture: smooth round dimples, packed
//   L2          the same textures one and two octaves finer: smaller craters
//               (10 to 20 um) and recast droplets or peening (3 to 6 um)
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, float, floor, fract, mix, smoothstep, step, clamp, exp, abs, sin, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

// One octave of craters (cell size cellM). rim: raised rim height, as a
// share of the depth (EDM 0.5, bead blast 0). Slopes are dimensionless.
function craters( p, cellM, depth, rim, jitter, off ) {

	const v = voronoi( mod( p.div( cellM ), 4096 ).add( off ), jitter ); // mod: hashes stay exact
	const h = hash3( v.id1.add( off ) );
	const R = h.x.mul( 0.35 ).add( 0.45 ); // radius, cells
	const d = v.toSeed.length().max( 1e-5 );
	const t = d.div( R );
	// Bowl (1 - t^2) inside, a rim bump at t = 1 that dies outside.
	const bowl = float( 1 ).sub( t.mul( t ) ).max( 0 );
	const rimB = exp( t.sub( 1 ).div( 0.22 ).pow( 2 ).negate() );
	// Height H = D (rim rimB - bowl); its derivative along t.
	const D = depth.mul( h.y.mul( 0.6 ).add( 0.7 ) ).mul( 0.15 ); // shallow: depth about a tenth of the width
	const dHdt = t.mul( 2 ).mul( step( t, 1 ) ).add( rimB.mul( rim ).mul( t.sub( 1 ) ).mul( - 2 / ( 0.22 * 0.22 ) ) ).mul( D );
	const slope = v.toSeed.div( d ).mul( dHdt ).div( R );
	// The border between craters is a sharp ridge where they cut each other.
	const ridge = smoothstep( 0.1, 0.0, v.edge ).mul( rim );
	return { slope: slope.add( v.dir.mul( ridge ).mul( D ).mul( 3 ) ), pit: bowl.mul( h.y.mul( 0.6 ).add( 0.7 ) ), rim: rimB.mul( rim ).max( ridge ), id: v.id1 };

}

export function buildSolid( p, fp, u ) {

	const s = u.seed;
	// L0 colour mottling, two scales.
	const tone = valueNoise( p.div( 0.05 ).add( s ) ).sub( 0.5 ).mul( u.colorVar ).add( valueNoise( p.div( 0.006 ).add( s.add( 3 ) ) ).sub( 0.5 ).mul( u.colorVar ).mul( 0.6 ) ).add( 1 );
	let color = u.color.mul( tone );
	let slope = vec2( 0 ), cavity = float( 0 ), rough = u.roughness, s2 = float( 0 );

	// Flow lines: ripples around a gate off the left edge, wavering.
	const gate = vec2( - 0.04, 0.17 ).add( vec2( hash1( vec2( s, 1 ) ), hash1( vec2( s, 2 ) ) ).sub( 0.5 ).mul( 0.1 ) );
	const gd = p.sub( gate );
	const gr = gd.length();
	const fq = gr.div( 0.003 ).add( valueNoise( p.div( 0.02 ).add( s.mul( 2 ) ) ).mul( 4 ) ).add( valueNoise( p.div( 0.005 ).add( 1.3 ) ).mul( 1.2 ) );
	const fAmp = smoothstep( 0.25, 0.7, valueNoise( vec2( gr.div( 0.03 ), s ) ) ).mul( u.flow ).mul( fadeIn( float( 0.003 ), fp, 1.5, 4.0 ) );
	const ripple = sin( fq.mul( Math.PI * 2 ) );
	slope = slope.add( gd.div( gr.max( 1e-4 ) ).mul( ripple ).mul( fAmp ).mul( 0.012 ) );
	rough = rough.mul( ripple.mul( fAmp ).mul( 0.15 ).add( 1 ) );
	color = color.mul( ripple.mul( fAmp ).mul( 0.02 ).add( 1 ) );

	// Orange peel: a waviness of a few mm, only in reflections.
	const pq = p.div( 0.0025 ).add( s.mul( 9 ) );
	const peel = vec2( valueNoise( pq ), valueNoise( pq.add( 5.3 ) ) ).sub( 0.5 ).add( vec2( valueNoise( pq.mul( 2.7 ) ), valueNoise( pq.mul( 2.7 ).add( 1.9 ) ) ).sub( 0.5 ).mul( 0.4 ) );
	const wPeel = fadeIn( float( 0.0025 ), fp, 1.5, 4.0 );
	slope = slope.add( peel.mul( u.peel ).mul( 0.008 ).mul( wPeel ) );
	s2 = s2.add( wPeel.oneMinus().mul( u.peel ).mul( 2e-4 ) );

	// Mould texture. The pin faces below are ground smooth: no grain there.
	let pinIn = float( 0 );
	if ( u.ejectors.value > 0 ) {

		// Ejector pins on a loose 9 cm grid, about one cell in two.
		const q = p.div( 0.09 ).add( s.mul( 1.3 ) );
		const id = floor( q );
		const h = hash3( id.add( 0.7 ) );
		const c = id.add( h.xy.mul( 0.6 ).add( 0.2 ) );
		const rel = q.sub( c ).mul( 0.09 );
		const d = rel.length();
		const R = u.pinM.mul( 0.5 );
		const on = step( h.z, u.ejectors.mul( 0.55 ) );
		pinIn = clamp( R.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( on ).toVar();
		const gap = clamp( float( 4e-5 ).sub( abs( d.sub( R ) ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
		// Ground face: fine lathe rings (15 um) around the pin axis.
		const lathe = sin( d.div( 1.5e-5 ).mul( Math.PI * 2 ) ).mul( fadeIn( float( 1.5e-5 ), fp, 2.0, 6.0 ) );
		slope = slope.add( rel.div( d.max( 1e-6 ) ).mul( lathe.mul( 0.04 ) ).mul( pinIn ) );
		color = color.mul( float( 1 ).sub( gap.mul( 0.5 ) ) ).mul( pinIn.mul( 0.05 ).add( 1 ) );
		cavity = cavity.max( gap );

	}

	const keep = float( 1 ).sub( pinIn );
	if ( u.grain.value > 0 ) {

		const g = u.grainM;
		const w1 = fadeIn( g, fp, 2.0, 6.0 ), w2 = fadeIn( g.mul( 0.3 ), fp, 2.0, 6.0 ), w3 = fadeIn( g.mul( 0.1 ), fp, 2.0, 6.0 );
		const c1 = craters( p, g, u.grain.mul( 0.5 ), 0.5, 0.95, s.mul( 3.1 ) );
		const c2 = craters( p, g.mul( 0.3 ), u.grain.mul( 0.4 ), 0.4, 0.95, s.add( 11.7 ) );
		const c3 = craters( p, g.mul( 0.1 ), u.grain.mul( 0.3 ), 0.0, 0.9, s.add( 23.1 ) );
		slope = slope.add( c1.slope.mul( w1 ).add( c2.slope.mul( w2 ) ).add( c3.slope.mul( w3 ) ).mul( keep ) );
		const shade = c1.pit.mul( w1 ).mul( 0.06 ).add( c2.pit.mul( w2 ).mul( 0.04 ) ).sub( c1.rim.mul( w1 ).mul( 0.05 ) );
		color = color.mul( float( 1 ).sub( shade.mul( keep ) ) ).mul( hash1( c1.id ).sub( 0.5 ).mul( 0.06 ).mul( w1 ).add( 1 ) );
		cavity = cavity.max( c1.pit.mul( w1 ).mul( 0.5 ).mul( keep ) );
		s2 = s2.add( w1.oneMinus().mul( 0.03 ).add( w2.oneMinus().mul( 0.02 ) ).add( w3.oneMinus().mul( 0.012 ) ).mul( u.grain ).mul( keep ) );

	}

	if ( u.blast.value > 0 ) {

		const g = u.blastM;
		const w1 = fadeIn( g, fp, 2.0, 6.0 ), w2 = fadeIn( g.mul( 0.33 ), fp, 2.0, 6.0 ), w3 = fadeIn( g.mul( 0.11 ), fp, 2.0, 6.0 );
		const c1 = craters( p, g, u.blast.mul( 0.35 ), 0.0, 0.9, s.mul( 4.3 ) );
		const c2 = craters( p, g.mul( 0.33 ), u.blast.mul( 0.3 ), 0.0, 0.9, s.add( 7.9 ) );
		const c3 = craters( p, g.mul( 0.11 ), u.blast.mul( 0.25 ), 0.0, 0.85, s.add( 31.3 ) );
		slope = slope.add( c1.slope.mul( w1 ).add( c2.slope.mul( w2 ) ).add( c3.slope.mul( w3 ) ).mul( keep ) );
		// The nozzle passes leave the blast denser here, lighter there (mm).
		const pass = valueNoise( vec2( p.x.div( 0.006 ), p.y.div( 0.0015 ) ).add( s.mul( 2.2 ) ) ).mul( 0.6 ).add( valueNoise( p.div( 7e-4 ).add( 4.4 ) ).mul( 0.4 ) ).sub( 0.5 ).mul( u.blast );
		color = color.mul( float( 1 ).sub( c1.pit.mul( w1 ).mul( 0.04 ).mul( keep ) ) ).mul( pass.mul( 0.08 ).add( 1 ) );
		rough = rough.add( pass.mul( 0.12 ).mul( keep ) );
		s2 = s2.add( w1.oneMinus().mul( 0.025 ).add( w2.oneMinus().mul( 0.02 ) ).add( w3.oneMinus().mul( 0.015 ) ).mul( u.blast ).mul( keep ) );

	}

	if ( u.parting.value > 0 ) {

		// Parting line at 70 % of the height, wandering by a few um.
		const y0 = float( 0.21 ).add( valueNoise( vec2( p.x.div( 0.01 ), s ) ).sub( 0.5 ).mul( 2e-5 ) );
		const dy = p.y.sub( y0 );
		const ridgeW = float( 6e-5 ).add( valueNoise( vec2( p.x.div( 6e-4 ), s.add( 2 ) ) ).mul( 8e-5 ) ); // flash, ragged
		const ridge = clamp( ridgeW.sub( abs( dy ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( u.parting );
		const wR = smoothstep( 0.5, 2.0, ridgeW.div( fp ) );
		slope = slope.add( vec2( 0, clamp( dy.div( ridgeW ), - 1, 1 ).negate().mul( 0.5 ) ).mul( ridge ).mul( wR ) );
		// Step between the halves: one is 20 um proud.
		slope = slope.add( vec2( 0, - 0.4 ).mul( clamp( float( 2e-5 ).sub( abs( dy ) ).div( fp.max( 1e-5 ) ), 0, 1 ) ).mul( u.parting ) );
		color = color.mul( ridge.mul( wR.mul( 0.15 ).add( 0.05 ) ).add( 1 ) );
		rough = mix( rough, rough.mul( 0.7 ), ridge );

	}

	return { color, slope, cavity, rough, s2, pinIn };

}
