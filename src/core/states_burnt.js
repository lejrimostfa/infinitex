// Burnt state (core/states.js): burn marks on a matter, cigarette and
// ember burns on a fabric, or scorch on wood. burnt_mm: their spacing.
//   L0  a broad scorch wash (iron or heat, 5 to 10 cm, pale yellow to tan);
//       burn marks of 6 to 30 mm: a brown halo where the fibres only
//       browned, a black charred ring, and in some a hole
//   L1  the char shrinks and crazes into plates of about 1 mm with dark
//       gaps; small spark holes (1 to 2 mm) with their own black rim;
//       charred fibre ends curl up around each hole
//   L2  grey ash crumbs (0.1 to 0.2 mm) on the hole edge; the char is
//       glassy carbon, so its plates glint (roughness 0.35)
// The scorch tints the matter and keeps its relief (the weave stays
// visible); the char buries part of it; the hole shows the dark below.

import { vec2, vec3, float, mix, smoothstep, step, mod } from 'three/tsl';
import { fadeIn } from './lod.js';
import { valueNoise } from './hash.js';
import { voronoi } from './voronoi.js';
import { grains, fibres, fbm, line } from '../families/ground/grains.js';
import { blobs, over, hero } from './states_shape.js';
import { lay, bend } from './states.js';

const SCORCH = vec3( 0.55, 0.33, 0.15 ), TAN = vec3( 0.95, 0.82, 0.58 ), CHAR = vec3( 0.028, 0.024, 0.021 );

// One family of burns at spacing g. Returns the zones and the hole.
function burns( p, fp, g, share, salt, holeShare, extra = null ) {

	const S = blobs( p, fp, g, share, salt, { rMin: 0.08, rMax: 0.26, wobble: 0.5, wick: 0.4, jitter: 0.6 } );
	const B = extra ? over( S, extra ) : S;
	// Halo outside the char ring, as wide as 0.9 R.
	const halo = smoothstep( B.R.mul( - 0.9 ), float( 0 ), B.sd ).mul( B.cov.oneMinus() );
	const hasHole = step( B.id.y, holeShare );
	const rh = float( 0.5 ).add( B.id.z.mul( 0.15 ) ).add( valueNoise( p.div( g.mul( 0.02 ) ).add( salt ) ).sub( 0.5 ).mul( 0.25 ) );
	const hole = smoothstep( 0.0, fp.div( B.R ).max( 1e-4 ), rh.sub( B.rho ) ).mul( hasHole ).mul( B.cov );
	const lipD = B.rho.sub( rh ).div( 0.12 ); // 0 at the hole edge
	const lip = smoothstep( 1.0, 0.0, lipD ).mul( step( 0, lipD ) ).mul( hasHole ).mul( B.cov );
	return { B, halo, hole, lip, rh };

}

