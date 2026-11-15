// Stains that soak into a matter (core/states.js), and the greasy state.
//   stains  blots with ragged edges and fingers wicked along the threads,
//           a tide line just inside the edge (the liquid carried its load
//           there as it dried: the coffee ring effect)
// Greasy (greasy_mm: stain spacing, about 35 mm):
//   L0  oil stains of 1 to 3 cm and a few finger wipes, elongated, with
//       streaks along the wipe
//   L1  the tide line (darker, 1 mm), fingers along warp and weft
//   L2  each thread and fibre drank its own share (stretched noise along
//       the threads, 0.3 mm and 20 um); tiny oil beads glint on the fibres
// Oil fills the air between the fibres, so less light scatters back: the
// fabric darkens and its colour saturates (it turns half translucent).
// The fibre sheen dies, the surface turns smoother.

import { vec2, vec3, float, mix, smoothstep, step, clamp } from 'three/tsl';
import { fadeIn } from './lod.js';
import { valueNoise } from './hash.js';
import { grains } from '../families/ground/grains.js';
import { blobs, over, hero } from './states_shape.js';
import { bend } from './states.js';

// extra: one more blob (a hero mark) merged in.
export function stains( p, fp, g, share, salt, extra = null ) {

	const S = blobs( p, fp, g, share, salt, { rMin: 0.12, rMax: 0.42, wobble: 0.55, wick: 0.7, jitter: 0.6 } );
	const B = extra ? over( S, extra ) : S;
	// The edge wicks over about 0.2 mm: never sharper than that.
	const cov = clamp( B.sd.div( fp.max( 2e-4 ) ).add( 0.5 ), 0, 1 ).toVar();
	const tideW = B.R.mul( 0.06 ).max( 6e-4 );
	const tide = smoothstep( tideW, tideW.mul( 0.2 ), B.sd ).mul( cov );
	return { B, cov, tide, core: smoothstep( 1.0, 0.3, B.rho ) };

}

// How much each thread and fibre drank: stretched noise along x and y.
export function threadShare( p, fp ) {

	const w2 = fadeIn( float( 3e-4 ), fp, 2.0, 6.0 ), w3 = fadeIn( float( 2e-5 ), fp, 2.0, 6.0 );
	const t2 = valueNoise( vec2( p.x.div( 3e-4 ), p.y.div( 4e-3 ) ) ).add( valueNoise( vec2( p.x.div( 4e-3 ), p.y.div( 3e-4 ) ).add( 5.5 ) ) ).mul( 0.5 );
	const t3 = valueNoise( vec2( p.x.div( 2e-5 ), p.y.div( 6e-4 ) ).add( 1.3 ) ).max( valueNoise( vec2( p.x.div( 6e-4 ), p.y.div( 2e-5 ) ).add( 8.1 ) ) );
	return float( 1 ).add( t2.sub( 0.5 ).mul( 0.5 ).mul( w2 ) ).add( t3.sub( 0.5 ).mul( 0.4 ).mul( w3 ) );

}

// Darken and saturate: the colour of a matter soaked in a clear oil.
export function soak( c, k, dark = 0.55, sat = 1.6 ) {

	const lum = c.dot( vec3( 0.2126, 0.7152, 0.0722 ) );
	const s = vec3( lum ).add( c.sub( lum ).mul( sat ) ).max( 0 );
	return mix( c, s.mul( dark ), k );

}

export function buildGrease( nodes, ctx ) {

	const { p, fp, s } = ctx;
	const g = s.greaseM;
	const St = stains( p, fp, g, s.greasy.mul( 0.5 ), 4.2, hero( p, fp, vec2( 0.158, 0.146 ), 0.013, [ 0.5, 0.5, 0.6 ], 0.5 ) );
	// Finger wipes: long blobs, streaks along them.
	const ang = 0.4;
	const Sm = blobs( p, fp, g.mul( 1.8 ), s.greasy.mul( 0.4 ), 8.8, { rMin: 0.08, rMax: 0.22, wobble: 0.3, elong: 3.5, angle: ang } );
	const along = p.dot( vec2( Math.cos( ang ), Math.sin( ang ) ) ), across = p.dot( vec2( - Math.sin( ang ), Math.cos( ang ) ) );
	const striae = valueNoise( vec2( across.div( 4e-4 ), along.div( 0.012 ) ) );
	const smear = Sm.cov.mul( striae.mul( 0.7 ).add( 0.3 ) ).mul( smoothstep( 1.0, 0.4, Sm.rho ).mul( 0.6 ).add( 0.4 ) );
	const share = threadShare( p, fp );
	const k = St.cov.mul( St.core.mul( 0.2 ).add( 0.8 ) ).max( smear ).mul( share ).min( 1 ).toVar();
	// Dirty oil carries soot and metal: the stain takes greasy_color.
	const dirt = St.B.id.z.mul( 0.6 ).add( smear.mul( 0.8 ) ).min( 1 );
	let color = soak( nodes.colorNode, k, 0.5, 1.25 );
	color = color.mul( mix( vec3( 1 ), s.greaseColor.mul( 2.6 ), dirt.mul( k ).mul( 0.5 ) ) );
	color = color.mul( float( 1 ).sub( St.tide.mul( 0.35 ) ) );
	nodes.colorNode = color;

	// Oil beads on the fibres: tiny glints.
	const Gb = grains( p, float( 4e-5 ), fp, 2.2, { gap: 0.3, radius: 0.25, round: 0.3, crown: 0.9 } );
	const bead = Gb.body.mul( step( 0.88, Gb.id.x ) ).mul( k ).mul( fadeIn( float( 4e-5 ), fp, 1.5, 4.0 ) );
	nodes.roughnessNode = mix( nodes.roughnessNode, nodes.roughnessNode.mul( 0.55 ).add( 0.05 ), k ).mul( float( 1 ).sub( bead.mul( 0.7 ) ) );
	if ( nodes.sheenNode ) nodes.sheenNode = nodes.sheenNode.mul( float( 1 ).sub( k.mul( 0.9 ) ) );
	// The oil fills the finest relief a little; beads add their dome.
	return bend( nodes, ctx, Gb.grad.mul( bead ).mul( 0.5 ), k.mul( 0.25 ) );

}
