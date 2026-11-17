// Matter never goes smooth up close. Each family stops at its finest
// level (wood fibres 30 um, cork cells, sand grains); under it the surface
// was one flat colour and one normal. This layer carries on from there,
// one octave each time the zoom doubles, down to about 1 um: below that,
// visible light (0.4 to 0.7 um) cannot resolve anything, physically.
// Every octave fades in with the footprint like any level (2 to 6 pixels
// per period), so nothing shimmers. Far away the family's roughness
// already stands for this micro relief: nothing is added to it. A glossy
// matter has a shallower micro relief: the slopes scale with roughness.
// The kind of matter decides what the micro detail is:
//   fibrous    streaks along the fibres, ever finer (wood, cloth, rope,
//              wool, hair): anisotropic noise, 6 to 1
//   granular   angular grains with tilted facets, finer grains on them
//              (stone, soil, ceramic)
//   scratched  polishing scratches ever finer, and pits (metal, plastic)
//   cellular   cells within cells, domed, with walls (leather, skin,
//              plants, organic, scales)
//   generic    rough noise
// Liquids, molten and lit screens stay smooth: a liquid surface is.
// Cost: a few noises per octave, all octaves compiled (5 or 6). The
// granular, scratched and cellular octaves sit in a gate() (core/lod.js):
// they run only where they show. Measured (M1 Max, 1080p): skin 10 to 20 %
// faster, metal about 10 %. The fibrous and generic octaves (one value
// noise each) stay ungated: their gates made knit and woven 10 to 60 %
// slower.

import { vec2, float, mod, smoothstep, cos, sin, tangentView, bitangentView } from 'three/tsl';
import { fadeIn, fadeOn, gate, perturbNormal, surfaceGradient } from './lod.js';
import { hash3, valueNoise, wrapCoord } from './hash.js';
import { voronoi } from './voronoi.js';
import { scratches } from '../families/stone/common.js';

// family -> [ kind, finest level of the family (m) ]
export const MICRO_KINDS = {
	knit: [ 'fibrous', 10e-6 ], rope: [ 'fibrous', 8e-6 ], woven: [ 'fibrous', 8e-6 ], fibermat: [ 'fibrous', 8e-6 ],
	strands: [ 'fibrous', 8e-6 ], pile: [ 'fibrous', 10e-6 ], interlace: [ 'fibrous', 10e-6 ], wood: [ 'fibrous', 15e-6 ],
	stone: [ 'granular', 20e-6 ], ground: [ 'granular', 30e-6 ], ceramic: [ 'granular', 10e-6 ],
	metal: [ 'scratched', 10e-6 ], plastic: [ 'scratched', 15e-6 ],
	leather: [ 'cellular', 20e-6 ], skin: [ 'cellular', 20e-6 ], organic: [ 'cellular', 20e-6 ], plant: [ 'cellular', 10e-6 ],
	scales: [ 'cellular', 20e-6 ], decor: [ 'generic', 20e-6 ], transform: [ 'generic', 20e-6 ],
};

const FLOOR = 1e-6; // light cannot resolve finer

