// Butterfly wing and insect compound eyes.
// Butterfly wing (a blue morpho, upper side, the wing base at the lower
// left corner of the face):
//   L0 wing      veins fan out from the base and fork, a cross vein closes
//                the discal cell; a black margin scalloped between the
//                veins, a row of white spots in it, a dark costal edge,
//                darker toward the base. The blue is structural: a strong
//                multilayer ridge interference (drawn as a thin film) over
//                dark scales, it turns violet at grazing
//   L1 scales    scales of size_mm (0.2 to 0.3 mm long) in rows across the
//                veins like roof tiles: each tip covers the base of the
//                next row and casts a thin shadow, the dark membrane shows
//                in the slits between them, tips have three or four teeth.
//                Each scale carries one colour: close up a mosaic
//   L2 ridges    longitudinal ridges on each scale (cell_um apart)
// Compound eyes (a carpet of dragonfly-like eyes):
//   L0 eyes      domes of size_mm packed on dark cuticle. Where the facets
//                of a dome look straight at the viewer they show their
//                dark pigment: the pseudopupil, a black spot that follows
//                the eye as the view moves
//   L1 sheen     faint colour bands, hairs between the domes
//   L2 facets    hexagonal lenses (cell_um, 40 to 80 um), each a glossy
//                dome with its own highlight, dark seams between them;
//                too small to draw they become a fine grain and roughness
// Returns { color, slope, cavity, rough, s2, irid, iridThick }.

import { vec2, float, floor, fract, mix, smoothstep, step, clamp, abs, sin, cos, atan, mod, positionView, normalView, tangentView, bitangentView } from 'three/tsl';
import { fadeIn, pick, perturbNormal } from '../../core/lod.js';
import { hash3, valueNoise, wrapCoord } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { fbm, band, hairs, warp2 } from './common.js';
import { hexNet } from './hex.js';

// The scale of row j, column picked by x: local coords (0 at base).
function scale( a, j, H, W, L ) {

	const off = fract( j.mul( 0.37 ) ).mul( W );
	const i = floor( a.x.sub( off ).div( W ) );
	const lx = a.x.sub( off ).sub( i.add( 0.5 ).mul( W ) ).div( W ); // -0.5..0.5
	const ly = a.y.sub( j.mul( H ) ).div( L ); // 0 base .. 1 tip
	const teeth = abs( sin( lx.mul( 3.14159 * 4 ) ) ).mul( 0.06 );
	const tipEnd = float( 1 ).sub( teeth ).sub( lx.mul( lx ).mul( 0.6 ) );
	const inside = step( ly, tipEnd ).mul( step( abs( lx ), 0.44 ) );
	return { id: vec2( i, j ), lx, ly, inside, tipEnd };

}

// Wing pattern at polar position (r, th) from the base. 1 blue .. 0 black.
function wing( r, th, fp, s ) {

	const NV = 9;
	const vt = th.mul( NV * 2 / Math.PI ).add( r.mul( 3 ) ); // veins bend outward
	const vf = fract( vt ).sub( 0.5 );
	const vein = band( vf.mul( r.mul( Math.PI / 2 / NV ) ), float( 2.2e-4 ).add( r.mul( - 4e-4 ) ).max( 1.2e-4 ), fp ).mul( step( 0.025, r ) )
		.max( band( r.sub( 0.105 ).add( vf.mul( 0.01 ) ), float( 2e-4 ), fp ).mul( step( 0.3, th ) ) );
	const edge = fbm( vec2( r, th ).mul( 40 ), float( 1 ), fp.mul( 40 ), 2, 2 ).sub( 0.5 ).mul( 0.004 );
	const rm = float( 0.255 ).add( cos( vt.mul( 6.2832 ) ).mul( - 0.004 ) ).add( edge );
	const margin = smoothstep( rm, rm.add( 0.002 ), r ).max( smoothstep( 1.42, 1.48, th ) );
	const spot = smoothstep( 0.32, 0.22, vec2( vf.mul( 1.1 ), r.sub( 0.272 ).div( 0.012 ) ).length() );
	const base = smoothstep( 0.07, 0.0, r );
	return { vein, margin, spot, base, vt };

}

