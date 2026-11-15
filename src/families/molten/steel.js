// Molten steel in a ladle or crucible, about 1800 K. The clean melt is a
// liquid metal: a mirror (reflectance about 0.6) with a low emissivity
// (0.35). An oxide skin (FeO, emissivity 0.85) forms where the surface
// cools, wrinkles and tears as the melt churns. Level by level:
//   L0 cells     scale_mm (80 to 200 mm): convection cells; melt wells up
//                clean and bright in the middle and flows out to the
//                borders, where the oxide gathers into dark lanes.
//   L1 oxide     size_mm (15 to 50 mm): patches of skin carried by the flow,
//                torn along meandering lines that glow; floating slag specks
//                (0.5 to 3 mm) drifting.
//   L2 wrinkles  feature_mm (1 to 3 mm): folds of the skin, and fine
//                ripples on the bare melt.
//   L3 specks    cell_um (0.2 to 1 mm): small slag and oxide particles.
//   L4 grain     micro_um (20 to 60 um): oxide crystals in the skin, glints.
// Motion: the skin and the big specks ride the surface (a translation at
// flow_mm_s) and change shape slowly; lace and ripples follow the outward
// flow of each cell (flowFbm: two copies crossfaded, restarted while
// unseen). All continuous in time.

import { vec2, float, clamp, smoothstep, mix, mod, abs } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { voronoi } from '../../core/voronoi.js';
import { bubbleField } from '../ceramic/bubbles.js';
import { frame, fbm, flowFbm } from './common.js';
import { radiance } from './heat.js';

