# Implementation-ready prompts for the remaining work

Paste a prompt into Claude Code in this repository (CLAUDE.md loads automatically). Each prompt names its agent
(`.claude/agents/`), the files, the root cause, how to reproduce and what "done" means. The consultant reviews the
diff and the evidence; Claude writes the code and the tests.

All O-01..O-20 code work is finished (docs/production-consolidation/BUG_FIX_REGISTER.md). What is left needs a phone,
an account or a hosted service, so most prompts start from evidence the consultant brings back.

---

## P-01: Change the run screen's "not yet verified" wording after the GPS device tests pass (O-02)

**Agent:** native-mobile · **Blocks:** App Review (guideline 2.5.4) · **Needs first:** IPHONE_DEVICE_TESTING.md tests
14, 15 and 16 passed on a real iPhone, with recordings.

```
Use the native-mobile agent. The background GPS run recording has now passed iPhone device tests 14, 15 and 16
(evidence: <paste device, iOS version, build, distances measured vs known route, recordings link>).
Update the wording that says it is not verified: locationSourceLabel() and the header comment in
src/lib/native/location.ts, and any run-screen copy or docs (grep -rn "not yet verified" src docs/RUN_TRACKING_PLAN.md).
Keep the browser wording ("keep this screen open") unchanged. Record the device results in
docs/production-consolidation/IPHONE_DEVICE_TESTING.md (date, device, build, pass) and update O-02 in
BUG_FIX_REGISTER.md. Run npm run verify. Done = no "not yet verified" text left for the native path, tests green.
```

## P-02: Triage a failed device test

