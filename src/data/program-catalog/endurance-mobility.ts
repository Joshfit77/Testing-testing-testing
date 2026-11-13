import type { ProgramDaySeed, ProgramSeed, ProgramWeekSeed } from "../programs";
import { CONDITIONING_WARMUP, R, STANDARD_COOLDOWN, STANDARD_WARMUP, T, day, joinNotes, secondsLabel, toFive, weeksOf, type BuildEx } from "../program-builders";

/**
 * Pro catalog additions (2026-11): endurance, conditioning, mobility, core and recovery programs. Slugs are permanent.
 * Every week is written out explicitly (weekTemplates) so the progression is visible and testable.
 */

/** Stated session length: the mean of week 1's computed day lengths, to the nearest 5 minutes. */
const meanMinutes = (days: ProgramDaySeed[]) => toFive(days.reduce((s, d) => s + d.minutes, 0) / days.length);

// =========================================================================== 22 · Beginner Run/Walk to 5K

const RW_WARMUP = ["5 minutes brisk walking", "Leg swings × 10 each leg", "Ankle circles × 10 each direction"];
const RW_COOLDOWN = ["5 minutes easy walking", "Calf stretch — 30 seconds per side", "Standing quad stretch — 30 seconds per side"];
const WALK_ONLY = "Walking-only option: walk fast for the run portions and easily for the breaks.";

/** [run seconds, walk seconds, rounds]; walk 0 = one continuous run. */
type RunWalk = readonly [number, number, number];

/**
 * Ten weeks, three sessions a week. Weekly running time (the running portions only) goes 28 → 30.5 → 33 → (28) → 36 → 39 →
 * 44 → (34) → 50 → 57 minutes: no more than about 10–15% above the previous full week, with lighter weeks 4 and 8.
 */
const RUN_WALK_PLAN: { sessions: [RunWalk, RunWalk, RunWalk]; lighter?: boolean }[] = [
  { sessions: [[60, 90, 9], [60, 90, 9], [60, 90, 10]] },
  { sessions: [[75, 75, 8], [75, 75, 8], [90, 90, 7]] },
  { sessions: [[90, 60, 7], [90, 60, 7], [120, 90, 6]] },
  { sessions: [[90, 90, 6], [90, 90, 6], [120, 90, 5]], lighter: true },
  { sessions: [[120, 75, 6], [120, 75, 6], [180, 90, 4]] },
  { sessions: [[180, 60, 4], [180, 60, 4], [300, 120, 3]] },
  { sessions: [[240, 60, 3], [240, 60, 3], [600, 120, 2]] },
  { sessions: [[180, 90, 3], [180, 90, 3], [480, 120, 2]], lighter: true },
  { sessions: [[300, 60, 3], [300, 60, 3], [1200, 0, 1]] },
  { sessions: [[720, 0, 1], [900, 0, 1], [1800, 0, 1]] },
];

function runWalkExercise([run, walk, rounds]: RunWalk): BuildEx {
  if (walk === 0)
    return T("zone-2-run", 1, run, 0, {
      rpe: 4,
      notes: `${secondsLabel(run)} of continuous easy running — slow enough to talk in full sentences. A short walk break is fine; then carry on. ${WALK_ONLY}`,
    });
  return T("run-walk-intervals", rounds, run, walk, {
    rpe: 4,
    notes: `Run ${secondsLabel(run)} at an easy, conversational pace, then walk briskly for ${secondsLabel(walk)} (the rest). ${rounds} rounds. ${WALK_ONLY}`,
  });
}

function beginnerRunWalkWeeks(): ProgramWeekSeed[] {
  return RUN_WALK_PLAN.map(({ sessions, lighter }, i): ProgramWeekSeed => {
    const w = i + 1;
    const name = (s: RunWalk, n: number) => (s[1] === 0 ? (n === 3 ? "Longest Continuous Run" : `Continuous Run ${n}`) : n === 3 ? "Run/Walk 3 (Longer Bouts)" : `Run/Walk ${n}`);
    const days = sessions.map((s, si) =>
      day(name(s, si + 1), s[1] === 0 ? "Continuous easy running" : si === 2 ? "The week's longest running bouts — still easy" : "Easy running with walking breaks", [runWalkExercise(s)], { warmup: RW_WARMUP, cooldown: RW_COOLDOWN }),
    );
    if (lighter) return { focus: `Lighter week ${w}: shorter running bouts and fewer rounds — let your legs catch up with your lungs`, isDeload: true, days };
    if (w === 10) return { focus: "Goal week: two shorter continuous runs, then 30 minutes (about 5 km for many beginners) without stopping", days };
    if (w === 1) return { focus: "Week 1: one-minute easy runs with 90-second walks — find a pace slow enough to talk", days };
    return { focus: `Week ${w}: a little more running, a little less walking — repeat this week if the last session felt hard`, days };
  });
}

// =========================================================================== 27 · Hybrid Strength + Running

const HYBRID_RUN_WARMUP = ["5 minutes brisk walking or very easy jogging", "Leg swings × 10 each leg", "Ankle circles × 10 each direction", "3 relaxed 20-second strides"];
const HYBRID_RUN_COOLDOWN = ["5 minutes walking", "Calf stretch — 30 seconds per side", "Hip flexor stretch — 30 seconds per side"];

/** Long-run minutes per week: about 10% more per loading week, lighter in weeks 4, 8 and 12. */
const HYBRID_LONG = [40, 44, 48, 30, 50, 54, 58, 36, 54, 58, 62, 36];

function hybridQuality(w: number, deload: boolean): BuildEx {
  if (deload) return T("running-intervals", 4, 30, 90, { rpe: 6, notes: "Lighter week: 4 relaxed 30-second strides, full recovery jog between." });
  const k = (w - 1) % 4;
  if (w <= 4) return T("running-intervals", 6 + k, 60, 90, { rpe: 8, notes: "60 s hard but controlled (up a gentle hill if you have one), 90 s easy jog or walk back." });
  if (w <= 8) return T("running-intervals", 4 + k, 180, 120, { rpe: 8, notes: "3 minutes at about 5K–10K effort, 2 minutes easy jog. Even pacing: the last rep no faster than the first." });
  const [sets, secs] = ([[2, 480], [2, 600], [3, 480]] as const)[k]!;
  return T("running-intervals", sets, secs, 120, { rpe: 7.5, notes: `Threshold: ${secondsLabel(secs)} 'comfortably hard' — a pace you could hold for about an hour — then 2 minutes easy.` });
}