export function buildSteel( p, fp, u, t ) {

	const F = frame( p, u.angle );
	const S = u.sizeM;
	// L0 convection cells: flow from the centre to the border.
	const V = voronoi( mod( p.div( u.scaleM ), 4096 ).add( u.seed.mul( 2.3 ) ), 0.8 );
	const out = V.toSeed.div( V.toSeed.length().max( 0.05 ) );
	const lane = smoothstep( 0.18, 0.0, V.edge );
	const vel = out.mul( u.flow ).mul( smoothstep( 0.0, 0.2, V.edge ).mul( 0.7 ).add( 0.3 ) );

	// The skin rides the surface as a whole (a translation, q) and changes
	// shape slowly (flowFbm, 16 s); the lace and ripples follow the faster
	// local flow out of each cell.
	const drift = F.dir.mul( u.flow.mul( t ) );
	const q = p.sub( drift ).toVar();
	const still = vec2( 0 );
	// L1 oxide patches, thicker in the lanes.
	const n = flowFbm( q, still, t, 16, S, fp, 3, 1 );
	const th = float( 0.82 ).sub( u.cover.mul( 0.2 ) ).sub( lane.mul( 0.3 ) );
	const e = fp.div( S ).mul( 3 ).add( 0.015 );
	const island = smoothstep( th.sub( e ), th.add( e ), n );
	// Lace: thin oxide filaments on the open melt, the contour of a flowing
	// noise, broken in places.
	const n3 = flowFbm( q, vel.mul( 0.5 ), t, 6, S.mul( 0.5 ), fp, 2, 6 );
	const lw = u.cover.mul( 0.08 ).add( 0.01 ).add( fp.div( S ).mul( 0.5 ) );
	const lace = smoothstep( lw, lw.mul( 0.4 ), abs( n3.sub( 0.5 ) ) ).mul( smoothstep( 0.35, 0.6, n ) ).mul( fadeIn( S.mul( 0.5 ), fp, 2.0, 6.0 ) );
	const oxide = island.max( lace ).toVar();
	// Tears: contour lines of a second flowing noise, only inside the skin.
	const m = flowFbm( q, still, t, 16, S.mul( 0.6 ), fp, 2, 2 );
	const tw = float( 0.012 ).add( fp.div( S ).mul( 0.6 ) );
	const tear = smoothstep( tw, tw.mul( 0.3 ), abs( m.sub( 0.5 ) ) ).mul( island ).mul( fadeIn( S.mul( 0.6 ), fp, 2.0, 6.0 ) ).toVar();
	const skin = oxide.mul( float( 1 ).sub( tear ) ).toVar();

	// Slag specks drifting with the surface (a translation).
	// Warped, so the specks are ragged, not discs.
	const wq = vec2( fbm( q, S.mul( 0.12 ), fp, 2, 8 ), fbm( q, S.mul( 0.12 ), fp, 2, 9 ) ).sub( 0.5 ).mul( S ).mul( 0.08 );
	const B = bubbleField( q.add( wq ), fp, S.mul( 0.25 ), 0.25, 7 );
	const C = bubbleField( p.sub( drift.mul( 1.3 ) ).add( wq.mul( 0.2 ) ), fp, u.cellM, 0.35, 11 );
	const speck = B.inside.mul( B.fade ).max( C.inside.mul( C.fade ) ).mul( float( 1 ).sub( oxide.mul( 0.7 ) ) );

	// L2 wrinkles of the skin, ripples on the melt.
	const wn = flowFbm( q, still, t, 16, u.featureM, fp, 3, 3 );
	const wr = float( 1 ).sub( abs( wn.mul( 2 ).sub( 1 ) ) );
	const wW = fadeIn( u.featureM, fp, 1.5, 5.0 );
	const rip = flowFbm( q, vel.mul( 0.5 ), t, 3, u.featureM.mul( 3 ), fp, 2, 4 );
	// L4 grain of the skin.
	const grain = fbm( q, u.microM, fp, 2, 5 );

	const h = oxide.mul( S ).mul( 0.01 ).add( wr.mul( u.featureM ).mul( 0.18 ).mul( skin ).mul( wW ) )
		.add( rip.mul( u.featureM ).mul( 0.06 ).mul( float( 1 ).sub( oxide ) ) )
		.add( grain.mul( u.microM ).mul( 0.3 ).mul( skin ) ).add( speck.mul( u.cellM ).mul( 0.3 ) );
	const slope = surfaceGradient( h, p );

	// Colour: the melt is metal (its colour is its reflectance), the skin and
	// specks are dark oxide.
	const ox = u.color.mul( grain.mul( 0.4 ).add( 0.8 ) ).mul( wr.mul( 0.3 ).add( 0.85 ) );
	const dark = skin.max( speck );
	const color = mix( u.color2, mix( ox, u.color3, speck ), dark );
	const metal = float( 1 ).sub( dark );

	// Light: emissivity times blackbody. The skin is cooler on its thick
	// lanes and hottest along its tears; specks a little cooler still.
	// Thin lace is hotter than the thick islands.
	const Tox = u.crustK.add( float( 1 ).sub( lane ).mul( 120 ) ).add( n.sub( th ).max( 0 ).mul( - 300 ) ).add( lace.sub( island ).max( 0 ).mul( 250 ) );
	// The melt: hotter where it wells up; ripples change the emissivity a
	// little (it depends on the angle to the view), so they show.
	const melt = radiance( u.meltK.add( float( 1 ).sub( lane ).mul( 40 ) ), u ).mul( rip.sub( 0.5 ).mul( 0.25 ).add( 0.35 ) );
	const tearL = radiance( u.meltK.mul( 0.97 ), u ).mul( 0.6 );
	let emissive = mix( melt, radiance( Tox, u ).mul( 0.85 ), skin );
	emissive = mix( emissive, tearL, tear );
	emissive = mix( emissive, radiance( u.crustK.mul( 0.95 ), u ).mul( 0.85 ), speck );

	return {
		color, slope, emissive, metal,
		rough: mix( float( 0.06 ), u.roughness, dark ), s2: wW.oneMinus().mul( 0.01 ),
		cavity: tear.mul( 0.5 ),
	};

}
