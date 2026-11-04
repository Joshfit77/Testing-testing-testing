# Exercise demonstrations: the 2D character system

Owner direction, 2026-11-04: no 3D exercise models. One original 2D character, consistent across every exercise,
premium on the app's dark background, light and reliable on iPhone. Incomplete demonstrations are never presented as
finished. Per-exercise status: [`docs/EXERCISE_DEMOS_2D_STATUS.md`](EXERCISE_DEMOS_2D_STATUS.md) (generated).

## 1. What was removed or retired (the 3D system)

| Removed | What it was | Notes |
| --- | --- | --- |
| `src/lib/anatomy3d/` (all) | three.js rig, skinning, pose solver, apparatus, bakes, player | Only the 3D page and 3D component imported it (checked: Body Scan, the body map and every other feature do not) |
| `src/components/train/exercise-demo-3d.tsx`, `showcase-3d.tsx` | the in-app 3D player and showcase | |
| `src/app/(app)/train/3d/` | the 3D showcase page | `/train/3d` now redirects to the exercise library (`next.config.ts`) |
| `public/anatomy/` (58 MB) | the Écorché model (CC BY-SA, third-party), rig, skin, face and 18 baked motions | The app's public folder went from about 67 MB to 9.3 MB; the third-party anatomy model is no longer shipped |
| `scripts/anatomy/` | 3D build, bake, QA, preview and library-status tooling | |
| `docs/anatomy3d/` | 3D library status (18 motions: 11 pass, 3 polish, 4 fail, 0 owner-approved), checklist, licence notes | The 3D backlog items are closed as retired |
| `tests/unit/anatomy-*.test.ts` (4), `e2e/exercise-demo-3d.spec.ts` | 3D tests | Replaced by `tests/unit/exercise-demo-2d.test.ts` (asserts nothing 3D remains) and `e2e/exercise-demo-2d.spec.ts` |
| `three`, `@types/three`, `meshoptimizer`, `three-mesh-bvh` | dependencies | Uninstalled; `package-lock.json` changed by removals only |
| Live 3D figure in the clickable iPhone demo tool | `scripts/demo/iphone-demo/*` | The tool now captures screens only |
| Software-WebGL flags in `playwright.config.ts` | only needed for 3D | |
| Athlete-look "preview / compare with classic" switch | `src/lib/athlete-look.ts` | Replaced by the readiness states below |

**Archive:** the 3D work stays in git history (last commit with it: `20fc052`) and on its remote branches, which were not
deleted. Nothing 3D is reachable in the app.

**Preserved:** the 2D motion engine (`src/lib/exercise-motion`, 157 hand-made motions), the 2.5D clip pipeline for the
exercise-video backlog (`src/lib/exercise-demos.ts`, `scripts/exercise-demos/`), Body Scan, the body map and every
other feature.

## 2. The character

The black-and-gold athlete (`src/lib/exercise-motion/athlete.ts`): an original figure drawn in code on a canvas
(no third-party character, asset or illustration): graphite skin with gold rim light, black shorts and shoes, muscular
and anatomically proportioned, the exercise's working muscles glowing gold (primary fully, secondary softly). Side or
front view per exercise, chosen for the clearest read of the movement. It is now the only character: the older gold
figure and the 3D figure are no longer shown anywhere in the app.

Equipment in the athlete's style (graphite with gold edges): barbell and plates, axle, dumbbells, keg, bench and
incline bench, rack, cable tower, cable handles and rope, rowing station (`props-athlete.ts`); bands, trap bar,
farmer's handles, log, yoke, sleds and ropes, leg press, hack squat, lat pulldown, leg extension and leg curl machines,
stationary and air bikes, dip bars, pull-up rig, landmine and jump rope (`props-athlete-gear.ts`); the walls, bands,
landmine and sled made for particular rebuilt motions (`props-athlete-kit.ts`); agility cones, floor lines and the
ladder (`props-drills.ts`). Where a side-view barbell's near plate would hide the head or upper arms (squats, bench
press, overhead press, cleans, Zercher, hip thrust), it is drawn see-through with a gold rim, and solid again where it
covers nothing. Still in the plainer shared style, readable but not yet matched: kettlebell, battle ropes, ab wheel,
machine chest press, seated calf raise, back-extension bench, rower, chair, and the boxes, mats, walls, medicine balls,
sandbags and stones that were already dark and gold.

## 3. What an exercise shows (`src/lib/exercise-demo-readiness.ts`)

