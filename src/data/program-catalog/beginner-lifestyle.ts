import type { ProgramDaySeed, ProgramSeed, ProgramWeekSeed } from "../programs";
import { type BuildEx, LOW_IMPACT_WARMUP, R, STANDARD_COOLDOWN, STANDARD_WARMUP, T, day, deloadDays } from "../program-builders";

/**
 * Pro catalog additions (2026-11): beginner and lifestyle programs. Slugs are permanent.
 * Every day carries its own warm-up and cool-down so the stated minutes are computed from the same framing the app shows.
 */

const framed = (warmup: string[], cooldown: string[]) => (name: string, focus: string, exercises: BuildEx[]): ProgramDaySeed =>
  day(name, focus, exercises, { warmup, cooldown });

// =========================================================================== [15] First 30 Days in the Gym

const GYM_WARMUP = [
  "5 minutes easy on a bike, treadmill or cross-trainer — try a different machine each session",
  "Bodyweight squats × 10",
  "Arm circles × 10 each direction",
  "One light practice set of your first exercise × 10",
];
const GYM_COOLDOWN = ["2–3 minutes easy walking", "Child's pose — 45 seconds", "Figure-four glute stretch — 30 seconds per side"];
const gymDay = framed(GYM_WARMUP, GYM_COOLDOWN);

interface First30Week {
  focus: string;
  main: number;
  acc: number;
  reps: string;
  rpe: number;
  coreReps: string;
  coreSecs: number;
  cardio: number;
}

const FIRST_30: First30Week[] = [
  {
    focus: "Week 1 — learn the gym: two easy sets of each exercise at about RPE 6 (4 reps still in the tank); note every seat and pin setting",
    main: 2,
    acc: 2,
    reps: "10-12",
    rpe: 6,
    coreReps: "6 per side",
    coreSecs: 20,
    cardio: 300,
  },
  {
    focus: "Week 2 — a third set on the first three exercises, same easy effort; aim for smooth, identical reps",
    main: 3,
    acc: 2,
    reps: "10-12",
    rpe: 6,
    coreReps: "6 per side",
    coreSecs: 25,
    cardio: 360,
  },
  {
    focus: "Week 3 — three sets of everything at about RPE 7 (3 reps in reserve); add a little weight where 12 reps felt easy",
    main: 3,
    acc: 3,
    reps: "10-12",
    rpe: 7,
    coreReps: "8 per side",
    coreSecs: 30,
    cardio: 480,
  },
  {
    focus: "Week 4 — slightly heavier sets of 8–10 at about RPE 7.5 (2–3 reps in reserve); finish the month with a full set of notes",
    main: 3,
    acc: 3,
    reps: "8-10",
    rpe: 7.5,
    coreReps: "8 per side",
    coreSecs: 35,
    cardio: 600,
  },
];

function first30Weeks(): ProgramWeekSeed[] {
  return FIRST_30.map((w, i): ProgramWeekSeed => {
    const first = i === 0;
    const orient = (text: string) => (first ? { notes: text } : {});
    const m = (ex: string, rest: number, o: Partial<BuildEx> = {}) => R(ex, w.main, w.reps, rest, { rpe: w.rpe, ...o });
    const a = (ex: string, reps: string, rest: number, o: Partial<BuildEx> = {}) => R(ex, w.acc, reps, rest, { rpe: w.rpe, ...o });
    return {
      focus: w.focus,
      days: [
        gymDay("Machines A", "Leg press, chest press and row on fixed machines", [
          m("leg-press", 90, orient("First time on the machine: ask a staff member to show you the seat and safety settings, and write the seat position down. Feet shoulder-width on the platform; stop each rep before your lower back lifts off the pad.")),
          m("machine-chest-press", 90, orient("Set the seat so the handles line up with mid-chest. Note the pin number you finish on.")),
          m("seated-cable-row", 90, orient("Chest tall against the pad or upright on the bench; pull the handle to your lower ribs.")),
          a("seated-leg-curl", w.reps, 60, orient("Line the machine's pivot up with your knee — the sticker on the frame shows where.")),
          R("dead-bug", 2, w.coreReps, 45, { notes: "On a mat. Lower back stays gently pressed into the floor; breathe out as the arm and leg reach." }),
          T("brisk-walk", 1, w.cardio, 0, { rpe: 4, notes: "Treadmill at a brisk walk you could still talk through. Learn the start, stop and emergency clip before you begin." }),
        ]),
        gymDay("Dumbbells A", "Squat, press and row with dumbbells", [
          m("goblet-squat", 90, orient("Pick up the dumbbell from the rack with a flat back, hold it at your chest by one end and squat to a comfortable depth.")),
          m("dumbbell-bench-press", 90, orient("Sit on the end of the bench with the dumbbells on your thighs, then lie back with them — the safest way to get into position.")),
          m("one-arm-dumbbell-row", 75, { reps: `${w.reps} per side`, ...orient("One hand and knee on the bench, back flat. Return the dumbbells to the rack when you're done.") }),
          a("glute-bridge", "12-15", 60, { notes: "Bodyweight first; rest a dumbbell across your hips once 15 reps feel easy." }),
          T("plank", 2, w.coreSecs, 45, { notes: "Forearms on a mat, body in one straight line. Knees down is fine." }),
          T("bike-intervals", 1, w.cardio, 0, { rpe: 4, notes: "Steady easy ride — not intervals. Set the saddle at hip height when standing beside it." }),
        ]),
        gymDay("Mixed Basics", "Pulldown, hip hinge and overhead press", [
          m("lat-pulldown", 90, orient("Tuck your thighs under the pad. Pull the bar to your upper chest, elbows down toward your back pockets.")),
          m("romanian-deadlift", 90, orient("Dumbbells. Push your hips back like closing a car door with your bottom, back flat, dumbbells close to your legs; stop when you feel your hamstrings.")),
          m("seated-dumbbell-shoulder-press", 90, orient("Set the bench upright. Press up without arching your lower back.")),
          a("leg-extension", w.reps, 60, orient("Line the machine's pivot up with your knee and set the ankle pad just above your shoes.")),
          R("bird-dog", 2, w.coreReps, 45, { notes: "On hands and knees; reach opposite arm and leg long and pause for a breath." }),
          T("rowing-intervals", 1, w.cardio, 0, { rpe: 4, notes: "Steady easy rowing: legs, then body, then arms — and back in reverse order. Damper around 3–5." }),
        ]),
      ],
    };
  });
}

