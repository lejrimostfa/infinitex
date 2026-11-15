// Near level of every hairy matter: real 3D strands that grow out of the
// surface along its normal, then bend over in the comb direction.
//
// Cost stays bounded at any zoom. One instanced draw of G x G strands. The
// strands live in a window around the point the camera looks at, rebuilt
// every frame from hashes of their root cell: the same strand always comes
// back at the same place, so nothing flickers while the camera moves.
//
// Nested grids. Roots sit one per fine cell (spacing s0 = real density).
// When the window must grow beyond G x G fine cells, the grid coarsens by
// powers of two. Each coarse cell keeps the strand of one of its 4 children
// (chosen by hash), so a coarse level is a subset of the finer one. Between
// two levels the strands that will not survive thin out and vanish. The
// painted strands of the base material fill the gaps: they are the deep
// layers of the same hair.
//
// Modules: hair3d_window.js (CPU window from the camera), hair3d_shade.js
// (fibre shading, self-shadow, occlusion, translucency), hair3d_shadow.js
// (shadows cast on the surface).
//
// Event bus: none. The owner (InfinitexMaterial.createHair) adds the mesh.
// onBeforeRender of the host, the strands and the shadows updates the
// window from the camera, once per camera and frame.

import { BufferGeometry, BufferAttribute, Vector2, InstancedMesh } from 'three/webgpu';
import {
	attribute, instanceIndex, vec2, float, floor, mod, exp, sin, cos, sqrt, mix, step, smoothstep,
} from 'three/tsl';
import { hash3, valueNoise } from './hash.js';
import { createHairWindow, MAXK } from './hair3d_window.js';

// A post pipeline may draw the strands apart (demo/post.js keeps them out
// of screen-space AO): it finds them by userData.hairStrands.
export const HAIR_LAYER = 7;
import { createHairMaterial } from './hair3d_shade.js';
import { createHairShadow } from './hair3d_shadow.js';

// One strand: SEG + 1 rings of two vertices. s in 0..1 root to tip,
// side -1 / 1 across the ribbon.
function strandGeometry( SEG ) {

	const n = ( SEG + 1 ) * 2;
	const s = new Float32Array( n ), side = new Float32Array( n ), pos = new Float32Array( n * 3 );
	for ( let i = 0; i <= SEG; i ++ ) {

		s[ i * 2 ] = s[ i * 2 + 1 ] = i / SEG;
		side[ i * 2 ] = - 1; side[ i * 2 + 1 ] = 1;

	}

	const idx = [];
	for ( let i = 0; i < SEG; i ++ ) {

		const a = i * 2;
		idx.push( a, a + 1, a + 2, a + 1, a + 3, a + 2 );

	}

	const g = new BufferGeometry();
	g.setAttribute( 'position', new BufferAttribute( pos, 3 ) );
	g.setAttribute( 'hs', new BufferAttribute( s, 1 ) );
	g.setAttribute( 'hside', new BufferAttribute( side, 1 ) );
	g.setIndex( idx );
	return g;

}

