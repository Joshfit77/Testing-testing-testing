/**
 * Custom program builder: turns the answers from /train/build into a periodized, week-by-week
 * ProgramSeed. Pure and deterministic — the same input always produces the same program.
 *
 * Loads are calculated from a known (or estimated) 1RM when one is provided and shown in the
 * user's units ("75% · 225 lb"). Without a max, sets are prescribed by RPE.
 */
import type { ProgramDaySeed, ProgramExerciseSeed, ProgramSeed, ProgramWeekSeed, ProgressionModel } from "@/data/programs";
import { STANDARD_COOLDOWN, STANDARD_WARMUP } from "@/data/programs";
import { isExerciseAvailable, type CatalogExercise } from "./program-generator";
import type { Difficulty, Equipment, ExperienceLevel, PrimaryGoal, ProgramType, UnitSystem } from "./types";
import { estimateOneRepMax } from "./strength";
import { kgToLb, lbToKg } from "./units";

// --------------------------------------------------------------------------- Types & config

export const CUSTOM_PROGRAM_TYPES = [
  "strength",
  "powerlifting",
  "bench",
  "deadlift",
  "squat",
  "mma",
  "cardio",
  "bodybuilding",
  "show_prep",
  "strongman",
  "speed",
  "agility",
] as const;
export type CustomProgramType = (typeof CUSTOM_PROGRAM_TYPES)[number];

export const MAIN_LIFTS = ["squat", "bench", "deadlift", "press"] as const;
export type MainLift = (typeof MAIN_LIFTS)[number];

export const MAIN_LIFT_LABELS: Record<MainLift, string> = {
  squat: "Back squat",
  bench: "Bench press",
  deadlift: "Deadlift",
  press: "Overhead press",
};

export const CARDIO_MODALITIES = ["run", "bike", "row", "walk"] as const;
export type CardioModality = (typeof CARDIO_MODALITIES)[number];
export const CARDIO_MODALITY_LABELS: Record<CardioModality, string> = {
  run: "Running",
  bike: "Bike",
  row: "Rower",
  walk: "Walking / stairs",
};

export const SHOW_DIVISIONS = [
  "bodybuilding",
  "classic_physique",
  "mens_physique",
  "womens_physique",
  "figure",
  "bikini",
  "wellness",
] as const;
export type ShowDivision = (typeof SHOW_DIVISIONS)[number];
export const SHOW_DIVISION_LABELS: Record<ShowDivision, string> = {
  bodybuilding: "Bodybuilding",
  classic_physique: "Classic Physique",
  mens_physique: "Men's Physique",
  womens_physique: "Women's Physique",
  figure: "Figure",
  bikini: "Bikini",
  wellness: "Wellness",
};

export interface GoalOption {
  id: string;
  label: string;
  description: string;
  /** The program builds toward a dated event; `weeks` means weeks until the event. */
  event?: boolean;
  /** Finish with a peak and a max test / competition week. */
  peaking?: boolean;
  /** Bias main-lift work toward higher reps and more volume. */
  volume?: boolean;
}

export interface CustomTypeConfig {
  type: CustomProgramType;
  label: string;
  description: string;
  /** Who this style is built for (shown in the type picker). */
  whoFor: string;
  /** What a typical training week looks like. */
  typicalWeek: string;
  category: string;
  programTypes: ProgramType[];
  primaryGoals: PrimaryGoal[];
  goals: GoalOption[];
  days: { min: number; max: number; default: number };
  weeks: { min: number; max: number; default: number };
  /** Label for the weeks field when an event goal is chosen. */
  eventLabel?: string;
  /** Main lifts the "Your numbers" step asks about (all optional). */
  lifts: MainLift[];
  cardioInput: boolean;
  defaultMinutes: number;
}

const LIFT_GOALS = (lift: string): GoalOption[] => [
  { id: "increase_1rm", label: "Increase my 1-rep max", description: `Build up to heavy singles and test a new ${lift} max in the final week.`, peaking: true },
  { id: "volume", label: `Build ${lift} volume & size`, description: "More sets of 5–8 reps to build muscle and work capacity. No max test.", volume: true },
  { id: "meet_prep", label: "Meet prep", description: "Peak for a powerlifting meet. The last week is meet week.", event: true, peaking: true },
];

export const CUSTOM_TYPES: Record<CustomProgramType, CustomTypeConfig> = {
  strength: {
    type: "strength",
    label: "Strength Training",
    description: "Get stronger on the squat, bench, deadlift and press.",
    whoFor: "Anyone who wants to get measurably stronger on the basic barbell lifts, from first-timers to experienced lifters.",
    typicalWeek: "2–5 sessions: each main lift heavy once a week plus a lighter second exposure, rows, pull-ups and core.",
    category: "strength",
    programTypes: ["strength"],
    primaryGoals: ["build_strength"],
    goals: [
      { id: "get_stronger", label: "Get stronger overall", description: "Classic strength work on the big lifts with planned deloads." },
      { id: "strength_size", label: "Strength and muscle", description: "A little more volume and accessory work for size.", volume: true },
      { id: "test_maxes", label: "Build to a max test", description: "Finish with a peak and test new maxes in the final week.", peaking: true },
    ],
    days: { min: 2, max: 5, default: 3 },
    weeks: { min: 4, max: 16, default: 8 },
    lifts: ["squat", "bench", "deadlift", "press"],
    cardioInput: false,
    defaultMinutes: 60,
  },
  powerlifting: {
    type: "powerlifting",
    label: "Powerlifting",
    description: "Squat, bench and deadlift with periodized percentages.",
    whoFor: "Lifters training for a powerlifting meet or a bigger squat, bench and deadlift total.",
    typicalWeek: "3–5 sessions: squat 2×, bench 2–3×, deadlift 1–2× per week at set percentages, building to openers on meet day.",
    category: "powerlifting",
    programTypes: ["powerlifting", "strength"],
    primaryGoals: ["build_strength"],
    goals: [
      { id: "build_total", label: "Build my total", description: "Off-season strength block with waves and deloads." },
      { id: "technique", label: "Technique & consistency", description: "More practice with paused and tempo variations at moderate loads.", volume: true },
      { id: "meet_prep", label: "Meet prep", description: "Peak for a meet. The last week is meet week.", event: true, peaking: true },
    ],
    days: { min: 3, max: 5, default: 4 },
    weeks: { min: 6, max: 16, default: 12 },
    eventLabel: "Weeks until your meet",
    lifts: ["squat", "bench", "deadlift"],
    cardioInput: false,
    defaultMinutes: 75,
  },
  bench: {
    type: "bench",
    label: "Bench Press Only",
    description: "Bench press specialization — press three or more times a week.",
    whoFor: "Bench-only competitors and lifters whose press is lagging.",
    typicalWeek: "Heavy, volume and paused/lockout bench days with upper-back and triceps work; legs kept strong on 1–2 days.",
    category: "bench-press",
    programTypes: ["powerlifting", "strength"],
    primaryGoals: ["build_strength"],
    goals: LIFT_GOALS("bench"),
    days: { min: 3, max: 5, default: 4 },
    weeks: { min: 6, max: 12, default: 8 },
    eventLabel: "Weeks until your meet",
    lifts: ["bench"],
    cardioInput: false,
    defaultMinutes: 60,
  },
  deadlift: {
    type: "deadlift",
    label: "Deadlift",
    description: "Deadlift specialization with variations and posterior-chain work.",
    whoFor: "Lifters chasing a bigger pull, including deadlift-only meets.",
    typicalWeek: "One heavy pull, one deficit or block-pull day, squats for leg drive and hamstring/lat/grip work.",
    category: "deadlift-specialization",
    programTypes: ["powerlifting", "strength"],
    primaryGoals: ["build_strength"],
    goals: LIFT_GOALS("deadlift"),
    days: { min: 3, max: 5, default: 3 },
    weeks: { min: 6, max: 12, default: 8 },
    eventLabel: "Weeks until your meet",
    lifts: ["deadlift", "squat"],
    cardioInput: false,
    defaultMinutes: 60,
  },
  squat: {
    type: "squat",
    label: "Squat Only",
    description: "Squat specialization — heavy, paused and tempo squats.",
    whoFor: "Lifters bringing up a lagging squat.",
    typicalWeek: "Squat 2–3× per week: heavy, paused and tempo/box variations, plus upper-body maintenance.",
    category: "squat-specialization",
    programTypes: ["powerlifting", "strength"],
    primaryGoals: ["build_strength"],
    goals: LIFT_GOALS("squat"),
    days: { min: 3, max: 5, default: 4 },
    weeks: { min: 6, max: 12, default: 8 },
    eventLabel: "Weeks until your meet",
    lifts: ["squat"],
    cardioInput: false,
    defaultMinutes: 60,
  },
  mma: {
    type: "mma",
    label: "MMA Training",
    description: "Strength, power and fight-specific conditioning that fits around skills training.",
    whoFor: "MMA fighters, boxers, kickboxers and grapplers who already do skills and sparring sessions.",
    typicalWeek: "2–3 low-soreness S&C sessions around your skills training — max strength, power, alactic sprints, glycolytic intervals and 5-minute rounds — plus optional recovery days.",
    category: "mma-conditioning",
    programTypes: ["mma", "athletic"],
    primaryGoals: ["combat_sports", "improve_conditioning"],
    goals: [
      { id: "fight_camp", label: "I have a fight date", description: "Fight camp: strength and aerobic base first, then power and fight-pace rounds, tapering into fight week.", event: true, peaking: true },
      { id: "fight_shape", label: "General fight shape", description: "Year-round strength, power and conditioning that leaves you fresh for skills and sparring." },
      { id: "strength_power", label: "Strength & power focus", description: "Off-season emphasis: more max-strength and power work, a little less conditioning." },
    ],
    days: { min: 2, max: 5, default: 3 },
    weeks: { min: 4, max: 12, default: 8 },
    eventLabel: "Weeks until your fight",
    lifts: [],
    cardioInput: false,
    defaultMinutes: 60,
  },
  cardio: {
    type: "cardio",
    label: "Cardiovascular",
    description: "Build your aerobic engine with zone 2, intervals and run/walk.",
    whoFor: "New runners, people building endurance, and anyone using cardio for heart health or fat loss.",
    typicalWeek: "Mostly easy zone 2 sessions, one interval day and one longer session (about 80% easy, 20% hard).",
    category: "cardiovascular",
    programTypes: ["cardio"],
    primaryGoals: ["improve_conditioning", "general_health"],
    goals: [
      { id: "first_5k", label: "Run my first 5K", description: "Run/walk progression to 30 minutes of continuous running.", peaking: true },
      { id: "endurance", label: "Improve endurance", description: "Zone 2 base, a weekly interval session and a growing long session." },
      { id: "fat_loss", label: "Fat loss", description: "Consistent zone 2 and intervals plus short strength circuits to keep muscle." },
    ],
    days: { min: 3, max: 6, default: 4 },
    weeks: { min: 4, max: 16, default: 8 },
    lifts: [],
    cardioInput: true,
    defaultMinutes: 40,
  },
  bodybuilding: {
    type: "bodybuilding",
    label: "Bodybuilding",
    description: "Proven hypertrophy splits with progressive, experience-scaled volume.",
    whoFor: "Anyone training to build muscle — recreational lifters through competitive bodybuilders.",
    typicalWeek: "Full-body, upper/lower, push/pull/legs or a classic body-part split with 10–20 hard sets per muscle per week, taken close to failure.",
    category: "hypertrophy",
    programTypes: ["hypertrophy"],
    primaryGoals: ["build_muscle"],
    goals: [
      { id: "mass", label: "Maximum muscle gain", description: "Balanced splits (full body, upper/lower or push/pull/legs) with weekly sets per muscle rising through each block." },
      { id: "recomp", label: "Build muscle & get leaner", description: "Hypertrophy training plus low-intensity cardio finishers and a daily step target." },
      { id: "upper_emphasis", label: "Bring up my upper body", description: "Specialization: extra sets for chest, back and shoulders; legs held at maintenance volume." },
      { id: "lower_emphasis", label: "Bring up legs & glutes", description: "Specialization: extra sets for quads, hamstrings and glutes; upper body held at maintenance volume." },
      { id: "body_part_split", label: "Classic body-part split", description: "The traditional pro layout — chest, back, shoulders, legs and arms on their own days. Best with 4–6 days and some experience." },
    ],
    days: { min: 3, max: 6, default: 4 },
    weeks: { min: 4, max: 16, default: 8 },
    lifts: [],
    cardioInput: false,
    defaultMinutes: 60,
  },
  show_prep: {
    type: "show_prep",
    label: "Show Prep",
    description: "Get stage-ready: hypertrophy, conditioning and posing practice.",
    whoFor: "Bodybuilding, physique, figure, bikini and wellness competitors preparing for a show with a coach.",
    typicalWeek: "4–6 hypertrophy sessions to keep muscle in a deficit, low-intensity cardio and daily steps, and posing practice every session.",
    category: "show-prep",
    programTypes: ["hypertrophy", "cardio"],
    primaryGoals: ["build_muscle", "lose_fat"],
    goals: [
      { id: "first_show", label: "My first show", description: "A conservative build of conditioning with plenty of posing practice.", event: true, peaking: true },
      { id: "improve_placing", label: "Improve my placing", description: "Higher volume and conditioning for experienced competitors.", event: true, peaking: true },
    ],
    days: { min: 4, max: 6, default: 5 },
    weeks: { min: 8, max: 24, default: 16 },
    eventLabel: "Weeks until your show",
    lifts: [],
    cardioInput: false,
    defaultMinutes: 75,
  },
  strongman: {
    type: "strongman",
    label: "Strongman",
    description: "Max-effort pressing and pulling, moving events and odd objects.",
    whoFor: "Strongman competitors and lifters who want brute, real-world strength — with or without strongman implements.",
    typicalWeek: "Max-effort overhead (log/axle) and deadlift days, a squat day, and 1–2 event days with yoke, farmer's, stones and drags by distance.",
    category: "strongman",
    programTypes: ["strongman", "strength"],
    primaryGoals: ["build_strength", "athletic_performance"],
    goals: [
      { id: "get_strongman_strong", label: "Get strongman strong", description: "Build the base: max-effort static lifts plus weekly event training." },
      { id: "contest_prep", label: "Contest prep", description: "Peak for a contest: event rehearsals at contest weights, then light openers in contest week.", event: true, peaking: true },
    ],
    days: { min: 3, max: 5, default: 4 },
    weeks: { min: 4, max: 16, default: 8 },
    eventLabel: "Weeks until your contest",
    lifts: ["deadlift", "press", "squat"],
    cardioInput: false,
    defaultMinutes: 75,
  },
  speed: {
    type: "speed",
    label: "Speed",
    description: "Sprint mechanics, acceleration, top speed and plyometrics.",
    whoFor: "Field- and court-sport athletes and anyone who wants to sprint faster.",
    typicalWeek: "Acceleration and max-velocity sprint days with full rest, plyometrics and one strength/power day.",
    category: "speed",
    programTypes: ["athletic"],
    primaryGoals: ["athletic_performance"],
    goals: [
      { id: "acceleration", label: "Faster first steps", description: "Emphasis on the first 10–20 m and starts." },
      { id: "top_speed", label: "Higher top speed", description: "More flying sprints and elastic plyometrics." },
      { id: "sport_speed", label: "All-round sport speed", description: "A balance of acceleration, max velocity and strength." },
    ],
    days: { min: 2, max: 4, default: 3 },
    weeks: { min: 4, max: 12, default: 6 },
    lifts: [],
    cardioInput: false,
    defaultMinutes: 50,
  },
  agility: {
    type: "agility",
    label: "Agility",
    description: "Footwork, cutting, change of direction and reactive drills.",
    whoFor: "Court, field and combat athletes who need to brake, cut and react faster.",
    typicalWeek: "Footwork and deceleration, planned cone drills, reactive partner drills and single-leg strength.",
    category: "agility",
    programTypes: ["athletic"],
    primaryGoals: ["athletic_performance"],
    goals: [
      { id: "change_of_direction", label: "Sharper cuts", description: "Deceleration and re-acceleration through planned drills." },
      { id: "reactive", label: "React faster", description: "More partner and cue-based reactive drills for sport." },
      { id: "footwork", label: "Quicker feet", description: "Ladder, rhythm and plyometric footwork." },
    ],
    days: { min: 2, max: 4, default: 3 },
    weeks: { min: 4, max: 12, default: 6 },
    lifts: [],
    cardioInput: false,
    defaultMinutes: 45,
  },
};

export function goalOption(type: CustomProgramType, goal: string): GoalOption | undefined {
  return CUSTOM_TYPES[type].goals.find((g) => g.id === goal);
}

/** Allowed program length for a type and goal (event goals use the event window). */
export function weeksRange(type: CustomProgramType, goal: string): { min: number; max: number; default: number } {
  const cfg = CUSTOM_TYPES[type];
  const g = goalOption(type, goal);
  if (g?.event) {
    if (type === "mma") return { min: 4, max: 12, default: 8 };
    if (type === "show_prep") return { min: 8, max: 24, default: 16 };
    return { min: Math.max(6, cfg.weeks.min), max: 16, default: Math.min(16, Math.max(cfg.weeks.default, 8)) };
  }
  return cfg.weeks;
}

export interface CustomProgramInput {
  type: CustomProgramType;
  goal: string;
  experience: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  weeks: number;
  units: UnitSystem;
  age: number;
  heightCm: number;
  bodyweightKg: number;
  /** Known or estimated one-rep maxes, in kilograms. */
  maxesKg: Partial<Record<MainLift, number>>;
  /** Optional goal maxes, in kilograms. */
  goalMaxesKg?: Partial<Record<MainLift, number>>;
  cardio?: { modality: CardioModality; continuousMinutes: number } | null;
  division?: ShowDivision | null;
  equipment: Equipment[];
}

// --------------------------------------------------------------------------- Loads

const BAR_KG = 20;
const BAR_LB = 45;

/** Round a load to the nearest 5 lb (imperial) or 2.5 kg (metric). Never below an empty bar. */
export function roundLoad(kg: number, units: UnitSystem, minimumBar = true): number {
  if (units === "imperial") {
    const lb = Math.round(kgToLb(kg) / 5) * 5;
    return minimumBar ? Math.max(BAR_LB, lb) : lb;
  }
  const v = Math.round(kg / 2.5) * 2.5;
  return minimumBar ? Math.max(BAR_KG, v) : v;
}

