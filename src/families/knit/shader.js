// Knit family: TSL node graph. Four levels, each faded by its pixel size.
//   L0 garment: base colour, sheen, roughness widened by the faded levels.
//   L1 stitch:  V-shaped yarn legs, height, normal, cavity AO   (stitch.js)
//   L2 ply:     2-4 plies twisted around each leg (S or Z)      (yarn.js)
//   L3 fiber:   striations of ~20 um fibers inside each ply     (yarn.js)
// This file joins the levels: albedo, AO, normal and roughness.
// Stitch patterns (rib, garter, seed, cable, lace, crochet) swap L1 for
// patterns.js and add a macro relief; fleece has its own graph (fleece.js).
//
// Real branches (gate() in core/lod.js): the ply level runs only where the
// plies show, the fiber level only where the fibers show. Jersey also gates
// its stitch level: under 4 px per stitch only the means are computed. A
// pattern keeps its stitch level outside: far away the ply variance still
// reads the radius of the piece on top (purl bumps and crochet pieces have
// their own). So does the colour from an image: its lookup reads screen
// derivatives (core/colormap.js), which may not sit inside a branch.

import { uv, vec2, vec3, float, step, sin, mix, mx_cell_noise_float, TBNViewMatrix, normalView, tangentView, bitangentView } from 'three/tsl';
import { applySurface } from '../../core/surface.js';
import { applyStates } from '../../core/states.js';
import { footprint, fadeIn, fadeOn, gate, composeRoughness, specularAA, pick, perturbNormal } from '../../core/lod.js';
import { stitchLevel, stitchAO } from './stitch.js';
import { patternLevel } from './patterns.js';
import { buildFleeceNodes } from './fleece.js';
import { plyStats, plyLevel, fiberLevel, S2_FIBER, S2_SCALE, AO_FIBER_MEAN } from './yarn.js';

// Mean of the ply groove darkening 0.6 + 0.4 sin( pi v ).
const AO_PLY_MEAN = 0.6 + 0.4 * 2 / Math.PI;
const asVar = ( n ) => n.isVarNode ? n : n.toVar();

