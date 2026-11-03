# Progress charts: lazy-loaded plots

Launch-critical item 5 (2026-11-03). Audit 4 (`docs/audit/4-gps-health-ios-performance.md`, R4) put `/progress/overview`
at about 412 KB of gzipped JavaScript, mostly the chart library (recharts), and recommended `next/dynamic`.

## What changed

`src/components/charts/charts.tsx` was one client module that imported recharts. It is now three:

- `chart-format.ts`: palette, axis style, value and date formatting.
- `charts.tsx`: the frame every chart shares, loaded with the page. It holds the title, description, legend, the
  **table view**, the empty state, and a placeholder of the plot's exact size. The plots load with
  `next/dynamic(..., { ssr: false })`. If their chunk fails to load (offline, a deploy in between), an error boundary
  says so and offers the numbers as a table.
- `chart-plots.tsx`: the recharts drawing (`BarPlot`, `LinePlot`), unchanged in what it draws. It is fetched after
  the page's own JavaScript.

The six screens that use charts are unchanged: `/progress/overview`, `/nutrition`, `/run`, exercise history, the muscle
map and the body-scan dashboard.

## Measured

### Bundle (production builds of `bef841c` and of this change)

Next.js's own figure, "First Load JS" from `next build`:

| Route | Before | After |
| --- | --- | --- |
| `/progress/overview` | 423 kB | **309 kB** |
| `/nutrition` | 380 kB | 265 kB |
| `/run` | 335 kB | 221 kB |
| shared by all | 107 kB | 107 kB |

The same routes measured with gzip -9 over every JS file the route loads on first visit
(`scripts/perf/route-first-load-js.mjs`; `docs/performance/measurements/route-first-load-js.json`):

| Route | Before | After | Change |
| --- | --- | --- | --- |
| `/progress/overview` | 448.4 KB | 336.6 KB | −111.8 KB (−25 %) |
| `/nutrition` | 406.0 KB | 294.1 KB | −111.9 KB |
| `/run` | 380.4 KB | 268.7 KB | −111.7 KB |
| `/progress`, `/home` (no charts) | 266.5 / 199.8 KB | 266.5 / 199.8 KB | 0 |

- New on-demand chunk: recharts plus the plots, 389.8 KB raw / **112.4 KB gzip**. It is downloaded only on a screen
  that draws a chart, and is no longer in any route's first load.
- The total JavaScript a chart screen eventually downloads is unchanged (455 vs 454 KB transferred). What moved is
  *when*: after the page is interactive instead of before.

### Loading and interaction (`/progress/overview`)

`scripts/perf/progress-overview-load.mjs` was run against both builds at once (old on :3001, new on :3000). The
account was the same Pro member with 3 weeks of bodyweight, steps and squat sessions, and runs alternated old/new. The
viewport was a Pixel 7 with **4× CPU throttling** and cache disabled. Medians of 5 runs
(`docs/performance/measurements/progress-overview-load.json`):

| Metric | Before | After |
| --- | --- | --- |
| JS downloaded before the `load` event | 454 KB | **341 KB** |
| DOMContentLoaded | 1,304 ms | 1,050 ms |
| `load` | 1,313 ms | 1,087 ms |
| Interactive (first chart's table button hydrated) | 1,516 ms | **1,364 ms** |
| Long-task time (main thread blocked beyond 50 ms) | 1,875 ms | **1,595 ms** |
| First chart drawn | 2,922 ms | 2,863 ms |

- The page becomes usable sooner, and the charts appear at about the same moment as before (not later).
- Individual runs vary a lot on this machine. One "before" run had DOMContentLoaded at 457 ms and one "after" run had
  it at 1,464 ms, so read these as medians.
- **Interaction**: toggling a chart to its table view and back on an idle page, 12 toggles per build. The ranges
  overlap: 31–277 ms before, 22–186 ms after, with medians of 108 vs 135 ms. **No measurable difference** either way.

### Same charts, same data

After the page settled, both builds were compared chart by chart
(`docs/performance/measurements/progress-overview-charts-equivalence.json`). Every one of the 9 chart frames was
**identical**:
- whether it was drawn: 5 drawn, 4 empty states;
- bar counts, line paths, dot counts and axis tick labels.

Each chart's table view still lists every data point (21 bodyweight rows), so the screen-reader path is unchanged.
The placeholder is `aria-hidden`, and the figure keeps its caption, heading and table toggle while the plot loads.

## Tests

- e2e: `/progress/overview`, `/nutrition` and `/run` are covered by the existing suites (run on this build; see the
  final report).
- Chart output equivalence was checked as above.
