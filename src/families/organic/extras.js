// Optional outputs of the animal matters, laid on the material nodes after
// the shared surface states (shader.js calls applyExtras once):
//   metal                  metalness of grains held in the matter (pyrite)
//   irid, iridThick (nm)   a thin film: nacre, butterfly scales, insect
//                          eyes. Colour shifts with the view angle.
//   transmission           the scene behind seen through (amber): three.js
//                          copies the opaque scene once per frame. With
//                          thickness (m), ior and an attenuation colour.
//   opacity                a cut out matter (spider web): the material is
//                          made transparent and double sided, so the web
//                          on the far faces shows through the gaps.
// Matters that set none of these cost nothing more.

import { DoubleSide } from 'three';
import { float } from 'three/tsl';

export function applyExtras( nodes, O ) {

	// Metal grains in the matter (pyrite in coal).
	if ( O.metal ) nodes.metalnessNode = O.metal;

	if ( O.irid ) {

		nodes.iridescenceNode = O.irid;
		nodes.iridescenceIORNode = O.iridIOR ?? float( 1.5 );
		nodes.iridescenceThicknessNode = O.iridThick ?? float( 400 );

	}

	if ( O.transmission ) {

		nodes.transmissionNode = O.transmission;
		nodes.thicknessNode = O.thickness ?? float( 0.02 );
		nodes.iorNode = O.ior ?? float( 1.54 );
		if ( O.attenColor ) nodes.attenuationColorNode = O.attenColor;
		if ( O.attenDist ) nodes.attenuationDistanceNode = O.attenDist;

	}

	if ( O.opacity ) {

		// Material flags travel with the nodes: index.js assigns them all.
		nodes.opacityNode = O.opacity;
		nodes.transparent = true;
		nodes.side = DoubleSide;
		nodes.depthWrite = false;

	}

	return nodes;

}
