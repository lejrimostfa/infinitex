// Tables of the family check, printed by bin/infinitex-check.mjs.
// Thresholds: the gate's (tests/gate-limits.js); frame cost against the
// catalogue (docs/performance.md section 2: 81 % of the matters cost under
// 8 ms at their worst distance, 92 % under 16 ms).

export const PERF = { warn: 8, fail: 16 };

export function printLint( lint ) {

	const e = lint.issues.filter( ( i ) => i.level === 'error' ), w = lint.issues.filter( ( i ) => i.level === 'warn' );
	console.log( `\nlint: ${ lint.files.length } files, ${ e.length } errors, ${ w.length } warnings` );
	for ( const i of lint.issues ) console.log( `  ${ i.level === 'error' ? 'FAIL' : 'warn' }  ${ i.rule.padEnd( 10 ) } ${ i.file }${ i.line ? ':' + i.line : '' }  ${ i.msg }` );
	return e.length === 0;

}

export function printGate( backend, kind, rows, LIMITS ) {

	let ok = true;
	console.log( `\n${ backend }, ${ kind } matter: gate (limits meanShift ${ LIMITS.meanShift * 100 }%, shimmer ${ LIMITS.shimmer })` );
	console.log( '  height    meanShift  shimmer  result' );
	for ( const r of rows ) {

		const bad = ! ( r.meanShift <= LIMITS.meanShift ) || ! ( r.shimmer <= LIMITS.shimmer );
		ok &&= ! bad;
		const h = r.d >= 0.01 ? `${ ( r.d * 100 ).toFixed( 1 ) } cm` : `${ ( r.d * 1000 ).toFixed( 0 ) } mm`;
		console.log( `  ${ h.padStart( 7 ) }  ${ ( r.meanShift * 100 ).toFixed( 2 ).padStart( 8 ) }%  ${ r.shimmer.toFixed( 2 ).padStart( 7 ) }  ${ bad ? 'FAIL' : 'pass' }` );

	}

	// Where it fails says what to look at (docs/authoring.md, "When the check fails").
	const bad = rows.filter( ( r ) => ! ( r.meanShift <= LIMITS.meanShift ) || ! ( r.shimmer <= LIMITS.shimmer ) );
	if ( bad.length && bad.every( ( r ) => r.d <= 0.002 ) ) console.log( '  hint: fails only under 2 mm: the finest level or the micro detail has a non-zero mean. Try --preset \'{"micro":0}\', then impl.micro = [ \'generic\', ... ].' );
	else if ( bad.some( ( r ) => r.meanShift > LIMITS.meanShift ) ) console.log( '  hint: mean shift: a gate or a fade returns something else than the level\'s average (colour, cavity, roughness).' );
	if ( bad.some( ( r ) => r.shimmer > LIMITS.shimmer ) ) console.log( '  hint: shimmer: a level shows under 2 px per period. Raise its fadeIn lo, or fade an edge with the footprint (aa = fp / size).' );
	return ok;

}

export function printPerf( backend, rows ) {

	let ok = true;
	console.log( `\n${ backend }: frame at 1920x1080, matter filling the frame (limits: warn over ${ PERF.warn } ms, fail over ${ PERF.fail } ms of cost)` );
	console.log( '  distance  frame ms  grey ms  cost ms  result' );
	for ( const r of rows ) {

		const res = r.cost > PERF.fail ? 'FAIL' : r.cost > PERF.warn ? 'warn' : 'pass';
		ok &&= res !== 'FAIL';
		const d = r.d >= 0.01 ? `${ ( r.d * 100 ).toFixed( 0 ) } cm` : `${ ( r.d * 1000 ).toFixed( 1 ) } mm`;
		console.log( `  ${ d.padStart( 8 ) }  ${ r.ms.toFixed( 2 ).padStart( 8 ) }  ${ r.greyMs.toFixed( 2 ).padStart( 7 ) }  ${ r.cost.toFixed( 2 ).padStart( 7 ) }  ${ res }` );

	}

	if ( backend === 'webgl' ) console.log( '  note: on WebGL2 the pixel readback waits about 8 ms per frame, costs under that floor read as 0. Trust the WebGPU numbers.' );
	return ok;

}
