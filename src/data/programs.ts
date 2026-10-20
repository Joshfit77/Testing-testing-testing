import { estimateSessionMinutes, framingMinutes } from "@/lib/domain/session-time";
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
  /**
   * Why a program of four or more weeks has no planned deload (e.g. novice stall-and-reset rules, or a
   * low-fatigue mobility plan). Every multi-week program needs a deload week or this explanation.
   */
  noDeloadReason?: string;
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
  { slug: "powerbuilding", name: "Powerbuilding", description: "Heavy compound strength plus bodybuilding volume — strength and size together." },
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

// --------------------------------------------------------------------------- Builders
// Small helpers so each program reads like a coach's sheet. Session minutes are computed from the
// prescription (work + rest + set-up + ramp-up sets) so the stated length matches what you'll do.

type BuildEx = ProgramExerciseSeed & {
  /** Hypertrophy blocks add sets to this exercise as the block progresses. */
  grow?: boolean;
  /** Isolation work: in hypertrophy blocks it runs half an RPE point closer to failure than compounds. */
  iso?: boolean;
};

const R = (ex: string, sets: number, reps: string, rest: number, o: Partial<BuildEx> = {}): BuildEx => ({ ex, sets, reps, rest, ...o });
const T = (ex: string, sets: number, seconds: number, rest: number, o: Partial<BuildEx> = {}): BuildEx => ({ ex, sets, seconds, rest, ...o });

function clean(e: BuildEx): ProgramExerciseSeed {
  const out: BuildEx = { ...e };
  delete out.grow;
  delete out.iso;
  return out;
}

const toFive = (n: number) => Math.max(10, Math.round(n / 5) * 5);
const joinNotes = (...n: (string | undefined)[]) => n.filter(Boolean).join(" ");

function day(name: string, focus: string, exercises: BuildEx[], extra: { warmup?: string[]; cooldown?: string[]; minutes?: number } = {}): ProgramDaySeed {
  const list = exercises.map(clean);
  const framing = framingMinutes(extra.warmup ?? STANDARD_WARMUP, extra.cooldown ?? STANDARD_COOLDOWN);
  const out: ProgramDaySeed = { name, focus, minutes: extra.minutes ?? toFive(estimateSessionMinutes(list, framing)), exercises: list };
  if (extra.warmup) out.warmup = extra.warmup;
  if (extra.cooldown) out.cooldown = extra.cooldown;
  return out;
}

const DELOAD_NOTE = "Deload: about 60% of your recent working weights; every rep smooth and fast.";

function deloadExercise(e: ProgramExerciseSeed, note = DELOAD_NOTE): ProgramExerciseSeed {
  const out: ProgramExerciseSeed = { ...e, sets: Math.max(1, Math.round(e.sets * 0.6)), notes: joinNotes(e.notes, note) };
  if (e.rpe) out.rpe = Math.max(5, e.rpe - 2);
  if (e.intensity) out.intensity = "about 60% of recent working weight";
  return out;
}

function deloadDays(days: ProgramDaySeed[], note?: string): ProgramDaySeed[] {
  return days.map((d) => day(d.name, d.focus, d.exercises.map((e) => deloadExercise(e, note)), { warmup: d.warmup, cooldown: d.cooldown }));
}

const weeksOf = (n: number, make: (w: number) => ProgramWeekSeed): ProgramWeekSeed[] => Array.from({ length: n }, (_, i) => make(i + 1));
const pct = (p: number) => `${p}% 1RM`;

/** Same days every week, with deloads in the listed weeks (used by templates whose loads are user-driven). */
function repeatWeeks(n: number, days: ProgramDaySeed[], focus: (w: number) => string, deloadWeeks: number[] = [n]): ProgramWeekSeed[] {
  return weeksOf(n, (w) =>
    deloadWeeks.includes(w) ? { focus: "Deload — fewer sets and lighter weights so you recover before the next block", isDeload: true, days: deloadDays(days) } : { focus: focus(w), days },
  );
}

// ----- Hypertrophy blocks: sets per muscle start near the low end of 10–20 hard sets a week and rise
// through the block as reps in reserve fall (an RP-style MEV → MAV mesocycle), then a deload.

interface DayPlan {
  name: string;
  focus: string;
  ex: BuildEx[];
  warmup?: string[];
}
interface BlockWeek {
  focus: string;
  /** Extra sets on exercises marked `grow`. */
  add: number;
  /** Target RPE for compounds (isolation work runs +0.5). */
  rpe: number;
  deload?: boolean;
}

function hypertrophyWeeks(plans: DayPlan[], weeks: BlockWeek[], extras?: (week: number, dayIndex: number) => BuildEx[]): ProgramWeekSeed[] {
  return weeks.map((w, wi) => {
    const out: ProgramWeekSeed = {
      focus: w.focus,
      days: plans.map((p, di) =>
        day(
          p.name,
          p.focus,
          [
            ...p.ex.map((e) => {
              if (w.deload) {
                const d: BuildEx = { ...e, sets: Math.max(1, Math.ceil(e.sets / 2)), notes: joinNotes(e.notes, "Deload: half the sets at the same or slightly lighter weights, 3–4 reps in reserve.") };
                if (e.rpe !== undefined) d.rpe = 6;
                return d;
              }
              const x: BuildEx = { ...e, sets: e.sets + (e.grow ? w.add : 0) };
              if (e.rpe !== undefined) x.rpe = Math.min(9.5, w.rpe + (e.iso ? 0.5 : 0));
              return x;
            }),
            ...(extras ? extras(wi + 1, di) : []),
          ],
          { warmup: p.warmup },
        ),
      ),
    };
    if (w.deload) out.isDeload = true;
    return out;
  });
}

/** Five loading weeks and a deload — repeat the block slightly heavier. */
const HYPERTROPHY_6: BlockWeek[] = [
  { focus: "Week 1 — find your working weights: about 3 reps in reserve on every set", add: 0, rpe: 7 },
  { focus: "Week 2 — same sets, about 2 reps in reserve: beat last week's reps or load", add: 0, rpe: 8 },
  { focus: "Week 3 — add a set to the key exercises, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: "Week 4 — 1–2 reps in reserve; keep adding reps before load", add: 1, rpe: 8.5 },
  { focus: "Week 5 — peak volume: one more set on key exercises, about 1 rep in reserve (isolation can reach failure)", add: 2, rpe: 9 },
  { focus: "Deload — half the sets and easy effort; then run the block again a little heavier", add: 0, rpe: 6, deload: true },
];

/** Two three-week waves, each followed by a deload. */
const HYPERTROPHY_8: BlockWeek[] = [
  { focus: "Wave 1, week 1 — about 3 reps in reserve: find your working weights", add: 0, rpe: 7 },
  { focus: "Wave 1, week 2 — about 2 reps in reserve: add reps or load", add: 0, rpe: 8 },
  { focus: "Wave 1, week 3 — one more set on key exercises, 1–2 reps in reserve", add: 1, rpe: 8.5 },
  { focus: "Deload — half the sets, easy effort", add: 0, rpe: 6, deload: true },
  { focus: "Wave 2, week 1 — start a set higher than wave 1, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: "Wave 2, week 2 — 1–2 reps in reserve; beat wave 1's numbers", add: 1, rpe: 8.5 },
  { focus: "Wave 2, week 3 — peak volume, about 1 rep in reserve (isolation can reach failure)", add: 2, rpe: 9 },
  { focus: "Deload — half the sets, easy effort; then start a new block", add: 0, rpe: 6, deload: true },
];

const secondsLabel = (s: number) => (s % 60 === 0 ? `${s / 60} min` : `${s} s`);

// --------------------------------------------------------------------------- First 5K (run/walk)

/** Run/walk progression: [run A, walk A, rounds A, run B, walk B, rounds B, long-run minutes] in seconds per week. */
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
  const warm = ["5 minutes brisk walking", "Leg swings × 10 each leg", "Ankle circles × 10 each direction"];
  return {
    focus:
      i === 7
        ? "Goal week: an easier start, then 30 minutes of continuous running"
        : `Build easy running time (week ${i + 1}) — repeat this week if the last session felt too hard`,
    days: [
      day(i >= 6 ? "Continuous Run A" : "Run/Walk A", "Easy running", [session(runA, walkA, roundsA)], { warmup: warm }),
      day(i >= 6 ? "Continuous Run B" : "Run/Walk A (repeat)", "Easy running — same as the first session", [session(runA, walkA, roundsA)], { warmup: warm }),
      day(i >= 6 ? "Long Run" : "Run/Walk B", "Longer easy running", [session(runB, walkB, roundsB)], { warmup: warm }),
    ],
  };
});

// --------------------------------------------------------------------------- Strength templates

/** Novice linear progression: alternate workouts A and B, three sessions a week (A-B-A, then B-A-B). */
function noviceLpWeeks(): ProgramWeekSeed[] {
  const phase = (w: number) => (w <= 4 ? 0 : w <= 8 ? 1 : 2);
  const lower = ["+2.5 kg / 5 lb every session", "+2.5 kg / 5 lb (+1–2.5 kg / 2.5–5 lb if slow)", "Smallest jump you can make; reset 10% after 3 stalls"];
  const upper = ["+2.5 kg / 5 lb every session", "+1–2.5 kg / 2.5–5 lb (use small plates)", "Smallest jump you can make; reset 10% after 3 stalls"];
  const pull = ["+5 kg / 10 lb every session", "+2.5–5 kg / 5–10 lb", "+2.5 kg / 5 lb; reset 10% after 3 stalls"];
  const A = (w: number) =>
    day("Workout A", "Squat, bench press, deadlift", [
      R("back-squat", 3, "5", 180, { intensity: lower[phase(w)], notes: "Three work sets of 5 at the same weight after warm-ups. All 15 reps made? Add weight next session." }),
      R("bench-press", 3, "5", 180, { intensity: upper[phase(w)] }),
      R("conventional-deadlift", 1, "5", 180, { intensity: pull[phase(w)], notes: "One work set of 5 after 3–4 warm-up sets. Reset every rep." }),
      R("chin-up", 3, "5-8", 120, { notes: "Band-assisted if needed. Add reps, then add weight." }),
    ]);
  const B = (w: number) =>
    day("Workout B", "Squat, overhead press, row", [
      R("back-squat", 3, "5", 180, { intensity: lower[phase(w)], notes: "Same rule: all reps made → add weight next session." }),
      R("overhead-press", 3, "5", 180, { intensity: upper[phase(w)] }),
      R("barbell-row", 3, "5", 120, { intensity: upper[phase(w)], notes: "If you've been coached on it, power cleans (5 × 3) can replace rows." }),
      R("back-extension", 2, "10", 75, { notes: "Builds the lower back and glutes for the deadlift." }),
    ]);
  const focus = [
    "Phase 1: add weight every session — it should feel easy at first",
    "Phase 2: smaller jumps on the presses; eat and sleep enough to keep progressing",
    "Phase 3: stalls arrive — repeat a weight once, then reset that lift 10% after a third miss",
  ];
  return weeksOf(12, (w) => ({ focus: focus[phase(w)]!, days: w % 2 === 1 ? [A(w), B(w), A(w)] : [B(w), A(w), B(w)] }));
}

/** Weekly undulating (in the style of the Texas Method): volume, light and intensity days. */
function weeklyUndulatingWeeks(): ProgramWeekSeed[] {
  const intensityScheme: Record<number, { sets: number; reps: string; note: string }> = {
    1: { sets: 1, reps: "5", note: "New 5-rep max: about 2.5 kg / 5 lb more than last week's top set." },
    2: { sets: 1, reps: "5", note: "New 5-rep max — small jumps." },
    3: { sets: 1, reps: "5", note: "New 5-rep max — small jumps." },
    5: { sets: 2, reps: "3", note: "Two heavy triples: about 5% heavier than your last 5-rep max." },
    6: { sets: 3, reps: "2", note: "Three heavy doubles: a little heavier than week 5's triples." },
    7: { sets: 1, reps: "5", note: "Back to a 5-rep max — aim to beat week 3." },
  };
  return weeksOf(8, (w) => {
    const deload = w === 4 || w === 8;
    const upperMain = w % 2 === 1 ? "bench-press" : "overhead-press";
    const upperLight = w % 2 === 1 ? "overhead-press" : "bench-press";
    const vol = day("Volume Day", "5 × 5 at about 90% of your intensity-day weight", [
      R("back-squat", deload ? 3 : 5, "5", 180, { intensity: deload ? "80% of last intensity-day weight" : "90% of last intensity-day 5", rpe: deload ? 6 : 7.5 }),
      R(upperMain, deload ? 3 : 5, "5", 180, { intensity: deload ? "80% of last intensity-day weight" : "90% of last intensity-day 5", rpe: deload ? 6 : 7.5 }),
      R("conventional-deadlift", 1, "5", 180, { rpe: deload ? 6 : 8, notes: "One heavy set of 5; add 2.5–5 kg / 5–10 lb a week while it moves well." }),
      R("barbell-row", 3, "8", 90, { rpe: 7, notes: "Upper-back work to balance the pressing." }),
    ]);
    const light = day("Light Day", "Recovery: light squats, the other press and pulling", [
      R("back-squat", 2, "5", 150, { intensity: "80% of volume-day weight", rpe: 6 }),
      R(upperLight, 3, "5", 150, { rpe: 7 }),
      R("chin-up", 3, "6-10", 120),
      R("back-extension", 3, "10", 75),
    ]);
    const s = intensityScheme[w];
    const intense = deload
      ? day("Intensity Day (light)", "Work up to a smooth triple — no PR attempts this week", [
          R("back-squat", 1, "3", 240, { rpe: 7, notes: "A smooth triple, not a max." }),
          R(upperMain, 1, "3", 240, { rpe: 7 }),
          R("barbell-row", 3, "8", 90),
        ])
      : day("Intensity Day", "Set a new rep record on squat and the press", [
          R("back-squat", s!.sets, s!.reps, 300, { rpe: 9, notes: `${s!.note} Ramp up over 4–5 warm-up sets.` }),
          R(upperMain, s!.sets, s!.reps, 300, { rpe: 9, notes: s!.note }),
          R("power-clean", 5, "3", 120, { notes: "Fast and crisp. Not coached on the clean? Do barbell rows 3 × 8 instead." }),
        ]);
    const days = [vol, light, intense];
    if (deload) return { focus: "Lighter week — fewer volume sets and no records, so the next wave starts fresh", isDeload: true, days };
    return {
      focus: w <= 3 ? `Weekly records: a new 5-rep max on intensity day (week ${w})` : `New rep targets: ${s!.sets} × ${s!.reps} on intensity day`,
      days,
    };
  });
}

/** 4-week waves from a training max (in the style of 5/3/1): cycle 1 with 5×10 volume, cycle 2 with "first set last" 5×5. */
const WAVES = [
  { reps: "5/5/5+", pcts: [65, 75, 85], label: "5s week" },
  { reps: "3/3/3+", pcts: [70, 80, 90], label: "3s week" },
  { reps: "5/3/1+", pcts: [75, 85, 95], label: "5/3/1 week" },
] as const;
const WAVE_DELOAD = { reps: "5/5/5", pcts: [40, 50, 60] } as const;

function trainingMaxWeeks(): ProgramWeekSeed[] {
  const lifts: { lift: string; name: string; assist: BuildEx[] }[] = [
    {
      lift: "overhead-press",
      name: "Press Day",
      assist: [R("chin-up", 5, "5-10", 90, { notes: "Aim for 50 total reps across sets." }), R("dips", 3, "8-12", 90), R("face-pull", 3, "15-20", 45)],
    },
    {
      lift: "conventional-deadlift",
      name: "Deadlift Day",
      assist: [R("hanging-knee-raise", 3, "10-15", 60), R("bulgarian-split-squat", 3, "8 per side", 90), T("dead-hang", 2, 40, 60)],
    },
    {
      lift: "bench-press",
      name: "Bench Day",
      assist: [R("one-arm-dumbbell-row", 5, "10 per side", 75, { notes: "Aim for 50 total reps per side." }), R("lateral-raise", 3, "12-20", 45), R("triceps-pushdown", 3, "10-15", 60)],
    },
    {
      lift: "back-squat",
      name: "Squat Day",
      assist: [R("seated-leg-curl", 3, "10-15", 60), R("ab-wheel-rollout", 3, "8-12", 60), R("standing-calf-raise", 3, "10-15", 45)],
    },
  ];
  return weeksOf(8, (w) => {
    const cycle = w <= 4 ? 1 : 2;
    const wi = (w - 1) % 4;
    if (wi === 3) {
      return {
        focus: `Deload (cycle ${cycle}) — 40/50/60% of your training max, no last-set max effort. Then raise your training max`,
        isDeload: true,
        days: lifts.map((l) =>
          day(l.name, "Light technique work and recovery", [
            R(l.lift, 3, WAVE_DELOAD.reps, 120, { intensity: `${WAVE_DELOAD.pcts.join("% / ")}% TM`, notes: "Easy, fast reps." }),
            ...l.assist.slice(0, 2).map((a) => ({ ...a, sets: 2 })),
          ]),
        ),
      };
    }
    const wave = WAVES[wi]!;
    // Cycle 1: 5 × 10 of the opposite lift (bench ↔ press, squat ↔ deadlift), a "boring but big" variant that
    // also trains each lift twice a week. Cycle 2: "first set last" 5 × 5 of the same lift, written on the main row.
    const OPPOSITE: Record<string, string> = { "overhead-press": "bench-press", "bench-press": "overhead-press", "back-squat": "conventional-deadlift", "conventional-deadlift": "back-squat" };
    const mainRow = (lift: string): BuildEx =>
      cycle === 1
        ? R(lift, 3, wave.reps, 180, {
            intensity: `${wave.pcts.join("% / ")}% TM`,
            notes: "Training max (TM) = 90% of your 1RM. One set at each percentage; the last set is for as many good reps as possible (stop 1 rep before a grinder).",
          })
        : R(lift, 8, `${wave.reps} + 5×5`, 180, {
            intensity: `${wave.pcts.join("% / ")}% TM; 5×5 @ ${wave.pcts[0]}%`,
            notes: `Training max (TM) = 90% of your 1RM. Sets 1–3: one set at each percentage, the last for as many good reps as possible. Sets 4–8: "first set last" — 5 × 5 at the first-set weight (${wave.pcts[0]}% TM).`,
          });
    return {
      focus: `Cycle ${cycle}, ${wave.label}: ${wave.pcts.join("/")}% of your training max, last set for as many good reps as you can`,
      days: lifts.map((l) =>
        day(l.name, `${wave.label}: main lift, ${cycle === 1 ? "5 × 10 of the opposite lift" : "5 × 5 first-set-last"}, assistance`, [
          mainRow(l.lift),
          ...(cycle === 1
            ? [
                R(OPPOSITE[l.lift]!, 5, "10", 90, {
                  intensity: `${[50, 55, 60][wi]}% TM`,
                  notes: "5 × 10 volume sets of the opposite lift (a \"boring but big\" variant), using that lift's training max. Rest 60–90 s; every set crisp.",
                }),
              ]
            : []),
          ...l.assist,
        ]),
      ),
    };
  });
}

/** Tiered program in the style of GZCL's linear progression: T1 heavy, T2 volume, T3 pump. */
function tieredWeeks(): ProgramWeekSeed[] {
  const t1 = (ex: string) => R(ex, 5, "3 (last set 3+)", 180, { notes: "T1: 5 × 3, last set as many reps as possible. Add weight every session. Miss? Next time 6 × 2, then 10 × 1, then retest a 5-rep max and restart at 85% of it." });
  const t2 = (ex: string) => R(ex, 3, "10", 120, { notes: "T2: 3 × 10, add weight every session. Miss? Move to 3 × 8, then 3 × 6, then restart at a lighter 3 × 10." });
  const t3 = (ex: string) => R(ex, 3, "15 (last set 15+)", 60, { notes: "T3: same weight until the last set reaches 25 reps, then add weight." });
  const days = [
    day("Day 1 — Squat T1", "Heavy squat, bench volume, lat pump", [t1("back-squat"), t2("bench-press"), t3("lat-pulldown")]),
    day("Day 2 — Press T1", "Heavy overhead press, deadlift volume, row pump", [t1("overhead-press"), t2("conventional-deadlift"), t3("one-arm-dumbbell-row")]),
    day("Day 3 — Bench T1", "Heavy bench, squat volume, lat pump", [t1("bench-press"), t2("back-squat"), t3("lat-pulldown")]),
    day("Day 4 — Deadlift T1", "Heavy deadlift, press volume, row pump", [t1("conventional-deadlift"), t2("overhead-press"), t3("one-arm-dumbbell-row")]),
  ];
  const focus = (w: number) =>
    w <= 5
      ? "Stage 1: add weight every session on every tier"
      : w <= 9
        ? "First stage changes: when a lift stalls, drop to the next set-and-rep scheme instead of stopping"
        : "Late stages: retest 5-rep maxes when T1 completes 10 × 1, then restart a little heavier";
  return repeatWeeks(12, days, focus, [6, 12]);
}

