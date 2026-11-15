// Liquid states (core/states.js): drops that bead on a matter.
// Sweaty (sweaty_mm: mean droplet diameter, about 1.2 mm):
//   L0  damp zones of a few cm where a thin film makes the skin shine
//   L1  droplets of 0.8 to 3 mm, round caps (contact angle about 70
//       degrees), each a lens: a sharp highlight, a dark rim, a bright
//       caustic on the side away from the light
//   L2  micro beads of 60 to 200 um at the pores; once below the pixel
//       they add to the film's gloss
// Bloody (bloody_mm: drop spacing, about 10 mm; bloody_age 0 fresh, 1 dry):
//   L0  soaked stains (2 to 4 cm) with a dark tide line, fingers along
//       the threads; on top, beaded drops and their satellites
//   L1  fresh drops are glossy dark red domes, lighter at the thin rim;
//       dried ones are flatter, browner, matt, and crack into flakes of
//       about 0.4 mm
//   L2  the stain dyes each thread and fibre by its own share
// A drop hides the matter's relief (its own surface is smooth); its
// clear-coat lobe follows the drop, so the highlight sits on the cap.

import { vec2, vec3, float, mix, smoothstep, mod, tangentView, bitangentView } from 'three/tsl';
import { fadeIn, perturbNormal } from './lod.js';
import { voronoi } from './voronoi.js';
import { fbm, line } from '../families/ground/grains.js';
import { blobs, dome, lens, over, hero } from './states_shape.js';
import { stains, threadShare } from './states_stain.js';
import { lay } from './states.js';

// Liquid caps: lay them and give the clear coat their normal.
function caps( nodes, ctx, D, { color, rough, slope, coat } ) {

	lay( nodes, ctx, { cov: D.cov, color, rough, slope, hide: float( 1 ) } );
	const c = D.cov.mul( coat );
	nodes.clearcoatNode = ( nodes.clearcoatNode ?? float( 0 ) ).max( c );
	nodes.clearcoatRoughnessNode = mix( nodes.clearcoatRoughnessNode ?? float( 0.1 ), float( 0.02 ), c );
	nodes.clearcoatNormalNode = perturbNormal( ctx.flatNormal, slope, tangentView, bitangentView );
	return nodes;

}

export function buildSweat( nodes, ctx ) {

	const { p, fp, s, down } = ctx;
	const g = s.sweatM, a = s.sweaty;
	const zone = smoothstep( 0.3, 0.75, fbm( p.div( 0.05 ).add( s.seed.mul( 1.3 ) ), 3 ) ).mul( 0.7 ).add( 0.3 ).toVar();
	const D1 = blobs( p, fp, g.mul( 3.5 ), a.mul( zone ).mul( 0.55 ), 1.7, { rMin: 0.1, rMax: 0.3, wobble: 0.06, jitter: 0.8 } );
	const D2 = blobs( p, fp, g.mul( 1.3 ), a.mul( zone ).mul( 0.5 ), 5.9, { rMin: 0.1, rMax: 0.28, wobble: 0.05, jitter: 0.8 } );
	const D3 = blobs( p, fp, g.mul( 0.25 ), a.mul( zone ).mul( 0.6 ), 3.1, { rMin: 0.12, rMax: 0.3, wobble: 0.04, jitter: 0.8 } );
	const w3 = fadeIn( g.mul( 0.12 ), fp, 2.0, 6.0 );
	const D = over( over( D1, D2 ), { ...D3, cov: D3.cov.mul( w3 ) } );

	// L0 film, and the unresolved beads: a smoother, glossier skin.
	const film = a.mul( zone ).mul( 0.6 ).add( a.mul( zone ).mul( 0.3 ).mul( w3.oneMinus() ) ).min( 1 );
	nodes.roughnessNode = mix( nodes.roughnessNode, nodes.roughnessNode.mul( 0.45 ), film );
	nodes.colorNode = nodes.colorNode.mul( mix( float( 1 ), float( 0.92 ), film ) );
	nodes.clearcoatNode = ( nodes.clearcoatNode ?? float( 0 ) ).max( film.mul( 0.5 ) );
	nodes.clearcoatRoughnessNode = mix( nodes.clearcoatRoughnessNode ?? float( 0.1 ), float( 0.12 ), film );

	// L1 drops: the skin seen through a lens.
	const slope = dome( D, fp, 0.45 );
	const color = nodes.colorNode.mul( 0.9 ).mul( lens( D, down, fp ) );
	return caps( nodes, ctx, D, { color, rough: float( 0.03 ), slope, coat: float( 1 ) } );

}

