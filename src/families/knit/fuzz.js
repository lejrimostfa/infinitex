// Knit L4: fuzz. Stray fibers that stick out of the yarn, drawn as stacked
// shells (Lengyel et al. 2001). One extra draw call: the garment geometry is
// copied N times, each copy tagged with its height `shellH` in 0..1 and pushed
// out along the (skinned) normal in the vertex stage. Works on skinned meshes
// because positionNode runs after skinning.
//
// Each hair is a short curly segment leaning along a smooth flow field. A
// shell is a slab of height dh. It shows where the view ray, inside that
// slab, passes closest to each hair: a 2D point-to-segment distance whose
// segment is the hair slope minus the ray slope. So slabs join into
// continuous hairs from any view angle, not dashes.
// Prefiltering: a hair thinner than a pixel is widened to the pixel and
// dimmed by the same ratio (energy conserving). Once hairs are closer than a
// few pixels, the shell shows their mean coverage instead.

import { BufferGeometry, BufferAttribute } from 'three';
import {
	uv, vec2, vec3, float, floor, fract, If, Fn, smoothstep, step, clamp, sin, cos, sqrt, mix, PI, attribute,
	positionLocal, normalLocal, positionView, normalView, tangentView, bitangentView,
} from 'three/tsl';
import { footprint, fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';

// Copy a geometry `layers` times. Adds the float attribute shellH.
// triangles: optional Uint8Array, 1 for the triangles that get shells.
export function createShellGeometry( src, layers, triangles = null ) {

	const n = src.attributes.position.count;
	const g = new BufferGeometry();
	for ( const [ name, a ] of Object.entries( src.attributes ) ) {

		const out = new a.array.constructor( a.array.length * layers );
		for ( let i = 0; i < layers; i ++ ) out.set( a.array, i * a.array.length );
		g.setAttribute( name, new BufferAttribute( out, a.itemSize, a.normalized ) );

	}

	const h = new Float32Array( n * layers );
	// Slab centres: the first slab starts at the yarn top, so roots touch it.
	for ( let i = 0; i < layers; i ++ ) h.fill( ( i + 0.5 ) / layers, i * n, ( i + 1 ) * n );
	g.setAttribute( 'shellH', new BufferAttribute( h, 1 ) );

	if ( src.index ) {

		let idx = src.index.array;
		if ( triangles ) idx = idx.filter( ( _, j ) => triangles[ ( j / 3 ) | 0 ] );
		const m = idx.length;
		const out = new Uint32Array( m * layers );
		// Inner shells first: blending order inside one draw call is index order.
		for ( let i = 0; i < layers; i ++ ) for ( let j = 0; j < m; j ++ ) out[ i * m + j ] = idx[ j ] + i * n;
		g.setIndex( new BufferAttribute( out, 1 ) );

	}

	g.boundingSphere = src.boundingSphere?.clone() ?? null;
	return g;

}

// Curl and per-hair deviation make each slab's slice of a hair longer than
// the lean alone. Measured with the gate (mean coverage vs resolved hairs).
const PATH_GAIN = 1.4;

// Expected fraction of hairs still alive at height h: lengths are uniform in [0.3, 1].
const aliveFrac = ( h ) => clamp( float( 1 ).sub( h ).div( 0.7 ), 0, 1 );

// opts.coords: knit coordinates in meters, opts.color: hair colour node,
// opts.mask: where the fuzz may grow (0..1).
export function buildFuzzNodes( u, opts = {} ) {

	const h = attribute( 'shellH', 'float' ).toVar();
	const L = u.fuzzLength;
	const positionNode = positionLocal.add( normalLocal.normalize().mul( h.mul( L ) ) );

	const uvm = ( opts.coords ?? uv().mul( u.metersPerUV ) ).toVar( 'ix_coords' );
	const fp = footprint( uvm ).toVar( 'ix_fuzz_fp' );
	const c = u.fuzzCell;
	const dh = float( 1 ).div( u.fuzzLayers );

	// Smooth flow field: hair direction turns all the way round over
	// fuzzFlowM (a few mm for wool, a few cm for body hair). It must vary
	// slowly against the hair reach, or the root-plane shift breaks.
	const ang = valueNoise( uvm.div( u.fuzzFlowM ).add( u.seed.mul( 17 ) ) ).mul( PI.mul( 4 ) );
	const flow = vec2( cos( ang ), sin( ang ) ).toVar();
	const reach = u.fuzzLean.mul( L ).div( c ); // horizontal reach at the tip, in cells
	// Back to the root plane: every hair leans by about flow * reach * h.
	const p = uvm.div( c ).sub( flow.mul( reach ).mul( h ) ).toVar();
	// The 2 x 2 cells nearest to p. Hair centres stay within half a cell of
	// their own cell, so no other cell can reach p.
	const base = floor( p.sub( 0.5 ) ).toVar();
	// View ray slope in the surface frame: lateral meters per meter of height.
	const rd = positionView.normalize();
	const rn = rd.dot( normalView ).min( - 0.03 );
	const raySlope = vec2( rd.dot( tangentView ), rd.dot( bitangentView ) ).div( rn );
	// Relative motion of hair and ray across this slab, in cells.
	const seg = flow.mul( u.fuzzLean ).sub( raySlope ).mul( L ).mul( dh ).div( c ).toVar();
	const side = vec2( flow.y.negate(), flow.x ).toVar();

	const r = u.fuzzRadius;

	const amp = u.fuzzCurl.mul( 0.2 );
	const hairs = fadeIn( c, fp, 2.0, 6.0 ).toVar();
	// Real branch: far away (hairs = 0) only the mean coverage is used, so
	// the hair loop is skipped. No derivative is taken inside it.
	// Returns vec2( coverage, tone ). If() needs an Fn() stack.
	const hairLoop = Fn( () => {

	const res = vec2( 0, 1 ).toVar();
	If( hairs.greaterThan( 0.0 ), () => {

	let alpha = float( 0 ), tone = float( 1 );
	for ( let oy = 0; oy <= 1; oy ++ ) for ( let ox = 0; ox <= 1; ox ++ ) {

		const id = base.add( vec2( ox, oy ) );
		const a = hash3( id.add( u.seed ) );
		const b = hash3( id.add( u.seed.add( 31 ) ) );
		const len = b.z.mul( 0.7 ).add( 0.3 );
		// Curl: sideways wave along the hair. Its slope joins the slab segment,
		// or the slabs would not meet and the hair would look dashed.
		const freq = a.z.mul( 6 ).add( 5 );
		const wave = h.mul( freq ).add( b.z.mul( 6.3 ) );
		const curl = sin( wave ).mul( amp ).mul( h );
		const dCurl = cos( wave ).mul( freq ).mul( h ).add( sin( wave ) ).mul( amp ).mul( dh );
		const dev = b.xy.sub( 0.5 ).mul( 0.2 );
		const segH = seg.add( side.mul( dCurl ) ).add( dev.mul( dh ) );
		const centre = id.add( a.xy.mul( 0.6 ).add( 0.2 ) ).add( dev.mul( h ) ).add( side.mul( curl ) );
		const w = p.sub( centre );
		const t = clamp( w.dot( segH ).div( segH.dot( segH ).max( 1e-8 ) ), - 0.5, 0.5 );
		const d = w.sub( segH.mul( t ) ).length().mul( c ); // meters
		const alive = smoothstep( h.sub( 0.04 ), h, len );
		// Tapered hair, opaque when wider than a pixel. Thinner than a pixel it
		// is widened to 2 px and dimmed by the same ratio (energy conserving).
		const rTip = r.mul( float( 1 ).sub( h.div( len ) ).max( 0 ).sqrt().mul( 0.6 ).add( 0.4 ) );
		const rEff = rTip.max( fp );
		const cov = clamp( rEff.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( rTip.div( rEff ) ).mul( alive );
		// Cylinder shading across the hair, and a per-hair tint.
		const across = d.div( rEff ).min( 1 );
		const shade = sqrt( float( 1 ).sub( across.mul( across ) ) ).mul( 0.45 ).add( 0.55 ).mul( a.z.mul( 0.3 ).add( 0.85 ) );
		const win = step( alpha, cov );
		tone = mix( tone, shade, win ).toVar();
		alpha = alpha.max( cov ).toVar();

	}

	res.assign( vec2( alpha, tone ) );

	} );
	return res;

	} );
	const hairRes = hairLoop().toVar( 'ix_hair' );
	const alphaV = hairRes.x, toneV = hairRes.y;

	// Mean coverage of one shell: hairs per m^2 times the slice area.
	// Grazing views make seg longer, so the mean coverage grows: that is the
	// sheen of the fuzz, the reason the base sheen is lowered (index.js).
	const sliceM = seg.length().mul( c );
	const meanAlpha = r.mul( 1.6 ).mul( sliceM ).add( r.mul( r ).mul( Math.PI ) ).div( c.mul( c ) ).mul( aliveFrac( h ) ).mul( PATH_GAIN );
	// Hairs right in front of a macro camera would be huge blurred lines.
	// Cut them over a short range: a long fade left half-transparent ghosts.
	const near = smoothstep( 6e-4, 7.5e-4, positionView.z.negate() );
	// Roots fade into the yarn: no visible hair foot standing on the surface.
	const root = smoothstep( 0.0, 0.25, h );
	const opacityNode = mix( meanAlpha, alphaV, hairs ).mul( u.fuzzOpacity ).mul( near ).mul( root ).mul( opts.mask ?? 1 ).clamp( 0, 1 );

	// Tips catch light, roots sit in the shadow of the yarn.
	const colorNode = ( opts.color ?? u.fuzzColor ).mul( mix( float( 0.6 ), float( 1.0 ), h ) ).mul( mix( float( 0.85 ), toneV, hairs ) );

	return { positionNode, opacityNode, colorNode };

}