function hybridStrengthRunWeeks(): ProgramWeekSeed[] {
  return weeksOf(12, (w) => {
    const block = w <= 4 ? 0 : w <= 8 ? 1 : 2;
    const k = (w - 1) % 4;
    const deload = k === 3;
    const reps = ["6", "5", "3"][block]!;
    const rpe = deload ? 6 : [[7, 7.5, 8], [7.5, 8, 8.5], [8, 8.5, 9]][block]![k]!;
    const mainSets = deload ? 2 : 4;
    const accSets = deload ? 2 : 3;
    const accRpe = deload ? 6 : 7 + 0.5 * k;
    const dn = deload ? "Lighter week: about 60% of your recent working weights; every rep smooth and fast." : undefined;
    const long = HYBRID_LONG[w - 1]!;
    const strength = { warmup: STANDARD_WARMUP, cooldown: STANDARD_COOLDOWN };
    const run = { warmup: HYBRID_RUN_WARMUP, cooldown: HYBRID_RUN_COOLDOWN };
    const days = [
      day("Mon · Lower Strength", "Squat and hinge — the week's heavy leg day", [
        R("back-squat", mainSets, reps, 180, { rpe, notes: joinNotes("Main lift. Heavy legs today, so Wednesday's intervals get two days' recovery.", dn) }),
        R("romanian-deadlift", accSets, "8", 120, { rpe: accRpe, notes: dn }),
        R("walking-lunge", accSets, "8 per side", 90, { rpe: accRpe, notes: dn }),
        R("standing-calf-raise", accSets, "12", 60, { rpe: accRpe, notes: "Slow on the way down — calves take a lot of running load." }),
        T("plank", 3, 40, 45),
      ], strength),
      day("Tue · Upper Strength", "Horizontal press and pull", [
        R("bench-press", mainSets, reps, 180, { rpe, notes: joinNotes("Main lift.", dn) }),
        R("pull-up", accSets, "5-8", 120, { rpe: accRpe, notes: joinNotes("Band-assisted if needed; add weight once every set reaches 8.", dn) }),
        R("incline-dumbbell-press", accSets, "8-10", 90, { rpe: accRpe, notes: dn }),
        R("one-arm-dumbbell-row", accSets, "8-10 per side", 75, { rpe: accRpe, notes: dn }),
        T("side-plank", 4, 30, 30, { notes: "Alternate sides: 2 holds per side." }),
      ], strength),
      day("Wed · Interval Run", w <= 4 ? "Short hard repeats" : w <= 8 ? "3-minute intervals" : "Threshold intervals", [
        T("zone-2-run", 1, 600, 0, { rpe: 4, notes: "10 minutes of easy running before the first interval." }),
        hybridQuality(w, deload),
      ], run),
      day("Fri · Deadlift & Overhead Strength", "Pull from the floor, press overhead, then rest your legs for the long run", [
        R("conventional-deadlift", deload ? 2 : 3, reps, 180, { rpe: deload ? 6 : rpe - 0.5, notes: joinNotes("Kept half a point easier than Monday's squat — tomorrow is the long run.", dn) }),
        R("overhead-press", mainSets, reps, 150, { rpe, notes: joinNotes("Main lift.", dn) }),
        R("chin-up", accSets, "6-10", 90, { rpe: accRpe, notes: dn }),
        T("farmers-carry", 3, 40, 60, { rpe: accRpe, notes: "Heavy dumbbells, tall posture." }),
      ], strength),
      day("Sat · Long Easy Run", "The longest run of the week — easy all the way", [
        T("zone-2-run", 1, long * 60, 0, { rpe: 4, notes: `${long} minutes easy and conversational. Walk breaks are fine. If yesterday's deadlifts left your legs heavy, run it on Sunday instead.` }),
      ], run),
    ];
    if (deload) return { focus: "Lighter week — half the strength sets at easy effort, shorter runs and strides instead of intervals", isDeload: true, days };
    const blockName = ["Block 1 (sets of 6, short hill repeats)", "Block 2 (sets of 5, 3-minute intervals)", "Block 3 (sets of 3, threshold running)"][block]!;
    const step = ["settle your working weights and paces", "add a little weight and a few running minutes", "the block's hardest week"][k]!;
    return { focus: `${blockName}, week ${k + 1}: ${step}`, days };
  });
}

// =========================================================================== 28 · Conditioning and Intervals

/** Per week: bike [work, rest, rounds, rpe], circuit [work, rest, rounds], row [work, rest, rounds]. */
const CONDITIONING_PLAN: { bike: [number, number, number, number]; circuit: [number, number, number]; row: [number, number, number]; lighter?: boolean }[] = [
  { bike: [30, 90, 8, 8], circuit: [20, 40, 4], row: [180, 120, 4] },
  { bike: [30, 60, 8, 8], circuit: [25, 35, 4], row: [180, 120, 5] },
  { bike: [30, 60, 10, 8.5], circuit: [30, 30, 4], row: [180, 90, 5] },
  { bike: [30, 90, 5, 7], circuit: [20, 40, 3], row: [180, 150, 3], lighter: true },
  { bike: [40, 60, 8, 8], circuit: [30, 30, 5], row: [240, 120, 4] },
  { bike: [45, 45, 8, 8.5], circuit: [35, 25, 5], row: [240, 120, 5] },
  { bike: [45, 45, 10, 8.5], circuit: [40, 20, 5], row: [240, 90, 5] },
  { bike: [30, 90, 5, 7], circuit: [20, 40, 3], row: [180, 150, 3], lighter: true },
];

const ratio = (work: number, rest: number) => {
  const g = (a: number, b: number): number => (b === 0 ? a : g(b, a % b));
  const d = g(work, rest);
  return `${work / d}:${rest / d}`;
};

function conditioningWeeks(): ProgramWeekSeed[] {
  return CONDITIONING_PLAN.map(({ bike, circuit, row, lighter }, i): ProgramWeekSeed => {
    const w = i + 1;
    const [bw, br, bn, brpe] = bike;
    const [cw, cr, cn] = circuit;
    const [rw, rr, rn] = row;
    const easy = lighter ? " Lighter week: steady, not all-out." : "";
    const frame = { warmup: CONDITIONING_WARMUP, cooldown: STANDARD_COOLDOWN };
    const cNote = `Circuit: ${secondsLabel(cw)} work, ${secondsLabel(cr)} to move to the next exercise; ${cn} rounds of all five in order.`;
    const days = [
      day("Bike Power Intervals", `${bn} × ${secondsLabel(bw)} hard, ${secondsLabel(br)} easy (work:rest ${ratio(bw, br)})`, [
        T("bike-intervals", bn, bw, br, { rpe: brpe, notes: `${secondsLabel(bw)} hard (about ${brpe} out of 10), ${secondsLabel(br)} easy spinning. Hold the same power on every rep — if it drops by more than about 10%, stop there.${easy}` }),
        T("plank", 3, 40, 40, { notes: "Squeeze glutes, ribs down, breathe." }),
        T("side-plank", 4, 25, 20, { notes: "Alternate sides: 2 holds per side." }),
      ], frame),
      day("Kettlebell & Bodyweight Circuit", `Work:rest ${cw}:${cr} for ${cn} rounds`, [
        T("kettlebell-swing", cn, cw, cr, { rpe: lighter ? 6 : 8, notes: joinNotes(cNote, "Hip snap, not a squat; stop the set if your back takes over.") }),
        T("goblet-squat", cn, cw, cr, { rpe: lighter ? 6 : 7.5, notes: "Same kettlebell, smooth reps, full depth you own." }),
        T("push-up", cn, cw, cr, { rpe: lighter ? 6 : 8, notes: "Elevate your hands to keep every rep clean." }),
        T("mountain-climber", cn, cw, cr, { notes: "Hips level; quick but controlled." }),
        T("step-back-burpee", cn, cw, cr, { notes: "Step back and in — no jump needed." }),
      ], frame),
      day("Rower Intervals + Carries", `${rn} × ${secondsLabel(rw)} hard, ${secondsLabel(rr)} easy (work:rest ${ratio(rw, rr)})`, [
        T("rowing-intervals", rn, rw, rr, { rpe: lighter ? 6.5 : 8, notes: `${secondsLabel(rw)} at a hard pace you can hold for every rep (about 5K-run effort), ${secondsLabel(rr)} easy paddling. Note your average split — aim to hold it as the rest shortens.${easy}` }),
        T("farmers-carry", 3, 40, 60, { rpe: lighter ? 6 : 7.5, notes: "Heavy kettlebells, tall posture, short quick steps." }),
        T("bear-crawl", 3, 30, 45, { notes: "Knees an inch off the floor, hips still." }),
      ], frame),
    ];
    if (lighter) return { focus: `Lighter week ${w}: fewer rounds and longer rests — recover so the next weeks can be harder`, isDeload: true, days };
    return { focus: `Week ${w}: bike ${ratio(bw, br)}, circuit ${cw}:${cr}, row ${secondsLabel(rw)} on / ${secondsLabel(rr)} off — more work or less rest than last week`, days };
  });
}

