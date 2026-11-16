# 1. Executive legal risk summary

Date: 2026-11-16. Not legal advice; see `README.md` for the limits of this audit.

## The position in one paragraph

The software is in good technical order, and its access controls hold up under test. The business is not yet in a
position to launch publicly or take investment. The legal drafts name no operating party or contact, ownership of the
code and artwork is not yet documented, the brand has not been searched, and no final Terms or Privacy Policy. Several statements shown to members
contradict what the code does. Two data-licensing and health-data questions need a lawyer's decision. None of the
trademark or patent research in this package, or in the earlier reports, was done against an official register,
because none could be reached.

## Critical and high findings

| # | Finding | Severity | Confirmed? | Detail in | Counsel decides | Blocks public launch |
|---|---|---|---|---|---|---|
| E1 | No official trademark register has been searched, in this audit or the earlier ones. Every trademark fact is from mirror sites or search summaries | Critical | Confirmed | 02 (F-01) | Y | Y (counsel) |
| E2 | Other "Narrow Gate" fitness businesses appear to be operating (Narrow Gate Strength & Conditioning; Narrow Gate Club, Greensboro NC, faith, fitness and nutrition) | High | Suspected (secondary sources) | 02 (F-02) | Y | Counsel |
| E3 | No patent claim text was obtained for any patent; all claim charts are provisional. Features counsel should look at first: adaptive training and coach proposals (Fitbod family), Body Scan (Amazon), sleep (Oura), food matching and meal photos | High | Confirmed (the limit); suspected (relevance) | 03 (P1–P8) | Y | Counsel |
| E4 | No operating party (individual or company), address or contact is named in the legal drafts; they say the owner is an individual. Members currently accept placeholder legal pages (version recorded as `2026-10-26-placeholder`); the drafts have 111 bracketed blanks and 17 open owner decisions, and do not cover sharing between members | High | Confirmed | 07, 09, 11 | Y | Y |
| E5 | Ownership is undocumented: the visible commits are authored by an AI assistant at the founder's direction, and no record of that direction, of the tool terms, or of any assignment, contractor agreement, licence receipt or release is in the repository. This does not mean ownership is lacking; it means it is not yet evidenced (file 11) | High | Confirmed (what the repo shows) | 04, 11 | Y | Counsel; blocks investment diligence |
| E6 | Badge artwork (27 images) is cropped from three phone screenshots with no creator, tool or licence record | High | Confirmed (no record); suspected (AI-generated) | 04 | Y | Counsel |
| E7 | Open Food Facts product data is saved into the app's own food tables and mixed with other data; two code comments said otherwise (now corrected). Whether the database licence's share-alike terms apply is undecided | High | Confirmed (the storage) | 05 | Y | Counsel |
| E8 | Apple Health / Health Connect data (steps, sleep) can reach the AI provider through the coach, after the member's AI consent. Both platforms restrict sharing of health data | Medium–High | Confirmed (the flow) | 05, 06, 09 | Y | Counsel |
| E9 | Statements to members that contradict the code: onboarding says body details are "Never shared" (they go to the AI provider after consent); "complete Faith section, always free" (the AI Bible helper is Pro); Body Scan says photos go to no "other company or service" (they are held by the storage provider); the AI consent card omits several things actually sent | High | Confirmed | 10, 06, 07 | Y (wording) | Y |
| E10 | The AI coach's safety, pain, nutrition and supplement rules, the programs and the exercise animations have had no licensed-professional review | High | Confirmed | 10 | Partly | Counsel |
| E11 | No support or contact address, no reviewer demo account, no store listing; in-app purchase never run against the stores; nothing tested on a physical device | High | Confirmed | 09 | N | Y (paid: Y) |
| E12 | Nothing is deleted on a schedule and no retention period is decided; the age gate is an unrecorded checkbox; no under-13 handling; no geographic restriction | Medium | Confirmed | 06 | Y | Counsel |
| E13 | Friends (switched off): no username filter, no moderation process or response time, no staff suspend tool; sharing defaults on; five privacy switches do nothing yet; a block and a decline can each be inferred | Medium (High if switched on) | Confirmed | 08, 09 | Partly | Blocks switching Friends on |

## What held up

- No member can read another member's private rows. The isolation sweep, the Friends tests and the callable-function
  allow-list pass (see `14_EVIDENCE_APPENDIX.md` for the runs).
- With Friends on, no health, faith, photo, nutrition or AI data crosses between members; a friend sees a name, a
  username and, if shared, workout counts and streaks.
- Body Scan captures and stores photographs; no image analysis and no biometric identifier or template was found in
  the code (files 03 and 06).
- No GPL or AGPL software was found. The Scripture text is the Berean Standard Bible (public-domain dedication per the
  repository's records; the publisher's page could not be reached to re-confirm).
- No testimonials, user counts, guarantees, body-fat estimates or competitor names were found in member-facing copy.
- Inside the native apps the web checkout is hidden and refused; Restore, Manage, renewal terms and in-app account
  deletion exist in code.

## Corrections made in this audit (low risk, no legal judgment)

See `12_REMEDIATION_PRIORITY_LIST.md`, part A. In short: a reporter can no longer read an administrator's note; the
database itself now limits username searches and invite-code guesses; a complete third-party licence file is generated
and linked from the Notices page, which now also covers the fonts and the health plugin's licence; two wrong code
comments and stale figures were corrected.

## Readiness assessment

| Stage | Assessment | What stands in the way |
|---|---|---|
| Internal development testing | **Ready** | Nothing found that prevents it |
| Private TestFlight (invited testers) | **Not ready; close** | A working support contact; corrected member-facing statements (file 15); a first pass on a physical iPhone; a decision on testers accepting draft Terms and Privacy pages. An individual Apple Developer account is permitted for TestFlight; a company is not required. See `19_TESTFLIGHT_CHECKLIST.md` |
| Public Free launch | **Not ready** | E1–E7, E9–E12: counsel's trademark search and decision, final Terms and Privacy Policy, entity and contacts, asset ownership records, the Open Food Facts and health-data decisions, device testing, store listing and reviewer account, professional review of safety content |
| Paid subscription launch | **Not ready** | Everything above, plus store products created and purchase, restore, cancel and refund run end to end; subscription disclosures reviewed against auto-renewal law; live AI cost and quality measured |
| Trademark filing | **Not ready** | No official search, no owner entity, no use in commerce yet. Counsel can advise on an intent-to-use filing once the search is done |
| Investor due diligence | **Not ready** | E4, E5, E6 and the checklist in file 11: a documented owner, the founder's authorship record, account ownership, counsel's trademark and patent review |

No item in this package is an all-clear. Where the audit found nothing, that means nothing was found by the methods
and within the access described, not that nothing exists.

## What cannot be verified from GitHub alone

Entity and ownership documents; domain, developer-account and service-account ownership; processor contracts and the
AI provider's retention terms; the hosted (production) configuration; official trademark and patent records; anything
that needs a physical phone or a store console; the identity of the people behind the AI-authored commits; the
contents of the hosted media storage; the full commit history (this checkout is shallow).
