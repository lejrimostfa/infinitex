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
// update( focusDistance ) once per frame; the slices are rebuilt only when
// the distance moved by more than 12%.
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
	light.shadow.mapSize.set( mapSize, mapSize );
	light.shadow.shadowNode = csm;

	let built = 0;
	return {
		csm,
		update( focusDistance ) {

			const want = Math.max( 0.02, focusDistance );
			if ( built && Math.abs( Math.log( want / built ) ) < 0.12 ) return;
			d = built = want;
			if ( csm.camera ) csm.updateFrustums(); // the node takes the camera on its first frame

		},
	};

}
