// A lava lake (Erta Ale, Nyiragongo): a black crust over basalt melt at
// about 1400 K, carried by convection. Level by level:
//   L0 conveyors  scale_mm (100 to 300 mm): wavy spreading lines where melt
//                 wells up (a bright seam) and sinks where the crust dives
//                 back (a narrower, duller seam). The crust moves away from
//                 a spreading line at flow_mm_s, so its age is its distance
//                 to the line over the speed: young crust is thin and glows
//                 red, old crust (crust_k, 600 to 800 K) is black.
//   L1 plates     size_mm (20 to 60 mm): the crust tears into rafts with
//                 jagged edges; the tears widen as the plates are pulled,
//                 so cracks are bright where they are old and wide. Plates
//                 tilt down into the sink seam.
//   L2 wrinkles   feature_mm (2 to 6 mm): ropy wrinkles of the cooling skin;
//                 a net of hair cracks on young crust, glowing faintly.
//   L3 vesicles   cell_um (0.3 to 2 mm): gas bubbles frozen in the skin.
//   L4 glass      micro_um (30 to 100 um): plagioclase laths in black glass,
//                 tiny mirrors that glint.
// Motion: the crust pattern lives in its own frame, s = flow t - distance
// to the spreading line, so plates are born at the seam, drift and dive
// at the sink. Nothing pops: every pattern is a continuous function of t.

