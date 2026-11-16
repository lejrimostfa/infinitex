// Polar fleece: a polyester knit brushed until the stitches vanish under a
// pile of fine fibres, then sheared to an even height.
//   L0 mottle (1 to 3 cm): the pile lies in slightly different directions
//      in patches, so it catches light unevenly. Pills: balls of tangled
//      fibres, 1 to 2 mm, a few per cm2, sitting in their own shadow.
//   L1 tufts (about 1.5 mm): the brushed pile clumps into rounded tufts with
//      dark crevices between them.
//   L2 fibres (15 um polyester, 0.3 to 0.8 mm visible length): curly
//      fibre ends laid every way on top of each tuft, round and a little
//      glossy (polyester, not wool: no scales).
// The fuzz shells (fuzz.js) add the loose fibres standing above the pile.
//
// Tufts, fibres and pills each sit in a gate() (core/lod.js): a level whose
// fade is zero is skipped, only its mean is used.

import { uv, vec2, vec3, float, floor, smoothstep, step, clamp, sqrt, sin, cos, mix, normalView, tangentView, bitangentView } from 'three/tsl';
import { footprint, fadeIn, fadeOn, gate, composeRoughness, specularAA, perturbNormal } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { applySurface } from '../../core/surface.js';

// One layer of short curly fibres at angle a. Cells long along the layer,
// one fibre per cell, 3 x 3 search. Returns coverage, slope, tone.
function fibreLayer( p, fp, u, k ) {

	const a = float( k * 2.1 + 0.3 ).add( u.seed );
	const ca = cos( a ), sa = sin( a );
	const q = vec2( p.x.mul( ca ).add( p.y.mul( sa ) ), p.y.mul( ca ).sub( p.x.mul( sa ) ) );
	const fd = u.fiberDiam;
	const cA = fd.mul( 30 ), cX = fd.mul( 3.2 );
	const x = vec2( q.x.div( cA ), q.y.div( cX ) ).add( k * 17.3 );
	const b = floor( x );
	let cov = float( 0 ), sl = vec2( 0 ), tone = float( 1 );
	for ( let oy = - 1; oy <= 1; oy ++ ) for ( let ox = - 1; ox <= 1; ox ++ ) {

		const id = b.add( vec2( ox, oy ) );
		const h = hash3( id.add( k * 5.7 ) );
		const c = id.add( vec2( h.x, h.y.mul( 0.5 ).add( 0.25 ) ) );
		const wm = x.sub( c ).mul( vec2( cA, cX ) );
		const dir = vec2( cA, h.z.sub( 0.5 ).mul( 2.4 ).mul( cX ) ).normalize();
		const perp = vec2( dir.y.negate(), dir.x );
		const half = hash1( id.add( 3.1 + k ) ).mul( 0.35 ).add( 0.3 ).mul( cA );
		const t = clamp( wm.dot( dir ), half.negate(), half );
		// Curl: a bend of about a third of a turn over the fibre.
		const bend = t.div( half ).pow( 2 ).mul( h.y.sub( 0.5 ) ).mul( cX.mul( 1.6 ) );
		const dv = wm.sub( dir.mul( t ) ).sub( perp.mul( bend ) );
		const r = fd.mul( 0.5 ).mul( hash1( id.add( 6.3 + k ) ).mul( 0.4 ).add( 0.8 ) );
		const rEff = r.max( fp );
		const cv = clamp( rEff.sub( dv.length() ).div( fp ).add( 0.5 ), 0, 1 ).mul( r.div( rEff ) );
		const s = clamp( dv.dot( perp ).div( rEff ), - 0.95, 0.95 );
		const slope = perp.mul( s.div( sqrt( float( 1 ).sub( s.mul( s ) ) ) ).negate().mul( 0.6 ) );
		const win = step( cov, cv );
		cov = cov.max( cv ).toVar();
		sl = mix( sl, slope, win ).toVar();
		tone = mix( tone, h.x.mul( 0.3 ).add( 0.85 ), win ).toVar();

	}

	return { cov, slope: vec2( sl.x.mul( ca ).sub( sl.y.mul( sa ) ), sl.x.mul( sa ).add( sl.y.mul( ca ) ) ), tone };

}

