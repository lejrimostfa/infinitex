// Settled snow.
//   L0 drifts    sastrugi (ridges carved by the wind, long along it) and
//                soft sun cups; light enters the snow and comes back blue
//                from the hollows; a granular crust of 2 to 10 mm
//   L1 grains    old snow is a pack of ice grains of 0.3 to 2 mm, rounded
//                by sublimation and bonded by necks; each grain has faces
//                that flash in the sun (the glitter of snow); sintered:
//                necks of ice bond the grains across the gaps
//   L2 crystals  up close, some grains are still crystals: hexagonal
//                plates with six ridges and stellar arms, the rest rounded
//                grains with facets; clear ice, so their cores look blue
//                grey and their rims bright
// Returns { color, slope, cavity, rough, s2 } for shader.js.
//
// Each level sits in a gate() (core/lod.js): beyond the grains' fade only
// the drifts, the crust and the mean colour are computed, and the plates,
// facets and frost run only where they show.

import { vec2, vec3, float, mix, smoothstep, step, abs, max, cos, sin, atan, mod } from 'three/tsl';
import { fadeIn, fadeOn, gate, surfaceGradient } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { packed, fbm, line } from './grains.js';

// Hexagon in grain coordinates: distance to the outline (negative inside)
// and to the six arms from the centre. q in grain units, a: rotation.
export function hexagon( q, a, r ) {

	const c = cos( a ), s = sin( a );
	const l = vec2( q.x.mul( c ).add( q.y.mul( s ) ), q.y.mul( c ).sub( q.x.mul( s ) ) );
	const k = 0.8660254;
	const d = max( abs( l.x ), max( abs( l.x.mul( 0.5 ).add( l.y.mul( k ) ) ), abs( l.x.mul( 0.5 ).sub( l.y.mul( k ) ) ) ) );
	// Arms: angular distance to the nearest of six directions, as a length.
	const ang = atan( l.y, l.x );
	const sector = ang.div( Math.PI / 3 ).add( 0.5 ).fract().sub( 0.5 ).mul( Math.PI / 3 );
	const arm = abs( sin( sector ) ).mul( l.length() );
	return { out: d.sub( r ), arm, rad: l.length() };

}

// L2 hexagonal plates: a quarter of the top grains are flat crystals,
// one facet, six arms and a rim; around them, the gap shows.
function hexPlates( G, ts, fp, u ) {

	const g = u.grainM, id = G.id;
	const wX = fadeIn( g.mul( 0.08 ), fp, 2.0, 6.0 ).toVar();
	const hexG = step( 0.72, id.y ).mul( G.top ).mul( wX ).toVar();
	const X = hexagon( ts, id.z.mul( 1.05 ), float( 0.36 ).add( id.x.mul( 0.08 ) ) );
	const inside = smoothstep( 0.5, - 0.5, X.out.mul( g ).div( fp ) );
	const arms = line( X.arm.mul( g ), g.mul( 0.012 ), fp ).mul( inside );
	const rim = line( X.out.add( 0.03 ).mul( g ), g.mul( 0.015 ), fp );
	const plateCol = mix( u.color2, u.color, X.out.negate().div( 0.3 ).clamp( 0, 1 ).oneMinus().mul( 0.6 ).add( 0.3 ) )
		.add( arms.mul( 0.25 ) ).add( rim.mul( 0.3 ) );
	// A hexagonal plate lies flat: its own normal, no dome (flat).
	return { hexG, col: mix( u.color3.mul( 0.85 ), plateCol, inside ), flat: hexG.mul( inside ) };

}

// Facets on the rounded grains: flat patches with their own lean, smooth
// ice that glints. Weighted by wF (2 px per 0.3 g).
function facets( p, id, wF, fp, u ) {

	const g = u.grainM;
	const F = voronoi( wrapCoord( p.div( g.mul( 0.3 ) ) ).add( 2.6 ), 0.9 );
	const fh = hash3( F.id1.add( id.xy.mul( 13 ) ) );
	const glint0 = step( 0.5, fh.z );
	return {
		lean: fh.xy.sub( 0.5 ).mul( 0.6 ).mul( glint0 ).mul( wF ),
		edge: float( 1 ).sub( line( F.edge.mul( g.mul( 0.3 ) ), g.mul( 0.004 ), fp ).mul( wF ).mul( glint0 ).mul( 0.08 ) ),
		// Glitter: grain faces are smooth ice.
		glint: step( 0.5, fh.z ).mul( u.sparkle ).mul( wF ),
	};

}

