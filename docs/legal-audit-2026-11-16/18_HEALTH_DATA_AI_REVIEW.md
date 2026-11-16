# 18. Apple Health and Health Connect data: what reaches the AI provider

Date: 2026-11-16. From the code on `claude/friends-challenges` (identical on the release candidate for these files).
No real member data was read; this describes code paths only. Not legal advice.

## What the app reads from the health platforms

Read-only: steps, sleep (with stages), overnight heart rate, heart-rate variability and respiratory rate
(`ios/App/App/Info.plist:73-76`; Android manifest; file 09 rows A26 and G7). Nothing is written back. There is no
advertising or analytics software in the app.

## The three paths to the AI provider

| # | Data | When it is sent | Code | Gate |
|---|---|---|---|---|
| H1 | The last 7 days of step counts, whatever their source (typed in, Apple Health or Health Connect) | With **every** coach message, as part of the standard context | `src/server/coach/snapshot.ts:170, 276` | AI consent (`ai_data_consent_at`, checked at `src/server/services/ai-coach.ts:469-470`) |
| H2 | A sleep summary: nights, averages, sleep debt, check-in patterns; and for nights a watch or ring recorded, stage shares, overnight heart rate, heart-rate variability, breathing rate and **the device's name** | Only when the model asks for it (the member asked about sleep or recovery) | `src/server/coach/sleep-summary.ts:17-73, 82-123`; tool at `src/server/coach/tools.ts:600-601` | AI consent, and the separate wellness consent (`wellness_consent_at`, `sleep-summary.ts:19-22`) |
| H3 | Weekly report figures, which include sleep totals and may include recorded stages | When the weekly report is generated for a Pro member | `src/lib/domain/weekly-report.ts:69, 106-109`; `src/server/services/weekly-reports.ts:138` | AI consent (to be confirmed for the scheduled path: see file 06) |

The consent card does tell the member about H1 and H2: "Bodyweight, steps and recovery check-ins" and "a summary of
your sleep, including nights your watch or ring recorded through Apple Health or Health Connect (time asleep, stages,
overnight heart rate, heart-rate variability and breathing rate)" (`src/components/coach/ai-consent-card.tsx:40-44`).

## What is questionable

| # | Point | Why it matters | Confirmed? |
|---|---|---|---|
| Q1 | One general AI consent covers health-platform data along with everything else | Apple's rule 5.1.2(i) asks for clear disclosure and explicit permission before personal data goes to third-party AI; rule 5.1.3(i) and Google's Health Connect policy restrict use and disclosure of platform health data. The disclosure exists; whether a single bundled consent is enough for platform health data is a policy reading for counsel | Confirmed flow; open question |
| Q2 | Steps go with every message, needed or not | Data minimisation: the coach rarely needs step counts to answer | Confirmed |
| Q3 | The wearable's **device name** is sent (`sleep-summary.ts:58, 106, 109`) | Device names often contain a person's real name ("Jordan's Apple Watch"). It adds nothing to the advice | Confirmed |
| Q4 | Heart-rate variability, overnight heart rate and breathing rate are sent | These are the most health-like values in the app. Washington's and Nevada's consumer-health-data laws require specific consent for collecting and sharing such data | Confirmed flow; open question |
| Q5 | The provider's terms were not verified | Whether the AI provider retains the data, for how long, and whether it may train on it depends on the account's contract. No contract is in the repository | Not verifiable from the repository |
| Q6 | Withdrawal | Turning AI consent off stops future sending. It cannot recall what was already sent | Confirmed |

Nothing was found going to advertising, analytics or any other member.

## Options

| Option | What changes | Effect on members | Risk left |
|---|---|---|---|
| **A. Never send platform health data to the AI provider** | Steps: send only typed-in steps (`source = 'manual'`). Sleep: leave wearable-recorded stages and vitals out of the summary; keep hand-logged nights and check-ins. Never send the device name | The coach cannot discuss watch-recorded sleep or imported steps; it says so honestly | Lowest. Hand-entered data still goes, under the general consent |
| **B. A separate, explicit switch, off by default** | A new setting, "Share Apple Health / Health Connect data with the AI Coach", recorded with its own timestamp. The code behaves as option A unless it is on. The switch names the provider and each value. Device name never sent | Members who want it turn it on | Low. Depends on the wording and on the provider's terms |
| C. Keep as is | Nothing | — | Rests on the bundled consent being judged sufficient |

**Recommendation:** ship option **A** as the default behaviour now, and add the option **B** switch once counsel has
approved its wording and the provider's terms have been checked. That is the safest position that keeps the feature
available later. Three parts are safe under any option and can be done first:

1. Stop sending the device name (Q3).
2. Send steps only when the member asks about activity, not with every message (Q2).
3. Add the missing lines to the consent card once approved (file 15, B4).

None of this has been implemented: it changes what the coach can see, so it waits for the owner's decision.

## Questions for counsel

1. Is a general AI consent enough for HealthKit and Health Connect data under Apple rule 5.1.3 and Google's Health
   Connect policy, or is a separate permission needed?
2. Do Washington's My Health My Data Act and Nevada's equivalent require a separate consent, or an authorisation, for
   sending heart-rate, HRV, breathing and sleep data to the AI provider?
3. What must the contract with the AI provider say (no training on member data, retention period, deletion on request,
   sub-processors), and is the current account on those terms?
4. Does the Privacy Policy need to name each value sent?
