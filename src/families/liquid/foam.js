// Sea foam on dark water (the wash of a wave on a beach, a harbour).
// Foam is air in water: bubbles of every size packed together, their
// films a few hundred nm thick, the water drained into the Plateau
// borders where three films meet (white: they scatter the light).
//   L0 lace     foam lies in patches of size_mm (8 cm) and in a net of
//               strands (cells of 3 cm, strands 2 to 12 mm) on dark
//               water. It drifts downwind (4 mm/s), its eddies (1.5 mm/s)
//               slowly reshape it (flow.js). Thick foam holds big
//               bubbles, its thin edges only small ones
//   L1 bubbles  four layers from feature_mm (6 mm) down to 0.27 mm. Big
//               ones sit on top: through their clear cap the smaller ones
//               show, a little darker. Round (wet foam): a bright film
//               wall at the outline, a dark ring inside it, white
//               Plateau borders between bubbles
//   L1 life     every bubble lives 4 to 14 s, then pops: in a frame its
//               cap is gone and the smaller bubbles under it show. A new
//               one swells in its place (coarsening: few big, many small)
//   L2 films    the caps of the big bubbles shine in thin film colours
//               (core/thinfilm.js), thinner and darker at their top
//   water       the water between patches: dark, rippled (waves.js),
//               near the foam a scum of drawn out streaks and lone
//               bubbles, so a hole reads as water with a lace edge

import { vec2, vec3, float, floor, fract, mix, clamp, smoothstep, step, mod, cos, sin } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, hash3 } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { bubbleField } from '../ceramic/bubbles.js';
import { ixTime } from '../../core/clock.js';
import { viewTangent } from '../../core/optics.js';
import { filmReflectance } from '../../core/thinfilm.js';
import { fbm } from '../stone/common.js';
import { curlFlow, advect } from './flow.js';
import { waveField } from './waves.js';

// One layer of bubbles of cell C (m). occ: share of cells holding a live
// bubble. Returns its cover (AA, faded to its mean far away), the
// offset of the pixel from its centre (cells), its slope and hash.
function layer( q, fp, C, t, occ, salt ) {

	const V = voronoi( mod( q.div( C ), 4096 ).add( salt ), 0.9 );
	const h = hash3( V.id1.add( salt * 0.37 ) );
	const life = h.x.mul( 10 ).add( 4 );
	const c = t.div( life ).add( h.y );
	const n = mod( floor( c ), 4096 ), ph = fract( c );
	const alive = step( hash1( V.id1.add( vec2( n.mul( 7.7 ), n.mul( 3.1 ) ) ) ), occ ).mul( step( ph, 0.93 ) );
	const grow = smoothstep( 0.0, 0.08, ph ).mul( ph.mul( 0.15 ).add( 0.85 ) );
	const r = V.toSeed.length();
	// Wet foam: round bubbles, each no wider than the gap to its nearest
	// neighbour, so they seldom touch and never read as cut chips.
	const rad = grow.mul( h.z.mul( 0.12 ).add( 0.38 ) ).min( V.p2.sub( V.p1 ).length().mul( 0.5 ).sub( 0.04 ) );
	const m = rad.sub( r ).min( V.edge.sub( 0.005 ) ); // inside the bubble outline, cells
	const w = fadeIn( C, fp, 1.5, 4.0 );
	const cov = clamp( m.mul( C ).div( fp ).add( 0.5 ), 0, 1 ).mul( alive );
	const cover = mix( occ.mul( 0.6 ), cov, w );
	// The cap: a flat dome, steep near its rim (a dome falls outward).
	// Seen edge on at the outline, the film wall is a thin bright line;
	// just inside it bends the light away: a dark ring.
	const wall = smoothstep( 0.0, 0.012, m ).mul( smoothstep( 0.045, 0.02, m ) );
	const rim = smoothstep( 0.035, 0.06, m ).mul( smoothstep( 0.13, 0.07, m ) );
	const slope = V.toSeed.mul( - 1.6 ).div( m.max( 0.02 ).add( 0.1 ) ).mul( 0.25 ).mul( cov ).mul( w );
	// Plateau borders: the liquid gathered between bubbles, along the cell
	// edges where no cap covers it.
	const border = smoothstep( 0.06, 0.0, V.edge ).mul( w ).mul( float( 1 ).sub( cov ) );
	return { cover, rim: rim.mul( cov ).mul( w ), wall: wall.mul( cov ).mul( w ), border, slope, h, v: V.toSeed, w };

}