// =========================================================================== 29 · Full-Body Mobility

const MOB_WARMUP = ["1–2 minutes of slow nasal breathing, lying or seated", "Cat-cow × 6 slow breaths", "Arm circles × 10 each direction"];
const MOB_COOLDOWN = ["Lie on your back, knees bent — 1 minute of slow breathing"];

/**
 * Static holds per side grow every week: one hold of 30 → 40 → 50 s, then two holds of 40 → 50 → 60 s
 * (30, 40, 50, 80, 100, 120 s of total time per side). Dynamic drills go from one to two slow sets.
 */
const MOB_HOLD = [30, 40, 50, 40, 50, 60];
const MOB_PER_SIDE = [1, 1, 1, 2, 2, 2];
const MOB_DYN = [40, 50, 60, 45, 50, 60];
const MOB_DYN_SETS = [1, 1, 1, 2, 2, 2];
/** Long-hold day: one hold per side, 45 → 120 seconds. */
const MOB_LONG = [45, 60, 75, 90, 105, 120];

function fullBodyMobilityWeeks(): ProgramWeekSeed[] {
  return weeksOf(6, (w) => {
    const h = MOB_HOLD[w - 1]!;
    const ps = MOB_PER_SIDE[w - 1]!;
    const dyn = MOB_DYN[w - 1]!;
    const ds = MOB_DYN_SETS[w - 1]!;
    const lh = MOB_LONG[w - 1]!;
    const longHold = (ex: string, notes: string) => T(ex, 2, lh, 10, { notes: `One ${lh}-second hold per side. ${notes}` });
    const sides = (o: string) => (ps === 1 ? `One ${h}-second hold per side. ${o}` : `Alternate sides: ${ps} holds of ${h} s per side. ${o}`);
    const static2 = (ex: string, notes: string) => T(ex, 2 * ps, h, 10, { notes: sides(notes).trim() });
    const dynamic = (ex: string, notes: string) => T(ex, ds, dyn, 15, { notes: `${secondsLabel(dyn)} of slow, continuous reps. ${notes}`.trim() });
    const frame = { warmup: MOB_WARMUP, cooldown: MOB_COOLDOWN };
    const days = [
      day("Hips & Hamstrings", "Hip rotation, hip flexors and the back of the legs", [
        dynamic("90-90-hip-switch", "Sit tall; rotate knees side to side without using your hands if you can."),
        dynamic("worlds-greatest-stretch", "Alternate sides each rep; pause 2 seconds in each position."),
        static2("couch-stretch", "Squeeze the glute of the back leg; back off if you feel it in the knee."),
        static2("supine-hamstring-stretch", "Band around the foot, knee slightly soft, breathe out to relax into it."),
      ], frame),
      day("Spine & Shoulders", "Thoracic rotation, overhead reach and shoulder blades", [
        dynamic("cat-cow", "One vertebra at a time, matched to slow breathing."),
        dynamic("thoracic-open-book", "Alternate sides; follow your hand with your eyes."),
        dynamic("band-pass-through", "Wide grip; only as far back as your elbows stay straight."),
        T("childs-pose", ps, h + 15, 10, { notes: "Walk your hands to one side, then the other, for a side-body stretch." }),
      ], frame),
      day("Ankles, Knees & Squat", "Ankle range and a comfortable deep squat", [
        dynamic("ankle-knee-to-wall", "Alternate sides; heel stays down, knee tracks over the middle toes."),
        T("deep-squat-hold", 1 + ps, h, 20, { notes: "Hold a doorframe or post if you need to; heels down, chest tall, breathe." }),
        static2("single-leg-balance", "Near a support; progress to eyes closed once steady."),
        R("standing-calf-raise", 2, "10", 30, { notes: "Slow: 3 seconds down, 2-second pause in the bottom stretch." }),
      ], frame),
      day("Full-Body Flow", "Linked, slow movement — the day to skip on the 4-day option", [
        dynamic("worlds-greatest-stretch", "Flow side to side without stopping."),
        dynamic("cat-cow", "Slow and breath-led."),
        dynamic("90-90-hip-switch", "Add a lean over the front shin at each side."),
        dynamic("thoracic-open-book", "Pause and breathe at the open position."),
        T("deep-squat-hold", ps, h, 20, { notes: "Finish in the bottom of the squat, breathing slowly." }),
      ], frame),
      day("Long Holds & Breathing", "Longer, relaxed static holds", [
        longHold("figure-four-stretch", "Lying on your back; breathe out slowly and let the hip relax."),
        longHold("couch-stretch", "Gentler than Day 1 — a pillow under the knee helps."),
        longHold("supine-hamstring-stretch", "Band around the foot; long exhales."),
        T("childs-pose", 1, lh, 0, { notes: "Slow breathing: 4 seconds in, 6 seconds out." }),
      ], frame),
    ];
    const focus =
      w <= 3
        ? `Week ${w}: one ${h}-second hold per side and one slow set of each drill — learn the positions, stay pain-free`
        : `Week ${w}: two ${h}-second holds per side and two sets of each drill — more total time in each position`;
    return { focus, days };
  });
}

// =========================================================================== 30 · Core Strength and Stability

const CORE_WARMUP = ["2–3 minutes easy marching or cycling", "Cat-cow × 6 slow breaths", "Glute bridge × 10", "Dead bug × 4 per side, slow"];
const CORE_COOLDOWN = ["Child's pose — 60 seconds", "Figure-four stretch — 30 seconds per side"];

