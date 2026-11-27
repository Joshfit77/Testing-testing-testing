# Launch preview: image quality, the focused high-resolution preview, and what was found

Written 2026-10-24 on branch `claude/sharp-cray-8y0uuv`. Companion to `docs/SLEEP_AND_PRELAUNCH_REPORT.md` and
`docs/COMPLETION_TRACKER.md` (Phase G). Nothing here was deployed or merged.

## 1. Why version 11 looked blurry (measured, not guessed)

The blur was in the pictures, not in the app. The app renders the same pixels a phone would; the demo compressed and
shrank them.

| Step | Version 11 (full demo, 2,956 screens) | What it did to sharpness |
| --- | --- | --- |
| Capture | Playwright, 390 CSS px viewport at `deviceScaleFactor: 2` → **780 px wide**, saved as **JPEG q80** (overlay patches q85, scripted base screens q72) | First lossy pass; fine text already softened a little |
| Packing | Every strip packed at **0.6× (468 px wide)** into **WebP q68** sheets, to fit 2,956 screens under the hosting limits (64 MB per publish, 256 MB per version) | Second lossy pass on top of the first, and a 40% downscale |
| Tall strips | 6 strips taller than one 14-megapixel sheet were **scaled down** further to fit | Those pages blurred more |
| Viewer | Draws each screen at 390 CSS px; the picture is stretched back up by the browser | On a 2× iPhone the browser **enlarged 1.67×**; on a 3× (Pro) iPhone **2.5×** |

Measured with `measure-dpr.mjs` on the version-11 package: a 468 px column displayed over 780 device px (2×) and
1170 device px (3×). Nothing in the app's own CSS or rendering was at fault; the app's text, icons, charts and badges
are vector or 2×/3× assets and render crisply on the device.

## 2. What the new preview does differently

| Setting | New focused preview |
| --- | --- |
| Capture | `deviceScaleFactor: 3` → **1170 px wide**, saved **lossless PNG** (no JPEG intermediate anywhere) |
| Packing scale | **1.0** (no downscale); the packer refuses to scale and **splits** strips taller than a sheet into chunks instead |
| Sheet format | **WebP q90** (one lossy pass only). Tab-bar images stay PNG. |
| Displayed | 1:1 on 3× iPhones (12 mini … 17 Pro Max), downsampled 1.5× on 2× iPhones (SE, 11, XR), downsampled on desktops. **Nothing is ever enlarged beyond the source.** |
| Sharpening / upscaling | none |
| Screens | A focused subset (Home, Train, Exercise demonstrations, AI Coach, Progress, Run, Food IQ, Sleep & Recovery, Faith, Billing); the full 2,956-screen version 11 stays published separately for navigation testing |

Bytes per pixel measured on two real 3× captures (a plan page with dense text, and the run recorder):

| Encoding | Dense page | Sparse page | Verdict |
| --- | --- | --- | --- |
| PNG | 0.145 B/px | 0.064 B/px | lossless; 2.8× the size of WebP q90 |
| WebP lossless | 0.082 B/px | 0.034 B/px | lossless; +60% over q90, kept as the fallback if the budget allows |
| **WebP q90** | **0.052 B/px** | **0.030 B/px** | indistinguishable from the PNG at 1:1 on the text crop (`cmp3/side.png`) |
| WebP q85 | 0.044 B/px | 0.026 B/px | still clean; slight ringing on thin gold rules |
| JPEG q90 | 0.110 B/px | 0.065 B/px | larger and softer than WebP q90 |
| Version 11 recipe (0.6×, q68, then enlarged to 3×) | — | — | visibly soft (`cmp3/v11-vs-new.png`) |

## 3. Results

### 3.1 Displayed size versus source size (measured with `compare3.mjs` on the packaged preview)

| Display | Picture column in the source | Shown at | Enlargement |
| --- | --- | --- | --- |
| iPhone, 390 CSS px wide, 3× (iPhone 12 mini … 16 Pro) | 1170 px | 1170 device px | **1.00** |
| iPhone, 430 CSS px wide, 3× (Plus / Pro Max) | 1170 px | 1170 device px (stage kept at 390 CSS px, centred) | **1.00** |
| iPhone, 390 CSS px wide, 2× (SE, 11, XR) | 1170 px | 780 device px | 0.67 (downsampled) |
| Desktop, 1440 px wide, 2× (Retina) | 1170 px | 741 device px | 0.63 (downsampled) |
| Desktop, 1440 px wide, 1× | 1170 px | 370 device px | 0.32 (downsampled) |

For comparison, version 11 showed its 468 px columns at 1.67× on a 2× iPhone and 2.50× on a 3× iPhone.

