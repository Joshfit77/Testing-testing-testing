# Exercise library: 218 exercises

Branch `claude/pro-premium`, 2026-11-13. Basic exercise education stays free.

## Counts

* 218 exercises (157 existing + 61 new); 134 can be done at home.
* By library group: chest 20, back 19, shoulders 25, biceps 11, triceps 8, quads and glutes 26, hamstrings and calves
  17, core 20, functional 57, mobility 15.

The target distribution in the brief (210) was not met in every group: chest (25), back (30), biceps (15), triceps (15),
quads/glutes (30) and hamstrings/calves (20) are short, functional is well over. Movements that could not be drawn
accurately in the 2D system were rejected rather than added with a wrong demonstration.

## What each exercise has

ID (stable, from the slug), name, category, primary and secondary muscles, equipment, difficulty, numbered steps,
starting position, execution cues, breathing, common mistakes, range of motion, setup and safety notes, substitutions
(every one checked to exist), aliases, home or gym, and a 2D demonstration. Checked for every exercise by
`tests/unit/exercise-library.test.ts`.

## Demonstration status (honest)

| Status | Count | Meaning |
|---|---|---|
| Animated | 217 | Passes the automated motion checks. The 61 new ones also had an AI review of the six rendered phases. |
| Placeholder | 1 (`bench-dip`) | The drawing read as sitting, so the app shows the labelled placeholder instead. |
| Owner approved | 0 | Nobody has signed any demonstration off. |

**No demonstration has been reviewed by a coach, physiotherapist or other human biomechanics expert.** The app never
labels a demonstration as verified. Contact sheets for review: `node scripts/exercise-review/contact-sheets.mjs
<outDir> --only=<slugs> --per=8 --w=200`.

## Search

Name, aliases and common shorthand (db, bb, kb, ohp, rdl...), muscle, equipment, difficulty, movement pattern, home or
gym, with "Did you mean" suggestions (`src/lib/domain/exercise-search.ts`, `tests/unit/exercise-search.test.ts`).

## Not done

* Human review of the foundational 20 and of the 61 new demonstrations.
* The six groups short of the brief's target.
* 3D: out of scope by instruction; the experimental prototype is untouched.
