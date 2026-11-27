import type { ProgramDaySeed, ProgramSeed, ProgramWeekSeed } from "../programs";
import { CONDITIONING_WARMUP, R, STANDARD_COOLDOWN, STANDARD_WARMUP, T, day } from "../program-builders";

/** Pro catalog additions (2026-11). Slugs are permanent. */

const meanMinutes = (days: ProgramDaySeed[]) => Math.round(days.reduce((s, d) => s + d.minutes, 0) / days.length / 5) * 5;

// --------------------------------------------------------------------------- 1. Beginner Strength Foundations

/**
 * Eight weeks, three full-body days. Reps come down (8 → 6 → 5) while reps in reserve shrink from about 4 to about 2,
 * a planned lighter week 5 consolidates technique, and week 8 tests a new 5-rep best with 1–2 reps still in reserve.
 */
interface BeginnerWeek {
  focus: string;
  /** Squat, bench and overhead press. */
  main: { sets: number; reps: string; rpe: number };
  dl: { sets: number; reps: string; rpe: number };
  /** Rows, pulldowns and chin-ups. */
  pull: { sets: number; reps: string };
  /** Plank hold in seconds. */
  core: { sets: number; secs: number };
  deload?: boolean;
  test?: boolean;
}

const BEGINNER_WEEKS: BeginnerWeek[] = [
  {
    focus: "Week 1 — learn the lifts: sets of 8 with about 4 reps in reserve; start light and find your working weights",
    main: { sets: 3, reps: "8", rpe: 6 },
    dl: { sets: 2, reps: "5", rpe: 6 },
    pull: { sets: 3, reps: "10" },
    core: { sets: 3, secs: 20 },
  },
  {
    focus: "Week 2 — same sets of 8, about 3 reps in reserve: add a small amount of weight each session",
    main: { sets: 3, reps: "8", rpe: 7 },
    dl: { sets: 3, reps: "5", rpe: 6.5 },
    pull: { sets: 3, reps: "10" },
    core: { sets: 3, secs: 25 },
  },
  {
    focus: "Week 3 — move to 4 sets of 6: about 5% heavier than your week 2 sets of 8, 3 reps in reserve",
    main: { sets: 4, reps: "6", rpe: 7 },
    dl: { sets: 3, reps: "5", rpe: 7 },
    pull: { sets: 3, reps: "8" },
    core: { sets: 3, secs: 30 },
  },
  {
    focus: "Week 4 — 4 sets of 6 with 2–3 reps in reserve: keep adding small jumps while every rep looks the same",
    main: { sets: 4, reps: "6", rpe: 7.5 },
    dl: { sets: 3, reps: "5", rpe: 7.5 },
    pull: { sets: 4, reps: "8" },
    core: { sets: 3, secs: 35 },
  },
  {
    focus: "Lighter week — half the sets at about 90% of week 4's weights; polish technique before the sets of 5",
    main: { sets: 2, reps: "6", rpe: 6 },
    dl: { sets: 2, reps: "5", rpe: 6 },
    pull: { sets: 2, reps: "8" },
    core: { sets: 2, secs: 30 },
    deload: true,
  },
  {
    focus: "Week 6 — sets of 5: start about 5% heavier than week 4, about 2–3 reps in reserve",
    main: { sets: 4, reps: "5", rpe: 7.5 },
    dl: { sets: 3, reps: "3", rpe: 7.5 },
    pull: { sets: 4, reps: "8" },
    core: { sets: 3, secs: 40 },
  },
  {
    focus: "Week 7 — the heaviest week: sets of 5 with about 2 reps in reserve; repeat a weight rather than grind",
    main: { sets: 4, reps: "5", rpe: 8 },
    dl: { sets: 3, reps: "3", rpe: 8 },
    pull: { sets: 4, reps: "6-8" },
    core: { sets: 3, secs: 45 },
  },
  {
    focus: "Test week — one top set of 5 on each lift for a new 5-rep best, stopping with 1–2 reps still in reserve",
    main: { sets: 1, reps: "5", rpe: 8.5 },
    dl: { sets: 1, reps: "5", rpe: 8.5 },
    pull: { sets: 2, reps: "8" },
    core: { sets: 2, secs: 30 },
    test: true,
  },
];

