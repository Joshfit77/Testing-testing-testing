# GPS accuracy: investigation, corrections and limits

_2026-10-23. Covers live run/walk recording (`src/lib/domain/gps-track.ts`, `src/components/run/gps-recorder.tsx`,
`src/components/run/route-map.tsx`). The numbers below come from **simulated** traces with known ground truth. They
are not from a phone outdoors; that testing is listed at the end and still has to be done._

## What was wrong

The recorder added up the straight-line distance between consecutive accepted fixes. That is the textbook way GPS
distance reads long:

1. **Zig-zag inflation.** Every fix carries a little noise. Summing fix-to-fix steps adds the sideways wobble to the
   length, and the slower you move, the bigger the share. Walking in a city read **30–50 % long** on the test traces;
   an open-sky run read about 3 % long.
2. **Standing still added distance.** The jitter rule only ignored moves smaller than about half the reported accuracy.
   GPS drifts slowly while you stand still, so every few seconds the drift crossed that threshold and was counted:
   about **150 m in 10 minutes** at a crossing or a traffic light.
3. **Multipath spikes were counted when they weren't fast enough to look impossible.** Tall buildings reflect the
   signal, and the phone still reports a fair accuracy for a fix 40–120 m off. A run among buildings read about 15 %
   long.
4. **A poor first fix** (cold start, biased by 10–30 m) anchored the track, and the walk read about 28 % long.
5. **"Precise Location" off** (iPhone) or approximate location (Android) produces fixes with ±1–3 km accuracy. They
   were all correctly ignored, but the screen just said "Waiting for GPS" forever with no reason given.
6. **Nothing showed what the GPS was doing**, so a wrong distance couldn't be explained.

## What changed

- **Smoothing (Kalman filter).** A constant-velocity filter per axis, in metres from the start of each line. Each fix
  is weighted by its own reported accuracy (variance ≈ (accuracy / 1.5)², at least (2 m)²). Process noise allows a
  runner to change speed and direction quickly (1.5 m²/s³) and a walker more gently (0.15 m²/s³).
- **Distance along the smoothed track, in chords of at least 6 m.** The leftover wobble of a smoothed position still
  adds length if it is summed every second. Measuring over a few metres removes most of it, and corner-cutting is
  negligible at 6 m.
- **Standing still adds nothing.** Below 0.55 m/s smoothed speed (a slow walk is about 0.8–0.9 m/s), the filter keeps
  following the fixes so the signal stays alive, but no distance is counted.
- **Outliers.** A fix is ignored when it is too far from where the track predicts you are, given both uncertainties
  (normalised innovation > 16, about 99.97 %). It is also ignored when the move implies an impossible speed for a run
  (10 m/s) or a walk (4 m/s), after allowing for the fix's accuracy, or when the smoothed speed would exceed that cap
  (a bike or a car).
- **Recovery from a bad anchor.** Three consecutive ignored fixes that agree with each other at a possible speed mean
  the track was wrong, not them. The filter restarts on them as a new line, and the jump is not counted.
- **Stale fixes** (timestamped before the recording started, i.e. a cached position) are ignored. Out-of-order and
  duplicate fixes were already ignored.
- **Unchanged rules** from `docs/RUN_TRACKING_PLAN.md`:
  - nothing is counted before the first fix within 20 m;
  - nothing is counted across a pause, or across a stretch with no signal for 15 s or more;
  - the clock keeps running through a signal gap.

  The straight-line distance across each signal gap is now **reported** in GPS details, on the review screen and on
  the saved activity ("about 650 ft in a straight line"). It is not counted.
- **Diagnostics ("GPS details").** Shown on the recording and review screens:
  - the source (browser or native);
  - time since the last reading;
  - accuracy now, plus the best and worst seen;
  - the average and longest update interval;
  - readings used, including how many came while standing still;
  - readings ignored, by reason;
  - signal gaps, with the uncounted straight-line distance;
  - smoothed speed;
  - filter restarts.

  It shows **no positions**, and nothing is logged or sent anywhere. Plain-language hints appear for:
  - approximate location, with how to turn on Precise Location on iPhone and Android;
  - a weak signal;
  - slow updates (more than 5 s apart: a throttled or power-saving browser);
  - many off-route readings.
- **Route map.**
  - Start and finish markers.
  - A numbered marker at each kilometre or mile, which never bridges a break.
  - Breaks (pauses or gaps) shown as faint dashed joins labelled "not counted".
  - While recording, your current smoothed position with its uncertainty ring.
  - A scale bar in miles and feet for imperial members.
  - A band kept clear at the bottom for the scale bar.

  The map is still drawn from the route's own points, so nothing is sent to a map service.
- **Saved quality.** "Imprecise or impossible readings ignored" no longer includes standing-still or paused fixes. The
  uncounted gap distance is saved with the activity.

## Measured on controlled traces

`tests/fixtures/gps-traces.ts` simulates each scenario along a known path at a known speed. It delivers about one fix
a second with timing jitter and adds the error a phone's GPS has:

- a slowly wandering correlated error: Gauss–Markov, low-pass filtered so it drifts smoothly (open sky σ ≈ 3 m,
  τ ≈ 60 s; urban σ ≈ 6 m, τ ≈ 30 s);
- about a metre of fix-to-fix jitter (phones already filter their output);
- a reported accuracy only loosely tied to the true error.

Events: multipath spikes that still report fair accuracy, 30 s tunnels, pauses, standing still, out-of-order and
duplicate delivery, a biased cold start, and accuracy in the kilometres.

Error of the recorded distance against the true distance, mean (worst) over 20 seeds per scenario. "Before" is the
previous code (`git show 25d5dc3:src/lib/domain/gps-track.ts`); "after" is this version.

