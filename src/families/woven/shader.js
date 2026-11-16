// Woven family: TSL node graph, every level faded by its pixel size.
//   L1 weave:   warp and weft cross over and under (plain, twill, satin,
//               herringbone); the thread on top is round across, dips at
//               the ends of its float where it goes under
//   L2 plies:   the twist of the thread, diagonal ridges
//   L3 fibers:  fibers along the ply, some in a fleck colour (tweed)
// Linen slubs make the thread thicker and thinner along its length.
// Optional, compiled only when the preset uses them: brocade.js (a gold
// motif in floats over the cloth), sheer.js (voile: the gaps are holes).
// Coordinates in meters: x across the warp (weft direction), y along it.
//
// The weave sits in a gate() (core/lod.js): past its fade only the mean
// colour of the cloth is computed.

import { uv, vec2, float, floor, fract, clamp, smoothstep, step, sqrt, mix, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, fadeIn, fadeOn, gate, composeRoughness, specularAA, perturbNormal, pick } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';
import { applySurface } from '../../core/surface.js';
import { applyStates, anyState } from '../../core/states.js';
import { buildBrocade } from './brocade.js';
import { applySheer } from './sheer.js';

// Positive modulo (WGSL % keeps the sign of x).
const pm = ( x, n ) => x.sub( n.mul( floor( x.div( n ) ) ) );

