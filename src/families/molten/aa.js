// Aa lava: the crust of a fast, cooling basalt flow torn into clinker,
// jagged blocks that ride and tumble on a core still at about 1380 K.
// Level by level:
//   L0 heat      scale_mm (80 to 200 mm): patches where the clinker is thin
//                and the core shows more, breathing as the flow churns.
//   L1 blocks    size_mm (20 to 80 mm): angular blocks with ragged edges, a
//                second layer of smaller ones lower down, the glowing core
//                in the gaps. Each block tumbles slowly: its faces turn,
//                so the light on it changes; its rim facing a gap is hotter.
//   L2 spines    feature_mm (3 to 10 mm): broken facets and spines, each a
//                face with its own tilt; red brown oxide (hematite) patches.
//   L3 vesicles  cell_um (0.5 to 3 mm): torn, stretched gas bubbles.
//   L4 glass     micro_um (30 to 100 um): laths and oxide grains glinting.
// The clinker rides the flow at flow_mm_s (a translation), the core under it
// is carried a little slower (flowFbm), the tumble is a rotation in time:
// all continuous, nothing pops.

import { vec2, float, clamp, smoothstep, mix, mod, cos, sin, step } from 'three/tsl';
import { fadeIn, surfaceGradient, pick } from '../../core/lod.js';
import { hash3 } from '../../core/hash.js';
import { crystals } from '../stone/crystals.js';
import { frame, fbm, flowFbm, vesicles, microlites } from './common.js';
import { radiance } from './heat.js';

// One layer of blocks of size S. Returns cover, height (S units), a hash
// and the distance to the gap.
function blocks( q, S, fp, g0, salt ) {

	const jag = vec2( fbm( q, S.mul( 0.3 ), fp, 3, salt ), fbm( q, S.mul( 0.3 ), fp, 3, salt + 1 ) ).sub( 0.5 ).mul( 0.5 );
	const C = crystals( mod( q.div( S ), 4096 ).add( jag ).add( salt * 0.71 ), { elong: 0.8, size: 0.35, square: 0.7 } );
	const h = hash3( C.id1.add( salt ) );
	const e = C.gap.sub( g0 );
	const body = clamp( e.mul( S ).mul( 0.5 ).div( fp ).add( 0.5 ), 0, 1 );
	const height = smoothstep( 0.0, 0.5, e ).mul( h.z.mul( 0.5 ).add( 0.5 ) );
	return { body, height, h, e, C };

}

