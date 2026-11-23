# Legal review checklist: the in-app Privacy Policy and Terms (2026-11-23)

**Status: DRAFTS. Not reviewed or approved by a lawyer.** This list was written by an engineer who is not a lawyer.
It is not legal advice. It records what the two pages members can open in the app currently say, every unfinished
placeholder in them, and what the code does today, so that counsel can check one against the other.

- Pages: `src/app/legal/privacy/page.tsx` (shown at `/legal/privacy`, title "Privacy Policy (Draft)") and
  `src/app/legal/terms/page.tsx` (`/legal/terms`, "Terms of Service (Draft)").
- Both are recorded as version `2026-10-26-placeholder` in `src/lib/legal/versions.ts`. Members accept that version
  at sign-up. Any change to either page's text needs a new version and SHA-256 there (`tests/unit/legal-versions.test.ts` enforces it), after
  which the app records the new version at the member's next acceptance.
- The longer drafts in `docs/legal/` (`PRIVACY_POLICY_DRAFT.md`, `TERMS_OF_SERVICE_DRAFT.md`, and the
  owner/counsel list `REMAINING_INFORMATION_NEEDED.md`) are also unapproved. This checklist rechecks the in-app pages
  against the code on 2026-11-23 and adds what changed since the 2026-11-16 list.
- Line numbers are from release candidate `claude/rc-testflight-1` at 251d68b4. Search for the bracketed text if
  they have moved.

## 1. Unfinished placeholders (10)

| # | Page:line | Placeholder | Needs |
|---|---|---|---|
| 1 | privacy:12 | `[DATE — to be completed by counsel]` | Effective date |
| 2 | privacy:49 | `[Counsel to complete.]` (end of "How we use it") | Purposes and, where required, legal bases |
| 3 | privacy:55–56 | `[Counsel to confirm the wording and any applicable "sale" or "sharing" definitions under state law.]` | US state-law wording |
| 4 | privacy:61 | `[Counsel to verify and list data processing agreements.]` | Final processor list and DPAs (see section 3) |
| 5 | privacy:66–67 | `[counsel to confirm with each provider's agreement]` | Provider retention after account deletion |
| 6 | privacy:72 | `[Contact details to be added.]` | Operator's legal name, address and privacy contact |
| 7 | terms:8 | `[DATE — to be completed by counsel]` | Effective date |
| 8 | terms:19 | `[Counsel to complete refund and consumer-law terms, including App Store and Google Play purchases.]` | Refunds, consumer law, store purchase terms |
| 9 | terms:21 | `[To be completed.]` (Acceptable use) | Acceptable-use terms |
| 10 | terms:23 | `[To be completed by counsel.]` (Limitation of liability) | Liability terms |

(Ten rows: the privacy page has six, the terms page four.)

**Missing from the Terms entirely** (no placeholder marks them): who operates the service; governing law and disputes;
termination and suspension; changes to the terms; intellectual property and member content licence; the AI coach's
limits beyond the health disclaimer; Apple's required terms for apps (Apple's standard licence agreement, or a custom
one that meets Apple's minimum terms); contact details.

## 2. Statements that do not match the code (verified 2026-11-23)

These were first listed on 2026-11-16 (`REMAINING_INFORMATION_NEEDED.md`, section F) and were rechecked against the
code today. All are still uncorrected on the page.

| # | Page:line | The page says | The code does | Evidence |
|---|---|---|---|---|
| 1 | privacy:27–28 | Health data goes to the AI provider "when you ask the AI coach about sleep or recovery" after AI consent | It needs AI consent **and** a separate health-sharing setting that is off by default | `profiles.health_ai_share_consent_at`, read in `src/server/services/adaptive-training.ts:44` and `weekly-reports.ts:180` |
| 2 | privacy:45 | "the barcode or search text is sent to Open Food Facts and USDA" | A scanned barcode or product search goes to Open Food Facts; diary search text goes to USDA only when the live USDA search is configured | `src/server/services/open-food-facts.ts`, `food-database.ts` |
| 3 | privacy:49 | "We do not use advertising or analytics trackers" | True of third-party trackers. The app keeps its own record of workout events | — |
| 4 | privacy:61 | "Vercel (hosting)" | Production host not yet confirmed; no email provider chosen (section 3) | — |
| 5 | privacy:30–31 | Wellness information is "limitation notes, recovery check-ins" | Also sleep entries and sleep check-ins; withdrawing wellness consent does not delete sleep data already logged | wellness consent paths |
| 6 | privacy:36, 41 | AI is used for meal photos, the coach, meal plans and "Ask AI about this food" | Also food-label photos, AI Bible study questions and the weekly report | `label-photo.ts`, `bible-ai.ts`, `weekly-reports.ts` |
| 7 | privacy:65–67 | Deleting the account removes your data | It also cancels a website (Stripe) subscription, but **cannot** cancel one billed by Apple or Google: the member must cancel it in their store account | `src/server/services/account-deletion.ts:17–20, 58` |

