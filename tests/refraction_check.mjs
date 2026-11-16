// Refraction math (src/core/refraction.js, apparentPoint): the same solver
// as the shader, checked against Snell's law and textbook values.
//   node tests/refraction_check.mjs
// Exit code 1 on any failure.

import { Vector3 } from 'three';
import { apparentPoint, N_WATER } from '../src/core/refraction.js';

let fails = 0;
const check = ( name, got, want, tol ) => {

	const ok = Math.abs( got - want ) <= tol;
	if ( ! ok ) fails ++;
	console.log( `${ ok ? 'ok  ' : 'FAIL' } ${ name.padEnd( 58 ) } ${ got.toFixed( 6 ) } (want ${ want.toFixed( 6 ) })` );

};

const up = new Vector3( 0, 1, 0 );
// Snell at the crossing: n_eye sin(i) = n_far sin(t).
function snellResidual( E, P, normal, offset, eta ) {

	const A = apparentPoint( E, P, normal, offset, eta );
	const d = A.clone().sub( E ).normalize();
	const t = ( offset - normal.dot( E ) ) / normal.dot( d );
	const S = E.clone().addScaledVector( d, t );
	const e = P.clone().sub( S ).normalize();
	const sinI = d.clone().addScaledVector( normal, - d.dot( normal ) ).length();
	const sinT = e.clone().addScaledVector( normal, - e.dot( normal ) ).length();
	return { residual: sinI - sinT / eta, S, A };

}

// 1. Snell holds, from the air into the water and the reverse, at all angles.
for ( const [ E, P, label ] of [
	[ new Vector3( 0, 1, 0 ), new Vector3( 0.3, - 0.5, 0.1 ), 'air to water, steep' ],
	[ new Vector3( 0, 0.05, 0 ), new Vector3( 2, - 0.3, 0 ), 'air to water, grazing' ],
	[ new Vector3( 0, 0.4, 0 ), new Vector3( - 0.2, - 0.05, 0.7 ), 'air to water, oblique' ],
] ) check( `Snell residual, ${ label }`, snellResidual( E, P, up, 0, 1 / N_WATER ).residual, 0, 1e-5 );
{

	const down = new Vector3( 0, - 1, 0 ); // eye under water, looking up
	const r = snellResidual( new Vector3( 0, - 0.5, 0 ), new Vector3( 0.4, 0.6, 0 ), down, 0, N_WATER );
	check( 'Snell residual, water to air', r.residual, 0, 1e-5 );

}

// 2. Face on, a point at depth b looks b / 1.33 deep.
{

	const A = apparentPoint( new Vector3( 0, 2, 0 ), new Vector3( 1e-4, - 0.4, 0 ), up, 0, 1 / N_WATER );
	check( 'apparent depth face on (m), true 0.4', - A.y, 0.4 / N_WATER, 1e-4 );

}

// 3. The broken stick: seen from above at 45 degrees, a point under the
// water looks raised (the line of sight to it dips less than the straight
// line), and nothing jumps at the surface.
{

	const E = new Vector3( - 1, 1, 0 );
	const top = apparentPoint( E, new Vector3( 0, - 1e-6, 0 ), up, 0, 1 / N_WATER );
	check( 'continuity at the surface (m)', top.distanceTo( new Vector3( 0, 0, 0 ) ), 0, 1e-4 );
	const P = new Vector3( 0, - 0.3, 0 ), A = apparentPoint( E, P, up, 0, 1 / N_WATER );
	const dipSeen = - A.clone().sub( E ).normalize().y, dipTrue = - P.clone().sub( E ).normalize().y;
	check( 'submerged point looks raised (dip seen < dip true)', dipSeen < dipTrue ? 1 : 0, 1, 0 );
	// Its line of sight crosses the surface where Snell puts it: sin(i) =
	// 1.33 sin(t). Solved apart (bisection in Python, 80 steps): s = 0.83500 m from the eye's foot.
	const d = A.clone().sub( E ).normalize();
	check( 'crossing point on the surface (x, m)', E.x - E.y / d.y * d.x, - 1 + 0.83500, 2e-4 );

}

// 4. Through a pane, face on: angular size grows. Eye 0.35 m from the
// glass, a 10 cm object 0.4 m behind it: tan = 0.05 / (0.35 + 0.4 / 1.33).
{

	const n = new Vector3( 0, 0, 1 ), E = new Vector3( 0, 0, 0.75 ), P = new Vector3( 0.05, 0, 0 );
	const A = apparentPoint( E, P, n, 0.4, 1 / N_WATER );
	const tanSeen = Math.abs( A.x / ( E.z - A.z ) );
	check( 'pane: apparent angular size (paraxial, tan)', tanSeen, 0.05 / ( 0.35 + 0.4 / N_WATER ), 2e-4 );

}

// 5. On the eye's side: untouched.
{

	const P = new Vector3( 0.2, 0.3, 0 );
	check( 'point on the eye side is not moved', apparentPoint( new Vector3( 0, 1, 0 ), P, up, 0, 1 / N_WATER ).distanceTo( P ), 0, 0 );

}

console.log( fails ? `${ fails } failure(s)` : 'all ok' );
process.exit( fails ? 1 : 0 );
