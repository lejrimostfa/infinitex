// Hand embroidery on linen: a flower spray repeated every size_mm (120 to
// 160 mm). Six strand cotton floss, two strands per needle, so a stitch is
// a flat glossy band of feature_mm (0.4 to 0.5 mm). Level by level:
//   L0 motif    a six petal flower, a stem curving down, two leaves
//   L1 stitches petals in long and short satin: stitches across the petal,
//               shaded dark at the heart to light at the tip, the steps of
//               the shading staggered stitch by stitch; leaves in fishbone
//               (stitches slanting from the midrib); the stem in stem
//               stitch (short slanted stitches overlapping like a rope);
//               the heart in French knots (round knots of 1.5 mm)
//   L2 floss    each stitch is round across, sunk where it meets the next
//               one; the two strands twist, so faint diagonal ridges
//   padding     the stitched area stands about 0.4 mm over the cloth and
//               casts a soft shadow on it
// Returns the layer over the woven ground: cover (0..1), colour, slope,
// roughness, sheen, cavity, and a shadow factor for the ground.

import { vec2, float, floor, fract, clamp, smoothstep, mod, mix, abs, cos, sin, atan, sqrt, max, PI } from 'three/tsl';
import { fadeIn, pick, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

const dir = ( a ) => vec2( cos( a ), sin( a ) );

export function buildEmbroidery( p, fp, u ) {

	const T = u.sizeM, F = u.featureM, s = u.seed;
	const tile = floor( p.div( T ).add( vec2( 0.4286, 0.5486 ) ) );
	const th = hash3( wrapCoord( tile ).add( s ) );
	const m = fract( p.div( T ).add( vec2( 0.4286, 0.5486 ) ) ).sub( 0.5 ).toVar(); // motif units
	const mirror = clamp( floor( th.x.mul( 2 ) ), 0, 1 ).mul( 2 ).sub( 1 );
	const q = vec2( m.x.mul( mirror ), m.y );

	// Flower: centre at (0, 0.12), six petals.
	const fc = q.sub( vec2( 0, 0.12 ) );
	const r = fc.length(), a = atan( fc.y, fc.x ).add( 0.3 );
	const k = floor( a.div( PI.div( 3 ) ).add( 0.5 ) );
	const ax = k.mul( PI.div( 3 ) ).sub( 0.3 );
	const ad = dir( ax ), pd = vec2( ad.y.negate(), ad.x );
	const along = fc.dot( ad ), across = fc.dot( pd );
	const lenP = float( 0.2 ).add( hash1( vec2( k, 2 ) ).mul( 0.03 ) );
	const tP = along.div( lenP ).clamp( 0, 1 );
	const halfW = sin( tP.mul( PI ) ).pow( 0.7 ).mul( 0.075 ).add( tP.mul( 0.02 ) );
	const sdPetal = min2( halfW.sub( abs( across ) ), lenP.sub( along ) ).min( along.sub( 0.035 ) ).mul( T );
	const sl = float( 0.25 ); // satin slant
	const gPetal = ad.mul( cos( sl ) ).add( pd.mul( sin( sl ) ) );
	const lanePetal = fc.dot( gPetal ).mul( T ).div( F );
	// Long and short shading: steps along the petal, staggered per lane.
	const stag = hash1( vec2( floor( lanePetal ), k ) ).sub( 0.5 ).mul( 0.12 );
	const shade = floor( tP.add( stag ).mul( 4 ) ).div( 3 ).clamp( 0, 1 );
	const petalCol = mix( u.color.mul( 0.45 ), mix( u.color, u.color2.mul( 0.4 ).add( u.color.mul( 0.8 ) ), 0.5 ), shade );

	// Heart: French knots.
	const sdHeart = float( 0.038 ).sub( r ).mul( T );
	const K = voronoi( wrapCoord( p.div( 1.6e-3 ) ).add( 5.5 ), 0.7 );
	const kd = K.toSeed.length();
	const knotH = smoothstep( 0.55, 0.0, kd );
	const swirl = sin( atan( K.toSeed.y, K.toSeed.x ).mul( 3 ).add( kd.mul( 18 ) ) ).mul( 0.5 ).add( 0.5 ).mul( fadeIn( float( 5e-4 ), fp, 2, 5 ) );
	const knotCol = u.color2.mul( knotH.mul( 0.5 ).add( 0.5 ) ).mul( swirl.mul( 0.25 ).add( 0.8 ) );

	// Stem: an arc of radius 0.42 around (0.4, -0.15), stem stitch.
	const sc = q.sub( vec2( 0.42, - 0.12 ) );
	const sr = sc.length(), sAng = atan( sc.y, sc.x );
	const sOn = smoothstep( 0.06, 0.04, q.y.sub( 0.0 ) ).mul( smoothstep( - 0.46, - 0.44, q.y ) ).mul( smoothstep( 0, 0.02, q.x.negate().add( 0.1 ) ) );
	const sdStem = float( 0.009 ).sub( abs( sr.sub( 0.43 ) ) ).mul( T ).sub( float( 1 ).sub( sOn ).mul( 0.01 ) );
	const arc = sAng.mul( 0.43 ).mul( T ), off = sr.sub( 0.43 ).mul( T );
	const laneStem = arc.add( off.mul( 2.2 ) ).div( F.mul( 3.5 ) ); // stitches 1.5 mm, slanted
	const gStem = vec2( sc.y.negate(), sc.x ).div( sr ).mul( - 1 ).add( sc.div( sr ).mul( 2.2 ) ).normalize();

	// Leaves: two, on the stem, fishbone stitch.
	const leaf = ( base, ang, len ) => {

		const d = dir( ang ), n = vec2( d.y.negate(), d.x );
		const l = q.sub( base );
		const al = l.dot( d ), ac = l.dot( n );
		const t = al.div( len ).clamp( 0, 1 );
		const hw = sin( t.mul( PI ) ).mul( len ).mul( 0.25 );
		const sd = min2( hw.sub( abs( ac ) ), min2( al, len.sub( al ) ) ).mul( T );
		const sgn = clamp( ac.mul( 1e4 ), - 1, 1 );
		const lane = al.add( abs( ac ).mul( 1.1 ) ).mul( T ).div( F );
		const g = d.add( n.mul( sgn ).mul( 1.1 ) ).normalize();
		const rib = smoothstep( 0.004, 0.0, abs( ac ) );
		return { sd, lane, g, col: u.color3.mul( mix( float( 0.7 ), float( 1.15 ), t ) ).mul( rib.mul( 0.3 ).add( 1 ) ) };

	};
	const L1 = leaf( vec2( 0.02, - 0.12 ), float( 2.6 ), float( 0.2 ) );
	const L2 = leaf( vec2( 0.06, - 0.26 ), float( 0.35 ), float( 0.17 ) );

	// Choose the region: flower over leaves over stem.
	const ins = ( sd ) => clamp( sd.div( fp ).add( 0.5 ), 0, 1 );
	const iStem = ins( sdStem ), iL1 = ins( L1.sd ), iL2 = ins( L2.sd ), iP = ins( sdPetal ), iH = ins( sdHeart );
	let lane = laneStem, g = gStem, col = mix( u.color3.mul( 0.55 ), u.color3, 0.3 );
	lane = pick( iL1, L1.lane, lane ); g = pick( iL1, L1.g, g ); col = pick( iL1, L1.col, col );
	lane = pick( iL2, L2.lane, lane ); g = pick( iL2, L2.g, g ); col = pick( iL2, L2.col, col );
	lane = pick( iP, lanePetal, lane ); g = pick( iP, gPetal, g ); col = pick( iP, petalCol, col );
	const cover = max( max( iStem, iL1 ), max( max( iL2, iP ), iH ) );
	const sdAll = max( max( sdStem, L1.sd ), max( max( L2.sd, sdPetal ), sdHeart ) );

	// L2 floss: round across the lane, a dark seam between lanes, plies.
	const x = fract( lane ).sub( 0.5 );
	const wL = fadeIn( F, fp, 2.0, 5.0 );
	const hc = sqrt( float( 1 ).sub( x.mul( x ).mul( 3.6 ) ).max( 0.02 ) );
	const gp = vec2( g.x.mul( mirror ), g.y ); // back from motif to surface axes
	const sAcross = x.mul( - 2.4 ).div( hc ).clamp( - 2, 2 ).mul( wL ).mul( 0.5 );
	const ply = fract( lane.mul( 0.5 ).add( vec2( gp.y.negate(), gp.x ).dot( p ).div( F.mul( 1.4 ) ) ) );
	const wP = fadeIn( F.mul( 0.7 ), fp, 2.0, 5.0 );
	const plyShade = mix( float( 1 ), smoothstep( 0.0, 0.25, abs( ply.sub( 0.5 ) ) ).mul( 0.25 ).add( 0.8 ), wP );
	const laneTone = hash1( vec2( floor( lane ), 3.3 ) ).sub( 0.5 ).mul( u.colorVar ).mul( wL ).add( 1 );
	const floss = mix( float( 0.82 ), hc.mul( 0.4 ).add( 0.62 ), wL ).mul( plyShade ).mul( laneTone );
	let color = col.mul( floss );
	color = mix( color, knotCol, iH );
	// Padding: the stitched area stands up; knots are domes.
	const pad = smoothstep( 0.0, 6e-4, sdAll ).mul( 3e-4 ).add( knotH.mul( iH ).mul( 3e-4 ) ).mul( u.relief );
	const slope = surfaceGradient( pad, p ).clamp( - 1.5, 1.5 ).add( gp.mul( sAcross ).mul( float( 1 ).sub( iH ) ) );
	const shadow = smoothstep( - 1.2e-3, 0.0, sdAll ).mul( 0.35 ).oneMinus();
	return {
		cover, color, slope, rough: float( 0.38 ), s2: float( 1 ).sub( wL ).mul( 0.06 ),
		sheen: color.mul( 0.6 ), cavity: float( 1 ).sub( hc ).mul( 0.4 ).mul( wL ), groundShade: shadow,
	};

}

const min2 = ( a, b ) => a.min( b );
