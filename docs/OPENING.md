# The opening (Narrow Gate intro)

A short, cinematic introduction that plays every time the app is opened fresh, then hands over to the app.
Nothing here is deployed.

## What you see (about 5 seconds)

| Time | |
| --- | --- |
| 0 s | Black. |
| 0.15 s | The Narrow Gate Fitness logo fades in. |
| 0.45 s | The scene fades up out of the dark: a dark stone wall, a tall narrow arched doorway with a moulded bronze-and-gold architrave (keystone, plinths), a polished threshold and floor. The door is shut; a thin line of white light leaks round it and spills under it onto the threshold. The camera drifts slowly forward the whole time. |
| 1.3–2.9 s | The door swings open on its hinge, inward, in real 3D. Soft white light pours out: it lights the reveal, the floor and the inside edge of the mouldings, glows in the haze and is reflected by the floor. Mist drifts through the light; a few motes of dust catch it. |
| 1.7 s | Matthew 7:13–14 (BSB) fades in below the doorway; at 2.15 s, **Enter Narrow Gate**. |
| 3.85 s, or as soon as Enter is pressed | The camera moves forward through the doorway, the light fills the screen, and the page beyond fades in. After Enter this takes 1.5 s: the camera pushes in for 1.05 s, the white light floods the screen from 0.32 s to about 1 s, and the opening fades away from 0.95 s to 1.5 s. |

**Enter Narrow Gate** works the moment it appears. If it is pressed while the door is still swinging, the script
first finishes opening the door and brightening its light from wherever they are (a few hundred milliseconds), so the
camera never moves through a half-open door. A second tap, or any number of rapid taps, does nothing more.

**Skip intro** (top right, from 0.3 s) and **Escape** fade it out at once. With Reduce Motion on (the iPhone setting
or the app's own), nothing moves: the scene and the words fade in with the door already open, and it fades out at the
same time, without the move into the light.

The verse text comes from the verified BSB file (`src/data/bsb-passages.json` via `scriptureText`), never typed by
hand.

## One gate

The opening is the app's only gate. The welcome page (`src/app/page.tsx`) used to draw the same gate again, still and
open, with the brand and the verse: when the opening walked through its doorway into the light, a second, identical
door appeared behind it. The welcome page now draws no gate. It is the place beyond the doorway: dark, with the light
settling from above (`.beyond-gate`), the brand, Matthew 7:13–14 and Start free / Sign in. `NarrowGateArt` has no
"still" form any more, and only the opening renders it.

## Where a launch goes

A launch is the full page load of `/` (the iPhone app's start address, a typed address or a bookmark).
`src/lib/supabase/middleware.ts` sends it where the person belongs before anything is drawn, with the session checked
against Supabase Auth (`getUser()`), never trusted from the cookie:

| Who | Where the launch goes |
| --- | --- |
| New on this device | the welcome page |
| Signed in on this device before, signed out now | sign-in (`/login`) |
| Signed in | Home, and from there onboarding if it isn't finished (the `(app)` layout) |

"Signed in here before" is the `ngf_member` cookie (httpOnly, one year), set the first time a signed-in request is
seen and removed when the account is deleted. It is a hint for where to go, not a credential: a signed-in page is only
ever shown once the session has been validated.

The launch response carries `ngf_gate=1` (30 seconds, readable by the page). The head script reads and removes it, so
the opening plays over the page the launch ends on (sign-in or onboarding included) exactly once; that page, reloaded
or reached again, does not play it. The app's own navigations and fetches are never launches (no HTML document is
asked for). A launch the service worker passes on still counts (Chromium sends it with mode "navigate" but
destination "empty").

## When it plays

`src/lib/opening.ts` decides, in an inline script in `<head>`, before the first paint, so neither the app nor the intro
ever flashes:

- **Plays** on every full load of the app: a fresh launch, a reload, reopening after the app was closed (in the
  iPhone/Android app, relaunching reloads the page). It is in the root layout, which stays mounted while you move
  around, so switching between Home, Train, Run, Food and Faith (or any in-app link) never replays it.
- **Does not play** on sign-in, sign-up, password, legal, onboarding and admin pages, unless a launch ended there; when reloading straight into a
  live activity (the workout logger, the GPS recorder, the body-scan camera, the barcode scanner, the smart alarm);
  whenever a workout or a GPS recording is in progress on the device, whatever the page; or in a background
  browser tab. (Inside the iPhone/Android app a page load always means the app was opened, relaunched or reloaded,
  so it plays even if the web view still reports "hidden" while the app starts up.)
- Browser tests and demo captures set `ngf.e2e.noIntro` in local storage to keep it out of the way.

The script also handles Skip, Enter and Escape and the automatic finish, so the intro works and ends even before the
page's JavaScript has loaded, or without it. The page beneath is inert while it plays; focus is in the dialog and Tab
moves between its two buttons.

**Slow or missing pictures.** The script loads and decodes the gate pictures itself (`new Image()`, `decode()`). While
they arrive, the whole sequence waits on black (`html[data-intro-art="loading"]` pauses every animation), at most
1.2 s; then it goes on regardless, so a slow phone or a poor connection never freezes on a half-drawn door. If a
picture fails to load (`data-intro-art="missing"`), a drawn gate takes its place: a lit arch with the same proportions
and a dark bronze door that opens the same way. The intro always ends, at the latest 5.6 s after it starts.

**Leaving the app.** If the app goes to the background for more than a second while the opening is on screen, it
fades away on return, so coming back never replays or resumes it. A shorter interruption (a notification banner)
leaves it running.

**No sound.** The opening has no audio of any kind.

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

They are only downloaded on loads where the gate is shown, by the head script as soon as it decides the intro will
play (the three that matter for the first frames; the haze follows as a CSS background). Re-render with `python3 scripts/opening/render_gate.py` (about ten minutes;
`--preview` for a quick half-size look).

## Tests

- `tests/unit/opening.test.ts` runs the real inline script against its situations (pages, launches, activities in
  progress, storage blocked, background tab) and checks Enter (including a half-open door and repeated taps), Skip,
  Escape, the automatic finish, the launch mark used once, slow and failed pictures, and leaving the app.
- `tests/unit/launch-routing.test.ts` checks the middleware: what counts as a launch, new / returning / signed-in
  launches, the launch mark, the remembered device, and that protected pages still require sign-in.
- `e2e/opening-gate.spec.ts` (real browser): replays on reload and on a fresh window, never on the five tabs; Enter
  moves into the light (the scene grows past 2.5× and the light covers the screen) before the app appears; Skip,
  Escape and the timer end it; the door turns 80° about its hinge; the verse is the verified text, fully on screen,
  legible and below the doorway, with the logo above the arch, on iPhone SE (both), iPhone 15, 15 Pro Max, landscape,
  iPad and desktop; reduced motion has no movement; the dialog is labelled, keeps focus and leaves nothing inert; the
  welcome page has no gate of its own, with the title centred, the verse beneath and Start free / Sign in on the
  first screen.
- The "one gate" group films each launch in the page itself and asserts that at most one gate is ever in the page and
  none is left once the opening has ended: a new person (welcome page), a returning person (sign-in), a signed-in
  person (onboarding, then Home), six rapid taps, Enter on a half-open door, failed pictures, slow pictures, and
  leaving the app mid-opening.
- `scripts/ios-verify/` (iOS Simulator, in the iOS workflow) films a fresh launch and Enter Narrow Gate and checks
  the order: the door open with its light, the light filling the screen, then the welcome page (dark, with no
  doorway of its own).