export function createHair3D( spec, opts ) {

	const G = opts.grid ?? 128;
	const host = opts.host;
	const win = createHairWindow( spec, { host, metersPerUV: opts.metersPerUV, grid: G } );
	const { P0, T, B, N, c0, centre, level, frac, s0, radius, pxAngle, camLocal } = win.u;

	// Instance -> cell at level k -> fine cell (descend by hash).
	const i = float( instanceIndex );
	const C = centre.add( vec2( mod( i, G ), floor( i.div( G ) ) ).sub( G / 2 ) ).toVar();
	let c = C;
	for ( let j = MAXK; j >= 1; j -- ) {

		const h = floor( hash3( c.add( j * 37.17 ).add( spec.seed ) ).xy.mul( 2 ) );
		c = mix( c, c.mul( 2 ).add( h ), step( j, level ) );

	}

	const fine = c.toVar();
	// Survives at level k + 1? Else it thins out as frac goes to 1.
	const parent = floor( C.div( 2 ) );
	const hp = floor( hash3( parent.add( level.add( 1 ).mul( 37.17 ) ).add( spec.seed ) ).xy.mul( 2 ) );
	const same = step( C.sub( parent.mul( 2 ).add( hp ) ).abs().dot( vec2( 1 ) ), 0.5 );
	const keep = mix( float( 1 ).sub( frac ), float( 1 ), same );

	// Root in coords (meters), its per-strand randoms.
	const hA = hash3( fine.add( spec.seed.mul( 7 ) ) ), hB = hash3( fine.add( 91.7 ).add( spec.seed ) );
	const rc = fine.add( hA.xy ).mul( s0 ).toVar();
	const dc = rc.sub( c0 );
	const root = P0.add( T.mul( dc.x ) ).add( B.mul( dc.y ) );
	const inBox = step( win.u.boxMin, rc ).mul( step( rc, win.u.boxMax ) );
	const edge = smoothstep( radius, radius.mul( 0.8 ), dc.length() ).mul( inBox.x ).mul( inBox.y );

	// Comb direction: preset angle, bent by the same smooth flow as the
	// painted strands, plus a small jitter per strand.
	const a = spec.angle.add( valueNoise( rc.div( spec.flowM ).add( spec.seed ) ).sub( 0.5 ).mul( spec.flowAmt ).mul( 2 ) ).add( hB.x.sub( 0.5 ).mul( 0.5 ) );
	const dir = T.mul( cos( a ) ).add( B.mul( sin( a ) ) ).normalize();
	const lat = N.cross( dir );
	// Lock this strand belongs to: one per lockM cell, its root jittered.
	const lockC = floor( rc.div( spec.lockM ) );
	const lockRoot = lockC.add( hash3( lockC.add( spec.seed.mul( 3 ) ) ).xy ).mul( spec.lockM );
	const ld = lockRoot.sub( rc );
	const lockOff = T.mul( ld.x ).add( B.mul( ld.y ) );

	// Shape: height rises at the root angle and settles at pile * length.
	const L = spec.lengthM.mul( hB.y.mul( 0.6 ).add( 0.7 ) );
	const H = L.mul( spec.pile ).mul( hB.z.mul( 0.5 ).add( 0.75 ) ).max( 1e-6 );
	const k = L.mul( spec.stand.tan() ).div( H );
	const Lx = L.mul( sqrt( float( 1 ).sub( spec.pile.mul( spec.pile ) ).max( 0.05 ) ) );
	const s = attribute( 'hs', 'float' );
	const curve = ( t ) => {

		// Clumping: the strand drifts toward the root of its lock, so the
		// tips of one lock meet and the locks part from each other.
		const pull = lockOff.mul( spec.clump.mul( t.mul( 2 ).min( 1 ) ) );
		return root.add( N.mul( H.mul( float( 1 ).sub( exp( k.mul( t ).negate() ) ) ) ) ).add( dir.mul( Lx.mul( t ) ) ).add( pull );

	};

	const pos = curve( s );
	const tangent = curve( s.add( 0.02 ) ).sub( curve( s.sub( 0.02 ) ) ).normalize();
	const toCam = camLocal.sub( pos ).normalize();
	const side = tangent.cross( toCam ).normalize();

	// Width: tapered hair, guard hairs thicker. At least one pixel wide; a
	// thinner hair is widened and made transparent by the same ratio.
	const guard = step( hA.z, spec.guard );
	const taper = float( 1 ).sub( s ).div( 0.25 ).clamp( 0, 1 ).sqrt().mul( 0.85 ).add( 0.15 );
	const r = spec.strandW.mul( 0.5 ).mul( hB.x.mul( 0.3 ).add( 0.85 ) ).mul( mix( float( 1 ), float( 1.6 ), guard ) ).mul( taper ).mul( keep ).mul( edge );
	const depth = camLocal.sub( pos ).length();
	const rPix = depth.mul( pxAngle );
	const rEff = r.max( rPix ).mul( step( 1e-9, r ) );
	// Crimp (wool waves) is drawn inside a wider ribbon by the fragment
	// stage: 28 waves on a fleece fibre would need 100+ segments. The wave
	// runs across the strand on the surface (lat), seen through the ribbon.
	const phase = s.mul( L ).div( spec.crimpM ).mul( Math.PI * 2 ).add( hA.z.mul( 6.28 ) );
	const amp = spec.crimp.mul( spec.crimpM ).mul( 0.3 ).mul( s.mul( 8 ).min( 1 ) ).mul( lat.dot( side ) );
	const halfW = rEff.add( amp.abs() );
	const positionNode = pos.add( side.mul( halfW ).mul( attribute( 'hside', 'float' ) ) );

	// Depth into the layer, 0 at the top of the pile, 1 at the skin.
	const height = H.mul( float( 1 ).sub( exp( k.mul( s ).negate() ) ) );
	const depthIn = float( 1 ).sub( height.div( spec.lengthM.mul( spec.pile ).mul( 1.2 ) ) ).clamp( 0, 1 );

	const S = {
		positionNode, pos, tangent, side, halfW, rEff, rPix, amp, r, phase, s, hA, hB, guard, N, height,
		depth: depthIn, across: attribute( 'hside', 'float' ),
	};
	const geometry = strandGeometry( opts.segments ?? 12 );
	const mesh = new InstancedMesh( geometry, createHairMaterial( S, spec ), G * G );
	mesh.frustumCulled = false;
	mesh.name = `${ host.name }_hair3d`;
	mesh.userData.hairStrands = true;
	const shadow = createHairShadow( S, win.u, spec, geometry, G * G );
	shadow.name = `${ host.name }_hair3d_shadow`;
	mesh.add( shadow );

	// The host draws first (opaque): it updates the window, so its painted
	// hairs know this frame's share. The strands and shadows update too, in
	// case the host is not drawn. Same camera and size: done once.
	const size = new Vector2();
	let lastKey = '';
	const update = ( renderer, scene, camera ) => {

		renderer.getDrawingBufferSize?.( size );
		const e = camera.matrixWorld.elements, h = host.matrixWorld.elements;
		const key = `${ camera.id } ${ size.y } ${ camera.fov } ${ e.join() } ${ h[ 12 ] } ${ h[ 13 ] } ${ h[ 14 ] }`;
		if ( key === lastKey ) return;
		lastKey = key;
		const on = win.update( camera, size.y || 1080, scene );
		mesh.count = on ? G * G : 0;
		// Shadows only while single strands show (fine levels).
		shadow.count = on && win.u.level.value < 3 ? G * G : 0;

	};

	mesh.onBeforeRender = shadow.onBeforeRender = update;
	const hostHook = host.onBeforeRender;
	host.onBeforeRender = function ( ...args ) {

		hostHook.apply( this, args );
		update( ...args );

	};
	return { mesh, shadow, update, uniforms: { level, frac, cell: win.u.cell, radius } };

}