// L1 to L3: the weave, its plies and fibers. c holds the cell coordinates
// and the colours computed before the gate. Returns the colour, the sheen
// colour, the slope, the cavity, the weights of L2 and L3, and for a
// sheer cloth the thread mask and the crossings.
function weave( p, fp, u, c ) {

	const { cx, cy, i, j, warpCol, weftCol, farCol, w1 } = c;
	const fx = fract( cx ), fy = fract( cy );
	const herringOn = step( 0.5, u.herring );
	const warpUp = ( ii, jj ) => {

		const flip = float( 1 ).sub( pm( floor( ii.div( u.herring.max( 1 ) ) ), float( 2 ) ).mul( 2 ) );
		const sh = u.shift.mul( pick( herringOn, flip, float( 1 ) ) );
		return step( pm( ii.mul( sh ).add( jj ), u.repeat ), u.up.sub( 0.5 ) );

	};

	// Each thread has a height: round across its width, and a crimp along
	// its length that goes up where it is on top and down where it passes
	// under (a smooth curve between cell centres). The highest thread is
	// the one seen: the crossings come out round, as in real cloth.
	const amp = u.flatten.mul( 0.5 ).add( 0.3 ); // crimp, in thread radii
	const crimp = ( a0, a1, f ) => {

		const t = f.mul( f ).mul( float( 3 ).sub( f.mul( 2 ) ) );
		return { z: mix( a0, a1, t ), dz: a1.sub( a0 ).mul( f.mul( float( 1 ).sub( f ) ).mul( 6 ) ) };

	};
	// Warp column i, along y: crimp from the cells below and above the centre.
	const ky = floor( cy.sub( 0.5 ) ), tfy = fract( cy.sub( 0.5 ) );
	const cw = crimp( warpUp( i, ky ).mul( 2 ).sub( 1 ), warpUp( i, ky.add( 1 ) ).mul( 2 ).sub( 1 ), tfy );
	// Weft row j, along x: it is up where the warp is down.
	const kx = floor( cx.sub( 0.5 ) ), tfx = fract( cx.sub( 0.5 ) );
	const cf = crimp( float( 1 ).sub( warpUp( kx, j ).mul( 2 ) ), float( 1 ).sub( warpUp( kx.add( 1 ), j ).mul( 2 ) ), tfx );
	// Slubs: each thread swells and thins along its length.
	const slW = valueNoise( vec2( p.y.div( u.slubM ), i.mul( 1.37 ).add( u.seed ) ) ).sub( 0.5 ).mul( u.slub ).mul( 1.6 ).add( 1 );
	const slF = valueNoise( vec2( p.x.div( u.slubM ), j.mul( 1.37 ).add( 7919 ).add( u.seed ) ) ).sub( 0.5 ).mul( u.slub ).mul( 1.6 ).add( 1 );
	// Hairy edges: the width wavers over a few fiber widths.
	// Two octaves: a slow waver and frayed fiber ends.
	const fray = ( t, id ) => valueNoise( vec2( t.div( u.fiberM.mul( 12 ) ), id ) ).sub( 0.5 ).mul( 0.3 )
		.add( valueNoise( vec2( t.div( u.fiberM.mul( 2.5 ) ), id.add( 0.5 ) ) ).sub( 0.5 ).mul( 0.22 ) ).mul( u.irregular ).mul( u.fray ).add( 1 );
	const edgeW = fray( p.y, i.mul( 3.1 ) );
	const edgeF = fray( p.x, j.mul( 3.1 ).add( 50 ) );
	const fillW = u.warpFill.mul( slW ).mul( edgeW ).clamp( 0.03, 1.08 ), fillF = u.fill.mul( slF ).mul( edgeF ).clamp( 0.3, 1.08 );
	const xw = fx.mul( 2 ).sub( 1 ).div( fillW ), xf = fy.mul( 2 ).sub( 1 ).div( fillF );
	// Section profile: round for a yarn, flat on top for a slat or a ribbon.
	const round = ( x ) => mix( float( 1 ), sqrt( float( 1 ).sub( x.clamp( - 0.98, 0.98 ).pow( 2 ) ) ), u.flatten.mul( 0.85 ).add( 0.15 ) );
	// Heights in thread radii; a gap (outside the width) is far below.
	const hW = cw.z.mul( amp ).add( round( xw ) ).sub( step( 1, xw.abs() ).mul( 9 ) );
	const hF = cf.z.mul( amp ).add( round( xf ) ).sub( step( 1, xf.abs() ).mul( 9 ) );
	const wu = step( hF, hW ).toVar(); // 1: the warp is seen
	const acrossF = pick( wu, fx, fy );
	const widthM = pick( wu, u.warpM, u.weftM ), lenM = pick( wu, u.weftM, u.warpM );
	const alongM = pick( wu, p.y, p.x );
	const tid = pick( wu, i, j.add( 7919 ) ); // thread id
	const sl = pick( wu, slW, slF ), fillE = pick( wu, fillW, fillF );
	const x = pick( wu, xw, xf );
	const ax = x.abs();
	// 1 on a thread, 0 in a gap between threads, antialiased over one pixel.
	const inside = clamp( float( 0.5 ).sub( ax.sub( 1 ).mul( widthM ).mul( fillE ).mul( 0.5 ).div( fp ) ), 0, 1 ).toVar();
	const xc = x.clamp( - 0.97, 0.97 );
	const hc = sqrt( float( 1 ).sub( xc.mul( xc ) ) );
	const sAcross = xc.div( hc ).negate().mul( u.flatten ).mul( 0.9 ).clamp( - 2, 2 ).mul( inside );
	// Along: the crimp slope, radius r = width * fill * flatten / 2.
	const dz = pick( wu, cw.dz, cf.dz );
	const sAlong = dz.mul( amp ).mul( widthM ).mul( fillE ).mul( u.flatten.mul( 0.5 ).add( 0.15 ) ).div( lenM ).mul( inside );
	const hTop = pick( wu, cw.z, cf.z );
	const dip = float( 1 ).sub( hTop ).mul( 0.5 ); // 0 on top of the float, 1 deep under
	const acrossDir = pick( wu, vec2( 1, 0 ), vec2( 0, 1 ) ), alongDir = pick( wu, vec2( 0, 1 ), vec2( 1, 0 ) );

	// L2 plies: ridges across the thread at the twist angle.
	const acrossM = acrossF.mul( widthM );
	const tilt = pick( wu, u.twistTan, u.twistTan.negate() ); // Z twist on the warp, S on the weft
	const pitch = widthM.mul( u.twistRatio );
	const r = alongM.add( acrossM.mul( tilt ) ).div( pitch ).add( hash1( vec2( tid, 3.1 ) ) );
	const rf = fract( r ).toVar();
	const g = alongDir.add( acrossDir.mul( tilt ) ).normalize(); // across the ridges
	const w2 = fadeIn( pitch, fp, 2.0, 6.0 ).mul( w1 ).toVar();
	const rx = rf.mul( 2 ).sub( 1 ).clamp( - 0.95, 0.95 );
	const rh = sqrt( float( 1 ).sub( rx.mul( rx ) ) );
	const sPly = rx.div( rh ).negate().mul( 0.3 ).clamp( - 1.5, 1.5 )
		.mul( smoothstep( 0.0, 1.0, rf.min( float( 1 ).sub( rf ) ).mul( pitch ).div( fp ) ) );

	// L3 fibers along the ply.
	const fdir = vec2( g.y.negate(), g.x );
	const lane = p.dot( g ).div( u.fiberM );
	const seg = p.dot( fdir ).div( u.fiberM.mul( 80 ) ).add( hash1( vec2( floor( lane ), tid ) ) );
	const fl = fract( lane.add( hash1( vec2( floor( seg ), floor( lane ) ) ).sub( 0.5 ).mul( 0.8 ) ) ).toVar();
	const fid = floor( lane ).add( floor( seg ).mul( 0.37 ) ).add( tid.mul( 0.11 ) );
	const w3 = fadeIn( u.fiberM, fp, 2.0, 6.0 ).mul( w2 ).toVar();
	const fx3 = fl.mul( 2 ).sub( 1 ).clamp( - 0.95, 0.95 );
	const sFib = fx3.div( sqrt( float( 1 ).sub( fx3.mul( fx3 ) ) ) ).negate().mul( 0.25 ).clamp( - 1.5, 1.5 )
		.mul( smoothstep( 0.0, 1.0, fl.min( float( 1 ).sub( fl ) ).mul( u.fiberM ).div( fp ) ) );

	const slope = acrossDir.mul( sAcross ).add( alongDir.mul( sAlong ) ).mul( w1 )
		.add( g.mul( sPly.mul( w2 ).mul( inside ) ) ).add( g.mul( sFib.mul( w3 ).mul( inside ) ) );

	// Colour of the thread on top and of the one under it.
	const topCol = pick( wu, warpCol, weftCol ), underCol = pick( wu, weftCol, warpCol );
	const v = u.colorVar;
	const tint = float( 1 ).add( hash1( vec2( tid, 9.7 ) ).sub( 0.5 ).mul( v ) )
		.add( sl.sub( 1 ).mul( 0.5 ) )
		.add( hash1( vec2( floor( r ), tid ) ).sub( 0.5 ).mul( v ).mul( w2 ) );
	// Flecks (tweed): short bits of coloured fiber, not whole fibers.
	const nep = floor( p.dot( fdir ).div( u.fiberM.mul( 6 ) ) );
	const isFleck = step( hash1( vec2( floor( lane ), nep.add( tid.mul( 0.7 ) ) ) ), u.heather );
	const fibCol = mix( topCol, u.heatherColor, mix( u.heather, isFleck, w3 ) )
		.mul( hash1( vec2( fid, 2.2 ) ).sub( 0.5 ).mul( v.mul( 2 ) ).mul( w3 ).add( 1 ) );
	const ao = mix( float( 1 ), hc.mul( u.roundShade ).add( float( 1 ).sub( u.roundShade ) ), w1 ).mul( float( 1 ).sub( dip.mul( 0.4 ).mul( w1 ) ) )
		.mul( mix( float( 1 ), rh.mul( 0.2 ).add( 0.8 ), w2 ) );
	const threadCol = fibCol.mul( tint ).mul( ao );
	const gapCol = underCol.mul( 0.45 );
	const cellCol = mix( gapCol, threadCol, inside );
	return {
		color: mix( farCol, cellCol, w1 ), sheen: mix( farCol, topCol, w1 ), slope,
		cavity: float( 1 ).sub( hc.mul( inside ) ).mul( 0.6 ).add( dip.mul( 0.4 ) ).mul( w1 ),
		w2, w3, inside, crossing: step( xw.abs(), 1 ).mul( step( xf.abs(), 1 ) ),
	};

}