export function buildButterfly( p, fp, u ) {

	const s = u.seed;
	const d = p.add( vec2( 0.012, 0.012 ) ).add( warp2( p, float( 0.2 ), 1.1 ).mul( 0.01 ) );
	const r = d.length().toVar(), th = atan( d.y, d.x ).toVar();
	// Scale frame: x across the rays (arc length), y outward (radius).
	const a = vec2( r.mul( th ), r );
	const H = u.sizeM.mul( 0.5 ), W = u.sizeM.mul( 0.42 ), L = u.sizeM;
	const j = floor( a.y.div( H ) );
	const A = scale( a, j.sub( 1 ), H, W, L ), B = scale( a, j, H, W, L );
	const top = A.inside; // the row nearer the base lies over this one
	const id = pick( top, A.id, B.id ), lx = pick( top, A.lx, B.lx ), ly = pick( top, A.ly, B.ly );
	const covered = top.max( B.inside );
	const shadow = smoothstep( 0.1, 0.0, A.ly.sub( A.tipEnd ).abs() ).mul( top.oneMinus() );
	const wS = fadeIn( W, fp, 1.0, 3.0 );
	// L0: pattern read at the scale centre when scales show.
	const rc = mix( r, id.y.mul( H ).add( L.mul( 0.5 ) ), wS );
	const thc = mix( th, id.x.add( 0.5 ).mul( W ).div( rc.max( 1e-3 ) ), wS );
	const P = wing( rc, thc, fp, s );
	const k = hash3( id.add( 4.4 ) );
	const tone = fbm( d, float( 0.05 ), fp, 3, 5 );
	const blue = mix( u.color.mul( 0.7 ), u.color.mul( 1.25 ), tone ).mul( k.x.sub( 0.5 ).mul( u.colorVar ).mul( wS ).add( 1 ) );
	let color = mix( blue, u.color3, P.margin );
	color = mix( color, u.color3.mul( 2 ), P.base.mul( 0.7 ) );
	color = mix( color, u.color2, P.spot.mul( P.margin ) );
	color = mix( color, u.color3, P.vein.mul( 0.9 ) );
	// L1: scale shading; dark membrane in the slits; shadow of the tip above.
	const shade = ly.mul( 0.5 ).add( 0.65 ).mul( float( 1 ).sub( shadow.mul( 0.6 ) ) );
	color = color.mul( mix( float( 0.85 ), shade, wS ) );
	color = mix( color, u.color3.mul( 0.5 ), covered.oneMinus().mul( wS ) );
	// L2: ridges along each scale.
	const rq = lx.mul( W ).div( u.cellM );
	const wR = fadeIn( u.cellM, fp, 2.5, 6.0 );
	const ridge = band( fract( rq ).sub( 0.5 ).mul( u.cellM ), u.cellM.mul( 0.15 ), fp ).mul( wR );
	color = color.mul( float( 1 ).sub( ridge.mul( 0.25 ) ) );
	// Each scale lies tilted: its tip lifts, it rolls a little sideways.
	const tilt = vec2( lx.mul( 0.4 ).add( k.y.sub( 0.5 ).mul( 0.3 ) ), ly.mul( 0.3 ).sub( 0.12 ) ).mul( wS ).mul( covered );
	const sl = tilt.add( vec2( sin( rq.mul( 6.283 ) ).mul( 0.2 ).mul( wR ), 0 ) );
	const er = d.div( r.max( 1e-4 ) ), et = vec2( er.y.negate(), er.x );
	const slope = et.mul( sl.x ).add( er.mul( sl.y ) ).mul( u.relief );
	const blueOn = P.margin.oneMinus().mul( P.vein.oneMinus() ).mul( P.base.oneMinus() );
	const irid = blueOn.mul( u.sheen ).mul( mix( float( 1 ), covered, wS ) );
	const iridThick = mix( float( 240 ), float( 360 ), k.y.mul( 0.6 ).add( ly.mul( 0.4 ) ).mul( wS ).add( tone.mul( wS.oneMinus() ) ) );
	return { color, slope, cavity: shadow.mul( 0.5 ).max( covered.oneMinus().mul( wS ) ), rough: u.roughness, s2: wS.oneMinus().mul( 0.05 ), irid, iridThick, iridIOR: float( 1.56 ) };

}

