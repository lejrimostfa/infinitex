// Shared pieces of the pile family.
//   brush      the lean of the pile, turned by crushed patches (same field
//              as the 3D strands, core/hair3d.js), and the view along it:
//              looking at the fibre ends (camera on the tip side) shows the
//              dark depth of the pile, looking at their sides shows light
//   fibreEnds  the top of a pile seen from above: each fibre ends as a short
//              round streak (it leans), two layers, dark depth between
//   yarn       a twisted yarn seen from the side: plies as helix bands,
//              fibres along each ply (loops of berber and terry)
// All sizes in meters. Each level fades in by its pixel size.

import { vec2, float, floor, fract, sqrt, mix, smoothstep, step, clamp, sin, cos, asin, positionView, tangentView, bitangentView } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';

export function brushField( p, u ) {

	const a = u.angle.add( valueNoise( p.div( u.flowM ).add( u.seed ) ).sub( 0.5 ).mul( u.flowAmt ).mul( 2 ) );
	const dir = vec2( cos( a ), sin( a ) ).toVar();
	// View ray in surface coordinates (camera to point).
	const rd = positionView.normalize();
	const vt = vec2( rd.dot( tangentView ), rd.dot( bitangentView ) );
	const facing = vt.dot( dir ).negate().toVar(); // > 0: camera on the tip side
	const lean = sqrt( float( 1 ).sub( u.pile.mul( u.pile ) ).max( 0 ) );
	// Fibre ends toward the camera: we look down into the pile, dark.
	const viewShade = float( 1 ).sub( facing.mul( u.nap ).mul( lean.mul( 2 ).add( 0.5 ) ) ).clamp( 0.3, 1.6 );
	return { dir, facing, lean, viewShade, grazing: vt.length() };

}

// Fibre ends on a jittered lattice, `spacing` apart, radius r. dir: lean.
// Returns coverage of the top layer, a shade (0 deep .. 1 tip), a slope.
export function fibreEnds( p, fp, dir, lean, spacing, r, seed ) {

	const w = fadeIn( spacing, fp, 1.5, 4.0 ).toVar();
	const lat = vec2( dir.y.negate(), dir.x );
	const q0 = vec2( p.dot( dir ), p.dot( lat ) ).div( spacing );
	const len = lean.mul( 1.6 ).add( 0.15 ); // streak length, in cells
	let shade = float( 0.25 ), slope = vec2( 0 ), cov = float( 0 );
	for ( let k = 0; k < 2; k ++ ) {

		const q = q0.add( vec2( k * 0.5, k * 0.37 ) );
		const id = floor( q ), f = fract( q );
		const h = hash3( id.add( seed ).add( k * 17 ) );
		const c = h.xy.mul( 0.5 ).add( 0.25 );
		// Segment from the tip (c) back toward the root, along -x.
		const rel = f.sub( c );
		const t = rel.x.negate().div( len ).clamp( 0, 1 );
		const d = rel.add( vec2( t.mul( len ), 0 ) );
		const rr = float( r ).div( spacing ).mul( h.z.mul( 0.5 ).add( 0.75 ) );
		const dist = d.length();
		const cv = clamp( rr.sub( dist ).mul( spacing ).div( fp ).add( 0.5 ), 0, 1 );
		// Round fibre: the slope points out of its axis.
		const qn = d.div( rr ).clamp( - 0.95, 0.95 );
		const sl = vec2( 0, qn.y ).mul( 0.8 );
		const s = mix( float( 1 ), float( 0.55 ), t ).mul( sqrt( float( 1 ).sub( qn.y.mul( qn.y ) ) ).mul( 0.4 ).add( 0.6 ) ).mul( 0.7 + 0.3 * k );
		shade = mix( shade, s, cv );
		slope = mix( slope, sl, cv );
		cov = cov.max( cv );

	}

	// Back to surface coordinates.
	const slopeP = dir.mul( slope.x ).add( lat.mul( slope.y ) );
	return { w, shade, slope: slopeP, cov };

}

