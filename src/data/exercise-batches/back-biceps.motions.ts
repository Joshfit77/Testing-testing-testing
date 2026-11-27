import { armIsolation, latPulldown, pullUp, row } from "../../lib/exercise-motion/patterns/upper";
import type { MotionDef, PropDef, Vec } from "../../lib/exercise-motion/types";

const S = "Side view. ";

/**
 * The body motion is always the pattern's own. Where an exercise moves exactly like a pattern but holds a different
 * implement (a barbell or a cable instead of dumbbells, dumbbells instead of a barbell), only the drawn equipment is
 * swapped: the joints, timing and hand path are untouched.
 */
const withProps = (def: MotionDef, props: PropDef[]): MotionDef => ({ ...def, props });

/** Light curl bar: plates of about 5–10 kg (radius in cm), held in both hands. */
const curlBar: PropDef = { id: "bar", kind: "barbell", at: { lm: "hands" }, layer: "front", size: 14 };

/** Low pulley in front of a lifter standing for a curl (the standing curl's hands hang over mid-foot, about 86 cm up). */
const LOW_PULLEY: Vec = [55, 10];
const lowCable: PropDef[] = [
  { id: "tower", kind: "cableTower", at: [LOW_PULLEY[0] + 12, 0], h: 200, layer: "back" },
  { id: "cable", kind: "cable", at: LOW_PULLEY, to: { lm: "hands" }, layer: "near" },
];

/** Neutral-grip dumbbells, one per hand, turning with the forearms. */
const neutralDumbbells: PropDef[] = [
  { id: "dbL", kind: "dumbbell", at: { lm: "handL" }, orient: "profile", follow: "handL", layer: "far" },
  { id: "dbR", kind: "dumbbell", at: { lm: "handR" }, orient: "profile", follow: "handR", layer: "front" },
];

/** A band anchored under the feet, ends in the hands (as the band curl draws it). */
const bandUnderFeet: PropDef = { id: "band", kind: "band", at: { lm: "soleR", dx: 2, dy: 1 }, to: { lm: "hands" }, layer: "near" };

/** Standing row toward a chest-height cable instead of a band on the wall: the same anchor point, with a cable stack. */
function standingCableRow(id: string, label: string): MotionDef {
  const def = row({ id, kind: "band", label });
  const anchor = def.props?.find((p) => p.id === "band")?.at as Vec;
  return withProps(def, [
    { id: "tower", kind: "cableTower", at: [anchor[0] + 12, 0], h: anchor[1] + 30, layer: "back" },
    { id: "cable", kind: "cable", at: anchor, to: { lm: "hands" }, layer: "near" },
  ]);
}

/** Hand-tuned 2D motions for the exercises in ./back-biceps.ts, built from the shared movement patterns. */
export const MOTIONS_BACK_BICEPS: Record<string, (id: string) => MotionDef> = {
  // ------------------------------------------------------------------ Back
  "wide-grip-pull-up": (id) =>
    pullUp({
      id,
      grip: "overhand",
      label: `${S}Hanging from the bar with a wide overhand grip (the width runs across the picture): pulls the chin over the bar, the elbows sweeping down and out to the sides, then lowers to straight arms.`,
    }),
  "band-assisted-chin-up": (id) =>
    pullUp({
      id,
      grip: "underhand",
      band: true,
      label: `${S}Underhand grip, one knee in a band looped over the bar for assistance: pulls up until the chin clears the bar, the elbows driving down in front of the body, then lowers to straight arms.`,
    }),
  "wide-grip-lat-pulldown": (id) =>
    latPulldown(id, `${S}Seated with the thighs under the pad and the hands out on the angled ends of the lat bar: pulls the bar down to the upper chest with a slight lean back, then lets it rise to straight arms.`),
  "dumbbell-bent-over-row": (id) =>
    withProps(
      row({ id, kind: "barbell", label: `${S}Hinged forward with a flat back and soft knees, a dumbbell in each hand with palms facing in: rows both dumbbells to the lower ribs and lowers them to arm's length.` }),
      neutralDumbbells,
    ),
  "reverse-grip-barbell-row": (id) =>
    row({ id, kind: "barbell", label: `${S}Hinged forward with a flat back, underhand grip on the bar: rows it to the lower ribs with the elbows close to the sides, then lowers it to arm's length.` }),
  "bent-over-band-row": (id) =>
    withProps(row({ id, kind: "barbell", label: `${S}Standing on the middle of a band, hinged forward with a flat back: rows the band's ends to the lower ribs as it stretches, then lowers them to arm's length.` }), [
      bandUnderFeet,
    ]),
  "standing-cable-row": (id) =>
    standingCableRow(id, `${S}Standing tall facing a cable set at chest height: rows the handle to the ribs, squeezing the shoulder blades, then lets the arms reach forward again.`),
  "reverse-grip-inverted-row": (id) =>
    row({ id, kind: "inverted", label: `${S}Hanging under a bar in a rack with an underhand grip, heels on the floor and body straight: pulls the chest to the bar and lowers to straight arms.` }),

  // ------------------------------------------------------------------ Biceps
  "barbell-curl": (id) =>
    withProps(armIsolation({ id, kind: "curl", label: `${S}Standing tall with an underhand grip and the elbows by the sides: curls the barbell up toward the shoulders and lowers it slowly to straight arms.` }), [curlBar]),
  "ez-bar-curl": (id) =>
    withProps(armIsolation({ id, kind: "curl", label: `${S}Standing tall, hands on the angled grips of an EZ bar and elbows by the sides: curls the bar up toward the shoulders and lowers it slowly.` }), [curlBar]),
  "cable-curl": (id) =>
    withProps(
      armIsolation({ id, kind: "curl", label: `${S}Standing facing a low pulley with the elbows by the sides: curls the cable handle up toward the shoulders and lowers it slowly against the cable's pull.` }),
      lowCable,
    ),
  "band-curl": (id) =>
    armIsolation({ id, kind: "band-curl", label: `${S}Standing on a band with the elbows by the sides: curls its ends up toward the shoulders as it stretches, and lowers them slowly.` }),
  "zottman-curl": (id) =>
    armIsolation({
      id,
      kind: "curl",
      label: `${S}Elbows by the sides: curls the dumbbells up palms-up, then lowers them slowly palms-down (from the side the dumbbells look the same both ways; the forearms turn at the top).`,
    }),
  "reverse-grip-curl": (id) =>
    withProps(armIsolation({ id, kind: "curl", label: `${S}Overhand (palms-down) grip on a barbell, elbows by the sides: curls the bar up toward the shoulders and lowers it slowly.` }), [curlBar]),
  "cable-rope-hammer-curl": (id) =>
    withProps(
      armIsolation({ id, kind: "hammer", label: `${S}Standing facing a low pulley, a rope held thumbs-up and the elbows by the sides: curls the rope toward the shoulders and lowers it slowly.` }),
      lowCable,
    ),
  "incline-hammer-curl": (id) => {
    const def = armIsolation({
      id,
      kind: "incline-curl",
      label: `${S}Leaning back on an incline bench with the arms hanging behind the body, palms facing in: curls the dumbbells up with the thumbs leading and lowers them to a full stretch.`,
    });
    return withProps(def, [...(def.props ?? []).filter((p) => p.kind !== "dumbbell"), ...neutralDumbbells]);
  },
};