// Frost on the grains: a fine noise of 0.01 g.
function frostNoise( p, fp, u ) {

	const g = u.grainM;
	const frost = valueNoise( p.div( g.mul( 0.01 ) ) ).sub( 0.5 ).mul( fadeIn( g.mul( 0.01 ), fp, 2.0, 6.0 ) );
	return { frost, slope: vec2( frost, valueNoise( p.div( g.mul( 0.01 ) ).add( 4.4 ) ).sub( 0.5 ) ).mul( 0.2 ).mul( fadeIn( g.mul( 0.01 ), fp, 2.0, 6.0 ) ) };

}

export function buildSnow( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	// L0: sastrugi, ridges carved by the wind (long along x), and sun cups,
	// shallow dishes 2 to 4 cm wide. Height in meters.
	const R = u.rippleM;
	const n1 = fbm( vec2( p.x.div( R.mul( 3 ) ), p.y.div( R ) ).add( s ), 3 );
	const ridge = float( 1 ).sub( n1.mul( 2 ).sub( 1 ).abs() ).pow( 2 );
	// Sun cups: soft dishes from a second, rounder noise.
	const dish = smoothstep( 0.3, 0.7, fbm( p.div( R.mul( 0.4 ) ).add( s.mul( 3 ) ), 2 ) );
	const H = ridge.mul( 0.8 ).add( dish.mul( 0.25 ) ).add( fbm( p.div( R.mul( 0.3 ) ).add( 7.7 ), 2 ).mul( 0.15 ) )
		.mul( u.ripple ).mul( R ).mul( 0.25 ).toVar();
	// Screen derivatives: outside every gate.
	const drift = surfaceGradient( H, p ).toVar();
	// Light scattered deep in the snow comes back blue from the hollows.
	const hollow = smoothstep( 0.55, 0.15, H.div( u.ripple.mul( R ).mul( 0.25 ).max( 1e-6 ) ) ).mul( u.ripple.min( 1 ) ).toVar();
	const wG = fadeIn( g, fp, 1.5, 5.0 ).toVar();
	// Surface crust: a granular texture of 2 to 10 mm. Gate: from 2 px per
	// 4 mm (wCrust), and only while the grains are not fully in (wG < 1).
	const crust = gate( fadeOn( 0.004, fp, 2.0 ).and( float( g ).div( fp ).lessThan( 5.0 ) ), { tone: 0, slope: [ 0, 0 ] }, () => {

		const c = fbm( p.div( 0.004 ).add( 2.9 ), 3 );
		const wCrust = fadeIn( float( 0.004 ), fp, 2.0, 6.0 );
		return {
			tone: c.sub( 0.5 ).mul( 0.12 ).mul( wCrust ).mul( wG.oneMinus() ),
			slope: vec2( c.sub( 0.5 ), fbm( p.div( 0.004 ).add( 5.3 ), 3 ).sub( 0.5 ) ).mul( 0.3 ).mul( wCrust ).mul( wG.oneMinus() ),
		};

	}, [ p, fp, wG ] );
	const crustTone = crust.tone.toVar(), crustSlope = crust.slope.toVar();
	// Hollows and crust over a colour: the drift scale shading.
	const drifts = ( c ) => mix( c, u.color2.mul( 0.75 ), hollow.mul( 0.6 ) ).mul( crustTone.add( 1 ) );

	const wF = fadeIn( g.mul( 0.3 ), fp, 2.0, 6.0 ).toVar();
	const amp = u.relief.mul( 0.2 ).toVar();
	const meanCol = mix( u.color, u.color2, 0.28 );
	// Past the grains' fade (under 1.5 px per grain) the grains, plates,
	// facets and frost are skipped: drifts, crust and the mean colour remain.
	const far = { color: { node: drifts( meanCol ), size: 3 }, slope: { node: drift.add( crustSlope ), size: 2 }, cavity: float( 0 ).max( hollow.mul( 0.3 ) ), rough: u.roughness };
	const N = gate( fadeOn( g, fp, 1.5 ), far, () => {

		// L1: grains.
		const G = packed( p, g, fp, 6.1, { gap: 0.04, round: 0.4, crown: 0.4, radius: 0.6, elong: 0.5, tilt: 1.0, sizeVar: u.sizeVar, ratio: 0.5, lift: 0.2 } );
		const id = G.id;
		const ts = G.toSeed.toVar();
		// Clear ice: the core shows the blue green of the depth, the rim is a
		// thin bright line (total internal reflection), a few grains glint.
		const r = ts.length();
		const core = smoothstep( 0.42, 0.0, r ).mul( id.x.mul( 0.4 ).add( 0.6 ) );
		const rimL = smoothstep( 0.28, 0.4, r ).mul( smoothstep( - 0.05, 0.15, G.h ) );
		let grainCol = mix( u.color, u.color2.mul( vec3( 0.75, 0.88, 0.9 ) ), core.mul( 0.8 ) ).add( rimL.mul( 0.35 ) );
		const spot = smoothstep( 0.07, 0.02, ts.sub( vec2( 0.12, - 0.14 ) ).length() ).mul( step( 0.7, id.z ) );
		grainCol = grainCol.add( spot.mul( 0.8 ) );
		// Sintered: grains are bonded by necks of ice across the gaps.
		const A = G.A.v;
		const seg = A.p2.sub( A.p1 );
		const tt = A.toSeed.dot( seg ).div( seg.dot( seg ) ).clamp( 0, 1 );
		const neck = smoothstep( 0.13, 0.07, A.toSeed.sub( seg.mul( tt ) ).length() ).mul( G.A.body.oneMinus() ).mul( step( 0.35, hash3( A.id1.add( A.id2 ) ).x ) );
		const ao = smoothstep( - 0.4, 0.4, G.h ).max( neck.mul( 0.8 ) );
		grainCol = mix( u.color3.mul( 0.7 ), mix( grainCol, u.color2, neck.mul( 0.5 ) ), ao.mul( 0.85 ).add( 0.15 ) );
		let color = drifts( mix( meanCol, grainCol, wG ) );

		// L2: crystals. Plates skipped under 2 px per 0.08 g.
		const X = gate( fadeOn( g.mul( 0.08 ), fp, 2.0 ), { hexG: 0, col: [ 0, 0, 0 ], flat: 0 }, () => hexPlates( G, ts, fp, u ), [ fp, id, G.top, ts ] );
		color = mix( color, X.col, X.hexG );
		// Facets skipped under 2 px per 0.3 g.
		const F = gate( fadeOn( g.mul( 0.3 ), fp, 2.0 ), { lean: [ 0, 0 ], edge: 1, glint: 0 }, () => facets( p, id, wF, fp, u ), [ p, fp, id, wF ] );
		color = color.mul( F.edge );
		// Frost noise skipped under 2 px per 0.01 g.
		const Fr = gate( fadeOn( g.mul( 0.01 ), fp, 2.0 ), { frost: 0, slope: [ 0, 0 ] }, () => frostNoise( p, fp, u ), [ p, fp ] );
		color = color.mul( Fr.frost.mul( 0.12 ).add( 1 ) );

		return {
			color,
			slope: drift.add( crustSlope )
				.add( G.grad.mul( amp ).mul( wG ).mul( X.hexG.oneMinus() ) )
				.add( id.yz.sub( 0.5 ).mul( 0.5 ).mul( X.flat ) )
				.add( F.lean.mul( X.hexG.oneMinus() ) )
				.add( Fr.slope ),
			// Rough where frost covers the faces, smooth on glints and plates.
			rough: mix( u.roughness, float( 0.05 ), F.glint.max( X.flat.mul( 0.8 ) ) ),
			cavity: smoothstep( 0.2, - 0.3, G.h ).mul( wG ).mul( 0.6 ).max( hollow.mul( 0.3 ) ),
		};

	}, [ p, fp, wG, wF, amp, hollow, drift, crustTone, crustSlope ] );

	const s2 = wG.oneMinus().mul( 0.15 ).mul( amp ).add( wF.oneMinus().mul( 0.1 ) );
	return { color: N.color, slope: N.slope, cavity: N.cavity, rough: N.rough, s2 };

}