// One octave of period P: its additions to the height, slope and tone.
function octave( kind, p, rot, fp, P, S, salt ) {

	const w = fadeIn( P, fp, 2.0, 6.0 );
	if ( kind === 'fibrous' ) {

		const q = wrapCoord( vec2( rot.x.div( P * 6 ), rot.y.div( P ) ) ).add( salt );
		const v = valueNoise( q );
		return { h: v.sub( 0.5 ).mul( P * S ).mul( w ), slope: vec2( 0 ), tone: v.sub( 0.5 ).mul( 0.07 ).mul( w ) };

	} else if ( kind === 'granular' ) {

		const V = voronoi( wrapCoord( p.div( P ) ).add( salt ), 0.85 );
		const g = hash3( V.id1.add( salt ) );
		// Each grain a tilted facet; a groove where grains meet.
		return {
			slope: g.xy.sub( 0.5 ).mul( S * 2 ).mul( w ).mul( smoothstep( 0.0, 0.08, V.edge ) ),
			h: float( 0 ).sub( smoothstep( 0.08, 0.0, V.edge ).mul( P * S * 0.5 ).mul( w ) ),
			tone: g.z.sub( 0.5 ).mul( 0.1 ).mul( w ).sub( smoothstep( 0.06, 0.0, V.edge ).mul( 0.06 ).mul( w ) ),
		};

	} else if ( kind === 'scratched' ) {

		const sc = scratches( p, fp, P * 5, P * 0.12, 0.45, salt );
		const v = valueNoise( wrapCoord( p.div( P ) ).add( salt ) );
		return {
			h: float( 0 ).sub( sc.mul( P * S * 0.6 ) ).add( v.sub( 0.5 ).mul( P * S * 0.3 ).mul( w ) ),
			slope: vec2( 0 ), tone: sc.mul( 0.05 ).add( v.sub( 0.5 ).mul( 0.03 ).mul( w ) ),
		};

	} else if ( kind === 'cellular' ) {

		const V = voronoi( wrapCoord( p.div( P ) ).add( salt ), 0.8 );
		const c = hash3( V.id1.add( salt ) );
		// Domed cells (the slope falls away from the centre), darker walls.
		return {
			h: float( 0 ), slope: float( 0 ).sub( V.toSeed.mul( S * 1.5 ).mul( w ).mul( smoothstep( 0.0, 0.12, V.edge ) ) ),
			tone: c.x.sub( 0.5 ).mul( 0.08 ).mul( w ).sub( smoothstep( 0.08, 0.0, V.edge ).mul( 0.08 ).mul( w ) ),
		};

	}

	const v = valueNoise( wrapCoord( p.div( P ) ).add( salt ) );
	return { h: v.sub( 0.5 ).mul( P * S ).mul( w ), slope: vec2( 0 ), tone: v.sub( 0.5 ).mul( 0.06 ).mul( w ) };

}

export function applyMicro( nodes, family, p, fp, { angle = 0, amount = 1, seed = 0 } = {} ) {

	const entry = MICRO_KINDS[ family ];
	if ( ! entry || amount <= 0 ) return nodes;
	const [ kind, finest ] = entry;
	const n = Math.max( 1, Math.min( 6, Math.ceil( Math.log2( finest / FLOOR ) ) ) );
	const gated = kind === 'granular' || kind === 'scratched' || kind === 'cellular';
	if ( gated ) {

		p = p.isVarNode ? p : p.toVar();
		fp = fp.isVarNode ? fp : fp.toVar();

	}

	const a = float( angle ), ca = cos( a ), sa = sin( a );
	const rot = vec2( p.x.mul( ca ).add( p.y.mul( sa ) ), p.y.mul( ca ).sub( p.x.mul( sa ) ) ); // x along the fibres
	let h = float( 0 ), slope = vec2( 0 ), tone = float( 0 );
	const rf = nodes.roughnessNode ? nodes.roughnessNode.clamp( 0.08, 1 ) : float( 0.5 ); // polished: shallow

	for ( let k = 0; k < n; k ++ ) {

		const P = finest / Math.pow( 2, k + 0.5 ); // period of this octave (m)
		const salt = seed * 1.7 + k * 13.1;
		const S = 0.18 * amount; // slope of an octave, about the same at every scale (self-similar)
		// Gate: the octave runs only while its fade (and, for scratches,
		// the narrower fade of the scratch) is above zero.
		const O = gated ? gate( fadeOn( P, fp, 2.0 ), { h: 0, slope: [ 0, 0 ], tone: 0 }, () => octave( kind, p, rot, fp, P, S, salt ), [ p, fp ] )
			: octave( kind, p, rot, fp, P, S, salt );
		h = h.add( O.h );
		slope = slope.add( O.slope );
		tone = tone.add( O.tone );

	}

	slope = slope.add( surfaceGradient( h, p ) ).mul( rf );
	nodes.normalNode = perturbNormal( nodes.normalNode, slope, tangentView, bitangentView ).normalize();
	nodes.colorNode = nodes.colorNode.mul( tone.mul( rf.mul( 0.6 ).add( 0.4 ) ).add( 1 ) );
	return nodes;

}