function beginnerWeeks(): ProgramWeekSeed[] {
  return BEGINNER_WEEKS.map((w, i) => {
    const restMain = w.main.reps === "8" ? 150 : 180;
    const mainNote = w.test
      ? "Test: ramp up in 4–6 warm-up sets, then one set of 5 that leaves 1–2 good reps in the tank. A new 5-rep best that moves well is the goal — no grinders."
      : w.deload
        ? "Lighter week: about 90% of last week's weights, every rep crisp."
        : i === 0
          ? "Start with the empty bar and add weight each warm-up set until a set of 8 feels like 4 reps were left. That's your working weight."
          : "Every rep made with the target reps in reserve? Add the smallest jump next session (2.5 kg / 5 lb lower body, 1–2.5 kg / 2.5–5 lb upper body).";
    const main = (ex: string, extra = "") => R(ex, w.main.sets, w.main.reps, restMain, { rpe: w.main.rpe, notes: `${mainNote}${extra}` });
    const dlNote = w.test
      ? "Test: one smooth set of 5 after 4–5 warm-ups. Reset each rep on the floor."
      : w.deload
        ? "Lighter week: about 90% of last week's weight."
        : "Reset each rep on the floor. All reps clean? Add 2.5–5 kg / 5–10 lb next week.";
    const pulls = w.pull.reps;
    const plank = T("plank", w.core.sets, w.core.secs, 45, { notes: "Squeeze glutes, ribs down, breathe behind the brace." });
    const days = [
      day("Day A — Squat & Bench", "Squat and bench press, rows", [
        main("back-squat", " Depth you can control, bar over mid-foot."),
        main("bench-press"),
        R("barbell-row", w.pull.sets, pulls, 90, { rpe: 7, notes: "Torso about 45°, pull to the lower ribs. Add weight when every set hits the top reps." }),
        plank,
      ]),
      day("Day B — Deadlift & Press", "Deadlift and overhead press, pulldowns", [
        R("conventional-deadlift", w.dl.sets, w.dl.reps, 180, { rpe: w.dl.rpe, notes: dlNote }),
        main("overhead-press", " Squeeze glutes and keep ribs down; press the bar back over mid-foot."),
        R("lat-pulldown", w.pull.sets, pulls, 90, { rpe: 7, notes: "Pull the bar to the top of the chest. Builds toward chin-ups." }),
        R("dead-bug", w.core.sets, "8 per side", 45, { notes: "Slow: 3 seconds out, lower back stays down." }),
      ]),
      day("Day C — Squat, Bench & Chin-ups", "Second squat and bench day, chin-ups and lower back", [
        main("back-squat"),
        main("bench-press", " Feet planted, shoulder blades pinched, touch the lower chest."),
        R("chin-up", w.pull.sets, w.test ? "AMRAP" : "3-6", 120, {
          notes: w.test
            ? "Test: one set of as many clean reps as you can, then one easy set."
            : "Can't do 3 yet? Do slow 5-second lowering reps from the top instead. Add a rep a week; add weight once every set reaches 6.",
        }),
        R("back-extension", w.core.sets, "10", 60, { notes: "Hips on the pad; lift to a straight line, no over-arching." }),
      ]),
    ];
    const out: ProgramWeekSeed = { focus: w.focus, days };
    if (w.deload) out.isDeload = true;
    return out;
  });
}

const BEGINNER = beginnerWeeks();

// --------------------------------------------------------------------------- 2. Intermediate Strength Builder

/**
 * Twelve weeks of upper/lower in three 4-week waves on a training max (TM = 90% of 1RM): accumulate (sets of 8),
 * intensify (5s and 4s), realize (3s and 2s). Weeks 4 and 8 deload; week 12 is a lighter week with one top-set test.
 */
type Scheme = { sets: number; reps: string; p?: number; rpe: number };
interface WaveWeek {
  focus: string;
  phase: "acc" | "int" | "real" | "deload" | "test";
  main: Scheme;
  dl: Scheme;
  /** Secondary barbell lifts (RDL, front squat, close-grip bench, row). */
  sec: Scheme;
  /** Accessories. */
  acc: { sets: number; reps: string };
}

