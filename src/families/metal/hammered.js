// Metal mode `hammered`: worked copper alloys and gold, every level faded
// by its pixel size.
//   L0 alloy:     reflectance colour (F0), tarnish film in broad patches
//   L1 hammer:    round craters packed side by side, soft ridges between
//   L2 patina:    verdigris or rust crust in the hollows, granular, pitted
//   L3 scratches: long ones and fine ones; they raise the roughness and
//                 show brighter fresh metal
//   L4 grains:    the crystals of the metal, each with its own sheen
// Metal parts are metallic (colour = reflectance), the patina is not.

import { vec2, vec3, float, floor, clamp, smoothstep, step, mix } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { marks } from './scratch.js';

export function buildHammered( p, fp, u, opts ) {

	// L1 hammer marks: round craters packed side by side, as an artisan's
	// hammer leaves them. Each Voronoi seed is a crater of its own radius;
	// a bowl profile (1 - r^2 / R^2)^2, zero slope at the centre and at the
	// rim, so the walls catch the light and nothing is faceted. The two
	// nearest craters are blended with a smooth min, which leaves thin soft
	// ridges where they meet.
	const hv = voronoi( p.div( u.hammerM ).add( u.seed.mul( 3.1 ) ), 0.75 );
	const wH = fadeIn( u.hammerM, fp, 2.0, 6.0 ).toVar();
	const crater = ( id, x ) => {

		const R = hash1( id.add( 5.5 ) ).mul( 0.2 ).add( 0.5 ); // radius, cells
		const t = float( 1 ).sub( x.dot( x ).div( R.mul( R ) ) ).max( 0 );
		const D = u.hammerDepth.mul( 0.12 );
		return { h: D.mul( t ).mul( t ).negate(), g: x.mul( D.mul( 4 ).mul( t ).div( R.mul( R ) ) ) }; // height (cells), slope

	};
	const c1 = crater( hv.id1, hv.toSeed );
	const c2 = crater( hv.id2, hv.toSeed.add( hv.p1 ).sub( hv.p2 ) );
	// Smooth min of the two heights (k in cell units).
	const k = 0.02;
	const hd = c1.h.sub( c2.h );
	const mixW = clamp( hd.div( k ).mul( 0.5 ).add( 0.5 ), 0, 1 ); // 1: crater 2 is deeper here
	const sH = mix( c1.g, c2.g, mixW ).mul( wH );
	const dentLow = mix( c1.h, c2.h, mixW ).div( u.hammerDepth.mul( 0.12 ).max( 1e-4 ) ).negate().clamp( 0, 1 ).mul( wH ).toVar(); // 1 deep in a crater

	// L0 tarnish, broad patches.
	const tn = valueNoise( p.div( 0.03 ) ).mul( 0.6 ).add( valueNoise( p.div( 0.008 ).add( 5.1 ) ).mul( 0.4 ) );
	const tarn = smoothstep( 0.3, 0.8, tn ).mul( u.tarnish ).toVar();

	// L2 patina: grows in patches and in the dents, with a crusty edge.
	const pn = valueNoise( p.div( 0.015 ).add( 11.3 ) ).mul( 0.7 ).add( dentLow.mul( 0.3 ) ).add( opts.cavity ?? 0 )
		.add( valueNoise( p.div( 0.002 ).add( 2.2 ) ).sub( 0.5 ).mul( 0.25 ) );
	const lo = float( 1 ).sub( u.patina );
	const pat = smoothstep( lo, lo.add( 0.12 ), pn ).mul( step( 0.001, u.patina ) ).toVar();
	const cq = p.div( 4e-4 );
	const crust = vec2( valueNoise( cq ), valueNoise( cq.add( 3.3 ) ) ).sub( 0.5 )
		.add( vec2( valueNoise( cq.mul( 3.7 ) ), valueNoise( cq.mul( 3.7 ).add( 8.8 ) ) ).sub( 0.5 ).mul( 0.6 ) );
	const wCr = fadeIn( 4e-4, fp, 2.0, 6.0 );
	const sCrust = crust.mul( 0.9 ).mul( wCr ).mul( pat );
	// Corrosion pits in the crust.
	const q = p.div( 3e-4 ).add( 17.1 );
	const qc = floor( q );
	const qh = hash3( qc );
	const qv = q.sub( qc.add( 0.5 ).add( qh.xy.sub( 0.5 ).mul( 0.6 ) ) );
	const pr = qh.z.mul( 0.1 ).add( 0.08 );
	const pit = step( qv.dot( qv ), pr.mul( pr ) ).mul( step( qh.z, u.pitting ) ).mul( fadeIn( 3e-4, fp, 2.0, 6.0 ) ).toVar();

	// L3 scratches: many, in every direction, on three scales, denser
	// where the metal was rubbed most.
	const sc1 = marks( p, fp, u.scratchM.mul( 0.5 ), float( 12e-6 ), 1.7 );
	const sc2 = marks( p, fp, u.scratchM.mul( 0.18 ), float( 6e-6 ), 9.3 );
	const sc3 = marks( p, fp, u.scratchM.mul( 0.06 ), float( 2.5e-6 ), 4.1 );
	const rub = smoothstep( 0.35, 0.75, valueNoise( p.div( 0.012 ).add( 2.9 ) ) ).toVar(); // rubbed, polished patches
	const scratch = sc1.max( sc2.mul( 0.8 ) ).max( sc3.mul( 0.6 ).mul( rub.mul( 0.7 ).add( 0.3 ) ) )
		.mul( u.scratches ).mul( float( 1 ).sub( pat ) ).toVar();

	// L4 crystal grains.
	const gv = voronoi( p.div( u.grainM ).add( 4.4 ) );
	const wG = fadeIn( u.grainM, fp, 2.0, 6.0 ).toVar();
	const gh = hash3( gv.id1 );
	const sG = gh.xy.sub( 0.5 ).mul( 0.025 ).mul( wG ).mul( float( 1 ).sub( pat ) );
	const boundary = float( 1 ).sub( smoothstep( 0.0, 1.5, gv.edge.mul( u.grainM ).div( fp ) ) ).mul( wG ).mul( float( 1 ).sub( pat ) );

	// Colour: metal reflectance, or patina albedo.
	const mapTint = opts.stitchColor ? opts.stitchColor.here.div( opts.stitchColor.here.dot( vec3( 0.33 ) ).max( 0.02 ) ).mul( 0.33 ) : vec3( 1 );
	const metal = u.f0.mul( mix( vec3( 1 ), mapTint, u.fromMap ) )
		.mul( mix( vec3( 1 ), vec3( 0.42, 0.33, 0.27 ), tarn ) )
		.mul( gh.z.sub( 0.5 ).mul( 0.025 ).mul( wG ).add( 1 ) )
		.mul( float( 1 ).sub( boundary.mul( 0.1 ) ) )
		.mul( float( 1 ).add( scratch.mul( 0.25 ) ) )
		.mul( rub.mul( 0.12 ).add( 0.94 ) );
	// Verdigris is never flat: blue-green to dark green-brown, darker where
	// the crust is thin (near the metal) and in the crust's own hollows.
	const pv = valueNoise( p.div( 0.003 ).add( 6.6 ) ), pv2 = valueNoise( p.div( 6e-4 ).add( 1.3 ) );
	const edgeDark = smoothstep( 0.0, 0.6, pat ).mul( 0.5 ).add( 0.5 );
	const patinaCol = mix( u.patinaColor.mul( vec3( 0.55, 0.7, 0.75 ) ), u.patinaColor.mul( vec3( 1.1, 1.05, 0.95 ) ), pv )
		.mul( pv2.mul( 0.4 ).add( 0.8 ) ).mul( edgeDark )
		.mul( crust.x.mul( 0.4 ).mul( wCr ).add( 1 ) )
		.mul( float( 1 ).sub( pit.mul( 0.6 ) ) );

	// Rubbed patches are smoother and brighter, the rest duller.
	const rMetal = u.roughness.mul( mix( float( 1.25 ), float( 0.7 ), rub ) ).add( tarn.mul( 0.2 ) ).add( scratch.mul( 0.2 ) ).add( gh.z.sub( 0.5 ).mul( 0.03 ).mul( wG ) );
	const s2 = float( 1 ).sub( wH ).mul( 0.02 ).mul( u.hammerDepth ).add( float( 1 ).sub( wCr ).mul( 0.05 ).mul( pat ) );

	// Wear polishes the ridges between dents; dirt sits in the dents.
	return {
		color: mix( metal, patinaCol, pat ),
		slope: sH.add( sCrust ).add( sG ),
		rough: mix( rMetal, float( 0.85 ), pat ),
		s2,
		metalness: float( 1 ).sub( pat ),
		cavity: dentLow.max( pat.mul( 0.6 ) ),
		porosity: mix( float( 0.05 ), float( 0.8 ), pat ),
		debug: { w1: wH, w2: wCr, w3: wG },
	};

}
