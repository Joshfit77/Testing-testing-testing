# The opening (Narrow Gate intro)

A short, cinematic introduction that plays every time the app is opened fresh, then hands over to the app. Branch
`claude/animated-opening-demo`. Nothing here is deployed.

## What you see (about 5 seconds)

| Time | |
| --- | --- |
| 0 s | Black. |
| 0.15 s | The Narrow Gate Fitness logo fades in. |
| 0.45 s | The scene fades up out of the dark: a dark stone wall, a tall narrow arched doorway with a moulded bronze-and-gold architrave (keystone, plinths), a polished threshold and floor. The door is shut; a thin line of white light leaks round it and spills under it onto the threshold. The camera drifts slowly forward the whole time. |
| 1.3–2.9 s | The door swings open on its hinge, inward, in real 3D. Soft white light pours out: it lights the reveal, the floor and the inside edge of the mouldings, glows in the haze and is reflected by the floor. Mist drifts through the light; a few motes of dust catch it. |
| 1.7 s | Matthew 7:13–14 (BSB) fades in below the doorway; at 2.15 s, **Enter Narrow Gate**. |
| 3.85 s, or as soon as Enter is pressed | The camera moves forward through the doorway, the light fills the screen, and the app fades in (about 1.2 s). |

**Skip intro** (top right, from 0.3 s) and **Escape** fade it out at once. With Reduce Motion on (the iPhone setting
or the app's own), nothing moves: the scene and the words fade in with the door already open, and it fades out at the
same time, without the move into the light.

The verse text comes from the verified BSB file (`src/data/bsb-passages.json` via `scriptureText`), never typed by
hand. The welcome page shows the same gate, still and open, with the verse beneath it.

## When it plays

`src/lib/opening.ts` decides, in an inline script in `<head>`, before the first paint, so neither the app nor the intro
ever flashes:

- **Plays** on every full load of the app: a fresh launch, a reload, reopening after the app was closed (in the
  iPhone/Android app, relaunching reloads the page). It is in the root layout, which stays mounted while you move
  around, so switching between Home, Train, Run, Food and Faith (or any in-app link) never replays it.
- **Does not play** on sign-in, sign-up, password, legal, onboarding and admin pages; when reloading straight into a
  live activity (the workout logger, the GPS recorder, the body-scan camera, the barcode scanner, the smart alarm);
  whenever a workout or a GPS recording is in progress on the device, whatever the page; or in a background tab.
- Browser tests and demo captures set `ngf.e2e.noIntro` in local storage to keep it out of the way.

The script also handles Skip, Enter and Escape and the automatic finish, so the intro works and ends even before the
page's JavaScript has loaded, or without it. The page beneath is inert while it plays; focus is in the dialog and Tab
moves between its two buttons.

## The gate pictures

The gate is not a drawing: `scripts/opening/render_gate.py` renders it with a small physically based renderer (numpy):
real geometry (the wall, the doorway and its reveal, the threshold, the floor), the white light beyond the doorway
treated as an area light (with the open door's shadow), single scattering in the haze, film-like tone mapping and a
little bloom. It writes four pictures to `public/opening/` and the camera numbers the CSS needs to
`src/components/common/gate-geometry.json`:

| File | Size | What it is |
| --- | --- | --- |
| `gate-base.webp` | 1800 × 2700 | the scene with the door shut (only the leaking light) |
| `gate-light.webp` | 1800 × 2700 | the light the open door adds; laid on top in proportion to how far it has opened |
| `gate-door.webp` | door leaf, 2× its drawn size | the leaf; turned about its hinge with the renderer's own perspective, so it lines up |
| `gate-haze.webp` | 768 × 768 | a tileable mist texture drifted through the light |

They are only downloaded on loads where the gate is shown (CSS backgrounds), and preloaded by the head script as soon
as it decides the intro will play. Re-render with `python3 scripts/opening/render_gate.py` (about ten minutes;
`--preview` for a quick half-size look).

## Tests

- `tests/unit/opening.test.ts` runs the real inline script against 27 situations (pages, activities in progress,
  storage blocked, background tab) and checks Enter, Skip, Escape, the automatic finish and the preloading.
- `e2e/opening-gate.spec.ts` (real browser): replays on reload and on a fresh window, never on the five tabs; Enter
  moves into the light (the scene grows past 2.5× and the light covers the screen) before the app appears; Skip,
  Escape and the timer end it; the door turns 80° about its hinge; the verse is the verified text, fully on screen,
  legible and below the doorway, with the logo above the arch, on iPhone SE (both), iPhone 15, 15 Pro Max, landscape,
  iPad and desktop; reduced motion has no movement; the dialog is labelled, keeps focus and leaves nothing inert; the
  welcome page shows the gate centred with the verse beneath and Start free / Sign in on the first screen.
