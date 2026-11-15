// Cooling slag (blast furnace or smelter slag poured on a heap): a black
// glass that froze fast, full of gas bubbles, still red hot inside in
// places (crust_k 600 to 750 K at the surface, melt_k about 1150 K deep in
// the cracks). Level by level:
//   L0 flow      scale_mm (100 to 300 mm): broad frozen folds of the pour,
//                and zones still hot inside, whose glow fades and wanders
//                slowly (tens of seconds) as the heap cools.
//   L1 cracks    size_mm (15 to 50 mm): thermal contraction cracks into
//                polygons, the slabs a little domed; the cracks glow faintly
//                red only in the hot zones.
//   L2 striae    feature_mm (1 to 5 mm): flow bands in the glass (tint and
//                gloss), dull grey patches where it began to crystallise,
//                a thin iridescent tarnish.
//   L3 vesicles  cell_um (0.5 to 3 mm): dense gas bubbles, opened at the
//                surface: rough dark pits with a glossy rim.
//   L4 crystals  micro_um (30 to 100 um): needles grown in the glass, glints.
// Motion: only the glow moves (flowFbm with a long period): smooth.

import { vec2, float, clamp, smoothstep, mix, mod } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { frame, fbm, flowFbm, vesicles, microlites } from './common.js';
import { radiance } from './heat.js';
import { bubbleField } from '../ceramic/bubbles.js';

export function buildSlag( p, fp, u, t ) {

	const F = frame( p, u.angle );
	const S = u.sizeM;
	// L0 folds of the pour (across the flow), and the hot zones.
	const fold = fbm( vec2( F.f.x, F.f.y.mul( 0.35 ) ).add( u.seed.mul( 0.17 ) ), u.scaleM.mul( 0.5 ), fp, 3, 1 );
	const zone = flowFbm( p, F.dir.mul( u.flow ), t, 25, u.scaleM.mul( 0.6 ), fp, 3, 2 );
	const hot = smoothstep( u.cover.mul( 0.2 ).add( 0.45 ), 0.75, zone ).toVar();

	// L1 contraction cracks, slabs slightly domed.
	const jag = vec2( fbm( p, S.mul( 0.25 ), fp, 2, 3 ), fbm( p, S.mul( 0.25 ), fp, 2, 4 ) ).sub( 0.5 ).mul( 0.25 );
	const V = voronoi( mod( p.div( S ), 4096 ).add( jag ).add( 4.4 ), 0.85 );
	const sh = hash3( V.id1.add( 3.3 ) );
	// Cracks are wider where the inside is still hot and soft.
	const cw = float( 0.0002 ).add( sh.x.mul( 0.0005 ) ).add( hot.mul( 0.0012 ) );
	const crack = clamp( cw.sub( V.edge.mul( S ) ).div( fp ).add( 0.5 ), 0, 1 ).toVar();
	const dome = smoothstep( 0.0, 0.4, V.edge );
	const wS = fadeIn( S, fp, 2.0, 6.0 );

	// L2 flow bands, devitrified patches.
	const band = fbm( vec2( F.f.x.mul( 0.25 ), F.f.y ).add( fold.mul( u.featureM ).mul( 3 ) ), u.featureM, fp, 3, 5 );
	// Spherulites: round grey spots where the glass began to crystallise.
	const Sp = bubbleField( p, fp, u.featureM.mul( 1.5 ), 0.2, 6 );
	const devit = Sp.inside.mul( Sp.fade ).mul( smoothstep( 0.2, 1.0, Sp.d ).mul( 0.4 ).add( 0.6 ) ).mul( 0.8 );

	// L3, L4.
	const Ve = vesicles( p, fp, u.cellM, 0.55, 7, 0.9 );
	const Mi = microlites( p, fp, u.microM, 19, 0.15, 0.7 );

	const h = fold.mul( u.scaleM ).mul( 0.03 ).add( dome.mul( S ).mul( 0.015 ).mul( wS ) ).add( band.mul( u.featureM ).mul( 0.03 ) );
	const solid = float( 1 ).sub( crack );
	const slope = surfaceGradient( h, p ).mul( solid ).add( Ve.slope.add( Mi.slope.mul( 0.4 ) ).mul( solid ) );

	// Colour: black green glass, banded; grey dull patches; pits darker.
	const tone = sh.y.sub( 0.5 ).mul( u.colorVar ).add( 1 );
	let col = mix( u.color, u.color2, band ).mul( tone );
	col = mix( col, u.color3, devit.mul( 0.6 ) );
	col = col.mul( float( 1 ).sub( Ve.pit.mul( 0.5 ) ) ).add( Mi.on.mul( 0.006 ) );
	const color = mix( col, u.color.mul( 0.3 ), crack );

	// Light: faint red where the inside is still hot, more in the cracks
	// and in the bubbles opened onto the hot glass; nothing elsewhere.
	const Ts = u.crustK.add( hot.mul( u.meltK.sub( u.crustK ) ).mul( 0.7 ) );
	const Tk = u.crustK.add( hot.mul( u.meltK.sub( u.crustK ) ) );
	let emissive = radiance( Ts, u );
	emissive = mix( emissive, radiance( mix( Ts, Tk, 0.6 ), u ), Ve.pit.mul( 0.6 ) );
	emissive = mix( emissive, radiance( Tk, u ), crack );

	const rough = mix( u.roughness, float( 0.55 ), devit.max( Ve.pit.mul( 0.8 ) ) ).add( band.mul( 0.04 ) );
	return {
		color, slope, emissive, rough,
		s2: Ve.s2.add( Mi.s2 ),
		cavity: crack.max( Ve.pit ),
		irid: smoothstep( 0.55, 0.75, fbm( p, u.scaleM.mul( 0.3 ), fp, 2, 9 ) ).mul( 0.25 ).mul( float( 1 ).sub( devit ) ).mul( solid ), iridNm: fbm( p, u.featureM.mul( 6 ), fp, 2, 8 ).mul( 300 ).add( 250 ),
	};

}