// A twisted yarn seen from the side. a: meters along the yarn, c: -1..1
// across it (0 on the axis), R: radius, id: per yarn random.
export function twistedYarn( a, c, R, fp, u, id, fuzz = 0 ) {

	const phi = asin( c.clamp( - 0.98, 0.98 ) );
	const nP = u.plies;
	// Helix bands: a / pitch + phi / 2 pi = const for each ply.
	const drift = valueNoise( vec2( a.div( u.twistM ), id.mul( 13.1 ) ) ).sub( 0.5 ).mul( 0.4 );
	const pc = a.div( u.twistM ).add( phi.div( Math.PI * 2 ) ).add( id ).add( drift ).mul( nP );
	const v = fract( pc ).toVar();
	const plyId = floor( pc ).add( id.mul( 31 ) ).toVar();
	const gA = nP.div( u.twistM ), gS = nP.div( R.mul( Math.PI * 2 ) );
	const period = float( 1 ).div( sqrt( gA.mul( gA ).add( gS.mul( gS ) ) ) );
	const w2 = fadeIn( period, fp, 2.0, 5.0 ).toVar();
	const edge = smoothstep( 0, 1, v.min( float( 1 ).sub( v ) ).mul( period ).div( fp ) );
	const plyShade = mix( float( 0.9 ), sin( v.mul( Math.PI ) ).sqrt().mul( 0.28 ).add( 0.72 ), w2.mul( edge ) );
	const dh = cos( v.mul( Math.PI ) ).mul( 0.4 ).mul( edge ).mul( w2 );
	// Fibres run along the ply: lanes across it, fibre width apart.
	const fw = u.strandW;
	const lanes = v.mul( period ).div( fw ).add( valueNoise( vec2( a.div( fw.mul( 40 ) ), plyId ) ).mul( 2 ) );
	const lf = fract( lanes );
	const lid = floor( lanes );
	const w3 = fadeIn( fw, fp, 1.5, 4.0 ).mul( w2 ).toVar();
	const x = lf.sub( 0.5 ).mul( 2 );
	const fEdge = smoothstep( 0, 1, lf.min( float( 1 ).sub( lf ) ).mul( fw ).div( fp ) );
	const fShade = mix( float( 0.9 ), sqrt( float( 1 ).sub( x.mul( x ) ).max( 0 ) ).mul( 0.45 ).add( 0.55 ).mul( hash1( vec2( lid, plyId ) ).mul( 0.3 ).add( 0.85 ) ), w3.mul( fEdge ) );
	// Loose yarn (fuzz > 0): a second set of fibres crosses the first at
	// about 20 degrees, and the gaps between fibres are deeper.
	let fs = fShade;
	if ( fuzz > 0 ) {

		const l2 = v.mul( period ).add( a.mul( 0.36 ) ).div( fw.mul( 1.2 ) ).add( valueNoise( vec2( a.div( fw.mul( 25 ) ), plyId.add( 5 ) ) ).mul( 3 ) );
		const x2 = fract( l2 ).sub( 0.5 ).mul( 2 );
		const e2 = smoothstep( 0, 1, fract( l2 ).min( float( 1 ).sub( fract( l2 ) ) ).mul( fw ).div( fp ) );
		const on = step( 0.55, hash1( vec2( floor( l2 ), plyId.add( floor( a.div( fw.mul( 60 ) ) ) ) ) ) );
		const s2f = sqrt( float( 1 ).sub( x2.mul( x2 ) ).max( 0 ) ).mul( 0.5 ).add( 0.6 );
		fs = mix( fShade.mul( float( 1 ).sub( w3.mul( fuzz * 0.25 ) ) ), s2f, on.mul( e2 ).mul( w3 ).mul( fuzz * 0.8 ) );

	}

	// Slope in (along, around) of the yarn: ply bands and fibre rounds.
	const gN = vec2( gA, gS ).mul( period );
	const slope = gN.mul( dh.add( x.mul( 0.35 ).mul( w3 ).mul( fEdge ) ) );
	return { shade: plyShade.mul( fs ), slope, plyId, v, w2, w3, fh: hash1( vec2( lid.add( 0.5 ), plyId.add( 3.3 ) ) ), s2: float( 1 ).sub( w2 ).mul( 0.04 ).add( float( 1 ).sub( w3 ).mul( 0.03 ) ) };

}
