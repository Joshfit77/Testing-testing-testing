# Engineering engagement agenda (AI-assisted)

**Model:** Claude is the primary engineer. It has implemented every code change it can make without a phone, an
account or a hosted service:

- all 20 open items (O-01 to O-20), each with a regression test;
- a third round (T-01 to T-26 in BUG_FIX_REGISTER.md), including:
  - native Swift and Java GPS persistence;
  - route clean-up on sign-out and deletion;
  - billing at volume;
  - photo limits that hold without storage triggers;
  - the fixes from five independent reviews.

The consultants:

- **direct** Claude with the prompts in `ISSUE_PROMPTS.md`;
- **bring back the evidence** only a person with devices and accounts can produce;
- **review** Claude's diffs.

Consultants write code only where review shows Claude can't.

**Rate:** $385/hour. **Before the first session:** the consultant runs `npm run setup` and `npm run verify` (about 20
minutes, mostly unattended) and reads CLAUDE.md and `docs/production-consolidation/MASTER_ENGINEERING_REPORT.md`.

## What the consultants are for

| Needs a person because… | Work |
|---|---|
| Only hardware shows it | Locked-screen GPS, HealthKit permission sheets, notification sound under Silent/Focus, keyboard and safe areas, Android edge-to-edge |
| Only real accounts can do it | Signing, TestFlight upload, App Store Connect products and privacy label, sandbox purchases, Stripe test mode, RevenueCat settings |
| Only a hosted service can confirm it | `supabase db push` to staging (storage-trigger privilege), cron jobs, load with real network latency |
| Independent judgement | A second pair of eyes on security- and money-critical diffs before merge |

## Agenda (prioritised; tracks run in parallel)

| Order | Item | Track | Depends on | Consultant role | Claude role | Hours | Blocks |
|---|---|---|---|---|---|---|---|
| 0 | Kickoff: walk the baseline, accounts and access, agree the order | all | setup done | Lead | Answers questions about the code from the repo | 1–1.5 | — |
| 1 | **R-05** independent review of the consolidation PR (prompt P-09): security, payments, and the new native code (about 600 lines of Swift and Java) | A (no device) | — | Security + payments reviewer: read the findings, accept or reject each, review the native recorder | Runs the specialist agents, writes findings with traced paths, implements accepted fixes with tests | 5–7 | Merge |
| 2 | **R-03** staging database deploy (085 → 098), `db:verify`, cron jobs, staging load test including writes (P-03, P-04) | A | Owner: staging Supabase + hosting | Runs the commands Claude prepares in their shell; reads dashboards | Prepares and interprets everything; extends the load test; fixes anything found | 2.5–4 | Launch |
| 3 | **R-04** release engineering: signing, TestFlight build, App Store Connect record, privacy label (P-08) | B (accounts) | Owner: Apple Developer access | Operates Xcode / App Store Connect | Checks configuration, writes the checklists, fixes build issues | 3–5 | TestFlight |
| 4 | **R-01** iPhone device pass, IPHONE_DEVICE_TESTING.md (41 tests, including the native journal, notification taps mid-run, alarm slot and sign-out clean-up), then the O-02 wording (P-01, P-02) | B | Item 3 | Runs or supervises the tests (one includes a 30-minute outdoor run) and records evidence | Triages every failure to a root cause, fixes it with a test, updates the checklist | 7–11 | Launch, paid |
| 5 | **R-02** payments: App Store sandbox purchase, restore, transfer; Stripe test mode on staging (P-05, P-06) | C (accounts) | Items 2 and 3 | Performs purchases, refunds and portal changes | Gives the expected database state after each step, compares, fixes differences with tests | 3–5 | Paid |
| 6 | Universal links activation (P-07) | B | Owner: Team ID, Associated Domains, domain | Confirms the Apple capability, checks on a phone | Runs the script, verifies `.well-known` responses, updates device test 3 | inside item 4 | — |
| 7 | **R-06** Android device pass and Play Console (P-10), including permission-first and the native journal | D (optional) | APK workflow | Runs ANDROID_DEVICE_TESTING.md | Triage and fixes | 3.5–5.5 | Android launch |
| 8 | **R-07** contingency for defects the above find | — | — | Reviews Claude's fixes, re-runs the device test | Implements | 4–8 | — |

