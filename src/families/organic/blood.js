// Blood on a pale floor, fresh and dried. Both share the same spill: the
// thickness of the liquid decides everything else.
//   L0 spill    pools a few cm across (up to 1 to 2 mm deep), thin smears
//               dragged along `angle`, round drops of feature_mm around
//               them (satellite spatter). Light crosses the film twice and
//               is absorbed by haemoglobin (Beer law): a 0.05 mm smear is
//               a clear scarlet, a 1 mm pool almost black red.
// Fresh:
//   L1 film     a mirror surface (clear coat) with the meniscus rounding
//               every edge (1 to 2 mm), streaks in the smears, air bubbles
//               of 0.2 to 1.5 mm caught in the pools (bright rim, dome)
//   L2 cells    red cells (cell_um, 7 to 8 um) settle in thin films: a fine
//               grain; micro bubbles of 30 to 80 um
// Dried:
//   L1 crust    the pool shrinks as it dries and cracks into flakes of
//               size_mm (2 to 5 mm), thicker crust, wider cracks; flake
//               edges curl up, some flakes have fallen off and show the
//               stain under them. Edges of the stain darker (coffee ring)
//   L2 cracks   a second net of hairline cracks (a third of the size),
//               a glossy skin on the flakes, matte brown stain on the floor
// Returns { color, slope, cavity, rough, s2, coat, coatRough }.

