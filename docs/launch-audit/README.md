# Launch audit (2026-10-25)

Technical, patent-research, trademark-research, security/privacy and Apple-readiness review of Narrow Gate Fitness before its first commercial release. Prepared as engineering research for the owner and their lawyers; **nothing in this folder is a legal opinion, and no name, feature or document is "cleared" by it.**

| File | What it is |
|---|---|
| `A_FEATURE_CLASSIFICATION.md` | Every feature with GREEN / YELLOW / RED / NOT PRESENT, verified behaviour, file paths, action and what is still uncertain. No feature is RED; nothing was removed. |
| `B_PATENT_CLAIM_CHARTS.md` | The six named patents (status, element-by-element comparison with code citations, questions for counsel) and a table of further patents found. Claim text could not be retrieved from the sandbox; charts are paraphrases to be re-run against the PDFs. |
| `C_TRADEMARKS.md` | FOOD IQ (Reg. 4,337,059), "Nutrition Score", NARROW GATE FITNESS, feature names, Scripture licensing; remaining clearance questions. |
| `D_CODE_CHANGES_AND_TESTS.md` | What this branch changed (before/after), tests added, test results, remaining bugs, pull request. |
| `E_LAUNCH_READINESS.md` | Critical blockers, high-priority improvements, optional work, outstanding legal reviews, device testing, subscription and privacy readiness. |
| `SECURITY_PRIVACY.md` | Findings (with fixes), RLS table, storage, API/auth, deletion and export, AI data flows, secrets, data-flow inventory, legal-page gap list. |
| `APPLE_COMPLIANCE.md` | App Store / TestFlight requirement-by-requirement status with evidence (Part 12). |
| `IOS_DEVICE_TEST_PLAN.md` | What to try on a physical iPhone (Health, GPS, camera, notifications, purchases, account), with the code each step exercises. |
| `ANDROID_READINESS.md` (on `claude/android-hardening`, PR #4) | Android backup rules, Health Connect permissions, plugin wiring, Play Billing readiness, device test list. |

Related, already in the repository: `docs/TESTFLIGHT.md` (upload steps), `docs/MOBILE_BILLING.md` (in-app purchases), `docs/LEGAL_REQUIREMENTS.md` (inventory for counsel, corrected), `docs/FOOD_IQ_METHOD.md` (the nutrition formula; public name now "Nutrition Score"), `docs/SCRIPTURE.md`, `docs/SECURITY.md`.

Branch: `claude/launch-audit` (from `claude/testflight-prep`; `main` is outdated). Not merged; nothing deployed, uploaded or billed.
