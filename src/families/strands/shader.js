// Strands family: hair, fur, fleece lying on a surface.
//   L0 flow:   combed direction, bent by a smooth warp across the strands
//   L1 locks:  strands gathered in locks, shadow between them
//   L2 strands: three layers of round strands, each with its root-to-tip
//              colour, agouti bands, guard hairs, tapered tips, crimp
// The specular lobe is stretched across the strands (anisotropy), as on
// real hair. Coordinates in meters.

import { uv, vec2, vec3, float, floor, fract, clamp, smoothstep, step, sqrt, mix, sin, cos, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, fadeIn, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { applySurface } from '../../core/surface.js';

const LAYERS = 3;

export function buildStrandsNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );
	const d = vec2( cos( u.angle ), sin( u.angle ) ), n = vec2( sin( u.angle ).negate(), cos( u.angle ) );
	const x = p.dot( d ), y0 = p.dot( n );

	// Flow: the strands bend together. The warp moves them across, as a
	// function of where they are along; its x derivative gives the local
	// strand direction (for the highlight).
	const warp = ( xx ) => valueNoise( vec2( xx.div( u.flowM ), y0.div( u.flowM.mul( 2 ) ).add( u.seed ) ) ).sub( 0.5 ).mul( u.flowM ).mul( u.flowAmt ).mul( 0.4 );
	const e = u.flowM.mul( 0.05 );
	const w0 = warp( x ), w1 = warp( x.add( e ) );
	const tangent = d.add( n.mul( w1.sub( w0 ).div( e ) ) ).normalize().toVar();
	const across = vec2( tangent.y.negate(), tangent.x );
	const y = y0.add( w0 );

	// Locks.
	const L = y.div( u.lockM ).add( valueNoise( vec2( x.div( u.lockM.mul( 10 ) ), 3.3 ) ).mul( 0.6 ) );
	const lf = fract( L ), lid = floor( L );
	const wL = fadeIn( u.lockM, fp, 1.0, 3.0 );
	const lockShade = mix( float( 1 ).sub( u.lockDepth.mul( 0.55 ) ), float( 1 ), sin( lf.mul( Math.PI ) ) );
	const sLock = across.mul( cos( lf.mul( Math.PI ) ).mul( u.lockDepth ).mul( - 0.35 ) ).mul( wL );

	// Strands.
	const spacing = u.strandW.mul( 1.5 );
	const wS = fadeIn( spacing, fp, 1.5, 4.0 ).toVar();
	const meanCol = mix( u.color, u.tipColor, 0.35 ).mul( mix( vec3( 1 ), u.bandColor.div( u.color.max( vec3( 0.01 ) ) ).min( vec3( 3 ) ), u.bands.mul( 0.15 ) ) );
	let col = meanCol.mul( 0.4 ); // deep, between strands
	let slope = vec2( 0 );
	for ( let k = 0; k < LAYERS; k ++ ) {

		// Crimp: strands of one lock wave together.
		const cr = sin( x.div( u.crimpM ).mul( Math.PI * 2 ).add( lid.mul( 1.7 ) ).add( k * 2.1 ) ).mul( u.crimp ).mul( u.crimpM ).mul( 0.25 );
		const yk = y.add( cr ).add( float( k ).mul( spacing ).mul( 0.37 ) );
		const sc = yk.div( spacing );
		const si = floor( sc ).add( k * 1013 );
		const f = fract( sc ).sub( 0.5 );
		const hs = hash3( vec2( si, 7.7 ).add( u.seed ) );
		// Root to tip: each strand is cut into hair lengths, offset per strand.
		const tq = x.div( u.lengthM.mul( hs.y.mul( 0.6 ).add( 0.7 ) ) ).add( hs.x.mul( 7 ) );
		const t = fract( tq );
		const guard = step( hs.z, u.guard );
		const taper = float( 1 ).sub( t ).div( 0.2 ).clamp( 0, 1 ).sqrt();
		const r = u.strandW.mul( 0.5 ).mul( hash1( vec2( si, 2.2 ) ).mul( 0.3 ).add( 0.85 ) ).mul( mix( float( 1 ), float( 1.6 ), guard ) ).mul( taper.mul( 0.8 ).add( 0.2 ) );
		const rEff = r.max( fp );
		const dist = f.abs().mul( spacing );
		const cov = clamp( rEff.sub( dist ).div( fp ).add( 0.5 ), 0, 1 ).mul( r.div( rEff ) ).mul( step( 0.015, t ) );
		const q = f.mul( spacing ).div( rEff ).clamp( - 0.95, 0.95 );
		const hq = sqrt( float( 1 ).sub( q.mul( q ) ) );
		const sStrand = across.mul( q.div( hq ).negate().mul( 0.6 ) );
		// Colour along the hair: root colour, lighter tip, agouti band.
		const band = smoothstep( 0.55, 0.62, t ).mul( float( 1 ).sub( smoothstep( 0.78, 0.85, t ) ) ).mul( u.bands );
		const sCol = mix( mix( u.color, u.tipColor, t.mul( t ) ), u.bandColor, band )
			.mul( hs.x.sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
		const strandCol = mix( sCol, u.guardColor, guard ).mul( hq.mul( 0.45 ).add( 0.55 ) ).mul( 0.85 + 0.075 * k );
		col = mix( col, strandCol, cov );
		slope = mix( slope, sStrand, cov );

	}

	// Crimp seen at lock scale: the waves of a fleece lock catch the light
	// in bands across it.
	const crimpShade = sin( x.div( u.crimpM ).mul( Math.PI * 2 ).add( lid.mul( 1.7 ) ) ).mul( u.crimp ).mul( 0.18 ).mul( fadeIn( u.crimpM, fp, 1.0, 3.0 ) ).add( 1 );
	const color = mix( meanCol.mul( 0.82 ), col, wS ).mul( mix( float( 1 ).sub( u.lockDepth.mul( 0.25 ) ), lockShade, wL ) ).mul( crimpShade );
	const sCrimp = across.mul( cos( x.div( u.crimpM ).mul( Math.PI * 2 ).add( lid.mul( 1.7 ) ) ).mul( u.crimp ).mul( 0.35 ) ).mul( fadeIn( u.crimpM, fp, 1.0, 3.0 ) );
	const total = slope.mul( wS ).add( sLock ).add( sCrimp );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, total, tangentView, bitangentView ).toVar( 'ix_normal' );
	const s2 = float( 1 ).sub( wS ).mul( 0.05 );
	const roughnessNode = specularAA( composeRoughness( u.roughness, s2 ), normalNode );
	const nodes = {
		colorNode: color, normalNode, roughnessNode, metalnessNode: float( 0 ),
		sheenNode: meanCol.mul( u.sheen ), sheenRoughnessNode: float( 0.4 ),
		// Stretched highlight: anisotropy along the strand, in tangent space.
		// Only where single strands show: far away the stretched lobe over
		// the lock relief aliased into dashes.
		anisotropyNode: tangent.mul( u.aniso ).mul( wS ),
	};
	applySurface( nodes, u.surface, { cavity: float( 1 ).sub( lockShade ).mul( wL ), flatNormal: base, porosity: 0.5 } );
	nodes.debug = { fp, w1: wL, w2: wS, w3: wS, covered: float( 1 ) };
	return nodes;

}
