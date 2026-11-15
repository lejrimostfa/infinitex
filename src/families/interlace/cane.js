// Chair cane webbing, seven step pattern. In units of the repeat P
// (pitch_mm, about 12 mm):
//   L0 mesh:    vertical pairs of strands on x = i, horizontal pairs on
//               y = j + 1/2, single diagonals both ways on x +- y = k.
//               Three lines cross at each star (a pair and both diagonals);
//               the diamonds left between the diagonals, cut by the pairs,
//               are the octagonal holes (about 5 mm). Strands go over and
//               under at every crossing (a crimp along each strand)
//   L0 nodes:   the rattan stem had nodes every 15 to 25 cm: darker bands
//               a few mm long across a strand, a low ridge
//   L1 strand:  binder cane is the glossy outer skin of rattan, 2 to 3 mm
//               wide, 0.6 to 0.9 mm thick: a flat face with rounded edges,
//               the cut fibrous edge lighter and dull
//   L2 lines:   vascular bundles under the skin show as long streaks,
//               about 80 um apart, and finer ones at 20 um
//   L3 skin:    the silica skin itself: smooth, small scuffs and dull spots
// Returns colour, slope, cavity, alpha.

import { vec2, float, floor, fract, clamp, smoothstep, step, mix, abs, cos, sin, max } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';

const pm = ( x, n ) => x.sub( floor( x.div( n ) ).mul( n ) );
const sgn = ( i ) => float( 1 ).sub( pm( i, float( 2 ) ).mul( 2 ) ); // (-1)^i
const R2 = Math.SQRT1_2;

// Crimp of a strand along its phase: level +-1 where it crosses over or
// under another strand (cos = +-1), level 0 where it passes between two
// (cos = 0), short ramps between. Flat levels keep the edge of the strand
// on top straight. Returns the level and its derivative per unit phase.
function crimp( ph ) {

	const c = cos( ph.mul( Math.PI ) ), ac = abs( c );
	const t = ac.sub( 0.35 ).div( 0.4 ).clamp( 0, 1 );
	const z = c.sign().mul( t.mul( t ).mul( t.mul( - 2 ).add( 3 ) ) );
	const dz = t.mul( float( 1 ).sub( t ) ).mul( 6 / 0.4 ).mul( sin( ph.mul( Math.PI ) ).mul( - Math.PI ) );
	return { z, dz };

}

// Share of the area covered by strands, for the far view (Monte Carlo on
// the same geometry, done once in JS when the preset is applied).
export function caneCoverage( w ) {

	let n = 0;
	const N = 40000, c = w * 0.52;
	for ( let k = 0; k < N; k ++ ) {

		const x = ( k % 200 + 0.5 ) / 200, y = ( Math.floor( k / 200 ) + 0.5 ) / 200; // grid, deterministic
		const dx = x - Math.round( x ), dy = y - 0.5 - Math.round( y - 0.5 );
		const d1 = ( x - y ) - Math.round( x - y ), d2 = ( x + y ) - Math.round( x + y );
		const on = Math.abs( Math.abs( dx ) - c ) < w / 2 || Math.abs( Math.abs( dy ) - c ) < w / 2
			|| Math.abs( d1 ) * R2 < w / 2 || Math.abs( d2 ) * R2 < w / 2;
		if ( on ) n ++;

	}

	return n / N;

}

