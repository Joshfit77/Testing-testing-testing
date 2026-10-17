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
    description: "Strength, power and fight-specific conditioning.",
    category: "mma-conditioning",
    programTypes: ["mma", "athletic"],
    primaryGoals: ["combat_sports", "improve_conditioning"],
    goals: [
      { id: "fight_camp", label: "I have a fight date", description: "Fight camp that peaks conditioning and tapers into fight week.", event: true, peaking: true },
      { id: "fight_shape", label: "General fight shape", description: "Year-round strength and conditioning alongside your skills training." },
      { id: "strength_power", label: "Strength & power focus", description: "More emphasis on getting stronger and more explosive." },
    ],
    days: { min: 2, max: 5, default: 3 },
    weeks: { min: 4, max: 12, default: 8 },
    eventLabel: "Weeks until your fight",
    lifts: [],
    cardioInput: false,
    defaultMinutes: 50,
  },
  cardio: {
    type: "cardio",
    label: "Cardiovascular",
    description: "Build your aerobic engine with zone 2, intervals and run/walk.",
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
    description: "Hypertrophy splits with progressive volume.",
    category: "hypertrophy",
    programTypes: ["hypertrophy"],
    primaryGoals: ["build_muscle"],
    goals: [
      { id: "mass", label: "Maximum muscle gain", description: "Balanced, high-volume training for overall size." },
      { id: "recomp", label: "Build muscle & get leaner", description: "Hypertrophy work plus short zone 2 finishers." },
      { id: "upper_emphasis", label: "Bring up my upper body", description: "Extra volume for chest, back, shoulders and arms." },
      { id: "lower_emphasis", label: "Bring up legs & glutes", description: "Extra volume for quads, hamstrings, glutes and calves." },
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
    description: "Pressing, pulling, carries and odd objects.",
    category: "strongman",
    programTypes: ["strongman", "strength"],
    primaryGoals: ["build_strength", "athletic_performance"],
    goals: [
      { id: "get_strongman_strong", label: "Get strongman strong", description: "Build the base: static strength plus event practice." },
      { id: "contest_prep", label: "Contest prep", description: "Peak for a strongman contest. The last week is contest week.", event: true, peaking: true },
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

function pickSlug(ctx: Ctx, options: string[], used: Set<string>): string | null {
  const available = options.filter((s) => usable(ctx, s) && !used.has(s));
  if (!available.length) return null;
  if (ctx.novice) {
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
  if (slot.reps) out.reps = slot.reps;
  if (slot.seconds) out.seconds = Math.max(5, Math.min(7200, Math.round(slot.seconds)));
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
  if (slot.notes) notes.push(slot.notes);
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
    const slug = pickSlug(ctx, slot.options, used);
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
  const minutes = Math.min(240, Math.max(ctx.input.sessionMinutes, Math.round(total() + 8)));
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

function strongmanDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const d = ctx.input.daysPerWeek;
  const carryTime = (wk: WeekPlan) => (wk.kind === "deload" ? 20 : wk.kind === "build" ? 40 + 5 * Math.min(wk.k, 2) : wk.kind === "base" ? 30 + 5 * Math.min(wk.k, 3) : 30);
  const press: DayBuilder = (wk) =>
    buildDay(ctx, "Overhead Day", "Log/axle-style pressing and upper back", [
      heavySlot(ctx, wk, "press", OPT.logPress, false),
      acc(ctx, wk, OPT.pushPress, "5", 150),
      acc(ctx, wk, OPT.row, "8", 90),
      acc(ctx, wk, OPT.triceps, "10-12", 60),
    ]);
  const squat: DayBuilder = (wk) =>
    buildDay(ctx, "Squat & Odd Objects", "Leg strength and loading odd objects", [
      heavySlot(ctx, wk, "squat", OPT.squat, false),
      acc(ctx, wk, OPT.stone, "2 per side", 120, { rpe: undefined, notes: "Smooth lap-to-platform or to-shoulder reps." }),
      acc(ctx, wk, OPT.yoke, "", 120, { seconds: carryTime(wk), reps: undefined, rpe: undefined, notes: "Short, fast steps; brace hard." }),
      acc(ctx, wk, OPT.core, "8-10", 60),
    ]);
  const pull: DayBuilder = (wk) =>
    buildDay(ctx, "Deadlift & Carries", "Pulling strength and grip", [
      heavySlot(ctx, wk, "deadlift", OPT.deadlift, false),
      acc(ctx, wk, OPT.carry, "", 120, { seconds: carryTime(wk), reps: undefined, rpe: undefined, notes: "Heavy farmer's walk — aim for unbroken." }),
      acc(ctx, wk, OPT.sandbag, "3", 90, { rpe: undefined }),
      acc(ctx, wk, OPT.grip, "", 60, { seconds: 40, reps: undefined, rpe: undefined }),
    ]);
  const medley: DayBuilder = (wk) =>
    buildDay(ctx, "Event Medley", "Event practice and conditioning", [
      acc(ctx, wk, OPT.sled, "", 120, { seconds: 30, reps: undefined, rpe: undefined, notes: "Medley: sled straight into a carry if you can." }),
      acc(ctx, wk, OPT.yoke, "", 120, { seconds: carryTime(wk), reps: undefined, rpe: undefined }),
      acc(ctx, wk, OPT.stone, "3", 120, { rpe: undefined }),
      acc(ctx, wk, OPT.carry, "", 90, { seconds: carryTime(wk), reps: undefined, rpe: undefined }),
    ]);
  const accessory: DayBuilder = (wk) =>
    buildDay(ctx, "Upper Accessories", "Pressing support and upper back", [
      volumeSlot(ctx, wk, "press", OPT.press),
      acc(ctx, wk, OPT.vPull, "8-10", 90),
      acc(ctx, wk, OPT.rearDelt, "15", 45),
      acc(ctx, wk, OPT.biceps, "12", 60, { notes: "Strong biceps help protect the elbow on stones." }),
    ]);
  void goal;
  if (d === 3) return [press, squat, pull];
  if (d === 4) return [press, squat, pull, medley];
  return [press, squat, accessory, pull, medley];
}

function mmaDays(ctx: Ctx, goal: GoalOption): DayBuilder[] {
  const d = ctx.input.daysPerWeek;
  const strengthBias = goal.id === "strength_power";
  const roundSecs = (wk: WeekPlan) => (wk.kind === "base" ? 180 : wk.kind === "build" || wk.kind === "peak" ? 300 : 120);
  const rounds = (wk: WeekPlan) =>
    wk.kind === "deload" || wk.kind === "test" ? 2 : wk.kind === "base" ? 3 + Math.min(wk.k, 2) : wk.kind === "build" ? 3 + Math.min(wk.k, 2) : 5;
  const power: DayBuilder = (wk) =>
    buildDay(ctx, "Power & Strength", "Explosive power, then heavy strength", [
      acc(ctx, wk, OPT.power, "3", 90, { rpe: undefined, sets: wk.kind === "deload" || wk.kind === "test" ? 2 : 4, notes: "Max intent; stop if speed drops." }),
      acc(ctx, wk, OPT.trapBar, strengthBias ? "3-5" : "4-6", 180, { main: true, sets: strengthBias ? ctx.mainSets : Math.max(3, ctx.mainSets - 1) }),
      acc(ctx, wk, OPT.landmine, "6 per side", 90),
      acc(ctx, wk, OPT.vPull, "5-8", 90),
      acc(ctx, wk, OPT.antiRotation, "10 per side", 45),
    ]);
  const energy: DayBuilder = (wk) =>
    buildDay(ctx, "Fight Rounds", "Round-based energy systems", [
      {
        options: OPT.bag,
        sets: rounds(wk),
        seconds: roundSecs(wk),
        rest: 60,
        notes:
          wk.kind === "base"
            ? "Steady pace you could hold for a full fight; focus on technique and breathing."
            : wk.kind === "deload" || wk.kind === "test"
              ? "Sharp and light — stay fast, stay fresh."
              : "Fight pace with surges: 10-second flurries every 30 seconds.",
      },
      {
        options: OPT.sprawl,
        sets: wk.kind === "deload" || wk.kind === "test" ? 3 : 6,
        seconds: 20,
        rest: 40,
        notes: "Sprawls or burpees: fast hips, stand back up into stance.",
      },
      {
        options: OPT.bikeSprint,
        sets: wk.kind === "base" ? 6 : wk.kind === "deload" || wk.kind === "test" ? 4 : 8,
        seconds: wk.kind === "base" ? 30 : 15,
        rest: wk.kind === "base" ? 60 : 45,
        notes: wk.kind === "base" ? "Hard 30 s / easy 60 s." : "All-out sprints with full-enough recovery to repeat them.",
      },
      acc(ctx, wk, OPT.core, "10", 45),
    ]);
  const grind: DayBuilder = (wk) =>
    buildDay(ctx, "Strength & Grappling Endurance", "Legs, pulling strength and grip", [
      acc(ctx, wk, OPT.frontSquat, "5", 150, { main: true, sets: ctx.mainSets - (strengthBias ? 0 : 1) }),
      acc(ctx, wk, OPT.row, "8", 90),
      acc(ctx, wk, OPT.pushUp, "10-15", 60),
      acc(ctx, wk, OPT.carry, "", 75, { seconds: 40, reps: undefined, rpe: undefined }),
      acc(ctx, wk, OPT.hipEscape, "", 45, { seconds: 30, reps: undefined, rpe: undefined }),
    ]);
  const aerobic: DayBuilder = (wk) =>
    buildDay(ctx, "Aerobic Base & Mobility", "Zone 2 conditioning and recovery", [
      {
        options: OPT.aerobic,
        sets: 1,
        seconds: (wk.kind === "deload" || wk.kind === "test" ? 20 : 30 + 5 * Math.min(wk.weekNumber - 1, 3)) * 60,
        rest: 0,
        notes: "Zone 2: nasal breathing or full sentences. Builds the engine that helps you recover between rounds.",
      },
      { options: OPT.mobility, sets: 2, seconds: 45, rest: 15 },
      { options: ["90-90-hip-switch", "couch-stretch", "thoracic-open-book"], sets: 2, seconds: 45, rest: 15 },
    ]);
  const power2: DayBuilder = (wk) =>
    buildDay(ctx, "Rotational Power & Upper Strength", "Punching power and upper-body strength", [
      acc(ctx, wk, OPT.rotational, "5 per side", 60, { rpe: undefined }),
      acc(ctx, wk, OPT.pushPress, "4", 150, { main: true }),
      acc(ctx, wk, OPT.vPull, "6-8", 90),
      acc(ctx, wk, OPT.splitSquat, "6 per side", 90),
      acc(ctx, wk, ["battle-rope-waves", "jump-rope", "shadowboxing"], "", 30, { seconds: 20, reps: undefined, rpe: undefined, sets: 6 }),
    ]);
  if (d === 2) return [power, energy];
  if (d === 3) return [power, energy, grind];
  if (d === 4) return [power, energy, grind, aerobic];
  return [power, energy, grind, aerobic, power2];
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

type Muscle = "chest" | "back" | "shoulders" | "arms" | "quads" | "hams" | "calves" | "core";

function bodybuildingDays(ctx: Ctx, goal: GoalOption, opts: { showPrep: boolean; division?: ShowDivision | null }): DayBuilder[] {
  const d = ctx.input.daysPerWeek;
  const upperBias = goal.id === "upper_emphasis" || opts.division === "mens_physique";
  const lowerBias = goal.id === "lower_emphasis" || opts.division === "bikini" || opts.division === "wellness";
  const finisher = goal.id === "recomp" || opts.showPrep;
  const hyp = (wk: WeekPlan, options: string[], reps: string, rest: number, muscle: Muscle, compound = false): Slot => {
    let sets = compound ? Math.max(3, ctx.mainSets - 1) : ctx.accSets;
    if (wk.kind === "base" && wk.k >= 2) sets += 1;
    if (wk.kind === "build") sets += 1;
    if (upperBias && ["chest", "back", "shoulders", "arms"].includes(muscle)) sets += 1;
    if (lowerBias && ["quads", "hams", "calves"].includes(muscle)) sets += 1;
    if (wk.kind === "deload") sets = Math.max(2, Math.round(sets * 0.6));
    if (wk.kind === "test") sets = Math.max(2, Math.round(sets * 0.5));
    // Peak weeks hold volume (show prep: conditioning peaks while training volume is kept).
    const rpe = wk.kind === "deload" || wk.kind === "test" ? 6 : wk.kind === "build" ? (compound ? 8.5 : 9) : compound ? 7.5 + 0.5 * Math.min(wk.k, 1) : 8;
    return { options, sets, reps, rest, rpe, main: compound };
  };
  const conditioning = (wk: WeekPlan): Slot | null => {
    if (!finisher) return null;
    const total = ctx.input.weeks;
    const prog = total <= 1 ? 1 : (wk.weekNumber - 1) / (total - 1);
    const mins = opts.showPrep ? Math.round(15 + 20 * prog) : 15;
    const actual = wk.kind === "test" ? 15 : wk.kind === "deload" ? Math.round(mins * 0.7) : mins;
    return {
      options: ["brisk-walk", "bike-intervals", "stair-climb", "rowing-intervals"],
      sets: 1,
      seconds: actual * 60,
      rest: 0,
      notes: "Low-intensity cardio (zone 2) after lifting.",
      // Conditioning is part of the plan, so trim isolation work before it.
      main: true,
    };
  };
  const day = (name: string, focus: string, slots: (wk: WeekPlan) => (Slot | null)[]): DayBuilder => (wk) =>
    buildDay(ctx, name, focus, [...slots(wk), conditioning(wk)].filter((s): s is Slot => s !== null));

  const upperA = day("Upper A", "Chest and back", (wk) => [
    hyp(wk, OPT.inclinePress, "6-10", 120, "chest", true),
    hyp(wk, OPT.vPull, "8-12", 90, "back", true),
    hyp(wk, ["seated-cable-row", "one-arm-dumbbell-row", "barbell-row", "band-row"], "10-12", 90, "back"),
    hyp(wk, OPT.fly, "12-15", 60, "chest"),
    hyp(wk, OPT.lateral, "15-20", 45, "shoulders"),
    hyp(wk, OPT.triceps, "10-15", 60, "arms"),
  ]);
  const lowerA = day("Lower A", "Quads and calves", (wk) => [
    hyp(wk, ["back-squat", "leg-press", "goblet-squat", "bulgarian-split-squat"], "6-10", 150, "quads", true),
    hyp(wk, OPT.rdl, "8-10", 120, "hams", true),
    hyp(wk, OPT.legExt, "12-15", 60, "quads"),
    hyp(wk, OPT.legCurl, "10-15", 60, "hams"),
    hyp(wk, OPT.calf, "12-15", 45, "calves"),
    hyp(wk, OPT.core, "10-15", 45, "core"),
  ]);
  const upperB = day("Upper B", "Shoulders, back and arms", (wk) => [
    hyp(wk, ["seated-dumbbell-shoulder-press", "overhead-press", "landmine-press"], "8-10", 120, "shoulders", true),
    hyp(wk, ["one-arm-dumbbell-row", "barbell-row", "seated-cable-row", "inverted-row"], "8-12", 90, "back", true),
    hyp(wk, ["dumbbell-bench-press", "bench-press", "push-up"], "8-12", 90, "chest"),
    hyp(wk, OPT.rearDelt, "15", 45, "shoulders"),
    hyp(wk, OPT.biceps, "10-12", 60, "arms"),
    hyp(wk, OPT.ohTriceps, "10-12", 60, "arms"),
  ]);
  const lowerB = day("Lower B", "Hamstrings and glutes", (wk) => [
    hyp(wk, ["romanian-deadlift", "trap-bar-deadlift", "single-leg-rdl"], "8-10", 150, "hams", true),
    hyp(wk, OPT.hipThrust, "8-12", 90, "hams", true),
    hyp(wk, OPT.splitSquat, "10 per side", 90, "quads"),
    hyp(wk, OPT.legCurl, "12-15", 60, "hams"),
    hyp(wk, OPT.calf, "15-20", 45, "calves"),
  ]);
  const push = day("Push", "Chest, shoulders and triceps", (wk) => [
    hyp(wk, ["bench-press", "dumbbell-bench-press", "push-up"], "6-10", 150, "chest", true),
    hyp(wk, ["seated-dumbbell-shoulder-press", "overhead-press", "landmine-press"], "8-12", 90, "shoulders", true),
    hyp(wk, OPT.fly, "12-15", 60, "chest"),
    hyp(wk, OPT.lateral, "15-20", 45, "shoulders"),
    hyp(wk, OPT.triceps, "10-15", 60, "arms"),
  ]);
  const pull = day("Pull", "Back, rear delts and biceps", (wk) => [
    hyp(wk, OPT.vPull, "6-10", 120, "back", true),
    hyp(wk, ["barbell-row", "seated-cable-row", "one-arm-dumbbell-row"], "8-12", 90, "back", true),
    hyp(wk, OPT.rearDelt, "15", 45, "shoulders"),
    hyp(wk, OPT.biceps, "10-12", 60, "arms"),
    hyp(wk, ["hammer-curl", "dumbbell-curl"], "12", 60, "arms"),
  ]);
  const legs = day("Legs", "Quads, hamstrings and calves", (wk) => [
    hyp(wk, ["back-squat", "leg-press", "goblet-squat"], "6-10", 150, "quads", true),
    hyp(wk, OPT.rdl, "8-10", 120, "hams", true),
    hyp(wk, OPT.lunge, "10 per side", 90, "quads"),
    hyp(wk, OPT.legCurl, "12-15", 60, "hams"),
    hyp(wk, OPT.calf, "12-15", 45, "calves"),
  ]);
  const fullA = day("Full Body A", "Squat, press and pull", (wk) => [
    hyp(wk, ["back-squat", "goblet-squat", "leg-press"], "6-10", 150, "quads", true),
    hyp(wk, ["bench-press", "dumbbell-bench-press", "push-up"], "8-10", 120, "chest", true),
    hyp(wk, OPT.vPull, "8-12", 90, "back"),
    hyp(wk, OPT.lateral, "15", 45, "shoulders"),
    hyp(wk, OPT.biceps, "12", 60, "arms"),
  ]);
  const fullB = day("Full Body B", "Hinge, incline and row", (wk) => [
    hyp(wk, ["romanian-deadlift", "trap-bar-deadlift", "single-leg-rdl"], "8-10", 150, "hams", true),
    hyp(wk, OPT.inclinePress, "8-12", 120, "chest", true),
    hyp(wk, ["barbell-row", "one-arm-dumbbell-row", "seated-cable-row"], "10-12", 90, "back"),
    hyp(wk, OPT.legExt, "12-15", 60, "quads"),
    hyp(wk, OPT.triceps, "12", 60, "arms"),
  ]);
  const fullC = day("Full Body C", "Single-leg, shoulders and arms", (wk) => [
    hyp(wk, OPT.splitSquat, "10 per side", 90, "quads", true),
    hyp(wk, ["seated-dumbbell-shoulder-press", "overhead-press", "landmine-press"], "8-12", 90, "shoulders", true),
    hyp(wk, ["seated-cable-row", "inverted-row", "band-row"], "10-12", 75, "back"),
    hyp(wk, OPT.legCurl, "12-15", 60, "hams"),
    hyp(wk, OPT.calf, "15", 45, "calves"),
  ]);
  if (d === 3) return [fullA, fullB, fullC];
  if (d === 4) return [upperA, lowerA, upperB, lowerB];
  if (d === 5) return [upperA, lowerA, push, pull, legs];
  return [push, pull, legs, upperA, lowerB, upperB];
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
      acc(ctx, wk, ["pallof-press", "side-plank"], "10 per side", 45),
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
      if (type === "mma") return "Peak conditioning: fight-length rounds at fight pace";
      if (type === "show_prep") return "Peak conditioning: hold volume, daily posing practice, follow your coach's plan";
      if (type === "cardio") return goal.id === "first_5k" ? "Biggest week: your longest easy runs so far" : "Sharpen: a little faster, a little less volume";
      return lifting ? "Peak: heavy singles with reduced volume" : "Sharpen: high quality, reduced volume";
    case "test":
      if (type === "mma") return "Fight week taper: short, sharp sessions — arrive fresh";
      if (type === "show_prep") return "Show week taper: reduced training volume and posing practice; peak week guided by your coach";
      if (type === "cardio") return goal.id === "first_5k" ? "5K week: lighter early, then your first 5K-length run" : "Test week: lighter sessions, then a benchmark effort";
      if (type === "speed") return "Taper and test: time your sprints fully rested";
      if (type === "agility") return "Taper and test: time your 5-10-5 fully rested";
      return goal.id === "meet_prep" || goal.id === "contest_prep" ? "Meet week: openers early in the week, then compete" : "Test week: taper, then test your new max";
    case "base":
      if (lifting) return "Accumulation: build volume at moderate loads";
      if (type === "cardio") return "Base: easy aerobic volume, gradually extended";
      if (type === "speed" || type === "agility") return "Mechanics: technique first, full recovery between reps";
      return "Base: build volume and work capacity";
    case "build":
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
      return "Add a rep or a little load when you reach the top of a rep range, keeping 1–2 reps in reserve. Sets increase through each block, then deload.";
    case "mma":
      return "Strength work follows RPE; conditioning progresses from aerobic base to fight-pace rounds. Planned lighter weeks keep you fresh for skills training.";
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

  const builders: DayBuilder[] = (() => {
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
        return bodybuildingDays(ctx, goal, { showPrep: false });
      case "show_prep":
        return bodybuildingDays(ctx, goal, { showPrep: true, division: input.division });
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
        ? ["5 minutes jump rope or shadowboxing", "Hip openers and world's greatest stretch × 3 per side", "2 × 10-second build-up efforts"]
        : undefined;
  const posing =
    input.type === "show_prep"
      ? [
          `Posing practice — ${input.division ? SHOW_DIVISION_LABELS[input.division] : "your division's"} mandatory poses and transitions, 10–20 minutes`,
          ...STANDARD_COOLDOWN,
        ]
      : undefined;

  const weekTemplates: ProgramWeekSeed[] = plans.map((wk) => ({
    focus: weekFocus(input.type, wk, goal),
    isDeload: wk.kind === "deload",
    days: builders.map((b) => {
      const day = b(wk);
      return { ...day, ...(dayWarmup ? { warmup: dayWarmup } : {}), ...(posing ? { cooldown: posing } : {}) };
    }),
  }));

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
  if (input.type === "show_prep")
    notes.push(
      "Nutrition, cardio adjustments and peak-week strategy should be guided by a qualified coach or registered dietitian. This program does not prescribe extreme dieting or dehydration — stay fueled and hydrated.",
    );
  if (input.type === "cardio" && goal.id === "fat_loss")
    notes.push("Fat loss mainly comes from a sustainable calorie deficit; this plan supports it with activity and strength work to protect muscle.");
  if (input.type === "mma") notes.push("Schedule these sessions around your skills training. Hard sparring days count as conditioning.");
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
