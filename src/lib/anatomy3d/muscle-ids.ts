/**
 * Muscle regions of the 3D anatomical athlete. Every vertex of the body mesh carries the region it belongs to (and the
 * neighbouring one at muscle borders), so the glow follows each muscle's own shape. Each region exists on both sides
 * (ids are side * REGION_COUNT + region), so one-sided exercises light only the working side.
 */
export const REGIONS = [
  "pecUpper",
  "pecLower",
  "deltAnt",
  "deltLat",
  "deltPost",
  "biceps",
  "brachialis",
  "triceps",
  "forearmFlex",
  "forearmExt",
  "lat",
  "trapUpper",
  "trapMid",
  "rhomboid",
  "rotatorCuff",
  "serratus",
  "obliques",
  "abs",
  "erector",
  "gluteMax",
  "gluteMed",
  "hipFlexor",
  "adductors",
  "rectusFemoris",
  "vastusLat",
  "vastusMed",
  "bicepsFemoris",
  "semitendinosus",
  "gastroc",
  "soleus",
  "tibialis",
  "peroneus",
  "neck",
] as const;

export type Region = (typeof REGIONS)[number];
export const REGION_COUNT = REGIONS.length;
/** Side index: 0 = the athlete's right, 1 = left. */
export type SideIndex = 0 | 1;
export const NO_MUSCLE = 255;

export const regionIndex = (r: Region): number => REGIONS.indexOf(r);
/** Id of a region on one side, as stored on the mesh. */
export const muscleId = (r: Region, side: SideIndex): number => side * REGION_COUNT + regionIndex(r);
export const MUSCLE_ID_COUNT = REGION_COUNT * 2;

/** Plain names shown in the app for each region. */
export const REGION_LABELS: Record<Region, string> = {
  pecUpper: "Upper chest",
  pecLower: "Chest",
  deltAnt: "Front deltoids",
  deltLat: "Side deltoids",
  deltPost: "Rear deltoids",
  biceps: "Biceps",
  brachialis: "Brachialis",
  triceps: "Triceps",
  forearmFlex: "Forearm flexors",
  forearmExt: "Forearm extensors",
  lat: "Lats",
  trapUpper: "Upper traps",
  trapMid: "Mid traps",
  rhomboid: "Rhomboids",
  rotatorCuff: "Rotator cuff",
  serratus: "Serratus",
  obliques: "Obliques",
  abs: "Abdominals",
  erector: "Spinal erectors",
  gluteMax: "Glutes",
  gluteMed: "Glute medius",
  hipFlexor: "Hip flexors",
  adductors: "Adductors",
  rectusFemoris: "Rectus femoris",
  vastusLat: "Outer quadriceps",
  vastusMed: "Inner quadriceps",
  bicepsFemoris: "Outer hamstrings",
  semitendinosus: "Inner hamstrings",
  gastroc: "Calves",
  soleus: "Soleus",
  tibialis: "Tibialis",
  peroneus: "Peroneals",
  neck: "Neck",
};

/**
 * Tissue of a vertex: drives the material. "deep" is the dark fascia layer seen in the gaps between muscles; "cover"
 * is the small smooth anatomical cover over the pelvis.
 */
export const TISSUE = { skin: 0, muscle: 1, bone: 2, tendon: 3, eye: 4, deep: 5, cover: 6 } as const;
export type Tissue = keyof typeof TISSUE;

/** Bones of the rig (skinning), in a fixed order shared by the mesh builder and the player. */
export const BONES = [
  "pelvis",
  "chest",
  "neck",
  "head",
  "clavR",
  "upperArmR",
  "foreArmR",
  "handR",
  "clavL",
  "upperArmL",
  "foreArmL",
  "handL",
  "thighR",
  "shinR",
  "footR",
  "thighL",
  "shinL",
  "footL",
] as const;
export type BoneName = (typeof BONES)[number];
export const boneIndex = (b: BoneName): number => BONES.indexOf(b);

/**
 * Maps a BodyParts3D part name (e.g. "acromial part of right deltoid") to the app's glow region. Parts that return
 * null are kept as plain anatomy without a glow region (face muscles); parts with "drop" are left out of the athlete.
 */
const PART_RULES: [RegExp, Region | "drop" | null][] = [
  [/platysma|orbicularis|zygomaticus|masseter|temporalis|frontalis/, "drop"], // the face and front of the neck use the skin surface
  [/clavicular part of .*pectoralis major/, "pecUpper"],
  [/pectoralis (major|minor)/, "pecLower"],
  [/clavicular part of .*deltoid/, "deltAnt"],
  [/acromial part of .*deltoid/, "deltLat"],
  [/spinal part of .*deltoid/, "deltPost"],
  [/biceps brachii|coracobrachialis/, "biceps"],
  [/brachialis/, "brachialis"],
  [/triceps brachii|anconeus/, "triceps"],
  [/brachioradialis|flexor carpi|flexor digitorum superficialis|pronator teres|palmaris/, "forearmFlex"],
  [/extensor carpi|extensor digitorum$|extensor digiti minimi|abductor pollicis longus|extensor pollicis/, "forearmExt"],
  [/latissimus dorsi|teres major/, "lat"],
  [/descending part of .*trapezius/, "trapUpper"],
  [/trapezius/, "trapMid"],
  [/rhomboid/, "rhomboid"],
  [/infraspinatus|supraspinatus|teres minor|subscapularis/, "rotatorCuff"],
  [/serratus anterior/, "serratus"],
  [/oblique$/, "obliques"],
  [/rectus abdominis/, "abs"],
  [/iliocostalis|longissimus thoracis|spinalis thoracis/, "erector"],
  [/gluteus maximus/, "gluteMax"],
  [/gluteus (medius|minimus)|tensor fasciae latae/, "gluteMed"],
  [/iliacus|psoas|sartorius/, "hipFlexor"],
  [/adductor (brevis|longus|magnus|minimus)|gracilis|pectineus/, "adductors"],
  [/rectus femoris/, "rectusFemoris"],
  [/vastus (lateralis|intermedius)/, "vastusLat"],
  [/vastus medialis/, "vastusMed"],
  [/biceps femoris/, "bicepsFemoris"],
  [/semitendinosus|semimembranosus/, "semitendinosus"],
  [/gastrocnemius|plantaris/, "gastroc"],
  [/soleus|flexor digitorum longus/, "soleus"],
  [/tibialis anterior|extensor digitorum longus|extensor hallucis longus/, "tibialis"],
  [/fibularis/, "peroneus"],
  [/sternocleidomastoid|splenius|levator scapulae|semispinalis capitis/, "neck"],
];

export function regionOf(name: string): Region | "drop" | null {
  for (const [re, r] of PART_RULES) if (re.test(name)) return r;
  return null;
}

/** 0 = the athlete's right, 1 = left, matching muscleId(). */
export const sideOf = (name: string): 0 | 1 => (/\bleft\b/.test(name) ? 1 : 0);