export function buildWovenNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );

	// L1: the cell and who is on top.
	// Hand irregularity: threads are not ruled lines. A smooth domain warp
	// makes each thread wander a little across its neighbours.
	const wanderX = valueNoise( vec2( p.x.div( u.warpM ).mul( 0.15 ), p.y.div( u.slubM ) ).add( u.seed ) ).sub( 0.5 );
	const wanderY = valueNoise( vec2( p.y.div( u.weftM ).mul( 0.15 ), p.x.div( u.slubM ) ).add( u.seed.add( 4.4 ) ) ).sub( 0.5 );
	// A finer wobble, over one or two threads, so no border runs straight.
	const fineX = valueNoise( vec2( p.x.div( u.warpM ).mul( 0.7 ), p.y.div( u.weftM ).mul( 0.6 ) ).add( 7.7 ) ).sub( 0.5 );
	const fineY = valueNoise( vec2( p.y.div( u.weftM ).mul( 0.7 ), p.x.div( u.warpM ).mul( 0.6 ) ).add( 1.9 ) ).sub( 0.5 );
	// Cell coordinates, taken before the gate: the far colour of a tartan
	// reads the band of the thread too.
	const cx = p.x.div( u.warpM ).add( wanderX.mul( 0.6 ).add( fineX.mul( 0.22 ) ).mul( u.irregular ) ).toVar();
	const cy = p.y.div( u.weftM ).add( wanderY.mul( 0.6 ).add( fineY.mul( 0.22 ) ).mul( u.irregular ) ).toVar();
	const i = floor( cx ).toVar(), j = floor( cy ).toVar();

	// Colour. Tartan: each thread takes the colour of its band in the sett.
	// Outside the gate: a colour map is a texture read with implicit mips.
	const band = ( n ) => {

		const k = pm( n, u.sett ).div( u.sett );
		return mix( mix( u.tA, u.tB, step( 0.42, k ) ), u.tC, step( 0.74, k ).mul( step( k, 0.86 ) ) );

	};
	const warpCol = mix( opts.stitchColor ? opts.stitchColor.here : u.warpColor, band( i ), u.tartan ).toVar();
	const weftCol = mix( opts.stitchColor ? opts.stitchColor.here : u.weftColor, band( j ), u.tartan ).toVar();
	// Far: the mean of the cell, warp share = up / repeat.
	// The crimp hides part of the thread that is underneath: the face
	// thread covers more than its share of the cells (measured on the 2 cm
	// view of a 3/1 twill: 0.75 -> about 0.85).
	const share0 = u.up.div( u.repeat );
	const share = share0.add( share0.sub( 0.5 ).mul( 0.4 ) );
	const farCol = mix( mix( weftCol, warpCol, share ), u.heatherColor, u.heather ).mul( u.fill.mul( 0.25 ).add( 0.6 ) ).toVar();
	const w1 = fadeIn( u.warpM.min( u.weftM ), fp, 2.0, 6.0 ).toVar();

	// Past the weave's fade (threads under 2 px) only the mean colour is
	// left: the gate skips the weave, its plies and its fibers. Not with a
	// surface state on: the long state code after the branch made those
	// presets slower (blood 1.3 to 1.5 times, burns 1.1), so the weave is
	// then built without a branch, as before.
	const off = { color: { node: farCol, size: 3 }, sheen: { node: farCol, size: 3 }, slope: [ 0, 0 ], cavity: 0, w2: 0, w3: 0 };
	if ( u.sheerOn ) Object.assign( off, { inside: 0, crossing: 0 } );
	const level = () => weave( p, fp, u, { cx, cy, i, j, warpCol, weftCol, farCol, w1 } );
	const W = anyState( u.states ) ? level() : gate( fadeOn( u.warpM.min( u.weftM ), fp, 2.0 ), off, level, [ p, fp, cx, cy, i, j, warpCol, weftCol, farCol, w1 ] );
	const { w2, w3 } = W;

	let slope = W.slope;
	const B = u.brocadeOn ? buildBrocade( p, fp, u ) : null;
	if ( B ) slope = mix( slope, B.slope, B.mask );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, slope, tangentView, bitangentView ).toVar( 'ix_normal' );

	let colorNode = W.color;
	if ( B ) colorNode = mix( colorNode.mul( B.groundShade ), B.color, B.mask );

	const s2 = float( 1 ).sub( w1 ).mul( 0.1 ).mul( u.flatten.add( 0.2 ) ).add( float( 1 ).sub( w2 ).mul( 0.03 ) ).add( float( 1 ).sub( w3 ).mul( 0.015 ) );
	const rough = B ? mix( u.roughness, B.rough, B.mask ) : u.roughness;
	const roughnessNode = specularAA( composeRoughness( rough, B ? mix( s2, B.s2, B.mask ) : s2 ), normalNode );
	const nodes = {
		colorNode, normalNode, roughnessNode, metalnessNode: B ? B.metal.mul( B.mask ) : float( 0 ),
		sheenNode: W.sheen.mul( u.sheenAmt ).mul( B ? float( 1 ).sub( B.mask ) : 1 ), sheenRoughnessNode: float( 0.5 ),
	};
	let cavity = W.cavity;
	if ( B ) cavity = mix( cavity.max( float( 1 ).sub( B.groundShade ) ), B.cavity, B.mask );
	if ( u.sheerOn ) applySheer( nodes, u, { inside: W.inside, crossing: W.crossing, w1 } );
	applySurface( nodes, u.surface, { cavity, flatNormal: base, porosity: 1 } );
	applyStates( nodes, u.states, { cavity, flatNormal: base, coords: p, fp } );
	nodes.debug = { fp, w1, w2, w3, covered: float( 1 ) };
	return nodes;

}
