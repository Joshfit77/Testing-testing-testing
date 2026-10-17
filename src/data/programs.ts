import type { Difficulty, Equipment, Plan, PrimaryGoal, ProgramType } from "@/lib/domain/types";

export interface ProgramExerciseSeed {
  ex: string;
  sets: number;
  reps?: string;
  seconds?: number;
  rest: number;
  rpe?: number;
  intensity?: string;
  notes?: string;
}

export interface ProgramDaySeed {
  name: string;
  focus: string;
  minutes: number;
  warmup?: string[];
  cooldown?: string[];
  exercises: ProgramExerciseSeed[];
}

export type ProgressionModel = "linear_rpe" | "volume_wave" | "steady" | "density";

/** One explicitly prescribed week (used by periodized programs with week-specific loads). */
export interface ProgramWeekSeed {
  focus: string;
  isDeload?: boolean;
  days: ProgramDaySeed[];
}

export interface ProgramSeed {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  types: ProgramType[];
  difficulty: Difficulty;
  weeks: number;
  sessionMinutes: number;
  goals: PrimaryGoal[];
  equipment: Equipment[];
  tier: Plan;
  lowImpact?: boolean;
  progression: string;
  progressionModel: ProgressionModel;
  /** Insert a deload as the final week. */
  deloadFinalWeek?: boolean;
  warmup: string[];
  cooldown: string[];
  /** The weekly template (or, with `weekTemplates`, the first week's days — used for summaries). */
  days: ProgramDaySeed[];
  /**
   * Optional explicit prescription for every week. When present it must contain exactly `weeks`
   * entries; each week is used verbatim (no generic progression is applied).
   */
  weekTemplates?: ProgramWeekSeed[];
}

export interface CategorySeed {
  slug: string;
  name: string;
  description: string;
}

export const PROGRAM_CATEGORIES: CategorySeed[] = [
  { slug: "strength", name: "Strength Training", description: "Get measurably stronger on fundamental lifts." },
  { slug: "powerlifting", name: "Powerlifting", description: "Squat, bench press and deadlift focused training." },
  { slug: "bench-press", name: "Bench Press Specialization", description: "Higher-frequency bench training to drive up your press." },
  { slug: "squat-specialization", name: "Squat Specialization", description: "Focused squat volume, variations and support work." },
  { slug: "deadlift-specialization", name: "Deadlift Specialization", description: "Pull more: deadlift variations plus posterior-chain strength." },
  { slug: "strongman", name: "Strongman", description: "Odd objects, carries and full-body strength." },
  { slug: "hypertrophy", name: "Bodybuilding & Hypertrophy", description: "Build muscle with productive volume." },
  { slug: "show-prep", name: "Physique Show Prep", description: "Hypertrophy and conditioning for a bodybuilding or physique stage." },
  { slug: "athletic-performance", name: "Explosive Athletic Performance", description: "Power, speed and resilient athleticism." },
  { slug: "speed", name: "Speed Training", description: "Sprint mechanics, acceleration and maximal velocity." },
  { slug: "agility", name: "Agility & Change of Direction", description: "Footwork, cutting and reactive agility drills." },
  { slug: "mma-conditioning", name: "MMA Conditioning", description: "Energy systems and strength for mixed martial arts." },
  { slug: "boxing-conditioning", name: "Boxing Conditioning", description: "Round-based work capacity, footwork and shoulder endurance." },
  { slug: "grappling-conditioning", name: "Wrestling & Grappling Conditioning", description: "Grip, hips and repeat-effort endurance for the mat." },
  { slug: "functional-conditioning", name: "Functional Conditioning", description: "Mixed-modal, high-variety conditioning circuits." },
  { slug: "weight-loss-cardio", name: "Weight Loss & Cardio", description: "Sustainable activity to support fat loss and heart health." },
  { slug: "cardiovascular", name: "Cardiovascular Endurance", description: "Build your aerobic engine: zone 2, intervals and run/walk progressions." },
  { slug: "beginner", name: "Beginner Training", description: "Learn the basics and build a consistent habit." },
  { slug: "womens-strength", name: "Women's Strength Training", description: "Progressive strength training designed with women's goals and feedback in mind — not lighter by default." },
  { slug: "active-aging", name: "Active Aging & Low-Impact", description: "Joint-friendly strength, balance and mobility." },
  { slug: "home-workouts", name: "Home Workouts", description: "Effective sessions with minimal equipment." },
  { slug: "mobility-flexibility", name: "Mobility & Flexibility", description: "Move better and feel better." },
  { slug: "recovery-deload", name: "Recovery & Deload", description: "Planned lower-stress weeks to absorb training." },
];

export const STANDARD_WARMUP = [
  "3–5 minutes easy cardio (walk, bike, rower or skipping)",
  "World's greatest stretch × 3 per side",
  "Bodyweight squats × 10",
  "Band pull-aparts or arm circles × 15",
  "2–3 ramp-up sets of your first lift, building toward working weight",
];

export const STANDARD_COOLDOWN = [
  "3–5 minutes easy walking or cycling to bring heart rate down",
  "Child's pose — 60 seconds",
  "Figure-four glute stretch — 30–45 seconds per side",
  "Slow nasal breathing — 1–2 minutes",
];

const LOW_IMPACT_WARMUP = [
  "3–5 minutes standing march or easy walk",
  "Cat-cow × 8 slow breaths",
  "Sit-to-stand × 5, slow and controlled",
  "Arm circles × 10 each direction",
];

const CONDITIONING_WARMUP = [
  "5 minutes easy jump rope, bike or shadowboxing",
  "Lateral shuffles × 20 seconds each way",
  "World's greatest stretch × 3 per side",
  "2 × 10-second build-up efforts at moderate intensity",
];

export const SPRINT_WARMUP = [
  "5 minutes easy jog, skipping or jump rope",
  "Leg swings front-to-back and side-to-side × 10 each leg",
  "World's greatest stretch × 3 per side",
  "A-skips and wall drills × 2 rounds",
  "3 build-up runs of 30–40 m at 60%, 75% and 90% effort",
];

const secondsLabel = (s: number) => (s % 60 === 0 ? `${s / 60} min` : `${s} s`);

/** Run/walk progression: [run A, walk A, rounds A, run B, walk B, rounds B] in seconds per week. */
const RUN_WALK_WEEKS: ProgramWeekSeed[] = (
  [
    [60, 90, 8, 90, 120, 7],
    [90, 90, 8, 120, 90, 7],
    [120, 60, 8, 180, 90, 6],
    [180, 90, 5, 300, 90, 4],
    [300, 90, 4, 480, 120, 3],
    [600, 120, 2, 900, 120, 2],
    [1080, 0, 1, 1320, 0, 1],
    [900, 0, 1, 1800, 0, 1],
  ] as const
).map(([runA, walkA, roundsA, runB, walkB, roundsB], i) => {
  const session = (run: number, walk: number, rounds: number): ProgramExerciseSeed =>
    walk === 0
      ? { ex: "zone-2-run", sets: 1, seconds: run, rest: 0, notes: `${secondsLabel(run)} of continuous easy, conversational running.` }
      : {
          ex: "run-walk-intervals",
          sets: rounds,
          seconds: run,
          rest: walk,
          notes: `Run ${secondsLabel(run)} easy, then walk briskly for ${secondsLabel(walk)} (the rest). ${rounds} rounds.`,
        };
  return {
    focus: i === 7 ? "Goal week: an easier start, then 30 minutes of continuous running" : `Build easy running time (week ${i + 1})`,
    days: [
      { name: i >= 6 ? "Continuous Run" : "Run/Walk A", focus: "Easy running", minutes: 35, exercises: [session(runA, walkA, roundsA)] },
      {
        name: "Steady Walk",
        focus: "Aerobic base, low impact",
        minutes: 35,
        exercises: [{ ex: "brisk-walk", sets: 1, seconds: 1800, rest: 0, notes: "Conversational pace; add incline if it feels too easy." }],
      },
      { name: i >= 6 ? "Long Run" : "Run/Walk B", focus: "Longer easy running", minutes: 40, exercises: [session(runB, walkB, roundsB)] },
    ],
  };
});