function coreStabilityWeeks(): ProgramWeekSeed[] {
  return weeksOf(8, (w) => {
    const deload = w === 4 || w === 8;
    const phase2 = w >= 5;
    const k = deload ? 0 : (w - 1) % 4; // 0..2 within each phase
    const sets = deload ? 2 : 3;
    const rpe = deload ? 5.5 : (phase2 ? 7 : 6) + 0.5 * k;
    const p2 = phase2 && !deload;
    const pick = <V>(a: V[], b: V[]): V => (p2 ? b : a)[k]!;
    const frame = { warmup: CORE_WARMUP, cooldown: CORE_COOLDOWN };
    const dn = deload ? "Lighter week: fewer sets, back to the easier version." : undefined;
    const days = [
      day("Anti-Extension", "Keep the ribs down and the lower back still while the arms and legs move", [
        R("dead-bug", sets, pick(["6 per side", "8 per side", "10 per side"], ["6 per side", "8 per side", "10 per side"]), 45, {
          rpe,
          notes: joinNotes(p2 ? "Long lever: legs straighter and a 4-second reach." : "3-second reach, exhale fully, lower back stays heavy on the floor.", dn),
        }),
        T("plank", sets, pick([20, 30, 40], [20, 25, 30]), 45, {
          notes: joinNotes(p2 ? "Hard-style plank: squeeze glutes and fists, pull elbows toward toes — harder, so shorter holds." : "Straight line from head to heels; stop before the hips sag.", dn),
        }),
        R("ab-wheel-rollout", sets, pick(["5", "6", "8"], ["6", "8", "10"]), 90, {
          rpe,
          notes: joinNotes(p2 ? "From the knees, rolling a little further each week — only as far as your back stays flat." : "From the knees, rolling out to a wall a short distance away so the range is limited.", dn),
        }),
        R("glute-bridge", sets, pick(["12", "15", "15"], ["8 per side", "10 per side", "12 per side"]), 60, {
          rpe,
          notes: joinNotes(p2 ? "Single-leg bridge, 2-second squeeze at the top." : "2-second squeeze at the top; ribs stay down.", dn),
        }),
      ], frame),
      day("Anti-Rotation", "Resist twisting through the trunk and hips", [
        R("pallof-press", sets, pick(["8 per side", "10 per side", "12 per side"], ["8 per side", "10 per side", "12 per side"]), 45, {
          rpe,
          notes: joinNotes(p2 ? "Standing split stance, heavier band, 5-second hold with arms straight." : "Half-kneeling, 2-second hold with arms straight; nothing twists.", dn),
        }),
        R("bird-dog", sets, pick(["5 per side", "6 per side", "8 per side"], ["5 per side", "6 per side", "8 per side"]), 45, {
          notes: joinNotes(p2 ? "5-second hold at full reach; a light weight on your low back must not wobble." : "3-second hold at full reach; hips stay level.", dn),
        }),
        R("single-leg-rdl", sets, pick(["6 per side", "8 per side", "10 per side"], ["8 per side", "8 per side", "10 per side"]), 60, {
          rpe,
          notes: joinNotes(p2 ? "A light dumbbell in the hand opposite the standing leg; hips stay square to the floor." : "Bodyweight, fingertips on a wall if needed; hips stay square to the floor.", dn),
        }),
        T("bear-crawl", sets, pick([20, 25, 30], [30, 35, 40]), 45, { notes: joinNotes("Knees an inch off the floor; slow steps, no hip sway.", dn) }),
      ], frame),
      day("Anti-Lateral Flexion & Carries", "Resist side-bending; strong hips and groin", [
        T("side-plank", 2 * (deload ? 1 : 2), pick([20, 25, 30], [20, 25, 30]), 30, {
          notes: joinNotes(p2 ? "From the feet. Alternate sides." : "From the knees. Alternate sides.", dn),
        }),
        T("copenhagen-plank", 2 * (deload ? 1 : 2), pick([10, 15, 20], [10, 15, 20]), 45, {
          notes: joinNotes(p2 ? "Long lever: foot on the bench. Alternate sides." : "Short lever: knee on the bench (or a sturdy chair). Alternate sides.", dn),
        }),
        T("suitcase-carry", 2 * (deload ? 1 : 2), pick([30, 30, 40], [30, 40, 40]), 60, {
          rpe,
          notes: joinNotes("One dumbbell, alternate hands each set; walk tall without leaning.", p2 ? "Heavier than phase 1." : undefined, dn),
        }),
        T("single-leg-balance", 2 * (deload ? 1 : 2), pick([20, 30, 30], [30, 30, 40]), 15, {
          notes: joinNotes(p2 ? "Eyes closed or on a folded towel; alternate sides." : "Near a support; alternate sides.", dn),
        }),
      ], frame),
    ];
    if (deload) return { focus: `Lighter week ${w}: two sets of the easier versions — consolidate before ${w === 4 ? "the harder variations" : "retesting or repeating"}`, isDeload: true, days };
    return {
      focus: phase2 ? `Phase 2, week ${k + 1}: harder lever positions (long-lever dead bug, hard-style plank, side plank from the feet, long Copenhagen)` : `Phase 1, week ${k + 1}: learn each brace, then add reps and seconds`,
      days,
    };
  });
}

// =========================================================================== 31 · Movement Quality Foundations

const MQ_WARMUP = ["3 minutes marching or easy walking", "Cat-cow × 6", "World's greatest stretch × 2 per side", "Bodyweight squats × 5, slow"];
const MQ_COOLDOWN = ["2 minutes easy walking", "Child's pose — 60 seconds", "Figure-four stretch — 30 seconds per side"];
const TEMPO = "Tempo 3-1-1: 3 seconds down, 1-second pause, 1 second up.";

function movementQualityWeeks(): ProgramWeekSeed[] {
  // W1–2 bodyweight, W3–4 light load, W5 build, W6 lighter consolidation week.
  return weeksOf(6, (w) => {
    const deload = w === 6;
    const loaded = w >= 3 && !deload;
    const sets = w === 1 || deload ? 2 : 3;
    const reps = w <= 3 || deload ? "8" : "10";
    const rpe = deload ? 5 : [5, 5.5, 6, 6.5, 7][w - 1]!;
    const carry = deload ? 30 : [30, 30, 30, 40, 40][w - 1]!;
    const side = `${reps} per side`;
    const frame = { warmup: MQ_WARMUP, cooldown: MQ_COOLDOWN };
    const days = [
      day("Squat · Push · Pull", "Squat pattern, pushing, rowing and a carry", [
        loaded
          ? R("goblet-squat", sets, reps, 90, { rpe, notes: `${TEMPO} A light dumbbell or kettlebell held at the chest.` })
          : R("bodyweight-squat", sets, reps, 60, { rpe, notes: `${TEMPO} Sit to a box or chair if you need a depth target.` }),
        R(w === 5 ? "push-up" : "incline-push-up", sets, reps, 75, {
          rpe,
          notes: `${TEMPO} ${w <= 2 ? "Hands on a bench or counter — high enough that every rep is clean." : w === 5 ? "Full push-ups, or the lowest incline you control." : "A lower incline than weeks 1–2."}`,
        }),
        R("band-row", sets, `${Number(reps) + 2}`, 60, { rpe, notes: "Squeeze the shoulder blades back for 1 second; slow return." }),
        T("farmers-carry", sets, carry, 60, { rpe: deload ? 5 : 6, notes: "Light-to-moderate dumbbells; tall posture, short steps." }),
        R("dead-bug", 2, "6 per side", 45, { notes: "Slow: 3-second reach, exhale fully." }),
      ], frame),
      day("Hinge · Pull · Lunge", "Hip hinge, one-arm row, split-stance strength and a one-sided carry", [
        R("romanian-deadlift", sets, reps, 90, {
          rpe,
          notes: `${TEMPO} ${loaded ? "Light dumbbells, sliding down the thighs." : "No weight yet: hands slide down the thighs, hips push back, back stays flat."}`,
        }),
        R("one-arm-dumbbell-row", sets, side, 75, { rpe, notes: "Light dumbbell; hand on a bench or chair; pull to the hip and pause 1 second." }),
        R("reverse-lunge", sets, side, 75, { rpe, notes: `${TEMPO} ${loaded ? "Light dumbbells at your sides." : "Bodyweight, hand on a wall or chair for balance."}` }),
        T("suitcase-carry", 2 * (deload ? 1 : 2), carry, 45, { rpe: deload ? 5 : 6, notes: "One dumbbell; alternate hands each set; stay level." }),
        R("bird-dog", 2, "5 per side", 45, { notes: "3-second hold at full reach; hips stay level." }),
      ], frame),
      day("Single-Leg · Overhead · Carry", "Step-ups, single-leg hinge, overhead press and upper back", [
        R("step-up", sets, side, 75, { rpe, notes: `${TEMPO} ${loaded ? "Light dumbbells at your sides." : "Low step, bodyweight; drive through the whole front foot."}` }),
        R("single-leg-rdl", sets, w <= 2 || deload ? "6 per side" : side, 75, {
          rpe,
          notes: `${TEMPO} ${loaded ? "A light dumbbell in the hand opposite the standing leg." : "Fingertips on a wall; reach long behind you."}`,
        }),
        R("seated-dumbbell-shoulder-press", sets, reps, 75, { rpe, notes: "Light dumbbells, seated on a bench or sturdy chair; ribs down, press to straight arms." }),
        R("band-pull-apart", sets, "12", 45, { notes: "Straight arms, 1-second squeeze." }),
        T("farmers-carry", sets, carry, 60, { rpe: deload ? 5 : 6, notes: "A little heavier than Day 1 if it felt easy." }),
      ], frame),
    ];
    if (deload) return { focus: "Lighter week: two sets of 8 with light loads — film a set of each pattern and compare with week 1", isDeload: true, days };
    const focus = [
      "Week 1: learn the six patterns with bodyweight, two sets, slow tempo",
      "Week 2: same movements, a third set",
      "Week 3: light dumbbells on the squat, hinge and lunge — keep the 3-second lowering",
      "Week 4: sets of 10 and longer carries",
      "Week 5: full push-ups (or your lowest incline) and a little more weight where every rep stayed clean",
    ][w - 1]!;
    return { focus, days };
  });
}

