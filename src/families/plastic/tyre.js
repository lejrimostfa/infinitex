// Tyre tread. y runs round the tyre (rolling direction), x across it.
//   L0 tread   ribs 65 mm apart cut by circumferential grooves (grooveM,
//              8 mm wide, 8 mm deep when new) and slanted lateral grooves
//              every blockM, staggered rib to rib: blocks. Wear makes the
//              grooves shallower; wear bars (1.6 mm high) cross them.
//   L0 sipes   thin zigzag slits (0.6 mm) across each block
//   L1 vents   mould vents: little stubs of rubber (0.8 mm) where air left
//              the mould; worn ones leave a ring
//   L1 tops    worn tops: grey, polished a little (worn shine)
//   L2 abrasion Schallamach waves: ridges across the rolling direction,
//              80 to 200 um apart, saw-tooth, wavering
//   L3 filler  carbon black and silica texture: grit of 10 to 30 um, a few
//              pale grains of road sand pressed in
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, abs, sin, mod } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

export function buildTyre( p, fp, u ) {

	const s = u.seed, x = p.x, y = p.y;
	const ribW = 0.065;
	const depth = float( 8e-3 ).mul( float( 1 ).sub( u.worn.mul( 0.65 ) ) );
	// Circumferential grooves: distance from the groove centre line.
	const rib = floor( x.div( ribW ) );
	const dC = abs( fract( x.div( ribW ) ).sub( 0.5 ) ).mul( ribW ).sub( ribW * 0.5 ).abs();
	// Lateral grooves, slanted and staggered rib to rib.
	const ly = y.add( x.mul( 0.4 ) ).add( hash1( vec2( rib, s ) ).mul( u.blockM ) );
	const lf = fract( ly.div( u.blockM ) );
	const dL = abs( lf.sub( 0.5 ) ).mul( u.blockM ).sub( u.blockM.mul( 0.5 ) ).abs().mul( 0.93 ); // across the slant
	const halfC = u.grooveM.mul( 0.5 ), halfL = u.grooveM.mul( 0.3 );
	// Signed distance to the nearest groove wall (positive on the block).
	const dist = dC.sub( halfC ).min( dL.sub( halfL ) );
	const chamfer = float( 1.2e-3 );
	const block = smoothstep( chamfer.negate(), chamfer, dist ).toVar();
	// Wear bars across the circumferential grooves.
	const bar = step( abs( fract( y.div( 0.12 ).add( rib.mul( 0.37 ) ) ).sub( 0.5 ) ), 0.04 ).mul( step( dC, halfC ) );
	const floorH = depth.negate().add( bar.mul( 1.6e-3 ) );
	// Sipes: two zigzag slits per block, parallel to the lateral grooves.
	// In the block frame: sa along the lateral groove, sv across it (m).
	const sa = x.sub( y.mul( 0.4 ) ).div( 1.077 );
	const sv = fract( lf.mul( 2 ) ).sub( 0.5 ).mul( u.blockM ).div( 2 * 1.077 ); // slits at a quarter and three quarters
	const zt = fract( sa.div( 0.004 ) );
	const zig = smoothstep( 0.0, 0.5, zt ).sub( smoothstep( 0.5, 1.0, zt ) ).sub( 0.5 ).mul( 0.0012 ); // rounded zigzag, 1.2 mm
	const dS = abs( sv.sub( zig ) ).mul( 0.85 );
	const sipeW = float( 3e-4 );
	const sipeE = sipeW.max( fp );
	const sipe = clamp( sipeE.sub( dS ).div( fp ).add( 0.5 ), 0, 1 ).mul( sipeW.div( sipeE ) ).mul( step( 0.004, dist ) ).toVar();
	// Wall slope, analytic (a screen-space gradient flips on some quads of
	// such steep walls): the gradient of the distance times the chamfer.
	const gC = vec2( fract( x.div( ribW ) ).sub( 0.5 ).sign().negate(), 0 );
	const gL = vec2( 0.4, 1 ).mul( lf.sub( 0.5 ).sign().negate().mul( 0.93 ) );
	const gD = pick( step( dC.sub( halfC ), dL.sub( halfL ) ), gC, gL );
	const tB = dist.add( chamfer ).div( chamfer.mul( 2 ) ).clamp( 0, 1 );
	const gW = gD.mul( floorH.negate() ).mul( tB.mul( tB.oneMinus() ).mul( 6 ) ).div( chamfer.mul( 2 ) );
	let slope = gW.mul( float( 3 ).div( gW.length().max( 3 ) ) ).mul( fadeIn( chamfer, fp, 0.5, 2.0 ) );

	// Vents: one stub per 18 mm cell on the block tops.
	const vq = p.div( 0.018 ).add( s.mul( 3 ) );
	const vh = hash3( floor( vq ) );
	const vrel = fract( vq ).sub( vh.xy.mul( 0.6 ).add( 0.2 ) ).mul( 0.018 );
	const vd = vrel.length();
	const stub = step( u.worn.mul( 0.9 ), vh.z ); // stubs worn away with use
	const vR = float( 4e-4 );
	const vent = clamp( vR.sub( vd ).div( fp ).add( 0.5 ), 0, 1 ).mul( block ).toVar();
	const ring = clamp( float( 3e-5 ).sub( abs( vd.sub( vR ) ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( block ).mul( stub.oneMinus() ).mul( fadeIn( vR, fp, 1.0, 3.0 ) );
	slope = slope.add( vrel.div( vR ).mul( vent ).mul( stub ).mul( - 1.2 ).mul( fadeIn( vR, fp, 1.0, 3.0 ) ) );

	// Schallamach waves on the tops: saw-tooth ridges across y.
	const lam = float( 1.3e-4 );
	const wq = y.div( lam ).add( valueNoise( vec2( x.div( 6e-4 ), y.div( 2e-3 ) ).add( s ) ).mul( 3 ) ).add( valueNoise( vec2( x.div( 1.2e-4 ), y.div( 2.5e-4 ) ) ).mul( 1.2 ) );
	const wf = fract( wq );
	const saw = smoothstep( 0.0, 0.75, wf ).sub( smoothstep( 0.75, 1.0, wf ) ); // slow rise, sharp drop
	const wA = fadeIn( lam, fp, 2.0, 6.0 ).toVar();
	const ridgeId = floor( wq );
	// Ridges break up: each one runs a few hundred um, then fades out.
	const amp = smoothstep( 0.25, 0.65, valueNoise( vec2( x.div( 3e-4 ), ridgeId.mul( 0.71 ) ) ) ).mul( smoothstep( 0.3, 0.7, valueNoise( p.div( 0.01 ).add( 2.2 ) ) ).mul( 0.6 ).add( 0.4 ) ).mul( u.worn ).mul( block );
	const sWave = mix( float( 0.5 ), float( - 2.2 ), step( 0.75, wf ) ).mul( 0.35 ).mul( amp ).mul( wA );
	slope = slope.add( vec2( 0, sWave ) );

	// Filler grit and road sand, cells of 25 um (wrapped: hashes stay exact).
	const gv = voronoi( wrapCoord( p.div( 2.5e-5 ) ).add( s ), 0.9 );
	const gh = hash3( gv.id1 );
	const wG = fadeIn( float( 2.5e-5 ), fp, 2.0, 6.0 );
	slope = slope.add( gv.toSeed.mul( - 0.5 ).mul( smoothstep( 0.45, 0.1, gv.toSeed.length() ) ).mul( wG ) );
	const sand = step( 0.996, gh.x ).mul( smoothstep( 0.4, 0.25, gv.toSeed.length() ) ).mul( wG ).mul( block ).mul( u.worn );

	// Colour: black rubber; worn tops grey and dusty, grooves deep black.
	const tone = valueNoise( p.div( 0.02 ).add( s ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 );
	const top = mix( u.color, u.color2, u.worn.mul( 0.55 ).mul( valueNoise( p.div( 0.004 ).add( 6.1 ) ).mul( 0.5 ).add( 0.5 ) ) );
	const groove = u.color.mul( mix( float( 0.45 ), float( 0.8 ), bar ) );
	let color = mix( groove, top, block ).mul( tone );
	color = color.mul( float( 1 ).sub( sipe.mul( 0.8 ) ) ).mul( float( 1 ).sub( ring.mul( 0.3 ) ) ).mul( vent.mul( stub ).mul( 0.25 ).add( 1 ) );
	color = color.mul( saw.sub( 0.5 ).mul( 0.12 ).mul( amp ).mul( wA ).add( 1 ) ).mul( gh.y.sub( 0.5 ).mul( 0.15 ).mul( wG ).add( 1 ) );
	color = mix( color, vec3( 0.2, 0.18, 0.16 ), sand );

	// Worn tops: polished a little. Grooves: the mould shine is still there.
	const rough = mix( u.roughness.mul( 0.75 ), u.roughness.mul( float( 1 ).sub( u.worn.mul( 0.3 ) ) ), block ).add( sand.mul( 0.3 ) );
	const cavity = block.oneMinus().max( sipe ).max( ring );
	const s2 = wA.oneMinus().mul( u.worn ).mul( 0.03 ).add( wG.oneMinus().mul( 0.02 ) );
	return { color, slope, cavity, rough, s2 };

}
