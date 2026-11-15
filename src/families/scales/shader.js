// Scales family: TSL node graph. The mode (params.js) picks one pattern
// when the material is built; each returns, per pixel:
//   h      height 0..1 of the scale under the pixel (0 in a groove)
//   slope  dh / dx in meters per meter
//   id     the scale's id (colour, blotches)
//   pit    0..1 for the small holes (croc sense pits, ostrich quill holes)
// Then shared levels: fine wrinkles, colour, grooves, blotches.
// Coordinates in meters.

import { uv, vec2, vec3, float, floor, fract, clamp, smoothstep, step, sqrt, mix, abs, cos, sin, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, fadeIn, composeRoughness, specularAA, perturbNormal, pick } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { applySurface } from '../../core/surface.js';
import { PATTERNS } from './pattern.js';

const sstep = ( t ) => t.mul( t ).mul( t.mul( - 2 ).add( 3 ) );
const dsstep = ( t ) => t.mul( float( 1 ).sub( t ) ).mul( 6 );

// Crocodile scutes: rows of rounded rectangles, each row its own width.
function tiles( p, fp, u ) {

	const H = u.scaleM;
	const j = floor( p.y.div( H ) );
	const Wj = H.mul( u.aspect ).mul( hash1( vec2( j, 3.3 ) ).sub( 0.5 ).mul( u.sizeVar ).add( 1 ) );
	const off = hash1( vec2( j, 7.7 ) ).mul( Wj );
	const xr = p.x.sub( off ).div( Wj );
	const i = floor( xr );
	const fx = fract( xr ), fy = fract( p.y.div( H ) );
	const dX = fx.min( float( 1 ).sub( fx ) ).mul( Wj ), dY = fy.min( float( 1 ).sub( fy ) ).mul( H );
	const g = u.groove.mul( H );
	// Smooth min of the two border distances, so the pillow has no crease
	// along its diagonals; its gradient blends the two inward directions.
	const ramp0 = u.groove.mul( H ).mul( 2 ).add( H.mul( 0.22 ) );
	const k = ramp0.mul( 0.35 );
	const ex = dX.negate().div( k ).exp(), ey = dY.negate().div( k ).exp();
	const d = ex.add( ey ).log().mul( k ).negate().max( 0 );
	const wx = ex.div( ex.add( ey ) ), wy = ey.div( ex.add( ey ) );
	// Pillow: the scute rounds off over a quarter of its height, then the
	// groove drops; no flat top, no bevel.
	const ramp = ramp0;
	const t = clamp( d.div( ramp ), 0, 1 );
	const A = u.depth.mul( ramp ).mul( 0.45 ); // height of the scute, meters
	const inward = vec2( float( 0.5 ).sub( fx ).sign().mul( wx ), float( 0.5 ).sub( fy ).sign().mul( wy ) );
	const aa = smoothstep( 0.0, 1.0, d.div( fp ) );
	// A low crown over the whole scute.
	const cx = fx.mul( 2 ).sub( 1 ), cy = fy.mul( 2 ).sub( 1 );
	const A2 = u.depth.mul( H ).mul( 0.04 );
	const crown = vec2( cx.mul( - 2 ).mul( float( 1 ).sub( cy.mul( cy ) ) ).mul( 2 ).div( Wj ), cy.mul( - 2 ).mul( float( 1 ).sub( cx.mul( cx ) ) ).mul( 2 ).div( H ) ).mul( A2 );
	// Growth rings: grooves parallel to the border, a few per scute.
	const ringP = d.div( H.mul( 0.06 ) );
	const ringF = fract( ringP ).sub( 0.5 );
	const ringW = fadeIn( H.mul( 0.06 ), fp, 1.5, 4.0 ).mul( u.rings ).mul( smoothstep( 0.0, 0.05, d.div( H ) ) );
	const sRing = inward.mul( ringF.mul( - 1.2 ).mul( ringW ) );
	const slope = inward.mul( A.mul( dsstep( t ) ).div( ramp ) ).mul( aa ).add( crown ).add( sRing );
	// One sense pit per scute, off centre.
	const ph = hash3( vec2( i, j ).add( 1.7 ) );
	const pv = vec2( fx.sub( ph.x.mul( 0.3 ).add( 0.35 ) ).mul( Wj ), fy.sub( ph.y.mul( 0.3 ).add( 0.35 ) ).mul( H ) );
	const pr = H.mul( 0.035 );
	const pit = clamp( pr.sub( pv.length() ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( 0.25, ph.z ) );
	// The groove itself: a narrow dark gap at the bottom of the pillow.
	const gap = smoothstep( 0.0, 1.0, d.div( g ).max( d.div( fp ).mul( 0.0 ) ) );
	return { h: sstep( t ).mul( gap.mul( 0.6 ).add( 0.4 ) ).mul( gap ), slope, id: vec2( i, j ), pit, fx, fy };

}

// Snake scales: a staggered lattice of ellipses; a scale lies over the one
// behind it (lower row), so the topmost covering scale has the highest row.
function overlap( p, fp, u ) {

	// Feathers are long (about three widths), pointed, a little bent and
	// asymmetric, and overlap over three rows.
	const isF = u.mode === 'feather';
	const R = u.scaleM.mul( isF ? 0.55 : 0.5 ), Cw = u.scaleM.mul( u.aspect );
	const a = Cw.mul( isF ? 0.68 : 0.62 ), b0 = u.scaleM.mul( isF ? 1.7 : 0.62 );
	const rows = isF ? 3 : 1;
	const j0 = floor( p.y.div( R ).add( 0.5 ) );
	let best = float( - 1e5 ), h = float( 0 ), slope = vec2( 0 ), id = vec2( 0 ), along = float( 0 ), loc = vec2( 0 );
	for ( let dj = - rows; dj <= rows; dj ++ ) {

		const j = j0.add( dj );
		const shift = fract( j.mul( 0.5 ) ).mul( 2 ).mul( 0.5 ); // 0.5 on odd rows
		const i0 = floor( p.x.div( Cw ).sub( shift ).add( 0.5 ) );
		for ( let di = - 1; di <= 1; di ++ ) {

			const i = i0.add( di );
			const jit = hash3( vec2( i, j ).add( 5.5 ) ).sub( 0.5 ).mul( isF ? 0.45 : 0.12 );
			const b = isF ? b0.mul( jit.z.mul( u.sizeVar ).mul( 2 ).add( 1 ) ) : b0;
			const c = vec2( i.add( shift ).add( jit.x ).mul( Cw ), j.add( jit.y ).mul( R ) );
			let v = p.sub( c );
			let aa = a;
			if ( isF ) {

				// Bent rachis, pointed tip at the free edge (-y), one vane narrower.
				const fh = hash3( vec2( i, j ).add( 9.1 ) );
				const yn = v.y.div( b );
				v = vec2( v.x.sub( fh.x.sub( 0.5 ).mul( 0.6 ).mul( a ).mul( yn.mul( yn ) ) ), v.y );
				// Ovate vane: narrow at the hidden base (+y), broadest at two
				// thirds, a rounded end at the free tip (-y).
				const ss = float( 1 ).sub( yn ).mul( 0.5 ).clamp( 0, 1 );
				aa = a.mul( sin( ss.mul( 0.82 ).add( 0.1 ).mul( Math.PI ) ).pow( 0.55 ).max( 0.05 ) ).mul( mix( float( 1 ), fh.y.mul( 0.25 ).add( 0.7 ), step( v.x, 0 ) ) );

			}

			const e = v.x.div( aa ).pow( 2 ).add( v.y.div( b ).pow( 2 ) );
			const inside = step( e, 1 );
			const win = inside.mul( step( best, j ) );
			// Height rises toward the free edge (the back, -y), keel along x = 0.
			const yy = v.y.div( b ).negate().mul( 0.5 ).add( 0.5 ).clamp( 0, 1 ); // 0 front, 1 free edge
			const hk = float( 1 ).sub( abs( v.x.div( aa ) ).mul( 3 ) ).max( 0 );
			// Volume: a rounded dome, sqrt( 1 - e ), plus a rise toward the free
			// edge. Height A in meters; slope analytic (grad e = 2 v / r^2).
			const A = u.depth.mul( b ).mul( 0.35 );
			const dome = float( 1 ).sub( e ).max( 0 ).sqrt();
			const hh = dome.mul( 0.6 ).add( yy.mul( 0.4 ) );
			const gradE = vec2( v.x.div( aa.mul( aa ) ), v.y.div( b.mul( b ) ) ).mul( 2 );
			const s = gradE.div( dome.max( 0.15 ).mul( 2 ) ).mul( - 0.6 ).add( vec2( 0, float( - 0.5 ).div( b ).mul( 0.4 ) ) ).mul( A )
				.add( vec2( v.x.sign().negate().mul( u.keel ).mul( 0.25 ).mul( step( 0.001, hk ) ), 0 ) );
			best = mix( best, j, win ).toVar();
			h = mix( h, hh, win ).toVar();
			slope = mix( slope, s, win ).toVar();
			id = mix( id, vec2( i, j ), win ).toVar();
			along = mix( along, yy, win ).toVar();
			loc = mix( loc, v, win ).toVar();

		}

	}

	// The front of a visible scale sits in the shadow of the free edge
	// of the scale above it.
	return { h: h.mul( smoothstep( 0.0, 0.4, along ).mul( 0.75 ).add( 0.25 ) ), slope, id, pit: float( 0 ), fx: along, fy: along, loc, a, b: b0 };

}

// Ostrich: quill bumps on smooth hide, a hole in each.
function quill( p, fp, u ) {

	const x = p.div( u.scaleM ).add( u.seed.mul( 3.1 ) );
	const c = floor( x );
	let h = float( 0 ), slope = vec2( 0 ), pit = float( 0 ), id = vec2( 0 );
	for ( let oy = 0; oy <= 1; oy ++ ) for ( let ox = 0; ox <= 1; ox ++ ) {

		const cid = floor( x.sub( 0.5 ) ).add( vec2( ox, oy ) );
		const hq = hash3( cid );
		const v = x.sub( cid.add( hq.xy.mul( 0.5 ).add( 0.25 ) ) ).mul( u.scaleM );
		const rq = u.scaleM.mul( 0.22 ).mul( hq.z.sub( 0.5 ).mul( u.sizeVar ).add( 1 ) );
		const r = v.length();
		const on = step( hash1( cid.add( 2.2 ) ), 0.85 );
		const t = float( 1 ).sub( r.div( rq ) ).clamp( 0, 1 );
		const hb = sstep( t ).mul( on );
		const sb = v.div( r.max( 1e-7 ) ).mul( dsstep( t ).div( rq ) ).mul( rq ).mul( u.depth ).mul( - 0.45 ).mul( on );
		const ph = clamp( rq.mul( 0.22 ).sub( r ).div( fp ).add( 0.5 ), 0, 1 ).mul( on ).mul( u.holes );
		const win = step( h, hb );
		h = h.max( hb ).toVar();
		slope = mix( slope, sb, win ).toVar();
		pit = pit.max( ph ).toVar();
		id = mix( id, cid, win ).toVar();

	}

	// Blotches follow the skin, not the grid of bumps.
	return { h: h.mul( 0.7 ).add( 0.3 ), slope, id, pid: x, pit, fx: h, fy: h };

}

// Galuchat: round beads packed side by side (Voronoi), domed; polishing
// sands their tops flat and white.
function beads( p, fp, u ) {

	const x = p.div( u.scaleM ).add( u.seed.mul( 2.7 ) );
	const v = voronoi( x, 0.75 );
	const s = hash1( v.id1.add( 4.4 ) ).sub( 0.5 ).mul( u.sizeVar ).add( 1 );
	const R = float( 0.48 ).mul( s );
	const r = v.toSeed.length().div( R ).clamp( 0, 0.98 );
	const hb = sqrt( float( 1 ).sub( r.mul( r ) ) );
	const flat = float( 1 ).sub( u.polish.mul( 0.6 ) );
	const top = step( flat, hb );
	const g = smoothstep( 0.0, u.groove.max( 0.01 ), v.edge ); // 0 on the groove
	const slope = v.toSeed.div( R.mul( R ) ).div( hb.max( 0.2 ) ).mul( - 0.6 ).mul( u.depth ).mul( float( 1 ).sub( top ) ).mul( g );
	return { h: hb.min( flat ).div( flat ).mul( g ), slope, id: v.id1, pit: float( 0 ), fx: top, fy: top };

}

// Feathers: laid like scales, each with its rachis down the middle, barbs
// slanting toward the tip, barbules across the barbs (seen under the loupe),
// and colour bars across the vane.
function feather( p, fp, u ) {

	const S = overlap( p, fp, u );
	const v = S.loc;
	const ax = v.x.abs();
	const barbM = u.scaleM.mul( 0.035 );
	// Rachis: a round shaft.
	const rw = S.a.mul( 0.05 );
	const rq = v.x.div( rw ).clamp( - 0.95, 0.95 );
	// The shaft thins and stops before the tip.
	const tipS = float( 1 ).sub( v.y.div( S.b ) ).mul( 0.5 );
	const rachis = clamp( rw.mul( float( 1 ).sub( tipS.mul( 0.7 ) ) ).sub( ax ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( tipS, 0.9 ) );
	const sRachis = vec2( rq.div( sqrt( float( 1 ).sub( rq.mul( rq ) ) ) ).negate().mul( 0.5 ), 0 );
	// Barbs: ridges slanting from the rachis toward the free edge (-y).
	const bph = v.y.add( ax.mul( 0.9 ) ).div( barbM ).add( valueNoise( vec2( ax.div( S.a.mul( 0.3 ) ), S.id.x.add( S.id.y.mul( 7 ) ) ) ).mul( 1.5 ) );
	const bf = fract( bph ).sub( 0.5 );
	const wB = fadeIn( barbM, fp, 1.5, 4.0 );
	const bdir = vec2( v.x.sign().mul( 0.9 ), 1 ).normalize();
	const sBarb = bdir.mul( bf.mul( - 0.8 ) ).mul( wB );
	// Splits: a few barbs come apart near the edge of the vane.
	const split = step( 0.93, hash1( vec2( floor( bph ), S.id.x.add( 3.1 ) ) ) ).mul( smoothstep( 0.6, 0.9, ax.div( S.a ) ) );
	// Barbules: very fine lines across the barbs.
	const blM = barbM.mul( 0.12 );
	const bl = fract( v.y.sub( ax.mul( 1.1 ) ).div( blM ) ).sub( 0.5 );
	const wBl = fadeIn( blM, fp, 1.5, 4.0 );
	const sBl = vec2( v.x.sign().negate(), 1 ).normalize().mul( bl.mul( - 0.5 ) ).mul( wBl );
	const slope = mix( S.slope.mul( 0.4 ).add( sBarb ).add( sBl ), sRachis, rachis );
	// h: rachis bright, barb grooves dark, splits show the feather below.
	const h = S.h.mul( mix( float( 1 ), float( 0.6 ), bf.abs().mul( 2 ).mul( wB ) ) ).mul( float( 1 ).sub( split.mul( 0.7 ) ) ).max( rachis.mul( 0.9 ) );
	// Bars follow the outline of the vane (chevrons), not straight lines.
	return { h, slope, id: S.id, pit: float( 0 ), fx: rachis, fy: v.y.div( S.b ).add( ax.div( S.a ).pow( 2 ).mul( 0.45 ) ), loc: v, a: S.a, b: S.b };

}

const MODES = { tiles, overlap, quill, beads, feather };

export function buildScalesNodes( u, opts = {} ) {

	const p0 = ( opts.coords ?? uv() ).toVar( 'ix_coords' );
	const fp = footprint( p0 ).toVar( 'ix_fp' );
	// Skin is never ruled: a gentle warp of the whole pattern.
	const wq = p0.div( u.scaleM.mul( 4 ) );
	const p = p0.add( vec2( valueNoise( wq ), valueNoise( wq.add( 5.3 ) ) ).sub( 0.5 ).mul( u.scaleM ).mul( 0.35 ) ).toVar();
	const S = MODES[ u.mode ]( p, fp, u );
	const w1 = fadeIn( u.scaleM.mul( u.groove ).mul( 2 ), fp, 1.0, 3.0 ).toVar();
	const w0 = fadeIn( u.scaleM, fp, 1.0, 3.0 ).toVar();

	// Fine wrinkles, deeper in the grooves.
	const nq = p0.div( u.wrinkleM );
	const nz = vec2( valueNoise( nq ), valueNoise( nq.add( 9.1 ) ) ).sub( 0.5 )
		.add( vec2( valueNoise( nq.mul( 2.9 ).add( 1.1 ) ), valueNoise( nq.mul( 2.9 ).add( 4.4 ) ) ).sub( 0.5 ).mul( 0.5 ) );
	const wW = fadeIn( u.wrinkleM, fp, 1.5, 5.0 );
	const sW = nz.mul( u.wrinkles ).mul( 0.2 ).mul( wW ).mul( float( 1 ).sub( S.h.mul( 0.5 ) ) );
	// Micro relief of the scale surface: tiny granules, a sixth of a
	// wrinkle apart, seen only under the loupe.
	const gM = u.wrinkleM.mul( 0.16 );
	const gv = voronoi( p0.div( gM ).add( 3.7 ), 0.8 );
	const wGr = fadeIn( gM, fp, 2.0, 5.0 );
	const gr = gv.toSeed.length().div( 0.5 ).clamp( 0, 0.95 );
	const sGr = gv.toSeed.div( sqrt( float( 1 ).sub( gr.mul( gr ) ) ).max( 0.3 ) ).mul( - 0.5 ).mul( wGr ).mul( u.wrinkles.mul( 0.5 ).add( 0.3 ) );
	const grain = float( 1 ).sub( smoothstep( 0.0, 0.12, gv.edge ) ).mul( wGr ).mul( u.mode === 'feather' ? 0 : 1 );

	// Micro ridges along the scales (snake skin micro-ornamentation): a few
	// microns apart, they diffract light into colours.
	const ridgeOn = u.mode === 'overlap' ? 1 : 0; // feathers have their own barbs
	const rq = p.x.div( u.ridgeM ).add( valueNoise( vec2( p.y.div( u.ridgeM.mul( 40 ) ), S.id.x ) ).mul( 3 ) );
	const wRi = fadeIn( u.ridgeM, fp, 2.0, 5.0 ).mul( ridgeOn ).mul( u.irid.min( 1 ).max( 0.3 ) );
	const sRi = vec2( cos( rq.mul( Math.PI * 2 ) ).mul( 0.3 ).mul( wRi ), 0 );
	const slope = S.slope.mul( w1 ).add( sW.mul( float( 1 ).sub( wRi.mul( 0.6 ) ) ) ).add( sGr.mul( float( 1 ).sub( ridgeOn * 0.85 ) ).mul( u.mode === 'feather' ? 0 : 1 ) ).add( sRi );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, slope, tangentView, bitangentView ).toVar( 'ix_normal' );

	// Colour: per-scale tint, blotches of whole scales, dark grooves, pits.
	const baseColor = opts.stitchColor ? opts.stitchColor.here : u.color;
	// Per-scale tint; smooth over the skin when the bumps sit on a grid.
	const tint = ( S.pid ? valueNoise( S.pid.mul( 0.7 ) ) : hash1( S.id.add( 0.37 ) ) ).sub( 0.5 ).mul( u.colorVar ).mul( w0 ).add( 1 );
	// Python saddles: a dark ring with a lighter heart, made of whole scales.
	const pid = S.pid ?? S.id;
	// Other patterns (pattern.js) read the scale's position in meters.
	const bnAt = PATTERNS[ u.patternShape ];
	const ppos = u.mode === 'overlap' ? pid.mul( vec2( u.scaleM.mul( u.aspect ), u.scaleM.mul( 0.5 ) ) ) : pid.mul( u.scaleM );
	const bn = bnAt ? bnAt( ppos, u ) : valueNoise( pid.mul( u.scaleM ).div( u.patternM ).add( u.seed ) )
		.add( valueNoise( pid.mul( u.scaleM ).div( u.patternM.mul( 0.35 ) ).add( 2.2 ) ).sub( 0.5 ).mul( 0.15 ) );
	const patOn = u.mode === 'feather' ? 0 : 1; // feathers use the pattern colour for bars
	const blot = smoothstep( 0.5, 0.53, bn ).sub( smoothstep( 0.62, 0.65, bn ).mul( 0.65 ) ).mul( u.pattern ).mul( patOn );
	const scaleCol = mix( baseColor, u.patternColor, blot.mul( w0 ).add( smoothstep( 0.5, 0.56, bnAt ? bnAt( p0, u ) : valueNoise( p0.div( u.patternM ) ) ).mul( 0.6 ).mul( u.pattern ).mul( patOn ).mul( float( 1 ).sub( w0 ) ) ) ).mul( tint );
	const meanGroove = u.groove.mul( 2 ).clamp( 0, 0.6 );
	const hC = mix( float( 1 ).sub( meanGroove ), S.h, w1 );
	const shade = mix( u.grooveColor.div( u.color.max( vec3( 0.02 ) ) ).min( vec3( 1 ) ), vec3( 1 ), hC.mul( 0.75 ).add( 0.25 ) );
	let color = scaleCol.mul( shade ).mul( float( 1 ).sub( S.pit.mul( 0.7 ).mul( w1 ) ) );
	if ( u.mode === 'feather' ) {

		// Bars across the vane (pattern colour), a pale rachis.
		const bars = step( 0.55, fract( S.fy.mul( 1.6 ).add( hash1( S.id ) ) ) ).mul( u.pattern );
		color = mix( color, u.patternColor.mul( shade ), bars.mul( w0 ) );
		color = mix( color, baseColor.mul( 1.8 ).min( vec3( 0.9 ) ), S.fx.mul( 0.7 ).mul( fadeIn( u.scaleM.mul( 0.05 ), fp, 3.0, 8.0 ) ) );

	}
	// Polished galuchat: white sanded tops.
	color = mix( color, vec3( 0.86, 0.84, 0.78 ), S.fx.mul( w1 ).mul( step( 0.2, u.polish ) ) );
	color = color.mul( nz.x.mul( 0.1 ).mul( wW ).add( 1 ) ).mul( float( 1 ).sub( grain.mul( 0.25 ) ) );

	const cavity = float( 1 ).sub( hC ).max( S.pit );
	const s2 = float( 1 ).sub( w1 ).mul( 0.06 ).mul( u.depth );
	const rough = u.roughness.mul( mix( float( 0.8 ), float( 1.5 ), cavity ) );
	const roughnessNode = specularAA( composeRoughness( rough, s2 ), normalNode );
	const nodes = { colorNode: color, normalNode, roughnessNode, metalnessNode: float( 0 ), sheenNode: baseColor.mul( u.sheen ), sheenRoughnessNode: float( 0.5 ) };
	// Iridescence: a thin film whose thickness changes from scale to scale
	// and along the ridges, so each scale flashes its own colour as the
	// view turns.
	const film = hash1( S.id.add( 8.3 ) ).mul( 0.55 ).add( valueNoise( p0.div( u.scaleM.mul( 2 ) ) ).mul( 0.25 ) ).add( fract( rq ).mul( 0.2 ).mul( wRi ) );
	nodes.iridescenceNode = u.irid.mul( float( 1 ).sub( cavity.mul( 0.6 ) ) );
	nodes.iridescenceIORNode = float( 1.55 ); // keratin
	nodes.iridescenceThicknessNode = mix( u.iridMin, u.iridMax, film );
	applySurface( nodes, u.surface, { cavity, flatNormal: base, porosity: 0.6 } );
	nodes.debug = { fp, w1: w0, w2: w1, w3: wW, covered: float( 1 ) };
	return nodes;

}