// =========================================================================== 32 · Flexibility and Recovery Routines

const FR_WARMUP = ["2 minutes easy walking or marching", "Shoulder rolls × 10", "Gentle hip circles × 5 each direction"];
const FR_COOLDOWN = ["1–2 minutes of slow breathing: 4 seconds in, 6 seconds out"];

/** Easy aerobic minutes (about 10% more most weeks) and static-hold seconds per week. */
const FR_AEROBIC = [15, 16, 18, 20, 22, 24];
const FR_HOLD = [30, 35, 40, 45, 50, 60];
const FR_LONG = [45, 50, 60, 60, 75, 90];

function flexibilityRecoveryWeeks(): ProgramWeekSeed[] {
  return weeksOf(6, (w) => {
    const aer = FR_AEROBIC[w - 1]!;
    const h = FR_HOLD[w - 1]!;
    const long = FR_LONG[w - 1]!;
    const frame = { warmup: FR_WARMUP, cooldown: FR_COOLDOWN };
    const gentle = "Gentle: a mild stretch, never pain.";
    const easyWalk = (notes: string) =>
      T("brisk-walk", 1, aer * 60, 0, { rpe: 4, notes: `${aer} minutes of easy walking (or easy cycling or rowing) — you could hold a full conversation. ${notes}` });
    const days = [
      day("Easy Walk + Lower-Body Stretch", "Easy aerobic recovery, then hamstrings, hips and calves", [
        easyWalk("A flat route is ideal."),
        T("supine-hamstring-stretch", 2, h, 10, { notes: `One hold per side, band around the foot. ${gentle}` }),
        T("figure-four-stretch", 2, h, 10, { notes: `One hold per side, lying on your back. ${gentle}` }),
        R("ankle-knee-to-wall", 1, "10 per side", 0, { notes: "Slow rocks toward the wall, heel down." }),
      ], frame),
      day("Upper Body & Spine", "Gentle spinal movement and shoulder range", [
        T("cat-cow", 2, h + 15, 15, { notes: "Slow, breath-led rounds." }),
        R("thoracic-open-book", 2, "6 per side", 15, { notes: "Pause 2 breaths at the open position." }),
        R("band-pass-through", 2, "8", 15, { notes: "Wide grip; only as far as is comfortable." }),
        T("childs-pose", 2, h, 10, { notes: "Second hold: walk the hands to one side, then switch next time." }),
      ], frame),
      day("Easy Walk + Hips", "Easy aerobic recovery, then hip and squat range", [
        easyWalk("Cycling is a good swap if your legs feel tired."),
        R("90-90-hip-switch", 2, "6 per side", 15, { notes: "Slow; hands behind you for support." }),
        R("worlds-greatest-stretch", 2, "3 per side", 15, { notes: "Pause 2 breaths in each position." }),
        T("deep-squat-hold", 2, h, 20, { notes: "Hold a doorframe or post; heels on a folded towel if needed." }),
      ], frame),
      day("Long-Hold Stretch & Breathing", "Long, relaxed holds with slow breathing", [
        T("childs-pose", 1, long, 0, { notes: "Arms long, forehead down, slow breathing." }),
        T("supine-hamstring-stretch", 2, long, 10, { notes: `One hold per side. ${gentle}` }),
        T("figure-four-stretch", 2, long, 10, { notes: `One hold per side. ${gentle}` }),
        T("couch-stretch", 2, h, 10, { notes: `One hold per side — the gentle version with the back knee on a cushion, torso upright. ${gentle}` }),
      ], frame),
    ];
    return { focus: `Week ${w}: ${aer} minutes of easy aerobic work, ${h}-second holds and ${secondsLabel(long)} long holds`, days };
  });
}

// =========================================================================== Catalog

const RUN_WALK_WEEKS = beginnerRunWalkWeeks();
const HYBRID_WEEKS = hybridStrengthRunWeeks();
const CONDITIONING_WEEKS = conditioningWeeks();
const MOBILITY_WEEKS = fullBodyMobilityWeeks();
const CORE_WEEKS = coreStabilityWeeks();
const MOVEMENT_WEEKS = movementQualityWeeks();
const RECOVERY_WEEKS = flexibilityRecoveryWeeks();