export function formatLoad(kg: number, units: UnitSystem): string {
  return `${roundLoad(kg, units)} ${units === "imperial" ? "lb" : "kg"}`;
}

/** "75% · 225 lb" */
export function percentIntensity(oneRmKg: number, pct: number, units: UnitSystem): string {
  return `${pct}% · ${formatLoad((oneRmKg * pct) / 100, units)}`;
}

/** Convert a rounded display load back to kilograms (for tests and displays). */
export function displayLoadToKg(value: number, units: UnitSystem): number {
  return units === "imperial" ? lbToKg(value) : value;
}

/** Barbell exercises whose loads can be prescribed as a percentage of each main lift's 1RM. */
const LIFT_FAMILY: Record<MainLift, string[]> = {
  squat: ["back-squat", "pause-squat", "tempo-squat", "box-squat"],
  bench: ["bench-press", "paused-bench-press", "close-grip-bench-press", "pin-press"],
  deadlift: ["conventional-deadlift", "sumo-deadlift", "deficit-deadlift", "block-pull"],
  press: ["overhead-press", "push-press", "log-press"],
};

// --------------------------------------------------------------------------- Week planning

export type WeekKind = "base" | "build" | "peak" | "test" | "deload";

export interface WeekPlan {
  kind: WeekKind;
  /** 0-based count of previous weeks with the same kind. */
  k: number;
  weekNumber: number;
  total: number;
}

/**
 * Lay out the block. Loading weeks run in waves of 3 (novices, 50+) or 4 weeks followed by a deload,
 * so a deload lands every 4–5 weeks. Non-peaking programs end with a deload; peaking programs end
 * with a peak week and a test/competition week.
 */
export function planWeeks(total: number, peaking: boolean, run: number): WeekKind[] {
  const kinds: WeekKind[] = [];
  const tail: WeekKind[] = peaking ? (total >= 4 ? ["peak", "test"] : ["test"]) : total >= 3 ? ["deload"] : [];
  const body = total - tail.length;
  let streak = 0;
  for (let w = 1; w <= body; w++) {
    // Don't schedule a mid-block deload in the last two loading weeks: the block already ends with a
    // deload (or a peak + test), so at most run + 2 loading weeks pass between lighter weeks.
    if (streak >= run && w < body - 1) {
      kinds.push("deload");
      streak = 0;
    } else {
      kinds.push("base");
      streak++;
    }
  }
  // Split loading weeks: first half accumulation (base), second half intensification (build).
  const loadingIdx = kinds.map((k, i) => (k === "base" ? i : -1)).filter((i) => i >= 0);
  const half = Math.ceil(loadingIdx.length / 2);
  loadingIdx.forEach((idx, n) => {
    if (n >= half) kinds[idx] = "build";
  });
  return [...kinds, ...tail];
}

function weekPlans(total: number, peaking: boolean, run: number): WeekPlan[] {
  const kinds = planWeeks(total, peaking, run);
  const seen = new Map<WeekKind, number>();
  return kinds.map((kind, i) => {
    const k = seen.get(kind) ?? 0;
    seen.set(kind, k + 1);
    return { kind, k, weekNumber: i + 1, total };
  });
}

// --------------------------------------------------------------------------- Slots & day building

interface Slot {
  options: string[];
  sets: number;
  reps?: string;
  seconds?: number;
  rest: number;
  rpe?: number;
  notes?: string;
  /** Percentage of the lift's 1RM; used when the max is known and a barbell variant is chosen. */
  lift?: MainLift;
  pct?: number;
  /** Main lift: never trimmed, gets warm-up guidance when heavy. */
  main?: boolean;
  /** Keep the option order for novices too (strongman implements are light-able; the event is the point). */
  anyDifficulty?: boolean;
  /**
   * Exercise-specific overrides, used when that exercise is the one chosen — e.g. a yoke run prescribed by
   * distance and a substitute carry with its own note. `null` clears the slot's value.
   */
  per?: Record<string, { reps?: string | null; seconds?: number | null; notes?: string }>;
}

interface Ctx {
  input: CustomProgramInput;
  catalog: Map<string, CatalogExercise>;
  novice: boolean;
  mainSets: number;
  accSets: number;
}

const DIFFICULTY_RANK: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };

function usable(ctx: Ctx, slug: string): boolean {
  const e = ctx.catalog.get(slug);
  return Boolean(e && isExerciseAvailable(e, ctx.input.equipment));
}

function pickSlug(ctx: Ctx, options: string[], used: Set<string>, anyDifficulty = false): string | null {
  const available = options.filter((s) => usable(ctx, s) && !used.has(s));
  if (!available.length) return null;
  if (ctx.novice && !anyDifficulty) {
    const easier = available.find((s) => DIFFICULTY_RANK[ctx.catalog.get(s)!.difficulty] < 2);
    if (easier) return easier;
  }
  return available[0]!;
}

function warmupNote(ctx: Ctx, lift: MainLift | undefined, workingKg: number | null): string {
  if (workingKg && lift) {
    const u = ctx.input.units;
    const steps = [0.5, 0.7, 0.85].map((f) => roundLoad(workingKg * f, u));
    const unit = u === "imperial" ? "lb" : "kg";
    const bar = u === "imperial" ? BAR_LB : BAR_KG;
    return `Warm-up: bar (${bar} ${unit}) × 10, ${steps[0]} × 5, ${steps[1]} × 3, ${steps[2]} × 1–2, then working sets.`;
  }
  return "Warm-up: 3–5 ramp-up sets (bar × 10, then about 50% × 5, 70% × 3, 85% × 1–2 of today's working weight).";
}

function slotToExercise(ctx: Ctx, slot: Slot, slug: string, allowWarmup: boolean): ProgramExerciseSeed {
  const out: ProgramExerciseSeed = { ex: slug, sets: Math.max(1, Math.min(20, slot.sets)), rest: Math.max(0, Math.min(900, slot.rest)) };
  const o = slot.per?.[slug];
  const reps = o && "reps" in o ? o.reps : slot.reps;
  const seconds = o && "seconds" in o ? o.seconds : slot.seconds;
  if (reps) out.reps = reps;
  if (seconds) out.seconds = Math.max(5, Math.min(7200, Math.round(seconds)));
  const max = slot.lift ? ctx.input.maxesKg[slot.lift] : undefined;
  const loadable = Boolean(slot.lift && slot.pct && max && LIFT_FAMILY[slot.lift].includes(slug));
  let workingKg: number | null = null;
  if (loadable) {
    out.intensity = percentIntensity(max!, slot.pct!, ctx.input.units);
    workingKg = (max! * slot.pct!) / 100;
  } else if (slot.rpe) {
    out.rpe = Math.min(10, Math.max(1, slot.rpe));
  }
  const notes: string[] = [];
  if (allowWarmup && slot.main && slot.lift) {
    if ((slot.pct ?? 0) >= 75) notes.push(warmupNote(ctx, slot.lift, workingKg));
    else if (!loadable && (slot.rpe ?? 0) >= 7.5) notes.push(warmupNote(ctx, slot.lift, null));
  }
  const specific = o?.notes;
  if (specific) notes.push(specific);
  else if (slot.notes) notes.push(slot.notes);
  if (notes.length) out.notes = notes.join(" ").slice(0, 500);
  return out;
}

function estimateMinutes(ex: ProgramExerciseSeed): number {
  const work = ex.seconds ?? 40;
  return (ex.sets * (work + ex.rest)) / 60;
}

function buildDay(ctx: Ctx, name: string, focus: string, slots: Slot[], extra?: Partial<ProgramDaySeed>): ProgramDaySeed {
  const used = new Set<string>();
  const chosen: { ex: ProgramExerciseSeed; main: boolean }[] = [];
  for (const slot of slots) {
    const slug = pickSlug(ctx, slot.options, used, slot.anyDifficulty);
    if (!slug) continue;
    used.add(slug);
    // Ramp-up guidance goes on the first heavy lift of the day; later lifts are already warm.
    const firstMain = Boolean(slot.main) && !chosen.some((c) => c.main);
    chosen.push({ ex: slotToExercise(ctx, slot, slug, firstMain), main: Boolean(slot.main) });
  }
  // Fit the session: ~8 minutes of warm-up, then trim accessories from the end.
  const budget = ctx.input.sessionMinutes - 8;
  const total = () => chosen.reduce((s, c) => s + estimateMinutes(c.ex), 0);
  while (total() > budget && chosen.length > 2) {
    let idx = -1;
    for (let i = chosen.length - 1; i >= 0; i--) {
      if (!chosen[i]!.main) {
        idx = i;
        break;
      }
    }
    if (idx < 0) break;
    chosen.splice(idx, 1);
  }
  // Honest estimate: lighter weeks (deload, taper) show shorter sessions.
  const minutes = Math.min(240, Math.max(15, Math.round(total() + 8)));
  return { name, focus, minutes, exercises: chosen.map((c) => c.ex), ...extra };
}

// --------------------------------------------------------------------------- Main-lift schemes

interface Scheme {
  sets: number;
  reps: string;
  pct: number;
  rpe: number;
  rest: number;
  notes?: string;
}

const clampRpe = (n: number, novice: boolean) => Math.min(novice ? 8.5 : 9.5, Math.max(5, Math.round(n * 2) / 2));

/** Week-specific prescription for the heavy day of a main lift. */
function heavyScheme(ctx: Ctx, wk: WeekPlan, volumeBias: boolean, lift: MainLift): Scheme {
  const n = ctx.mainSets;
  const novice = ctx.novice;
  const pull = lift === "deadlift";
  const rest = pull ? 240 : 180;
  switch (wk.kind) {
    case "base": {
      const step = Math.min(wk.k, 4);
      return volumeBias
        ? { sets: n, reps: "8", pct: 65 + 2.5 * step, rpe: clampRpe(6.5 + 0.5 * step, novice), rest: rest - 30 }
        : { sets: n, reps: pull ? "4" : "5", pct: 70 + 2.5 * step, rpe: clampRpe(6.5 + 0.5 * step, novice), rest };
    }
    case "build": {
      const step = Math.min(wk.k, 3);
      return volumeBias
        ? { sets: n, reps: "6", pct: 72.5 + 2.5 * step, rpe: clampRpe(7.5 + 0.5 * step, novice), rest }
        : { sets: n, reps: pull ? "2" : "3", pct: 80 + 2.5 * step, rpe: clampRpe(7.5 + 0.5 * step, novice), rest: rest + 30 };
    }
    case "peak": {
      const max = ctx.input.maxesKg[lift];
      const backoff = max ? `85% (${formatLoad(max * 0.85, ctx.input.units)})` : "about 85%";
      return {
        sets: 1,
        reps: "1",
        pct: novice ? 87.5 : 92.5,
        rpe: clampRpe(8.5, novice),
        rest: 300,
        notes: `Heavy single — then 2 × 2 back-off sets at ${backoff}. Stop if the bar slows down noticeably.`,
      };
    }
    case "test":
      return { sets: 1, reps: "1", pct: 100, rpe: clampRpe(9.5, novice), rest: 300 };
    case "deload":
      return { sets: Math.max(2, n - 2), reps: pull ? "3" : "5", pct: 60, rpe: 5.5, rest: 150, notes: "Deload: move the bar fast and smooth." };
  }
}

function heavySlot(ctx: Ctx, wk: WeekPlan, lift: MainLift, options: string[], volumeBias: boolean): Slot {
  const s = heavyScheme(ctx, wk, volumeBias, lift);
  if (wk.kind === "test") {
    const max = ctx.input.maxesKg[lift];
    const goal = ctx.input.goalMaxesKg?.[lift];
    const u = ctx.input.units;
    const attempts = max
      ? `Attempts: ~92% (${formatLoad(max * 0.92, u)}), ~97% (${formatLoad(max * 0.97, u)}), then ${goal && goal > max ? `your goal of ${formatLoad(goal, u)}` : `100–103% (${formatLoad(max * 1.02, u)})`} if it's there.`
      : "Work up in jumps of 5–10% to a heavy single you're confident in, then one more attempt only if it moved fast.";
    return {
      options,
      sets: 1,
      reps: "1",
      rest: 300,
      lift,
      main: true,
      rpe: s.rpe,
      notes: `Max test: rest 3–5 min between attempts. ${attempts} Use spotters or safeties.`,
    };
  }
  return { options, sets: s.sets, reps: s.reps, rest: s.rest, rpe: s.rpe, lift, pct: s.pct, main: true, notes: s.notes };
}

/** Lighter, higher-rep second exposure for a lift in the same week. */
function volumeSlot(ctx: Ctx, wk: WeekPlan, lift: MainLift, options: string[]): Slot {
  const s = heavyScheme(ctx, wk, true, lift);
  if (wk.kind === "deload") return { options, sets: 2, reps: "5", pct: 55, rpe: 5, rest: 120, lift, main: true };
  if (wk.kind === "peak" || wk.kind === "test") return { options, sets: 2, reps: "3", pct: 70, rpe: 6, rest: 150, lift, main: true, notes: "Light technique sets only." };
  return { options, sets: Math.max(3, s.sets - 1), reps: s.reps, pct: Math.max(55, s.pct - 5), rpe: clampRpe(s.rpe - 0.5, ctx.novice), rest: 150, lift, main: true };
}

/** Variation work (paused, pin, deficit…) at a lower percentage of the competition max. */
function variationSlot(ctx: Ctx, wk: WeekPlan, lift: MainLift, options: string[], note: string): Slot {
  const base = wk.kind === "deload" ? 55 : wk.kind === "build" ? 70 + 2.5 * Math.min(wk.k, 2) : wk.kind === "base" ? 65 + 2.5 * Math.min(wk.k, 3) : 65;
  const sets = wk.kind === "deload" || wk.kind === "peak" || wk.kind === "test" ? 2 : Math.max(3, ctx.mainSets - 1);
  return { options, sets, reps: wk.kind === "build" ? "3" : "4", pct: base, rpe: clampRpe(wk.kind === "deload" ? 5.5 : 7, ctx.novice), rest: 180, lift, main: true, notes: note };
}

/** Accessory volume rises a set in the second half of each loading phase and drops on deload/peak weeks. */
function acc(ctx: Ctx, wk: WeekPlan, options: string[], reps: string, rest = 75, extra: Partial<Slot> = {}): Slot {
  let sets = ctx.accSets;
  if (wk.kind === "build") sets += wk.k >= 1 ? 1 : 0;
  if (wk.kind === "deload" || wk.kind === "test") sets = Math.max(1, sets - 1);
  if (wk.kind === "peak") sets = Math.max(2, sets - 1);
  const rpe = wk.kind === "deload" ? 6 : wk.kind === "build" ? 8 : 7.5;
  return { options, sets, reps, rest, rpe, ...extra };
}

// --------------------------------------------------------------------------- Exercise option lists

const OPT = {
  squat: ["back-squat", "goblet-squat", "leg-press", "bulgarian-split-squat", "bodyweight-squat"],
  bench: ["bench-press", "dumbbell-bench-press", "push-up"],
  deadlift: ["conventional-deadlift", "trap-bar-deadlift", "romanian-deadlift", "kettlebell-swing", "glute-bridge"],
  press: ["overhead-press", "seated-dumbbell-shoulder-press", "landmine-press", "pike-push-up"],
  pausedBench: ["paused-bench-press", "close-grip-bench-press", "dumbbell-bench-press", "push-up"],
  closeGrip: ["close-grip-bench-press", "dumbbell-bench-press", "push-up"],
  pinPress: ["pin-press", "close-grip-bench-press", "dumbbell-bench-press"],
  pauseSquat: ["pause-squat", "goblet-squat", "bulgarian-split-squat"],
  tempoSquat: ["tempo-squat", "goblet-squat", "leg-press"],
  boxSquat: ["box-squat", "goblet-squat", "box-squat-to-chair"],
  deficit: ["deficit-deadlift", "romanian-deadlift", "trap-bar-deadlift", "single-leg-rdl"],
  blockPull: ["block-pull", "trap-bar-deadlift", "romanian-deadlift", "hip-thrust"],
  rdl: ["romanian-deadlift", "single-leg-rdl", "good-morning", "glute-bridge"],
  goodMorning: ["good-morning", "romanian-deadlift", "single-leg-rdl"],
  row: ["barbell-row", "one-arm-dumbbell-row", "seated-cable-row", "inverted-row", "band-row"],
  vPull: ["pull-up", "chin-up", "lat-pulldown", "band-assisted-pull-up", "inverted-row"],
  facePull: ["face-pull", "band-pull-apart", "rear-delt-fly"],
  triceps: ["triceps-pushdown", "overhead-triceps-extension", "dips", "push-up"],
  ohTriceps: ["overhead-triceps-extension", "triceps-pushdown", "dips"],
  biceps: ["dumbbell-curl", "hammer-curl"],
  lateral: ["lateral-raise", "band-pull-apart"],
  rearDelt: ["rear-delt-fly", "face-pull", "band-pull-apart"],
  inclinePress: ["incline-dumbbell-press", "dumbbell-bench-press", "incline-push-up"],
  fly: ["cable-chest-fly", "incline-dumbbell-press", "push-up"],
  dips: ["dips", "close-grip-bench-press", "push-up"],
  splitSquat: ["bulgarian-split-squat", "walking-lunge", "reverse-lunge", "step-up"],
  lunge: ["walking-lunge", "reverse-lunge", "step-up"],
  legPress: ["leg-press", "goblet-squat", "bulgarian-split-squat"],
  legExt: ["leg-extension", "step-up", "reverse-lunge"],
  legCurl: ["leg-curl", "single-leg-rdl", "glute-bridge"],
  hipThrust: ["hip-thrust", "glute-bridge"],
  calf: ["standing-calf-raise"],
  core: ["ab-wheel-rollout", "hanging-knee-raise", "dead-bug", "plank"],
  antiRotation: ["pallof-press", "side-plank", "bird-dog"],
  plank: ["plank", "side-plank", "dead-bug"],
  carry: ["farmers-carry", "suitcase-carry", "sandbag-bear-hug-carry"],
  grip: ["dead-hang", "farmers-carry", "hammer-curl"],
  logPress: ["log-press", "push-press", "overhead-press", "seated-dumbbell-shoulder-press"],
  pushPress: ["push-press", "overhead-press", "landmine-press", "seated-dumbbell-shoulder-press"],
  yoke: ["yoke-carry", "sandbag-bear-hug-carry", "farmers-carry"],
  stone: ["atlas-stone-load", "sandbag-to-shoulder", "kettlebell-swing"],
  sandbag: ["sandbag-to-shoulder", "kettlebell-swing", "medicine-ball-slam"],
  sled: ["sled-push", "bike-intervals", "battle-rope-waves", "burpee"],
  frontSquat: ["front-squat", "goblet-squat", "bulgarian-split-squat"],
  trapBar: ["trap-bar-deadlift", "conventional-deadlift", "kettlebell-swing", "romanian-deadlift"],
  power: ["box-jump", "broad-jump", "medicine-ball-slam"],
  rotational: ["medicine-ball-rotational-throw", "cable-woodchop", "pallof-press"],
  pushUp: ["push-up", "dumbbell-bench-press", "incline-push-up"],
  landmine: ["landmine-press", "push-press", "seated-dumbbell-shoulder-press", "push-up"],
  hipEscape: ["hip-escape", "bear-crawl", "dead-bug"],
  bag: ["heavy-bag-rounds", "shadowboxing"],
  shadow: ["shadowboxing", "jump-rope"],
  sprawl: ["sprawl", "burpee", "step-back-burpee", "mountain-climber"],
  bikeSprint: ["bike-intervals", "rowing-intervals", "battle-rope-waves", "jump-rope", "burpee"],
  aerobic: ["bike-intervals", "rowing-intervals", "zone-2-run", "brisk-walk"],
  mobility: ["worlds-greatest-stretch", "90-90-hip-switch", "thoracic-open-book", "couch-stretch"],
};

