import type { ProgramDaySeed, ProgramSeed, ProgramWeekSeed } from "../programs";
import { T, day, secondsLabel, toFive, type BuildEx } from "../program-builders";

/**
 * Pro catalog #26 (2026-11): Aerobic Endurance Builder. A dedicated plan, not the beginner run/walk (#22): it is for people
 * who can already keep moving for 20–30 minutes and builds weekly aerobic time, mostly at easy talk-test effort, with one
 * longer session a week. The slug is permanent. Every week is written out (weekTemplates) so the progression is testable.
 */

const AE_WARMUP = [
  "5 minutes of brisk walking, or very easy pedalling or rowing",
  "Leg swings × 10 each leg",
  "Ankle circles × 10 each direction",
  "Start the session slower than you need to; settle into the effort over the first 5 minutes",
];
const AE_COOLDOWN = ["5 minutes of easy walking or spinning", "Calf stretch — 30 seconds per side", "Hip flexor stretch — 30 seconds per side"];

const ANY_MODE = "Running is the default; a bike, rower or brisk incline walk for the same time at the same effort counts the same.";

/** Per week: Monday easy minutes and strides, Wednesday easy minutes and steady tempo [reps, minutes], Saturday long minutes. */
interface AerobicWeek {
  mon: number;
  strides: number;
  wed: number;
  tempo?: readonly [number, number];
  long: number;
  cutback?: boolean;
  final?: boolean;
}

/**
 * Minutes of aerobic work on the three core sessions (strides and tempo included, recoveries not):
 * about 86 → 95 → 104 → (75 cutback) → 107 → 117 → 125 → (81 final week). Each full week is at most about 10% above the
 * previous full week; week 5 restarts below week 3's total plus 10% after the cutback.
 */
const AEROBIC_PLAN: AerobicWeek[] = [
  { mon: 25, strides: 4, wed: 25, long: 35 },
  { mon: 27, strides: 5, wed: 28, long: 38 },
  { mon: 30, strides: 6, wed: 30, long: 42 },
  { mon: 22, strides: 4, wed: 22, long: 30, cutback: true },
  { mon: 30, strides: 6, wed: 20, tempo: [2, 5], long: 45 },
  { mon: 30, strides: 6, wed: 20, tempo: [3, 5], long: 50 },
  { mon: 32, strides: 6, wed: 20, tempo: [2, 8], long: 55 },
  { mon: 25, strides: 4, wed: 25, long: 30, final: true },
];

const STRIDE_SECONDS = 20;
const OPTIONAL = "; optional easy days up to 20 minutes each";

/** Total aerobic minutes in a plan week (work time only, recoveries excluded), shown in each week's focus. */
const aerobicPlanMinutes = (w: AerobicWeek) => w.mon + (w.strides * STRIDE_SECONDS) / 60 + w.wed + (w.tempo ? w.tempo[0] * w.tempo[1] : 0) + w.long;

const easy = (minutes: number, notes: string): BuildEx => T("zone-2-run", 1, minutes * 60, 0, { rpe: 4, notes: `${minutes} minutes at RPE 3–4 — you can talk in full sentences. ${notes}`.trim() });

function aerobicEnduranceWeeks(): ProgramWeekSeed[] {
  return AEROBIC_PLAN.map((p, i): ProgramWeekSeed => {
    const w = i + 1;
    const frame = { warmup: AE_WARMUP, cooldown: AE_COOLDOWN };
    const strides = T("running-intervals", p.strides, STRIDE_SECONDS, 60, {
      rpe: 6,
      notes: `Strides: ${p.strides} × ${STRIDE_SECONDS} s quick and relaxed — smooth, not a sprint — with an easy walk back (the rest). On a bike or rower, ${STRIDE_SECONDS} s at a brisker cadence; walkers, ${STRIDE_SECONDS} s of faster walking.`,
    });
    const wedExercises: BuildEx[] = [easy(p.wed, p.tempo ? "Do this before the tempo blocks." : ANY_MODE)];
    if (p.tempo) {
      const [reps, mins] = p.tempo;
      wedExercises.push(
        T("running-intervals", reps, mins * 60, 120, {
          rpe: 6,
          notes: `Steady tempo: ${reps} × ${mins} minutes at RPE 6 — comfortably moderate, short phrases only, never a race — with 2 minutes easy between. Same effort on a bike or rower.`,
        }),
      );
    }
    const longNotes = p.final
      ? "Aerobic check: 30 minutes without stopping at the same easy effort, on the route or machine you used for week 1's long session. Note your distance and compare it with week 1."
      : w === 1
        ? `Baseline: note the distance you have covered at 30 minutes (and average heart rate if you wear a monitor) — week 8 repeats this check. ${ANY_MODE}`
        : `The week's longest session — easy all the way; slow down rather than push. ${ANY_MODE}`;
    const days: ProgramDaySeed[] = [
      day("Mon · Easy Aerobic + Strides", "Easy, conversational aerobic work, then a few relaxed strides", [easy(p.mon, ANY_MODE), strides], frame),
      day(
        p.tempo ? "Wed · Easy + Steady Tempo" : "Wed · Easy Aerobic",
        p.tempo ? `Easy aerobic work with ${p.tempo[0]} × ${secondsLabel(p.tempo[1] * 60)} of steady tempo` : "Continuous easy aerobic work",
        wedExercises,
        frame,
      ),
      day(p.final ? "Sat · 30-Minute Aerobic Check" : "Sat · Long Easy Session", p.final ? "30 minutes continuous at easy effort — compare with week 1" : `${p.long} minutes at easy effort`, [easy(p.long, longNotes)], frame),
    ];
    const total = Math.round(aerobicPlanMinutes(p));
    if (p.cutback) return { focus: `Cutback week: about ${total} minutes, roughly 25% less than week 3 — no optional extra days, let your body absorb the work`, isDeload: true, days };
    if (p.final) return { focus: `Easier final week: about ${total} minutes, no optional extra days, then the 30-minute aerobic check on Saturday`, isDeload: true, days };
    if (w === 1) return { focus: `Week 1: about ${total} minutes of easy aerobic work — find your talk-test effort${OPTIONAL}`, days };
    if (p.tempo) return { focus: `Week ${w}: about ${total} minutes, with ${p.tempo[0]} × ${p.tempo[1]} minutes of steady tempo on Wednesday${OPTIONAL}`, days };
    return { focus: `Week ${w}: about ${total} minutes of easy aerobic work and a ${p.long}-minute long session${OPTIONAL}`, days };
  });
}

