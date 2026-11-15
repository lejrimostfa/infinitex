// Living skin: TSL node graph, faded by pixel size like every family.
//   L0 tone:      melanin and hemoglobin, or the colours of a game texture;
//                 light passing through (thickness colour, MeshSSSNodeMaterial)
//   L1 furrows:   the coarse lines of the skin, about 1 mm
//   L2 lines:     the fine net of skin lines (microrelief), about 0.45 mm
//   L3 pores:     follicle pores, darker and slightly sunk
//   L4 cells:     corneocytes, the flat dead cells of the surface, 35 um
// Vellus hair comes from the shared fuzz shells (createFuzz).
// Oil and sweat are the surface states (gloss, wetness).

import {
	uv, vec2, vec3, float, floor, clamp, smoothstep, step, mix, pow, exp, sin, cos,
	normalView, tangentView, bitangentView,
} from 'three/tsl';
import { footprint, fadeIn, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { applySurface } from '../../core/surface.js';
import { applyStates } from '../../core/states.js';
import { skinFeatures } from './features.js';

const sstep = ( t ) => t.mul( t ).mul( t.mul( - 2 ).add( 3 ) );
const dsstep = ( t ) => t.mul( float( 1 ).sub( t ) ).mul( 6 );
// Linear albedo of very fair and very dark skin. The tone in between is a
// geometric blend (absorption adds up like Beer-Lambert).
const FAIR = vec3( 0.80, 0.56, 0.46 ), DARK = vec3( 0.06, 0.032, 0.021 );
const lum = ( c ) => c.dot( vec3( 0.2126, 0.7152, 0.0722 ) );

export function buildSkinNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv().mul( u.metersPerUV ) ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );

	// Skin lines (microrelief). Real skin is not a crackle of random cells:
	// a few families of nearly straight grooves cross each other (two or
	// three directions), and the plateaus between them rise like small
	// pyramids whose tops catch the light. Each family: parallel lines that
	// bend slowly, irregular spacing, and grooves that fade in and out
	// along their length. Height = pyramid (smooth min of the distances to
	// the lines) minus the grooves; the slope is analytic.
	const family = ( ang, spacingM, seed, weight = 1 ) => {

		// Fixed direction. Rotating it with position would accumulate over
		// the distance (p.n is ~1000 spacings) and turn lines into contours.
		// Waviness and uneven spacing come from a bounded offset instead.
		const a = float( ang );
		const nrm = vec2( cos( a ), sin( a ) ), along = vec2( sin( a ).negate(), cos( a ) );
		const t = p.dot( along ).div( spacingM );
		const n0 = p.dot( nrm ).div( spacingM );
		// Wavy lines: the cells round off instead of forming sharp triangles.
		const sc = n0.add( valueNoise( vec2( t.mul( 0.22 ), n0.mul( 0.15 ).add( seed ) ) ).sub( 0.5 ).mul( 1.1 ) )
			.add( valueNoise( vec2( t.mul( 0.35 ), n0.mul( 0.5 ).add( seed + 3 ) ) ).sub( 0.5 ).mul( 0.3 ) );
		const idx = floor( sc.add( 0.5 ) );
		const f = sc.sub( idx ); // -0.5 .. 0.5
		const side = f.sign();
		// Both neighbouring lines, so the surface stays continuous where the
		// nearest line changes (a line's strength jumped there: those cliffs
		// were the hard edges and triangles).
		const str = ( i ) => smoothstep( 0.15, 0.6, valueNoise( vec2( t.mul( 0.18 ), i.mul( 1.7 ).add( seed ) ) ) ).mul( weight );
		// Rounded valley floor: soft distance sqrt( d^2 + r^2 ) - r.
		const softD = ( x ) => x.mul( x ).add( 0.0036 ).sqrt();
		const fa = f.abs(), s1 = softD( fa ), s2 = softD( float( 1 ).sub( fa ) );
		return {
			lines: [
				{ d: s1.sub( 0.06 ), dir: nrm.mul( f.div( s1 ) ), s: str( idx ) },
				{ d: s2.sub( 0.06 ), dir: nrm.mul( side.negate() ).mul( float( 1 ).sub( fa ).div( s2 ) ), s: str( idx.add( side ) ) },
			],
			dCrease: fa.mul( spacingM ), // to the nearest line, meters, for anti-aliasing
		};

	};
	// Soft cushions between the lines, not pyramids: H = A * prod( f_k ),
	// f_k = 1 - exp( -d_k / lambda ), rounded on top and with no ridge where
	// the nearest line changes. The valleys sit on the lines. Gradient by
	// the product rule, analytic. Faint lines are pushed away (dEff) so
	// they barely dent the cushion.
	// Soft cushions between the lines: H = A * prod_k f_k with
	// f_k = 1 - sum over its two nearest lines of s * exp( -d / lambda ).
	// Rounded on top, no ridges, continuous everywhere. Product rule for
	// the gradient, analytic.
	const network = ( fams, steep, lambda ) => {

		let P = float( 1 ), G = vec2( 0 );
		for ( const k of fams ) {

			let f = float( 1 ), df = vec2( 0 );
			for ( const l of k.lines ) {

				const e = l.d.div( lambda ).negate().exp().mul( l.s );
				f = f.sub( e );
				df = df.add( l.dir.mul( e.div( lambda ) ) );

			}

			f = f.max( 0.02 );
			df = df.mul( smoothstep( 0.0, 1.0, k.dCrease.div( fp ) ) ); // valley crease faded within a pixel
			G = G.mul( f ).add( df.mul( P ) );
			P = P.mul( f );

		}

		return { slope: G.mul( steep ).mul( lambda ), fold: float( 1 ).sub( P ) };

	};
	const base0 = hash1( vec2( u.seed, 3.7 ) ).mul( Math.PI );
	const L = u.linesM;
	const primary = network( [
		family( base0, L, 1.3 ), family( base0.add( 0.95 ), L.mul( 1.15 ), 5.9 ), family( base0.add( 2.2 ), L.mul( 0.9 ), 9.2, 0.5 ),
	], u.linesDepth.mul( 2.4 ), 0.34 );
	const secondary = network( [
		family( base0.add( 0.5 ), L.mul( 0.4 ), 12.4 ), family( base0.add( 1.6 ), L.mul( 0.36 ), 15.1 ),
	], u.linesDepth.mul( 0.8 ), 0.25 );
	const wL1 = fadeIn( L, fp, 1.5, 4.0 ), wL2 = fadeIn( L.mul( 0.38 ), fp, 1.5, 4.0 );
	const furrow = { slope: primary.slope.mul( wL1 ), w: wL1 };
	const fine = { slope: secondary.slope.mul( wL2 ), w: wL1 };
	const fold = primary.fold.mul( wL1 ).max( secondary.fold.mul( wL2 ).mul( 0.4 ) ).toVar();

	// Pores.
	const q = p.div( u.poreM ).add( 41.7 );
	const pc = floor( q );
	const ph = hash3( pc.add( u.seed ) );
	const v = q.sub( pc.add( 0.5 ).add( ph.xy.sub( 0.5 ).mul( 0.6 ) ) );
	const rp = ph.z.mul( 0.05 ).add( 0.07 );
	const r2 = v.dot( v ).div( rp.mul( rp ) );
	const inPore = step( r2, 1 ).mul( step( ph.z, 0.85 ) );
	const wP = fadeIn( u.poreM, fp, 1.5, 4.0 ).toVar();
	const pore = inPore.mul( float( 1 ).sub( r2 ) ).mul( wP ).toVar();
	const rimAA = smoothstep( 0.0, 1.0, float( 1 ).sub( r2.sqrt() ).mul( rp ).mul( u.poreM ).div( fp ) );
	const sP = v.mul( u.poreDepth.mul( 0.06 ).div( rp.mul( rp ) ) ).mul( inPore ).mul( rimAA ).mul( wP );

	// Corneocytes: flat plates, each slightly tilted, thin dark borders.
	const cx = p.div( u.cellM );
	const cg = voronoi( cx.add( vec2( valueNoise( cx.mul( 0.5 ) ), valueNoise( cx.mul( 0.5 ).add( 2.2 ) ) ).mul( 0.6 ) ) );
	const wC = fadeIn( u.cellM, fp, 2.0, 6.0 ).toVar();
	const tilt = hash3( cg.id1 ).xy.sub( 0.5 ).mul( 0.14 );
	const border = float( 1 ).sub( smoothstep( 0.0, 1.5, cg.edge.mul( u.cellM ).div( fp ) ) ).mul( wC ).toVar();
	const sC = tilt.mul( wC );

	// Body hair lying flat on the skin: 2D curves drawn in the surface, with
	// a soft shadow beside them. (Stacked shells suit standing fuzz; flat
	// hairs need no height.) One hair per cell, shorter than a cell, so a
	// 3 x 3 search finds every hair that can cover this point.
	const F = skinFeatures( u, p, fp );
	const hc = p.div( u.hairCellM );
	const hb = floor( hc );
	let hairCov = float( 0 ), hairShadow = float( 0 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = hb.add( vec2( ox, oy ) );
		const hh = hash3( id.add( u.seed.mul( 7 ) ) );
		const ha = hash3( id.add( 19.7 ) );
		const ang = valueNoise( id.mul( 0.15 ) ).mul( 2.4 ).add( hh.z.sub( 0.5 ).mul( 0.6 ) ); // a common flow, each hair a little off
		const dir = vec2( cos( ang ), sin( ang ) );
		const ctr = id.add( hh.xy.mul( 0.5 ).add( 0.25 ) );
		const half = ha.x.mul( 0.2 ).add( 0.25 ); // half length, cells
		const w = p.div( u.hairCellM ).sub( ctr );
		const t = clamp( w.dot( dir ), half.negate(), half );
		const bendOff = t.mul( t ).mul( ha.y.sub( 0.5 ).mul( 0.8 ) ); // slight curve
		const side = vec2( dir.y.negate(), dir.x );
		const d = w.sub( dir.mul( t ) ).sub( side.mul( bendOff ) ).length().mul( u.hairCellM ); // meters
		const r = u.hairR.mul( float( 1 ).sub( t.abs().div( half ) ).max( 0 ).sqrt().mul( 0.6 ).add( 0.4 ) ); // tapered
		const rEff = r.max( fp );
		const exists = step( ha.z, u.hairDensity.mul( u.paintedShare ) ).mul( float( 1 ).sub( F.scar ) );
		hairCov = hairCov.max( clamp( rEff.sub( d ).div( fp ).add( 0.5 ), 0, 1 ).mul( r.div( rEff ) ).mul( exists ) ).toVar();
		hairShadow = hairShadow.max( float( 1 ).sub( smoothstep( r, r.mul( 4 ).add( fp ), d ) ).mul( exists ) ).toVar();

	}

	const keep = float( 1 ).sub( F.smooth );
	const slope = furrow.slope.add( fine.slope ).add( sP ).mul( keep ).add( sC ).add( F.slope ).mul( float( 1 ).sub( hairCov ) );
	const base = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( base, slope, tangentView, bitangentView ).toVar( 'ix_normal' );

	// Colour.
	const tone0 = FAIR.mul( pow( DARK.div( FAIR ), vec3( u.melanin ) ) )
		.mul( exp( vec3( 0.04, 0.35, 0.3 ).mul( u.hemoglobin.sub( 0.5 ) ).negate() ) );
	// Animals: a colour of their own (frog, dolphin, slug).
	const tone = mix( tone0, u.customColor, u.useColor ).toVar();
	let color = tone;
	if ( opts.stitchColor ) {

		const map = opts.stitchColor.here;
		// Override: the pigment tone, keeping the painted shading of the map.
		const detail = lum( map ).div( 0.6 ).clamp( 0.55, 1.3 );
		color = mix( map, tone.mul( detail ), u.toneOverride );

	}

	// Freckles: irregular brown spots of 1 to 4 mm, in clusters.
	const fz = p.div( u.freckleM );
	const fn = valueNoise( fz ).mul( 0.7 ).add( valueNoise( fz.mul( 3.1 ).add( 2.2 ) ).mul( 0.3 ) );
	const spots = smoothstep( 0.66, 0.74, fn ).mul( smoothstep( 0.35, 0.6, valueNoise( fz.mul( 0.15 ).add( 5.5 ) ) ) ).mul( u.freckles );
	// Light leaves the valleys red after travelling under the skin: tint
	// them, do not darken them grey.
	const valley = mix( vec3( 1 ), vec3( 0.93, 0.74, 0.7 ), fold.mul( keep ).mul( u.linesDepth ).mul( u.scatter.mul( 0.5 ).add( 0.5 ) ) );
	const ao = float( 1 ).mul( float( 1 ).sub( pore.mul( keep ).mul( u.poreDepth ).mul( 0.45 ) ) )
		.mul( float( 1 ).sub( border.mul( 0.25 ) ) );
	const cellTone = hash1( cg.id1.add( 3.1 ) ).sub( 0.5 ).mul( 0.1 ).mul( wC ).add( 1 );
	// A hair in each follicle (beard, scalp) darkens the pores.
	const follicle = mix( vec3( 1 ), u.hairColor.mul( 1.5 ), pore.mul( keep ).mul( u.poreDark ).clamp( 0, 1 ) );
	const skinColor = color.mul( ao ).mul( follicle ).mul( F.tint ).mul( valley ).mul( cellTone ).mul( mix( vec3( 1 ), mix( u.freckleColor, u.freckleColor.div( color.max( vec3( 0.005 ) ) ), u.useColor ), spots ) ).mul( float( 1 ).sub( hairShadow.mul( 0.18 ) ) );
	// Ink replaces the colour (seen through the top layer, so a little of
	// the skin's own shading stays).
	const inked = mix( skinColor, u.tattooColor.mul( lum( skinColor ).div( lum( tone ).max( 0.01 ) ).clamp( 0.6, 1.2 ) ), F.ink.mul( 0.88 ) );
	const colorNode = mix( inked, u.hairColor, hairCov );

	const cavity = fold.mul( keep ).mul( u.linesDepth ).max( pore.mul( keep ) ).max( F.cavity );
	const rough = u.roughness.mul( mix( float( 0.9 ), float( 1.4 ), cavity ) ).mul( mix( float( 1 ), float( 0.6 ), F.scar ) );
	const roughnessNode = specularAA( composeRoughness( rough, float( 0.01 ).mul( float( 1 ).sub( fine.w ) ) ), normalNode );

	const nodes = {
		colorNode, normalNode, roughnessNode,
		metalnessNode: float( 0 ),
		iorNode: float( 1.4 ), // skin reflects about 2.8 % head on
		// Light through thin parts: red, because blood absorbs the rest.
		// Ink blocks the light; a vein absorbs the red that crosses it, so the
		// light coming back out over it is greener.
		thicknessColorNode: tone.mul( vec3( 1.0, 0.32, 0.22 ) ).mul( u.scatter ).mul( float( 1 ).sub( F.ink.mul( 0.85 ) ) ).mul( mix( vec3( 1 ), vec3( 0.35, 0.8, 0.9 ), F.vein ) ),
		// Ambient term: some light comes back out red from every direction,
		// which softens the relief like real subsurface scattering.
		thicknessDistortionNode: float( 0.5 ),
		thicknessAmbientNode: u.scatter.mul( 0.3 ).mul( float( 1 ).sub( F.ink.mul( 0.85 ) ) ),
		thicknessPowerNode: float( 2.0 ),
		thicknessScaleNode: float( 4.0 ),
		thicknessAttenuationNode: float( 0.8 ),
	};
	applySurface( nodes, u.surface, { cavity, flatNormal: base, porosity: 0.4 } );
	applyStates( nodes, u.states, { cavity, flatNormal: base, coords: p, fp } );
	nodes.debug = { fp, w1: fine.w, w2: wP, w3: wC, covered: float( 1 ) };
	return nodes;

}