// L1 to L3 joined, before the pattern's macro relief and holes: albedo,
// cavity, slope variance s2 (s2Far plus the near terms), the tangent
// normal before normalize, and the weights. s: the stitch level, st: the
// ply rates (yarn.js), c: { color, heather, meanColor }.
function joinLevels( u, s0, fp, w1, st, c, s2Far ) {

	// What the ply gate reads from the stitch level and is read outside too.
	const v0 = {};
	for ( const k of [ 'brn', 'bt', 'bcol', 'brow', 'dir', 'len', 'Rm', 'covered', 'nYarn' ] ) v0[ k ] = asVar( s0[ k ] );
	const s = { ...s0, ...v0 };
	const { bz, bcol, brow, edgeFade, covered, nYarn } = s;
	// L2 and L3: plies and fibers. Off where w2 = fadeIn( plyPeriod ) *
	// covered * w1 is zero, then their colour, AO and normal are the means.
	const shared = [ fp, w1, st.dvda, st.dvds, st.gl, st.plyPeriod, c.meanColor, ...Object.values( v0 ) ];
	if ( c.color.isVarNode ) shared.push( c.color, c.heather );
	const D = gate( fadeOn( st.plyPeriod, fp ).and( fadeOn( u.stitchW, fp, 4.0 ) ).and( covered.greaterThan( 0 ) ), {
		plyCol: { node: c.meanColor, size: 3 }, fibF: 1, aoPly: AO_PLY_MEAN, aoFiber: AO_FIBER_MEAN, w2: 0, w3: 0, w4: 0,
		nFiber: { node: nYarn.normalize().normalize(), size: 3 },
	}, () => {

		const ply = plyLevel( u, s, fp, st );
		const { v, plyIdx, w2, plyEdge } = ply;
		const nPly = ply.nPly.toVar();
		const hPly = mx_cell_noise_float( vec3( plyIdx, bcol, brow.add( u.seed ) ) );
		const plyColor = pick( step( hPly, u.heatherFrac ), c.heather, c.color );
		// L3: fibers. Off under 2 px per fiber (w3 = fadeIn( fiberDiam ) * w2).
		const F = gate( fadeOn( u.fiberDiam, fp ), { fibF: 1, aoFiber: AO_FIBER_MEAN, w3: 0, w4: 0, nFiber: { node: nPly.normalize(), size: 3 } }, () => {

			const { fIdx, fDepth, profile, w3, w4, fiberEdge, nFiber } = fiberLevel( u, s, { ...ply, nPly }, fp );
			const hFiber = mx_cell_noise_float( vec3( fIdx, plyIdx, bcol.add( brow.mul( 131 ) ) ) );
			return {
				fibF: hFiber.mul( 2 ).sub( 1 ).mul( u.fiberVar ).mul( w3 ).mul( fiberEdge ).add( 1 ),
				// Gap darkening scales with fiber depth. Its mean is analytic (yarn.js).
				aoFiber: mix( float( AO_FIBER_MEAN ), float( 1 ).sub( fDepth.mul( 0.3 ).mul( float( 1 ).sub( profile ) ) ), w3 ),
				w3, w4, nFiber,
			};

		}, [ fp, nPly, v, plyIdx, w2, st.dvda, st.dvds, st.gl, st.plyPeriod, ...Object.values( v0 ) ] );
		return {
			// Hard colour borders (ply, leg, fiber) also fade to the mean within a pixel.
			plyCol: mix( c.meanColor, plyColor, w2.mul( plyEdge ) ),
			fibF: F.fibF,
			aoPly: mix( float( AO_PLY_MEAN ), sin( v.mul( Math.PI ) ).mul( 0.4 ).add( 0.6 ), w2 ),
			aoFiber: F.aoFiber, w2, w3: F.w3, w4: F.w4, nFiber: F.nFiber,
		};

	}, shared );

	// Albedo: per-stitch, per-ply (heather) and per-fiber variation, zero mean.
	const hStitch = mx_cell_noise_float( vec3( bcol, brow, u.seed.add( 17 ) ) );
	const baseCol = D.plyCol.mul( hStitch.mul( 2 ).sub( 1 ).mul( u.stitchVar ).mul( w1 ).mul( edgeFade ).add( 1 ) ).mul( D.fibF );

	// Stitch AO and cavity fade to their means (stats.js). The cavity is
	// not computed from the mean AO: its occlusion multiplies the AO, and the
	// product of the means is darker than the mean of the product.
	const wStitch = w1.mul( edgeFade );
	const aoNear = stitchAO( s.local ?? bz, u.R, u.arch );
	const ao1 = mix( u.meanAO, aoNear, wStitch );
	const cavity = mix( u.meanCavity, float( 1 ).sub( aoNear ).div( 0.7 ).clamp( 0, 1 ), wStitch );

	// L0: everything that faded out becomes roughness.
	const s2 = s2Far
		.add( w1.mul( float( 1 ).sub( D.w2 ).mul( st.s2Ply ).add( float( 1 ).sub( D.w3 ).mul( S2_FIBER ) ).mul( covered ) ) )
		.add( w1.mul( covered ).mul( D.w3.sub( D.w4 ) ).mul( S2_SCALE ) )
		.add( s.s2Yarn );
	return {
		albedo: baseCol.mul( ao1 ).mul( D.aoPly ).mul( D.aoFiber ), cavity, s2, w2: D.w2, w3: D.w3, covered,
		nMix: mix( vec3( 0, 0, 1 ), D.nFiber, w1.mul( covered ) ),
	};

}

