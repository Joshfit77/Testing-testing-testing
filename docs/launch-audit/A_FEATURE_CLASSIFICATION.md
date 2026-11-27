# A. Feature classification: GREEN / YELLOW / RED / NOT PRESENT

Audit of `claude/testflight-prep` (commit `c541d63`, 2026-10-25) with the changes made on `claude/launch-audit`. Lines refer to that commit unless a file was changed on this branch. "Verified" means the file was read and, where tests exist, they were run (results in D). Patent references point at `B_PATENT_CLAIM_CHARTS.md`; trademark references at `C_TRADEMARKS.md`; security findings at `SECURITY_PRIVACY.md` (S-n).

**Headline:** every feature the brief lists as "must be preserved" exists, is enabled, and is untouched by this branch except for user-visible wording. Nothing was deleted, no algorithm was rewritten, no feature flag was switched. **No feature is classified RED.** Three features are YELLOW for attorney review (not for disabling), and the holds the brief anticipated (medical food verdicts, body-fat prediction, nap detection with score recalculation, physiological circadian optimization) are NOT PRESENT.

## A.1 Training and exercises

| Feature | Class | Verified current behaviour | Files | Reasoning / IP | Action | Done | Uncertainty |
|---|---|---|---|---|---|---|---|
| Exercise library (157 exercises with instructions, cues, mistakes, muscles, equipment, alternatives) | **GREEN** | Seeded catalog; published rows readable by everyone, edits admin-only (RLS) | `src/data/exercises.ts:27+`; RLS `supabase/migrations/20261016000002_rls_policies.sql:228-231` | Original content, no third-party media | Preserve | — | — |
| Exercise demonstrations and animations | **GREEN** | Code-drawn figure animations per exercise (timeline + skeleton renderer), no third-party video in the repo; optional uploaded media must carry a licence string | `src/lib/exercise-motion/*` (build, mount, render, timeline, patterns), `src/data/exercise-motions.ts`; media rules `src/lib/exercise-media.ts:1-9` (`AI_MEDIA_LICENSE`), import script `scripts/import-exercise-videos.ts` | No licensing issue found: `public/` holds no mp4/gif; only the owner's uploads would | Preserve; keep the licence/attribution fields filled for any uploaded media | — | Any externally linked media added later needs its own licence check |
| Workout programs (19 library programs incl. strongman, combat, bodybuilding, athletic; custom builder; AI plan mode) | **GREEN** | Programs seeded from `src/data/programs.ts`; plan-tier gating enforced in RLS | `src/data/programs.ts`, `src/lib/domain/program-catalog.ts`, `custom-programs.ts`; RLS `rls_policies.sql:248-275`, `20261023000024_plan_enforcement.sql:65-67` | Original | Preserve | — | — |
| Workout logging: sets, reps, weights, timers, rest, PRs, drafts that survive reloads | **GREEN** | Verified by e2e `training-stage2`, `train-pause`, `journeys` | `src/lib/domain/workout-draft.ts`, `src/components/train/*` | — | Preserve | — | — |
| Adaptive training review (plateau, deload, volume, frequency, low-readiness, short-sleep recommendations) | **YELLOW (review only)** | Rule-based on the member's own logs; every recommendation lists its evidence and **changes nothing until accepted** | `src/lib/domain/adaptive-training.ts:1-10`, `:346-400`, `:504`; `src/server/services/adaptive-training.ts` | Patent: Fitbod US 12,551,760 (ML-model plateau detection) and 12,109,454 — see B Part 2. No ML model here | Keep as is; attorney reads Fitbod claim 1 | — | Claim text not retrieved |
| Achievements, ranks, badges, celebrations (confetti, progress rings) | **GREEN** | 25 achievements, 3 ranks; reduced-motion respected | `src/lib/domain/achievements.ts`, `ranks.ts`, `src/components/common/celebration.tsx`; `src/app/globals.css` (`prefers-reduced-motion`) | Original artwork | Preserve | — | — |

## A.2 Nutrition

