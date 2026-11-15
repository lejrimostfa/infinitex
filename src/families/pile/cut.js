// Cut-pile carpet (saxony, plush): yarn tufted through a backing, every
// loop cut open at the top. Seen from above:
//   L0 shading  crushed patches turn the lean of the pile (brush field):
//               light and dark tracks that change with the view
//   L1 tufts    one tuft every 2.5 to 4 mm (the gauge). A tuft is a cut
//               end of a 2-ply yarn, heat set: two round ply ends side by
//               side, each a pinwheel of twisted fibres. Between tufts the
//               deep pile is in shadow.
//   L2 fibres   nylon or wool fibres (30 to 45 um) end as round dots
// The tufts sit on the same jittered lattice as the 3D strand locks, so
// near the camera the 3D tufts (core/hair3d.js) stand where they were
// painted. The tips lean by length x lean, the painted tops move with them.

import { vec2, float, sqrt, mix, smoothstep, step, clamp, sin, cos, atan } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { fibreEnds } from './fibres.js';

export function buildCut( p, fp, u, B ) {

	// Sample where the tips are: the tuft leans along the pile direction.
	const ps = p.sub( B.dir.mul( u.lengthM.mul( B.lean ).mul( float( 1 ).sub( u.clump.mul( 0.5 ) ) ) ) );
	const V = voronoi( ps.div( u.lockM ).add( u.seed.mul( 3 ) ), 1.0 );
	const wT = fadeIn( u.lockM, fp, 1.5, 4.0 ).toVar();
	const h = hash3( V.id1.add( 5.5 ) );
	const R = h.x.mul( 0.14 ).add( 0.4 ); // tuft top radius, cells
	const a0 = h.y.mul( Math.PI * 2 );
	const rel = V.toSeed;
	const e = vec2( rel.x.mul( cos( a0 ) ).add( rel.y.mul( sin( a0 ) ) ), rel.y.mul( cos( a0 ) ).sub( rel.x.mul( sin( a0 ) ) ) );
	// The nearer of the two ply ends.
	const side = step( 0, e.x ).mul( 2 ).sub( 1 );
	const dp = e.sub( vec2( side.mul( R ).mul( 0.42 ), 0 ) );
	const rp = R.mul( 0.66 );
	const dl = dp.length();
	const cellFp = fp.div( u.lockM );
	const plyCov = clamp( rp.sub( dl ).div( cellFp ).add( 0.5 ), 0, 1 );
	// The tuft as a whole blooms past its plies and meets its neighbours.
	const tuftCov = clamp( R.mul( 1.15 ).sub( rel.length() ).div( cellFp.max( 0.08 ) ).add( 0.5 ), 0, 1 ).mul( smoothstep( 0.0, 0.1, V.edge ) );
	const qd = dl.div( rp ).clamp( 0, 0.97 );
	const dome = sqrt( float( 1 ).sub( qd.mul( qd ) ) );
	// Pinwheel: the fibres of a twisted ply spiral out from its centre.
	const phi = atan( dp.y, dp.x );
	const wS = fadeIn( u.lockM.mul( 0.25 ), fp, 2.0, 5.0 );
	const swirl = sin( phi.mul( 3 ).add( qd.mul( 7 ) ).add( h.z.mul( 6.28 ) ) ).mul( 0.12 ).mul( wS ).mul( plyCov ).add( 1 );
	const seam = mix( float( 0.7 ), float( 1 ), plyCov );
	const top = dome.mul( 0.35 ).add( 0.65 ).mul( swirl ).mul( seam );
	const deep = float( 1 ).sub( u.lockDepth );
	const tShade = mix( deep, top, tuftCov );
	const shade = mix( mix( deep, float( 0.85 ), 0.75 ), tShade, wT );
	const tuftVar = mix( float( 1 ), h.z.sub( 0.5 ).mul( u.colorVar ).add( 1 ), wT );
	// Dome slopes: the ply (rotated back to surface axes) and the tuft.
	const sp = dp.div( rp ).mul( plyCov ).mul( 0.5 );
	const spW = vec2( sp.x.mul( cos( a0 ) ).sub( sp.y.mul( sin( a0 ) ) ), sp.x.mul( sin( a0 ) ).add( sp.y.mul( cos( a0 ) ) ) );
	const sTuft = spW.add( rel.mul( 0.5 ).mul( tuftCov ) ).mul( wT );

	// Fibre ends: a fibre bundle, fibres about 1.4 diameters apart.
	const F = fibreEnds( ps, fp, B.dir, B.lean.mul( 0.4 ), u.strandW.mul( 1.4 ), u.strandW.mul( 0.5 ), u.seed );
	const fShade = mix( float( 0.62 ), F.shade.mul( 0.8 ).add( 0.3 ), F.w.mul( tuftCov.mul( wT ).add( float( 1 ).sub( wT ) ) ) );
	// Slow dye and yarn lot drift over the carpet.
	const drift = valueNoise( p.div( 0.09 ).add( u.seed.mul( 7 ) ) ).sub( 0.5 ).mul( u.colorVar ).add( 1 );
	const col = mix( u.color, u.tipColor, top.mul( tuftCov ).mul( wT ).mul( 0.6 ) );
	const color = col.mul( shade ).mul( fShade.mul( 1.3 ) ).mul( tuftVar ).mul( drift ).mul( B.viewShade );
	const slope = sTuft.add( F.slope.mul( F.w ).mul( tuftCov ) );
	const s2 = float( 1 ).sub( wT ).mul( 0.1 ).add( float( 1 ).sub( F.w ).mul( 0.06 ) );
	return { color, slope, s2, cavity: float( 1 ).sub( tuftCov ).mul( wT ), rough: u.roughness, sheenColor: u.tipColor };

}