const FIRST_30_WEEKS = first30Weeks();

const FIRST_30_DAYS_PROGRAM: ProgramSeed = {
  slug: "first-30-days-in-the-gym",
  name: "First 30 Days in the Gym",
  summary: "A calm four-week introduction to a commercial gym: machines and dumbbells, two easy sets to start, technique before load.",
  description:
    "For complete beginners who feel unsure where to start in a gym. Goal: learn how the machines, dumbbells and cardio equipment work, practise the " +
    "basic squat, hinge, push and pull patterns, and build a three-day habit. Volume and effort rise very gradually — week 1 is two sets of each " +
    "exercise at about RPE 6 (four reps left in the tank), week 4 is three slightly heavier sets at about RPE 7.5. Each session also tries one " +
    "cardio machine at an easy pace. You'll finish with a written record of your settings and starting weights, ready for a longer program such as " +
    "Full Body Fitness Foundations.",
  category: "beginner",
  types: ["strength"],
  difficulty: "beginner",
  weeks: 4,
  sessionMinutes: 40,
  goals: ["general_health", "build_strength", "build_muscle"],
  equipment: ["machine", "dumbbell", "bench", "bodyweight", "mat", "bike", "rower"],
  tier: "pro",
  progression:
    "Week 1: two sets at RPE 6. Week 2: a third set on the first three exercises. Week 3: three sets of everything at RPE 7 — add the smallest " +
    "weight step wherever all sets reached 12 reps. Week 4: sets of 8–10 with a little more weight at about RPE 7.5. Core holds grow by 5 seconds " +
    "and the easy cardio by a minute or two each week (5 → 10 minutes).",
  progressionModel: "linear_rpe",
  noDeloadReason:
    "A four-week introduction that never goes past RPE 7.5 and starts with only two sets, so fatigue stays low. Take an easy week before your next program if you feel run down.",
  warmup: GYM_WARMUP,
  cooldown: GYM_COOLDOWN,
  days: FIRST_30_WEEKS[0]!.days,
  weekTemplates: FIRST_30_WEEKS,
  milestones: [
    "Completed all three sessions, found every machine and wrote down your seat settings and starting weights",
    "Did three sets of the main lifts with every rep looking the same as the first",
    "Added weight to at least two exercises while staying at about 3 reps in reserve",
    "Finished 12 sessions — a full month — and have a log of settings and weights to take into your next program",
  ],
  instructions: [
    "Gym orientation: before your first session, ask the front desk for a quick tour — where the machines, dumbbells and cardio area are, how to adjust seats and pins, and the house rules. Wipe equipment down after use, re-rack dumbbells, and it's normal to ask someone \"How many sets have you got left?\" and share.",
    "Choosing weights: there are no prescribed weights. Start lighter than you think, do a practice set, then pick a weight you could lift 4 more times at the end of the set in week 1 (RPE 6) — about 3 more by week 3 and 2–3 more in week 4. If a set feels harder than that, drop the weight; if it feels easier, go up a small step next set.",
    "Schedule: three sessions a week with a rest day between them, for example Mon/Wed/Fri. Do the sessions in order: Machines A, Dumbbells A, Mixed Basics.",
    "Missed a session? Do it at your next visit and carry on in order — don't double up on one day. If you miss most of a week, repeat that week.",
    "Repeat a week if any exercise felt uncomfortable, if you couldn't keep good form, or if you'd simply like more practice. Pain is a signal to stop that exercise; this is not a rehabilitation program.",
  ],
  catalogNumber: 15,
};

// =========================================================================== [16] Full Body Fitness Foundations

const foundationsDay = framed(STANDARD_WARMUP, STANDARD_COOLDOWN);

interface FoundationsWeek {
  focus: string;
  mainSets: number;
  mainReps: string;
  accSets: number;
  rpe: number;
  coreSecs: number;
  coreReps: string;
  rounds: number;
  work: number;
}

const FOUNDATIONS: FoundationsWeek[] = [
  { focus: "Week 1 — sets of 10–12 at about RPE 6 (4 reps in reserve) to find your working weights; finisher 4 × 20 s", mainSets: 3, mainReps: "10-12", accSets: 2, rpe: 6, coreSecs: 20, coreReps: "6 per side", rounds: 4, work: 20 },
  { focus: "Week 2 — same sets at about RPE 6.5: add reps or a small weight step; one more finisher round", mainSets: 3, mainReps: "10-12", accSets: 2, rpe: 6.5, coreSecs: 25, coreReps: "6 per side", rounds: 5, work: 20 },
  { focus: "Week 3 — a third set on the accessory exercises, about RPE 7 (3 reps in reserve); finisher 6 × 20 s", mainSets: 3, mainReps: "10-12", accSets: 3, rpe: 7, coreSecs: 30, coreReps: "8 per side", rounds: 6, work: 20 },
  { focus: "Week 4 — heavier sets of 8–10 on the main lifts at about RPE 7; finisher intervals lengthen to 30 s on / 30 s off", mainSets: 3, mainReps: "8-10", accSets: 3, rpe: 7, coreSecs: 30, coreReps: "8 per side", rounds: 5, work: 30 },
  { focus: "Week 5 — 8–10 reps at about RPE 7.5; beat week 4's weights or reps; six finisher rounds", mainSets: 3, mainReps: "8-10", accSets: 3, rpe: 7.5, coreSecs: 35, coreReps: "8 per side", rounds: 6, work: 30 },
  { focus: "Week 6 — a fourth set on the main lifts at about RPE 7.5 (2–3 reps in reserve)", mainSets: 4, mainReps: "8-10", accSets: 3, rpe: 7.5, coreSecs: 40, coreReps: "10 per side", rounds: 6, work: 30 },
  { focus: "Week 7 — peak week: four main-lift sets at about RPE 8 (2 reps in reserve) and seven finisher rounds", mainSets: 4, mainReps: "8-10", accSets: 3, rpe: 8, coreSecs: 45, coreReps: "10 per side", rounds: 7, work: 30 },
];

