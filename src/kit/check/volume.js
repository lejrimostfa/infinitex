// Liquid volumes in non-box containers (check.html?volume=1): a wine glass
// (lathe) and a round-bottom flask (sphere and neck) on a terrazzo table,
// filled through createLiquidVolume (core/liquidvolume.js).
//   ?liquid=wine|water|oil|honey|juice|milk   the glass (the flask: water)
//   ?fill=0.55                                  share of the glass filled
//   ?view=close                                 the wine surface at the wall (meniscus)
// window.__ixCheck: { ready, errors, volumes, setFill( f ) }. The info line
// listens to each volume's levelChanged event.

import * as THREE from 'three/webgpu';
import { uv } from 'three/tsl';
import { createMaterial, createLiquidVolume } from '../../index.js';
import { thinGlassMaterial } from '../../core/liquidshading.js';

const V = ( x, y ) => new THREE.Vector2( x, y );

// Inner bowl of a wine glass, closed on the axis at both ends (m).
const BOWL = [ V( 0, 0.1 ), V( 0.012, 0.1015 ), V( 0.026, 0.108 ), V( 0.034, 0.12 ), V( 0.037, 0.14 ), V( 0.0345, 0.165 ), V( 0.0305, 0.19 ), V( 0, 0.19 ) ];
// Round-bottom flask: a 5 cm sphere centred 6 cm up, a 12 mm neck to 17 cm.
function flaskProfile( r = 0.05, cy = 0.06, neck = 0.012, top = 0.17, n = 40 ) {

	const a1 = Math.asin( neck / r ), pts = [];
	for ( let i = 0; i <= n; i ++ ) {

		const th = ( Math.PI - a1 ) * i / n; // 0 at the bottom, up to the neck
		pts.push( V( r * Math.sin( th ), cy - r * Math.cos( th ) ) );

	}

	pts.push( V( neck, top ), V( 0, top ) );
	return pts;

}

// The glass around a cavity profile: offset outward by `t`, open at the
// top (drop the closing point on the axis), plus a stem and a foot.
function glassProfile( cavity, t, stem = null ) {

	const wall = cavity.slice( 1, - 1 ).map( ( p ) => V( p.x + t, p.y ) );
	const base = stem ? [ V( 0, 0 ), V( 0.035, 0 ), V( 0.035, 0.003 ), V( 0.0045, 0.008 ), V( 0.004, stem ) ] : [ V( 0, cavity[ 0 ].y - t ) ];
	return [ ...base, ...wall ];

}

export async function buildVolumeScene( ctx, q ) {

	const { scene, camera, controls, floor } = ctx;
	floor.visible = false;
	const table = new THREE.Mesh( new THREE.PlaneGeometry( 1.2, 1.2 ).rotateX( - Math.PI / 2 ), createMaterial( { family: 'terrazzo', chip_mm: 14 }, { coords: uv().mul( 1.2 ) } ).material );
	table.geometry.computeTangents();
	scene.add( table );

	const info = document.getElementById( 'info' );
	const volumes = [];
	const say = () => { if ( info ) info.textContent = volumes.map( ( v ) => `${ v.liquid }: ${ ( v.volume * 1e6 ).toFixed( 0 ) } ml, level ${ ( v.level * 100 ).toFixed( 1 ) } cm` ).join( '   ' ); };

	function vessel( profile, cavityPts, liquid, fill, x ) {

		const glass = new THREE.Mesh( new THREE.LatheGeometry( profile, 96 ), thinGlassMaterial() );
		glass.position.x = x;
		glass.renderOrder = 2; // after the liquid: blended over it
		scene.add( glass );
		const vol = createLiquidVolume( { cavity: new THREE.LatheGeometry( cavityPts, 96 ), fill, liquid } );
		vol.addEventListener( 'levelChanged', say );
		vol.addEventListener( 'volumeReady', say );
		glass.add( vol.object );
		volumes.push( vol );
		return vol;

	}

	const fill = Number( q.get( 'fill' ) ?? 0.55 );
	vessel( glassProfile( BOWL, 0.0012, 0.1 ), BOWL, q.get( 'liquid' ) ?? 'wine', fill, - 0.06 );
	const fp = flaskProfile();
	vessel( glassProfile( fp, 0.0015 ), fp, 'water', 0.5, 0.07 );

	// The sky behind the glass: thin glass and liquids read by what they show.
	if ( scene.environment ) { scene.background = scene.environment; scene.backgroundBlurriness = 0.25; }
	const close = q.get( 'view' ) === 'close'; // the wine surface at the wall
	controls.target.set( close ? - 0.06 : 0, close ? 0.15 : 0.1, 0 );
	camera.position.set( close ? - 0.02 : 0.03, close ? 0.185 : 0.19, close ? 0.06 : 0.36 );
	window.__ixCheck = {
		ready: true, errors: [], volumes: () => volumes.map( ( v ) => ( { liquid: v.liquid, volume_m3: v.volume, level: v.level, fill: v.fill, chord: v.U.chord.value } ) ),
		setFill: ( f ) => volumes[ 0 ].setFill( f ),
	};

}
