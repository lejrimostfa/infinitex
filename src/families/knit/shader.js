// Knit family: TSL node graph. Four levels, each faded by its pixel size.
//   L0 garment: base colour, sheen, roughness widened by the faded levels.
//   L1 stitch:  V-shaped yarn legs, height, normal, cavity AO   (stitch.js)
//   L2 ply:     2-4 plies twisted around each leg (S or Z)      (yarn.js)
//   L3 fiber:   striations of ~20 um fibers inside each ply     (yarn.js)
// This file joins the levels: albedo, AO, normal and roughness.
// Stitch patterns (rib, garter, seed, cable, lace, crochet) swap L1 for
// patterns.js and add a macro relief; fleece has its own graph (fleece.js).

import { uv, vec2, vec3, float, step, sin, mix, mx_cell_noise_float, TBNViewMatrix, normalView, tangentView, bitangentView } from 'three/tsl';
import { applySurface } from '../../core/surface.js';
import { applyStates } from '../../core/states.js';
import { footprint, composeRoughness, specularAA, pick, perturbNormal } from '../../core/lod.js';
import { stitchLevel, stitchAO } from './stitch.js';
import { patternLevel } from './patterns.js';
import { buildFleeceNodes } from './fleece.js';
import { plyLevel, fiberLevel, S2_FIBER, S2_SCALE, AO_FIBER_MEAN } from './yarn.js';

// opts.coords:      knit coordinates in meters (default uv * meters_per_uv)
// opts.stitchColor: colour from an image, one colour per stitch (core/colormap.js)
export function buildKnitNodes( u, opts = {} ) {

	if ( u.stitch === 'fleece' ) return buildFleeceNodes( u, opts );
	const uvm = ( opts.coords ?? uv().mul( u.metersPerUV ) ).toVar( 'ix_coords' );
	const fp = footprint( uvm ).toVar( 'ix_fp' );

	const s = u.stitch === 'jersey' ? stitchLevel( u, uvm, fp ) : patternLevel( u, uvm, fp );
	const ply = plyLevel( u, s, fp );
	const fib = fiberLevel( u, s, ply, fp );
	const { bz, bcol, brow, edgeFade, w1 } = s;
	const covered = s.covered;
	const { v, plyIdx, w2, plyEdge, s2Ply } = ply;
	const { fIdx, fDepth, profile, w3, w4, fiberEdge, nFiber } = fib;

	// Albedo: per-stitch, per-ply (heather) and per-fiber variation, zero mean.
	const hStitch = mx_cell_noise_float( vec3( bcol, brow, u.seed.add( 17 ) ) );
	const hPly = mx_cell_noise_float( vec3( plyIdx, bcol, brow.add( u.seed ) ) );
	const hFiber = mx_cell_noise_float( vec3( fIdx, plyIdx, bcol.add( brow.mul( 131 ) ) ) );
	// Base colour: the preset colour, or the image colour of this stitch.
	// Heather plies are a darker shade of the same colour.
	let color = u.color, heather = u.heather;
	if ( opts.stitchColor ) {

		const centre = vec2( bcol.add( 0.5 ), brow.add( 0.6 ).mul( u.aspect ) ).mul( u.stitchW );
		const near = opts.stitchColor.at( centre.sub( uvm ), u.stitchW );
		color = mix( opts.stitchColor.here, near, w1 ).toVar( 'ix_stitch_color' );
		heather = color.mul( u.heather.div( u.color.max( 1e-3 ) ).clamp( 0, 1.5 ) );

	}

	const meanColor = mix( color, heather, u.heatherFrac );
	const plyColor = pick( step( hPly, u.heatherFrac ), heather, color );
	// Hard colour borders (ply, leg, fiber) also fade to the mean within a pixel.
	const baseCol = mix( meanColor, plyColor, w2.mul( plyEdge ) )
		.mul( hStitch.mul( 2 ).sub( 1 ).mul( u.stitchVar ).mul( w1 ).mul( edgeFade ).add( 1 ) )
		.mul( hFiber.mul( 2 ).sub( 1 ).mul( u.fiberVar ).mul( w3 ).mul( fiberEdge ).add( 1 ) );

	const ao1 = mix( u.meanAO, mix( u.meanAO, stitchAO( s.local ?? bz, u.R, u.arch ), edgeFade ), w1 );
	const aoPly = mix( float( 0.6 + 0.4 * 2 / Math.PI ), sin( v.mul( Math.PI ) ).mul( 0.4 ).add( 0.6 ), w2 );
	// Gap darkening scales with fiber depth. Its mean is analytic (yarn.js).
	const aoFiber = mix( float( AO_FIBER_MEAN ), float( 1 ).sub( fDepth.mul( 0.3 ).mul( float( 1 ).sub( profile ) ) ), w3 );
	// Faded ply relief still costs diffuse light: under sky light a normal
	// with slope t gets (1 + n_z) / 2, about 1 - t^2 / 4 on average.
	// The stitch level carries the same loss inside meanAO (stats.js). For
	// fibers the gate showed no gain: their slopes are small once averaged.
	const diffuseLoss = float( 1 ).sub( float( 1 ).sub( w2 ).mul( s2Ply ).mul( 0.25 ) );
	let albedo = baseCol.mul( ao1 ).mul( aoPly ).mul( aoFiber ).mul( diffuseLoss );
	if ( s.macro ) albedo = albedo.mul( s.macro.ao );
	// Lace: the backing shows through the eyelets and the gaps. Far away a
	// soft disc per eyelet stands in for the hole.
	const holeMix = s.hole ? mix( s.hole.far, s.hole.exact, w1 ) : null;
	if ( s.hole ) albedo = mix( albedo, u.backing, holeMix );

	// L0: everything that faded out becomes roughness.
	const s2Fiber = float( S2_FIBER );
	const s2 = float( 1 ).sub( w1 ).mul( u.stitchSlopeVar.add( s2Ply ).add( s2Fiber ) )
		.add( w1.mul( float( 1 ).sub( w2 ).mul( s2Ply ).add( float( 1 ).sub( w3 ).mul( s2Fiber ) ).mul( covered ) ) )
		.add( w1.mul( covered ).mul( w3.sub( w4 ) ).mul( S2_SCALE ) )
		.add( s.s2Yarn )
		.mul( u.specVarScale );

	let nTangent = mix( vec3( 0, 0, 1 ), nFiber, w1.mul( covered ) ).normalize();
	// Pattern relief (raised ribs, ridges, cables) tilts the whole yarn.
	if ( s.macro ) nTangent = nTangent.sub( vec3( s.macro.slope, 0 ).mul( nTangent.z ) ).normalize();
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
	applySurface( nodes, u.surface, { cavity: float( 1 ).sub( ao1 ).div( 0.7 ).clamp( 0, 1 ), flatNormal: flat, porosity: 1 } );
	applyStates( nodes, u.states, { cavity: float( 1 ).sub( ao1 ).div( 0.7 ).clamp( 0, 1 ), flatNormal: flat, coords: uvm, fp } );
	nodes.debug = { fp, w1, w2, w3, covered };
	return nodes;

}