const WAVE_WEEKS: WaveWeek[] = [
  {
    focus: "Wave 1 (accumulate), week 1 — sets of 8 at 65% of your training max, about 3–4 reps in reserve",
    phase: "acc",
    main: { sets: 4, reps: "8", p: 65, rpe: 6.5 },
    dl: { sets: 3, reps: "6", p: 65, rpe: 6.5 },
    sec: { sets: 3, reps: "10", rpe: 7 },
    acc: { sets: 3, reps: "12" },
  },
  {
    focus: "Wave 1, week 2 — 5 sets of 8 at 70% TM: more volume, still 3 reps in reserve",
    phase: "acc",
    main: { sets: 5, reps: "8", p: 70, rpe: 7 },
    dl: { sets: 4, reps: "6", p: 70, rpe: 7 },
    sec: { sets: 3, reps: "10", rpe: 7.5 },
    acc: { sets: 3, reps: "12" },
  },
  {
    focus: "Wave 1, week 3 — peak volume: 5 sets of 8 at 72.5% TM, about 2–3 reps in reserve",
    phase: "acc",
    main: { sets: 5, reps: "8", p: 72.5, rpe: 7.5 },
    dl: { sets: 4, reps: "6", p: 72.5, rpe: 7.5 },
    sec: { sets: 4, reps: "10", rpe: 8 },
    acc: { sets: 4, reps: "12" },
  },
  {
    focus: "Deload — 3 easy sets of 5 at 60% TM and fewer accessory sets before the heavier wave",
    phase: "deload",
    main: { sets: 3, reps: "5", p: 60, rpe: 5 },
    dl: { sets: 2, reps: "5", p: 60, rpe: 5 },
    sec: { sets: 2, reps: "8", rpe: 6 },
    acc: { sets: 2, reps: "12" },
  },
  {
    focus: "Wave 2 (intensify), week 1 — sets of 5 at 77.5% TM, about 3 reps in reserve",
    phase: "int",
    main: { sets: 5, reps: "5", p: 77.5, rpe: 7 },
    dl: { sets: 4, reps: "4", p: 77.5, rpe: 7 },
    sec: { sets: 4, reps: "6", rpe: 7 },
    acc: { sets: 3, reps: "10" },
  },
  {
    focus: "Wave 2, week 2 — sets of 5 at 82.5% TM, about 2–3 reps in reserve",
    phase: "int",
    main: { sets: 5, reps: "5", p: 82.5, rpe: 7.5 },
    dl: { sets: 4, reps: "4", p: 82.5, rpe: 7.5 },
    sec: { sets: 4, reps: "6", rpe: 7.5 },
    acc: { sets: 3, reps: "10" },
  },
  {
    focus: "Wave 2, week 3 — heavier sets of 4 at 87.5% TM, about 2 reps in reserve",
    phase: "int",
    main: { sets: 4, reps: "4", p: 87.5, rpe: 8 },
    dl: { sets: 3, reps: "3", p: 87.5, rpe: 8 },
    sec: { sets: 4, reps: "6", rpe: 8 },
    acc: { sets: 3, reps: "10" },
  },
  {
    focus: "Deload — 3 light triples at 65% TM; recover before the heavy wave",
    phase: "deload",
    main: { sets: 3, reps: "3", p: 65, rpe: 5 },
    dl: { sets: 2, reps: "3", p: 65, rpe: 5 },
    sec: { sets: 2, reps: "6", rpe: 6 },
    acc: { sets: 2, reps: "10" },
  },
  {
    focus: "Wave 3 (realize), week 1 — triples at 87.5% TM, about 2–3 reps in reserve",
    phase: "real",
    main: { sets: 5, reps: "3", p: 87.5, rpe: 7.5 },
    dl: { sets: 4, reps: "3", p: 87.5, rpe: 7.5 },
    sec: { sets: 3, reps: "5", rpe: 7.5 },
    acc: { sets: 3, reps: "8" },
  },
  {
    focus: "Wave 3, week 2 — triples at 92.5% TM, about 2 reps in reserve; volume starts to come down",
    phase: "real",
    main: { sets: 4, reps: "3", p: 92.5, rpe: 8 },
    dl: { sets: 3, reps: "2", p: 92.5, rpe: 8 },
    sec: { sets: 3, reps: "5", rpe: 8 },
    acc: { sets: 3, reps: "8" },
  },
  {
    focus: "Wave 3, week 3 — the heaviest work: doubles at 97.5% TM, 1–2 reps in reserve",
    phase: "real",
    main: { sets: 3, reps: "2", p: 97.5, rpe: 8.5 },
    dl: { sets: 2, reps: "2", p: 97.5, rpe: 8.5 },
    sec: { sets: 2, reps: "5", rpe: 7.5 },
    acc: { sets: 2, reps: "8" },
  },
  {
    focus: "Test week — light volume and one top set of 3 on each main lift at about RPE 9 (one rep left), not a true max",
    phase: "test",
    main: { sets: 1, reps: "3", rpe: 9 },
    dl: { sets: 1, reps: "3", rpe: 9 },
    sec: { sets: 2, reps: "5", rpe: 6.5 },
    acc: { sets: 2, reps: "10" },
  },
];

