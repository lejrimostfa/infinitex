// Fiber mat family: felt, boiled wool, paper, cardboard, papier-mache.
//   L0 formation and lumps: cloudy density, soft bumps; cardboard flutes
//      seen through the liner; papier-mache pieces with torn edges and print
//   L1 fibers: four layers of fibers laid at random, each layer combed in
//      its own direction and bent by a smooth warp; the top fiber of each
//      layer covers the ones below, the deep mat shows in between
// Coordinates in meters.

import { uv, vec2, vec3, float, floor, fract, clamp, smoothstep, step, sqrt, mix, sin, cos, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, fadeIn, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { applySurface } from '../../core/surface.js';

const LAYERS = 4;

// One layer of fibers. Cells are long along the layer's direction and a few
// fiber widths across, one fiber per cell, a 3 x 3 search. Returns the
// coverage of the top fiber, its slope (meters per meter) and a tone.
function fiberLayer( p, fp, u, k ) {

	const a = float( k * 0.83 + 0.4 ).add( u.seed.mul( 0.37 ) );
	const ca = cos( a ), sa = sin( a );
	const q = vec2( p.x.mul( ca ).add( p.y.mul( sa ) ), p.y.mul( ca ).sub( p.x.mul( sa ) ) );
	const cA = u.fiberL.mul( 0.8 ), cX = u.fiberW.mul( 5 ).div( u.density ).max( u.fiberL.mul( 0.02 ) );
	const x = vec2( q.x.div( cA ), q.y.div( cX ) ).add( k * 13.1 );
	const b = floor( x );
	let cov = float( 0 ), sl = vec2( 0 ), tone = float( 1 ), fid = float( 0 );
	const wScale = fadeIn( u.fiberW.mul( 0.4 ), fp, 2.0, 5.0 ).mul( u.scales );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = b.add( vec2( ox, oy ) );
		const h = hash3( id.add( k * 7.3 ) );
		const c = id.add( vec2( h.x, h.y.mul( 0.5 ).add( 0.25 ) ) );
		const wm = x.sub( c ).mul( vec2( cA, cX ) ); // meters, layer frame
		const tilt = h.z.sub( 0.5 ).mul( 1.8 );
		const dir = vec2( cA, tilt.mul( cX ) ).normalize();
		const perp = vec2( dir.y.negate(), dir.x );
		const half = hash1( id.add( 2.2 + k ) ).mul( 0.4 ).add( 0.35 ).mul( cA );
		const t = clamp( wm.dot( dir ), half.negate(), half );
		// Crimp: wool fibers wave along their length (paper fibers barely).
		// Wool crimp: 5 to 10 waves per cm, so a fiber looks gently bent at
		// 200 um, not wiggly.
		const lam = u.fiberL.mul( hash1( id.add( 4.4 + k ) ).mul( 0.25 ).add( 0.25 ) );
		const wave = sin( t.div( lam ).mul( Math.PI * 2 ).add( h.x.mul( 6.28 ) ) ).mul( lam.mul( u.curl ).mul( 0.12 ).min( cX.mul( 0.7 ) ) ); // the search reaches one cell across: keep the wave inside it
		const dv = wm.sub( dir.mul( t ) ).sub( perp.mul( wave ) );
		const d = dv.length();
		const r = u.fiberW.mul( 0.5 ).mul( hash1( id.add( 5.1 + k ) ).mul( 0.6 ).add( 0.7 ) );
		const rEff = r.max( fp );
		const cv = clamp( rEff.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( r.div( rEff ) );
		const s = clamp( dv.dot( perp ).div( rEff ), - 0.95, 0.95 );
		const sAcross = s.div( sqrt( float( 1 ).sub( s.mul( s ) ) ) ).negate().mul( u.flatten ).mul( 0.7 );
		// Cuticle scales of wool: a slow rise then a sharp step every
		// 0.4 fiber width, the step lines a little slanted and wavy.
		const sc = fract( t.div( u.fiberW.mul( 0.4 ) ).add( s.mul( 0.25 ) ).add( valueNoise( vec2( t.div( u.fiberW.mul( 0.6 ) ), h.y.mul( 50 ) ) ).mul( 0.5 ) ) );
		const step1 = smoothstep( 0.82, 1.0, sc );
		const sAlong = float( 0.25 ).sub( step1.mul( 1.4 ) ).mul( wScale );
		const slope = perp.mul( sAcross ).add( dir.mul( sAlong ) );
		const scaleLine = step1.mul( wScale );
		const win = step( cov, cv );
		cov = cov.max( cv ).toVar();
		sl = mix( sl, slope, win ).toVar();
		tone = mix( tone, h.z.sub( scaleLine.mul( 0.35 ) ), win ).toVar();
		fid = mix( fid, hash1( id.add( 9.9 + k ) ), win ).toVar();

	}

	// Back to the surface frame: rotate by the layer angle.
	return { cov, slope: vec2( sl.x.mul( ca ).sub( sl.y.mul( sa ) ), sl.x.mul( sa ).add( sl.y.mul( ca ) ) ), tone, fid };

}

export function buildFibermatNodes( u, opts = {} ) {

	const p0 = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p0 ).toVar( 'ix_fp' );
	// Fibers bend: a smooth warp over about a fiber length.
	const wq = p0.div( u.fiberL.mul( 1.3 ) );
	const wq2 = p0.div( u.fiberL.mul( 0.35 ) ).add( 9.1 );
	const p = p0.add( vec2( valueNoise( wq ), valueNoise( wq.add( 3.7 ) ) ).sub( 0.5 ).mul( u.fiberL ).mul( u.curl ).mul( 0.9 ) )
		.add( vec2( valueNoise( wq2 ), valueNoise( wq2.add( 2.9 ) ) ).sub( 0.5 ).mul( u.fiberL ).mul( u.curl ).mul( 0.2 ) ).toVar();

	// L0 formation: cloudy density on two scales.
	const fq = p0.div( u.formationM );
	const form = valueNoise( fq ).mul( 0.65 ).add( valueNoise( fq.mul( 2.7 ).add( 1.3 ) ).mul( 0.35 ) );
	// Lumps: a soft height field, slope by finite differences.
	const lq = p0.div( u.lumpsM );
	const e = 0.08;
	const l0 = valueNoise( lq ), lx = valueNoise( lq.add( vec2( e, 0 ) ) ), ly = valueNoise( lq.add( vec2( 0, e ) ) );
	const wL = fadeIn( u.lumpsM, fp, 1.0, 4.0 );
	const sLump = vec2( lx.sub( l0 ), ly.sub( l0 ) ).div( e ).mul( u.lumps ).mul( 0.25 ).mul( wL );
	// Flutes of corrugated board under the liner.
	const fluteOn = step( 1e-5, u.fluteM );
	const fl = p0.x.div( u.fluteM.max( 1e-5 ) ).mul( Math.PI * 2 );
	const wF = fadeIn( u.fluteM.max( 1e-5 ), fp, 1.0, 4.0 ).mul( fluteOn );
	const sFlute = vec2( cos( fl ).mul( u.fluteDepth ).mul( 0.35 ).mul( wF ), 0 );
	const fluteShade = mix( float( 1 ), sin( fl ).mul( 0.12 ).add( 0.94 ), wF.mul( u.fluteDepth ) );

	// Papier-mache: torn pieces, each its own paper tone, some printed.
	// Torn pieces: the cell borders wander (large warp) and fray (fine warp).
	const pq = p0.div( u.patchM );
	const pw = pq.add( vec2( valueNoise( pq.mul( 1.3 ) ), valueNoise( pq.mul( 1.3 ).add( 5.5 ) ) ).sub( 0.5 ).mul( 0.7 ) )
		.add( vec2( valueNoise( pq.mul( 14 ) ), valueNoise( pq.mul( 14 ).add( 2.1 ) ) ).sub( 0.5 ).mul( 0.06 ) );
	const pv = voronoi( pw.add( u.seed.mul( 2.3 ) ), 0.9 );
	const patchOn = step( 0.001, u.patches );
	const ph = hash3( pv.id1.add( 3.3 ) );
	const patchTone = mix( float( 1 ), ph.x.mul( 0.35 ).add( 0.7 ), patchOn );
	const rim = float( 1 ).sub( smoothstep( 0.0, 1.0, pv.edge.mul( u.patchM ).div( u.fiberL.mul( 0.4 ) ) ) ).mul( patchOn ); // torn white rim
	const wP = fadeIn( u.patchM, fp, 1.0, 4.0 ).mul( patchOn );
	const sPatch = pv.dir.mul( rim.mul( 0.15 ) ).mul( wP );
	// Print: rows of letters in some pieces, turned with the piece.
	const pa = ph.y.mul( Math.PI );
	const pr = vec2( p0.x.mul( cos( pa ) ).add( p0.y.mul( sin( pa ) ) ), p0.y.mul( cos( pa ) ).sub( p0.x.mul( sin( pa ) ) ) );
	const lineH = float( 1.3e-3 );
	const row = floor( pr.y.div( lineH ) );
	const inRow = step( fract( pr.y.div( lineH ) ), 0.42 );
	const ch = floor( pr.x.div( 3e-4 ) );
	const gap = step( fract( pr.x.div( 3e-4 ) ), 0.72 ).mul( step( 0.12, fract( pr.y.div( lineH ) ) ) );
	const word = step( 0.18, hash1( vec2( floor( pr.x.div( 2.1e-3 ) ), row.add( 77 ) ) ) );
	const letter = step( 0.3, hash1( vec2( ch, row ) ) ).mul( inRow ).mul( word ).mul( gap );
	const wInk = fadeIn( float( 3e-4 ), fp, 1.0, 3.0 );
	const printed = step( ph.z, u.print ).mul( patchOn ).mul( float( 1 ).sub( rim ) );
	const ink = printed.mul( mix( float( 0.18 ), letter.mul( 0.85 ), wInk ) );

	// L1 fibers, four layers, the last on top.
	const wFib = fadeIn( u.fiberW.mul( 5 ), fp, 1.5, 5.0 ).toVar();
	const meanCol = mix( u.color, u.color2, 0.35 );
	let col = meanCol.mul( 0.55 ); // the deep mat between the top fibers
	let slope = vec2( 0 );
	for ( let k = 0; k < LAYERS; k ++ ) {

		const L = fiberLayer( p, fp, u, k );
		const fc = mix( u.color, u.color2, step( L.fid, 0.35 ) ).mul( L.tone.sub( 0.5 ).mul( u.colorVar ).add( 1 ) ).mul( 0.8 + 0.07 * k );
		col = mix( col, fc, L.cov );
		slope = mix( slope, L.slope, L.cov );

	}

	// Thermo-bonded synthetic felt: fused drops where fibers met, smooth
	// and a little glossy, laid over the fibers.
	const bCell = u.fiberW.mul( 9 );
	const bq = p0.div( bCell ).add( 3.3 );
	const bc = floor( bq );
	let bond = float( 0 ), bSlope = vec2( 0 );
	for ( let oy = 0; oy <= 1; oy ++ ) for ( let ox = 0; ox <= 1; ox ++ ) {

		const id = floor( bq.sub( 0.5 ) ).add( vec2( ox, oy ) );
		const bh = hash3( id.add( 41.0 ) );
		const R = u.fiberW.mul( bh.z.mul( 1.8 ).add( 1.4 ) );
		const wv = bq.sub( id.add( bh.xy.mul( 0.4 ).add( 0.3 ) ) ).mul( bCell );
		const dd = wv.length();
		const on = step( hash1( id.add( 8.8 ) ), u.bonds );
		const bcov = clamp( R.sub( dd ).div( fp ).add( 0.5 ), 0, 1 ).mul( on ).mul( R.div( R.max( fp ) ) );
		const rr = dd.div( R ).clamp( 0, 0.95 );
		const bs = wv.normalize().mul( rr.div( sqrt( float( 1 ).sub( rr.mul( rr ) ) ) ).negate().mul( 0.22 ) ); // flattened drops
		bSlope = mix( bSlope, bs, bcov ).toVar();
		bond = bond.max( bcov ).toVar();

	}

	bond = bond.mul( step( 0.001, u.bonds ) );
	col = mix( col, meanCol.mul( 1.08 ), bond );
	slope = mix( slope, bSlope, bond );

	const fibers = mix( meanCol.mul( 0.85 ), col, wFib );
	let color = mix( meanCol.mul( 0.85 ), fibers, u.contrast.min( 1 ) );
	color = color.mul( form.sub( 0.5 ).mul( u.formation ).mul( 0.6 ).add( 1 ) ).mul( fluteShade ).mul( patchTone );
	color = mix( color, vec3( 0.93, 0.91, 0.86 ), rim.mul( 0.7 ).mul( wP ) );
	color = mix( color, vec3( 0.06 ), ink );

	// Boiled wool: the knit it was made from, shrunk and felted. Rows of
	// V stitches survive as soft chevron ridges under the fibers.
	const kw = vec2( valueNoise( p0.div( u.knitM.mul( 3 ) ) ), valueNoise( p0.div( u.knitM.mul( 3 ) ).add( 4.2 ) ) ).sub( 0.5 ).mul( 0.5 ); // shrunk unevenly
	const kx = p0.x.div( u.knitM ).add( kw.x ), ky = p0.y.div( u.knitM.mul( 0.8 ) ).add( kw.y );
	const fxk = fract( kx ).sub( 0.5 );
	const yk = ky.add( fxk.abs().mul( 0.9 ) );
	const band = fract( yk );
	const wK = fadeIn( u.knitM, fp, 1.0, 4.0 ).mul( u.knitGhost );
	const kh = sin( band.mul( Math.PI ) );
	const dk = cos( band.mul( Math.PI ) ).mul( Math.PI ).mul( 0.05 ); // dh / d(yk)
	const sKnit = vec2( dk.mul( fxk.sign() ).mul( 0.9 ).div( 0.8 ).mul( 0.8 ), dk ).mul( wK );
	color = color.mul( mix( float( 1 ), kh.mul( 0.1 ).add( 0.92 ), wK ) );

	const sFib = slope.mul( wFib ).mul( u.contrast ).add( sKnit );
	const total = sFib.add( sLump ).add( sFlute ).add( sPatch );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, total, tangentView, bitangentView ).toVar( 'ix_normal' );

	const s2 = float( 1 ).sub( wFib ).mul( 0.04 ).mul( u.contrast ).mul( u.flatten.add( 0.3 ) );
	const roughnessNode = specularAA( composeRoughness( mix( u.roughness, float( 0.32 ), bond.mul( wFib ) ), s2 ), normalNode );
	const nodes = {
		colorNode: color, normalNode, roughnessNode, metalnessNode: float( 0 ),
		sheenNode: meanCol.mul( u.sheenAmt ), sheenRoughnessNode: float( 0.6 ),
	};
	const cavity = float( 1 ).sub( l0 ).mul( 0.5 ).mul( u.lumps ).add( float( 1 ).sub( sin( fl ).mul( 0.5 ).add( 0.5 ) ).mul( 0.4 ).mul( wF ) );
	applySurface( nodes, u.surface, { cavity, flatNormal: base, porosity: 1 } );
	nodes.debug = { fp, w1: wFib, w2: wL, w3: wP, covered: float( 1 ) };
	return nodes;

}
