import type { MotionDef } from "../../lib/exercise-motion/types";
import { coreMove } from "../../lib/exercise-motion/patterns/core";
import { overheadPress, pushUp } from "../../lib/exercise-motion/patterns/upper";
import { frontRaise, hangingLegRaise, hollowHold, inclineYRaise, reverseCrunch, vUp } from "../../lib/exercise-motion/patterns/shoulders-core-extra";

const S = "Side view. ";

/** Hand-tuned 2D motions for the exercises in ./shoulders-core.ts, built from the shared movement patterns. */
export const MOTIONS_SHOULDERS_CORE: Record<string, (id: string) => MotionDef> = {
  // ------------------------------------------------------------------ Shoulders
  "standing-dumbbell-shoulder-press": (id) =>
    overheadPress({ id, implement: "dumbbell", label: `${S}Standing tall with feet planted, a dumbbell in each hand at the shoulders: presses both straight up past the face to straight arms overhead, then lowers them back to the shoulders.` }),
  "seated-barbell-shoulder-press": (id) =>
    overheadPress({ id, seated: true, label: `${S}Seated on an upright bench with the back against the pad and feet flat: presses the barbell from the front of the shoulders straight up past the face to lockout, then lowers it.` }),
  "single-arm-dumbbell-shoulder-press": (id) =>
    overheadPress({ id, implement: "dumbbell", oneArm: true, label: `${S}Standing tall with the free hand on the hip: presses one dumbbell from the shoulder straight up to a straight arm overhead, then lowers it.` }),
  "seated-single-arm-dumbbell-shoulder-press": (id) =>
    overheadPress({ id, implement: "dumbbell", oneArm: true, seated: true, label: `${S}Seated on an upright bench with the free hand on the hip: presses one dumbbell from the shoulder to a straight arm overhead and lowers it.` }),
  "kettlebell-overhead-press": (id) =>
    overheadPress({ id, implement: "kettlebell", oneArm: true, label: `${S}Standing tall with the free hand on the hip: presses one kettlebell from the rack at the shoulder straight up to a straight arm overhead, then lowers it back to the rack.` }),
  "dumbbell-push-press": (id) =>
    overheadPress({ id, implement: "dumbbell", drive: true, label: `${S}Dumbbells at the shoulders: a short dip at the knees, then the legs drive up and the arms finish pressing both dumbbells to lockout overhead; they are lowered back to the shoulders.` }),
  "strict-log-press": (id) =>
    overheadPress({ id, implement: "log", label: `${S}Log resting on the upper chest with the knees straight: presses it up past the face to lockout overhead with no leg drive, then lowers it to the chest.` }),
  "dumbbell-front-raise": (id) =>
    frontRaise(id, `${S}Standing tall, dumbbells in front of the thighs: raises both arms forward with soft elbows to shoulder height, pauses, and lowers them slowly.`),
  "incline-y-raise": (id) =>
    inclineYRaise(id, `${S}Lying face down on an incline bench with the feet on the floor and light dumbbells hanging under the shoulders: raises the straight arms forward and up until they are in line with the torso, pauses, and lowers them.`),
  // ------------------------------------------------------------------ Core
  crunch: (id) =>
    coreMove(id, `${S}Lying on a mat with the knees bent, feet flat and fingertips at the sides of the head: curls the upper back until the shoulder blades lift off the floor, then lowers.`, "crunch"),
  "sit-up": (id) =>
    coreMove(id, `${S}Lying on a mat with the knees bent, feet flat and fingertips at the sides of the head: curls up and keeps rolling until the torso is upright, then rolls back down to the floor.`, "sit-up"),
  "lying-leg-raise": (id) =>
    coreMove(id, `${S}Lying on a mat with the arms by the sides: raises both straight legs from just above the floor until they point at the ceiling, then lowers them slowly.`, "leg-raise"),
  "high-plank": (id) =>
    pushUp({ id, hold: true, label: `${S}Straight-arm plank: hands under the shoulders and toes tucked, holds a straight line from head to heels.` }),
  "incline-plank": (id) =>
    pushUp({ id, hold: true, hands: 45, label: `${S}Hands on a box with straight arms under the shoulders: holds a straight line from head to heels.` }),
  "hollow-body-hold": (id) =>
    hollowHold(id, `${S}Lying on the back with the lower back pressed into the mat: shoulder blades and head curled just off the floor, arms reaching past the ears and straight legs held a little off the floor, breathing steadily.`),
  "reverse-crunch": (id) =>
    reverseCrunch(id, `${S}Lying on the back with arms by the sides and knees bent over the hips: curls the pelvis up off the mat to bring the knees toward the chest while the upper back stays down, then lowers slowly.`),
  "v-up": (id) =>
    vUp(id, `${S}Lying flat with the arms overhead: lifts the torso and the straight legs together into a V balanced on the seat, hands reaching to the shins, then lowers both back to the mat.`),
  "hanging-leg-raise": (id) =>
    hangingLegRaise(id, `${S}Hanging from a bar with straight arms: raises the straight legs together to above hip height, leaning back slightly as the pelvis curls, then lowers them slowly without swinging.`),
};
