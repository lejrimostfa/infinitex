// Camera path and captions for the zoom film (and the "Zoom" button).
// k in [0, 1] runs from the whole mannequin to the wool fibers on the chest.
// k > 1 holds at the fibers while the camera keeps turning.
// The near part of the path is locked to one vertex of the skinned torso,
// so the camera rides the sweater while it moves.
// Captions and the scale bar are DOM nodes: the film recorder screenshots
// the page, so they land in the video.

import * as THREE from 'three/webgpu';

const sstep = ( a, b, x ) => {

	const t = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) );
	return t * t * ( 3 - 2 * t );

};

export const FILM = { dFar: 3.2, dNear: 6.5e-4, tilt: 38 * Math.PI / 180, spin: 0.55 };

const CAPTIONS = [
	[ 0.55, 'A wool sweater, 100% procedural' ],
	[ 0.075, 'The jersey stitches' ],
	[ 0.011, 'Each stitch: a yarn of 3 twisted plies' ],
	[ 0.0026, 'The plies and their fuzz' ],
	[ 0, 'Wool fibres, 21 µm' ],
];
const BARS = [ 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 5e-3, 2e-3, 1e-3, 5e-4, 2e-4, 1e-4, 5e-5 ];
const label = ( m ) => m >= 0.01 ? `${ +( m * 100 ).toFixed( 1 ) } cm` : m >= 1e-3 ? `${ +( m * 1000 ).toFixed( 1 ) } mm` : `${ Math.round( m * 1e6 ) } µm`;

// anchor: { mesh, tri: [ i0, i1, i2 ], uvName, outward }. The camera locks
// onto that triangle of the (skinned) mesh; its frame comes from the
// triangle's knit coordinates, so the camera turns with the wales.
export function createFilm( { camera, scene, anchor: A, farTarget, farDir, captions = CAPTIONS } ) {

	const p = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3();
	const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
	const tU = new THREE.Vector3(), tV = new THREE.Vector3(), n = new THREE.Vector3();
	const uvA = A.mesh.geometry.attributes[ A.uvName ];
	const [ i0, i1, i2 ] = A.tri;
	const d1 = [ uvA.getX( i1 ) - uvA.getX( i0 ), uvA.getY( i1 ) - uvA.getY( i0 ) ];
	const d2 = [ uvA.getX( i2 ) - uvA.getX( i0 ), uvA.getY( i2 ) - uvA.getY( i0 ) ];
	const det = d1[ 0 ] * d2[ 1 ] - d2[ 0 ] * d1[ 1 ];
	const target = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3();
	let faceSign = 1;

	// Surface frame at the anchor triangle, skinned on the CPU:
	// dP/du and dP/dv from the edges and their knit coordinate deltas.
	function anchor() {

		A.mesh.getVertexPosition( i0, p );
		A.mesh.getVertexPosition( i1, p1 );
		A.mesh.getVertexPosition( i2, p2 );
		A.mesh.localToWorld( p );
		A.mesh.localToWorld( p1 );
		A.mesh.localToWorld( p2 );
		e1.subVectors( p1, p );
		e2.subVectors( p2, p );
		tU.copy( e1 ).multiplyScalar( d2[ 1 ] ).addScaledVector( e2, - d1[ 1 ] ).divideScalar( det ).normalize();
		tV.copy( e2 ).multiplyScalar( d1[ 0 ] ).addScaledVector( e1, - d2[ 0 ] ).divideScalar( det ).normalize();
		// The face normal from the winding: it never flips with the pose.
		// (A sign picked from a rough "outward" hint flipped on a curved
		// cheek and put the camera inside the head.)
		n.crossVectors( e1, e2 ).normalize().multiplyScalar( faceSign );
		tV.crossVectors( n, tU ).normalize();
		p.add( p1 ).add( p2 ).divideScalar( 3 );

	}

	// Decide once, in the current pose, which side of the face is outside.
	anchor();
	if ( n.dot( A.outward ) < 0 ) faceSign = - 1;

	// Returns the distance to the surface, for the clip planes.
	function pose( k ) {

		scene.updateMatrixWorld( true );
		anchor();
		const e = 0.5 - 0.5 * Math.cos( Math.PI * Math.min( 1, k ) );
		const d = Math.exp( Math.log( FILM.dFar ) * ( 1 - e ) + Math.log( FILM.dNear ) * e );
		const m = sstep( Math.log( 1.4 ), Math.log( 0.12 ), Math.log( d ) );
		// Near direction: tilted up from the normal, slowly turning around it.
		const a = FILM.spin * e + 0.6 * Math.max( 0, k - 1 ); // k > 1: hold and keep turning
		const side = tV.clone().multiplyScalar( 0.75 ).addScaledVector( tU, 0.66 ).normalize().applyAxisAngle( n, a );
		const nearDir = n.clone().multiplyScalar( Math.cos( FILM.tilt ) ).addScaledVector( side, Math.sin( FILM.tilt ) ).normalize();
		target.lerpVectors( farTarget, p, m );
		dir.lerpVectors( farDir, nearDir, m ).normalize();
		up.set( 0, 1, 0 ).lerp( tV.clone().applyAxisAngle( n, a ), m ).normalize();
		camera.position.copy( target ).addScaledVector( dir, d );
		camera.up.copy( up );
		camera.lookAt( target );
		camera.near = 1e-6; // reversed float depth: fixed planes are fine
		camera.far = 100;
		camera.updateProjectionMatrix();
		return d;

	}

	const cap = document.getElementById( 'film-cap' );
	const bar = document.getElementById( 'film-bar' );
	function overlay( d ) {

		const H = 2 * d * Math.tan( camera.fov * Math.PI / 360 );
		let html = '';
		let hi = Infinity;
		for ( const [ lo, text ] of captions ) {

			// Fade over a quarter decade at each band edge.
			const o = Math.min( lo > 0 ? sstep( 0, 0.25, Math.log10( H / lo ) ) : 1, sstep( 0, 0.25, Math.log10( hi / H ) ) );
			if ( o > 0.01 ) html += `<div style="opacity:${ o.toFixed( 3 ) }">${ text }</div>`;
			hi = lo;

		}

		cap.innerHTML = html;
		const pxPerM = innerHeight / H;
		const m = BARS.find( ( b ) => b * pxPerM <= innerWidth * 0.2 ) ?? BARS[ BARS.length - 1 ];
		bar.innerHTML = `<i style="width:${ ( m * pxPerM ).toFixed( 1 ) }px"></i><span>${ label( m ) }</span>`;

	}

	return { pose, overlay };

}
