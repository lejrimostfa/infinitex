// Loop pile: the yarn comes up through the backing and goes back down,
// uncut. Seen from above, each loop is the top of an arch of twisted yarn.
// Berber (loop mode):
//   L1 loops   tight level loops in rows (rows 3 to 5 mm apart, a loop
//              every 2.5 to 3.5 mm, the yarn 2 to 3 mm thick): pebbles,
//              alternate rows shifted by half a loop, dark pinches between
//   L2 plies   2 or 3 plies twisted, dark flecks in some ply segments
//              (the berber fleck: short dark dashes in an oatmeal yarn)
//   L3 fibres  wool or olefin fibres (30 to 45 um) along each ply
// Terry towel (terry mode):
//   L1 loops   loose loops (2 to 5 mm) standing from a woven ground in
//              rows, flopped every way: rings of yarn seen at all angles,
//              three layers deep, the roots hidden, the ground dark
//   L2 plies   soft low-twist cotton yarn (0.5 to 0.7 mm)
//   L3 fibres  cotton fibres (12 to 20 um), fuzzy
// Each loop is drawn as a twisted yarn (fibres.js twistedYarn).

import { vec2, float, floor, fract, sqrt, mix, smoothstep, step, clamp, sin, cos, atan, mod } from 'three/tsl';
import { fadeIn, pick } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { twistedYarn } from './fibres.js';