// --------------------------------------------------------------------------- Powerlifting

/** RPE-anchored percentage block: accumulation, deload, intensification, deload & re-test. */
function powerliftingBaseWeeks(): ProgramWeekSeed[] {
  const acc = [72.5, 75, 77.5];
  const int = [80, 82.5, 85];
  return weeksOf(8, (w) => {
    const deload = w === 4 || w === 8;
    const phase = w <= 3 ? "acc" : "int";
    const i = phase === "acc" ? w - 1 : w - 5;
    const sq = deload ? { s: 3, r: "5", p: 60 } : phase === "acc" ? { s: 4, r: "5", p: acc[i]! } : { s: 5, r: "3", p: int[i]! };
    const bp = deload ? { s: 3, r: "5", p: 60 } : phase === "acc" ? { s: 5, r: "5", p: acc[i]! } : { s: 5, r: "3", p: int[i]! };
    const dl = deload ? { s: 2, r: "3", p: 65 } : phase === "acc" ? { s: 4, r: "4", p: acc[i]! + 2.5 } : { s: 4, r: "2", p: int[i]! + 2.5 };
    const rpe = deload ? 6 : phase === "acc" ? 7 + 0.5 * i : 7.5 + 0.5 * i;
    const accessory = (sets: number) => (deload ? Math.max(2, sets - 1) : sets);
    const days = [
      day("Squat Focus", "Competition squat + posterior chain", [
        R("back-squat", sq.s, sq.r, 210, { intensity: pct(sq.p), rpe }),
        R("romanian-deadlift", accessory(3), "8", 150, { rpe: deload ? 6 : 7 }),
        R("bulgarian-split-squat", accessory(3), "8 per side", 90),
        R("ab-wheel-rollout", 3, "8-10", 60),
      ]),
      day("Bench Focus", "Competition bench + upper back", [
        R("bench-press", bp.s, bp.r, 180, { intensity: pct(bp.p), rpe, notes: "Pause each rep briefly on the chest." }),
        R("barbell-row", accessory(4), "8", 120, { rpe: 7 }),
        R("incline-dumbbell-press", accessory(3), "10", 90),
        R("face-pull", 3, "15", 60),
      ]),
      day("Deadlift Focus", "Competition deadlift + quads", [
        R("conventional-deadlift", dl.s, dl.r, 240, { intensity: pct(dl.p), rpe, notes: "Pull sumo if that's your competition stance." }),
        R("front-squat", accessory(3), "5", 150, { rpe: deload ? 6 : 7 }),
        R("lat-pulldown", accessory(3), "10", 90),
        T("side-plank", 3, 30, 45),
      ]),
      day("Bench Volume", "Bench variation, overhead strength and triceps", [
        R("close-grip-bench-press", deload ? 2 : 4, phase === "acc" ? "6" : "4", 150, { intensity: pct(deload ? 55 : phase === "acc" ? 67.5 + 2.5 * i : 72.5 + 2.5 * i), rpe: deload ? 6 : 7 }),
        R("overhead-press", accessory(3), "6", 120, { rpe: 7 }),
        R("one-arm-dumbbell-row", accessory(3), "10 per side", 75),
        R("triceps-pushdown", 3, "12", 60),
      ]),
    ];
    if (w === 4) return { focus: "Deload: lighter loads and fewer sets before the heavier phase", isDeload: true, days };
    if (w === 8) return { focus: "Deload & re-test: keep sessions light, then (optionally) work up to a smooth heavy triple at the end of the week", isDeload: true, days };
    return { focus: phase === "acc" ? `Accumulation week ${w}: sets of 4–5 at ${acc[i]}%` : `Intensification week ${w - 4}: heavier triples at ${int[i]}%`, days };
  });
}

/** 12-week peak for a meet or a max test. */
function peakingWeeks(): ProgramWeekSeed[] {
  type P = { sets: number; reps: string; p: number; notes?: string };
  const plan = (w: number) => {
    if (w <= 4) {
      const p = 70 + 2.5 * (w - 1);
      return { kind: "acc", sq: { sets: 4, reps: "6", p }, bp: { sets: 5, reps: "6", p }, dl: { sets: 3, reps: "5", p: p + 2.5 }, sec: { sets: 3, reps: "8", p: 62.5 } };
    }
    if (w === 5) return { kind: "deload", sq: { sets: 3, reps: "4", p: 60 }, bp: { sets: 3, reps: "4", p: 60 }, dl: { sets: 2, reps: "3", p: 65 }, sec: { sets: 2, reps: "6", p: 55 } };
    if (w <= 9) {
      const p = 80 + 2.5 * (w - 6);
      return { kind: "int", sq: { sets: 5, reps: "3", p }, bp: { sets: 5, reps: "3", p }, dl: { sets: 4, reps: "2", p: p + 2.5 }, sec: { sets: 3, reps: "5", p: 70 } };
    }
    if (w === 10)
      return {
        kind: "peak",
        sq: { sets: 1, reps: "1", p: 92.5, notes: "Heavy single, then 3 × 2 at 85%. Stop if the bar slows down noticeably." },
        bp: { sets: 1, reps: "1", p: 92.5, notes: "Heavy single with a competition pause, then 3 × 2 at 85%." },
        dl: { sets: 1, reps: "1", p: 90, notes: "Last heavy pull of the block, about 10 days out. Then 2 × 2 at 80%." },
        sec: { sets: 2, reps: "3", p: 70 },
      };
    return {
      kind: "taper",
      sq: { sets: 1, reps: "1", p: 90, notes: "Opener practice: a single at your planned opener, then 2 × 2 at 75%." },
      bp: { sets: 1, reps: "1", p: 90, notes: "Opener practice with full commands, then 2 × 2 at 75%." },
      dl: { sets: 2, reps: "2", p: 70, notes: "Light and fast — no heavy pulls in the last 10 days." },
      sec: { sets: 2, reps: "3", p: 60 },
    };
  };
  const ex = (slug: string, x: P, rest: number, rpe: number) => R(slug, x.sets, x.reps, rest, { intensity: pct(x.p), rpe, ...(x.notes ? { notes: x.notes } : {}) });
  return weeksOf(12, (w) => {
    if (w === 12) {
      return {
        focus: "Meet week: openers early, light technique, then three attempts per lift (or a max-test day)",
        isDeload: true,
        days: [
          day("Meet Week — Openers", "One single at your opener for squat and bench, then go home", [
            R("back-squat", 1, "1", 300, { intensity: pct(90), rpe: 7, notes: "An opener you could triple on a bad day. Commands: “Squat”, “Rack”." }),
            R("bench-press", 1, "1", 300, { intensity: pct(90), rpe: 7, notes: "“Start”, a motionless pause, “Press”, “Rack”." }),
          ]),
          day("Meet Week — Light Technique", "Short and light: rehearse setup and commands", [
            R("back-squat", 2, "2", 120, { intensity: pct(55), rpe: 5 }),
            R("bench-press", 2, "2", 120, { intensity: pct(55), rpe: 5 }),
            R("conventional-deadlift", 1, "2", 120, { intensity: pct(55), rpe: 5 }),
          ]),
          day("Rest or Mobility", "Walk, stretch, sleep, eat normally", [T("brisk-walk", 1, 1200, 0, { notes: "Easy." }), T("worlds-greatest-stretch", 2, 45, 15)]),
          day("Meet Day", "Three attempts per lift: make your opener, build momentum", [
            R("back-squat", 3, "1", 600, { intensity: "opener 90–92% · second 95–97% · third 100–103%", rpe: 9, notes: "Last warm-up about 85% roughly 5–8 minutes before your opener. Take the third only if the second moved well." }),
            R("bench-press", 3, "1", 600, { intensity: "opener 90–92% · second 95–97% · third 100–103%", rpe: 9 }),
            R("conventional-deadlift", 3, "1", 600, { intensity: "opener 90–92% · second 95–97% · third 100–103%", rpe: 9, notes: "Hold the lockout until “Down”." }),
          ]),
        ],
      };
    }
    const p = plan(w);
    const rpe = p.kind === "acc" ? 7 + 0.5 * Math.min(w - 1, 2) : p.kind === "int" ? 7.5 + 0.5 * Math.min(w - 6, 3) : p.kind === "peak" ? 8.5 : 6;
    const accSets = p.kind === "acc" ? 3 : p.kind === "int" ? 3 : 2;
    const days = [
      day("Squat + Bench Volume", "Competition squat, second bench exposure", [
        ex("back-squat", p.sq, 240, rpe),
        ex("bench-press", p.sec, 150, Math.min(rpe, 7)),
        R("romanian-deadlift", accSets, "8", 120, { rpe: 7 }),
        R("ab-wheel-rollout", 2, "8-10", 60),
      ]),
      day("Bench + Deadlift", "Competition bench and deadlift", [
        ex("bench-press", p.bp, 210, rpe),
        ex("conventional-deadlift", p.dl, 240, rpe),
        R("barbell-row", accSets, "8", 90, { rpe: 7 }),
        R("face-pull", 2, "15-20", 45),
      ]),
      day("Squat & Bench Variations", "Pause squats and paused bench for position", [
        ex("pause-squat", { ...p.sec, notes: "2-second pause at depth." }, 180, Math.min(rpe, 7.5)),
        ex("paused-bench-press", { ...p.sec, notes: "Long, motionless pause on the chest." }, 150, Math.min(rpe, 7.5)),
        R("lat-pulldown", accSets, "10", 75),
        R("triceps-pushdown", accSets, "12", 60),
      ]),
      day("Deadlift Variation + Upper", "Pull weak points and upper-back support", [
        ex("deficit-deadlift", { ...p.sec, p: Math.max(55, p.sec.p - 5), notes: "1–2 inch deficit — strength off the floor." }, 180, Math.min(rpe, 7.5)),
        R("overhead-press", accSets, "6", 120, { rpe: 7 }),
        R("chest-supported-row", accSets, "10", 75),
        T("side-plank", 2, 30, 45),
      ]),
    ];
    if (p.kind === "deload") return { focus: "Deload: lighter and shorter so the heavy phase starts fresh", isDeload: true, days };
    if (p.kind === "acc") return { focus: `Accumulation (week ${w}): volume at ${p.sq.p}% — build work capacity and technique`, days };
    if (p.kind === "int") return { focus: `Intensification (week ${w - 5}): triples at ${p.sq.p}%, less volume`, days };
    if (p.kind === "peak") return { focus: "Peak: heavy singles at 90–92.5%, volume cut by about 40%", days };
    return { focus: "Taper: opener practice and about half the volume — intensity stays, fatigue drops", days };
  });
}

/** Conjugate-style week: max-effort and dynamic-effort days for upper and lower body. */
function conjugateWeeks(): ProgramWeekSeed[] {
  const meLower = ["box-squat", "box-squat", "deficit-deadlift", "deficit-deadlift", "pause-squat", "pause-squat", "block-pull", "block-pull"];
  const meUpper = ["close-grip-bench-press", "close-grip-bench-press", "pin-press", "pin-press", "paused-bench-press", "paused-bench-press", "close-grip-bench-press", "close-grip-bench-press"];
  const deSquat = [50, 55, 60, 0, 52.5, 57.5, 62.5, 0];
  const deBench = [50, 52.5, 55, 0, 50, 52.5, 55, 0];
  return weeksOf(8, (w) => {
    const deload = w === 4 || w === 8;
    const me = (slug: string) =>
      deload
        ? R(slug, 3, "3", 180, { rpe: 7, notes: "Deload: three crisp triples, no max." })
        : R(slug, 3, "1-3 top + 2 × 3", 240, {
            rpe: 9,
            notes: "Max effort: work up in small jumps to a 1–3 rep max for today (RPE 9, no grinders), then 2 back-off triples at about 85% of it. The exercise rotates every 2 weeks so you can push it hard without stalling.",
          });
    const days = [
      day("Max-Effort Lower", "Heavy squat or pull variation, then posterior chain", [
        me(meLower[w - 1]!),
        R("good-morning", deload ? 2 : 4, "8", 120, { rpe: 7 }),
        R("seated-leg-curl", deload ? 2 : 3, "10-15", 60),
        R("sled-push", deload ? 2 : 4, "20 m", 90, { notes: "Heavy sled pushes: leg drive with no eccentric stress." }),
        R("ab-wheel-rollout", 3, "10", 60),
      ]),
      day("Max-Effort Upper", "Heavy bench variation, then triceps and upper back", [
        me(meUpper[w - 1]!),
        R("overhead-triceps-extension", deload ? 2 : 4, "10-15", 60),
        R("barbell-row", deload ? 2 : 4, "8-10", 90),
        R("lat-pulldown", deload ? 2 : 3, "10-12", 75),
        R("face-pull", 3, "15-20", 45),
      ]),
      day("Dynamic-Effort Lower", "Fast box squats and speed pulls", [
        deload
          ? R("box-squat", 6, "2", 60, { intensity: pct(45), notes: "Easy speed work." })
          : R("box-squat", 10, "2", 60, { intensity: pct(deSquat[w - 1]!), notes: "Dynamic effort: move the bar as fast as possible; 45–60 s between sets. Bands or chains optional." }),
        R("conventional-deadlift", deload ? 4 : 6, "1", 60, { intensity: pct(deload ? 55 : 65), notes: "Speed pulls: reset and explode every rep." }),
        R("bulgarian-split-squat", deload ? 2 : 3, "8 per side", 90),
        R("back-extension", deload ? 2 : 3, "12-15", 60),
      ]),
      day("Dynamic-Effort Upper", "Fast bench triples, then repetition work", [
        deload
          ? R("bench-press", 6, "3", 60, { intensity: pct(45), notes: "Easy speed work." })
          : R("bench-press", 9, "3", 60, { intensity: pct(deBench[w - 1]!), notes: "Dynamic effort: 9 fast triples, 45–60 s rest; rotate grip width every 3 sets." }),
        R("dumbbell-bench-press", deload ? 2 : 3, "10-12", 75),
        R("triceps-pushdown", deload ? 2 : 4, "12-15", 45),
        R("lat-pulldown", deload ? 2 : 4, "10-12", 60),
        R("lateral-raise", 3, "15-20", 45),
      ]),
    ];
    if (deload) return { focus: w === 8 ? "Deload — then test competition lifts on the max-effort days next week if you're peaking" : "Deload — no max-effort singles, light speed work", isDeload: true, days };
    return { focus: `Wave ${w <= 3 ? 1 : 2}: speed squats at ${deSquat[w - 1]}% and speed bench at ${deBench[w - 1]}%; max effort on ${meLower[w - 1]!.replace(/-/g, " ")} and ${meUpper[w - 1]!.replace(/-/g, " ")}`, days };
  });
}

// --------------------------------------------------------------------------- Strongman

const EVENT_WARMUP = ["5 minutes easy carries, sled or bike", "Hip openers, band pull-aparts and wrist circles", "2–3 build-up runs or reps with each implement before your first working set"];

function strongmanWeeks(): ProgramWeekSeed[] {
  return weeksOf(8, (w) => {
    const deload = w === 4 || w === 8;
    const k = w <= 3 ? w - 1 : w - 5;
    const wave2 = w >= 5;
    const staticScheme = deload
      ? { sets: 3, reps: "3", rpe: 6, note: "Deload: light, fast reps." }
      : wave2
        ? [{ sets: 5, reps: "2", rpe: 8, note: "Heavy doubles." }, { sets: 4, reps: "2", rpe: 8.5, note: "Heavier doubles." }, { sets: 1, reps: "1", rpe: 9, note: "Work up to a heavy single (RPE 9), then 2 × 2 at 85% of it." }][k]!
        : [{ sets: 5, reps: "3", rpe: 7, note: "Smooth triples." }, { sets: 5, reps: "3", rpe: 7.5, note: "Heavier triples." }, { sets: 4, reps: "3", rpe: 8, note: "Heaviest triples of the wave." }][k]!;
    const runs = deload ? 2 : wave2 ? 3 : 4;
    const eventNote = (name: string, jump: string, secs: number) =>
      deload
        ? `${name}: ${runs} × 20 m light — technique and speed only.`
        : wave2
          ? `${name}: ${runs} × 20 m heavy. Add ${jump} when every run is under ${secs} s; keep the weight if you drop it mid-run.`
          : `${name}: ${runs} × 20 m at a moderate weight, fast and smooth. Add ${jump} next week when every run is under ${secs} s.`;
    const days = [
      day("Max Effort — Overhead", "Log press, push press, triceps and upper back", [
        R("log-press", staticScheme.sets, staticScheme.reps, 180, { rpe: staticScheme.rpe, notes: `Clean every rep. ${staticScheme.note}` }),
        R("push-press", deload ? 2 : 3, "5", 150, { rpe: deload ? 6 : 7.5, notes: "Axle or barbell. Drive with the legs, lock out hard." }),
        R("close-grip-bench-press", deload ? 2 : 3, "6-8", 120, { rpe: 7.5, notes: "Triceps strength finishes heavy overhead lockouts." }),
        R("chest-supported-row", deload ? 2 : 4, "8-10", 90),
        R("face-pull", 3, "15", 45),
      ]),
      day("Max Effort — Deadlift", "Heavy pulls, an above-the-knee pull, hamstrings and grip", [
        R("conventional-deadlift", staticScheme.sets, staticScheme.reps, 240, { rpe: staticScheme.rpe, notes: staticScheme.note }),
        R("block-pull", deload ? 2 : 3, "3", 180, { rpe: deload ? 6 : 7.5, notes: "Bar just above the knee (about 18 in / 46 cm) — common strongman deadlift height. Straps are fine." }),
        R("good-morning", deload ? 2 : 3, "8", 120, { rpe: 7 }),
        T("dead-hang", 3, 40, 60, { notes: "Double-overhand grip." }),
        R("ab-wheel-rollout", 3, "8-10", 60),
      ]),
      day("Squat & Overhead Volume", "Squats, Zercher squats and a second press session", [
        R("back-squat", deload ? 3 : 4, "5", 180, { rpe: deload ? 6 : 7 + 0.5 * k }),
        R("zercher-squat", deload ? 2 : 3, "6", 150, { notes: "Builds the lap position for stones, kegs and sandbags." }),
        R("overhead-press", deload ? 2 : 4, "6", 120, { rpe: deload ? 6 : 7 }),
        R("barbell-row", deload ? 2 : 3, "8-10", 90),
        R("hammer-curl", 3, "10-12", 60, { notes: "Strong biceps help protect the elbows on stones and axle cleans." }),
      ]),
      day(
        "Event Day",
        "Yoke, farmer's walk, stones and a sled drag — by distance and target time",
        [
          T("yoke-carry", runs, 15, 150, { reps: "20 m", notes: eventNote("Yoke", "10 kg / 20 lb", 15) }),
          T("strongman-farmers-walk", runs, 12, 150, { reps: "20 m", notes: eventNote("Farmer's walk", "5 kg / 10 lb per hand", 12) }),
          R("atlas-stone-load", deload ? 2 : wave2 ? 5 : 4, deload ? "2" : wave2 ? "1-2" : "3", 150, {
            notes: deload ? "Light stones: practise the lap and extension." : wave2 ? "Heavy singles and doubles — reset fully between reps." : "A moderate stone: smooth lap, re-grip, extend. Go heavier when every rep is smooth.",
          }),
          T("sled-drag", runs, 20, 120, { reps: "20 m", notes: eventNote("Sled drag (truck-pull substitute)", "20 kg / 45 lb", 20) }),
        ],
        { warmup: EVENT_WARMUP },
      ),
    ];
    if (deload) return { focus: "Deload: light statics and light, fast events", isDeload: true, days };
    return { focus: wave2 ? `Intensification (week ${k + 1}): heavier doubles and singles, heavier events over 20 m` : `Accumulation (week ${k + 1}): triples on the statics, moderate events done fast`, days };
  });
}