const AEROBIC_WEEKS = aerobicEnduranceWeeks();
const meanMinutes = (days: ProgramDaySeed[]) => toFive(days.reduce((s, d) => s + d.minutes, 0) / days.length);

export const CATALOG_AEROBIC_ENDURANCE: ProgramSeed[] = [
  {
    slug: "aerobic-endurance-builder-8-week",
    name: "Aerobic Endurance Builder",
    summary: "For building an aerobic base on any machine or on foot: about 45% more weekly endurance time in eight weeks, mostly at talk-test effort.",
    description:
      "For people who can already run, cycle or walk briskly without stopping for about 20–30 minutes and want a bigger aerobic base. This is not a " +
      "couch-to-5K: there are no run/walk intervals. Each week has an easy session with a few relaxed strides, a second easy session that gains short " +
      "blocks of steady tempo from week 5, and one longer easy session that grows from 35 to 55 minutes. Almost all of the work is at an easy, " +
      "conversational effort (RPE 3–4, often called zone 2), set by the talk test rather than pace. Weekly time on the three core sessions rises from " +
      "about 85 to about 125 minutes, never more than about 10% above the previous full week, with a cutback in week 4 and an easier final week that " +
      "ends with a 30-minute aerobic check against your week 1 baseline. Running is the default, but a bike, rower or brisk incline walk works for any " +
      "session, and one or two optional easy cross-training days let you train three to five days a week.",
    category: "cardiovascular",
    types: ["cardio"],
    difficulty: "beginner",
    weeks: 8,
    sessionMinutes: meanMinutes(AEROBIC_WEEKS[0]!.days),
    goals: ["improve_conditioning", "general_health"],
    equipment: ["bodyweight"],
    tier: "pro",
    completion:
      "Complete at least 80% of the 24 core sessions — 20 or more — including the week 8 aerobic check. The optional easy days are a bonus and don't count toward it.",
    progression:
      "Core weekly time goes about 86 → 95 → 104 minutes, drops about 25% in the week 4 cutback, then 107 → 117 → 125 minutes — never more than about 10% " +
      "above the previous full week. The long session grows from 35 to 55 minutes, Monday's easy session from 25 to 32 minutes with 4 → 6 strides, and from " +
      "week 5 Wednesday adds steady tempo at RPE 6 (2 × 5 → 3 × 5 → 2 × 8 minutes). Week 8 is easier and ends with a 30-minute aerobic check. Repeat a " +
      "week if the long session left you sore or drained the next day.",
    progressionModel: "steady",
    warmup: AE_WARMUP,
    cooldown: AE_COOLDOWN,
    days: AEROBIC_WEEKS[0]!.days,
    weekTemplates: AEROBIC_WEEKS,
    milestones: [
      "Completed 25-, 25- and 35-minute sessions at talk-test effort and noted your distance at 30 minutes of the long session.",
      "Built to about 95 minutes for the week, all easy, with five relaxed strides and a 38-minute long session.",
      "Reached about 105 minutes of easy aerobic work, six strides and a 42-minute long session, still able to talk throughout.",
      "Cutback week: about 25% less time, finishing fresh with no lingering soreness or heavy legs.",
      "Completed your first steady tempo, 2 × 5 minutes at RPE 6, and a 45-minute easy long session.",
      "Completed 3 × 5 minutes of steady tempo and a 50-minute long session, about 117 minutes for the week.",
      "Peak week: 2 × 8 minutes steady, a 55-minute long session and about 125 minutes in total, roughly 45% more than week 1.",
      "Finished the easier final week and the 30-minute aerobic check: more distance than week 1 at the same easy effort, or the same distance feeling easier.",
    ],
    instructions: [
      "Set effort by the talk test, not pace: easy sessions are RPE 3–4 out of 10 (you can speak in full sentences), and the steady tempo from week 5 is about RPE 6 (short phrases only). On hot or hilly days, slow down to keep the effort the same.",
      "Do the three core sessions on non-consecutive days, for example Mon/Wed/Sat. For four or five days, add one or two optional easy sessions of up to 20 minutes on Tue and Thu (bike, rower, brisk incline walk or an easy run) — one new day at a time, none in weeks 4 and 8, and drop them first if you feel tired.",
      "Any session can be done on a bike, rower or as a brisk incline walk for the same time at the same effort. Record runs with the app's GPS run recorder, or log treadmill, bike and rower sessions by hand, so you can see your weekly minutes build.",
      "Missed a session? Carry on with the next one in order rather than doubling up — there's no need to restart. If you miss two or more core sessions in a week, repeat that week before moving on.",
      "Stop, and get advice from a doctor before training again, if you feel chest pain or pressure, dizziness or faintness, or unusual breathlessness. Sharp or worsening pain in a joint or bone also means stop and get it checked.",
    ],
    catalogNumber: 26,
  },
];
