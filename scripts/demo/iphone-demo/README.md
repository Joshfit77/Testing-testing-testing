# The clickable iPhone demo (captured screens of the real app)

A private web page that opens on an iPhone (Safari) and tap-navigates **pictures of the real app**, captured in demo
mode with sample data at iPhone size (390 CSS px, 3×: 1170 px wide, one WebP pass), joined by the real tap targets.
Exercise pages show the app's animated 2D demonstration (the canvas figure) as it appears on the page, captured in
the picture; it does not move in the demo.

It is not the live app: typing, timers, animations, GPS, the camera and purchases are pictures. The workout flow
(start, demonstration, log sets, rest timer, substitute, finish, summary) and the AI coach's reply are captured step
by step. The page says so on its menu. The real app on a phone is the private preview deployment in `docs/DEMO.md`.

## Build it

```bash
npm run demo                       # the demo-mode app on :3000 (Docker, sample data), or scripts/demo/run-demo.sh
BASE=http://localhost:3000 node scripts/demo/iphone-demo/crawl.mjs cap 520        # ~30 min: pictures + tap targets
CONTINUE=1 node scripts/demo/iphone-demo/crawl.mjs cap 520                        # optional: more screens; re-does the flows
python3 -I scripts/demo/iphone-demo/build.py cap out 88                           # out/app.html + out/s
node scripts/demo/iphone-demo/verify.mjs out out-shots                            # taps through it at iPhone size
```

`out/app.html` is the page (published as a claude.ai artifact with `out/s/*` as its files; a publish takes at most
64 MB and 255 files, a version at most 256 MB and 511 files, so a large set goes up in parts).

- `crawl.mjs`: Playwright, iPhone 15 viewport, `deviceScaleFactor: 3`, lossless PNG, reduced motion; the fixed tab bar
  is hidden during each page's capture and shot once per tab; every link, button, tab, menu item and summary is
  recorded with its box; the pages a link leads to are queued breadth-first (caps per section keep it to a few hundred
  screens); on exercise pages it waits briefly for the 2D demonstration's canvas; the workout and coach flows are
  driven and captured as `state:` screens; dialog screens keep only the dialog's own targets and close on a tap
  elsewhere.
- `build.py`: PNG → WebP (q88; pictures taller than WebP's limit are split and stacked), tap targets clipped to the
  phone's width, the viewer assembled from `viewer.html` with the screens' data; writes `files.json` (the files to
  publish) and `wide.json` (pages wider than the phone).
- `viewer.html`: the phone page. Back, ◎ (outline the tap targets), ☰ (every captured screen, grouped, and what the
  demo is). A tap on something not captured says so. On a desktop it shows an iPhone-size frame.
- `verify.mjs`: serves the build as the artifact wrapper does and taps through the opening, sample-data sign-in,
  tabs, back, the workout flow, the menu and the coach, and checks every screen's picture exists.