export function buildCane( p, fp, u ) {

	const P = u.pitchM, w = u.strandM.div( P ), c = w.mul( 0.52 );
	const q = p.div( P ).add( u.seed.mul( 0.37 ) );
	const irr = u.irregular.mul( 0.035 );
	const wob = ( t, id ) => valueNoise( vec2( t.mul( 0.4 ), id.mul( 1.7 ).add( 3.3 ) ) ).sub( 0.5 ).mul( irr );
	const thick = u.strandM.mul( 0.3 ); // strand thickness, meters
	const cands = [];
	// Vertical pair.
	{

		const i = floor( q.x.add( 0.5 ) ), dx = q.x.sub( i );
		const s = step( 0, dx ).mul( 2 ).sub( 1 );
		const id = i.mul( 2 ).add( s );
		const a = dx.sub( s.mul( c ) ).sub( wob( q.y, id ) ).div( w.mul( 0.5 ) );
		const cr = crimp( q.y.sub( 0.5 ) );
		cands.push( { a, z: sgn( i ).mul( cr.z ), dz: sgn( i ).mul( cr.dz ), across: vec2( 1, 0 ), along: vec2( 0, 1 ), t: p.y, id } );

	}

	// Horizontal pair.
	{

		const j = floor( q.y ), dy = q.y.sub( 0.5 ).sub( j );
		const s = step( 0, dy ).mul( 2 ).sub( 1 );
		const id = j.mul( 2 ).add( s ).add( 500 );
		const a = dy.sub( s.mul( c ) ).sub( wob( q.x, id ) ).div( w.mul( 0.5 ) );
		const cr = crimp( q.x );
		cands.push( { a, z: sgn( j ).mul( cr.z ).negate(), dz: sgn( j ).mul( cr.dz ).negate(), across: vec2( 0, 1 ), along: vec2( 1, 0 ), t: p.x, id } );

	}

	// Diagonals: x - y = k (running along (1, 1)) and x + y = k.
	for ( const dir of [ 1, - 1 ] ) {

		const e = dir > 0 ? q.x.sub( q.y ) : q.x.add( q.y ), l = dir > 0 ? q.x.add( q.y ) : q.x.sub( q.y );
		const k = floor( e.add( 0.5 ) );
		const id = k.add( dir > 0 ? 1000 : 2000 );
		const a = e.sub( k ).mul( R2 ).sub( wob( l.mul( R2 ), id ) ).div( w.mul( 0.5 ) );
		const cr = crimp( l );
		cands.push( { a, z: cr.z.mul( 0.8 * dir ), dz: cr.dz.mul( 0.8 * dir * Math.SQRT2 ), across: vec2( R2, - R2 * dir ), along: vec2( R2, R2 * dir ), t: l.mul( P ).mul( R2 ), id } );

	}

	// Highest strand wins; coverage is the union of all strands.
	let best = float( - 1e3 ), A = float( 0 ), dz = float( 0 ), across = vec2( 0 ), along = vec2( 0 ), t = float( 0 ), id = float( 0 ), cover = float( 0 );
	let zNear = float( - 1e3 ); // a strand passing just beside and above: its shadow
	for ( const C of cands ) {

		const ax = abs( C.a );
		const h = C.z.mul( 0.6 ).add( float( 1 ).sub( ax.pow( 8 ) ).mul( 0.5 ) ).sub( step( 1, ax ).mul( 9 ) );
		zNear = max( zNear, C.z.mul( 0.6 ).add( 0.5 ).sub( smoothstep( 1.0, 1.9, ax ).mul( 9 ) ) ).toVar();
		const win = step( best, h );
		best = max( best, h ).toVar();
		A = pick( win, C.a, A ).toVar();
		dz = pick( win, C.dz, dz ).toVar();
		across = pick( win, C.across, across ).toVar();
		along = pick( win, C.along, along ).toVar();
		t = pick( win, C.t, t ).toVar();
		id = pick( win, C.id, id ).toVar();
		cover = cover.max( clamp( float( 1 ).sub( ax ).mul( u.strandM.mul( 0.5 ) ).div( fp ).add( 0.5 ), 0, 1 ) );

	}

	const wS = fadeIn( u.strandM, fp, 2.0, 6.0 ).toVar();
	const wHole = fadeIn( P.mul( 0.4 ), fp, 1.5, 4.0 );
	const ac = A.clamp( - 0.98, 0.98 );
	const sAcross = ac.pow( 7 ).mul( - 8 ).mul( thick ).mul( 0.5 ).div( u.strandM.mul( 0.5 ) ).clamp( - 2, 2 );
	const sAlong = dz.mul( 0.6 ).mul( thick ).div( P );

	// Nodes along each strand.
	const nodeM = float( 0.2 );
	const nf = fract( t.div( nodeM ).add( hash1( vec2( id, 7.7 ) ) ) ).sub( 0.5 ).mul( nodeM ); // meters from the node
	const node = smoothstep( 0.004, 0.0015, abs( nf ) );
	const sNode = nf.mul( - 8 ).mul( smoothstep( 0.003, 0.001, abs( nf ) ) ).mul( 0.4 );

	// Vascular streaks along the strand.
	const xm = ac.mul( u.strandM.mul( 0.5 ) ); // meters across
	const lane1 = valueNoise( vec2( xm.div( 8e-5 ), t.div( 0.004 ) ).add( id ) ).mul( 0.6 ).add( valueNoise( vec2( xm.div( 3e-4 ), t.div( 0.02 ) ).add( id.mul( 1.3 ) ) ).mul( 0.4 ) );
	const w2 = fadeIn( 8e-5, fp, 2.0, 6.0 ).mul( wS );
	const lane2 = valueNoise( vec2( xm.div( u.fiberM ), t.div( 0.0015 ) ).add( id.mul( 0.3 ) ) );
	const w3 = fadeIn( u.fiberM, fp, 2.0, 6.0 ).mul( wS );
	const sLine = lane1.sub( 0.5 ).mul( 0.1 ).mul( w2 ).add( lane2.sub( 0.5 ).mul( 0.05 ).mul( w3 ) );
	// Skin scuffs: dull spots and short scratches.
	const scuff = smoothstep( 0.62, 0.8, valueNoise( p.div( 6e-4 ).add( id ) ) ).mul( fadeIn( 6e-4, fp, 2.0, 6.0 ) );

	const slope = across.mul( sAcross.add( sLine ).mul( wS ) ).add( along.mul( sAlong.add( sNode ).mul( wS ) ) );
	const edge = smoothstep( 0.8, 0.92, abs( A ) ).mul( wS ); // cut fibrous edge
	const tint = hash1( vec2( id, 3.1 ) ).sub( 0.5 ).mul( u.colorVar ).mul( wS ).add( 1 )
		.mul( valueNoise( p.div( 0.08 ).add( u.seed ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) )
		.mul( valueNoise( vec2( t.div( 0.03 ), id.mul( 0.7 ) ) ).sub( 0.5 ).mul( u.colorVar ).mul( 1.5 ).add( 1 ) );
	let color = u.color.mul( tint ).mul( lane1.sub( 0.5 ).mul( 0.4 ).mul( w2 ).add( 1 ) ).mul( lane2.sub( 0.5 ).mul( 0.15 ).mul( w3 ).add( 1 ) );
	color = mix( color, u.color2, node.mul( 0.8 ) );
	color = mix( color, u.color.mul( 1.25 ).add( 0.04 ), edge.mul( 0.7 ) );
	const shadow = smoothstep( 0.1, 0.6, zNear.sub( best ) ).mul( wS );
	const shade = mix( float( 0.8 ), float( 1 ).sub( ac.pow( 8 ).mul( 0.3 ) ), wS ).mul( best.mul( 0.1 ).add( 0.9 ).clamp( 0.75, 1 ) ).mul( float( 1 ).sub( shadow.mul( 0.55 ) ) );
	color = color.mul( shade );
	const rough = u.roughness.add( edge.mul( 0.45 ) ).add( scuff.mul( 0.15 ) ).add( node.mul( 0.1 ) ).min( 1 );
	const s2 = float( 1 ).sub( wS ).mul( 0.06 ).add( float( 1 ).sub( w2 ).mul( 0.004 ) );
	const meanCover = u.coverage;
	const alpha = mix( meanCover, cover, wHole );
	const cavity = ac.pow( 8 ).mul( 0.5 ).add( node.mul( 0.2 ) ).add( shadow.mul( 0.5 ) ).mul( wS );
	return { color, slope, rough, s2, cavity, alpha };

}