// --------------------------------------------------------------------------- Program builders

type DayBuilder = (wk: WeekPlan) => ProgramDaySeed;

function strengthDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const vb = Boolean(goal.volume);
  const d = ctx.input.daysPerWeek;
  const A: DayBuilder = (wk) =>
    buildDay(ctx, d <= 3 ? "Day A — Squat & Bench" : "Lower A — Squat", "Squat and press strength", [
      heavySlot(ctx, wk, "squat", OPT.squat, vb),
      ...(d <= 3 ? [heavySlot(ctx, wk, "bench", OPT.bench, vb)] : [acc(ctx, wk, OPT.rdl, "8", 120)]),
      acc(ctx, wk, OPT.row, "8", 90),
      ...(vb ? [acc(ctx, wk, OPT.splitSquat, "10 per side", 75)] : []),
      acc(ctx, wk, OPT.core, "8-12", 60),
    ]);
  const B: DayBuilder = (wk) =>
    buildDay(ctx, d <= 3 ? "Day B — Deadlift & Press" : "Upper A — Bench", d <= 3 ? "Pull and overhead strength" : "Horizontal press strength", [
      ...(d <= 3 ? [heavySlot(ctx, wk, "deadlift", OPT.deadlift, vb), heavySlot(ctx, wk, "press", OPT.press, vb)] : [heavySlot(ctx, wk, "bench", OPT.bench, vb), acc(ctx, wk, OPT.row, "8", 90)]),
      acc(ctx, wk, OPT.vPull, "6-10", 90),
      ...(d > 3 ? [acc(ctx, wk, OPT.press, "8", 90)] : [acc(ctx, wk, OPT.splitSquat, "8 per side", 75)]),
      ...(vb ? [acc(ctx, wk, OPT.triceps, "12", 60), acc(ctx, wk, OPT.biceps, "12", 60)] : [acc(ctx, wk, OPT.facePull, "15", 60)]),
    ]);
  const C: DayBuilder = (wk) =>
    buildDay(ctx, d <= 3 ? "Day C — Volume" : "Lower B — Deadlift", d <= 3 ? "Second exposures and accessories" : "Hinge strength", [
      ...(d <= 3
        ? [volumeSlot(ctx, wk, "squat", OPT.squat), volumeSlot(ctx, wk, "bench", OPT.closeGrip), acc(ctx, wk, OPT.rdl, "8", 120)]
        : [heavySlot(ctx, wk, "deadlift", OPT.deadlift, vb), volumeSlot(ctx, wk, "squat", OPT.pauseSquat), acc(ctx, wk, OPT.lunge, "10 per side", 75)]),
      acc(ctx, wk, OPT.carry, "", 90, { reps: undefined, seconds: 40, rpe: undefined }),
      acc(ctx, wk, OPT.plank, "", 45, { reps: undefined, seconds: 40, rpe: undefined }),
    ]);
  const D: DayBuilder = (wk) =>
    buildDay(ctx, "Upper B — Press", "Overhead strength and upper back", [
      heavySlot(ctx, wk, "press", OPT.press, vb),
      volumeSlot(ctx, wk, "bench", OPT.closeGrip),
      acc(ctx, wk, OPT.vPull, "6-10", 90),
      acc(ctx, wk, OPT.row, "10", 75),
      acc(ctx, wk, vb ? OPT.lateral : OPT.facePull, "15", 45),
    ]);
  const E: DayBuilder = (wk) =>
    buildDay(ctx, "Conditioning & Accessories", "Work capacity, arms and core", [
      acc(ctx, wk, OPT.sled, "", 60, { seconds: 30, reps: undefined, rpe: undefined, notes: "Hard but repeatable efforts." }),
      acc(ctx, wk, OPT.carry, "", 90, { seconds: 40, reps: undefined, rpe: undefined }),
      acc(ctx, wk, OPT.biceps, "12", 60),
      acc(ctx, wk, OPT.triceps, "12", 60),
      acc(ctx, wk, OPT.antiRotation, "10 per side", 45),
    ]);
  if (d === 2)
    return [
      (wk) =>
        buildDay(ctx, "Day A — Squat & Bench", "Full-body strength", [
          heavySlot(ctx, wk, "squat", OPT.squat, vb),
          heavySlot(ctx, wk, "bench", OPT.bench, vb),
          acc(ctx, wk, OPT.row, "8", 90),
          acc(ctx, wk, OPT.core, "8-12", 60),
        ]),
      (wk) =>
        buildDay(ctx, "Day B — Deadlift & Press", "Full-body strength", [
          heavySlot(ctx, wk, "deadlift", OPT.deadlift, vb),
          heavySlot(ctx, wk, "press", OPT.press, vb),
          acc(ctx, wk, OPT.vPull, "6-10", 90),
          acc(ctx, wk, OPT.splitSquat, "8 per side", 75),
        ]),
    ];
  if (d === 3) return [A, B, C];
  if (d === 4) return [A, B, C, D];
  return [A, B, C, D, E];
}

function powerliftingDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const vb = Boolean(goal.volume);
  const d = ctx.input.daysPerWeek;
  const SQ: DayBuilder = (wk) =>
    buildDay(ctx, "Squat Day", "Competition squat + posterior chain", [
      heavySlot(ctx, wk, "squat", OPT.squat, vb),
      ...(d === 3 ? [volumeSlot(ctx, wk, "bench", OPT.bench)] : [acc(ctx, wk, OPT.rdl, "8", 120)]),
      acc(ctx, wk, OPT.splitSquat, "8 per side", 90),
      acc(ctx, wk, OPT.core, "8-10", 60),
    ]);
  const BP: DayBuilder = (wk) =>
    buildDay(ctx, "Bench Day", "Competition bench + upper back", [
      heavySlot(ctx, wk, "bench", OPT.bench, vb),
      acc(ctx, wk, OPT.row, "8", 120),
      ...(d === 3 ? [variationSlot(ctx, wk, "squat", OPT.pauseSquat, "2-second pause at depth.")] : [acc(ctx, wk, OPT.press, "6-8", 120)]),
      acc(ctx, wk, OPT.facePull, "15", 60),
      acc(ctx, wk, OPT.triceps, "10-12", 60),
    ]);
  const DL: DayBuilder = (wk) =>
    buildDay(ctx, "Deadlift Day", "Competition deadlift + quads", [
      heavySlot(ctx, wk, "deadlift", OPT.deadlift, vb),
      ...(d === 3 ? [variationSlot(ctx, wk, "bench", OPT.pausedBench, "Pause 1–2 s on the chest.")] : [variationSlot(ctx, wk, "squat", OPT.pauseSquat, "2-second pause at depth.")]),
      acc(ctx, wk, OPT.vPull, "8-10", 90),
      acc(ctx, wk, OPT.antiRotation, "10 per side", 45),
    ]);
  const BP2: DayBuilder = (wk) =>
    buildDay(ctx, "Bench Variation Day", "Paused bench, close-grip and upper back", [
      variationSlot(ctx, wk, "bench", OPT.pausedBench, "Pause 1–2 s on the chest — competition style."),
      volumeSlot(ctx, wk, "bench", OPT.closeGrip),
      acc(ctx, wk, OPT.row, "10-12", 75),
      acc(ctx, wk, OPT.dips, "8-12", 75),
    ]);
  const SQ2: DayBuilder = (wk) =>
    buildDay(ctx, "Squat Volume & Pull Variation", "Second squat exposure and deadlift weak points", [
      volumeSlot(ctx, wk, "squat", OPT.tempoSquat),
      variationSlot(ctx, wk, "deadlift", OPT.deficit, "1–2 inch deficit; builds strength off the floor."),
      acc(ctx, wk, OPT.legCurl, "12", 60),
      acc(ctx, wk, OPT.plank, "", 45, { seconds: 40, reps: undefined, rpe: undefined }),
    ]);
  if (d === 3) return [SQ, DL, BP];
  if (d === 4) return [SQ, BP, DL, BP2];
  return [SQ, BP, DL, BP2, SQ2];
}

function benchDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const vb = Boolean(goal.volume);
  const d = ctx.input.daysPerWeek;
  const heavy: DayBuilder = (wk) =>
    buildDay(ctx, "Heavy Bench", "Low-rep competition bench + upper back", [
      heavySlot(ctx, wk, "bench", OPT.bench, vb),
      acc(ctx, wk, OPT.row, "8", 120),
      acc(ctx, wk, OPT.press, "8", 90),
      acc(ctx, wk, OPT.facePull, "15", 60),
    ]);
  const lowerA: DayBuilder = (wk) =>
    buildDay(ctx, d === 3 ? "Lower + Bench Volume" : "Lower Body A", "Keep the legs strong", [
      acc(ctx, wk, OPT.squat, "5", 180, { rpe: wk.kind === "deload" ? 6 : 7 }),
      ...(d === 3 ? [volumeSlot(ctx, wk, "bench", OPT.closeGrip)] : []),
      acc(ctx, wk, OPT.rdl, "8", 120),
      acc(ctx, wk, OPT.core, "8-12", 60),
    ]);
  const volume: DayBuilder = (wk) =>
    buildDay(ctx, "Bench Volume", "Higher-rep bench, close-grip and triceps", [
      volumeSlot(ctx, wk, "bench", OPT.bench),
      variationSlot(ctx, wk, "bench", OPT.closeGrip, "Hands about shoulder width; elbows tucked."),
      acc(ctx, wk, OPT.vPull, "6-10", 90),
      acc(ctx, wk, OPT.triceps, "12", 60),
      acc(ctx, wk, OPT.lateral, "15", 45),
    ]);
  const variation: DayBuilder = (wk) =>
    buildDay(ctx, "Paused & Lockout Bench", "Competition pause and top-end strength", [
      variationSlot(ctx, wk, "bench", OPT.pausedBench, "Hold each rep motionless on the chest for 1–2 s."),
      wk.kind === "build" || wk.kind === "peak"
        ? variationSlot(ctx, wk, "bench", OPT.pinPress, "Lockout work — pins 2–4 inches above the chest (or a close-grip press).")
        : variationSlot(ctx, wk, "bench", OPT.closeGrip, "Close-grip: hands about shoulder width, elbows tucked."),
      acc(ctx, wk, OPT.row, "10-12", 75),
      acc(ctx, wk, OPT.ohTriceps, "12", 60),
      acc(ctx, wk, OPT.rearDelt, "15", 45),
    ]);
  const lowerB: DayBuilder = (wk) =>
    buildDay(ctx, "Lower Body B", "Hinge and single-leg maintenance", [
      acc(ctx, wk, OPT.deadlift, "5", 180, { rpe: wk.kind === "deload" ? 6 : 7 }),
      acc(ctx, wk, OPT.splitSquat, "8 per side", 90),
      acc(ctx, wk, OPT.legCurl, "12", 60),
      acc(ctx, wk, OPT.plank, "", 45, { seconds: 40, reps: undefined, rpe: undefined }),
    ]);
  if (d === 3) return [heavy, lowerA, variation];
  if (d === 4) return [heavy, lowerA, volume, variation];
  return [heavy, lowerA, volume, lowerB, variation];
}

function squatDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const vb = Boolean(goal.volume);
  const d = ctx.input.daysPerWeek;
  const heavy: DayBuilder = (wk) =>
    buildDay(ctx, "Heavy Squat", "Low-rep back squat", [
      heavySlot(ctx, wk, "squat", OPT.squat, vb),
      acc(ctx, wk, OPT.rdl, "8", 150),
      acc(ctx, wk, OPT.legCurl, "12", 60),
      acc(ctx, wk, OPT.core, "8-10", 60),
    ]);
  const upperA: DayBuilder = (wk) =>
    buildDay(ctx, "Upper Body A", "Press and pull maintenance", [
      acc(ctx, wk, OPT.bench, "5", 150, { rpe: wk.kind === "deload" ? 6 : 7 }),
      acc(ctx, wk, OPT.vPull, "6-10", 90),
      acc(ctx, wk, OPT.press, "8", 90),
      acc(ctx, wk, OPT.row, "10", 75),
    ]);
  const pause: DayBuilder = (wk) =>
    buildDay(ctx, "Pause Squat", "Strength out of the hole", [
      variationSlot(ctx, wk, "squat", OPT.pauseSquat, "2–3 second pause at depth; stay braced."),
      acc(ctx, wk, OPT.splitSquat, "8 per side", 90),
      acc(ctx, wk, OPT.legExt, "12-15", 60),
      acc(ctx, wk, OPT.antiRotation, "10 per side", 45),
    ]);
  const volume: DayBuilder = (wk) =>
    buildDay(ctx, "Squat Volume", "Tempo or box squats and posterior chain", [
      volumeSlot(ctx, wk, "squat", wk.kind === "build" ? OPT.boxSquat : OPT.tempoSquat),
      acc(ctx, wk, OPT.goodMorning, "8", 120),
      acc(ctx, wk, OPT.legPress, "10-12", 90),
      acc(ctx, wk, OPT.calf, "12-15", 45),
    ]);
  const upperB: DayBuilder = (wk) =>
    buildDay(ctx, "Upper Body B", "Upper back and arms", [
      acc(ctx, wk, OPT.inclinePress, "8-10", 90),
      acc(ctx, wk, OPT.row, "8", 90),
      acc(ctx, wk, OPT.facePull, "15", 60),
      acc(ctx, wk, OPT.biceps, "12", 60),
    ]);
  if (d === 3) return [heavy, upperA, pause];
  if (d === 4) return [heavy, upperA, pause, volume];
  return [heavy, upperA, pause, upperB, volume];
}

function deadliftDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const vb = Boolean(goal.volume);
  const d = ctx.input.daysPerWeek;
  const heavy: DayBuilder = (wk) =>
    buildDay(ctx, "Heavy Deadlift", "Low-rep competition pull", [
      heavySlot(ctx, wk, "deadlift", OPT.deadlift, vb),
      acc(ctx, wk, OPT.row, "8", 120),
      acc(ctx, wk, OPT.hipThrust, "10", 90),
      acc(ctx, wk, OPT.carry, "", 90, { seconds: 40, reps: undefined, rpe: undefined, notes: "Heavy — builds grip for the deadlift." }),
    ]);
  const upper: DayBuilder = (wk) =>
    buildDay(ctx, "Upper Body", "Press and upper back", [
      acc(ctx, wk, OPT.bench, "5", 150, { rpe: wk.kind === "deload" ? 6 : 7 }),
      acc(ctx, wk, OPT.vPull, "5-8", 90),
      acc(ctx, wk, OPT.press, "10", 90),
      acc(ctx, wk, OPT.facePull, "15", 60),
    ]);
  const variation: DayBuilder = (wk) =>
    buildDay(ctx, "Squat & Pull Variation", "Squat strength and the deadlift sticking point", [
      volumeSlot(ctx, wk, "squat", OPT.squat),
      variationSlot(
        ctx,
        wk,
        "deadlift",
        wk.kind === "build" || wk.kind === "peak" ? OPT.blockPull : OPT.deficit,
        wk.kind === "build" || wk.kind === "peak" ? "Bar just below the knee — overload the lockout." : "1–2 inch deficit — strength off the floor.",
      ),
      acc(ctx, wk, OPT.goodMorning, "8", 120),
      acc(ctx, wk, OPT.grip, "", 60, { seconds: 40, reps: undefined, rpe: undefined }),
    ]);
  const posterior: DayBuilder = (wk) =>
    buildDay(ctx, "Posterior Chain", "Hamstrings, glutes and lats", [
      volumeSlot(ctx, wk, "deadlift", OPT.rdl),
      acc(ctx, wk, OPT.vPull, "8-10", 90),
      acc(ctx, wk, OPT.legCurl, "12", 60),
      acc(ctx, wk, OPT.core, "8-12", 60),
    ]);
  const upperB: DayBuilder = (wk) =>
    buildDay(ctx, "Upper Body B", "Upper back and arms", [
      acc(ctx, wk, OPT.inclinePress, "8-10", 90),
      acc(ctx, wk, OPT.row, "10-12", 75),
      acc(ctx, wk, OPT.biceps, "12", 60),
      acc(ctx, wk, OPT.triceps, "12", 60),
    ]);
  if (d === 3) return [heavy, upper, variation];
  if (d === 4) return [heavy, upper, variation, posterior];
  return [heavy, upper, variation, upperB, posterior];
}

// --------------------------------------------------------------------------- Meet week

const COMPETITION_OPTIONS: Record<MainLift, string[]> = { squat: OPT.squat, bench: OPT.bench, deadlift: OPT.deadlift, press: OPT.press };
const COMMANDS: Record<MainLift, string> = {
  squat: "Commands: wait for “Squat” to start and “Rack” before re-racking.",
  bench: "Commands: “Start”, a motionless pause on the chest, “Press”, then “Rack”.",
  deadlift: "Commands: hold the lockout until “Down”, then lower under control.",
  press: "",
};

