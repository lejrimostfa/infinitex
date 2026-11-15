// Micro-shadowing: the relief of a family is a normal map, so a pore or a
// crack never shadows itself from the key light. The cavity (as aoNode,
// core/surface.js) says how closed a point is; a closed point receives
// direct light only when the light comes nearly along the normal.
//   shadow = clamp( |N.L| + 2 ao^2 - 1, 0, 1 )
// (Chan, "Material advances in Call of Duty: WWII", 2018). Wraps the
// material's lighting model: the light colour of every direct light is
// scaled before the usual BRDF. No cost where ao = 1.

import { normalView } from 'three/tsl';

export function addMicroShadow( material ) {

	const ao = material.aoNode;
	if ( ! ao ) return material;
	const setup = material.setupLightingModel.bind( material );
	material.setupLightingModel = ( builder ) => {

		const model = setup( builder );
		const direct = model.direct.bind( model );
		model.direct = ( args, b ) => {

			// The cavity is a coarse signal (a wide, shallow mortar joint
			// counts as much as a crack): soften it before the cone test.
			const nl = normalView.dot( args.lightDirection ).abs();
			const a = ao.mul( 0.6 ).add( 0.4 );
			const ms = nl.add( a.mul( a ).mul( 2 ) ).sub( 1 ).clamp( 0, 1 );
			return direct( { ...args, lightColor: args.lightColor.mul( ms ) }, b );

		};
		return model;

	};
	return material;

}
