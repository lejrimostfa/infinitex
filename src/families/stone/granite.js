// Granite: a magma that cooled slowly, so its minerals grew into each other.
//   L0 crystals  feldspar crystals 3 to 10 mm (pink K-feldspar, milky
//                plagioclase) with clusters of smaller quartz and mica
//                grains filling the gaps between them
//   L1 inside    plagioclase twin stripes (0.1 to 0.3 mm), pink perthite
//                streaks, growth zoning, cleavage cracks every 0.3 to 1 mm;
//                quartz glassy grey with healed fractures; mica black flakes,
//                each one a small mirror at its own tilt, so it flashes
//   L2 micro     fluid inclusion trails in quartz (5 um bubbles), stacked
//                sheets of mica (15 um), polishing scratches (1 to 2 um)
// polish 1: mirror polish, colours deep. polish 0: flamed, the torch
// spalls the quartz, frosts the feldspar white and leaves a rough relief.
// colour = K-feldspar, color2 = plagioclase, color3 = quartz, color4 = mica.

import { vec2, float, floor, fract, mix, smoothstep, step, clamp, sin, mod } from 'three/tsl';
import { fadeIn, pick, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, lines, scratches, fbm } from './common.js';
import { crystals } from './crystals.js';

export function buildGranite( p, fp, u ) {

	const g = u.grainM, s = u.seed;
	// Crystal faces are straight (box metric in each crystal's frame); a
	// small warp only roughens them.
	const wq2 = p.div( g.mul( 0.3 ) ).add( s.mul( 2 ) );
	const warp = vec2( valueNoise( wq2 ), valueNoise( wq2.add( 3.3 ) ) ).sub( 0.5 ).mul( g ).mul( 0.05 );
	const pw = p.add( warp ).toVar();
	const C = crystals( pw.div( g ).add( s.mul( 3.1 ) ), { elong: 1.2, size: 0.4, square: 0.8 } );
	const hc = hash3( C.id1.add( 1.7 ) ).toVar();
	const micaCl = step( hc.x, u.mica ); // a mica cluster
	const qCl = step( hc.x, u.mica.add( u.quartz ) ).sub( micaCl ); // a quartz cluster
	const feld = float( 1 ).sub( micaCl ).sub( qCl ).toVar();

	// Clusters split into grains: quartz in thirds, mica in small flakes;
	// stray mica flakes sit in the quartz too.
	const f = g.mul( 0.33 );
	const fq = pw.div( f ).add( s.mul( 5.3 ).add( 11 ) );
	const F = crystals( fq.add( vec2( valueNoise( fq.mul( 1.7 ) ), valueNoise( fq.mul( 1.7 ).add( 5 ) ) ).sub( 0.5 ).mul( 0.4 ) ), { elong: 0.4, size: 0.35, square: 0.5 } );
	const hf = hash3( F.id1.add( 2.9 ) ).toVar();
	const M = crystals( pw.div( g.mul( 0.13 ) ).add( 4.4 ), { elong: 0.8, size: 0.3, square: 0.7 } );
	const hm = hash3( M.id1.add( 8.1 ) ).toVar();
	const micaG = pick( micaCl, step( 0.45, hm.x ), step( hm.x, 0.1 ) ).mul( feld.oneMinus() ).toVar();
	const qtz = feld.oneMinus().sub( micaG ).toVar();
	const pinkK = step( hc.y, u.pink ).mul( feld ).toVar();

	// Feldspar: tone per crystal, twins, perthite, zoning, cleavage.
	// The crystal's own frame: twins and cleavage run along its length.
	const ax = dir2( hc.z.mul( 3.1416 ) ), ay = vec2( ax.y.negate(), ax.x );
	const tx = C.loc.x.mul( g ), ty = C.loc.y.mul( g );
	const tw = hash1( C.id1.add( 5.5 ) ).mul( 1.5e-4 ).add( 8e-5 ); // twin spacing
	const twin = smoothstep( 0.35, 0.65, fract( ty.div( tw ).add( valueNoise( vec2( tx.div( 2e-3 ), hc.x.mul( 50 ) ) ).mul( 0.6 ) ) ) )
		.mul( fadeIn( tw, fp, 3.0, 8.0 ) ).mul( feld.sub( pinkK ) );
	const perth = smoothstep( 0.62, 0.8, valueNoise( vec2( tx.div( 6e-4 ), ty.div( 6e-5 ) ).add( hc.xy.mul( 40 ) ) ) ).mul( fadeIn( float( 6e-5 ), fp, 2.0, 5.0 ) ).mul( pinkK );
	const zone = sin( C.d1.mul( g ).div( 2.5e-4 ) ).mul( 0.5 ).add( 0.5 ).mul( fadeIn( float( 1.5e-3 ), fp, 2.0, 6.0 ) );
	const clv = lines( tx.add( valueNoise( vec2( ty.div( 1e-3 ), 3.3 ) ).mul( 2e-4 ) ), hash1( C.id1 ).mul( 5e-4 ).add( 3e-4 ), 2.5e-6, fp )
		.mul( smoothstep( 0.45, 0.6, valueNoise( p.div( 7e-4 ).add( hc.xy.mul( 30 ) ) ) ) ).mul( feld );
	const fTone = hc.y.mul( 0.45 ).add( 0.78 ).mul( valueNoise( p.div( g.mul( 0.4 ) ).add( hc.xy.mul( 9 ) ) ).mul( u.colorVar ).add( float( 1 ).sub( u.colorVar.mul( 0.5 ) ) ) );
	// Alteration: clouds of clay and sericite dust inside the feldspar.
	const alter = fbm( p.add( hc.xy ), g.mul( 0.25 ), fp, 4, 8 );
	const D = voronoi( mod( p.div( 3e-5 ), 4096 ).add( 1.3 ), 0.9 );
	const dust = smoothstep( 0.32, 0.22, D.toSeed.length() ).mul( step( 0.6, hash1( D.id1 ).add( alter.sub( 0.5 ) ) ) ).mul( fadeIn( float( 1e-5 ), fp, 1.5, 4.0 ) ).mul( feld );
	let fCol = mix( u.color2, u.color, pinkK ).mul( fTone ).mul( zone.mul( 0.06 ).add( 0.97 ) ).mul( alter.sub( 0.5 ).mul( 0.5 ).add( 1 ) );
	fCol = fCol.mul( float( 1 ).sub( dust.mul( 0.25 ) ) );
	// Inclusions: small mica flakes and apatite needles caught as the
	// feldspar grew, 50 to 200 um.
	const IV = voronoi( mod( p.div( 6e-4 ), 4096 ).add( 7.7 ), 0.8 );
	const ih2 = hash3( IV.id1.add( 3.1 ) );
	const il = IV.toSeed.mul( 6e-4 );
	const ia = dir2( ih2.x.mul( 6.28 ) );
	const isz = ih2.y.mul( 1.2e-4 ).add( 4e-5 );
	const inc = band( vec2( il.dot( ia ).div( 3 ), il.dot( vec2( ia.y.negate(), ia.x ) ) ).length(), isz.mul( 0.3 ), fp )
		.mul( step( 0.82, ih2.z ) ).mul( fadeIn( isz, fp, 1.5, 4.0 ) ).mul( feld );
	fCol = mix( fCol, u.color4.mul( 1.5 ), inc.mul( 0.85 ) );
	fCol = mix( fCol, fCol.mul( 1.12 ).add( 0.03 ), twin.mul( 0.5 ).add( perth.mul( 0.7 ) ) );

	// Quartz: smoky glass, darker where thick, healed fractures, bubbles.
	const qDepth = fbm( p.add( hf.yz.mul( 0.05 ) ), g.mul( 0.25 ), fp, 4, 4 ); // each grain its own depth
	const qw = p.div( 3e-4 ).add( 2.2 );
	const QF = voronoi( qw.add( vec2( valueNoise( qw.mul( 0.6 ) ), valueNoise( qw.mul( 0.6 ).add( 9 ) ) ).sub( 0.5 ).mul( 1.2 ) ), 0.9 );
	const qCrack = band( QF.edge.mul( 3e-4 ), 2e-6, fp ).mul( fadeIn( float( 3e-4 ), fp, 3.0, 8.0 ) ).mul( step( 0.55, hash1( QF.id1.add( QF.id2 ) ) ) ).mul( qtz );
	const iq = mod( p.div( 2.5e-5 ), 4096 );
	const ih = hash3( floor( iq ).add( 0.5 ) );
	const trail = smoothstep( 0.6, 0.75, valueNoise( vec2( p.dot( ax ).div( 4e-5 ), p.dot( ay ).div( 4e-4 ) ).add( 9 ) ) );
	const incl = smoothstep( 0.32, 0.18, fract( iq ).sub( ih.xy.mul( 0.4 ).add( 0.3 ) ).length() ).mul( trail ).mul( fadeIn( float( 5e-6 ), fp, 1.5, 4.0 ) ).mul( qtz );
	const qCol = u.color3.mul( qDepth.mul( 1.0 ).add( 0.45 ) ).mul( hf.y.mul( 0.6 ).add( 0.65 ) );

	// Mica: black flakes, a book of sheets, each flake a tilted mirror.
	const sheets = lines( p.dot( dir2( hm.z.mul( 6.28 ) ) ), 1.5e-5, 1.5e-6, fp ).mul( micaG );
	const mCol = u.color4.mul( hm.y.mul( 0.9 ).add( 0.6 ) ).mul( float( 1 ).add( sheets.mul( 0.8 ) ) );

	let color = fCol.mul( feld ).add( qCol.mul( qtz ) ).add( mCol.mul( micaG ) );
	// Grain borders: thin dark seams, wider between clusters and feldspar.
	const wB = fadeIn( f, fp, 2.0, 6.0 );
	const bC = band( C.gap.mul( g ).mul( 0.5 ), 1.2e-5, fp );
	const bF = band( F.gap.mul( f ).mul( 0.5 ), 5e-6, fp ).mul( qtz ).mul( 0.8 )
		.max( band( M.gap.mul( g ).mul( 0.08 ), 3e-6, fp ).mul( micaG ) );
	const border = bC.max( bF ).mul( wB ).toVar();
	color = color.mul( float( 1 ).sub( border.mul( 0.55 ) ) ).mul( float( 1 ).sub( clv.mul( 0.45 ) ) ).mul( float( 1 ).sub( incl.mul( 0.5 ) ) );
	color = mix( color, color.mul( 1.4 ).add( 0.05 ), qCrack.mul( 0.6 ) );

	// Finish. Flamed: feldspar frosted white, quartz spalled into pits.
	const flame = u.polish.oneMinus();
	color = mix( color, color.mul( 0.6 ).add( 0.3 ), flame.mul( feld.add( qtz.mul( 0.6 ) ) ).mul( 0.45 ) );
	color = mix( color, color.mul( color ).mul( 1.35 ).min( color ), u.polish.mul( 0.4 ) ); // polish deepens
	const sp = voronoi( p.div( 6e-4 ).add( s.mul( 2.2 ) ), 0.9 );
	const wSp = fadeIn( float( 6e-4 ), fp, 2.0, 6.0 );
	const spall = smoothstep( 0.0, 0.25, sp.edge ).mul( hash1( sp.id1 ).mul( 0.7 ).add( 0.3 ) );
	const height = spall.mul( 4e-5 ).mul( flame ).mul( feld.add( qtz ) ).add( qtz.mul( 6e-7 ) ).sub( border.mul( 1e-6 ) );
	const tilt = hm.yz.sub( 0.5 ).mul( mix( float( 0.5 ), float( 0.12 ), u.polish ) ).mul( micaG ).mul( wB );
	const slope = surfaceGradient( height, p ).mul( wSp.mul( 0.8 ).add( 0.2 ) ).add( tilt ).add( sp.toSeed.mul( - 0.15 ).mul( flame ).mul( wSp ) );

	// Polishing scratches: faint hairlines seen only very close.
	const scr = scratches( p, fp, float( 1.2e-4 ), 8e-7, u.polish.mul( 0.35 ), 1 ).add( scratches( p, fp, float( 4e-4 ), 1.2e-6, u.polish.mul( 0.2 ), 2 ) ).min( 1 );
	color = color.mul( float( 1 ).add( scr.mul( 0.25 ) ) );

	const roughF = mix( float( 0.78 ), float( 0.07 ), u.polish );
	const roughQ = mix( float( 0.45 ), float( 0.05 ), u.polish );
	const roughM = mix( float( 0.3 ), float( 0.12 ), u.polish );
	const rough = roughF.mul( feld ).add( roughQ.mul( qtz ) ).add( roughM.mul( micaG ) ).add( scr.mul( 0.15 ) ).mul( u.roughness.div( 0.7 ) ).clamp( 0.03, 1 );
	const s2 = flame.mul( wSp.oneMinus().mul( 0.04 ) ).add( micaG.mul( wB.oneMinus() ).mul( 0.02 ) );
	const cavity = border.max( qCrack ).max( flame.mul( smoothstep( 0.2, 0.0, sp.edge ) ).mul( 0.6 ) );
	return { color: clamp( color, 0, 1 ), slope, cavity, rough, s2 };

}
