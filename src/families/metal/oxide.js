// Oxide crust, the fine levels of rust (rust and painted modes).
//   knobs   a bumpy crust, tubercles about 0.6 mm across
//   lumps   the scale grows in rounded lumps of 80 to 200 um, each a dome
//           of its own shade (orange, brown, ochre, near black), split by
//           dark gaps 2 to 4 um wide along a quarter of the borders
//   grains  each lump is packed oxide grains of about rust_grain_um (10 to
//           30 um), small domes with dark pores between them
//   fine    sub-grain roughness, a few um
// Returns tone (multiplies the oxide colour, mean about 1), a hue shift
// toward dark brown (0..1), a slope, the pore signal and the weight of the
// grains (for the roughness hand-off).

import { float, clamp, smoothstep, step, mod, mix, vec2 } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

const vn = valueNoise;

export function oxideCrust( p, fp, u ) {

	// Knobs: two octaves of soft bumps.
	const kq = p.div( 6e-4 ).add( 12.4 );
	const kn = vn( kq ).toVar();
	const wK = fadeIn( 6e-4, fp, 2.0, 6.0 ).toVar();
	const sKnob = vec2( kn, vn( kq.add( 3.3 ) ) ).sub( 0.5 ).add( vec2( vn( kq.mul( 2.6 ).add( 1.7 ) ), vn( kq.mul( 2.6 ).add( 6.2 ) ) ).sub( 0.5 ).mul( 0.5 ) )
		.mul( 0.7 ).mul( wK );

	// Lumps, on warped cells so they are not a honeycomb.
	const LM = 1.4e-4;
	const lq = p.div( LM );
	const lv = voronoi( lq.add( vec2( valueNoise( lq.mul( 0.35 ) ), valueNoise( lq.mul( 0.35 ).add( 5.5 ) ) ).mul( 0.8 ) ).add( 3.9 ), 0.95 );
	const wL = fadeIn( LM, fp, 2.0, 6.0 ).toVar();
	const lh = hash3( lv.id1 );
	const gapW = lh.z.mul( 2.5e-6 ).add( 1.5e-6 ), gapE = gapW.max( fp );
	// Only some borders open, each a pair of lumps: hash of both ids.
	const jag = vn( lq.mul( 6 ).add( 1.3 ) ).sub( 0.5 ).mul( 0.08 );
	const gap = clamp( gapE.sub( lv.edge.add( jag ).abs().mul( LM ) ).div( fp ).add( 0.5 ), 0, 1 ).mul( gapW.div( gapE ) )
		.mul( step( hash1( lv.id1.add( lv.id2 ).add( lv.id1.mul( lv.id2 ).mul( 0.01 ) ) ), 0.25 ) ).mul( fadeIn( LM, fp, 4.0, 12.0 ) );
	const dome = lv.toSeed.mul( - 0.45 ).mul( lh.y.mul( 0.6 ).add( 0.4 ) );

	// Grains.
	const gq = mod( p.div( u.rustGrainM ), 4096 );
	const gv = voronoi( gq.add( vec2( vn( gq.mul( 0.4 ) ), vn( gq.mul( 0.4 ).add( 7.3 ) ) ).mul( 0.9 ) ).add( 2.3 ), 0.95 );
	const w = fadeIn( u.rustGrainM, fp, 2.0, 6.0 ).toVar();
	const h = hash3( gv.id1 );
	const pore = float( 1 ).sub( smoothstep( 0.0, 0.15, gv.edge ) ).mul( w ).mul( smoothstep( 0.3, 0.7, h.y ) ).mul( 0.5 ).max( gap );
	const fine = valueNoise( mod( p.div( u.rustGrainM.mul( 0.3 ) ), 4096 ).add( 6.1 ) ).sub( 0.5 ).mul( fadeIn( u.rustGrainM.mul( 0.3 ), fp, 2.0, 6.0 ) );

	// Lump shade: half its own, half a smooth field, so no cell reads as a tile.
	const lumpT = mix( lh.x, vn( lq.mul( 0.5 ).add( 4.2 ) ), 0.6 );
	const tone = kn.sub( 0.5 ).mul( 0.45 ).mul( wK ).add( 1 ).mul( lumpT.sub( 0.5 ).mul( 0.5 ).mul( wL ).add( 1 ) )
		.mul( h.z.sub( 0.5 ).mul( 0.3 ).mul( w ).add( 1 ) ).add( fine.mul( 0.3 ) )
		.mul( float( 1 ).sub( pore.mul( 0.7 ) ) );
	// Some lumps and grains are dark brown, nearly black (magnetite).
	const dark = smoothstep( 0.6, 0.85, vn( p.div( 5e-4 ).add( 8.8 ) ) ).mul( 0.8 ).mul( wK ).max( smoothstep( 0.9, 0.99, h.x ).mul( 0.6 ).mul( w ) );
	const slope = sKnob.add( dome.mul( wL ) ).add( gv.toSeed.mul( - 0.5 ).add( h.xy.sub( 0.5 ).mul( 0.4 ) ).mul( w ) );
	return { tone, dark, slope, pore, w, wL, wK };

}
