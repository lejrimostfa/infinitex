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
			{ at: 9, ray: ( C, V ) => [ C( 'LeftArm' ).add( V( 0.35, 0.05, 0.7 ) ), C( 'LeftArm' ).add( V( 0, 0.05, 0 ) ) ], alt: 0.05, caption: 'Une veste en laine tricotée' },
			{ at: 14, ray: ( C, V ) => [ C( 'LeftArm' ).add( V( 0.35, - 0.04, 0.7 ) ), C( 'LeftArm' ).add( V( 0, - 0.04, 0 ) ) ], alt: 0.012, caption: 'Les mailles prennent la couleur de la texture du jeu' },
			{ at: 19, ray: ( C, V ) => [ C( 'LeftArm' ).add( V( 0.35, - 0.06, 0.7 ) ), C( 'LeftArm' ).add( V( 0, - 0.06, 0 ) ) ], alt: 0.0018, caption: 'Les brins, les fibres, le duvet' },
			{ at: 23, ray: ( C, V ) => [ C( 'LeftArm' ).add( V( 0.35, - 0.08, 0.7 ) ), C( 'LeftArm' ).add( V( 0, - 0.08, 0 ) ) ], alt: 0.07 },
			{ at: 28, ray: ( C, V ) => [ C( 'Spine01' ).add( V( 0.08, - 0.05, 0.9 ) ), C( 'Spine01' ).add( V( 0.08, - 0.05, 0 ) ) ], alt: 0.04, caption: 'Un tablier en cuir' },
			{ at: 32, ray: ( C, V ) => [ C( 'Hips' ).add( V( 0.06, 0.05, 0.9 ) ), C( 'Hips' ).add( V( 0.06, 0.05, 0 ) ) ], alt: 0.009, caption: 'Grain, plis et craquelures' },
			{ at: 36, ray: ( C, V ) => [ C( 'Hips' ).add( V( 0.03, 0.0, 0.9 ) ), C( 'Hips' ).add( V( 0.03, 0.0, 0 ) ) ], alt: 0.0014, caption: 'Les pores du cuir' },
			{ at: 40, ray: ( C, V ) => [ C( 'Spine02' ).add( V( 0.0, 0.0, 0.9 ) ), C( 'Spine02' ).add( V( 0.0, 0.0, 0 ) ) ], alt: 0.35 },
			{ at: 45, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.2, 0.12, 1.0 ) ), C( 'Head' ).add( V( 0.05, 0.09, 0 ) ) ], alt: 0.05, caption: 'Un masque en bronze martelé, bordé de corde' },
			{ at: 50, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.15, 0.1, 1.0 ) ), C( 'Head' ).add( V( 0.04, 0.09, 0 ) ) ], alt: 0.007, caption: 'Cratères du marteau, vert-de-gris' },
			{ at: 55, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.13, 0.12, 1.0 ) ), C( 'Head' ).add( V( 0.03, 0.1, 0 ) ) ], alt: 0.0012, caption: 'Rayures et grains de l’alliage' },
			{ at: 60, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.13, 0.12, 1.0 ) ), C( 'Head' ).add( V( 0.03, 0.1, 0 ) ) ], alt: 0.3 },
			{ at: 65, ray: ( C, V ) => [ C( 'Head' ).add( V( 0.3, 0.5, 0.6 ) ), C( 'Head' ).add( V( 0.02, 0.12, 0.0 ) ) ], alt: 0.04, caption: 'Un bonnet tricoté' },
			{ at: 70, pos: [ 0.6, 1.8, 1.6 ], look: [ 0, 1.5, 0 ] },
			{ at: 77, pos: [ 1.1, 1.45, 3.0 ], look: [ 0, 1.05, 0 ], caption: '100 % procédural, du personnage aux fibres' },
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
				[ 0.075, 'Sa veste orange vient de la texture du jeu' ],
				[ 0.011, 'Chaque maille prend la couleur de la texture' ],
				[ 0.0026, 'Le fil, ses brins et son duvet' ],
				[ 0, 'Les fibres de laine, 21 µm' ],
			],
		},
		mask: {
			extra: 2, outward: [ 0, 0.2, 1 ], far: { target: [ 0, 1.6, 0.05 ], dir: [ 0.3, 0.35, 1 ] },
			ray: ( C, V ) => [ C( 'Head' ).add( V( 0.25, 0.35, 1.0 ) ), C( 'Head' ).add( V( 0.06, 0.06, 0 ) ) ],
			captions: [
				[ 0.55, 'The riveraine, a game character' ],
				[ 0.075, 'Son masque en bronze' ],
				[ 0.011, 'Coups de marteau, patine verte dans les creux' ],
				[ 0.0012, 'Rayures et piqûres de corrosion' ],
				[ 0, 'Les grains cristallins du métal' ],
			],
		},
		rope: {
			extra: 3, outward: [ 0, 0.3, 1 ],
			ray: ( C, V ) => [ C( 'Head' ).add( V( 0.3, 0.1, 1.0 ) ), C( 'Head' ).add( V( 0.08, 0.02, 0 ) ) ],
			captions: [
				[ 0.55, 'The riveraine, a game character' ],
				[ 0.075, 'La corde de son masque' ],
				[ 0.011, 'Trois torons tordus' ],
				[ 0.0012, 'Dans chaque toron, des fils tordus en sens inverse' ],
				[ 0, 'Les fibres de chanvre' ],
			],
		},
		apron: {
			zone: 1, goal: ( C, V ) => C( 'LeftUpLeg' ).add( V( - 0.05, 0, 0.2 ) ), outward: [ 0, 0, 1 ],
			captions: [
				[ 0.55, 'The riveraine, a game character' ],
				[ 0.075, 'Son tablier en cuir vient de la texture du jeu' ],
				[ 0.011, 'Le grain : un réseau de plis, des craquelures' ],
				[ 0.0012, 'Les pores, là où poussaient les poils' ],
				[ 0, 'Le vernis de surface et ses micro-fissures' ],
			],
		},
	},
};
