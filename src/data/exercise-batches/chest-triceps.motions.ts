import type { MotionDef } from "../../lib/exercise-motion/types";
import { benchPress, pushUp } from "../../lib/exercise-motion/patterns/upper";
import { benchDip, declineBenchPress, dumbbellFly, dumbbellKickback, kneePushUp, lyingTricepsExtension } from "../../lib/exercise-motion/patterns/upper-extra";

const S = "Side view. ";

/** Hand-tuned 2D motions for the exercises in ./chest-triceps.ts, built from the shared movement patterns. */
export const MOTIONS_CHEST_TRICEPS: Record<string, (id: string) => MotionDef> = {
  // ------------------------------------------------------------------ Chest
  "incline-barbell-bench-press": (id) =>
    benchPress({ id, incline: 30, label: `${S}Lying on a bench inclined about 30° in front of a rack: lowers the bar to the upper chest over two seconds, touches, and presses it back up over the shoulders.` }),
  "tempo-bench-press": (id) =>
    benchPress({ id, down: 3, holdBottom: 0.3, label: `${S}Lying on a flat bench: lowers the bar slowly to the lower chest over three seconds, touches briefly, and presses it back over the shoulders in about a second.` }),
  "dumbbell-squeeze-press": (id) =>
    benchPress({ id, implement: "dumbbell", grip: "close", label: `${S}Lying on a flat bench with the two dumbbells held together over the chest and the elbows tucked close to the body: lowers them to the middle of the chest and presses them back up.` }),
  "tempo-push-up": (id) =>
    pushUp({ id, down: 3, label: `${S}Body in a straight plank: lowers the chest to just above the floor slowly over three seconds with the elbows travelling back, then pushes up in about a second.` }),
  "dumbbell-fly": (id) =>
    dumbbellFly({ id, label: `${S}Lying on a flat bench, dumbbells together over the chest with palms facing: the arms open out to the sides in a wide arc with a slight, fixed elbow bend until the dumbbells are about level with the chest, then sweep back up to meet.` }),
  "incline-dumbbell-fly": (id) =>
    dumbbellFly({ id, incline: 30, label: `${S}Lying on a bench inclined about 30°, dumbbells together over the upper chest: the arms open out to the sides in a wide arc with a slight, fixed elbow bend until the dumbbells are level with the upper chest, then sweep back up to meet.` }),
  "decline-bench-press": (id) =>
    declineBenchPress({ id, label: `${S}Lying on a decline bench with the head lower than the hips and the ankles hooked under the roller: lowers the bar to the lower chest with the forearms near vertical and presses it back up over the shoulders.` }),
  "decline-dumbbell-press": (id) =>
    declineBenchPress({ id, implement: "dumbbell", label: `${S}Lying on a decline bench with the head lower than the hips and the ankles hooked under the roller: lowers two dumbbells to the sides of the lower chest and presses them back up over the shoulders.` }),
  "knee-push-up": (id) =>
    kneePushUp(id, `${S}Kneeling on a mat with the feet raised behind and the body straight from the knees to the head: lowers the chest to just above the floor with the elbows travelling back, then pushes up to straight arms.`),
  // ------------------------------------------------------------------ Triceps
  "close-grip-push-up": (id) =>
    pushUp({ id, label: `${S}Hands directly under the shoulders and body in a straight plank: lowers the chest to just above the floor with the elbows tucked back along the ribs, then pushes up to straight arms.` }),
  "ez-bar-skull-crusher": (id) =>
    lyingTricepsExtension({ id, implement: "ez-bar", label: `${S}Lying on a flat bench, upper arms held still and tilted slightly back toward the head: bends only the elbows to lower the bar to just above the forehead, then straightens them.` }),
  "dumbbell-lying-triceps-extension": (id) =>
    lyingTricepsExtension({ id, implement: "dumbbell", label: `${S}Lying on a flat bench with a dumbbell in each hand, upper arms held still and tilted back toward the head: bends only the elbows to lower the dumbbells beside the head, then straightens them.` }),
  "dumbbell-kickback": (id) =>
    dumbbellKickback(id, `${S}Hinged forward with soft knees and a flat back, upper arms level with the floor beside the torso: straightens the elbows to push the dumbbells back, pauses, and bends them back to about 90°.`),
  "bench-dip": (id) =>
    benchDip(id, `${S}Hands on the edge of a bench behind the hips, knees bent and feet flat in front: bends the elbows back to lower the hips until the upper arms are near level with the floor, then presses back up to straight arms.`),
};