function foundationsWeeks(): ProgramWeekSeed[] {
  const loading = FOUNDATIONS.map((w): ProgramWeekSeed => {
    const m = (ex: string, rest: number, o: Partial<BuildEx> = {}) => R(ex, w.mainSets, w.mainReps, rest, { rpe: w.rpe, ...o });
    const a = (ex: string, reps: string, rest: number, o: Partial<BuildEx> = {}) => R(ex, w.accSets, reps, rest, { rpe: w.rpe, ...o });
    const off = 60 - w.work;
    const finisher = (ex: string, how: string) =>
      T(ex, w.rounds, w.work, off, { rpe: 7, notes: `Finisher: ${w.work} s ${how}, ${off} s easy — ${w.rounds} rounds. Hard but repeatable, never all-out.` });
    return {
      focus: w.focus,
      days: [
        foundationsDay("Full Body A", "Squat, chest press and pulldown + bike finisher", [
          m("goblet-squat", 90),
          m("machine-chest-press", 90),
          a("lat-pulldown", "10-12", 75),
          a("glute-bridge", "12-15", 60, { notes: "A dumbbell across the hips once 15 reps is easy." }),
          R("dead-bug", 2, w.coreReps, 45),
          finisher("bike-intervals", "brisk pedalling"),
        ]),
        foundationsDay("Full Body B", "Hip hinge, row and push-up + bodyweight finisher", [
          m("romanian-deadlift", 90, { notes: "Dumbbells. Hips back, flat back, dumbbells close to the legs." }),
          m("seated-cable-row", 90),
          a("incline-push-up", "8-12", 75, { notes: "Hands on a bench or bar; lower the incline when 12 reps is easy." }),
          a("reverse-lunge", "8 per side", 75, { notes: "Bodyweight, then dumbbells at your sides." }),
          T("plank", 2, w.coreSecs, 45),
          finisher("step-back-burpee", "of steady step-back burpees"),
        ]),
        foundationsDay("Full Body C", "Leg press, overhead press and row + rower finisher", [
          m("leg-press", 90),
          m("seated-dumbbell-shoulder-press", 90),
          a("one-arm-dumbbell-row", "10-12 per side", 60),
          a("seated-leg-curl", "10-12", 60),
          T("side-plank", 2, Math.max(15, w.coreSecs - 10), 30, { notes: "Per side; knees bent to start." }),
          finisher("rowing-intervals", "of strong rowing"),
        ]),
      ],
    };
  });
  return [
    ...loading,
    {
      focus: "Week 8 — lighter week: fewer sets at about 60% of week 7's weights, then retest or start your next program",
      isDeload: true,
      days: deloadDays(loading.at(-1)!.days, "Lighter week: about 60% of week 7's weights; every rep smooth."),
    },
  ];
}

const FOUNDATIONS_WEEKS = foundationsWeeks();

const FULL_BODY_FOUNDATIONS_PROGRAM: ProgramSeed = {
  slug: "full-body-fitness-foundations",
  name: "Full Body Fitness Foundations",
  summary: "Eight weeks of three full-body strength sessions, each ending with a short conditioning finisher — dumbbells, machines and bodyweight.",
  description:
    "Goal: build all-round strength and fitness in one plan. Each session trains a squat or leg press, a hinge, a push and a pull (every major muscle " +
    "twice a week, in line with ACSM guidance), then finishes with 4–7 minutes of bike, rower or bodyweight intervals. For beginners who know their way " +
    "around a gym — or who have finished First 30 Days in the Gym — and want a structured next step. Effort rises from about RPE 6 to RPE 8, reps " +
    "move from 10–12 to heavier 8–10, and week 8 is lighter before you move on.",
  category: "beginner",
  types: ["strength", "functional"],
  difficulty: "beginner",
  weeks: 8,
  sessionMinutes: 45,
  goals: ["general_health", "build_strength", "improve_conditioning", "lose_fat"],
  equipment: ["dumbbell", "bench", "machine", "bodyweight", "mat", "bike", "rower"],
  tier: "pro",
  progression:
    "Weeks 1–3: sets of 10–12, effort rising from RPE 6 to 7 and a third accessory set in week 3. Weeks 4–7: heavier sets of 8–10 on the main lifts, " +
    "RPE 7 to 8, with a fourth set from week 6. Double progression throughout: when every set reaches the top of the range at the target effort, use " +
    "the next weight up. Finishers grow from 4 × 20 s to 7 × 30 s; core holds lengthen each week. Week 8 is a lighter week.",
  progressionModel: "linear_rpe",
  warmup: STANDARD_WARMUP,
  cooldown: STANDARD_COOLDOWN,
  days: FOUNDATIONS_WEEKS[0]!.days,
  weekTemplates: FOUNDATIONS_WEEKS,
  milestones: [
    "Found a working weight for every exercise that leaves about 4 reps in reserve",
    "Added reps or weight to at least half the exercises",
    "Completed three sets of every strength exercise and six finisher rounds",
    "Moved the main lifts to heavier sets of 8–10 with good form",
    "Beat week 4's weight or reps on every main lift",
    "Completed four sets of each main lift",
    "Peak week done: four main-lift sets at about 2 reps in reserve and seven finisher rounds",
    "Recovered with a lighter week — compare your week 1 and week 7 weights in your log",
  ],
  instructions: [
    "Train three days a week with a rest day between sessions, for example Mon/Wed/Fri, doing Full Body A, B and C in order.",
    "Choosing weights: no weights are prescribed. In week 1 pick a weight you could lift about 4 more times at the end of each set (RPE 6). Adjust between sets: too easy → go up a step; form slipping → go down. Use the week's RPE target, not last week's number, to decide.",
    "Finishers should be hard but repeatable — you should be able to match round 1's pace in the last round. If you can't, slow down rather than stop.",
    "Missed a session? Do it next time and keep the order. Missed a whole week, or a week felt much harder than its RPE target? Repeat that week before moving on.",
  ],
  catalogNumber: 16,
};

// =========================================================================== [17] Strength for Fat-Loss Goals

const fatLossDay = framed(STANDARD_WARMUP, STANDARD_COOLDOWN);

interface FatLossWeek {
  focus: string;
  mainSets: number;
  mainReps: string;
  mainRest: number;
  accReps: string;
  accSets: number;
  rpe: number;
  steady: number;
  /** Lower B conditioning: [rounds, work s, rest s], or null for a steady ride. */
  intervals: [number, number, number] | null;
}