export function buildBurnt( nodes, ctx ) {

	const { p, fp, s } = ctx;
	const g = s.burntM, a = s.burnt;
	// L0 scorch wash.
	const wash = smoothstep( 0.55, 0.8, fbm( p.div( 0.07 ).add( s.seed.mul( 2.1 ) ), 3 ) ).mul( a ).mul( 0.6 );
	const K = burns( p, fp, g, a.mul( 0.5 ), 3.7, 0.65, hero( p, fp, vec2( 0.155, 0.152 ), 0.008, [ 0.5, 0.1, 0.4 ], 0.4 ) );
	const E = burns( p, fp, g.mul( 0.18 ), a.mul( 0.15 ), 9.2, 0.8 );
	const top = step( E.B.sd, K.B.sd );
	const charCov = K.B.cov.max( E.B.cov ).toVar();
	const hole = K.hole.max( E.hole ).toVar();
	const halo = K.halo.max( E.halo.mul( 0.8 ) );
	const lip = K.lip.max( E.lip );
	const rho = mix( E.B.rho, K.B.rho, top );

	// Scorch: multiply the matter, darker toward the char.
	const sc = halo.pow( 1.5 );
	const tint = mix( mix( vec3( 1 ), TAN, wash ), mix( TAN, SCORCH, sc ), smoothstep( 0.0, 0.25, halo ) );
	nodes.colorNode = nodes.colorNode.mul( tint ).mul( float( 1 ).sub( sc.mul( 0.35 ) ) );
	nodes.roughnessNode = nodes.roughnessNode.add( sc.mul( 0.08 ) ).min( 1 );

	// L1 char: brown at the outer edge, black inside, crazed plates.
	const wC = fadeIn( float( 1e-3 ), fp, 2.0, 6.0 ).toVar();
	const warp = vec2( valueNoise( p.div( 7e-4 ) ), valueNoise( p.div( 7e-4 ).add( 5.3 ) ) ).sub( 0.5 ).mul( 0.6 );
	const V = voronoi( mod( p.div( 1e-3 ), 4096 ).add( warp ).add( 2.9 ), 0.9 );
	const gap = line( V.edge.mul( 1e-3 ), float( 6e-5 ), fp ).mul( wC );
	const plate = valueNoise( V.id1.mul( 0.37 ) );
	let col = mix( CHAR, SCORCH.mul( 0.25 ), smoothstep( 0.75, 1.0, rho ) ).mul( plate.mul( 0.5 ).add( 0.75 ).mul( wC ).add( wC.oneMinus() ) );
	col = col.mul( float( 1 ).sub( gap.mul( 0.6 ) ) );
	// Charred fibre ends around the holes, ash crumbs on the edge.
	const T = fibres( p, float( 6e-4 ), float( 1.2e-5 ), lip, fp, 4.1, 0.8 );
	col = mix( col, CHAR.mul( 0.6 ), T.fiber );
	const Ga = grains( p, float( 1.5e-4 ), fp, 6.6, { gap: 0.25, radius: 0.3, round: 0.3, crown: 0.5, tilt: 0.5 } );
	const ash = Ga.body.mul( step( Ga.id.x, lip.mul( 0.7 ) ) ).mul( fadeIn( float( 1.5e-4 ), fp, 1.5, 4.0 ) );
	col = mix( col, vec3( 0.42, 0.41, 0.39 ).mul( Ga.id.y.mul( 0.5 ).add( 0.7 ) ), ash );
	// The hole: the dark behind the fabric.
	col = mix( col, vec3( 0.008 ), hole );

	const tilt = vec2( valueNoise( V.id1.mul( 0.71 ) ), valueNoise( V.id1.mul( 0.53 ).add( 4.4 ) ) ).sub( 0.5 ).mul( 0.5 ).mul( wC );
	const radial = mix( E.B.rad, K.B.rad, top );
	// The lip curls up: the char rises toward the hole edge.
	const slope = tilt.add( V.dir.mul( smoothstep( 0.1, 0.0, V.edge ) ).mul( 0.4 ).mul( wC ) )
		.add( radial.mul( lip ).mul( 0.6 ) ).add( T.slope.mul( 0.8 ) ).add( Ga.grad.mul( ash ).mul( 0.5 ) )
		.mul( charCov ).mul( hole.oneMinus() );
	const rough = mix( mix( float( 0.35 ).add( plate.mul( 0.25 ) ), float( 0.9 ), gap.max( ash ).max( wC.oneMinus().mul( 0.5 ) ) ), float( 1 ), hole );
	lay( nodes, ctx, { cov: charCov, color: col, rough, slope, hide: float( 0.45 ).add( hole.mul( 0.55 ) ) } );
	// Faint brown crust relief in the halo (the fibres shrank).
	return bend( nodes, ctx, vec2( valueNoise( p.div( 3e-4 ) ), valueNoise( p.div( 3e-4 ).add( 3.1 ) ) ).sub( 0.5 ).mul( 0.25 ).mul( sc ).mul( fadeIn( float( 3e-4 ), fp, 2.0, 6.0 ) ) );

}