| Feature | Class | Verified current behaviour | Files | Reasoning / IP | Action | Done | Uncertainty |
|---|---|---|---|---|---|---|---|
| Barcode scanning and product facts (Open Food Facts), name search | **GREEN** | Server-side lookups, cached a day; product page links the source record (ODbL attribution) | `src/server/services/food-quality.ts`, `open-food-facts.ts`; `src/app/(app)/nutrition/product/[code]/page.tsx:212` | Patents 1/2 default GREEN (B) | Preserve | — | Counsel: ODbL attribution wording |
| Nutrient classes, ingredient evidence, allergens, NOVA, alternatives | **GREEN** | Evidence table cites regulators; "insufficient" when unknown; missing data never treated as absence | `src/lib/food-iq.ts:265-345`, `src/lib/additive-evidence.ts`, `src/lib/food-quality.ts:336-520` | No health-condition logic | Preserve | — | — |
| 0–100 nutritional-quality rating (method FIQ-0.1) | **GREEN, kept OFF** | Deterministic published formula; shown only when `FOOD_IQ_SCORE=on`, labelled experimental | `src/lib/food-iq.ts:26-28`, `:136-263`; `.env.example:86-87`; `docs/FOOD_IQ_METHOD.md` | Patent 2 elements absent (B); WW/Nestlé patents low (B Part 2) | Keep off until a dietitian reviews the method (owner's instruction) | — | — |
| **Public name "Food IQ"** | **YELLOW → done** | Every member-visible label, link, title, ARIA label and AI prompt now says "Nutrition Score" | `src/lib/food-iq.ts:16-23` (`NUTRITION_SCORE_LABEL`), nutrition pages and `src/components/nutrition/*`; test `tests/unit/public-labels.test.ts` | Trademark C.1 | Rename (done); clear a distinctive name later | **Yes** | "Nutrition Score" is a descriptive placeholder, not cleared (C.2) |
| "Fits your goals" (per-serving % of the member's own targets, diet-style and chosen-allergen conflicts) | **GREEN** | No medical profile, no verdict; separate from the rating | `src/lib/food-iq.ts:346-447` | Patent 1: medical compatibility workflow NOT PRESENT (B) | Preserve | — | — |
| "Ask AI about this food" (Pro) | **GREEN** | Model limited to the facts given, no health/allergy guarantees, repeats only reviewed evidence | `src/lib/food-quality-ai.ts:15-26`; `src/server/actions/food-quality.ts:58-80` | S-1 (consent list) and S-10 (injection guard) fixed on this branch | Preserve | **Yes** | — |
| Automated medical food-safety verdicts; disease-specific risk scoring; medication interactions | **NOT PRESENT** | Searched `src/lib/food-*`, `src/server/services/food-*`, `additive-evidence.ts` for condition/medication/interaction logic: none | — | — | Do not add without review | — | — |
| Food diary, USDA search, recipes, planner, grocery, meal photo estimates | **GREEN** | USDA public-domain data; meal photos sent to Anthropic under a separate consent and not stored | `src/server/services/usda-local.ts`, `food-photo.ts:14-46` | — | Preserve | — | — |

## A.3 GPS running and walking

| Feature | Class | Verified current behaviour | Files | Reasoning / IP | Action | Done | Uncertainty |
|---|---|---|---|---|---|---|---|
| Live GPS run/walk tracking: accuracy filter, Kalman smoothing, outlier gate, stand-still rule, signal-loss handling, splits, pace | **GREEN** | Pure, unit-tested with controlled traces (`tests/unit/gps-track*.test.ts`); no spline, no map matching, no historical-route or map refinement | `src/lib/domain/gps-track.ts:1-19`, `:202-234`, `:287-348` | Patents 3 and 4: claimed mechanisms absent (B) | Preserve; do not add spline fitting or route snapping without review | — | TomTom claim wording and fee status unverified |
| Route storage and map display | **GREEN** | Simplified route (≤ 2,000 points) stored privately; display only | `gps-track.ts:500-543`; `supabase/migrations/20261024000029_gps_running.sql` | — | Preserve | — | — |
| Deleting a run kept its route (S-4) | **YELLOW → done** | Soft delete now nulls `route`, `splits`, `gps_quality` | `src/server/actions/activities.ts` (this branch) | Privacy | Fix | **Yes** | — |
| Recording left in device storage after sign-out (S-5) | **YELLOW → done** | `clearAllDrafts` also removes `run.recording.<user>` | `src/lib/drafts.ts` (this branch); test `tests/unit/drafts.test.tsx` | Privacy on shared devices | Fix | **Yes** | — |
| Background location permission and purpose strings | **GREEN** | Only during a recording the member started | `ios/App/App/Info.plist:77-84`; `src/lib/native/location.ts` | Apple 5.1.1 | Explain in review notes | — | Device test outstanding |

## A.4 Sleep & Recovery and Apple Health

| Feature | Class | Verified current behaviour | Files | Reasoning / IP | Action | Done | Uncertainty |
|---|---|---|---|---|---|---|---|
| Apple Health / Health Connect import of steps, sleep (stages) and overnight HR/HRV/RR, summarised on the device | **GREEN** | Read-only; per-night aggregates stored; wellness consent required in RLS | `src/lib/native-sleep.ts`, `src/lib/domain/sleep-import.ts`; `20261024000034_sleep.sql:97-119`, `…41_sleep_vitals.sql` | Patent 6: import, not detection (B) | Preserve | — | Not yet run on a physical phone |
| Nightly sleep score v1 (duration, efficiency, timing, wake-ups) | **GREEN** | Transparent weights, no physiological inputs | `src/lib/domain/sleep-score.ts:47`, `:64-101` | Fitbit sleep-score family requires sleeping heart rate (B Part 2): absent | Preserve; do not add HR to the score without review | — | — |
| Sleep windows, consistency guidance, habits, energy sketch | **GREEN** | From the member's own median times and goal; no circadian measurement | `src/lib/domain/sleep-schedule.ts:1-6`, `:71-112`; `sleep-energy.ts:1-7` | Patent 5: score-vs-bedtime window analysis absent (B) | Preserve | — | '078 claims unverified |
| Readiness (4-question check-in) and adaptive links to training | **GREEN** | Self-reported only; associations worded as patterns | `src/lib/domain/readiness.ts:9-14`; `sleep-training.ts:1-5` | Oura 10,842,429 (biosignal readiness) absent (B Part 2) | Preserve; do not derive readiness from HRV without review | — | — |
| Naps | **GREEN** | Logged or imported sessions; never change the nightly score; no cut-off/confirmation workflow | `src/lib/domain/sleep.ts:17-26`, `:343-387` | Patent 6 combination NOT PRESENT | Preserve | — | — |
| AI sleep coaching (`get_sleep_summary` tool) | **YELLOW → done** | Sends a summary incl. device readings to Anthropic after AI consent; consent card and privacy draft did not say so (S-1) | `src/server/coach/tools.ts:516-518`, `sleep-summary.ts`; consent `src/components/coach/ai-consent-card.tsx` (this branch) | Apple 5.1.3 disclosure | Disclose (done); counsel confirms wording | **Yes** | — |
| Native sleep detection / smart alarm from sensors | **NOT PRESENT** | The alarm is a plain local notification; "smart window" is stored but every alarm sounds at the deadline and the page says so | `src/lib/domain/sleep-alarm.ts:1-8` | — | — | — | — |

## A.5 Body Scan and progress photos

| Feature | Class | Verified current behaviour | Files | Reasoning / IP | Action | Done | Uncertainty |
|---|---|---|---|---|---|---|---|
| Progress photos (private bucket, signed URLs 10 min, EXIF stripped on device, per-photo delete, purged at account deletion) | **GREEN** | Verified by RLS table and `tests/unit/account-coverage.test.ts` | `supabase/migrations/20261017000002_progress_photos.sql:16-47`; `src/server/services/progress-photos.ts:6`; `src/lib/image-compress.ts:26-29` | — | Preserve | — | — |
| Body Scan (Pro): guided front/side/back photos with outline, timer, tilt check, faint overlay of the last scan; tape measurements typed in; comparisons | **YELLOW (review only)** | **No body-fat or composition estimate; no 3D model; no AI on photos** | `src/lib/domain/body-scan.ts:19-97`; `src/components/body-scan/scan-capture.tsx:144`, `:211+`; `consent-card.tsx:15` | Patent: guided multi-angle capture claims (US 11,232,629 / 11,580,693) — see B Part 2 | Keep; attorney reads claim 1 of both | — | Claim text not retrieved |
| Automatic body-fat prediction | **NOT PRESENT** | Explicitly refused in the consent card | `src/components/body-scan/consent-card.tsx:15` | Would also touch US 11,759,151 | Do not add without validation and review | — | — |

## A.6 AI Coach

| Feature | Class | Verified current behaviour | Files | Reasoning / IP | Action | Done | Uncertainty |
|---|---|---|---|---|---|---|---|
| Chat and plan mode (Claude via Anthropic API), knowledge base, read-only tools, proposal cards needing Confirm, monthly allowance, consent gate | **GREEN** | Red-flag/injury rules and referral; plan output validated against the catalog; proposals re-validated server-side; one proposal per reply; model refusals handled | `src/server/services/ai-coach.ts`; `src/lib/coach/knowledge.ts:30`, `:193`; `src/lib/validation/ai.ts:78+`; `src/server/actions/coach.ts` | WHOOP/Oura score patents (B Part 2) need HR-derived scores: absent | Preserve | — | Prompt-injection mitigation is instruction-level plus read-only tools (S-O1) |
| Faith handling in the coach | **GREEN** | Religious content only when the member turned faith on; one verse max, from the verified BSB list; never in safety/medical replies | `src/lib/coach/knowledge.ts:227-241`, `src/lib/coach/prompt.ts:25-27` | Brief Part 11 §3 | Preserve | — | — |
| Coaching memory (opt-in), shared journal entries only | **GREEN** | Journal text can never become a memory; health details refused as memories | `src/lib/coach/memory.ts:97-123`; `src/server/coach/snapshot.ts:181-188` | — | Preserve | — | — |

## A.7 Faith & Discipline

| Feature | Class | Verified current behaviour | Files | Reasoning / IP | Action | Done | Uncertainty |
|---|---|---|---|---|---|---|---|
| Faith section: verse cards (19 passages), devotionals, 40-day challenge (41 entries incl. day 0), practices, reminders, streaks | **GREEN** | Optional: opt-in flag; training works without it (README) | `src/app/(app)/faith/*`, `src/data/content.ts`, `devotionals.ts`, `src/lib/domain/challenge.ts`, `practices.ts` | Trademark C.4 (challenge name) | Preserve | — | — |
| Scripture accuracy and licence | **GREEN** | BSB only (public domain); every quote checked against the official text by a unit test; attribution shown | `src/data/scripture.ts`, `bsb-passages.json`; `tests/unit/scripture.test.ts`; `docs/SCRIPTURE.md` | C.5 | Preserve | — | — |
| Private faith journal | **GREEN** | Owner-only RLS, no admin clause, no service-role reader; shared with the coach only per entry on request | `20261016000001_core_schema.sql:502-515`; `rls_policies.sql:130-145`; `src/server/actions/faith.ts:105-111` | S-I | Preserve | — | — |

## A.8 Accounts, billing, platform

| Feature | Class | Verified current behaviour | Files | Reasoning / IP | Action | Done | Uncertainty |
|---|---|---|---|---|---|---|---|
| Supabase auth, RLS on all 72 tables, owner-only policies, pinned `search_path` | **GREEN** | Enforced by `tests/unit/rls-coverage.test.ts`; `plan_of()` leak (S-6) fixed by migration | `supabase/migrations/*`; `20261025000042_plan_of_private.sql` (this branch) | — | Fix (done) | **Yes** | — |
| Account deletion and export | **GREEN** | Full deletion chain; export of every owned table; export now rate-limited (S-7) | `src/server/services/account-deletion.ts`; `src/app/api/account/export/route.ts` (this branch) | Apple 5.1.1(v) | Fix (done) | **Yes** | — |
| Stripe web billing (test keys; live keys ignored unless `STRIPE_LIVE_APPROVED=true`) | **GREEN** | Guard tested | `src/server/env.ts:12-15`; `tests/unit/stripe-live-guard.test.ts` | — | Keep test mode | — | — |
| RevenueCat in-app purchases (sandbox flags off by default) | **YELLOW** | Code and tests complete; never run against App Store Connect | `src/lib/billing/*`, `src/server/services/store-billing.ts`; `docs/MOBILE_BILLING.md` | Apple 3.1.1/3.1.2 (APPLE_COMPLIANCE #7) | Owner creates products and sandbox-tests on a device | — | Device/sandbox verification outstanding |
| Legal pages | **RED for submission (not a feature hold)** | Drafts with counsel placeholders; facts corrected on this branch | `src/app/legal/*`; `docs/LEGAL_REQUIREMENTS.md` | Apple 5.1.1(i) | Counsel finalises | partly | — |
| Black-and-gold design, opening, navigation, celebrations | **GREEN** | Untouched; opening verified in the iOS Simulator by CI | `src/app/globals.css`, `src/lib/opening.ts`, `.github/workflows/ios.yml` | — | Preserve | — | Physical-device check outstanding |
| Analytics / tracking SDKs | **NOT PRESENT** | None in `src`, `package.json` or native projects | — | Privacy label "no tracking" is accurate | Keep it that way | — | — |

## A.9 Preservation checklist (Part 11 §6)

| Item | Verified how |
|---|---|
| Exercise library preserved | `src/data/exercises.ts` untouched on this branch (`git diff claude/testflight-prep..claude/launch-audit --stat`) |
| Workout programs preserved | `src/data/programs.ts`, `program-catalog.ts` untouched |
| Exercise animations preserved | `src/lib/exercise-motion/*`, `src/data/exercise-motions.ts` untouched; `exercise-demo.spec.ts` passes |
| Black-and-gold design preserved | `globals.css`, components untouched except wording |
| Celebrations preserved | `celebration.tsx` untouched |
| Faith & Discipline, verses, journal, 40-day challenge preserved | `src/app/(app)/faith/*`, `src/data/*` untouched; `faith-calendar.spec.ts`, `challenge.spec.ts` pass; journal RLS unchanged |
| Faith optional | opt-in flag and coach rules unchanged |
| User progress and history preserved | no destructive migration; the only migration is a `revoke execute` |
| Narrow Gate Fitness branding preserved | `capacitor.config.ts`, `Info.plist`, layout unchanged |