import { vec2, vec3, float, mix, smoothstep, step, clamp, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { bubbleField, capSlope } from '../ceramic/bubbles.js';
import { absorb } from '../ceramic/glaze.js';
import { rot2, fbm, cells, warp2 } from './common.js';

// Thickness of the spill in units of 1 mm at a point (no derivatives).
function depth( q, fp, u, salt ) {

	const a = rot2( q, u.angle );
	const n = fbm( q.add( salt ), float( 0.14 ), fp, 4, 3 );
	// Pools: where the slow noise is high; the meniscus spans ~1.5 mm.
	const pool = smoothstep( 0.52, 0.56, n ).mul( n.sub( 0.52 ).mul( 6 ).add( 0.25 ).min( 1 ) );
	// Smears dragged along the angle: streaky thin film.
	const zone = smoothstep( 0.5, 0.6, fbm( q.add( salt + 4.4 ), float( 0.1 ), fp, 3, 7 ) );
	const aw = a.add( warp2( a, float( 0.05 ), salt + 2 ).mul( 0.02 ) );
	const streak = valueNoise( vec2( aw.x.div( 0.05 ), aw.y.div( 0.004 ) ).add( salt ) ).mul( 0.6 ).add( valueNoise( vec2( aw.x.div( 0.015 ), aw.y.div( 8e-4 ) ) ).mul( 0.4 ) );
	const smear = zone.mul( smoothstep( 0.3, 0.7, streak ) ).mul( 0.06 );
	return pool.max( smear );

}

function spill( p, fp, u, salt ) {

	const e = float( 3e-4 );
	const h0 = depth( p, fp, u, salt ).toVar();
	const hx = depth( p.add( vec2( e, 0 ) ), fp, u, salt ), hy = depth( p.add( vec2( 0, e ) ), fp, u, salt );
	// Satellite drops: round domes, most small, a few big.
	const D = bubbleField( p, fp, u.featureM.mul( 4 ), u.density.mul( 0.6 ), salt + 17 );
	const dropH = float( 1 ).sub( D.d.mul( D.d ) ).max( 0 ).sqrt().mul( D.rm.mul( 400 ).min( 0.6 ) ).mul( D.inside );
	const onDrop = step( h0, dropH );
	const h = h0.max( dropH ).toVar();
	const slope = vec2( hx.sub( h0 ), hy.sub( h0 ) ).div( e ).mul( 1e-3 ).mul( onDrop.oneMinus() )
		.add( capSlope( D.v, D.d ).mul( 0.5 ).mul( D.inside ).mul( onDrop ) );
	return { h, slope, D };

}

export function buildBlood( p, fp, u ) {

	const S = spill( p, fp, u, 0 );
	const floor = u.color3.mul( fbm( p, float( 0.02 ), fp, 4, 9 ).mul( 0.25 ).add( 0.85 ) );
	// Two passes through the film; amount 1 = a 0.1 mm film gives `color`.
	const t = S.h.mul( 10 ).min( 6 );
	let color = absorb( floor, u.color.div( u.color3.max( vec3( 0.05 ) ) ).min( vec3( 1 ) ), t );
	color = color.mul( fbm( p.add( 2.2 ), float( 0.01 ), fp, 3, 3 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	// L1: bubbles in the pools only.
	const wet = smoothstep( 0.05, 0.25, S.h );
	let slope = S.slope.mul( u.relief );
	for ( const [ k, sl ] of [ [ 1, 3 ], [ 0.3, 11 ] ] ) {

		const B = bubbleField( p, fp, u.sizeM.mul( k ), u.bubbles.mul( 0.5 ), sl );
		const on = B.inside.mul( wet ).mul( B.fade );
		color = color.mul( float( 1 ).add( on.mul( 0.15 ) ) ).add( B.rim.mul( wet ).mul( B.fade ).mul( 0.12 ).mul( u.color2 ) );
		slope = slope.add( capSlope( B.v, B.d ).mul( 0.6 ).mul( on ) );

	}

	// L2: settled red cells in the thin film, a fine grain.
	const C = cells( p, u.cellM, fp, 5.5, { jitter: 0.9, crown: 0.5 } );
	const thin = smoothstep( 0.02, 0.0, S.h.sub( 0.04 ).abs() ).add( smoothstep( 0.12, 0.02, S.h ).mul( step( 0.005, S.h ) ) ).min( 1 );
	color = color.mul( C.h.sub( 0.5 ).mul( 0.2 ).mul( C.w ).mul( thin ).add( 1 ) );
	slope = slope.add( C.slope.mul( 0.08 ).mul( thin ) );
	// A liquid: almost a mirror where wet, the floor stays matte.
	const film = smoothstep( 0.0, 0.01, S.h );
	const rough = mix( u.roughness, float( 0.08 ), film );
	return { color, slope, cavity: float( 0 ), rough, s2: float( 0 ), coat: film, coatRough: float( 0.03 ) };

}

export function buildDriedBlood( p, fp, u ) {

	const S = spill( p, fp, u, 2.1 );
	const floor = u.color3.mul( fbm( p, float( 0.02 ), fp, 4, 9 ).mul( 0.25 ).add( 0.85 ) );
	const t = S.h.mul( 10 ).min( 8 );
	// The stain: brown where thin, almost black where it was thick.
	const stain = absorb( floor, u.color2.div( u.color3.max( vec3( 0.05 ) ) ).min( vec3( 1 ) ), t.min( 1.5 ) );
	const crust = smoothstep( 0.12, 0.3, S.h );
	// L1: flakes. Cracks widen with the crust; flakes curl at their edge.
	const g = u.sizeM;
	const V = voronoi( mod( p.div( g ), 4096 ).add( 5.1 ), 0.9 );
	const k = hash3( V.id1.add( 3.3 ) );
	const wV = fadeIn( g, fp, 1.5, 4.0 );
	const gapM = g.mul( 0.03 ).mul( S.h.mul( 1.5 ).add( 0.3 ) );
	const crack = clamp( gapM.sub( V.edge.mul( g ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( crust ).mul( wV );
	const lost = step( k.x, u.density.mul( 0.25 ) ).mul( crust ).mul( wV );
	const curl = smoothstep( 0.1, 0.0, V.edge ).mul( crust );
	// L2: hairline cracks inside each flake.
	const W = voronoi( mod( p.div( g.mul( 0.3 ) ), 4096 ).add( 8.8 ), 0.9 );
	const wW = fadeIn( g.mul( 0.3 ), fp, 2.0, 5.0 );
	const hair = clamp( g.mul( 0.004 ).sub( W.edge.mul( g.mul( 0.3 ) ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( crust ).mul( wW ).mul( step( 0.4, hash3( W.id1 ).y ) );

	let crustCol = mix( u.color, u.color.mul( 0.55 ), smoothstep( 0.3, 1.0, S.h ) ).mul( k.y.sub( 0.5 ).mul( u.colorVar ).mul( wV ).add( 1 ) ).mul( fbm( p.add( 9.9 ), g.mul( 0.5 ), fp, 3, 2 ).mul( 0.3 ).add( 0.85 ) );
	// Curled edges are thin: light passes, they look redder.
	crustCol = mix( crustCol, u.color2.mul( 0.7 ), curl.mul( 0.25 ) );
	let color = mix( stain, crustCol, crust.mul( lost.oneMinus() ) );
	// Coffee ring: the stain darker where the pool edge stood.
	const ring = smoothstep( 0.04, 0.12, S.h ).mul( smoothstep( 0.2, 0.12, S.h ) );
	color = color.mul( float( 1 ).sub( ring.mul( 0.35 ) ) );
	color = mix( color, stain.mul( 0.35 ), crack.max( hair.mul( 0.7 ) ) );
	color = color.mul( fbm( p.add( 5.5 ), float( 0.004 ), fp, 3, 6 ).sub( 0.5 ).mul( 0.2 ).add( 1 ) );

	const lift = V.dir.mul( curl ).mul( - 0.15 ).mul( wV ).mul( lost.oneMinus() );
	const slope = S.slope.mul( 0.4 ).mul( crust.oneMinus() ).add( lift ).add( W.dir.mul( smoothstep( 0.1, 0.0, W.edge ) ).mul( - 0.2 ).mul( hair ) ).mul( u.relief );
	const cavity = crack.max( hair.mul( 0.5 ) ).max( lost.mul( 0.4 ) );
	const rough = mix( float( 0.75 ), u.roughness, crust.mul( lost.oneMinus() ) );
	return { color, slope, cavity, rough, s2: wV.oneMinus().mul( crust ).mul( 0.04 ), coat: crust.mul( lost.oneMinus() ).mul( 0.4 ), coatRough: float( 0.2 ) };

}
