# The clickable iPhone demo (captured screens + the live 3D figure)

A private web page that opens on an iPhone (Safari) and tap-navigates **pictures of the real app**, captured in demo
mode with sample data at iPhone size (390 CSS px, 3×: 1170 px wide, one WebP pass), joined by the real tap targets.
The **3D anatomical figure is live** on it: the same showcase player as `scripts/anatomy/preview/showcase.ts`,
started when the figure is first opened, so the five 3D exercises turn, zoom and play on the phone itself.

It is not the live app: typing, timers, GPS, the camera and purchases are pictures. The workout flow (start,
demonstration, log sets, rest timer, substitute, finish, summary) and the AI coach's reply are captured step by step.
The page says so on its menu. The real app on a phone is the private preview deployment in `docs/DEMO.md`.

## Build it

```bash
npm run demo                       # the demo-mode app on :3000 (Docker, sample data), or scripts/demo/run-demo.sh
BASE=http://localhost:3000 node scripts/demo/iphone-demo/crawl.mjs cap 520        # ~30 min: pictures + tap targets
CONTINUE=1 node scripts/demo/iphone-demo/crawl.mjs cap 520                        # optional: more screens; re-does the flows
STATUS_JSON=<library-status --json> OUT=showcase bash scripts/anatomy/preview/build-showcase.sh   # the 3D player
python3 -I scripts/demo/iphone-demo/build.py cap showcase out 88                  # out/app.html + out/s + out/anatomy
node scripts/demo/iphone-demo/verify.mjs out out-shots                            # taps through it at iPhone size
```

`out/app.html` is the page (published as a claude.ai artifact with `out/s/*` and `out/anatomy/*` as its files; a
publish takes at most 64 MB and 255 files, a version at most 256 MB and 511 files, so a large set goes up in parts).

- `crawl.mjs`: Playwright, iPhone 15 viewport, `deviceScaleFactor: 3`, lossless PNG; the fixed tab bar is hidden
  during each page's capture and shot once per tab; every link, button, tab, menu item and summary is recorded with
  its box; the pages a link leads to are queued breadth-first (caps per section keep it to a few hundred screens);
  the workout and coach flows are driven and captured as `state:` screens; dialog screens keep only the dialog's own
  targets and close on a tap elsewhere.
- `build.py`: PNG → WebP (q88; pictures taller than WebP's limit are split and stacked), tap targets clipped to the
  phone's width, the viewer assembled from `viewer.html` with the screens' data and the showcase bundle
  (`window.SHOWCASE_LAZY`), the model's files copied as text parts.
- `viewer.html`: the phone page. Back, ◎ (outline the tap targets), ☰ (every captured screen, grouped, and what the
  demo is). A tap on something not captured says so. On a desktop it shows an iPhone-size frame.
- `verify.mjs`: serves the build as the artifact wrapper does and taps through the opening, sample-data sign-in,
  tabs, back, the workout flow, the menu, the coach, and the live 3D figure (loads, switches exercise, returns).
