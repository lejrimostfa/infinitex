// Shading of the 3D strands: shape across the ribbon, colour, and how light
// goes through the hair layer.
//
//   cylinder   the ribbon is drawn as a round fibre: normal across it,
//              coverage from the distance to the fibre centre (with crimp)
//   shadow     light reaching a point deep in the layer crossed the strands
//              above it: transmittance exp(-tau * depth / cos), tau from the
//              density, length and width of the hair (deep opacity, done
//              analytically since the layer is a slab). Below the surface
//              the body blocks the light.
//   occlusion  the same depth darkens the ambient light (aoNode)
//   depth tint light scattered many times inside the hair comes out more
//              saturated: deep strands look darker and richer
//   translucency  light from behind goes through the fibres (TT lobe of
//              Marschner's fibre model, tinted by the fibre)
//   second highlight  light reflected inside the fibre (TRT): a broad
//              coloured highlight along the strand (Kajiya-Kay)
//
// Event bus: none.

import { MeshPhysicalNodeMaterial, PhysicalLightingModel, DoubleSide } from 'three/webgpu';
import {
	varying, vec3, vec4, float, exp, sin, sqrt, mix, smoothstep, clamp, pow,
	positionView, positionViewDirection, normalView, modelViewMatrix, transformDirection,
} from 'three/tsl';

class HairLightingModel extends PhysicalLightingModel {

	constructor( h ) {

		super();
		this.h = h;

	}

	direct( args, builder ) {

		const { lightDirection, lightColor, reflectedLight } = args;
		const h = this.h;
		const cosL = h.nView.dot( lightDirection );
		// Through the strands above, and not through the body.
		const tr = mix( float( 0.3 ), float( 1 ), exp( h.tau.mul( h.depth ).div( cosL.max( 0.2 ) ).mul( - 0.5 ) ) ).mul( smoothstep( - 0.15, 0.1, cosL ) ).toVar();
		const lc = lightColor.mul( tr ).toVar();
		super.direct( { ...args, lightColor: lc }, builder );

		// Translucency (TT lobe, Marschner): light goes through the fibre and
		// leaves on the other side. Along the strand it exits at the mirror
		// angle (sinI + sinO = 0, widened by the cuticle tilt); around the
		// strand it comes out opposite to where it entered.
		const V = positionViewDirection, T = h.tView;
		const sinI = T.dot( lightDirection ), sinO = T.dot( V );
		const M = exp( sinI.add( sinO ).pow( 2 ).div( - 0.25 ) );
		const Lp = lightDirection.sub( T.mul( sinI ) ).normalize(), Vp = V.sub( T.mul( sinO ) ).normalize();
		const behind = Lp.dot( Vp ).negate().clamp();
		reflectedLight.directDiffuse.addAssign( lc.mul( h.ttColor ).mul( M ).mul( behind.mul( behind ) ).mul( 4 ) );

		// Second highlight along the strand, shifted toward the root side.
		const t2 = h.tView.add( h.nView.mul( 0.15 ) ).normalize();
		const H = lightDirection.add( positionViewDirection ).normalize();
		const tH = t2.dot( H );
		const sinTH = sqrt( float( 1 ).sub( tH.mul( tH ) ).max( 0 ) );
		const kk = pow( sinTH, h.trtExp ).mul( normalView.dot( lightDirection ).clamp().mul( 0.7 ).add( 0.3 ) );
		reflectedLight.directSpecular.addAssign( lc.mul( h.trtColor ).mul( kk ) );

	}

}

// S: strand nodes from hair3d.js (vertex stage). spec: hair uniforms.
export function createHairMaterial( S, spec ) {

	// Fragment inputs.
	const across = varying( S.across, 'ix_h_across' );
	const sideV = varying( transformDirection( S.side, modelViewMatrix ), 'ix_h_side' );
	const alphaV = varying( S.r.div( S.rEff.max( 1e-12 ) ), 'ix_h_alpha' );
	const wV = varying( vec4( S.halfW, S.rEff, S.rPix, S.amp ), 'ix_h_w' );
	const phV = varying( S.phase, 'ix_h_phase' );
	const sV = varying( S.s, 'ix_h_s' );
	const hV = varying( vec3( S.hA.z, S.hB.x, S.guard ), 'ix_h_rand' );
	const depth = varying( S.depth, 'ix_h_depth' );
	const nView = varying( transformDirection( S.N, modelViewMatrix ), 'ix_h_n' ).normalize();
	const tView = varying( transformDirection( S.tangent, modelViewMatrix ), 'ix_h_t' ).normalize();

	// Distance to the fibre centre, in units of its radius.
	const off = across.mul( wV.x ).sub( sin( phV ).mul( wV.w ) );
	const q = off.div( wV.y.max( 1e-12 ) ).clamp( - 1, 1 );
	const cov = clamp( wV.y.sub( off.abs() ).div( wV.z.max( 1e-12 ) ).add( 0.5 ), 0, 1 );
	const toCamV = positionView.negate().normalize();
	const normalNode = sideV.normalize().mul( q ).add( toCamV.mul( sqrt( float( 1 ).sub( q.mul( q ) ).max( 0 ) ) ) ).normalize();

	const t = sV;
	const band = smoothstep( 0.55, 0.62, t ).mul( float( 1 ).sub( smoothstep( 0.78, 0.85, t ) ) ).mul( spec.bands );
	const sCol = mix( mix( spec.color, spec.tipColor, t.mul( t ) ), spec.bandColor, band ).mul( hV.y.sub( 0.5 ).mul( spec.colorVar ).add( 1 ) );
	const albedo = mix( sCol, spec.guardColor, hV.z ).max( vec3( 1e-3 ) ).toVar();
	const colorNode = pow( albedo, depth.mul( 0.35 ).add( 1 ) );
	// Hairs right in front of a macro camera would be huge blurred bars.
	const near = smoothstep( 4e-4, 9e-4, positionView.z.negate() );
	const opacityNode = alphaV.mul( near ).mul( cov );

	// Optical depth of the whole layer: strands crossed per unit area, half
	// the light passes between or around them (forward scattering). Capped,
	// with a floor for the light scattered many times: the 3D strands are
	// the top of the hair, lighter than the painted layers under them.
	const tau = spec.density.mul( spec.lengthM ).mul( spec.strandW ).mul( 0.5 ).clamp( 0.2, 3 );
	const aoNode = mix( float( 0.4 ), float( 1 ), exp( tau.mul( depth ).mul( - 0.5 ) ) );
	const exponent = float( 2 ).div( spec.roughness.mul( spec.roughness ).max( 0.01 ) ).clamp( 4, 200 );

	const material = new MeshPhysicalNodeMaterial( { side: DoubleSide, transparent: true } );
	Object.assign( material, {
		positionNode: S.positionNode, normalNode, colorNode, opacityNode, aoNode,
		roughnessNode: spec.roughness, metalnessNode: float( 0 ),
	} );
	const shading = {
		nView, tView, depth, tau,
		ttColor: pow( albedo, 0.6 ).mul( 0.9 ),
		trtColor: albedo.mul( 0.6 ),
		trtExp: exponent.mul( 0.25 ),
	};
	material.setupLightingModel = () => new HairLightingModel( shading );
	material.depthWrite = true;
	material.alphaTest = 0.02;
	return material;

}