function waveWeeks(): ProgramWeekSeed[] {
  return WAVE_WEEKS.map((w, i) => {
    const deload = w.phase === "deload";
    const testNote =
      "Test: build up in 4–6 warm-up sets (about 50/65/75/85/92% of your TM) to one set of 3 that leaves about one rep in reserve. Estimated 1RM ≈ weight × 1.1; your next TM is 90% of that.";
    const tmNote =
      i === 0
        ? "TM = training max, 90% of your 1RM (see instructions). If the RPE runs more than 1 point above target, lower the TM 5% and continue."
        : deload
          ? "Deload: easy, fast reps."
          : "Percentages are of your TM. If a set runs more than 1 RPE above target, repeat that load next week instead of moving up.";
    const mainLift = (ex: string, s: Scheme, rest: number) =>
      w.phase === "test"
        ? R(ex, 1, s.reps, rest, { intensity: "top set ≈ 100–105% TM", rpe: s.rpe, notes: testNote })
        : R(ex, s.sets, s.reps, rest, { intensity: `${s.p}% TM`, rpe: s.rpe, notes: tmNote });
    const sec = (ex: string, note: string) => R(ex, w.sec.sets, w.sec.reps, 150, { rpe: w.sec.rpe, notes: note });
    const acc = (ex: string, reps: string, rest: number, note?: string) => R(ex, w.acc.sets, reps, rest, { rpe: deload ? 6 : 8, ...(note ? { notes: note } : {}) });
    const days = [
      day("Lower A — Squat", "Back squat, Romanian deadlift, single-leg work", [
        mainLift("back-squat", w.main, 210),
        sec("romanian-deadlift", "Hinge until the hamstrings stop you; bar close to the legs. Choose a weight that leaves the target reps in reserve."),
        acc("walking-lunge", w.acc.reps === "12" ? "10 per side" : w.acc.reps === "10" ? "8 per side" : "6 per side", 90, "Dumbbells at your sides; add load when every set is smooth."),
        R("hanging-knee-raise", w.acc.sets, "10-15", 60, { notes: "Curl the pelvis up; no swinging." }),
      ]),
      day("Upper A — Bench", "Bench press, rows, overhead and chin-ups", [
        mainLift("bench-press", w.main, 180),
        sec("barbell-row", "Torso about 45°, pull to the lower ribs, pause briefly."),
        acc("seated-dumbbell-shoulder-press", w.acc.reps, 90),
        R("chin-up", w.acc.sets, w.phase === "real" ? "4-6" : "6-10", 90, {
          rpe: deload ? 6 : 8,
          notes: "Add weight once every set reaches the top of the range.",
        }),
      ]),
      day("Lower B — Deadlift", "Deadlift, front squat, split squat and trunk", [
        mainLift("conventional-deadlift", w.dl, 240),
        sec("front-squat", "Elbows high, upright torso. Kept a step lighter than the back squat on purpose."),
        acc("bulgarian-split-squat", w.acc.reps === "12" ? "10 per side" : w.acc.reps === "10" ? "8 per side" : "6 per side", 90),
        R("ab-wheel-rollout", w.acc.sets, "8-12", 60, { notes: "Roll out only as far as you can keep the lower back from sagging." }),
      ]),
      day("Upper B — Press", "Overhead press, close-grip bench, pulldowns and upper back", [
        mainLift("overhead-press", w.main, 180),
        sec("close-grip-bench-press", "Hands about shoulder-width; elbows tucked."),
        acc("lat-pulldown", w.acc.reps, 90),
        acc("face-pull", "15-20", 45, "Pull to the forehead, thumbs back."),
      ]),
    ];
    const out: ProgramWeekSeed = { focus: w.focus, days };
    if (deload) out.isDeload = true;
    return out;
  });
}

const WAVES = waveWeeks();

// --------------------------------------------------------------------------- 7. Power and Athletic Strength

/**
 * Ten weeks, three days. Each session opens with a small dose of jumps, throws or cleans at full rest while fresh,
 * then strength lifts. Phase 1 (weeks 1–4) builds strength with sets of 6 → 4; week 5 deloads; phase 2 (weeks 6–9)
 * goes heavier on the lifts and lower-rep, higher-intent on power; week 10 tests jumps, throws and a top set.
 */
interface PowerWeek {
  focus: string;
  /** Jumps and throws: sets × reps; intent rises (higher box, heavier ball or bar, farther target). */
  power: { sets: number; reps: number };
  clean: { sets: number; reps: string; rpe: number };
  strength: { sets: number; reps: string; rpe: number };
  /** Nordics, split squats, rows. */
  support: { sets: number; reps: string };
  /** Isometric holds in seconds. */
  hold: number;
  deload?: boolean;
  test?: boolean;
}

