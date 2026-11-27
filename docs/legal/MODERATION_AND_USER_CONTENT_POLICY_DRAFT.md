# Narrow Gate Fitness — Moderation and User Content Policy (DRAFT)

Version: [DRAFT 2026-11-16]
Effective date: [EFFECTIVE DATE — set when published]

> **DRAFT FOR ATTORNEY REVIEW — NOT LEGAL ADVICE, NOT REVIEWED BY AN ATTORNEY AND NOT IN FORCE.** This document was written on 2026-11-16 by a non-lawyer as drafting support. It applies only to the **Friends** feature, which is **switched off** and whose code is not part of the current release. **Challenges between members have not been built.** Nothing here is a commitment to members. Every review time, response time, retention period and enforcement step is left as **[OWNER DECISION]**: none has been decided and none is invented here. It does not state or imply that the service complies with any law or store rule. Facts come from `docs/legal-audit-2026-11-16/08_FRIENDS_PRIVACY_AUDIT.md` and `09_STORE_COMPLIANCE_CHECKLIST.md`; the audit read the Friends code on branch `claude/friends-challenges`, not a hosted system.

---

## 1. Scope

This policy would cover what one member can cause another member to see, and how [LEGAL ENTITY NAME] ("**we**") handles reports about it. It does not cover content that stays private to one account (logs, photos, journals, AI conversations): no other member can see those.

A second switched-off feature, Accountability partners, shares a display name, workout figures and fixed encouragement messages between two members. It is not covered by the reporting tools described here unless a member reports the partner through Friends. [OWNER DECISION: whether this policy also governs Accountability partners.]

## 2. What members can create that others see

| Item | Who sees it | Limits in the code |
|---|---|---|
| **Username** | Any member who searches (unless "searchable" is off); friends; members with a pending request to or from you; administrators reviewing a report | 3 to 20 characters. A list of reserved staff-like names is refused. One change every 30 days. **No screening for offensive words** |
| **Display name** (the name given at sign-up) | Friends only. Always shown to friends; no switch hides it | Up to 60 characters, free text, not unique. **Not screened at all**, including for staff-like names |
| Workout count for the last 7 days; day and week streaks | Friends, while the member's "show workouts" switch is on | Numbers only, calculated by the Service |

**There is no free text between members.** No chat, comments, captions, photos, posts or activity feed exist. Friend requests carry no message.

**Report details** (a reason, and up to 500 characters of free text) are written by members but go **to administrators only**. The reported member never sees them and is not told who reported them.

## 3. Prohibited usernames, display names and conduct — [DRAFT FOR ATTORNEY REVIEW]

These rules mirror the draft Terms of Service, Section 13.1. Neither is in force.

A username or display name must not:
- impersonate another person, or suggest the member is Narrow Gate Fitness staff, support or an administrator;
- contain hateful, harassing, sexually explicit, threatening or unlawful words;
- contain another person's personal information, or contact details meant to move a conversation elsewhere;
- advertise or promote a product or service.

A member must not:
- send repeated friend requests to someone who has not accepted;
- use search, requests, invite links, blocks or reports to harass, stalk or pressure another member;
- file false or repeated reports;
- use Friends to contact anyone they believe is under 18;
- try to get around a block, for example with a second account.

