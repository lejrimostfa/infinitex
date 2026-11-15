// The time every animated material reads, in seconds. One uniform for the
// whole library, set by the app (InfinitexMaterial users call setTime each
// frame). TSL's own `time` follows the wall clock, so a film rendered frame
// by frame would not be reproducible: animated families read ixTime instead.
//
// Event bus: none. The app owns the clock; materials only read it.

import { uniform } from 'three/tsl';

export const ixTime = uniform( 0 );

export function setTime( seconds ) {

	ixTime.value = seconds;

}
