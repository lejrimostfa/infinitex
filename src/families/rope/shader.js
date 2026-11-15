// Rope family: a laid rope, every level faded by its pixel size.
//   L1 strands: 2 to 6 strands twisted around the rope, round in section
//   L2 yarns:   yarns twisted the other way inside each strand
//   L3 fibers:  long hemp fibers along each yarn, light and dark
// Stray fibers come from the shared fuzz shells.
// Coordinates in meters: x along the rope, y around it.

import { uv, vec2, vec3, float, floor, fract, clamp, smoothstep, sqrt, mix, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, fadeIn, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { hash1 } from '../../core/hash.js';
import { applySurface } from '../../core/surface.js';

// Round bump across a band, coordinate f in 0..1: slope of sqrt(1 - x^2),
// x = 2f - 1, capped near the edges (they are grooves), faded within a
// pixel of the groove.
function bump( f, widthM, fp, amp ) {

	const x = f.mul( 2 ).sub( 1 ).clamp( - 0.97, 0.97 );
	const s = x.div( sqrt( float( 1 ).sub( x.mul( x ) ) ) ).negate().mul( amp ).clamp( - 2, 2 );
	const edge = smoothstep( 0.0, 1.0, f.min( float( 1 ).sub( f ) ).mul( widthM ).div( fp ) );
	return { s: s.mul( edge ), h: sqrt( float( 1 ).sub( x.mul( x ) ) ) };

}

export function buildRopeNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const circ = u.diameter.mul( Math.PI );

	// L1 strands: helix lines y / circ - x / lay = const.
	const helix = vec2( circ, u.layM ).normalize(); // direction of a strand on the surface (x, y)
	const across = vec2( helix.y.negate(), helix.x ); // across the strand
	const sc = p.y.div( circ ).sub( p.x.div( u.layM ) ).mul( u.strands );
	const si = floor( sc );
	const sf = fract( sc ).toVar();
	const strandW = circ.div( u.strands ).mul( across.y.abs() ).max( 1e-5 );
	const w1 = fadeIn( strandW, fp, 2.0, 6.0 ).toVar();
	const st = bump( sf, strandW, fp, float( 0.6 ) );

	// L2 yarns: counter twist inside the strand.
	const alongS = p.dot( helix );
	const yc = sf.mul( u.yarns ).add( alongS.div( u.yarnLayM ).mul( u.yarns ).mul( 0.5 ) );
	const yi = floor( yc ).add( si.mul( 37 ) );
	const yf = fract( yc ).toVar();
	const yarnW = strandW.div( u.yarns );
	const w2 = fadeIn( yarnW, fp, 2.0, 6.0 ).mul( w1 ).toVar();
	const yb = bump( yf, yarnW, fp, float( 0.35 ) );
	// The yarn runs diagonally on the strand: its across direction.
	const yDir = across.mul( u.yarns ).add( helix.mul( u.yarns.mul( 0.5 ).mul( strandW ).div( u.yarnLayM ) ) ).normalize();

	// L3 fibers along the yarn.
	const yAlong = vec2( yDir.y.negate(), yDir.x );
	const lane = p.dot( yDir ).div( u.fiberM );
	const segC = p.dot( yAlong ).div( u.fiberM.mul( 120 ) ).add( hash1( vec2( floor( lane ), yi ) ) );
	const fl = fract( lane.add( hash1( vec2( floor( segC ), floor( lane ) ) ).sub( 0.5 ).mul( 0.8 ) ) ).toVar();
	const fi = floor( lane ).add( floor( segC ).mul( 0.37 ) );
	const w3 = fadeIn( u.fiberM, fp, 2.0, 6.0 ).mul( w2 ).toVar();
	const fb = bump( fl, u.fiberM, fp, float( 0.3 ) );

	const slope = across.mul( st.s.mul( w1 ) ).add( yDir.mul( yb.s.mul( w2 ) ) ).add( yDir.mul( fb.s.mul( w3 ) ) );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, slope, tangentView, bitangentView ).toVar( 'ix_normal' );

	// Colour: per strand, per yarn, per fiber variation; dark grooves.
	const baseColor = opts.stitchColor ? opts.stitchColor.here : u.color;
	const v = u.colorVar;
	const tint = float( 1 )
		.add( hash1( vec2( si, 3.3 ) ).sub( 0.5 ).mul( v ).mul( w1 ) )
		.add( hash1( vec2( yi, 7.1 ) ).sub( 0.5 ).mul( v ).mul( w2 ) )
		.add( hash1( vec2( fi, 1.9 ) ).sub( 0.5 ).mul( v.mul( 2 ) ).mul( w3 ) );
	const ao = mix( float( 0.75 ), st.h.mul( 0.6 ).add( 0.4 ), w1 ).mul( mix( float( 0.88 ), yb.h.mul( 0.25 ).add( 0.75 ), w2 ) );
	const colorNode = baseColor.mul( tint ).mul( ao );

	const s2 = float( 1 ).sub( w1 ).mul( 0.12 ).add( float( 1 ).sub( w2 ).mul( 0.04 ) ).add( float( 1 ).sub( w3 ).mul( 0.02 ) );
	const roughnessNode = specularAA( composeRoughness( u.roughness, s2 ), normalNode );
	const nodes = {
		colorNode, normalNode, roughnessNode, metalnessNode: float( 0 ),
		sheenNode: baseColor.mul( u.sheenAmt ), sheenRoughnessNode: float( 0.6 ),
	};
	applySurface( nodes, u.surface, { cavity: float( 1 ).sub( st.h ).mul( w1 ), flatNormal: base, porosity: 1 } );
	nodes.debug = { fp, w1, w2, w3, covered: float( 1 ) };
	return nodes;

}
