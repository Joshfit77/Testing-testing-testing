# Privacy data-flow audit: what can reach the AI provider

Date: 2026-11-16. Branch: `claude/legal-remediation`. Scope: every route by which sensitive information can reach the
AI provider (Anthropic), the consent that gates it, and the tests that prove the gates. The full data-flow map for
every data type is `docs/legal-audit-2026-11-16/06_PRIVACY_DATA_FLOW_MAP.md`. Not legal advice; whether these consents
are sufficient in law is for counsel.

## Routes, gates and status

| Sensitive item | Route to the AI provider | Gate enforced on the server | Minimised? | Status |
|---|---|---|---|---|
| Age (from birth year), sex, height, units | Standard context with every coach message | General AI consent (`profiles.ai_data_consent_at`), checked at `src/server/services/ai-coach.ts:469-470` and `:659-660` before any request | Age is sent, not the birth year | Disclosed on the consent card. The onboarding screen that said "Never shared" is corrected |
| Bodyweight entries (90 days) and goal weight | Standard context | General AI consent | 90 days | Disclosed |
| Training records: workouts, sets, personal records, program | Standard context and coach tools | General AI consent | Recent sessions | Disclosed |
| Food log (7 days), targets, supplements | Standard context | General AI consent | 7 days | Disclosed |
| Health limitation notes | Standard context | General AI consent **and** wellness consent (`wellness_consent_at`): `src/server/coach/snapshot.ts:257` | Omitted without wellness consent | Disclosed |
| Recovery check-in score | Standard context | General AI consent | Latest only | Disclosed |
| **Step counts imported from Apple Health / Health Connect** | Standard context | **New:** general AI consent **and** the separate health permission (`health_ai_share_consent_at`, migration 079): `src/server/coach/snapshot.ts` | Typed-in steps only, unless the permission is on | **Changed on this branch** |
| **Sleep recorded by a watch or ring: time asleep, stages, overnight heart rate, heart-rate variability, breathing rate** | Sleep summary tool, when the member asks about sleep or recovery | **New:** general AI consent, wellness consent **and** the separate health permission: `src/server/coach/sleep-summary.ts` | Without the permission, imported nights are left out entirely and the coach is told how many, so it does not guess | **Changed on this branch** |
| **The wearable's device name** | Was sent in the sleep summary | **Never sent now**, whatever the permissions | Removed | **Changed on this branch** |
| Sleep the member logged by hand; sleep check-in answers | Sleep summary tool | General AI consent and wellness consent | — | Disclosed in part: check-in answers are a proposed addition to the consent card |
| Weekly report figures, including sleep | Scheduled weekly report for Pro members | General AI consent; **new:** imported nights are left out of what the provider receives unless the health permission is on (`src/server/services/weekly-reports.ts`). The member's own report page still shows every night | — | **Changed on this branch**; proposed addition to the consent card |
| Prayer journal entries | Standard context | General AI consent **and** the per-entry switch "Share with AI Coach", off by default: `src/server/coach/snapshot.ts:188-190` | Only entries the member marked | Disclosed. Owner decision A1 (whether to offer this at all) is still open |
| Bible study questions and the passage being read | Bible study helper | General AI consent: `src/server/services/bible-ai.ts:87-93` | — | Proposed addition to the consent card |
| Meal photos | Food-photo estimate | General AI consent **and** a separate food-photo consent: `src/server/services/food-photo.ts:35-52` | Not stored, per the audit | Disclosed |
| Progress photos, Body Scan photos | **None.** No code sends them | — | — | Verified by reading the coach context and tools |
| Coach memories | Standard context | General AI consent **and** memory switched on | Member can view and delete | Disclosed |
| Other members' data | **None** | Row-level security; isolation tests | — | Verified |

## The change made on this branch, stated plainly

Before: with the general AI consent on, imported step counts went with every coach message, and a sleep summary
including a watch's stages, heart rate, heart-rate variability, breathing rate and device name went to the provider
when the member asked about sleep. The consent card disclosed the health data (not the device name).

Now: none of that is sent unless the member turns on a second, separate permission, "Share Apple Health / Health
Connect data with the AI Coach", under You > Privacy & data. It is off by default. Withdrawing the general AI consent
switches it off too. The device name is never sent.

Effect on members: until they turn the permission on, the coach cannot discuss watch-recorded sleep or imported
steps, and says so. Steps and sleep they entered themselves are unaffected.

**This is a behaviour change and is not silent:** it is on the remediation branch only, nothing is merged, and the
wording of the new switch and of the consent card is marked pending owner and counsel approval
(`src/components/profile/profile-forms.tsx`, `src/components/coach/ai-consent-card.tsx`).

## Tests that demonstrate unauthorised data cannot reach the provider

`tests/integration/health-ai-sharing.test.ts` (5 tests, local database, a synthetic member with two imported step
days, two typed-in step days, one hand-logged night and two watch-recorded nights with measurements and a device
name containing a person's name). They read exactly what the coach assembles for the model:

| Test | What it shows |
|---|---|
| Default (AI consent on, health permission off) | Only the typed-in step counts appear; one night is reported; the two imported nights are counted as not shared; no measurement, no platform name and no device name appears anywhere in the output |
| Health permission on | Imported steps and the watch's readings appear; the device name still does not |
| Health permission on, AI consent off | Imported data is absent: the permission does nothing alone |
| Turning the permission off | Imported data disappears again at the next read |
| Another member | Cannot set the permission on someone else's profile |

`tests/unit/health-ai-sharing.test.ts` (4 tests): the rule itself, the default, and that the weekly figures given to
the provider leave imported nights out.

Existing tests still relied on: `tests/unit/ai-context-privacy.test.ts` and
`tests/integration/cross-user-isolation.test.ts` (no other member's data in a coach context);
`tests/integration/ai-route-limits.test.ts` and `entitlements.test.ts` (Free members refused; consent required).
Results of the full runs are in `LEGAL_REMEDIATION_COMPLETED.md`.

## Consent: what exists and what is thin

| Aspect | Status |
|---|---|
| Explicit consent before anything is sent | Yes: the consent card must be accepted first; the server refuses without the timestamp |
| Scope | One general consent, plus separate ones for health-platform data (new), food photos, coach memory, wellness notes, and per-entry for prayer journal |
| Withdrawal | Each can be turned off; it stops future sending. Nothing already sent can be recalled |
| Record of consent | A single timestamp per consent, erased on withdrawal. No history of what text was agreed to. **For counsel:** whether a consent log is needed |
| Retention at the provider | **Unknown.** No contract is in the repository. **For the owner:** confirm the account's terms (retention, no training on member data) |
| Retention in the app | Conversations are kept until the member deletes them or their account. No automatic deletion exists. **Owner decision** |
| Disclosure | The consent card is updated for the health change. Five items the audit found missing are still proposals (`docs/legal-audit-2026-11-16/15_WORDING_CORRECTIONS_BEFORE_AFTER.md`, B4) |

## Not verified

A live model call (the tests read what the app assembles; the provider itself was a stand-in or not called). The
hosted environment's configuration. Whether a single bundled consent would have satisfied Apple's and Google's
health-data rules: the new separate permission is the conservative answer, not a legal conclusion.