/**
 * Competition week for meet-prep goals: opener practice early, light technique days, then meet day with three
 * attempts per lift — instead of separate max-test days for each lift.
 */
function meetWeekDays(ctx: Ctx, lifts: MainLift[], d: number): ProgramDaySeed[] {
  const u = ctx.input.units;
  const at = (lift: MainLift, pct: number) => {
    const m = ctx.input.maxesKg[lift];
    return m ? ` (${formatLoad((m * pct) / 100, u)})` : "";
  };
  // Most lifters take their last heavy pull 7–10 days out, so a full meet skips deadlift openers.
  const openerLifts = lifts.length > 1 ? lifts.filter((l) => l !== "deadlift") : lifts;
  const opener = buildDay(
    ctx,
    "Meet Week — Opener Practice",
    "One crisp single at your planned opener per lift, then go home",
    openerLifts.map((lift) => ({
      options: COMPETITION_OPTIONS[lift],
      sets: 1,
      reps: "1",
      rest: 300,
      lift,
      pct: 90,
      rpe: 7,
      main: true,
      notes: `Work up to your planned opener${at(lift, 90)} — a weight you could triple on a bad day — for one single with full commands. ${COMMANDS[lift]}`,
    })),
  );
  const light = (n: number) =>
    buildDay(
      ctx,
      `Meet Week — Light Technique${d > 3 ? ` ${n}` : ""}`,
      "Short, light and fast: rehearse setup and commands, stay loose",
      openerLifts.map((lift) => ({
        options: COMPETITION_OPTIONS[lift],
        sets: 2,
        reps: "2",
        rest: 120,
        lift,
        pct: 55,
        rpe: 5,
        main: true,
        notes: `Light and fast. ${COMMANDS[lift]}`,
      })),
    );
  const meetDay = buildDay(
    ctx,
    `Meet Day — ${lifts.map((l) => MAIN_LIFT_LABELS[l].replace("Back squat", "Squat").replace("Bench press", "Bench")).join(", ")}`,
    "Three attempts per lift — make your opener, build momentum",
    lifts.map((lift) => {
      const goal = ctx.input.goalMaxesKg?.[lift];
      const max = ctx.input.maxesKg[lift];
      const third = goal && max && goal > max ? `your goal of ${formatLoad(goal, u)}` : `100–103%${at(lift, 102)}`;
      return {
        options: COMPETITION_OPTIONS[lift],
        sets: 3,
        reps: "1",
        rest: 600,
        lift,
        pct: 91,
        rpe: 9,
        main: true,
        notes: `Attempts: opener ~90–92%${at(lift, 91)}, second ~95–97%${at(lift, 96)}, third ${third} only if the second moved well. Last warm-up about 85% roughly 5–8 minutes before your opener. ${COMMANDS[lift]}`,
      };
    }),
  );
  return [opener, ...Array.from({ length: Math.max(0, d - 2) }, (_, i) => light(i + 1)), meetDay];
}

// --------------------------------------------------------------------------- Strongman

/** "20 m" (metric) or "65 ft" (imperial). */
function distanceLabel(ctx: Ctx, metres: number): string {
  return ctx.input.units === "imperial" ? `${Math.round((metres * 3.28084) / 5) * 5} ft` : `${metres} m`;
}

/** A load jump in the user's units: "20 lb" or "10 kg". */
function loadJump(ctx: Ctx, lb: number, kg: number): string {
  return ctx.input.units === "imperial" ? `${lb} lb` : `${kg} kg`;
}

/** Moving events in preference order: the real implement first, then gym substitutes. */
export const STRONGMAN_MOVING_EVENTS = {
  yoke: ["yoke-carry", "zercher-carry", "sandbag-bear-hug-carry", "farmers-carry", "sled-push", "bear-crawl"],
  farmers: ["strongman-farmers-walk", "trap-bar-carry", "farmers-carry", "suitcase-carry", "dead-hang", "plank"],
  keg: ["keg-carry", "sandbag-bear-hug-carry", "zercher-carry", "farmers-carry", "bear-crawl"],
  drag: ["sled-drag", "arm-over-arm-sled-pull", "sled-push", "bear-crawl"],
} as const;
type MovingEvent = keyof typeof STRONGMAN_MOVING_EVENTS;

/** Event name, load jump (lb, kg) and a good target time over 20 m, per implement. */
const EVENT_INFO: Record<string, { name: string; lb: number; kg: number; secs20: number; perHand?: boolean; hold?: boolean; noLoad?: boolean }> = {
  "bear-crawl": { name: "Bear crawl (no-equipment substitute)", lb: 0, kg: 0, secs20: 25, noLoad: true },
  "dead-hang": { name: "Dead hang (grip substitute for farmer's)", lb: 0, kg: 0, secs20: 30, hold: true },
  plank: { name: "Plank (bracing substitute)", lb: 0, kg: 0, secs20: 40, hold: true },
  "yoke-carry": { name: "Yoke", lb: 20, kg: 10, secs20: 15 },
  "zercher-carry": { name: "Zercher carry (yoke substitute)", lb: 10, kg: 5, secs20: 18 },
  "sandbag-bear-hug-carry": { name: "Sandbag carry (yoke/keg substitute)", lb: 10, kg: 5, secs20: 18 },
  "farmers-carry": { name: "Farmer's carry (dumbbells or kettlebells)", lb: 5, kg: 2.5, secs20: 14, perHand: true },
  "sled-push": { name: "Sled push", lb: 25, kg: 10, secs20: 15 },
  "strongman-farmers-walk": { name: "Farmer's walk", lb: 10, kg: 5, secs20: 12, perHand: true },
  "trap-bar-carry": { name: "Trap bar carry (farmer's substitute)", lb: 20, kg: 10, secs20: 14 },
  "suitcase-carry": { name: "Suitcase carry (farmer's substitute, each hand)", lb: 5, kg: 2.5, secs20: 15 },
  "keg-carry": { name: "Keg carry", lb: 10, kg: 5, secs20: 15 },
  "sled-drag": { name: "Sled drag (truck-pull substitute)", lb: 45, kg: 20, secs20: 20 },
  "arm-over-arm-sled-pull": { name: "Arm-over-arm sled pull (truck-pull substitute)", lb: 25, kg: 10, secs20: 25 },
};

function movingEvent(ctx: Ctx, wk: WeekPlan, event: MovingEvent, contest: boolean): Slot {
  const metres = wk.kind === "test" ? 15 : 20;
  const dist = distanceLabel(ctx, metres);
  const sets =
    wk.kind === "base" ? (ctx.novice ? 3 : 4) : wk.kind === "build" ? 3 : wk.kind === "peak" ? 2 : wk.kind === "test" ? 1 : 2;
  const per: NonNullable<Slot["per"]> = {};
  for (const slug of STRONGMAN_MOVING_EVENTS[event]) {
    const info = EVENT_INFO[slug]!;
    if (info.hold || info.noLoad) {
      const secs = info.hold ? info.secs20 : Math.round((info.secs20 * metres) / 20);
      per[slug] = {
        reps: info.hold ? null : dist,
        seconds: secs,
        notes: `${info.name}: ${info.hold ? `hold ${secs} s` : `${dist}`} per set. Get the real implement or a sandbag when you can — loaded carries are the point of this day.`,
      };
      continue;
    }
    const t = Math.round((info.secs20 * metres) / 20);
    const jump = `${loadJump(ctx, info.lb, info.kg)}${info.perHand ? " per hand" : ""}`;
    const notes =
      wk.kind === "base"
        ? `${info.name}: ${sets} × ${dist}. Moderate weight, fast and smooth — add ${jump} next week when every run is under ${t} s.`
        : wk.kind === "build"
          ? `${info.name}: ${sets} × ${dist} heavy. Add ${jump} when every run is under ${t} s; keep the weight if you have to drop it mid-run.`
          : wk.kind === "peak"
            ? `${info.name}: ${sets} × ${dist} at ${contest ? "contest weight and distance" : "your heaviest smooth weight"} — rehearse the pick, the first steps and your pace.`
            : wk.kind === "test"
              ? `${info.name}: one smooth opener run at about 80% of contest weight, early in the week. No heavy events in the last 3 days before the contest.`
              : `${info.name}: ${sets} × ${dist} light — technique and speed only.`;
    per[slug] = { reps: dist, seconds: t, notes };
  }
  return { options: [...STRONGMAN_MOVING_EVENTS[event]], sets, reps: dist, seconds: 15, rest: wk.kind === "build" ? 180 : 150, main: true, anyDifficulty: true, per };
}

const STONE_OPTIONS = ["atlas-stone-load", "sandbag-load-over-bar", "sandbag-to-shoulder", "zercher-squat", "kettlebell-swing", "broad-jump"];

function loadingEvent(ctx: Ctx, wk: WeekPlan, contest: boolean): Slot {
  const scheme =
    wk.kind === "base"
      ? { sets: 4, reps: "3", rest: 120, note: "a moderate stone (or bag) — smooth lap, re-grip, extend. Move up when every rep is smooth." }
      : wk.kind === "build"
        ? { sets: ctx.novice ? 4 : 5, reps: "1-2", rest: 150, note: "heavy singles and doubles — reset fully between reps." }
        : wk.kind === "peak"
          ? { sets: 2, reps: "3-5 loads", rest: 240, note: contest ? "run your contest series (or 3–5 progressively heavier stones) at contest pace." : "a progressive series of 3–5 loads, heaviest last." }
          : wk.kind === "test"
            ? { sets: 2, reps: "1", rest: 120, note: "light, fast openers early in the week only." }
            : { sets: 2, reps: "2", rest: 120, note: "light stones, practise the lap and extension." };
  const per: NonNullable<Slot["per"]> = {
    "atlas-stone-load": { notes: `Atlas stones: ${scheme.note} Use tacky only where your gym allows it.` },
    "sandbag-load-over-bar": { notes: `Sandbag loads (stone substitute): ${scheme.note}` },
    "sandbag-to-shoulder": { notes: `Sandbag to shoulder (stone substitute): ${scheme.note} Alternate shoulders.` },
    "zercher-squat": { reps: wk.kind === "build" ? "3" : "5", notes: "Zercher squats (stone substitute): builds the lap position and upper-back strength for stones and kegs." },
    "kettlebell-swing": { reps: "10", notes: "Kettlebell swings (stone substitute): powerful hip extension for loading events." },
    "broad-jump": { reps: "3", notes: "Broad jumps (no-equipment substitute): explosive hip extension, the engine of every loading event." },
  };
  return { options: STONE_OPTIONS, sets: scheme.sets, reps: scheme.reps, rest: scheme.rest, main: true, anyDifficulty: true, per };
}

/** Clean & press practice on event days: the clean is half of every overhead event. */
function overheadEvent(ctx: Ctx, wk: WeekPlan, contest: boolean): Slot {
  const s =
    wk.kind === "base"
      ? { sets: 5, reps: "3", rpe: 7, note: "clean every rep — smooth, fast reps with 1–2 in the tank." }
      : wk.kind === "build"
        ? { sets: 5, reps: "2", rpe: 8, note: "heavier doubles, clean every rep." }
        : wk.kind === "peak"
          ? { sets: 1, reps: "5-8", rpe: 8.5, note: contest ? "for-reps rehearsal: as many clean reps as you can in 60 s at contest weight, stopping 1–2 shy of failure." : "one set of clean-and-press reps in 60 s, stopping 1–2 shy of failure." }
          : wk.kind === "test"
            ? { sets: 2, reps: "2", rpe: 6, note: "light openers early in the week." }
            : { sets: 3, reps: "3", rpe: 6, note: "light technique work." };
  return {
    options: ["log-press", "axle-clean-and-press", "one-arm-dumbbell-push-press", "push-press", "seated-dumbbell-shoulder-press", "landmine-press", "pike-push-up"],
    sets: s.sets,
    reps: s.reps,
    rest: 150,
    rpe: clampRpe(s.rpe, ctx.novice),
    main: true,
    anyDifficulty: true,
    per: {
      "log-press": { notes: `Log clean & press: ${s.note}` },
      "axle-clean-and-press": { notes: `Axle clean & press: ${s.note}` },
      "one-arm-dumbbell-push-press": { reps: s.reps === "5-8" ? "5-8 per arm" : `${s.reps} per arm`, notes: `Circus dumbbell substitute: ${s.note}` },
      "push-press": { notes: `Push press (log substitute): ${s.note}` },
    },
  };
}

/** Contest week: light openers early, easy days, then contest day — no static max testing. */
function strongmanContestWeek(ctx: Ctx, d: number): ProgramDaySeed[] {
  const wk: WeekPlan = { kind: "test", k: 0, weekNumber: ctx.input.weeks, total: ctx.input.weeks };
  const openers = buildDay(ctx, "Contest Week — Openers", "Light opener runs and reps early in the week — nothing heavy after today", [
    overheadEvent(ctx, wk, true),
    movingEvent(ctx, wk, "yoke", true),
    movingEvent(ctx, wk, "farmers", true),
    loadingEvent(ctx, wk, true),
  ]);
  const easy = (n: number) =>
    buildDay(ctx, `Contest Week — Easy Movement${d > 3 ? ` ${n}` : ""}`, "Light sled work and mobility to stay loose", [
      { options: ["sled-drag", "sled-push", "brisk-walk"], sets: 3, reps: "20 m", seconds: 30, rest: 90, notes: "Very light — just get blood moving.", per: { "brisk-walk": { reps: null, seconds: 900, notes: "Easy 15-minute walk." } } },
      { options: OPT.mobility, sets: 2, seconds: 45, rest: 15 },
      { options: ["90-90-hip-switch", "thoracic-open-book", "couch-stretch"], sets: 2, seconds: 45, rest: 15 },
    ]);
  const contestNote = "Contest: follow the event's weight, distance and time limit. Warm up with 2–3 light runs or reps per event and keep warm between events.";
  const contestDay = buildDay(ctx, "Contest Day", "Compete — trust your training", [
    { ...overheadEvent(ctx, wk, true), sets: 1, reps: "event", rpe: undefined, per: undefined, notes: contestNote },
    { ...movingEvent(ctx, wk, "yoke", true), reps: "event", per: undefined, notes: contestNote },
    { ...movingEvent(ctx, wk, "farmers", true), reps: "event", per: undefined, notes: contestNote },
    { ...loadingEvent(ctx, wk, true), sets: 1, reps: "event", per: undefined, notes: contestNote },
  ]);
  return [openers, ...Array.from({ length: Math.max(0, d - 2) }, (_, i) => easy(i + 1)), contestDay];
}

function strongmanDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const d = ctx.input.daysPerWeek;
  const contest = Boolean(goal.event);
  const staticSlot = (wk: WeekPlan, lift: MainLift, options: string[]): Slot => heavySlot(ctx, wk, lift, options, false);
  const overheadOptions = ["log-press", "axle-clean-and-press", "overhead-press", "push-press", "one-arm-dumbbell-push-press", "seated-dumbbell-shoulder-press", "landmine-press", "pike-push-up"];
  const deadliftOptions = ["conventional-deadlift", "trap-bar-deadlift", "romanian-deadlift", "kettlebell-swing", "glute-bridge"];
  const grip = (wk: WeekPlan) =>
    acc(ctx, wk, ["dead-hang", "trap-bar-carry", "farmers-carry", "hammer-curl"], "", 75, {
      reps: undefined,
      seconds: 30,
      rpe: undefined,
      notes: "Grip: double-overhand holds or hangs as long as you can hold good position.",
      per: { "hammer-curl": { reps: "10-12", seconds: null } },
    });
  const trunk = (wk: WeekPlan) =>
    acc(ctx, wk, ["ab-wheel-rollout", "suitcase-carry", "side-plank", "cable-crunch", "dead-bug"], "8-10", 60, {
      per: { "suitcase-carry": { reps: null, seconds: 30 }, "side-plank": { reps: null, seconds: 30 } },
    });
  const eventWarmup = [
    "5 minutes easy carries, sled or bike",
    "Hip openers, band pull-aparts and wrist circles",
    "2–3 build-up runs or reps with each implement before your first working set",
  ];
  const overhead: DayBuilder = (wk) =>
    buildDay(ctx, "Max Effort — Overhead", "Heavy log or axle, then upper back and triceps for lockout", [
      staticSlot(wk, "press", overheadOptions),
      acc(ctx, wk, ["push-press", "axle-clean-and-press", "one-arm-dumbbell-push-press", "overhead-press", "seated-dumbbell-shoulder-press"], "3-5", 150, {
        per: {
          "axle-clean-and-press": { notes: "Axle: clean every rep — the clean is half the event." },
          "one-arm-dumbbell-push-press": { reps: "3-5 per arm", notes: "Circus dumbbell substitute: drive with the legs, lock out hard." },
        },
      }),
      acc(ctx, wk, ["close-grip-bench-press", "dips", "triceps-pushdown", "overhead-triceps-extension", "push-up"], "6-10", 90, { notes: "Triceps strength finishes heavy overhead lockouts." }),
      acc(ctx, wk, ["chest-supported-row", "barbell-row", "one-arm-dumbbell-row", "seated-cable-row", "band-row"], "8-12", 90),
      acc(ctx, wk, ["face-pull", "band-external-rotation", "band-pull-apart", "rear-delt-fly"], "15", 45, { notes: "Shoulder health for high-frequency pressing." }),
    ]);
  const deadlift = (withSquat: boolean): DayBuilder => (wk) =>
    buildDay(
      ctx,
      withSquat ? "Max Effort — Deadlift & Squat" : "Max Effort — Deadlift",
      withSquat ? "Heavy pulls, squat volume, grip and trunk" : "Heavy pulls, an above-the-knee pull, grip and trunk",
      [
        staticSlot(wk, "deadlift", deadliftOptions),
        withSquat
          ? volumeSlot(ctx, wk, "squat", OPT.squat)
          : variationSlot(ctx, wk, "deadlift", ["block-pull", "trap-bar-deadlift", "romanian-deadlift", "hip-thrust"], "Bar just above the knee (about 18 in / 46 cm) — the height of many strongman deadlift events. Straps are fine."),
        acc(ctx, wk, ["good-morning", "romanian-deadlift", "seated-leg-curl", "nordic-hamstring-curl", "glute-bridge"], "8", 120),
        grip(wk),
        trunk(wk),
      ],
    );
  const squat: DayBuilder = (wk) =>
    buildDay(ctx, "Squat & Overhead Volume", "Heavy squats, Zercher work and a second press session", [
      staticSlot(wk, "squat", OPT.squat),
      acc(ctx, wk, ["zercher-squat", "front-squat", "goblet-squat", "bulgarian-split-squat"], "6", 150, {
        per: { "zercher-squat": { notes: "Builds the lap and front-carry positions used in stones, kegs and sandbags." } },
      }),
      volumeSlot(ctx, wk, "press", ["log-press", "overhead-press", "push-press", "seated-dumbbell-shoulder-press", "landmine-press", "pike-push-up"]),
      acc(ctx, wk, ["barbell-row", "chest-supported-row", "one-arm-dumbbell-row", "inverted-row", "band-row"], "8-10", 90),
      acc(ctx, wk, ["hammer-curl", "dumbbell-curl"], "10-12", 60, { notes: "Strong biceps help protect the elbows on stones and axle cleans." }),
    ]);
  const movingDay = (withLoading: boolean): DayBuilder => (wk) =>
    buildDay(
      ctx,
      withLoading ? "Event Day — Moving & Loading" : "Event Day — Moving Events",
      withLoading ? "Clean & press practice, yoke, farmer's, stones and a drag" : "Yoke, farmer's, keg carries and drags by distance",
      withLoading
        ? [overheadEvent(ctx, wk, contest), movingEvent(ctx, wk, "yoke", contest), movingEvent(ctx, wk, "farmers", contest), loadingEvent(ctx, wk, contest), movingEvent(ctx, wk, "drag", contest)]
        : [movingEvent(ctx, wk, "yoke", contest), movingEvent(ctx, wk, "farmers", contest), movingEvent(ctx, wk, "keg", contest), movingEvent(ctx, wk, "drag", contest), trunk(wk)],
      { warmup: eventWarmup },
    );
  const loadingDay: DayBuilder = (wk) =>
    buildDay(ctx, "Event Day — Loading & Overhead", "Stones or sandbags, clean & press practice and a keg carry", [
      overheadEvent(ctx, wk, contest),
      loadingEvent(ctx, wk, contest),
      {
        ...acc(ctx, wk, ["sandbag-to-shoulder", "sandbag-load-over-bar", "kettlebell-swing"], "5", 120, { rpe: undefined, notes: "Sandbag to shoulder: alternate shoulders; fast, powerful reps.", main: true }),
        per: { "kettlebell-swing": { reps: "10", notes: "Hard, powerful swings." } },
      },
      movingEvent(ctx, wk, "keg", contest),
      grip(wk),
    ], { warmup: eventWarmup });
  if (d === 3) return [overhead, deadlift(true), movingDay(true)];
  if (d === 4) return [overhead, deadlift(false), squat, movingDay(true)];
  return [overhead, deadlift(false), movingDay(false), squat, loadingDay];
}

