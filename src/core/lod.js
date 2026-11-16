// Infinitex core: footprint-driven level of detail for procedural TSL materials.
//
// Every family works in "surface meters": uv * metersPerUV. The pixel footprint
// is measured once, before any branch, because WGSL forbids derivatives in
// non-uniform control flow. Each detail level then fades in with fadeIn() and,
// once faded out, hands its slope variance to composeRoughness() so the far
// view keeps the average look of the near view (Toksvig / LEAN idea).

import {
	float, vec2, vec3, vec4, mat4, int, dFdx, dFdy, smoothstep, step, max, min, sqrt, clamp, mix, normalView, Fn, If,
} from 'three/tsl';

// Build-time override (core/pixel.js): while a family graph is built on
// art pixel centres, the footprint is the art pixel, not the screen pixel,
// so detail smaller than an art pixel is averaged away. Relief read from
// screen derivatives is off: those derivatives are zero inside an art pixel.
// opts.flat (pixel art): the normal jumps at every texel border, so the
// specular anti-aliasing would draw a line there: it is off too.
let FP_OVERRIDE = null, FLAT = false;
export function withFootprint( fp, build, opts = {} ) {

	const prev = [ FP_OVERRIDE, FLAT ];
	FP_OVERRIDE = fp;
	FLAT = !! opts.flat;
	try { return build(); } finally { [ FP_OVERRIDE, FLAT ] = prev; }

}

// Pixel footprint in surface meters. Isotropic max: over-blurs at grazing
// angles, which is the safe side.
export function footprint( surfaceMeters ) {

	if ( FP_OVERRIDE ) return FP_OVERRIDE;
	const dx = dFdx( surfaceMeters );
	const dy = dFdy( surfaceMeters );
	return max( dx.length(), dy.length() ).max( 1e-12 );

}

// Weight of a detail level whose period is `periodMeters`.
// 0 below `lo` pixels per period, 1 above `hi`. Continuous, so nothing pops.
export function fadeIn( periodMeters, fp, lo = 2.0, hi = 6.0 ) {

	return smoothstep( float( lo ), float( hi ), float( periodMeters ).div( fp ) );

}

// True while a detail level of period `periodMeters` has a non-zero
// fadeIn( periodMeters, fp, lo ): the condition of its gate().
export function fadeOn( periodMeters, fp, lo = 2.0 ) {

	return float( periodMeters ).div( fp ).greaterThan( lo );

}

// Real branch around a detail level. A faded level used to be computed and
// then weighted by zero; inside gate() the GPU skips it. Measured on the
// soil ground (M1 Max, 1080p): 7.6 ms to 1.6 ms at 10 m, same image.
//
//   on      bool node, usually fadeOn() of the level's widest fade
//   spec    { name: value when the level is off }. A value is a number, a
//           scalar node, an array of 2 to 4 numbers or scalar nodes, or
//           { node, size } for a vector node. At most 16 floats in all.
//   build   () => { name: node }, the level itself. Runs inside the branch.
//   shared  .toVar() nodes that build() reads and that are also read
//           outside (the coordinates, the footprint, a warped position).
//           They are evaluated before the branch. Without this, a node
//           first met inside the branch is computed there, then again
//           after it: twice the work, and the second copy can round
//           differently.
//
// Cell coordinates of a Voronoi or a grid ( mod( p.div( size ), 4096 ) )
// are best taken as a .toVar() just before the gate that reads them, and
// passed in `shared`: computed inside the branch they can round differently,
// and some cell borders move by a pixel (seen on the sand facets).
//
// Returns { name: node }. No derivative (dFdx, dFdy, a texture sample with
// implicit mips) may sit inside build(): take them before, like footprint().
// More traps, found when every family was converted:
//   lattice    noise coordinates without a mod ( fbm( p.div( x ) ) ) round
//              differently inside a branch too: take them as a .toVar()
//              before the gate, as for the cells.
//   tangents   never read the tangent frame inside a gate (tangentWorld,
//              tangentView, or anything built from them): on a mesh with
//              no tangents three derives it from dFdx.
//   live code  a value computed before the gate and read after it stays
//              live across the branch. Around one cheap noise a gate can
//              make the shader slower (seen on glossy plastic, on the
//              micro fibre octaves, on oil paint). A gate must be measured.
// setLodBranches( false ) builds every level unconditionally (the
// reference of tests/lod_branches.mjs).
let BRANCHES = true;
export function setLodBranches( on ) { BRANCHES = !! on; }

// A few gates are exact on WebGPU only: on the WebGL2 fallback the code
// inside the branch rounds differently and the image moves (suede fibres
// 9 um wide, the frosted glass pits). They use gateGpu(). An app on the
// fallback calls setLodFallback( true ) before it builds its materials
// (the demos do, demo/scene.js): those levels are then built without a
// branch. The image is the same, WebGL2 only keeps its former cost there.
let FALLBACK = false;
export function setLodFallback( on ) { FALLBACK = !! on; }
export function gateGpu( on, spec, build, shared = [] ) { return FALLBACK ? build() : gate( on, spec, build, shared ); }

const isNode = ( v ) => v && v.isNode === true;
const specSize = ( v ) => typeof v === 'number' || isNode( v ) ? 1 : Array.isArray( v ) ? v.length : v.size;
const specParts = ( v ) => typeof v === 'number' ? [ float( v ) ] : isNode( v ) ? [ v ] : Array.isArray( v ) ? v.map( ( x ) => float( x ) ) : [ v.node ];

