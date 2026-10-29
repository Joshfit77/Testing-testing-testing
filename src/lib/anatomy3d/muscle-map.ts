import type { Region } from "./muscle-ids";

/**
 * Which 3D muscle regions light up for an exercise, from the catalogue's own primary and secondary muscle lists.
 * Primary muscles glow at full strength, secondary muscles softer. This is an instructional picture of the muscles
 * the exercise trains, not a measurement of activation.
 */
export interface MuscleTargets {
  /** Glow strength per region, 1 = primary, about 0.45 = secondary. */
  weights: Partial<Record<Region, number>>;
  primary: Region[];
  secondary: Region[];
}

type Weighted = [Region, number][];

/** The catalogue's muscle words, mapped to the athlete's regions (weights shape the glow within a group). */
const VOCAB: Record<string, Weighted> = {
  quadriceps: [["rectusFemoris", 1], ["vastusLat", 1], ["vastusMed", 1]],
  glutes: [["gluteMax", 1], ["gluteMed", 0.7]],
  hamstrings: [["bicepsFemoris", 1], ["semitendinosus", 1]],
  adductors: [["adductors", 1]],
  calves: [["gastroc", 1], ["soleus", 0.85]],
  "calves (soleus)": [["soleus", 1], ["gastroc", 0.5]],
  "calves (gastrocnemius)": [["gastroc", 1], ["soleus", 0.5]],
  chest: [["pecLower", 1], ["pecUpper", 0.85]],
  "upper chest": [["pecUpper", 1], ["pecLower", 0.4]],
  lats: [["lat", 1]],
  "teres major": [["lat", 0.8]],
  "upper back": [["trapMid", 1], ["rhomboid", 1], ["deltPost", 0.6], ["lat", 0.5]],
  traps: [["trapUpper", 1], ["trapMid", 0.7]],
  "upper traps": [["trapUpper", 1]],
  "middle traps": [["trapMid", 1]],
  rhomboids: [["rhomboid", 1]],
  "rotator cuff": [["rotatorCuff", 1]],
  serratus: [["serratus", 1]],
  "front delts": [["deltAnt", 1]],
  "front deltoids": [["deltAnt", 1]],
  "side delts": [["deltLat", 1]],
  "side deltoids": [["deltLat", 1]],
  "rear delts": [["deltPost", 1]],
  "rear deltoids": [["deltPost", 1]],
  biceps: [["biceps", 1], ["brachialis", 0.6]],
  brachialis: [["brachialis", 1], ["biceps", 0.5]],
  triceps: [["triceps", 1]],
  "triceps (long head)": [["triceps", 1]],
  forearms: [["forearmFlex", 1], ["forearmExt", 0.8]],
  grip: [["forearmFlex", 1], ["forearmExt", 0.6]],
  core: [["abs", 1], ["obliques", 0.8]],
  abs: [["abs", 1]],
  abdominals: [["abs", 1], ["obliques", 0.5]],
  obliques: [["obliques", 1], ["abs", 0.3]],
  "spinal erectors": [["erector", 1]],
  "lower back": [["erector", 1]],
  spine: [["erector", 0.8]],
  "thoracic spine": [["erector", 0.7], ["trapMid", 0.5], ["rhomboid", 0.5]],
  "hip flexors": [["hipFlexor", 1], ["rectusFemoris", 0.6]],
  "hip rotators": [["gluteMed", 1], ["gluteMax", 0.4]],
  hips: [["gluteMed", 1], ["gluteMax", 0.6], ["hipFlexor", 0.6]],
  neck: [["neck", 1]],
  ankles: [["tibialis", 1], ["peroneus", 0.8], ["soleus", 0.5]],
  "foot and ankle stabilizers": [["tibialis", 1], ["peroneus", 1]],
  "foot stabilizers": [["tibialis", 0.8], ["peroneus", 0.8]],
  legs: [["rectusFemoris", 1], ["vastusLat", 1], ["vastusMed", 1], ["gluteMax", 0.9], ["bicepsFemoris", 0.8], ["semitendinosus", 0.8], ["gastroc", 0.7]],
  "full body": [
    ["rectusFemoris", 0.9], ["vastusLat", 0.9], ["vastusMed", 0.9], ["gluteMax", 1], ["bicepsFemoris", 0.8], ["semitendinosus", 0.8],
    ["erector", 0.8], ["abs", 0.7], ["lat", 0.7], ["trapUpper", 0.7], ["deltAnt", 0.6], ["deltLat", 0.6], ["gastroc", 0.6], ["forearmFlex", 0.6],
  ],
  // Whole-body systems: no single muscle region; the secondary list says which muscles carry the work.
  "cardiovascular system": [],
  "heart and lungs": [],
};

/** "Shoulders" depends on the movement: presses work the front delts, raises the side delts, pulls the rear delts. */
function shoulders(name: string, pattern: string): Weighted {
  const n = name.toLowerCase();
  if (/lateral raise|side raise|upright row/.test(n)) return [["deltLat", 1], ["trapUpper", 0.5]];
  if (/rear|reverse fly|face pull|pull-apart/.test(n)) return [["deltPost", 1], ["rotatorCuff", 0.6]];
  if (/front raise/.test(n)) return [["deltAnt", 1]];
  if (pattern === "vertical_push") return [["deltAnt", 1], ["deltLat", 0.8]];
  if (pattern === "horizontal_pull" || pattern === "vertical_pull") return [["deltPost", 1], ["rotatorCuff", 0.5]];
  return [["deltAnt", 1], ["deltLat", 0.7], ["deltPost", 0.5]];
}

export function wordToRegions(word: string, name = "", pattern = ""): Weighted {
  const w = word.trim().toLowerCase();
  if (w === "shoulders") return shoulders(name, pattern);
  return VOCAB[w] ?? [];
}

export const SECONDARY_WEIGHT = 0.4;

export function muscleTargets(ex: { name: string; pattern: string; primary: string[]; secondary: string[] }): MuscleTargets {
  const weights: Partial<Record<Region, number>> = {};
  const put = (r: Region, v: number) => {
    weights[r] = Math.max(weights[r] ?? 0, v);
  };
  for (const word of ex.primary) for (const [r, w] of wordToRegions(word, ex.name, ex.pattern)) put(r, w);
  for (const word of ex.secondary) for (const [r, w] of wordToRegions(word, ex.name, ex.pattern)) put(r, w * SECONDARY_WEIGHT);
  const entries = Object.entries(weights) as [Region, number][];
  return {
    weights,
    primary: entries.filter(([, v]) => v > SECONDARY_WEIGHT + 0.01).map(([r]) => r),
    secondary: entries.filter(([, v]) => v <= SECONDARY_WEIGHT + 0.01).map(([r]) => r),
  };
}

/** Every catalogue word this map understands (used by tests to catch new, unmapped words). */
export const KNOWN_WORDS = [...Object.keys(VOCAB), "shoulders"];
