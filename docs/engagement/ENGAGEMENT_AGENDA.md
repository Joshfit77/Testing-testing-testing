# Engineering engagement agenda (AI-assisted)

**Model:** Claude is the primary engineer. It has implemented every code change it can make without a phone, an
account or a hosted service:

- all 20 items that were open (O-01 to O-20), each with a regression test;
- a third round (T-01 to T-31 in BUG_FIX_REGISTER.md), including:
  - native Swift and Java GPS persistence;
  - route clean-up on sign-out and deletion;
  - billing at volume;
  - photo limits that hold without storage triggers;
  - the fixes from five independent reviews.

**Who does what (restructured to minimise consultant hours):**

- **The founders** do the operational work, guided step by step by Claude: device testing, account and store
  configuration, sandbox payments, the staging commands and the TestFlight workflow (FOUNDER_TASKS.md).
- **Claude** keeps doing all the engineering: it prepares every step, reads every result, finds the root cause of
  every failure, writes the fix with a test, and updates the checklists.
- **Consultants** only do what needs independent engineering judgement: the independent review before merge, and a
  review of the fixes that come out of the founders' tests. A small reserve covers problems Claude and the founders
  can't solve within a day.

**Rate:** $385/hour. **Before the first session:** the consultant reads CLAUDE.md,
`docs/production-consolidation/MASTER_ENGINEERING_REPORT.md` and this agenda, and runs `npm run setup` and
`npm run verify` (about 20 minutes, mostly unattended).

## Agenda (prioritised; tracks run in parallel)

| Order | Item | Who | Depends on | Claude's role | Consultant hours | Blocks |
|---|---|---|---|---|---|---|
| F-1 | Accounts and settings (Apple, App Store Connect, RevenueCat, Stripe test mode, staging Supabase, hosting, GitHub protections, Turnstile) | Founders | — | Exact checklist; checks every setting from screenshots | 0 | Everything below |
| F-2 | **R-03** staging deploy (085 → 099), `db:verify`, cron jobs, staging load test | Founders run the commands | F-1 | Prepares and interprets everything; fixes anything found with tests | 0 | Launch |
| F-3 | **R-04** TestFlight build through the iOS workflow, install | Founders | F-1 | Walks through the guide, reads the logs, fixes build issues | 0 | TestFlight |
| F-4 | **R-01** iPhone device pass (42 tests), then the O-02 wording | Founders | F-3 | Triages each failure to a root cause, fixes it with a test, says what to re-test | 0 | Launch, paid |
| F-5 | **R-02** App Store sandbox and Stripe test-mode payments | Founders | F-1, F-3 | Gives the expected database state for each step, compares, fixes differences | 0 | Paid |
| F-6 | Universal links activation | Founders | F-1 | Runs the script, checks `.well-known` | 0 | — |
| F-7 | **R-06** Android device pass (optional) | Founders | APK workflow | As F-4 | 0 | Android launch |
| C-1 | Orientation: read the reports, run setup and verify | Consultant | — | Answers questions from the repo | 0.5–1 | — |
| C-2 | **R-05** independent review of the consolidation PR (P-09): security, payments, and the native code (about 600 lines of Swift and Java) | Consultant (security/payments, with native experience) | — | Runs the specialist agents, writes findings with traced paths, implements accepted fixes with tests | 5–7 | Merge |
| C-3 | **R-07** review of Claude's fixes for defects the founders find (device, sandbox, staging) | Consultant | F-2..F-5 | Implements every fix with a test | 2–4 | Merge of those fixes |
| C-4 | Escalation reserve: hands-on help only if Claude and the founders can't resolve something within one working day (Xcode signing, a device behaviour Claude can't reproduce, an App Review rejection) | Consultant | as needed | Prepares the facts and a proposed fix | 0–4 (only if used) | — |

**Parallel from day 1:** C-1 and C-2 need no device or account and start at once. F-1 starts at once too. F-2, F-3
and F-6 follow F-1; F-4 and F-5 follow F-3. C-3 runs as fixes arrive. Calendar time is about one week, limited by
Apple's processing and the device tests.

### Why each consultant item needs a consultant

| Item | Why Claude or the founders can't do it |
|---|---|
| C-2 independent review | So far Claude's own agents have reviewed Claude's code. Security- and money-critical code needs an accountable human engineer before merge, and the founders aren't engineers |
| C-3 review of fixes | Fixes for device-only defects change native and payment code; the same independence applies |
| C-4 reserve | A few problems (certificates, a platform behaviour seen only on one device) go faster with someone who has solved them before at a Mac. Kept small and used only when needed |

The founders' tasks need hands, accounts and phones rather than engineering judgement. Each one has exact expected
results written from the code, and Claude handles every failure, so a consultant adds little there.

## Hours and cost (remaining work only)

| Scope | Consultant hours | At $385/h |
|---|---|---|
| **iOS launch with paid subscriptions** (C-1 to C-3) | **7.5–12** | **$2,888–$4,620** |
| Including the escalation reserve, if fully used (C-4) | up to 16 | up to $6,160 |
| Plus Android (more fixes for C-3 to review) | 8–13, up to 17 with the reserve | $3,080–$5,005, up to $6,545 |

**Founder time (not billed):** about 17–26 hours for the iOS launch with paid subscriptions, plus 3–5 for Android.
It is spread over about a week (FOUNDER_TASKS.md).

### How this was recalculated

- **The original 45–90 hours** assumed consultants would write the fixes. That code is written and tested.
- **The previous 25.5–41.5 hours** assumed consultants would also run the device, account, sandbox and staging work.
  Those items move to the founders, guided by Claude:
  - R-01: 7–11 h;
  - R-02: 3–5 h;
  - R-03: 2.5–4 h;
  - R-04: 3–5 h;
  - R-06: 3.5–5.5 h.
- **Kickoff** becomes a short orientation (1–1.5 → 0.5–1 h).
- **Contingency** becomes a review of Claude's fixes (R-07: 4–8 → 2–4 h), plus a reserve that is only used if needed
  (0–4 h).
- **R-05 stays at 5–7 hours.** The independent review is the one item where a consultant's judgement is the
  point, so it is not reduced.

### Why the hours aren't lower

- **The review:** an independent review of security-, payment- and native-critical code can't responsibly be done
  in less time.
- **Device defects:** a first native build usually produces a few device-only defects, and each fix needs review.
- **Founder time:** the founders' hours are real time, even though they aren't billed. If they can't give about 17–26
  hours over a week, move F-4 (device pass) back to a consultant at 7–11 hours.

**Not included:**

- legal review;
- Apple review time;
- an optional external penetration test.

## Working agreement

- Claude works on feature branches from the baseline and opens PRs; nothing merges into `main`, deploys, uploads or
  goes live without the owner's explicit approval.
- Every change: a test that fails without it, `npm run verify` green, iOS/Android workflows green for native changes.
- Device and sandbox results go into the checklists with date, device and build; nothing is marked passed without
  evidence.
- Keys go into hosting settings or GitHub secrets, never into chat or commits.