const POWER_WEEKS: PowerWeek[] = [
  {
    focus: "Phase 1, week 1 — learn the rhythm: 3 sets of 3 jumps and throws at full rest; lifts at sets of 6, about 3 reps in reserve",
    power: { sets: 3, reps: 3 },
    clean: { sets: 4, reps: "3", rpe: 6 },
    strength: { sets: 4, reps: "6", rpe: 7 },
    support: { sets: 2, reps: "6 per side" },
    hold: 15,
  },
  {
    focus: "Phase 1, week 2 — same power dose with more intent (higher box, heavier ball); lifts at sets of 5",
    power: { sets: 3, reps: 3 },
    clean: { sets: 4, reps: "3", rpe: 6.5 },
    strength: { sets: 4, reps: "5", rpe: 7.5 },
    support: { sets: 3, reps: "6 per side" },
    hold: 20,
  },
  {
    focus: "Phase 1, week 3 — one more power set; 5 sets of 5 on the lifts",
    power: { sets: 4, reps: 3 },
    clean: { sets: 5, reps: "2", rpe: 7 },
    strength: { sets: 5, reps: "5", rpe: 7.5 },
    support: { sets: 3, reps: "8 per side" },
    hold: 20,
  },
  {
    focus: "Phase 1, week 4 — heaviest week of the phase: sets of 4 at about 2 reps in reserve",
    power: { sets: 4, reps: 3 },
    clean: { sets: 5, reps: "2", rpe: 7.5 },
    strength: { sets: 5, reps: "4", rpe: 8 },
    support: { sets: 3, reps: "8 per side" },
    hold: 25,
  },
  {
    focus: "Deload — two easy power sets and about 60% of the lifting volume; stay snappy",
    power: { sets: 2, reps: 3 },
    clean: { sets: 3, reps: "2", rpe: 5 },
    strength: { sets: 2, reps: "4", rpe: 6 },
    support: { sets: 2, reps: "6 per side" },
    hold: 20,
    deload: true,
  },
  {
    focus: "Phase 2, week 1 — heavier strength (sets of 4) and 4 × 3 power work with a heavier ball or bar",
    power: { sets: 4, reps: 3 },
    clean: { sets: 5, reps: "2", rpe: 7.5 },
    strength: { sets: 4, reps: "4", rpe: 8 },
    support: { sets: 3, reps: "6 per side" },
    hold: 25,
  },
  {
    focus: "Phase 2, week 2 — power drops to doubles for maximal intent; lifts at 5 × 3",
    power: { sets: 5, reps: 2 },
    clean: { sets: 6, reps: "2", rpe: 8 },
    strength: { sets: 5, reps: "3", rpe: 8 },
    support: { sets: 3, reps: "6 per side" },
    hold: 30,
  },
  {
    focus: "Phase 2, week 3 — heaviest lifting of the program: 5 × 3 at 1–2 reps in reserve; heavy clean singles",
    power: { sets: 5, reps: 2 },
    clean: { sets: 6, reps: "1", rpe: 8 },
    strength: { sets: 5, reps: "3", rpe: 8.5 },
    support: { sets: 3, reps: "5 per side" },
    hold: 30,
  },
  {
    focus: "Phase 2, week 4 — volume comes down so you arrive fresh for testing: crisp doubles, fewer sets",
    power: { sets: 3, reps: 2 },
    clean: { sets: 4, reps: "1", rpe: 7 },
    strength: { sets: 3, reps: "2", rpe: 8 },
    support: { sets: 2, reps: "5 per side" },
    hold: 25,
  },
  {
    focus: "Test week — best of 3 attempts on the broad jump and throws, a heavy clean double and one top set of 3 on each lift",
    power: { sets: 3, reps: 1 },
    clean: { sets: 1, reps: "2", rpe: 8.5 },
    strength: { sets: 1, reps: "3", rpe: 9 },
    support: { sets: 2, reps: "5 per side" },
    hold: 20,
    test: true,
  },
];

