// Knit stitch patterns: which stitch sits in each cell, how high it stands,
// and the relief of the pattern seen from afar. Used instead of
// stitchLevel() when the preset sets `stitch` (the jersey path is untouched).
//   rib      columns of knit V (raised) and purl bumps (sunk), 2 x 2 by
//            default: ribs 1 cm apart on a 20 stitch per 10 cm yarn
//   garter   every row purl on this face: a ridge every two rows, the knit
//            rows sink between them
//   seed     knit and purl alternate in both directions: a pebbly check
//   cable    Aran: crossed knit strands raised over reverse stockinette
//            (cable.js)
//   lace     knit with eyelets (yarn overs) in a diamond, holes show the
//            backing (lace.js)
//   crochet  single crochet: posts, loop chains, holes between posts
// Each pattern returns the stitch level of cells.js plus a macro relief
// { h, ao } in stitch widths, which stays visible once single stitches
// are below a pixel (rib grooves, garter ridges, cables, eyelets).

import { vec2, float, floor, smoothstep, step, abs } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { valueNoise } from '../../core/hash.js';
import { topPiece } from './cells.js';
import { knitItems, purlItems, crochetItems, posmod } from './pieces.js';
import { cableLevel } from './cable.js';
import { laceLevel } from './lace.js';

// Smooth square wave: 1 inside [0, on) of each period n, 0 in the rest.
function band( x, on, n, soft = 0.45 ) {

	const d = abs( posmod( x.sub( on / 2 ).add( n / 2 ), n ).sub( n / 2 ) );
	return float( 1 ).sub( smoothstep( on / 2 - soft, on / 2 + soft, d ) );

}

// Knit / purl patterns: rib, garter, seed. g = pattern settings (params.js).
function knitPurl( u, f, g ) {

	const L = u.relief.mul( g.lift );
	let isPurl, macro;
	if ( g.mode === 'rib' ) {

		const n = g.ribK + g.ribP;
		isPurl = ( c ) => step( g.ribK - 0.5, posmod( c.x, n ) );
		macro = ( p ) => band( p.x, g.ribK, n );

	} else if ( g.mode === 'garter' ) {

		isPurl = ( c ) => posmod( c.y, 2 );
		macro = ( p ) => band( p.y.div( u.aspect ).sub( 1 ), 1, 2 );

	} else {

		isPurl = ( c ) => posmod( c.x.add( c.y ), 2 );
		macro = null;

	}

	const isKnit = ( c ) => float( 1 ).sub( isPurl( c ) );
	// Knit stands up by L, purl sinks by L (rib); garter the other way.
	const sign = g.mode === 'garter' ? - 1 : 1;
	const liftK = ( c ) => isKnit( c ).mul( 2 ).sub( 1 ).mul( L ).mul( sign );
	const liftP = ( c ) => liftK( c );
	const items = [ ...knitItems( u, f, isKnit, liftK ), ...purlItems( u, f, isPurl, liftP ) ];
	// Macro: s = 1 on the raised stitches. Far AO darkens the sunk ones.
	const mac = macro ? ( p ) => {

		const s = sign > 0 ? macro( p ) : float( 1 ).sub( macro( p ) );
		return { h: s.mul( 2 ).sub( 1 ).mul( L ), ao: s.mul( g.macroAO ).add( 1 - g.macroAO ) };

	} : null;
	return { items, macro: mac };

}

function crochet( u, f ) {

	return { items: crochetItems( u, f ), macro: null };

}

const MODES = { rib: knitPurl, garter: knitPurl, seed: knitPurl, crochet, cable: cableLevel, lace: laceLevel };

// Same frame as stitchLevel(): stitch widths, rows that wander a little.
// No parallax probe: patterns already cost two to three times the legs.
// w1: fadeIn( stitchW, fp, 4, 12 ) as a variable, from shader.js.
export function patternLevel( u, uvm, fp, w1 ) {

	const g = u.pattern;
	const p0 = uvm.div( u.stitchW );
	const wob = vec2( valueNoise( p0.div( 7 ) ), valueNoise( p0.div( 7 ).add( 37.7 ) ) ).sub( 0.5 ).mul( u.irregular.mul( 0.35 ) );
	let p = p0.add( wob ).toVar();
	const pre = g.mode === 'lace' ? laceLevel.warp( u, p ) : null;
	if ( pre ) p = pre.p;
	const col = floor( p.x ).toVar();
	const row = floor( p.y.div( u.aspect ) ).toVar();
	const local = vec2( p.x.sub( col ), p.y.sub( row.mul( u.aspect ) ) ).toVar();
	const P = MODES[ g.mode ]( u, { local, col, row, p, pre }, g );
	const s = topPiece( u, P.items, fp, w1 );

	// Macro relief: slope by central differences, faded by its period.
	s.macro = null;
	if ( P.macro ) {

		const e = 0.06;
		const m0 = P.macro( p );
		const hx = P.macro( p.add( vec2( e, 0 ) ) ).h.sub( P.macro( p.sub( vec2( e, 0 ) ) ).h ).div( 2 * e );
		const hy = P.macro( p.add( vec2( 0, e ) ) ).h.sub( P.macro( p.sub( vec2( 0, e ) ) ).h ).div( 2 * e );
		const wM = fadeIn( u.stitchW.mul( g.macroPeriod ), fp, 2.0, 6.0 );
		s.macro = { slope: vec2( hx, hy ).mul( wM ), ao: m0.ao.sub( g.macroMeanAO ).mul( wM ).add( g.macroMeanAO ), h: m0.h };

	}

	// Lace: the eyelet disc is empty whatever the warp brought there.
	s.hole = null;
	if ( P.hole ) {

		const fpS = fp.div( u.stitchW );
		const disc = P.hole.radius.sub( P.hole.dist ).div( fpS ).add( 0.5 ).clamp( 0, 1 );
		const exact = disc.max( float( 1 ).sub( s.covered ).mul( s.edgeFade ) );
		s.covered = s.covered.mul( float( 1 ).sub( disc ) ).toVar();
		// Far: the disc blurred over the footprint, its area kept.
		const far = P.hole.radius.sub( P.hole.dist ).div( fpS.max( 0.3 ) ).add( 0.5 ).clamp( 0, 1 ).mul( P.hole.radius.mul( 2 ).div( fpS ).min( 1 ).pow( 2 ) );
		s.hole = { exact, far };

	}

	return s;

}
