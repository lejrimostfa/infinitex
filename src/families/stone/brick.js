// Brick and mortar. angle_deg turns the courses.
//   L0 bond     courses of bricks (brick_mm x course_mm) in joints
//               (joint_mm) of mortar set back by recess_mm. bond 0:
//               running bond, half a brick offset. bond 1: English bond,
//               stretcher courses and header courses in turn
//   L0 firing   each brick its own colour: where it sat in the kiln, flashed
//               darker ends, mottled faces
//   L1 face     chipped arrises (chips), sand grains pressed into the face,
//               grog (crushed fired clay, 0.5 to 2 mm), iron specks, pores;
//               mortar with its sand, tooled concave
//   L2 clay     silt grains 20 to 60 um glinting, micro pores
// color = brick, color2 = dark firing, color3 = mortar, color4 = grog.

import { vec2, vec3, float, floor, fract, mix, smoothstep, step, clamp, mod, max, min } from 'three/tsl';
import { fadeIn, surfaceGradient } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';
import { dir2, band, grains, fbm } from './common.js';

export function buildBrick( p, fp, u ) {

	const s = u.seed, J = u.jointM;
	const ax = dir2( u.angle ), ay = vec2( ax.y.negate(), ax.x );
	const tx = p.dot( ax ), ty = p.dot( ay );

	// Course and brick.
	const H = u.courseM.add( J ), Lu = u.brickM.add( J );
	const cy = ty.div( H ).add( 0.31 );
	const course = floor( cy );
	const odd = fract( course.mul( 0.5 ) ).mul( 2 );
	const Lc = mix( Lu, Lu.mul( 0.5 ), odd.mul( u.bond ) );
	const off = odd.mul( mix( float( 0.5 ), float( 0.25 ), u.bond ) ).mul( Lu );
	const bx = tx.add( off ).div( Lc ).add( 0.13 );
	const id = vec2( floor( bx ), course ).toVar();
	const hb = hash3( id.add( s.mul( 3.3 ) ) ).toVar();
	const lx = fract( bx ).sub( 0.5 ).mul( Lc ), ly = fract( cy ).sub( 0.5 ).mul( H );
	const hx = Lc.sub( J ).mul( 0.5 ), hy = u.courseM.mul( 0.5 );
	// Bricks are never quite square: wobble the outline a little.
	const wob = valueNoise( p.div( 0.03 ).add( hb.xy.mul( 20 ) ) ).sub( 0.5 ).mul( J ).mul( 0.25 );
	const dIn = min( hx.sub( lx.abs() ), hy.sub( ly.abs() ) ).add( wob ).toVar(); // > 0 on the brick

	// Chips: bites out of the arris, deeper where the noise says so.
	const cn = fbm( p.add( hb.xy ), float( 0.012 ), fp, 3, 2 );
	const chipD = smoothstep( 0.5, 0.75, cn ).mul( u.chips ).mul( 0.009 );
	const chip = clamp( chipD.sub( dIn ).div( fp ).add( 0.5 ), 0, 1 ).mul( step( 1e-5, chipD ) ).toVar();
	const brick = clamp( dIn.div( fp ).add( 0.5 ), 0, 1 ).toVar();

	// Firing colour.
	const fire = hb.x.pow( 2 );
	const flashSide = step( 0.5, hb.y ).mul( 2 ).sub( 1 );
	const flash = smoothstep( 0.1, 1.0, lx.div( hx ).mul( flashSide ) ).mul( step( 0.6, hb.z ) );
	const mott = fbm( p.add( hb.yz ), float( 0.03 ), fp, 4, 3 );
	let bCol = mix( u.color, u.color2, fire.mul( 0.7 ).add( flash.mul( 0.5 ) ).min( 1 ) ).mul( mott.sub( 0.5 ).mul( u.colorVar ).mul( 2 ).add( 1 ) ).mul( hb.z.sub( 0.5 ).mul( u.colorVar ).add( 1 ) );
	// Sand on the face, grog, dark iron specks.
	const Sg = grains( p, float( 4e-4 ), fp, 0.0, 5 );
	const sand = Sg.inside.mul( step( 0.8, Sg.h.y ) ).mul( Sg.w );
	const gw = p.add( vec2( valueNoise( p.div( 8e-4 ) ), valueNoise( p.div( 8e-4 ).add( 3 ) ) ).sub( 0.5 ).mul( 6e-4 ) );
	const Gg = grains( gw, float( 1.2e-3 ), fp, 0.3, 7 );
	const grog = Gg.inside.mul( step( 0.82, Gg.h.y ) ).mul( Gg.w );
	const SV = voronoi( mod( p.div( 1.5e-3 ), 4096 ).add( 6.1 ), 0.9 );
	const speck = band( SV.toSeed.length().mul( 1.5e-3 ), hash1( SV.id1 ).mul( 2.5e-4 ).add( 8e-5 ), fp ).mul( step( 0.88, hash1( SV.id1.add( 4.4 ) ) ) ).mul( fadeIn( float( 3e-4 ), fp, 1.5, 4.0 ) );
	// Sand: rounded quartz, white to yellow, a shadow ring where it sinks in.
	// Glassy: dark rim where the clay grips it, clear body, a bright core.
	const sandCol = mix( vec3( 0.55, 0.52, 0.48 ), vec3( 0.6, 0.45, 0.28 ), Sg.h.z ).mul( smoothstep( 0.0, 0.2, Sg.m ).mul( 0.5 ).add( 0.5 ) ).add( smoothstep( 0.18, 0.3, Sg.m ).mul( 0.06 ) );
	bCol = mix( bCol, sandCol.mul( bCol.add( 0.6 ) ), sand.mul( 0.5 ) ); // fired into the face: tinted by the clay
	bCol = mix( bCol, u.color4.mul( Gg.h.z.mul( 0.4 ).add( 0.8 ) ), grog.mul( 0.55 ) ).mul( float( 1 ).sub( speck.mul( 0.5 ) ) );
	// Clay close up: silt glints and pores.
	const SI = voronoi( mod( p.div( 4e-5 ), 4096 ).add( 2.7 ), 0.9 );
	const silt = smoothstep( 0.05, 0.15, SI.edge ).mul( hash1( SI.id1 ).sub( 0.5 ) ).mul( fadeIn( float( 4e-5 ), fp, 2.0, 5.0 ) ).add( fbm( p, float( 2e-4 ), fp, 3, 4 ).sub( 0.5 ).mul( 0.5 ) );
	const PV = voronoi( mod( p.div( 1.5e-4 ), 4096 ).add( 8.3 ), 0.9 );
	const pore = band( PV.toSeed.length().mul( 1.5e-4 ), hash1( PV.id1 ).mul( 2e-5 ).add( 6e-6 ), fp ).mul( step( 0.7, hash1( PV.id1.add( 1.9 ) ) ) ).mul( fadeIn( float( 2e-5 ), fp, 1.5, 4.0 ) );
	bCol = bCol.mul( silt.mul( 0.15 ).add( 1 ) ).mul( float( 1 ).sub( pore.mul( 0.5 ) ) );
	bCol = mix( bCol, bCol.mul( 0.82 ), chip ); // the broken clay is a bit darker and dull

	// Mortar: sandy, grey, set back and tooled concave.
	const Ms = grains( p, float( 6e-4 ), fp, 0.2, 9 );
	const mCol = u.color3.mul( mott.sub( 0.5 ).mul( 0.2 ).add( 1 ) ).mul( mix( float( 1 ), Ms.h.z.mul( 0.5 ).add( 0.7 ), Ms.inside.mul( 0.6 ) ) );
	let color = mix( mCol, bCol, brick );

	// Height: arris rounded over 1.5 mm, chips bite in, mortar recessed.
	const bev = smoothstep( 0, max( float( 1.5e-3 ), fp.mul( 2 ) ), dIn );
	const tool = dIn.negate().div( J.mul( 0.5 ) ).clamp( 0, 1 ); // 0 at the brick edge, 1 mid joint
	const mortH = u.recessM.negate().sub( tool.mul( float( 2 ).sub( tool ) ).mul( 1e-3 ) );
	const brickH = bev.sub( 1 ).mul( 7e-4 ).sub( chip.mul( chipD ).mul( 0.6 ) );
	const h = mix( mortH, brickH, brick );
	const slope = surfaceGradient( h, p ).add( Sg.slope.mul( sand ).mul( 1.4 ) ).add( Gg.slope.mul( grog ).mul( 0.4 ) )
		.add( Ms.slope.mul( brick.oneMinus() ).mul( 0.5 ) ).add( vec2( silt, silt.negate() ).mul( 0.2 ) );
	const rough = u.roughness.add( chip.mul( 0.08 ) ).add( brick.oneMinus().mul( 0.05 ) ).sub( sand.mul( 0.45 ) ).min( 1 ); // quartz grains glint
	const cavity = brick.oneMinus().mul( 0.8 ).max( chip.mul( 0.5 ) ).max( pore.mul( 0.4 ) );
	return { color: clamp( color, 0, 1 ), slope, cavity, rough, s2: Sg.w.oneMinus().mul( 0.03 ) };

}
