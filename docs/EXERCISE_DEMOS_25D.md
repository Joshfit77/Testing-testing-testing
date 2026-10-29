# Premium 2.5D exercise demonstrations

The owner's direction (2026-10-29): replace the live 3D anatomical figure, the gold anatomical models and the animated
illustrations in the main exercise library with pre-rendered 2.5D demonstrations of **one athlete**: the realistic
black-and-gold male from the owner's dumbbell curl reference image (same physique, face, hairstyle, dark graphite body,
gold anatomical highlights, glowing highlight on the working muscles, black fitted shorts, realistic equipment, dramatic
lighting, matte charcoal background). No live rotatable model in the library; smooth looped motion; fast on iPhone.

Nothing is approved by code. Each asset carries a status the app shows until the owner approves it: `stand-in`,
`review`, `approved`. The animated illustration stays as the fallback for every exercise without an approved asset.

## 1. Where the old visuals are used (audit, branch `claude/3d-in-workout`)

| Where | What it rendered | Now |
| --- | --- | --- |
| `src/app/(app)/train/exercises/[slug]/page.tsx` (exercise page hero and the "Animated demo" fold under uploaded media) | `ExerciseDemo3D` for the five slugs in `src/lib/anatomy3d/in-app.ts` (gold Écorché, live WebGL), `ExerciseDemo` (illustration) for the rest | `ExerciseDemo` for all: the 2.5D asset when one exists, else the illustration. The 3D figure is gone from this page. |
| `src/components/workout/exercise-card.tsx` (workout logger, 80×60 card and its enlarge dialog) | `ExerciseDemoMini`: illustration loop / still, dialog with 3D for the five | 2.5D still / loop in the card, 2.5D in the dialog; no 3D. |
| `src/app/(app)/train/exercises/page.tsx` (library list thumbnails) | `ExerciseThumb`: illustration still drawn on a canvas | 2.5D `thumb.webp` when it exists, else the canvas still. |
| `src/components/train/exercise-demo.tsx` | the illustration player and the 3D dispatch | the dispatcher (`ExerciseDemo` → `ExerciseDemo25D` or `ExerciseIllustration`) |
| `src/components/train/exercise-demo-3d.tsx`, `src/lib/anatomy3d/*`, `public/anatomy/*` (28 MB of model files) | the live 3D player, rig, solver, bakes | kept only for `/train/3d` (the isolated anatomy showcase, `showcase-3d.tsx`); not used by the library. Candidates for removal once the 2.5D library is approved. |
| `src/lib/exercise-motion/*`, `src/data/exercise-motions.ts` | the 157 animated illustrations | the fallback; unchanged. |
| `exercise_media` table + `exercise-media` bucket (admin upload) | owner-uploaded videos/images shown above the demo | unchanged; still shown first when present. |
| `scripts/anatomy/*`, `docs/anatomy3d/*` | the 3D tooling and status | unchanged; the anatomy feature's own record. |

The first replacement: the dumbbell biceps curl (`dumbbell-curl`), on its exercise page, the logger card and the
library list, because it is the owner's reference exercise. The other nine of phase 1 follow the same path once the
first loop is approved: `back-squat`, `push-up`, `seated-cable-row`, `kettlebell-swing`, `zone-2-run`, `sled-push`,
`triceps-pushdown`, `lateral-raise`, `inverted-row`.

## 2. The new system

- **Component** `src/components/train/exercise-demo-25d.tsx`: poster first, then a muted inline loop (`loop.webm`
  with `loop.mp4` fallback), play/pause, 0.5×/1×, phase buttons that seek to the start/mid/top positions, a line
  naming the highlighted muscles, and the status badge. Reduced Motion: poster, play on tap. A still-only asset says
  "the animated loop has not been produced yet". If the video fails, the phase stills show; if there are none, the
  illustration would have been used instead (the dispatcher only picks an asset that exists).
