// Brocade: a floral motif woven in floats of a gold weft over a silk ground.
// The gold weft is a supplementary pick: it floats on the face inside the
// motif and passes to the back outside it. Levels:
//   L0 motif:   a half drop repeat (motif_mm wide, 1.3 times as tall) of a
//               six petal flower on a waving stem with two leaves, and a
//               small four petal filler between the repeats. Petal veins,
//               an inner outline and leaf ribs are lines of ground left
//               between the floats. The ground around the gold sits lower:
//               it is shaded along the edge
//   L1 floats:  the gold lies in rows (picks, about 0.8 mm), so the motif
//               edge steps from row to row. A binding warp of the ground
//               ties each float every `binding` ends (about 1 mm), each tie
//               two ends further on each row (a twill line); the float
//               dips into each tie
//   L2 file:    each row holds two gold threads (file, about 0.4 mm): a
//               flat gilt strip wound around a yellow silk core. The strip
//               shows as slanted wraps, about 0.3 mm apart, the core in the
//               narrow gaps between them
//   L3 strip:   rolling lines along the strip (about 12 um) and the gilt
//               rubbed off on the highest points, showing the silver under it
// Returns { mask, color, slope, metal, rough, s2, cavity, groundShade }.
//
// The floats, the file and the strip sit in a gate() (core/lod.js): they
// run only inside the motif, where the mask is not zero. Outside it the
// woven shader mixes them by zero.

import { vec2, vec3, float, floor, fract, clamp, smoothstep, step, sqrt, mix, abs, cos, sin, atan, exp } from 'three/tsl';
import { fadeIn, gate } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';

const pm = ( x, n ) => x.sub( floor( x.div( n ) ).mul( n ) );

// Petalled rosette around c: approximate signed distance (motif units),
// plus the polar angle and radius.
function rosette( m, c, R, n ) {

	const v = m.sub( c );
	const r = v.length();
	const th = atan( v.y, v.x );
	const Rf = R.mul( abs( cos( th.mul( n / 2 ) ) ).pow( 0.6 ).mul( 0.42 ).add( 0.58 ) );
	return { d: r.sub( Rf ), r, th, Rf };

}

// Pointed leaf from anchor a, angle phi, length L, half width W.
function leaf( m, a, phi, L, W ) {

	const dir = vec2( Math.cos( phi ), Math.sin( phi ) ), nrm = vec2( - Math.sin( phi ), Math.cos( phi ) );
	const v = m.sub( a );
	const s = v.dot( dir ).sub( L / 2 ).div( L / 2 ), t = v.dot( nrm );
	const w = float( 1 ).sub( s.mul( s ) ).max( 0 ).mul( W );
	const d = abs( t ).sub( w ).max( abs( s ).sub( 1 ).mul( L / 2 ) );
	// Rib along the middle, side veins slanting to the tip.
	const rib = abs( t ).sub( 0.0035 );
	const vein = abs( fract( s.mul( L / 2 ).sub( abs( t ).mul( 1.3 ) ).div( 0.032 ) ).sub( 0.5 ) ).mul( 0.032 ).sub( 0.0028 )
		.max( abs( s ).sub( 0.8 ) ).max( abs( t ).sub( w.mul( 0.8 ) ) );
	return { d, line: rib.min( vein ).max( d ) };

}

