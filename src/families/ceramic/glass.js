// A block of glass, seen through (transmission: three.js samples the
// opaque scene behind, blurred by the roughness, bent by the normal).
// Frosted (sand-blasted) glass:
//   L0  the blast is never even: denser and lighter patches of 2 cm
//   L1  pits of frost_um (50 um): each grain of sand knocked out a small
//       conchoidal shell; the pits overlap and meet in sharp ridges. Their
//       slopes scatter the light: far away this is the roughness (their
//       slope variance), near they are many small smooth mirrors
//   L2  pits of a third the size inside, and the ripples of the fracture
//   clear_mm: bands masked off before the blast stay clear, their edge
//   softened by overspray; through them the scene behind is sharp
// Blown glass:
//   L0  waviness: the glass was blown and turned, never flat (0.3 mm over
//       4 cm); cords: streaks of glass of another index, long along the
//       flow, that bend the view behind
//   L1  seed bubbles of 0.3 to 3 mm, stretched along the flow, at three
//       depths; parallax puts them inside the block as the eye moves
//   L2  micro seeds of 20 to 100 um just under the surface
// A bubble: a dark rim (the light bends away), a clear centre, a bright
// spot where it reflects the light.
//
// Returns { color, slope, cavity, rough, s2, transmission }.
//
// The frost pits (each octave, the big pits) and the seed bubbles sit in
// gate()s (core/lod.js): they run only where they show.

import { vec2, vec3, float, fract, step, smoothstep, sin, cos, mod, positionView, tangentView, bitangentView } from 'three/tsl';
import { fadeIn, fadeOn, gate, surfaceGradient } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { bubbleCells, bubbleAt, capSlope } from './bubbles.js';