- **Manifest** `src/data/exercise-demos.json`, read by `src/lib/exercise-demos.ts` (`has25dDemo`, `getDemoAsset`).
- **Assets** `public/exercise-demos/<slug>/`: `poster.webp` (1200×900), `thumb.webp` (480×360), `loop.mp4` (H.264,
  30 fps, ≤ 2.5 MB), `loop.webm` (VP9), `phase-N.webp`. Bundled with the app, so they load from the device in the
  iPhone app and are cached by the service worker on the web.
- **Pipeline** `scripts/exercise-demos/build.mjs` from `assets/exercise-demos-src/<slug>/` (a rendered loop, a frame
  sequence, or phase stills, plus `meta.json`): letterboxes to 4:3 on `#0a0a0a`, encodes, extracts the phase stills,
  measures the loop seam (first vs last frame), checks sizes, writes the manifest. Re-running replaces that slug only.

## 3. What is needed to produce the assets (read before phase 1 continues)

The reference is a still made by an image model. Turning it into **the same athlete performing a smooth rep** needs
generation tools this environment does not have:

| Need | Tool class | Why |
| --- | --- | --- |
| The athlete, identical across frames and exercises | an image model with character/reference conditioning (e.g. the model that made the reference, with the reference attached as the character; Midjourney `--cref`; Flux Kontext) | keyframes (start, mid, top) of each exercise with the same face, body and lighting |
| Smooth motion between those keyframes | an image-to-video / keyframe-to-video model (e.g. Kling, Runway Gen-4, Luma Dream Machine, Veo) with the start and end frames given | a 2–4 s rep that loops; frame interpolation alone warps limbs and equipment |
| Loop closure, encoding, phase stills | this repo's pipeline (ffmpeg) | done here |