// The motif in one cell; m in motif units (cell width 1).
function motif( m ) {

	const F = rosette( m, vec2( 0, 0.14 ), float( 0.21 ), 6 );
	const ring = abs( F.r.sub( 0.062 ) ).sub( 0.004 );
	const vein = abs( sin( F.th.mul( 3 ) ) ).mul( F.r ).sub( 0.0045 ).max( float( 0.085 ).sub( F.r ) ).max( F.r.sub( F.Rf ).add( 0.045 ) );
	const outline = abs( F.d.add( 0.026 ) ).sub( 0.0042 ).max( float( 0.07 ).sub( F.r ) );
	const xs = ( y ) => sin( y.mul( 6 ).add( 0.5 ) ).mul( 0.06 );
	const stem = abs( m.x.sub( xs( m.y ) ) ).mul( 0.8 ).sub( 0.011 ).max( abs( m.y.add( 0.33 ) ).sub( 0.3 ) );
	const y1 = - 0.22, y2 = - 0.44;
	const L1 = leaf( m, vec2( Math.sin( y1 * 6 + 0.5 ) * 0.06, y1 ), 0.6, 0.2, 0.055 );
	const L2 = leaf( m, vec2( Math.sin( y2 * 6 + 0.5 ) * 0.06, y2 ), 2.55, 0.18, 0.05 );
	const d = F.d.min( stem ).min( L1.d ).min( L2.d );
	const line = ring.min( vein ).min( outline ).max( F.d ).min( L1.line ).min( L2.line );
	return { d, line };

}

function filler( m ) {

	const R = rosette( m, vec2( 0 ), float( 0.085 ), 4 );
	return { d: R.d, line: abs( R.r.sub( 0.024 ) ).sub( 0.0035 ).max( R.d ) };

}

// Cell local coordinates of a half drop repeat, in motif units.
function halfDrop( q, ratio ) {

	const k = floor( q.x );
	const y = q.y.div( ratio ).sub( pm( k, float( 2 ) ).mul( 0.5 ) );
	return vec2( fract( q.x ).sub( 0.5 ), fract( y ).sub( 0.5 ).mul( ratio ) );

}

export function buildBrocade( p, fp, u ) {

	const M = u.motifM, Pg = u.goldPickM;
	// L1: rows of gold; the motif is read at the middle of each row.
	const j = floor( p.y.div( Pg ) ).toVar(), fy = fract( p.y.div( Pg ) ).toVar();
	const wRow = fadeIn( Pg, fp, 1.5, 4.0 ).toVar();
	const pq = vec2( p.x, mix( p.y, j.add( 0.5 ).mul( Pg ), wRow ) ).div( M );
	const A = motif( halfDrop( pq, 1.3 ) );
	const B = filler( halfDrop( pq.add( vec2( 0.5, 0.325 ) ), 1.3 ) );
	const d = A.d.min( B.d ).mul( M ), line = A.line.min( B.line ).mul( M );
	const fill = clamp( d.negate().div( fp ).add( 0.5 ), 0, 1 );
	const cut = clamp( line.negate().div( fp ).add( 0.5 ), 0, 1 ).mul( fadeIn( M.mul( 0.012 ), fp, 1.0, 3.0 ) );
	const mask = fill.mul( float( 1 ).sub( cut ) ).toVar();
	const groundShade = mix( float( 0.62 ), float( 1 ), smoothstep( 0.0, 1.0, d.div( Pg.mul( 1.2 ) ).max( 0 ) ).max( mask ) );
	// Outside the motif (mask 0) the gate skips the ties, file and strip.
	const off = { color: [ 0, 0, 0 ], slope: [ 0, 0 ], metal: 0, rough: 0, s2: 0, cavity: 0 };
	const G = gate( mask.greaterThan( 0 ), off, () => floats( p, fp, u, j, fy, wRow ), [ p, fp, j, fy, wRow, mask ] );
	return { mask, groundShade, ...G };

}

