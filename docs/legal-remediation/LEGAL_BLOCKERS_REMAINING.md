# Legal blockers remaining

Date: 2026-11-16. Branch: `claude/legal-remediation`. What still stands between the app and each launch stage after
the remediation work. Nothing here has been resolved by code alone; each item names who must act. Not legal advice.

## Blocks private TestFlight

| # | Blocker | Who | Detail |
|---|---|---|---|
| T1 | No support or feedback email | Founder | TestFlight requires one; it must also appear in the app (`FOUNDER_ACTION_ITEMS.md`, F1) |
| T2 | Apple Developer account, app record, hosted staging, signed build | Founder | An individual account is permitted; a company is not required |
| T3 | No pass on a physical iPhone | Founder | Device plan in `docs/release/IPHONE_PLAN_2026-11-15.md` |
| T4 | Offline fix not yet on the release candidate | Founder approval | Ready on `claude/rc-offline-fix` |
| T5 | Corrections on `claude/legal-remediation` not yet on the release candidate | Founder approval | Includes the health-data permission and the statement corrections |

Sensible but not strictly blocking for a closed test: counsel's view on testers accepting the draft legal pages; the
asset-origin answers for the badges and the clip.

## Blocks a public Free launch (in addition to the above)

| # | Blocker | Who |
|---|---|---|
| P1 | Final Terms of Service and Privacy Policy: 76 facts to supply, 34 open decisions, 66 attorney notes (`docs/legal/REMAINING_INFORMATION_NEEDED.md`) | Founder + privacy/technology attorney |
| P2 | Trademark search on official registers and a decision on the name, tagline, "Nutrition Score", the Nutri-Score display and "Food IQ" (`TRADEMARK_ATTORNEY_PACKAGE.md`) | Trademark attorney |
| P3 | Ownership records for the 27 badge images and the supplied dumbbell-curl clip, or their replacement or exclusion (`ASSET_OWNERSHIP_MANIFEST.md`) | Founder |
| P4 | Founder's record of authorship and AI-tool use; any co-founder or contractor assignments (`INVESTOR_IP_OWNERSHIP_CHECKLIST.md`) | Founder + counsel |
| P5 | Open Food Facts: what storing its records in the app's tables requires under its database licence (`THIRD_PARTY_LICENSES.md`) | Counsel |
| P6 | Approval of the 27 legally consequential wording changes and the health-data permission wording | Founder + counsel |
| P7 | Professional review of the AI coach's safety rules, the programs, supplement notes and exercise demonstrations; theological review of the commentary | Founder (engage reviewers) |
| P8 | Retention periods, age handling, geographic availability, consent records | Founder + counsel |
| P9 | AI provider contract terms (retention, training, deletion) and other processor agreements | Founder + counsel |
| P10 | Store setup: listing, privacy label, Data safety, health declarations, age rating, review notes and demo account, support and deletion URLs (`APP_STORE_COMPLIANCE_CHECKLIST.md`, section 4) | Founder |
| P11 | Full device testing on iPhone and Android | Founder |
| P12 | Patent counsel's view on the features in `PATENT_COUNSEL_PACKAGE.md` (claims never obtained) | Patent counsel |

## Blocks paid subscriptions (in addition to the above)

| # | Blocker | Who |
|---|---|---|
| S1 | Store products created at $17.99 monthly and $119.99 yearly; paid apps agreement, tax and banking | Founder |
| S2 | Purchase, restore, cancel, refund and expiry run end to end in the sandbox | Founder (device) |
| S3 | Subscription and auto-renewal disclosures reviewed against federal and state law | Counsel |
| S4 | Live AI quality and cost measured under a spending cap | Founder (staging key) |

## Blocks investment

Entity, operating agreement, cap table and IP assignment; account ownership (domains, developer accounts, GitHub,
service accounts); the AI-use record; counsel's trademark and patent views; insurance
(`INVESTOR_IP_OWNERSHIP_CHECKLIST.md`).

## Blocks switching Friends & Challenges on (kept off)

Legal text for sharing between members; a moderation process with response times and a staff suspend tool; username
screening; age handling; owner and counsel decision on sharing defaults
(`docs/legal/MODERATION_AND_USER_CONTENT_POLICY_DRAFT.md`; `docs/legal-audit-2026-11-16/08_FRIENDS_PRIVACY_AUDIT.md`,
status section).

## Cannot be verified from this environment

Official trademark and patent records (blocked); Google Play policy pages (blocked); anything on a physical device or
in a store console; the hosted environment; contracts and account ownership.