// --------------------------------------------------------------------------- MMA / combat sports

/** S&C day names start with this prefix; recovery days don't. MMA programs never have more than three. */
export const MMA_SC_PREFIX = "S&C";

function mmaDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const d = ctx.input.daysPerWeek;
  const strengthBias = goal.id === "strength_power";
  const camp = Boolean(goal.event);
  const fightWeek = (wk: WeekPlan) => camp && wk.kind === "test";
  const lowSoreness = "Leave 2–3 reps in reserve — no grinding. Soreness costs you skill sessions.";

  /** Max strength: general strength early in camp, heavier triples mid-camp, fast low-volume work late. */
  const strength = (wk: WeekPlan, options: string[], perSide = false): Slot => {
    const bias = strengthBias ? 1 : 0;
    const top = Math.min(5, ctx.mainSets + bias);
    const s =
      wk.kind === "base"
        ? { sets: Math.max(3, top - 1), reps: "5", rpe: 7 + (wk.k >= 2 ? 0.5 : 0), note: lowSoreness }
        : wk.kind === "build"
          ? { sets: top, reps: "3", rpe: 8, note: "Max strength: heavy triples, crisp reps. " + lowSoreness }
          : wk.kind === "peak"
            ? { sets: 3, reps: "2", rpe: 7, note: "Power phase: moderate load moved as fast as possible. Strength is maintained, not chased." }
            : wk.kind === "test"
              ? { sets: 2, reps: "2", rpe: 6, note: "Primer: light and fast." }
              : { sets: 2, reps: "5", rpe: 6, note: "Deload: easy, fast reps." };
    return { options, sets: s.sets, reps: perSide ? `${s.reps} per side` : s.reps, rest: 150, rpe: clampRpe(s.rpe, ctx.novice), main: true, notes: s.note };
  };
  const jumps = (wk: WeekPlan): Slot => ({
    options: ["trap-bar-jump", "box-jump", "broad-jump", "medicine-ball-slam"],
    sets: wk.kind === "deload" || wk.kind === "test" ? 2 : strengthBias ? 4 : 3,
    reps: "3",
    rest: 90,
    main: true,
    notes: "Power first, while you're fresh: maximal intent, full reset between reps. Stop if height or distance drops.",
  });
  /** Alactic power: ≤10 s all-out with long rests (work:rest of 1:8 or longer) so every rep is maximal. */
  const alactic = (wk: WeekPlan): Slot => {
    const s =
      wk.kind === "base"
        ? { sets: 6, secs: 8, rest: 90 }
        : wk.kind === "build"
          ? { sets: 8, secs: 8, rest: 80 }
          : wk.kind === "peak"
            ? { sets: 8, secs: 10, rest: 80 }
            : { sets: 4, secs: 6, rest: 90 };
    return {
      options: ["air-bike-sprint", "bike-intervals", "rowing-intervals", "acceleration-sprint", "battle-rope-waves", "medicine-ball-slam"],
      sets: s.sets,
      seconds: s.secs,
      rest: s.rest,
      main: true,
      notes: `Alactic power: ${s.secs} s all-out, ${s.rest} s easy (at least 1:8 work to rest). Every rep at max speed — stop the set if one is clearly slower.`,
    };
  };
  /** Glycolytic intervals: 20–45 s hard with short rests — the burn you feel in scrambles and exchanges. */
  const glycolytic = (wk: WeekPlan): Slot | null => {
    if (fightWeek(wk)) return null;
    const cut = strengthBias ? 2 : 0;
    const s =
      wk.kind === "base"
        ? { sets: 6 - cut, secs: 30, rest: 90 }
        : wk.kind === "build"
          ? { sets: 8 - cut, secs: 30, rest: 60 }
          : wk.kind === "peak"
            ? { sets: 6 - cut, secs: 45, rest: 45 }
            : { sets: 4, secs: 20, rest: 100 };
    return {
      options: ["air-bike-sprint", "bike-intervals", "rowing-intervals", "running-intervals", "battle-rope-waves", "burpee", "mountain-climber"],
      sets: Math.max(3, s.sets),
      seconds: s.secs,
      rest: s.rest,
      main: true,
      notes: `Glycolytic intervals: ${s.secs} s hard (about 9/10), ${s.rest} s easy. Skip this block if you spar hard today or tomorrow — hard sparring already trains it.`,
    };
  };
  const rounds = (wk: WeekPlan): Slot => {
    const s =
      wk.kind === "base"
        ? { sets: 4, secs: 180, note: "Aerobic-power rounds: steady and technical, breathing under control." }
        : wk.kind === "build"
          ? { sets: 5, secs: 300, note: "5-minute rounds at fight pace with a 10-second surge every 30 seconds." }
          : wk.kind === "peak"
            ? { sets: 5, secs: 300, note: "Fight simulation: 5-minute rounds at your planned fight pace, 1 minute rest — like a championship fight." }
            : wk.kind === "test"
              ? { sets: 3, secs: 120, note: "Sharp and light — stay fast, stay fresh. No fatigue this week." }
              : { sets: 3, secs: 180, note: "Easy, technical rounds." };
    return { options: ["heavy-bag-rounds", "shadowboxing"], sets: s.sets, seconds: s.secs, rest: 60, main: true, notes: s.note };
  };
  const sprawls = (wk: WeekPlan): Slot => ({
    options: ["sprawl", "step-back-burpee", "burpee", "mountain-climber"],
    sets: wk.kind === "deload" || wk.kind === "test" ? 3 : wk.kind === "base" ? 5 : 6,
    seconds: wk.kind === "base" || wk.kind === "deload" || wk.kind === "test" ? 15 : 20,
    rest: wk.kind === "base" ? 45 : 40,
    notes: "Sprawl and get back to stance fast — hips down, hands ready.",
  });
  const neck = (wk: WeekPlan, banded = false): Slot => ({
    main: true,
    options: banded ? ["band-neck-training", "neck-isometrics"] : ["neck-isometrics", "band-neck-training"],
    sets: wk.kind === "deload" || wk.kind === "test" ? 1 : 2,
    seconds: wk.kind === "build" || wk.kind === "peak" ? 20 : 15,
    rest: 30,
    notes: "Neck: front, back and each side. Build gradually — never train through neck pain.",
    per: { "band-neck-training": { reps: "12 each way", seconds: null, notes: "Neck: 12 slow reps each direction with a light band. Never train through neck pain." } },
  });
  const rotational = (wk: WeekPlan): Slot =>
    acc(ctx, wk, ["medicine-ball-scoop-toss", "medicine-ball-rotational-throw", "landmine-rotation", "cable-woodchop", "pallof-press"], "5 per side", 60, {
      rpe: undefined,
      notes: "Rotational power: hips lead, throw hard, reset between reps.",
      per: { "pallof-press": { reps: "10 per side", notes: "Anti-rotation: resist the pull, ribs down." } },
    });
  const punch = (wk: WeekPlan): Slot =>
    acc(ctx, wk, ["medicine-ball-shot-put", "landmine-press", "push-up", "dumbbell-bench-press"], "4 per side", 75, {
      rpe: undefined,
      notes: "Punch power: rear foot drives, hips turn, then the hand.",
      per: { "push-up": { reps: "6-8", notes: "Explosive push-ups: fast up, controlled down." }, "dumbbell-bench-press": { reps: "6", notes: "Fast concentric, 2–3 reps in reserve." } },
    });
  const pull: (wk: WeekPlan) => Slot = (wk) => acc(ctx, wk, OPT.vPull, "5-8", 90, { notes: "Grip and pulling strength for clinches and grappling." });
  const groin = (wk: WeekPlan): Slot =>
    acc(ctx, wk, ["copenhagen-plank", "side-plank"], "", 45, { reps: undefined, seconds: 20, rpe: undefined, sets: 2, notes: "Injury prevention for kicks, sprawls and scrambles: 20 s per side." });
  const shoulders = (wk: WeekPlan): Slot =>
    acc(ctx, wk, ["band-external-rotation", "face-pull", "band-pull-apart"], "15", 45, { rpe: undefined, sets: 2, notes: "Shoulder health for punching and framing." });
  const mobility = (): Slot => ({ options: OPT.mobility, sets: 2, seconds: 45, rest: 15 });

  const A: DayBuilder = (wk) =>
    fightWeek(wk)
      ? buildDay(ctx, "Fight Week — Primer", "Short and sharp: a few jumps, light lifts and sprints", [
          jumps(wk),
          strength(wk, ["trap-bar-deadlift", "back-squat", "goblet-squat", "bulgarian-split-squat"]),
          alactic(wk),
        ])
      : buildDay(ctx, `${MMA_SC_PREFIX} 1 — Max Strength + Alactic Power`, "Jumps, heavy lower-body strength, upper pull and push, neck, then short all-out sprints", [
          jumps(wk),
          strength(wk, ["trap-bar-deadlift", "back-squat", "front-squat", "goblet-squat", "bulgarian-split-squat"]),
          pull(wk),
          acc(ctx, wk, ["landmine-press", "push-press", "dumbbell-bench-press", "push-up"], "5-6", 90),
          alactic(wk),
          neck(wk),
        ]);
  const B: DayBuilder = (wk) =>
    fightWeek(wk)
      ? buildDay(ctx, "Fight Week — Sharp & Light", "Crisp shadowboxing, a few throws and mobility", [rounds(wk), rotational(wk), mobility()])
      : buildDay(ctx, `${MMA_SC_PREFIX} 2 — Power-Endurance + Glycolytic`, "Rotational and punch power, single-leg strength, then glycolytic intervals", [
          rotational(wk),
          punch(wk),
          strength(wk, ["bulgarian-split-squat", "reverse-lunge", "step-up", "goblet-squat"], true),
          acc(ctx, wk, ["chest-supported-row", "one-arm-dumbbell-row", "seated-cable-row", "inverted-row", "band-row"], "8", 75),
          glycolytic(wk),
          groin(wk),
        ].filter((s): s is Slot => s !== null));
  const C: DayBuilder = (wk) =>
    fightWeek(wk)
      ? buildDay(ctx, "Fight Week — Mobility & Breathing", "Loosen up and stay calm — the work is done", [mobility(), { options: ["90-90-hip-switch", "thoracic-open-book", "childs-pose"], sets: 2, seconds: 45, rest: 15 }])
      : buildDay(ctx, `${MMA_SC_PREFIX} 3 — Fight-Specific Conditioning`, "Rounds matched to 5-minute fight rounds, sprawls, mat work and neck", [
          rounds(wk),
          sprawls(wk),
          acc(ctx, wk, ["hip-escape", "bear-crawl"], "", 30, { reps: undefined, seconds: 30, rpe: undefined, notes: "Mat movement under fatigue: smooth and continuous." }),
          neck(wk, true),
          acc(ctx, wk, ["pallof-press", "side-plank", "dead-bug"], "10 per side", 45, { per: { "side-plank": { reps: null, seconds: 30 } } }),
        ]);
  const D: DayBuilder = (wk) =>
    buildDay(ctx, fightWeek(wk) ? "Fight Week — Easy Walk & Stretch" : "Recovery — Aerobic Base & Mobility", "Zone 2 conditioning and mobility — recovery, not a hard day", [
      {
        options: ["bike-intervals", "rowing-intervals", "zone-2-run", "brisk-walk"],
        sets: 1,
        seconds: (wk.kind === "deload" || wk.kind === "test" ? 20 : Math.min(45, 30 + 5 * Math.min(wk.weekNumber - 1, 3))) * 60,
        rest: 0,
        notes: "Zone 2: nasal breathing, or you can talk in full sentences. Builds the aerobic engine that refills your tank between exchanges and rounds.",
        per: { "brisk-walk": { notes: "Easy, brisk walk — recovery, not training." } },
      },
      mobility(),
      { options: ["90-90-hip-switch", "couch-stretch", "thoracic-open-book"], sets: 2, seconds: 45, rest: 15 },
    ]);
  const E: DayBuilder = (wk) =>
    buildDay(ctx, fightWeek(wk) ? "Fight Week — Rest or Easy Movement" : "Recovery — Prehab & Easy Shadowboxing", "Light technical rounds and injury-prevention work", [
      { options: ["shadowboxing", "jump-rope"], sets: wk.kind === "test" ? 2 : 4, seconds: 180, rest: 60, notes: "Easy, technical shadowboxing — nose breathing, no hard output." },
      shoulders(wk),
      groin(wk),
      mobility(),
    ]);
  if (d === 2) return [A, B];
  if (d === 3) return [A, B, C];
  if (d === 4) return [A, B, C, D];
  return [A, B, C, D, E];
}

function cardioDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const d = ctx.input.daysPerWeek;
  const cardio = ctx.input.cardio ?? { modality: "run" as CardioModality, continuousMinutes: 10 };
  const modality: CardioModality = goal.id === "first_5k" ? "run" : cardio.modality;
  const base = Math.max(0, Math.min(180, cardio.continuousMinutes));
  const bmi = ctx.input.bodyweightKg / (ctx.input.heightCm / 100) ** 2;
  const steady: string[] =
    modality === "bike"
      ? ["bike-intervals", "rowing-intervals", "brisk-walk"]
      : modality === "row"
        ? ["rowing-intervals", "bike-intervals", "brisk-walk"]
        : modality === "walk"
          ? ["brisk-walk", "stair-climb"]
          : ["zone-2-run", "brisk-walk"];
  const hard: string[] =
    modality === "bike"
      ? ["bike-intervals", "rowing-intervals", "stair-climb"]
      : modality === "row"
        ? ["rowing-intervals", "bike-intervals", "stair-climb"]
        : modality === "walk"
          ? ["stair-climb", "brisk-walk"]
          : ["running-intervals", "bike-intervals", "stair-climb"];
  const total = ctx.input.weeks;
  const isDown = (wk: WeekPlan) => wk.kind === "deload";
  const frac = (wk: WeekPlan) => (total <= 1 ? 1 : (wk.weekNumber - 1) / (total - 1));
  const lowImpactNote = bmi >= 35 && modality === "run" ? " If running bothers your joints, walk briskly on an incline or use a bike instead." : "";

  if (goal.id === "first_5k") {
    // Run/walk until continuous running reaches 20 minutes, then extend to 30.
    const runSession = (wk: WeekPlan, long: boolean): Slot => {
      // Someone who can already run 20+ minutes starts with continuous easy runs.
      const startRun = base >= 20 ? Math.min(base, 25) : Math.max(1, base / 2);
      const target = long ? 30 : 25;
      const continuousTarget = startRun + Math.max(0, target - startRun) * Math.pow(frac(wk), 1.1);
      const test = wk.kind === "test";
      const fiveKDay = test && long;
      // Test week: easier early sessions, then the 5K-length run.
      const runMin = isDown(wk) || (test && !long) ? Math.max(startRun, continuousTarget * 0.7) : continuousTarget;
      if (runMin >= 18) {
        const mins = fiveKDay ? 30 : Math.round(runMin);
        return {
          options: ["zone-2-run", "run-walk-intervals", "brisk-walk"],
          sets: 1,
          seconds: mins * 60,
          rest: 0,
          notes: `${mins} minutes of continuous easy running.${fiveKDay ? " 5K day — run it at a steady, conversational effort." : ""}${lowImpactNote}`,
        };
      }
      const intervalMin = Math.max(1, Math.round(runMin / 2.5));
      const walkSec = intervalMin >= 5 ? 120 : 90;
      const roundsN = Math.max(3, Math.min(10, Math.round(22 / (intervalMin + walkSec / 60))));
      return {
        options: ["run-walk-intervals", "brisk-walk"],
        sets: roundsN,
        seconds: intervalMin * 60,
        rest: walkSec,
        notes: fiveKDay
          ? `5K day: cover 5 km (3.1 miles) with run ${intervalMin} min / walk ${walkSec === 120 ? "2 min" : "90 s"} intervals — keep repeating until you finish.${lowImpactNote}`
          : `Run ${intervalMin} min easy, then walk ${walkSec === 120 ? "2 min" : "90 s"} (the rest). ${roundsN} rounds.${lowImpactNote}`,
      };
    };
    const days: DayBuilder[] = [
      (wk) => buildDay(ctx, "Easy Run A", "Run/walk progression", [runSession(wk, false)]),
      (wk) =>
        buildDay(ctx, "Walk & Strength", "Low-impact aerobic work and leg strength", [
          { options: ["brisk-walk", "bike-intervals"], sets: 1, seconds: 20 * 60, rest: 0, notes: "Conversational pace." },
          acc(ctx, wk, ["bodyweight-squat", "goblet-squat"], "12", 60),
          acc(ctx, wk, ["reverse-lunge", "step-up"], "8 per side", 60),
          acc(ctx, wk, ["standing-calf-raise", "glute-bridge"], "15", 45),
        ]),
      (wk) => buildDay(ctx, "Long Easy Run", "Longest run of the week", [runSession(wk, true)]),
      (wk) => buildDay(ctx, "Easy Run B", "Run/walk progression", [runSession(wk, false)]),
      (wk) => buildDay(ctx, "Cross-Training", "Low-impact aerobic work", [{ options: ["bike-intervals", "rowing-intervals", "brisk-walk"], sets: 1, seconds: (isDown(wk) ? 20 : 30) * 60, rest: 0, notes: "Easy, conversational." }]),
      () => buildDay(ctx, "Recovery Walk", "Active recovery", [{ options: ["brisk-walk"], sets: 1, seconds: 30 * 60, rest: 0, notes: "Easy walk." }]),
    ];
    return days.slice(0, d);
  }

  const steadyMinutes = (wk: WeekPlan, scale = 1) => {
    const start = Math.max(20, Math.min(45, base || 20));
    const grown = start * (1 + 0.5 * frac(wk));
    return Math.round(Math.min(ctx.input.sessionMinutes - 5, (isDown(wk) ? grown * 0.7 : grown) * scale));
  };
  const steadySlot = (wk: WeekPlan, scale = 1, note = "Zone 2: you can speak in full sentences."): Slot => ({
    options: steady,
    sets: 1,
    seconds: Math.max(10, steadyMinutes(wk, scale)) * 60,
    rest: 0,
    notes: note + lowImpactNote,
  });
  const intervals = (wk: WeekPlan): Slot => {
    if (isDown(wk) || wk.kind === "test") return { options: hard, sets: 4, seconds: 60, rest: 120, notes: "Strides: 1 min brisk, 2 min easy. Stay smooth." };
    if (base < 10 && modality === "run") return { options: ["run-walk-intervals", ...hard], sets: 6, seconds: 120, rest: 90, notes: "Run 2 min at a strong effort, walk 90 s." };
    if (wk.kind === "base") return { options: hard, sets: 4 + Math.min(wk.k, 2), seconds: 180, rest: 120, notes: "Hard but controlled (about 8/10), easy 2 min between." };
    return { options: hard, sets: 4, seconds: 240, rest: 180, notes: "4 × 4 min at about 85–90% of max heart rate (hard, few words), 3 min easy between." };
  };
  const circuit = (wk: WeekPlan, name: string) =>
    buildDay(ctx, name, "Full-body strength circuit to keep muscle", [
      acc(ctx, wk, ["goblet-squat", "bodyweight-squat", "leg-press"], "10-12", 45),
      acc(ctx, wk, ["push-up", "dumbbell-bench-press", "incline-push-up"], "8-12", 45),
      acc(ctx, wk, ["one-arm-dumbbell-row", "band-row", "inverted-row", "seated-cable-row"], "10-12", 45),
      acc(ctx, wk, ["romanian-deadlift", "glute-bridge", "kettlebell-swing"], "10-12", 45),
      acc(ctx, wk, ["plank", "dead-bug"], "", 30, { seconds: 30, reps: undefined, rpe: undefined }),
    ]);
  const isFatLoss = goal.id === "fat_loss";
  const z2 = (name: string, scale = 1): DayBuilder => (wk) => buildDay(ctx, name, "Aerobic base", [steadySlot(wk, scale)]);
  const ints: DayBuilder = (wk) => buildDay(ctx, "Intervals", "Aerobic capacity", [intervals(wk)]);
  const long: DayBuilder = (wk) =>
    buildDay(ctx, "Long Session", "Endurance", [steadySlot(wk, 1.4, "Long, easy session — keep it conversational from start to finish.")]);
  const walk: DayBuilder = (wk) =>
    buildDay(ctx, "Incline Walk / Stairs", "Low-impact calorie burn", [
      { options: ["brisk-walk", "stair-climb"], sets: 1, seconds: Math.max(20, steadyMinutes(wk)) * 60, rest: 0, notes: "Brisk incline walk or stairs at a conversational pace." },
    ]);
  const fatLoss: DayBuilder[] = [z2("Zone 2 A"), (wk) => circuit(wk, "Strength Circuit A"), ints, walk, (wk) => circuit(wk, "Strength Circuit B"), z2("Zone 2 B", 0.8)];
  const endurance: DayBuilder[] = [z2("Zone 2 A"), ints, long, z2("Zone 2 B", 0.8), (wk) => circuit(wk, "Strength Support"), z2("Recovery Session", 0.6)];
  const order = isFatLoss ? fatLoss : endurance;
  return order.slice(0, d);
}

// --------------------------------------------------------------------------- Bodybuilding & physique

export const BODYBUILDING_MUSCLES = ["chest", "back", "delts", "quads", "hamstrings", "biceps", "triceps", "calves", "abs"] as const;
export type BodybuildingMuscle = (typeof BODYBUILDING_MUSCLES)[number];
/** Muscles that get the full 10–20 hard sets per week (hamstrings includes glutes). */
export const MAJOR_MUSCLES: BodybuildingMuscle[] = ["chest", "back", "delts", "quads", "hamstrings"];

/**
 * Direct hard sets per muscle per week, by experience: the block starts at the low end and builds toward the
 * high end. Smaller muscles also get indirect work from compounds, so they need fewer direct sets.
 */
export const BODYBUILDING_WEEKLY_SETS: Record<ExperienceLevel, { major: [number, number]; minor: [number, number] }> = {
  new: { major: [10, 12], minor: [4, 6] },
  beginner: { major: [10, 14], minor: [6, 8] },
  intermediate: { major: [12, 18], minor: [6, 10] },
  advanced: { major: [14, 20], minor: [8, 12] },
};
/** Specialization: priority muscles get up to this many extra sets; everything else holds at the low end. */
export const SPECIALIZATION_BONUS = 4;

type BBKind = "heavy" | "compound" | "isolation" | "pump";
interface BBSlot {
  options: string[];
  muscle: BodybuildingMuscle;
  kind: BBKind;
  /** Trains the muscle hard at long lengths — gets a stretch cue. */
  lengthened?: boolean;
  note?: string;
}
interface BBDay {
  name: string;
  focus: string;
  slots: BBSlot[];
}

const BB_REPS: Record<BBKind, string> = { heavy: "6-10", compound: "8-12", isolation: "10-15", pump: "12-20" };
const BB_REST: Record<BBKind, number> = { heavy: 150, compound: 120, isolation: 75, pump: 60 };
/** Exercises whose sensible rep range differs from their slot's (mostly low-equipment fallbacks). */
const BB_REPS_FOR: Record<string, string> = { "nordic-hamstring-curl": "3-6", "glute-bridge": "12-20", "band-assisted-pull-up": "6-10", "pull-up": "6-10", "chin-up": "6-10" };

/** Exercise → the muscle its hard sets count toward. */
const BB_MUSCLE_OF: Record<string, BodybuildingMuscle> = {};

const bb = (muscle: BodybuildingMuscle, kind: BBKind, options: string[], extra: Partial<BBSlot> = {}): BBSlot => {
  for (const o of options) BB_MUSCLE_OF[o] ??= muscle;
  return { options, muscle, kind, ...extra };
};

const BB = {
  chestFlat: bb("chest", "heavy", ["machine-chest-press", "bench-press", "dumbbell-bench-press", "push-up"]),
  chestIncline: bb("chest", "heavy", ["incline-dumbbell-press", "machine-chest-press", "dumbbell-bench-press", "bench-press", "incline-push-up", "push-up"]),
  chestFly: bb("chest", "isolation", ["cable-chest-fly", "dips", "push-up"], { lengthened: true }),
  chestDip: bb("chest", "compound", ["dips", "dumbbell-bench-press", "machine-chest-press", "push-up"]),
  backVertical: bb("back", "compound", ["lat-pulldown", "pull-up", "chin-up", "band-assisted-pull-up", "inverted-row"]),
  backVertical2: bb("back", "compound", ["pull-up", "chin-up", "lat-pulldown", "band-assisted-pull-up", "inverted-row"]),
  backRow: bb("back", "compound", ["chest-supported-row", "seated-cable-row", "one-arm-dumbbell-row", "barbell-row", "band-row", "inverted-row"]),
  backRow2: bb("back", "heavy", ["seated-cable-row", "barbell-row", "one-arm-dumbbell-row", "chest-supported-row", "band-row", "inverted-row"]),
  backLat: bb("back", "isolation", ["straight-arm-pulldown", "one-arm-dumbbell-row", "band-row"], { lengthened: true }),
  deltPress: bb("delts", "compound", ["seated-dumbbell-shoulder-press", "overhead-press", "landmine-press", "pike-push-up"]),
  deltSide: bb("delts", "pump", ["cable-lateral-raise", "lateral-raise"], { lengthened: true }),
  deltSide2: bb("delts", "pump", ["lateral-raise", "cable-lateral-raise"]),
  deltRear: bb("delts", "pump", ["rear-delt-fly", "face-pull", "band-pull-apart"]),
  quadMain: bb("quads", "heavy", ["hack-squat", "back-squat", "leg-press", "goblet-squat", "bulgarian-split-squat", "bodyweight-squat"]),
  quadPress: bb("quads", "compound", ["leg-press", "hack-squat", "goblet-squat", "bulgarian-split-squat", "step-up"]),
  quadIso: bb("quads", "isolation", ["leg-extension", "step-up", "reverse-lunge"]),
  quadUni: bb("quads", "compound", ["bulgarian-split-squat", "walking-lunge", "reverse-lunge", "step-up"], { lengthened: true }),
  hamHinge: bb("hamstrings", "heavy", ["romanian-deadlift", "single-leg-rdl", "good-morning", "glute-bridge"], { lengthened: true }),
  hamCurl: bb("hamstrings", "isolation", ["seated-leg-curl", "leg-curl", "nordic-hamstring-curl", "single-leg-rdl", "glute-bridge"], { lengthened: true }),
  hamCurl2: bb("hamstrings", "isolation", ["leg-curl", "seated-leg-curl", "nordic-hamstring-curl", "glute-bridge"]),
  glutes: bb("hamstrings", "compound", ["hip-thrust", "glute-bridge", "single-leg-rdl"]),
  biceps: bb("biceps", "isolation", ["incline-dumbbell-curl", "dumbbell-curl", "hammer-curl", "chin-up"], { lengthened: true }),
  biceps2: bb("biceps", "isolation", ["hammer-curl", "dumbbell-curl", "incline-dumbbell-curl"]),
  tricepsOH: bb("triceps", "isolation", ["overhead-triceps-extension", "triceps-pushdown", "dips", "push-up"], { lengthened: true }),
  triceps: bb("triceps", "isolation", ["triceps-pushdown", "overhead-triceps-extension", "close-grip-bench-press", "dips", "push-up"]),
  calves: bb("calves", "pump", ["standing-calf-raise", "seated-calf-raise"], { note: "Pause 1–2 s in the bottom stretch — no bouncing." }),
  calvesSeated: bb("calves", "pump", ["seated-calf-raise", "standing-calf-raise"], { note: "Pause 1–2 s in the bottom stretch — no bouncing." }),
  abs: bb("abs", "pump", ["cable-crunch", "hanging-knee-raise", "ab-wheel-rollout", "dead-bug", "plank"]),
};
// Map every catalog alternative that can only appear via a fallback to a sensible muscle.
for (const [slug, m] of Object.entries({ "close-grip-bench-press": "triceps", "chin-up": "back", dips: "chest", "push-up": "chest", "glute-bridge": "hamstrings", "single-leg-rdl": "hamstrings" } as Record<string, BodybuildingMuscle>))
  BB_MUSCLE_OF[slug] = m;

/** Direct hard sets per muscle in one prescribed week (conditioning and posing don't count). */
export function hardSetsByMuscle(week: Pick<ProgramWeekSeed, "days">): Record<BodybuildingMuscle, number> {
  const out = Object.fromEntries(BODYBUILDING_MUSCLES.map((m) => [m, 0])) as Record<BodybuildingMuscle, number>;
  for (const day of week.days)
    for (const ex of day.exercises) {
      const m = BB_MUSCLE_OF[ex.ex];
      if (m) out[m] += ex.sets;
    }
  return out;
}

function bodybuildingSplit(d: number, goal: GoalOption): BBDay[] {
  const upperA: BBDay = { name: "Upper A — Chest & Back", focus: "Flat press, vertical pull, fly, row, side delts and arms", slots: [BB.chestFlat, BB.backVertical, BB.chestFly, BB.backRow, BB.deltSide, BB.tricepsOH, BB.biceps] };
  const upperB: BBDay = { name: "Upper B — Shoulders & Arms", focus: "Shoulder press, row, incline press, lats, delts and arms", slots: [BB.deltPress, BB.backRow2, BB.chestIncline, BB.backLat, BB.deltSide2, BB.deltRear, BB.biceps2, BB.triceps] };
  const lowerA: BBDay = { name: "Lower A — Quads", focus: "Squat pattern, hinge, leg extensions, curls, calves and abs", slots: [BB.quadMain, BB.hamHinge, BB.quadIso, BB.hamCurl, BB.calves, BB.abs] };
  const lowerB: BBDay = { name: "Lower B — Hamstrings & Glutes", focus: "Hip thrust, leg press, curls, split squats, calves and abs", slots: [BB.glutes, BB.quadPress, BB.hamCurl2, BB.quadUni, BB.calvesSeated, BB.abs] };
  const pushA: BBDay = { name: "Push — Chest, Shoulders & Triceps", focus: "Incline press, shoulder press, fly, laterals and triceps", slots: [BB.chestIncline, BB.deltPress, BB.chestFly, BB.deltSide, BB.tricepsOH, BB.triceps] };
  const pushB: BBDay = { name: "Push B — Chest, Shoulders & Triceps", focus: "Flat press, dips, laterals and triceps", slots: [BB.chestFlat, BB.chestDip, BB.deltPress, BB.deltSide2, BB.triceps] };
  const pullA: BBDay = { name: "Pull — Back, Rear Delts & Biceps", focus: "Vertical pull, rows, lats, rear delts and biceps", slots: [BB.backVertical2, BB.backRow, BB.backLat, BB.deltRear, BB.biceps, BB.biceps2] };
  const pullB: BBDay = { name: "Pull B — Back, Rear Delts & Biceps", focus: "Heavy row, pulldown, rear delts and biceps", slots: [BB.backRow2, BB.backVertical, BB.deltRear, BB.biceps2] };
  const legsA: BBDay = { name: "Legs — Quads, Hamstrings & Calves", focus: "Leg press or hack squat, RDL, hip thrust, extensions, curls and calves", slots: [BB.quadPress, BB.hamHinge, BB.glutes, BB.quadIso, BB.hamCurl2, BB.calvesSeated] };
  const legsB: BBDay = { name: "Legs B — Hamstrings & Glutes", focus: "Hinge, hip thrust, curls, split squats and calves", slots: [BB.hamHinge, BB.glutes, BB.hamCurl, BB.quadUni, BB.calves, BB.abs] };
  const fullA: BBDay = { name: "Full Body A", focus: "Squat pattern, flat press, vertical pull, curls, laterals, arms and calves", slots: [BB.quadMain, BB.chestFlat, BB.backVertical, BB.hamCurl, BB.deltSide, BB.biceps, BB.calves] };
  const fullB: BBDay = { name: "Full Body B", focus: "Hinge, incline press, row, extensions, rear delts, triceps and abs", slots: [BB.hamHinge, BB.chestIncline, BB.backRow, BB.quadIso, BB.deltRear, BB.tricepsOH, BB.abs] };
  const fullC: BBDay = { name: "Full Body C", focus: "Single-leg work, shoulder press, row, fly, glutes and arms", slots: [BB.quadUni, BB.deltPress, BB.backRow2, BB.chestFly, BB.glutes, BB.biceps2, BB.triceps] };

  if (goal.id === "body_part_split") {
    const chest = [BB.chestFlat, BB.chestIncline, BB.chestFly, BB.chestDip];
    const back = [BB.backVertical, BB.backRow2, BB.backRow, BB.backLat];
    const delts = [BB.deltPress, BB.deltSide, BB.deltRear, BB.deltSide2];
    const quads = [BB.quadMain, BB.quadPress, BB.quadIso, BB.quadUni];
    const hams = [BB.hamHinge, BB.hamCurl, BB.glutes];
    const day = (name: string, focus: string, slots: BBSlot[]): BBDay => ({ name, focus, slots });
    if (d === 3)
      return [
        day("Chest & Back", "Pressing and pulling — the classic upper-body pairing", [...chest.slice(0, 3), ...back.slice(0, 3)]),
        day("Legs", "Quads, hamstrings, glutes and calves", [...quads.slice(0, 3), ...hams, BB.calves]),
        day("Shoulders & Arms", "Delts from every angle, then biceps and triceps", [...delts.slice(0, 3), BB.biceps, BB.tricepsOH, BB.biceps2, BB.triceps, BB.abs]),
      ];
    if (d === 4)
      return [
        day("Chest & Triceps", "All chest volume, then triceps", [...chest, BB.tricepsOH, BB.triceps]),
        day("Back & Biceps", "All back volume, then biceps", [...back, BB.biceps, BB.biceps2]),
        day("Legs", "Quads, hamstrings, glutes and calves", [...quads.slice(0, 3), ...hams, BB.calves]),
        day("Shoulders & Abs", "Delts from every angle, calves and abs", [...delts, BB.calvesSeated, BB.abs]),
      ];
    if (d === 5)
      return [
        day("Chest", "Flat, incline, fly and dips — plus abs", [...chest, BB.abs]),
        day("Back", "Width and thickness — plus calves", [...back, BB.calvesSeated]),
        day("Shoulders", "Press, side and rear delts — plus abs", [...delts, BB.abs]),
        day("Legs", "Quads, hamstrings, glutes and calves", [...quads, ...hams, BB.calves]),
        day("Arms", "Biceps and triceps, long-head emphasis", [BB.biceps, BB.tricepsOH, BB.biceps2, BB.triceps]),
      ];
    return [
      day("Chest", "Flat, incline, fly and dips", chest),
      day("Back", "Width and thickness", back),
      day("Quads & Calves", "Squat pattern, presses, extensions and calves", [...quads, BB.calves]),
      day("Shoulders & Abs", "Press, side and rear delts, abs", [...delts, BB.abs]),
      day("Arms", "Biceps and triceps, long-head emphasis", [BB.biceps, BB.tricepsOH, BB.biceps2, BB.triceps]),
      day("Hamstrings, Glutes & Calves", "Hinge, curls, hip thrust and calves", [...hams, BB.hamCurl2, BB.calvesSeated, BB.abs]),
    ];
  }
  if (d === 3) return [fullA, fullB, fullC];
  if (d === 4) return [upperA, lowerA, upperB, lowerB];
  if (d === 5) return [upperA, lowerA, pushA, pullA, legsA];
  return [pushA, pullA, legsA, pushB, pullB, legsB];
}

