// Shadows the 3D strands cast on the surface they grow from.
//
// The surface under the window is a plane (see hair3d_window.js), so the
// shadow of a strand is exact: each strand vertex is projected along the
// main light onto that plane, and the same ribbon is drawn there in black,
// alpha blended, on both sides (lying flat, its winding may face the skin). Overlapping shadows multiply, like transmittance does.
// The penumbra grows with the height of the point above the surface, so a
// shadow is sharp at the root and soft toward the tip, where it stops.
//
// Event bus: none. hair3d.js adds this mesh next to the strands.

import { InstancedMesh, MeshBasicNodeMaterial, DoubleSide } from 'three/webgpu';
import { float, vec3, step, smoothstep, varying, transformDirection, modelViewMatrix } from 'three/tsl';

const PENUMBRA = 0.03; // tan of the light's apparent radius (soft sky sun)

export function createHairShadow( S, u, spec, geometry, count ) {

	const N = S.N, L = u.lightLocal.normalize();
	const cosL = L.dot( N ).toVar();
	const c = cosL.max( 0.2 );
	// Onto the plane, along the light, then a hair above it against z-fighting.
	const depthCam = u.camLocal.sub( S.pos ).length();
	const lift = depthCam.mul( 2e-4 ).max( 2e-6 );
	const ground = S.pos.sub( L.mul( S.height.div( c ) ) ).add( N.mul( lift ) );
	// Strand direction on the plane, the ribbon lies flat across it.
	const tp = S.tangent.sub( L.mul( S.tangent.dot( N ).div( c ) ) );
	const side = N.cross( tp ).normalize();
	const w = S.r.add( S.height.div( c ).mul( PENUMBRA ) );
	// Cost: a shadow blurred to many times its strand width is faint and
	// covers a lot of screen; thousands of them overlap (60 ms on close
	// fur). Only the sharp part near the root is drawn: the contact shadow.
	// Strands far thinner than a pixel cast none (hair3d.js also skips the
	// whole draw at coarse levels).
	const sharp = S.r.max( depthCam.mul( u.pxAngle ) );
	const wFull = w.max( depthCam.mul( u.pxAngle ) ).max( 1e-12 );
	const keep = step( 1e-9, S.r ).mul( step( w, sharp.mul( 4 ) ) ).mul( step( 0.15, S.r.div( sharp ) ) );
	const wEff = wFull.mul( keep );
	const positionNode = ground.add( side.mul( wEff ).mul( S.across ) );

	const material = new MeshBasicNodeMaterial( { transparent: true, side: DoubleSide } );
	material.positionNode = positionNode;
	material.colorNode = vec3( 0 );
	// Dark where the strand covers the whole width, lighter as it blurs;
	// none when the light grazes the surface or comes from behind it. The
	// sky still lights a shadow (0.45 at most), and in dense hair thousands
	// of shadows overlap: each one is lighter so the floor stays readable.
	const tau = spec.density.mul( spec.lengthM ).mul( spec.strandW ).mul( 0.5 );
	material.opacityNode = S.r.div( wFull ).mul( keep ).mul( float( 0.45 ).div( tau.max( 1 ).sqrt() ) ).mul( smoothstep( 0.05, 0.3, cosL ) ).mul( u.lightOn ).clamp( 0, 1 );
	material.depthWrite = false;
	// The strand geometry has no normals. A post pass that stores view
	// normals (GTAO) would get zeros under every shadow and turn it black:
	// give it the surface normal instead, so blending leaves it unchanged.
	const nView = varying( transformDirection( N, modelViewMatrix ), 'ix_hs_n' );
	material.setupNormal = () => nView.normalize();
	material.polygonOffset = true;
	material.polygonOffsetFactor = - 1;
	material.polygonOffsetUnits = - 1;

	const mesh = new InstancedMesh( geometry, material, count );
	mesh.frustumCulled = false;
	mesh.renderOrder = - 1; // before the strands, after the opaque host
	return mesh;

}
