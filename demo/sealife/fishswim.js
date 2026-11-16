// Where each fish of a school is, and how it is turned, as a function of
// time only (so a frame for a given t is always the same, setTime too).
//   path      a closed loop: an ellipse { centre, radii } that rises and
//             falls twice per turn, or a stadium { centre, half, radius,
//             bob } (two straights, two round ends) run at even speed
//   lanes     each fish keeps a slot along the loop and a place in its
//             cross-section, both wander slowly; it surges ahead and drops
//             back (speed changes); the whole school speeds up and slows
//   apart     two fish never overlap: a smooth push between close pairs,
//             twice, on the positions before the frame is built
//   frame     nose along the velocity; the back leans into the turn (bank,
//             from the side acceleration); the body bends into the curve
// Writes the InstancedMesh matrices and 8 floats per fish in one
// interleaved buffer (WebGPU has 8 vertex buffers per draw):
//   swim  = ( beat phase, bend 1/m, beat amplitude, pectoral phase )
//   side  = ( side axis in mesh space, with the scale; brightness )
//
// Event bus: none (driven by the page's frame loop through update( t )).

import * as THREE from 'three/webgpu';

export function makePath( p ) {

	const [ cx, cy, cz ] = p.centre;
	if ( p.half !== undefined ) {

		// Stadium: arc length 4 h + 2 pi r, centre line along x.
		const h = p.half, r = p.radius, total = 4 * h + 2 * Math.PI * r, bob = p.bob ?? 0;
		return {
			length: total,
			at( u, out ) {

				let d = ( ( u % 1 ) + 1 ) % 1 * total;
				const y = cy + Math.sin( u * Math.PI * 4 ) * bob;
				if ( d < 2 * h ) return out.set( cx - h + d, y, cz + r );
				d -= 2 * h;
				if ( d < Math.PI * r ) { const a = d / r; return out.set( cx + h + Math.sin( a ) * r, y, cz + Math.cos( a ) * r ); }
				d -= Math.PI * r;
				if ( d < 2 * h ) return out.set( cx + h - d, y, cz - r );
				const a = ( d - 2 * h ) / r;
				return out.set( cx - h - Math.sin( a ) * r, y, cz - Math.cos( a ) * r );

			},
		};

	}

	const [ rx, ry, rz ] = p.radii;
	return {
		length: Math.PI * 2 * Math.sqrt( ( rx * rx + rz * rz ) / 2 ),
		at: ( u, out ) => { const w = u * Math.PI * 2; return out.set( cx + Math.cos( w ) * rx, cy + Math.sin( w * 2 ) * ry, cz + Math.sin( w ) * rz ); },
	};

}

