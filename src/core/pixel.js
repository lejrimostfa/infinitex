// Pixel art from any family. The surface is cut into square art pixels.
// Each one is a power of two in surface meters, sized from the screen
// footprint: an art pixel covers px / 2 to px screen pixels. So a
// zoom in splits every art pixel into 4, and the drawing gains detail.
// The family is built on the centre of each art pixel, with the art pixel
// as its footprint (lod.js withFootprint): detail smaller than an art pixel
// is averaged away by the family's own LOD, so nothing flickers.
// On top: each art pixel gets its own small shift of tone and hue (the
// mottled look of a photo shrunk to a few texels), and the albedo goes
// through a palette of a few levels per channel, with a random dither per
// art pixel (an ordered Bayer pattern reads as a screen door). Light stays
// smooth by default; pixel_levels > 0 posterizes it into steps.
// Change of grid: near the end of a step, coarse art pixels split one by
// one, in random order, until all are split. No seam line, no second
// evaluation of the graph.
// With pixel_octaves 2 the grid splits every two octaves: an art pixel then
// spans px / 4 to px screen pixels, so near texels look bigger than far
// ones, as on a textured game scene.
// Preset keys, read at build time when `pixel` is set: see PIXEL_DEFAULTS.

import { vec2, vec3, vec4, floor, log2, exp2, mod, step, dot, uv, output, dFdx, dFdy, positionView } from 'three/tsl';
import { hash1, hash3 } from './hash.js';
import { footprint, withFootprint } from './lod.js';

export const PIXEL_DEFAULTS = {
	pixel_px: 14, // largest art pixel, in screen pixels (32: chunky squares)
	pixel_octaves: 1, // the grid splits every 1 or 2 octaves of zoom
	pixel_colors: 16, // albedo levels per channel
	pixel_dither: 0.5, // 0: hard bands, 1: full ordered dither
	pixel_jitter: 0.12, // tone and hue shift per art pixel
	pixel_levels: 0, // light steps, 0: smooth light
	pixel_blend: 0.4, // share of a step where art pixels split one by one
};

export function pixelGrid( p, px, blend, octaves = 1 ) {

	const fp = footprint( p ); // the real screen footprint, measured first
	const t = log2( fp.mul( px ) ).div( octaves );
	// Zooming in, t falls: in the last `blend` of a step, coarse art pixels
	// stay whole in random order (hash of the coarse pixel). The choice must
	// hold for the whole coarse pixel, else it cuts it along a line of
	// equal distance. So t is taken at the coarse pixel's centre: on a plane
	// the view depth is linear in p, its gradient comes from derivatives.
	const z = positionView.z.negate();
	const dpx = dFdx( p ), dpy = dFdy( p ), dzx = dFdx( z ), dzy = dFdy( z );
	const det = dpx.x.mul( dpy.y ).sub( dpx.y.mul( dpy.x ) );
	const sdet = det.abs().max( 1e-14 ).mul( step( 0, det ).mul( 2 ).sub( 1 ) );
	const gz = vec2( dzx.mul( dpy.y ).sub( dzy.mul( dpx.y ) ), dpx.x.mul( dzy ).sub( dpy.x.mul( dzx ) ) ).div( sdet );
	const k = floor( t );
	const coarse = exp2( k.add( 1 ).mul( octaves ) );
	const cid = floor( p.div( coarse ) );
	const zc = z.add( dot( gz, cid.add( 0.5 ).mul( coarse ).sub( p ) ) ).max( z.mul( 0.25 ) );
	const tc = t.add( log2( zc.div( z ) ).div( octaves ) );
	const h = hash1( mod( cid, 4096 ).add( k.mul( 1.7 ) ) );
	const up = step( h, tc.sub( k ).sub( 1 - blend ).div( Math.max( blend, 1e-3 ) ) );
	const cell = exp2( k.add( up ).mul( octaves ) );
	const id = floor( p.div( cell ) );
	return { pq: id.add( 0.5 ).mul( cell ), cell, id };

}

// Few levels per channel, in a perceptual (gamma) space. d: dither in 0..1.
function posterize( c, levels, d ) {

	return floor( c.max( 0 ).pow( 1 / 2.2 ).mul( levels ).add( d ) ).div( levels ).pow( 2.2 );

}

// Builds the family on art pixels. Returns its nodes plus an outputNode.
export function buildPixel( impl, uniforms, buildOpts, preset ) {

	const o = { ...PIXEL_DEFAULTS, ...preset };
	const g = pixelGrid( buildOpts.coords ?? uv(), o.pixel_px, o.pixel_blend, o.pixel_octaves );
	const nodes = withFootprint( g.cell, () => impl.build( uniforms, { ...buildOpts, coords: g.pq } ), { flat: true } );
	const d = hash1( mod( g.id, 4096 ).add( 31.7 ) ).sub( 0.5 ).mul( o.pixel_dither ).add( 0.5 );
	// Mottle: one random tone and hue shift per art pixel. The id is
	// wrapped so the hash stays exact; the cell size seeds each grid apart.
	const j = hash3( mod( g.id, 4096 ).add( vec2( log2( g.cell ).mul( 7.3 ) ) ) ).sub( 0.5 ).mul( o.pixel_jitter * 2 );
	const mottled = nodes.colorNode.mul( j.x.add( 1 ) ).mul( vec3( 1 ).add( j.yzy.mul( vec3( 0.25, 0.15, - 0.25 ) ) ) );
	nodes.colorNode = posterize( mottled, o.pixel_colors, d );
	if ( nodes.emissiveNode ) nodes.emissiveNode = posterize( nodes.emissiveNode, o.pixel_colors, d );
	if ( ! o.pixel_levels ) return nodes;
	// Light in steps: posterize the lit luminance, keep its hue.
	const c = output.rgb, L = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ).max( 1e-5 );
	const Lq = floor( L.pow( 1 / 2.2 ).mul( o.pixel_levels ).add( d ) ).div( o.pixel_levels ).max( 0.5 / o.pixel_levels ).pow( 2.2 );
	nodes.outputNode = vec4( c.mul( Lq.div( L ) ), output.a );
	return nodes;

}