const FAT_LOSS: FatLossWeek[] = [
  { focus: "Block 1, week 1 — sets of 10–12 at about RPE 6.5 to find working weights; 10 minutes easy conditioning", mainSets: 3, mainReps: "10-12", mainRest: 120, accReps: "12-15", accSets: 2, rpe: 6.5, steady: 600, intervals: null },
  { focus: "Block 1, week 2 — RPE 7 and a third accessory set; conditioning 12 minutes", mainSets: 3, mainReps: "10-12", mainRest: 120, accReps: "12-15", accSets: 3, rpe: 7, steady: 720, intervals: null },
  { focus: "Block 1, week 3 — RPE 7.5: add weight wherever every set hit 12; conditioning 14 minutes", mainSets: 3, mainReps: "10-12", mainRest: 120, accReps: "12-15", accSets: 3, rpe: 7.5, steady: 840, intervals: null },
  { focus: "", mainSets: 0, mainReps: "", mainRest: 0, accReps: "", accSets: 0, rpe: 0, steady: 0, intervals: null },
  { focus: "Block 2, week 1 — heavier sets of 8–10 at about RPE 7; Lower B adds short bike intervals", mainSets: 3, mainReps: "8-10", mainRest: 120, accReps: "10-12", accSets: 3, rpe: 7, steady: 900, intervals: [6, 30, 90] },
  { focus: "Block 2, week 2 — a fourth set on the main lifts at RPE 7.5; conditioning 16 minutes", mainSets: 4, mainReps: "8-10", mainRest: 120, accReps: "10-12", accSets: 3, rpe: 7.5, steady: 960, intervals: [7, 30, 90] },
  { focus: "Block 2, week 3 — RPE 8 (about 2 reps in reserve); conditioning 18 minutes", mainSets: 4, mainReps: "8-10", mainRest: 120, accReps: "10-12", accSets: 3, rpe: 8, steady: 1080, intervals: [8, 30, 90] },
  { focus: "", mainSets: 0, mainReps: "", mainRest: 0, accReps: "", accSets: 0, rpe: 0, steady: 0, intervals: null },
  { focus: "Block 3, week 1 — heavier sets of 6–8 at about RPE 7.5: keep the weight on the bar while you diet", mainSets: 4, mainReps: "6-8", mainRest: 120, accReps: "10-12", accSets: 3, rpe: 7.5, steady: 1080, intervals: [6, 40, 80] },
  { focus: "Block 3, week 2 — RPE 8 on the main lifts; conditioning 19 minutes", mainSets: 4, mainReps: "6-8", mainRest: 120, accReps: "10-12", accSets: 3, rpe: 8, steady: 1140, intervals: [7, 40, 80] },
  { focus: "Block 3, week 3 — top week: about RPE 8.5 (1–2 reps in reserve), never to failure; conditioning 20 minutes", mainSets: 4, mainReps: "6-8", mainRest: 120, accReps: "10-12", accSets: 3, rpe: 8.5, steady: 1200, intervals: [8, 40, 80] },
];

function fatLossWeeks(): ProgramWeekSeed[] {
  const out: ProgramWeekSeed[] = [];
  FAT_LOSS.forEach((w, i) => {
    const week = i + 1;
    if (week === 4 || week === 8) {
      out.push({
        focus: `Lighter week — fewer sets at about 60% of last week's weights; easy conditioning only. Block ${week / 4 + 1} starts next week`,
        isDeload: true,
        days: deloadDays(out.at(-1)!.days, "Lighter week: about 60% of last week's weights, 3–4 reps in reserve."),
      });
      return;
    }
    const m = (ex: string, o: Partial<BuildEx> = {}) => R(ex, w.mainSets, w.mainReps, w.mainRest, { rpe: w.rpe, ...o });
    const a = (ex: string, o: Partial<BuildEx> = {}, reps = w.accReps) => R(ex, w.accSets, reps, 75, { rpe: Math.min(8.5, w.rpe + 0.5), ...o });
    const mins = w.steady / 60;
    const steady = (ex: string, how: string) => T(ex, 1, w.steady, 0, { rpe: 4, notes: `${mins} minutes ${how} at a pace you could hold a conversation (zone 2).` });
    const lowerB = w.intervals
      ? T("bike-intervals", w.intervals[0], w.intervals[1], w.intervals[2], {
          rpe: 7.5,
          notes: `${w.intervals[1]} s brisk, ${w.intervals[2]} s easy pedalling — ${w.intervals[0]} rounds. Low impact; strong but controlled, not a sprint.`,
        })
      : steady("bike-intervals", "of steady cycling");
    out.push({
      focus: w.focus,
      days: [
        fatLossDay("Upper A", "Chest, back and shoulders + steady bike", [
          m("dumbbell-bench-press"),
          m("lat-pulldown"),
          a("seated-dumbbell-shoulder-press"),
          a("chest-supported-row"),
          steady("bike-intervals", "of steady cycling"),
        ]),
        fatLossDay("Lower A", "Leg press and hip hinge + incline walk", [
          m("leg-press"),
          m("romanian-deadlift", { notes: "Dumbbells. Hips back, flat back; stop when the hamstrings are stretched." }),
          a("reverse-lunge", {}, "8 per side"),
          a("seated-leg-curl"),
          T("plank", 2, [30, 40, 45][Math.floor(i / 4)]!, 45),
          steady("brisk-walk", "of incline treadmill or outdoor hill walking"),
        ]),
        fatLossDay("Upper B", "Machine press, row and shoulders + steady row", [
          m("machine-chest-press"),
          m("seated-cable-row"),
          a("lateral-raise", {}, "12-15"),
          a("rear-delt-fly", {}, "12-15"),
          steady("rowing-intervals", "of steady rowing"),
        ]),
        fatLossDay("Lower B", "Squat and glutes + bike intervals", [
          m("goblet-squat"),
          m("glute-bridge", { notes: "Load it: a dumbbell across the hips. Pause one second at the top." }),
          a("leg-extension"),
          a("standing-calf-raise", {}, "12-15"),
          R("dead-bug", 2, week <= 3 ? "6 per side" : "8 per side", 45),
          lowerB,
        ]),
      ],
    });
  });
  out.push({
    focus: "Week 12 — lighter week to finish: fewer sets at about 60% of week 11's weights. Then start again at block 2 or move to a maintenance plan",
    isDeload: true,
    days: deloadDays(out.at(-1)!.days, "Lighter week: about 60% of week 11's weights, 3–4 reps in reserve."),
  });
  return out;
}

const FAT_LOSS_WEEKS = fatLossWeeks();