| State | Shown | When |
| --- | --- | --- |
| **Animated** | The moving athlete, looping, with play/pause, 0.5× and finger scrubbing | Passed the visual review in the athlete look (six phases: setup, path, equipment in the hands, no clipping, clean loop) and the automated motion checks |
| **Pose frames** | Two still frames side by side: Start and Mid-rep, labelled "Pose frames · animation in progress" | Key positions correct; something between them is not yet |
| **Placeholder** | "Demonstration in progress — follow the written steps, form cues and common mistakes for now" | The drawing would mislead |

Every state is shown with the written steps ("How to do it"), form cues and common mistakes on the exercise page, and
with the cues and mistakes on the workout card. An exercise not listed in `src/data/exercise-demo-readiness.json` is a
placeholder (never "finished" by default). `ownerApproved` is a separate list that code never fills.

A 2.5D clip replaces the athlete only once the owner has approved it (`shownDemoAsset`); none is approved today.

## 4. Workout player

The current-set card shows: exercise name, the 2D demo (tap to enlarge), set label, weight and reps steppers
pre-filled from last time, last time and the program target, the rest timer, **Form cues & common mistakes** (one tap
to open, from the exercise library) and **Swap for another exercise** (the existing substitute sheet, alternatives
first, sets already done stay logged). The logger itself (saving, sync, rest, skip, undo, finish) is unchanged; its
tests pass.

## 5. Performance

- The motion library is one lazily loaded chunk of about 197 KB (60 KB gzipped), fetched only when a demo appears; the
  enlarged demo, thumbnails and pose frames reuse it.
- Pose frames and thumbnails are single canvas draws (no animation loop); thumbnails draw only when scrolled into view.
- The trained muscles are passed from the page, so the 159 KB exercise catalog is no longer downloaded just to light
  them.
- No WebGL, no model downloads: the 3D page used to fetch tens of MB of model files.

## 6. Promoting an exercise

1. Fix its motion in `src/data/exercise-motions.ts` / `src/lib/exercise-motion/patterns` and run the motion tests
   (`tests/unit/exercise-motion*.test.ts`, `exercise-form.test.ts`).
2. Render it: `node scripts/exercise-review/contact-sheets.mjs out --w=420 --per=3 --only=<slug>` (athlete look by
   default) and review all six phases.
3. Set its entry in `src/data/exercise-demo-readiness.json` to `animated` (or `poses`), with a note if not animated.
4. Regenerate the status page: `npx tsx --tsconfig tsconfig.json scripts/exercise-review/readiness-report.ts`.
5. The owner records sign-off by adding the slug to `ownerApproved`. The owner's review sheet
   (`node scripts/exercise-review/review-sheet.mjs <out.html>`) shows every exercise moving, with Approve / Needs work
   and a note; decisions are kept against the motion's fingerprint, so a decision on an older version shows as out of
   date. Approvals are copied into `ownerApproved` only from the owner's own decisions, never by code.

## 7. Not done / owner decisions

- Owner review of the athlete look itself and of each exercise (none approved yet).
- A coach's review of the exercises flagged in `src/data/exercise-review-notes.ts`.
- Every exercise is now in the Animated state (phase 2, below). The Pose frames and Placeholder states stay in the
  code for exercises added later or demoted after review.
- The weakest reads, worth the owner's closest look: three-cone drill (turns are quick fades), thoracic open book,
  Pallof press, rear delt fly (front view; can look like a lateral raise) and hip escape. Each has a limitation note.
- Real-iPhone check of smoothness and battery on older phones (only checked in desktop Chromium at phone size).

## 8. Phase 2 (2026-11-04): every exercise animated

Four agents, each in its own branch, rebuilt the 31 exercises that were pose frames or placeholders (11 of them in
launch tier 1) plus hip abduction, and restyled the equipment above; each was checked at six phases and in 1x / 0.5x
frame strips, then by the reviewer, and merged. The merged code was re-rendered for all 157 exercises and reviewed
again by eye. `node scripts/exercise-review/fingerprint.mjs --compare=<before.json>` (a hash of each exercise's
keyframes) confirmed that exactly those 32 exercises changed movement and no other did. One merge interaction was
caught by rendering, not by tests (the restyled band, sled and landmine replaced the drawings made for three rebuilt
motions) and fixed so motion-specific props keep their own drawing.

Result: 157 animated, 0 pose frames, 0 placeholders, 53 with a limitation note (status page). Nothing is
owner-approved, and nothing has been reviewed by a coach.