// opts: { count, length, size: [ min, max ], path, period, arc, lanes:
// [ across, up ], surge (in body lengths), bankG (m/s2: the side
// acceleration that gives 45 degrees of bank), pec: pectoral beats per s }
export function createSwimmers( mesh, motion, o, rnd ) {

	const path = makePath( o.path ), up = new THREE.Vector3( 0, 1, 0 );
	const fish = Array.from( { length: o.count }, ( _, i ) => {

		const ang = rnd() * Math.PI * 2, rad = Math.sqrt( rnd() );
		return {
			slot: o.count > 1 ? ( i + rnd() * 0.8 ) / o.count * o.arc : 0, size: o.size[ 0 ] + rnd() * ( o.size[ 1 ] - o.size[ 0 ] ),
			lane: [ Math.cos( ang ) * rad * o.lanes[ 0 ], Math.sin( ang ) * rad * o.lanes[ 1 ] ],
			w: [ 0.15 + rnd() * 0.3, 0.12 + rnd() * 0.25, 0.25 + rnd() * 0.35 ], ph: [ rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28 ], tone: 0.85 + rnd() * 0.25,
		};

	} );
	const n = o.count, T = new THREE.Vector3(), N = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3();
	const P = [ 0, 1, 2 ].map( () => fish.map( () => new THREE.Vector3() ) );
	const L = o.length, minD = L * 0.75;
	// Loop fraction of fish f at time t (school speed swell plus its surge).
	const uAt = ( f, t ) => t / o.period + 0.012 * Math.sin( t * 0.31 ) + f.slot + o.surge * L / path.length * Math.sin( t * f.w[ 2 ] + f.ph[ 2 ] );

	function place( t, out ) {

		for ( let i = 0; i < n; i ++ ) {

			const f = fish[ i ], u = uAt( f, t );
			path.at( u + 0.001, A );
			path.at( u, out[ i ] );
			T.subVectors( A, out[ i ] ).normalize();
			N.crossVectors( T, up ).normalize();
			const across = f.lane[ 0 ] * ( 1 + 0.35 * Math.sin( t * f.w[ 0 ] + f.ph[ 0 ] ) ), lift = f.lane[ 1 ] + o.lanes[ 1 ] * 0.4 * Math.sin( t * f.w[ 1 ] + f.ph[ 1 ] );
			out[ i ].addScaledVector( N, across ).addScaledVector( up, lift );

		}

		// Apart: a smooth push, (minD - d)^2, shared by the pair.
		for ( let it = 0; it < 2; it ++ ) for ( let i = 0; i < n; i ++ ) for ( let j = i + 1; j < n; j ++ ) {

			const a = out[ i ], b = out[ j ], m = minD * ( fish[ i ].size + fish[ j ].size ) / 2;
			const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d2 = dx * dx + dy * dy + dz * dz;
			if ( d2 >= m * m || d2 < 1e-12 ) continue;
			const d = Math.sqrt( d2 ), k = ( m - d ) * ( m - d ) / m / d * 0.5;
			a.x -= dx * k; a.y -= dy * k; a.z -= dz * k;
			b.x += dx * k; b.y += dy * k; b.z += dz * k;

		}

	}

	const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), V = new THREE.Vector3(), Acc = new THREE.Vector3(), M = new THREE.Matrix4(), S = new THREE.Vector3();
	const buf = motion.array, dt = 0.05;
	return function update( t ) {

		place( t - dt, P[ 0 ] );
		place( t, P[ 1 ] );
		place( t + dt, P[ 2 ] );
		for ( let i = 0; i < n; i ++ ) {

			const f = fish[ i ];
			V.subVectors( P[ 2 ][ i ], P[ 0 ][ i ] ).divideScalar( 2 * dt );
			Acc.copy( P[ 2 ][ i ] ).add( P[ 0 ][ i ] ).addScaledVector( P[ 1 ][ i ], - 2 ).divideScalar( dt * dt );
			const v = Math.max( V.length(), 1e-4 );
			X.copy( V ).divideScalar( v );
			Acc.addScaledVector( X, - Acc.dot( X ) ); // the side part
			// Bank: the back leans toward the centre of the turn.
			Y.copy( up ).addScaledVector( Acc, 1 / o.bankG ).normalize();
			Z.crossVectors( X, Y ).normalize();
			Y.crossVectors( Z, X );
			M.makeBasis( X, Y, Z ).scale( S.setScalar( f.size ) ).setPosition( P[ 1 ][ i ] );
			mesh.setMatrixAt( i, M );
			// Beat phase from the distance swum: faster when it surges.
			const dist = uAt( f, t ) * path.length, q = i * 8;
			buf[ q ] = dist / ( 0.7 * L * f.size ) * Math.PI * 2 + f.ph[ 3 ];
			buf[ q + 1 ] = Acc.dot( Z ) / ( v * v ) * f.size * 0.5;
			buf[ q + 2 ] = Math.min( 1.3, 0.55 + 0.45 * v / ( path.length / o.period ) );
			buf[ q + 3 ] = t * o.pec * Math.PI * 2 + f.ph[ 3 ];
			buf[ q + 4 ] = Z.x * f.size; buf[ q + 5 ] = Z.y * f.size; buf[ q + 6 ] = Z.z * f.size;
			buf[ q + 7 ] = f.tone;

		}

		mesh.instanceMatrix.needsUpdate = true;
		motion.needsUpdate = true;

	};

}