function rirText(rpe: number): string {
  if (rpe <= 6.5) return "3–4 reps in reserve (easy week)";
  if (rpe <= 7.5) return "2–3 reps in reserve";
  if (rpe <= 8) return "2 reps in reserve";
  if (rpe <= 8.5) return "1–2 reps in reserve";
  if (rpe <= 9) return "1 rep in reserve";
  return "0–1 reps in reserve — the last set can go to failure";
}

const SHOW_POSES: Record<ShowDivision, string> = {
  bodybuilding: "front double biceps, front lat spread, side chest, back double biceps, back lat spread, side triceps, abs & thigh, then your free-posing routine",
  classic_physique: "the classic mandatories (front and back double biceps, side chest, side triceps, abs & thigh, your favourite classic pose) and the stomach vacuum",
  mens_physique: "front and back stance, quarter turns and smooth transitions, plus your stage walk",
  womens_physique: "front double biceps (open hands), side chest, back double biceps, side triceps, abs & thigh and your routine",
  figure: "front, side and back quarter turns with a tall, tight V-taper presentation",
  bikini: "front and back poses, transitions and your stage walk — practise in heels",
  wellness: "front and back poses, side presentations and your stage walk — practise in heels",
};

/** Priority muscles for specialization goals and show divisions. */
function priorityMuscles(goal: GoalOption, division?: ShowDivision | null): BodybuildingMuscle[] {
  if (goal.id === "upper_emphasis") return ["chest", "back", "delts"];
  if (goal.id === "lower_emphasis") return ["quads", "hamstrings"];
  switch (division) {
    case "mens_physique":
      return ["chest", "back", "delts"];
    case "figure":
      return ["back", "delts"];
    case "bikini":
      return ["hamstrings", "delts"];
    case "wellness":
      return ["quads", "hamstrings"];
    default:
      return [];
  }
}

interface BBResult {
  builder: (wk: WeekPlan) => ProgramDaySeed[];
  /** Set when session length forced lower volume than prescribed in at least one week. */
  timeCapped: () => boolean;
}

function bodybuildingProgram(ctx: Ctx, goal: GoalOption, opts: { showPrep: boolean; division?: ShowDivision | null }): BBResult {
  const days = bodybuildingSplit(ctx.input.daysPerWeek, goal);
  const range = BODYBUILDING_WEEKLY_SETS[ctx.input.experience];
  const priority = new Set(priorityMuscles(goal, opts.showPrep ? opts.division : null));
  const specialized = priority.size > 0;
  const cardioFinisher = goal.id === "recomp" || opts.showPrep;
  const total = ctx.input.weeks;
  const loadingWeeks = planWeeks(total, Boolean(goal.peaking), ctx.input.age >= 50 || ctx.novice ? 3 : 4)
    .map((k, i) => (k === "base" || k === "build" ? i : -1))
    .filter((i) => i >= 0);
  let capped = false;

  /** Weekly hard-set target for a muscle this week. */
  const target = (m: BodybuildingMuscle, wk: WeekPlan): number => {
    const [lo, hiFull] = MAJOR_MUSCLES.includes(m) ? range.major : range.minor;
    // In a show-prep deficit, volume is held in the lower half of the range.
    const hi = opts.showPrep ? Math.round((lo + hiFull) / 2) : hiFull;
    const idx = loadingWeeks.indexOf(wk.weekNumber - 1);
    const frac = loadingWeeks.length <= 1 ? 0 : Math.max(0, idx) / (loadingWeeks.length - 1);
    let t: number;
    if (wk.kind === "deload") t = Math.round(lo * 0.5);
    else if (wk.kind === "test") t = Math.round(lo * 0.4);
    else if (wk.kind === "peak") t = Math.round((lo + hi) / 2);
    else t = Math.round(lo + (hi - lo) * frac);
    if (specialized && MAJOR_MUSCLES.includes(m)) {
      if (priority.has(m)) {
        if (wk.kind === "base" || wk.kind === "build" || wk.kind === "peak") t = Math.min(hiFull + SPECIALIZATION_BONUS, t + SPECIALIZATION_BONUS);
      } else if (wk.kind === "base" || wk.kind === "build") t = lo; // maintenance volume while specializing
    }
    return Math.max(1, t);
  };

  const rpeFor = (kind: BBKind, wk: WeekPlan): number => {
    const compound = kind === "heavy" || kind === "compound";
    let r: number;
    switch (wk.kind) {
      case "base":
        r = compound ? (wk.k >= 1 ? 8 : 7.5) : wk.k >= 1 ? 9 : 8.5;
        break;
      case "build":
        r = compound ? 8.5 : 9.5;
        break;
      case "peak":
        r = compound ? 8 : 9;
        break;
      case "deload":
        r = compound ? 6 : 6.5;
        break;
      case "test":
        r = 6;
        break;
    }
    if (ctx.input.experience === "new") r = Math.min(r, compound ? 7.5 : 8.5);
    else if (ctx.novice) r = Math.min(r, compound ? 8 : 9);
    return r;
  };

  const conditioning = (wk: WeekPlan): ProgramExerciseSeed | null => {
    if (!cardioFinisher) return null;
    const prog = total <= 1 ? 1 : (wk.weekNumber - 1) / (total - 1);
    const mins = opts.showPrep ? Math.round(15 + 20 * prog) : 15;
    const actual = wk.kind === "test" ? 15 : wk.kind === "deload" ? Math.round(mins * 0.7) : mins;
    const steps = opts.showPrep ? Math.round((8000 + 4000 * prog) / 500) * 500 : 8000;
    const ex = pickSlug(ctx, ["brisk-walk", "stair-climb", "bike-intervals", "rowing-intervals"], new Set());
    if (!ex) return null;
    return {
      ex,
      sets: 1,
      seconds: actual * 60,
      rest: 0,
      notes: `Low-intensity cardio (LISS, zone 2) after lifting. Daily steps: about ${steps.toLocaleString("en-US")}${opts.showPrep ? " — your coach adjusts cardio and steps based on weekly progress" : ""}.`,
    };
  };

  const posing = (wk: WeekPlan): ProgramExerciseSeed | null => {
    if (!opts.showPrep || !ctx.catalog.has("posing-practice")) return null;
    const prog = total <= 1 ? 1 : (wk.weekNumber - 1) / (total - 1);
    const mins = wk.kind === "test" || wk.kind === "peak" ? 20 : Math.round(10 + 10 * prog);
    const poses = opts.division ? SHOW_POSES[opts.division] : "your division's mandatory poses and transitions";
    return {
      ex: "posing-practice",
      sets: 1,
      seconds: mins * 60,
      rest: 0,
      notes: `Posing: ${poses}. Hold each pose 10–20 s and breathe.${prog >= 0.6 || wk.kind === "test" ? " Practise every day now, rest days included, and film a full run-through for your coach." : " Film one run-through a week."}`,
    };
  };

  const builder = (wk: WeekPlan): ProgramDaySeed[] => {
    // 1. Choose exercises for every day (no repeats within a day).
    const chosen = days.map((day) => {
      const used = new Set<string>();
      return day.slots
        .map((slot) => {
          const slug = pickSlug(ctx, slot.options, used);
          if (!slug) return null;
          used.add(slug);
          return { slot, slug, sets: 0 };
        })
        .filter((c): c is { slot: BBSlot; slug: string; sets: number } => c !== null);
    });
    // 2. Spread each muscle's weekly target across the slots that train it (at most 6 sets per exercise).
    for (const m of BODYBUILDING_MUSCLES) {
      const refs = chosen.flatMap((day) => day.filter((c) => c.slot.muscle === m));
      if (!refs.length) continue;
      const t = target(m, wk);
      const base = Math.floor(t / refs.length);
      const extra = t % refs.length;
      refs.forEach((r, i) => (r.sets = Math.min(6, base + (i < extra ? 1 : 0))));
    }
    // 3. Fit each session into the time available by trimming sets (small muscles first), never below 2.
    return days.map((day, di) => {
      const items = chosen[di]!.filter((c) => c.sets > 0);
      const extras = [conditioning(wk), posing(wk)].filter((e): e is ProgramExerciseSeed => e !== null);
      const extraMinutes = extras.reduce((s, e) => s + (e.seconds ?? 0) / 60, 0);
      const minutes = () => 8 + extraMinutes + items.reduce((s, c) => s + (c.sets * (40 + BB_REST[c.slot.kind])) / 60, 0);
      while (minutes() > ctx.input.sessionMinutes) {
        const trimmable = items.filter((c) => c.sets > 2);
        if (!trimmable.length) break;
        const score = (c: (typeof items)[number]) => c.sets * 10 + (MAJOR_MUSCLES.includes(c.slot.muscle) ? 0 : 100) - (priority.has(c.slot.muscle) ? 50 : 0);
        const victim = trimmable.reduce((a, b) => (score(b) >= score(a) ? b : a));
        victim.sets -= 1;
        if (wk.kind === "base" || wk.kind === "build") capped = true;
      }
      const exercises: ProgramExerciseSeed[] = items.map((c, i) => {
        const rpe = rpeFor(c.slot.kind, wk);
        const notes = [`${rirText(rpe)}.`];
        if (c.slot.lengthened) notes.push("Lengthened focus: 2–3 s lowering and a brief pause in the stretch.");
        if (c.slot.note) notes.push(c.slot.note);
        if (i === 0 && (wk.kind === "base" || wk.kind === "build"))
          notes.push("Double progression: when every set reaches the top of the rep range at this effort, add the smallest load jump next time.");
        return { ex: c.slug, sets: c.sets, reps: BB_REPS_FOR[c.slug] ?? BB_REPS[c.slot.kind], rest: BB_REST[c.slot.kind], rpe, notes: notes.join(" ").slice(0, 500) };
      });
      const all = [...exercises, ...extras];
      return { name: day.name, focus: day.focus, minutes: Math.min(240, Math.max(15, Math.round(minutes()))), exercises: all };
    });
  };
  return { builder, timeCapped: () => capped };
}

function speedDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const d = ctx.input.daysPerWeek;
  const reps = (wk: WeekPlan, start: number) =>
    wk.kind === "deload" ? Math.max(2, start - 2) : wk.kind === "test" ? 3 : start + Math.min(wk.weekNumber - 1, 4) - (wk.kind === "base" ? 0 : 1);
  const accDist = (wk: WeekPlan) => (wk.kind === "base" && wk.k < 2 ? "10 m" : wk.kind === "base" ? "20 m" : "20–30 m");
  const accelEmphasis = goal.id === "acceleration";
  const topEmphasis = goal.id === "top_speed";
  const accel: DayBuilder = (wk) =>
    buildDay(ctx, "Acceleration", "Starts and drive phase", [
      { options: ["wall-drill"], sets: 3, reps: "5 per side", rest: 45 },
      { options: ["a-skip"], sets: 2, reps: "20 m", rest: 45 },
      {
        options: ["acceleration-sprint"],
        sets: reps(wk, accelEmphasis ? 6 : 5),
        reps: wk.weekNumber === wk.total ? "10 m + 30 m" : accDist(wk),
        rest: 150,
        notes:
          wk.weekNumber === wk.total
            ? "Test: time a 10 m and a 30 m sprint (two attempts each), full rest. Compare with week 1."
            : "Maximal effort. Walk back and rest fully (2–3 min) — if a rep is slower, stop.",
      },
      { options: ["broad-jump", "box-jump"], sets: wk.kind === "deload" ? 2 : 4, reps: "3", rest: 90, notes: "Stick every landing." },
      acc(ctx, wk, OPT.core, "8", 45),
    ]);
  const maxV: DayBuilder = (wk) =>
    buildDay(ctx, "Max Velocity", "Top speed and elastic stiffness", [
      { options: ["pogo-jumps", "jump-rope"], sets: 3, reps: "15 contacts", rest: 60 },
      { options: ["bounding", "broad-jump"], sets: wk.kind === "deload" ? 2 : 3, reps: ctx.novice ? "3" : "30 m", rest: 120 },
      {
        options: ["flying-sprint", "acceleration-sprint"],
        sets: reps(wk, topEmphasis ? 5 : 4),
        reps: ctx.novice ? "30 m" : "20 m fly",
        rest: 240,
        notes: ctx.novice ? "Build-up sprints: gradually reach about 90% speed by the end." : "20–30 m build-up, then the fly zone at top speed. Rest 3–5 min.",
      },
      acc(ctx, wk, ["single-leg-rdl", "romanian-deadlift", "glute-bridge"], "8 per side", 60),
    ]);
  const strength: DayBuilder = (wk) =>
    buildDay(ctx, "Strength & Power", "Force production for faster sprints", [
      { options: ["box-jump", "broad-jump"], sets: wk.kind === "deload" ? 2 : 4, reps: "3", rest: 90 },
      acc(ctx, wk, ["trap-bar-deadlift", "back-squat", "goblet-squat"], "4", 180, { main: true, sets: ctx.mainSets }),
      acc(ctx, wk, OPT.splitSquat, "6 per side", 90),
      acc(ctx, wk, ["romanian-deadlift", "single-leg-rdl", "glute-bridge"], "6-8", 90),
      acc(ctx, wk, ["nordic-hamstring-curl", "leg-curl", "single-leg-rdl"], wk.weekNumber <= 2 || wk.kind === "deload" ? "3" : "4-6", 90, {
        sets: 2,
        rpe: undefined,
        main: true,
        notes: "Nordic curls are among the best-supported ways to reduce hamstring strains in sprinters. Start low (2 × 3) — they make you very sore at first.",
      }),
      acc(ctx, wk, OPT.calf, "10", 60, { notes: "Pause at the bottom, explode up." }),
    ]);
  const tempo: DayBuilder = (wk) =>
    buildDay(ctx, "Plyometrics & Tempo", "Elastic qualities and recovery", [
      { options: ["pogo-jumps"], sets: 3, reps: "20 contacts", rest: 60 },
      { options: ["lateral-bound", "broad-jump"], sets: 3, reps: "4 per side", rest: 75 },
      {
        options: ["zone-2-run", "bike-intervals", "brisk-walk"],
        sets: wk.kind === "deload" ? 4 : 6,
        seconds: 20,
        rest: 40,
        notes: "Tempo strides at about 70% speed — relaxed and smooth, not sprints.",
      },
      { options: OPT.mobility, sets: 2, seconds: 40, rest: 15 },
    ]);
  if (d === 2) return [accel, maxV];
  if (d === 3) return [accel, strength, maxV];
  return [accel, strength, maxV, tempo];
}

function agilityDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const d = ctx.input.daysPerWeek;
  const reps = (wk: WeekPlan, start: number) =>
    wk.kind === "deload" ? Math.max(2, start - 2) : wk.kind === "test" ? 3 : start + Math.min(Math.floor((wk.weekNumber - 1) / 2), 3);
  const reactiveBias = goal.id === "reactive";
  const footBias = goal.id === "footwork";
  const footwork: DayBuilder = (wk) =>
    buildDay(ctx, "Footwork & Deceleration", "Rhythm, braking and lateral power", [
      { options: ["agility-ladder-drills"], sets: footBias ? 8 : 6, seconds: 15, rest: 45, notes: "Two-in, lateral in-out, Icky shuffle; add crossovers as you improve." },
      { options: ["lateral-bound", "lateral-shuffle"], sets: 3, reps: "4 per side", rest: 60, notes: "Stick each landing for 2 seconds before the next." },
      {
        options: ["pro-agility-shuttle"],
        sets: reps(wk, 4),
        reps: "1",
        rest: 90,
        notes: wk.weekNumber === wk.total ? "Test: time two 5-10-5s (start both directions). Compare with week 1." : "Full rest so every rep is fast.",
      },
      acc(ctx, wk, ["reverse-lunge", "step-up", "bulgarian-split-squat"], "8 per side", 60),
    ]);
  const strength: DayBuilder = (wk) =>
    buildDay(ctx, "Single-Leg Strength", "Strength for braking and cutting", [
      { options: ["box-jump", "broad-jump"], sets: wk.kind === "deload" ? 2 : 3, reps: "4", rest: 75 },
      acc(ctx, wk, ["goblet-squat", "back-squat", "bodyweight-squat"], "6-8", 120, { main: true }),
      acc(ctx, wk, OPT.splitSquat, "8 per side", 75),
      acc(ctx, wk, ["single-leg-rdl", "romanian-deadlift", "glute-bridge"], "8 per side", 60),
      acc(ctx, wk, ["copenhagen-plank", "pallof-press", "side-plank"], "", 45, {
        reps: undefined,
        seconds: 20,
        rpe: undefined,
        notes: "Copenhagen plank: 20 s per side — groin resilience for cutting and braking.",
        per: { "pallof-press": { reps: "10 per side", seconds: null, notes: "Anti-rotation: ribs down, resist the pull." } },
      }),
    ]);
  const cone: DayBuilder = (wk) =>
    buildDay(ctx, "Cones & Reaction", "Planned cuts, then reactive work", [
      { options: ["pogo-jumps"], sets: 3, reps: "15 contacts", rest: 45 },
      { options: ["t-drill"], sets: reps(wk, 3), reps: "1", rest: 90 },
      { options: ["three-cone-drill"], sets: reps(wk, 3), reps: "1", rest: 90 },
      {
        options: ["reactive-mirror-drill", "lateral-shuffle"],
        sets: reactiveBias ? 8 : 6,
        seconds: wk.kind === "base" ? 6 : 8,
        rest: 60,
        notes: "Partner leads; switch roles. Solo: react to random calls or app cues.",
      },
    ]);
  const mixed: DayBuilder = (wk) =>
    buildDay(ctx, "Speed & Change of Direction", "Accelerate, brake, re-accelerate", [
      { options: ["a-skip"], sets: 2, reps: "20 m", rest: 45 },
      { options: ["acceleration-sprint"], sets: reps(wk, 4), reps: "10 m", rest: 120, notes: "Maximal effort, full rest." },
      { options: ["lateral-shuffle"], sets: 4, seconds: 10, rest: 50, notes: "Shuffle 3 steps, plant, sprint 5 m." },
      { options: ["reactive-mirror-drill", "agility-ladder-drills"], sets: 5, seconds: 8, rest: 60 },
    ]);
  if (d === 2) return [footwork, cone];
  if (d === 3) return [footwork, strength, cone];
  return [footwork, strength, cone, mixed];
}