export function buildAa( p, fp, u, t ) {

	const F = frame( p, u.angle );
	const S = u.sizeM;
	const q = F.f.sub( vec2( u.flow.mul( t ), 0 ) ).add( u.seed.mul( 0.11 ) ).toVar();

	// L0: where the clinker is thin, breathing.
	const thin = flowFbm( F.f, vec2( u.flow.mul( 0.5 ), 0 ), t, 6, u.scaleM, fp, 2, 1 );
	const g0 = float( 1 ).sub( u.cover ).mul( 0.5 ).add( smoothstep( 0.4, 0.75, thin ).mul( 0.25 ) );

	// L1: two layers of blocks.
	const A = blocks( q, S, fp, g0, 3 );
	const B = blocks( q.add( 0.013 ), S.mul( 0.45 ), fp, g0.mul( 0.8 ), 9 );
	const hB = B.height.mul( 0.45 ).sub( 0.35 );
	const top = step( hB, A.height ).mul( A.body ).max( float( 1 ).sub( B.body ) ).toVar();
	const solid = A.body.max( B.body ).toVar();
	const bh = pick( top, A.h, B.h ).toVar();
	// Tumble: each block turns its tilt slowly (0.05 to 0.3 rad/s).
	const ang = bh.x.mul( 6.2832 ).add( t.mul( bh.y.sub( 0.5 ).mul( 0.5 ) ) );
	const tilt = vec2( cos( ang ), sin( ang ) ).mul( bh.z.mul( 0.35 ).add( 0.1 ) );
	const height = pick( top, A.height, hB ).mul( S ).mul( 0.25 );
	const wB = fadeIn( S, fp, 2.0, 6.0 );

	// L2: facets and spines, each a face with its own tilt.
	const Fc = crystals( mod( q.div( u.featureM ), 4096 ).add( bh.xy.mul( 7 ) ), { elong: 1.2, size: 0.4, square: 0.85 } );
	const fh = hash3( Fc.id1.add( 5.5 ) );
	const wF = fadeIn( u.featureM, fp, 2.0, 6.0 );
	const facet = fh.xy.sub( 0.5 ).mul( 1.4 ).mul( wF );
	const edge = clamp( float( 0.06 ).sub( Fc.gap ).mul( u.featureM ).div( fp ).add( 0.5 ), 0, 1 ).mul( wF );
	const oxide = smoothstep( 0.62, 0.8, fbm( q, S.mul( 0.5 ), fp, 3, 6 ).add( fh.z.mul( 0.15 ) ) );
	// A second, finer set of broken faces: clinker is spiny at every scale.
	const Fd = crystals( mod( q.div( u.featureM.mul( 0.3 ) ), 4096 ).add( 2.2 ), { elong: 1.5, size: 0.4, square: 0.85 } );
	const fd = hash3( Fd.id1.add( 8.8 ) );
	const wD = fadeIn( u.featureM.mul( 0.3 ), fp, 2.0, 6.0 );

	// L3, L4: torn vesicles (stretched along the flow), laths.
	const Ve = vesicles( vec2( q.x.div( 1.8 ), q.y ), fp, u.cellM, 0.5, 13, 0.9 );
	const Mi = microlites( q, fp, u.microM, 17, 0.2, 0.8 );

	const gl = tilt.add( facet ).add( fd.xy.sub( 0.5 ).mul( 0.9 ).mul( wD ) ).add( Ve.slope.mul( vec2( 0.55, 1 ) ) ).add( Mi.slope.mul( 0.5 ) ).mul( solid );
	// Granular roughness under the facets: the clinker surface is a
	// crust of tiny spines and broken bubbles (0.2 to 1 mm).
	const grit = fbm( q, u.cellM.mul( 0.8 ), fp, 5, 21 );
	const slope = F.toP( gl.mul( wB ) ).add( surfaceGradient( height.add( grit.mul( u.cellM ).mul( 0.7 ) ).mul( solid ), p ) );

	// Colour: dark grey basalt, red brown oxide, dark facet edges.
	const tone = bh.y.sub( 0.5 ).mul( u.colorVar ).add( 1 ).mul( fh.y.mul( 0.3 ).add( 0.85 ) );
	let rock = mix( u.color, u.color2, oxide ).mul( tone );
	rock = rock.mul( fd.z.mul( 0.4 ).add( 0.8 ) ).mul( grit.mul( 0.6 ).add( 0.7 ) ).mul( float( 1 ).sub( edge.mul( 0.4 ) ) ).mul( float( 1 ).sub( Ve.pit.mul( 0.5 ) ) ).add( Mi.on.mul( 0.015 ) );
	const color = mix( u.color.mul( 0.35 ), rock, solid );

	// Light: the core in the gaps (partly hidden: deeper ones dimmer); block
	// rims next to a gap and freshly turned blocks still hot.
	const core = flowFbm( F.f, vec2( u.flow.mul( 0.7 ), 0 ), t, 4, float( 0.015 ), fp, 3, 2 );
	const Tm = u.meltK.mul( core.mul( 0.1 ).add( 0.92 ) );
	const gapGlow = float( 1 ).sub( solid ).mul( smoothstep( 0.3, 0.7, thin ).mul( 0.5 ).add( 0.5 ) );
	const rimD = pick( top, A.e, B.e ).max( 0 );
	const rim = rimD.div( 0.05 ).negate().exp();
	const Tb = u.crustK.add( bh.x.mul( bh.x ).mul( 120 ) ).add( rim.mul( u.meltK.sub( u.crustK ).mul( 0.3 ) ) );
	const emissive = mix( radiance( Tb, u ), radiance( Tm, u ), gapGlow );

	return {
		color, slope, emissive,
		rough: mix( float( 0.25 ), u.roughness, solid ), s2: Ve.s2.add( Mi.s2 ).add( wF.oneMinus().mul( 0.05 ) ).add( wD.oneMinus().mul( 0.04 ) ),
		cavity: float( 1 ).sub( solid ).max( edge.mul( 0.6 ) ).max( Ve.pit ),
	};

}
