// Open-cell polyurethane foam (a kitchen sponge, a seat cushion).
//   L0 colour  oxidised yellow, mottled; big voids (1 to 3 mm) where gas
//              pockets were cut open, a darker hole each
//   L1 cells   the cut face shows the cell skeleton: struts along the cell
//              edges (cells of cellM, 0.3 to 1 mm), thicker where three
//              meet (Plateau borders). Through each cell the struts of the
//              cells behind show, two layers deeper, darker and shifted by
//              parallax; past them, shadow.
//   L1 windows a few cells keep a thin membrane: a faint shiny film
//   L2 struts  each strut has a triangular section with concave faces: a
//              bright crest line; a fine ripple and specks along it
// Returns { color, slope, cavity, rough, s2 } for shader.js.

import { vec2, vec3, float, mix, smoothstep, step, clamp, positionView, tangentView, bitangentView, normalView } from 'three/tsl';
import { fadeIn } from '../../core/lod.js';
import { hash1, hash3, valueNoise } from '../../core/hash.js';
import { voronoi } from '../../core/voronoi.js';

// One layer of struts at depth (m), seen along the eye ray.
function strutLayer( p, fp, view, cellM, depth, off ) {

	const q = p.sub( view.xy.div( view.z.max( 0.25 ) ).mul( depth ) ).div( cellM ).add( off ).mod( 4096 ); // mod: hashes stay exact
	const v = voronoi( q, 0.8 );
	// Thicker near the vertices, where three struts meet.
	const toS = v.toSeed.length();
	const w = float( 0.055 ).mul( smoothstep( 0.4, 0.75, toS ).mul( 1.6 ).add( 1 ) ).mul( hash1( v.id1.add( v.id2 ) ).mul( 0.5 ).add( 0.75 ) );
	const e = v.edge;
	const cov = clamp( w.sub( e ).mul( cellM ).div( fp ).add( 0.5 ), 0, 1 );
	const x = e.div( w ).clamp( 0, 1 );
	const crest = float( 1 ).sub( x.pow( 0.6 ) ); // concave faces: a sharp crest
	return { v, cov, x, crest, w };

}

export function buildFoam( p, fp, u ) {

	const s = u.seed, c = u.cellM;
	const V = positionView.negate().normalize();
	const view = vec3( V.dot( tangentView ), V.dot( bitangentView ), V.dot( normalView ) );
	const wC = fadeIn( c, fp, 2.0, 6.0 ).toVar();

	const A = strutLayer( p, fp, view, c, float( 0 ), s.mul( 3.1 ) );
	const B = strutLayer( p, fp, view, c.mul( 0.95 ), c.mul( 0.6 ), s.add( 17.3 ) );
	const C = strutLayer( p, fp, view, c.mul( 0.9 ), c.mul( 1.3 ), s.add( 41.9 ) );

	// Colour, front to back.
	const tone = valueNoise( p.div( 0.03 ).add( s ) ).sub( 0.5 ).mul( u.colorVar ).add( valueNoise( p.div( 0.004 ).add( 5.5 ) ).sub( 0.5 ).mul( u.colorVar ).mul( 0.5 ) ).add( 1 );
	const col = u.color.mul( tone );
	// Struts are lit on their crest; the faces turn away.
	const lit = ( L, k ) => col.mul( k ).mul( L.crest.mul( 0.35 ).add( 0.75 ) );
	const deep = col.mul( 0.1 );
	const backC = mix( deep, lit( C, 0.35 ), C.cov );
	const backB = mix( backC, lit( B, 0.6 ), B.cov );
	// Windows: a thin film over a few front cells.
	const win = step( 0.85, hash1( A.v.id1.add( 9.1 ) ) ).mul( smoothstep( 0.05, 0.12, A.v.edge ) );
	const behind = mix( backB, mix( backB, col.mul( 0.9 ), 0.4 ), win );
	let color = mix( behind, lit( A, 1 ), A.cov );

	// Fine ripple and specks along the front struts.
	const rip = valueNoise( p.div( c.mul( 0.02 ) ).mod( 4096 ) ).sub( 0.5 );
	const wR = fadeIn( c.mul( 0.02 ), fp, 2.0, 6.0 );
	color = color.mul( rip.mul( 0.15 ).mul( wR ).mul( A.cov ).add( 1 ) );

	// Big voids: a cut gas pocket now and then.
	const big = voronoi( p.div( c.mul( 4 ) ).add( s.mul( 2 ) ), 0.9 );
	const hole = step( 0.96, hash3( big.id1 ).x ).mul( smoothstep( 0.2, 0.35, big.edge ) );
	color = mix( color, color.mul( 0.6 ), hole.mul( 0.5 ) );

	// Far: the mean of struts over depth.
	const mean = col.mul( 0.62 ).mul( float( 1 ).sub( hole.mul( 0.4 ) ) );
	color = mix( mean, color, wC );

	// Front strut relief: round across, towards the strut axis.
	const sStrut = A.v.dir.mul( A.x.div( float( 1 ).sub( A.x.mul( A.x ) ).max( 0.05 ).sqrt() ) ).mul( 0.6 ).mul( A.cov ).mul( wC );
	const sWin = A.v.toSeed.mul( 0.15 ).mul( win ).mul( A.cov.oneMinus() ).mul( wC );
	const slope = sStrut.add( sWin ).add( vec2( rip, rip.mul( - 0.7 ) ).mul( 0.3 ).mul( wR ).mul( A.cov ) );
	const cavity = mix( float( 0.7 ), A.cov.oneMinus().mul( win.oneMinus() ), wC );
	const rough = mix( u.roughness, float( 0.35 ), win.mul( A.cov.oneMinus() ).mul( wC ) );
	return { color, slope, cavity, rough, s2: wC.oneMinus().mul( 0.15 ) };

}
