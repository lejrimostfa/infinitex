// CPU side of the 3D hair: the window of strands around the point the
// camera looks at, rebuilt before each render.
//
// The view ray hits the host mesh at P. The surface under the window is the
// tangent plane at P: T and B are dP / dcoords of the hit triangle, N its
// normal. The window must cover what the camera sees around P plus the reach
// of a hair. When it grows beyond G x G fine cells, the grid coarsens by
// powers of two (level, frac), see hair3d.js.
//
// Also kept here, in the host's local space: the camera position and the
// direction toward the main light (for the shadows the strands cast).
//
// Event bus: none. hair3d.js calls update() from onBeforeRender.

import { Raycaster, Vector2, Vector3, Matrix4 } from 'three/webgpu';
import { uniform } from 'three/tsl';

export const MAXK = 10; // coarsest level: 2^10 fine cells per window cell

export function createHairWindow( spec, { host, metersPerUV: mpu, grid: G } ) {

	const u = {
		P0: uniform( new Vector3() ), T: uniform( new Vector3() ), B: uniform( new Vector3() ), N: uniform( new Vector3() ),
		c0: uniform( new Vector2() ), // coords at P0
		centre: uniform( new Vector2() ), // window centre cell, at level k
		level: uniform( 0 ), frac: uniform( 0 ), cell: uniform( 1e-3 ), s0: uniform( 1e-3 ),
		radius: uniform( 1 ), // strands fade out beyond this distance from c0
		pxAngle: uniform( 1e-3 ), // pixel size per meter of depth
		camLocal: uniform( new Vector3() ),
		lightLocal: uniform( new Vector3( 0, 0, 1 ) ), // toward the main light
		lightOn: uniform( 0 ), // 1 when a directional light exists
		boxMin: uniform( new Vector2( - 1e9, - 1e9 ) ), boxMax: uniform( new Vector2( 1e9, 1e9 ) ), // roots stay in the hit region
	};

	const ray = new Raycaster();
	const inv = new Matrix4(), v = new Vector3(), dirW = new Vector3(), lw = new Vector3(), tw = new Vector3();
	const e1 = new Vector3(), e2 = new Vector3();
	const pa = new Vector3(), pb = new Vector3(), pc = new Vector3();
	const ua = new Vector2(), ub = new Vector2(), uc = new Vector2();

	// The strands stand on the tangent plane of the hit point. That plane
	// runs past the edges of the surface, so roots are kept inside the
	// coords box of the flat region around the hit triangle: triangles
	// reached through shared vertices whose normal stays within ~15 degrees.
	// Cached per region, so each face is walked once.
	const regionOf = new Map();
	const region = ( g, f0 ) => {

		if ( regionOf.has( f0 ) ) return regionOf.get( f0 );
		const idx = g.index, pAt = g.attributes.position, uAt = g.attributes.uv;
		if ( ! idx ) return null;
		const nTri = idx.count / 3;
		const triN = ( f, out ) => {

			pa.fromBufferAttribute( pAt, idx.getX( f * 3 ) ); pb.fromBufferAttribute( pAt, idx.getX( f * 3 + 1 ) ); pc.fromBufferAttribute( pAt, idx.getX( f * 3 + 2 ) );
			return out.subVectors( pb, pa ).cross( e2.subVectors( pc, pa ) ).normalize();

		};
		if ( ! g.userData.ixVertTris ) {

			const vt = Array.from( { length: pAt.count }, () => [] );
			for ( let f = 0; f < nTri; f ++ ) for ( let k = 0; k < 3; k ++ ) vt[ idx.getX( f * 3 + k ) ].push( f );
			g.userData.ixVertTris = vt;

		}

		const vt = g.userData.ixVertTris, n0 = triN( f0, new Vector3() ), n = new Vector3();
		const seen = new Set( [ f0 ] ), stack = [ f0 ], box = { min: new Vector2( Infinity, Infinity ), max: new Vector2( - Infinity, - Infinity ) };
		while ( stack.length && seen.size < 50000 ) {

			const f = stack.pop();
			for ( let k = 0; k < 3; k ++ ) {

				const vi = idx.getX( f * 3 + k );
				ua.fromBufferAttribute( uAt, vi ).multiplyScalar( mpu );
				box.min.min( ua ); box.max.max( ua );
				for ( const t of vt[ vi ] ) if ( ! seen.has( t ) && triN( t, n ).dot( n0 ) > 0.966 ) { seen.add( t ); stack.push( t ); }

			}

		}

		for ( const f of seen ) regionOf.set( f, box );
		return box;

	};

	// The brightest directional light casts the strand shadows.
	const mainLight = ( scene ) => {

		let best = null;
		scene?.traverseVisible( ( o ) => {

			if ( o.isDirectionalLight && ( ! best || o.intensity > best.intensity ) ) best = o;

		} );
		return best;

	};

	// Returns false when there is nothing to draw: the camera looks away, or
	// a strand would be thinner than 1/20 pixel (the alpha test drops it).
	const update = ( camera, viewportH, scene ) => {

		camera.getWorldDirection( dirW );
		ray.set( camera.getWorldPosition( v ), dirW );
		const hit = ray.intersectObject( host, false )[ 0 ];
		const px = 2 * Math.tan( camera.fov * Math.PI / 360 ) / viewportH;
		if ( ! hit || spec.strandW.value / ( hit.distance * px ) < 0.05 ) {

			if ( spec.paintedShare ) spec.paintedShare.value = 1;
			return false;

		}

		inv.copy( host.matrixWorld ).invert();
		u.camLocal.value.copy( v ).applyMatrix4( inv );
		u.P0.value.copy( hit.point ).applyMatrix4( inv );
		u.c0.value.copy( hit.uv ).multiplyScalar( mpu );

		const light = mainLight( scene );
		u.lightOn.value = light ? 1 : 0;
		if ( light ) {

			light.getWorldPosition( lw );
			light.target.getWorldPosition( tw );
			u.lightLocal.value.subVectors( lw, tw ).transformDirection( inv );

		}

		// Tangent frame dP / dcoords from the hit triangle.
		const g = host.geometry, pAt = g.attributes.position, uAt = g.attributes.uv;
		pa.fromBufferAttribute( pAt, hit.face.a ); pb.fromBufferAttribute( pAt, hit.face.b ); pc.fromBufferAttribute( pAt, hit.face.c );
		ua.fromBufferAttribute( uAt, hit.face.a ).multiplyScalar( mpu ); ub.fromBufferAttribute( uAt, hit.face.b ).multiplyScalar( mpu ); uc.fromBufferAttribute( uAt, hit.face.c ).multiplyScalar( mpu );
		e1.subVectors( pb, pa ); e2.subVectors( pc, pa );
		const du1 = ub.x - ua.x, dv1 = ub.y - ua.y, du2 = uc.x - ua.x, dv2 = uc.y - ua.y;
		const det = du1 * dv2 - du2 * dv1 || 1e-12;
		u.T.value.copy( e1 ).multiplyScalar( dv2 ).addScaledVector( e2, - dv1 ).divideScalar( det );
		u.B.value.copy( e2 ).multiplyScalar( du1 ).addScaledVector( e1, - du2 ).divideScalar( det );
		u.N.value.copy( e1 ).cross( e2 ).normalize();
		const box = region( g, hit.faceIndex );
		if ( box ) { u.boxMin.value.copy( box.min ); u.boxMax.value.copy( box.max ); } else { u.boxMin.value.set( - 1e9, - 1e9 ); u.boxMax.value.set( 1e9, 1e9 ); }

		// Window: what the camera sees around P, plus the reach of a hair.
		const half = hit.distance * Math.tan( camera.fov * Math.PI / 360 ) * Math.max( 1, camera.aspect ) * 1.3;
		const need = half + spec.lengthM.value * 1.3;
		const fineSpacing = 1 / Math.sqrt( spec.density.value );
		const lv = Math.max( 0, Math.log2( need / ( G / 2 * fineSpacing ) ) );
		const kk = Math.min( MAXK, Math.floor( lv ) );
		u.level.value = kk;
		u.frac.value = kk === MAXK ? 0 : lv - kk;
		u.s0.value = fineSpacing;
		u.cell.value = fineSpacing * 2 ** kk;
		u.centre.value.set( Math.floor( u.c0.value.x / u.cell.value ), Math.floor( u.c0.value.y / u.cell.value ) );
		u.radius.value = need;
		u.pxAngle.value = px;
		// Painted hairs (skin) fill in for the 3D strands the coarse levels
		// leave out: 3D keeps 4^-lv of the roots.
		if ( spec.paintedShare ) spec.paintedShare.value = 1 - 4 ** - lv;
		return true;

	};

	return { u, update };

}