// --------------------------------------------------------------------------- Combat

const MMA_WARMUP = ["5 minutes jump rope or easy shadowboxing", "Hip openers, neck circles and world's greatest stretch × 3 per side", "2 × 10-second build-up efforts"];

/** An 8-week fight camp: general prep, specific prep, peak, then fight week. */
function fightCampWeeks(): ProgramWeekSeed[] {
  const phase = (w: number) => (w <= 3 ? "gpp" : w <= 6 ? "spp" : w === 7 ? "peak" : "fight");
  return weeksOf(8, (w) => {
    const ph = phase(w);
    if (ph === "fight") {
      return {
        focus: "Fight week taper: short, sharp sessions — arrive fresh. Weight cut and rehydration are your coach's call",
        isDeload: true,
        days: [
          day("Fight Week — Primer", "A few jumps, light fast lifts and short sprints", [
            R("box-jump", 2, "3", 60),
            R("trap-bar-deadlift", 2, "2", 120, { rpe: 6, notes: "Light and fast." }),
            T("air-bike-sprint", 3, 6, 60, { notes: "Short, sharp — not tiring (rest at least 10× the sprint)." }),
          ], { warmup: MMA_WARMUP }),
          day("Fight Week — Sharp & Light", "Crisp shadowboxing and a few throws", [
            T("shadowboxing", 2, 120, 60, { notes: "Sharp and light — stay fast, stay fresh." }),
            R("medicine-ball-rotational-throw", 2, "4 per side", 60),
          ], { warmup: ["5 minutes easy jump rope or shadowboxing"] }),
          day("Fight Week — Mobility & Breathing", "Loosen up and stay calm — the work is done", [T("90-90-hip-switch", 2, 45, 15), T("thoracic-open-book", 2, 45, 15), T("childs-pose", 1, 90, 0)], { warmup: [] }),
        ],
      };
    }
    const k = ph === "gpp" ? w - 1 : ph === "spp" ? w - 4 : 0;
    const strength =
      ph === "gpp"
        ? { sets: 3 + Math.min(k, 1), reps: "5", rpe: 7, note: "Strength base: leave 2–3 reps in reserve — no grinding." }
        : ph === "spp"
          ? { sets: 4, reps: "3", rpe: 8, note: "Max strength: heavy, crisp triples. Leave 2 reps in reserve." }
          : { sets: 3, reps: "2", rpe: 7, note: "Power phase: moderate load moved as fast as possible." };
    const alactic = ph === "gpp" ? { sets: 6, secs: 8, rest: 90 } : ph === "spp" ? { sets: 8, secs: 8, rest: 80 } : { sets: 8, secs: 10, rest: 80 };
    const glyco = ph === "gpp" ? { sets: 6, secs: 30, rest: 90 } : ph === "spp" ? { sets: 6 + Math.min(k, 2), secs: 30, rest: 60 } : { sets: 6, secs: 45, rest: 45 };
    const rounds =
      ph === "gpp"
        ? { sets: 4, secs: 180, note: "Aerobic-power rounds: steady and technical, breathing under control." }
        : ph === "spp"
          ? { sets: 5, secs: 300, note: "5-minute rounds at fight pace with a 10-second surge every 30 seconds." }
          : { sets: 5, secs: 300, note: "Fight simulation: five 5-minute rounds at your planned pace, 1 minute rest." };
    const days = [
      day("S&C 1 — Max Strength + Alactic Power", "Jumps, heavy lower body, upper pull and push, neck, then short all-out sprints", [
        R("trap-bar-jump", 3, "3", 90, { notes: "Power first, while fresh: full reset between reps." }),
        R("trap-bar-deadlift", strength.sets, strength.reps, 150, { rpe: strength.rpe, notes: strength.note }),
        R("pull-up", 3, "5-8", 90, { notes: "Grip and pulling strength for clinches." }),
        R("landmine-press", 3, "5 per side", 90),
        T("air-bike-sprint", alactic.sets, alactic.secs, alactic.rest, { notes: `Alactic power: ${alactic.secs} s all-out, ${alactic.rest} s easy (at least 1:8 work to rest).` }),
        T("neck-isometrics", 2, 15, 30, { notes: "Front, back and each side. Build gradually — never train through neck pain." }),
      ], { warmup: MMA_WARMUP }),
      day("S&C 2 — Power-Endurance + Glycolytic", "Rotational power, single-leg strength, then glycolytic intervals", [
        R("medicine-ball-rotational-throw", 3, "5 per side", 60, { notes: "Hips lead, throw hard, reset between reps." }),
        R("bulgarian-split-squat", 3, `${strength.reps === "5" ? "6" : "4"} per side`, 120, { rpe: Math.min(strength.rpe, 7.5) }),
        R("chest-supported-row", 3, "8", 75),
        T("air-bike-sprint", glyco.sets, glyco.secs, glyco.rest, { rpe: 8, notes: `Glycolytic intervals: ${glyco.secs} s hard, ${glyco.rest} s easy. Skip if you spar hard today or tomorrow.` }),
        T("copenhagen-plank", 2, 20, 45, { notes: "Groin resilience for kicks and sprawls: 20 s per side." }),
      ], { warmup: MMA_WARMUP }),
      day("S&C 3 — Fight-Specific Conditioning", "Rounds matched to 5-minute fight rounds, sprawls, mat work and neck", [
        T("heavy-bag-rounds", rounds.sets, rounds.secs, 60, { rpe: 8, notes: rounds.note }),
        T("sprawl", 5, ph === "gpp" ? 15 : 20, 40, { notes: "Sprawl and get back to stance fast." }),
        T("hip-escape", 3, 30, 30, { notes: "Smooth and continuous under fatigue." }),
        R("band-neck-training", 2, "12 each way", 30, { notes: "Light band, slow reps. Never train through neck pain." }),
      ], { warmup: MMA_WARMUP }),
    ];
    const focus =
      ph === "gpp"
        ? `General preparation (week ${k + 1}): strength base, aerobic power and technique on every drill`
        : ph === "spp"
          ? `Specific preparation (week ${k + 1}): max strength, 5-minute fight-pace rounds and glycolytic intervals`
          : "Peak: power over strength, fight simulation rounds, less lifting volume";
    return { focus, days };
  });
}

/** Off-camp: two short strength & power sessions that leave you fresh for skills. */
function offCampWeeks(): ProgramWeekSeed[] {
  return weeksOf(8, (w) => {
    const deload = w === 4 || w === 8;
    const heavy = w >= 5;
    const k = heavy ? w - 5 : w - 1;
    const main = deload ? { sets: 2, reps: "5", rpe: 6 } : heavy ? { sets: 4, reps: "3", rpe: 7.5 + 0.5 * Math.min(k, 1) } : { sets: 3 + Math.min(k, 1), reps: "5", rpe: 7 + 0.5 * Math.min(k, 1) };
    const days = [
      day("Strength A — Pull & Press", "Jumps, heavy hinge, press, pull, neck", [
        R("box-jump", deload ? 2 : 3, "3", 90, { notes: "Maximal intent, step down, full reset." }),
        R("trap-bar-deadlift", main.sets, main.reps, 150, { rpe: main.rpe, notes: "Leave 2–3 reps in reserve: you need your legs for training." }),
        R("dumbbell-bench-press", deload ? 2 : 3, "6-8", 90, { rpe: 7 }),
        R("pull-up", deload ? 2 : 3, "5-8", 90),
        T("neck-isometrics", 2, 15, 30, { notes: "Front, back and each side." }),
      ], { warmup: MMA_WARMUP }),
      day("Strength B — Squat & Rotate", "Rotational power, single-leg strength, row, hamstrings and groin", [
        R("medicine-ball-rotational-throw", deload ? 2 : 3, "5 per side", 60),
        R("front-squat", main.sets, main.reps, 150, { rpe: main.rpe, notes: "Goblet squats work too." }),
        R("chest-supported-row", deload ? 2 : 3, "8-10", 75),
        R("nordic-hamstring-curl", 2, deload ? "3" : "4-6", 90, { notes: "Eccentric hamstring strength — start with 2 × 3." }),
        T("copenhagen-plank", 2, 20, 45, { notes: "20 s per side." }),
      ], { warmup: MMA_WARMUP }),
    ];
    if (deload) return { focus: "Deload: lighter and shorter — keep skills sharp", isDeload: true, days };
    return { focus: heavy ? "Strength phase: heavier triples, same low soreness" : "Base phase: sets of 5, technique and power", days };
  });
}

// --------------------------------------------------------------------------- Endurance

const RUN_WARMUP = ["5 minutes brisk walk or very easy jog", "Leg swings × 10 each leg", "A-skips × 20 m and 2 relaxed strides"];

/** 12-week half-marathon base with about 80% easy running and two cutback weeks. */
function halfMarathonWeeks(): ProgramWeekSeed[] {
  const long = [60, 65, 70, 50, 75, 80, 90, 60, 95, 100, 105, 0];
  const easy = [35, 40, 40, 30, 45, 45, 50, 35, 50, 50, 50, 30];
  return weeksOf(12, (w) => {
    const cutback = w === 4 || w === 8;
    const quality: BuildEx =
      w <= 3
        ? T("running-intervals", 6, 60, 90, { notes: "Hill repeats: 60 s up at a hard but controlled effort, jog down. Builds strength and economy." })
        : w <= 7
          ? T("running-intervals", 3, 480, 120, { notes: "Threshold: 8 minutes at a 'comfortably hard' pace you could hold for about an hour, 2 min jog." })
          : w <= 11
            ? T("running-intervals", 3, 900, 180, { notes: "Half-marathon pace: 15 minutes at goal race pace, 3 min easy." })
            : T("running-intervals", 4, 60, 120, { notes: "Race week: 4 × 1 min at race pace to stay sharp." });
    const cut: BuildEx = T("running-intervals", 4, 60, 120, { notes: "Cutback week: 4 relaxed strides of 1 min." });
    const days = [
      day("Easy Run", "Conversational pace (zone 2)", [T("zone-2-run", 1, easy[w - 1]! * 60, 0, { notes: "Easy — you can speak in full sentences." })], { warmup: RUN_WARMUP }),
      day("Quality Session", w <= 3 ? "Hills" : w <= 7 ? "Threshold intervals" : "Race-pace work", [
        T("zone-2-run", 1, 600, 0, { notes: "10 minutes of easy running before the first interval." }),
        cutback ? cut : quality,
        T("brisk-walk", 1, 600, 0, { notes: "Cool down: 10 minutes of easy jogging or walking." }),
      ], { warmup: RUN_WARMUP }),
      day("Easy Run + Strides", "Easy running with 4–6 short, relaxed strides", [T("zone-2-run", 1, Math.max(25, easy[w - 1]! - 5) * 60, 0, { notes: "Easy. Finish with 4–6 × 20 s strides." }), R("standing-calf-raise", 2, "15", 45), R("single-leg-rdl", 2, "8 per side", 45)], { warmup: RUN_WARMUP }),
      w === 12
        ? day("Race Day — Half Marathon", "21.1 km / 13.1 miles: start conservatively, finish strong", [T("zone-2-run", 1, 7200, 0, { reps: "21.1 km", notes: "Run the first 5 km slower than goal pace, settle in, and save your effort for the last 5 km. Fuel and drink as you practised." })], { warmup: RUN_WARMUP })
        : day("Long Run", "The key session of the week — easy all the way", [T("zone-2-run", 1, long[w - 1]! * 60, 0, { notes: "Easy and conversational from start to finish. Practise drinking and fuelling on runs over 75 minutes." })], { warmup: RUN_WARMUP }),
    ];
    if (cutback) return { focus: "Cutback week: about 25% less running and no hard session — absorb the training", isDeload: true, days };
    if (w === 12) return { focus: "Race week: short, easy runs, a few race-pace minutes, then race", isDeload: true, days };
    return { focus: w <= 3 ? "Base: easy volume plus short hills" : w <= 7 ? "Build: threshold intervals, longer long runs" : "Specific: race-pace work and your longest runs", days };
  });
}

/** Lean & Conditioned: steady cardio grows every other week, intervals add rounds, strength uses double progression. */
function leanWeeks(): ProgramWeekSeed[] {
  return weeksOf(6, (w) => {
    const deload = w === 6;
    const steady = deload ? 25 : 30 + 5 * Math.floor((w - 1) / 2);
    const intervals = deload ? 5 : 6 + Math.min(w - 1, 3);
    const strengthSets = deload ? 2 : w >= 4 ? 4 : 3;
    const days = [
      day("Strength Circuit A", "Full-body strength", [
        R("goblet-squat", strengthSets, "10-12", 60, { rpe: deload ? 6 : 7.5 }),
        R("dumbbell-bench-press", strengthSets, "10-12", 60, { rpe: deload ? 6 : 7.5 }),
        R("one-arm-dumbbell-row", strengthSets, "10-12 per side", 60, { rpe: deload ? 6 : 7.5 }),
        R("reverse-lunge", 3, "10 per side", 60),
        T("plank", 3, 30, 30),
      ]),
      day("Steady Cardio", "Aerobic base", [T("brisk-walk", 1, steady * 60, 0, { rpe: 5, notes: "Zone 2: you can talk in full sentences. Bike or rower is fine." }), R("glute-bridge", 2, "15", 45), R("bird-dog", 2, "8 per side", 30)]),
      day("Strength Circuit B", "Full-body strength", [
        R("romanian-deadlift", strengthSets, "10-12", 60, { rpe: deload ? 6 : 7.5 }),
        R("seated-dumbbell-shoulder-press", strengthSets, "10-12", 60, { rpe: deload ? 6 : 7.5 }),
        R("band-row", 3, "12-15", 45),
        R("step-up", 3, "10 per side", 60),
        R("dead-bug", 3, "8 per side", 30),
      ]),
      day("Intervals", "Short, hard efforts", [T("bike-intervals", intervals, 30, 90, { rpe: deload ? 6 : 8, notes: "30 s hard, 90 s easy. Rower works too." }), T("mountain-climber", 3, 30, 30)]),
    ];
    if (deload) return { focus: "Lighter week: fewer sets and easier intervals — keep the habit", isDeload: true, days };
    return { focus: `Week ${w}: ${steady} min steady cardio, ${intervals} intervals; strength ${strengthSets} sets — add load when you hit 12 reps`, days };
  });
}

// --------------------------------------------------------------------------- Speed & agility

function speedWeeks(): ProgramWeekSeed[] {
  return weeksOf(6, (w) => {
    const deload = w === 6;
    const accReps = deload ? 4 : 5 + Math.min(w - 1, 3);
    const accDist = w <= 2 ? "10 m" : w <= 4 ? "20 m" : "30 m";
    const fly = deload ? 2 : 3 + Math.min(Math.floor((w - 1) / 2), 2);
    const days = [
      day("Acceleration", "First steps and drive phase", [
        R("wall-drill", 3, "5 per side", 45),
        R("a-skip", 3, "20 m", 45),
        R("acceleration-sprint", accReps, deload ? "10 m + 30 m test" : accDist, 150, {
          notes: deload ? "Test: time a 10 m and a 30 m sprint (two attempts each), fully rested. Compare with week 1." : "Maximal effort, walk back and rest fully (2–3 min). If a rep is slower, stop.",
        }),
        R("broad-jump", deload ? 2 : 4, "3", 90),
        R("dead-bug", 2, "8 per side", 30),
      ], { warmup: SPRINT_WARMUP }),
      day("Strength & Power", "Force production", [
        R("box-jump", deload ? 2 : 4, "3", 90),
        R("back-squat", deload ? 2 : 4, "4", 180, { rpe: deload ? 6 : 7 + 0.5 * Math.min(w - 1, 2) }),
        R("romanian-deadlift", deload ? 2 : 3, "6", 120, { rpe: 7 }),
        R("nordic-hamstring-curl", 2, w <= 2 ? "3" : "4-6", 90, { notes: "Reduces hamstring-strain risk in sprinters. Start low — very sore at first." }),
        R("standing-calf-raise", 3, "10", 60, { notes: "Pause at the bottom, explode up." }),
      ], { warmup: SPRINT_WARMUP }),
      day("Max Velocity", "Top speed and elastic stiffness", [
        R("pogo-jumps", 3, "15 contacts", 60),
        R("bounding", deload ? 2 : 3, "30 m", 120),
        R("flying-sprint", fly, "20 m fly", 240, { notes: "20–30 m build-up, then 20 m at top speed. Rest 3–5 min." }),
        R("single-leg-rdl", 3, "8 per side", 60),
      ], { warmup: SPRINT_WARMUP }),
    ];
    if (deload) return { focus: "Lighter week: half the volume, then time your 10 m and 30 m sprints fully rested", isDeload: true, days };
    return { focus: `Week ${w}: ${accReps} × ${accDist} accelerations and ${fly} flying sprints — never trade rest for volume`, days };
  });
}

function agilityWeeks(): ProgramWeekSeed[] {
  return weeksOf(6, (w) => {
    const deload = w === 6;
    const n = deload ? 3 : 4 + Math.min(Math.floor((w - 1) / 2), 2);
    const days = [
      day("Footwork & Deceleration", "Rhythm, braking and lateral power", [
        T("agility-ladder-drills", 6, 15, 45, { notes: "Two-in, lateral in-out, Icky shuffle; add crossovers as you improve." }),
        R("lateral-bound", 3, "4 per side", 60, { notes: "Stick each landing for 2 seconds." }),
        R("pro-agility-shuttle", n, "1", 90, { notes: deload ? "Test: time two 5-10-5s (start both directions). Compare with week 1." : "Full rest so every rep is fast." }),
        R("reverse-lunge", 3, "8 per side", 60),
        T("side-plank", 2, 30, 30),
      ], { warmup: SPRINT_WARMUP }),
      day("Leg Strength", "Single-leg strength for cutting", [
        R("goblet-squat", 3, "8", 90, { rpe: deload ? 6 : 7 }),
        R("bulgarian-split-squat", deload ? 2 : 3, "8 per side", 75),
        R("single-leg-rdl", 3, "8 per side", 60),
        R("box-jump", 3, "4", 75),
        T("copenhagen-plank", 2, 20, 45, { notes: "Groin resilience for cutting: 20 s per side." }),
      ], { warmup: SPRINT_WARMUP }),
      day("Cone & Reactive", "Planned cuts and reaction", [
        R("pogo-jumps", 3, "15 contacts", 45),
        R("t-drill", n, "1", 90),
        R("three-cone-drill", n, "1", 90),
        T("reactive-mirror-drill", deload ? 4 : 6, 8, 60, { notes: "Partner leads; switch roles. Solo: react to random cues." }),
      ], { warmup: SPRINT_WARMUP }),
    ];
    if (deload) return { focus: "Lighter week: recover, then time your 5-10-5 fully rested", isDeload: true, days };
    return { focus: `Week ${w}: ${n} reps per cone drill — add a rep only while every rep stays sharp`, days };
  });
}

// --------------------------------------------------------------------------- General fitness

