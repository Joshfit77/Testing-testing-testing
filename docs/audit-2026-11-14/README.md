# Application audit, repair and finalization — 2026-11-14/15

Branch `claude/pro-premium`. Nothing was merged into `main`, deployed, published, or charged. No price, AI
allowance or Free/Pro rule was changed.

This page is the summary. The detail for each area is in the four reports beside it:

- [security-billing.md](security-billing.md) — security, privacy, billing, entitlements
- [workouts-programs-progress.md](workouts-programs-progress.md) — workout tracking, program library, builder, progress
- [nutrition-gps-health.md](nutrition-gps-health.md) — nutrition, GPS and cardio, Apple Health / Health Connect, sleep
- [ai-faith-notifications.md](ai-faith-notifications.md) — AI coach, Faith, notifications
- [../design/HOME_BACKGROUNDS.md](../design/HOME_BACKGROUNDS.md) — the seven Home backgrounds

Everything below marked "passed" was executed in this environment (Linux container, local Supabase, Chromium at phone
size). Nothing was run on a physical iPhone or Android phone; those items are listed in section 5.

## What the app is

Next.js 15 (App Router) with a Supabase database, wrapped for iOS and Android with Capacitor. 111 pages, 18 route
handlers, 214 server actions, 68 migrations, 106 tables. Payments through Stripe (web) and RevenueCat (App Store,
Google Play). AI through the Anthropic API. Tests: vitest (unit and integration) and Playwright (browser).

## 1. Quality score

**Overall: 78 / 100.** This is a judgement, not a measurement. Each line says what it rests on and how sure it is.

| Area | Score | Based on | Uncertainty |
|---|---|---|---|
| Design | 80 | One black, charcoal and gold system across all tabs; seven Home backgrounds; measured text contrast. The backgrounds are illustrations, not the photographs that were asked for; wide subjects are cropped on phones | Medium: judged from browser screenshots, not on a phone screen |
| Usability | 80 | Five onboarding questions; "Start today's workout" on Home and the plan page; one-tap set completion. 11 mobility and timed programs still ask for reps (P-3) | Medium: no real users have tested it |
| Training features | 82 | Logger, drafts, PRs, streaks, 74 programs and 2,440 builder plans validated with zero failures after the fixes; two coaching-rule questions open (B-2, B-4) | Low for what the tests cover |
| Exercise animations | 70 | 218 exercises all animated in the app's 2D style; 16 inspected here at six phases each. None has been signed off by the owner or reviewed by a strength coach or physiotherapist | High: rendering correctly is not the same as being anatomically right |
| Nutrition | 78 | Diary, barcode, recipes and targets work in tests; history truncation and impossible macro targets fixed. Macro split for heavy members on low budgets needs a dietitian's rule (O1) | Medium: live food databases and the camera were not reachable |
| AI coach | 72 | Limits, metering, Free refusal and privacy rules hold in tests; billed-but-failed requests are now counted. No live model was called in this audit, so answer quality is unmeasured here | High |
| Faith features | 84 | 166 stored verses and 400+ references checked against the BSB text with 0 mismatches; red-letter data consistent; strict restart rule unchanged. Commentary still needs the planned theological review | Low for the text checks |
| Reliability | 80 | Offline drafts, retries and idempotency tested; discarded-workout resurrection and invented GPS distance fixed. Behaviour when iOS suspends the app is untested | Medium |
| Security | 85 | Row-level security on all 106 tables, cross-user tests on 87 tables and 3 buckets pass, no secrets in the tree or history, 0 production dependency advisories. Production configuration could not be inspected | Medium |
| Subscription readiness | 62 | Entitlements are enforced on the server and the billing logic is tested against stand-ins. No real App Store, Google Play, RevenueCat or Stripe transaction has ever been run | High |
| Performance | 75 | Largest paint, median of 3 loads at phone size on a local production server: Home 312 ms, Train 168, Nutrition 212, Faith 192, Progress 156, Coach 192, Exercise library 488. The exercise library sends about 500 kB of page data for 218 exercises. Home's picture used to fade in, which held its largest paint at about 700 ms; fixed | Medium: measured on a local server, not a phone on a mobile network |
| Launch readiness | 55 | Legal pages are drafts with counsel placeholders, no physical-device testing, no store purchase test, production settings unverified | Low: these are known gaps |

## 2. Problems found, by severity

No Critical problem was found. Line numbers are as at commit `9240ca2`, before the fixes.

### High