**Agent:** native-mobile (or the area's agent) · **Use for:** any failure in IPHONE_DEVICE_TESTING.md or
ANDROID_DEVICE_TESTING.md.

```
Use the native-mobile agent. Device test <number> failed.
Device / OS / build: <...>. Steps exactly as run: <...>. Expected: <copy from the checklist>. Actual: <...>.
Attached: <screen recording>, <Xcode console or `adb logcat` excerpt around the time>.
1. Find the root cause in the code (name the file and line) and say whether it reproduces in the Simulator/emulator.
2. Write a unit test (plugin mocked) that fails for this cause, then fix it.
3. Run npm run verify; trigger the iOS / Android APK workflows if native files changed.
4. Update the checklist row with what to re-test. Don't mark the device test passed.
```

## P-03: Staging database deploy and verification (R-03, O-16)

**Agent:** database · **Run by:** a founder (F-2) · **Needs:** a staging Supabase project (owner creates it; Pro
plan) and its database URL in the founder's terminal, never in chat.

```
Use the database agent. Deploy the migrations to the STAGING Supabase project only (never production):
1. `npx supabase link --project-ref <staging-ref>` then `npx supabase db push --dry-run`, show me the list,
   then `npx supabase db push`.
2. Run `psql "$STAGING_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/verify-database.sql` and show the result.
3. If a migration warned "trigger not installed (no TRIGGER privilege on storage.objects)", explain the impact
   (the storage policy limit still applies) and propose the grant for the owner to run; don't run it yourself.
4. Point the integration suite at staging only if I confirm it has no real members
   (TEST_SUPABASE_URL / TEST_SUPABASE_ANON_KEY / TEST_SUPABASE_SERVICE_ROLE_KEY), run it, and report counts.
Done = all checks "ok", or each failure explained with the owner action it needs.
```

## P-04: Staging load test including writes (R-03)

**Agent:** qa-testing + backend · **Needs:** the staging site and staging Supabase (no real members).

```
Use the qa-testing agent. Extend scripts/perf/load-test.mjs with a write mix (log a set, finish a workout for a
member with 200 seeded sessions, log a meal) using synthetic members only, keep the read routes, and run it against
STAGING with ALLOW_REMOTE_LOAD_TEST=1 at 10, 25 and 50 concurrent for 60 s each. Report p50/p95/p99 per route, error
counts and the Supabase CPU graph values the consultant reads off the dashboard. Compare with the local figures in
docs/production-consolidation/PERFORMANCE_REPORT.md and update that report (label staging results as staging).
Delete every synthetic member afterwards. Done = report updated, cleanup confirmed.
```

## P-05: App Store sandbox purchase, restore and transfer (R-02)

**Agent:** payments · **Needs:** App Store Connect products at $24.99 / $149.99, a sandbox tester, a TestFlight build,
RevenueCat project with webhook to staging. Consultant performs the taps; Claude reads results.

```
Use the payments agent. On the staging deployment, a sandbox tester just did: <buy monthly | restore after reinstall |
restore onto a second account | refund via Apple sandbox>. Here are the RevenueCat customer JSON (redacted) and the
staging rows: `select plan, source, valid_until from user_entitlements where user_id = '<id>'`,
`select * from store_subscriptions where user_id = '<id>'`, `select id, type, status, attempts from
revenuecat_events order by received_at desc limit 5`.
Check each against docs/production-consolidation/PAYMENT_VERIFICATION.md. If anything differs, find the root cause,
add an integration test with the stand-in reproducing it, fix it. Record the sandbox results in PAYMENT_VERIFICATION.md.
```

## P-06: Stripe test-mode end to end on staging (R-02)

**Agent:** payments · **Needs:** Stripe test-mode keys set on staging hosting (never in chat), webhook endpoint added.

```
Use the payments agent. On staging with Stripe TEST mode: walk me through checkout for Pro monthly with card 4242,
then the customer portal (switch to yearly, cancel at period end), then a full refund from the Stripe Dashboard.
After each step, give me the SQL to read user_entitlements, subscriptions and stripe_events for the member, and the
expected values. Then call /api/billing/reconcile with the cron secret (I run it) and confirm nothing changes for a
consistent member. Record results in PAYMENT_VERIFICATION.md.
```

## P-07: Turn on universal links / App Links (O-05 activation)

**Agent:** native-mobile · **Needs (owner):** Apple Team ID, Associated Domains enabled for the App ID, the production
(or staging) domain, Play App Signing SHA-256.

```
Use the native-mobile agent. The owner enabled Associated Domains for com.narrowgatefitness.app and set APPLE_TEAM_ID
and ANDROID_APP_CERT_SHA256 on <staging|production> hosting. Run `APP_LINKS_DOMAIN=<host> npm run native:app-links`,
show the diff of App.entitlements and AndroidManifest.xml, run the unit tests and the iOS / Android APK workflows, and
check https://<host>/.well-known/apple-app-site-association and /assetlinks.json return the expected JSON with status
200 and no redirect. Add device steps to IPHONE_DEVICE_TESTING.md test 3 (email link opens the app).
```

## P-08: Release engineering: TestFlight build (R-04)

**Agent:** native-mobile · **Needs:** Apple Developer account access for the consultant, signing in GitHub secrets
(docs/TESTFLIGHT_FIRST_BUILD_GUIDE.md), CAP_SERVER_URL pointing at staging.

```
Use the native-mobile agent. Prepare the first TestFlight build from release/narrow-gate-production-consolidation
following docs/TESTFLIGHT_FIRST_BUILD_GUIDE.md: check the iOS workflow inputs, ITSAppUsesNonExemptEncryption, version
and build numbers, the privacy manifest against the App Privacy answers in docs/production-consolidation/
APP_STORE_READINESS.md, and that CAP_SERVER_URL is the staging HTTPS site. List anything missing as an owner action.
Do not upload anything without the owner's explicit approval in this conversation.
```

## P-09: Independent review of the consolidation pull request (R-05)

**Agents:** security, then payments · **Needs:** nothing but the repository.

```
Use the security agent, then the payments agent, to review the diff of release/narrow-gate-production-consolidation
against main, focusing on: migrations 088-098, src/server/services/{billing,billing-reconcile,store-billing}.ts,
src/server/api-auth.ts, src/lib/run/fix-journal.ts, src/lib/native/location.ts, src/lib/native/run-journal.ts,
ios/App/App/RunJournal*.swift, android/app/src/main/java/com/narrowgatefitness/app/runjournal/, src/lib/app-links.ts,
src/lib/storage-reservation.ts and the .well-known routes. For each finding give the exploit or failure path from a real entry point, severity and a minimal
fix; drop anything you can't trace. I will decide which to fix; then implement the accepted ones with tests.
```

## P-10: Android device pass (R-06)

**Agent:** native-mobile · **Needs:** an Android 15/16 phone, the APK from the "Android APK" workflow.

```
Use the native-mobile agent. Here are my results for ANDROID_DEVICE_TESTING.md (tests 1-15, including 6a and 6b): <table>. For each failure
follow P-02. For test 3 (edge-to-edge) include screenshots with gesture and 3-button navigation.
```
