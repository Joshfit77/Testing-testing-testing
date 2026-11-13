/**
 * Existing library programs adopted into the 40-program Pro catalog (docs/pro/PROGRAM_CATALOG.md). Their prescriptions
 * are unchanged (members may be part-way through them); this only adds the catalog number, one milestone per week and
 * the before-you-start instructions every catalog program carries.
 */
export interface AdoptedCatalogEntry {
  catalogNumber: number;
  milestones: string[];
  instructions: string[];
}

const MISSED_SESSION =
  "Missed a session? Carry on with the next session in order rather than doubling up; if you miss two or more sessions in a week, repeat that week before moving on.";

const STOP_LIFTING =
  "Stop the session and get advice from a doctor or physiotherapist if you feel sharp or joint pain, dizziness or chest pain — a hard set should feel heavy, not painful.";

const STOP_RUNNING =
  "Stop and walk, and get advice from a doctor or physiotherapist, if you feel sharp pain, dizziness, chest pain or unusual breathlessness.";

const RUN_TRACKING =
  "Record each run with the app's GPS run recorder, or log treadmill runs by hand, so you can see the week build; running time rises gradually and is never increased aggressively, so don't add extra runs or distance on top.";

export const ADOPTED_CATALOG: Record<string, AdoptedCatalogEntry> = {
  "powerlifting-peaking-12-week": {
    catalogNumber: 3,
    milestones: [
      "Completed week 1's volume — squat and bench sets of 6 at 70%, deadlift 3 × 5 at 72.5% — at about RPE 7, confirming your 1RM estimates.",
      "Moved every main lift up 2.5% at about RPE 7.5 and kept the paused squat and paused bench reps still and controlled.",
      "Completed squat and bench sets of 6 at 75% and deadlift fives at 77.5% at about RPE 8, with no set more than 1 RPE over target.",
      "Finished the accumulation phase with sixes at 77.5% and deadlift fives at 80%, all at or close to RPE 8.",
      "Completed the deload week at about RPE 6 and arrived at the heavy phase feeling fresh.",
      "Started intensification with 5 × 3 at 80% on squat and bench and deadlift doubles at 82.5%, at about RPE 7.5.",
      "Handled 5 × 3 at 82.5% and deadlift doubles at 85% at about RPE 8 with steady bar speed.",
      "Completed 5 × 3 at 85% and deadlift doubles at 87.5% at RPE 8.5, holding the weight wherever a set ran more than 1 RPE high.",
      "Finished the heaviest triples of the block at 87.5%, and deadlift doubles at 90%, at about RPE 9 without a missed rep.",
      "Peak week: hit heavy singles at 92.5% on squat and bench and your last heavy deadlift single at 90%, about ten days out.",
      "Taper week: practised your openers on squat and bench at about RPE 6 with roughly half the usual volume and only light, fast pulls.",
      "Meet week: openers early in the week, a short light technique session, rest, then three attempts per lift on meet day or a max-test day.",
    ],
    instructions: [
      "This meet-prep plan has not yet been reviewed by a qualified coach, so if you are preparing for a competition, ask a coach to look over it and your attempt choices.",
      "Percentages are of your current 1RM: use a recent max or estimate one from a recent heavy set rather than testing before you start, and if week 1's sets feel harder than RPE 7, lower your estimate until they don't.",
      "Train four days a week with the two squat days apart, for example Mon/Tue/Thu/Fri, and in week 12 count back from your meet or test day so the openers session comes early in the week.",
      "Missed a session? Carry on with the next session in order rather than doubling up; if you miss two or more sessions in a week, repeat that week — except in weeks 10–12, where you keep to your meet date and skip what you missed.",
      STOP_LIFTING,
    ],
  },

  "bench-press-specialist": {
    catalogNumber: 4,
    milestones: [
      "Completed all four sessions and found heavy-triple, volume and paused bench weights that each left about 3 reps in reserve (RPE 7).",
      "Added a small step to any bench lift where every set finished at or below target, now working at about RPE 7.5.",
      "Benched at about RPE 8 on all three bench days with a consistent bar path and a motionless pause on the chest.",
      "Completed week 4 at about RPE 8.5 and noted which bench day — heavy, volume or paused — is moving best.",
      "Reached RPE 9 on the heavy triples while keeping every paused rep still on the chest.",
      "Held the RPE 9 target for a second week, adding weight only where every set of the main bench lift stayed at or below it.",
      "Finished the last hard week at RPE 9 with crisp form, keeping the weight the same on any lift whose sets ran over target.",
      "Deload week: completed fewer sets at about 60% of recent working weights, with the option to test a new max at the end if you feel fresh.",
    ],
    instructions: [
      "Choose weights by effort: ramp up through the warm-up sets and settle on a weight that leaves about 3 reps in reserve (RPE 7) in week 1; the rough percentages in the exercise notes are a guide, the RPE decides.",
      "Train four days a week with the bench days spread out, for example Mon (heavy), Tue (lower body), Thu (volume) and Sat (paused).",
      "Add a small step to the main bench lift only when every set finished at or below the target RPE; otherwise keep the same weight next week.",
      "Use a spotter or safety arms set just below chest height for every heavy and paused set.",
      MISSED_SESSION,
      STOP_LIFTING,
    ],
  },

  "squat-specialist": {
    catalogNumber: 5,
    milestones: [
      "Completed all four sessions and found heavy, pause and tempo squat weights that left about 3 reps in reserve (tempo squats a little easier).",
      "Added a small step to the heavy squat where every set finished at or below target, now working at about RPE 7.5.",
      "Squatted at about RPE 8 on all three squat days, holding a braced 2-second pause and a steady 4-second lowering.",
      "Completed week 4 at about RPE 8.5 on heavy and pause squats with depth and bracing unchanged.",
      "Reached RPE 9 on heavy and pause squats, with tempo squats at about RPE 8.5 and no grinding reps.",
      "Held the RPE 9 target for a second week, adding weight to the heavy squat only when every set stayed at or below it.",
      "Finished the last hard week at RPE 9 with consistent depth, keeping the weight the same wherever sets ran over target.",
      "Deload week: completed fewer sets at about 60% of recent working weights and finished the block feeling fresh.",
    ],
    instructions: [
      "Choose weights by effort: ramp up through the warm-up sets and settle on a weight that leaves about 3 reps in reserve (RPE 7) in week 1; the rough percentages in the exercise notes are a guide, the RPE decides.",
      "Train four days a week with the squat days spread out, for example Mon (heavy), Tue (upper body), Thu (pause) and Sat (tempo).",
      "Add a small step to the heavy squat only when every set finished at or below the target RPE; otherwise keep the same weight next week.",
      "Squat inside a rack with the safety arms set just below your bottom position.",
      MISSED_SESSION,
      STOP_LIFTING,
    ],
  },

  "deadlift-specialist": {
    catalogNumber: 6,
    milestones: [
      "Completed all three sessions and found heavy-triple and deficit-pull weights that left about 3 reps in reserve, resetting every rep.",
      "Added weight to the heavy deadlift only where all sets finished at or below RPE 7.5 with a flat back.",
      "Pulled at about RPE 8 on heavy and deficit days, holding the farmer's carries for the full 40 seconds.",
      "Completed week 4 at about RPE 8.5 with no rounding on any heavy deadlift rep.",
      "Reached RPE 9 on heavy deadlift triples and deficit pulls while still resetting each rep from a dead stop.",
      "Held the RPE 9 target for a second week, adding weight only when every heavy set stayed on target with a flat back.",
      "Finished the last hard week at RPE 9 with a consistent back position, keeping the weight the same wherever sets ran over target.",
      "Deload week: completed fewer sets at about 60% of recent working weights and finished the block feeling fresh.",
    ],
    instructions: [
      "Choose weights by effort: ramp up through the warm-up sets and settle on a weight that leaves about 3 reps in reserve (RPE 7) in week 1; the rough percentages in the exercise notes are a guide, the RPE decides.",
      "Train three non-consecutive days a week, for example Mon (heavy deadlift), Wed (upper body) and Fri (squat and deficit pulls).",
      "Add weight to the heavy deadlift only when every set finished at or below the target RPE with a flat back; otherwise keep the same weight next week.",
      MISSED_SESSION,
      STOP_LIFTING,
    ],
  },

  "dumbbell-home-strength": {
    catalogNumber: 18,
    milestones: [
      "Completed all three full-body sessions and picked a dumbbell for each exercise that left about 3 reps in reserve (RPE 7).",
      "Added reps within each range at about RPE 7.5, moving to the next dumbbell wherever every set reached the top of the range.",
      "Worked at about RPE 8 (2 reps in reserve) on the main lifts with the same controlled form as week 1.",
      "Reached about RPE 8.5 (1–2 reps in reserve) on every exercise, the hardest effort this plan asks for.",
      "Held 1–2 reps in reserve for another week and moved up a dumbbell wherever every set reached the top of its range.",
      "Where your heaviest dumbbell felt too light, slowed the lowering to 3 seconds or added a set to stay at 1–2 reps in reserve.",
      "Finished the last hard week at 1–2 reps in reserve and noted your best dumbbell and reps for each exercise.",
      "Deload week: completed fewer sets at about 60% of recent working weights and finished the plan feeling fresh.",
    ],
    instructions: [
      "Choose dumbbells by effort: start lighter than you think and pick the weight you could lift about 3 more times at the end of each set (RPE 7) in week 1.",
      "Train three non-consecutive days a week, for example Mon/Wed/Fri, in the order A, B, C.",
      "Use double progression: stay with a dumbbell until every set reaches the top of the rep range with 1–2 reps in reserve, then move to the next one.",
      MISSED_SESSION,
      STOP_LIFTING,
    ],
  },

  "calisthenics-foundations": {
    catalogNumber: 19,
    milestones: [
      "Completed sessions A, B and A and chose a progression for each movement that let you hit the rep range with about 3 reps in reserve.",
      "Completed sessions B, A and B at about RPE 7.5, adding reps and moving up a progression wherever the top of the range felt easy.",
      "Handled the extra fourth set on the main pairs — pull-ups, push-ups, split squats, rows, pike push-ups and single-leg RDLs — at 1–2 reps in reserve.",
      "Deload week: completed two sets of easier variations, stopping well short of failure on every rep.",
      "Started block 2 at about 3 reps in reserve, ideally on a harder progression than week 1 for at least one movement.",
      "Added reps across sessions B, A and B at about RPE 7.5, moving up a progression wherever the top of the range felt easy.",
      "Completed four sets on the main pairs at 1–2 reps in reserve, the hardest week of the plan.",
      "Deload week: finished with easier variations and noted your current progression and best reps for each movement.",
    ],
    instructions: [
      "Choose the progression for each movement by effort, not by what you think you should manage: pick the version that lets you reach the bottom of the rep range with about 3 reps in reserve (RPE 7), such as the lightest band that still gives you 5 pull-ups.",
      "Train three non-consecutive days a week, for example Mon/Wed/Fri; the sessions alternate A and B, so each week starts where the last one left off.",
      "When every set reaches the top of the rep range, move to the next progression and start again at the bottom of the range.",
      MISSED_SESSION,
      STOP_LIFTING,
    ],
  },

  "5k-training": {
    catalogNumber: 23,
    milestones: [
      "Completed a 25-minute easy run, 6 × 1 min at about 5K effort and a 35-minute easy long run.",
      "Ran 28 minutes easy, 7 × 1 min repeats and a 40-minute long run, keeping the easy runs conversational.",
      "Finished 8 × 1 min repeats and a 45-minute easy long run, the longest of the base phase.",
      "Cutback week: shorter easy runs and four relaxed strides in place of repeats, so you start the build phase fresh.",
      "Completed 5 × 3 min at 5K effort with even pacing and a 50-minute easy long run.",
      "Held 5 × 3 min at 5K effort, the last rep no faster than the first, and extended the long run to 55 minutes.",
      "Completed 4 × 3 min at 5K effort and a second 55-minute long run, the last full week before the taper.",
      "Race week: short easy runs, 3 × 1 min at race effort to stay sharp, then a 5K race or time trial.",
    ],
    instructions: [
      "Set your effort rather than a target pace: easy runs pass the talk test (you can speak in full sentences), and repeats are hard but controlled, at about the effort you could hold for a 5K.",
      "Run three days a week with a rest day between runs, for example Tue (easy), Thu (repeats) and Sat or Sun (long run).",
      RUN_TRACKING,
      MISSED_SESSION,
      STOP_RUNNING,
    ],
  },

  "10k-training": {
    catalogNumber: 24,
    milestones: [
      "Completed four runs: two easy, 6 × 60 s hill or flat repeats and a 45-minute easy long run.",
      "Repeated 6 × 60 s at a controlled effort and extended the easy long run to 50 minutes.",
      "Finished the base phase with 6 × 60 s repeats and a 55-minute easy long run.",
      "Cutback week: about 25% less running and relaxed strides instead of a hard session.",
      "Completed 3 × 8 min at a comfortably hard threshold effort and a 60-minute easy long run.",
      "Repeated 3 × 8 min at threshold with an even effort across reps and a 65-minute long run.",
      "Second cutback week: shorter runs and relaxed strides only, ready for 10K-pace work.",
      "Completed 4 × 10 min at goal 10K pace and the longest easy run of the plan, 70 minutes.",
      "Repeated 4 × 10 min at 10K pace and a second 70-minute long run, with the easy runs still conversational.",
      "Race week: short easy runs, 4 × 1 min at race pace, then a 10K race or time trial.",
    ],
    instructions: [
      "Set your effort rather than a target pace: easy runs pass the talk test, threshold reps are comfortably hard, and 10K pace is the pace you can realistically hold for the race.",
      "Run four days a week without putting the quality session and long run back to back, for example Tue (easy), Thu (quality), Sat (easy with strides) and Sun (long run).",
      RUN_TRACKING,
      MISSED_SESSION,
      STOP_RUNNING,
    ],
  },

  "half-marathon-base-80-20": {
    catalogNumber: 25,
    milestones: [
      "Completed four runs: easy running, 6 × 60 s hill repeats, calf raises and single-leg RDLs after the strides run, and a 60-minute easy long run.",
      "Kept the easy runs conversational, repeated the six hill repeats and extended the long run to 65 minutes.",
      "Finished the base phase with six hill repeats and a 70-minute easy long run.",
      "Cutback week: about 25% less running and 1-minute relaxed strides instead of a hard session.",
      "Completed 3 × 8 min at a comfortably hard threshold effort and a 75-minute easy long run.",
      "Repeated 3 × 8 min at threshold with an even effort and extended the long run to 80 minutes.",
      "Finished the threshold block and a 90-minute easy long run, practising drinking and fuelling on the run.",
      "Second cutback week: shorter runs and relaxed strides only, to absorb the build phase.",
      "Completed 3 × 15 min at goal half-marathon pace and a 95-minute easy long run.",
      "Repeated 3 × 15 min at half-marathon pace and extended the long run to 100 minutes.",
      "Completed the last race-pace session and your longest run, 105 minutes easy, with your race-day fuelling practised.",
      "Race week: short easy runs and 4 × 1 min at race pace, then the half marathon — conservative start, strong finish.",
    ],
    instructions: [
      "Set your effort rather than a target pace: about 80% of your running should pass the talk test, threshold reps are comfortably hard, and half-marathon pace is the pace you can realistically hold for the race.",
      "Run four days a week without putting the quality session and long run back to back, for example Tue (easy), Thu (quality), Sat (easy with strides and strength work) and Sun (long run).",
      RUN_TRACKING,
      "Missed a session? Carry on with the next session in order rather than doubling up; if you miss two or more sessions in a week, or a week leaves you unusually tired or sore, repeat that week before moving on.",
      STOP_RUNNING,
    ],
  },
};