const STRENGTH_FOR_FAT_LOSS_PROGRAM: ProgramSeed = {
  slug: "strength-for-fat-loss",
  name: "Strength for Fat-Loss Goals",
  summary: "Twelve weeks of four strength-first sessions a week to keep your muscle while you diet, each with low-impact conditioning.",
  description:
    "Goal: hold on to — or build — muscle and strength while you lose body fat. Fat loss itself comes from a moderate, sustainable calorie deficit: " +
    "use your app's calorie and protein targets and don't cut further for this program. Heavy-enough strength work is the main signal to keep muscle " +
    "in a deficit, so the lifts progress from sets of 10–12 to 6–8 across three four-week blocks, never to failure. Each session ends with 10–20 " +
    "minutes of low-impact conditioning (bike, rower, incline walking) rather than high-impact work. For beginners and early intermediates who can " +
    "already perform the basic gym lifts; a 3-day schedule is explained in the instructions. Not a substitute for medical advice on weight management.",
  category: "weight-loss-cardio",
  types: ["strength", "cardio"],
  difficulty: "beginner",
  weeks: 12,
  sessionMinutes: 50,
  goals: ["lose_fat", "build_strength", "general_health", "improve_conditioning"],
  equipment: ["dumbbell", "bench", "machine", "bodyweight", "mat", "bike", "rower"],
  tier: "pro",
  completion:
    "Complete at least 80% of the 48 sessions — 39 or more. On the 3-day rotation the same 48 sessions simply take about 16 weeks.",
  progression:
    "Three blocks of three loading weeks and a lighter week. Block 1: 3 × 10–12, RPE 6.5 → 7.5. Block 2: 8–10 reps, a fourth main-lift set from its " +
    "second week, RPE 7 → 8, and bike intervals on Lower B. Block 3: 4 × 6–8, RPE 7.5 → 8.5. Add weight when every set reaches the " +
    "top of the range at the target effort. Steady conditioning grows from 10 to 20 minutes in steps of 1–2 minutes; weeks 4, 8 and 12 are lighter.",
  progressionModel: "linear_rpe",
  warmup: STANDARD_WARMUP,
  cooldown: STANDARD_COOLDOWN,
  days: FAT_LOSS_WEEKS[0]!.days,
  weekTemplates: FAT_LOSS_WEEKS,
  milestones: [
    "Found working weights for every exercise at about 3–4 reps in reserve",
    "Completed all four sessions with three accessory sets",
    "Added weight to at least two main lifts",
    "Lighter week done — note how your weights have held up",
    "Moved to heavier sets of 8–10 and completed your first bike intervals",
    "Completed four sets of every main lift",
    "Hit your block 2 targets at about 2 reps in reserve with 18 minutes of steady conditioning",
    "Second lighter week done — compare your main-lift weights with week 1",
    "Moved to sets of 6–8 on the main lifts while dieting",
    "Matched or beat week 9's weights with 19 minutes of conditioning",
    "Top week: main lifts at 1–2 reps in reserve — strength kept or improved during your fat-loss phase",
    "Twelve weeks complete; lighter week done and ready to repeat block 2 or move to maintenance",
  ],
  instructions: [
    "Schedule: four days a week, for example Mon (Upper A), Tue (Lower A), Thu (Upper B), Fri (Lower B). 3-day option: train Mon/Wed/Fri and rotate the four sessions in order (Upper A, Lower A, Upper B, Lower B, Upper A…), moving to the next week's prescription after every four sessions — the plan then takes about 16 weeks.",
    "Choosing weights: no weights are prescribed. Pick a weight that leaves the reps in reserve the week's RPE implies (RPE 7 ≈ 3 reps left, RPE 8 ≈ 2). In a calorie deficit some days feel heavier — go by today's effort, and it's fine if a weight holds steady for a few weeks.",
    "Nutrition: use your app's calorie and protein targets. This program doesn't change them.",
    "Conditioning stays conversational except the Lower B intervals. If you're short on time, shorten the conditioning before you cut strength sets.",
    "Missed a session? Do the next one in order — don't stack two in a day. Repeat a week if you missed more than one session in it, or if two or more main lifts went backwards.",
  ],
  catalogNumber: 17,
};

// =========================================================================== [20] Busy Schedule: 30-Minute Workouts

const BUSY_WARMUP = ["2 minutes marching, skipping or easy stairs", "World's greatest stretch × 2 per side", "First superset: one light set of each × 8"];
const BUSY_COOLDOWN = ["1 minute slow breathing and a stretch of your choice"];
const busyDay = framed(BUSY_WARMUP, BUSY_COOLDOWN);

interface BusyWeek {
  focus: string;
  rounds: number;
  reps: string;
  sideReps: string;
  rest: number;
  rpe: number;
  finRounds: number;
  finWork: number;
}

const BUSY: BusyWeek[] = [
  { focus: "Week 1 — learn the supersets: 3 rounds of 10–12 at about RPE 7, 60 s between rounds", rounds: 3, reps: "10-12", sideReps: "6-8 per side", rest: 60, rpe: 7, finRounds: 2, finWork: 30 },
  { focus: "Week 2 — 45 s between rounds and a third finisher round; add reps or the next dumbbell where 12 felt easy", rounds: 3, reps: "10-12", sideReps: "6-8 per side", rest: 45, rpe: 7.5, finRounds: 3, finWork: 30 },
  { focus: "Week 3 — same rests at about RPE 8 (2 reps in reserve): more weight or reps in the same 30 minutes", rounds: 3, reps: "10-12", sideReps: "6-8 per side", rest: 45, rpe: 8, finRounds: 3, finWork: 30 },
  { focus: "", rounds: 0, reps: "", sideReps: "", rest: 0, rpe: 0, finRounds: 0, finWork: 0 },
  { focus: "Week 5 — heavier dumbbells for sets of 8–10 at about RPE 7.5, 60 s between rounds", rounds: 3, reps: "8-10", sideReps: "5-6 per side", rest: 60, rpe: 7.5, finRounds: 3, finWork: 30 },
  { focus: "Week 6 — 45 s between rounds at about RPE 8; beat week 5's weights or reps", rounds: 3, reps: "8-10", sideReps: "5-6 per side", rest: 45, rpe: 8, finRounds: 3, finWork: 30 },
  { focus: "Week 7 — densest week: 45 s rests at about RPE 8 and longer 40-second finisher efforts", rounds: 3, reps: "8-10", sideReps: "5-6 per side", rest: 45, rpe: 8, finRounds: 3, finWork: 40 },
];

