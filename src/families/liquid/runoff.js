// Water running down a stone wall after rain. Down is -v (the face's
// own vertical). The wall is the stone family (the `wall` sub-preset:
// slate by default), darkened where it is wet.
//   L0 rivulets  one per column of size_mm (25 mm), some starting half
//                way down; each meanders (its path drifts over tens of
//                seconds) and swells and narrows along its way. Width
//                feature_mm (3 mm), height a quarter of the width (a
//                contact angle of about 50 degrees)
//   L0 sheets    patches where a film 0.2 mm thick covers the stone
//   L1 pulses    the flow comes in surges (roll waves, 1.5 to 2 cm apart)
//                that run down at 12 to 20 cm/s; wavelets on the sheets
//   L1 beads     drops of 0.8 to 2.5 mm slide down at 0.4 to 2.4 cm/s,
//                each on its own lane, a wet trail above it; others sit
//                pinned to the rough stone
//   L2 mist      droplets of 0.05 to 0.3 mm on the wet stone
//   L2 bubbles   air bubbles of 0.1 to 0.4 mm carried by the rivulets;
//                at the edge, the bright line of the meniscus
//   L2 stone     the wall's own detail through the film

import { vec2, vec3, float, floor, fract, mix, clamp, smoothstep, step, sin, mod } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash3, valueNoise } from '../../core/hash.js';
import { ixTime } from '../../core/clock.js';
import { capSlope, bubbleField } from '../ceramic/bubbles.js';
import { buildSlate, buildSandstone } from '../stone/sediment.js';
import { buildGranite } from '../stone/granite.js';
import { buildConcrete } from '../stone/concrete.js';
import { buildBrick } from '../stone/brick.js';

const WALLS = { slate: buildSlate, sandstone: buildSandstone, granite: buildGranite, concrete: buildConcrete, brick: buildBrick };

function rivulets( p, fp, u, t ) {

	const C = u.sizeM, col = floor( p.x.div( C ) );
	let cover = float( 0 ), slope = vec2( 0 ), s2 = float( 0 ), halo = float( 0 ), core = float( 0 );
	for ( let j = - 1; j <= 1; j ++ ) {

		const id = col.add( j );
		const h = hash3( vec2( mod( id, 4096 ), u.seed.add( 3.3 ) ) );
		const on = step( h.z, u.amount );
		// The path wanders: slow along the wall, slower still in time.
		const wan = valueNoise( vec2( p.y.div( 0.07 ), id.mul( 7.1 ).add( t.mul( 0.03 ) ) ) ).sub( 0.5 );
		const wig = valueNoise( vec2( p.y.div( 0.011 ), id.mul( 3.3 ).add( t.mul( 0.05 ) ) ) ).sub( 0.5 );
		const xc = id.add( 0.5 ).add( h.x.sub( 0.5 ).mul( 0.3 ) ).add( wan.mul( 0.9 ) ).mul( C ).add( wig.mul( 0.0025 ) );
		const wid = u.featureM.mul( h.y.mul( 0.9 ).add( 0.55 ) ).mul( valueNoise( vec2( p.y.div( 0.025 ), id.mul( 5.1 ) ) ).mul( 0.6 ).add( 0.7 ) ).mul( 0.5 );
		const y0 = h.y.mul( 0.5 ).add( 0.12 ).mul( 0.3 ).add( step( 0.5, h.x ).mul( 0.3 ) ); // half start on the face
		const alive = smoothstep( y0, y0.sub( 0.02 ), p.y ).mul( on );
		// Surges run down.
		const v = h.x.mul( 0.08 ).add( 0.12 );
		const yy = p.y.add( v.mul( t ) ).div( 0.017 ).add( h.y.mul( 6.0 ) );
		const surge = sin( yy.mul( 6.283 ).add( valueNoise( vec2( yy.mul( 0.3 ), id ) ).mul( 4 ) ) ).mul( 0.22 ).add( 1 );
		const w = wid.mul( surge.mul( 0.4 ).add( 0.6 ) ).mul( alive ).max( 1e-6 );
		const d = p.x.sub( xc );
		const q = d.div( w );
		const H = w.mul( 0.5 ).mul( surge ); // apex height over half width: 0.5
		const cov = clamp( w.sub( d.abs() ).div( fp ).add( 0.5 ), 0, 1 ).mul( alive );
		const res = fadeIn( w.mul( 2 ), fp, 1.5, 4.0 );
		const sx = H.mul( q ).mul( - 2 ).div( w ).mul( cov ).mul( res );
		// Along the flow: the surge swells the thickness H (1 - q^2).
		const sy = w.mul( 0.5 * 0.22 * 6.283 / 0.017 ).mul( float( 1 ).sub( q.mul( q ) ).max( 0 ) ).mul( yy.mul( 6.283 ).cos() ).mul( cov ).mul( res );
		slope = slope.add( vec2( sx, sy ) );
		s2 = s2.add( cov.mul( res.oneMinus() ).mul( 0.33 ) );
		cover = cover.max( cov );
		core = core.max( cov.mul( float( 1 ).sub( q.abs() ) ) );
		halo = halo.max( smoothstep( w.add( 0.004 ), w, d.abs() ).mul( alive ) );

	}

	return { cover, slope, s2, halo, core };

}

