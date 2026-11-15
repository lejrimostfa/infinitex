// Sheer cloth (voile, organza): the gaps between threads are holes and a
// fine thread lets part of the light through. So the cloth is drawn as a
// blended, two sided surface: the far face of the cube shows through the
// near one, as through a curtain.
//   near: opacity = thread_opacity on a thread, 0 in a gap (antialiased
//         by the `inside` mask of the weave)
//   far:  the mean of the cell. A gap is (1 - fill) of the spacing both
//         ways, so the open area is (1 - fill)^2; where the two threads
//         cross the light goes through two layers.

import { float, mix } from 'three/tsl';
import { DoubleSide } from 'three';

export function applySheer( nodes, u, { inside, crossing, w1 } ) {

	const op = u.threadOpacity;
	const open = float( 1 ).sub( u.fill ).pow( 2 );
	const cross = u.fill.mul( u.fill );
	const two = float( 1 ).sub( float( 1 ).sub( op ).pow( 2 ) ); // two layers
	const mean = float( 1 ).sub( open ).sub( cross ).mul( op ).add( cross.mul( two ) );
	const near = inside.mul( mix( op, two, crossing ) );
	nodes.opacityNode = mix( mean, near, w1 );
	nodes.transparent = true;
	nodes.side = DoubleSide;
	nodes.depthWrite = false;
	return nodes;

}