function powerWeeks(): ProgramWeekSeed[] {
  return POWER_WEEKS.map((w) => {
    const pReps = `${w.power.reps}`;
    const pSide = `${w.power.reps} per side`;
    const powerNote = w.test
      ? "Test: one rep per set, full rest, best attempt counts. Record it."
      : w.deload
        ? "Deload: easy, crisp reps."
        : "Every rep at full intent with a full reset; stop the set if speed or height drops.";
    const strengthNote = w.test
      ? "Test: ramp up in 4–6 warm-up sets to one set of 3 with about one rep in reserve. Record it."
      : w.deload
        ? "Deload: about 85–90% of last week's weights, every rep fast."
        : "Choose the weight from the target reps in reserve; move it fast. Beat last week's load or bar speed, never by grinding.";
    const lift = (ex: string, sets = w.strength.sets, extra = "") => R(ex, Math.max(1, sets), w.strength.reps, 180, { rpe: w.strength.rpe, notes: `${strengthNote}${extra}` });
    const days = [
      day(
        "Day 1 — Lower Power & Squat",
        "Box jumps and trap-bar jumps, then back squat and hamstrings",
        [
          R("box-jump", w.power.sets, pReps, 90, { notes: `${powerNote} Step down; land softly in the same position you took off from.` }),
          R("trap-bar-jump", w.power.sets, pReps, 120, {
            notes: `${powerNote} Light load only: one you can jump with as high as a bodyweight jump minus a little. Land with soft knees.`,
          }),
          lift("back-squat"),
          R("nordic-hamstring-curl", w.support.sets, w.support.reps.startsWith("8") ? "5" : w.support.reps.startsWith("5") ? "3" : "4", 90, {
            notes: "Lower as slowly as you can control, catch yourself with your hands, push back up.",
          }),
          T("copenhagen-plank", 2, w.hold, 45, { notes: "Per side. Short-lever version (knee on the bench) to start." }),
        ],
        { warmup: [...CONDITIONING_WARMUP, "Pogo hops × 10 and 2 practice jumps at half effort"] },
      ),
      day(
        "Day 2 — Upper Power & Press/Pull",
        "Medicine-ball throws, then bench press, pull-ups and rows",
        [
          R("medicine-ball-shot-put", w.power.sets, pSide, 75, { notes: `${powerNote} Drive from the back leg and hip; catch or retrieve and reset each throw.` }),
          lift("bench-press", w.strength.sets, " Lower under control, press fast."),
          w.test
            ? R("pull-up", 1, "AMRAP", 120, { notes: "Test: one set of as many clean reps as you can, stopping before form breaks." })
            : R("pull-up", w.strength.sets, w.strength.reps === "6" ? "6" : "4-6", 120, {
                rpe: Math.min(8.5, w.strength.rpe),
                notes: "Add weight once every set is easy at the top of the range.",
              }),
          R("one-arm-dumbbell-row", w.support.sets, w.support.reps.replace(/\d+/, (n) => `${Number(n) + 2}`), 75, { rpe: 8 }),
          T("side-plank", 2, w.hold + 10, 45, { notes: "Per side; long straight line from head to heel." }),
        ],
        { warmup: [...STANDARD_WARMUP.slice(0, 4), "2 light medicine-ball throws per side at half effort"] },
      ),
      day(
        "Day 3 — Olympic Derivative & Hinge",
        "Broad jumps, scoop tosses and power cleans, then trap-bar deadlift and split squats",
        [
          R("broad-jump", w.power.sets, pReps, 90, { notes: `${powerNote} Stick each landing for a second; walk back.` }),
          R("medicine-ball-scoop-toss", w.power.sets, pSide, 75, { notes: `${powerNote} Hinge, then throw up and back off the hips.` }),
          R("power-clean", w.clean.sets, w.clean.reps, 150, {
            rpe: w.clean.rpe,
            notes: w.test
              ? "Test: work up to a heavy double that is still fast and technically clean. Record it."
              : "From the floor; the bar should feel fast, not heavy. Not coached on the clean? Do an extra 3 sets of trap-bar jumps instead.",
          }),
          lift("trap-bar-deadlift", w.test ? 1 : w.strength.sets - 1, " Drive the floor away; lock out with the glutes."),
          R("bulgarian-split-squat", w.support.sets, w.support.reps, 90, { rpe: w.deload ? 6 : 7.5, notes: "Dumbbells at your sides; add load when every set is smooth." }),
        ],
        { warmup: [...CONDITIONING_WARMUP, "Empty-bar clean drill × 2 sets of 5 (hang, then floor)"] },
      ),
    ];
    const out: ProgramWeekSeed = { focus: w.focus, days };
    if (w.deload) out.isDeload = true;
    return out;
  });
}

const POWER = powerWeeks();

// --------------------------------------------------------------------------- Catalog