function frosted( p, fp, u, y ) {

	const s = u.seed, f = u.frostM;
	// Uneven blast: soft patches and the passes of the nozzle.
	const patchy = valueNoise( p.div( 0.03 ).add( s ) ).mul( 0.6 ).add( valueNoise( p.div( 0.008 ).add( s.add( 1 ) ) ).mul( 0.4 ) );
	const pass = valueNoise( vec2( p.x.div( 0.12 ), p.y.div( 0.011 ) ).add( s.add( 2 ) ) );
	let dens = u.frost.mul( patchy.mul( 0.16 ).add( pass.mul( 0.12 ) ).add( 0.8 ) ).min( 1 );
	// Clear bands masked off before the blast; the overspray softens
	// their edge over about a millimetre.
	const yy = fract( y.div( u.clearEvery ) ).sub( 0.5 ).mul( u.clearEvery ).abs().add( valueNoise( p.div( 0.0015 ).add( 3.3 ) ).sub( 0.5 ).mul( 6e-4 ) );
	dens = dens.mul( smoothstep( u.clearM.mul( 0.5 ).sub( 2e-4 ), u.clearM.mul( 0.5 ).add( 1e-3 ), yy ).max( step( u.clearM, 0 ) ) );
	// Pits: concave, height ~ distance to the pit centre squared.
	// Skipped under 1.5 px per pit, with their ripples (narrower fade).
	const wA = fadeIn( f, fp, 1.5, 4.0 ).toVar();
	const qA = mod( p.div( f ), 4096 ).add( s.mul( 3 ) ).toVar();
	const PA = gate( fadeOn( f, fp, 1.5 ), { slope: [ 0, 0 ], ridge: 0 }, () => {

		const A = voronoi( qA, 0.95 );
		const hA = hash3( A.id1 );
		const k = hA.x.mul( 0.8 ).add( 0.7 ); // steepness of this pit
		// Ripples of the fracture, round each pit.
		const rr = A.toSeed.length();
		const wR = fadeIn( f.mul( 0.12 ), fp, 2.0, 5.0 );
		return {
			slope: A.toSeed.mul( k ).mul( 1.4 ).mul( wA ).add( A.toSeed.div( rr.max( 1e-3 ) ).mul( sin( rr.mul( 38 ).add( hA.y.mul( 6.28 ) ) ).mul( 0.12 ) ).mul( wR ) ),
			ridge: smoothstep( 0.06, 0.0, A.edge ).mul( wA ),
		};

	}, [ fp, wA, qA ] );
	let slope = PA.slope;
	// Smaller pits on top. Skipped under 1.5 px per pit.
	const wB = fadeIn( f.mul( 0.33 ), fp, 1.5, 4.0 ).toVar();
	const qB = mod( p.div( f.mul( 0.33 ) ), 4096 ).add( 7.7 ).toVar();
	const PB = gate( fadeOn( f.mul( 0.33 ), fp, 1.5 ), { slope: [ 0, 0 ] }, () => ( { slope: voronoi( qB, 0.95 ).toSeed.mul( 0.9 ).mul( wB ) } ), [ wB, qB ] );
	slope = slope.add( PB.slope );
	// Unresolved pits go into the roughness (slope variance of a paraboloid
	// pit: k^2 / 6 per axis, here both octaves).
	// A few big pits where a coarse grain hit (100 to 200 um): they glint
	// at arm's length, where the small ones are already a haze. Skipped
	// where they are under a pixel (their fade is zero).
	const qC = bubbleCells( p, f.mul( 5 ), 51 ).toVar();
	const C = gate( fadeOn( f.mul( 5 * 0.77 ), fp, 1.0 ), { slope: [ 0, 0 ], fade: 0 }, () => {

		const B = bubbleAt( qC, fp, f.mul( 5 ), float( 0.35 ), 51 );
		return { slope: capSlope( B.v, B.d ).mul( B.inside ).mul( B.fade ).mul( 0.5 ), fade: B.fade };

	}, [ fp, qC ] );
	slope = slope.add( C.slope );
	const s2 = wA.oneMinus().mul( 0.12 ).add( wB.oneMinus().mul( 0.05 ) ).add( C.fade.oneMinus().mul( 0.01 ) ).mul( dens );
	// Ridges where pits meet catch a little light: a white haze.
	const ridge = PA.ridge.max( wA.oneMinus().mul( 0.25 ) );
	return { slope: slope.mul( dens ), s2, haze: ridge.mul( dens ), dens };

}

// Where a layer at depth d (meters) is seen from this pixel: the view ray,
// bent by refraction, travels sideways while it goes down.
function under( p, d, u ) {

	const V = positionView.negate().normalize();
	const vt = vec2( V.dot( tangentView ), V.dot( bitangentView ) ).div( u.ior );
	const vn = float( 1 ).sub( vt.dot( vt ) ).max( 0.05 ).sqrt();
	return p.sub( vt.mul( d ).div( vn ) );

}