function busyWeeks(): ProgramWeekSeed[] {
  const out: ProgramWeekSeed[] = [];
  BUSY.forEach((w, i) => {
    const week = i + 1;
    if (week === 4) {
      out.push({
        focus: "Week 4 — lighter week: fewer rounds at about 60% of week 3's weights, then heavier dumbbells from week 5",
        isDeload: true,
        days: deloadDays(out.at(-1)!.days, "Lighter week: about 60% of last week's weights."),
      });
      return;
    }
    // Superset pairs: the first exercise is followed straight away by the second (15 s to switch), then rest before the next round.
    const a1 = (ex: string, reps = w.reps, o: Partial<BuildEx> = {}) =>
      R(ex, w.rounds, reps, 15, { rpe: w.rpe, ...o, notes: [`Superset: go straight to the next exercise.`, o.notes].filter(Boolean).join(" ") });
    const a2 = (ex: string, reps = w.reps, o: Partial<BuildEx> = {}) =>
      R(ex, w.rounds, reps, w.rest, { rpe: w.rpe, ...o, notes: [`Then rest ${w.rest} s and repeat the pair.`, o.notes].filter(Boolean).join(" ") });
    const f1 = (ex: string, notes: string) => T(ex, w.finRounds, w.finWork, 15, { notes: `Finisher circuit: ${notes}` });
    const f2 = (ex: string, notes: string) => T(ex, w.finRounds, w.finWork, 30, { notes: `Finisher circuit: ${notes} Rest 30 s, then the next round.` });
    out.push({
      focus: w.focus,
      days: [
        busyDay("Express A", "Squat + press, hinge + row, carry finisher", [
          a1("goblet-squat"),
          a2("dumbbell-bench-press"),
          a1("romanian-deadlift", w.reps, { notes: "Dumbbells, hips back, flat back." }),
          a2("one-arm-dumbbell-row", w.sideReps, { notes: "Hand and knee on the bench." }),
          f1("farmers-carry", "heaviest pair you can hold with tall posture."),
          f2("plank", "straight line from head to heels."),
        ]),
        busyDay("Express B", "Lunge + row, press + bridge, conditioning finisher", [
          a1("reverse-lunge", w.sideReps, { notes: "Dumbbells at your sides." }),
          a2("chest-supported-row", w.reps, { notes: "Chest on an incline bench." }),
          a1("seated-dumbbell-shoulder-press"),
          a2("glute-bridge", w.reps, { notes: "A dumbbell across your hips; pause a second at the top." }),
          f1("mountain-climber", "steady, controlled pace."),
          f2("step-back-burpee", "step back and in — no jumping needed."),
        ]),
        busyDay("Express C", "Split squat + incline press, arms, carry finisher", [
          a1("bulgarian-split-squat", w.sideReps, { notes: "Rear foot on the bench, dumbbells at your sides." }),
          a2("incline-dumbbell-press"),
          a1("dumbbell-curl"),
          a2("overhead-triceps-extension"),
          f1("suitcase-carry", "one dumbbell, switch hands halfway, stay upright."),
          f2("side-plank", "switch sides halfway through the hold."),
        ]),
      ],
    });
  });
  out.push({
    focus: "Week 8 — lighter week: fewer rounds at about 60% of week 7's weights. Then repeat the plan with heavier dumbbells",
    isDeload: true,
    days: deloadDays(out.at(-1)!.days, "Lighter week: about 60% of last week's weights."),
  });
  return out;
}

const BUSY_WEEKS = busyWeeks();

const BUSY_SCHEDULE_PROGRAM: ProgramSeed = {
  slug: "busy-schedule-30-minute-workouts",
  name: "Busy Schedule: 30-Minute Workouts",
  summary: "Three dumbbell sessions a week that fit in 30 minutes including the warm-up — supersets and a short finisher circuit.",
  description:
    "Goal: real full-body strength and fitness in the time you actually have. Every session — warm-up, two dumbbell supersets, a short finisher circuit " +
    "and a minute of cool-down — fits in 30 minutes. Pairing exercises that don't compete (a squat with a press, a hinge with a row) lets one muscle " +
    "group rest while the other works, so you get more done without rushing your heaviest sets. For beginners and returning exercisers with a pair " +
    "of adjustable dumbbells and a bench, at home or in a gym. Progress comes from heavier dumbbells and shorter rests between rounds, not longer sessions.",
  category: "home-workouts",
  types: ["strength", "home"],
  difficulty: "beginner",
  weeks: 8,
  sessionMinutes: 30,
  goals: ["general_health", "build_strength", "lose_fat", "build_muscle"],
  equipment: ["dumbbell", "bench", "bodyweight", "mat"],
  tier: "pro",
  progression:
    "Density within a fixed 30 minutes. Weeks 1–3: sets of 10–12 with rest between superset rounds falling from 60 s to 45 s and effort rising from " +
    "RPE 7 to 8. Week 4 is lighter. Weeks 5–7: heavier dumbbells for 8–10 reps, rest again falling from 60 s to 45 s; finisher efforts lengthen from " +
    "30 s to 40 s. Week 8 is lighter. Use the next dumbbell when every round reaches the top of the range.",
  progressionModel: "density",
  warmup: BUSY_WARMUP,
  cooldown: BUSY_COOLDOWN,
  days: BUSY_WEEKS[0]!.days,
  weekTemplates: BUSY_WEEKS,
  milestones: [
    "Finished all three sessions inside 30 minutes, warm-up included",
    "Cut rest between rounds to 45 s and added a third finisher round",
    "Completed every superset with 45 s rest at about 2 reps in reserve",
    "Lighter week done — pick heavier dumbbells for week 5",
    "Moved to heavier dumbbells for sets of 8–10",
    "Beat week 5's weights or reps with only 45 s between rounds",
    "Densest week done: 45 s rests and 40-second finisher efforts",
    "Eight weeks complete — repeat the plan a dumbbell heavier, or keep going for maintenance",
  ],
  instructions: [
    "Schedule: three sessions a week with a day between them, for example Mon/Wed/Fri, in the order Express A, B, C. Set out both dumbbell pairs before you start so you don't lose time.",
    "How supersets work: do one set of the first exercise, go straight to the second, then rest and repeat the pair for the listed rounds. The finisher is a circuit of the last two exercises.",
    "Choosing weights: no weights are prescribed. Pick dumbbells that leave about 3 reps in reserve at the end of a set in week 1 (RPE 7) and about 2 by week 3. Short on adjustable dumbbells? Slow the lowering to 3 seconds before you shorten rest.",
    "Short on time on a given day? Do both supersets and skip the finisher rather than rushing the warm-up.",
    "Missed a session? Do it next time and keep the order. If you missed more than one session in a week, or couldn't keep the rest periods, repeat that week.",
  ],
  catalogNumber: 20,
};

