// Real relief up close: parallax occlusion mapping with self-shadows.
// A bump (normal) map tilts the light but the surface stays flat. Up close
// that shows: canyon floors should slide behind the ridges as the camera
// moves, ridges should hide part of the floor and cast shadows into it.
// So the view ray is marched through the family's height field, and the
// family is drawn where the ray hits it.
//   gate     the march runs only where the relief spans a few pixels
//            (depth / footprint): far views keep the plain bump, free
//   march    `steps` linear steps down to the deepest point (stop at the
//            first one inside), then 6 bisections: no terraces
//   normal   central differences of the height at the hit, one footprint
//            apart: walls become steep where the height drops
//   shadow   a second march from the hit toward the key light; a ridge
//            above the ray darkens the point (soft over 8 percent of H)
// The height callback h(q) returns metres, 0 at the top, negative below,
// never under -H. It must not use screen derivatives: it runs inside a
// loop. Use the footprint passed to the family's height() instead.

import { Vector3 } from 'three';
import { vec2, vec3, vec4, float, Fn, If, Loop, Break, uniform, smoothstep, step, clamp, mix, dot, uv, positionView, tangentView, bitangentView, tangentGeometry, normalViewGeometry, cameraViewMatrix } from 'three/tsl';
import { footprint, withFootprint, perturbNormal } from './lod.js';

// Direction toward the key light, world space. The cube demo light sits at
// (1.5, 2.5, 2.2) aiming at the origin; a game sets its own.
export const reliefLight = uniform( new Vector3( 1.5, 2.5, 2.2 ).normalize() );

export function reliefMarch( p, fp, h, H, { steps = 40, shadowSteps = 12 } = {} ) {

	// Geometry normal: the final normalView depends on this march.
	const N = normalViewGeometry, T = tangentView.normalize();
	// Own bitangent: the shared bitangentView variable, used here and in the
	// normal pass, would be declared twice in the shader.
	const B = N.cross( T ).mul( tangentGeometry.w ).normalize();
	const V = positionView.negate().normalize();
	const vt = vec3( dot( V, T ), dot( V, B ), dot( V, N ).max( 0.08 ) );
	const dir = vt.xy.div( vt.z ).negate(); // surface shift per metre of depth
	const w = smoothstep( 1.0, 4.0, H.div( fp ) ).toVar( 'ix_relief_w' );
	const Hs = H.mul( w ).max( 1e-9 ).toVar( 'ix_relief_H' );
	const depthAt = ( q ) => h( q ).negate().mul( w );
	const d2in = ( d ) => step( depthAt( p.add( dir.mul( d ) ) ), d ); // 1 if the ray at depth d is inside

	// Light in the tangent frame. The frame is computed here and passed in,
	// so its variables are declared outside the branch.
	const Lv = cameraViewMatrix.mul( vec4( reliefLight, 0 ) ).xyz.normalize();
	const lt = vec3( dot( Lv, T ), dot( Lv, B ), dot( Lv, N ).max( 0.02 ) );
	const lstep = lt.xy.div( lt.z );

	// x, y: hit point; z: depth of the hit; w: lit share (1 = not shadowed).
	const march = Fn( ( [ dir, lstep ] ) => {

		const res = vec4( p, 0, 1 ).toVar();
		If( w.greaterThan( 0 ), () => {

			// Linear search for the first step inside, then bisection between
			// the last step outside and the first inside: no terraces.
			const dA = float( 0 ).toVar(), dB = Hs.toVar();
			Loop( steps, ( { i } ) => {

				const d = float( i ).add( 1 ).div( steps ).mul( Hs );
				If( d.sub( depthAt( p.add( dir.mul( d ) ) ) ).greaterThanEqual( 0 ), () => { // the ray is inside

					dB.assign( d );
					Break();

				} );
				dA.assign( d );

			} );
			Loop( 6, () => {

				const m = dA.add( dB ).mul( 0.5 );
				const inside = d2in( m );
				dB.assign( mix( dB, m, inside ) );
				dA.assign( mix( m, dA, inside ) );

			} );
			const depth = dA.add( dB ).mul( 0.5 ).toVar();
			const hit = p.add( dir.mul( depth ) ).toVar();
			// Toward the light: is the terrain ever above the ray?
			const occ = float( 0 ).toVar();
			Loop( shadowSteps, ( { i } ) => {

				const s = float( i ).add( 1 ).div( shadowSteps ).mul( depth );
				const above = depth.sub( s ).sub( depthAt( hit.add( lstep.mul( s ) ) ) );
				occ.assign( occ.max( above.div( Hs.mul( 0.08 ) ) ) );

			} );
			res.assign( vec4( hit, depth, float( 1 ).sub( clamp( occ, 0, 1 ) ) ) );

		} );
		return res;

	} )( dir.toVar( 'ix_relief_dir' ), lstep.toVar( 'ix_relief_lstep' ) ).toVar( 'ix_relief' );

	const hit = march.xy;
	const slopeFn = Fn( () => {

		const sl = vec2( 0 ).toVar();
		If( w.greaterThan( 0 ), () => {

			const e = fp.max( Hs.mul( 0.02 ) );
			const sx = h( hit.add( vec2( e, 0 ) ) ).sub( h( hit.sub( vec2( e, 0 ) ) ) );
			const sy = h( hit.add( vec2( 0, e ) ) ).sub( h( hit.sub( vec2( 0, e ) ) ) );
			sl.assign( vec2( sx, sy ).div( e.mul( 2 ) ).mul( w ) );

		} );
		return sl;

	} );
	return { p: hit, depth: march.z, shadow: march.w, H: Hs, w, slope: slopeFn().toVar( 'ix_relief_slope' ) };

}

// Builds a family with relief (preset.relief). The family exposes
// height( u, p, fp ) -> { H, h } or null when this preset has no relief.
// It is drawn at the hit point with the footprint of the real pixel; its
// own derivative-based relief is off there (the march replaces it).
export function buildRelief( impl, uniforms, buildOpts, preset ) {

	const p = ( buildOpts.coords ?? uv() ).toVar( 'ix_relief_p' );
	const fp = footprint( p ).toVar( 'ix_relief_fp' );
	const R = impl.height?.( uniforms, p, fp );
	if ( ! R ) return impl.build( uniforms, buildOpts );
	const M = reliefMarch( p, fp, R.h, R.H, { steps: preset.relief_steps ?? 40 } );
	// Base normal from the geometry: normalView would loop back through this
	// material's own normalNode, which now depends on the march.
	const baseNormal = buildOpts.baseNormal ?? normalViewGeometry;
	const nodes = withFootprint( fp, () => impl.build( uniforms, { ...buildOpts, baseNormal, coords: M.p } ) );
	nodes.normalNode = perturbNormal( nodes.normalNode, M.slope, tangentView, bitangentView ).normalize();
	// Shadowed floors lose most of the key light; deep floors see less sky.
	nodes.colorNode = nodes.colorNode.mul( mix( float( 1 ), M.shadow, M.w.mul( 0.85 ) ) );
	const ao = float( 1 ).sub( M.depth.div( M.H ).mul( M.w ).mul( 0.6 ) );
	nodes.aoNode = nodes.aoNode ? nodes.aoNode.mul( ao ) : ao;
	return nodes;

}