## 3. Outside services the code contacts that the page does not name

| Service | When | What it receives | Evidence | New since 11-16? |
|---|---|---|---|---|
| **Cloudflare Turnstile** (bot check) | Sign-up, sign-in, resend and password reset, only once `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set | The visitor's IP address and browser signals | `src/components/auth/captcha-field.tsx:15`, `security-headers.ts:53` | **Yes** (added 2026-11-21, F-7) |
| **Open Food Facts image servers** | Opening a scanned product that has a photo | The member's IP address (the picture loads straight from `images.openfoodfacts.org` in the browser) | `src/app/(app)/nutrition/product/[code]/page.tsx:153`, `src/lib/food-quality.ts` | Not listed before |
| **YouTube (no-cookie player) / Vimeo** | Only if an administrator links a third-party video to an exercise and a member plays it | IP address and browser details | `src/lib/media.ts:19–29` | Listed in the long draft, not on the in-app page |
| **Map tile provider** | Off. Only if the owner sets `NEXT_PUBLIC_MAP_TILE_URL` | The area of each route a member views | `src/lib/domain/map-tiles.ts:1–7` | Off by default; disclose before turning on |
| **Email delivery** | Sign-up confirmation and password reset emails | Email address | Supabase Auth; production needs a chosen SMTP provider | Provider not chosen |
| **App's own error reports** | Off unless `ERROR_REPORTING=on` | A redacted error message and page path, no ids or typed text, to the app's own server log | `src/lib/error-report.ts`, `src/app/api/client-errors/route.ts` | First-party; mention if turned on |

Not a third party: Bible text is stored in the app's own database and bundle (`src/data/scripture.ts`); fonts are
served from the app itself (`next/font/local`).

## 4. Facts that match the code (for counsel's confidence)

- 18+ only: the Terms say so (terms:10), sign-up requires the age box and an age of 18–100
  (`src/lib/validation/schemas.ts:39, 93`).
- GPS read only during a recording the member started; routes visible only to the member (RLS, tested in
  `tests/integration/gps-running.test.ts` and `cross-user-isolation.test.ts`); deleting a run removes its route.
- Health data read only, never written; never used for advertising.
- Progress and Body Scan photos in private storage, not analysed by AI.
- Faith journal: no admin access path (`tests/integration/rls.test.ts:119`, `faith-calendar.test.ts:67`).
- No card numbers stored (Stripe Checkout and Apple in-app purchase).
- Export and deletion from Profile → Privacy & data.
- iOS privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`) declares email, name, fitness, health, other user
  content, purchase history, user ID, precise location, and photos. The App Store privacy answers must match it and
  this page.

## 5. Questions for counsel

1. Which laws apply at launch (US states only, or also UK/EU), and therefore what legal bases, rights and sale/share
   wording the policy needs.
2. Health data: is a consumer health data notice needed (for example Washington's My Health My Data Act), given Apple
   Health, sleep, heart rate and wellness notes?
3. Faith and religious content: is a journal entry or Bible note "sensitive" data in any launch jurisdiction?
4. AI provider: the retention and training terms of Anthropic's commercial agreement, to state on the page.
5. Subscriptions: auto-renewal disclosures (web checkout already shows price and period: `src/lib/legal/versions.ts`),
   refunds, and Apple/Google store purchase terms.
6. Whether to use Apple's standard licence agreement for the iOS app or a custom one.
7. Provider retention after deletion (Supabase backups, Stripe records kept for tax, RevenueCat, Anthropic).
8. Operator identity and contact address to publish.

## 6. What the owner must do

1. Choose the production host and email provider; tell counsel (section 3).
2. Send this file, the two pages and `docs/legal/` to counsel.
3. Do not present either page as final, and do not submit to the App Store for public release, until counsel has
   approved both and the placeholders are gone. A private TestFlight build can carry the drafts, because they are
   clearly marked as drafts.
4. When counsel's text is final: replace both pages, update `src/lib/legal/versions.ts`, and set `LEGAL_TERMS_URL`
   and `LEGAL_PRIVACY_URL` in the production environment.