// =========================================================================== [21] Active Aging Strength and Balance

const AGING_COOLDOWN = ["Slow walk 2–3 minutes", "Seated hamstring stretch — 30 seconds per side", "Slow breathing — 1 minute"];
const agingDay = framed(LOW_IMPACT_WARMUP, AGING_COOLDOWN);

interface AgingWeek {
  focus: string;
  sets: number;
  reps: string;
  rpe: number;
  /** Phase: 1 learn (support), 2 harder variations, 3 load and speed. */
  phase: 1 | 2 | 3;
  balanceSets: number;
  balanceSecs: number;
  carrySecs: number;
  walk: number;
}

const AGING: AgingWeek[] = [
  { focus: "Phase 1, week 1 — learn the movements: 2 easy sets of 10–12 (about RPE 5), a support always within reach", sets: 2, reps: "10-12", rpe: 5, phase: 1, balanceSets: 2, balanceSecs: 15, carrySecs: 20, walk: 600 },
  { focus: "Phase 1, week 2 — same exercises at about RPE 6 (4 reps in reserve); balance holds 20 s", sets: 2, reps: "10-12", rpe: 6, phase: 1, balanceSets: 2, balanceSecs: 20, carrySecs: 25, walk: 720 },
  { focus: "Phase 1, week 3 — a third set on the strength exercises; three balance holds", sets: 3, reps: "10-12", rpe: 6, phase: 1, balanceSets: 3, balanceSecs: 20, carrySecs: 30, walk: 780 },
  { focus: "", sets: 0, reps: "", rpe: 0, phase: 1, balanceSets: 0, balanceSecs: 0, carrySecs: 0, walk: 0 },
  { focus: "Phase 2, week 1 — harder versions: sit-to-stand with arms crossed, push-ups on a counter; about RPE 6", sets: 3, reps: "8-12", rpe: 6, phase: 2, balanceSets: 3, balanceSecs: 20, carrySecs: 30, walk: 840 },
  { focus: "Phase 2, week 2 — about RPE 6.5: add a little resistance where 12 reps felt easy; balance holds 25 s", sets: 3, reps: "8-12", rpe: 6.5, phase: 2, balanceSets: 3, balanceSecs: 25, carrySecs: 35, walk: 900 },
  { focus: "Phase 2, week 3 — about RPE 7 (3 reps in reserve); balance with fingertip support only", sets: 3, reps: "8-12", rpe: 7, phase: 2, balanceSets: 3, balanceSecs: 30, carrySecs: 40, walk: 960 },
  { focus: "", sets: 0, reps: "", rpe: 0, phase: 2, balanceSets: 0, balanceSecs: 0, carrySecs: 0, walk: 0 },
  { focus: "Phase 3, week 1 — add load and speed: sit-to-stand holding a dumbbell, stand up briskly; sets of 8–10 at about RPE 6.5", sets: 3, reps: "8-10", rpe: 6.5, phase: 3, balanceSets: 3, balanceSecs: 30, carrySecs: 40, walk: 1020 },
  { focus: "Phase 3, week 2 — about RPE 7; balance without hand support if you're steady", sets: 3, reps: "8-10", rpe: 7, phase: 3, balanceSets: 3, balanceSecs: 30, carrySecs: 45, walk: 1080 },
  { focus: "Phase 3, week 3 — top week at about RPE 7.5 (2–3 reps in reserve); retest your 30-second sit-to-stand count", sets: 3, reps: "8-10", rpe: 7.5, phase: 3, balanceSets: 3, balanceSecs: 35, carrySecs: 45, walk: 1200 },
];

function agingWeeks(): ProgramWeekSeed[] {
  const out: ProgramWeekSeed[] = [];
  AGING.forEach((w, i) => {
    const week = i + 1;
    if (week === 4 || week === 8) {
      out.push({
        focus: "Lighter week — fewer sets with lighter resistance; keep the habit and let your body catch up",
        isDeload: true,
        days: deloadDays(out.at(-1)!.days, "Lighter week: easier resistance, every rep comfortable."),
      });
      return;
    }
    const s = (ex: string, rest: number, o: Partial<BuildEx> = {}, reps = w.reps) => R(ex, w.sets, reps, rest, { rpe: w.rpe, ...o });
    const sitToStand = [
      "Sit-to-stand from a sturdy chair without wheels: hands on your thighs or the armrests if needed. Stand up briskly, sit down slowly.",
      "Sit-to-stand with arms crossed over your chest. Stand up briskly, take 3 seconds to sit down.",
      "Sit-to-stand holding one dumbbell at your chest. Stand up as quickly as you safely can — rising speed builds the power that helps with stairs and getting up.",
    ][w.phase - 1]!;
    const balanceNote = [
      "Per leg, standing next to a counter or sturdy chair with a hand resting on it.",
      "Per leg, next to a counter, fingertips only — or none if you're steady.",
      "Per leg, next to a counter. Steady without hands? Turn your head slowly side to side, or try it on a cushion.",
    ][w.phase - 1]!;
    const balance = () => T("single-leg-balance", w.balanceSets, w.balanceSecs, 30, { notes: balanceNote });
    const pushEx = w.phase === 1 ? "wall-push-up" : "incline-push-up";
    out.push({
      focus: w.focus,
      days: [
        agingDay("Strength & Balance A", "Sit-to-stand, push, pull and balance", [
          s("box-squat-to-chair", 90, { notes: sitToStand }),
          s(pushEx, 75, { notes: w.phase === 1 ? "Hands on the wall at shoulder height; step the feet back to make it harder." : "Hands on a kitchen counter or sturdy table; lower the surface as it gets easier." }),
          s("band-row", 75, { notes: "Band anchored in a door at chest height; squeeze the shoulder blades together." }),
          R("standing-calf-raise", 2, w.phase === 3 ? "12-15" : "10-15", 45, { notes: "Hold a counter. Rise up slowly, pause, lower slowly." }),
          balance(),
        ]),
        agingDay("Strength & Balance B", "Steps, hip hinge, carrying and balance", [
          s("step-up", 90, { notes: "A low step (10–20 cm) with a handrail. Lead with the same leg for all reps, then switch." }, w.phase === 1 ? "6-8 per side" : "8-10 per side"),
          s("romanian-deadlift", 90, { notes: "Light dumbbells. Push the hips back toward a chair behind you, back flat, and stand tall." }),
          T("farmers-carry", 3, w.carrySecs, 60, { notes: "Light dumbbells, tall posture, steady steps along a clear hallway." }),
          R("pallof-press", 2, w.phase === 1 ? "6 per side" : "8 per side", 45, { notes: "Standing, band anchored at chest height to the side: press out and resist the twist." }),
          T("standing-march", 2, w.phase === 1 ? 30 : 45, 30, { notes: "Balance march: lift one knee, pause for 2 seconds, lower, switch. A hand on the counter if needed." }),
          balance(),
        ]),
        agingDay("Strength & Stamina C", "Sit-to-stand power, press, row, balance and a walk", [
          s("box-squat-to-chair", 90, { notes: `${sitToStand} Today: the fastest safe rise on every rep.` }, w.phase === 3 ? "6-8" : "8-10"),
          s("seated-dumbbell-shoulder-press", 75, { notes: "Seated on a sturdy chair, back supported." }),
          s("one-arm-dumbbell-row", 75, { notes: "One hand on a chair seat or table for support." }, `${w.reps} per side`),
          balance(),
          T("brisk-walk", 1, w.walk, 0, { rpe: 4, notes: `${w.walk / 60} minutes of walking, brisk enough to breathe a little harder but still talk.` }),
        ]),
      ],
    });
  });
  out.push({
    focus: "Week 12 — lighter week to finish: fewer sets, easier resistance. Then repeat phase 3 a little heavier or start again with harder variations",
    isDeload: true,
    days: deloadDays(out.at(-1)!.days, "Lighter week: easier resistance, every rep comfortable."),
  });
  return out;
}