function activeAgingStrengthWeeks(): ProgramWeekSeed[] {
  return weeksOf(8, (w) => {
    const lighter = w === 4 || w === 8;
    const phase = w <= 3 ? { sets: 2 + Math.min(w - 1, 1), reps: "10-12", rpe: 6 + 0.5 * Math.min(w - 1, 2) } : { sets: 3, reps: "6-8", rpe: 7 + 0.5 * Math.min(w - 5, 2) };
    const s = lighter ? { sets: 2, reps: "8-10", rpe: 6 } : phase;
    const days = [
      day("Strength A", "Legs, pushing, pulling and balance", [
        R("goblet-squat", s.sets, s.reps, 90, { rpe: s.rpe, notes: "Stand up briskly, lower slowly — speed of rising matters for daily life. Use a box behind you if you like." }),
        R("dumbbell-bench-press", s.sets, s.reps, 90, { rpe: s.rpe, notes: "Incline push-ups work too." }),
        R("one-arm-dumbbell-row", s.sets, `${s.reps} per side`, 75, { rpe: s.rpe }),
        T("single-leg-balance", 3, 30, 30, { notes: "Per leg, near a support. Progress to eyes closed or a cushion." }),
        T("farmers-carry", 3, 30, 60, { notes: "Tall posture, steady steps." }),
      ], { warmup: LOW_IMPACT_WARMUP }),
      day("Strength B", "Hips, stairs, shoulders and trunk", [
        R("romanian-deadlift", s.sets, s.reps, 90, { rpe: s.rpe, notes: "Dumbbells. Hinge at the hips, back flat." }),
        R("step-up", s.sets, `${s.reps} per side`, 75, { rpe: s.rpe, notes: "Use a rail at first." }),
        R("seated-dumbbell-shoulder-press", s.sets, s.reps, 75, { rpe: s.rpe }),
        R("band-pull-apart", 2, "15", 45),
        R("dead-bug", 2, "6 per side", 30),
      ], { warmup: LOW_IMPACT_WARMUP }),
    ];
    if (lighter) return { focus: "Lighter week: fewer sets — keep the habit, let the body adapt", isDeload: true, days };
    return { focus: w <= 3 ? `Foundation (week ${w}): sets of 10–12, learning the movements` : `Strength (week ${w - 4}): heavier sets of 6–8 with 2–3 reps in reserve`, days };
  });
}

function mobilityWeeks(days: ProgramDaySeed[]): ProgramWeekSeed[] {
  return weeksOf(4, (w) => ({
    focus: w === 1 ? "Learn the positions — move slowly, stay pain-free" : `Hold each stretch about ${5 * (w - 1)} s longer than week 1`,
    days: days.map((d) => ({ ...d, exercises: d.exercises.map((e) => (e.seconds && e.seconds >= 20 && e.rest > 0 ? { ...e, seconds: e.seconds + 5 * (w - 1) } : e)) })),
  }));
}

// --------------------------------------------------------------------------- Hypertrophy day plans

