// The riveraine, a game character: knit jacket and cap, leather
// apron, gloves and belt. Model: public/personnages/riveraine.glb.

import { isOrange, isBrown } from '../zones.js';

export default {
	model: '/demo/assets/riveraine.glb',
	body: ( o ) => o.isSkinnedMesh && o.material.name === 'Material_0',
	idle: 'Idle',
	zones: [
		{
			name: 'Veste : tricot', test: isOrange, fuzz: true,
			preset: { family: 'knit', stitches_per_10cm: 22, rows_per_10cm: 30, color: '#ffffff', heather_color: '#c4c4c4', heather_fraction: 0.18, fuzz_hairs_per_mm2: 3, sheen: 0.5 },
		},
		{ name: 'Tablier : cuir', test: isBrown, preset: { family: 'leather', wear: 0.25, crack_amount: 0.5 } },
	],
	// One cylinder per body part: wales down the torso and cap, along the sleeves.
	regions: ( C, V ) => [
		{ bones: [ 'Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'LeftShoulder', 'RightShoulder', 'LeftUpLeg', 'RightUpLeg' ], axis: { origin: C( 'Hips', 'Spine', 'Spine01', 'Spine02' ), dir: V( 0, 1, 0 ), seam: V( 0, 0, - 1 ) } },
		...[ 'Left', 'Right' ].map( ( s ) => ( { bones: [ `${ s }Arm`, `${ s }ForeArm`, `${ s }Hand` ], axis: { origin: C( `${ s }Arm` ), dir: C( `${ s }ForeArm` ).sub( C( `${ s }Arm` ) ), seam: V( 0, - 1, 0 ) } } ) ),
		{ bones: [ 'Head' ], axis: { origin: C( 'Head' ), dir: V( 0, 1, 0 ), seam: V( 0, 0, - 1 ) } },
		...[ 'Left', 'Right' ].map( ( s ) => ( { bones: [ `${ s }Leg`, `${ s }Foot`, `${ s }ToeBase` ], axis: { origin: C( `${ s }Leg` ), dir: V( 0, - 1, 0 ), seam: V( 0, 0, - 1 ) } } ) ),
	],
	// Rigid meshes found by material name, one family each. The mask hangs
	// on the head bone; the rope is unwrapped along its length (0.028 m
	// per UV unit both ways), so it keeps its own UVs.
	extras: [
		{ material: 'dockers_face', name: 'Masque : face en bronze', preset: { family: 'metal', metal: 'bronze', color_from_map: 0.6, patina: 0.35 } },
		{ material: 'dockers_cote', name: 'Masque : bord en bronze', preset: { family: 'metal', metal: 'bronze', patina: 0.55, seed: 2 } },
		{ material: 'bronze', name: 'Masque : bronze', preset: { family: 'metal', metal: 'bronze', patina: 0.45, seed: 3 } },
		{ material: 'corde_claire', name: 'Corde : chanvre', fuzz: true, uvScale: [ 0.028, 0.028 ], preset: { family: 'rope', diameter_mm: 8.9 } },
	],
	// The flyover: wide, the knit sleeve, the leather apron, the bronze mask,
	// the rope, the knit cap, wide again. Low keys dive (mm), keys between
	// parts rise so the flight never cuts through the body.
	flyover: {
		keys: [
			{ at: 0, pos: [ 0.9, 1.35, 2.6 ], look: [ 0, 1.05, 0 ], caption: 'The riveraine, a game character' },
			{ at: 5, pos: [ 0.75, 1.3, 1.1 ], look: [ 0.2, 1.2, 0 ] },
			{ at: 9, ray: ( C, V ) => [ C( 'LeftArm' ).add( V( 0.35, 0.05, 0.7 ) ), C( 'LeftArm' ).add( V( 0, 0.05, 0 ) ) ], alt: 0.05, caption: 'A knitted wool jacket' },
			{ at: 14, ray: ( C, V ) => [ C( 'LeftArm' ).add( V( 0.35, - 0.04, 0.7 ) ), C( 'LeftArm' ).add( V( 0, - 0.04, 0 ) ) ], alt: 0.012, caption: 'Each stitch takes its colour from the game texture' },
			{ at: 19, ray: ( C, V ) => [ C( 'LeftArm' ).add( V( 0.35, - 0.06, 0.7 ) ), C( 'LeftArm' ).add( V( 0, - 0.06, 0 ) ) ], alt: 0.0018, caption: 'Plies, fibres and fuzz' },
			{ at: 23, ray: ( C, V ) => [ C( 'LeftArm' ).add( V( 0.35, - 0.08, 0.7 ) ), C( 'LeftArm' ).add( V( 0, - 0.08, 0 ) ) ], alt: 0.07 },
			{ at: 28, ray: ( C, V ) => [ C( 'Spine01' ).add( V( 0.08, - 0.05, 0.9 ) ), C( 'Spine01' ).add( V( 0.08, - 0.05, 0 ) ) ], alt: 0.04, caption: 'A leather apron' },
			{ at: 32, ray: ( C, V ) => [ C( 'Hips' ).add( V( 0.06, 0.05, 0.9 ) ), C( 'Hips' ).add( V( 0.06, 0.05, 0 ) ) ], alt: 0.009, caption: 'Grain, creases and cracks' },
			{ at: 36, ray: ( C, V ) => [ C( 'Hips' ).add( V( 0.03, 0.0, 0.9 ) ), C( 'Hips' ).add( V( 0.03, 0.0, 0 ) ) ], alt: 0.0014, caption: 'The pores of the leather' },
			{ at: 40, ray: ( C, V ) => [ C( 'Spine02' ).add( V( 0.0, 0.0, 0.9 ) ), C( 'Spine02' ).add( V( 0.0, 0.0, 0 ) ) ], alt: 0.35 },
			{ at: 45, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.2, 0.12, 1.0 ) ), C( 'Head' ).add( V( 0.05, 0.09, 0 ) ) ], alt: 0.05, caption: 'A hammered bronze mask, edged with rope' },
			{ at: 50, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.15, 0.1, 1.0 ) ), C( 'Head' ).add( V( 0.04, 0.09, 0 ) ) ], alt: 0.007, caption: 'Hammer dents and verdigris' },
			{ at: 55, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.13, 0.12, 1.0 ) ), C( 'Head' ).add( V( 0.03, 0.1, 0 ) ) ], alt: 0.0012, caption: 'Scratches and the grains of the alloy' },
			{ at: 60, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.13, 0.12, 1.0 ) ), C( 'Head' ).add( V( 0.03, 0.1, 0 ) ) ], alt: 0.3 },
			{ at: 65, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.3, 0.5, 0.6 ) ), C( 'Head' ).add( V( 0.02, 0.12, 0.0 ) ) ], alt: 0.04, caption: 'A knitted cap' },
			{ at: 70, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.3, 0.5, 0.6 ) ), C( 'Head' ).add( V( 0.01, 0.13, 0.0 ) ) ], alt: 0.008, caption: 'Rows of stitches' },
			{ at: 75, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.3, 0.5, 0.6 ) ), C( 'Head' ).add( V( 0.0, 0.14, 0.0 ) ) ], alt: 0.0015, caption: 'The yarn, down to its fibres' },
			{ at: 80, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.3, 0.5, 0.6 ) ), C( 'Head' ).add( V( 0.0, 0.15, 0.0 ) ) ], alt: 0.06 },
			{ at: 84, pos: [ 0.6, 1.8, 1.6 ], look: [ 0, 1.5, 0 ] },
			{ at: 91, pos: [ 1.1, 1.45, 3.0 ], look: [ 0, 1.05, 0 ], caption: '100% procedural, from the character down to the fibres' },
		],
	},
	far: { target: [ 0, 1.05, 0 ], dir: [ 0.32, 0.12, 1 ] },
	view: { target: [ 0, 1.05, 0 ], camera: [ 0.6, 1.35, 2.4 ] },
	defaultStop: 'sleeve',
	stops: {
		sleeve: {
			zone: 0, goal: ( C, V ) => C( 'LeftArm' ).add( V( 0, 0.02, 0.06 ) ), outward: [ 0.4, 0.2, 1 ],
			captions: [
				[ 0.55, 'The riveraine, a game character' ],
				[ 0.075, 'The orange jacket comes from the game texture' ],
				[ 0.011, 'Each stitch takes the colour of the texture' ],
				[ 0.0026, 'The yarn, its plies and its fuzz' ],
				[ 0, 'Wool fibres, 21 µm' ],
			],
		},
		mask: {
			extra: 2, outward: [ 0, 0.2, 1 ], far: { target: [ 0, 1.6, 0.05 ], dir: [ 0.3, 0.35, 1 ] },
			ray: ( C, V ) => [ C( 'Head' ).add( V( 0.25, 0.35, 1.0 ) ), C( 'Head' ).add( V( 0.06, 0.06, 0 ) ) ],
			captions: [
				[ 0.55, 'The riveraine, a game character' ],
				[ 0.075, 'The bronze mask' ],
				[ 0.011, 'Hammer dents, green patina in the hollows' ],
				[ 0.0012, 'Scratches and corrosion pits' ],
				[ 0, 'The crystal grains of the metal' ],
			],
		},
		rope: {
			extra: 3, outward: [ 0, 0.3, 1 ],
			ray: ( C, V ) => [ C( 'Head' ).add( V( 0.3, 0.1, 1.0 ) ), C( 'Head' ).add( V( 0.08, 0.02, 0 ) ) ],
			captions: [
				[ 0.55, 'The riveraine, a game character' ],
				[ 0.075, 'The rope of the mask' ],
				[ 0.011, 'Three twisted strands' ],
				[ 0.0012, 'In each strand, yarns twisted the other way' ],
				[ 0, 'Hemp fibres' ],
			],
		},
		apron: {
			zone: 1, goal: ( C, V ) => C( 'LeftUpLeg' ).add( V( - 0.05, 0, 0.2 ) ), outward: [ 0, 0, 1 ],
			captions: [
				[ 0.55, 'The riveraine, a game character' ],
				[ 0.075, 'The leather apron comes from the game texture' ],
				[ 0.011, 'The grain: a net of creases, and cracks' ],
				[ 0.0012, 'The pores, where the hairs grew' ],
				[ 0, 'The surface finish and its micro cracks' ],
			],
		},
	},
};