export function buildBlood( nodes, ctx ) {

	const { p, fp, s, down } = ctx;
	const g = s.bloodM, age = s.bloodAge;
	const fresh = s.bloodColor, dried = s.bloodColor.mul( vec3( 0.75, 1.6, 1.4 ) ).add( vec3( 0.02, 0.008, 0.004 ) );
	const blood = mix( fresh, dried, age ).toVar();

	// L0 soaked stains: dye the matter, darker tide line, wicked edges.
	const St = stains( p, fp, g.mul( 3 ), s.bloody.mul( 0.4 ), 5.5, hero( p, fp, vec2( 0.145, 0.157 ), 0.009, [ 0.3, 0.5, 0.7 ], 0.5 ) );
	const k = St.cov.mul( threadShare( p, fp ) ).mul( St.core.mul( 0.25 ).add( 0.75 ) ).min( 1 ).toVar();
	const dye = mix( blood.mul( 2.2 ).min( vec3( 1 ) ), blood.mul( 1.1 ), St.tide.max( St.core.mul( 0.4 ) ) );
	nodes.colorNode = mix( nodes.colorNode, nodes.colorNode.mul( dye ), k );
	nodes.roughnessNode = mix( nodes.roughnessNode, nodes.roughnessNode.mul( 0.85 ), k );
	if ( nodes.sheenNode ) nodes.sheenNode = nodes.sheenNode.mul( float( 1 ).sub( k.mul( 0.8 ) ) );

	// Drops on top, and satellites flung around them.
	const spray = smoothstep( 0.35, 0.7, fbm( p.div( 0.06 ).add( s.seed.mul( 2.3 ) ), 3 ) ).toVar();
	const D1 = blobs( p, fp, g, s.bloody.mul( 0.4 ).mul( spray ), 2.2, { rMin: 0.08, rMax: 0.3, wobble: 0.2, jitter: 0.8 } );
	const D2 = blobs( p, fp, g.mul( 0.3 ), s.bloody.mul( 0.35 ).mul( spray ), 7.7, { rMin: 0.06, rMax: 0.22, wobble: 0.12, jitter: 0.8 } );
	const D = over( over( D1, D2 ), hero( p, fp, vec2( 0.1535, 0.1515 ), 0.003, [ 0.2, 0.4, 0.6 ], 0.15 ) );
	// Thin rim lets the red through; the thick cap is near black.
	const thin = smoothstep( 0.55, 1.0, D.rho );
	let color = mix( blood.mul( 0.45 ), blood.mul( 2.2 ).min( vec3( 1 ) ), thin.mul( 0.8 ) );
	color = color.mul( lens( D, down, fp, age.oneMinus().mul( 0.5 ) ) );
	// L1 dried crust cracks into flakes.
	const wC = fadeIn( float( 4e-4 ), fp, 2.0, 6.0 );
	const V = voronoi( mod( p.div( 4e-4 ), 4096 ).add( 6.6 ), 0.85 );
	const crack = line( V.edge.mul( 4e-4 ), float( 1.2e-5 ), fp ).mul( wC ).mul( smoothstep( 0.4, 0.9, age ) ).mul( thin.oneMinus() );
	color = color.mul( float( 1 ).sub( crack.mul( 0.7 ) ) );
	const slope = dome( D, fp, mix( float( 0.15 ), float( 0.06 ), age ) ).add( V.dir.mul( smoothstep( 0.08, 0.0, V.edge ) ).mul( 0.3 ).mul( crack ).mul( D.cov ) );
	const rough = mix( float( 0.05 ), float( 0.5 ), age ).add( crack.mul( 0.3 ) );
	return caps( nodes, ctx, D, { color, rough, slope, coat: age.oneMinus() } );

}