| ID | Where | Problem | Status |
|---|---|---|---|
| G1 | `src/lib/domain/gps-track.ts:291-296` | With the app in the background, the first GPS fix after a silent stretch was joined to the last one by a straight line: 5 minutes away added 750 m that was never run | Fixed |
| N1 | `src/server/services/progress.ts:87-97` | Nutrition history was read in one request capped at 1,000 rows, so the 90-day and 1-year charts lost the newest days for anyone logging about 12 foods a day | Fixed |
| H1 | `src/components/home/daily-hero.tsx` (new this audit) | First version of the Home backgrounds put the lit subject behind the greeting: 1.4:1 contrast on Sunday | Fixed before commit: 7.5:1 or better on every day |
| A1 | `src/server/coach/snapshot.ts:182-192`, `src/lib/coach/context.ts:344-351` | Prayer-journal entries the member has switched to "Share with AI Coach" (off by default) are sent to the model. This conflicts with the instruction to keep private prayer content out of the AI context if that instruction is meant literally | **Open: owner decision.** Not changed, because it is an opt-in feature that works as designed |
| L1 | `src/app/legal/privacy/page.tsx`, `src/app/legal/terms/page.tsx` | Privacy Policy and Terms are drafts with "[Counsel to complete]" placeholders and no contact details | **Open: launch blocker.** Needs an attorney; not something code can fix |

### Medium

| ID | Where | Problem | Status |
|---|---|---|---|
| F1 | `src/app/api/ai/food-photo/route.ts:26-49`, `label-photo/route.ts:26-48` | Photo uploads (5 MB, up to 40 megapixels) were decoded before the plan was checked, so any signed-in account could make the server work without limit | Fixed |
| F2 | `src/server/services/billing.ts:558-559` | Where Stripe could not be reached, deleting an account left its Stripe subscription charging | Fixed |
| AI1 | `src/server/services/ai-coach.ts:654-690` | AI requests that failed after the provider had charged for them were recorded as costing nothing, so the budget and alerts under-counted | Fixed |
| NT1 | `src/lib/notifications/planner.ts:259-276` | Reading, prayer and before-midnight reminders were dropped when a journey's time zone is behind the profile's. These protect a strict journey from restarting | Fixed |
| W-1 | `src/components/workout/workout-logger.tsx:331-383` | A discarded workout could come back as "Resume workout" when a failed backup retried after the discard | Fixed |
| N2 | `src/lib/domain/diets.ts:241-267`, `calorie-budget.ts:85-95` | Heavy members on a low budget got macros that added up to more than their calories; above about 228 kg onboarding failed to save | Fixed |
| S1 | `src/server/actions/sleep-import.ts:131-152` | A night imported before the watch had finished syncing could never be corrected | Fixed |
| P-3 | `train/workout/page.tsx:75`, `workout-draft.ts:365`, `current-set-card.tsx:586` | 11 programs prescribe time on exercises the logger counts in reps; one-tap completion fails and the member must type a number | **Open.** Touches the logger, history, editor and templates |
| B-2 | `src/lib/domain/custom-programs.ts:539`, `:1027` | Without a barbell, the builder keeps heavy low-rep schemes on the substitute ("dumbbell bench press 3×1" for a new lifter) | **Open: needs a coaching rule** |
| O1 (sec) | `supabase/config.toml:200`, `:208` | All sign-ins reach Supabase Auth from the app server's address, so Supabase's per-address limits apply to all members together | **Open: owner sets production limits** |
| O1 (nut) | `src/lib/domain/diets.ts:248-275` | "Balanced" for heavy members on a low budget is protein plus minimum fat with 0 g carbohydrate | **Open: needs a dietitian's rule** |

### Low

Fixed: late out-of-order `invoice.paid` restoring access (F3); checkout and billing portal without a rate limit (F4);
retried finish not advancing the program (W-4); substitution carrying "no weight" to a loaded lift (W-2); "1079.9 lb"
on the completion screen (W-3); "0 lb over 30 days" and a mislabelled 1RM tile (P-1); 12 programs with wrong equipment
lists (B-1); stage mix dropping the newest nights (S2); unsynced days counted as zero steps (N3); split table missing
the last partial stretch (G2); two commentary quotations that did not match the BSB (`devotionals.ts:201`,
`studies.ts:63,69`); a stale internal review note on the 5-10-5 shuttle; Home pictures served with `max-age=0`.