export const CATALOG_STRENGTH: ProgramSeed[] = [
  {
    slug: "beginner-strength-foundations-8-week",
    name: "Beginner Strength Foundations",
    summary: "For beginners who'd rather progress by effort than add weight every session: learn the squat, bench, deadlift, press, rows and chin-ups, then test a new 5-rep best.",
    description:
      "Goal: get measurably stronger on the basic barbell lifts while learning to judge effort. Focus: squat and bench twice a week, deadlift and " +
      "overhead press once, rows, pulldowns and chin-ups every session. Reps come down from 8 to 6 to 5 while the reps you keep in reserve shrink " +
      "from about four to about two, so weight goes up steadily without grinding. Week 5 is a planned lighter week and week 8 tests a new 5-rep best " +
      "on each lift with a rep or two still in the tank. For new lifters, or anyone returning after a long break, who wants a structured start that " +
      "teaches effort control instead of adding a fixed amount every session.",
    category: "strength",
    types: ["strength"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: meanMinutes(BEGINNER[0]!.days),
    goals: ["build_strength", "general_health"],
    equipment: ["barbell", "rack", "bench", "pull_up_bar", "cable", "mat"],
    tier: "pro",
    progression:
      "Effort-driven linear progression. Each session, if every work set was completed with at least the target reps in reserve, add the smallest " +
      "jump next time: about 2.5 kg / 5 lb on squats, 2.5–5 kg / 5–10 lb on deadlifts and 1–2.5 kg / 2.5–5 lb on bench, press and rows. If a set " +
      "felt harder than the target, keep the weight. Missed reps: repeat the weight next session. Miss the same weight twice in a row: reset that " +
      "lift about 10% lighter and build back up. When the reps drop (8 → 6 in week 3, 6 → 5 in week 6), start about 5% heavier than your last sets. " +
      "Week 5 is a lighter week at about 90% of week 4's weights; week 8 is a 5-rep test with 1–2 reps in reserve.",
    progressionModel: "linear_rpe",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: BEGINNER[0]!.days,
    weekTemplates: BEGINNER,
    milestones: [
      "Completed all three sessions and found a starting weight for every lift that left about 4 reps in reserve.",
      "Added weight on each lift at least once while keeping about 3 reps in reserve.",
      "Moved to 4 × 6 about 5% heavier than week 2's sets of 8 with consistent technique.",
      "Finished 4 × 6 on every lift at 2–3 reps in reserve, or reset any lift that stalled twice.",
      "Completed the lighter week with every rep crisp — ready for sets of 5.",
      "Started 4 × 5 about 5% heavier than week 4, deadlift triples moving well.",
      "Completed the heaviest week at about 2 reps in reserve without a grinding rep.",
      "Recorded a new 5-rep best on squat, bench, deadlift and overhead press, and a chin-up rep count to beat next block.",
    ],
    instructions: [
      "Train three non-consecutive days a week, for example Mon/Wed/Fri, in the order A, B, C.",
      "Choose weights by reps in reserve (RIR), not by a number you think you should lift: start each lift with the empty bar, add weight each warm-up set, and stop when a set of 8 feels like about 4 more reps were possible. That is your week 1 working weight. RPE 6 = about 4 reps in reserve, RPE 7 = 3, RPE 8 = 2.",
      "Missed a session? Pick up with the next one in order and keep the weights you last used; don't double up. Missed a whole week or more? Repeat your last completed week before moving on.",
      "Repeat a week (rather than advance) if two or more lifts ended it harder than the target effort, or if you reset a lift that week.",
      "If you can't do chin-ups yet, use slow lowering reps from the top of the bar. The pulldown on Day B builds toward them.",
    ],
    catalogNumber: 1,
  },
  {
    slug: "intermediate-strength-builder-upper-lower",
    name: "Intermediate Strength Builder",
    summary: "For intermediates who want a 12-week block that peaks: 4-day upper/lower in three waves — accumulate, intensify, realize — from a training max, ending with a top-set test.",
    description:
      "Goal: a measurable jump in squat, bench, deadlift and overhead press for lifters who no longer progress session to session. Focus: one main " +
      "lift per day on an upper/lower split, each run as a percentage of a training max (TM, 90% of your 1RM) with an RPE check, plus a secondary " +
      "barbell lift and two accessories. Three 4-week waves move from sets of 8 (accumulate) to 5s and 4s (intensify) to triples and doubles " +
      "(realize). Weeks 4 and 8 deload, and week 12 is a lighter week with one top set of 3 per lift — not an all-out max — to set your next training " +
      "max. For intermediate lifters with at least 6–12 months of consistent barbell training.",
    category: "strength",
    types: ["strength", "powerlifting"],
    difficulty: "intermediate",
    weeks: 12,
    sessionMinutes: meanMinutes(WAVES[0]!.days),
    goals: ["build_strength", "build_muscle"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "pull_up_bar", "cable", "ab_wheel"],
    tier: "pro",
    progression:
      "Main lifts use percentages of a training max (TM = 90% of your 1RM): 65 → 70 → 72.5% for sets of 8 in wave 1, 77.5 → 82.5 → 87.5% for 5s and " +
      "4s in wave 2, and 87.5 → 92.5 → 97.5% for triples and doubles in wave 3, while sets come down as load goes up. Each prescription also has a " +
      "target RPE: if a lift runs more than 1 RPE above it, repeat that load next week; if it runs well below for a whole wave, add 2.5 kg / 5 lb " +
      "(upper) or 5 kg / 10 lb (lower) to that TM after the next deload. Secondary lifts and accessories go by RPE: add weight when every set hits " +
      "the target reps at or below it. Weeks 4 and 8 deload at 60–65% TM; week 12 tests one top set of 3 at about RPE 9 and resets the TM.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: WAVES[0]!.days,
    weekTemplates: WAVES,
    milestones: [
      "Set a training max for each main lift and completed 4 × 8 at 65% TM with 3–4 reps in reserve.",
      "Completed 5 × 8 at 70% TM on all four main lifts.",
      "Finished peak accumulation volume (5 × 8 at 72.5% TM) at or below RPE 8.",
      "Completed the deload and reviewed each lift's RPE to decide whether its TM should change.",
      "Moved to 5 × 5 at 77.5% TM with every rep at full speed.",
      "Completed 5 × 5 at 82.5% TM within 1 RPE of target.",
      "Hit 4 × 4 at 87.5% TM on each main lift at about 2 reps in reserve.",
      "Completed the second deload — fresh for the heavy wave.",
      "Completed 5 × 3 at 87.5% TM without missing a rep.",
      "Completed 4 × 3 at 92.5% TM at about RPE 8.",
      "Hit 3 × 2 at 97.5% TM — the heaviest training of the block.",
      "Recorded a top set of 3 on squat, bench, deadlift and press and set a new training max for the next block.",
    ],
    instructions: [
      "Train four days a week with the two lower days apart, for example Mon (Lower A) / Tue (Upper A) / Thu (Lower B) / Fri (Upper B).",
      "Set each training max from a recent effort, not a guess: work up to a set of 5 that feels like about RPE 8 (2 reps left); your TM is roughly that weight plus 8%. If you already know a recent 1RM, use 90% of it. Week 1's RPE check confirms it — if 65% TM feels harder than RPE 7.5, lower the TM 5%.",
      "Choose secondary-lift and accessory weights by reps in reserve each session; the RPE beside each exercise is the target (RPE 8 = 2 reps left).",
      "Missed a session? Do it next, then carry on in order; don't stack two heavy lower days back to back. Missed most of a week? Repeat that week.",
      "Repeat a week if two or more main lifts finished more than 1 RPE above target. If a lift needs a repeat twice in one wave, lower its TM 5–10%.",
    ],
    catalogNumber: 2,
  },
  {
    slug: "power-and-athletic-strength-10-week",
    name: "Power and Athletic Strength",
    summary: "For athletes who want to jump, sprint and throw harder: jumps, throws and power cleans at full rest paired with squat, bench and trap-bar strength, ending in a test week.",
    description:
      "Goal: produce force faster — jump farther, throw harder and get stronger at the same time. Focus: each session opens with a small dose of " +
      "power work (box jumps, trap-bar jumps, broad jumps, medicine-ball throws, power cleans) done fresh with full rest, then strength lifts " +
      "(back squat, bench press, trap-bar deadlift, pull-ups) and single-leg and trunk work. Power volume stays low on purpose — quality, not " +
      "fatigue. Phase 1 (weeks 1–4) builds strength from sets of 6 to 4; week 5 deloads; phase 2 (weeks 6–9) goes heavier on the lifts and shifts " +
      "power to doubles with maximal intent; week 10 tests broad jump, throws, a clean double and one top set per lift. For field and court athletes " +
      "and lifters with at least six months of barbell experience who want to be more explosive. An optional fourth conditioning day is described " +
      "in the instructions.",
    category: "athletic-performance",
    types: ["athletic", "strength"],
    difficulty: "intermediate",
    weeks: 10,
    sessionMinutes: meanMinutes(POWER[0]!.days),
    goals: ["athletic_performance", "build_strength"],
    equipment: ["barbell", "rack", "bench", "box", "trap_bar", "medicine_ball", "pull_up_bar", "dumbbell", "mat"],
    tier: "pro",
    progression:
      "Power work stays at 6–12 jumps or throws per exercise with 75–120 s between sets: it progresses by intent — a higher box, a heavier ball or " +
      "trap bar, a farther target — not by fatigue, and drops from triples to doubles in phase 2. Stop any set when height, distance or speed drops. " +
      "Strength lifts are chosen by reps in reserve: sets of 6 at RPE 7 in week 1 down to triples at RPE 8.5 in week 8; add load when every set " +
      "lands at or below the target RPE. Power cleans build from technique triples (RPE 6) to heavy singles (RPE 8). Week 5 deloads, week 9 cuts " +
      "volume before testing, and week 10 records best jumps, throws and a top set of 3 per lift.",
    progressionModel: "linear_rpe",
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: POWER[0]!.days,
    weekTemplates: POWER,
    milestones: [
      "Completed every jump and throw with full rest and found strength working weights for sets of 6 at about 3 reps in reserve.",
      "Raised box height or ball weight while every rep stayed crisp; lifts at 4 × 5.",
      "Handled the fourth power set without losing jump height; lifts at 5 × 5.",
      "Completed 5 × 4 at about 2 reps in reserve and power-clean doubles at RPE 7.5.",
      "Completed the deload week feeling fresh and fast.",
      "Started phase 2: 4 × 4 heavier than week 4 on squat, bench and trap-bar deadlift.",
      "Completed 5 × 3 on the lifts and doubles on every power exercise at full intent.",
      "Hit the heaviest lifting of the program (5 × 3 at 1–2 reps in reserve) and clean singles at RPE 8.",
      "Completed the lighter pre-test week feeling fresh, with no sore or heavy legs.",
      "Recorded best broad jump, best throws, a heavy clean double and a top set of 3 on squat, bench and trap-bar deadlift.",
    ],
    instructions: [
      "Train three non-consecutive days, for example Mon/Wed/Fri. Do power work first in every session, before anything tiring.",
      "Choose lifting weights by reps in reserve, not by a fixed number: the RPE beside each lift is the target (RPE 7 = about 3 reps left, RPE 8 = about 2). For trap-bar jumps use a light load that still lets you jump nearly as high as without it; for medicine balls start with one you can throw fast and far, often 3–5 kg / 6–10 lb.",
      "Rest fully between power sets (the times shown are minimums). If height, distance or bar speed drops noticeably, end that exercise for the day.",
      "Optional 4th day (e.g. Saturday): 20–30 minutes of easy aerobic work — bike, rower or jog at a conversational pace — then 6–8 relaxed strides of 60–80 m with a full walk back. Keep it easy, skip it in weeks 5, 9 and 10, and drop it if it leaves your legs heavy for Monday.",
      "Missed a session? Do it next and carry on in order, keeping at least one day between sessions. Missed most of a week? Repeat that week. Repeat a week too if jump distances or lifts went backwards across it.",
    ],
    catalogNumber: 7,
  },
];