export function gate( on, spec, build, shared = [] ) {

	if ( ! BRANCHES ) return build();
	// Lay the outputs out in up to four vec4 columns, first fit.
	const cols = [], where = {};
	for ( const [ k, v ] of Object.entries( spec ) ) {

		const n = specSize( v );
		let c = cols.findIndex( ( used ) => used + n <= 4 );
		if ( c < 0 ) { c = cols.length; cols.push( 0 ); }
		where[ k ] = { c, off: cols[ c ], n };
		cols[ c ] += n;

	}

	if ( cols.length > 4 ) throw new Error( 'infinitex gate: more than 16 floats, split the level in two gates' );
	const pack = ( parts ) => {

		const v = cols.map( ( used, c ) => {

			const a = [];
			for ( const k of Object.keys( spec ) ) if ( where[ k ].c === c ) a.push( ...parts( k ) );
			for ( let i = used; i < 4; i ++ ) a.push( float( 0 ) );
			return vec4( ...a );

		} );
		if ( v.length === 1 ) return v[ 0 ];
		while ( v.length < 4 ) v.push( vec4( 0 ) );
		return mat4( ...v );

	};

	const M = Fn( () => {

		// A var is emitted where the stack meets it only if something else
		// reads it too (three r187 StackNode skips a var read by nobody),
		// so the var itself goes on the stack, not a copy of it.
		for ( const s of shared ) {

			if ( ! s.isVarNode ) throw new Error( 'infinitex gate: a shared node must be a .toVar()' );
			s.toStack();

		}

		const o = pack( ( k ) => specParts( spec[ k ] ) ).toVar();
		If( on, () => {

			const r = build();
			o.assign( pack( ( k ) => [ typeof r[ k ] === 'number' ? float( r[ k ] ) : r[ k ] ] ) );

		} );
		return o;

	} )().toVar();
	const out = {};
	for ( const [ k, { c, off, n } ] of Object.entries( where ) ) {

		const col = cols.length === 1 ? M : M.element( int( c ) );
		out[ k ] = n === 4 ? col : col[ 'xyzw'.slice( off, off + n ) ];

	}

	return out;

}

// Perceptual roughness r -> GGX alpha^2 = r^4. A faded level with slope
// variance s2 widens the lobe: alpha^2 += 2 * s2 (Beckmann slope variance).
export function composeRoughness( roughness, slopeVariance ) {

	const a2 = roughness.pow( 4 ).add( slopeVariance.mul( 2.0 ) );
	return clamp( sqrt( sqrt( a2 ) ), 0.02, 1.0 );

}

// Geometric specular anti-aliasing (Tokuyoshi and Kaplanyan 2019, simplified).
// Widens roughness where the final view-space normal changes fast between
// pixels. About 10 ALU.
export function specularAA( roughness, nView = normalView ) {

	if ( FLAT ) return roughness;
	const dndx = dFdx( nView );
	const dndy = dFdy( nView );
	const variance = dndx.dot( dndx ).add( dndy.dot( dndy ) ).mul( 0.25 );
	const kernel = min( variance.mul( 2.0 ), 0.18 );
	const a2 = roughness.pow( 4 ).add( kernel );
	return clamp( sqrt( sqrt( a2 ) ), 0.02, 1.0 );

}

// Branch-free choice: a when t = 1, b when t = 0. Use instead of select:
// TSL compiles select to if/else, which duplicates subtrees per branch.
export const pick = ( t, a, b ) => mix( b, a, t );

// Tangent-space helpers used by the families.
export const UP = vec3( 0, 0, 1 );

// Tangent-space slope (dh/du, dh/dv) applied on top of a view-space base
// normal, with the tangent frame re-orthogonalised against it. Lets a family
// keep the folds of a game's normal map and add its own fine relief.
export function perturbNormal( baseNormal, slope, tangent, bitangent ) {

	const t = tangent.sub( baseNormal.mul( baseNormal.dot( tangent ) ) ).normalize();
	const b = bitangent.sub( baseNormal.mul( baseNormal.dot( bitangent ) ) ).sub( t.mul( t.dot( bitangent ) ) ).normalize();
	return baseNormal.sub( t.mul( slope.x ) ).sub( b.mul( slope.y ) ).normalize();

}

// Surface gradient (dh/du, dh/dv in surface meters) of a height already
// computed per pixel, from its screen derivatives and those of the
// coordinates. For relief several pixels wide (paint edges, eroded rings,
// chip steps); the result is constant over each 2 x 2 pixel quad.
export function surfaceGradient( h, coords ) {

	if ( FP_OVERRIDE ) return vec2( 0 );
	const dpx = dFdx( coords ), dpy = dFdy( coords ), hx = dFdx( h ), hy = dFdy( h );
	const det = dpx.x.mul( dpy.y ).sub( dpx.y.mul( dpy.x ) );
	const safe = det.abs().max( 1e-14 ).mul( step( 0, det ).mul( 2 ).sub( 1 ) );
	return vec2( hx.mul( dpy.y ).sub( hy.mul( dpx.y ) ), hy.mul( dpx.x ).sub( hx.mul( dpy.x ) ) ).div( safe );

}
