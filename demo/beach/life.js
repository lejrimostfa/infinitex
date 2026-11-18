// What moves on the paper beach (demo/beach.js), driven by the page clock.
//   sway     each palm leans a little in the trade wind, slow and out of
//            step with its neighbours (a turn about its base: the origin
//            of the folded GLB is the foot of the trunk)
//   crab     walks sideways, back and forth along the waterline, its legs
//            stepping (named parts of crab_parts.glb: leg_L1..R4, claw_L/R)
//   pop-up   setPop( s ): s seconds into the opening, each prop rises from
//            flat on the sand to standing, with a small overshoot, in a
//            wave from the pier outward. null: all standing (default)
// createLife( placed ) -> { update( t ), setPop( s ) }. placed: the copies
// from beach/props.js place(), with userData.entry (their layout entry).
//
// Event bus: none (the page calls update each frame).

const PIER = [ - 8, 3 ]; // where the wave starts (x, z)
const WAVE = 30; // m per second: the farthest palm of the grove (about 260 m) stands after 9 s
const RISE = 0.9; // s for one prop to stand

export function createLife( placed ) {

	const palms = [], props = [];
	let crab = null;
	for ( const o of placed ) {

		const e = o.userData.entry;
		const base = { rx: o.rotation.x, rz: o.rotation.z, x: o.position.x, z: o.position.z, s: o.scale.x };
		const delay = Math.hypot( base.x - PIER[ 0 ], base.z - PIER[ 1 ] ) / WAVE;
		props.push( { o, base, delay } );
		if ( e.name === 'palm' ) palms.push( { o, base, phase: base.x * 0.37 + base.z * 0.21 } );
		if ( e.name === 'crab' ) {

			const legs = [];
			o.traverse( ( c ) => { if ( /^leg_/.test( c.name ) ) legs.push( { c, rx: c.rotation.x, side: c.name.includes( '_L' ) ? 1 : - 1, i: + c.name.slice( - 1 ) } ); } );
			crab = { o, base, legs };

		}

	}

	let pop = null;
	const ease = ( k ) => { k = Math.min( 1, Math.max( 0, k ) ); return 1 + 2.2 * Math.pow( k - 1, 3 ) + 1.2 * Math.pow( k - 1, 2 ); }; // ease out with a small overshoot

	function update( t ) {

		for ( const p of palms ) {

			const w = Math.sin( t * 0.7 + p.phase ) * 0.6 + Math.sin( t * 1.9 + p.phase * 2 ) * 0.25;
			p.o.rotation.z = p.base.rz + w * 0.025;
			p.o.rotation.x = p.base.rx + Math.sin( t * 0.5 + p.phase ) * 0.012;

		}

		if ( crab ) {

			// Sideways along its own x: two metres one way, then back.
			const s = Math.sin( t * 0.35 ) * 2;
			const yaw = crab.o.rotation.y;
			crab.o.position.x = crab.base.x + Math.cos( yaw ) * s;
			crab.o.position.z = crab.base.z - Math.sin( yaw ) * s;
			for ( const l of crab.legs ) l.c.rotation.x = l.rx + Math.sin( t * 9 + l.i * 1.6 + ( l.side > 0 ? 0 : Math.PI ) ) * 0.35;

		}

		for ( const p of props ) {

			if ( pop === null ) { p.o.scale.y = p.base.s; p.o.visible = true; continue; }
			const k = ( pop - p.delay ) / RISE;
			p.o.visible = k > 0;
			p.o.scale.y = p.base.s * Math.max( 0.02, k >= 1 ? 1 : ease( k ) );

		}

	}

	return { update, setPop: ( s ) => { pop = s; }, palms, crab };

}
