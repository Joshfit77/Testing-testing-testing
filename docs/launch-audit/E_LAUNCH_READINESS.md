# E. Commercial launch readiness

As of 2026-10-25, branch `claude/launch-audit` (on top of `claude/testflight-prep`). Status words: **done** (on this branch), **owner** (needs your account, money or decision), **counsel** (needs a lawyer), **device** (needs a physical iPhone / App Store sandbox).

## E.1 Critical launch blockers (nothing ships without these)

| # | Blocker | Why | Who | Where the steps are |
|---|---|---|---|---|
| 1 | **No deployed web app.** The iPhone app is a native shell around the deployed site; `capacitor.config.ts` refuses to build without a real `https://` address | TestFlight build cannot be made | owner (+ approval for the deploy) | `docs/TESTFLIGHT.md` §1 |
| 2 | **No Apple Developer account / App Store Connect record / API key secrets** | Signing and upload impossible; HealthKit App ID registration needed | owner | `docs/TESTFLIGHT.md` §2–3 |
| 3 | **Final privacy policy and terms** (drafts have counsel placeholders; facts were corrected here) | App Store 5.1.1(i), Beta App Review for external testers, FTC/state privacy law | counsel | `src/app/legal/*`, `docs/LEGAL_REQUIREMENTS.md`, `SECURITY_PRIVACY.md` §L |
| 4 | **In-app subscriptions never run against App Store Connect** (code and tests complete) | Apple 3.1.1; paying members would not be able to buy | owner + device | `docs/MOBILE_BILLING.md`; APPLE_COMPLIANCE #7 |
| 5 | **Trademark clearance of "Narrow Gate Fitness"** (common-law users found: Narrow Gate Strength & Conditioning (PA), Narrow Gate Club (NC); pending NARROW PATH ATHLETICS) | Launching nationally under an uncleared name risks a dispute and a forced rebrand later | counsel | `C_TRADEMARKS.md` §C.3, C.6 |
| 6 | **Real-device verification**: Apple Health import, background GPS, barcode scanner, purchases, opening animation on an iPhone | None has run on hardware; CI covers the Simulator and browsers only | device | `docs/TESTFLIGHT.md`, `docs/SLEEP_DEVICE_CHECKLIST.md` |

## E.2 High-priority improvements (before external testers / App Store)

1. **Patent counsel reads the actual independent claims** for the six patents and the three Part-2 items flagged for review (Fitbod 12,551,760; the two-dimensional body-image collection family 11,232,629 / 11,580,693; Oura 10,842,429), using `B_PATENT_CLAIM_CHARTS.md` as the chart skeleton. The sandbox could not retrieve claim text, so every chart is a paraphrase.
2. **Confirm FOOD IQ Reg. 4,337,059 status on TSDR** and search/clear a distinctive replacement for the placeholder "Nutrition Score" (also check NUTRI-SCORE Reg. 6,160,878).
3. **Dietitian / nutrition-scientist review of the FIQ-0.1 method** before `FOOD_IQ_SCORE` is switched on (it stays off).
4. **App Store Connect privacy answers** matching `PrivacyInfo.xcprivacy`; review notes explaining background location, HealthKit use, optional faith content; demo account.
5. **Android before any Play build:** `allowBackup="false"` or extraction rules; remove unused Health Connect permissions; add the missing background-geolocation and RevenueCat plugin wiring (`SECURITY_PRIVACY.md` S-8, S-9, O3).
6. **Incident procedure** for the FTC Health Breach Notification Rule (notice templates, who decides, timelines), decided with counsel.
7. **Prompt-injection hardening** of coach tool results (delimit third-party strings) — defence in depth; the current design already limits impact to a proposal card the member must confirm.
8. **Open Food Facts attribution wording** (ODbL) confirmed by counsel; USDA is public domain.

## E.3 Optional future work (not required for launch)

- Sign in with Apple (not required: email/password only).
- A CI assertion that the synced iOS `capacitor.config.json` points at `https://` before archiving.
- Purge soft-deleted activities after 30 days (routes are already stripped on delete).
- Distributed rate limiting (the in-memory limiter is per instance; AI metering is already database-backed).
- CSP without `'unsafe-inline'`.
- The three pending exercise-animation tasks (5-10-5 shuttle, 90/90 hip switch, QA sweep) from the earlier brief.

## E.4 Outstanding legal reviews (handoff list)

| Topic | Document | Decision needed |
|---|---|---|
| Patents 1–6 + Part 2 | `B_PATENT_CLAIM_CHARTS.md` | Freedom-to-operate opinion on the actual claims; whether to hold any feature (none is held today) |
| FOOD IQ, NUTRI-SCORE, "Nutrition Score" | `C_TRADEMARKS.md` §C.1–C.2 | Live/dead status; confusion analysis; replacement name |
| NARROW GATE FITNESS and feature names | `C_TRADEMARKS.md` §C.3–C.4, C.6 | Clearance search; filing strategy; "40 Days Through the Narrow Gate" |
| Privacy policy, terms, consent texts | `src/app/legal/*`, `docs/LEGAL_REQUIREMENTS.md`, `SECURITY_PRIVACY.md` §L–N | Final documents; retention; transfers; CCPA; HBNR; HealthKit wording |
| App Store EULA, refund terms, age rating | `APPLE_COMPLIANCE.md` | Apple standard EULA vs custom; refund policy for web purchases |
| Open Food Facts ODbL attribution; BSB attribution | `C_TRADEMARKS.md` §C.5, `docs/SCRIPTURE.md` | Wording only (BSB is public domain; OFF link present) |

## E.5 Required device testing (cannot be done from this environment)

1. Install the TestFlight build on an iPhone; confirm the opening, navigation, sign-in persistence, offline error page.
2. Connect Apple Health; import steps, sleep (with an Apple Watch or Oura/Garmin/WHOOP writing to Health), overnight HR/HRV/RR; check the consent and settings wording; disconnect.
3. Record a run with the phone locked (background location); pause/resume; signal loss; delete the run and confirm the route is gone from the export.
4. Scan barcodes with the native scanner; search; "Ask AI about this food" (needs `ANTHROPIC_API_KEY` on the deployment).
5. App Store sandbox: purchase Plus and Pro monthly/yearly, restore, upgrade, cancel, expiry, refund; confirm entitlements on the server (`docs/MOBILE_BILLING.md` checklist).
6. Body Scan capture on device (camera, overlay, tilt), progress photos, account export, account deletion.
7. Local notifications: reminders and the sleep alarm.

## E.6 Subscription and privacy readiness summary

| Area | State |
|---|---|
| Web billing (Stripe) | Test mode; live keys ignored unless `STRIPE_LIVE_APPROVED=true` (guard tested) |
| In-app billing (RevenueCat) | Implemented and unit/e2e-tested; sandbox flags off by default; **never run against the stores** |
| Entitlements | Server-side only, recomputed from Stripe/RevenueCat; plan tiers enforced in RLS |
| Consent gates | AI (now lists sleep and food-explain data), meal photos, wellness notes, Body Scan, sleep |
| Deletion / export | Complete; export rate-limited; deleted runs lose their route; sign-out clears recordings |
| Tracking | None; privacy manifest says so |
| Legal documents | Drafts, facts corrected, counsel placeholders remain |
| Health data | Read-only; not sold or used for ads; shared with the AI provider only as a sleep summary after consent, now disclosed |

**Overall:** the product is technically ready for an internal TestFlight build as soon as a site is deployed and the Apple account exists; it is **not** ready for commercial release until E.1 items 3–6 are done and the legal reviews in E.4 have been carried out.
