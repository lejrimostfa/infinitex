// Family registry. createMaterial( { family } ) looks the family up here.
// The built-in families are added by src/index.js at load; a game adds its
// own with registerFamily(). Same impl shape for both:
//
//   {
//     defaults  plain object: every preset key with its default
//     uniforms  () => u           the uniforms of one material
//     apply     ( u, preset ) => { preset, stats, derived }   no recompile
//     build     ( u, opts ) => nodes   the TSL graph (opts.coords, baseNormal)
//     sliders   optional, [ [ key, min, max, step ], ... ]
//     material  optional, 'sss' or ( u ) => 'sss' | undefined
//     micro     optional, [ kind, finest level (m) ] for core/micro.js:
//               kind is fibrous, granular, scratched, cellular or generic
//     height, fuzz, hair   optional, as the built-in families
//     displace, displaceMax   optional, together: a height node that moves
//               the vertices (preset.displace), and its largest value in
//               meters from the uniforms (the camera pads collisions by it)
//   }
//
// Event bus: familyEvents (EventTarget) emits
//   familyRegistered  { name, builtin, defaults, sliders }
// UI code (a family picker) listens to it instead of polling listFamilies().

import { MICRO_KINDS } from './core/micro.js';

const TABLE = new Map(); // name -> { impl, builtin }
export const familyDefaults = {}; // name -> defaults, the `families` export of index.js
export const familyEvents = new EventTarget();

const NAME = /^[a-z][a-z0-9_]{1,31}$/;
const MICRO = [ 'fibrous', 'granular', 'scratched', 'cellular', 'generic' ];
const FN_KEYS = [ 'uniforms', 'apply', 'build' ];
const OPT_FN_KEYS = [ 'height', 'fuzz', 'hair', 'displace', 'displaceMax' ];

const fail = ( name, msg ) => { throw new Error( `infinitex registerFamily("${ name }"): ${ msg }` ); };

// Throws a clear error for each wrong field. Cheap: one uniforms() and one
// apply() on the defaults, no node graph built.
export function validateFamily( name, impl ) {

	if ( typeof name !== 'string' || ! NAME.test( name ) ) fail( name, 'the name must be 2 to 32 characters, lower case letters, digits or _, starting with a letter' );
	if ( ! impl || typeof impl !== 'object' ) fail( name, 'impl must be an object { defaults, uniforms, apply, build }' );
	if ( ! impl.defaults || typeof impl.defaults !== 'object' ) fail( name, 'impl.defaults must be an object of preset keys' );
	if ( impl.defaults.family !== undefined && impl.defaults.family !== name ) fail( name, `impl.defaults.family is "${ impl.defaults.family }", it must be "${ name }" or absent` );
	for ( const k of FN_KEYS ) if ( typeof impl[ k ] !== 'function' ) fail( name, `impl.${ k } must be a function` );
	for ( const k of OPT_FN_KEYS ) if ( impl[ k ] !== undefined && typeof impl[ k ] !== 'function' ) fail( name, `impl.${ k } must be a function when given` );
	if ( impl.displace && ! impl.displaceMax ) fail( name, 'impl.displaceMax is required with impl.displace: the camera collides with the flat mesh padded by it' );
	const m = impl.material;
	if ( m !== undefined && m !== 'sss' && m !== 'physical' && typeof m !== 'function' ) fail( name, 'impl.material must be "sss", "physical" or a function of the uniforms' );
	if ( impl.sliders !== undefined ) {

		if ( ! Array.isArray( impl.sliders ) ) fail( name, 'impl.sliders must be an array of [ key, min, max, step ]' );
		for ( const s of impl.sliders ) {

			if ( ! Array.isArray( s ) || s.length !== 4 || typeof s[ 0 ] !== 'string' || ! s.slice( 1 ).every( Number.isFinite ) ) fail( name, `slider ${ JSON.stringify( s ) } must be [ key, min, max, step ]` );
			if ( ! ( s[ 0 ] in impl.defaults ) ) fail( name, `slider "${ s[ 0 ] }" has no default in impl.defaults` );

		}

	}

	if ( impl.micro !== undefined ) {

		const [ kind, finest ] = Array.isArray( impl.micro ) ? impl.micro : [];
		if ( ! MICRO.includes( kind ) || ! ( finest > 0 && finest < 0.01 ) ) fail( name, `impl.micro must be [ kind, finest_m ] with kind in ${ MICRO.join( ', ' ) } and finest_m in metres (e.g. 20e-6)` );

	}

	const u = impl.uniforms();
	if ( ! u || typeof u !== 'object' ) fail( name, 'impl.uniforms() must return an object' );
	const state = impl.apply( u, { ...impl.defaults } );
	if ( ! state || typeof state.preset !== 'object' ) fail( name, 'impl.apply( u, preset ) must return { preset, stats, derived }' );

}

function add( name, impl, builtin ) {

	TABLE.set( name, { impl, builtin } );
	familyDefaults[ name ] = impl.defaults;
	if ( impl.micro ) MICRO_KINDS[ name ] = impl.micro;
	familyEvents.dispatchEvent( new CustomEvent( 'familyRegistered', { detail: { name, builtin, defaults: impl.defaults, sliders: impl.sliders ?? [] } } ) );

}

// Called once by src/index.js with its FAMILIES table.
export function registerBuiltins( table ) {

	for ( const [ name, impl ] of Object.entries( table ) ) add( name, impl, true );

}

// Adds a family. A built-in name cannot be taken. The same name again with
// the same impl object is a no-op (hot reload); with another impl it
// throws, unless opts.replace is true.
export function registerFamily( name, impl, opts = {} ) {

	const had = TABLE.get( name );
	if ( had?.impl === impl ) return impl;
	if ( had?.builtin ) fail( name, 'a built-in family has that name, pick another' );
	if ( had && ! opts.replace ) fail( name, 'already registered, pass { replace: true } to swap it' );
	validateFamily( name, impl );
	add( name, impl, false );
	return impl;

}

export function getFamily( name ) {

	return TABLE.get( name )?.impl;

}

// [ { name, builtin } ] in registration order.
export function listFamilies() {

	return [ ...TABLE ].map( ( [ name, e ] ) => ( { name, builtin: e.builtin } ) );

}
