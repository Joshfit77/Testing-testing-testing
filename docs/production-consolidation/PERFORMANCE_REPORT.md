# Performance report

**Everything here was measured locally**, on one 4-core / 16 GB sandbox machine. It ran:

- the production build (`next build` + `next start`, a single Node process);
- the full local Supabase stack in Docker: Postgres, PostgREST, GoTrue and the gateway.

These are **not production capacity figures**: production runs on different hardware, over a real network, with the
database on a separate machine. The figures show relative costs and where the bottleneck sits. Run date 2026-11-26,
commit `8fa7c3b5`.

## Method

- **Script:** `SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/perf/load-test.mjs <baseUrl> <supabaseUrl>
  <members> <concurrency> <seconds>`. Keys come from the environment, never the command line. Each run uses a random
  password, and the synthetic members are deleted even if the run fails or is interrupted. It refuses a non-local
  Supabase unless `ALLOW_REMOTE_LOAD_TEST=1` (staging only, never production).
- **Setup:** the script creates N synthetic, onboarded members, signs each in, and sends their real session cookie
  (pages) or Bearer token (API).
- **Load:** C concurrent workers loop over 7 routes:
  - `/home`, `/train`, `/nutrition`, `/progress/overview`, `/faith` (full server renders with database reads);
  - `/api/v1/workouts` (Bearer API);
  - `/api/health`.
- **Measurement:** one warm-up pass, then timed runs.
- **Clean-up:** the synthetic members are deleted afterwards.
- **Reads only.** Writes (logging sets, finishing workouts, AI calls) were not load-tested. AI calls go to Anthropic and
  are bounded by the budgets, not by this server.

## Results

| Members | Concurrent | Duration | Throughput | Page p50 (range across 5 pages) | Page p95 (worst page) | API p95 | Non-200 |
|---|---|---|---|---|---|---|---|
| 20 | 5 | 30 s | 36.5 req/s | 130–228 ms | 343 ms (`/faith`) | 45 ms | 0 of 1,095 |
| 50 | 10 | 45 s | 36.3 req/s | 240–463 ms | 617 ms (`/faith`) | 78 ms | 0 of 1,635 |
| 100 | 25 | 45 s | 36.0 req/s | 425–1,392 ms | 1,800 ms (`/faith`) | 178 ms | 0 of 1,619 |
| 200 | 50 | 45 s | 37.5 req/s | 901–2,529 ms | 3,726 ms (`/faith`) | 416 ms | 1 of 1,689 (a 307 redirect on `/home`) |

**Bottleneck:** the single Next.js process. During a 25-concurrent run it used about 1.1 CPU cores, while PostgREST
used 0.35, the gateway 0.12, auth 0.12 and the Postgres backends a few percent each, with 45% of the machine idle.

- Throughput stays flat at about 36 requests a second whatever the concurrency, and latency grows with the queue.
  That is the expected pattern for one server-rendering Node process.
- The database was far from saturated.
- Rough server CPU per full page render is about 40–45 ms.

## Observations

1. **`/faith` and `/nutrition` are the heaviest pages** (most reads per render). They are the first candidates for
   caching or parallelising reads if latency matters.
2. **Under 50 concurrent workers, 11 background calls from the server to the local Supabase gateway failed at the
   network level** (`faith.journey.settle: fetch failed`). The call is non-fatal: it is logged and the page still
   rendered with 200. The likely cause is connection pressure on the local gateway, not an app defect. Production
   should watch for the same log line (docs/ERROR_MONITORING.md).
3. **One `307` on `/home` at 200 members.** A redirect, probably to sign-in, for one request in 1,689. It was not
   reproduced at lower load. Possible cause: concurrent session refresh for the same member. Logged for monitoring,
   not fixed.
4. **The app talks to Postgres through PostgREST over HTTP.** Serverless app instances therefore don't open database
   connections of their own, which removes the usual connection-pool limit when scaling out.
5. **Not measured here:**
   - finishing a workout for members with a long history (O-12: about six full-history reads in sequence);
   - the global AI-budget lock under many simultaneous AI requests (O-17).

## Capacity estimates (assumptions stated; verify with a staging load test)

**Assumptions:**

- 15% of daily active users are in the app during the peak hour.
- A session makes about 25 server requests (page loads and actions).
- Bursts reach 3× the hourly average.
- Each app instance is kept at about 50% of the measured local throughput, so about 18 req/s.

| Daily active users | Peak average req/s | Burst req/s | App instances (serverless scales automatically) | Database (Supabase) |
|---|---|---|---|---|
| 100 | 0.1 | 0.3 | 1 | Pro, smallest compute |
| 1,000 | 1.0 | 3.1 | 1 | Pro, smallest compute; add the indexes from 089 (done) |
| 5,000 | 5.2 | 15.6 | 1–2 | Pro with a small/medium compute add-on; fix O-12 and O-17 first |
| 10,000 | 10.4 | 31 | 2–3 | Medium/large compute add-on; read replica optional; production load test required |

Formula: DAU × 0.15 × 25 ÷ 3,600 = peak average req/s; × 3 for bursts.

At these sizes the cost driver is AI usage (AI_COST_ANALYSIS.md), not hosting or database compute.

## Recommendations

| Priority | Item | When |
|---|---|---|
| 1 | Repeat this test against **staging** (hosted Supabase + the real hosting provider) before launch, including writes | Before launch |
| 2 | O-12: parallelise the workout-finish reads | Before about 1,000 actives |
| 3 | O-17: row-level budget reservation instead of one global lock | Before AI is widely used |
| 4 | Cache or parallelise the reads on `/faith` and `/nutrition` | If p95 above 1 s is seen in production |
