# Founder action items

Things only you can do (accounts, money, legal, approvals, physical devices). Engineering work is in
EXTERNAL_DEVELOPER_SCOPE.md. Ordered by what unblocks the most.

## Decisions needed now

| # | Decision | Context | Recommendation |
|---|---|---|---|
| D1 | Review and approve the pull request `release/narrow-gate-production-consolidation` → `main` | It changes `main` substantially, including pricing on `main` from $30 Pro / $9.99 Plus to the approved **$17.99 / $119.99**. Nothing is merged until you approve | Approve after reading MASTER_ENGINEERING_REPORT.md; merging does not deploy by itself unless your hosting deploys `main` automatically — **check that first** |
| D2 | Close the 10 obsolete pull requests (#3–#12) | All are older than and contained in the consolidation branch | Close them (I did not, per your rules) |
| D3 | Delete merged branches later? | 34 branches are fully contained | Optional housekeeping; nothing was deleted |
| D4 | Enable `AI_CHAT_RETENTION_DAYS`? | AI chat history is kept until the member deletes it; the option purges older chats | Decide a period (e.g. 365 days) with your privacy policy |
| D5 | Friends & Challenges | Merged, switched off by flag `friends_challenges` | Keep off for v1.0; enable after its own beta |

## Accounts and setup (no code)

1. **Apple Developer Program** membership and App Store Connect app record (`com.narrowgatefitness.app`).
2. **Google Play Console** account (if launching on Android).
3. **Production Supabase** project (Pro plan recommended; see REMAINING_COST_ESTIMATE.md), then let an engineer run
   `supabase db push` against **staging first** (O-16).
4. **Hosting** for the Next.js app (e.g. Vercel Pro) with the environment variables listed in `.env.example`.
5. **RevenueCat** project; App Store and Play products at $17.99 monthly / $119.99 yearly.
6. **Stripe** account for web subscriptions — keep in test mode until you approve live billing.
7. **Anthropic** API key with a monthly spend limit set in the Anthropic console (AI_COST_ANALYSIS.md) — do not
   enable until you approve paid AI.
8. **Scheduled jobs** (cron) for `/api/maintenance/*` with a `CRON_SECRET`.
9. **Email sending** (Supabase SMTP with your domain) so confirmation emails don't land in spam.
10. **Universal links (O-05, built and switched off):** in the Apple Developer account, enable *Associated Domains*
    for the App ID; set `APPLE_TEAM_ID` and (Android) `ANDROID_APP_CERT_SHA256` on the hosting; then a consultant runs
    prompt P-07 in docs/engagement/ISSUE_PROMPTS.md.
11. **RevenueCat:** set the restore behaviour to *Transfer to new App User ID* (the app also protects against one
    purchase granting two accounts, O-10).
12. **Book the engagement:** docs/engagement/ENGAGEMENT_AGENDA.md lists who you need, in what order, and the hours.

Enter every key directly into the hosting provider, GitHub secrets or the secure form — never into chat.

## Legal

- Final privacy policy and terms reviewed by a lawyer (health data, faith data, AI processing, minimum age and how under-18 members are handled).
- Confirm Bible translation licensing for the bundled text (BSB is public-domain-dedicated; keep the attribution).
- Trademark search for "Narrow Gate Fitness" (see the legal research documents merged from the Friends branch).

## Physical device testing

- Install TestFlight builds on 1–2 iPhones and run IPHONE_DEVICE_TESTING.md (about 4–6 hours including a 30-minute
  outdoor run). Record results honestly; failures go back to engineering.
- Optional Android pass (ANDROID_DEVICE_TESTING.md).
- Recruit 10–30 beta testers (docs/BETA_TEST_PLAN.md).

## Approvals I will ask for before doing

- Merging into `main`; any deployment; live billing; store uploads; production database changes; paid AI usage
  (including any live AI test run, which would be capped).
