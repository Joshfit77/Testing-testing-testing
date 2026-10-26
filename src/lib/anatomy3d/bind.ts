/**
 * World axes: +X forward (the way the athlete faces), +Y up, +Z the athlete's right, in centimetres.
 * LIMB and HALF are the 2D motion figure's proportions (src/lib/exercise-motion/skeleton.ts BODY), used to recover
 * depth from the keyframed motions; the mesh's own rest pose is BIND.
 */
import { MEASURED_BIND } from "./athlete-bind.generated";

export type V3 = [number, number, number];

export const LIMB = { upperArm: 32, forearm: 31, thigh: 45, shin: 44, lumbar: 25, thorax: 31.5, neck: 9, headR: 11, ankleH: 7.5 } as const;
export const HALF = { hip: 9, shoulder: 18 } as const;

/** The 3D athlete's own rest pose, measured from its skeleton (see scripts/anatomy/build-athlete.mts). */
export const BIND = MEASURED_BIND;
export type BindJoints = typeof BIND;
