// Velvet and corduroy: a short dense pile of fine fibres cut level.
//   L0 nap     the pile leans one way and crushed patches turn it (brush
//              field): seen from the tip side we look into the pile (dark,
//              rich), from the root side we see the fibre sides (light).
//              The grazing glow is the sheen lobe.
//   L1 tufts   the pile yarns stand in rows from the ground weave, about
//              0.3 to 0.6 mm apart: soft clusters with darker gaps
//   L2 fibres  each fibre (12 to 20 um) ends as a short round streak along
//              the lean, two layers deep; near the camera the 3D strands
//              take over (core/hair3d.js)
// Corduroy: the same pile on ribs (wales, 8 to 16 per inch, 1.6 to 3 mm).
// Between the ribs the pile was cut away: a narrow channel shows the
// ground cloth, a plain weave about 0.25 mm per yarn.

import { vec2, float, floor, fract, sqrt, mix, smoothstep, clamp, sin, cos } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { fibreEnds } from './fibres.js';

// The pile surface, without ribs. Returns colour, slope, s2, cavity.
export function velvetPile( p, fp, u, B ) {

	// Tufts on the same jittered lattice as the 3D strand locks.
	const V = voronoi( p.div( u.lockM ).add( u.seed.mul( 3 ) ), 1.0 );
	const wT = fadeIn( u.lockM, fp, 1.5, 4.0 ).toVar();
	const rT = V.toSeed.length();
	// Soft clusters: no cell borders, the fibres of two tufts mingle.
	const gap = smoothstep( 0.95, 0.15, rT );
	const tuft = mix( float( 1 ).sub( u.lockDepth.mul( 0.3 ) ), mix( float( 1 ).sub( u.lockDepth.mul( 0.6 ) ), float( 1.05 ), gap ), wT );
	const tuftVar = mix( float( 1 ), hash1( V.id1 ).sub( 0.5 ).mul( u.colorVar ).add( 1 ), wT );
	// Dome of the tuft (slope away from its centre).
	const sT = V.toSeed.mul( u.lockDepth.mul( 0.4 ) ).mul( wT ).mul( gap );

	// Fibre ends.
	const spacing = float( 1 ).div( u.density.sqrt() );
	const F = fibreEnds( p, fp, B.dir, B.lean, spacing, u.strandW.mul( 0.5 ), u.seed );
	// The pile shades itself: from above it is darker than one fibre, and
	// fibres lit along their axis reflect little (Kajiya-Kay). Matched on
	// the 3D strands: without the AO pass the window of strands does not show.
	const fib = mix( float( 0.55 ), F.shade, F.w );
	// Crushed patches: the pile lies flatter there and shows the fibre
	// sides, lighter and shinier (crushed velvet, worn seats).
	// Two warped octaves: streaky organic patches, no lattice.
	const cq = p.div( u.flowM.mul( 0.6 ) ).add( u.seed.mul( 5 ) );
	const warp = vec2( valueNoise( cq.mul( 0.5 ).add( 3.7 ) ), valueNoise( cq.mul( 0.5 ).add( 9.1 ) ) ).sub( 0.5 ).mul( 1.6 );
	const cn = valueNoise( cq.add( warp ) ).add( valueNoise( cq.mul( 2.3 ).add( warp.mul( 2 ) ).add( 1.3 ) ).mul( 0.5 ) ).div( 1.5 );
	const crush = smoothstep( 0.5, 0.72, cn ).mul( u.flowAmt.min( 1 ) );
	const color = mix( u.color, u.tipColor, fib.mul( 0.6 ).add( crush.mul( 0.3 ) ) ).mul( fib.mul( 0.36 ).add( 0.15 ) ).mul( crush.mul( 0.5 ).add( 1 ) ).mul( tuft ).mul( tuftVar ).mul( B.viewShade );

	const slope = sT.add( F.slope.mul( F.w ) );
	const s2 = float( 1 ).sub( F.w ).mul( 0.12 ).add( float( 1 ).sub( wT ).mul( 0.02 ) );
	return { color, slope, s2, cavity: float( 1 ).sub( gap ).mul( wT ).mul( 0.5 ), crush };

}

export function buildVelvet( p, fp, u, B ) {

	const P = velvetPile( p, fp, u, B );
	return { ...P, rough: u.roughness, sheenColor: mix( u.tipColor, u.color, 0.3 ).mul( P.crush.mul( 0.8 ).add( 1 ) ) };

}

export function buildCord( p, fp, u, B ) {

	const d = vec2( cos( u.angle ), sin( u.angle ) ), n = vec2( sin( u.angle ).negate(), cos( u.angle ) );
	const x = p.dot( d ), y = p.dot( n );
	// Wales wander a little: the cloth is never perfectly straight.
	const wy = y.div( u.waleM ).add( valueNoise( vec2( x.div( 0.07 ), y.div( 0.3 ) ).add( u.seed ) ).sub( 0.5 ).mul( 0.25 ) );
	const f = fract( wy ), wid = floor( wy );
	const half = float( 0.5 ).sub( u.channel.mul( 0.5 ) );
	const g = f.sub( 0.5 ).div( half );
	const ribW = half.mul( u.waleM ).mul( 2 );
	const wW = fadeIn( u.waleM, fp, 2.0, 6.0 ).toVar();
	const inRib = clamp( float( 1 ).sub( g.abs() ).mul( ribW.mul( 0.5 ) ).div( fp ).add( 0.5 ), 0, 1 ).toVar();
	const gc = g.clamp( - 0.97, 0.97 );
	const dome = sqrt( float( 1 ).sub( gc.mul( gc ) ) );
	// Rib height about a third of its width: slope across the wale.
	const sAcross = gc.div( dome ).negate().mul( 0.45 ).clamp( - 1.6, 1.6 ).mul( inRib );
	const sRib = n.mul( sAcross ).mul( wW );

	const P = velvetPile( p, fp, u, B );
	// Flanks lean away from the light and the pile parts there: darker.
	const ribShade = mix( float( 0.82 ), dome.pow( 0.6 ).mul( 0.6 ).add( 0.5 ), wW );
	const waleVar = hash1( vec2( wid, 4.1 ) ).sub( 0.5 ).mul( u.colorVar ).mul( wW ).add( 1 );
	// Channel: ground cloth, plain weave, in the shadow of the ribs.
	const wv = fadeIn( float( 5e-4 ), fp, 2.0, 5.0 );
	const weave = sin( x.div( 2.5e-4 ).mul( Math.PI ) ).mul( sin( y.div( 2.5e-4 ).mul( Math.PI ) ) ).mul( 0.25 ).mul( wv ).add( 0.75 );
	const channelCol = u.color2.mul( weave ).mul( 0.55 );
	const color = mix( mix( P.color.mul( 0.8 ), channelCol, u.channel.mul( 0.6 ) ), mix( channelCol, P.color.mul( ribShade ).mul( waleVar ), inRib ), wW );
	const slope = mix( vec2( 0 ), P.slope, inRib ).add( sRib );
	const s2 = P.s2.add( float( 1 ).sub( wW ).mul( 0.08 ) );
	const cavity = mix( P.cavity, float( 0.9 ), float( 1 ).sub( inRib ).mul( wW ) );
	return { color, slope, s2, cavity, rough: u.roughness, sheenColor: mix( u.tipColor, u.color, 0.3 ).mul( 1.2 ) };

}