// --------------------------------------------------------------------------- Week focus, text and assembly

function weekFocus(type: CustomProgramType, wk: WeekPlan, goal: GoalOption): string {
  const lifting = ["strength", "powerlifting", "bench", "deadlift", "squat", "strongman"].includes(type);
  switch (wk.kind) {
    case "deload":
      if (wk.weekNumber === wk.total && type === "speed") return "Lighter week: recover, then time your 10 m and 30 m sprints fully rested";
      if (wk.weekNumber === wk.total && type === "agility") return "Lighter week: recover, then time your 5-10-5 fully rested";
      return "Deload: lighter loads and about 40% less volume so you recover and come back stronger";
    case "peak":
      if (type === "mma") return "Peak conditioning: 5-minute rounds at fight pace, power over strength, lower lifting volume";
      if (type === "show_prep") return "Peak conditioning: hold training volume, posing every day, cardio and steps at their highest — follow your coach's plan";
      if (type === "strongman") return goal.event ? "Event rehearsal: contest weights and distances, then a heavy single on the static lifts" : "Peak: heavy singles and your heaviest smooth event runs";
      if (type === "cardio") return goal.id === "first_5k" ? "Biggest week: your longest easy runs so far" : "Sharpen: a little faster, a little less volume";
      return lifting ? "Peak: heavy singles with reduced volume" : "Sharpen: high quality, reduced volume";
    case "test":
      if (type === "mma") return "Fight week taper: short, sharp sessions — arrive fresh. Weight cut and rehydration are your coach's call";
      if (type === "show_prep")
        return "Show week taper: light pump sessions and posing every day. Keep food, fluids and sodium consistent — no extreme water or sodium manipulation; follow your coach";
      if (type === "strongman" && goal.event) return "Contest week: light openers early, 2–3 easy days, then compete";
      if (type === "cardio") return goal.id === "first_5k" ? "5K week: lighter early, then your first 5K-length run" : "Test week: lighter sessions, then a benchmark effort";
      if (type === "speed") return "Taper and test: time your sprints fully rested";
      if (type === "agility") return "Taper and test: time your 5-10-5 fully rested";
      return goal.id === "meet_prep" || goal.id === "contest_prep" ? "Meet week: openers early in the week, then compete" : "Test week: taper, then test your new max";
    case "base":
      if (type === "strongman") return "Accumulation: moderate static lifts, event technique and speed over distance";
      if (type === "mma") return wk.k === 0 ? "General preparation: strength base, aerobic engine and technique on every drill" : "General preparation: build strength and repeat-effort capacity";
      if (type === "bodybuilding" || type === "show_prep") return "Accumulation: weekly sets build toward the top of your range, 1–3 reps in reserve";
      if (lifting) return "Accumulation: build volume at moderate loads";
      if (type === "cardio") return "Base: easy aerobic volume, gradually extended";
      if (type === "speed" || type === "agility") return "Mechanics: technique first, full recovery between reps";
      return "Base: build volume and work capacity";
    case "build":
      if (type === "strongman") return "Intensification: heavier static lifts and heavier, shorter event runs";
      if (type === "mma") return "Specific preparation: max strength, fight-pace rounds and glycolytic intervals";
      if (type === "bodybuilding" || type === "show_prep") return "Peak volume: your highest weekly sets, isolation work taken to 0–1 reps in reserve";
      if (lifting) return "Intensification: heavier, lower-rep work";
      if (type === "cardio") return "Build: longer sessions and harder intervals";
      if (type === "speed" || type === "agility") return "Intensify: longer distances and more reps at full speed";
      return "Build: push intensity while keeping quality high";
  }
}

function progressionText(type: CustomProgramType, goal: GoalOption, hasMaxes: boolean): string {
  switch (type) {
    case "cardio":
      return goal.id === "first_5k"
        ? "Run portions grow each week and walk breaks shrink until you can run 30 minutes continuously. Repeat any week that feels too hard."
        : "Easy sessions grow about 5–10% per week with lighter weeks for recovery. Intervals get longer as your fitness improves.";
    case "bodybuilding":
    case "show_prep":
      return "Double progression: add reps until every set reaches the top of the rep range at the target reps-in-reserve, then add the smallest load jump. Weekly sets per muscle rise through each block, then a deload resets fatigue. Log every set — progressive overload only works if you track it.";
    case "mma":
      return "Strength is built early and converted to power late; conditioning moves from aerobic base and alactic sprints to glycolytic intervals and fight-pace 5-minute rounds. Lifting stays 2–3 reps shy of failure so you're fresh for skills and sparring.";
    case "strongman":
      return hasMaxes
        ? "Static lifts follow percentage waves from your maxes. Events progress by load: when every run is under the target time (or every rep is smooth), add the listed jump next week. Planned deloads keep joints healthy."
        : "Static lifts follow RPE targets. Events progress by load: when every run is under the target time (or every rep is smooth), add the listed jump next week. Planned deloads keep joints healthy.";
    case "speed":
    case "agility":
      return "Add reps or distance only while every rep stays fast. Full recovery between reps is part of the program — speed is trained fresh.";
    default:
      return hasMaxes
        ? "Loads are calculated from your max and progress week by week through accumulation and intensification waves, with planned deloads. If a set is much harder than the target, keep the load next week."
        : "Each week targets a slightly higher RPE. When every set is completed at or below the target RPE, add 2.5 kg / 5 lb next time. Planned deloads let you recover.";
  }
}

function cmLabel(cm: number, units: UnitSystem): string {
  if (units === "metric") return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}′${totalIn % 12}″`;
}

function bodyweightLabel(kg: number, units: UnitSystem): string {
  return units === "imperial" ? `${Math.round(kgToLb(kg))} lb` : `${Math.round(kg * 10) / 10} kg`;
}

export type LiftEntry = { weightKg: number; reps: number } | null | undefined;

/**
 * Turn "your numbers" entries (a 1RM, or a recent best set) into one-rep maxes in kg using the
 * Epley estimate. Only lifts the program type asks about are kept; unusable entries are dropped.
 */
export function resolveMaxes(type: CustomProgramType, lifts: Partial<Record<MainLift, LiftEntry>>): Partial<Record<MainLift, number>> {
  const out: Partial<Record<MainLift, number>> = {};
  for (const lift of CUSTOM_TYPES[type].lifts) {
    const entry = lifts[lift];
    if (!entry) continue;
    const e1rm = estimateOneRepMax(entry.weightKg, entry.reps);
    if (e1rm != null && e1rm >= 10 && e1rm <= 600) out[lift] = e1rm;
  }
  return out;
}

/** Goal maxes are only kept when they're above the current max (and plausible). */
export function resolveGoalMaxes(
  type: CustomProgramType,
  goals: Partial<Record<MainLift, number | null | undefined>>,
  maxes: Partial<Record<MainLift, number>>,
): Partial<Record<MainLift, number>> {
  const out: Partial<Record<MainLift, number>> = {};
  for (const lift of CUSTOM_TYPES[type].lifts) {
    const g = goals[lift];
    const m = maxes[lift];
    if (g && m && g > m && g <= m * 1.5) out[lift] = g;
  }
  return out;
}

export function validateCustomInput(input: CustomProgramInput): string[] {
  const errors: string[] = [];
  const cfg = CUSTOM_TYPES[input.type];
  if (!cfg) return ["Unknown program type"];
  const goal = goalOption(input.type, input.goal);
  if (!goal) errors.push("Choose a goal for this program type");
  if (input.daysPerWeek < cfg.days.min || input.daysPerWeek > cfg.days.max) errors.push(`Choose ${cfg.days.min}–${cfg.days.max} days per week`);
  const wr = weeksRange(input.type, input.goal);
  if (input.weeks < wr.min || input.weeks > wr.max) errors.push(`Choose ${wr.min}–${wr.max} weeks`);
  if (input.age < 18) errors.push("Narrow Gate Fitness is for adults (18+)");
  return errors;
}

/**
 * Build a personalized, periodized program. Exercises the user can't do with their equipment are
 * excluded (with sensible substitutes), and slugs are only chosen from the provided catalog.
 */
export function buildCustomProgram(input: CustomProgramInput, catalogList: CatalogExercise[]): ProgramSeed {
  const errors = validateCustomInput(input);
  if (errors.length) throw new Error(errors.join("; "));
  const cfg = CUSTOM_TYPES[input.type];
  const goal = goalOption(input.type, input.goal)!;
  const novice = input.experience === "new" || input.experience === "beginner";
  const ctx: Ctx = {
    input,
    catalog: new Map(catalogList.map((e) => [e.slug, e])),
    novice,
    mainSets: { new: 3, beginner: 3, intermediate: 4, advanced: 5 }[input.experience],
    accSets: { new: 2, beginner: 3, intermediate: 3, advanced: 3 }[input.experience],
  };

  // Deload every 4th week for novices and lifters 50+, every 5th otherwise.
  const run = novice || input.age >= 50 ? 3 : 4;
  const peaking = Boolean(goal.peaking);
  const plans = weekPlans(input.weeks, peaking, run);

  let bodybuilding: BBResult | null = null;
  const builders: DayBuilder[] | null = (() => {
    switch (input.type) {
      case "strength":
        return strengthDays(ctx, goal);
      case "powerlifting":
        return powerliftingDays(ctx, goal);
      case "bench":
        return benchDays(ctx, goal);
      case "squat":
        return squatDays(ctx, goal);
      case "deadlift":
        return deadliftDays(ctx, goal);
      case "strongman":
        return strongmanDays(ctx, goal);
      case "mma":
        return mmaDays(ctx, goal);
      case "cardio":
        return cardioDays(ctx, goal);
      case "bodybuilding":
      case "show_prep":
        bodybuilding = bodybuildingProgram(ctx, goal, { showPrep: input.type === "show_prep", division: input.division });
        return null;
      case "speed":
        return speedDays(ctx, goal);
      case "agility":
        return agilityDays(ctx, goal);
    }
  })();

  const speedish = input.type === "speed" || input.type === "agility";
  const dayWarmup: string[] | undefined = speedish
    ? [
        "5 minutes easy jog, skipping or jump rope",
        "Leg swings × 10 each direction, each leg",
        "World's greatest stretch × 3 per side",
        "A-skips and lateral shuffles × 2 rounds",
        "3 build-up runs at 60%, 75% and 90% effort",
      ]
    : input.type === "cardio"
      ? ["5 minutes brisk walking or very easy pace", "Leg swings × 10 each leg", "Ankle circles × 10 each direction"]
      : input.type === "mma"
        ? [
            "5 minutes jump rope or easy shadowboxing",
            "Hip openers, neck circles and world's greatest stretch × 3 per side",
            "2 × 10-second build-up efforts",
          ]
        : undefined;

  const meetLifts: MainLift[] | null =
    goal.id === "meet_prep" ? (({ powerlifting: ["squat", "bench", "deadlift"], bench: ["bench"], squat: ["squat"], deadlift: ["deadlift"] }) as Partial<Record<CustomProgramType, MainLift[]>>)[input.type] ?? null : null;
  const weekDays = (wk: WeekPlan): ProgramDaySeed[] => {
    if (meetLifts && wk.kind === "test") return meetWeekDays(ctx, meetLifts, input.daysPerWeek);
    if (input.type === "strongman" && goal.event && wk.kind === "test") return strongmanContestWeek(ctx, input.daysPerWeek);
    if (bodybuilding) return bodybuilding.builder(wk);
    return builders!.map((b) => b(wk));
  };
  const weekTemplates: ProgramWeekSeed[] = plans.map((wk) => ({
    focus: weekFocus(input.type, wk, goal),
    isDeload: wk.kind === "deload",
    days: weekDays(wk).map((day) => ({ ...day, ...(dayWarmup && !day.warmup ? { warmup: dayWarmup } : {}) })),
  }));
  const bb = bodybuilding as BBResult | null;

  const usedSlugs = new Set(weekTemplates.flatMap((w) => w.days.flatMap((d) => d.exercises.map((e) => e.ex))));
  const owned = new Set<Equipment>([...input.equipment, "bodyweight"]);
  const equipmentUsed = [...new Set([...usedSlugs].flatMap((s) => ctx.catalog.get(s)?.equipment ?? []))].filter((e) => owned.has(e));

  const hasMaxes = cfg.lifts.some((l) => Boolean(input.maxesKg[l]));
  const goalLabel = goal.label;
  const division = input.type === "show_prep" && input.division ? ` (${SHOW_DIVISION_LABELS[input.division]})` : "";
  const notes: string[] = [
    `Built for you: age ${input.age}, ${cmLabel(input.heightCm, input.units)}, ${bodyweightLabel(input.bodyweightKg, input.units)}, ${input.experience === "new" ? "new to training" : `${input.experience} lifter`}.`,
    cfg.description,
  ];
  if (hasMaxes) notes.push("Working loads are calculated from the numbers you entered and rounded to plates you can load.");
  else if (cfg.lifts.length) notes.push("No maxes were entered, so loads are set by RPE (how hard a set feels). Add your numbers any time by rebuilding the program.");
  if (input.age >= 50) notes.push("Deloads come a little more often to support recovery.");
  if (input.type === "bodybuilding" || input.type === "show_prep") {
    const r = BODYBUILDING_WEEKLY_SETS[input.experience].major;
    notes.push(
      `Volume: about ${r[0]}–${r[1]} hard sets per major muscle per week for your experience, starting low and building through each block. Sets are taken to 0–3 reps in reserve; machines and cables are favoured for safe, close-to-failure work and exercises that load muscles in the stretch.`,
    );
    if (bb?.timeCapped())
      notes.push(`Your ${input.sessionMinutes}-minute sessions can't fit all of that volume, so some sets were trimmed; longer sessions or an extra training day would let you do the full prescription.`);
  }
  if (input.type === "bodybuilding" && ["upper_emphasis", "lower_emphasis"].includes(goal.id))
    notes.push("Specialization: priority muscles get extra sets while everything else is held at maintenance volume. Run it for one block, then return to balanced training.");
  if (input.type === "show_prep")
    notes.push(
      "Nutrition, cardio adjustments and peak-week strategy should be guided by a qualified coach or registered dietitian. This program does not prescribe extreme dieting, water cutting or sodium manipulation — these are risky and often make you look flatter. Keep food, fluids and sodium consistent in show week, stay fueled and hydrated, and practise posing every session.",
    );
  if (input.type === "strongman") {
    notes.push(
      "Moving events are written as distance with a target time; static lifts use percentages or RPE. No implements? Each event swaps to a substitute you own — zercher or sandbag carries for the yoke, trap bar or dumbbell carries for farmer's, sandbag loads for stones, push presses for the log.",
    );
    if (input.maxesKg.press) notes.push("Overhead percentages use your overhead press max, so log or axle work may feel conservative at first — that's fine.");
  }
  if (meetLifts)
    notes.push("Meet week: opener practice early, light technique sessions, then meet day with three attempts per lift. Pick openers you could triple on a bad day.");
  if (input.type === "cardio" && goal.id === "fat_loss")
    notes.push("Fat loss mainly comes from a sustainable calorie deficit; this plan supports it with activity and strength work to protect muscle.");
  if (input.type === "mma")
    notes.push(
      "Fit S&C around skills: lift after technique work on the same day (or 6+ hours apart) so hard days stay hard and easy days stay easy. Never put glycolytic intervals the day before hard sparring — hard sparring already counts as glycolytic conditioning. Recovery days are optional and easy.",
    );
  if (speedish) notes.push("Speed and agility are trained fresh: rest fully between reps and stop if quality drops.");
  notes.push("Stop any exercise that causes pain. This is general fitness guidance, not medical advice.");

  const firstDays = weekTemplates[0]!.days;
  const model: ProgressionModel = ["cardio", "mma", "speed", "agility"].includes(input.type)
    ? "density"
    : ["bodybuilding", "show_prep"].includes(input.type)
      ? "volume_wave"
      : "linear_rpe";

  const difficulty: Difficulty = novice ? "beginner" : input.experience === "advanced" ? "advanced" : "intermediate";

  return {
    slug: "custom",
    name: `${cfg.label}: ${goalLabel}${division}`.slice(0, 120),
    summary: `${firstDays.length} sessions per week for ${input.weeks} weeks, about ${input.sessionMinutes} minutes each${peaking ? `, peaking in week ${input.weeks}` : ""}.`,
    description: notes.join(" "),
    category: cfg.category,
    types: cfg.programTypes,
    difficulty,
    weeks: input.weeks,
    sessionMinutes: input.sessionMinutes,
    goals: cfg.primaryGoals,
    equipment: equipmentUsed,
    tier: "free",
    lowImpact: false,
    progression: progressionText(input.type, goal, hasMaxes),
    progressionModel: model,
    deloadFinalWeek: !peaking,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: firstDays,
    weekTemplates,
  };
}