Without those, the only things this session can render are the rejected looks: the Écorché/gold rig and the
illustrations. So the owner either (a) generates the curl keyframes and the loop with their own tools and drops the
files into `assets/exercise-demos-src/dumbbell-curl/`, or (b) authorises an API account for one of the models above
(a paid service; nothing is bought without the owner's say-so) and gives the session network access to it, and the
pipeline then runs the same recipe for every exercise. Either way the first result goes on the curl page for review
before the other nine are made.

### Recipe for one exercise (the curl)

1. **Character sheet**, once: generate the reference athlete front, three-quarter and side on the charcoal
   background, same lighting, holding nothing. Keep these as the character reference for every later generation.
2. **Keyframes**: with the character reference attached, generate `start.png` (arms extended, dumbbells at the
   thighs, supinated grip), `mid.png` (forearms at 90°), `top.png` (full curl, biceps peaked), same camera
   (three-quarter front, waist-up or full body, 4:3 or taller), same background and lighting, gold glow on the
   biceps only. Reject any frame where the face, hair, proportions, shorts or dumbbell size drift.
3. **Motion**: image-to-video from `start` to `top` (and `top` back to `start`, or ask for a loop), 2–3 s, no camera
   move, no background change. Reject warping, extra fingers, floating or morphing dumbbells.
4. Put `loop.mp4` (or the frame sequence in `frames/`), the keyframes and `meta.json` in the slug folder; run the
   build; open `/train/exercises/dumbbell-curl`.

`meta.json` for the curl:

```json
{ "status": "review", "highlighted": ["biceps"], "phases": [{ "label": "Start", "t": 0 }, { "label": "Top", "t": 1.2 }] }
```

### Prompt template (the same words every time, only the exercise block changes)

> Realistic 3D-rendered adult athletic male, muscular physique, clean proportions, neutral face, short dark hair,
> dark graphite skin with metallic gold anatomical highlights along the muscles, black fitted athletic shorts, matte
> charcoal background, dramatic rim lighting, premium luxury fitness-app look, not cartoon, not medical illustration.
> Same character as the reference image. [EXERCISE: name; equipment, realistic; position; the muscles glowing
> gold/amber: …; camera: three-quarter front, full body, eye level; no text, no logos.]

| Exercise | Equipment | Glow | Camera note |
| --- | --- | --- | --- |
| Dumbbell Biceps Curl | two dumbbells | biceps (forearms faint) | three-quarter front, full body |
| Barbell Back Squat | barbell on the upper back, rack behind | quadriceps, glutes | three-quarter front |
| Push-Up | floor | chest, triceps | low three-quarter side |
| Seated Cable Row | cable machine, V-handle | upper back, lats | side |
| Kettlebell Swing | kettlebell | glutes, hamstrings | side |
| Easy Zone 2 Run | none (running shoes) | calves, quadriceps, glutes (light) | side, mid-stride |
| Sled Push | weighted sled | quadriceps, glutes | side |
| Cable Triceps Pushdown | cable, straight bar | triceps | three-quarter front |
| Dumbbell Lateral Raise | two dumbbells | side deltoids | front |
| Inverted Row | bar in a rack, body under it | upper back, lats | side |

## 3b. Reaching a video model from this environment (checked 2026-10-29)

The sandbox's network policy decides which generation services a session can call. Checked with a plain request
to each API host: only Google's `generativelanguage.googleapis.com` (Veo through the Gemini API) answered; OpenAI,
Runway, Kling, Luma, Replicate and fal were refused by the policy. So, from here, the only API path is Veo with a
Google AI API key stored as an environment secret (never pasted in chat), and it is a paid service: nothing is
bought without the owner's approval. The other path is the owner's own ChatGPT Plus account, whose Sora does
image-to-video from the reference; the clips are then dropped into the source folders.

Cost picture (list prices move; check before approving): video models bill per second of output. At roughly
$0.40–$0.75 per second, one 5-second clip is about $2–$4, and a usable clip typically takes 2–4 attempts. For 157
exercises with one angle that is on the order of $600–$2,400; a second angle for the exercises that need one adds
roughly half again. Keyframe generation with an image model is cheap by comparison (cents per image). The owner's
ChatGPT Plus subscription includes a daily Sora allowance at no extra charge, which suits the curl proof and the
first ten, and the API suits the remaining batches.

## 3c. The full library: how it is tracked and when an exercise is complete

- `assets/exercise-demos-src/SHEET.md` (generated): all 157 exercises in production order (the curl, then the
  owner's ten, then batches grouped by equipment), each with the equipment to render, the muscles to glow, the
  subtle secondaries, the camera, the length, whether it loops, and the second angle where form needs it.
- `docs/EXERCISE_DEMOS_STATUS.md` (generated by `scripts/exercise-demos/status.mjs`): one row per exercise with
  the owner's eight checks: asset created (YES / STILL ONLY / NO), character consistency, form and biomechanics,
  equipment, muscle highlighting, video playback, mobile performance, owner approval. The verdicts live in each
  exercise's `meta.json` (`review`), and `status: "approved"` is the owner's word only.
- An exercise is **complete** only when it has a real moving clip, every check reads PASS, and the owner has
  approved it. A clip is never reused for another exercise whose grip, equipment, body position or mechanics differ.
- Second angles go in `angles/<name>/loop.mp4`; the player shows a Main / Side (or Front) switch.
- Clips carry no audio track (the build strips it); the player is muted, inline, loops where the sheet says so,
  honours Reduced Motion (poster, play on tap), and offers 0.5× for study.

## 4. Phases

1. One animated curl on the real exercise page (this document's recipe), reviewed by the owner on the phone: the
   method's proof, so that 157 inconsistent or defective clips are never produced.
2. The owner's ten, same recipe, one review pass over all ten pages (look, smoothness, highlighting, equipment, UI,
   phone appearance).
3. The remaining 147 in the sheet's order, in batches of about 20 grouped by equipment, each batch reviewed with
   the status table before the next; `status` moves to `approved` per exercise only on the owner's word (the
   `meta.json` edit is the record). The illustration stays the fallback for every exercise not yet approved.
4. When every exercise an athlete can reach in the library is approved, the 3D player, rig, solver, bakes and the
   28 MB of model files are removed from the main app (the owner's call, a separate change).

What is not changed by this work: exercise names, categories, muscles, difficulty, cues, setup steps, descriptions,
logging, programs, filters, navigation, prices.
