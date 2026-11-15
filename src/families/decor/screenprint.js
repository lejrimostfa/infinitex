// Screen print on cotton canvas: plastisol ink pushed through a polyester
// mesh by a squeegee, one screen per colour, then cured. Level by level:
//   L0 design   a retro badge per face: a sun with cut bands, fading out
//               in halftone dots at the bottom, a ring, two mountains and
//               a line of block letters, in two inks
//   L1 register each screen sits a little off (amount x 0.8 mm): thin
//               gaps and overlaps where the colours meet
//   L1 cracks   cured plastisol is a skin 50 to 100 um thick; washing and
//               stretching crack it into cells of 1.5 to 3 mm, the fabric
//               shows in the cracks
//   L2 ink      the ink drapes over the threads (the weave shows through),
//               halftone dots of feature_mm (0.4 to 0.5 mm)
//   L3 mesh     the mesh (60 threads per cm) leaves a faint grid of
//               bumps in the ink and a saw-tooth along every edge
// Returns the layer over the woven ground. `conform` tells the shader how
// much of the weave relief and shading shows through the ink.

import { vec2, float, floor, fract, clamp, smoothstep, mod, mix, abs, cos, sin, max, min } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash1, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

const MESH = 1.65e-4; // mesh period, meters

export function buildScreenprint( p, fp, u ) {

	const s = u.seed;
	// L3 mesh: grid of bumps, saw-tooth on the edges.
	const mq = p.div( MESH );
	const wM = fadeIn( float( MESH ), fp, 2.0, 5.0 );
	const mesh = cos( mq.x.mul( 6.2832 ) ).mul( cos( mq.y.mul( 6.2832 ) ) ).mul( wM );
	const saw = fract( mq.x ).add( fract( mq.y ) ).sub( 1 ).mul( 2.5e-5 ).mul( wM );
	const ragged = valueNoise( p.div( 4e-4 ).add( s ) ).sub( 0.5 ).mul( 6e-5 );
	const ins = ( sd ) => clamp( sd.add( saw ).add( ragged ).div( fp ).add( 0.5 ), 0, 1 );

	// L1 register: each screen shifted.
	const off = u.amount.mul( 8e-4 );
	const fA = p.sub( vec2( 0.15 ) ).add( vec2( off, off.mul( - 0.4 ) ) ).div( 0.3 );
	const fB = p.sub( vec2( 0.15 ) ).sub( vec2( off.mul( 0.3 ), off.mul( - 0.6 ) ) ).div( 0.3 );

	// Screen A (warm): the sun with cut bands, halftone at the bottom.
	const sc = fA.sub( vec2( 0, 0.08 ) );
	const sdSun = float( 0.2 ).sub( sc.length() ).mul( 0.3 );
	const by = sc.y.negate().div( 0.2 ); // 0 centre, 1 bottom
	const cut = abs( fract( fA.y.div( 0.035 ) ).sub( 0.5 ) ).mul( 0.035 ).sub( by.max( 0 ).mul( 0.006 ) ).mul( 0.3 );
	const sdA = min( sdSun, cut.max( float( 0.0 ).sub( by ).mul( 0.3 ) ) );
	// Halftone dots, screen at 22.5 degrees.
	const ca = cos( float( 0.3927 ) ), sa = sin( float( 0.3927 ) );
	const hq = vec2( p.x.mul( ca ).add( p.y.mul( sa ) ), p.y.mul( ca ).sub( p.x.mul( sa ) ) ).div( u.featureM );
	const tone = smoothstep( 1.0, 0.25, by );
	const hd = fract( hq ).sub( 0.5 ).length().mul( u.featureM );
	const dotR = tone.sqrt().mul( u.featureM ).mul( 0.62 );
	const wH = fadeIn( u.featureM, fp, 2.5, 6.0 );
	const dots = mix( tone, clamp( dotR.sub( hd ).div( fp ).add( 0.5 ), 0, 1 ), wH );
	const inkA = ins( sdA ).mul( dots );

	// Screen B (dark): ring, mountains, block letters.
	const r = fB.sub( vec2( 0, 0.08 ) ).length();
	const sdRing = float( 0.012 ).sub( abs( r.sub( 0.235 ) ) );
	const mtn = ( px, py, w ) => py.sub( fB.y ).sub( abs( fB.x.sub( px ) ).mul( py.add( 0.06 ).div( w ) ) ).min( fB.y.add( 0.06 ) );
	const sdMtn = max( mtn( float( - 0.09 ), float( 0.12 ), float( 0.2 ) ), mtn( float( 0.1 ), float( 0.05 ), float( 0.16 ) ) );
	// Letters: 7 glyphs of 3 x 5 blocks.
	const lq = vec2( fB.x.add( 0.35 ).div( 0.1 ), fB.y.add( 0.33 ).div( 0.13 ) );
	const gi = floor( lq.x );
	const bx = fract( lq.x ).mul( 4 ).sub( 0.25 ), byy = lq.y.mul( 5 );
	const bi = vec2( floor( bx ), floor( byy ) );
	const on = clamp( floor( hash1( bi.add( gi.mul( 7.3 ) ).add( s ) ).mul( 1.6 ) ), 0, 1 )
		.max( clamp( floor( abs( bi.x.sub( 1 ) ).mul( 0.5 ).add( 0.6 ) ), 0, 1 ) ); // side bars always on
	const inGlyph = clamp( min( min( bx, float( 3 ).sub( bx ) ), min( byy, float( 5 ).sub( byy ) ) ).mul( 1e3 ), 0, 1 )
		.mul( clamp( min( gi.add( 0.5 ), float( 6.5 ).sub( gi ) ).mul( 1e3 ), 0, 1 ) );
	const blk = fract( vec2( bx, byy ) ).sub( 0.5 ).abs();
	const sdBlk = float( 0.5 ).sub( max( blk.x, blk.y ) ).mul( 0.3 * 0.1 / 4 ).mul( on ).sub( float( 1 ).sub( on.mul( inGlyph ) ).mul( 0.01 ) );
	const sdB = max( max( sdRing, sdMtn ).mul( 0.3 ), sdBlk );
	const inkB = ins( sdB );

	// L1 cracks in the cured ink.
	// Cracks wander, and gather where the print was stretched most.
	const cwarp = vec2( valueNoise( p.div( 9e-4 ) ), valueNoise( p.div( 9e-4 ).add( 7 ) ) ).sub( 0.5 ).mul( 6e-4 );
	const V = voronoi( mod( p.add( cwarp ).div( 2.2e-3 ), 4096 ).add( s.mul( 3 ) ), 0.85 );
	const zone = smoothstep( 0.45, 0.7, valueNoise( p.div( 0.02 ).add( s ) ) );
	const cw = valueNoise( p.div( 1e-3 ) ).mul( 3e-5 ).add( 5e-6 ).mul( u.amount ).mul( zone );
	const crackD = V.edge.mul( 2.2e-3 );
	const crack = clamp( cw.max( fp.mul( 0.5 ) ).sub( crackD ).div( fp ).add( 0.5 ), 0, 1 ).mul( cw.div( cw.max( fp.mul( 0.5 ) ) ) );

	const cover = max( inkA, inkB ).mul( float( 1 ).sub( crack ) );
	const color = mix( u.color2, u.color, inkB ).mul( mesh.mul( 0.03 ).add( 1 ) );
	// Ink height: 70 um skin, mesh bumps on it, cupped at the cracks.
	const h = cover.mul( 7e-5 ).add( mesh.mul( 3e-6 ) ).add( smoothstep( 0.0, 2e-4, crackD ).mul( 5e-6 ) ).mul( u.relief );
	const slope = surfaceGradient( h, p ).clamp( - 1, 1 );
	return { cover, color, slope, rough: float( 0.55 ), s2: float( 0.005 ), cavity: crack, conform: float( 0.35 ), sheen: color.mul( 0 ) };

}
