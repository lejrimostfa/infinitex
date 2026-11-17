// A lava lake (Erta Ale, Nyiragongo): a black crust over basalt melt at
// about 1400 K, carried by convection. Every width is a share of the plate
// size, so the same lake reads on a 30 cm cube (plates of a few cm) and on
// a lake of hundreds of metres (plates of metres, the living room).
// Level by level:
//   L0 conveyors  scale_mm: wavy spreading lines where melt wells up (a
//                 bright seam) and sinks where the crust dives back (a
//                 narrower, duller seam). The crust moves away from a
//                 spreading line at flow_mm_s, so its age is its distance to
//                 the line over the speed: young crust is thin and glows
//                 red, old crust (crust_k) is black.
//   L1 plates     size_mm: rafts with jagged edges; the tears widen as the
//                 plates are pulled apart (0.4 to 3 percent of a plate), so
//                 old cracks are wide and bright. A hot lip lines each crack.
//                 Plates are domed and tilt down into the sink.
//   L1b cracks    contraction cracks, a fifth of a plate: thin, dull red on
//                 young crust, dark seams on old crust.
//   L1c bubbles   now and then a gas bubble bursts under a plate: a disc of
//                 melt opens (a seventh of a plate), its torn rim glows,
//                 then the skin closes over it again (every 7 to 13 s per
//                 spot, about 1.5 s each).
//   L2 wrinkles   feature_mm: ropy folds of the skin, across the flow, with
//                 rounded crests; a net of hair cracks (a twentieth of a
//                 plate) glows faintly on the young crust.
//   L3 vesicles   cell_um: gas bubbles frozen in the skin.
//   L4 glass      micro_um: plagioclase laths in black glass, tiny mirrors
//                 that glint.
// Slope: never from screen derivatives (surfaceGradient). Seen from low
// over a big lake, the screen difference across a stretched pixel flickered
// along the screen rows (dark lines flat on, rings at a slant). Instead the
// dive and rise of the plates take the exact derivative of their
// smoothsteps (they depend on the distance to the seam only), and the domes
// and wrinkles take differences in the crust frame, a fixed share of their
// size apart (a step that followed the footprint drew rows again).
// Motion: the crust pattern lives in its own frame, s = flow t - distance
// to the spreading line, so plates are born at the seam, drift and dive
// at the sink. Nothing pops: every pattern is a continuous function of t.

import { vec2, float, floor, fract, clamp, smoothstep, step, mix, mod, abs, sqrt, exp, length, max } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { frame, fbm, vesicles, microlites } from './common.js';
import { radiance } from './heat.js';

// Coverage of a line of half width w at distance d, anti-aliased by fp.
const line = ( d, w, fp ) => clamp( w.sub( d ).div( fp ).add( 0.5 ), 0, 1 );
// Derivative of smoothstep( a, b, x ) in x.
const dsm = ( a, b, x ) => { const k = clamp( x.sub( a ).div( b.sub( a ) ), 0, 1 ); return k.mul( k.oneMinus() ).mul( 6 ).div( b.sub( a ) ); };