**Parallel from day 1:** track A (items 1, 2) needs no device. Track B starts once the owner grants Apple access.
Track C starts when staging and a TestFlight build exist. Track D is independent. With two consultants (one
security/payments, one mobile), the calendar time is about one week, limited mainly by Apple processing and device
testing.

### Why each item needs a person

| Item | Why Claude can't do it |
|---|---|
| 0 Kickoff | Granting account access and choosing priorities are the owner's decisions |
| 1 R-05 review | The reviews so far were Claude's own agents reviewing Claude's code. Money- and security-critical code needs an accountable human reviewer before merge |
| 2 R-03 staging | Needs the staging project's credentials and the owner's approval to change a hosted database. Claude prepares every command and reads the results |
| 3 R-04 release | Signing certificates, the Apple Developer account, Xcode with the owner's Apple ID, and App Store Connect are not available to Claude |
| 4 R-01 iPhone | Locked-screen GPS, permission sheets, notification sound, keyboard and safe areas only show on a real iPhone. The native recorder compiles and its store is unit-tested; its behaviour with iOS suspending the app can't be simulated |
| 5 R-02 payments | Sandbox purchases need a sandbox Apple ID on a device; Stripe test mode needs the owner's test keys on staging |
| 7 R-06 Android | A physical Android device and the Play Console account |
| 8 R-07 | Depends on what the device and account passes find; Claude writes the fixes, a person re-runs them on the device |

## Hours and cost (remaining work only)

| Scope | Consultant hours | At $385/h |
|---|---|---|
| **iOS launch with paid subscriptions** (items 0–6 and 8) | **25.5–41.5** | **$9,818–$15,978** |
| Plus Android (item 7) | 29–47 | $11,165–$18,095 |

### How this was recalculated

- **The original 45–90 hours** (launch minimum, with consultants writing the fixes) are no longer needed: that code
  is written and tested, now including the native Swift/Java recorder, billing at volume and trigger-free quotas.
- **The previous estimate (24–41 h)** was for verification and review only. It changes by item:
  - **R-05:** up 1 hour (4–6 → 5–7): there is more to review (native code, migrations 096–098).
  - **R-01:** up 1 hour (6–10 → 7–11): 5 more device tests for the native behaviour.
  - **R-06:** up 0.5 hours (3–5 → 3.5–5.5): 2 more Android tests.
  - **R-03:** down 0.5–1 hour (3–5 → 2.5–4): the storage-trigger question can no longer block a deploy.
  - **Every other item:** unchanged.
- **Net: the remaining hours rise slightly.** This round added code that a person must check on a device and review,
  and none of it can be verified without them. The estimate was not lowered to look better.

### Why they aren't lower

- Device testing takes real time: a 30-minute outdoor run, permission flows on fresh installs, overnight alarm and
  reminder checks.
- App Store Connect and TestFlight processing involve waiting.
- Sandbox purchase flows run step by step.
- The range's upper end assumes a few device-only defects (item 8), which is normal for a first native build.

**Not included:**

- the founder's own time (accounts, legal review, beta testers);
- Apple review time;
- an optional external penetration test.

## Working agreement

- Claude works on feature branches from the baseline and opens PRs; nothing merges into `main`, deploys, uploads or
  goes live without the owner's explicit approval.
- Every change: a test that fails without it, `npm run verify` green, iOS/Android workflows green for native changes.
- Device and sandbox results go into the checklists with date, device and build; nothing is marked passed without
  evidence.
- Keys go into hosting settings or GitHub secrets, never into chat or commits.
