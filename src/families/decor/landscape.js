// The picture an oil painter puts on the canvas: a summer landscape, one
// per face of the cube. q runs 0..1 across the face, y up. Plain shapes,
// soft edges: the brush strokes (oil.js) sample it once per stroke, so the
// detail of the picture is the stroke size, as in a real painting.
//   sky      blue at the top, pale and warm near the horizon, clouds
//   hills    two ranges, the far one blue grey (aerial perspective)
//   fields   ochre and green bands with furrows, a path in perspective
//   tree     a dark crown on a trunk at the right, lit on its left side
// brushFlow gives the direction a painter's brush follows.

import { vec2, vec3, float, clamp, smoothstep, mix, abs } from 'three/tsl';
import { valueNoise } from '../../core/hash.js';

const soft = ( sd, w ) => clamp( sd.div( w ).add( 0.5 ), 0, 1 );

export function landscape( q ) {

	const x = q.x, y = q.y;
	// Sky and clouds.
	let c = mix( vec3( 0.62, 0.66, 0.62 ), vec3( 0.16, 0.3, 0.56 ), smoothstep( 0.5, 0.98, y ) );
	const cl = valueNoise( vec2( x.mul( 4 ), y.mul( 9 ) ).add( 3.1 ) ).mul( 0.65 ).add( valueNoise( vec2( x.mul( 11 ), y.mul( 22 ) ) ).mul( 0.35 ) );
	const cloud = smoothstep( 0.55, 0.75, cl ).mul( smoothstep( 0.62, 0.75, y ) );
	c = mix( c, mix( vec3( 0.9, 0.86, 0.78 ), vec3( 0.55, 0.56, 0.62 ), smoothstep( 0.6, 0.85, cl ).mul( 0.6 ) ), cloud );
	// Far hills: blue grey.
	const far = float( 0.55 ).add( valueNoise( vec2( x.mul( 3.5 ), 1.3 ) ).mul( 0.1 ) );
	c = mix( c, vec3( 0.36, 0.42, 0.5 ), soft( far.sub( y ), 0.006 ) );
	// Near hills: dull green, lighter on top.
	const near = float( 0.46 ).add( valueNoise( vec2( x.mul( 2.2 ), 7.7 ) ).mul( 0.12 ) );
	const hillCol = mix( vec3( 0.2, 0.3, 0.14 ), vec3( 0.36, 0.44, 0.2 ), smoothstep( near.sub( 0.08 ), near, y ) );
	c = mix( c, hillCol, soft( near.sub( y ), 0.006 ) );
	// Fields: bands that widen toward the viewer, furrows across.
	const fy = float( 0.38 ).sub( y ).max( 0 );
	const bandId = valueNoise( vec2( float( 0.4 ).div( fy.add( 0.04 ) ), 2.2 ) );
	const fieldCol = mix( vec3( 0.66, 0.5, 0.16 ), vec3( 0.3, 0.42, 0.14 ), smoothstep( 0.4, 0.6, bandId ) )
		.mul( valueNoise( vec2( x.mul( 30 ), y.mul( 60 ) ) ).mul( 0.2 ).add( 0.9 ) );
	const fieldOn = soft( float( 0.38 ).sub( y ), 0.005 );
	c = mix( c, fieldCol, fieldOn );
	// Path: a pale band narrowing into the distance.
	const pathX = float( 0.42 ).add( fy.mul( 0.6 ) ).add( valueNoise( vec2( y.mul( 6 ), 5.5 ) ).sub( 0.5 ).mul( 0.05 ) );
	const path = soft( fy.mul( 0.35 ).add( 0.004 ).sub( abs( x.sub( pathX ) ) ), 0.005 ).mul( fieldOn );
	c = mix( c, vec3( 0.78, 0.68, 0.5 ), path );
	// Tree: trunk and a lumpy crown, lit from the left.
	const trunk = soft( float( 0.012 ).sub( abs( x.sub( 0.76 ) ) ), 0.004 ).mul( soft( float( 0.5 ).sub( y ), 0.004 ) ).mul( soft( y.sub( 0.2 ), 0.004 ) );
	c = mix( c, vec3( 0.18, 0.12, 0.08 ), trunk );
	const tc = vec2( x.sub( 0.76 ), y.sub( 0.6 ).mul( 0.85 ) );
	const lump = valueNoise( tc.mul( 18 ).add( 4.4 ) ).sub( 0.5 ).mul( 0.06 );
	const crown = soft( float( 0.14 ).add( lump ).sub( tc.length() ), 0.006 );
	const lit = smoothstep( 0.08, - 0.08, tc.x.sub( tc.y.mul( 0.5 ) ) );
	c = mix( c, mix( vec3( 0.07, 0.15, 0.07 ), vec3( 0.28, 0.4, 0.14 ), lit.mul( 0.8 ) ), crown );
	return c;

}

// Brush direction (an angle) at q: cheap, the strokes ask it 9 times.
// Along the land, curling around the crown, up the trunk.
export function brushFlow( q ) {

	const tc = vec2( q.x.sub( 0.76 ), q.y.sub( 0.6 ).mul( 0.85 ) );
	const crown = smoothstep( 0.17, 0.12, tc.length() );
	const trunk = smoothstep( 0.03, 0.01, abs( q.x.sub( 0.76 ) ) ).mul( smoothstep( 0.47, 0.45, q.y ) );
	const tilt = valueNoise( q.mul( 7 ).add( 1.1 ) ).sub( 0.5 ).mul( 0.5 );
	return tilt.add( tc.x.div( tc.length().max( 0.01 ) ).mul( - 1.2 ).mul( crown ) ).add( trunk.mul( 1.5 ) );

}