export function buildLake( p, fp, u, t ) {

	const F = frame( p, u.angle );
	const L = u.scaleM, S = u.sizeM;
	// L0: spreading lines across the flow axis, wavy.
	const X = F.f.x.add( fbm( p, L.mul( 1.3 ), fp, 2, 1 ).sub( 0.5 ).mul( L ).mul( 0.7 ) ).div( L ).add( u.seed.mul( 0.37 ) );
	const band = floor( X );
	const dx = fract( X ).sub( 0.5 ).mul( L );
	const side = step( 0, dx ).mul( 2 ).sub( 1 );
	const ad = abs( dx ).toVar();
	const half = L.mul( 0.5 );
	// Crust frame: material at distance ad left the seam ad / flow ago.
	// Salt kept small: big offsets cost float precision at the microns.
	const salt = fract( vec2( side.mul( 0.137 ).add( band.mul( 0.291 ) ), side.mul( 0.53 ) ) ).mul( 5 );
	const Pm = vec2( u.flow.mul( t ).sub( ad ), F.f.y ).add( salt.mul( S ) ).toVar();
	const age = ad.div( half );
	const cool = sqrt( age.div( 0.3 ) ).min( 1 ).toVar(); // thin and red near the seam, black after

	// L1: plates; cracks widen with age, a hot lip along each.
	const jag = vec2( fbm( Pm, S.mul( 0.4 ), fp, 3, 3 ), fbm( Pm, S.mul( 0.4 ), fp, 3, 4 ) ).sub( 0.5 ).mul( 0.35 ).toVar();
	const plates = ( q ) => voronoi( wrapCoord( q.div( S ) ).add( jag ), 0.9 );
	const V = plates( Pm );
	const ph = hash3( V.id1.add( 7.7 ) );
	const edge = V.edge.mul( S ).toVar(); // metres to the plate's border
	const cw = S.mul( float( 0.002 ).add( smoothstep( 0.1, 0.9, age ).mul( 0.013 ).mul( ph.x.mul( 0.8 ).add( 0.4 ) ) ) ).toVar();
	const crack = line( edge, cw, fp ).toVar();
	const lip = exp( edge.sub( cw ).max( 0 ).div( S.mul( 0.025 ) ).negate() ).mul( float( 1 ).sub( cool.mul( 0.6 ) ) );
	// Seams: the spreading line (melt wells up) and the sink (crust dives).
	const seamW = L.mul( 0.012 ).mul( fbm( vec2( F.f.y, band ), L.mul( 0.25 ), fp, 2, 5 ).add( 0.4 ) );
	const ridge = line( ad, seamW, fp );
	const sink = line( half.sub( ad ), seamW.mul( 0.45 ), fp );

	// L1b: contraction cracks inside the plates.
	const C = voronoi( wrapCoord( Pm.div( S.mul( 0.21 ) ) ).add( jag.mul( 0.5 ) ).add( 1.7 ), 0.85 );
	const cW = fadeIn( S.mul( 0.21 ), fp, 2.0, 6.0 );
	const ccrack = line( C.edge.mul( S ).mul( 0.21 ), S.mul( 0.0018 ), fp ).mul( cW ).mul( smoothstep( 0.02, 0.25, age ) ).toVar();

	// L1c: bubbles bursting under the crust, one spot per cell of 1.6 plates.
	const G = S.mul( 1.6 );
	const cell = floor( Pm.div( G ) );
	const bh = hash3( wrapCoord( cell ).add( 31.3 ) );
	const centre = cell.add( bh.xy.mul( 0.6 ).add( 0.2 ) ).mul( G );
	const r = length( Pm.sub( centre ) );
	const phase = fract( t.div( bh.z.mul( 6 ).add( 7 ) ).add( bh.x ) );
	const k = phase.div( 0.12 ).clamp( 0, 1 ); // the burst, about 1.5 s
	const R = S.mul( 0.14 ).mul( sqrt( k ) );
	const closing = float( 1 ).sub( smoothstep( 0.55, 1, k ) );
	const live = step( phase, 0.12 ).mul( float( 1 ).sub( cool.mul( 0.5 ) ) );
	const open = line( r, R, fp ).mul( closing ).mul( live ).toVar();
	const rim = exp( r.sub( R ).div( S.mul( 0.02 ) ).pow( 2 ).negate() ).mul( live ).mul( float( 1 ).sub( k.mul( 0.7 ) ) ).toVar();

	// L2: ropy wrinkles across the flow (stretched along the crust y) with
	// rounded crests, and a net of hair cracks on the young crust.
	const wrW = fadeIn( u.featureM, fp, 1.5, 5.0 );
	const crest = ( n ) => float( 1 ).sub( n.mul( 2 ).sub( 1 ).pow( 2 ).add( 0.06 ).sqrt() ).div( float( 1 ).sub( Math.sqrt( 0.06 ) ) );
	const wrinkle = ( q ) => crest( fbm( vec2( q.x, q.y.mul( 0.35 ) ).add( vec2( fbm( q, S, fp, 2, 6 ).mul( S ).mul( 0.3 ), 0 ) ), u.featureM, fp, 3, 7 ) ).mul( u.featureM ).mul( 0.12 ).mul( wrW );
	const Hn = voronoi( wrapCoord( Pm.div( S.mul( 0.05 ) ) ).add( 3.1 ), 0.9 );
	const hairW = fadeIn( S.mul( 0.05 ), fp, 2.0, 6.0 );
	const hair = line( Hn.edge.mul( S ).mul( 0.05 ), S.mul( 0.0004 ), fp ).mul( hairW ).mul( float( 1 ).sub( cool ).mul( 0.8 ).add( 0.2 ) );

	// L3, L4: vesicles and glass laths, carried with the crust.
	const Ve = vesicles( Pm, fp, u.cellM, 0.35, 11 );
	const Mi = microlites( Pm, fp, u.microM, 21, 0.15, 0.6 );

	// Slope (see the header): plates and the torn rims of the bubbles.
	const melt = crack.max( ridge ).max( sink ).max( open );
	const plate = float( 1 ).sub( melt );
	const dAd = dsm( half.mul( 0.8 ), half, ad ).mul( S ).mul( - 0.12 ).add( dsm( L.mul( 0.06 ), float( 0 ), ad ).mul( S ).mul( 0.05 ) );
	const dome = ( q ) => smoothstep( 0.0, 0.3, plates( q ).edge ).mul( S ).mul( 0.02 );
	// Fixed steps, a small share of each feature: a step that followed the
	// footprint changed from one screen row to the next, and so did the slope.
	const eD = S.mul( 0.004 ), eW = u.featureM.mul( 0.02 );
	const d0 = dome( Pm ), w0 = wrinkle( Pm );
	const gPm = vec2(
		dome( Pm.add( vec2( eD, 0 ) ) ).sub( d0 ).div( eD ).add( wrinkle( Pm.add( vec2( eW, 0 ) ) ).sub( w0 ).div( eW ) ),
		dome( Pm.add( vec2( 0, eD ) ) ).sub( d0 ).div( eD ).add( wrinkle( Pm.add( vec2( 0, eW ) ) ).sub( w0 ).div( eW ) ) )
		// The rim stands up around the hole: a ring of height, its slope radial.
		.add( Pm.sub( centre ).div( r.max( 1e-6 ) ).mul( r.sub( R ).mul( - 2 ).div( S.mul( 0.02 ) ).mul( rim ).mul( 0.05 ) ) );
	const g = gPm.add( Ve.slope ).add( Mi.slope.mul( 0.6 ) );
	// Crust frame x runs against the frame x on the + side (Pm.x = flow t - ad).
	const slope = F.toP( vec2( dAd.mul( side ).sub( g.x.mul( side ) ), g.y ) ).mul( plate );

	// Colour: black glassy crust, silver grey sheen on young crust; melt
	// seen in the cracks is dark (it glows, it does not reflect much).
	const tone = ph.y.sub( 0.5 ).mul( u.colorVar ).add( 1 ).mul( fbm( Pm, S.mul( 0.08 ), fp, 3, 8 ).mul( 0.4 ).add( 0.8 ) );
	let crust = mix( u.color2, u.color, cool ).mul( tone );
	crust = crust.mul( float( 1 ).sub( Ve.pit.mul( 0.5 ) ) ).mul( float( 1 ).sub( hair.mul( 0.6 ) ) ).mul( float( 1 ).sub( ccrack.mul( 0.5 ) ) ).add( Mi.on.mul( 0.012 ) );
	// A thin chilled film forms on open melt in seconds: grey flakes that dim
	// the glow, drifting with the melt.
	const film = smoothstep( 0.56, 0.68, fbm( Pm.add( 0.3 ), S.mul( 0.06 ), fp, 3, 10 ) ).mul( float( 1 ).sub( ridge.mul( 0.7 ) ) ).mul( float( 1 ).sub( open ) ).toVar();
	const color = mix( crust, mix( u.color.mul( 0.4 ), u.color2, film.mul( 0.5 ) ), melt );

	// Light: crust temperature from its age, a little per plate, hotter on
	// the lips; melt hottest along the middle of a crack and in the seams,
	// with slow cooler streaks carried along.
	let Tc = mix( u.meltK.mul( 0.9 ), u.crustK, cool ).add( ph.z.sub( 0.5 ).mul( 60 ) );
	Tc = mix( Tc, u.meltK.mul( 0.88 ), lip.mul( 0.5 ).max( rim.mul( 0.8 ) ) );
	const mid = float( 1 ).sub( edge.div( cw ).clamp( 0, 1 ) );
	const streak = fbm( Pm.add( vec2( 0, t.mul( S ).mul( 0.05 ) ) ), S.mul( 0.12 ), fp, 2, 9 );
	const Tm = u.meltK.mul( mix( float( 0.9 ), float( 1.0 ), mid.max( ridge ).max( open ) ) ).sub( streak.sub( 0.5 ).mul( 90 ) )
		.sub( fbm( Pm.add( vec2( t.mul( S ).mul( 0.0375 ), 0 ) ), S.mul( 0.016 ), fp, 3, 12 ).sub( 0.5 ).mul( 120 ) );
	const hot = max( melt, sink.mul( 0.6 ) ).max( hair.mul( 0.35 ) ).max( ccrack.mul( float( 1 ).sub( cool ).mul( 0.5 ).add( 0.08 ) ) )
		.max( Ve.pit.mul( float( 1 ).sub( cool ) ).mul( 0.3 ) );
	const emissive = mix( radiance( Tc, u ), radiance( Tm.sub( film.mul( 160 ) ), u ), hot );

	const rough = mix( mix( float( 0.3 ), u.roughness, cool ), float( 0.15 ), melt );
	return {
		color, slope, rough, emissive,
		s2: Ve.s2.add( Mi.s2 ).add( wrW.oneMinus().mul( 0.01 ) ),
		cavity: crack.max( Ve.pit ).max( hair ).max( ccrack ).mul( 0.8 ),
	};

}