export const PROGRAMS: ProgramSeed[] = [
  // ------------------------------------------------------------ Beginner (free)
  {
    slug: "foundations-full-body",
    name: "Foundations: Full-Body Strength",
    summary: "Three full-body sessions a week to learn the core movement patterns.",
    description:
      "A gentle, structured entry into strength training. Each session covers a squat, hinge, push, pull and core pattern with " +
      "dumbbells and bodyweight. You'll leave every session feeling like you could have done a little more — that's intentional.",
    category: "beginner",
    types: ["strength", "home"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 45,
    goals: ["general_health", "build_strength", "build_muscle", "lose_fat"],
    equipment: ["dumbbell", "bodyweight", "bench"],
    tier: "free",
    progression:
      "When you complete every set at the top of the rep range with good form at or below the target RPE, increase the load by the smallest " +
      "available increment next session. Week 6 is a lighter consolidation week.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Full Body A",
        focus: "Squat & push",
        minutes: 45,
        exercises: [
          { ex: "goblet-squat", sets: 3, reps: "8-12", rest: 90, rpe: 6 },
          { ex: "dumbbell-bench-press", sets: 3, reps: "8-12", rest: 90, rpe: 6 },
          { ex: "one-arm-dumbbell-row", sets: 3, reps: "10-12", rest: 75, rpe: 6 },
          { ex: "glute-bridge", sets: 2, reps: "12-15", rest: 60, rpe: 6 },
          { ex: "dead-bug", sets: 2, reps: "6-8 per side", rest: 45 },
        ],
      },
      {
        name: "Full Body B",
        focus: "Hinge & pull",
        minutes: 45,
        exercises: [
          { ex: "romanian-deadlift", sets: 3, reps: "8-10", rest: 90, rpe: 6, notes: "Use dumbbells." },
          { ex: "incline-push-up", sets: 3, reps: "8-12", rest: 75, rpe: 6 },
          { ex: "band-row", sets: 3, reps: "12-15", rest: 60, rpe: 6 },
          { ex: "reverse-lunge", sets: 2, reps: "8 per side", rest: 75, rpe: 6 },
          { ex: "plank", sets: 2, seconds: 30, rest: 45 },
        ],
      },
      {
        name: "Full Body C",
        focus: "Single-leg & shoulders",
        minutes: 45,
        exercises: [
          { ex: "step-up", sets: 3, reps: "8 per side", rest: 75, rpe: 6 },
          { ex: "seated-dumbbell-shoulder-press", sets: 3, reps: "8-12", rest: 90, rpe: 6 },
          { ex: "one-arm-dumbbell-row", sets: 3, reps: "10-12", rest: 75, rpe: 6 },
          { ex: "glute-bridge", sets: 2, reps: "12-15", rest: 60 },
          { ex: "farmers-carry", sets: 3, seconds: 30, rest: 60, notes: "Moderate weight; tall posture." },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Home (free)
  {
    slug: "home-bodyweight-strength",
    name: "Home Strength: Bodyweight Builder",
    summary: "No gym needed — progressive bodyweight strength in 30–40 minutes.",
    description:
      "Built for living rooms, hotel rooms and garages. Progress by adding reps, slowing tempo, and moving to harder variations. " +
      "Only a mat is required; a resistance band and pull-up bar unlock extra options.",
    category: "home-workouts",
    types: ["home", "strength"],
    difficulty: "beginner",
    weeks: 4,
    sessionMinutes: 35,
    goals: ["general_health", "build_strength", "lose_fat"],
    equipment: ["bodyweight", "mat", "band"],
    tier: "free",
    progression:
      "Add 1–2 reps per set each week. Once you can do the top of every range, slow the lowering phase to 3 seconds or progress the " +
      "variation (e.g. incline push-up → push-up).",
    progressionModel: "volume_wave",
    warmup: ["3 minutes marching or skipping", "Cat-cow × 8", "Bodyweight squats × 10", "World's greatest stretch × 2 per side"],
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Lower & Core",
        focus: "Legs and trunk",
        minutes: 35,
        exercises: [
          { ex: "bodyweight-squat", sets: 3, reps: "12-20", rest: 60, rpe: 7 },
          { ex: "reverse-lunge", sets: 3, reps: "8-12 per side", rest: 60, rpe: 7 },
          { ex: "glute-bridge", sets: 3, reps: "15-20", rest: 45 },
          { ex: "side-plank", sets: 2, seconds: 25, rest: 30, notes: "Per side." },
          { ex: "dead-bug", sets: 2, reps: "8 per side", rest: 30 },
        ],
      },
      {
        name: "Upper Push & Pull",
        focus: "Chest, shoulders and back",
        minutes: 35,
        exercises: [
          { ex: "push-up", sets: 4, reps: "6-15", rest: 75, rpe: 7, notes: "Use incline push-ups if needed." },
          { ex: "band-row", sets: 4, reps: "12-15", rest: 60 },
          { ex: "pike-push-up", sets: 3, reps: "5-10", rest: 75 },
          { ex: "band-pull-apart", sets: 2, reps: "15-20", rest: 45 },
          { ex: "plank", sets: 2, seconds: 40, rest: 45 },
        ],
      },
      {
        name: "Conditioning Circuit",
        focus: "Full-body work capacity",
        minutes: 30,
        exercises: [
          { ex: "step-back-burpee", sets: 4, seconds: 30, rest: 30 },
          { ex: "mountain-climber", sets: 4, seconds: 30, rest: 30 },
          { ex: "bodyweight-squat", sets: 4, seconds: 30, rest: 30 },
          { ex: "bear-crawl", sets: 4, seconds: 20, rest: 40 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Strength (plus)
  {
    slug: "barbell-strength-foundations",
    name: "Barbell Strength: Linear Progression",
    summary: "Three barbell sessions a week built on the big compound lifts.",
    description:
      "A classic approach for newer lifters with access to a barbell: train the main lifts frequently, add weight in small jumps, " +
      "and recover well. Accessories are kept minimal so the main work stays fresh.",
    category: "strength",
    types: ["strength", "powerlifting"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: 60,
    goals: ["build_strength", "build_muscle"],
    equipment: ["barbell", "rack", "bench", "pull_up_bar"],
    tier: "plus",
    progression:
      "Add 2.5 kg / 5 lb to upper-body lifts and 2.5–5 kg / 5–10 lb to lower-body lifts each session while all reps are completed at RPE 8 " +
      "or below. If you miss reps twice in a row on a lift, reduce that lift by 10% and build back up. Week 8 is a deload.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Day A",
        focus: "Squat, bench, row",
        minutes: 60,
        exercises: [
          { ex: "back-squat", sets: 3, reps: "5", rest: 180, rpe: 7 },
          { ex: "bench-press", sets: 3, reps: "5", rest: 180, rpe: 7 },
          { ex: "barbell-row", sets: 3, reps: "8", rest: 120, rpe: 7 },
          { ex: "plank", sets: 2, seconds: 45, rest: 60 },
        ],
      },
      {
        name: "Day B",
        focus: "Squat, press, deadlift",
        minutes: 60,
        exercises: [
          { ex: "back-squat", sets: 3, reps: "5", rest: 180, rpe: 7 },
          { ex: "overhead-press", sets: 3, reps: "5", rest: 180, rpe: 7 },
          { ex: "conventional-deadlift", sets: 1, reps: "5", rest: 180, rpe: 7, notes: "One top set after warm-ups." },
          { ex: "chin-up", sets: 3, reps: "5-8", rest: 120, notes: "Use band assistance if needed." },
        ],
      },
      {
        name: "Day C",
        focus: "Squat, bench, accessories",
        minutes: 60,
        exercises: [
          { ex: "back-squat", sets: 3, reps: "5", rest: 180, rpe: 7 },
          { ex: "bench-press", sets: 3, reps: "5", rest: 180, rpe: 7 },
          { ex: "romanian-deadlift", sets: 3, reps: "8", rest: 120, rpe: 7 },
          { ex: "face-pull", sets: 3, reps: "15", rest: 60 },
          { ex: "hanging-knee-raise", sets: 3, reps: "8-12", rest: 60 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Powerlifting (plus)
  {
    slug: "powerlifting-base-block",
    name: "Powerlifting Base Block",
    summary: "Four days of RPE-driven squat, bench and deadlift training.",
    description:
      "An intermediate block to build strength and technique in the competition lifts. Intensity is autoregulated with RPE so the plan " +
      "adapts to your day. Includes variation lifts and targeted accessories.",
    category: "powerlifting",
    types: ["powerlifting", "strength"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 75,
    goals: ["build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable"],
    tier: "plus",
    progression:
      "Target RPE rises by about 0.5 each week (weeks 1–3, then 5–7). Week 4 drops volume slightly. If a top set feels harder than " +
      "the target RPE, keep the weight and repeat it next week. Week 8 is a deload before re-testing.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Squat Focus",
        focus: "Competition squat + posterior chain",
        minutes: 75,
        exercises: [
          { ex: "back-squat", sets: 4, reps: "4", rest: 210, rpe: 7, intensity: "~75–80% 1RM" },
          { ex: "romanian-deadlift", sets: 3, reps: "8", rest: 150, rpe: 7 },
          { ex: "bulgarian-split-squat", sets: 3, reps: "8 per side", rest: 90 },
          { ex: "ab-wheel-rollout", sets: 3, reps: "8-10", rest: 60 },
        ],
      },
      {
        name: "Bench Focus",
        focus: "Competition bench + upper back",
        minutes: 70,
        exercises: [
          { ex: "bench-press", sets: 5, reps: "4", rest: 180, rpe: 7, intensity: "~75–80% 1RM" },
          { ex: "barbell-row", sets: 4, reps: "8", rest: 120, rpe: 7 },
          { ex: "incline-dumbbell-press", sets: 3, reps: "10", rest: 90 },
          { ex: "face-pull", sets: 3, reps: "15", rest: 60 },
          { ex: "triceps-pushdown", sets: 3, reps: "12", rest: 60 },
        ],
      },
      {
        name: "Deadlift Focus",
        focus: "Competition deadlift + quads",
        minutes: 75,
        exercises: [
          { ex: "conventional-deadlift", sets: 4, reps: "3", rest: 240, rpe: 7, intensity: "~78–83% 1RM", notes: "Pull sumo if that is your competition stance." },
          { ex: "front-squat", sets: 3, reps: "5", rest: 150, rpe: 7 },
          { ex: "lat-pulldown", sets: 3, reps: "10", rest: 90 },
          { ex: "side-plank", sets: 3, seconds: 30, rest: 45 },
        ],
      },
      {
        name: "Bench Volume",
        focus: "Bench variation + shoulders",
        minutes: 60,
        exercises: [
          { ex: "close-grip-bench-press", sets: 4, reps: "6", rest: 150, rpe: 7 },
          { ex: "overhead-press", sets: 3, reps: "6", rest: 120, rpe: 7 },
          { ex: "one-arm-dumbbell-row", sets: 3, reps: "10 per side", rest: 75 },
          { ex: "dips", sets: 3, reps: "8-12", rest: 90 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Hypertrophy (plus)
  {
    slug: "hypertrophy-upper-lower",
    name: "Hypertrophy: Upper / Lower Split",
    summary: "Four sessions per week with productive volume for muscle growth.",
    description:
      "Each muscle group is trained twice a week with a mix of compound and isolation work in moderate rep ranges. " +
      "Sets are taken close to — but not past — technical failure to balance stimulus and recovery.",
    category: "hypertrophy",
    types: ["hypertrophy"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 65,
    goals: ["build_muscle", "build_strength"],
    equipment: ["barbell", "dumbbell", "bench", "cable", "machine", "rack"],
    tier: "plus",
    progression:
      "Use double progression: once you hit the top of the rep range on all sets at the target RPE, add load. Weeks 1–3 build volume, " +
      "week 4 adds one set to the first two exercises, weeks 5–7 push intensity, week 8 deloads.",
    progressionModel: "volume_wave",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Upper A",
        focus: "Chest & back emphasis",
        minutes: 65,
        exercises: [
          { ex: "bench-press", sets: 4, reps: "6-8", rest: 150, rpe: 8 },
          { ex: "one-arm-dumbbell-row", sets: 4, reps: "8-12", rest: 90, rpe: 8 },
          { ex: "incline-dumbbell-press", sets: 3, reps: "10-12", rest: 90, rpe: 8 },
          { ex: "lat-pulldown", sets: 3, reps: "10-12", rest: 90, rpe: 8 },
          { ex: "lateral-raise", sets: 3, reps: "12-20", rest: 60 },
          { ex: "triceps-pushdown", sets: 3, reps: "12-15", rest: 60 },
        ],
      },
      {
        name: "Lower A",
        focus: "Quad emphasis",
        minutes: 65,
        exercises: [
          { ex: "back-squat", sets: 4, reps: "6-8", rest: 180, rpe: 8 },
          { ex: "romanian-deadlift", sets: 3, reps: "8-10", rest: 120, rpe: 8 },
          { ex: "leg-press", sets: 3, reps: "10-15", rest: 120, rpe: 8 },
          { ex: "leg-extension", sets: 3, reps: "12-15", rest: 60 },
          { ex: "standing-calf-raise", sets: 4, reps: "10-15", rest: 60 },
        ],
      },
      {
        name: "Upper B",
        focus: "Shoulders & arms emphasis",
        minutes: 65,
        exercises: [
          { ex: "overhead-press", sets: 4, reps: "6-8", rest: 150, rpe: 8 },
          { ex: "pull-up", sets: 4, reps: "6-10", rest: 120, rpe: 8 },
          { ex: "dumbbell-bench-press", sets: 3, reps: "10-12", rest: 90 },
          { ex: "seated-cable-row", sets: 3, reps: "10-12", rest: 90 },
          { ex: "dumbbell-curl", sets: 3, reps: "10-15", rest: 60 },
          { ex: "face-pull", sets: 3, reps: "15-20", rest: 60 },
        ],
      },
      {
        name: "Lower B",
        focus: "Hamstring & glute emphasis",
        minutes: 65,
        exercises: [
          { ex: "conventional-deadlift", sets: 3, reps: "5", rest: 180, rpe: 7 },
          { ex: "bulgarian-split-squat", sets: 3, reps: "8-12 per side", rest: 90, rpe: 8 },
          { ex: "hip-thrust", sets: 3, reps: "8-12", rest: 90, rpe: 8 },
          { ex: "leg-curl", sets: 3, reps: "10-15", rest: 60 },
          { ex: "hanging-knee-raise", sets: 3, reps: "10-15", rest: 60 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Women's strength (plus)
  {
    slug: "womens-strength-progression",
    name: "Strong Foundations: Women's Strength",
    summary: "A full-body strength plan that progresses load — not just reps — three days a week.",
    description:
      "Shaped by feedback from women lifters who wanted real strength progression rather than 'toning' circuits. The emphasis is on " +
      "heavy compound lifts, upper-body pulling strength and glute development, with adjustable volume. Pick weights that challenge " +
      "you — there is nothing in this plan that assumes you should lift light.",
    category: "womens-strength",
    types: ["strength", "hypertrophy"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: 55,
    goals: ["build_strength", "build_muscle", "general_health", "lose_fat"],
    equipment: ["barbell", "dumbbell", "bench", "rack", "pull_up_bar", "band"],
    tier: "plus",
    progression:
      "Add load when all reps are completed at or below the target RPE. Pull-ups progress from band-assisted to bodyweight by using " +
      "lighter bands every 1–2 weeks. Week 8 is a deload.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Strength A",
        focus: "Squat & horizontal press",
        minutes: 55,
        exercises: [
          { ex: "back-squat", sets: 4, reps: "5-6", rest: 150, rpe: 7 },
          { ex: "dumbbell-bench-press", sets: 3, reps: "6-8", rest: 120, rpe: 7 },
          { ex: "band-assisted-pull-up", sets: 3, reps: "5-8", rest: 120 },
          { ex: "hip-thrust", sets: 3, reps: "8-10", rest: 90, rpe: 8 },
          { ex: "pallof-press", sets: 2, reps: "10 per side", rest: 45 },
        ],
      },
      {
        name: "Strength B",
        focus: "Hinge & overhead press",
        minutes: 55,
        exercises: [
          { ex: "trap-bar-deadlift", sets: 4, reps: "5", rest: 180, rpe: 7, notes: "Use a conventional deadlift if no trap bar." },
          { ex: "overhead-press", sets: 3, reps: "6-8", rest: 120, rpe: 7 },
          { ex: "one-arm-dumbbell-row", sets: 3, reps: "8-10 per side", rest: 90 },
          { ex: "walking-lunge", sets: 3, reps: "10 per side", rest: 90 },
          { ex: "farmers-carry", sets: 3, seconds: 40, rest: 60 },
        ],
      },
      {
        name: "Strength C",
        focus: "Single-leg & upper volume",
        minutes: 55,
        exercises: [
          { ex: "bulgarian-split-squat", sets: 3, reps: "8 per side", rest: 90, rpe: 7 },
          { ex: "romanian-deadlift", sets: 3, reps: "8", rest: 120, rpe: 7 },
          { ex: "push-up", sets: 3, reps: "AMRAP", rest: 90, notes: "Stop 1–2 reps before form breaks." },
          { ex: "lat-pulldown", sets: 3, reps: "10-12", rest: 90 },
          { ex: "side-plank", sets: 2, seconds: 30, rest: 45 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Strongman (plus)
  {
    slug: "strongman-foundations",
    name: "Strongman Foundations",
    summary: "Build odd-object strength, carries and pressing power with gym-accessible tools.",
    description:
      "A strongman-inspired program that uses equipment found in many gyms — sandbags, sleds, dumbbells and barbells — to develop " +
      "full-body strength, grip and conditioning. Event days end with a medley for work capacity.",
    category: "strongman",
    types: ["strongman", "strength"],
    difficulty: "intermediate",
    weeks: 6,
    sessionMinutes: 70,
    goals: ["build_strength", "athletic_performance"],
    equipment: ["barbell", "rack", "sandbag", "sled", "dumbbell", "kettlebell"],
    tier: "plus",
    progression:
      "Increase carry distance/time or load by 5–10% each week when all sets are completed with good posture. Pressing follows RPE " +
      "progression. Week 6 deloads volume by ~40%.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Press & Carry",
        focus: "Overhead strength and loaded carries",
        minutes: 70,
        exercises: [
          { ex: "push-press", sets: 5, reps: "3", rest: 180, rpe: 7 },
          { ex: "overhead-press", sets: 3, reps: "6", rest: 120, rpe: 7 },
          { ex: "farmers-carry", sets: 4, seconds: 40, rest: 120, notes: "Heavy; aim for unbroken." },
          { ex: "barbell-row", sets: 3, reps: "8", rest: 90 },
        ],
      },
      {
        name: "Legs & Odd Objects",
        focus: "Squat strength and sandbag work",
        minutes: 70,
        exercises: [
          { ex: "front-squat", sets: 4, reps: "5", rest: 180, rpe: 7 },
          { ex: "sandbag-to-shoulder", sets: 5, reps: "2 per side", rest: 120 },
          { ex: "sandbag-bear-hug-carry", sets: 4, seconds: 30, rest: 90 },
          { ex: "hanging-knee-raise", sets: 3, reps: "10", rest: 60 },
        ],
      },
      {
        name: "Pull & Medley",
        focus: "Deadlift strength and conditioning",
        minutes: 70,
        exercises: [
          { ex: "conventional-deadlift", sets: 4, reps: "3", rest: 210, rpe: 7 },
          { ex: "kettlebell-swing", sets: 3, reps: "15", rest: 90 },
          { ex: "sled-push", sets: 4, seconds: 25, rest: 90, notes: "Medley: sled push straight into a farmer's carry if available." },
          { ex: "dead-hang", sets: 3, seconds: 30, rest: 60 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Athletic (plus)
  {
    slug: "athletic-power-development",
    name: "Explosive Athletic Power",
    summary: "Jump higher, sprint faster, and stay resilient with power-first training.",
    description:
      "Each session starts with low-volume, high-quality power work while you are fresh, then builds strength and finishes with " +
      "rotational and single-leg work. Suitable for field and court athletes and anyone who wants to move explosively.",
    category: "athletic-performance",
    types: ["athletic", "strength"],
    difficulty: "intermediate",
    weeks: 6,
    sessionMinutes: 60,
    goals: ["athletic_performance", "build_strength"],
    equipment: ["barbell", "rack", "box", "medicine_ball", "dumbbell", "kettlebell"],
    tier: "plus",
    progression:
      "Keep power work crisp: stop sets when speed drops. Add load to strength lifts using RPE progression. Plyometric contacts increase " +
      "modestly in weeks 2–5; week 6 deloads.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: [...CONDITIONING_WARMUP, "Ankle knee-to-wall × 10 per side"],
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Lower Power",
        focus: "Vertical and horizontal power",
        minutes: 60,
        exercises: [
          { ex: "box-jump", sets: 4, reps: "3", rest: 90, notes: "Full reset between reps." },
          { ex: "trap-bar-deadlift", sets: 4, reps: "4", rest: 180, rpe: 7, notes: "Move the bar fast." },
          { ex: "bulgarian-split-squat", sets: 3, reps: "6 per side", rest: 90 },
          { ex: "medicine-ball-rotational-throw", sets: 3, reps: "5 per side", rest: 60 },
        ],
      },
      {
        name: "Upper Power",
        focus: "Pressing power and pulling strength",
        minutes: 55,
        exercises: [
          { ex: "medicine-ball-slam", sets: 4, reps: "5", rest: 60 },
          { ex: "push-press", sets: 4, reps: "3", rest: 150, rpe: 7 },
          { ex: "pull-up", sets: 4, reps: "5-8", rest: 120 },
          { ex: "landmine-press", sets: 3, reps: "6 per side", rest: 90 },
          { ex: "pallof-press", sets: 3, reps: "10 per side", rest: 45 },
        ],
      },
      {
        name: "Total Body Athleticism",
        focus: "Olympic-derivative power and resilience",
        minutes: 60,
        exercises: [
          { ex: "broad-jump", sets: 4, reps: "3", rest: 90 },
          { ex: "power-clean", sets: 5, reps: "2", rest: 150, notes: "Swap for kettlebell swings if you haven't been coached on the clean." },
          { ex: "front-squat", sets: 3, reps: "5", rest: 150, rpe: 7 },
          { ex: "single-leg-rdl", sets: 3, reps: "8 per side", rest: 75 },
          { ex: "lateral-shuffle", sets: 4, seconds: 15, rest: 45 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ MMA (plus)
  {
    slug: "mma-fight-conditioning",
    name: "MMA Fight Conditioning",
    summary: "Strength and energy-system work to support skill training — not replace it.",
    description:
      "Designed to sit alongside 2–4 skill sessions a week. Day 1 builds strength and power, day 2 develops anaerobic capacity with " +
      "round-based intervals, and day 3 builds the aerobic base and grappling-specific endurance. Keep the hardest conditioning away from " +
      "hard sparring days.",
    category: "mma-conditioning",
    types: ["mma", "athletic", "grappling", "boxing"],
    difficulty: "intermediate",
    weeks: 6,
    sessionMinutes: 55,
    goals: ["combat_sports", "improve_conditioning", "athletic_performance"],
    equipment: ["barbell", "kettlebell", "medicine_ball", "bike", "jump_rope", "heavy_bag", "pull_up_bar", "mat"],
    tier: "plus",
    progression:
      "Intervals progress by adding a round or shortening rest by 10–15 seconds each week while output stays consistent. Strength work " +
      "follows RPE. Week 6 tapers for a fight or test.",
    progressionModel: "density",
    deloadFinalWeek: true,
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Strength & Power",
        focus: "Force production",
        minutes: 55,
        exercises: [
          { ex: "medicine-ball-rotational-throw", sets: 4, reps: "4 per side", rest: 60 },
          { ex: "trap-bar-deadlift", sets: 4, reps: "4", rest: 150, rpe: 7 },
          { ex: "pull-up", sets: 4, reps: "5-8", rest: 120 },
          { ex: "landmine-press", sets: 3, reps: "6 per side", rest: 90 },
          { ex: "farmers-carry", sets: 3, seconds: 40, rest: 75 },
        ],
      },
      {
        name: "Anaerobic Rounds",
        focus: "Fight-pace intervals",
        minutes: 45,
        exercises: [
          { ex: "heavy-bag-rounds", sets: 5, seconds: 180, rest: 60, rpe: 8, notes: "Work round: 3 min. Mix 10-second flurries every 30 seconds." },
          { ex: "sprawl", sets: 4, seconds: 30, rest: 30 },
          { ex: "kettlebell-swing", sets: 4, seconds: 30, rest: 30 },
          { ex: "bike-intervals", sets: 6, seconds: 20, rest: 40, rpe: 9, notes: "All-out sprints." },
        ],
      },
      {
        name: "Aerobic Base & Grappling Endurance",
        focus: "Recovery capacity",
        minutes: 55,
        exercises: [
          { ex: "rowing-intervals", sets: 1, seconds: 1200, rest: 60, rpe: 5, notes: "Steady pace: you can speak in full sentences." },
          { ex: "hip-escape", sets: 4, seconds: 45, rest: 30 },
          { ex: "bear-crawl", sets: 4, seconds: 30, rest: 30 },
          { ex: "dead-hang", sets: 3, seconds: 40, rest: 60 },
          { ex: "sandbag-bear-hug-carry", sets: 3, seconds: 40, rest: 60, notes: "Substitute a heavy goblet hold walk without a sandbag." },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Boxing (plus)
  {
    slug: "boxing-round-ready",
    name: "Boxing: Round Ready",
    summary: "Shoulder endurance, footwork and repeat-sprint capacity for boxing.",
    description:
      "Round-structured sessions that mirror the demands of boxing: sustained shoulder output, light fast feet and the ability to " +
      "recover between exchanges. Pair with technical boxing coaching.",
    category: "boxing-conditioning",
    types: ["boxing", "cardio"],
    difficulty: "beginner",
    weeks: 4,
    sessionMinutes: 45,
    goals: ["combat_sports", "improve_conditioning", "lose_fat"],
    equipment: ["jump_rope", "heavy_bag", "dumbbell", "medicine_ball", "bodyweight"],
    tier: "plus",
    progression: "Add one round per exercise each week or reduce rest by 10 seconds. Week 4 keeps rounds but lowers intensity.",
    progressionModel: "density",
    deloadFinalWeek: true,
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Footwork & Rhythm",
        focus: "Light feet and aerobic rounds",
        minutes: 45,
        exercises: [
          { ex: "jump-rope", sets: 4, seconds: 180, rest: 60 },
          { ex: "shadowboxing", sets: 4, seconds: 180, rest: 60, notes: "Focus on stepping in and out with every combination." },
          { ex: "lateral-shuffle", sets: 4, seconds: 20, rest: 40 },
          { ex: "plank", sets: 3, seconds: 40, rest: 30 },
        ],
      },
      {
        name: "Bag Power Rounds",
        focus: "Striking endurance",
        minutes: 45,
        exercises: [
          { ex: "heavy-bag-rounds", sets: 6, seconds: 120, rest: 60, rpe: 8 },
          { ex: "medicine-ball-rotational-throw", sets: 3, reps: "6 per side", rest: 60 },
          { ex: "push-up", sets: 3, reps: "10-15", rest: 60 },
          { ex: "dead-bug", sets: 2, reps: "8 per side", rest: 30 },
        ],
      },
      {
        name: "Strength Support",
        focus: "Upper back, legs and trunk",
        minutes: 45,
        exercises: [
          { ex: "goblet-squat", sets: 3, reps: "10", rest: 90 },
          { ex: "one-arm-dumbbell-row", sets: 3, reps: "10 per side", rest: 75 },
          { ex: "seated-dumbbell-shoulder-press", sets: 3, reps: "10", rest: 75 },
          { ex: "band-pull-apart", sets: 3, reps: "20", rest: 45 },
          { ex: "pallof-press", sets: 3, reps: "10 per side", rest: 45 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Grappling (plus)
  {
    slug: "grappling-mat-endurance",
    name: "Wrestling & Grappling: Mat Endurance",
    summary: "Grip, hips, and repeat-effort endurance for wrestling, BJJ and judo.",
    description:
      "Grapplers need strength-endurance in awkward positions, a crushing grip and the ability to repeat scrambles. These sessions " +
      "build exactly that while protecting the neck and lower back with controlled loading.",
    category: "grappling-conditioning",
    types: ["grappling", "mma"],
    difficulty: "intermediate",
    weeks: 4,
    sessionMinutes: 50,
    goals: ["combat_sports", "improve_conditioning"],
    equipment: ["kettlebell", "sandbag", "pull_up_bar", "mat", "barbell", "dumbbell"],
    tier: "plus",
    progression: "Add 5–10 seconds per work interval each week, or one extra round. Week 4 reduces volume by a third.",
    progressionModel: "density",
    deloadFinalWeek: true,
    warmup: [...CONDITIONING_WARMUP, "Hip escapes × 6 per side"],
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Grip & Pull",
        focus: "Grip endurance and pulling strength",
        minutes: 50,
        exercises: [
          { ex: "pull-up", sets: 4, reps: "5-8", rest: 120 },
          { ex: "barbell-row", sets: 3, reps: "8", rest: 90 },
          { ex: "dead-hang", sets: 4, seconds: 40, rest: 60 },
          { ex: "hammer-curl", sets: 3, reps: "10-12", rest: 60 },
          { ex: "farmers-carry", sets: 3, seconds: 45, rest: 75 },
        ],
      },
      {
        name: "Scramble Intervals",
        focus: "Wrestling conditioning",
        minutes: 40,
        exercises: [
          { ex: "sprawl", sets: 6, seconds: 20, rest: 40, rpe: 8 },
          { ex: "hip-escape", sets: 6, seconds: 30, rest: 30 },
          { ex: "kettlebell-swing", sets: 5, reps: "15", rest: 45 },
          { ex: "bear-crawl", sets: 4, seconds: 30, rest: 30 },
        ],
      },
      {
        name: "Hips & Odd Objects",
        focus: "Hip power and trunk strength",
        minutes: 50,
        exercises: [
          { ex: "sandbag-to-shoulder", sets: 4, reps: "3 per side", rest: 90, notes: "Swap for kettlebell swings without a sandbag." },
          { ex: "front-squat", sets: 3, reps: "6", rest: 150, rpe: 7 },
          { ex: "sandbag-bear-hug-carry", sets: 3, seconds: 40, rest: 75 },
          { ex: "cable-woodchop", sets: 3, reps: "10 per side", rest: 45 },
          { ex: "side-plank", sets: 3, seconds: 30, rest: 30 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Functional (plus)
  {
    slug: "functional-engine",
    name: "Functional Engine",
    summary: "Varied mixed-modal workouts that build strength and a big engine.",
    description:
      "Inspired by functional fitness training: a strength piece followed by a timed conditioning circuit. Scale every movement to " +
      "keep good form — intensity should never outrun technique.",
    category: "functional-conditioning",
    types: ["functional", "cardio", "strength"],
    difficulty: "intermediate",
    weeks: 4,
    sessionMinutes: 55,
    goals: ["improve_conditioning", "lose_fat", "general_health"],
    equipment: ["barbell", "kettlebell", "dumbbell", "rower", "box", "pull_up_bar", "jump_rope", "medicine_ball"],
    tier: "plus",
    progression: "Strength pieces follow RPE progression; circuits aim to beat last week's rounds or time while keeping form.",
    progressionModel: "density",
    deloadFinalWeek: true,
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Squat + Short Couplet",
        focus: "Leg strength and intensity",
        minutes: 50,
        exercises: [
          { ex: "front-squat", sets: 5, reps: "5", rest: 150, rpe: 7 },
          { ex: "kettlebell-swing", sets: 5, reps: "15", rest: 30, notes: "Couplet: alternate with burpees, minimal rest." },
          { ex: "burpee", sets: 5, reps: "10", rest: 60 },
        ],
      },
      {
        name: "Engine Builder",
        focus: "Aerobic intervals",
        minutes: 45,
        exercises: [
          { ex: "rowing-intervals", sets: 5, seconds: 240, rest: 90, rpe: 7 },
          { ex: "box-jump", sets: 5, reps: "8", rest: 60, notes: "Step down each rep." },
          { ex: "jump-rope", sets: 5, seconds: 60, rest: 30 },
        ],
      },
      {
        name: "Press + Chipper",
        focus: "Upper strength and work capacity",
        minutes: 55,
        exercises: [
          { ex: "push-press", sets: 5, reps: "3", rest: 150, rpe: 7 },
          { ex: "pull-up", sets: 4, reps: "8", rest: 45 },
          { ex: "medicine-ball-slam", sets: 4, reps: "15", rest: 45 },
          { ex: "walking-lunge", sets: 4, reps: "10 per side", rest: 45 },
          { ex: "mountain-climber", sets: 4, seconds: 30, rest: 45 },
        ],
      },
      {
        name: "Deadlift + Long Grind",
        focus: "Posterior chain and pacing",
        minutes: 55,
        exercises: [
          { ex: "conventional-deadlift", sets: 4, reps: "4", rest: 180, rpe: 7 },
          { ex: "bike-intervals", sets: 1, seconds: 900, rest: 60, rpe: 6, notes: "Steady 15 minutes." },
          { ex: "farmers-carry", sets: 4, seconds: 40, rest: 45 },
          { ex: "plank", sets: 3, seconds: 45, rest: 30 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Weight loss & cardio (plus)
  {
    slug: "lean-and-conditioned",
    name: "Lean & Conditioned",
    summary: "Strength to protect muscle plus sustainable cardio to support fat loss.",
    description:
      "Fat loss is driven mainly by a modest, sustainable calorie deficit; this program supports that with resistance training to " +
      "maintain muscle and a mix of steady and interval cardio. It is not a substitute for medical advice on weight management.",
    category: "weight-loss-cardio",
    types: ["cardio", "strength", "functional"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 45,
    goals: ["lose_fat", "general_health", "improve_conditioning"],
    equipment: ["dumbbell", "bodyweight", "bike", "rower"],
    tier: "plus",
    progression:
      "Add 5 minutes to steady cardio sessions every other week, and progress strength lifts with double progression. Week 6 is lighter.",
    progressionModel: "volume_wave",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Strength Circuit A",
        focus: "Full-body strength",
        minutes: 45,
        exercises: [
          { ex: "goblet-squat", sets: 3, reps: "10-12", rest: 60 },
          { ex: "dumbbell-bench-press", sets: 3, reps: "10-12", rest: 60 },
          { ex: "one-arm-dumbbell-row", sets: 3, reps: "10-12", rest: 60 },
          { ex: "reverse-lunge", sets: 3, reps: "10 per side", rest: 60 },
          { ex: "plank", sets: 3, seconds: 30, rest: 30 },
        ],
      },
      {
        name: "Steady Cardio",
        focus: "Aerobic base",
        minutes: 40,
        exercises: [
          { ex: "brisk-walk", sets: 1, seconds: 1800, rest: 0, rpe: 5, notes: "Swap for bike or rower if you prefer." },
          { ex: "glute-bridge", sets: 2, reps: "15", rest: 45 },
          { ex: "bird-dog", sets: 2, reps: "8 per side", rest: 30 },
        ],
      },
      {
        name: "Strength Circuit B",
        focus: "Full-body strength",
        minutes: 45,
        exercises: [
          { ex: "romanian-deadlift", sets: 3, reps: "10-12", rest: 60 },
          { ex: "seated-dumbbell-shoulder-press", sets: 3, reps: "10-12", rest: 60 },
          { ex: "band-row", sets: 3, reps: "12-15", rest: 45 },
          { ex: "step-up", sets: 3, reps: "10 per side", rest: 60 },
          { ex: "dead-bug", sets: 3, reps: "8 per side", rest: 30 },
        ],
      },
      {
        name: "Intervals",
        focus: "Short, hard efforts",
        minutes: 30,
        exercises: [
          { ex: "bike-intervals", sets: 8, seconds: 30, rest: 90, rpe: 8, notes: "Rower works too." },
          { ex: "mountain-climber", sets: 3, seconds: 30, rest: 30 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Active aging (free)
  {
    slug: "active-aging-low-impact",
    name: "Active Aging: Strength & Balance",
    summary: "Joint-friendly strength, balance and mobility to keep you capable for life.",
    description:
      "Low-impact sessions that train the things that matter for everyday independence: getting up from a chair, carrying groceries, " +
      "climbing stairs and staying steady on your feet. Every exercise can be done next to a sturdy support. If you have a medical " +
      "condition, check with your healthcare provider before starting a new exercise program.",
    category: "active-aging",
    types: ["low_impact", "strength", "mobility"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 35,
    goals: ["general_health", "mobility", "build_strength"],
    equipment: ["bodyweight", "dumbbell", "band"],
    tier: "free",
    lowImpact: true,
    progression:
      "Add reps before adding weight. When an exercise feels easy (RPE 5 or less) at the top of the range for two sessions, add a little " +
      "resistance or slow down the lowering phase.",
    progressionModel: "volume_wave",
    warmup: LOW_IMPACT_WARMUP,
    cooldown: ["Slow walk 2–3 minutes", "Seated figure-four stretch 30 seconds per side", "Child's pose or seated forward reach 45 seconds"],
    days: [
      {
        name: "Strength & Balance A",
        focus: "Legs, pushing and balance",
        minutes: 35,
        exercises: [
          { ex: "box-squat-to-chair", sets: 3, reps: "8-12", rest: 75, rpe: 6 },
          { ex: "wall-push-up", sets: 3, reps: "8-12", rest: 60 },
          { ex: "band-row", sets: 3, reps: "10-12", rest: 60 },
          { ex: "single-leg-balance", sets: 3, seconds: 20, rest: 30, notes: "Per leg, with support nearby." },
          { ex: "standing-calf-raise", sets: 2, reps: "10-12", rest: 45 },
        ],
      },
      {
        name: "Mobility & Walking",
        focus: "Move well and build stamina",
        minutes: 35,
        exercises: [
          { ex: "brisk-walk", sets: 1, seconds: 1200, rest: 0, rpe: 4 },
          { ex: "cat-cow", sets: 2, reps: "8 breaths", rest: 30 },
          { ex: "thoracic-open-book", sets: 2, reps: "6 per side", rest: 30 },
          { ex: "figure-four-stretch", sets: 2, seconds: 30, rest: 15 },
        ],
      },
      {
        name: "Strength & Balance B",
        focus: "Hips, carrying and core",
        minutes: 35,
        exercises: [
          { ex: "step-up", sets: 3, reps: "6-10 per side", rest: 75, notes: "Use a low step and a handrail." },
          { ex: "glute-bridge", sets: 3, reps: "10-12", rest: 60 },
          { ex: "farmers-carry", sets: 3, seconds: 30, rest: 60, notes: "Light weights, tall posture." },
          { ex: "standing-march", sets: 2, seconds: 45, rest: 30 },
          { ex: "dead-bug", sets: 2, reps: "5 per side", rest: 30 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Mobility (free)
  {
    slug: "daily-mobility-flow",
    name: "Daily Mobility Flow",
    summary: "Short daily routines for hips, spine, shoulders and ankles.",
    description:
      "Fifteen to twenty minutes of mobility you can do on its own or after training. Move within a comfortable, pain-free range. " +
      "If a movement causes pain, skip it — this is not a rehabilitation program.",
    category: "mobility-flexibility",
    types: ["mobility", "low_impact"],
    difficulty: "beginner",
    weeks: 4,
    sessionMinutes: 20,
    goals: ["mobility", "general_health"],
    equipment: ["mat", "band", "bodyweight"],
    tier: "free",
    lowImpact: true,
    progression: "Gradually increase hold times by 5–10 seconds per week as positions become more comfortable.",
    progressionModel: "steady",
    warmup: ["1 minute of slow nasal breathing", "Cat-cow × 5"],
    cooldown: ["Child's pose — 60 seconds of slow breathing"],
    days: [
      {
        name: "Hips & Spine",
        focus: "Lower body mobility",
        minutes: 20,
        exercises: [
          { ex: "cat-cow", sets: 2, reps: "8 breaths", rest: 15 },
          { ex: "worlds-greatest-stretch", sets: 2, reps: "4 per side", rest: 15 },
          { ex: "90-90-hip-switch", sets: 2, reps: "8", rest: 15 },
          { ex: "couch-stretch", sets: 2, seconds: 45, rest: 15, notes: "Per side." },
          { ex: "figure-four-stretch", sets: 2, seconds: 40, rest: 15 },
        ],
      },
      {
        name: "Shoulders & Upper Back",
        focus: "Upper body mobility",
        minutes: 20,
        exercises: [
          { ex: "thoracic-open-book", sets: 2, reps: "8 per side", rest: 15 },
          { ex: "band-pass-through", sets: 2, reps: "10", rest: 15 },
          { ex: "band-pull-apart", sets: 2, reps: "15", rest: 15 },
          { ex: "dead-hang", sets: 2, seconds: 20, rest: 30, notes: "Feet can stay lightly on the floor." },
          { ex: "childs-pose", sets: 1, seconds: 60, rest: 0 },
        ],
      },
      {
        name: "Ankles & Squat",
        focus: "Squat depth and ankle range",
        minutes: 20,
        exercises: [
          { ex: "ankle-knee-to-wall", sets: 2, reps: "10 per side", rest: 15 },
          { ex: "deep-squat-hold", sets: 3, seconds: 30, rest: 30 },
          { ex: "supine-hamstring-stretch", sets: 2, seconds: 40, rest: 15 },
          { ex: "single-leg-balance", sets: 2, seconds: 30, rest: 15 },
        ],
      },
      {
        name: "Full-Body Reset",
        focus: "Whole-body flow",
        minutes: 15,
        exercises: [
          { ex: "cat-cow", sets: 1, reps: "8 breaths", rest: 0 },
          { ex: "worlds-greatest-stretch", sets: 1, reps: "3 per side", rest: 0 },
          { ex: "thoracic-open-book", sets: 1, reps: "6 per side", rest: 0 },
          { ex: "deep-squat-hold", sets: 2, seconds: 30, rest: 15 },
          { ex: "childs-pose", sets: 1, seconds: 60, rest: 0 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Recovery / deload (free)
  {
    slug: "recovery-deload-week",
    name: "Recovery & Deload Week",
    summary: "A planned easy week: lighter loads, mobility and easy cardio.",
    description:
      "Use this after a hard block or when check-ins show low readiness. Keep loads at roughly 50–60% of normal and stop every set " +
      "with plenty in reserve. The goal is to leave each session feeling better than when you started.",
    category: "recovery-deload",
    types: ["mobility", "low_impact"],
    difficulty: "beginner",
    weeks: 1,
    sessionMinutes: 35,
    goals: ["general_health", "mobility"],
    equipment: ["bodyweight", "dumbbell", "band", "bike"],
    tier: "free",
    lowImpact: true,
    progression: "No progression this week — return to your regular program next week.",
    progressionModel: "steady",
    warmup: LOW_IMPACT_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Light Full Body",
        focus: "Move, don't grind",
        minutes: 35,
        exercises: [
          { ex: "goblet-squat", sets: 2, reps: "8", rest: 60, rpe: 5 },
          { ex: "incline-push-up", sets: 2, reps: "8", rest: 60, rpe: 5 },
          { ex: "band-row", sets: 2, reps: "12", rest: 45, rpe: 5 },
          { ex: "glute-bridge", sets: 2, reps: "12", rest: 45 },
        ],
      },
      {
        name: "Easy Cardio + Mobility",
        focus: "Blood flow",
        minutes: 35,
        exercises: [
          { ex: "bike-intervals", sets: 1, seconds: 1200, rest: 0, rpe: 4, notes: "Easy, conversational pace." },
          { ex: "worlds-greatest-stretch", sets: 2, reps: "3 per side", rest: 15 },
          { ex: "90-90-hip-switch", sets: 2, reps: "8", rest: 15 },
        ],
      },
      {
        name: "Mobility Reset",
        focus: "Restore range",
        minutes: 25,
        exercises: [
          { ex: "cat-cow", sets: 2, reps: "8 breaths", rest: 15 },
          { ex: "thoracic-open-book", sets: 2, reps: "6 per side", rest: 15 },
          { ex: "couch-stretch", sets: 2, seconds: 40, rest: 15 },
          { ex: "childs-pose", sets: 1, seconds: 90, rest: 0 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Combat/athletic session library (plus)
  {
    slug: "combat-conditioning-sessions",
    name: "Combat Conditioning Session Library",
    summary: "Six stand-alone sessions: grappling, wrestling, striking, anaerobic, aerobic and footwork.",
    description:
      "Choose the session that complements your skill training that day. Each one targets a specific quality — don't do them all in one " +
      "week. Hard anaerobic sessions should be 48 hours away from hard sparring.",
    category: "mma-conditioning",
    types: ["mma", "boxing", "grappling"],
    difficulty: "intermediate",
    weeks: 1,
    sessionMinutes: 40,
    goals: ["combat_sports", "improve_conditioning"],
    equipment: ["kettlebell", "sandbag", "pull_up_bar", "mat", "bike", "rower", "jump_rope", "heavy_bag"],
    tier: "plus",
    progression: "Repeat any session weekly, adding a round or reducing rest by 10 seconds when output holds steady.",
    progressionModel: "steady",
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Grappling Endurance",
        focus: "Strength-endurance in grappling positions",
        minutes: 40,
        exercises: [
          { ex: "hip-escape", sets: 5, seconds: 45, rest: 30 },
          { ex: "sandbag-bear-hug-carry", sets: 5, seconds: 40, rest: 45 },
          { ex: "dead-hang", sets: 4, seconds: 45, rest: 45 },
          { ex: "bear-crawl", sets: 4, seconds: 40, rest: 30 },
        ],
      },
      {
        name: "Wrestling Conditioning",
        focus: "Repeated explosive scrambles",
        minutes: 35,
        exercises: [
          { ex: "sprawl", sets: 8, seconds: 20, rest: 40, rpe: 8 },
          { ex: "kettlebell-swing", sets: 6, reps: "12", rest: 30 },
          { ex: "broad-jump", sets: 4, reps: "3", rest: 60 },
        ],
      },
      {
        name: "Striking Endurance",
        focus: "Shoulder and hip endurance at pace",
        minutes: 40,
        exercises: [
          { ex: "heavy-bag-rounds", sets: 6, seconds: 180, rest: 60, rpe: 7 },
          { ex: "shadowboxing", sets: 2, seconds: 180, rest: 60, notes: "Light hands, sharp footwork." },
          { ex: "push-up", sets: 3, reps: "12", rest: 45 },
        ],
      },
      {
        name: "Anaerobic Intervals",
        focus: "Glycolytic power and repeat sprints",
        minutes: 30,
        exercises: [
          { ex: "bike-intervals", sets: 8, seconds: 20, rest: 70, rpe: 9 },
          { ex: "medicine-ball-slam", sets: 4, seconds: 20, rest: 40 },
          { ex: "burpee", sets: 4, seconds: 20, rest: 40 },
        ],
      },
      {
        name: "Aerobic Conditioning",
        focus: "Aerobic base for recovery between rounds",
        minutes: 45,
        exercises: [
          { ex: "rowing-intervals", sets: 3, seconds: 600, rest: 90, rpe: 5, notes: "Nasal breathing pace." },
          { ex: "jump-rope", sets: 3, seconds: 180, rest: 60 },
        ],
      },
      {
        name: "Footwork",
        focus: "Agility, rhythm and balance",
        minutes: 30,
        exercises: [
          { ex: "jump-rope", sets: 4, seconds: 120, rest: 45 },
          { ex: "lateral-shuffle", sets: 6, seconds: 15, rest: 45 },
          { ex: "shadowboxing", sets: 3, seconds: 120, rest: 60, notes: "Angle changes and pivots only — light hands." },
          { ex: "single-leg-balance", sets: 2, seconds: 30, rest: 15 },
        ],
      },
    ],
  },
  {
    slug: "athletic-qualities-sessions",
    name: "Athletic Qualities Session Library",
    summary: "Four focused sessions: explosive power, rotational core, grip endurance, sport-specific strength.",
    description:
      "Plug-in sessions to target a specific athletic quality. Use one or two per week alongside your sport or main program.",
    category: "athletic-performance",
    types: ["athletic", "mma", "strength"],
    difficulty: "intermediate",
    weeks: 1,
    sessionMinutes: 40,
    goals: ["athletic_performance", "combat_sports"],
    equipment: ["barbell", "medicine_ball", "box", "cable", "band", "pull_up_bar", "dumbbell", "kettlebell", "trap_bar"],
    tier: "plus",
    progression: "Power: stop sets when speed drops. Strength: RPE progression. Grip: add 5 seconds per hold weekly.",
    progressionModel: "steady",
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Explosive Power",
        focus: "Rate of force development",
        minutes: 40,
        exercises: [
          { ex: "box-jump", sets: 5, reps: "3", rest: 90 },
          { ex: "medicine-ball-slam", sets: 4, reps: "5", rest: 60 },
          { ex: "push-press", sets: 4, reps: "3", rest: 120, rpe: 7 },
          { ex: "broad-jump", sets: 3, reps: "3", rest: 90 },
        ],
      },
      {
        name: "Rotational Core Strength",
        focus: "Hip-to-hand force transfer",
        minutes: 35,
        exercises: [
          { ex: "medicine-ball-rotational-throw", sets: 4, reps: "5 per side", rest: 60 },
          { ex: "cable-woodchop", sets: 3, reps: "10 per side", rest: 45 },
          { ex: "pallof-press", sets: 3, reps: "10 per side", rest: 45 },
          { ex: "side-plank", sets: 3, seconds: 30, rest: 30 },
        ],
      },
      {
        name: "Grip Endurance",
        focus: "Crush and support grip",
        minutes: 30,
        exercises: [
          { ex: "dead-hang", sets: 4, seconds: 40, rest: 60 },
          { ex: "farmers-carry", sets: 4, seconds: 45, rest: 75 },
          { ex: "hammer-curl", sets: 3, reps: "12", rest: 60 },
          { ex: "suitcase-carry", sets: 2, seconds: 40, rest: 60, notes: "Per side." },
        ],
      },
      {
        name: "Sport-Specific Strength",
        focus: "Unilateral and posterior chain strength",
        minutes: 45,
        exercises: [
          { ex: "trap-bar-deadlift", sets: 4, reps: "4", rest: 150, rpe: 7 },
          { ex: "bulgarian-split-squat", sets: 3, reps: "6 per side", rest: 90, rpe: 7 },
          { ex: "single-leg-rdl", sets: 3, reps: "8 per side", rest: 75 },
          { ex: "landmine-press", sets: 3, reps: "8 per side", rest: 75 },
          { ex: "chin-up", sets: 3, reps: "6-8", rest: 90 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Lift specializations (plus)
  {
    slug: "bench-press-specialist",
    name: "Bench Press Specialist",
    summary: "Bench three times a week — heavy, volume and paused — with the upper-back and triceps work to support it.",
    description:
      "An 8-week bench block for lifters who want a bigger press. Day 1 is heavy, Day 2 builds volume with close-grip work, and Day 3 " +
      "practises competition-style paused reps. Lower-body training is kept to maintenance so your recovery goes to the bench. " +
      "Use the custom program builder if you want exact loads calculated from your max.",
    category: "bench-press",
    types: ["powerlifting", "strength"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 60,
    goals: ["build_strength", "build_muscle"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pull_up_bar"],
    tier: "plus",
    progression:
      "Target RPE rises by about 0.5 per week. When every set of the main bench lift is completed at or below the target RPE, add " +
      "2.5 kg / 5 lb next week. Week 8 is a deload — or test a new max at the end of it if you feel fresh.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Heavy Bench",
        focus: "Low-rep competition bench + upper back",
        minutes: 60,
        exercises: [
          { ex: "bench-press", sets: 5, reps: "3", rest: 180, rpe: 7.5, intensity: "~80–85% 1RM", notes: "Ramp up with 4–5 warm-up sets (10, 5, 3, 2, 1 reps)." },
          { ex: "barbell-row", sets: 4, reps: "8", rest: 120, rpe: 7 },
          { ex: "overhead-press", sets: 3, reps: "6", rest: 120, rpe: 7 },
          { ex: "face-pull", sets: 3, reps: "15", rest: 60 },
        ],
      },
      {
        name: "Lower Maintenance",
        focus: "Squat, hinge and core — keep the legs strong",
        minutes: 50,
        exercises: [
          { ex: "back-squat", sets: 3, reps: "5", rest: 180, rpe: 7 },
          { ex: "romanian-deadlift", sets: 3, reps: "8", rest: 120, rpe: 7 },
          { ex: "walking-lunge", sets: 2, reps: "10 per side", rest: 90 },
          { ex: "plank", sets: 3, seconds: 40, rest: 45 },
        ],
      },
      {
        name: "Bench Volume",
        focus: "Close-grip strength and triceps",
        minutes: 60,
        exercises: [
          { ex: "bench-press", sets: 4, reps: "6-8", rest: 150, rpe: 7, intensity: "~70–75% 1RM" },
          { ex: "close-grip-bench-press", sets: 3, reps: "6", rest: 120, rpe: 7 },
          { ex: "chin-up", sets: 4, reps: "6-8", rest: 90 },
          { ex: "triceps-pushdown", sets: 3, reps: "12", rest: 60 },
          { ex: "lateral-raise", sets: 3, reps: "15", rest: 45 },
        ],
      },
      {
        name: "Paused Bench",
        focus: "Competition-style pauses and lockout",
        minutes: 55,
        exercises: [
          { ex: "paused-bench-press", sets: 4, reps: "3", rest: 180, rpe: 7.5, intensity: "~75% 1RM", notes: "Hold each rep motionless on the chest for 1–2 seconds." },
          { ex: "pin-press", sets: 3, reps: "4", rest: 150, rpe: 7, notes: "Pins 2–4 inches above the chest." },
          { ex: "one-arm-dumbbell-row", sets: 3, reps: "10 per side", rest: 75 },
          { ex: "overhead-triceps-extension", sets: 3, reps: "12", rest: 60 },
        ],
      },
    ],
  },
  {
    slug: "squat-specialist",
    name: "Squat Specialist",
    summary: "Three squat sessions a week — heavy, paused and tempo — plus targeted quad and posterior-chain work.",
    description:
      "An 8-week block for building a stronger squat. Heavy sets early in the week, pause squats for position and power out of the hole, " +
      "and tempo squats for control. Upper-body work is kept to maintenance. Use the custom program builder for loads based on your max.",
    category: "squat-specialization",
    types: ["powerlifting", "strength"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 65,
    goals: ["build_strength", "build_muscle"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "machine", "pull_up_bar"],
    tier: "plus",
    progression:
      "Target RPE rises by about 0.5 per week. Add 2.5–5 kg / 5–10 lb to the heavy squat when every set is completed at or below the " +
      "target RPE. Week 8 is a deload.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Heavy Squat",
        focus: "Low-rep back squat",
        minutes: 65,
        exercises: [
          { ex: "back-squat", sets: 5, reps: "3", rest: 210, rpe: 7.5, intensity: "~80–85% 1RM", notes: "Ramp up with 4–5 warm-up sets (10, 5, 3, 2, 1 reps)." },
          { ex: "romanian-deadlift", sets: 3, reps: "8", rest: 150, rpe: 7 },
          { ex: "leg-curl", sets: 3, reps: "12", rest: 60 },
          { ex: "ab-wheel-rollout", sets: 3, reps: "8-10", rest: 60 },
        ],
      },
      {
        name: "Upper Maintenance",
        focus: "Press and pull",
        minutes: 50,
        exercises: [
          { ex: "bench-press", sets: 3, reps: "5", rest: 150, rpe: 7 },
          { ex: "chin-up", sets: 3, reps: "6-8", rest: 90 },
          { ex: "overhead-press", sets: 3, reps: "8", rest: 90, rpe: 7 },
          { ex: "barbell-row", sets: 3, reps: "10", rest: 90 },
        ],
      },
      {
        name: "Pause Squat",
        focus: "Strength out of the hole",
        minutes: 60,
        exercises: [
          { ex: "pause-squat", sets: 4, reps: "4", rest: 180, rpe: 7, intensity: "~70% 1RM", notes: "2-second pause at depth, stay braced." },
          { ex: "bulgarian-split-squat", sets: 3, reps: "8 per side", rest: 90 },
          { ex: "leg-extension", sets: 3, reps: "12-15", rest: 60 },
          { ex: "side-plank", sets: 3, seconds: 30, rest: 30 },
        ],
      },
      {
        name: "Tempo Squat & Hinge",
        focus: "Control and posterior chain",
        minutes: 60,
        exercises: [
          { ex: "tempo-squat", sets: 3, reps: "5", rest: 150, rpe: 6.5, intensity: "~65% 1RM", notes: "4-second lowering, normal speed up." },
          { ex: "good-morning", sets: 3, reps: "8", rest: 120, rpe: 6.5 },
          { ex: "leg-press", sets: 3, reps: "10-12", rest: 90 },
          { ex: "standing-calf-raise", sets: 3, reps: "12-15", rest: 45 },
        ],
      },
    ],
  },
  {
    slug: "deadlift-specialist",
    name: "Deadlift Specialist",
    summary: "Two pulling days — heavy and variation — with hinge accessories, upper-back and grip work.",
    description:
      "An 8-week block for a stronger deadlift. Deadlifts are very fatiguing, so heavy pulls happen once a week, with a lighter " +
      "variation day (deficit or block pulls) to target your sticking point. Squats and upper-body work support the pull. " +
      "Use the custom program builder for loads based on your max.",
    category: "deadlift-specialization",
    types: ["powerlifting", "strength"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 60,
    goals: ["build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pull_up_bar"],
    tier: "plus",
    progression:
      "Target RPE rises by about 0.5 per week. Add 5 kg / 10 lb to the heavy deadlift when all sets are completed at or below the target " +
      "RPE with a flat back. Week 8 is a deload.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Heavy Deadlift",
        focus: "Low-rep competition pull",
        minutes: 60,
        exercises: [
          { ex: "conventional-deadlift", sets: 4, reps: "3", rest: 240, rpe: 7.5, intensity: "~80–85% 1RM", notes: "Ramp up with 4–5 warm-up sets. Reset each rep — no bouncing." },
          { ex: "barbell-row", sets: 3, reps: "8", rest: 120, rpe: 7 },
          { ex: "hip-thrust", sets: 3, reps: "10", rest: 90 },
          { ex: "farmers-carry", sets: 3, seconds: 40, rest: 90, notes: "Heavy; builds grip for the deadlift." },
        ],
      },
      {
        name: "Upper Body",
        focus: "Press and upper back",
        minutes: 50,
        exercises: [
          { ex: "bench-press", sets: 4, reps: "5", rest: 150, rpe: 7 },
          { ex: "pull-up", sets: 4, reps: "5-8", rest: 90 },
          { ex: "seated-dumbbell-shoulder-press", sets: 3, reps: "10", rest: 90 },
          { ex: "face-pull", sets: 3, reps: "15", rest: 60 },
        ],
      },
      {
        name: "Squat & Pull Variation",
        focus: "Squat strength and deadlift sticking point",
        minutes: 65,
        exercises: [
          { ex: "back-squat", sets: 4, reps: "5", rest: 180, rpe: 7 },
          { ex: "deficit-deadlift", sets: 3, reps: "5", rest: 180, rpe: 7, intensity: "~65–70% 1RM", notes: "1–2 inch deficit. Swap for block pulls if lockout is your weak point." },
          { ex: "good-morning", sets: 3, reps: "8", rest: 120, rpe: 6.5 },
          { ex: "dead-hang", sets: 3, seconds: 40, rest: 60 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Show prep (plus)
  {
    slug: "physique-show-prep",
    name: "Physique Show Prep",
    summary: "Twelve weeks of high-volume hypertrophy, daily steps and planned conditioning, tapering into show week.",
    description:
      "A training plan for bodybuilding, classic, men's/women's physique, figure, bikini and wellness competitors. Five sessions per week " +
      "keep volume high to hold muscle while conditioning is gradually increased. The final week is a training taper. Nutrition, " +
      "water and peak-week strategy should be guided by a qualified coach or registered dietitian — this program does not prescribe " +
      "extreme dieting or dehydration.",
    category: "show-prep",
    types: ["hypertrophy", "cardio"],
    difficulty: "advanced",
    weeks: 12,
    sessionMinutes: 75,
    goals: ["build_muscle", "lose_fat"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar", "bike"],
    tier: "plus",
    progression:
      "Add a rep or a small amount of load each week while keeping 1–2 reps in reserve. Add 5 minutes of low-intensity cardio per session " +
      "every two weeks as needed. Week 12 is a taper: lower volume and keep posing practice daily.",
    progressionModel: "volume_wave",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: [...STANDARD_COOLDOWN, "5 minutes posing practice (mandatory poses for your division)"],
    days: [
      {
        name: "Chest & Back",
        focus: "Upper-body width and thickness",
        minutes: 75,
        exercises: [
          { ex: "incline-dumbbell-press", sets: 4, reps: "8-10", rest: 120, rpe: 8 },
          { ex: "lat-pulldown", sets: 4, reps: "10-12", rest: 90, rpe: 8 },
          { ex: "cable-chest-fly", sets: 3, reps: "12-15", rest: 60 },
          { ex: "seated-cable-row", sets: 3, reps: "10-12", rest: 90 },
          { ex: "bike-intervals", sets: 1, seconds: 1200, rest: 0, notes: "Low-intensity steady cardio (conversational pace)." },
        ],
      },
      {
        name: "Quads & Calves",
        focus: "Leg development",
        minutes: 75,
        exercises: [
          { ex: "back-squat", sets: 4, reps: "6-8", rest: 150, rpe: 8 },
          { ex: "leg-press", sets: 3, reps: "12-15", rest: 90 },
          { ex: "walking-lunge", sets: 3, reps: "12 per side", rest: 90 },
          { ex: "leg-extension", sets: 3, reps: "15", rest: 60 },
          { ex: "standing-calf-raise", sets: 4, reps: "12-15", rest: 45 },
        ],
      },
      {
        name: "Shoulders & Arms",
        focus: "Delts, biceps and triceps",
        minutes: 70,
        exercises: [
          { ex: "seated-dumbbell-shoulder-press", sets: 4, reps: "8-10", rest: 90, rpe: 8 },
          { ex: "lateral-raise", sets: 4, reps: "15-20", rest: 45 },
          { ex: "rear-delt-fly", sets: 3, reps: "15", rest: 45 },
          { ex: "dumbbell-curl", sets: 3, reps: "10-12", rest: 60 },
          { ex: "overhead-triceps-extension", sets: 3, reps: "10-12", rest: 60 },
          { ex: "brisk-walk", sets: 1, seconds: 1200, rest: 0, notes: "Incline walk at a conversational pace." },
        ],
      },
      {
        name: "Hamstrings & Glutes",
        focus: "Posterior chain",
        minutes: 70,
        exercises: [
          { ex: "romanian-deadlift", sets: 4, reps: "8-10", rest: 120, rpe: 8 },
          { ex: "hip-thrust", sets: 3, reps: "10-12", rest: 90 },
          { ex: "leg-curl", sets: 4, reps: "12-15", rest: 60 },
          { ex: "bulgarian-split-squat", sets: 3, reps: "10 per side", rest: 75 },
          { ex: "hanging-knee-raise", sets: 3, reps: "12-15", rest: 45 },
        ],
      },
      {
        name: "Upper Pump & Conditioning",
        focus: "Weak-point volume and intervals",
        minutes: 60,
        exercises: [
          { ex: "dumbbell-bench-press", sets: 3, reps: "10-12", rest: 75 },
          { ex: "one-arm-dumbbell-row", sets: 3, reps: "12 per side", rest: 60 },
          { ex: "lateral-raise", sets: 3, reps: "20", rest: 45 },
          { ex: "triceps-pushdown", sets: 3, reps: "15", rest: 45 },
          { ex: "bike-intervals", sets: 8, seconds: 30, rest: 90, notes: "Hard 30 s / easy 90 s." },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Speed & agility (plus)
  {
    slug: "speed-development",
    name: "Speed Development",
    summary: "Sprint mechanics, acceleration and max velocity with plyometrics and strength — always fully recovered.",
    description:
      "Three sessions a week to get faster: an acceleration day, a max-velocity day and a strength/power day. Speed is trained fresh " +
      "with full rest between reps (2–5 minutes) — if a rep feels slower, the session is done. Find a flat track or field.",
    category: "speed",
    types: ["athletic"],
    difficulty: "intermediate",
    weeks: 6,
    sessionMinutes: 50,
    goals: ["athletic_performance"],
    equipment: ["bodyweight", "barbell", "rack", "dumbbell", "box"],
    tier: "plus",
    progression:
      "Add one sprint rep or 5 m of distance each week while quality is high. Never trade rest for volume. Week 6 halves volume to " +
      "let speed show up — time a 20 m or 40 m sprint at the end of it.",
    progressionModel: "steady",
    deloadFinalWeek: true,
    warmup: SPRINT_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Acceleration",
        focus: "First steps and drive phase",
        minutes: 50,
        exercises: [
          { ex: "wall-drill", sets: 3, reps: "5 per side", rest: 45 },
          { ex: "a-skip", sets: 3, reps: "20 m", rest: 45 },
          { ex: "acceleration-sprint", sets: 6, reps: "20 m", rest: 120, notes: "Maximal effort, full walk-back recovery." },
          { ex: "broad-jump", sets: 4, reps: "3", rest: 90 },
          { ex: "dead-bug", sets: 2, reps: "8 per side", rest: 30 },
        ],
      },
      {
        name: "Strength & Power",
        focus: "Force production",
        minutes: 55,
        exercises: [
          { ex: "box-jump", sets: 4, reps: "3", rest: 90 },
          { ex: "back-squat", sets: 4, reps: "4", rest: 180, rpe: 7.5 },
          { ex: "romanian-deadlift", sets: 3, reps: "6", rest: 120, rpe: 7 },
          { ex: "bulgarian-split-squat", sets: 3, reps: "6 per side", rest: 90 },
          { ex: "standing-calf-raise", sets: 3, reps: "10", rest: 60, notes: "Pause at the bottom, explode up." },
        ],
      },
      {
        name: "Max Velocity",
        focus: "Top speed and elastic stiffness",
        minutes: 50,
        exercises: [
          { ex: "pogo-jumps", sets: 3, reps: "15 contacts", rest: 60 },
          { ex: "bounding", sets: 3, reps: "30 m", rest: 120 },
          { ex: "flying-sprint", sets: 4, reps: "20 m fly", rest: 240, notes: "20–30 m build-up, then 20 m at top speed." },
          { ex: "single-leg-rdl", sets: 3, reps: "8 per side", rest: 60 },
        ],
      },
    ],
  },
  {
    slug: "agility-footwork",
    name: "Agility & Footwork",
    summary: "Ladder footwork, cone drills, reactive work and lateral plyometrics for quicker cuts.",
    description:
      "Three sessions per week to move faster in any direction. Planned change-of-direction drills teach deceleration and re-acceleration; " +
      "reactive drills train you to read and respond. Cones can be any markers, and the ladder can be taped or chalked on the floor.",
    category: "agility",
    types: ["athletic"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 45,
    goals: ["athletic_performance"],
    equipment: ["bodyweight", "dumbbell", "box", "band"],
    tier: "plus",
    progression:
      "Add one rep per drill each week while every rep stays sharp. Keep rest long enough (60–90 s) that each rep is fast. Week 6 reduces " +
      "volume — time your 5-10-5 at the end of it.",
    progressionModel: "steady",
    deloadFinalWeek: true,
    warmup: SPRINT_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      {
        name: "Footwork & Deceleration",
        focus: "Rhythm, braking and lateral power",
        minutes: 45,
        exercises: [
          { ex: "agility-ladder-drills", sets: 6, seconds: 15, rest: 45, notes: "Two-in, lateral in-out, Icky shuffle." },
          { ex: "lateral-bound", sets: 3, reps: "4 per side", rest: 60, notes: "Stick each landing for 2 seconds." },
          { ex: "pro-agility-shuttle", sets: 5, reps: "1", rest: 90 },
          { ex: "reverse-lunge", sets: 3, reps: "8 per side", rest: 60 },
          { ex: "side-plank", sets: 2, seconds: 30, rest: 30 },
        ],
      },
      {
        name: "Leg Strength",
        focus: "Single-leg strength for cutting",
        minutes: 45,
        exercises: [
          { ex: "goblet-squat", sets: 3, reps: "8", rest: 90, rpe: 7 },
          { ex: "bulgarian-split-squat", sets: 3, reps: "8 per side", rest: 75 },
          { ex: "single-leg-rdl", sets: 3, reps: "8 per side", rest: 60 },
          { ex: "box-jump", sets: 3, reps: "4", rest: 75 },
          { ex: "pallof-press", sets: 3, reps: "10 per side", rest: 45 },
        ],
      },
      {
        name: "Cone & Reactive",
        focus: "Planned cuts and reaction",
        minutes: 45,
        exercises: [
          { ex: "pogo-jumps", sets: 3, reps: "15 contacts", rest: 45 },
          { ex: "t-drill", sets: 4, reps: "1", rest: 90 },
          { ex: "three-cone-drill", sets: 4, reps: "1", rest: 90 },
          { ex: "reactive-mirror-drill", sets: 6, seconds: 8, rest: 60, notes: "Partner leads; switch roles. Solo: react to random cues." },
          { ex: "lateral-shuffle", sets: 3, seconds: 15, rest: 45 },
        ],
      },
    ],
  },
  // ------------------------------------------------------------ Cardiovascular (free)
  {
    slug: "aerobic-base-run-walk",
    name: "Aerobic Base: Run/Walk to 30 Minutes",
    summary: "Go from walking to 30 minutes of continuous easy running in 8 weeks — about a 5K.",
    description:
      "A gradual run/walk progression for new or returning runners. Every run is easy and conversational (zone 2). Walking breaks " +
      "are part of the plan, not a failure. Repeat any week that feels too hard. A bike or rower can replace any session if you need " +
      "a lower-impact day.",
    category: "cardiovascular",
    types: ["cardio"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: 35,
    goals: ["improve_conditioning", "general_health", "lose_fat"],
    equipment: ["bodyweight"],
    tier: "free",
    progression:
      "Each week the run portions get longer and the walk breaks shorter, finishing with 30 minutes of continuous easy running. " +
      "Week 8 starts lighter and ends with 30 minutes of continuous easy running — roughly a 5K for many runners.",
    progressionModel: "steady",
    warmup: ["5 minutes brisk walking", "Leg swings × 10 each leg", "Ankle circles × 10 each direction"],
    cooldown: ["5 minutes easy walking", "Calf stretch — 30 seconds per side", "Standing quad stretch — 30 seconds per side"],
    days: RUN_WALK_WEEKS[0]!.days,
    weekTemplates: RUN_WALK_WEEKS,
  },
];

export function getProgramSeed(slug: string): ProgramSeed | undefined {
  return PROGRAMS.find((p) => p.slug === slug);
}
