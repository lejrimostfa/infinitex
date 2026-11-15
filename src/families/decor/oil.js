// Oil painting on canvas, old and varnished. Level by level:
//   L0 picture  a landscape (landscape.js) laid in with brush strokes of
//               size_mm (8 to 15 mm long, a third as wide); each stroke
//               carries one colour, picked from the picture at its centre,
//               and follows the forms (brushFlow); later strokes cover
//               earlier ones
//   L1 impasto  each stroke is a ridge of paint 0.1 to 0.5 mm thick: paint
//               pushed up along both edges, a blob where the brush lifted,
//               or a dry thin tail where it ran out of paint
//   L2 bristles grooves along the stroke left by the bristles, feature_mm
//               apart (0.3 to 0.5 mm), with streaks of unmixed colour
//   L2 canvas   linen canvas, about 12 threads per cm, under a white
//               ground: it shows through wherever the paint is thin
//   L2 cracks   craquelure of the aged paint and varnish: cells of 2 to
//               5 mm, then finer generations, dirt in the cracks
//               (ceramic/crackle.js)
//   L3 pigment  grains of 2 to 20 um in the oil, some brighter
// The old varnish yellows the colours and gives a soft gloss.

import { vec2, vec3, float, floor, fract, clamp, smoothstep, step, mod, mix, abs, cos, sin, sqrt, min } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { crackleNet } from '../ceramic/crackle.js';
import { landscape, brushFlow } from './landscape.js';

const FACE = 0.3; // the picture spans one face of the cube