The viewer change that makes the second row true: on phones wider than 390 CSS px the stage no longer stretches to
the screen; it stays 390 CSS px and is centred, because a stretched stage would have enlarged the picture by up to
1.13×.

### 3.2 Side-by-side crops

Each image shows the packed preview as displayed (left) next to the same region of the lossless capture resampled to
the same displayed size (right): `docs/launch-preview/home-phone3.png` (3× iPhone, 1:1) and the sleep and Food IQ
crops listed in §3.3. `docs/launch-preview/v11-vs-new.png` shows the version-11 recipe (left) against the new one
(right) on the same text at 3×.

### 3.3 The focused preview

Published privately as **Narrow Gate Crisp Preview**, https://claude.ai/artifact/AMRTW6eHCCVMqptgEaCWt9 (two
uploads, version 2 holds everything). The full 2,956-screen demo stays at
https://claude.ai/artifact/NP9mW7vehDxeuzgKdQQp54 (version 11) for navigation testing.

| | Crisp preview | Full demo (version 11) |
| --- | --- | --- |
| Screens | 303 (158 pages, 145 recorded states) | 2,956 |
| Areas | Home 2 · Train and exercise demonstrations 33 · AI Coach 9 (+5 consent and memory states) · Progress 18 (badges, body map and scan with their states) · Run 9 (+ live, finish and review states) · Food IQ 21 (every one of the 14 product pages, scanner, search, a comparison, meal photo) · Sleep & Recovery 36 (hub, 14 nightly reports, history ranges, check-ins, debt, schedule, energy, training, alarm, settings, method) · Faith 6 · Billing 4 | everything |
| Source pixels | 1170 px wide, lossless PNG | 780 px wide, JPEG q80 |
| Packed | 1.0×, WebP q90, 252 sheets, 1,118 strips (58 tall ones split, none scaled) | 0.6×, WebP q68 |
| Size | 107.5 MB of pictures + 0.96 MB page | ≈ 150 MB |
| Tappable | 3,633 screen links, 123 dropdown pickers, 431 overlays (toggles, chosen options), 333 explanatory notes, 101 resets | 8,399 taps |
| Automated checks | all 303 screens' pictures load without gaps; a toggle, a dropdown, a pop-up, an in-place change and a text field each behave; no page errors (`tap-controls.mjs --all`) | 1,440 sampled screens |
| Shown at | 1:1 on 3× iPhones, downsampled elsewhere (§3.1) | enlarged 1.67–2.5× |

Links that leave the focused areas (for example Profile, the other 300 exercise pages, supplements) and taps past
the two-recorded-states-per-page cap show "isn't included in this preview" rather than a wrong screen: 1,400 such
taps on 268 targets, 736 of them the state cap. Every Food IQ product page and every Sleep & Recovery page in the
seeded fortnight is included and reachable from the app's own links.

Two scripted pages (`/coach`, `/train/review`) kept their flow pictures because the live page had moved on since the
flow was recorded; their links work, their extra controls were not added.

Capture time on this branch's production build against the local database: base passes about 35 minutes, focused
exploration about 65 minutes (four workers, then one for taps that save data, with the demo account restored between
them), packing about 4 minutes.

## 4. Remaining limitations

- A screenshot preview is still a set of pictures: typing, live GPS, the camera, Apple Health and the AI model's
  live replies are shown as recorded states, not run. Text fields explain why typing isn't possible.
- Hosting limits (64 MB per publish, 256 MB per artifact version) are why the crisp preview is a focused subset.
  At 3× and WebP q90 a screen costs roughly 0.35–0.45 MB, so about 450 screens fit one artifact; the full app at this
  quality would need about 1.2 GB. If a crisp **and** complete walk-through is wanted, the honest option is a real
  running staging build behind a login (Vercel preview deployment with password protection, or the Capacitor shell on
  a TestFlight / internal-testing build), which this environment cannot deploy without approval.
- 3× is the highest density of any current iPhone; nothing is lost on them. On a 2× phone or a desktop the browser
  downsamples, which keeps edges sharp.
- The 2,956-screen version 11 is unchanged and still soft; it remains the navigation-coverage demo.

## 5. Wearable sleep status (summary)

See `docs/WEARABLES.md`, `docs/SLEEP_METHOD.md` ("Recorded nights") and `docs/COMPLETION_TRACKER.md` Phase G.
Apple Health and Health Connect reads (sleep, stages, overnight heart rate, HRV, breathing), de-duplication, sync
UX and the dashboard are implemented and tested in unit, integration and browser tests with seeded records. **No
native read has run on a physical phone or watch yet**; until the checklist in `docs/SLEEP_DEVICE_CHECKLIST.md`
(A1–A15) is done on devices, no device integration is claimed as verified. Background sync while the app is closed
is not built (the plugin has no observer or background-delivery API).
