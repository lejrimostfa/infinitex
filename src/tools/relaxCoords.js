// Make the knit coordinates as isometric as the surface allows. A cylinder
// projection stretches stitches up to 5x where the cloth slopes away from
// the axis (shoulders, folds, a flared hem). Position-based relaxation on
// the triangle edges pulls each 2D edge to its 3D length. Then every patch
// is rotated back onto its projection (Procrustes), so wales keep their
// direction. Seams stay split: each side relaxes on its own.
export function relaxCoords( geo, iterations ) {

	if ( ! iterations ) return;
	const idx = geo.index.array, P = geo.attributes.position, U = geo.attributes.ixUV;
	const n = U.count;
	const uv = new Float64Array( n * 2 ), uv0 = new Float64Array( n * 2 );
	for ( let i = 0; i < n; i ++ ) { uv[ i * 2 ] = uv0[ i * 2 ] = U.getX( i ); uv[ i * 2 + 1 ] = uv0[ i * 2 + 1 ] = U.getY( i ); }
	const live = ( i ) => uv0[ i * 2 ] !== 0 || uv0[ i * 2 + 1 ] !== 0;
	const edges = [], seen = new Set();
	for ( let t = 0; t < idx.length; t += 3 ) {

		if ( ! live( idx[ t ] ) || ! live( idx[ t + 1 ] ) || ! live( idx[ t + 2 ] ) ) continue;
		for ( const [ a, b ] of [ [ idx[ t ], idx[ t + 1 ] ], [ idx[ t + 1 ], idx[ t + 2 ] ], [ idx[ t + 2 ], idx[ t ] ] ] ) {

			const key = a < b ? a * n + b : b * n + a;
			if ( seen.has( key ) ) continue;
			seen.add( key );
			const L = Math.hypot( P.getX( a ) - P.getX( b ), P.getY( a ) - P.getY( b ), P.getZ( a ) - P.getZ( b ) );
			edges.push( a, b, L );

		}

	}

	for ( let it = 0; it < iterations; it ++ ) for ( let e = 0; e < edges.length; e += 3 ) {

		const a = edges[ e ], b = edges[ e + 1 ], L0 = edges[ e + 2 ];
		const dx = uv[ b * 2 ] - uv[ a * 2 ], dy = uv[ b * 2 + 1 ] - uv[ a * 2 + 1 ];
		const L = Math.hypot( dx, dy ) || 1e-9;
		const k = 0.5 * ( L - L0 ) / L;
		uv[ a * 2 ] += dx * k; uv[ a * 2 + 1 ] += dy * k;
		uv[ b * 2 ] -= dx * k; uv[ b * 2 + 1 ] -= dy * k;

	}

	// Patches = connected live vertices. Rotate and shift each one back.
	const parent = new Int32Array( n ).map( ( _, i ) => i );
	const find = ( i ) => { while ( parent[ i ] !== i ) i = parent[ i ] = parent[ parent[ i ] ]; return i; };
	for ( let e = 0; e < edges.length; e += 3 ) parent[ find( edges[ e ] ) ] = find( edges[ e + 1 ] );
	const groups = new Map();
	for ( let i = 0; i < n; i ++ ) if ( live( i ) ) { const r = find( i ); if ( ! groups.has( r ) ) groups.set( r, [] ); groups.get( r ).push( i ); }
	for ( const ids of groups.values() ) {

		let cx = 0, cy = 0, ox = 0, oy = 0;
		for ( const i of ids ) { cx += uv[ i * 2 ]; cy += uv[ i * 2 + 1 ]; ox += uv0[ i * 2 ]; oy += uv0[ i * 2 + 1 ]; }
		cx /= ids.length; cy /= ids.length; ox /= ids.length; oy /= ids.length;
		let sc = 0, ss = 0;
		for ( const i of ids ) {

			const px = uv[ i * 2 ] - cx, py = uv[ i * 2 + 1 ] - cy, qx = uv0[ i * 2 ] - ox, qy = uv0[ i * 2 + 1 ] - oy;
			sc += px * qx + py * qy;
			ss += px * qy - py * qx;

		}

		const ang = Math.atan2( ss, sc ), c = Math.cos( ang ), s = Math.sin( ang );
		for ( const i of ids ) {

			const px = uv[ i * 2 ] - cx, py = uv[ i * 2 + 1 ] - cy;
			U.setXY( i, ox + c * px - s * py, oy + s * px + c * py );

		}

	}

	U.needsUpdate = true;

}