export function buildFoam( p, fp, u ) {

	const t = ixTime.mul( u.speed );
	const wind = vec2( cos( u.angle ), sin( u.angle ) );
	const q = p.sub( wind.mul( t.mul( 0.004 ) ) );
	const S = u.sizeM;
	const vel = curlFlow( p, S, float( 0.0015 ), u.seed ).add( wind.mul( 0.004 ) );
	const lace = advect( p, vel, t, 20, ( x, salt ) => fbm( x.add( salt.add( u.seed.mul( 1.37 ) ).mul( S ) ), S, fp, 5, 2 ) );
	// Patches, and the streaks between them (where the field crosses its
	// mean: a ridge), torn by holes of a few cm.
	// Foam gathers on lines where the surface converges: a net of cells
	// a third of size_mm wide, its strands 2 to 12 mm thick, broken here
	// and there; patches where the net is dense.
	const lw = vec2( fbm( q, S.mul( 0.5 ), fp, 2, 7 ), fbm( q, S.mul( 0.5 ), fp, 2, 8 ) ).sub( 0.5 ).mul( S.mul( 0.25 ) );
	const N = voronoi( mod( q.add( lw ).div( S.mul( 0.35 ) ), 4096 ).add( u.seed ), 0.95 );
	const strandW = fbm( q, S.mul( 0.2 ), fp, 3, 9 ).mul( 0.2 ).sub( 0.04 ).max( 0.0 );
	const net = smoothstep( strandW.add( 0.02 ), strandW.sub( 0.02 ), N.edge );
	const blob = smoothstep( float( 0.6 ).sub( u.amount.mul( 0.3 ) ), float( 0.66 ).sub( u.amount.mul( 0.3 ) ), lace );
	const thick = blob.max( net.mul( smoothstep( 0.12, 0.3, lace ) ).mul( 0.7 ) ).toVar();
	// Near a patch the open water carries a thin scum: streaks of small
	// bubbles drawn out by the drift, and lone bubbles afloat.
	const near = smoothstep( float( 0.42 ).sub( u.amount.mul( 0.3 ) ), float( 0.6 ).sub( u.amount.mul( 0.3 ) ), lace );
	const sq = vec2( q.dot( wind ), q.dot( vec2( wind.y.negate(), wind.x ) ) );
	const scum = smoothstep( 0.45, 0.75, fbm( vec2( sq.x.div( 3 ), sq.y ), S.mul( 0.08 ), fp, 4, 11 ) ).mul( near );
	const lone = bubbleField( q, fp, float( 0.003 ), near.mul( 0.5 ), 71 );

	// Water between the patches.
	const Wv = waveField( p, fp, { lmax: 0.05, lmin: 0.005, angle: u.angle, steep: 0.09, t, rate: u.speed, seed: u.seed, count: 8 } );
	let waterCol = u.color2.mul( Wv.h.mul( 40 ).add( 1 ) );
	waterCol = mix( waterCol, u.color.mul( 0.55 ), scum.mul( 0.45 ) );
	waterCol = mix( mix( waterCol, waterCol.mul( 0.8 ), lone.inside.mul( lone.fade ) ), u.color.mul( 0.9 ), lone.rim.mul( lone.fade ) );

	// Bubble layers, the smallest first; each covers what is under it.
	const B = u.featureM;
	const foam = u.color;
	let col = foam.mul( 0.82 ), slope = vec2( 0 ), s2 = float( 0 );
	const sizes = [ 0.045, 0.13, 0.36, 1.0 ];
	const cosI = viewTangent().z.abs();
	let film = float( 0 ), big = float( 0 );
	sizes.forEach( ( k, i ) => {

		const present = smoothstep( i * 0.2 - 0.1, i * 0.2 + 0.12, thick ).mul( u.density.mul( 0.5 ).add( 0.5 ) );
		const L = layer( q, fp, B.mul( k ), t, present.mul( i === 0 ? 0.95 : 0.8 ), i * 17 + 3 );
		// Through a clear cap: the bubbles below, a little darker; the
		// white between caps is the finer foam (and the Plateau borders).
		col = mix( col, foam.mul( 1.05 ), L.border.mul( 0.5 ) );
		const inside = col.mul( 0.82 ).mul( float( 1 ).sub( L.rim.mul( 0.45 ) ) ).mul( L.h.z.mul( 0.12 ).add( 0.94 ) );
		col = mix( mix( col, inside, L.cover ), foam.mul( 1.08 ), L.wall.mul( 0.85 ) );
		slope = mix( slope, L.slope, L.cover.mul( L.w ) );
		s2 = s2.add( L.cover.mul( L.w.oneMinus() ).mul( 0.04 ) );
		if ( i >= 2 ) {

			// Cap film: 200 to 900 nm, draining thinner toward its top.
			film = mix( film, L.h.y.mul( 700 ).add( 200 ).mul( L.v.y.mul( 0.9 ).add( 1 ).max( 0.1 ) ), L.cover.mul( L.w ) );
			big = big.max( L.cover.mul( L.w ) );

		}

	} );
	const water2 = vec3( 0.02 );
	const specCol = mix( water2, filmReflectance( film, 1.33, 1.0, cosI, 0 ).max( 0.02 ), big );

	const fm = smoothstep( 0.0, 0.06, thick );
	const color = mix( waterCol, col, fm );
	return {
		wet: float( 1 ).sub( fm.mul( 0.7 ) ), color, slope: mix( Wv.slope, slope, fm ), cavity: float( 0 ), rough: mix( u.roughness, float( 0.08 ), fm ),
		s2: mix( Wv.s2, s2, fm ), spec: mix( water2, specCol, fm ),
	};

}
