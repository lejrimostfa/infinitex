// The height of the aquarium's displaced sand, on the CPU: the same
// formula as the GPU (src/families/ground/sand.js sandHeight, with the
// hashes of src/core/hash.js), so a creature can stand on the floor the
// camera sees. Ripples and low mounds, in meters above y = 0.
//   sandFloor( preset, { width, depth } )  returns ( x, z ) => y
// The floor is the tank's plane, rotated flat: its coordinates in meters
// are ( x + width / 2, depth / 2 - z ). Float32 rounding on the GPU moves
// a hash by about 1e-3 at most: some tens of microns of height.
// Cost: about 0.3 us per call (three noise octaves, twice).
//
// Event bus: none (a pure function).

const fract = ( x ) => x - Math.floor( x );
const wrap = ( i ) => i - 4096 * Math.floor( i / 4096 );

function hash1( x, y ) {

	const a = fract( x * 0.1031 ), b = fract( y * 0.1031 ), c = a;
	const d = a * ( b + 33.33 ) + b * ( c + 33.33 ) + c * ( a + 33.33 );
	return fract( ( a + d + b + d ) * ( c + d ) );

}

function valueNoise( x, y ) {

	const ix = Math.floor( x ), iy = Math.floor( y ), fx = x - ix, fy = y - iy;
	const sx = fx * fx * ( 3 - 2 * fx ), sy = fy * fy * ( 3 - 2 * fy );
	const v00 = hash1( wrap( ix ), wrap( iy ) ), v10 = hash1( wrap( ix + 1 ), wrap( iy ) );
	const v01 = hash1( wrap( ix ), wrap( iy + 1 ) ), v11 = hash1( wrap( ix + 1 ), wrap( iy + 1 ) );
	const a = v00 + ( v10 - v00 ) * sx, b = v01 + ( v11 - v01 ) * sx;
	return a + ( b - a ) * sy;

}

// Three octaves, as fbm( q, 3 ) in src/families/ground/grains.js.
function fbm3( x, y ) {

	let s = 0, a = 0.5;
	for ( let i = 0; i < 3; i ++ ) {

		s += valueNoise( x, y ) * a;
		x = x * 2.03 + 5.17;
		y = y * 2.03 + 5.17;
		a *= 0.5;

	}

	return s / ( 1 - a * 2 );

}

export function sandFloor( preset, { width, depth } ) {

	const L = ( preset.ripple_mm ?? 70 ) * 1e-3, ripple = preset.ripple ?? 0.6, dune = preset.dune ?? 0, seed = preset.seed ?? 1;
	const amp = ripple * 0.1;
	return ( x, z ) => {

		const px = x + width / 2, py = depth / 2 - z;
		// Ripples: a windward rise over 75 % of the period, a lee drop.
		const warp = ( fbm3( px / ( L * 2.5 ) + seed, py / ( L * 2.5 ) + seed ) - 0.5 ) * 1.6;
		const t = fract( py / L + warp + px / ( L * 7 ) );
		const u = t <= 0.75 ? t / 0.75 : ( 1 - t ) / 0.25;
		let h = u * u * ( 3 - 2 * u ) * amp * L;
		// Low mounds, four ripples wide.
		if ( dune > 0 ) {

			const M = L * 4;
			h += fbm3( px / M + seed + 17.3, py / M + seed + 17.3 ) * dune * M * 0.09;

		}

		return h;

	};

}
