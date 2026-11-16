// What use does to a plastic face. Each layer is compiled only when the
// preset asks for it.
//   scratches  straight marks on three scales: 20 um wide over cm, 6 um
//              over mm, 1.5 um over a tenth of a mm. They scatter light,
//              so they show pale on dark plastic and raise the roughness.
//   swirl      wiping marks: arcs of concentric hairlines (1 to 3 um)
//              around the centre of each wiping stroke, 5 to 10 cm across
//   dust       grains of 20 to 80 um and 3 to 10 um, pale, matte; a few
//              lint fibres (10 um thick, mm long)
//   scuffs     patches of short parallel scratches with a grey transfer
//   prints     fingerprints: grease ridges 0.45 mm apart in ovals of 15 mm
// W: { color, slope, cavity, rough, s2 } from solid.js, returned updated.
//
// The scuff marks sit in a gate() (core/lod.js): they run only inside
// their patches.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, abs, atan, sin, cos } from 'three/tsl';
import { fadeIn, gate } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { scratchMarks } from '../../core/marks.js';

// One family of concentric hairlines around centres on a grid of cellM.
// Each point sees the four nearest centres: arcs overlap, never end at a
// cell border.
function swirlLayer( p, fp, cellM, off ) {

	const q = p.div( cellM ).add( off );
	const b = floor( q.sub( 0.5 ) );
	const sp = float( 3.5e-5 ); // mean spacing of the hairlines
	const w = fadeIn( sp, fp, 2.0, 5.0 );
	let cov = float( 0 ), near = float( 0 ), radial = vec2( 0 );
	for ( let oy = 0; oy <= 1; oy ++ ) for ( let ox = 0; ox <= 1; ox ++ ) {

		const id = b.add( vec2( ox, oy ) );
		const h = hash3( id );
		const rel = q.sub( id.add( h.xy.mul( 0.5 ).add( 0.25 ) ) ).mul( cellM );
		const r = rel.length();
		const reach = smoothstep( cellM.mul( 1.1 ), cellM.mul( 0.5 ), r ).mul( smoothstep( 0.0, cellM.mul( 0.1 ), r ) );
		const k = floor( r.div( sp ) );
		// Hairlines come in bands of about eight (one pass of the cloth):
		// from afar a band reads as one hazy arc.
		const band = floor( k.div( 8 ) );
		const hb = hash3( vec2( band, id.x.add( id.y.mul( 17 ) ) ).add( off ) );
		const hk = hash3( vec2( k, id.x.add( id.y.mul( 17 ) ) ).add( off ) );
		const ang = atan( rel.y, rel.x );
		// Each band is an arc: on over part of the turn only.
		const arc = smoothstep( 0.5, 0.6, valueNoise( vec2( ang.mul( 2.5 ).add( hb.x.mul( 40 ) ), band.mul( 0.37 ) ) ) );
		const bandOn = step( hb.y, 0.12 ).mul( arc ).mul( reach );
		const on = step( hk.y, 0.7 ).mul( bandOn );
		const wHalf = hk.z.mul( 1.5e-6 ).add( 1e-6 );
		const dLine = abs( fract( r.div( sp ) ).sub( 0.5 ) ).mul( sp );
		const rEff = wHalf.max( fp );
		const n = clamp( rEff.sub( dLine ).div( fp ).add( 0.5 ), 0, 1 ).mul( wHalf.div( rEff ) ).mul( on );
		// Lines closer than a few pixels fade to their mean coverage: no moire.
		const mean = bandOn.mul( 0.7 ).mul( wHalf.mul( 2 ).div( sp ) ).mul( 1.2 ); // a band of hairlines scatters a little more than its area
		const c = mix( mean, n, w );
		radial = radial.add( rel.div( r.max( 1e-6 ) ).mul( n ).mul( w ) );
		near = near.max( n.mul( w ) ).toVar();
		cov = cov.max( c ).toVar();

	}

	return { cov, radial: radial.toVar(), near };

}