// Beads sliding down their lanes (6 mm wide), with a wet trail above.
function beads( p, fp, u, t ) {

	const Cb = 0.006;
	const lane = floor( p.x.div( Cb ) );
	const hl = hash3( vec2( mod( lane, 4096 ), u.seed.add( 9.9 ) ) );
	const v = hl.x.mul( 0.02 ).add( 0.004 );
	const qy = p.y.add( v.mul( t ) ).div( Cb );
	const row = floor( qy );
	const h = hash3( vec2( mod( lane, 4096 ), mod( row, 4096 ) ).add( 0.37 ) );
	const on = step( h.z, u.density.mul( 0.45 ) );
	const rb = h.x.mul( 0.11 ).add( 0.07 ); // radius, cells
	const c = vec2( hl.y.sub( 0.5 ).mul( 0.4 ).add( 0.5 ), h.y.mul( 0.5 ).add( 0.25 ) );
	const f = vec2( fract( p.x.div( Cb ) ), fract( qy ) );
	const vv = f.sub( c ).mul( vec2( 1, 0.85 ) ).div( rb );
	const dd = vv.length();
	const rm = rb.mul( Cb );
	const inside = clamp( float( 1 ).sub( dd ).mul( rm ).div( fp ).add( 0.5 ), 0, 1 ).mul( on ).mul( fadeIn( rm.mul( 2 ), fp, 1, 3 ) );
	const trail = smoothstep( rb.mul( 0.55 ), rb.mul( 0.3 ), f.x.sub( c.x ).abs() ).mul( step( c.y, f.y ) ).mul( smoothstep( 1, 0.3, f.y.sub( c.y ).div( 1 - 0.25 ) ) ).mul( on );
	// Light through the drop gathers on its lower side: a bright crescent.
	const glint = smoothstep( 0.7, 0.1, vv.sub( vec2( 0, - 0.4 ) ).length() ).mul( inside );
	return { inside, slope: capSlope( vv, dd ).mul( inside ).mul( - 0.3 ), trail, glint }; // a dome

}

export function buildRunoff( p, fp, u ) {

	const t = ixTime.mul( u.speed );
	const Wl = ( WALLS[ u.wall.mode ] ?? buildSlate )( p, fp, u.wall );
	const R = rivulets( p, fp, u, t );
	const Bd = beads( p, fp, u, t );
	const pin = bubbleField( p, fp, float( 0.0035 ), u.density.mul( 0.3 ), 41 );
	// Mist: droplets of 0.05 to 0.3 mm on every wet stone.
	const mist = bubbleField( p, fp, float( 8e-4 ), u.density.mul( 0.5 ), 61 );
	const pinned = pin.inside.mul( pin.fade ).max( mist.inside.mul( mist.fade ) );

	// Sheets: a thin film over patches of the wall, wavelets running down.
	const sq = vec2( p.x.div( 0.07 ), p.y.div( 0.2 ) ).add( u.seed );
	const sheet = smoothstep( 0.62, 0.72, valueNoise( sq ).mul( 0.7 ).add( valueNoise( sq.mul( 2.7 ) ).mul( 0.3 ) ) ).mul( u.amount );
	const ry = p.y.add( t.mul( 0.08 ) ).div( 0.006 ).add( valueNoise( vec2( p.x.div( 0.008 ), p.y.div( 0.02 ) ) ).mul( 3 ) );
	const wl = fadeIn( 0.006, fp, 2, 5 );
	const patchy = valueNoise( vec2( p.x.div( 0.012 ), p.y.add( t.mul( 0.08 ) ).div( 0.03 ) ) );
	const sheetSlope = vec2( 0, ry.mul( 6.283 ).cos().mul( 0.035 ).mul( wl ).mul( patchy ) ).mul( sheet );

	const water = R.cover.max( sheet ).max( Bd.inside ).max( pinned ).toVar();
	const wetness = water.max( R.halo.mul( 0.8 ) ).max( Bd.trail.mul( 0.7 ) ).max( sheet.mul( 1.2 ).min( 1 ) );
	let color = mix( Wl.color, Wl.color.mul( 0.5 ), wetness );
	color = mix( color, color.mul( 0.85 ).add( vec3( 0.0, 0.004, 0.008 ) ), water );
	color = color.add( Bd.glint.mul( 0.15 ) );
	// Bubbles carried in the rivulets.
	const cb = bubbleField( vec2( p.x, p.y.add( t.mul( 0.14 ) ) ), fp, float( 0.0012 ), float( 0.3 ), 51 );
	const inCore = smoothstep( 0.2, 0.5, R.core );
	const bub = cb.inside.mul( cb.fade ).mul( inCore );
	color = mix( color, color.mul( 1.5 ).add( 0.04 ), cb.rim.mul( cb.fade ).mul( inCore ) );
	const slope = Wl.slope.mul( float( 1 ).sub( water.mul( 0.85 ) ) ).add( R.slope ).add( sheetSlope )
		.add( Bd.slope.mul( float( 1 ).sub( R.cover ) ) ).sub( capSlope( pin.v, pin.d ).mul( pin.inside ).mul( pin.fade ).mul( 0.3 ) ).sub( capSlope( mist.v, mist.d ).mul( mist.inside ).mul( mist.fade ).mul( 0.3 ) ).sub( capSlope( cb.v, cb.d ).mul( bub ).mul( 0.5 ) );
	const rough = mix( Wl.rough, Wl.rough.mul( 0.6 ), wetness ).mul( float( 1 ).sub( water ) ).add( u.roughness.mul( water ) );
	const s2 = Wl.s2.mul( water.oneMinus() ).add( R.s2 );
	return { color, slope, cavity: Wl.cavity.mul( water.oneMinus() ), rough, s2, wet: water.add( wetness.mul( 0.3 ) ).min( 1 ) };

}
