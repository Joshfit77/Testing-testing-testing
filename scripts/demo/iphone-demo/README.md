# The clickable iPhone demo (captured screens of the real app)

A private web page that opens on any phone (iPhone or Android) and tap-navigates **pictures of the real app**,
captured in demo mode with sample data at iPhone 15 Pro size (393 × 852 CSS px, 3×: 1179 px wide, one WebP pass;
`PHONE_W`/`PHONE_H` change it), joined by the real tap targets. On a phone the pictures and the tab bar fill the
screen's width, from 320 to 500 points (tap targets and live demonstrations are placed in percentages, so they scale
with them); on a desktop it shows an iPhone-size frame. The real app lays itself out for each phone instead: that is
checked separately, model by model (`e2e/device-matrix.spec.ts`).
Three parts are live rather than pictures:

- **The opening**: the app's own scene and CSS play first, over the welcome screen (Enter Narrow Gate or Skip intro).
- **Every exercise demonstration**: the app's own 2D engine (`src/lib/exercise-motion`) runs in the page with the
  options the app's player uses (`src/components/train/exercise-demo.tsx`): play/pause, 1×/0.5×, scrub, the
  "Animated demo" badge. It is placed exactly where the captured page shows it, and in the workout's demonstration
  dialog.
- Nothing else: typing, timers, GPS, the camera, Apple Health and purchases are pictures. The workout flow (start,
  demonstration, log sets, rest timer, substitute, finish, summary), the AI coach's reply and a brand-new member's path
  (five questions, Ready, the plan, the first workout, that member's own app) are captured step by step. The page says
  so on its menu. The real app on a phone is the private preview deployment in `docs/DEMO.md`.

## Build it

```bash
npm run demo                       # the demo-mode app on :3000 (Docker, sample data), or scripts/demo/run-demo.sh
export CHROMIUM=/path/to/chrome    # optional: a Chromium for Playwright (else Playwright's own)
BASE=http://localhost:3000 node scripts/demo/iphone-demo/crawl.mjs cap 520        # ~30 min: pictures + tap targets
npm run demo:reset && FLOWS=1 node scripts/demo/iphone-demo/crawl.mjs cap 600     # optional: re-do only the flows
BASE=http://localhost:3000 node scripts/demo/iphone-demo/live.mjs cap             # where each live demonstration sits
BASE=http://localhost:3000 node scripts/demo/iphone-demo/new-member.mjs cap       # the new-member path (new local account)
BASE=http://localhost:3000 node scripts/demo/iphone-demo/extras.mjs cap           # in-page states links cannot reach (Run log → Treadmill)
npm run demo:reset                                                                # the sample account back to its start
node scripts/demo/iphone-demo/engine.mjs out                                      # out/ngf.js: the app's 2D engine
python3 -I scripts/demo/iphone-demo/build.py cap out 88                           # out/app.html, out/s, out/opening, out/fonts
#   it warns when the set needs more than 511 files; then lower MAX_SCREENS (462 on 2026-11-09, for 508 files) and run it again
node scripts/demo/iphone-demo/verify.mjs out out-shots                            # taps through it at iPhone size
PUBLISHED=1 node scripts/demo/iphone-demo/verify.mjs pub pub-shots              # the same on the page downloaded from the artifact (app.html = its index.html)
```

`out/app.html` is the page, published as a claude.ai artifact with `out/files.json`'s files (`s/*`, `opening/*`,
`fonts/*`). A publish takes at most 64 MB and 255 files and a version at most 256 MB and **511 files**, so the set
goes up in parts (pictures first, then the rest; send `null` for pictures of the previous version that are not in
the new one, or they stay and count against the 511).

- `crawl.mjs`: Playwright, iPhone 15 Pro (393 × 852 unless `PHONE_W`/`PHONE_H`), `deviceScaleFactor: 3`, lossless PNG, reduced motion; the fixed tab bar
  is hidden during each page's capture and shot once per tab; every link, button, tab, menu item and summary is
  recorded with its box (in the picture's space: the page for a full-page picture, the screen for a dialog or menu
  shown over a scrolled page); the pages a link leads to are queued breadth-first (caps per section keep it to a few
  hundred screens); the workout and coach flows are driven and captured as `state:` screens; dialog screens keep only
  the dialog's own targets and close on a tap elsewhere.
- `live.mjs`: signs in to the sample account, measures the demonstration's box on every captured exercise page (and
  in the workout's demonstration dialog, named after the exercise the captured workout shows) and records it as a
  `live` target, replacing the player's own buttons inside it; it reports any page whose height no longer matches its
  picture.
- `new-member.mjs`: "Start as a new member" on the welcome screen (a fresh demo account in the local database): each
  of the five questions as asked and as answered, Ready, the first optional question, the plan, the first workout
  screen and the member's own tabs, wired like the app (answers fill the step in, Continue goes on, Back goes back).
- `extras.mjs`: signs in to the sample account and captures states inside a page that only a button reaches (the Run
  log with Treadmill chosen), wired to the buttons that switch between them.
- `engine.mjs`: bundles `src/lib/exercise-motion` and `src/data/exercises` (esbuild, IIFE, global `NGF`).
- `build.py`: PNG → WebP (q88; pictures taller than WebP's limit are split and stacked), tap targets clipped to the
  phone's width, long date series and the Bible's book pages cut to a few each so the set fits 511 files (a tap on a
  dropped screen says it was not captured, or lands on the section's main screen), the viewer assembled from
  `viewer.html` with the screens' data and the engine, the opening's pictures (`public/opening`) and the app's fonts
  (`src/app/fonts`) copied beside it; writes `files.json` (the files to publish) and `wide.json` (pages wider than
  the phone).
- `viewer.html`: the phone page. Back, ◎ (outline the tap targets), ☰ (every captured screen, grouped, and what the
  demo is). A tap on something not captured says so. On a desktop it shows an iPhone-size frame.
- `verify.mjs`: serves the build as the artifact wrapper does and taps through the live opening, sample-data sign-in,
  tabs, back, the workout flow, the menu and the coach; checks that the live demonstrations draw, move and carry the
  app's badge and label (and that every captured exercise page has one); walks the new-member path; and checks every
  screen's picture exists and every target lies inside its screen. Then, on every iPhone and Android viewport in
  Playwright's device list, that the demo fills the phone's width, nothing scrolls sideways, and the opening, the
  sample-data sign-in and a tab work.
