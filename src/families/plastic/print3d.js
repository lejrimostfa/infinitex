// FDM 3D print, a side wall. y is the print height, x along the layers.
//   L0 wobble  Z wobble: the lead screw pushes the layers in and out with a
//              period of wobbleM (about 8 mm): soft horizontal bands
//   L0 seam    each layer starts and ends at nearly the same place: a
//              vertical line of little blobs and gaps
//   L0 worn    a spot sanded through the two outer walls: the gyroid infill
//              shows (cell 6 mm, walls 0.45 mm), air pockets dark between
//   L1 layers  rounded beads of layerM (0.1 to 0.3 mm), each one its own
//              width and shade (flow never stays constant)
//   L2 nozzle  fine drag lines along each bead (10 to 20 um, from the
//              nozzle tip) and extrusion ripples across it (about 70 um)
// Returns { color, slope, cavity, rough, s2, aniso } for shader.js.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, abs, sin, cos, sqrt } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { scratchMarks } from '../../core/marks.js';

export function buildPrint( p, fp, u ) {

	const s = u.seed, x = p.x, y = p.y, L = u.layerM;
	const lid = floor( y.div( L ) );
	const lf = fract( y.div( L ) );
	const lh = hash3( vec2( lid, s ) );
	const w1 = fadeIn( L, fp, 2.0, 6.0 ).toVar();

	// Wobble: in and out with the screw, plus a slow drift.
	const wob = sin( y.div( u.wobbleM ).mul( Math.PI * 2 ) ).mul( 0.7 ).add( valueNoise( vec2( y.div( u.wobbleM.mul( 3 ) ), s ) ).sub( 0.5 ).mul( 0.8 ) );
	const sWob = cos( y.div( u.wobbleM ).mul( Math.PI * 2 ) ).mul( u.wobble ).mul( 0.03 );
	// Each bead: rounded, its own bulge.
	const b = lf.mul( 2 ).sub( 1 ).clamp( - 0.96, 0.96 );
	const bh = sqrt( float( 1 ).sub( b.mul( b ) ) );
	const flat = lh.x.mul( 0.25 ).add( 0.35 ); // bead aspect: flatter or rounder
	const sBead = b.div( bh ).negate().mul( flat ).clamp( - 1.6, 1.6 ).mul( smoothstep( 0.0, 1.5, lf.min( float( 1 ).sub( lf ) ).mul( L ).div( fp ) ) );

	// Seam: a column near x0, jittered layer to layer.
	const x0 = float( 0.105 ).add( hash1( vec2( s, 4.4 ) ).mul( 0.09 ) );
	const sx = x.sub( x0.add( lh.y.sub( 0.5 ).mul( 3e-4 ) ) );
	const blobR = lh.z.mul( 2.5e-4 ).add( 1.5e-4 );
	const blob = smoothstep( blobR, blobR.mul( 0.2 ), abs( sx ) ).mul( step( 0.3, lh.z ) ).mul( bh );
	const gap = smoothstep( 1.2e-4, 0.4e-4, abs( sx ) ).mul( step( lh.z, 0.3 ) );
	const sSeam = vec2( sx.sign().mul( blob ).mul( - 0.8 ), 0 ).mul( fadeIn( blobR, fp, 1.0, 3.0 ) );

	// Nozzle drag lines along x, extrusion ripples across.
	const dq = vec2( x.div( 0.002 ), y.div( 1.4e-5 ) ).add( s.mul( 7 ) ).mod( 4096 ); // mod: hashes stay exact
	const drag = valueNoise( dq ).add( valueNoise( dq.mul( vec2( 1, 2.3 ) ).add( 3.1 ) ).mul( 0.5 ) ).sub( 0.75 );
	const wD = fadeIn( float( 1.4e-5 ), fp, 2.0, 6.0 ).mul( w1 );
	const rq = x.div( 7e-5 ).add( valueNoise( vec2( x.div( 4e-4 ), lid ) ).mul( 1.5 ) );
	const wRp = fadeIn( float( 7e-5 ), fp, 2.0, 6.0 ).mul( w1 );
	const sNoz = vec2( cos( rq.mul( Math.PI * 2 ) ).mul( 0.04 ).mul( wRp ), drag.mul( 0.25 ).mul( wD ).mul( bh ) );

	let slope = vec2( 0, sWob ).add( vec2( 0, sBead ).mul( w1 ) ).add( sSeam ).add( sNoz );
	let color = u.color.mul( lh.x.sub( 0.5 ).mul( u.colorVar ).mul( w1 ).add( 1 ) )
		.mul( wob.mul( u.wobble ).mul( 0.06 ).add( 1 ) )
		.mul( mix( float( 1 ), bh.mul( 0.3 ).add( 0.7 ), w1 ) ) // groove between beads in shadow
		.mul( float( 1 ).sub( gap.mul( 0.6 ) ) ).mul( blob.mul( 0.08 ).add( 1 ) );
	let cavity = float( 1 ).sub( bh ).mul( w1 ).max( gap );
	let rough = u.roughness.add( drag.mul( 0.1 ).mul( wD ) );

	if ( u.infill.value > 0 ) {

		// The worn spot: sanded through the walls around a centre.
		const c = vec2( 0.2, 0.1 ).add( vec2( hash1( vec2( s, 8 ) ), hash1( vec2( s, 9 ) ) ).sub( 0.5 ).mul( 0.06 ) );
		const d = p.sub( c ).length().add( valueNoise( p.div( 0.008 ).add( 2.2 ) ).sub( 0.5 ).mul( 0.012 ) )
			.add( valueNoise( p.div( 0.0015 ).add( 6.6 ) ).sub( 0.5 ).mul( 0.002 ) );
		const R = float( 0.035 ).mul( u.infill );
		const sanded = clamp( R.add( 0.008 ).sub( d ).div( fp.max( 2e-4 ) ), 0, 1 ); // the beads are ground flat
		const through = clamp( R.sub( d ).div( fp ).add( 0.5 ), 0, 1 ); // walls gone
		// Gyroid infill cut by a plane 1 mm inside.
		const k = Math.PI * 2 / 0.006;
		const gx = x.mul( k ), gy = y.mul( k ), gz = float( 0.001 * k );
		const G = sin( gx ).mul( cos( gy ) ).add( sin( gy ).mul( cos( gz ) ) ).add( sin( gz ).mul( cos( gx ) ) );
		const gw = float( 0.24 ); // wall share
		const e = abs( G ).sub( gw );
		const solid = clamp( e.negate().div( fp.mul( k ).mul( 1.4 ) ).add( 0.5 ), 0, 1 );
		// Abrasion scratches on the ground surfaces.
		const sc = scratchMarks( p, fp, float( 0.0015 ), float( 6e-6 ), s.add( 2.9 ), { angle: 0.3, spread: 0.2, length: 1.2, density: sanded } );
		const groundCol = mix( u.color, u.color.mul( 0.6 ).add( 0.25 ), 0.35 ).mul( float( 1 ).sub( sc.cov.mul( 0.2 ) ).add( sc.cov.mul( 0.4 ) ) );
		const air = u.color.mul( 0.12 );
		const inner = mix( air, groundCol.mul( mix( float( 0.9 ), float( 1 ), bh ) ), solid );
		color = mix( color, groundCol, sanded );
		color = mix( color, inner, through );
		slope = mix( slope, slope.mul( 0.15 ).add( sc.slope ), sanded );
		rough = mix( rough, float( 0.75 ), sanded );
		cavity = mix( cavity, solid.oneMinus(), through );

	}

	// Far: the layer grooves become a stretched highlight along them.
	const aniso = vec2( 1, 0 ).mul( w1.oneMinus() ).mul( u.aniso );
	const s2 = w1.oneMinus().mul( 0.04 ).add( wD.oneMinus().mul( 0.01 ) );
	return { color, slope, cavity, rough, s2, aniso };

}