// Yarn colour with flecks: a dark fibre lot spun into the yarn. Where it
// comes up (patches 0.3 to 1 mm, stretched along the yarn) a share of the
// fibres is dark: dark streaks along the fibres, a speck from afar.
function flecked( u, Y, a, c, R, id ) {

	const n = valueNoise( vec2( a.div( 9e-4 ), c.mul( R ).div( 3e-4 ) ).add( id.mul( 7.3 ) ) );
	const patch = smoothstep( float( 0.95 ).sub( u.fleck.mul( 0.6 ) ), float( 1.15 ).sub( u.fleck.mul( 0.6 ) ), n ).mul( Y.w2 );
	const f = patch.mul( mix( float( 0.6 ), step( Y.fh, patch.mul( 0.8 ) ), Y.w3 ) );
	return mix( u.color, u.color2, f ).mul( hash1( vec2( id, 2.7 ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );

}

export function buildLoop( p, fp, u ) {

	const d = vec2( cos( u.angle ), sin( u.angle ) ), n = vec2( sin( u.angle ).negate(), cos( u.angle ) );
	const x = p.dot( d ), y = p.dot( n );
	const ry = y.div( u.rowM );
	const rid = floor( ry );
	const fy = fract( ry ).sub( 0.5 );
	const xl = x.div( u.lockM ).add( mod( rid, 2 ).mul( 0.5 ) ).add( hash1( vec2( rid, 9.1 ) ) );
	const lid = floor( xl );
	const fx = fract( xl ).sub( 0.5 );
	const id = wrapCoord( lid ).add( wrapCoord( rid ).mul( 0.0137 ) ).toVar();
	const h = hash3( vec2( lid, rid ).add( u.seed ) );
	const ax = h.x.mul( 0.2 ).add( 0.6 ), ay = h.y.mul( 0.1 ).add( 0.5 );
	const ex = fx.add( h.z.sub( 0.5 ).mul( 0.08 ) ).div( ax ), ey = fy.div( ay );
	const rr = vec2( ex, ey ).length();
	const wL = fadeIn( u.lockM, fp, 1.5, 4.0 ).toVar();
	const R = ay.mul( u.rowM );
	const cov = clamp( float( 1 ).sub( rr ).mul( R ).div( fp ).add( 0.5 ), 0, 1 );
	const q = rr.clamp( 0, 0.97 );
	const dome = sqrt( float( 1 ).sub( q.mul( q ) ) );
	const ya = x.add( lid.mul( 1.7e-3 ) );
	const Y = twistedYarn( ya, ey.clamp( - 1, 1 ), R, fp, u, id, 0.5 );
	// A loop is a flattened arch: light on top, shade only near its foot.
	// Loops are never quite level: lower ones sit in the shade.
	const lvl = hash1( vec2( lid, rid ).add( 7.7 ) ).mul( 0.25 ).add( 0.8 );
	const top = smoothstep( 0.0, 0.6, dome ).mul( 0.4 ).add( 0.6 ).mul( Y.shade ).mul( lvl );
	const deep = float( 1 ).sub( u.lockDepth );
	const yarnCol = flecked( u, Y, ya, ey, R, id );
	const meanCol = mix( u.color, u.color2, u.fleck.mul( 0.5 ) ).mul( mix( deep, float( 0.85 ), 0.8 ) );
	const color = mix( meanCol, yarnCol.mul( mix( deep, top, cov ) ), wL );
	// Dome of the loop plus the ply and fibre relief (along x, around y).
	const sDome = vec2( ex.div( ax ), ey.div( ay ) ).mul( 0.2 ).div( dome.max( 0.35 ) ).mul( cov );
	const sY = Y.slope.mul( dome.max( 0.2 ) ).mul( cov );
	const sl = sDome.add( sY ).mul( wL );
	const slope = d.mul( sl.x ).add( n.mul( sl.y ) );
	const s2 = float( 1 ).sub( wL ).mul( 0.1 ).add( Y.s2.mul( wL ) );
	return { color, slope, s2, cavity: float( 1 ).sub( cov.mul( dome ) ).mul( wL ), rough: u.roughness, sheenColor: u.color };

}

const LAYERS = 3;

export function buildTerry( p, fp, u ) {

	const d = vec2( cos( u.angle ), sin( u.angle ) ), n = vec2( sin( u.angle ).negate(), cos( u.angle ) );
	const x = p.dot( d ), y = p.dot( n );
	const cell = vec2( u.lockM, u.rowM );
	const yarnR = u.lockM.mul( 0.17 );
	const wL = fadeIn( u.lockM, fp, 1.5, 4.0 ).toVar();
	// One loop: centre jittered in its cell, a ring of radii a, b (a loop
	// seen tilted), turned by th; its roots (one arc) dive under the others.
	const loopAt = ( cid, q0, k ) => {

		const h = hash3( cid.add( u.seed ).add( k * 31 ) ), h2 = hash3( cid.add( 57.3 + k * 13 ) );
		const rel = q0.sub( cid.add( 0.5 ).add( h.xy.sub( 0.5 ).mul( 0.9 ) ) ).mul( cell );
		const th = h2.y.mul( Math.PI ), ct = cos( th ), st = sin( th );
		const e = vec2( rel.x.mul( ct ).add( rel.y.mul( st ) ), rel.y.mul( ct ).sub( rel.x.mul( st ) ) );
		const a = u.lockM.mul( h.z.mul( 0.25 ).add( 0.42 ) );
		const b = a.mul( h2.x.mul( 0.6 ).add( 0.3 ) );
		const en = vec2( e.x.div( a ), e.y.div( b ) );
		const l = en.length();
		const dr = l.sub( 1 ).mul( a.add( b ).mul( 0.5 ) );
		const r0 = h2.z.mul( 6.28 );
		const arc = smoothstep( 0.92, 0.55, en.dot( vec2( cos( r0 ), sin( r0 ) ) ).div( l.max( 1e-6 ) ) );
		const cv = clamp( yarnR.sub( dr.abs() ).div( fp ).add( 0.5 ), 0, 1 ).mul( arc );
		return { cv, e, en, a, b, dr, ct, st };

	};

	// Winner so far: the topmost loop covering this point.
	let cov = float( 0 ), across = float( 0 ), along = float( 0 ), wid = float( 0 ), rdir = vec2( 0 ), layerShade = float( 0.25 );
	for ( let k = 0; k < LAYERS; k ++ ) {

		const q0 = vec2( x, y ).div( cell ).add( vec2( k * 0.37, k * 0.61 ) ).toVar();
		const base = floor( q0 );
		// Cheap pass: coverage only, keep the best cell. Then the full yarn
		// frame of that one loop.
		let lc = float( 0 ), best = vec2( 0 );
		for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

			const cid = base.add( vec2( ox, oy ) );
			const { cv } = loopAt( cid, q0, k );
			const better = step( lc, cv );
			lc = pick( better, cv, lc ).toVar();
			best = pick( better, cid, best ).toVar();

		}

		const L = loopAt( best, q0, k );
		const la = L.dr.div( yarnR );
		const lg = atan( L.en.y, L.en.x ).mul( L.a.add( L.b ).mul( 0.5 ) );
		const li = hash1( best.add( k * 7.7 ) ).mul( 97 );
		const rw = vec2( L.e.x.div( L.a.mul( L.a ) ), L.e.y.div( L.b.mul( L.b ) ) ).normalize();
		const lr = vec2( rw.x.mul( L.ct ).sub( rw.y.mul( L.st ) ), rw.x.mul( L.st ).add( rw.y.mul( L.ct ) ) );

		// A higher layer covers the lower ones.
		across = mix( across, la, lc ).toVar();
		along = mix( along, lg, lc ).toVar();
		wid = pick( step( 0.5, lc ), li, wid ).toVar();
		rdir = mix( rdir, lr, lc ).toVar();
		layerShade = mix( layerShade, float( 0.62 + 0.19 * k ), lc ).toVar();
		cov = cov.max( lc ).toVar();

	}

	const c = across.clamp( - 0.97, 0.97 );
	const round = sqrt( float( 1 ).sub( c.mul( c ) ) );
	const Y = twistedYarn( along, c, yarnR, fp, u, wid, 1 );
	const yarnCol = u.color.mul( hash1( vec2( wid, 3.3 ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	// The ground, deep under the loops: in the shade, seen through gaps.
	const ground = mix( u.color, u.color2, 0.5 ).mul( valueNoise( p.div( 5e-4 ).add( u.seed ) ).mul( 0.15 ).add( 0.12 ) );
	const lit = yarnCol.mul( layerShade ).mul( round.mul( 0.4 ).add( 0.6 ) ).mul( Y.shade );
	const near = mix( ground, lit, cov );
	const color = mix( u.color.mul( 0.68 ), near, wL ).mul( valueNoise( p.div( 0.03 ).add( u.seed ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	const sAcross = rdir.mul( c.div( round ).negate().mul( 0.5 ) ).mul( cov );
	const sl = sAcross.add( rdir.mul( Y.slope.y ).mul( cov ) ).mul( wL );
	const slope = d.mul( sl.x ).add( n.mul( sl.y ) );
	const s2 = float( 1 ).sub( wL ).mul( 0.15 ).add( Y.s2.mul( wL ) );
	return { color, slope, s2, cavity: float( 1 ).sub( cov.mul( layerShade ) ).mul( wL ), rough: u.roughness, sheenColor: u.color };

}
