// Sun shadows of the camera kit (kit.js, option shadows): cascades that
// follow the focus distance (three's CSMShadowNode). One shadow map over a whole room gives texels of a few
// millimetres: enough for a sofa, not for an orange in a bowl. Here the
// view is cut in three slices, each with its own map:
//   near    up to 2.5 times the focus distance: what the camera looks at.
//           At 40 cm from a fruit a texel is about half a millimetre.
//   mid     up to 10 times
//   far     the rest of the scene, as before
// The slices move with the focus (lens.js), so the fine one is always
// on the subject, from a room down to a few centimetres.
//
// Once per frame: three renders a shadow map once per camera per frame,
// and a page that draws its scene again from another camera (a water
// mirror, a waterline's second pass, a reflection probe) drew the same
// maps again, though the slices fit the page camera only (the node keeps
// the camera it was built with). Here the maps render on the first pass of
// each frame (node frame id) and the later passes reuse them. On the
// beach: 6 to 9 cascade passes a frame down to 3, same image.
//
// update( focusDistance ) once per frame; the slices are rebuilt when the
// distance moved by more than 4%. The kit eases that distance (kit.js), so
// a change of subject re-cuts them in small steps, not in one jump.
//
// Event bus: none (kit.update drives it each frame).

import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';

export function createSunCascades( { light, camera, far = 30, mapSize = 2048, margin = 30 } ) {

	let d = 1;
	const csm = new CSMShadowNode( light, {
		cascades: 3, maxFar: far, mode: 'custom', lightMargin: margin,
		customSplitsCallback: ( n, near, f, breaks ) => {

			const a = Math.min( 0.3, d * 2.5 / f ), b = Math.min( 0.6, Math.max( a * 1.5, d * 10 / f ) );
			breaks.push( a, b, 1 );

		},
	} );
	csm.fade = true; // blend from one slice to the next
	let frameSeen = - 1;
	const fit = csm.updateBefore.bind( csm );
	csm.updateBefore = ( frame ) => {

		if ( frame && frame.frameId !== frameSeen ) {

			frameSeen = frame.frameId;
			for ( const l of csm.lights ) { l.shadow.autoUpdate = false; l.shadow.needsUpdate = true; }

		}

		return fit( frame );

	};
	light.shadow.mapSize.set( mapSize, mapSize );
	light.shadow.shadowNode = csm;

	let built = 0;
	return {
		csm,
		update( focusDistance ) {

			const want = Math.max( 0.02, focusDistance );
			if ( built && Math.abs( Math.log( want / built ) ) < 0.04 ) return;
			d = built = want;
			if ( csm.camera ) csm.updateFrustums(); // the node takes the camera on its first frame

		},
	};

}
