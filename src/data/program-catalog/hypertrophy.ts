import type { ProgramSeed, ProgramWeekSeed } from "../programs";
import { STANDARD_COOLDOWN, STANDARD_WARMUP, R, type BlockWeek, type DayPlan, hypertrophyWeeks } from "../program-builders";

/**
 * Pro catalog additions (2026-11): hypertrophy programs. Slugs are permanent.
 *
 * Every program is built from mesocycles: hard sets per muscle start near the low end of about 10–20 a week and
 * rise through each block as reps in reserve fall, then a deload halves the sets. Later blocks start a little
 * harder and, where noted, rotate exercise variations. Loads are always chosen by reps in reserve (RIR / RPE),
 * never prescribed as absolute weights.
 */

/** Run one or more blocks back to back: each pairs its day plans with its weeks. */
const blocks = (...parts: [DayPlan[], BlockWeek[]][]): ProgramWeekSeed[] => parts.flatMap(([plans, weeks]) => hypertrophyWeeks(plans, weeks));

const DELOAD_FOCUS = "Deload — half the sets at the same or slightly lighter weights, about 3–4 reps in reserve";

// =========================================================================== [8] Beginner Muscle Builder

const BEGINNER_DAYS: DayPlan[] = [
  {
    name: "Full Body A",
    focus: "Leg press, dumbbell bench, pulldown, hamstrings, delts, biceps",
    ex: [
      R("leg-press", 3, "10-12", 120, { rpe: 8, grow: true, notes: "Feet shoulder-width, lower until your hips start to tuck, then press through the whole foot." }),
      R("dumbbell-bench-press", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("lat-pulldown", 3, "10-12", 90, { rpe: 8, grow: true, notes: "Pull the bar to your upper chest; control it all the way up." }),
      R("seated-leg-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("lateral-raise", 2, "12-15", 45, { rpe: 8, iso: true }),
      R("dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Full Body B",
    focus: "Romanian deadlift, machine press, cable row, goblet squat, shoulders, triceps",
    ex: [
      R("romanian-deadlift", 3, "8-10", 120, { rpe: 8, notes: "Barbell or dumbbells. Push the hips back with a long spine; stop when your hamstrings are fully stretched." }),
      R("machine-chest-press", 3, "10-12", 90, { rpe: 8 }),
      R("seated-cable-row", 3, "10-12", 90, { rpe: 8, grow: true }),
      R("goblet-squat", 3, "10-12", 90, { rpe: 8 }),
      R("seated-dumbbell-shoulder-press", 2, "10-12", 90, { rpe: 8 }),
      R("triceps-pushdown", 2, "12-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Full Body C",
    focus: "Back squat, incline press, chest-supported row, quads, rear delts, calves",
    ex: [
      R("back-squat", 3, "6-10", 150, { rpe: 8, grow: true, notes: "Learn it with a light bar first. A leg press or goblet squat is a fine substitute while you practise." }),
      R("incline-dumbbell-press", 3, "8-12", 90, { rpe: 8 }),
      R("chest-supported-row", 3, "10-12", 90, { rpe: 8 }),
      R("leg-extension", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("standing-calf-raise", 2, "10-15", 45, { rpe: 8, iso: true, notes: "Pause 1–2 s in the bottom stretch." }),
    ],
  },
];

const BEGINNER_WEEKS: BlockWeek[] = [
  { focus: "Week 1 — learn the movements: choose weights that leave about 3 reps in reserve on every set", add: 0, rpe: 7 },
  { focus: "Week 2 — same sets, 2–3 reps in reserve: add a rep or two wherever the form stays clean", add: 0, rpe: 7.5 },
  { focus: "Week 3 — one extra set on the main lifts, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: DELOAD_FOCUS, add: 0, rpe: 6, deload: true },
  { focus: "Week 5 — block 2: keep the extra set and start a little heavier than week 1, 2–3 reps in reserve", add: 1, rpe: 7.5 },
  { focus: "Week 6 — about 2 reps in reserve: beat your week 3 reps or loads", add: 1, rpe: 8 },
  { focus: "Week 7 — peak week: two extra sets on the main lifts, 1–2 reps in reserve", add: 2, rpe: 8.5 },
  { focus: "Deload — half the sets, easy effort; then repeat the block or move to an intermediate split", add: 0, rpe: 6, deload: true },
];

const BEGINNER_PROGRAM = blocks([BEGINNER_DAYS, BEGINNER_WEEKS]);

// =========================================================================== [9] Upper/Lower Hypertrophy

const UL_MESO_1: DayPlan[] = [
  {
    name: "Upper A",
    focus: "Barbell bench, chest-supported row, shoulder press, pulldown, arms",
    ex: [
      R("bench-press", 3, "6-8", 150, { rpe: 8, grow: true }),
      R("chest-supported-row", 3, "8-10", 90, { rpe: 8, grow: true }),
      R("seated-dumbbell-shoulder-press", 3, "8-12", 90, { rpe: 8 }),
      R("lat-pulldown", 3, "10-12", 90, { rpe: 8 }),
      R("cable-lateral-raise", 2, "12-15", 45, { rpe: 8, iso: true, grow: true }),
      R("dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower A",
    focus: "Back squat, Romanian deadlift, quads, hamstrings, calves",
    ex: [
      R("back-squat", 3, "6-8", 180, { rpe: 8, grow: true }),
      R("romanian-deadlift", 3, "8-10", 120, { rpe: 8 }),
      R("leg-extension", 2, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-leg-curl", 3, "10-12", 60, { rpe: 8, iso: true, notes: "Seated curls train the hamstrings at long lengths." }),
      R("standing-calf-raise", 3, "10-15", 45, { rpe: 8, iso: true, notes: "Pause 1–2 s in the bottom stretch." }),
    ],
  },
  {
    name: "Upper B",
    focus: "Incline press, pull-ups, flyes, cable row, delts, arms",
    ex: [
      R("incline-dumbbell-press", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("pull-up", 3, "6-10", 120, { rpe: 8, grow: true, notes: "Band-assisted or a pulldown if you can't yet do 6; add weight past 10." }),
      R("cable-chest-fly", 3, "12-15", 60, { rpe: 8, iso: true }),
      R("seated-cable-row", 3, "10-12", 90, { rpe: 8 }),
      R("lateral-raise", 2, "12-20", 45, { rpe: 8, iso: true, grow: true }),
      R("rear-delt-fly", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("hammer-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower B",
    focus: "Leg press, hip thrust, split squats, leg curls, calves",
    ex: [
      R("leg-press", 3, "10-15", 120, { rpe: 8, grow: true }),
      R("hip-thrust", 3, "8-12", 90, { rpe: 8, notes: "Pause 1 s at the top, ribs down." }),
      R("bulgarian-split-squat", 2, "8-12 per side", 90, { rpe: 8 }),
      R("leg-curl", 3, "10-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-calf-raise", 3, "12-15", 45, { rpe: 8, iso: true }),
      R("cable-crunch", 2, "12-15", 45),
    ],
  },
];

const UL_MESO_2: DayPlan[] = [
  {
    name: "Upper A",
    focus: "Dumbbell bench, barbell row, overhead press, chin-ups, arms",
    ex: [
      R("dumbbell-bench-press", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("barbell-row", 3, "8-10", 120, { rpe: 8, grow: true, notes: "Torso about 45°, no heaving." }),
      R("overhead-press", 3, "6-10", 150, { rpe: 8 }),
      R("chin-up", 3, "6-10", 120, { rpe: 8, notes: "Band-assisted if needed; add weight past 10." }),
      R("lateral-raise", 2, "15-20", 45, { rpe: 8, iso: true, grow: true }),
      R("incline-dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true, notes: "Arms hang behind you — a lengthened-position curl." }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower A",
    focus: "Hack squat, deadlift, quads, hamstrings, calves",
    ex: [
      R("hack-squat", 3, "8-12", 120, { rpe: 8, grow: true }),
      R("conventional-deadlift", 3, "5", 180, { rpe: 7, notes: "Kept submaximal (about 3 reps in reserve) — deadlifts are very fatiguing." }),
      R("leg-extension", 2, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-leg-curl", 3, "10-15", 60, { rpe: 8, iso: true }),
      R("seated-calf-raise", 3, "12-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper B",
    focus: "Incline press, pulldown, one-arm row, flyes, delts, arms",
    ex: [
      R("incline-dumbbell-press", 3, "10-12", 90, { rpe: 8, grow: true }),
      R("lat-pulldown", 3, "10-12", 90, { rpe: 8, grow: true }),
      R("one-arm-dumbbell-row", 2, "10-12 per side", 75, { rpe: 8 }),
      R("cable-chest-fly", 3, "12-15", 60, { rpe: 8, iso: true }),
      R("cable-lateral-raise", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("hammer-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower B",
    focus: "Back squat, hip thrust, walking lunges, leg curls, calves",
    ex: [
      R("back-squat", 3, "8-10", 150, { rpe: 8, grow: true }),
      R("hip-thrust", 3, "10-12", 90, { rpe: 8 }),
      R("walking-lunge", 2, "10-12 per side", 90, { rpe: 8 }),
      R("leg-curl", 3, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("standing-calf-raise", 3, "10-15", 45, { rpe: 8, iso: true }),
      R("cable-crunch", 2, "12-15", 45),
    ],
  },
];

const UL_MESO_3: DayPlan[] = [
  {
    name: "Upper A",
    focus: "Barbell bench, cable row, shoulder press, pull-ups, arms",
    ex: [
      R("bench-press", 3, "6-8", 150, { rpe: 8, grow: true, notes: "Aim to beat your meso 1 numbers at the same reps in reserve." }),
      R("seated-cable-row", 3, "8-10", 90, { rpe: 8, grow: true }),
      R("seated-dumbbell-shoulder-press", 3, "6-10", 90, { rpe: 8 }),
      R("pull-up", 3, "6-10", 120, { rpe: 8, notes: "Add a little weight if you pass 10 reps." }),
      R("lateral-raise", 2, "12-20", 45, { rpe: 8, iso: true, grow: true }),
      R("hammer-curl", 2, "8-12", 60, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "8-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower A",
    focus: "Front squat, Romanian deadlift, quads, hamstrings, calves",
    ex: [
      R("front-squat", 3, "6-8", 180, { rpe: 8, grow: true, notes: "Hack squat if front squats limit you." }),
      R("romanian-deadlift", 3, "6-10", 120, { rpe: 8 }),
      R("leg-extension", 2, "10-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-leg-curl", 3, "8-12", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 3, "8-12", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper B",
    focus: "Incline press, chest-supported row, pulldown, flyes, rear delts, arms",
    ex: [
      R("incline-dumbbell-press", 3, "8-10", 90, { rpe: 8, grow: true }),
      R("chest-supported-row", 3, "10-12", 90, { rpe: 8, grow: true }),
      R("lat-pulldown", 3, "10-12", 90, { rpe: 8 }),
      R("cable-chest-fly", 3, "12-15", 60, { rpe: 8, iso: true }),
      R("rear-delt-fly", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("cable-lateral-raise", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("incline-dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower B",
    focus: "Leg press, hip thrust, split squats, leg curls, calves",
    ex: [
      R("leg-press", 3, "10-15", 120, { rpe: 8, grow: true }),
      R("hip-thrust", 3, "8-10", 90, { rpe: 8 }),
      R("bulgarian-split-squat", 2, "8-12 per side", 90, { rpe: 8 }),
      R("leg-curl", 3, "10-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-calf-raise", 3, "12-15", 45, { rpe: 8, iso: true }),
      R("cable-crunch", 2, "12-15", 45),
    ],
  },
];

const ulMeso = (n: number, rpes: [number, number, number]): BlockWeek[] => [
  { focus: `Mesocycle ${n}, week 1 — ${n === 1 ? "find your working weights" : "new exercise variations: find their working weights"} at about ${rpes[0] === 7 ? "3" : "2–3"} reps in reserve`, add: 0, rpe: rpes[0] },
  { focus: `Mesocycle ${n}, week 2 — one extra set on key exercises, about 2 reps in reserve: add reps before load`, add: 1, rpe: rpes[1] },
  { focus: `Mesocycle ${n}, week 3 — peak volume: two extra sets on key exercises, about 1 rep in reserve (isolation can reach failure)`, add: 2, rpe: rpes[2] },
  { focus: n === 3 ? "Deload — half the sets, easy effort; then start a new cycle a little heavier" : DELOAD_FOCUS, add: 0, rpe: 6, deload: true },
];

const UPPER_LOWER_PROGRAM = blocks([UL_MESO_1, ulMeso(1, [7, 8, 8.5])], [UL_MESO_2, ulMeso(2, [7.5, 8, 9])], [UL_MESO_3, ulMeso(3, [7.5, 8.5, 9])]);

// =========================================================================== [10] Push/Pull/Legs

const PPL_BLOCK_1: DayPlan[] = [
  {
    name: "Push A",
    focus: "Bench press, shoulder press, incline press, laterals, triceps",
    ex: [
      R("bench-press", 3, "6-8", 150, { rpe: 8, grow: true }),
      R("seated-dumbbell-shoulder-press", 3, "8-10", 90, { rpe: 8 }),
      R("incline-dumbbell-press", 2, "10-12", 90, { rpe: 8 }),
      R("lateral-raise", 3, "12-20", 45, { rpe: 8, iso: true, grow: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Pull A",
    focus: "Pull-ups, barbell row, cable row, face pulls, biceps",
    ex: [
      R("pull-up", 3, "6-10", 120, { rpe: 8, grow: true, notes: "Band-assisted if needed; add weight past 10." }),
      R("barbell-row", 3, "6-10", 120, { rpe: 8 }),
      R("seated-cable-row", 2, "10-12", 90, { rpe: 8 }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("incline-dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
      R("hammer-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Legs A",
    focus: "Back squat, Romanian deadlift, quads, hamstrings, calves",
    ex: [
      R("back-squat", 3, "6-8", 180, { rpe: 8, grow: true }),
      R("romanian-deadlift", 3, "8-10", 120, { rpe: 8 }),
      R("leg-extension", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("seated-leg-curl", 2, "10-15", 60, { rpe: 8, iso: true, grow: true }),
      R("standing-calf-raise", 3, "10-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Push B",
    focus: "Overhead press, dumbbell bench, flyes, cable laterals, triceps",
    ex: [
      R("overhead-press", 3, "6-8", 150, { rpe: 8, grow: true }),
      R("dumbbell-bench-press", 3, "8-12", 90, { rpe: 8 }),
      R("cable-chest-fly", 2, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("cable-lateral-raise", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "12-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Pull B",
    focus: "Pulldown, chest-supported row, straight-arm pulldown, rear delts, biceps",
    ex: [
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("chest-supported-row", 3, "8-12", 90, { rpe: 8 }),
      R("straight-arm-pulldown", 2, "12-15", 60, { rpe: 8, iso: true, notes: "Lengthened lat work — let the arms travel overhead." }),
      R("rear-delt-fly", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Legs B",
    focus: "Leg press, hip thrust, split squats, leg curls, calves",
    ex: [
      R("leg-press", 3, "10-15", 120, { rpe: 8, grow: true }),
      R("hip-thrust", 3, "8-12", 90, { rpe: 8 }),
      R("bulgarian-split-squat", 2, "8-12 per side", 90, { rpe: 8 }),
      R("leg-curl", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("seated-calf-raise", 3, "12-15", 45, { rpe: 8, iso: true }),
    ],
  },
];

const PPL_BLOCK_2: DayPlan[] = [
  {
    name: "Push A",
    focus: "Incline press, overhead press, machine press, laterals, triceps",
    ex: [
      R("incline-dumbbell-press", 3, "6-10", 120, { rpe: 8, grow: true }),
      R("overhead-press", 3, "8-10", 150, { rpe: 8 }),
      R("machine-chest-press", 2, "10-12", 90, { rpe: 8 }),
      R("lateral-raise", 3, "15-20", 45, { rpe: 8, iso: true, grow: true }),
      R("triceps-pushdown", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Pull A",
    focus: "Chin-ups, one-arm row, cable row, face pulls, biceps",
    ex: [
      R("chin-up", 3, "6-10", 120, { rpe: 8, grow: true, notes: "Band-assisted if needed; add weight past 10." }),
      R("one-arm-dumbbell-row", 3, "8-12 per side", 75, { rpe: 8 }),
      R("seated-cable-row", 2, "12-15", 90, { rpe: 8 }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("dumbbell-curl", 2, "8-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Legs A",
    focus: "Front squat, deadlift, quads, hamstrings, calves",
    ex: [
      R("front-squat", 3, "6-8", 180, { rpe: 8, grow: true, notes: "Hack squat if front squats limit you." }),
      R("conventional-deadlift", 2, "5", 180, { rpe: 7, notes: "Kept submaximal (about 3 reps in reserve) — deadlifts are very fatiguing." }),
      R("leg-extension", 3, "12-15", 60, { rpe: 8, iso: true }),
      R("seated-leg-curl", 3, "10-12", 60, { rpe: 8, iso: true, grow: true }),
      R("standing-calf-raise", 3, "8-12", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Push B",
    focus: "Bench press, shoulder press, flyes, cable laterals, triceps",
    ex: [
      R("bench-press", 3, "8-10", 150, { rpe: 8, grow: true }),
      R("seated-dumbbell-shoulder-press", 3, "10-12", 90, { rpe: 8 }),
      R("cable-chest-fly", 2, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("cable-lateral-raise", 2, "12-15", 45, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Pull B",
    focus: "Barbell row, pulldown, straight-arm pulldown, rear delts, biceps",
    ex: [
      R("barbell-row", 3, "8-10", 120, { rpe: 8, grow: true }),
      R("lat-pulldown", 3, "10-12", 90, { rpe: 8 }),
      R("straight-arm-pulldown", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("rear-delt-fly", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("incline-dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
      R("hammer-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Legs B",
    focus: "Hack squat, hip thrust, walking lunges, leg curls, calves",
    ex: [
      R("hack-squat", 3, "10-12", 120, { rpe: 8, grow: true }),
      R("hip-thrust", 3, "10-12", 90, { rpe: 8 }),
      R("walking-lunge", 2, "10-12 per side", 90, { rpe: 8 }),
      R("leg-curl", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("seated-calf-raise", 3, "12-15", 45, { rpe: 8, iso: true }),
    ],
  },
];

const PPL_WEEKS_1: BlockWeek[] = [
  { focus: "Block 1, week 1 — find your working weights at about 3 reps in reserve", add: 0, rpe: 7 },
  { focus: "Block 1, week 2 — same sets, about 2 reps in reserve: add reps or load", add: 0, rpe: 8 },
  { focus: "Block 1, week 3 — one extra set on key exercises, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: "Block 1, week 4 — keep the extra set, 1–2 reps in reserve", add: 1, rpe: 8.5 },
  { focus: "Block 1, week 5 — peak volume: two extra sets on key exercises, about 1 rep in reserve", add: 2, rpe: 9 },
  { focus: DELOAD_FOCUS, add: 0, rpe: 6, deload: true },
];

const PPL_WEEKS_2: BlockWeek[] = [
  { focus: "Block 2, week 1 — new variations: find their working weights at 2–3 reps in reserve", add: 0, rpe: 7.5 },
  { focus: "Block 2, week 2 — one extra set on key exercises, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: "Block 2, week 3 — keep the extra set, 1–2 reps in reserve: add reps before load", add: 1, rpe: 8.5 },
  { focus: "Block 2, week 4 — two extra sets on key exercises, 1–2 reps in reserve", add: 2, rpe: 8.5 },
  { focus: "Block 2, week 5 — peak week: about 1 rep in reserve (isolation can reach failure)", add: 2, rpe: 9 },
  { focus: "Deload — half the sets, easy effort; then start a new cycle a little heavier", add: 0, rpe: 6, deload: true },
];

const PPL_PROGRAM = blocks([PPL_BLOCK_1, PPL_WEEKS_1], [PPL_BLOCK_2, PPL_WEEKS_2]);

// =========================================================================== [11] Advanced Bodybuilding

/** Block 1: back and delt emphasis (width). */
const ADV_BACK_DELTS: DayPlan[] = [
  {
    name: "Upper Strength",
    focus: "Heavy bench, rows, overhead press and pull-ups",
    ex: [
      R("bench-press", 3, "5-8", 180, { rpe: 8 }),
      R("barbell-row", 3, "6-8", 150, { rpe: 8, grow: true }),
      R("overhead-press", 2, "6-8", 150, { rpe: 8 }),
      R("pull-up", 3, "6-10", 120, { rpe: 8, notes: "Add weight once you pass 10 reps." }),
      R("dumbbell-curl", 2, "8-12", 60, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower Strength",
    focus: "Heavy squats, Romanian deadlifts, leg press, curls, calves",
    ex: [
      R("back-squat", 3, "5-8", 180, { rpe: 8 }),
      R("romanian-deadlift", 3, "6-10", 150, { rpe: 8 }),
      R("leg-press", 2, "10-12", 120, { rpe: 8 }),
      R("seated-leg-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 3, "8-12", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Push",
    focus: "Incline press, machine press, shoulder press, lateral raises, triceps",
    ex: [
      R("incline-dumbbell-press", 3, "8-12", 90, { rpe: 8 }),
      R("machine-chest-press", 2, "10-12", 90, { rpe: 8 }),
      R("seated-dumbbell-shoulder-press", 2, "8-12", 90, { rpe: 8 }),
      R("lateral-raise", 3, "12-20", 45, { rpe: 8, iso: true, grow: true, notes: "Priority muscle this block: slow negatives, no swinging." }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Pull (Priority)",
    focus: "Back width and rear delts: pulldowns, chest-supported rows, straight-arm work",
    ex: [
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8, grow: true, notes: "Priority muscle this block: full stretch at the top of every rep." }),
      R("chest-supported-row", 3, "8-12", 90, { rpe: 8 }),
      R("straight-arm-pulldown", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("rear-delt-fly", 3, "15-20", 45, { rpe: 8, iso: true, grow: true }),
      R("incline-dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Legs + Delts",
    focus: "Hack squat, hip thrust, leg isolation, then cable laterals and face pulls",
    ex: [
      R("hack-squat", 3, "8-12", 120, { rpe: 8 }),
      R("hip-thrust", 3, "8-12", 90, { rpe: 8 }),
      R("leg-extension", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("leg-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("cable-lateral-raise", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
    ],
  },
];

/** Block 2: chest and arm emphasis. */
const ADV_CHEST_ARMS: DayPlan[] = [
  {
    name: "Upper Strength",
    focus: "Heavy bench, rows, shoulder press and chin-ups, then arms",
    ex: [
      R("bench-press", 3, "5-8", 180, { rpe: 8, grow: true, notes: "Priority muscle this block." }),
      R("one-arm-dumbbell-row", 3, "8-10 per side", 75, { rpe: 8 }),
      R("seated-dumbbell-shoulder-press", 2, "8-10", 90, { rpe: 8 }),
      R("chin-up", 3, "6-10", 120, { rpe: 8 }),
      R("incline-dumbbell-curl", 3, "8-12", 60, { rpe: 8, iso: true, grow: true }),
      R("overhead-triceps-extension", 3, "10-12", 60, { rpe: 8, iso: true, grow: true }),
    ],
  },
  {
    name: "Lower Strength",
    focus: "Front squats, Romanian deadlifts, leg press, curls, calves",
    ex: [
      R("front-squat", 3, "6-8", 180, { rpe: 8 }),
      R("romanian-deadlift", 3, "8-10", 150, { rpe: 8 }),
      R("leg-press", 2, "10-15", 120, { rpe: 8 }),
      R("seated-leg-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 3, "10-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Push (Priority)",
    focus: "Chest volume: incline press, machine press, flyes, then laterals and triceps",
    ex: [
      R("incline-dumbbell-press", 3, "8-10", 90, { rpe: 8, grow: true }),
      R("machine-chest-press", 3, "10-12", 90, { rpe: 8 }),
      R("cable-chest-fly", 3, "12-15", 60, { rpe: 8, iso: true, grow: true, notes: "Deep stretch, controlled." }),
      R("lateral-raise", 3, "12-20", 45, { rpe: 8, iso: true }),
      R("triceps-pushdown", 3, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Pull",
    focus: "Pulldowns, cable rows, rear delts, biceps",
    ex: [
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8 }),
      R("seated-cable-row", 3, "10-12", 90, { rpe: 8 }),
      R("rear-delt-fly", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("hammer-curl", 3, "10-12", 60, { rpe: 8, iso: true, grow: true }),
      R("dumbbell-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Legs + Arms",
    focus: "Hack squat, hip thrust, leg isolation, then close-grip bench",
    ex: [
      R("hack-squat", 3, "8-12", 120, { rpe: 8 }),
      R("hip-thrust", 3, "8-12", 90, { rpe: 8 }),
      R("leg-extension", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("leg-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("seated-calf-raise", 3, "12-15", 45, { rpe: 8, iso: true }),
      R("close-grip-bench-press", 3, "8-10", 120, { rpe: 8 }),
    ],
  },
];

/** Block 3: leg emphasis (quads, glutes and hamstrings). */
const ADV_LEGS: DayPlan[] = [
  {
    name: "Upper Strength",
    focus: "Heavy bench, rows, overhead press and pull-ups",
    ex: [
      R("bench-press", 3, "5-8", 180, { rpe: 8 }),
      R("barbell-row", 3, "6-8", 150, { rpe: 8 }),
      R("overhead-press", 2, "6-8", 150, { rpe: 8 }),
      R("pull-up", 3, "6-10", 120, { rpe: 8 }),
      R("lateral-raise", 2, "12-20", 45, { rpe: 8, iso: true }),
      R("dumbbell-curl", 2, "8-12", 60, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Quads (Priority)",
    focus: "Back squat, leg press, leg extensions, curls, calves",
    ex: [
      R("back-squat", 4, "6-8", 180, { rpe: 8, grow: true, notes: "Priority muscle this block." }),
      R("leg-press", 3, "10-12", 120, { rpe: 8 }),
      R("leg-extension", 3, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-leg-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 3, "8-12", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Push",
    focus: "Incline press, shoulder press, flyes, cable laterals, triceps",
    ex: [
      R("incline-dumbbell-press", 3, "8-12", 90, { rpe: 8 }),
      R("seated-dumbbell-shoulder-press", 2, "8-12", 90, { rpe: 8 }),
      R("cable-chest-fly", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("cable-lateral-raise", 3, "15-20", 45, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Pull",
    focus: "Pulldowns, chest-supported rows, rear delts, biceps",
    ex: [
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8 }),
      R("chest-supported-row", 3, "8-12", 90, { rpe: 8 }),
      R("rear-delt-fly", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("incline-dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Glutes & Hamstrings (Priority)",
    focus: "Romanian deadlift, hip thrust, split squats, leg curls, calves",
    ex: [
      R("romanian-deadlift", 3, "8-10", 150, { rpe: 8, grow: true }),
      R("hip-thrust", 3, "8-12", 90, { rpe: 8, grow: true }),
      R("bulgarian-split-squat", 3, "8-12 per side", 90, { rpe: 8 }),
      R("leg-curl", 3, "10-15", 60, { rpe: 8, iso: true, grow: true }),
      R("seated-calf-raise", 3, "12-15", 45, { rpe: 8, iso: true }),
    ],
  },
];

const advBlock = (n: number, label: string, rpes: [number, number, number]): BlockWeek[] => [
  { focus: `Block ${n} (${label}), week 1 — find working weights at 2–3 reps in reserve`, add: 0, rpe: rpes[0] },
  { focus: `Block ${n} (${label}), week 2 — one extra set on the priority exercises, 1–2 reps in reserve`, add: 1, rpe: rpes[1] },
  { focus: `Block ${n} (${label}), week 3 — peak volume: two extra sets on the priority exercises, about 1 rep in reserve`, add: 2, rpe: rpes[2] },
  { focus: n === 3 ? "Deload — half the sets, easy effort; then choose your next priority" : DELOAD_FOCUS, add: 0, rpe: 6, deload: true },
];

const ADVANCED_PROGRAM = blocks(
  [ADV_BACK_DELTS, advBlock(1, "back & delts", [7.5, 8.5, 9])],
  [ADV_CHEST_ARMS, advBlock(2, "chest & arms", [8, 8.5, 9])],
  [ADV_LEGS, advBlock(3, "legs", [8, 8.5, 9])],
);

// =========================================================================== [12] Upper Body Specialization

const UPPER_SPEC_DAYS: DayPlan[] = [
  {
    name: "Upper A — Chest & Back",
    focus: "Bench press, barbell row, incline press, pulldown, laterals, biceps",
    ex: [
      R("bench-press", 3, "6-8", 150, { rpe: 8, grow: true }),
      R("barbell-row", 3, "6-10", 120, { rpe: 8, grow: true }),
      R("incline-dumbbell-press", 2, "8-12", 90, { rpe: 8 }),
      R("lat-pulldown", 3, "10-12", 90, { rpe: 8 }),
      R("lateral-raise", 2, "12-20", 45, { rpe: 8, iso: true }),
      R("dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower — Maintenance",
    focus: "Squat, Romanian deadlift, leg press, leg isolation — enough to hold your legs",
    ex: [
      R("back-squat", 3, "6-8", 180, { rpe: 8, notes: "Maintenance: same weights or slightly heavier than before the program; no need to chase records." }),
      R("romanian-deadlift", 3, "8-10", 120, { rpe: 8 }),
      R("leg-press", 2, "10-12", 120, { rpe: 8 }),
      R("leg-extension", 2, "12-15", 60, { rpe: 8, iso: true }),
      R("seated-leg-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("standing-calf-raise", 2, "10-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper B — Shoulders & Arms",
    focus: "Overhead press, chin-ups, cable laterals, face pulls, arms",
    ex: [
      R("overhead-press", 3, "6-8", 150, { rpe: 8, grow: true }),
      R("chin-up", 3, "6-10", 120, { rpe: 8, grow: true, notes: "Band-assisted if needed; add weight past 10." }),
      R("cable-lateral-raise", 3, "12-20", 45, { rpe: 8, iso: true, grow: true }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("incline-dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper C — Volume",
    focus: "Dumbbell bench, cable row, shoulder press, flyes, rear delts, arms",
    ex: [
      R("dumbbell-bench-press", 3, "10-12", 90, { rpe: 8 }),
      R("seated-cable-row", 3, "10-12", 90, { rpe: 8 }),
      R("seated-dumbbell-shoulder-press", 2, "10-12", 90, { rpe: 8 }),
      R("cable-chest-fly", 2, "12-15", 60, { rpe: 8, iso: true, grow: true }),
      R("rear-delt-fly", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "10-15", 60, { rpe: 8, iso: true }),
      R("hammer-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
    ],
  },
];

const UPPER_SPEC_WEEKS: BlockWeek[] = [
  { focus: "Block 1, week 1 — find your working weights at about 3 reps in reserve", add: 0, rpe: 7 },
  { focus: "Block 1, week 2 — one extra set on key upper-body exercises, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: "Block 1, week 3 — two extra sets on key exercises, 1–2 reps in reserve", add: 2, rpe: 8.5 },
  { focus: DELOAD_FOCUS, add: 0, rpe: 6, deload: true },
  { focus: "Block 2, week 1 — start a set higher than block 1 at 2–3 reps in reserve, a little heavier", add: 1, rpe: 7.5 },
  { focus: "Block 2, week 2 — about 2 reps in reserve: beat block 1's numbers", add: 1, rpe: 8.5 },
  { focus: "Block 2, week 3 — peak volume, about 1 rep in reserve (isolation can reach failure)", add: 2, rpe: 9 },
  { focus: "Deload — half the sets, easy effort; then return to a balanced program", add: 0, rpe: 6, deload: true },
];

const UPPER_SPEC_PROGRAM = blocks([UPPER_SPEC_DAYS, UPPER_SPEC_WEEKS]);

// =========================================================================== [13] Lower Body and Glute Development

const GLUTE_WARMUP = [...STANDARD_WARMUP.slice(0, 4), "Glute bridges × 10 and banded side steps × 10 per side", "2–3 ramp-up sets of your first lift"];

const LOWER_BLOCK_1: DayPlan[] = [
  {
    name: "Lower A — Glute Strength",
    focus: "Heavy hip thrusts, squats and Romanian deadlifts",
    ex: [
      R("hip-thrust", 4, "6-10", 120, { rpe: 8, grow: true, notes: "Pause 1 s at the top, ribs down, chin tucked." }),
      R("back-squat", 3, "6-8", 180, { rpe: 8 }),
      R("romanian-deadlift", 3, "8-10", 120, { rpe: 8 }),
      R("hip-abduction", 2, "12-20", 45, { rpe: 8, iso: true }),
      R("standing-calf-raise", 2, "10-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper A",
    focus: "Dumbbell bench, pulldown, shoulder press, cable row, laterals",
    ex: [
      R("dumbbell-bench-press", 3, "8-12", 90, { rpe: 8 }),
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8 }),
      R("seated-dumbbell-shoulder-press", 2, "8-12", 90, { rpe: 8 }),
      R("seated-cable-row", 2, "10-12", 90, { rpe: 8 }),
      R("lateral-raise", 2, "12-20", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower B — Quads & Glute Volume",
    focus: "Split squats, leg press, back extensions, leg curls, leg extensions",
    ex: [
      R("bulgarian-split-squat", 3, "8-12 per side", 90, { rpe: 8, grow: true, notes: "A slight forward lean and a long stride bias the glutes." }),
      R("leg-press", 3, "10-15", 120, { rpe: 8 }),
      R("back-extension", 2, "12-15", 60, { rpe: 8, notes: "Round the upper back slightly and squeeze the glutes to bias them over the low back." }),
      R("seated-leg-curl", 3, "10-15", 60, { rpe: 8, iso: true, grow: true }),
      R("leg-extension", 2, "12-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper B",
    focus: "Incline press, one-arm row, face pulls, arms",
    ex: [
      R("incline-dumbbell-press", 3, "8-12", 90, { rpe: 8 }),
      R("one-arm-dumbbell-row", 3, "8-12 per side", 75, { rpe: 8 }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("dumbbell-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
      R("triceps-pushdown", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
];

const LOWER_BLOCK_2: DayPlan[] = [
  {
    name: "Lower A — Glute Strength",
    focus: "Hip thrusts, hack squats, heavier Romanian deadlifts, abduction",
    ex: [
      R("hip-thrust", 4, "6-8", 120, { rpe: 8, grow: true, notes: "Heavier than block 1. Pause 1 s at the top." }),
      R("hack-squat", 3, "8-12", 120, { rpe: 8 }),
      R("romanian-deadlift", 3, "6-8", 150, { rpe: 8 }),
      R("hip-abduction", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("seated-calf-raise", 2, "12-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper A",
    focus: "Machine press, chin-ups, shoulder press, chest-supported row, laterals",
    ex: [
      R("machine-chest-press", 3, "10-12", 90, { rpe: 8 }),
      R("band-assisted-pull-up", 3, "6-10", 120, { rpe: 8, notes: "Use a lighter band as you improve; bodyweight once you manage 3 × 6." }),
      R("seated-dumbbell-shoulder-press", 2, "10-12", 90, { rpe: 8 }),
      R("chest-supported-row", 2, "10-12", 90, { rpe: 8 }),
      R("cable-lateral-raise", 3, "15-20", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Lower B — Quads & Glute Volume",
    focus: "Walking lunges, back squats, back extensions, leg curls, leg extensions",
    ex: [
      R("walking-lunge", 3, "10-12 per side", 90, { rpe: 8, grow: true, notes: "Long steps, torso slightly forward for more glute." }),
      R("back-squat", 3, "8-10", 150, { rpe: 8, notes: "Lighter, higher-rep squats than block 1." }),
      R("back-extension", 2, "12-15", 60, { rpe: 8 }),
      R("leg-curl", 3, "10-15", 60, { rpe: 8, iso: true, grow: true }),
      R("leg-extension", 2, "12-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Upper B",
    focus: "Dumbbell bench, cable row, rear delts, arms",
    ex: [
      R("dumbbell-bench-press", 3, "8-12", 90, { rpe: 8 }),
      R("seated-cable-row", 3, "10-12", 90, { rpe: 8 }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("hammer-curl", 2, "10-12", 60, { rpe: 8, iso: true }),
      R("overhead-triceps-extension", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
];

const LOWER_WEEKS_1: BlockWeek[] = [
  { focus: "Block 1, week 1 — find your working weights at about 3 reps in reserve", add: 0, rpe: 7 },
  { focus: "Block 1, week 2 — same sets, about 2 reps in reserve: add reps or load", add: 0, rpe: 8 },
  { focus: "Block 1, week 3 — one extra set on hip thrusts, split squats and leg curls, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: "Block 1, week 4 — two extra sets on the key lower-body lifts, 1–2 reps in reserve", add: 2, rpe: 8.5 },
  { focus: DELOAD_FOCUS, add: 0, rpe: 6, deload: true },
];

const LOWER_WEEKS_2: BlockWeek[] = [
  { focus: "Block 2, week 1 — new variations: find their working weights at 2–3 reps in reserve", add: 0, rpe: 7.5 },
  { focus: "Block 2, week 2 — one extra set on the key lower-body lifts, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: "Block 2, week 3 — keep the extra set, 1–2 reps in reserve: beat last week", add: 1, rpe: 8.5 },
  { focus: "Block 2, week 4 — peak volume: two extra sets, about 1 rep in reserve", add: 2, rpe: 9 },
  { focus: "Deload — half the sets, easy effort; then start a new cycle a little heavier", add: 0, rpe: 6, deload: true },
];

const LOWER_GLUTE_PROGRAM = blocks([LOWER_BLOCK_1, LOWER_WEEKS_1], [LOWER_BLOCK_2, LOWER_WEEKS_2]);

// =========================================================================== [14] Arms and Shoulders Specialization

const ARMS_DAYS: DayPlan[] = [
  {
    name: "Shoulders & Arms A",
    focus: "Overhead press, chin-ups, lateral raises, incline curls, overhead extensions",
    ex: [
      R("overhead-press", 3, "6-8", 150, { rpe: 8, grow: true }),
      R("chin-up", 3, "6-10", 120, { rpe: 8, grow: true, notes: "Band-assisted if needed; add weight past 10." }),
      R("lateral-raise", 3, "12-20", 45, { rpe: 8, iso: true, grow: true }),
      R("incline-dumbbell-curl", 3, "8-12", 60, { rpe: 8, iso: true, grow: true, notes: "Arms hang behind you — a lengthened-position curl." }),
      R("overhead-triceps-extension", 3, "10-12", 60, { rpe: 8, iso: true, grow: true, notes: "Overhead position trains the long head at long lengths." }),
    ],
  },
  {
    name: "Lower & Chest — Maintenance",
    focus: "Squat, Romanian deadlift, dumbbell bench, calves",
    ex: [
      R("back-squat", 3, "6-8", 180, { rpe: 8, notes: "Maintenance: hold your usual weights; no need to chase records." }),
      R("romanian-deadlift", 3, "8-10", 120, { rpe: 8 }),
      R("dumbbell-bench-press", 3, "8-12", 90, { rpe: 8 }),
      R("standing-calf-raise", 2, "10-15", 45, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Shoulders & Arms B",
    focus: "Shoulder press, close-grip bench, cable laterals, rear delts, hammer curls, pushdowns",
    ex: [
      R("seated-dumbbell-shoulder-press", 3, "8-12", 90, { rpe: 8 }),
      R("close-grip-bench-press", 3, "6-10", 150, { rpe: 8, grow: true }),
      R("cable-lateral-raise", 3, "15-20", 45, { rpe: 8, iso: true }),
      R("rear-delt-fly", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("hammer-curl", 3, "10-12", 60, { rpe: 8, iso: true, grow: true }),
      R("triceps-pushdown", 3, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
  {
    name: "Back & Legs — Maintenance",
    focus: "Leg press, pulldown, chest-supported row, incline press, leg curls, curls",
    ex: [
      R("leg-press", 3, "10-15", 120, { rpe: 8 }),
      R("lat-pulldown", 3, "8-12", 90, { rpe: 8 }),
      R("chest-supported-row", 3, "8-12", 90, { rpe: 8 }),
      R("incline-dumbbell-press", 2, "8-12", 90, { rpe: 8 }),
      R("seated-leg-curl", 3, "10-15", 60, { rpe: 8, iso: true }),
      R("face-pull", 2, "15-20", 45, { rpe: 8, iso: true }),
      R("dumbbell-curl", 2, "10-15", 60, { rpe: 8, iso: true }),
    ],
  },
];

const ARMS_WEEKS: BlockWeek[] = [
  { focus: "Block 1, week 1 — find your working weights at about 3 reps in reserve", add: 0, rpe: 7 },
  { focus: "Block 1, week 2 — one extra set on the arm and shoulder priorities, about 2 reps in reserve", add: 1, rpe: 8 },
  { focus: "Block 1, week 3 — two extra sets on the priorities, 1–2 reps in reserve", add: 2, rpe: 8.5 },
  { focus: DELOAD_FOCUS, add: 0, rpe: 6, deload: true },
  { focus: "Block 2, week 1 — start a set higher than block 1, 2–3 reps in reserve, a little heavier", add: 1, rpe: 7.5 },
  { focus: "Block 2, week 2 — about 2 reps in reserve: beat block 1's reps on the arm work", add: 1, rpe: 8.5 },
  { focus: "Block 2, week 3 — peak volume, about 1 rep in reserve (isolation can reach failure)", add: 2, rpe: 9 },
  { focus: "Deload — half the sets, easy effort; then return to a balanced program", add: 0, rpe: 6, deload: true },
];

const ARMS_PROGRAM = blocks([ARMS_DAYS, ARMS_WEEKS]);

// =========================================================================== Shared instructions

const LOAD_BY_RIR =
  "Choose loads by reps in reserve (RIR), not by a number on a sheet: in week 1 pick a weight you could lift for about 3 more reps than prescribed at the end of each set (RPE 7). " +
  "If you finish with more in reserve than the week asks, go heavier next set; if you hit failure early, go lighter.";
const DOUBLE_PROGRESSION =
  "Use double progression: stay at a weight until every set reaches the top of its rep range at the week's reps-in-reserve target, then add the smallest jump available (about 2.5 kg / 5 lb on barbells, the next dumbbell or pin on machines).";

// =========================================================================== Programs

export const CATALOG_HYPERTROPHY: ProgramSeed[] = [
  {
    slug: "beginner-muscle-builder",
    name: "Beginner Muscle Builder",
    summary: "Three full-body sessions a week on machines, dumbbells and cables, plus squats and Romanian deadlifts — your first eight weeks of building muscle.",
    description:
      "Goal: build muscle and learn the core gym movements with a plan that is simple to follow. Each full-body session trains every major muscle " +
      "with about 9–11 hard sets a week for most major muscles to start, rising to about 11–15 by the end, because weekly hard sets taken close to failure are the main " +
      "driver of growth and training each muscle two to three times a week is a sensible default. Mostly machines, dumbbells and cables (easy to learn and " +
      "adjust) with two barbell lifts — the back squat and Romanian deadlift — to practise. For people new to lifting or returning after a long break.",
    category: "hypertrophy",
    types: ["hypertrophy"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: 45,
    goals: ["build_muscle", "general_health", "build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine"],
    tier: "pro",
    progression:
      "Double progression: add reps until every set reaches the top of the range, then add the smallest load jump. Two four-week blocks: effort rises from " +
      "about 3 reps in reserve to 1–2, the main lifts gain a set in weeks 3, 5–6 and two sets in week 7, and weeks 4 and 8 are deloads with half the sets.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: BEGINNER_PROGRAM[0]!.days,
    weekTemplates: BEGINNER_PROGRAM,
    milestones: [
      "Completed all three sessions and written down a working weight for every exercise",
      "Added a rep or a little load to most exercises compared with week 1",
      "Handled the extra set on the main lifts with clean form",
      "Deload done — you should feel fresher going into block 2",
      "Started block 2 slightly heavier than week 1 on most lifts",
      "Beat your week 3 reps or loads on the leg press, bench and rows",
      "Completed the peak week: your heaviest and highest-volume week so far",
      "Finished the program — compare week 7 with week 1 and pick your next block",
    ],
    instructions: [
      "Train three non-consecutive days, e.g. Mon/Wed/Fri, doing Full Body A, B and C in order.",
      LOAD_BY_RIR,
      DOUBLE_PROGRESSION,
      "Missed a session? Do the next session in order when you're back — don't squeeze two into one day. Miss most of a week and repeat that week.",
      "If a week left you sore into the next session or your form slipped, repeat it before moving on. New to the squat? Practise with a light bar or use the leg press until it feels steady.",
    ],
    catalogNumber: 8,
  },
  {
    slug: "upper-lower-hypertrophy-12-week",
    name: "Upper/Lower Hypertrophy",
    summary: "Four sessions a week for 12 weeks: three mesocycles of three loading weeks and a deload, with new exercise variations each mesocycle.",
    description:
      "Goal: steady muscle gain for lifters past the beginner stage. Each muscle is trained twice a week on an upper/lower split with roughly 9–16 hard sets " +
      "per major muscle in the first week of each mesocycle, building to about 12–20 by its third week as reps in reserve fall from about 3 to 1. Every " +
      "four weeks the exercise variations rotate (barbell to dumbbell bench, back squat to hack squat to front squat, and so on) to train muscles through " +
      "different ranges and keep progress measurable. For intermediates with access to a full gym.",
    category: "hypertrophy",
    types: ["hypertrophy"],
    difficulty: "intermediate",
    weeks: 12,
    sessionMinutes: 50,
    goals: ["build_muscle", "build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar"],
    tier: "pro",
    progression:
      "Three four-week mesocycles. In each, week 1 sets the working weights (about 3 reps in reserve), week 2 adds a set to key exercises, week 3 adds a " +
      "second set at about 1 rep in reserve, and week 4 deloads. Double progression within each mesocycle; later mesocycles start a little harder.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: UPPER_LOWER_PROGRAM[0]!.days,
    weekTemplates: UPPER_LOWER_PROGRAM,
    milestones: [
      "Working weights recorded for every mesocycle 1 exercise",
      "Handled the extra set on key exercises and matched or beat week 1's reps",
      "Completed the first peak week at about 1 rep in reserve",
      "Deload done — mesocycle 1 complete",
      "Working weights found for the new mesocycle 2 variations",
      "Added reps or load on most mesocycle 2 exercises",
      "Completed the second peak week",
      "Deload done — two-thirds of the way through",
      "Back on barbell bench and pull-ups: matched or beat your mesocycle 1 numbers",
      "Added reps or load on most mesocycle 3 exercises",
      "Completed the final peak week — your highest-volume week of the program",
      "Program complete: compare mesocycle 3 with mesocycle 1 on the lifts that repeat",
    ],
    instructions: [
      "Train four days a week with a rest day after every two, e.g. Mon/Tue/Thu/Fri (Upper A, Lower A, Upper B, Lower B).",
      LOAD_BY_RIR,
      DOUBLE_PROGRESSION,
      "Missed a session? Pick up with the next one in order and let the week run a day long; don't double up. Miss two or more sessions in a week and repeat that week.",
      "Repeat a loading week (rather than adding sets) if you couldn't reach the target reps in reserve on most exercises or recovery is poor. When the variations change, start conservatively — new movements take a session or two to settle.",
    ],
    catalogNumber: 9,
  },
  {
    slug: "push-pull-legs-12-week",
    name: "Push/Pull/Legs",
    summary: "Push, pull and legs twice a week for 12 weeks: two six-week blocks that build volume and end in deloads, with a 3-day option.",
    description:
      "Goal: muscle gain with high frequency. Each muscle is trained twice a week across six focused sessions with about 10–17 hard sets per major muscle " +
      "in week 1, rising to about 14–21 by each block's peak week. Block 2 rotates the main variations (incline-led push days, chin-ups, front squats and " +
      "hack squats). For intermediates who can train most days; there is a 3-day option for busier weeks.",
    category: "hypertrophy",
    types: ["hypertrophy"],
    difficulty: "intermediate",
    weeks: 12,
    sessionMinutes: 45,
    goals: ["build_muscle"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar"],
    tier: "pro",
    progression:
      "Two six-week blocks. Block 1 holds sets for two weeks while effort rises, then adds a set to key exercises in weeks 3–4 and two in week 5; week 6 " +
      "deloads. Block 2 starts a little harder, adds sets sooner and peaks in week 11; week 12 deloads. Double progression throughout.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: PPL_PROGRAM[0]!.days,
    weekTemplates: PPL_PROGRAM,
    milestones: [
      "Working weights recorded for all six sessions",
      "Added reps or load on most exercises at the same sets",
      "Handled the extra set on key exercises",
      "Kept the extra set at 1–2 reps in reserve with clean technique",
      "Completed block 1's peak week",
      "Deload done — block 1 complete",
      "Working weights found for the block 2 variations",
      "Handled the extra set on key exercises in block 2",
      "Added reps or load on most block 2 exercises",
      "Completed two extra sets on key exercises",
      "Completed the final peak week — your highest-volume week of the program",
      "Program complete: compare bench, overhead press and rows with block 1",
    ],
    instructions: [
      "Six days a week: Push A, Pull A, Legs A, Push B, Pull B, Legs B, then a rest day (e.g. Mon–Sat, Sunday off). You can also rest after the first three days and finish the week on day 8.",
      "Short on time? Run it 3 days a week (e.g. Mon/Wed/Fri), doing Push, Pull and Legs once each — the A days one week and the B days the next. Each muscle then gets about half the weekly sets (roughly 6–10), which maintains muscle and still builds it slowly; return to six days when you can.",
      LOAD_BY_RIR,
      DOUBLE_PROGRESSION,
      "Missed a session? Do the next one in order and let the week run a day long. Miss two or more and repeat the week. Repeat a week, too, if you couldn't reach the target reps in reserve or recovery is poor.",
    ],
    completion:
      "Complete at least 80% of the 72 sessions — 58 or more — including the final week. On the 3-day option, complete at least 29 of the 36 sessions you schedule, including the final week.",
    catalogNumber: 10,
  },
  {
    slug: "advanced-bodybuilding-5-day",
    name: "Advanced Bodybuilding",
    summary: "Five days a week for experienced lifters: three four-week blocks, each prioritising different muscles — back and delts, then chest and arms, then legs.",
    description:
      "Goal: keep growing when you've been training for years. Experienced lifters often progress best by giving one or two muscle groups extra volume " +
      "for a block while the rest stay at a solid working level, then rotating. Block 1 prioritises back and delts, block 2 chest and arms, block 3 quads, " +
      "glutes and hamstrings. Priority muscles start around 13–16 hard sets a week and climb to about 17–23 by each block's peak; other major muscles hold at about 8–13. Upper and lower strength " +
      "days keep heavy compounds in the week. No extreme intensity techniques — every set is a straight set taken close to, not past, technical failure. " +
      "For advanced lifters with good recovery and a full gym.",
    category: "hypertrophy",
    types: ["hypertrophy", "strength"],
    difficulty: "advanced",
    weeks: 12,
    sessionMinutes: 45,
    goals: ["build_muscle", "build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar"],
    tier: "pro",
    needsSpecialistReview: false,
    progression:
      "Three four-week blocks. In each, week 1 sets weights at 2–3 reps in reserve, week 2 adds a set to the priority exercises, week 3 adds a second set at " +
      "about 1 rep in reserve, week 4 deloads. Double progression on everything; strength-day compounds add load when every set reaches the top of 5–8.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: ADVANCED_PROGRAM[0]!.days,
    weekTemplates: ADVANCED_PROGRAM,
    milestones: [
      "Working weights set for block 1; priority exercises (pulldowns, rows, laterals, rear delts) logged",
      "Handled the extra set on the back and delt priorities",
      "Completed block 1's peak week at about 1 rep in reserve",
      "Deload done — back and delt block complete",
      "Working weights set for block 2 (chest and arms priority)",
      "Handled the extra set on chest and arm priorities",
      "Completed block 2's peak week",
      "Deload done — chest and arm block complete",
      "Working weights set for block 3 (leg priority)",
      "Handled the extra set on squats, leg extensions and the glute and hamstring work",
      "Completed block 3's peak week",
      "Program complete: compare your bench, rows and squats with week 1 and choose your next priority",
    ],
    instructions: [
      "Five days a week: Upper Strength, Lower Strength, rest, Push, Pull, Legs, rest — e.g. Mon/Tue/Thu/Fri/Sat.",
      LOAD_BY_RIR,
      DOUBLE_PROGRESSION,
      "Missed a session? Keep the priority day for that block (marked Priority) and drop a non-priority day rather than cramming two into one. Miss more than two sessions and repeat the week.",
      "Recovery decides the pace: if performance drops two sessions running on the same exercise, or joints ache, repeat the week without the extra sets or take the deload early. Want a different order of priorities? Run the blocks in any order.",
    ],
    catalogNumber: 11,
  },
  {
    slug: "upper-body-specialization",
    name: "Upper Body Specialization",
    summary: "Eight weeks of three upper-body days and one leg maintenance day: chest, back and shoulders build to about 14–20 hard sets a week.",
    description:
      "Goal: bring up the chest, back, shoulders and arms when the upper body lags behind the legs. Three upper sessions train each upper muscle two to three " +
      "times a week, starting around 10–15 hard sets and building to about 14–20, while one lower session keeps legs at maintenance volume (about 7–8 sets) " +
      "so you don't lose what you've built. For intermediates; run it for one or two blocks, then return to a balanced program.",
    category: "hypertrophy",
    types: ["hypertrophy"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 50,
    goals: ["build_muscle"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar"],
    tier: "pro",
    progression:
      "Two four-week blocks. Upper-body key exercises gain one set in week 2 and two in week 3 as reps in reserve fall from about 3 to 1–2; block 2 starts a " +
      "set higher and peaks at about 1 rep in reserve. Leg work stays at maintenance sets throughout. Weeks 4 and 8 deload.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: UPPER_SPEC_PROGRAM[0]!.days,
    weekTemplates: UPPER_SPEC_PROGRAM,
    milestones: [
      "Working weights recorded for all four sessions",
      "Handled the extra set on bench, rows, overhead press and chin-ups",
      "Completed block 1's peak week",
      "Deload done — block 1 complete",
      "Started block 2 a set higher and slightly heavier than week 1",
      "Beat your block 1 numbers on most upper-body lifts",
      "Completed the peak week at about 1 rep in reserve",
      "Program complete: compare upper-body lifts with week 1, then return to balanced training",
    ],
    instructions: [
      "Four days a week, e.g. Mon (Upper A), Tue (Lower), Thu (Upper B), Sat (Upper C) — keep at least one rest day between Upper B and Upper C.",
      LOAD_BY_RIR,
      DOUBLE_PROGRESSION,
      "On the leg day, use weights you already know at the prescribed effort — the aim is to hold leg size and strength, not to set records.",
      "Missed a session? Do the next upper day in order; if you miss the leg day, add it to the next free day rather than skipping it all week. Miss two or more sessions and repeat the week.",
    ],
    catalogNumber: 12,
  },
  {
    slug: "lower-body-glute-development",
    name: "Lower Body and Glute Development",
    summary: "Ten weeks, two lower-body days and two upper days a week: glutes, hamstrings and quads get most of the volume and build through two blocks, with a 3-day option.",
    description:
      "Goal: bigger, stronger glutes and legs, for anyone. Lower days pair heavy hip thrusts, squats and Romanian deadlifts with split squats, lunges, back " +
      "extensions, abduction and leg curls, so glutes and hamstrings (counted together) start around 17–18 hard sets a week and quads around 11, building into the low 20s and to about 13 by each block's peak. " +
      "Two upper days keep chest, back and shoulders at a productive maintenance level (about 6–10 sets). Two five-week blocks, each ending in a deload; " +
      "block 2 rotates variations. For intermediates.",
    category: "hypertrophy",
    types: ["hypertrophy", "strength"],
    difficulty: "intermediate",
    weeks: 10,
    sessionMinutes: 45,
    goals: ["build_muscle", "build_strength"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar", "band"],
    tier: "pro",
    progression:
      "Two five-week blocks. Hip thrusts, split squats or lunges, and leg curls gain one set in week 3 and two in week 4 (block 2: one set in weeks 7–8, two " +
      "in week 9) as reps in reserve fall from about 3 to 1. Double progression throughout; weeks 5 and 10 deload.",
    progressionModel: "volume_wave",
    warmup: GLUTE_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: LOWER_GLUTE_PROGRAM[0]!.days,
    weekTemplates: LOWER_GLUTE_PROGRAM,
    milestones: [
      "Working weights recorded for every exercise, including your hip thrust",
      "Added reps or load to the hip thrust and squat at the same sets",
      "Handled the extra set on hip thrusts, split squats and leg curls",
      "Completed block 1's peak week",
      "Deload done — block 1 complete",
      "Working weights found for the block 2 variations",
      "Handled the extra set on the key lower-body lifts",
      "Beat last week's hip thrust reps or load",
      "Completed the peak week at about 1 rep in reserve",
      "Program complete: compare hip thrust and Romanian deadlift numbers with block 1",
    ],
    instructions: [
      "Four days a week: Lower A, Upper A, rest, Lower B, Upper B — e.g. Mon/Tue/Thu/Fri.",
      "3-day option: keep both lower days and alternate the upper days week to week (e.g. Mon Lower A, Wed Upper A or B, Fri Lower B). Leg volume stays the same; upper-body volume halves, so expect upper-body progress to stall while your legs keep building.",
      LOAD_BY_RIR,
      DOUBLE_PROGRESSION,
      "Missed a session? Prioritise the lower days — do the missed lower day next and skip an upper day if you must. Miss two or more sessions and repeat the week; repeat it too if your reps in reserve drifted well off target.",
    ],
    completion:
      "Complete at least 80% of the 40 sessions — 32 or more — including the final week. On the 3-day option, complete at least 24 of the 30 sessions you schedule, including the final week.",
    catalogNumber: 13,
  },
  {
    slug: "arms-shoulders-specialization",
    name: "Arms and Shoulders Specialization",
    summary: "Eight weeks, four days: delts, biceps and triceps get two dedicated days a week, while chest, back and legs stay at maintenance volume.",
    description:
      "Goal: bigger arms and shoulders. Two sessions a week are built around overhead pressing, lateral and rear-delt work, curls and triceps extensions " +
      "(including lengthened-position incline curls and overhead extensions), with delts starting near 17 hard sets a week (about 21 at the peak) and arms around 10–14 (about 15–19 at the peak), " +
      "counting presses and pulls as half-sets for the arms. Two maintenance sessions keep chest, back and legs at about 6–12 sets so you hold what you've built. For intermediates; " +
      "run it for one or two blocks, then return to a balanced program.",
    category: "hypertrophy",
    types: ["hypertrophy"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: 50,
    goals: ["build_muscle"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "cable", "machine", "pull_up_bar"],
    tier: "pro",
    progression:
      "Two four-week blocks. Arm and shoulder priorities gain one set in week 2 and two in week 3 as reps in reserve fall from about 3 to 1–2; block 2 starts " +
      "a set higher and peaks at about 1 rep in reserve. Chest, back and leg work stays at maintenance sets. Weeks 4 and 8 deload.",
    progressionModel: "volume_wave",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: ARMS_PROGRAM[0]!.days,
    weekTemplates: ARMS_PROGRAM,
    milestones: [
      "Working weights recorded for all four sessions",
      "Handled the extra set on presses, laterals, curls and extensions",
      "Completed block 1's peak week",
      "Deload done — block 1 complete",
      "Started block 2 a set higher and slightly heavier than week 1",
      "Beat your block 1 reps on curls, extensions and lateral raises",
      "Completed the peak week at about 1 rep in reserve",
      "Program complete: compare overhead press, close-grip bench and curls with week 1",
    ],
    instructions: [
      "Four days a week, e.g. Mon (Shoulders & Arms A), Tue (Lower & Chest), Thu (Shoulders & Arms B), Sat (Back & Legs) — keep at least two days between the two arm days.",
      LOAD_BY_RIR,
      DOUBLE_PROGRESSION,
      "Small muscles progress in small steps: on curls, lateral raises and extensions add reps first, and move up only when every set reaches the top of the range. On maintenance days use weights you already know.",
      "Missed a session? Do the next one in order; if you miss an arm day, do it before the next maintenance day. Miss two or more sessions and repeat the week.",
    ],
    catalogNumber: 14,
  },
];