Open (34 Low or Info items, each with a proposed fix in its report): session cookies without the `Secure` flag; client address
taken from the first `X-Forwarded-For` entry; what counts as "production" for the demo and sandbox switches; kill
switches failing open; no cap on progress-photo count; direct Supabase sign-ups skipping the Terms boxes; a full refund
leaving the subscription running; `sharp` not a direct dependency; time with no distance counted as moving time; no
fl oz for water; a 14-day sleep import stamped with one time zone; commentary in older-translation wording; the usage
screen not saying "UTC"; AI helpers without their own timeout; three beginner programs with advanced lifts; a plan that
can fill all seven days; edits that leave a workout with no completed sets still counting for streaks; the muscle map
reading at most 1,000 sessions; the exercise library page sending about 500 kB for 218 exercises; and others listed in the four reports.

### Design and content (Part 3)

- No demo label, placeholder text or "coming soon" was found in release screens. The words "Demo" and "sample data"
  appear only in components that render in demo mode (`src/components/demo/*`, `coach/page.tsx:160`), and
  `e2e/production-no-demo.spec.ts` checks that a production build shows none of them.
- The only placeholder text a member can reach is in the two legal pages (L1).

## 3. What was fixed, with files

**Home and activation (this session's own work)**

| Change | Files |
|---|---|
| Seven Home backgrounds, one per weekday, following the phone's local date | `public/home-backgrounds/*.webp`, `scripts/home-backgrounds/{scenes.js,render.mjs}`, `src/lib/home-backgrounds.ts`, `src/components/home/daily-hero.tsx`, `src/app/(app)/home/page.tsx`, `public/sw.js`, `next.config.ts` |
| Activation report: second workout, day-30 return | `supabase/migrations/20261115000075_activation_second_workout_day30.sql`, `src/app/(app)/admin/page.tsx`, `docs/activation/FIRST_WORKOUT_ACTIVATION.md`, `supabase/setup-all.sql` |
| Tests | `tests/unit/home-backgrounds.test.ts`, `e2e/home-backgrounds.spec.ts`, `tests/integration/activation-events.test.ts` |
| Review note corrected | `src/data/exercise-demo-readiness.json`, `docs/EXERCISE_DEMOS_2D_STATUS.md` |

**Security and billing** — `src/server/services/ai-photo-guard.ts` (new), `src/app/api/ai/food-photo/route.ts`,
`src/app/api/ai/label-photo/route.ts`, `src/server/services/billing.ts`, `src/server/actions/billing.ts`; tests
`tests/integration/{ai-photo-upload-guard,account-deletion-billing,api-function-surface}.test.ts`,
`tests/unit/checkout-rate-limit.test.ts`.

**Workouts, programs, progress** — `src/components/workout/workout-logger.tsx`, `src/server/services/workouts.ts`,
`src/lib/domain/workout-draft.ts`, `src/lib/domain/record-labels.ts`, `src/lib/domain/strength.ts`,
`src/app/(app)/progress/overview/page.tsx`, `src/components/progress/muscle-map.tsx`, `src/data/programs.ts`,
`supabase/seed.sql`; six new test files (`tests/unit/workout-audit-2026-11-14.test.ts`,
`workout-logger-backup-stops.test.tsx`, `program-catalog-validation.test.ts`, `program-builder-matrix.test.ts`,
`progress-audit-2026-11-14.test.ts`, `tests/integration/workout-audit-2026-11-14.test.ts`).

**Nutrition, GPS, health** — `src/lib/domain/gps-track.ts`, `src/components/run/gps-recorder.tsx`,
`src/server/services/progress.ts`, `src/server/services/sleep.ts`, `src/lib/domain/diets.ts`,
`src/lib/domain/calorie-budget.ts`, `src/server/actions/sleep-import.ts`, `src/components/steps/steps-card.tsx`,
`src/lib/domain/steps.ts`, `docs/SLEEP_METHOD.md`; tests `tests/unit/audit-ngh-{gps,nutrition,sleep}.test.ts`,
`audit-ngh-steps-card.test.tsx`, `tests/integration/{nutrition-daily-paging,sleep-stages-paging}.test.ts`.

**AI, Faith, notifications** — `src/server/services/ai-coach.ts` and the five AI helpers that use it,
`src/lib/notifications/planner.ts`, `src/data/devotionals.ts`, `src/data/studies.ts`, `standalone/index.html`; tests
`tests/unit/{scripture-quotations,red-letter-boundaries,notification-planner-audit,ai-context-privacy}.test.ts`,
`tests/integration/{ai-billed-failures,ai-policy-audit}.test.ts`.

Every fix has a regression test that was seen failing on the old code first. One database change was made: migration
075 replaces one admin-only report function (no table, column, policy or stored row changes; rollback is the function
in migration 056). Twelve `training_programs.equipment` values were corrected in the seed.

## 4. Verification

All on the merged code (commit `ff135ac`, plus the Home fade change noted below), on 2026-11-15. Type check, lint and the two Home unit files were re-run after that change.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | No errors |
| `npx eslint .` | No findings |
| `npx vitest run --project unit` | 254 files, 4,707 tests passed, 0 failed |
| `npx vitest run --project integration` (local Supabase) | 79 files passed, 1 skipped; 467 tests passed, 1 skipped, 0 failed |
| `npm run build` | Built |
| Production browser suite: `npx playwright test --project mobile --workers 2` against `next start`, with stand-ins for the AI provider and Open Food Facts | 148 passed, 0 failed, 99 skipped (58 demo-only tests, 40 opt-in audit tests, 1 demo-server check). Run on the build before the last one-line Home change; after it, `home-backgrounds`, `csp-and-layout` and `production-no-demo` were re-run on the final build: 12 passed |
| Demo browser suite (demo server, sample account) | 57 passed, 0 failed, 1 skipped (the sleep-stage label test skips itself when the sample's latest night has no stages). Final build, after a full database reset: all 68 migrations applied from scratch and the sample account seeded |
| `e2e/home-backgrounds.spec.ts` (final build) | 5 passed; lowest text contrast per day 7.5 to 12.0 (4.5 needed) |
| Contact sheets of 16 exercises at six phases (`scripts/exercise-review/contact-sheets.mjs`) | Rendered and inspected by eye; see section 5 |

Not run: the opt-in device-matrix and button-sweep audits (40 tests), any test on iOS or Android, any call to a live AI
model, any real payment.

### End-to-end journeys (Part 22)

"Passed" means automated browser or database tests ran the journey here. None was run on a phone, with a real
mailbox, or with a real payment.

| Journey | What ran | Result | Not tested |
|---|---|---|---|
| New Free user | Sign up, confirm by email (local inbox), five questions, plan, Start today's workout, complete sets, finish, Free limits shown: `core-flow`, `onboarding-plan`, `first-workout-activation`, `new-member-states`, `memberships` | Passed | Real mailbox; any device |
| New Pro user | Pro granted by a test helper, then coach chat (stand-in AI), Pro programs, live GPS gate, usage screen: `memberships`, `pro-programs`, `coach`, `ai-usage`, `gps-run` | Passed with stand-ins | Buying Pro in a store; a live AI model |
| Returning athlete | Sample account with 33 workouts, 30 days of food, 8 runs, 28 nights of sleep and a Faith journey on day 21: the demo suite (57 tests) | Passed | Long real histories (years of data) |
| Existing subscriber | Store-billed member sees where to manage the plan and what deletion does: `store-billing`; refunds, disputes, renewals, transfers in `tests/integration/{subscription-lifecycle,billing-integrity,store-billing}` | Passed against stand-ins | Real App Store, Google Play, RevenueCat and Stripe events |
| Unreliable network | Offline logging and resync, double taps, retry after failure, discard not resurrecting, AI failure keeping the unsent message, Home pictures and Bible offline: `workout-reliability`, `workout-data-preservation`, `coach`, `home-backgrounds`, `tests/unit/bible-offline` | Passed in Chromium's offline mode | A real weak mobile connection; iOS suspending the app |
| Subscription expiration | Lapsed, refunded and disputed members lose Pro on the server; direct calls refused: `tests/integration/{subscription-lifecycle,entitlements,plan-enforcement,pro-bypass}` | Passed at the server and database | **No browser journey of a plan expiring while the app is open**; store-side expiry |
| Privacy isolation | Member A cannot read or change member B's rows in 87 tables and 3 file buckets; row-level security on all 106 tables; account deletion removes the data: `tests/integration/{cross-user-isolation,rls,account-security,account-deletion}`, `e2e/account-deletion` | Passed | Production database configuration |

## 5. What remains

### Blocked on something outside the code

| Item | Blocked on |
|---|---|
| Privacy Policy and Terms | Attorney review (L1) |
| Home backgrounds | **The owner rejected the seven illustrations on 2026-11-15.** They are placeholders until seven photorealistic images are generated or supplied and approved; art direction and prompts in `docs/design/HOME_BACKGROUNDS.md` |
| App Store / Google Play purchases, restore, refund, expiry | Store accounts, RevenueCat project, sandbox testers |
| Live AI answer quality and real cost per member | An API key with a spend limit; plan in `docs/LIVE_AI_TEST_PLAN.md` |
| Production settings (auth limits, SMTP, environment switches, headers, cookies) | Access to the production project |
| Exercise animation correctness | Review by a qualified strength coach or physiotherapist, and the owner's sign-off (none of the 218 is signed off) |
| Faith commentary | The planned theological review |

### Needs a physical iPhone (Part 23)

None of these was tested, and none can be from this environment:

- Install, launch, splash and opening sequence on a real device; safe areas and the Dynamic Island.
- Sign in with a real mailbox, password reset links opening the app.
- Workout logging with the screen locking, the app being killed mid-workout, and rest-timer notifications.
- Outdoor GPS: accuracy, background and locked-screen recording, battery use, the location permission prompts.
- Apple Health: authorisation, denial, revocation, step and sleep import from a real watch.
- Camera: barcode scanner, meal photo, label photo, progress photo, body scan.
- Local notifications: permission, delivery at the scheduled time, quiet hours, deep links.
- In-app purchase: buy monthly and yearly in the sandbox, restore, cancel, expire, refund, family or account transfer.
- Home backgrounds: sharpness, whether the web view keeps the pictures for offline use, the change at midnight after
  iOS has suspended the app, and a change of the phone's time zone.
- VoiceOver, Dynamic Type at the largest sizes, Reduce Motion.
- Performance on an older phone and on a slow mobile connection.

The step-by-step script for these is `docs/device-testing/` and `docs/TESTFLIGHT_INTERNAL_CHECKLIST.md`.

### Animation inspection (Part 7)

Sixteen exercises were rendered at six phases each and looked at: back squat, conventional deadlift, bench press,
barbell row, overhead press, walking lunge, pull-up, power clean, cable woodchop, medicine-ball slam, cat-cow, 90/90
hip switch, A-skip, 5-10-5 shuttle, three-cone drill, agility ladder.

- All sixteen render the app's own 2D athlete with equipment, no broken limbs, no missing frames.
- The barbell lifts, lunge, pull-up, row, woodchop and slam read as the movement they name.
- **90/90 hip switch:** drawn from the front on a mat. In the stills it reads as a wide kneeling straddle more than a
  seated 90/90. Needs an expert's eye before it is called correct.
- **Three-cone drill:** the figure is small and the turns are fades; the weakest of the agility drills, as its own
  review note says.
- **Power clean:** the six sampled frames skip the second pull and the catch, so the bar path could not be judged from
  them.
- Six stills cannot show timing or joint paths. Nothing here is a claim that any animation is anatomically correct.

## 6. Launch readiness

| Stage | Decision | Why |
|---|---|---|
| Internal development testing | **Ready** | All automated checks pass; demo mode and seed data work |
| Private TestFlight (owner and a few invited testers) | **Ready to build, with conditions** | Needs the owner's Apple and Supabase staging setup (`docs/TESTFLIGHT_STEPS.md`); payments stay in sandbox; legal pages are visibly drafts, which is acceptable for invited testers only; first job of the testers is the device list in section 5 |
| Public Free launch | **Not ready** | Legal pages (L1); no physical-device testing; production auth limits unverified (O1); animation and commentary reviews outstanding |
| Paid subscription launch | **Not ready** | Everything above, plus no real store purchase, restore, refund or expiry has been run; the prayer-journal sharing decision (A1); the three AI policy questions below |

## 7. Next steps, in order

1. **Owner decisions** (each is one sentence to answer):
   - A1: should "Share with AI Coach" on prayer-journal entries stay, or be removed?
   - Should members on the old Plus plan keep AI access? (`src/server/services/billing.ts:597`)
   - Should the automatic weekly report count toward the 150 requests a month? (Today it does not: about 4–5 extra.)
   - Confirm $17.99 monthly and $119.99 yearly are the prices to create in App Store Connect and Google Play. (The code
     already uses them; nothing live was changed.)
2. Send the Privacy Policy and Terms drafts to an attorney.
3. Set up staging and build a private TestFlight; run the device list.
4. Run the sandbox purchase plan (`docs/MOBILE_BILLING.md`) on that build.
5. Fix P-3 (timed exercises in the logger) and decide B-2 and B-4 with a coach.
6. Get the animation review and the theological review done; record sign-offs in `exercise-demo-readiness.json`.
7. Produce and approve seven photorealistic Home backgrounds (the illustrations were rejected).
8. Verify production settings (O1 and O4 in the security report), then re-run this audit's test commands against
   staging.
