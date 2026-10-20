/**
 * Types for the animated exercise demonstrations.
 *
 * Conventions (all angles in degrees, lengths in "cm" of a ~180 cm figure, world y is up, floor is y = 0):
 *
 * Side view (sagittal plane): the figure faces +x. "R" limbs are the near side (drawn in front, brighter),
 * "L" limbs the far side (drawn behind, darker).
 *  - trunk:  lean of the pelvis→mid-back segment from vertical, + = forward. Prone = 90, supine = -90.
 *  - spine:  flexion of the upper back relative to the lower back, + = rounding forward, - = arching.
 *  - neck:   head relative to the upper back, + = chin to chest.
 *  - hip:    hip flexion relative to the lower back, + = thigh forward / up. 0 = standing.
 *  - knee:   knee flexion, >= 0.
 *  - ankle:  dorsiflexion relative to a foot that is square to the shin, + = shin over toes, - = pointing the toes.
 *  - sh:     shoulder flexion relative to the upper back, 0 = arm along the body, 90 = forward, 180 = overhead,
 *            - = extension (arm behind the body).
 *  - el:     elbow flexion, >= 0.
 *
 * Front (frontal) view: the figure faces the viewer. "L" (the figure's left) is drawn on screen right.
 *  - trunk / spine: lateral lean, + = toward screen right.
 *  - sh: shoulder abduction (0 = at the side, 90 = out to the side, 180 = overhead).  el: elbow bend in that plane.
 *  - hip: hip abduction.  knee: knee bend (drawn by foreshortening the thigh / shin).  ankle: shin tilt from the knee.
 *
 * Depth fields foreshorten a segment that points toward / away from the viewer (0 = in the picture plane).
 */
export interface Pose {
  trunk: number;
  spine: number;
  neck: number;
  hipL: number;
  hipR: number;
  kneeL: number;
  kneeR: number;
  ankleL: number;
  ankleR: number;
  shL: number;
  shR: number;
  elL: number;
  elR: number;
  /** Upper-arm foreshortening (degrees out of the picture plane). */
  armDL: number;
  armDR: number;
  /** Forearm foreshortening. */
  foreDL: number;
  foreDR: number;
  /** Thigh foreshortening. */
  legDL: number;
  legDR: number;
  /** Shin foreshortening (front view). */
  shinDL: number;
  shinDR: number;
}

export type PoseKey = keyof Pose;

export type View = "side" | "front";

export type Vec = [number, number];

export type Side = "L" | "R";

/** Named points on the figure that roots, IK targets and equipment can refer to. */
export type Landmark =
  | "pelvis"
  | "mid"
  | "neckBase"
  | "shoulder"
  | "shoulderL"
  | "shoulderR"
  | "head"
  | "headTop"
  | "hipL"
  | "hipR"
  | "kneeL"
  | "kneeR"
  | "kneeCapL"
  | "kneeCapR"
  | "ankleL"
  | "ankleR"
  | "heelL"
  | "heelR"
  | "ballL"
  | "ballR"
  | "toeL"
  | "toeR"
  | "soleL"
  | "soleR"
  | "elbowL"
  | "elbowR"
  | "handL"
  | "handR"
  | "hands"
  | "trap"
  | "rack"
  | "chest"
  | "belly"
  | "hipCrease"
  | "upperBack"
  | "lowBack"
  | "butt"
  | "forearmL"
  | "forearmR"
  | "elbowPadL"
  | "elbowPadR"
  | "shinL"
  | "shinR"
  | "thighL"
  | "thighR"
  | "foreheadFront"
  | "headBack"
  | "waist";

/** A point: fixed world coordinates, or a landmark of the current frame plus an offset. */
export type Anchor = Vec | { lm: Landmark; dx?: number; dy?: number; /** Absolute height (overrides the landmark y). */ y?: number };

/** How the whole figure is placed in the world for a keyframe. */
export type RootRule =
  /** Translate so that a landmark sits exactly at a world point (feet planted, hands on a bar, back on a bench...). */
  | { pin: Landmark; at: Vec }
  /** Pelvis at world x; lowest body point rests on the floor (raised by `lift` for flight phases). */
  | { ground: number; lift?: number };

export type Ease = "inOut" | "in" | "out" | "linear" | "spline";