| Scenario | True distance | Before: mean (worst) | After: mean (worst) |
|---|---|---|---|
| Run: 5 km park loop, open sky | 5.00 km | +2.9% (+3.4%) | +0.5% (+1.1%) |
| Walk: city blocks, two stops at crossings | 2.03 km | +35.6% (+40.6%) | +4.2% (+8.6%) |
| Intervals on a 400 m track: 6 × (400 m fast, 200 m jog) | 3.61 km | +2.2% (+3.1%) | +1.1% (+1.9%) |
| Run with a 3-minute pause | 1.98 km | +2.5% (+3.4%) | −0.1% (−0.8%) |
| Run through two 30-second tunnels (no fixes) | 2.97 km | −4.4% (−4.9%) | −6.8% (−7.3%) ¹ |
| Run with multipath spikes (40–120 m off, fair reported accuracy) | 2.86 km | +15.1% (+19.4%) | +2.8% (+4.4%) |
| Slow walk (0.9 m/s), open sky | 0.81 km | +7.1% (+8.6%) | −0.7% (−3.3%) |
| Walk in a city at 1.2 m/s, no stops | 1.08 km | +37.5% (+47.3%) | +4.6% (+10.6%) |
| Standing still for 10 minutes (drift) | 0 m | 153 m (193 m) | 5 m (25 m) |
| Run with out-of-order and duplicate deliveries | 1.98 km | +2.6% (+3.3%) | +0.2% (+0.9%) |
| Walk starting with a poor, biased first fix | 1.26 km | +28.4% (+32.7%) | +3.4% (+7.5%) |
| Browser with precise location off | 0.42 km | −100% | −100% ² |

¹ By design: the ~200 m inside the tunnels is not counted. Against the distance the GPS could actually see, the error
is under 1 %. The old code's apparent −4 % was its +2.5 % inflation partly cancelling the gap. The skipped
straight-line distance is now shown to the member.
² Nothing can be measured from ±2 km fixes. The difference is that the screen now says why, and how to fix it.

**Trade-offs, stated plainly.**

- A very slow walk can read a few percent short (worst −3.3 % above), because moments below 0.55 m/s are treated as
  standing still.
- Urban walking still reads about 4–5 % long on average. The slowly wandering part of urban GPS error can't be told
  apart from movement without other sensors.
- The parameters were tuned on these simulated traces, so they need confirming against real recordings.

`tests/unit/gps-accuracy.test.ts` asserts these bounds on six seeds for every scenario. It also checks that the saved
route length agrees with the counted distance, and that the diagnostics never contain a position.
`tests/unit/gps-track.test.ts` keeps the original rule tests.

To reproduce the "after" column, run `npx tsx scripts/gps-accuracy-report.ts`. For "before", run the same script with
the previous `gps-track.ts` checked out.

## What the browser can and can't do

A desktop or laptop browser usually has no GPS at all: it answers `getCurrentPosition` from Wi-Fi access points or the
IP address, with an accuracy of tens to thousands of metres that never improves while you walk. That is what the first
demo recordings were made with, and it explains "inaccurate GPS" there better than any filtering bug. The app treats
such fixes like any other poor fix (they fail the accuracy gate and show the approximate-location help), so a desktop
recording shows a waiting state rather than an invented route; real accuracy figures need a phone outdoors.

| | Browser / installed web app | Native app (Capacitor + background-geolocation) |
|---|---|---|
| Fixes while the screen is on and the page is open | Yes (`watchPosition`, high accuracy) | Yes |
| Screen locked or app in the background | **No.** Browsers stop or heavily throttle location; the recorder shows a gap and counts nothing for it | Designed to (iOS background location; Android foreground service). **Not yet verified on a device** |
| Keep the screen awake | Wake Lock where supported (Chrome, Safari 16.4+) | Not needed |
| Update rate | About 1 s in the foreground; can slow on battery saver (now flagged as "slow updates") | About 1 s |
| Approximate-location detection | Yes (now explained, with the fix) | Same |
| Accuracy | The phone's own fused location, the same chip | The same chip; no extra filtering beyond ours |
| Tested here | Playwright with Chromium's location override (scripted routes, approximate accuracy, permission denied, signal loss) | Not runnable in this environment |

**Needs a real phone** (nothing above can prove these):

- background and locked-screen recording on iPhone and Android;
- the Android foreground-service notification;
- battery use over an hour;
- real multipath in a city;
- the real stationary drift of specific phones;
- update rates under power saving;
- whether a phone's reported accuracy matches its actual error.

## Outdoor test plan (needs a person with a phone)

Do each with the native build and with the browser, on at least one iPhone and one Android phone. Export the result
from GPS details (counts only) and the distance shown.

1. **Measured track:** 4 laps of a 400 m track in lane 1 (1,600 m). Pass: within ±2 %.
2. **Measured road route** (a certified 5 km course, or a route measured on a map): pass within ±3 %.
3. **City walk** among tall buildings, about 1.5 km with two crossings and a 2-minute stop: within ±8 %, and the stop
   adds under 20 m.
4. **Standing still for 10 minutes** outdoors: under 25 m.
5. **Underpass or tunnel:** a gap appears, nothing is counted inside it, and the straight-line estimate is shown.
6. **Lock the screen for 5 minutes** while walking. Native should keep the route; the browser should show a gap and
   say why.
7. **Kill the app mid-run and reopen it:** "Continue recording" is offered, and the time away is a gap.
8. **iPhone with Precise Location off:** the hint appears and no distance is counted.

Until these pass, GPS distance should be described as "measured from your phone's GPS", without accuracy claims in
marketing.