export function applyLife( W, p, fp, u ) {

	let { color, slope, cavity, rough, s2 } = W;
	const s = u.seed;
	let scatter = float( 0 ); // share of light thrown back white by marks and dust

	if ( u.scratches.value > 0 ) {

		const a = scratchMarks( p, fp, float( 0.03 ), float( 1e-5 ), s.add( 1.7 ), { density: u.scratches.mul( 0.5 ) } );
		const b = scratchMarks( p, fp, float( 0.004 ), float( 3e-6 ), s.add( 9.3 ), { density: u.scratches.mul( 0.4 ) } );
		const c = scratchMarks( p, fp, float( 4e-4 ), float( 0.8e-6 ), s.add( 4.1 ), { density: u.scratches.mul( 0.3 ) } );
		const sc = a.cov.max( b.cov.mul( 0.8 ) ).max( c.cov.mul( 0.6 ) );
		scatter = scatter.max( sc );
		slope = slope.add( a.slope ).add( b.slope.mul( 0.6 ) ).add( c.slope.mul( 0.4 ) );
		rough = rough.add( sc.mul( 0.35 ) );
		cavity = cavity.max( sc.mul( 0.4 ) );

	}

	if ( u.swirl.value > 0 ) {

		const A = swirlLayer( p, fp, float( 0.07 ), s.add( 2.3 ) );
		const B = swirlLayer( p, fp, float( 0.09 ), s.add( 15.1 ) );
		const sw = A.cov.max( B.cov ).mul( u.swirl );
		scatter = scatter.max( sw );
		slope = slope.add( A.radial.add( B.radial ).mul( 0.2 ).mul( u.swirl ) );
		rough = rough.add( sw.mul( 0.25 ) );

	}

	if ( u.scuffs.value > 0 ) {

		// Patches where something hard rubbed in one direction.
		const patch = smoothstep( 0.55, 0.75, valueNoise( p.div( 0.035 ).add( s.mul( 6 ) ) ).add( valueNoise( p.div( 0.008 ) ).sub( 0.5 ).mul( 0.3 ) ) ).mul( u.scuffs ).toVar();
		// Skipped outside the patches: with a zero density no mark is drawn.
		const M = gate( patch.greaterThan( 0 ), { sc: 0, slope: [ 0, 0 ] }, () => {

			const a = scratchMarks( p, fp, float( 0.002 ), float( 8e-6 ), s.add( 5.5 ), { angle: 0.4, spread: 0.12, length: 0.7, density: patch } );
			const b = scratchMarks( p, fp, float( 3e-4 ), float( 2e-6 ), s.add( 8.8 ), { angle: 0.4, spread: 0.15, length: 0.8, density: patch } );
			return { sc: a.cov.max( b.cov.mul( 0.7 ) ), slope: a.slope };

		}, [ p, fp, patch ] );
		const sc = M.sc;
		color = mix( color, vec3( 0.35, 0.34, 0.33 ).mul( color.add( 0.3 ) ), patch.mul( 0.25 ) );
		scatter = scatter.max( sc.mul( 0.8 ) );
		slope = slope.add( M.slope.mul( 0.5 ) );
		rough = rough.add( patch.mul( 0.2 ) ).add( sc.mul( 0.2 ) );

	}

	if ( u.prints.value > 0 ) {

		// Fingerprints: ridges 0.45 mm apart in an oval of 12 x 16 mm, left
		// in grease. Grease fills a matte texture (shinier) and hazes a
		// glossy one (duller): roughness goes toward 0.35 either way.
		const q = p.div( 0.06 ).add( s.mul( 1.9 ) );
		const id = floor( q );
		const h = hash3( id.add( 4.2 ) );
		const ang = h.z.mul( 6.28 );
		const rel0 = fract( q ).sub( h.xy.mul( 0.4 ).add( 0.3 ) ).mul( 0.06 );
		const rel = vec2( rel0.x.mul( cos( ang ) ).add( rel0.y.mul( sin( ang ) ) ), rel0.y.mul( cos( ang ) ).sub( rel0.x.mul( sin( ang ) ) ) );
		const e = vec2( rel.x.div( 0.006 ), rel.y.div( 0.008 ) ).length();
		const warp = valueNoise( rel.div( 0.003 ).add( id ) ).mul( 1.5 ).add( valueNoise( rel.div( 0.0009 ) ).mul( 0.4 ) );
		const ridge = smoothstep( 0.3, 0.7, sin( e.mul( 0.007 / 0.00045 * Math.PI * 2 ).add( warp.mul( 6.28 ) ) ).mul( 0.5 ).add( 0.5 ) );
		const blob = smoothstep( 1.0, 0.6, e.add( valueNoise( rel.div( 0.004 ) ).sub( 0.5 ).mul( 0.5 ) ) ).mul( step( h.x, u.prints ) );
		const wR = fadeIn( float( 4.5e-4 ), fp, 2.0, 6.0 );
		const grease = blob.mul( mix( float( 0.5 ), ridge, wR ) );
		rough = mix( rough, float( 0.35 ), grease.mul( 0.8 ) );
		color = color.mul( float( 1 ).sub( grease.mul( 0.06 ) ) );

	}

	if ( u.dust.value > 0 ) {

		// Grains: one candidate per cell, irregular outline.
		const grains = ( cellM, rMin, rMax, density, off ) => {

			const q = p.div( cellM ).add( off );
			const id = floor( q );
			const h = hash3( id );
			const rel = fract( q ).sub( h.xy.mul( 0.6 ).add( 0.2 ) );
			const wob = valueNoise( rel.mul( 14 ).add( id.mul( 0.7 ) ) ).sub( 0.5 ).mul( 0.9 ).add( 1 ).mul( valueNoise( rel.mul( 40 ).add( 3.3 ) ).sub( 0.5 ).mul( 0.3 ).add( 1 ) );
			const R = h.z.mul( h.z ).mul( rMax - rMin ).add( rMin ).mul( wob ); // cells, most grains small
			const d = rel.length();
			const on = step( hash1( id.add( 2.2 ) ), density );
			const wG = fadeIn( cellM, fp, 2.0, 6.0 );
			const g = clamp( R.sub( d ).mul( cellM ).div( fp ).add( 0.5 ), 0, 1 ).mul( on );
			// Faded: the mean cover of the grains.
			return { cov: mix( density.mul( ( rMin + rMax ) ** 2 * 0.8 ), g, wG ), slope: rel.div( d.max( 1e-4 ) ).mul( g ).mul( smoothstep( R.mul( 0.4 ), R, d ) ).mul( - 0.8 ).mul( wG ) };

		};
		const big = grains( float( 6e-4 ), 0.02, 0.08, u.dust.mul( 0.2 ), s.add( 3.3 ) );
		const small = grains( float( 6e-5 ), 0.03, 0.09, u.dust.mul( 0.5 ), s.add( 7.7 ) );
		const lint = scratchMarks( p, fp, float( 0.012 ), float( 5e-6 ), s.add( 12.5 ), { length: 1.4, density: u.dust.mul( 0.25 ) } );
		const cover = big.cov.max( small.cov ).max( lint.cov.mul( 0.8 ) ).mul( smoothstep( 0.2, 0.7, valueNoise( p.div( 0.05 ).add( 4.4 ) ) ).mul( 0.6 ).add( 0.4 ) );
		const dh = hash3( floor( p.div( 6e-4 ) ).add( 1.9 ) );
		const dustCol = mix( vec3( 0.55, 0.53, 0.5 ), vec3( 0.36, 0.3, 0.24 ), dh.x ).mul( dh.y.mul( 0.5 ).add( 0.6 ) ); // mineral grey to fibre brown
		color = mix( color, dustCol, cover.min( 1 ).mul( 0.85 ) );
		slope = slope.mul( float( 1 ).sub( cover.mul( 0.5 ) ) ).add( big.slope.add( small.slope ).mul( 0.5 ) ).add( lint.slope );
		rough = mix( rough, float( 0.95 ), cover.min( 1 ) );

	}

	// Marks scatter light: they read pale over the colour, a little grey.
	color = mix( color, color.mul( 0.5 ).add( vec3( 0.4 ) ), scatter.mul( 0.8 ) );
	return { ...W, color, slope, cavity, rough: rough.min( 1 ), s2 };

}