// L1 to L3 inside the motif: ties, file, wraps, strip.
function floats( p, fp, u, j, fy, wRow ) {

	const Pg = u.goldPickM;

	// Ties: one ground end over the float, two ends further on each row,
	// so the ties line up in a fine twill diagonal.
	const e = p.x.div( u.warpM ).add( j.mul( 2 ) );
	const qE = fract( e.div( u.binding ) ).sub( 0.5 ).mul( u.binding ); // ends from the tie
	const wTie = fadeIn( u.warpM, fp, 1.5, 4.0 ).mul( wRow );
	const tie = clamp( float( 0.42 ).sub( abs( qE ) ).mul( u.warpM ).div( fp ).add( 0.5 ), 0, 1 ).mul( wTie );
	const dip = exp( qE.mul( qE ).div( - 1.4 ) );
	const R = Pg.mul( 0.25 ); // file radius
	const sDip = dip.mul( qE ).mul( 2 / 1.4 ).mul( 0.6 ).mul( R ).div( u.warpM ).mul( wRow );

	// L2: two file per row, round across, wraps slanting along them.
	const sub = fract( fy.mul( 2 ) );
	const wFile = fadeIn( Pg.mul( 0.5 ), fp, 2.0, 6.0 );
	const xs = sub.mul( 2 ).sub( 1 ).clamp( - 0.96, 0.96 );
	const hs = sqrt( float( 1 ).sub( xs.mul( xs ) ) );
	const sFile = xs.div( hs ).negate().mul( 0.8 ).clamp( - 2.5, 2.5 ).mul( wFile );
	const wrapM = Pg.mul( 0.4 );
	const fid = j.mul( 2 ).add( floor( fy.mul( 2 ) ) );
	const ph = p.x.add( xs.mul( R ).mul( 1.1 ) ).div( wrapM ).add( hash1( vec2( fid, 4.1 ) ) );
	const fr = fract( ph );
	const wWrap = fadeIn( wrapM, fp, 2.0, 6.0 );
	const gap = smoothstep( 0.86, 0.9, fr ).mul( wWrap ).mul( hs ); // core seen between wraps
	const fx = fr.div( 0.88 ).mul( 2 ).sub( 1 ).clamp( - 0.95, 0.95 );
	const sWrap = fx.div( sqrt( float( 1 ).sub( fx.mul( fx ) ) ) ).negate().mul( 0.12 ).clamp( - 0.6, 0.6 ).mul( wWrap ).mul( float( 1 ).sub( gap ) );

	// L3: rolling lines along the strip, gilt rubbed off on the tops.
	const sM = float( 12e-6 );
	const rl = valueNoise( vec2( p.x.div( sM ).mul( 0.25 ).add( p.y.div( sM ).mul( 0.08 ) ), fid ) );
	const wRoll = fadeIn( sM, fp, 2.0, 6.0 );
	const sRoll = rl.sub( 0.5 ).mul( 0.08 ).mul( wRoll );
	const rub = smoothstep( 0.82, 0.97, hs.mul( float( 1 ).sub( abs( fx ).mul( 0.6 ) ) ).mul( valueNoise( p.div( 0.004 ) ).mul( 0.5 ).add( 0.6 ) ) ).mul( wWrap );

	const slope = vec2( sDip.add( sWrap ).add( sRoll ), sFile ).mul( float( 1 ).sub( tie ) )
		.add( vec2( qE.mul( - 0.7 ), 0 ).mul( tie ) );
	const tarnish = valueNoise( p.div( 0.03 ) ).mul( 0.25 ).add( 0.8 );
	const gold = mix( u.goldColor.mul( tarnish ), vec3( 0.9, 0.89, 0.86 ), rub.mul( 0.5 ) );
	const shade = mix( float( 1 ), hs.mul( 0.4 ).add( 0.6 ), wFile ).mul( float( 1 ).sub( dip.mul( 0.25 ).mul( wTie ) ) );
	let color = mix( gold, u.coreColor, gap ).mul( shade );
	color = mix( color, u.warpColor.mul( 0.9 ), tie );
	const metal = float( 1 ).sub( gap ).mul( float( 1 ).sub( tie ) );
	const rough = mix( float( 0.24 ), float( 0.5 ), gap.max( tie ) );
	const s2 = float( 1 ).sub( wFile ).mul( 0.07 ).add( float( 1 ).sub( wWrap ).mul( 0.02 ) );
	const cavity = float( 1 ).sub( hs ).mul( 0.5 ).mul( wFile ).add( dip.mul( 0.3 ).mul( wTie ) );
	return { color, slope, metal, rough, s2, cavity };

}