export interface Keyframe {
  pose: Pose;
  root: RootRule;
  /** Limbs placed by inverse kinematics (their angles in `pose` are then ignored). */
  ik?: Partial<Record<"handL" | "handR" | "footL" | "footR", Anchor>>;
  /** Per-keyframe positions for movable equipment (e.g. a thrown ball), by prop id. */
  props?: Record<string, Anchor>;
  /** Seconds to travel from this keyframe to the next. */
  dur: number;
  /** Seconds to hold this keyframe before moving on. */
  hold?: number;
  ease?: Ease;
  /** Overall opacity (used to reset travelling movements between loops). */
  alpha?: number;
}

export type PropKind =
  | "barbell"
  | "plate"
  | "dumbbell"
  | "kettlebell"
  | "bench"
  | "inclineBench"
  | "rack"
  | "pullupBar"
  | "dipBars"
  | "cableTower"
  | "cable"
  | "band"
  | "box"
  | "chair"
  | "wall"
  | "sled"
  | "sandbag"
  | "medball"
  | "yoke"
  | "farmerHandle"
  | "trapBar"
  | "stone"
  | "platform"
  | "log"
  | "keg"
  | "jumpRope"
  | "heavyBag"
  | "battleRope"
  | "rower"
  | "bike"
  | "landmine"
  | "abWheel"
  | "mat"
  | "legPress"
  | "hackSquat"
  | "legExtension"
  | "legCurl"
  | "seatedLegCurl"
  | "chestPress"
  | "latPulldown"
  | "cableRowSeat"
  | "calfMachine"
  | "cone"
  | "ladder"
  | "stairs"
  | "rope"
  | "hurdleLine"
  | "pad"
  | "hyper";

/** Equipment / scenery drawn with the figure. */
export interface PropDef {
  id: string;
  kind: PropKind;
  /** Where it is drawn (keyframes may override via `props`). */
  at: Anchor;
  /** Second point for things that span two points (cables, bands, landmine, ropes). */
  to?: Anchor;
  /** Drawing layer. */
  layer?: "back" | "far" | "mid" | "near" | "front";
  /** Kind-specific size / style parameters. */
  size?: number;
  w?: number;
  h?: number;
  angle?: number;
  /** For dumbbells: "end" = seen end-on (pronated / supinated grip), "profile" = neutral grip seen from the side. */
  orient?: "end" | "profile" | "vertical";
  /** Rotate with the forearm of this hand (dumbbell profile / kettlebell hang). */
  follow?: "handL" | "handR";
  variant?: string;
}

export interface MotionDef {
  /** Exercise slug (or pattern id for fallbacks). */
  id: string;
  view: View;
  keyframes: Keyframe[];
  props?: PropDef[];
  /** World distance travelled per loop (the camera follows; the floor scrolls). */
  travel?: number;
  /** Plain-language description of the movement used as the accessible label. */
  label: string;
  /** Feet that must stay planted (same spot on the floor) throughout the loop. */
  planted?: Side[];
  /** True when at least one foot stays on the floor the whole loop (no jumps / lying / hanging). */
  footGrounded?: boolean;
  /** Phase (0..1 of the loop) shown as the still image for reduced motion / thumbnails. */
  stillPhase?: number;
  /** Mirror horizontally (face left). */
  mirror?: boolean;
  /** Floor style. */
  floor?: "plain" | "mat" | "none";
  /** Joint-limit checks to skip for deliberately stylised poses (documented in the definition). */
  allowLimits?: PoseKey[];
}

/** A fully computed frame. */
export interface Frame {
  view: View;
  pose: Pose;
  pts: Record<Landmark, Vec>;
  props: ResolvedProp[];
  alpha: number;
  cameraX: number;
  /** How far the floor clamp had to raise the whole figure (diagnostic; ~0 for well-authored motions). */
  lifted?: number;
  /** Absolute (screen-plane) segment directions in degrees, down-angle convention. */
  seg: {
    T1: number;
    T2: number;
    head: number;
    thighL: number;
    thighR: number;
    shinL: number;
    shinR: number;
    footL: number;
    footR: number;
    armL: number;
    armR: number;
    foreL: number;
    foreR: number;
  };
}

export interface ResolvedProp {
  def: PropDef;
  at: Vec;
  to?: Vec;
}

/** Minimal exercise info used to choose a pattern-based fallback for slugs without a hand-made motion. */
export interface ExerciseMeta {
  slug: string;
  name?: string;
  pattern?: string;
  category?: string;
  equipment?: readonly string[];
  timed?: boolean;
}