// Seed bubbles at four depths. Skipped where even the biggest are under a
// pixel (every fade is zero there).
function seeds( p, fp, u, dirs ) {

	const layers = [ [ 0.003, 1.0, 1 ], [ 0.012, 0.75, 7 ], [ 0.03, 0.55, 13 ], [ 0.0004, 0.12, 19 ] ];
	// Cell coordinates of each layer, taken before the gate.
	const xs = layers.map( ( [ depth, size, salt ] ) => {

		const q = under( p, depth, u );
		const along = q.dot( dirs.d ), across = q.dot( dirs.n );
		const qs = vec2( along.div( 3 ), across ); // stretched along the flow
		return bubbleCells( qs, u.seedM.mul( size * 3 ), salt ).toVar();

	} );
	return gate( fadeOn( u.seedM.mul( 3 * 0.77 ), fp, 1.0 ), { dark: 0, spot: 0 }, () => {

		let dark = float( 0 ), spot = float( 0 ), bright = float( 0 );
		layers.forEach( ( [ depth, size, salt ], i ) => {

			const B = bubbleAt( xs[ i ], fp, u.seedM.mul( size * 3 ), u.seeds.mul( size < 0.2 ? 0.9 : 0.45 ), salt );
			const sp = smoothstep( 0.18, 0.04, B.v.sub( vec2( - 0.3, 0.4 ) ).length() ).mul( B.inside ).mul( 0.6 );
			// Inside the edge the view ray bends away: a dark band. On the edge
			// itself the light reflects totally: a thin silver line.
			const band = smoothstep( 0.7, 0.95, B.d ).mul( B.inside );
			const k = float( 1 - depth * 10 ).mul( B.fade );
			dark = dark.max( band.mul( k ) );
			// The silver line is a crescent on the side facing the light.
			const side = smoothstep( - 0.2, 0.8, B.v.normalize().dot( vec2( - 0.6, 0.8 ) ) );
			bright = bright.max( smoothstep( 0.55, 0.68, B.d ).mul( smoothstep( 0.8, 0.68, B.d ) ).mul( B.inside ).mul( side ).mul( k ).mul( 0.4 ) );
			spot = spot.max( sp.mul( B.fade ).mul( 0.3 ) );

		} );
		return { dark, spot: spot.max( bright.mul( 0.8 ) ) };

	}, [ fp, ...xs ] );

}

export function buildGlass( p, fp, u ) {

	const s = u.seed;
	const d = vec2( cos( u.angle ), sin( u.angle ) ), n = vec2( sin( u.angle ).negate(), cos( u.angle ) );
	const x = p.dot( d ), y = p.dot( n );
	let color = vec3( 1 ), slope = vec2( 0 ), s2 = float( 0 ), transmission = float( 1 ), cavity = float( 0 );

	if ( u.wave.value > 0 || u.cords.value > 0 ) {

		// Waviness and cords as one height: cords bend the light like a
		// ridge of the surface would.
		const wave = valueNoise( p.div( 0.045 ).add( s ) ).mul( 0.65 ).add( valueNoise( p.div( 0.013 ).add( s.add( 3 ) ) ).mul( 0.35 ) ).mul( u.wave ).mul( 3e-4 );
		const cy = y.add( valueNoise( vec2( x.div( 0.08 ), y.div( 0.05 ) ).add( s ) ).sub( 0.5 ).mul( 0.02 ) );
		const c1 = valueNoise( vec2( x.div( 0.2 ), cy.div( 0.005 ) ).add( 4.4 ) );
		const c2 = valueNoise( vec2( x.div( 0.09 ), cy.div( 0.0013 ) ).add( 8.8 ) ).mul( fadeIn( float( 0.0013 ), fp, 1.5, 4.0 ) );
		const cord = smoothstep( 0.5, 0.85, c1 ).mul( 0.7 ).add( smoothstep( 0.55, 0.9, c2 ).mul( 0.3 ) ).mul( u.cords );
		slope = surfaceGradient( wave.add( cord.mul( 1.5e-4 ) ), p );
		color = color.mul( float( 1 ).sub( cord.mul( 0.08 ) ) );

	}

	if ( u.seeds.value > 0 ) {

		const S = seeds( p, fp, u, { d, n } );
		color = color.mul( float( 1 ).sub( S.dark.mul( 0.7 ) ) );
		transmission = transmission.sub( S.spot.mul( 0.6 ) );

	}

	let rough = u.roughness;
	if ( u.frost.value > 0 ) {

		const F = frosted( p, fp, u, y );
		slope = slope.add( F.slope );
		s2 = s2.add( F.s2 );
		// Frosted glass scatters some light back: a little white diffuse.
		transmission = transmission.sub( F.dens.mul( 0.05 ) ).sub( F.haze.mul( 0.1 ) );
		cavity = F.haze.mul( 0.3 );

	}

	return { color, slope, cavity, rough, s2, transmission: transmission.clamp( 0, 1 ) };

}
