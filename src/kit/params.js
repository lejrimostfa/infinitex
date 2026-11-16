// Preset -> uniforms, from the defaults alone. Every built-in family writes
// this by hand (plastic/params.js); a new family can let the kit do it.
// Naming rules, read from each default:
//   '#rrggbb'              Color uniform, camelCase name        color2 -> u.color2
//   number, key _mm _um _cm _m   uniform in metres, name + M    chip_mm -> u.chipM
//   number, key _deg       uniform in radians                   angle_deg -> u.angle
//   other number           uniform as is                        relief -> u.relief
//   [ a, b ]               Vector2 uniform                      film_nm -> u.filmNm
//   other string (mode)    plain field, read when the graph is built
//   wetness, gloss, wear, wear_color   u.surface (core/surface.js)
// apply() only writes uniform values: ix.set() never recompiles. A string
// field (mode) changes the graph: it takes effect at the next createMaterial().

import { Color, Vector2 } from 'three';
import { uniform } from 'three/tsl';
import { SURFACE_DEFAULTS, createSurfaceUniforms, applySurfacePreset } from '../core/surface.js';

const UNIT = { _um: 1e-6, _mm: 1e-3, _cm: 1e-2, _m: 1 };
const META = new Set( [ 'family', 'schema_version', 'intent' ] );
const camel = ( k ) => k.replace( /_([a-z0-9])/g, ( _, c ) => c.toUpperCase() );
const isHex = ( v ) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test( v );

// key -> { name, kind, scale }
function plan( defaults ) {

	const out = {};
	for ( const [ k, v ] of Object.entries( defaults ) ) {

		if ( META.has( k ) || k in SURFACE_DEFAULTS ) continue;
		if ( isHex( v ) ) { out[ k ] = { name: camel( k ), kind: 'color' }; continue; }
		if ( Array.isArray( v ) && v.length === 2 ) { out[ k ] = { name: camel( k ), kind: 'vec2' }; continue; }
		if ( typeof v === 'string' ) { out[ k ] = { name: camel( k ), kind: 'field' }; continue; }
		if ( typeof v !== 'number' ) continue; // nested objects: the family handles them
		const unit = Object.keys( UNIT ).find( ( s ) => k.endsWith( s ) );
		if ( unit ) out[ k ] = { name: camel( k.slice( 0, - unit.length ) ) + 'M', kind: 'num', scale: UNIT[ unit ] };
		else if ( k.endsWith( '_deg' ) ) out[ k ] = { name: camel( k.slice( 0, - 4 ) ), kind: 'num', scale: Math.PI / 180 };
		else out[ k ] = { name: camel( k ), kind: 'num', scale: 1 };

	}

	return out;

}

export function defineParams( defaults ) {

	const full = { ...defaults, ...SURFACE_DEFAULTS, ...defaults };
	const P = plan( full );
	const names = Object.values( P ).map( ( e ) => e.name );
	const dup = names.find( ( n, i ) => names.indexOf( n ) !== i );
	if ( dup ) throw new Error( `infinitex defineParams: two preset keys map to the uniform "${ dup }", rename one` );

	function uniforms() {

		const u = { surface: createSurfaceUniforms() };
		for ( const [ k, e ] of Object.entries( P ) ) {

			const v = full[ k ];
			u[ e.name ] = e.kind === 'color' ? uniform( new Color( v ) ) : e.kind === 'vec2' ? uniform( new Vector2( v[ 0 ], v[ 1 ] ) )
				: e.kind === 'field' ? v : uniform( v * e.scale );

		}

		return u;

	}

	function apply( u, preset ) {

		const p = { ...full, ...preset };
		for ( const [ k, e ] of Object.entries( P ) ) {

			const v = p[ k ];
			if ( e.kind === 'color' ) u[ e.name ].value.set( v );
			else if ( e.kind === 'vec2' ) u[ e.name ].value.set( v[ 0 ], v[ 1 ] );
			else if ( e.kind === 'field' ) u[ e.name ] = v;
			else u[ e.name ].value = v * e.scale;

		}

		applySurfacePreset( u.surface, p );
		return { preset: p, stats: {}, derived: {} };

	}

	return { defaults: full, uniforms, apply, map: P };

}