import { vec2, float, floor, fract, clamp, smoothstep, step, mix, mod, abs, sqrt } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { frame, fbm, vesicles, microlites } from './common.js';
import { radiance } from './heat.js';

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

	// Crust cools as it ages: thin and red near the seam, black after.
	const age = ad.div( half );
	const cool = sqrt( age.div( 0.3 ) ).min( 1 ).toVar();

	// L1: plates with jagged edges; cracks widen with age.
	const jag = vec2( fbm( Pm, S.mul( 0.4 ), fp, 3, 3 ), fbm( Pm, S.mul( 0.4 ), fp, 3, 4 ) ).sub( 0.5 ).mul( 0.35 );
	const V = voronoi( mod( Pm.div( S ), 4096 ).add( jag ), 0.9 );
	const ph = hash3( V.id1.add( 7.7 ) );
	const cw = float( 0.00025 ).add( smoothstep( 0.1, 0.9, age ).mul( 0.0012 ).mul( ph.x.mul( 0.8 ).add( 0.4 ) ) );
	const crack = clamp( cw.sub( V.edge.mul( S ) ).div( fp ).add( 0.5 ), 0, 1 ).toVar();
	// Seams: the spreading line (melt wells up) and the sink (crust dives).
	const seamW = L.mul( 0.012 ).mul( fbm( vec2( F.f.y, band ), L.mul( 0.25 ), fp, 2, 5 ).add( 0.4 ) );
	const ridge = clamp( seamW.sub( ad ).div( fp ).add( 0.5 ), 0, 1 );
	const sink = clamp( seamW.mul( 0.45 ).sub( half.sub( ad ) ).div( fp ).add( 0.5 ), 0, 1 );

	// L2: wrinkles of the skin, and hair cracks on the young crust.
	const wn = fbm( Pm.add( vec2( 0, fbm( Pm, S, fp, 2, 6 ).mul( S ) ) ), u.featureM, fp, 3, 7 );
	const wr = float( 1 ).sub( abs( wn.mul( 2 ).sub( 1 ) ) );
	const wrW = fadeIn( u.featureM, fp, 1.5, 5.0 );
	const H = voronoi( mod( Pm.div( u.featureM.mul( 2.5 ) ), 4096 ).add( 3.1 ), 0.9 );
	const hairW = fadeIn( u.featureM.mul( 2.5 ), fp, 2.0, 6.0 );
	const hair = clamp( float( 0.00012 ).sub( H.edge.mul( u.featureM ).mul( 2.5 ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( hairW ).mul( float( 1 ).sub( cool ).mul( 0.8 ).add( 0.2 ) );

	// L3, L4: vesicles and glass laths, carried with the crust.
	const Ve = vesicles( Pm, fp, u.cellM, 0.35, 11 );
	const Mi = microlites( Pm, fp, u.microM, 21, 0.15, 0.6 );

	// Height (meters): rafts domed a little, edges falling into the
	// cracks, plates tilting into the sink, wrinkles on top.
	const dome = smoothstep( 0.0, 0.3, V.edge ).mul( S ).mul( 0.02 );
	const dive = smoothstep( half.mul( 0.8 ), half, ad ).mul( S ).mul( - 0.12 );
	const rise = smoothstep( L.mul( 0.06 ), 0, ad ).mul( S ).mul( 0.05 );
	const h = dome.add( dive ).add( rise ).add( wr.mul( u.featureM ).mul( 0.12 ).mul( wrW ) );
	const plate = float( 1 ).sub( crack.max( ridge ).max( sink ) );
	let slope = surfaceGradient( h, p ).mul( plate );
	// Crust frame slopes back to the surface: its x runs against the flow
	// on the + side of a spreading line.
	const g = Ve.slope.add( Mi.slope.mul( 0.6 ) ).mul( plate );
	slope = slope.add( F.toP( vec2( g.x.mul( side ).negate(), g.y ) ) );

	// Colour: black glassy crust, silver grey sheen on young crust; melt
	// seen in the cracks is dark too (it glows, it does not reflect much).
	const tone = ph.y.sub( 0.5 ).mul( u.colorVar ).add( 1 ).mul( fbm( p, 0.02, fp, 3, 8 ).mul( 0.4 ).add( 0.8 ) );
	let crust = mix( u.color2, u.color, cool ).mul( tone );
	crust = crust.mul( float( 1 ).sub( Ve.pit.mul( 0.5 ) ) ).mul( float( 1 ).sub( hair.mul( 0.6 ) ) ).add( Mi.on.mul( 0.012 ) );
	// A thin chilled film forms on the open melt in a few seconds: grey
	// flakes that dim the glow, drifting with the melt.
	const film = smoothstep( 0.56, 0.68, fbm( Pm.add( 0.3 ), float( 0.003 ), fp, 3, 10 ) ).mul( float( 1 ).sub( ridge.mul( 0.7 ) ) ).toVar();
	const melt = mix( u.color.mul( 0.4 ), u.color2, film.mul( 0.5 ) );
	const color = mix( crust, melt, float( 1 ).sub( plate ) );

	// Light: crust temperature from its age, a little per plate; melt in
	// the cracks, hottest in the spreading seam.
	// The crust lip next to a crack is thinner, so hotter: a red fringe
	// about 2 mm wide that fades as the plate ages.
	const lip = V.edge.mul( S ).sub( cw ).max( 0 ).div( 0.0018 ).negate().exp().mul( float( 1 ).sub( cool.mul( 0.6 ) ) );
	let Tc = mix( u.meltK.mul( 0.9 ), u.crustK, cool ).add( ph.z.sub( 0.5 ).mul( 60 ) );
	Tc = mix( Tc, u.meltK.mul( 0.88 ), lip.mul( 0.5 ) );
	// Melt in a crack: hottest along its middle, cooler at the walls,
	// with slow cooler streaks carried along.
	const mid = float( 1 ).sub( V.edge.mul( S ).div( cw ).clamp( 0, 1 ) );
	const streak = fbm( Pm.add( vec2( 0, t.mul( 0.002 ) ) ), float( 0.006 ), fp, 2, 9 );
	const Tm = u.meltK.mul( mix( float( 0.9 ), float( 1.0 ), mid.max( ridge ) ) ).sub( streak.sub( 0.5 ).mul( 90 ) )
		.sub( fbm( Pm.add( vec2( t.mul( 0.0015 ), 0 ) ), float( 0.0008 ), fp, 3, 12 ).sub( 0.5 ).mul( 120 ) );
	const hot = crack.max( ridge ).max( sink.mul( 0.6 ) ).max( hair.mul( 0.35 ) ).max( Ve.pit.mul( float( 1 ).sub( cool ) ).mul( 0.3 ) );
	const emissive = mix( radiance( Tc, u ), radiance( Tm.sub( film.mul( 160 ) ), u ), hot );

	const rough = mix( mix( float( 0.3 ), u.roughness, cool ), float( 0.15 ), float( 1 ).sub( plate ) );
	return {
		color, slope, rough, emissive,
		s2: Ve.s2.add( Mi.s2 ).add( wrW.oneMinus().mul( 0.01 ) ),
		cavity: crack.max( Ve.pit ).max( hair ).mul( 0.8 ),
	};

}