export const CATALOG_ENDURANCE_MOBILITY: ProgramSeed[] = [
  {
    slug: "beginner-run-walk-5k-10-week",
    name: "Beginner Run/Walk to 5K: 10 Weeks",
    summary: "Three run/walk sessions a week for ten weeks — a slower build than most couch-to-5K plans, finishing with 30 minutes of continuous easy running.",
    description:
      "For complete beginners, heavier or returning runners, and anyone who found faster plans too steep. Week 1 alternates 60 seconds of easy running " +
      "with 90 seconds of walking; the running bouts lengthen and the walk breaks shrink a little each week, so your weekly running time rises by no more " +
      "than about 10–15% over the previous full week. Weeks 4 and 8 are lighter so your joints, tendons and bones can catch up with your fitness. Every run " +
      "is easy and conversational; walking is part of the plan. The last session is 30 minutes without stopping — about 5 km for many new runners. A " +
      "walking-only version of every session is built in for days when running isn't right.",
    category: "cardiovascular",
    types: ["cardio"],
    difficulty: "beginner",
    weeks: 10,
    sessionMinutes: meanMinutes(RUN_WALK_WEEKS[0]!.days),
    goals: ["improve_conditioning", "general_health", "lose_fat"],
    equipment: ["bodyweight"],
    tier: "pro",
    progression:
      "Running bouts lengthen (60 s → 90 s → 2, 3, 4, 5 minutes → continuous) while walk breaks shorten. Weekly running time goes about 28 → 33 → 39 → 44 → " +
      "50 → 57 minutes, never more than about 15% above the previous full week. Weeks 4 and 8 step back by about 20–25%. Repeat any week until its last " +
      "session feels comfortable.",
    progressionModel: "steady",
    warmup: RW_WARMUP,
    cooldown: RW_COOLDOWN,
    days: RUN_WALK_WEEKS[0]!.days,
    weekTemplates: RUN_WALK_WEEKS,
    milestones: [
      "Completed three sessions of 9–10 × 1-minute easy runs with walking breaks.",
      "Running 75–90 seconds at a time, still able to talk.",
      "Running 2 minutes at a time in the longer session.",
      "Finished a lighter week feeling fresh — no lingering soreness.",
      "Running 3 minutes at a time in the longer session.",
      "Five-minute running bouts in the longer session.",
      "Ten minutes of running at a time, twice, in the longer session.",
      "Finished the second lighter week with energy to spare.",
      "Ran 20 minutes without stopping.",
      "Ran 30 minutes continuously — about 5 km for many beginners.",
    ],
    instructions: [
      "Run three days a week with a rest day between sessions (for example Mon/Wed/Sat or Tue/Thu/Sun). Easy walking on rest days is welcome.",
      "There are no target paces. Run slowly enough to speak in full sentences — about 3–4 out of 10 effort. If you're breathing too hard to talk, slow down or walk early; that is still a completed session.",
      "Repeat-a-week rule: move on only when you've done all three sessions of a week and the last one felt comfortable, with no soreness that lasts into the next day. Otherwise repeat the week — most beginners repeat at least one, and that is part of the plan.",
      "Missed one session? Carry on where you left off. Missed a full week, or more? Go back and repeat the last week you finished comfortably (go back two weeks after a break of two weeks or more).",
      "Walking-only fallback: on days when running isn't right (aches, illness, heat), do the same session as brisk walking for the run portions and easy walking for the breaks. It keeps the habit going; repeat that week's running version before moving on. Pain that changes how you move means stop and get it checked.",
    ],
    catalogNumber: 22,
  },
  {
    slug: "hybrid-strength-run-12-week",
    name: "Hybrid Strength + Running: 12-Week Strength-Priority Plan",
    summary: "Three strength sessions and two runs a week for 12 weeks, with hard days separated and a lighter week every fourth week.",
    description:
      "For lifters who want to keep getting stronger while building real running fitness. We chose three strength days and two runs (rather than two and " +
      "three): three full sessions train every major muscle at least twice a week and let the main lifts progress, while one interval run and one long " +
      "easy run cover both ends of the aerobic range with the least interference. The week is Mon lower-body strength, Tue upper-body strength, Wed " +
      "intervals (two days after heavy legs), Fri deadlift and overhead press, Sat long easy run. Strength moves from sets of 6 to 5 to 3 across three " +
      "blocks; running moves from short hill repeats to 3-minute intervals to threshold work, and weekly running time rises about 10% per week at most. " +
      "Weeks 4, 8 and 12 are lighter. Best for intermediate lifters who can already run 30–40 minutes easily.",
    category: "hybrid-training",
    types: ["strength", "cardio"],
    difficulty: "intermediate",
    weeks: 12,
    sessionMinutes: meanMinutes(HYBRID_WEEKS[0]!.days),
    goals: ["build_strength", "improve_conditioning", "general_health"],
    equipment: ["barbell", "rack", "bench", "dumbbell", "pull_up_bar", "bodyweight"],
    tier: "pro",
    progression:
      "Strength: main lifts go from 4 × 6 (RPE 7 → 8) to 4 × 5 (RPE 7.5 → 8.5) to 4 × 3 (RPE 8 → 9); add a little weight whenever every set hits its reps " +
      "below the target RPE. Running: the long run grows from 40 to 62 minutes and intervals move from 6–8 × 60 s to 4–6 × 3 min to 2–3 × 8–10 min threshold, " +
      "with weekly running time up no more than about 10% on the previous full week. Weeks 4, 8 and 12 halve the strength sets and swap intervals for strides.",
    progressionModel: "linear_rpe",
    warmup: STANDARD_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: HYBRID_WEEKS[0]!.days,
    weekTemplates: HYBRID_WEEKS,
    milestones: [
      "Found working weights for 4 × 6 at about RPE 7 and ran 6 easy-to-hard hill repeats.",
      "Added a little weight to the main lifts; 7 repeats; 44-minute long run.",
      "Block 1's hardest week: 4 × 6 at RPE 8, 8 repeats, 48-minute long run.",
      "Lighter week done — legs fresh, lifts moving fast.",
      "Settled into sets of 5 and four 3-minute intervals.",
      "Five 3-minute intervals at even pace; 54-minute long run.",
      "Block 2's hardest week: 4 × 5 at RPE 8.5, six 3-minute intervals, 58-minute long run.",
      "Second lighter week done.",
      "Sets of 3 at RPE 8 and two 8-minute threshold reps.",
      "Two 10-minute threshold reps; 58-minute long run.",
      "Block 3's peak: 4 × 3 at RPE 9, three 8-minute threshold reps, 62-minute long run.",
      "Final lighter week done — ready to test a 3–5RM or a 5K, or start the cycle again a little heavier.",
    ],
    instructions: [
      "Recommended week: Mon lower strength, Tue upper strength, Wed intervals, Thu rest, Fri deadlift and overhead press, Sat long easy run, Sun rest. Keep at least one day between the interval run and the heavy squat.",
      "Choose starting weights by effort, not a formula: on the first week's main lifts, build up in warm-up sets until a set of 6 feels like RPE 7 — about 3 reps left in reserve. Use that weight for all four sets, and add the smallest jump available once every set feels easier than the target.",
      "Run the easy and long runs at a conversational pace, and the intervals hard but controlled — you should finish the last rep at the same pace as the first. If you fade badly, stop the set there.",
      "Missed a strength day? Do it on the next free day, but never on the day before the interval run. Missed a run? Skip it rather than doubling up. Missed most of a week? Repeat that week.",
      "Repeat a week instead of moving on if your lifts stalled at the target RPE or the long run left you sore for more than a day.",
    ],
    catalogNumber: 27,
  },
  {
    slug: "conditioning-intervals-8-week",
    name: "Conditioning & Intervals: Bike, Rower and Kettlebell",
    summary: "Three interval sessions a week — bike, kettlebell-and-bodyweight circuits and rower — with work:rest ratios that tighten over eight weeks.",
    description:
      "For people who already train and want a bigger engine: better repeat-effort fitness, faster recovery between hard efforts and more work done in less " +
      "time. Each week has a bike power session (short hard intervals, from 1:3 to 1:1 work:rest), a kettlebell and bodyweight circuit (from 20:40 to 40:20) " +
      "and longer rower intervals (3–4 minutes at a hard, sustainable pace with shrinking rests). Weeks 4 and 8 are lighter. Effort is set by feel, so it works " +
      "at any fitness level within the intermediate range; no bike or rower? An outdoor run or hill repeats can replace either.",
    category: "functional-conditioning",
    types: ["cardio", "functional"],
    difficulty: "intermediate",
    weeks: 8,
    sessionMinutes: meanMinutes(CONDITIONING_WEEKS[0]!.days),
    goals: ["improve_conditioning", "lose_fat", "general_health"],
    equipment: ["bike", "rower", "kettlebell", "bodyweight"],
    tier: "pro",
    progression:
      "Density: bike 8 × 30 s with 90 s easy → 10 × 45 s with 45 s easy; circuits 20:40 for 4 rounds → 40:20 for 5 rounds; rower 4 × 3 min with 2 min easy → " +
      "5 × 4 min with 90 s easy. Each week adds work or trims rest, never both on the same piece. Weeks 4 and 8 drop rounds and lengthen rests.",
    progressionModel: "density",
    warmup: CONDITIONING_WARMUP,
    cooldown: STANDARD_COOLDOWN,
    days: CONDITIONING_WEEKS[0]!.days,
    weekTemplates: CONDITIONING_WEEKS,
    milestones: [
      "Completed 8 bike sprints with steady power and a 20:40 circuit; noted your rower split.",
      "Held your bike power with only 60 s rest; five rower intervals.",
      "Ten bike intervals and a 30:30 circuit without breaking form.",
      "Lighter week done — rested and ready for longer work bouts.",
      "40-second bike intervals and five circuit rounds.",
      "1:1 bike intervals (45:45) and four-minute rower intervals five times.",
      "Peak week: 10 × 45:45 on the bike, 40:20 circuits and 5 × 4 min rowing on 90 s rest.",
      "Final lighter week — compare your week 7 rower splits and bike power with week 1.",
    ],
    instructions: [
      "Train three non-consecutive days, e.g. Mon/Wed/Fri. Walking or easy cycling on other days helps recovery.",
      "Set intensity by RPE, not prescribed numbers: 'hard' intervals are about 8 out of 10 — strong breathing, can't talk, but the same pace or power is repeatable on every rep. In week 1, note the power, split or reps you can hold; that is your baseline.",
      "Kettlebell: choose one you could swing for about 15 crisp reps with 3–4 reps in reserve. Go heavier only when every round of the circuit feels clean.",
      "If power or form drops sharply partway through, end that piece there and repeat the week next time rather than moving on. Missed a session? Do the next one in order; don't stack two hard days back to back.",
      "Substitutions: an air bike, spin bike or outdoor hill run can replace the bike; a run or ski erg can replace the rower; dumbbells can replace the kettlebell.",
    ],
    catalogNumber: 28,
  },
  {
    slug: "full-body-mobility-6-week",
    name: "Full-Body Mobility: 6-Week Routine",
    summary: "Five short mobility sessions a week (or four) for hips, spine, shoulders and ankles, with holds that grow every week.",
    description:
      "For all levels: 15–25 minutes of mobility work you can do on its own or after training. Each session targets one region — hips and hamstrings, spine " +
      "and shoulders, ankles and squat, a full-body flow and a long-hold session — and the time you spend in each position grows every week, because " +
      "regular practice and longer total time under stretch are what improve range of motion. Move slowly and stay in a comfortable, pain-free range. This is " +
      "general mobility training, not rehabilitation: if you have an injury or pain, follow your healthcare provider's advice.",
    category: "mobility-flexibility",
    types: ["mobility", "low_impact"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: meanMinutes(MOBILITY_WEEKS[0]!.days),
    goals: ["mobility", "general_health"],
    equipment: ["mat", "band", "bodyweight"],
    tier: "pro",
    lowImpact: true,
    completion: "Complete at least 80% of the 30 sessions — 24 or more (20 of 24 on the 4-day option) — including the final week.",
    progression:
      "Weeks 1–3: one hold per side growing from 30 to 50 seconds, and one slow set of each drill. Weeks 4–6: two holds per side (40 → 60 seconds) and two sets " +
      "of each drill — total time per side goes from 30 to 120 seconds. The long-hold day builds from one 45-second to one 2-minute hold per side. " +
      "Sessions grow from about 15 to about 25 minutes.",
    progressionModel: "steady",
    noDeloadReason: "Mobility work at a comfortable, pain-free range is low-fatigue, so there is nothing to recover from; skip a day whenever you feel run down.",
    warmup: MOB_WARMUP,
    cooldown: MOB_COOLDOWN,
    days: MOBILITY_WEEKS[0]!.days,
    weekTemplates: MOBILITY_WEEKS,
    milestones: [
      "Learned all five sessions and held each stretch for 30 seconds comfortably.",
      "Holding 40 seconds per side with relaxed breathing.",
      "Holding 50 seconds per side; drills feel smoother.",
      "Two rounds per side — 80 seconds in each position.",
      "100 seconds per position; squat hold feels more settled.",
      "Two 60-second holds per side — four times week 1's time in each position. Compare your deep squat and hamstring reach with week 1.",
    ],
    instructions: [
      "Five days, e.g. Mon–Fri. On the 4-day option, skip Day 4 (Full-Body Flow) and space the other four through the week.",
      "Go to a mild stretch — about 3–4 out of 10 — and breathe slowly; never force a range or stretch into pain. The right position is one you could hold calmly for the whole time.",
      "There are no loads to choose: progress comes from the hold times written for each week. If a hold feels too long, split it into two shorter holds.",
      "Missed a session? Just do the next one; there is no need to make it up. Missed most of a week? Repeat that week.",
      "Repeat a week if the holds felt strained rather than relaxed. In week 6, take a photo of your deep squat and hamstring stretch and compare with week 1.",
    ],
    catalogNumber: 29,
  },
  {
    slug: "core-strength-stability-8-week",
    name: "Core Strength & Stability: 8 Weeks",
    summary: "Three sessions a week of anti-extension, anti-rotation and anti-lateral-flexion work, from planks and dead bugs to rollouts and Copenhagen planks.",
    description:
      "For beginners to intermediates who want a strong, stable trunk for lifting, running and everyday life. The core's main job is to resist unwanted " +
      "movement, so each session trains one direction: resisting extension (dead bugs, planks, ab-wheel rollouts), rotation (Pallof presses, bird dogs, " +
      "single-leg hinges, bear crawls) and side-bending (side planks, Copenhagen planks, suitcase carries). Phase 1 (weeks 1–3) teaches each brace and adds " +
      "reps and seconds; phase 2 (weeks 5–7) moves to harder levers. Weeks 4 and 8 are lighter. Pairs well with any strength or running plan.",
    category: "home-workouts",
    types: ["strength", "home"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: meanMinutes(CORE_WEEKS[0]!.days),
    goals: ["build_strength", "general_health", "athletic_performance"],
    equipment: ["bodyweight", "mat", "band", "dumbbell", "ab_wheel", "bench"],
    tier: "pro",
    progression:
      "Phase 1 (weeks 1–3): holds grow by 5–10 seconds and reps by 1–2 each week (plank 20 → 40 s, rollouts 5 → 8, side plank from the knees 20 → 30 s). " +
      "Phase 2 (weeks 5–7): harder versions — long-lever dead bugs, hard-style planks, side planks from the feet, long-lever Copenhagen planks, single-leg " +
      "bridges and loaded single-leg hinges — built up the same way. Weeks 4 and 8 drop to two sets of the easier versions.",
    progressionModel: "volume_wave",
    warmup: CORE_WARMUP,
    cooldown: CORE_COOLDOWN,
    days: CORE_WEEKS[0]!.days,
    weekTemplates: CORE_WEEKS,
    milestones: [
      "Can hold a 20-second plank and 20-second side planks from the knees with steady breathing.",
      "30-second plank; 10 slow dead bugs per side.",
      "40-second plank, 8 short-range rollouts and 20-second short-lever Copenhagen planks.",
      "Lighter week — every brace feels automatic.",
      "First side planks from the feet and long-lever Copenhagen planks.",
      "8 longer-range rollouts; 25-second hard-style plank.",
      "10 rollouts, 30-second side planks from the feet and 20-second long-lever Copenhagen planks.",
      "Lighter week done — repeat phase 2 a little harder, or retest your longest clean plank and side plank.",
    ],
    instructions: [
      "Train three non-consecutive days, e.g. Mon/Wed/Fri; the sessions can follow your usual workouts.",
      "Stop every set while your form is still perfect — when the lower back arches, hips sag or you hold your breath, the set is over. Aim for about 2–3 reps or 5–10 seconds left in reserve (RPE 6–7.5).",
      "For carries, single-leg hinges and Pallof presses, choose the load by effort: a dumbbell or band you could carry or press for about twice the prescribed time or reps. There is no set starting weight.",
      "If you can't yet hold a prescribed time, do several shorter holds that add up to it. Repeat a week until every set is clean before moving on.",
      "Missed a session? Do the next one in order. Missed a week? Repeat the last week you completed.",
    ],
    catalogNumber: 30,
  },
  {
    slug: "movement-quality-foundations",
    name: "Movement Quality Foundations: Squat, Hinge, Lunge, Push, Pull, Carry",
    summary: "Three slow-tempo sessions a week that teach the six basic movement patterns with bodyweight first, then light dumbbells.",
    description:
      "For true beginners, people returning after a long break, or lifters who want to clean up their technique. Every session practises the basic " +
      "patterns — squat, hip hinge, lunge, push, pull and carry — at a slow 3-1-1 tempo so you feel each position. Weeks 1–2 use bodyweight only; weeks " +
      "3–5 add light dumbbells and a resistance band once each pattern looks and feels consistent; week 6 is lighter so you can check your form against " +
      "week 1. It prepares you for any full-body strength program. Leave every set with plenty in reserve.",
    category: "beginner",
    types: ["strength", "low_impact"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: meanMinutes(MOVEMENT_WEEKS[0]!.days),
    goals: ["general_health", "build_strength", "mobility"],
    equipment: ["bodyweight", "dumbbell", "band", "bench"],
    tier: "pro",
    lowImpact: true,
    progression:
      "Week 1: two sets of 8 with bodyweight. Week 2: a third set. Week 3: light dumbbells on the squat, hinge and lunge. Week 4: sets of 10 and longer " +
      "carries. Week 5: full push-ups and a little more load where every rep stayed clean (RPE 5 → 7 across the block). Week 6 is lighter.",
    progressionModel: "linear_rpe",
    warmup: MQ_WARMUP,
    cooldown: MQ_COOLDOWN,
    days: MOVEMENT_WEEKS[0]!.days,
    weekTemplates: MOVEMENT_WEEKS,
    milestones: [
      "Learned all six patterns with bodyweight at a slow tempo.",
      "Three steady sets of every movement.",
      "Goblet squats, dumbbell Romanian deadlifts and lunges with light weights, tempo intact.",
      "Sets of 10 and 40-second carries with good posture.",
      "Full push-ups (or your lowest incline) and slightly heavier dumbbells.",
      "Lighter week: filmed each pattern and compared with week 1 — ready for a full-body strength program.",
    ],
    instructions: [
      "Train three non-consecutive days, e.g. Mon/Wed/Fri.",
      "There are no prescribed weights. From week 3, choose dumbbells you could lift for about 4–5 more reps than written while keeping the slow tempo (RPE 5–6); add a little weight only when every rep of every set looks the same as the first.",
      "Quality first: if the tempo speeds up, the back rounds or the knees cave, use the easier version (less load, a higher incline, a hand on a wall) for the rest of the session.",
      "Missed a session? Continue where you left off. Missed a week or more? Repeat the last week you completed.",
      "Repeat a week whenever a pattern still feels uncertain — this program is about doing the movements well, not finishing quickly.",
    ],
    catalogNumber: 31,
  },
  {
    slug: "flexibility-recovery-routines",
    name: "Flexibility & Recovery Routines",
    summary: "Four gentle sessions a week (five optional) of easy walking or cycling and relaxed stretching to help you feel looser and recover between workouts.",
    description:
      "For anyone at any level who wants a calm, structured routine of gentle stretching and easy aerobic activity — alongside a training plan, on a lighter " +
      "phase, or on its own. Two sessions pair 15–24 minutes of easy walking or cycling with lower-body stretches, one works the spine and shoulders, and one " +
      "is long, relaxed holds with slow breathing. This is a general wellness routine, not rehabilitation or treatment: it is not designed for injuries, pain " +
      "or medical conditions — if you have one, follow the plan from your healthcare provider or physiotherapist instead.",
    category: "recovery-deload",
    types: ["mobility", "low_impact", "cardio"],
    difficulty: "beginner",
    weeks: 6,
    sessionMinutes: meanMinutes(RECOVERY_WEEKS[0]!.days),
    goals: ["mobility", "general_health"],
    equipment: ["bodyweight", "mat", "band"],
    tier: "pro",
    lowImpact: true,
    completion: "Complete at least 80% of the 24 sessions — 20 or more — including the final week. Fifth-day sessions on the 5-day option are a bonus.",
    progression:
      "Easy aerobic time grows from 15 to 24 minutes (about 10% a week), stretch holds from 30 to 60 seconds and long holds from 45 to 90 seconds. Effort " +
      "stays easy throughout — the progression is time, not intensity.",
    progressionModel: "steady",
    noDeloadReason: "Every session is easy (about 3–4 out of 10) and low-fatigue, so the whole program works like recovery; there is no build-up of fatigue to deload.",
    warmup: FR_WARMUP,
    cooldown: FR_COOLDOWN,
    days: RECOVERY_WEEKS[0]!.days,
    weekTemplates: RECOVERY_WEEKS,
    milestones: [
      "Completed four gentle sessions and 30-second relaxed holds.",
      "16-minute easy walks feel comfortable; holds are 35 seconds.",
      "40-second holds with slow, easy breathing.",
      "20 minutes of easy aerobic work and 60-second long holds.",
      "50-second holds; long holds of 75 seconds feel relaxed.",
      "24-minute easy walks, 60-second holds and 90-second long holds — a routine you can keep using between training blocks.",
    ],
    instructions: [
      "Four days, e.g. Mon/Tue/Thu/Sat, on non-training days or after an easy workout. Five-day option: add a fifth day repeating Day 1 or a 20–30 minute easy walk.",
      "Everything is easy: the walk or ride at about 3–4 out of 10 (full conversation possible) and every stretch at a mild, comfortable tension, never pain. There are no loads to choose — progress is the time written for each week.",
      "If a hold is too long to stay relaxed, split it into two shorter holds. If any movement causes pain, skip it.",
      "Missed a session? Do the next one; nothing needs making up. Missed a week? Repeat the last week you completed.",
      "Repeat a week if you finished sessions feeling tired rather than better — this routine should leave you feeling looser and fresher.",
    ],
    catalogNumber: 32,
  },
];