export function buildOil( p, fp, u ) {

	const s = u.seed;
	const L = u.sizeM, W = L.mul( 0.34 ), C = L.mul( 0.3 );
	const b = floor( p.div( C ) );
	let best = float( - 1 ), cov = float( 0 );
	let bc = vec2( 0 ), ba = float( 0 ), bb = float( 0 ), blen = float( 1 ), bwid = float( 1 ), bh = vec3( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = b.add( vec2( ox, oy ) );
		const h = hash3( mod( id, 4096 ).add( s ) ), h2 = hash3( mod( id, 4096 ).add( 7.1 ) );
		const c = id.add( h.xy ).mul( C );
		const ang = brushFlow( c.div( FACE ) ).add( h.z.sub( 0.5 ).mul( 0.5 ) );
		const d = vec2( cos( ang ), sin( ang ) );
		const rel = p.sub( c );
		const a = rel.dot( d ), across = rel.dot( vec2( d.y.negate(), d.x ) );
		const len = L.mul( h2.x.mul( 0.7 ).add( 0.6 ) ).mul( 0.5 );
		const t = a.div( len );
		const wid = W.mul( h2.y.mul( 0.6 ).add( 0.7 ) ).mul( 0.5 ).mul( sqrt( float( 1 ).sub( t.mul( t ).mul( t ).mul( t ) ).max( 0 ) ).mul( 0.4 ).add( 0.6 ) );
		// Ragged end: bristles stop at different places.
		const rag = valueNoise( vec2( across.div( u.featureM.mul( 1.5 ) ), h.x.mul( 50 ) ) ).mul( 0.18 );
		const sd = min( len.mul( float( 1 ).sub( rag ) ).sub( abs( a ) ), wid.sub( abs( across ) ) );
		const inside = clamp( sd.div( fp ).add( 0.5 ), 0, 1 );
		const take = inside.mul( step( best, h2.z ) );
		best = mix( best, h2.z, step( 0.5, take ) );
		bc = mix( bc, c, take ); ba = mix( ba, a, take ); bb = mix( bb, across, take );
		blen = mix( blen, len, take ); bwid = mix( bwid, wid, take ); bh = mix( bh, h2, take );
		cov = cov.max( inside );

	}

	const t = ba.div( blen ).clamp( - 1, 1 ), sa = bb.div( bwid ).clamp( - 1, 1 );
	const wS = fadeIn( W, fp, 1.5, 4.0 );
	// L1 thickness, in 0..1 units of 0.4 mm.
	const body = sqrt( float( 1 ).sub( sa.mul( sa ) ).max( 0 ) );
	const ridge = smoothstep( 0.55, 0.9, abs( sa ) ).mul( smoothstep( 1.0, 0.9, abs( sa ) ) );
	const blobby = step( 0.5, bh.z.mul( 7 ).fract() );
	const blob = smoothstep( 0.5, 0.85, t ).mul( smoothstep( 1.0, 0.85, t ) ).mul( blobby );
	const load = mix( float( 1 ), smoothstep( 1.1, - 0.4, t ).mul( 0.8 ).add( 0.15 ), float( 1 ).sub( blobby ) );
	// L2 bristles: grooves along the stroke.
	const wB = fadeIn( u.featureM, fp, 2.0, 5.0 );
	// Ridges between grooves, each bristle track a little off its neighbours.
	const bq = bb.div( u.featureM ).add( valueNoise( vec2( bb.div( u.featureM.mul( 3 ) ), ba.div( L.mul( 0.5 ) ) ).add( bh.xy.mul( 40 ) ) ).mul( 1.5 ) );
	const tri = float( 1 ).sub( abs( fract( bq ).sub( 0.5 ) ).mul( 2 ) );
	const groove = mix( float( 0.5 ), tri.mul( tri ).mul( float( 3 ).sub( tri.mul( 2 ) ) ).mul( valueNoise( vec2( floor( bq ), ba.div( L.mul( 0.2 ) ) ) ).mul( 0.6 ).add( 0.4 ) ), wB );
	const paintT = body.mul( 0.5 ).add( ridge.mul( 0.6 ) ).add( blob.mul( 0.9 ) ).add( 0.15 ).mul( load ).mul( groove.mul( 0.7 ).add( 0.6 ) ).mul( cov ).mul( u.relief );
	// L2 canvas: a weave of bumps, 0.83 mm period.
	const cq = p.div( 8.3e-4 );
	const wC = fadeIn( float( 8.3e-4 ), fp, 2.0, 5.0 );
	const cx = fract( cq.x ).sub( 0.5 ), cy = fract( cq.y ).sub( 0.5 );
	const over = step( 0.5, fract( floor( cq.x ).add( floor( cq.y ) ).mul( 0.5 ) ) );
	const thread = mix( float( 1 ).sub( cy.mul( cy ).mul( 4 ) ), float( 1 ).sub( cx.mul( cx ).mul( 4 ) ), over )
		.mul( valueNoise( cq.mul( 0.35 ) ).mul( 0.4 ).add( 0.8 ) );
	const canvasH = mix( float( 0.5 ), thread, wC );
	// Paint hides the canvas where it is thicker than the weave relief.
	const show = smoothstep( 0.0, 0.1, paintT.sub( canvasH.mul( 0.12 ) ) );
	const h = paintT.mul( wS ).mul( 4e-4 ).add( canvasH.mul( 4e-5 ) );
	let slope = surfaceGradient( h, p ).clamp( - 2, 2 );

	// Colour: the picture at the stroke centre, a tint per stroke, streaks.
	// The painter mixes on the palette: each load is a little off, its hue
	// drawn from nearby in the picture.
	const jit = bh.xy.sub( 0.5 ).mul( L.mul( 0.8 ) );
	const strokeCol = landscape( bc.add( jit ).div( FACE ) ).mul( bh.sub( 0.5 ).mul( u.colorVar.mul( 2 ) ).add( 1 ) )
		.mul( groove.sub( 0.5 ).mul( 0.35 ).add( 1 ) );
	const under = landscape( p.div( FACE ) ).mul( 0.92 ); // the thin underpainting
	const primer = vec3( 0.8, 0.76, 0.66 ).mul( canvasH.mul( 0.25 ).add( 0.8 ) );
	let color = mix( primer, mix( under, strokeCol, cov ), show.max( float( 1 ).sub( wC ).mul( 0.85 ) ) );
	// L3 pigment grains.
	const gq = mod( p.div( 6e-6 ), 4096 );
	const gh = hash3( floor( gq ) );
	const wG = fadeIn( float( 6e-6 ), fp, 1.5, 4.0 );
	color = color.mul( gh.x.sub( 0.5 ).mul( 0.3 ).mul( wG ).add( 1 ) ).add( step( 0.97, gh.y ).mul( 0.08 ).mul( wG ) );

	// L2 craquelure: dirt in the cracks, cells slightly cupped.
	const K = crackleNet( p, fp, { seed: s, crackleFine: float( 0.8 ) }, float( 0.004 ) );
	const crack = K.c1.add( K.c2.mul( 0.6 ) ).add( K.c3.mul( 0.4 ) ).min( 1 ).mul( u.amount );
	color = color.mul( float( 1 ).sub( crack.mul( 0.75 ) ) );
	slope = slope.add( K.slope.mul( u.amount ).mul( 2 ) );
	// Old varnish: yellow, a little darker.
	color = color.mul( mix( vec3( 1 ), vec3( 0.95, 0.85, 0.62 ), u.varnish ) );
	const cavity = crack.max( float( 1 ).sub( show ).mul( 0.4 ) );
	return {
		color, slope, cavity, rough: mix( u.roughness, float( 0.35 ), u.varnish ), s2: float( 1 ).sub( wB ).mul( 0.02 ).add( float( 1 ).sub( wS ).mul( 0.05 ) ),
		coat: u.varnish.mul( 0.7 ), coatRough: float( 0.15 ),
	};

}
