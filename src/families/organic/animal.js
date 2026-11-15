// Mode table of the animal, fossil, sea and soil matters of row 20.
// shader.js spreads these into its MODES, POROSITY and SSS tables, so the
// plant matters and these can grow without touching the same lines.
// To add a matter: one entry in ANIMAL_MODES, one in ANIMAL_POROSITY, and
// its name in ANIMAL_SSS when light passes through it.

import { buildMeat, buildFat } from './flesh.js';
import { buildBlood, buildDriedBlood } from './blood.js';
import { buildMucus } from './mucus.js';
import { buildBone, buildSponge } from './bone.js';
import { buildHoneycomb, buildBeeswax } from './hive.js';
import { buildEggshell, buildPearl } from './shell.js';
import { buildIvory, buildTortoise } from './ivory.js';
import { buildButterfly, buildInsectEye } from './insect.js';
import { buildCocoon, buildWeb } from './silk.js';
import { buildAmber } from './fossil.js';
import { buildPetrified, buildCoal } from './mineral.js';
import { buildCoral } from './sea.js';
import { buildBarnacle } from './barnacle.js';
import { buildMould, buildCompost } from './soil.js';

export const ANIMAL_MODES = {
	meat: buildMeat, fat: buildFat, blood: buildBlood, driedblood: buildDriedBlood, mucus: buildMucus,
	bone: buildBone, sponge: buildSponge, honeycomb: buildHoneycomb, beeswax: buildBeeswax, eggshell: buildEggshell, pearl: buildPearl,
	ivory: buildIvory, tortoise: buildTortoise, butterfly: buildButterfly, insecteye: buildInsectEye,
	cocoon: buildCocoon, web: buildWeb, amber: buildAmber, petrified: buildPetrified, coal: buildCoal,
	coral: buildCoral, barnacle: buildBarnacle, mould: buildMould, compost: buildCompost,
};

// How much each matter drinks water (surface.js wetness).
export const ANIMAL_POROSITY = {
	meat: 0.2, fat: 0.05, blood: 0, driedblood: 0.4, mucus: 0,
	bone: 0.9, sponge: 1, honeycomb: 0.1, beeswax: 0.05, eggshell: 0.5, pearl: 0,
	ivory: 0.2, tortoise: 0, butterfly: 0.3, insecteye: 0,
	cocoon: 0.9, web: 0, amber: 0, petrified: 0.05, coal: 0.2, coral: 0.9, barnacle: 0.4, mould: 0.8, compost: 1,
};

// Soft tissue, wax, resin: light enters and comes out in their colour.
export const ANIMAL_SSS = [ 'meat', 'fat', 'mucus', 'honeycomb', 'beeswax', 'ivory', 'tortoise' ];