// opts.coords:      knit coordinates in meters (default uv * meters_per_uv)
// opts.stitchColor: colour from an image, one colour per stitch (core/colormap.js)
export function buildKnitNodes( u, opts = {} ) {

	if ( u.stitch === 'fleece' ) return buildFleeceNodes( u, opts );
	const uvm = ( opts.coords ?? uv().mul( u.metersPerUV ) ).toVar( 'ix_coords' );
	const fp = footprint( uvm ).toVar( 'ix_fp' );
	const w1 = fadeIn( u.stitchW, fp, 4.0, 12.0 ).toVar();
	const s2Fiber = float( S2_FIBER );

	let J, s = null, st, meanColor, color = u.color, heather = u.heather;
	if ( u.stitch === 'jersey' && ! opts.stitchColor ) {

		// Jersey: the ply rates do not depend on the leg on top, so the
		// faded variance is known without the stitch level.
		st = plyStats( u, u.R.mul( u.stitchW ) );
		meanColor = mix( color, heather, u.heatherFrac ).toVar();
		const s2Far = float( 1 ).sub( w1 ).mul( u.stitchSlopeVar.add( st.s2Ply ).add( s2Fiber ) ).toVar();
		// L1 to L3: under 4 px per stitch (w1 = 0) only the means remain.
		J = gate( fadeOn( u.stitchW, fp, 4.0 ), {
			albedo: { node: meanColor.mul( u.meanAO ).mul( AO_PLY_MEAN ).mul( AO_FIBER_MEAN ), size: 3 },
			cavity: u.meanCavity, s2: s2Far, w2: 0, w3: 0, covered: 0, nMix: [ 0, 0, 1 ], // covered: debug only
		}, () => joinLevels( u, stitchLevel( u, uvm, fp, w1 ), fp, w1, st, { color, heather, meanColor }, s2Far ),
		[ uvm, fp, w1, meanColor, s2Far, st.dvda, st.dvds, st.gl, st.plyPeriod, st.s2Ply, tangentView, bitangentView, normalView ] );

	} else {

		s = u.stitch === 'jersey' ? stitchLevel( u, uvm, fp, w1 ) : patternLevel( u, uvm, fp, w1 );
		st = plyStats( u, s.Rm );
		// Base colour: the preset colour, or the image colour of this stitch.
		// Heather plies are a darker shade of the same colour.
		if ( opts.stitchColor ) {

			const centre = vec2( s.bcol.add( 0.5 ), s.brow.add( 0.6 ).mul( u.aspect ) ).mul( u.stitchW );
			const near = opts.stitchColor.at( centre.sub( uvm ), u.stitchW );
			color = mix( opts.stitchColor.here, near, w1 ).toVar( 'ix_stitch_color' );
			heather = color.mul( u.heather.div( u.color.max( 1e-3 ) ).clamp( 0, 1.5 ) ).toVar();

		}

		meanColor = mix( color, heather, u.heatherFrac ).toVar();
		const s2Far = float( 1 ).sub( w1 ).mul( u.stitchSlopeVar.add( st.s2Ply ).add( s2Fiber ) );
		J = joinLevels( u, s, fp, w1, st, { color, heather, meanColor }, s2Far );

	}

	const { w2, w3, covered } = J;
	// Faded stitch and ply relief still tilt the normals, which changes the
	// light they get. That change depends on the sky, so the lighting
	// measures it (core/slopelight.js) from the faded slope variance. For
	// fibers the gate showed no gain: their slopes are small once averaged.
	const slopeLight = float( 1 ).sub( w1 ).mul( u.stitchSlopeVar ).add( float( 1 ).sub( w2 ).mul( st.s2Ply ) );
	let albedo = J.albedo;
	if ( s?.macro ) albedo = albedo.mul( s.macro.ao );
	// Lace: the backing shows through the eyelets and the gaps. Far away a
	// soft disc per eyelet stands in for the hole.
	const holeMix = s?.hole ? mix( s.hole.far, s.hole.exact, w1 ) : null;
	if ( holeMix ) albedo = mix( albedo, u.backing, holeMix );

	const s2 = J.s2.mul( u.specVarScale );
	let nTangent = J.nMix.normalize();
	// Pattern relief (raised ribs, ridges, cables) tilts the whole yarn.
	if ( s?.macro ) nTangent = nTangent.sub( vec3( s.macro.slope, 0 ).mul( nTangent.z ) ).normalize();
	// On a game mesh, keep the folds of its normal map under the knit.
	const flat = opts.baseNormal ?? normalView;
	const normalNode = ( opts.baseNormal
		? perturbNormal( opts.baseNormal, nTangent.xy.div( nTangent.z.max( 0.2 ) ).negate(), tangentView, bitangentView )
		: TBNViewMatrix.mul( nTangent ).normalize() ).toVar( 'ix_normal' );
	const roughnessNode = specularAA( composeRoughness( u.roughness, s2 ), normalNode );

	const nodes = {
		colorNode: albedo,
		normalNode,
		roughnessNode,
		metalnessNode: float( 0 ),
		// Sheen comes from the fibers, so it takes their colour when the
		// colour comes from an image (white sheen washed orange wool pink).
		sheenNode: ( opts.stitchColor ? meanColor : u.sheenColor ).mul( u.sheen ).mul( u.sheenKeep ),
		sheenRoughnessNode: u.sheenRoughness,
	};
	if ( holeMix ) nodes.sheenNode = nodes.sheenNode.mul( float( 1 ).sub( holeMix ) );
	// Surface states. Cavity: the stitch AO (0 on the yarn tops).
	applySurface( nodes, u.surface, { cavity: J.cavity, flatNormal: flat, porosity: 1 } );
	applyStates( nodes, u.states, { cavity: J.cavity, flatNormal: flat, coords: uvm, fp } );
	nodes.slopeLight = slopeLight;
	nodes.debug = { fp, w1, w2, w3, covered };
	return nodes;

}
