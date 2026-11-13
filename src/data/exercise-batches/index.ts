import { BATCH_BACK_BICEPS } from "./back-biceps";
import { MOTIONS_BACK_BICEPS } from "./back-biceps.motions";
import { BATCH_CHEST_TRICEPS } from "./chest-triceps";
import { MOTIONS_CHEST_TRICEPS } from "./chest-triceps.motions";
import { BATCH_LEGS_MOBILITY } from "./legs-mobility";
import { MOTIONS_LEGS_MOBILITY } from "./legs-mobility.motions";
import { BATCH_SHOULDERS_CORE } from "./shoulders-core";
import { MOTIONS_SHOULDERS_CORE } from "./shoulders-core.motions";

/** Library expansion of 2026-11-13, appended after the original 157 exercises. */
export const ADDED_EXERCISES = [...BATCH_CHEST_TRICEPS, ...BATCH_BACK_BICEPS, ...BATCH_SHOULDERS_CORE, ...BATCH_LEGS_MOBILITY];
export const ADDED_MOTIONS = { ...MOTIONS_CHEST_TRICEPS, ...MOTIONS_BACK_BICEPS, ...MOTIONS_SHOULDERS_CORE, ...MOTIONS_LEGS_MOBILITY };