[ATTORNEY REVIEW: confirm the list, and whether further categories are needed for Apple guideline 1.2 and Google Play's user-generated-content policy.]

## 4. How a member reports and blocks

**Report.** From a member's entry in Friends, choose Report, pick a reason and optionally add up to 500 characters. Limits in code: 5 reports per reporter per 24 hours; one open report per pair of members. Reporting works even while Friends is switched off.

**Block.** From a member's entry in Friends, choose Block. Blocking:
- removes the friendship and closes pending requests between the two members;
- ends an active accountability partnership between them;
- hides each from the other's search.

The blocked member is **not told**. They may still be able to work out that they were blocked. This policy must not promise otherwise. Unblocking removes the block only; it does not restore the friendship.

**Outside the app.** [SUPPORT EMAIL] — no support or contact address exists anywhere in the app today.

## 5. What administrators can see and do today

**See, in the app:**
- a reports list: reporter and reported member (account IDs and usernames), reason, details, status, internal note, times, and the number of open reports about the reported member;
- the last 15 entries of the administrator audit log.

Administrators **cannot** see, through the app: Friends profiles and settings, friendships, friend requests, blocks or invite links; or any member's health, food, faith, photo, location or AI data.

**Do, in the app:**
- close a report (set its status) and add an internal note. Closing is written to the audit log; reading reports is not logged.

**There is NO in-app tool to:** suspend or ban a member; restrict a member's use of Friends; change or remove a username or display name; remove a friendship; warn a member; or tell the reporter the outcome. Any such action would today have to be made directly in the database provider's console, where it leaves no record in the app.

**Known defect to fix first:** a reporter can read the administrators' internal note on their own report through the database interface and in their data export (audit F-05).

## 6. Review and response-time commitments — proposed, not decided

| Step | Commitment |
|---|---|
| Who reviews reports | [OWNER DECISION: named role or roles] |
| How an administrator learns of a new report (no alert exists today) | [OWNER DECISION: alert method] |
| Time to first review of a report | [OWNER DECISION: review time] |
| Time to first review of a report that describes a threat, self-harm, a crime or a suspected minor | [OWNER DECISION: urgent review time] |
| Time to act once a breach is confirmed | [OWNER DECISION: response time] |
| Whether the reporter is told the outcome, and how | [OWNER DECISION] |
| Whether the reported member is told a report was made or an action taken, and how | [OWNER DECISION] |

[ATTORNEY REVIEW: Apple guideline 1.2 and Google Play's user-generated-content policy expect a way to report, a way to block, filtering of objectionable material, timely action and published contact information (audit file 09, rows A2–A3 and G8). Advise which commitments must be published and in what words.]

## 7. Enforcement steps — proposed, not decided

[OWNER DECISION: which steps will exist, and in what order.] A possible ladder, for counsel and the owner to accept, change or reject:

1. No action; close the report.
2. Require a change of username or display name.
3. Remove the friendship or restrict the member's use of Friends.
4. Suspend the account.
5. Close the account.

None of steps 2 to 5 can be done in the app today (Section 5). The draft Terms of Service, Section 18, is the contract basis for suspension and closure.

## 8. Escalation

- **Immediate danger.** A report that describes a threat to life or safety: [OWNER DECISION: who is contacted, and whether and when emergency services or law enforcement are contacted]. [ATTORNEY REVIEW]
- **Self-harm.** [OWNER DECISION] [ATTORNEY REVIEW]
- **Suspected minor.** The Service is for adults only. [OWNER DECISION: age policy — what happens to an account believed to belong to someone under 18.] [ATTORNEY REVIEW: including any reporting duty.]
- **Suspected crime, or a request from law enforcement.** [OWNER DECISION: who handles it] [ATTORNEY REVIEW: what may be disclosed, and on what legal process.]
- **A report about an administrator.** [OWNER DECISION]

## 9. Records and retention

**As built:**
- Reports are never deleted on a schedule.
- A report is deleted when **either** the reporter's or the reported member's account is deleted. Evidence of harassment is lost that way, and nothing prevents the person from signing up again.
- The audit log keeps the report ID and status after the report itself is gone.
- No record is kept of any action taken on an account outside the app.

**To decide:**
- Retention period for open and closed reports: [OWNER DECISION: retention period].
- Whether reports should survive deletion of either account, and for how long: [OWNER DECISION: retention period] [ATTORNEY REVIEW].
- Retention of the record of enforcement actions: [OWNER DECISION: retention period].
- Whether a report about a member, and requests they sent that were declined, must be given to that member on an access request: [ATTORNEY REVIEW] (audit F-11).

## 10. Appeal

No appeal process exists. [DRAFT FOR ATTORNEY REVIEW — proposed outline only: a member whose name was changed, whose use of Friends was restricted, or whose account was suspended or closed may ask for a review by writing to [SUPPORT EMAIL] within [OWNER DECISION: appeal window]; a person who did not make the original decision reviews it within [OWNER DECISION: appeal response time]; the member is told the result.] [OWNER DECISION: whether a second reviewer is available.]

## 11. Operational gaps to close before Friends is switched on

| # | Gap | Source |
|---|---|---|
| 1 | The Privacy Policy and Terms must cover sharing between members and be accepted by members | F-01 |
| 2 | No screening of usernames for offensive words; no screening of display names at all | F-20; file 09 |
| 3 | No in-app tool to suspend a member, restrict Friends, or change a name; no record of actions taken | F-06; file 09 |
| 4 | No alert to staff when a report is filed | file 09 |
| 5 | No published support or contact address | file 09 |
| 6 | No review or response-time commitment (Section 6) | file 09 |
| 7 | No retention period for reports; reports vanish when either account is deleted (Section 9) | F-06 |
| 8 | A reporter can read the administrators' internal note | F-05 |
| 9 | Username search and invite-code attempts are rate-limited only in the app layer, so usernames and account IDs can be listed by calling the database interface directly | F-02, F-08 |
| 10 | Sharing is on by default once a request is accepted; the display name is always shown and the join screen does not say so | F-07 |
| 11 | Five privacy switches (records, body, nutrition, faith, leaderboards) are shown but do nothing | F-09 |
| 12 | A member cannot leave Friends without deleting the whole account | F-10 |
| 13 | An invite link makes the holder a friend at once, and the invitee does not see who invited them | F-08 |
| 14 | Any single administrator can switch the feature on; there is no second approval | F-19 |
| 15 | Nothing specific to minors beyond the sign-up age box and the onboarding age field | F-20 |
| 16 | No appeal process (Section 10) and no escalation procedure (Section 8) | — |
| 17 | Who holds the administrator role and database-console access in production is not recorded | F-22 |

## 12. Contact

[LEGAL ENTITY NAME] · [SUPPORT EMAIL]