export function buildFleeceNodes( u, opts = {} ) {

	const p = ( opts.coords ?? uv().mul( u.metersPerUV ) ).toVar( 'ix_coords' );
	const fp = footprint( p ).toVar( 'ix_fp' );

	// L0 mottle: patches where the pile leans another way.
	const mq = p.div( 0.012 );
	const mottle = valueNoise( mq ).mul( 0.6 ).add( valueNoise( mq.mul( 2.9 ).add( 4.1 ) ).mul( 0.4 ) );

	// L1 tufts: rounded clumps, warped so they are not cells. Under 1.5 px
	// per tuft (wT = 0) the gate skips the warp and the cells.
	const wT = fadeIn( u.pileM, fp, 1.5, 5.0 ).toVar();
	const T = gate( fadeOn( u.pileM, fp, 1.5 ), { sTuft: [ 0, 0 ], tuftAO: 0.88, tuftCavity: 0 }, () => {

		const tq = p.div( u.pileM );
		const tw = tq.add( vec2( valueNoise( tq.mul( 0.4 ) ), valueNoise( tq.mul( 0.4 ).add( 7.7 ) ) ).sub( 0.5 ).mul( 1.6 ) )
			.add( vec2( valueNoise( tq.mul( 2.3 ) ), valueNoise( tq.mul( 2.3 ).add( 1.9 ) ) ).sub( 0.5 ).mul( 0.35 ) );
		const v = voronoi( tw.add( u.seed.mul( 3.1 ) ), 0.9 );
		const rim = smoothstep( 0.0, 0.6, v.edge ); // 0 in the crevice, soft: the pile spills over
		const tuftH = hash3( v.id1 );
		// Dome: slope points away from the tuft centre, steeper near the rim.
		const toC = v.toSeed;
		return {
			sTuft: toC.mul( float( 1 ).sub( rim ).mul( 0.35 ).add( 0.12 ) ).mul( wT ),
			tuftAO: mix( float( 0.88 ), rim.mul( 0.22 ).add( 0.76 ).mul( tuftH.x.mul( 0.1 ).add( 0.95 ) ), wT ),
			tuftCavity: float( 1 ).sub( rim ).mul( wT ).mul( 0.6 ),
		};

	}, [ p, fp, wT ] );

	// L2 fibres: three layers, the last on top; the deep pile between them.
	// Under 1.5 px per six fibre widths (wF = 0) the gate skips the layers.
	const wF = fadeIn( u.fiberDiam.mul( 6 ), fp, 1.5, 5.0 ).toVar();
	const F = gate( fadeOn( u.fiberDiam.mul( 6 ), fp, 1.5 ), { fibreTone: 0.8, cover: 0, sF: [ 0, 0 ] }, () => {

		let cover = float( 0 ), sF = vec2( 0 ), tone = float( 0.62 );
		for ( let k = 0; k < 3; k ++ ) {

			const L = fibreLayer( p, fp, u, k );
			tone = mix( tone, L.tone.mul( 0.9 + 0.06 * k ), L.cov );
			sF = mix( sF, L.slope, L.cov );
			cover = cover.max( L.cov );

		}

		// Weighted by the fade: cover and sF are only read through wF.
		return { fibreTone: mix( float( 0.8 ), tone, wF ), cover: cover.mul( wF ), sF: sF.mul( wF ) };

	}, [ p, fp, wF ] );

	const fibreTone = F.fibreTone.toVar();
	// Glints: polyester fibres are smooth, so their tops shine a little.
	const fibreRough = mix( u.roughness, u.roughness.mul( 0.75 ), F.cover );

	// Pills: sparse balls on a jittered grid, one chance per cell. Their
	// outline is lumpy and soft (loose fibres), their top a tangle.
	const wPill = fadeIn( u.pillM, fp, 1.0, 3.0 ).toVar();
	const pills = ( color ) => {

		const pq = p.div( u.pillCell );
		let pill = float( 0 ), sPill = vec2( 0 ), pillShadow = float( 0 );
		for ( let oy = 0; oy <= 1; oy ++ ) for ( let ox = 0; ox <= 1; ox ++ ) {

			const id = floor( pq.sub( 0.5 ) ).add( vec2( ox, oy ) );
			const h = hash3( id.add( 91.0 ) );
			const R = u.pillM.mul( 0.5 ).mul( h.z.mul( 0.7 ).add( 0.65 ) );
			const d = pq.sub( id.add( h.xy.mul( 0.6 ).add( 0.2 ) ) ).mul( u.pillCell );
			const on = step( hash1( id.add( 12.5 ) ), 0.85 );
			const lumpy = R.mul( valueNoise( d.div( R.mul( 0.45 ) ).add( id.mul( 7.1 ) ) ).mul( 0.45 ).add( 0.75 ) );
			const dl = d.length();
			const soft = fp.max( R.mul( 0.12 ) );
			const cv = clamp( lumpy.sub( dl ).div( soft ).add( 0.5 ), 0, 1 ).mul( on );
			const k = dl.div( lumpy ).min( 0.95 );
			const sl = d.div( lumpy ).mul( float( 1 ).div( sqrt( float( 1 ).sub( k.mul( k ) ) ) ) ).mul( 0.45 );
			sPill = mix( sPill, sl, cv );
			pill = pill.max( cv );
			pillShadow = pillShadow.max( smoothstep( 1.8, 1.0, dl.div( lumpy ) ).mul( on ) );

		}

		const onPill = pill.mul( wPill ).toVar();
		const tang = valueNoise( p.div( u.fiberDiam.mul( 6 ) ) );
		color = color.mul( float( 1 ).sub( pillShadow.mul( 0.4 ).mul( wPill ).mul( float( 1 ).sub( pill ) ) ) );
		// On a pill the fibres are tangled every way: same fibres, steeper.
		color = mix( color, base.mul( fibreTone ).mul( tang.mul( 0.2 ).add( 0.95 ) ), onPill );
		return { color, onPill, sPill: sPill.mul( onPill ) };

	};

	const base = mix( u.color, u.heather, mottle.mul( u.heatherFrac.mul( 2 ) ).clamp( 0, 1 ) ).toVar();
	const color0 = base.mul( fibreTone ).mul( T.tuftAO ).mul( mottle.sub( 0.5 ).mul( 0.12 ).add( 1 ) ).toVar();
	// Pills: under 1 px per pill (wPill = 0) the gate skips them.
	const P = gate( fadeOn( u.pillM, fp, 1.0 ), { color: { node: color0, size: 3 }, onPill: 0, sPill: [ 0, 0 ] },
		() => pills( color0 ), [ p, fp, wPill, base, color0, fibreTone ] );
	const { color, onPill } = P;
	const slope = T.sTuft.mul( float( 1 ).sub( onPill ) ).add( F.sF.mul( onPill.mul( 0.8 ).add( 0.7 ) ) ).add( P.sPill );
	const rough = mix( fibreRough, float( 0.95 ), onPill );

	const flat = ( opts.baseNormal ?? normalView ).toVar( 'ix_base_normal' );
	const normalNode = perturbNormal( flat, slope, tangentView, bitangentView ).toVar( 'ix_normal' );
	const s2 = float( 1 ).sub( wF ).mul( 0.12 ).add( float( 1 ).sub( wT ).mul( 0.08 ) );
	const roughnessNode = specularAA( composeRoughness( rough, s2 ), normalNode );
	const nodes = {
		colorNode: color, normalNode, roughnessNode, metalnessNode: float( 0 ),
		sheenNode: u.sheenColor.mul( u.sheen ).mul( u.sheenKeep ).mul( base.add( 0.2 ) ), sheenRoughnessNode: u.sheenRoughness,
	};
	applySurface( nodes, u.surface, { cavity: T.tuftCavity, flatNormal: flat, porosity: 0.6 } );
	nodes.debug = { fp, w1: wT, w2: wF, w3: wPill, covered: float( 1 ) };
	return nodes;

}