const UPPER_LOWER: DayPlan[] = [
  {
    name: "Upper A",
    focus: "Chest & back emphasis",
    ex: [
      R("bench-press", 3, "6-8", 150, { rpe: 8, grow: true }),
      R("one-arm-dumbbell-row", 3, "8-12 per side", 90, { rpe: 8, grow: true }),
      R("incline-dumbbell-press", 3, "8-12", 90, { rpe: 8 }),
      R("lat-pulldown", 3, "10-12", 90, { rpe: 8 }),
      R("lateral-raise", 3, "12-20", 45, { rpe: 8, iso: true, grow: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true, notes: "Overhead position trains the long head at long lengths." }),
      R("incline-dumbbell-curl", 2, "10-15", 60, { rpe: 8, iso: true, notes: "Arms hang behind you — a lengthened-position curl." }),
    ],
  },
  {
    name: "Lower A",
    focus: "Quad emphasis",
    ex: [
      R("back-squat", 3, "6-8", 180, { rpe: 8, grow: true }),
      R("romanian-deadlift", 3, "8-10", 120, { rpe: 8 }),
      R("leg-press", 3, "10-15", 120, { rpe: 8 }),
      R("leg-extension", 2, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-leg-curl", 2, "10-15", 60, { rpe: 8, iso: true, notes: "Seated curls train the hamstrings at longer lengths." }),
      R("standing-calf-raise", 3, "10-15", 45, { rpe: 8, iso: true, notes: "Pause 1–2 s in the bottom stretch." }),
    ],
  },
  {
    name: "Upper B",
    focus: "Shoulders & arms emphasis",
    ex: [
      R("overhead-press", 3, "6-8", 150, { rpe: 8, grow: true }),
      R("pull-up", 3, "6-10", 120, { rpe: 8, grow: true }),
      R("dumbbell-bench-press", 3, "10-12", 90, { rpe: 8 }),
      R("seated-cable-row", 3, "10-12", 90, { rpe: 8 }),
      R("cable-chest-fly", 2, "12-15", 60, { rpe: 8, iso: true, notes: "Deep stretch, controlled." }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("hammer-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "12-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower B",
    focus: "Hamstring & glute emphasis",
    ex: [
      R("conventional-deadlift", 2, "5", 180, { rpe: 7, notes: "Kept submaximal — deadlifts are very fatiguing." }),
      R("bulgarian-split-squat", 3, "8-12 per side", 90, { rpe: 8, grow: true }),
      R("hip-thrust", 3, "8-12", 90, { rpe: 8 }),
      R("seated-leg-curl", 3, "10-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-calf-raise", 3, "12-15", 45, { rpe: 8, iso: true }),
      R("hanging-knee-raise", 2, "10-15", 60),
    ],
  },
];

const PHUL_DAYS: DayPlan[] = [
  {
    name: "Upper Power",
    focus: "Heavy bench, row and press (3–5 reps)",
    ex: [
      R("bench-press", 4, "3-5", 180, { rpe: 8 }),
      R("barbell-row", 4, "3-5", 150, { rpe: 8 }),
      R("overhead-press", 3, "5-8", 150, { rpe: 8 }),
      R("pull-up", 3, "6-10", 120, { rpe: 8, grow: true }),
      R("lateral-raise", 2, "12-20", 45, { rpe: 8, iso: true, grow: true }),
      R("dumbbell-curl", 2, "6-10", 60, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "6-10", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower Power",
    focus: "Heavy squat and deadlift (3–5 reps)",
    ex: [
      R("back-squat", 4, "3-5", 210, { rpe: 8 }),
      R("conventional-deadlift", 3, "3-5", 210, { rpe: 8 }),
      R("leg-press", 3, "10-15", 120, { rpe: 8, grow: true }),
      R("leg-curl", 3, "6-10", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 4, "6-10", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper Hypertrophy",
    focus: "Chest, back, delts and arms in moderate reps",
    ex: [
      R("incline-dumbbell-press", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("cable-chest-fly", 3, "12-15", 60, { rpe: 8, iso: true }),
      R("seated-cable-row", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("one-arm-dumbbell-row", 3, "8-12 per side", 75, { rpe: 8 }),
      R("lateral-raise", 3, "12-20", 45, { rpe: 8, iso: true }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("incline-dumbbell-curl", 3, "8-12", 60, { rpe: 8, iso: true }),
      R("triceps-pushdown", 3, "8-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower Hypertrophy",
    focus: "Front squats, lunges, extensions, curls and calves",
    ex: [
      R("front-squat", 3, "8-12", 150, { rpe: 8, notes: "Hack squat or leg press if front squats limit you." }),
      R("walking-lunge", 3, "8-12 per side", 90, { rpe: 8, grow: true }),
      R("leg-extension", 3, "10-15", 60, { rpe: 8, iso: true }),
      R("seated-leg-curl", 3, "10-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-calf-raise", 3, "10-15", 45, { rpe: 8, iso: true }),
    ],
  },
];

const PHAT_DAYS: DayPlan[] = [
  {
    name: "Upper Power",
    focus: "Heavy rows, pull-ups, bench, dips and arms",
    ex: [
      R("barbell-row", 3, "3-5", 180, { rpe: 8 }),
      R("pull-up", 2, "6-10", 120, { rpe: 8, notes: "Add weight when you pass 10 reps." }),
      R("bench-press", 3, "3-5", 180, { rpe: 8 }),
      R("dips", 2, "6-10", 120, { rpe: 8 }),
      R("seated-dumbbell-shoulder-press", 3, "6-10", 120, { rpe: 8 }),
      R("dumbbell-curl", 2, "6-10", 60, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "6-10", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower Power",
    focus: "Heavy squats, hack squats, hinge, curls and calves",
    ex: [
      R("back-squat", 3, "3-5", 210, { rpe: 8 }),
      R("hack-squat", 2, "6-10", 120, { rpe: 8 }),
      R("romanian-deadlift", 3, "5-8", 150, { rpe: 8 }),
      R("leg-curl", 2, "6-10", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 3, "6-10", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Back & Shoulders Hypertrophy",
    focus: "Speed rows, then back and delt volume",
    ex: [
      R("barbell-row", 6, "3", 75, { intensity: "65–70% of your 3–5RM row", notes: "Speed work: explosive reps, 60–90 s rest." }),
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("seated-cable-row", 3, "8-12", 90, { rpe: 8 }),
      R("straight-arm-pulldown", 2, "12-15", 60, { rpe: 8, iso: true, notes: "Lengthened lat work." }),
      R("seated-dumbbell-shoulder-press", 2, "8-12", 90, { rpe: 8 }),
      R("lateral-raise", 3, "12-20", 45, { rpe: 8, iso: true, grow: true }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower Hypertrophy",
    focus: "Speed squats, then leg volume",
    ex: [
      R("back-squat", 6, "3", 75, { intensity: "65–70% of your 3–5RM squat", notes: "Speed work: explosive reps, 60–90 s rest." }),
      R("hack-squat", 3, "8-12", 120, { rpe: 8 }),
      R("leg-extension", 3, "12-20", 60, { rpe: 8, iso: true, grow: true }),
      R("romanian-deadlift", 3, "8-12", 120, { rpe: 8 }),
      R("seated-leg-curl", 2, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-calf-raise", 4, "10-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Chest & Arms Hypertrophy",
    focus: "Speed bench, then chest and arm volume",
    ex: [
      R("bench-press", 6, "3", 75, { intensity: "65–70% of your 3–5RM bench", notes: "Speed work: explosive reps, 60–90 s rest." }),
      R("incline-dumbbell-press", 3, "8-12", 90, { rpe: 8 }),
      R("cable-chest-fly", 2, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("incline-dumbbell-curl", 3, "8-12", 60, { rpe: 8, iso: true }),
      R("hammer-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 3, "8-12", 60, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "12-15", 45, { rpe: 8, iso: true }),
    ],
  },
];

const PPL_DAYS: DayPlan[] = [
  {
    name: "Pull A",
    focus: "Deadlift, vertical and horizontal pulls, rear delts, biceps",
    ex: [
      R("conventional-deadlift", 1, "5+", 210, { rpe: 8, notes: "One work set of 5 or more. Add 5 kg / 10 lb when you get 5+." }),
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("seated-cable-row", 3, "8-12", 90, { rpe: 8 }),
      R("face-pull", 3, "15-20", 45, { rpe: 8, iso: true }),
      R("hammer-curl", 2, "8-12", 60, { rpe: 8, iso: true }),
      R("incline-dumbbell-curl", 2, "8-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Push A",
    focus: "Bench press, overhead press, incline, laterals, triceps",
    ex: [
      R("bench-press", 4, "5 (last set 5+)", 180, { rpe: 8, notes: "4 × 5 with the last set for as many reps as possible. Add 2.5 kg / 5 lb when you get 5+ on every set." }),
      R("overhead-press", 3, "8-12", 120, { rpe: 8 }),
      R("incline-dumbbell-press", 2, "8-12", 90, { rpe: 8, grow: true }),
      R("lateral-raise", 3, "15-20", 45, { rpe: 8, iso: true, grow: true }),
      R("triceps-pushdown", 2, "8-12", 60, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "8-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Legs A",
    focus: "Squat, Romanian deadlift, leg press, curls, calves",
    ex: [
      R("back-squat", 3, "5 (last set 5+)", 180, { rpe: 8, notes: "Add 2.5 kg / 5 lb when you get 5+ on every set." }),
      R("romanian-deadlift", 3, "8-12", 120, { rpe: 8 }),
      R("leg-press", 3, "8-12", 120, { rpe: 8, grow: true }),
      R("seated-leg-curl", 2, "8-12", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 4, "8-12", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Pull B",
    focus: "Barbell rows, pull-ups, rows, rear delts, biceps",
    ex: [
      R("barbell-row", 4, "5 (last set 5+)", 150, { rpe: 8, notes: "Add 2.5 kg / 5 lb when you get 5+ on every set." }),
      R("pull-up", 3, "6-10", 120, { rpe: 8 }),
      R("chest-supported-row", 2, "8-12", 90, { rpe: 8, grow: true }),
      R("rear-delt-fly", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("dumbbell-curl", 2, "8-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Push B",
    focus: "Overhead press, bench, dips, laterals, triceps",
    ex: [
      R("overhead-press", 4, "5 (last set 5+)", 180, { rpe: 8, notes: "Add 2.5 kg / 5 lb when you get 5+ on every set." }),
      R("dumbbell-bench-press", 3, "8-12", 90, { rpe: 8 }),
      R("cable-chest-fly", 2, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("cable-lateral-raise", 3, "15-20", 45, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Legs B",
    focus: "Squat, split squats, hip thrust, curls, calves",
    ex: [
      R("back-squat", 3, "8-10", 150, { rpe: 8, notes: "Lighter, higher-rep squats than Legs A." }),
      R("bulgarian-split-squat", 2, "8-12 per side", 90, { rpe: 8, grow: true }),
      R("hip-thrust", 3, "8-12", 90, { rpe: 8 }),
      R("seated-leg-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("seated-calf-raise", 3, "12-15", 45, { rpe: 8, iso: true }),
    ],
  },
];

const FULL_BODY_3: DayPlan[] = [
  {
    name: "Full Body A",
    focus: "Squat, flat press, vertical pull, curls, laterals",
    ex: [
      R("back-squat", 3, "6-10", 150, { rpe: 8, grow: true, notes: "Goblet squats or leg press are fine substitutes." }),
      R("dumbbell-bench-press", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8 }),
      R("seated-leg-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("lateral-raise", 2, "12-20", 45, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Full Body B",
    focus: "Hinge, overhead press, row, leg press, biceps, calves",
    ex: [
      R("romanian-deadlift", 3, "8-10", 120, { rpe: 8 }),
      R("seated-dumbbell-shoulder-press", 3, "8-12", 90, { rpe: 8 }),
      R("one-arm-dumbbell-row", 3, "8-12 per side", 75, { rpe: 8, grow: true }),
      R("leg-press", 3, "10-15", 120, { rpe: 8 }),
      R("push-up", 2, "8-15", 60, { rpe: 8, notes: "Elevate your feet once 15 is easy." }),
      R("incline-dumbbell-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 2, "10-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Full Body C",
    focus: "Split squat, incline press, cable row, hip thrust, delts, triceps",
    ex: [
      R("bulgarian-split-squat", 3, "8-12 per side", 90, { rpe: 8 }),
      R("incline-dumbbell-press", 3, "8-12", 90, { rpe: 8 }),
      R("seated-cable-row", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("hip-thrust", 3, "8-12", 90, { rpe: 8 }),
      R("lateral-raise", 2, "12-20", 45, { rpe: 8, iso: true, grow: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
];

const POWERBUILDING_4: DayPlan[] = [
  {
    name: "Upper Strength",
    focus: "Heavy bench, rows and presses",
    ex: [
      R("bench-press", 4, "4-6", 180, { rpe: 8 }),
      R("barbell-row", 4, "6-8", 120, { rpe: 8 }),
      R("seated-dumbbell-shoulder-press", 3, "8-10", 90, { rpe: 8 }),
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("triceps-pushdown", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower Strength",
    focus: "Heavy squats and hinges",
    ex: [
      R("back-squat", 4, "4-6", 210, { rpe: 8 }),
      R("romanian-deadlift", 3, "6-8", 150, { rpe: 8 }),
      R("leg-press", 3, "10-12", 120, { rpe: 8, grow: true }),
      R("seated-leg-curl", 3, "10-15", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 3, "8-12", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper Hypertrophy",
    focus: "Incline press, rows, flyes, delts and arms",
    ex: [
      R("incline-dumbbell-press", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("chest-supported-row", 3, "10-12", 90, { rpe: 8, grow: true }),
      R("cable-chest-fly", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("pull-up", 3, "6-10", 120, { rpe: 8 }),
      R("lateral-raise", 3, "12-20", 45, { rpe: 8, iso: true, grow: true }),
      R("incline-dumbbell-curl", 3, "10-15", 60, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower Hypertrophy",
    focus: "Deadlift, split squats, hip thrust and isolation",
    ex: [
      R("conventional-deadlift", 3, "3-5", 210, { rpe: 8 }),
      R("bulgarian-split-squat", 3, "8-12 per side", 90, { rpe: 8, grow: true }),
      R("hip-thrust", 3, "8-12", 90, { rpe: 8 }),
      R("leg-extension", 3, "12-15", 60, { rpe: 8, iso: true }),
      R("seated-calf-raise", 3, "12-15", 45, { rpe: 8, iso: true }),
      R("hanging-knee-raise", 2, "10-15", 60),
    ],
  },
];

const GLUTE_STRENGTH: DayPlan[] = [
  {
    name: "Lower A — Glute Strength",
    focus: "Heavy hip thrusts, squats and hinges",
    ex: [
      R("hip-thrust", 4, "6-10", 120, { rpe: 8, grow: true, notes: "Pause 1 s at the top, ribs down." }),
      R("back-squat", 4, "6-8", 180, { rpe: 8 }),
      R("romanian-deadlift", 3, "8-10", 120, { rpe: 8 }),
      R("hip-abduction", 2, "12-20", 45, { rpe: 8, iso: true }),
      T("plank", 2, 40, 45),
    ],
  },
  {
    name: "Upper A",
    focus: "Press, pull, shoulders",
    ex: [
      R("dumbbell-bench-press", 3, "8-10", 90, { rpe: 8, grow: true }),
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8 }),
      R("seated-dumbbell-shoulder-press", 3, "8-12", 90, { rpe: 8 }),
      R("seated-cable-row", 3, "10-12", 75, { rpe: 8 }),
      R("lateral-raise", 2, "12-20", 45, { rpe: 8, iso: true, grow: true }),
    ],
  },
  {
    name: "Lower B — Glute Volume",
    focus: "Split squats, deadlifts, back extensions and curls",
    ex: [
      R("bulgarian-split-squat", 3, "8-12 per side", 90, { rpe: 8, notes: "Slight forward lean and a long stride bias the glutes." }),
      R("conventional-deadlift", 3, "5", 180, { rpe: 7, notes: "Trap-bar deadlifts work too." }),
      R("back-extension", 2, "10-15", 60, { rpe: 8, notes: "Round the upper back slightly and squeeze the glutes to bias them over the low back." }),
      R("step-up", 2, "10-12 per side", 75, { rpe: 8 }),
      R("seated-leg-curl", 3, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper B",
    focus: "Chin-ups, push-ups, rows, rear delts, arms",
    ex: [
      R("band-assisted-pull-up", 3, "5-8", 120, { rpe: 8, grow: true, notes: "Use a lighter band every 1–2 weeks; bodyweight chin-ups when you can do 3 × 5." }),
      R("push-up", 3, "6-15", 90, { rpe: 8, notes: "Incline as needed; add a pause at the bottom when 15 is easy." }),
      R("one-arm-dumbbell-row", 3, "8-12 per side", 75, { rpe: 8 }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("dumbbell-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
];

/** Physique show prep: five days, conditioning that rises over the prep, and daily posing. */
const SHOW_PREP_DAYS: DayPlan[] = [
  {
    name: "Chest & Back",
    focus: "Upper-body width and thickness",
    ex: [
      R("incline-dumbbell-press", 3, "8-10", 120, { rpe: 8 }),
      R("lat-pulldown", 3, "10-12", 90, { rpe: 8 }),
      R("machine-chest-press", 3, "10-12", 90, { rpe: 8 }),
      R("seated-cable-row", 3, "10-12", 90, { rpe: 8 }),
      R("cable-chest-fly", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("straight-arm-pulldown", 2, "12-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Quads & Calves",
    focus: "Leg development",
    ex: [
      R("hack-squat", 3, "6-10", 150, { rpe: 8, notes: "Back squats work too." }),
      R("leg-press", 3, "12-15", 90, { rpe: 8 }),
      R("walking-lunge", 2, "12 per side", 90, { rpe: 8 }),
      R("leg-extension", 3, "15", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 4, "12-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Shoulders & Arms",
    focus: "Delts, biceps and triceps",
    ex: [
      R("seated-dumbbell-shoulder-press", 3, "8-10", 90, { rpe: 8 }),
      R("cable-lateral-raise", 4, "15-20", 45, { rpe: 8, iso: true }),
      R("rear-delt-fly", 3, "15", 45, { rpe: 8, iso: true }),
      R("incline-dumbbell-curl", 3, "10-12", 60, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 3, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Hamstrings & Glutes",
    focus: "Posterior chain",
    ex: [
      R("romanian-deadlift", 3, "8-10", 120, { rpe: 8 }),
      R("hip-thrust", 3, "10-12", 90, { rpe: 8 }),
      R("seated-leg-curl", 3, "12-15", 60, { rpe: 8, iso: true }),
      R("bulgarian-split-squat", 2, "10 per side", 75, { rpe: 8 }),
      R("cable-crunch", 3, "12-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper Pump & Conditioning",
    focus: "Weak-point volume and intervals",
    ex: [
      R("dumbbell-bench-press", 3, "10-12", 75, { rpe: 8 }),
      R("chest-supported-row", 3, "10-12", 75, { rpe: 8 }),
      R("lateral-raise", 3, "15-20", 45, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "15", 45, { rpe: 8, iso: true }),
      R("hammer-curl", 2, "12-15", 45, { rpe: 8, iso: true }),
    ],
  },
];

const SHOW_PREP_BLOCK: BlockWeek[] = [
  { focus: "Prep week 1 — establish working weights at 2–3 reps in reserve; start conservatively", add: 0, rpe: 7.5 },
  { focus: "Prep week 2 — hold volume, about 2 reps in reserve", add: 0, rpe: 8 },
  { focus: "Prep week 3 — about 2 reps in reserve; keep loads, not ego", add: 0, rpe: 8 },
  { focus: "Prep week 4 — 1–2 reps in reserve on isolation work", add: 0, rpe: 8 },
  { focus: "Prep week 5 — maintain loads as the deficit deepens", add: 0, rpe: 8 },
  { focus: "Prep week 6 — 1–2 reps in reserve; recovery is getting harder — sleep matters", add: 0, rpe: 8.5 },
  { focus: "Lighter week — half the sets (pair with a diet break only if your coach prescribes one)", add: 0, rpe: 6, deload: true },
  { focus: "Prep week 8 — back to full volume, about 2 reps in reserve", add: 0, rpe: 8 },
  { focus: "Prep week 9 — hold the weights you're using; strength may dip slightly — that's normal", add: 0, rpe: 8 },
  { focus: "Prep week 10 — conditioning at its highest; posing every day", add: 0, rpe: 8 },
  { focus: "Prep week 11 — peak week approaches: keep training normal, nothing new", add: 0, rpe: 8 },
  {
    focus: "Show week taper: light pump sessions and posing every day. Keep food, fluids and sodium consistent — no extreme water or sodium manipulation; follow your coach",
    add: 0,
    rpe: 6,
    deload: true,
  },
];

function showPrepExtras(week: number, dayIndex: number): BuildEx[] {
  const posing = T("posing-practice", 1, (week >= 8 ? 20 : 10 + Math.floor((week - 1) / 2) * 2) * 60, 0, {
    notes: `Mandatory poses, quarter turns and transitions for your division; hold each pose 10–20 s.${week >= 8 ? " Practise every day now, rest days included." : ""}`,
  });
  if (week === 12) return [posing];
  const liss = Math.min(35, 20 + 2 * (week - 1)) * (week === 7 ? 0.7 : 1);
  if (dayIndex === 4)
    return [T("bike-intervals", week === 7 ? 5 : 8, 30, 90, { rpe: 8, notes: "Intervals: 30 s hard / 90 s easy." }), posing];
  if (dayIndex === 1 || dayIndex === 3) return [posing];
  return [T(dayIndex === 0 ? "bike-intervals" : "brisk-walk", 1, Math.round(liss) * 60, 0, { notes: "Low-intensity cardio (zone 2). Your coach adjusts cardio and steps from weekly weigh-ins." }), posing];
}

// --------------------------------------------------------------------------- Library
// Order within each discipline: beginner → intermediate → advanced (the Train page also sorts this way).

const FOUNDATIONS_DAYS: ProgramDaySeed[] = [
  day("Full Body A", "Squat & push", [
    R("goblet-squat", 3, "8-12", 90, { rpe: 6 }),
    R("dumbbell-bench-press", 3, "8-12", 90, { rpe: 6 }),
    R("one-arm-dumbbell-row", 3, "10-12 per side", 75, { rpe: 6 }),
    R("glute-bridge", 2, "12-15", 60, { rpe: 6 }),
    R("dead-bug", 2, "6-8 per side", 45),
  ]),
  day("Full Body B", "Hinge & pull", [
    R("romanian-deadlift", 3, "8-10", 90, { rpe: 6, notes: "Use dumbbells." }),
    R("incline-push-up", 3, "8-12", 75, { rpe: 6 }),
    R("band-row", 3, "12-15", 60, { rpe: 6 }),
    R("reverse-lunge", 2, "8 per side", 75, { rpe: 6 }),
    T("plank", 2, 30, 45),
  ]),
  day("Full Body C", "Single-leg & shoulders", [
    R("step-up", 3, "8 per side", 75, { rpe: 6 }),
    R("seated-dumbbell-shoulder-press", 3, "8-12", 90, { rpe: 6 }),
    R("one-arm-dumbbell-row", 3, "10-12 per side", 75, { rpe: 6 }),
    R("band-pull-apart", 2, "15-20", 45),
    T("farmers-carry", 3, 30, 60, { notes: "Moderate weight; tall posture." }),
  ]),
];

const MOBILITY_WARMUP = ["1 minute of slow nasal breathing", "Cat-cow × 5"];
const MOBILITY_COOLDOWN = ["Child's pose — 60 seconds of slow breathing"];
const MOBILITY_FRAME = { warmup: MOBILITY_WARMUP, cooldown: MOBILITY_COOLDOWN };
const MOBILITY_DAYS: ProgramDaySeed[] = [
  day("Hips & Spine", "Lower body mobility", [
    R("cat-cow", 2, "8 breaths", 15),
    R("worlds-greatest-stretch", 2, "4 per side", 15),
    R("90-90-hip-switch", 2, "8", 15),
    T("couch-stretch", 2, 45, 15, { notes: "Per side." }),
    T("figure-four-stretch", 2, 40, 15),
  ], MOBILITY_FRAME),
  day("Shoulders & Upper Back", "Upper body mobility", [
    R("thoracic-open-book", 2, "8 per side", 15),
    R("band-pass-through", 2, "10", 15),
    R("band-pull-apart", 2, "15", 15),
    T("dead-hang", 2, 20, 30, { notes: "Feet can stay lightly on the floor." }),
    T("childs-pose", 1, 60, 0),
  ], MOBILITY_FRAME),
  day("Ankles & Squat", "Squat depth and ankle range", [
    R("ankle-knee-to-wall", 2, "10 per side", 15),
    T("deep-squat-hold", 3, 30, 30),
    T("supine-hamstring-stretch", 2, 40, 15),
    T("single-leg-balance", 2, 30, 15),
  ], MOBILITY_FRAME),
  day("Full-Body Reset", "Whole-body flow", [
    R("cat-cow", 1, "8 breaths", 0),
    R("worlds-greatest-stretch", 1, "3 per side", 0),
    R("thoracic-open-book", 1, "6 per side", 0),
    T("deep-squat-hold", 2, 30, 15),
    T("childs-pose", 1, 60, 0),
  ], MOBILITY_FRAME),
];

export const PROGRAMS: ProgramSeed[] = [
  // =========================================================== General fitness
  {
    slug: "foundations-full-body",
    name: "Foundations: Full-Body Strength",
    summary: "Three full-body sessions a week to learn the core movement patterns.",
    description:
      "A gentle, structured entry into strength training that meets the WHO/ACSM minimum of training every major muscle at least twice a week. " +
      "Each session covers a squat, hinge, push, pull and core pattern with dumbbells and bodyweight. You'll leave every session feeling like " +
      "you could have done a little more — that's intentional. Add 150 minutes a week of brisk walking or other moderate activity for the full health benefit.",
    category: "beginner",
    types: ["strength", "home"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 40,
    goals: ["general_health", "build_strength", "build_muscle", "lose_fat"],
    equipment: ["dumbbell", "bodyweight", "bench", "band"],
    tier: "free",
    progression:
      "Double progression: when you complete every set at the top of the rep range with good form and 2+ reps still in the tank, add the " +
      "smallest available weight next session. Target effort rises from about 4 reps in reserve to about 2. Week 6 is a lighter consolidation week.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: FOUNDATIONS_DAYS,
  },
  {
    slug: "home-bodyweight-strength",
    name: "Home Strength: Bodyweight Builder",
    summary: "No gym needed — progressive bodyweight strength in 30–35 minutes.",
    description:
      "Built for living rooms, hotel rooms and garages. Progress by adding reps, slowing the tempo and moving to harder variations — sets taken " +
      "close to failure build muscle with light loads too. Only a mat is required; a resistance band unlocks rows.",
    category: "home-workouts",
    types: ["home", "strength"],
    difficulty: "beginner",
    weeks: 4,
    sessionMinutes: 35,
    goals: ["general_health", "build_strength", "lose_fat"],
    equipment: ["bodyweight", "mat", "band"],
    tier: "free",
    progression:
      "Weeks 1–2: add 1–2 reps per set each session. Weeks 3–4: one extra set on most exercises. Once you reach the top of every range, slow the " +
      "lowering phase to 3 seconds or progress the variation (incline push-up → push-up → feet-elevated push-up).",
    progressionModel: "volume_wave",
    noDeloadReason: "A short 4-week block at moderate effort (RPE ≤ 7.5); take an easy week before repeating it with harder variations.",
    warmup: ["3 minutes marching or skipping", "Cat-cow × 8", "Bodyweight squats × 10", "World's greatest stretch × 2 per side"],
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Lower & Core", "Legs and trunk", [
        R("bodyweight-squat", 3, "12-20", 60, { rpe: 7 }),
        R("reverse-lunge", 3, "8-12 per side", 60, { rpe: 7 }),
        R("glute-bridge", 3, "15-20", 45, { rpe: 7 }),
        T("side-plank", 2, 25, 30, { notes: "Per side." }),
        R("dead-bug", 2, "8 per side", 30),
      ]),
      day("Upper Push & Pull", "Chest, shoulders and back", [
        R("push-up", 4, "6-15", 75, { rpe: 7, notes: "Use incline push-ups if needed." }),
        R("band-row", 4, "12-15", 60, { rpe: 7 }),
        R("pike-push-up", 3, "5-10", 75, { rpe: 7 }),
        R("band-pull-apart", 2, "15-20", 45),
        T("plank", 2, 40, 45),
      ]),
      day("Conditioning Circuit", "Full-body work capacity", [
        T("step-back-burpee", 4, 30, 30),
        T("mountain-climber", 4, 30, 30),
        T("bodyweight-squat", 4, 30, 30),
        T("bear-crawl", 4, 20, 40),
      ]),
    ],
  },
  {
    slug: "active-aging-low-impact",
    name: "Active Aging: Strength & Balance",
    summary: "Three joint-friendly sessions a week for strength, balance and stamina.",
    description:
      "Low-impact sessions that train what matters for independence: rising from a chair, carrying shopping, climbing stairs and staying steady on " +
      "your feet. WHO guidelines recommend that adults 65+ do balance and strength work on 3 or more days a week plus 150–300 minutes of moderate " +
      "activity — the walking day and a daily walk get you there. Stand up briskly and lower slowly: fast rising builds the power that prevents falls. " +
      "Every exercise can be done next to a sturdy support. If you have a medical condition, check with your healthcare provider first.",
    category: "active-aging",
    types: ["low_impact", "strength", "mobility"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 40,
    goals: ["general_health", "mobility", "build_strength"],
    equipment: ["bodyweight", "dumbbell", "band"],
    tier: "free",
    lowImpact: true,
    progression:
      "Weeks 1–3: add reps before weight. Weeks 4–6: one extra set on most exercises. When an exercise feels easy (RPE 5 or less) at the top of " +
      "the range for two sessions, add a little resistance or slow down the lowering phase.",
    progressionModel: "volume_wave",
    noDeloadReason: "Effort stays moderate (RPE ≤ 7) throughout, so planned deloads aren't needed — take an easy week whenever you feel run down.",
    warmup: LOW_IMPACT_WARMUP,
    cooldown: ["Slow walk 2–3 minutes", "Seated figure-four stretch 30 seconds per side", "Child's pose or seated forward reach 45 seconds"],
    days: [
      day("Strength & Balance A", "Legs, pushing and balance", [
        R("box-squat-to-chair", 3, "8-12", 75, { rpe: 6, notes: "Stand up briskly, sit down slowly." }),
        R("wall-push-up", 3, "8-12", 60, { rpe: 6 }),
        R("band-row", 3, "10-12", 60, { rpe: 6 }),
        T("single-leg-balance", 3, 20, 30, { notes: "Per leg, with support nearby." }),
        R("standing-calf-raise", 2, "10-12", 45),
      ]),
      day("Walk & Mobility", "Move well and build stamina", [
        T("brisk-walk", 1, 1500, 0, { rpe: 4, notes: "Brisk enough to breathe a little harder but still talk." }),
        R("cat-cow", 2, "8 breaths", 30),
        R("thoracic-open-book", 2, "6 per side", 30),
        T("figure-four-stretch", 2, 30, 15),
      ]),
      day("Strength & Balance B", "Hips, carrying and core", [
        R("step-up", 3, "6-10 per side", 75, { rpe: 6, notes: "Use a low step and a handrail." }),
        R("glute-bridge", 3, "10-12", 60, { rpe: 6 }),
        T("farmers-carry", 3, 30, 60, { notes: "Light weights, tall posture." }),
        T("standing-march", 2, 45, 30),
        R("dead-bug", 2, "5 per side", 30),
      ]),
    ],
  },
  {
    slug: "active-aging-strength-2-day",
    name: "Strong for Life: 2-Day Strength (50+)",
    summary: "Two progressive strength sessions a week that build from light sets of 12 to heavier sets of 6–8.",
    description:
      "For active adults over 50 who want real strength, not just movement. Research such as the LIFTMOR trial shows that supervised, progressive, " +
      "genuinely challenging lifting is safe for many older adults and improves bone density and function — so this plan moves from learning sets of " +
      "10–12 to heavier sets of 6–8 with 2–3 reps in reserve. Two sessions meet the WHO/ACSM minimum for muscle strengthening; add balance work and " +
      "150 minutes of walking or other moderate activity across the week. Get medical clearance first if you have a heart, bone or joint condition.",
    category: "active-aging",
    types: ["strength", "low_impact"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: 30,
    goals: ["general_health", "build_strength", "build_muscle"],
    equipment: ["dumbbell", "bench", "band"],
    tier: "plus",
    lowImpact: true,
    progression:
      "Weeks 1–3: sets of 10–12, adding a set by week 2. Week 4 is lighter. Weeks 5–7: heavier sets of 6–8 — add a little weight whenever every set " +
      "reaches 8 reps with 2–3 reps still in the tank. Week 8 is lighter again before you repeat the cycle.",
    progressionModel: "linear_rpe",
    warmup: LOW_IMPACT_WARMUP,
    cooldown: ["Slow walk 2–3 minutes", "Seated hamstring stretch 30 seconds per side", "Slow breathing 1 minute"],
    days: activeAgingStrengthWeeks()[0]!.days,
    weekTemplates: activeAgingStrengthWeeks(),
  },
  {
    slug: "daily-mobility-flow",
    name: "Daily Mobility Flow",
    summary: "Short daily routines for hips, spine, shoulders and ankles.",
    description:
      "Fifteen to twenty minutes of mobility you can do on its own or after training. Move within a comfortable, pain-free range — longer holds " +
      "and regular practice are what improve range of motion. If a movement causes pain, skip it; this is not a rehabilitation program.",
    category: "mobility-flexibility",
    types: ["mobility", "low_impact"],
    difficulty: "beginner",
    weeks: 4,
    sessionMinutes: 15,
    goals: ["mobility", "general_health"],
    equipment: ["mat", "band", "bodyweight"],
    tier: "free",
    lowImpact: true,
    progression: "Hold times grow by about 5 seconds each week as positions become more comfortable.",
    progressionModel: "steady",
    noDeloadReason: "Mobility work is low-fatigue; there's nothing to recover from.",
    warmup: MOBILITY_WARMUP,
    cooldown: MOBILITY_COOLDOWN,
    days: mobilityWeeks(MOBILITY_DAYS)[0]!.days,
    weekTemplates: mobilityWeeks(MOBILITY_DAYS),
  },
  {
    slug: "recovery-deload-week",
    name: "Recovery & Deload Week",
    summary: "A planned easy week: lighter loads, mobility and easy cardio.",
    description:
      "Use this after a hard block or when check-ins show low readiness. Keep loads at roughly 50–60% of normal and stop every set with plenty " +
      "in reserve — coaches deload by cutting volume and effort, not by stopping entirely. Leave each session feeling better than when you started.",
    category: "recovery-deload",
    types: ["mobility", "low_impact"],
    difficulty: "beginner",
    weeks: 1,
    sessionMinutes: 25,
    goals: ["general_health", "mobility"],
    equipment: ["bodyweight", "dumbbell", "band", "bike"],
    tier: "free",
    lowImpact: true,
    progression: "No progression this week — return to your regular program next week.",
    progressionModel: "steady",
    noDeloadReason: "This whole week is a deload.",
    warmup: LOW_IMPACT_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Light Full Body", "Move, don't grind", [
        R("goblet-squat", 2, "8", 60, { rpe: 5 }),
        R("incline-push-up", 2, "8", 60, { rpe: 5 }),
        R("band-row", 2, "12", 45, { rpe: 5 }),
        R("glute-bridge", 2, "12", 45),
      ]),
      day("Easy Cardio + Mobility", "Blood flow", [
        T("bike-intervals", 1, 1200, 0, { rpe: 4, notes: "Easy, conversational pace." }),
        R("worlds-greatest-stretch", 2, "3 per side", 15),
        R("90-90-hip-switch", 2, "8", 15),
      ]),
      day("Mobility Reset", "Restore range", [
        R("cat-cow", 2, "8 breaths", 15),
        R("thoracic-open-book", 2, "6 per side", 15),
        T("couch-stretch", 2, 40, 15),
        T("childs-pose", 1, 90, 0),
      ]),
    ],
  },
  // =========================================================== Strength & powerlifting
  {
    slug: "barbell-strength-foundations",
    name: "Novice Linear Progression: 3×5 Barbell",
    summary: "Alternate two short barbell workouts three times a week and add weight every session.",
    description:
      "The classic way new lifters get strong fastest, in the style of Starting Strength and StrongLifts: squat every session, alternate bench press " +
      "and overhead press, deadlift once or twice a week, and add a small amount of weight every time you train. Three work sets of five are heavy " +
      "enough to build strength and light enough to recover from 48 hours later. Run it until progress stalls despite good sleep and food — usually " +
      "3–9 months — then move to the weekly-undulating or training-max programs.",
    category: "strength",
    types: ["strength", "powerlifting"],
    difficulty: "beginner",
    weeks: 12,
    sessionMinutes: 45,
    goals: ["build_strength", "build_muscle"],
    equipment: ["barbell", "rack", "bench", "pull_up_bar"],
    tier: "free",
    progression:
      "Every session: if you made all your reps, add weight next time — about 2.5 kg / 5 lb on squats, presses and rows and 5 kg / 10 lb on deadlifts, " +
      "using smaller jumps on the presses once they slow down. Missed reps? Repeat the weight next session. Miss the same weight three sessions in a " +
      "row: drop that lift by 10% and build back up. Two resets on a lift means you're ready for an intermediate program.",
    progressionModel: "linear_rpe",
    noDeloadReason: "Novice progression uses stall-based resets (drop 10% after three missed sessions) instead of scheduled deloads.",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: noviceLpWeeks()[0]!.days,
    weekTemplates: noviceLpWeeks(),
  },
  {
    slug: "tiered-strength-program",
    name: "Tiered Strength: Heavy, Volume & Pump",
    summary: "Four days built on three tiers — heavy triples, sets of ten and high-rep pump work — with a set rule for every stall.",
    description:
      "A tiered linear progression in the style of Cody Lefever's GZCLP. Each day pairs one main lift for heavy, low-rep work (tier 1) with a " +
      "different main lift for volume (tier 2) and a high-rep upper-back exercise (tier 3), so every lift gets trained heavy once and for volume once " +
      "a week. When a lift stalls you change the set-and-rep scheme instead of stopping — which keeps late-novice lifters progressing for months.",
    category: "strength",
    types: ["strength", "powerlifting"],
    difficulty: "beginner",
    weeks: 12,
    sessionMinutes: 40,
    goals: ["build_strength", "build_muscle"],
    equipment: ["barbell", "rack", "bench", "cable", "dumbbell"],
    tier: "plus",
    progression:
      "Tier 1 (5 × 3, last set as many as possible): add 2.5 kg / 5 lb upper, 5 kg / 10 lb lower every session. On a miss go to 6 × 2, then 10 × 1, " +
      "then test a 5-rep max and restart 5 × 3 at 85% of it. Tier 2 (3 × 10): add weight every session; on a miss go to 3 × 8, then 3 × 6, then restart " +
      "3 × 10 about 5–10% lighter than your last 3 × 10. Tier 3 (3 × 15+): add weight when the last set reaches 25 reps. Weeks 6 and 12 are deloads.",
    progressionModel: "steady",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: tieredWeeks()[0]!.days,
    weekTemplates: tieredWeeks(),
  },
  {
    slug: "womens-strength-progression",
    name: "Strong Foundations: Women's Strength",
    summary: "A full-body strength plan that progresses load — not just reps — three days a week.",
    description:
      "Shaped by feedback from women lifters who wanted real strength progression rather than 'toning' circuits. Research shows women gain muscle at a " +
      "similar relative rate to men and often gain upper-body strength faster, so nothing here assumes you should lift light: heavy compound lifts, " +
      "upper-body pulling strength and glute development, with adjustable volume.",
    category: "womens-strength",
    types: ["strength", "hypertrophy"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: 50,
    goals: ["build_strength", "build_muscle", "general_health", "lose_fat"],
    equipment: ["barbell", "dumbbell", "bench", "rack", "pull_up_bar", "band", "cable"],
    tier: "plus",
    progression:
      "Add load when all reps are completed at or below the target RPE; target effort rises from RPE 7 to about 9 by week 5. Pull-ups progress from " +
      "band-assisted to bodyweight by using lighter bands every 1–2 weeks. Week 8 is a deload.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Strength A", "Squat & horizontal press", [
        R("back-squat", 4, "5-6", 150, { rpe: 7 }),
        R("dumbbell-bench-press", 3, "6-8", 120, { rpe: 7 }),
        R("band-assisted-pull-up", 3, "5-8", 120),
        R("hip-thrust", 3, "8-10", 90, { rpe: 7.5 }),
        R("pallof-press", 2, "10 per side", 45),
      ]),
      day("Strength B", "Hinge & overhead press", [
        R("trap-bar-deadlift", 4, "5", 180, { rpe: 7, notes: "Use a conventional deadlift if no trap bar." }),
        R("overhead-press", 3, "6-8", 120, { rpe: 7 }),
        R("one-arm-dumbbell-row", 3, "8-10 per side", 90),
        R("walking-lunge", 3, "10 per side", 90),
        T("farmers-carry", 3, 40, 60),
      ]),
      day("Strength C", "Single-leg & upper volume", [
        R("bulgarian-split-squat", 3, "8 per side", 90, { rpe: 7 }),
        R("romanian-deadlift", 3, "8", 120, { rpe: 7 }),
        R("push-up", 3, "AMRAP", 90, { notes: "Stop 1–2 reps before form breaks." }),
        R("lat-pulldown", 3, "10-12", 90),
        R("lateral-raise", 2, "12-20", 45),
      ]),
    ],
  },
  {
    slug: "intermediate-weekly-undulating",
    name: "Weekly Undulating Strength: Volume, Light & Heavy Days",
    summary: "Three days a week — a volume day, a recovery day and a heavy day — with weekly records instead of session-to-session jumps.",
    description:
      "For lifters whose novice progression has stalled. In the style of the Texas Method from Rippetoe and Kilgore's Practical Programming: Monday's " +
      "5 × 5 at about 90% of Friday's weight builds the stress, Wednesday's light day lets you recover, and Friday you set a new rep record. Progress " +
      "comes weekly rather than every session. Bench and overhead press alternate weeks as the main press.",
    category: "strength",
    types: ["strength", "powerlifting"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 40,
    goals: ["build_strength"],
    equipment: ["barbell", "rack", "bench", "pull_up_bar"],
    tier: "plus",
    progression:
      "Each week: add 2.5 kg / 5 lb to the intensity-day top set and set volume day at about 90% of it (light day squats at 80% of volume day). " +
      "Weeks 1–3 chase new 5-rep maxes, week 4 is lighter, weeks 5–7 rotate to heavy triples and doubles, and week 8 is a deload. If you miss " +
      "intensity-day reps twice, drop volume day to 4 × 5 before cutting the weight.",
    progressionModel: "linear_rpe",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: weeklyUndulatingWeeks()[0]!.days,
    weekTemplates: weeklyUndulatingWeeks(),
  },
  {
    slug: "wave-strength-training-max",
    name: "4-Week Wave Strength: Training-Max Method",
    summary: "One main lift a day in 4-week waves of 65–95% of a training max, with 5×10 or 5×5 supplemental work and a deload every fourth week.",
    description:
      "In the style of Jim Wendler's 5/3/1. You base everything on a training max — 90% of your true 1RM — so the work is always a little easier than " +
      "you think, which is why it keeps working for years. Week 1 is sets of 5 (65/75/85%), week 2 triples (70/80/90%), week 3 is 5/3/1 (75/85/95%), " +
      "and the last set each week is for as many good reps as you can. Week 4 deloads at 40/50/60%. Cycle 1 adds 5 × 10 volume sets of the opposite lift " +
      "(a \"boring but big\" variant) for size and frequency; cycle 2 switches to 5 × 5 at the first-set weight (\"first set last\") for strength.",
    category: "strength",
    types: ["strength", "powerlifting"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 55,
    goals: ["build_strength", "build_muscle"],
    equipment: ["barbell", "rack", "bench", "pull_up_bar", "dumbbell", "cable", "dip_station"],
    tier: "plus",
    progression:
      "Set your training max (TM) at 90% of your 1RM. After each deload, add 2.5 kg / 5 lb to the bench and press TMs and 5 kg / 10 lb to the squat " +
      "and deadlift TMs. If you can't get at least 5 reps on the last set of the 5s week (or 1 rep on the 95% set), lower that lift's TM by 10%. " +
      "Never chase grinders on the last set — leave one good rep in the tank.",
    progressionModel: "steady",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: trainingMaxWeeks()[0]!.days,
    weekTemplates: trainingMaxWeeks(),
  },
  {
    slug: "powerbuilding-4-day",
    name: "Powerbuilding 4-Day: Strength + Size",
    summary: "Two heavy days and two hypertrophy days a week: get stronger on the big lifts while building muscle everywhere.",
    description:
      "Powerbuilding blends a powerlifter's heavy compound work with a bodybuilder's volume. Strength days use 4–6 reps on the squat, bench and rows; " +
      "hypertrophy days use 8–20 reps, machines, cables and lengthened-position exercises. Weekly volume lands around 10–20 hard sets per major muscle " +
      "and builds through two three-week waves, each followed by a deload.",
    category: "powerbuilding",
    types: ["strength", "hypertrophy"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 55,
    goals: ["build_strength", "build_muscle"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar"],
    tier: "plus",
    progression:
      "Heavy lifts: add 2.5 kg / 5 lb when every set reaches the top of the rep range at the target RPE. Hypertrophy work: double progression — add reps, " +
      "then load. Each wave starts at about 3 reps in reserve and ends around 1, with an extra set on key exercises; weeks 4 and 8 halve the sets.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: hypertrophyWeeks(POWERBUILDING_4, HYPERTROPHY_8)[0]!.days,
    weekTemplates: hypertrophyWeeks(POWERBUILDING_4, HYPERTROPHY_8),
  },
  {
    slug: "powerlifting-base-block",
    name: "Powerlifting Base Block",
    summary: "Four days of percentage-based squat, bench and deadlift training with RPE checks.",
    description:
      "An intermediate block to build strength and technique in the competition lifts. Three weeks of sets of 4–5 at 72.5–77.5%, a deload, then three " +
      "weeks of triples at 80–85% and a deload with an optional re-test. Squat and bench are trained twice a week, the deadlift once plus front squats. " +
      "Each set has a percentage and an RPE: if the RPE is much higher than written, use the RPE.",
    category: "powerlifting",
    types: ["powerlifting", "strength"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 50,
    goals: ["build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable"],
    tier: "plus",
    progression:
      "Percentages of your current 1RM rise 2.5% a week. If a set is more than 1 RPE above target, keep the weight for the rest of that session. " +
      "Weeks 4 and 8 are deloads; at the end of week 8 you can work up to a smooth heavy triple to estimate your new max for the next block.",
    progressionModel: "linear_rpe",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: powerliftingBaseWeeks()[0]!.days,
    weekTemplates: powerliftingBaseWeeks(),
  },
  {
    slug: "bench-press-specialist",
    name: "Bench Press Specialist",
    summary: "Bench three times a week — heavy, volume and paused — with the upper-back and triceps work to support it.",
    description:
      "An 8-week bench block for lifters who want a bigger press. Day 1 is heavy, day 3 builds volume with close-grip work, and day 4 practises " +
      "competition-style paused reps. Lower-body training is kept to maintenance so your recovery goes to the bench, and rows balance the pressing. " +
      "Use the custom program builder if you want exact loads calculated from your max.",
    category: "bench-press",
    types: ["powerlifting", "strength"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 50,
    goals: ["build_strength", "build_muscle"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pull_up_bar"],
    tier: "plus",
    progression:
      "Target RPE rises by about 0.5 a week (capped at RPE 9 for multi-set work). When every set of the main bench lift is completed at or below the target " +
      "RPE, add 2.5 kg / 5 lb next week. Week 8 is a deload — or test a new max at the end of it if you feel fresh.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Heavy Bench", "Low-rep competition bench + upper back", [
        R("bench-press", 5, "3", 180, { rpe: 7, notes: "About 80–85% 1RM. Ramp up with 4–5 warm-up sets (10, 5, 3, 2, 1 reps)." }),
        R("barbell-row", 4, "8", 120, { rpe: 7 }),
        R("overhead-press", 3, "6", 120, { rpe: 7 }),
        R("face-pull", 3, "15", 60),
      ]),
      day("Lower Maintenance", "Squat, hinge and core — keep the legs strong", [
        R("back-squat", 3, "5", 180, { rpe: 7 }),
        R("romanian-deadlift", 3, "8", 120, { rpe: 7 }),
        R("walking-lunge", 2, "10 per side", 90),
        T("plank", 3, 40, 45),
      ]),
      day("Bench Volume", "Moderate-weight bench, close-grip and pulling", [
        R("bench-press", 4, "6-8", 150, { rpe: 7, notes: "About 70–75% 1RM." }),
        R("close-grip-bench-press", 3, "6", 120, { rpe: 7 }),
        R("chin-up", 4, "6-8", 90),
        R("triceps-pushdown", 3, "12", 60),
        R("lateral-raise", 3, "15", 45),
      ]),
      day("Paused Bench", "Competition-style pauses and lockout", [
        R("paused-bench-press", 4, "3", 180, { rpe: 7, notes: "About 75% 1RM. Hold each rep motionless on the chest for 1–2 seconds." }),
        R("pin-press", 3, "4", 150, { rpe: 7, notes: "Pins 2–4 inches above the chest." }),
        R("one-arm-dumbbell-row", 4, "10 per side", 75),
        R("overhead-triceps-extension", 3, "12", 60),
      ]),
    ],
  },
  {
    slug: "squat-specialist",
    name: "Squat Specialist",
    summary: "Three squat sessions a week — heavy, paused and tempo — plus targeted quad and posterior-chain work.",
    description:
      "An 8-week block for building a stronger squat. Heavy sets early in the week, pause squats for position and power out of the hole, and tempo " +
      "squats for control. Upper-body work is kept to maintenance. Use the custom program builder for loads based on your max.",
    category: "squat-specialization",
    types: ["powerlifting", "strength"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 45,
    goals: ["build_strength", "build_muscle"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "machine", "pull_up_bar"],
    tier: "plus",
    progression:
      "Target RPE rises by about 0.5 a week (capped at RPE 9 for multi-set work). Add 2.5–5 kg / 5–10 lb to the heavy squat when every set is " +
      "completed at or below the target RPE. Week 8 is a deload.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Heavy Squat", "Low-rep back squat", [
        R("back-squat", 5, "3", 210, { rpe: 7, notes: "About 80–85% 1RM. Ramp up with 4–5 warm-up sets (10, 5, 3, 2, 1 reps)." }),
        R("romanian-deadlift", 3, "8", 150, { rpe: 7 }),
        R("leg-curl", 3, "12", 60),
        R("ab-wheel-rollout", 3, "8-10", 60),
      ]),
      day("Upper Maintenance", "Press and pull", [
        R("bench-press", 3, "5", 150, { rpe: 7 }),
        R("chin-up", 3, "6-8", 90),
        R("overhead-press", 3, "8", 90, { rpe: 7 }),
        R("barbell-row", 3, "10", 90),
      ]),
      day("Pause Squat", "Strength out of the hole", [
        R("pause-squat", 4, "4", 180, { rpe: 7, notes: "About 70% 1RM. 2-second pause at depth, stay braced." }),
        R("bulgarian-split-squat", 3, "8 per side", 90),
        R("leg-extension", 3, "12-15", 60),
        T("side-plank", 3, 30, 30),
      ]),
      day("Tempo Squat & Hinge", "Control and posterior chain", [
        R("tempo-squat", 3, "5", 150, { rpe: 6.5, notes: "About 65% 1RM. 4-second lowering, normal speed up." }),
        R("good-morning", 3, "8", 120, { rpe: 6.5 }),
        R("leg-press", 3, "10-12", 90),
        R("standing-calf-raise", 3, "12-15", 45),
      ]),
    ],
  },
  {
    slug: "deadlift-specialist",
    name: "Deadlift Specialist",
    summary: "Two pulling days — heavy and variation — with hinge accessories, upper-back and grip work.",
    description:
      "An 8-week block for a stronger deadlift. Deadlifts are very fatiguing, so heavy pulls happen once a week, with a lighter variation day " +
      "(deficit or block pulls) to target your sticking point. Squats and upper-body work support the pull. Use the custom program builder for loads " +
      "based on your max.",
    category: "deadlift-specialization",
    types: ["powerlifting", "strength"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 50,
    goals: ["build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "pull_up_bar"],
    tier: "plus",
    progression:
      "Target RPE rises by about 0.5 a week (capped at RPE 9 for multi-set work). Add 5 kg / 10 lb to the heavy deadlift when all sets are completed at " +
      "or below the target RPE with a flat back. Week 8 is a deload.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Heavy Deadlift", "Low-rep competition pull", [
        R("conventional-deadlift", 4, "3", 240, { rpe: 7, notes: "About 80–85% 1RM. Ramp up with 4–5 warm-up sets. Reset each rep — no bouncing." }),
        R("barbell-row", 3, "8", 120, { rpe: 7 }),
        R("hip-thrust", 3, "10", 90),
        T("farmers-carry", 3, 40, 90, { notes: "Heavy; builds grip for the deadlift." }),
      ]),
      day("Upper Body", "Press and upper back", [
        R("bench-press", 4, "5", 150, { rpe: 7 }),
        R("pull-up", 4, "5-8", 90),
        R("seated-dumbbell-shoulder-press", 3, "10", 90),
        R("face-pull", 3, "15", 60),
      ]),
      day("Squat & Pull Variation", "Squat strength and deadlift sticking point", [
        R("back-squat", 4, "5", 180, { rpe: 7 }),
        R("deficit-deadlift", 3, "5", 180, { rpe: 7, notes: "About 65–70% 1RM. 1–2 inch deficit. Swap for block pulls if lockout is your weak point." }),
        R("good-morning", 3, "8", 120, { rpe: 6.5 }),
        T("dead-hang", 3, 40, 60),
      ]),
    ],
  },
  {
    slug: "conjugate-4-day",
    name: "Conjugate 4-Day: Max Effort & Dynamic Effort",
    summary: "Max-effort and speed days for upper and lower body, with rotating heavy variations and lots of accessory work.",
    description:
      "Based on the conjugate principles popularised by Westside Barbell: each week has a max-effort lower and upper day (work up to a 1–3 rep max " +
      "on a variation that rotates every two weeks) and a dynamic-effort lower and upper day (many fast sets at 50–60% of your max). Rotating the " +
      "max-effort exercise lets you train heavy every week without stalling. Best for experienced lifters with solid technique.",
    category: "powerlifting",
    types: ["powerlifting", "strength"],
    difficulty: "advanced",
    weeks: 8,
    sessionMinutes: 50,
    goals: ["build_strength"],
    equipment: ["barbell", "rack", "bench", "box", "dumbbell", "cable", "machine", "pull_up_bar", "sled"],
    tier: "plus",
    progression:
      "Max-effort days: beat your previous best on that variation, and rotate the exercise every 2 weeks. Dynamic-effort days run in 3-week waves " +
      "(speed squats 50 → 55 → 60%, speed bench 50 → 55%), then reset. Accessories use double progression. Weeks 4 and 8 are deloads.",
    progressionModel: "steady",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: conjugateWeeks()[0]!.days,
    weekTemplates: conjugateWeeks(),
  },
  {
    slug: "powerlifting-peaking-12-week",
    name: "12-Week Powerlifting Peak",
    summary: "Accumulation, intensification, a two-week taper and meet week — with attempt selection built in.",
    description:
      "A block-periodized meet prep. Four weeks of volume at 70–77.5%, a deload, four weeks of triples at 80–87.5%, a peak week of heavy singles, a " +
      "taper that cuts volume by about half while keeping intensity (the approach supported by tapering research for strength athletes), and meet week. " +
      "Bench is trained three times a week, squat twice and the deadlift twice with the last heavy pull about ten days out. Meet day uses the common " +
      "attempt rule: an opener you could triple on a bad day (90–92%), a second at 95–97%, and a third at 100–103% only if the second moved well.",
    category: "powerlifting",
    types: ["powerlifting", "strength"],
    difficulty: "advanced",
    weeks: 12,
    sessionMinutes: 50,
    goals: ["build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar"],
    tier: "plus",
    progression:
      "Percentages are of your current 1RM and rise 2.5% a week through each phase. If a set is more than 1 RPE above target, stay at that weight. " +
      "Week 5 deloads; weeks 10–11 peak and taper (volume down 40–50%, intensity held); week 12 is meet week.",
    progressionModel: "linear_rpe",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: peakingWeeks()[0]!.days,
    weekTemplates: peakingWeeks(),
  },
  // =========================================================== Strongman
  {
    slug: "strongman-foundations",
    name: "Strongman Foundations",
    summary: "Build odd-object strength, carries and pressing power with gym-accessible tools.",
    description:
      "A strongman program that uses equipment found in many gyms — sandbags, sleds, dumbbells and barbells — as substitutes for the log, circus " +
      "dumbbell, stones, yoke and truck pull. Two max-effort days (overhead and deadlift) plus an odd-object day, with carries and drags programmed by " +
      "distance and target time — the way competitive strongmen structure their weeks. Have real implements? Try Strongman 4-Day: Statics & Events.",
    category: "strongman",
    types: ["strongman", "strength"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 55,
    goals: ["build_strength", "athletic_performance"],
    equipment: ["barbell", "rack", "sandbag", "sled", "dumbbell", "kettlebell"],
    tier: "free",
    progression:
      "Moving events progress by load: when every run beats the target time with good posture, add weight next week. Pressing and pulling follow RPE " +
      "progression (capped at RPE 9). Week 6 deloads volume by about 40%.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Max Effort — Overhead & Carries", "Log-style pressing, a circus-dumbbell substitute and farmer's carries by distance", [
        R("push-press", 5, "3", 180, { rpe: 7, notes: "Log substitute: dip and drive, lock out hard. Swap in a log or axle if your gym has one." }),
        R("one-arm-dumbbell-push-press", 3, "5 per arm", 120, { rpe: 7, notes: "Circus dumbbell substitute." }),
        T("farmers-carry", 4, 15, 120, { reps: "20 m", notes: "Farmer's: 4 × 20 m (65 ft). Add 2.5 kg / 5 lb per hand when every run is under 15 s." }),
        R("barbell-row", 3, "8", 90),
        R("dumbbell-bench-press", 2, "8-10", 90, { notes: "Pressing strength from the chest supports the log." }),
        R("face-pull", 2, "15", 45, { notes: "Shoulder health for high-frequency pressing." }),
      ]),
      day("Squat & Odd Objects", "Zercher squats, sandbag loads (stone substitute) and a bear-hug carry", [
        R("zercher-squat", 4, "5", 180, { rpe: 7, notes: "Builds the lap position for stones, kegs and sandbags." }),
        R("sandbag-load-over-bar", 5, "2", 120, { notes: "Stone substitute: lap, re-grip, extend. Move to a heavier bag when every rep is smooth." }),
        R("sandbag-to-shoulder", 3, "2 per side", 120),
        T("sandbag-bear-hug-carry", 4, 18, 90, { reps: "20 m", notes: "Keg/yoke substitute: 4 × 20 m. Go heavier when every run is under 18 s." }),
        R("hanging-knee-raise", 3, "10", 60),
      ]),
      day("Max Effort — Deadlift & Medley", "Heavy pulls, an above-the-knee pull, a sled drag and grip", [
        R("conventional-deadlift", 4, "3", 210, { rpe: 7 }),
        R("block-pull", 3, "3", 180, { rpe: 7, notes: "Bar just above the knee — the height of many strongman deadlift events. Straps are fine." }),
        T("sled-drag", 4, 20, 120, { reps: "20 m", notes: "Truck-pull substitute: 4 × 20 m. Add load when every run is under 20 s." }),
        T("dead-hang", 3, 30, 60, { notes: "Double-overhand grip." }),
      ]),
    ],
  },
  {
    slug: "strongman-4-day-events",
    name: "Strongman 4-Day: Statics & Events",
    summary: "Max-effort log and deadlift days, a squat/volume day and a full event day with real implements.",
    description:
      "How competitive strongmen commonly organise a week: a max-effort overhead day (log or axle), a max-effort deadlift day with an above-the-knee " +
      "pull, a squat and overhead-volume day, and a dedicated event day — yoke, farmer's walk, stones and a drag — written as distance with a target " +
      "time. Two 3-week waves (triples, then heavier doubles and singles), each followed by a deload. Needs a log, yoke, farmer's handles, stones and a sled.",
    category: "strongman",
    types: ["strongman", "strength"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 55,
    goals: ["build_strength", "athletic_performance"],
    equipment: ["barbell", "rack", "bench", "strongman_implements", "sled", "cable", "pull_up_bar"],
    tier: "plus",
    progression:
      "Static lifts follow RPE targets that rise through each wave (triples in weeks 1–3, doubles and a heavy single in weeks 5–7). Events progress by " +
      "load: when every 20 m run is under the target time, add the listed jump next week; stones move up when every rep is smooth. Weeks 4 and 8 deload. " +
      "Peaking for a contest? Use the custom strongman builder's contest-prep goal for event rehearsals and openers.",
    progressionModel: "linear_rpe",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: strongmanWeeks()[0]!.days,
    weekTemplates: strongmanWeeks(),
  },
  // =========================================================== Bodybuilding & physique
  {
    slug: "full-body-hypertrophy-3-day",
    name: "Full-Body Hypertrophy: 3 Days",
    summary: "Three full-body sessions a week: every muscle trained three times with about 10 hard sets per muscle that build through the block.",
    description:
      "The most time-efficient way to build muscle for beginners and busy lifters. Research shows growth depends mostly on weekly hard sets taken " +
      "close to failure, and that training each muscle at least twice a week is a sensible default — full-body sessions three times a week hit both. " +
      "Each day uses a different squat, hinge, press and pull plus small-muscle work, with lengthened-position exercises like incline curls and " +
      "overhead triceps extensions.",
    category: "hypertrophy",
    types: ["hypertrophy", "strength"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 45,
    goals: ["build_muscle", "build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine"],
    tier: "free",
    progression:
      "Double progression: add reps until every set reaches the top of the range at the week's reps-in-reserve target, then add the smallest load jump. " +
      "Weeks 1–2 build effort, weeks 3–5 add a set to key exercises, week 6 is a deload. Repeat the block a little heavier.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: hypertrophyWeeks(FULL_BODY_3, HYPERTROPHY_6)[0]!.days,
    weekTemplates: hypertrophyWeeks(FULL_BODY_3, HYPERTROPHY_6),
  },
  {
    slug: "womens-glute-strength",
    name: "Glutes & Strength: 4-Day Upper/Lower",
    summary: "Two glute-focused lower days and two upper days — heavy hip thrusts and squats plus real upper-body strength.",
    description:
      "A glute-specialization program that doesn't skip strength. Lower days pair heavy hip thrusts, squats and deadlifts with split squats, back " +
      "extensions and abduction work for the upper glutes; upper days build pressing and pulling strength (including your first chin-up). Glutes get " +
      "the most volume, while upper-body muscles train at a productive maintenance-to-growth level. Popular with women, suitable for anyone.",
    category: "womens-strength",
    types: ["hypertrophy", "strength"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 45,
    goals: ["build_muscle", "build_strength", "lose_fat", "general_health"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "band", "pull_up_bar"],
    tier: "plus",
    progression:
      "Double progression: add reps until every set reaches the top of the range at the week's reps-in-reserve target, then add load. Weeks 3–5 add a " +
      "set to hip thrusts and key upper-body lifts. Week 6 is a deload — then repeat with heavier weights.",
    progressionModel: "volume_wave",
    warmup: [...STANDARD_WARMUP.slice(0, 4), "Glute bridges × 10 and banded side steps × 10 per side", "2–3 ramp-up sets of your first lift"],
    cooldown: STANDARD_COOLDOWN,
    days: hypertrophyWeeks(GLUTE_STRENGTH, HYPERTROPHY_6)[0]!.days,
    weekTemplates: hypertrophyWeeks(GLUTE_STRENGTH, HYPERTROPHY_6),
  },
  {
    slug: "hypertrophy-upper-lower",
    name: "Hypertrophy: Upper / Lower Split",
    summary: "Four sessions per week with 11–18 hard sets per muscle for muscle growth.",
    description:
      "Each muscle group is trained twice a week with a mix of compound and isolation work in moderate rep ranges, including exercises that load " +
      "muscles at long lengths (incline curls, overhead extensions, seated leg curls). Sets are taken close to — but not past — technical failure, and " +
      "weekly volume builds through two three-week waves, each ending in a deload.",
    category: "hypertrophy",
    types: ["hypertrophy"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 55,
    goals: ["build_muscle", "build_strength"],
    equipment: ["barbell", "dumbbell", "bench", "cable", "machine", "rack", "pull_up_bar"],
    tier: "plus",
    progression:
      "Double progression: once you hit the top of the rep range on all sets at the week's reps-in-reserve target, add load. Each wave starts at about " +
      "3 reps in reserve and finishes near 1, adding a set to key exercises; weeks 4 and 8 halve the sets.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: hypertrophyWeeks(UPPER_LOWER, HYPERTROPHY_8)[0]!.days,
    weekTemplates: hypertrophyWeeks(UPPER_LOWER, HYPERTROPHY_8),
  },
  {
    slug: "power-hypertrophy-upper-lower",
    name: "Power & Hypertrophy Upper/Lower (4 Days)",
    summary: "Two heavy 3–5 rep days and two 8–15 rep days — each muscle twice a week, strength and size together.",
    description:
      "In the style of Brandon Campbell's PHUL: upper and lower power days built on heavy compounds, then upper and lower hypertrophy days with more " +
      "isolation work. A popular next step after a novice program for lifters who want to look and perform better.",
    category: "hypertrophy",
    types: ["hypertrophy", "strength"],
    difficulty: "intermediate",
    weeks: 6,
    sessionMinutes: 55,
    goals: ["build_muscle", "build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar"],
    tier: "plus",
    progression:
      "Power days: add 2.5 kg / 5 lb when every set reaches 5 reps at the target RPE. Hypertrophy days: double progression. Weeks 3–5 add a set to key " +
      "exercises as reps in reserve fall from 3 to about 1; week 6 is a deload.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: hypertrophyWeeks(PHUL_DAYS, HYPERTROPHY_6)[0]!.days,
    weekTemplates: hypertrophyWeeks(PHUL_DAYS, HYPERTROPHY_6),
  },
  {
    slug: "push-pull-legs-6-day",
    name: "Push / Pull / Legs: 6 Days",
    summary: "Push, pull and legs twice a week: a heavy lift with a last-set rep target, then bodybuilding volume.",
    description:
      "In the style of the popular Reddit PPL by u/metallicadpa: each day opens with a main lift (deadlift, bench, squat, row or overhead press) and " +
      "a last set for as many reps as possible, then moves to 8–20 rep accessories. Six days give every muscle two sessions a week with about 12–18 " +
      "hard sets. Run it Push-Pull-Legs-Push-Pull-Legs-Rest, or put the rest day after the first three.",
    category: "hypertrophy",
    types: ["hypertrophy", "strength"],
    difficulty: "intermediate",
    weeks: 6,
    sessionMinutes: 45,
    goals: ["build_muscle", "build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar"],
    tier: "plus",
    progression:
      "Main lifts: when the last set reaches 5+ reps (deadlift: 5+ on its single set), add 2.5 kg / 5 lb (deadlift 5 kg / 10 lb) next time; miss three " +
      "times and drop 10%. Accessories: double progression. Weeks 3–5 add a set to key accessories; week 6 is a deload.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: hypertrophyWeeks(PPL_DAYS, HYPERTROPHY_6)[0]!.days,
    weekTemplates: hypertrophyWeeks(PPL_DAYS, HYPERTROPHY_6),
  },
  {
    slug: "power-hypertrophy-5-day",
    name: "Power-Hypertrophy 5-Day",
    summary: "Two heavy power days and three body-part hypertrophy days with speed work — high volume for experienced lifters.",
    description:
      "In the style of Layne Norton's PHAT: an upper and a lower power day early in the week, then back-and-shoulders, legs, and chest-and-arms " +
      "hypertrophy days that open with explosive speed sets at 65–70% of your power-day weights. It's a lot of volume — about 15–20 hard sets for the " +
      "big muscles — so it suits lifters with a few years of training and good recovery.",
    category: "hypertrophy",
    types: ["hypertrophy", "strength"],
    difficulty: "advanced",
    weeks: 6,
    sessionMinutes: 50,
    goals: ["build_muscle", "build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar", "dip_station"],
    tier: "plus",
    progression:
      "Power days: add load when every set reaches the top of 3–5 reps at the target RPE. Speed sets stay at 65–70% of your current power-day weights. " +
      "Hypertrophy work: double progression with a set added to key exercises in weeks 3–5. Week 6 is a deload.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: hypertrophyWeeks(PHAT_DAYS, HYPERTROPHY_6)[0]!.days,
    weekTemplates: hypertrophyWeeks(PHAT_DAYS, HYPERTROPHY_6),
  },
  {
    slug: "physique-show-prep",
    name: "Physique Show Prep",
    summary: "Twelve weeks of hypertrophy, rising conditioning and daily posing, tapering into show week.",
    description:
      "A training plan for bodybuilding, classic, men's/women's physique, figure, bikini and wellness competitors. Five sessions a week hold muscle " +
      "while conditioning rises gradually; evidence-based prep guidance (Helms, Aragon & Fitschen) suggests losing about 0.5–1% of body weight per " +
      "week and keeping training heavy enough to signal muscle retention. Week 7 is lighter and week 12 tapers. Nutrition, water and peak-week strategy " +
      "should be guided by a qualified coach or registered dietitian — this program does not prescribe extreme dieting, dehydration or sodium " +
      "manipulation, which carry real risks and often make you look flatter. Every session ends with posing practice.",
    category: "show-prep",
    types: ["hypertrophy", "cardio"],
    difficulty: "advanced",
    weeks: 12,
    sessionMinutes: 65,
    goals: ["build_muscle", "lose_fat"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar", "bike"],
    tier: "plus",
    progression:
      "Keep the weights you're lifting and 1–3 reps in reserve — in a deficit, holding strength is the win. Low-intensity cardio rises from about 20 to " +
      "35 minutes per session over the prep and posing from 10 to 20 minutes; your coach adjusts both from weekly weigh-ins. Week 7 is lighter and " +
      "week 12 is a taper.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: hypertrophyWeeks(SHOW_PREP_DAYS, SHOW_PREP_BLOCK, showPrepExtras)[0]!.days,
    weekTemplates: hypertrophyWeeks(SHOW_PREP_DAYS, SHOW_PREP_BLOCK, showPrepExtras),
  },
  // =========================================================== Combat sports
  {
    slug: "mma-off-camp-2-day",
    name: "Off-Camp Strength for Fighters (2 Days)",
    summary: "Two short strength & power sessions a week that build a base without stealing from skills training.",
    description:
      "Between fight camps, most of your energy should go to skills. Two full-body sessions a week are enough to build and keep strength, power and " +
      "resilience: jumps and throws first, then a heavy lower-body lift, pressing and pulling, hamstring and groin injury-prevention work, and neck " +
      "training (stronger necks are associated with lower concussion risk in observational research). Everything stays 2–3 reps shy of failure to keep " +
      "soreness low — lift after technique work or 6+ hours apart.",
    category: "mma-conditioning",
    types: ["mma", "athletic", "grappling", "boxing"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: 35,
    goals: ["combat_sports", "build_strength", "athletic_performance"],
    equipment: ["barbell", "trap_bar", "dumbbell", "medicine_ball", "box", "pull_up_bar", "bench", "rack"],
    tier: "free",
    progression:
      "Weeks 1–3: sets of 5, adding a set and a little load. Week 4 deloads. Weeks 5–7: heavier triples at the same low soreness. Week 8 deloads. " +
      "Neck and groin work progress by 5 seconds or 2 reps a week, never through pain.",
    progressionModel: "linear_rpe",
    warmup: MMA_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: offCampWeeks()[0]!.days,
    weekTemplates: offCampWeeks(),
  },
  {
    slug: "boxing-round-ready",
    name: "Boxing: Round Ready",
    summary: "Shoulder endurance, footwork and repeat-sprint capacity for boxing.",
    description:
      "Round-structured sessions that mirror the demands of boxing: sustained shoulder output, light fast feet and the ability to recover between " +
      "exchanges. Pair with technical boxing coaching.",
    category: "boxing-conditioning",
    types: ["boxing", "cardio"],
    difficulty: "beginner",
    weeks: 4,
    sessionMinutes: 45,
    goals: ["combat_sports", "improve_conditioning", "lose_fat"],
    equipment: ["jump_rope", "heavy_bag", "dumbbell", "medicine_ball", "bodyweight"],
    tier: "plus",
    progression: "Conditioning adds a round or cuts 10 seconds of rest each week; strength work holds at about RPE 7. Week 4 keeps rounds but lowers intensity.",
    progressionModel: "density",
    deloadFinalWeek: true,
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Footwork & Rhythm", "Light feet and aerobic rounds", [
        T("jump-rope", 4, 180, 60),
        T("shadowboxing", 3, 180, 60, { notes: "Focus on stepping in and out with every combination." }),
        T("lateral-shuffle", 4, 20, 40),
        T("plank", 3, 40, 30),
      ]),
      day("Bag Power Rounds", "Striking endurance", [
        T("heavy-bag-rounds", 6, 120, 60, { rpe: 8 }),
        R("medicine-ball-rotational-throw", 3, "6 per side", 60),
        R("push-up", 3, "10-15", 60, { rpe: 7 }),
        R("dead-bug", 2, "8 per side", 30),
      ]),
      day("Strength Support", "Upper back, legs and trunk", [
        R("goblet-squat", 3, "10", 90, { rpe: 7 }),
        R("one-arm-dumbbell-row", 3, "10 per side", 75, { rpe: 7 }),
        R("seated-dumbbell-shoulder-press", 3, "10", 75, { rpe: 7 }),
        R("band-pull-apart", 3, "20", 45),
        R("pallof-press", 3, "10 per side", 45),
      ]),
    ],
  },
  {
    slug: "grappling-mat-endurance",
    name: "Wrestling & Grappling: Mat Endurance",
    summary: "Grip, hips, and repeat-effort endurance for wrestling, BJJ and judo.",
    description:
      "Grapplers need strength-endurance in awkward positions, a crushing grip, pressing strength for frames and posts, and the ability to repeat " +
      "scrambles. These sessions build exactly that while protecting the neck and lower back with controlled loading.",
    category: "grappling-conditioning",
    types: ["grappling", "mma"],
    difficulty: "intermediate",
    weeks: 4,
    sessionMinutes: 45,
    goals: ["combat_sports", "improve_conditioning"],
    equipment: ["kettlebell", "sandbag", "pull_up_bar", "mat", "barbell", "dumbbell", "landmine"],
    tier: "plus",
    progression: "Conditioning intervals add a round or cut 10 seconds of rest each week; lifts hold at RPE 7–8. Week 4 reduces volume by a third.",
    progressionModel: "density",
    deloadFinalWeek: true,
    warmup: [...CONDITIONING_WARMUP, "Hip escapes × 6 per side"],
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Grip & Pull", "Grip endurance, pulling and pressing strength", [
        R("pull-up", 4, "5-8", 120, { rpe: 7 }),
        R("barbell-row", 3, "8", 90, { rpe: 7 }),
        R("landmine-press", 3, "6-8 per side", 90, { rpe: 7, notes: "Pressing strength for frames and posts." }),
        T("dead-hang", 4, 40, 60),
        T("farmers-carry", 3, 45, 75),
      ]),
      day("Scramble Intervals", "Wrestling conditioning", [
        T("sprawl", 6, 20, 40, { rpe: 8 }),
        T("hip-escape", 6, 30, 30),
        R("kettlebell-swing", 5, "15", 45),
        T("bear-crawl", 4, 30, 30),
        T("neck-isometrics", 2, 15, 30, { notes: "Front, back and each side. Never train through neck pain." }),
      ]),
      day("Hips & Odd Objects", "Hip power and trunk strength", [
        R("sandbag-to-shoulder", 4, "3 per side", 90, { notes: "Swap for kettlebell swings without a sandbag." }),
        R("front-squat", 3, "6", 150, { rpe: 7 }),
        T("sandbag-bear-hug-carry", 3, 40, 75),
        R("push-up", 3, "10-15", 60, { rpe: 7 }),
        T("side-plank", 3, 30, 30),
      ]),
    ],
  },
  {
    slug: "mma-fight-conditioning",
    name: "MMA Fight Conditioning",
    summary: "Strength and energy-system work to support skill training — not replace it.",
    description:
      "Designed to sit alongside 2–4 skill sessions a week. Day 1 builds strength and alactic power, day 2 develops anaerobic capacity with round-based " +
      "intervals, and day 3 builds the aerobic base — MMA's longer rounds lean on the aerobic system more than most combat sports. Keep the hardest " +
      "conditioning away from hard sparring days.",
    category: "mma-conditioning",
    types: ["mma", "athletic", "grappling", "boxing"],
    difficulty: "intermediate",
    weeks: 6,
    sessionMinutes: 50,
    goals: ["combat_sports", "improve_conditioning", "athletic_performance"],
    equipment: ["barbell", "trap_bar", "kettlebell", "medicine_ball", "bike", "jump_rope", "heavy_bag", "pull_up_bar", "mat", "sandbag", "landmine"],
    tier: "plus",
    progression:
      "Glycolytic and aerobic intervals add a round or cut 10–15 seconds of rest each week while output stays consistent. Strength work holds at 2–3 " +
      "reps in reserve, and the 8-second alactic sprints keep their long rests so every rep is maximal. Week 6 tapers for a fight or test.",
    progressionModel: "density",
    deloadFinalWeek: true,
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("S&C 1 — Max Strength + Alactic Power", "Rotational power, heavy pulls, upper strength, neck and short all-out sprints", [
        R("medicine-ball-rotational-throw", 4, "4 per side", 60, { notes: "Hips lead, throw hard, reset between reps." }),
        R("trap-bar-deadlift", 4, "4", 150, { rpe: 7, notes: "Leave 2–3 reps in reserve — no grinding." }),
        R("pull-up", 4, "5-8", 120, { rpe: 7 }),
        R("landmine-press", 3, "6 per side", 90, { rpe: 7 }),
        T("neck-isometrics", 2, 15, 30, { notes: "Front, back and each side. Never train through neck pain." }),
        T("bike-intervals", 6, 8, 90, { notes: "Alactic power: 8 s all-out, 90 s easy. Every rep at max speed." }),
      ]),
      day("S&C 2 — Fight-Pace Rounds + Glycolytic", "5-minute rounds, sprawls and glycolytic intervals", [
        T("heavy-bag-rounds", 3, 300, 60, { rpe: 8, notes: "5-minute MMA rounds with a 10-second flurry every 30 seconds." }),
        T("sprawl", 4, 30, 30),
        T("kettlebell-swing", 4, 30, 30),
        T("bike-intervals", 6, 20, 40, { rpe: 9, notes: "Glycolytic intervals: 20 s hard, 40 s easy. Skip if you spar hard today or tomorrow." }),
      ]),
      day("S&C 3 — Aerobic Base & Grappling Endurance", "Zone 2 engine, mat movement, grip and neck", [
        T("rowing-intervals", 1, 1200, 0, { rpe: 5, notes: "Steady pace: you can speak in full sentences." }),
        T("hip-escape", 4, 45, 30),
        T("bear-crawl", 4, 30, 30),
        T("dead-hang", 3, 40, 60),
        T("sandbag-bear-hug-carry", 3, 40, 60, { notes: "Substitute a heavy goblet hold walk without a sandbag." }),
        T("neck-isometrics", 2, 15, 30, { notes: "Front, back and each side." }),
      ]),
    ],
  },
  {
    slug: "mma-fight-camp-3-day",
    name: "MMA Fight Camp: 8 Weeks (3 Days)",
    summary: "Three S&C sessions a week periodized into a fight: base, specific preparation, peak and fight week.",
    description:
      "Fight-camp S&C that fits around skills and sparring. Weeks 1–3 build a strength base and aerobic power; weeks 4–6 move to heavy triples, " +
      "5-minute fight-pace rounds and glycolytic intervals; week 7 converts strength to power with full fight simulations; fight week is short and sharp. " +
      "Concurrent-training research shows strength work and conditioning can coexist when sessions are separated and lifting stays submaximal — so all " +
      "lifting stops 2 reps short of failure. Weight cuts and rehydration are your coach's and doctor's call.",
    category: "mma-conditioning",
    types: ["mma", "athletic"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 40,
    goals: ["combat_sports", "improve_conditioning", "athletic_performance"],
    equipment: ["trap_bar", "dumbbell", "medicine_ball", "bike", "heavy_bag", "pull_up_bar", "box", "landmine", "band", "mat", "bench"],
    tier: "plus",
    progression:
      "Strength moves from sets of 5 (weeks 1–3) to heavy triples (4–6) to fast doubles (7). Alactic sprints stay at 1:8+ work-to-rest. Glycolytic " +
      "intervals shorten their rests through specific prep, and rounds grow from 3-minute aerobic-power rounds to five 5-minute fight-pace rounds. " +
      "Week 8 is fight week: cut volume by more than half and arrive fresh.",
    progressionModel: "density",
    warmup: MMA_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: fightCampWeeks()[0]!.days,
    weekTemplates: fightCampWeeks(),
  },
  {
    slug: "combat-conditioning-sessions",
    name: "Combat Conditioning Session Library",
    summary: "Six stand-alone sessions — pick 1–2 a week: grappling, wrestling, striking, anaerobic, aerobic and footwork.",
    description:
      "Choose the session that complements your skill training that day. Each one targets a specific quality — don't do them all in one week. Hard " +
      "anaerobic sessions should be 48 hours away from hard sparring.",
    category: "mma-conditioning",
    types: ["mma", "boxing", "grappling"],
    difficulty: "intermediate",
    weeks: 1,
    sessionMinutes: 45,
    goals: ["combat_sports", "improve_conditioning"],
    equipment: ["kettlebell", "sandbag", "pull_up_bar", "mat", "bike", "rower", "jump_rope", "heavy_bag"],
    tier: "plus",
    progression: "Repeat any session weekly, adding a round or reducing rest by 10 seconds when output holds steady.",
    progressionModel: "steady",
    noDeloadReason: "A one-week pick-list of sessions, not a block — use 1–2 a week alongside your main program.",
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Grappling Endurance", "Strength-endurance in grappling positions", [T("hip-escape", 5, 45, 30), T("sandbag-bear-hug-carry", 5, 40, 45), T("dead-hang", 4, 45, 45), T("bear-crawl", 4, 40, 30)]),
      day("Wrestling Conditioning", "Repeated explosive scrambles", [T("sprawl", 8, 20, 40, { rpe: 8 }), R("kettlebell-swing", 6, "12", 30), R("broad-jump", 4, "3", 60)]),
      day("Striking Endurance", "Shoulder and hip endurance at pace", [
        T("heavy-bag-rounds", 6, 180, 60, { rpe: 7 }),
        T("shadowboxing", 2, 180, 60, { notes: "Light hands, sharp footwork." }),
        R("push-up", 3, "12", 45),
      ]),
      day("Anaerobic Intervals", "Glycolytic power and repeat sprints", [T("bike-intervals", 8, 20, 70, { rpe: 9 }), T("medicine-ball-slam", 4, 20, 40), T("burpee", 4, 20, 40)]),
      day("Aerobic Conditioning", "Aerobic base for recovery between rounds", [
        T("rowing-intervals", 3, 600, 90, { rpe: 5, notes: "Nasal breathing pace." }),
        T("jump-rope", 3, 180, 60),
      ]),
      day("Footwork", "Agility, rhythm and balance", [
        T("jump-rope", 4, 120, 45),
        T("lateral-shuffle", 6, 15, 45),
        T("shadowboxing", 3, 120, 60, { notes: "Angle changes and pivots only — light hands." }),
        T("single-leg-balance", 2, 30, 15),
      ]),
    ],
  },
  // =========================================================== Endurance & conditioning
  {
    slug: "aerobic-base-run-walk",
    name: "First 5K: Run/Walk to 30 Minutes",
    summary: "Three run/walk sessions a week take you from walking to 30 minutes of continuous easy running in 8 weeks — about a 5K.",
    description:
      "A gradual run/walk progression for new or returning runners, built like the well-known couch-to-5K plans: week 1 alternates 60 seconds of " +
      "easy running with 90 seconds of walking, and each week the running gets longer. Every run is easy and conversational (zone 2); walking breaks " +
      "are part of the plan, not a failure. Repeat any week that feels too hard — most beginners repeat at least one. A bike or rower can replace any " +
      "session if you need a lower-impact day, and a walk on rest days adds to your weekly activity.",
    category: "cardiovascular",
    types: ["cardio"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: 30,
    goals: ["improve_conditioning", "general_health", "lose_fat"],
    equipment: ["bodyweight"],
    tier: "free",
    progression:
      "Each week the run portions get longer and the walk breaks shorter. Leave at least one rest day between runs. Week 8 starts lighter and ends with " +
      "30 minutes of continuous easy running — roughly a 5K for many runners.",
    progressionModel: "steady",
    noDeloadReason: "Load rises gently each week and you repeat any week that feels too hard, so no separate deload week is needed.",
    warmup: ["5 minutes brisk walking", "Leg swings × 10 each leg", "Ankle circles × 10 each direction"],
    cooldown: ["5 minutes easy walking", "Calf stretch — 30 seconds per side", "Standing quad stretch — 30 seconds per side"],
    days: RUN_WALK_WEEKS[0]!.days,
    weekTemplates: RUN_WALK_WEEKS,
  },
  {
    slug: "lean-and-conditioned",
    name: "Lean & Conditioned",
    summary: "Strength to protect muscle plus sustainable cardio to support fat loss.",
    description:
      "Fat loss is driven mainly by a modest, sustainable calorie deficit; this program supports that with resistance training to maintain muscle and " +
      "a mix of steady and interval cardio. It is not a substitute for medical advice on weight management.",
    category: "weight-loss-cardio",
    types: ["cardio", "strength", "functional"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 40,
    goals: ["lose_fat", "general_health", "improve_conditioning"],
    equipment: ["dumbbell", "bodyweight", "bike", "rower", "band"],
    tier: "plus",
    progression:
      "Steady cardio grows by 5 minutes every other week (30 → 40), intervals add a round a week (6 → 9), and the main lifts go from 3 to 4 sets in " +
      "week 4 — add load when you reach 12 reps. Week 6 is lighter.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: leanWeeks()[0]!.days,
    weekTemplates: leanWeeks(),
  },
  {
    slug: "functional-engine",
    name: "Functional Engine",
    summary: "Varied mixed-modal workouts that build strength and a big engine.",
    description:
      "Inspired by functional fitness training: a strength piece followed by a timed conditioning circuit. Scale every movement to keep good form — " +
      "intensity should never outrun technique.",
    category: "functional-conditioning",
    types: ["functional", "cardio", "strength"],
    difficulty: "intermediate",
    weeks: 4,
    sessionMinutes: 50,
    goals: ["improve_conditioning", "lose_fat", "general_health"],
    equipment: ["barbell", "rack", "kettlebell", "dumbbell", "rower", "box", "pull_up_bar", "jump_rope", "medicine_ball", "bike"],
    tier: "plus",
    progression: "Strength pieces hold full rest and move up to RPE 8; conditioning adds a round or cuts rest each week while form stays sharp. Week 4 is lighter.",
    progressionModel: "density",
    deloadFinalWeek: true,
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Squat + Short Couplet", "Leg strength and intensity", [
        R("front-squat", 5, "5", 150, { rpe: 7 }),
        T("kettlebell-swing", 5, 30, 15, { notes: "Couplet: 30 s swings straight into 30 s burpees." }),
        T("burpee", 5, 30, 60),
      ]),
      day("Engine Builder", "Aerobic intervals", [
        T("rowing-intervals", 5, 240, 90, { rpe: 7 }),
        R("box-jump", 5, "8", 60, { notes: "Step down each rep." }),
        T("jump-rope", 5, 60, 30),
      ]),
      day("Press + Chipper", "Upper strength and work capacity", [
        R("push-press", 5, "3", 150, { rpe: 7 }),
        R("pull-up", 4, "8", 45),
        R("medicine-ball-slam", 4, "15", 45),
        R("walking-lunge", 4, "10 per side", 45),
        T("mountain-climber", 4, 30, 45),
      ]),
      day("Deadlift + Long Grind", "Posterior chain and pacing", [
        R("conventional-deadlift", 4, "4", 180, { rpe: 7 }),
        T("bike-intervals", 1, 900, 0, { rpe: 6, notes: "Steady 15 minutes." }),
        T("farmers-carry", 4, 40, 45),
        T("plank", 3, 45, 30),
      ]),
    ],
  },
  {
    slug: "half-marathon-base-80-20",
    name: "Half Marathon: 80/20 Base to Race",
    summary: "Twelve weeks, four runs a week: about 80% easy running, one quality session, a growing long run and two cutback weeks.",
    description:
      "Built on the polarized (80/20) intensity distribution that Stephen Seiler and others observed in successful endurance athletes: most running " +
      "is easy enough to talk, and one session a week is genuinely hard — hills, then threshold intervals, then race-pace work. The long run grows from " +
      "60 to about 105 minutes with cutback weeks in weeks 4 and 8, then a race-week taper. Best for runners who can already run 30–40 minutes. Two " +
      "short strength sessions a week (calf raises and single-leg work are included on easy days) help economy and injury resilience.",
    category: "cardiovascular",
    types: ["cardio"],
    difficulty: "intermediate",
    weeks: 12,
    sessionMinutes: 55,
    goals: ["improve_conditioning", "general_health"],
    equipment: ["bodyweight", "dumbbell"],
    tier: "plus",
    progression:
      "The long run adds 5–10 minutes most weeks; easy runs grow from 35 to 50 minutes. Quality sessions move from 6 × 60 s hills (weeks 1–3) to " +
      "3 × 8 min threshold (5–7) to 3 × 15 min at half-marathon pace (9–11). Weeks 4 and 8 cut back by about 25%. If a week leaves you unusually " +
      "tired or sore, repeat it rather than pushing on.",
    progressionModel: "steady",
    warmup: RUN_WARMUP,
    cooldown: ["5 minutes easy walking", "Calf stretch — 30 seconds per side", "Standing quad stretch — 30 seconds per side"],
    days: halfMarathonWeeks()[0]!.days,
    weekTemplates: halfMarathonWeeks(),
  },
  // =========================================================== Speed & agility
  {
    slug: "agility-footwork",
    name: "Agility & Footwork",
    summary: "Ladder footwork, cone drills, reactive work and lateral plyometrics for quicker cuts.",
    description:
      "Three sessions per week to move faster in any direction. Planned change-of-direction drills teach deceleration and re-acceleration; reactive " +
      "drills train you to read and respond — which matters most in real sport. Cones can be any markers, and the ladder can be taped or chalked on the floor.",
    category: "agility",
    types: ["athletic"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: 35,
    goals: ["athletic_performance"],
    equipment: ["bodyweight", "dumbbell", "box", "band"],
    tier: "free",
    progression:
      "Cone drills add a rep every two weeks (4 → 6) while every rep stays sharp; rest stays long enough (60–90 s) that each rep is fast. Week 6 reduces " +
      "volume — time your 5-10-5 at the end of it.",
    progressionModel: "steady",
    warmup: SPRINT_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: agilityWeeks()[0]!.days,
    weekTemplates: agilityWeeks(),
  },
  {
    slug: "speed-development",
    name: "Speed Development",
    summary: "Sprint mechanics, acceleration and max velocity with plyometrics and strength — always fully recovered.",
    description:
      "Three sessions a week to get faster: an acceleration day, a max-velocity day and a strength/power day. Speed is trained fresh with full rest " +
      "between reps (2–5 minutes) — if a rep feels slower, the session is done. Nordic curls are included because eccentric hamstring work is linked " +
      "to fewer hamstring strains. Find a flat track or field.",
    category: "speed",
    types: ["athletic"],
    difficulty: "intermediate",
    weeks: 6,
    sessionMinutes: 45,
    goals: ["athletic_performance"],
    equipment: ["bodyweight", "barbell", "rack", "dumbbell", "box"],
    tier: "plus",
    progression:
      "Accelerations add a rep each week (5 → 8) and lengthen from 10 m to 30 m; flying sprints go from 3 to 5. Never trade rest for volume. Week 6 " +
      "halves volume to let speed show up — time a 10 m and 30 m sprint at the end of it.",
    progressionModel: "steady",
    warmup: SPRINT_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: speedWeeks()[0]!.days,
    weekTemplates: speedWeeks(),
  },
  {
    slug: "athletic-power-development",
    name: "Explosive Athletic Power",
    summary: "Jump higher, sprint faster, and stay resilient with power-first training.",
    description:
      "Each session starts with low-volume, high-quality power work while you are fresh, then builds strength and finishes with rotational and " +
      "single-leg work. Suitable for field and court athletes and anyone who wants to move explosively.",
    category: "athletic-performance",
    types: ["athletic", "strength"],
    difficulty: "intermediate",
    weeks: 6,
    sessionMinutes: 50,
    goals: ["athletic_performance", "build_strength"],
    equipment: ["barbell", "rack", "box", "medicine_ball", "dumbbell", "kettlebell", "trap_bar", "pull_up_bar", "landmine"],
    tier: "plus",
    progression:
      "Power work stays at low, constant contacts — quality beats quantity, so stop a set when speed drops. Strength lifts follow RPE progression " +
      "(7 → 9 by week 5, capped at RPE 9). Week 6 deloads.",
    progressionModel: "linear_rpe",
    deloadFinalWeek: true,
    warmup: [...CONDITIONING_WARMUP, "Ankle knee-to-wall × 10 per side"],
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Lower Power", "Vertical and horizontal power", [
        R("box-jump", 4, "3", 90, { notes: "Full reset between reps." }),
        R("trap-bar-deadlift", 4, "4", 180, { rpe: 7, notes: "Move the bar fast." }),
        R("bulgarian-split-squat", 3, "6 per side", 90, { rpe: 7 }),
        R("medicine-ball-rotational-throw", 3, "5 per side", 60),
      ]),
      day("Upper Power", "Pressing power and pulling strength", [
        R("medicine-ball-slam", 4, "5", 60),
        R("push-press", 4, "3", 150, { rpe: 7 }),
        R("pull-up", 4, "5-8", 120, { rpe: 7 }),
        R("landmine-press", 3, "6 per side", 90, { rpe: 7 }),
        R("pallof-press", 3, "10 per side", 45),
      ]),
      day("Total Body Athleticism", "Olympic-derivative power and resilience", [
        R("broad-jump", 4, "3", 90),
        R("power-clean", 5, "2", 150, { notes: "Swap for kettlebell swings if you haven't been coached on the clean." }),
        R("front-squat", 3, "5", 150, { rpe: 7 }),
        R("single-leg-rdl", 3, "8 per side", 75),
        T("lateral-shuffle", 4, 15, 45),
      ]),
    ],
  },
  {
    slug: "athletic-qualities-sessions",
    name: "Athletic Qualities Session Library",
    summary: "Four focused sessions — pick 1–2 a week: explosive power, rotational core, grip endurance, sport-specific strength.",
    description: "Plug-in sessions to target a specific athletic quality. Use one or two per week alongside your sport or main program.",
    category: "athletic-performance",
    types: ["athletic", "mma", "strength"],
    difficulty: "intermediate",
    weeks: 1,
    sessionMinutes: 40,
    goals: ["athletic_performance", "combat_sports"],
    equipment: ["barbell", "medicine_ball", "box", "cable", "band", "pull_up_bar", "dumbbell", "kettlebell", "trap_bar", "landmine"],
    tier: "plus",
    progression: "Power: stop sets when speed drops. Strength: RPE progression. Grip: add 5 seconds per hold weekly.",
    progressionModel: "steady",
    noDeloadReason: "A one-week pick-list of sessions, not a block — use 1–2 a week alongside your main program.",
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: [
      day("Explosive Power", "Rate of force development", [R("box-jump", 5, "3", 90), R("medicine-ball-slam", 4, "5", 60), R("push-press", 4, "3", 120, { rpe: 7 }), R("broad-jump", 3, "3", 90)]),
      day("Rotational Core Strength", "Hip-to-hand force transfer", [
        R("medicine-ball-rotational-throw", 4, "5 per side", 60),
        R("cable-woodchop", 3, "10 per side", 45),
        R("pallof-press", 3, "10 per side", 45),
        T("side-plank", 3, 30, 30),
      ]),
      day("Grip Endurance", "Crush and support grip", [
        T("dead-hang", 4, 40, 60),
        T("farmers-carry", 4, 45, 75),
        R("hammer-curl", 3, "12", 60),
        T("suitcase-carry", 2, 40, 60, { notes: "Per side." }),
      ]),
      day("Sport-Specific Strength", "Unilateral and posterior chain strength", [
        R("trap-bar-deadlift", 4, "4", 150, { rpe: 7 }),
        R("bulgarian-split-squat", 3, "6 per side", 90, { rpe: 7 }),
        R("single-leg-rdl", 3, "8 per side", 75),
        R("landmine-press", 3, "8 per side", 75),
        R("chin-up", 3, "6-8", 90),
      ]),
    ],
  },
];

export function getProgramSeed(slug: string): ProgramSeed | undefined {
  return PROGRAMS.find((p) => p.slug === slug);
}
