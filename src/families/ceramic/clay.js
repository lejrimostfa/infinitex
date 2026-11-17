// Unglazed fired clay (terracotta). Iron oxide makes it red; nothing seals
// it, so it stays matt and drinks water. Level by level:
//   L0 body     red, mottled by the kiln (flashing: darker, browner where
//               the flame licked it); white salt bloom (efflorescence) where
//               water carried salts out and dried, thicker in the hollows
//   L1 tools    the potter scraped or turned it: shallow parallel grooves
//               about tool_mm apart, and drag marks where the tool caught a
//               grain and ploughed a furrow behind it
//   L1 grog     crushed fired clay mixed in (0.3 to 2 mm), lighter or darker
//               than the body, angular, a shrinkage gap round each grain
//   L2 pores    pinholes of 0.05 to 0.3 mm where gas and burnt matter left
//   L3 matrix   silt grains of 20 to 80 um, quartz specks, mica flakes
//               that glint
//
// Returns { color, slope, cavity, rough, s2 }.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, sin, cos, mod } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { bubbleField, capSlope } from './bubbles.js';

export function buildClay( p, fp, u ) {

	const s = u.seed;
	const d = vec2( cos( u.angle ), sin( u.angle ) ), n = vec2( sin( u.angle ).negate(), cos( u.angle ) );
	const x = p.dot( d ), y = p.dot( n );

	// Body: mottle and kiln flashing.
	const m = valueNoise( p.div( 0.06 ).add( s ) ).mul( 0.6 ).add( valueNoise( p.div( 0.012 ).add( s.add( 2 ) ) ).mul( 0.4 ) );
	const flash = smoothstep( 0.55, 0.85, valueNoise( p.div( 0.09 ).add( s.add( 5 ) ) ) );
	let color = u.bodyColor.mul( m.sub( 0.5 ).mul( u.colorVar ).mul( 2 ).add( 1 ) );
	color = mix( color, color.mul( vec3( 0.72, 0.58, 0.5 ) ), flash.mul( 0.6 ) );

	// Tool marks: shallow grooves across y, each pass its own depth.
	const tq = y.div( u.toolM ).add( valueNoise( vec2( x.div( 0.05 ), s ) ).mul( 1.5 ) );
	const tAmp = valueNoise( vec2( floor( tq ), x.div( 0.02 ) ) ).mul( 0.8 ).add( 0.2 );
	const tf = fract( tq );
	const wT = fadeIn( u.toolM, fp, 2.0, 6.0 ).mul( u.toolMarks );
	const tH = tf.mul( float( 1 ).sub( tf ) ).mul( 4 ).mul( tAmp ).mul( u.toolM ).mul( 0.03 );
	let height = tH.mul( wT );

	// Drag marks: a furrow along the stroke, a grain stuck at its end.
	const dq = vec2( x.div( 0.009 ), y.div( 0.0011 ) ).add( s.mul( 3 ) );
	const dh = hash3( floor( dq ) );
	const dl = fract( dq ).sub( 0.5 ).sub( vec2( 0, dh.y.sub( 0.5 ).mul( 0.4 ) ) );
	const dt = dl.x.div( 0.45 ).clamp( - 1, 1 );
	const dw = dt.add( 1 ).mul( 0.5 ).sqrt().mul( dh.z.mul( 0.12 ).add( 0.1 ) ); // widens toward the grain
	const furrow = clamp( dw.sub( dl.y.abs() ).mul( 0.0011 ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( dl.x.abs(), 0.45 ) ).mul( step( dh.x, u.toolMarks.mul( 0.25 ) ) ).mul( fadeIn( float( 0.0004 ), fp, 1.5, 4.0 ) );
	height = height.sub( furrow.mul( 4e-5 ) );

	// Grog: angular grains in a matrix, a gap round each.
	// Crushed grains: bend the cell borders so no edge is straight.
	const gw = vec2( valueNoise( wrapCoord( p.div( u.grogM.mul( 0.4 ) ) ) ), valueNoise( wrapCoord( p.div( u.grogM.mul( 0.4 ) ) ).add( 3.7 ) ) ).sub( 0.5 ).mul( 0.35 );
	const G = voronoi( wrapCoord( p.div( u.grogM ) ).add( gw ).add( s.mul( 7 ) ), 0.9 );
	const hg = hash3( G.id1.add( 9.1 ) );
	const isG = step( hg.z, u.grog.mul( 0.55 ) );
	const gIn = clamp( G.edge.sub( hg.y.mul( 0.15 ).add( 0.18 ) ).mul( u.grogM ).div( fp ).add( 0.5 ), 0, 1 ).mul( isG ).mul( fadeIn( u.grogM, fp, 1.0, 3.0 ) ).toVar();
	const gap = smoothstep( 0.03, 0.0, G.edge.sub( hg.y.mul( 0.15 ).add( 0.16 ) ).abs() ).mul( isG ).mul( fadeIn( u.grogM.mul( 0.05 ), fp, 1.5, 4.0 ) );
	const gCol = mix( u.grogColor, u.bodyColor.mul( 0.7 ), step( 0.6, hg.x ) ).mul( hg.x.mul( 0.2 ).add( 0.9 ) );
	const pale = step( 0.96, hg.x ); // limestone or quartz grains
	// Slip half covers the grains: they show in patches, never as flat tiles.
	const show = valueNoise( wrapCoord( p.div( u.grogM.mul( 0.35 ) ) ).add( 2.5 ) ).mul( 0.7 ).add( 0.3 ).mul( 0.6 );
	color = mix( color, mix( gCol, vec3( 0.62, 0.52, 0.43 ), pale.mul( 0.7 ) ), gIn.mul( show ) ).mul( float( 1 ).sub( gap.mul( 0.35 ) ) );
	color = color.mul( float( 1 ).sub( fadeIn( u.grogM, fp, 1.0, 3.0 ).oneMinus().mul( u.grog ).mul( 0.03 ) ) );
	height = height.add( gIn.mul( 3e-5 ) ).sub( gap.mul( 2e-5 ) );

	// Pores: two sizes of pits.
	let pslope = vec2( 0 ), pore = float( 0 );
	for ( const [ cell, dens, salt ] of [ [ 0.0008, 0.18, 31 ], [ 0.00025, 0.3, 37 ] ] ) {

		const P = bubbleField( p, fp, float( cell ), u.pores.mul( dens ), salt );
		pore = pore.max( P.inside.mul( P.fade ) );
		pslope = pslope.add( capSlope( P.v, P.d ).mul( P.inside ).mul( P.fade ).mul( 0.8 ) );
		color = color.mul( float( 1 ).sub( P.fade.oneMinus().mul( u.pores ).mul( dens ).mul( 0.04 ) ) );

	}

	color = color.mul( float( 1 ).sub( pore.mul( 0.65 ) ) );

	// Matrix: silt grains, quartz specks, mica glints.
	const M = voronoi( wrapCoord( p.div( 5e-5 ) ).add( 3.3 ), 0.9 );
	const hm = hash3( M.id1 );
	const wM = fadeIn( float( 5e-5 ), fp, 2.0, 6.0 );
	const quartz = step( 0.993, hm.x ).mul( wM );
	const mica = step( 0.99, hm.y ).mul( wM );
	color = color.mul( hm.z.sub( 0.5 ).mul( 0.25 ).mul( wM ).add( 1 ) ).mul( float( 1 ).sub( smoothstep( 0.06, 0.0, M.edge ).mul( 0.15 ).mul( wM ) ) );
	color = mix( color, vec3( 0.55, 0.45, 0.36 ), quartz.mul( 0.5 ) );
	const grit = vec2( valueNoise( wrapCoord( p.div( 1.5e-5 ) ) ), valueNoise( wrapCoord( p.div( 1.5e-5 ) ).add( 5.2 ) ) ).sub( 0.5 ).mul( fadeIn( float( 1.5e-5 ), fp, 2.0, 5.0 ) );
	const mslope = M.toSeed.mul( 0.25 ).mul( wM ).add( grit.mul( 0.5 ) );

	// Efflorescence: white bloom in patches, denser at their rim and in
	// the hollows, powdery up close.
	let rough = u.roughness, cavity = pore.max( furrow ).max( gap.mul( 0.6 ) ).max( float( 1 ).sub( tf.mul( float( 1 ).sub( tf ) ).mul( 4 ) ).mul( wT ).mul( 0.4 ) );
	if ( u.efflor.value > 0 ) {

		const e = valueNoise( p.div( 0.04 ).add( s.add( 11 ) ) ).mul( 0.5 ).add( valueNoise( p.div( 0.01 ).add( 4.2 ) ).mul( 0.3 ) ).add( valueNoise( p.div( 0.0025 ).add( 6.6 ) ).mul( 0.2 ) );
		const th = float( 0.75 ).sub( u.efflor.mul( 0.4 ) );
		const patch = smoothstep( th, th.add( 0.12 ), e ).add( smoothstep( th.sub( 0.03 ), th, e ).mul( smoothstep( th.add( 0.06 ), th, e ) ).mul( 0.4 ) );
		const powder = valueNoise( wrapCoord( p.div( 4e-5 ) ) ).mul( fadeIn( float( 4e-5 ), fp, 1.5, 4.0 ) );
		const salt = patch.mul( pore.max( gap ).mul( 0.7 ).add( 0.3 ) ).mul( powder.mul( 0.8 ).add( 0.6 ) ).clamp( 0, 1 ).mul( u.efflor );
		color = mix( color, u.efflorColor.mul( valueNoise( p.div( 0.003 ) ).mul( 0.15 ).add( 0.88 ) ), salt.mul( 0.85 ) );
		rough = mix( rough, float( 1 ), salt );

	}

	// Grains stand a little proud, domed.
	const gDome = G.toSeed.mul( - 0.5 ).mul( gIn ).mul( fadeIn( u.grogM, fp, 2.0, 6.0 ) );
	const slope = surfaceGradient( height, p ).add( pslope ).add( gDome ).add( mslope.mul( float( 1 ).sub( pore ) ) );
	const s2 = float( 1 ).sub( wM ).mul( 0.02 ).add( wT.oneMinus().mul( u.toolMarks ).mul( 0.004 ) );
	// Mica flakes: flat mirrors in a matt body.
	rough = mix( rough, float( 0.25 ), mica );
	return { color, slope, cavity, rough, s2 };

}
