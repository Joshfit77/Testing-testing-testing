# Legal remediation: completed work and evidence

Date: 2026-11-16. Not legal advice; nothing here has been reviewed by an attorney. Nothing has been merged into the
release candidate or `main`, deployed or published. No price, plan entitlement or brand name was changed.

## Branches

| Branch | Commit | Contents |
|---|---|---|
| `claude/legal-remediation` | `d3b5f38` (plus the commit adding this report) | The release candidate (`56500ff`) + the offline fix + every remediation below. **No Friends code** |
| `claude/rc-offline-fix` | `8ea238f` | The release candidate + only the two-file offline fix. Ready to fast-forward on approval |
| `claude/friends-challenges` | `fcb18ee` | Friends & Challenges (switched off) + its privacy fixes. Not for the release candidate |

## A. Fixed, implemented and verified

### 1. Apple Health / Health Connect data and the AI provider

**Defect:** with the general AI consent on, imported step counts went to the AI provider with every coach message,
and watch-recorded sleep (stages, overnight heart rate, heart-rate variability, breathing rate, and the device's name)
went when the member asked about sleep, recovery or training.

**Fix:** a separate permission, "Share Apple Health / Health Connect data with the AI Coach", off by default
(`profiles.health_ai_share_consent_at`, migration `20261116000079`). One rule (`src/lib/domain/health-ai-sharing.ts`)
is applied on **every** path that feeds the AI provider:

| Path | File |
|---|---|
| Standard coach context (steps) | `src/server/coach/snapshot.ts` |
| Sleep summary tool | `src/server/coach/sleep-summary.ts` |
| Training-review tool | `src/server/services/adaptive-training.ts` (`forAiProvider`), `src/server/coach/tools.ts` |
| Lift-progress and recovery tools | `src/server/coach/analysis.ts` |
| Weekly report analysis | `src/server/services/weekly-reports.ts` |

The device name is never sent. Withdrawing the general AI consent also switches the health permission off
(`src/server/actions/profile.ts`). The permission column can be written only by its owner (column grant plus
row-level security). The member's own Sleep, Train and report screens still use every night. The switch is under
You > Privacy & data; the consent card says imported data is not sent unless separately allowed.

The training-review and recovery paths were found during this work, after the first version of the gate covered only
the coach context, sleep summary and weekly report. They are now gated and tested.

**Evidence:** `tests/integration/health-ai-sharing.test.ts`, 6 tests, all passing. A synthetic member holds two typed
and two imported step days, one hand-logged night, and two watch-recorded nights with readings and a device name
containing a person's name. The tests read exactly what the coach assembles:

| Test | Result |
|---|---|
| Default: only typed-in steps; 1 night; 2 nights reported as not shared; no reading, platform name or device name anywhere | Pass |
| Permission on: imported steps and readings present; device name still absent | Pass |
| Permission on but AI consent off: nothing imported | Pass |
| Turning the permission off removes the data at the next read | Pass |
| Training-review and recovery tools: 1 night without the permission, 3 with it; the member's own review always sees 3 | Pass |
| Another member cannot set the permission on someone else's profile | Pass |

`tests/unit/health-ai-sharing.test.ts`: 4 tests, all passing.

**Status of the wording:** the switch and consent-card text are pending owner and counsel approval.

### 2. User-facing statements corrected (46)

Full before/after with code references: `docs/legal-audit-2026-11-16/21_STATEMENT_CORRECTIONS_APPLIED.md`.

**19 factual fixes (applied; no approval needed):** README rows 13, 14, 21, 32, 33 (exercise count corrected to 218,
counted from `EXERCISES.length`; program counts 64 listed / 74 total; data statements); `IMPLEMENTATION_STATUS.md:52`;
`docs/MEMBERSHIPS.md:29, 49`; `docs/PRESENTATION_GUIDE.md` (8 lines); `src/lib/demo/presenter.ts:48`;
`src/lib/bible/ai.ts:98`; `src/server/actions/bible-ai.ts:8`; `src/components/train/program-builder.tsx:864`.

**27 legally consequential changes (applied with accurate wording; awaiting your and counsel's approval):**

| # | Where | Now reads |
|---|---|---|
| 1 | `onboarding-questionnaire.tsx:487` | "…Kept private to your account. If you turn on the AI Coach, your age, sex, height and weight are sent to its AI provider to personalise answers." (was "Never shared") |
| 2 | `onboarding-wizard.tsx:249` | Same as 1 |
| 3 | `onboarding-wizard.tsx:415` | "…the app gives administrators no way to view it" (was "never visible to administrators") |
| 4 | `body-scan/consent-card.tsx:13` | "…kept in private storage with our hosting provider that only your account can open. The app gives our team and admins no way to view them." |
| 5 | `body-scan/consent-card.tsx:14` | "…stored privately with our hosting provider and are never sent to the AI coach or to anyone else…" (was "to any other company or service") |
| 6 | `body-scan/scan-dashboard.tsx:140` | Same facts as 5 |
| 7 | `progress-photos.tsx:146` | "Stored privately with our hosting provider; only your account can open them. Never sent to the AI Coach or to anyone else…" (was "Only you can see your photos") |
| 8 | `progress-photos.tsx:485` | "Stored privately; only your account can open them." |
| 9 | `faith/faith-forms.tsx:159` | "…the app gives administrators no way to view it" (was "Never to administrators") |
| 10 | `faith/journal/[id]/page.tsx:88` | Same pattern as 9 |
| 11 | `faith/ask/page.tsx:50` | "Your question and the earlier messages in this thread are sent to our AI provider…" (earlier messages were not disclosed) |
| 12 | `sleep/consent-card.tsx:18` | Describes when a sleep summary goes to the AI provider (was "never shared with the AI coach unless you ask") |
| 15 | `plans.ts:143` | "Bible reading, prayer journal, devotionals and reading journeys (the AI Bible study helper is part of Pro)" (was "complete … always free") |
| 16 | `membership-plans.tsx:43` | Same as 15 |
| 17 | `membership.ts:37` | Plan table shows a tick instead of "Always free" |
| 18 | `profile/billing/page.tsx:169` | "Included in the Free plan: Bible reading, the prayer journal, devotionals and reading journeys. The AI Bible study helper is part of Pro." |
| 19 | `profile/billing/page.tsx:164` | "Everything you need to build your foundation. No card required." (was "free for as long as you like") |
| 20 | `signup/page.tsx:23` | "Free plan. No card required." (was "Free forever plan") |
| 21–22 | `coach/page.tsx:230-231` | "…Bible and prayer journal are in Free" (was "Faith stays free") |
| 23 | `notification-settings.tsx:467` | "…Included in Free." (was an open-ended promise) |
| 24 | `bible-ai.ts:78` | "…are included in the Free plan." |
| 25 | `bible-ai.ts:120` | "The Bible is free to read and search." (was "always free") |
| 26 | `lib/bible/ai.ts:112` | Same as 25 |
| 27 | `faith/bible/page.tsx:51` | "…Free to read." |
| 29 | `standalone/index.html:2787` | "The Faith section, included in Free" |
| 46 | `train/build/page.tsx:25` | "…is included on every plan." |

Also corrected earlier and carried into this branch: the cancellation note (deleting the account cancels a website
subscription; removing the app cancels nothing), and a code comment that wrongly said no Open Food Facts data is stored.

### 3. Legal drafts (still drafts)

`docs/legal/PRIVACY_POLICY_DRAFT.md` and `docs/legal/TERMS_OF_SERVICE_DRAFT.md` now describe what the app actually
does: data categories, processors, AI sharing and the new health permission, Apple Health and Health Connect, GPS,
progress and Body Scan photos, nutrition and Open Food Facts, deletion and export, a "Friends (not yet available)"
section, prices exactly as in code, no free trial, cancellation and restore. Draft banners, 66 attorney notes and every
placeholder are kept; no company detail was invented. New: `docs/legal/MODERATION_AND_USER_CONTENT_POLICY_DRAFT.md`
(draft) and `docs/legal/REMAINING_INFORMATION_NEEDED.md` (76 facts, 34 decisions, 7 documents still to write).

### 4. Other fixes

| Fix | File |
|---|---|
| Public page explaining how to delete an account (Google Play asks for a web address) | `src/app/legal/delete-account/page.tsx`, linked in the legal links |
| Complete third-party notices file (175 packages with licence texts, plus the four fonts), linked from the Notices page; MPL-2.0 plugin named with version and licence link | `public/third-party-notices.txt`, `scripts/legal/third-party-notices.mjs`, `src/app/legal/notices/page.tsx` |
| Open Food Facts credit linked on the scan amount step | `src/components/nutrition/food-amount.tsx` |
| Offline fix (service worker) | `public/sw.js` (also on `claude/rc-offline-fix`) |

### 5. Friends & Challenges privacy (branch `claude/friends-challenges`, still switched off)

Migrations 077 and 078: a new friend sees only a username and display name until the member switches workouts on;
switches that no feature reads are hidden; the screen says weight, measurements, nutrition and Faith activity are
never shared with friends; the database itself limits username searches and invite-code guessing; a reporter can no
longer read administrators' notes; `search_path` hardened on 24 functions; unneeded grants to signed-out visitors
revoked; a member who turned search off receives requests only from people they asked; a blocked member can no longer
become the blocker's accountability partner. Feature flags untouched. Status per finding:
`docs/legal-audit-2026-11-16/08_FRIENDS_PRIVACY_AUDIT.md`, final section.

**What a friend can see, verified by tests:** user id, username, display name, the date they became friends, and
whether the profile is visible; workouts in the last 7 days and streaks only if the member switches that on. No
function returns weight, measurements, nutrition, Faith activity, journal entries, sleep, photos or AI conversations
to another member (`tests/integration/friends.test.ts`; the isolation sweep covers every Friends table).

### 6. Documents delivered

`docs/legal-remediation/`: `TRADEMARK_ATTORNEY_PACKAGE.md`, `PATENT_COUNSEL_PACKAGE.md`,
`ASSET_OWNERSHIP_MANIFEST.md`, `THIRD_PARTY_LICENSES.md`, `PRIVACY_DATA_FLOW_AUDIT.md`,
`APP_STORE_COMPLIANCE_CHECKLIST.md`, `INVESTOR_IP_OWNERSHIP_CHECKLIST.md`, `FOUNDER_ACTION_ITEMS.md`,
`LEGAL_BLOCKERS_REMAINING.md`, and this file. Official trademark and patent registers could not be reached; those
packages say so and mark every number unverified.

## Test evidence (exact results)

### `claude/legal-remediation` at `d3b5f38`, clean tree

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean |
| `npx eslint .` | Clean |
| Unit (`vitest --project unit`) | 257 files passed; 4,717 passed, 1 skipped, 0 failed |
| Integration (`vitest --project integration`, local Supabase reset to this branch's 69 migrations) | 80 files passed, 1 skipped; 473 passed, 1 skipped, 0 failed. Includes the security suites: cross-user isolation sweep, callable-function allow-list, row-level-security coverage, entitlements, AI route limits, AI context privacy |
| Production build | Built |
| Browser suite (`playwright --project mobile`, stand-ins for the AI provider and food database) | 147 passed, 101 skipped, 0 failed (11.9 min). The skips are demo-only specs, opt-in audits and the Home-photograph checks |

The skips are by design: the unit test checks the Home photographs, which don't exist yet; the integration file
calls the live Open Food Facts service, which is off in this environment.

### `claude/rc-offline-fix` at `8ea238f`

Typecheck and lint clean; unit 256 files, 4,713 passed, 1 skipped; build passed; offline Bible and Home browser tests
6 passed, 2 skipped (waiting for photographs); full browser suite 147 passed, 101 skipped, 0 failed.

### `claude/friends-challenges` at `fcb18ee`

Typecheck and lint clean; unit 258 files, 4,734 passed, 1 skipped; integration 80 files passed, 1 skipped, 489 passed,
1 skipped, 0 failed. Production build passed; the two-member Friends browser test (database reset to the Friends branch's migrations): 3 passed: hidden while the flag is off; username, search, request, accept, profile, privacy switch, remove; invite link. Both feature flags confirmed off before and after.

### Not tested

Anything on a physical iPhone or Android phone; real store purchases; a live AI model; the hosted environment.

## Answers

| | Answer |
|---|---|
| **E. Ready for private TestFlight?** | **Conditional.** The code side is ready once you approve the offline fix and the remediation branch. What remains is yours: a support email in the app, the Apple Developer account and app record, a hosted staging copy, a signed build, and a first pass on a physical iPhone. A company is not required |
| **F. Ready for public launch?** | **No.** Final Terms and Privacy Policy (76 facts, 34 decisions); trademark search; ownership records or replacement for the badge art and the supplied clip; your record of authorship and AI-tool use; the Open Food Facts licence question; approval of the 27 wordings; professional review of safety content; store setup; device testing. See `LEGAL_BLOCKERS_REMAINING.md` |
| **G. Ready for paid subscriptions?** | **No.** Everything in F, plus store products, sandbox purchase/restore/cancel/refund on a device, counsel's review of auto-renewal disclosures, and live AI cost measured |
| **H. Ready for investors?** | **No.** No entity, cap table or IP assignment; the authorship and AI-use record; account ownership (domains, developer accounts, GitHub, services); counsel's trademark and patent views. The product is substantial and tested in software; the ownership and legal documentation is what is missing |