export function buildInsectEye( p, fp, u ) {

	const s = u.seed;
	// L0: eye domes packed on the head cuticle.
	// Each eye a sphere cap in its Voronoi cell, packed close.
	const D = voronoi( wrapCoord( p.div( u.sizeM ) ).add( s.mul( 0.7 ) ), 0.7 );
	const kd = hash3( D.id1.add( 2.9 ) );
	const R = kd.x.mul( 0.08 ).add( 0.44 ).min( D.edge.add( D.toSeed.length() ).mul( 0.98 ) );
	const v = D.toSeed.div( R ), dv = v.length();
	const eye = clamp( float( 1 ).sub( dv ).mul( R ).mul( u.sizeM ).div( fp ).add( 0.5 ), 0, 1 );
	const domeS = v.div( float( 1 ).sub( dv.mul( dv ) ).max( 0.08 ).sqrt() ).mul( - 0.9 ).mul( eye );
	const Dh = float( 1 ).sub( dv.mul( dv ) ).max( 0 ).sqrt();
	// Pseudopupil: facets whose axis points at the eye of the viewer.
	const nD = perturbNormal( normalView, domeS, tangentView, bitangentView );
	const V = positionView.negate().normalize();
	const pupil = smoothstep( 0.965, 0.995, nD.dot( V ) ).mul( eye );
	// L1: faint bands, hairs.
	const w = p.add( warp2( p, float( 0.05 ), 2.2 ).mul( 0.01 ) );
	const band0 = fract( Dh.mul( 2.2 ).add( fbm( w, float( 0.03 ), fp, 2, 3 ).mul( 0.4 ) ) );
	let color = mix( u.color, u.color2, smoothstep( 0.3, 0.7, band0 ).mul( 0.35 ) ).mul( kd.y.sub( 0.5 ).mul( u.colorVar ).add( 1 ) ).mul( Dh.mul( 0.3 ).add( 0.7 ) );
	// L2: facets on a net that bends round each dome.
	const q = p.add( D.toSeed.mul( u.sizeM ).mul( 0.15 ) ).div( u.cellM ).add( s.mul( 3 ) );
	const X = hexNet( q );
	const wF = fadeIn( u.cellM, fp, 1.5, 4.0 );
	const seam = clamp( u.cellM.mul( 0.06 ).sub( X.edge.mul( u.cellM ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( wF ).mul( eye );
	const kf = hash3( X.id.add( 3.1 ) );
	// Unresolved facets: a fine grain of their mean (a touch darker).
	const grain = valueNoise( p.div( u.cellM.mul( 1.5 ) ) ).sub( 0.5 ).mul( 0.15 ).mul( fadeIn( u.cellM.mul( 1.5 ), fp, 1.0, 2.0 ) ).mul( wF.oneMinus() );
	color = color.mul( kf.x.sub( 0.5 ).mul( 0.15 ).mul( wF ).add( 1 ).add( grain ) ).mul( float( 1 ).sub( seam.mul( 0.7 ) ) );
	color = mix( color, u.color3, pupil.mul( 0.9 ) );
	const cuticle = u.color3.mul( 1.6 ).mul( fbm( p, u.sizeM.mul( 0.2 ), fp, 3, 8 ).mul( 0.4 ).add( 0.8 ) );
	color = mix( cuticle, color, eye );
	const Hr = hairs( p, u.featureM.mul( 0.5 ), u.fiberM, u.fuzz.mul( eye.oneMinus().mul( 0.7 ).add( 0.15 ) ), fp, 5.9, valueNoise( p.div( 0.02 ) ).mul( 6.28 ), 0.6, 1.0 );
	color = mix( color, u.color2.mul( 0.6 ).add( 0.15 ), Hr.cover.mul( 0.8 ) );
	const lens = X.g.mul( 1.1 ).mul( wF ).mul( eye );
	const slope = domeS.add( lens ).add( Hr.slope.mul( 0.5 ) ).mul( u.relief );
	const irid = u.sheen.mul( eye ).mul( float( 1 ).sub( seam ) ).mul( pupil.oneMinus() );
	const iridThick = mix( float( 300 ), float( 520 ), band0 );
	const s2 = wF.oneMinus().mul( 0.06 ).mul( eye );
	return { color, slope, cavity: seam.max( eye.oneMinus().mul( 0.6 ) ), rough: mix( float( 0.6 ), u.roughness, eye ), s2, irid, iridThick };

}