const AGING_WEEKS = agingWeeks();

const ACTIVE_AGING_PROGRAM: ProgramSeed = {
  slug: "active-aging-strength-and-balance",
  name: "Active Aging Strength and Balance",
  summary: "Twelve weeks of low-impact strength with balance practice every session and sit-to-stand progressions from supported to loaded.",
  description:
    "Goal: stronger legs, steadier balance and easier everyday tasks — getting out of a chair, climbing stairs, carrying shopping. For older adults " +
    "and anyone returning to exercise who wants a gentle, progressive start. WHO guidelines suggest adults 65+ do balance and strength work on three or " +
    "more days a week; every session here includes balance practice, and the sit-to-stand progresses from using your hands, to arms crossed, to " +
    "holding a dumbbell with a brisk rise. Everything is low impact and done next to a sturdy chair or counter. Effort stays moderate (RPE 5–7.5) with " +
    "a lighter week every fourth week. A 2-day option is in the instructions. If you have a heart, lung, bone or joint condition, or have fallen " +
    "recently, check with your healthcare provider before starting.",
  category: "active-aging",
  types: ["low_impact", "strength"],
  difficulty: "beginner",
  weeks: 12,
  sessionMinutes: 35,
  goals: ["general_health", "build_strength", "mobility"],
  equipment: ["bodyweight", "dumbbell", "band"],
  tier: "pro",
  lowImpact: true,
  needsSpecialistReview: true,
  completion:
    "Complete at least 80% of the 36 sessions — 29 or more. On the 2-day rotation the same 36 sessions simply take about 18 weeks.",
  progression:
    "Three four-week phases, each three building weeks and a lighter week. Phase 1: 2 → 3 sets of 10–12 at RPE 5–6 with supported variations. " +
    "Phase 2: 3 sets of 8–12 at RPE 6–7 with harder variations (arms-crossed sit-to-stand, counter push-ups). Phase 3: 3 sets of 8–10 at RPE 6.5–7.5 " +
    "with a dumbbell and a brisk rise. Balance holds grow from 2 × 15 s with a hand on a support to 3 × 35 s with little or no support; carries and " +
    "the walk lengthen each week (walk 10 → 20 minutes).",
  progressionModel: "volume_wave",
  warmup: LOW_IMPACT_WARMUP,
  cooldown: AGING_COOLDOWN,
  days: AGING_WEEKS[0]!.days,
  weekTemplates: AGING_WEEKS,
  milestones: [
    "Completed all three sessions and counted how many sit-to-stands you can do in 30 seconds (write it down)",
    "Held each single-leg balance for 20 seconds with a hand on a support",
    "Completed three sets of each strength exercise",
    "Lighter week done — you've kept the habit for a month",
    "Moved to arms-crossed sit-to-stands and counter push-ups",
    "Added a little resistance to at least two exercises",
    "Held each balance for 30 seconds with fingertip support only",
    "Second lighter week done",
    "Sit-to-stands holding a dumbbell with a brisk rise",
    "Walked 18 minutes at a brisk, talkable pace",
    "Retested your 30-second sit-to-stand count — compare it with week 1",
    "Twelve weeks of strength and balance complete; lighter week done and ready to repeat phase 3",
  ],
  instructions: [
    "Schedule: three days a week with a day between, for example Mon/Wed/Fri, in the order A, B, C. 2-day option: train Mon and Thu and rotate the three sessions in order (A, B, C, A…), moving to the next week's prescription after every three sessions; practise the single-leg balance for a minute on most other days, next to a counter.",
    "Choosing resistance: no weights are prescribed. Pick a dumbbell or band that leaves the reps in reserve the week's RPE implies — about 5 more reps at RPE 5, 4 at RPE 6, 3 at RPE 7. Go lighter if your form changes or anything hurts.",
    "Safety set-up: use a sturdy chair without wheels placed against a wall, keep a counter or rail within reach for every standing exercise, wear supportive shoes and clear the floor around you. Stop if you feel dizzy, short of breath beyond a brisk walk, or any pain.",
    "Missed a session? Simply do the next one in order. If you miss a week or more, repeat the last week you completed before moving on.",
    "Repeat a week whenever it felt harder than its RPE target or a balance hold wasn't steady — there's no rush.",
  ],
  catalogNumber: 21,
};

/** Pro catalog additions (2026-11). Slugs are permanent. */
export const CATALOG_BEGINNER_LIFESTYLE: ProgramSeed[] = [
  FIRST_30_DAYS_PROGRAM,
  FULL_BODY_FOUNDATIONS_PROGRAM,
  STRENGTH_FOR_FAT_LOSS_PROGRAM,
  BUSY_SCHEDULE_PROGRAM,
  ACTIVE_AGING_PROGRAM,
];
