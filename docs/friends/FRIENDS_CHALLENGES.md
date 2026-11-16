# Friends & Challenges

Branch `claude/friends-challenges`, cut from `release/testflight-rc-2026-11-15`. Not merged into the TestFlight branch
or `main`, not deployed. The whole feature sits behind the `friends_challenges` flag, which is inserted **off**: with
it off there is no entry point, the pages return 404, and the database refuses usernames, searches, requests and
invites.

Statuses: **VERIFIED** (run in this environment and passed), **NOT TESTED**. Environment: local Supabase in Docker,
Chromium at phone size. No physical phone.

## Owner decisions (2026-11-16)

1. Basic social features are Free: adding friends, invitations, basic accountability partnerships, encouragement,
   joining private challenges. Possible Pro extras are a proposal only (below); no entitlement is changed without
   approval.
2. In-app notification inbox now. Push is prepared for but not built or claimed until the native integrations are
   configured and tested.
3. Competitions are honour-based with server-side safeguards against duplicates, backdating and manipulation. Priority:
   workout consistency, running, steps from connected health sources, personal goals, completing programs. No contests
   on heaviest lift or most weight lost. Scoring is explained on screen.
4. Separate feature branch, flag off by default. No merge, no deploy.
5. Team challenges with shared goals (workouts together, miles together, a shared Bible reading challenge, shared
   consistency). Prayer requests, journals, nutrition detail and health information stay private.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Usernames, search, friend requests, friends list, remove, block, report (with an admin queue), privacy switches, friend profile, invite links | Built; see "Phase 1 verification" |
| 2 | Notification inbox (requests, accepted invitations, challenge invitations, milestones, results), per-type switches, a delivery seam for future push | Not started |
| 3 | Accountability partners inside Friends: weekly workout goal, on-track status, encouragement and nudges | Not started (the earlier partners feature, migration 067, exists behind its own flag) |
| 4 | Comparisons between friends, including same-exercise records | Not started |
| 5 | Challenges: head-to-head and team, scoring rules, standings, results | Not started |
| 6 | Activity feed with fixed reactions | Not started |
| 7 | Demo data, polish, full regression, screenshots | Not started |

## Phase 1: what was built

- **Database** (`supabase/migrations/20261116000076_friends_foundation.sql`, with its rollback at the top):
  `social_profiles`, `friend_requests`, `friendships`, `user_blocks`, `user_reports`, `friend_invites`. A member reads
  only their own rows. Everything that involves a second member goes through a database function that identifies the
  caller itself: `claim_username`, `search_users`, `send_friend_request`, `respond_friend_request`,
  `cancel_friend_request`, `remove_friend`, `block_user`, `unblock_user`, `report_user`, `accept_friend_invite`,
  `friends_overview`, `friend_profile`, and `admin_user_reports` for administrators.
- **Screens**: You > Friends (`/friends`), a friend's profile (`/friends/[id]`), Privacy & sharing
  (`/friends/privacy`), the invite landing (`/friends/invite/[code]`), and Admin > Reports (`/admin/reports`).
- **No free text between members.** The only text a member writes is the optional detail on a report, which goes to
  administrators.

### Rules

| Rule | Value |
|---|---|
| Username | 3 to 20 lower-case letters, digits, underscores; unique; names that pass for staff are refused; one change in 30 days |
| Search | By the start of a username, at least 3 characters, 10 results, 30 searches a minute; returns the username only |
| Display name | Shown between friends only |
| Friends | 200 per member |
| Requests | 20 per sender in 24 hours; one pending per pair; a declined request can't be repeated for 30 days and the decline isn't shown to the sender |
| Invite links | Single use, 7 days, 5 open at a time; opening one makes the two friends |
| Block | Ends the friendship, any pending request and any accountability partnership between the two; each disappears from the other's search; the blocked member is told nothing (requests look like "not found") |
| Reports | Fixed reasons, optional detail up to 500 characters, one open report per pair, 5 per reporter in 24 hours |
| With the flag off | Removing, blocking, unblocking, reporting, declining, withdrawing and switching sharing off still work |

### What a friend can see

| Switch | Default | Phase 1 effect |
|---|---|---|
| Show my profile to friends | On | Off: name and username only |
| Workouts and streak | On | Completed workouts in the last 7 days; day and week streaks |
| Personal records | Off | Stored; nothing is shown yet (phase 4) |
| Appear in friend rankings | On | Stored; used from phase 4 |
| Weight and body measurements | Off | Stored; **nothing is returned by any function in this phase** |
| Nutrition | Off | Stored; nothing is returned in this phase |
| Faith and discipline activity | Off | Stored; nothing is returned in this phase |
| Let people find me by username | On | Off: hidden from search (friends still find each other) |

Never shared, whatever the switches: prayer journal and Faith notes, sleep, progress photos and body scans, AI Coach
conversations, individual exercises, sets and workout notes, the email address.

## Phase 1 verification

| Check | Result |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | VERIFIED: clean |
| Unit (`tests/unit/friends.test.ts` and the whole suite) | VERIFIED: 257 files, 4,728 passed, 1 skipped |
| Database (`tests/integration/friends.test.ts`, 17 tests) | VERIFIED: off while the flag is off; unique usernames; no direct writes to any Friends table; search returns usernames only; nothing shared before acceptance; a friend sees only what is switched on; switching off takes effect at once; crossing requests; withdraw; invite links single use and expiring; remove; block (never revealed, ends an accountability partnership); reports reach administrators only; a signed-out visitor can do none of it; account deletion removes every trace |
| Existing security gates with the new tables | VERIFIED: cross-user isolation sweep, callable-function allow-list (three internal helpers refuse members and visitors), row-security coverage, account deletion and export coverage |
| Whole integration suite | VERIFIED: 80 files passed, 1 skipped; 484 passed, 1 skipped |
| Browser, two members in two browsers (`e2e/friends.spec.ts`) | VERIFIED: hidden with the flag off (no entry, 404); username; search; request; accept; friend profile; privacy switch changes the friend's view; report sheet; remove; invite link through sign-in; a used link is refused; no sideways scroll |
| Whole browser suite | See the commit message for this phase |
| On an iPhone or Android phone | NOT TESTED |
| The native share sheet for invite links | NOT TESTED (Chromium copies the text instead) |

## Known limits of phase 1

- **A new person who opens an invite link** is sent to sign in. If they create an account instead, they finish
  onboarding and then have to open the link again: the app has no deep links yet.
- **No notifications yet.** A request is seen when the member opens Friends. Phase 2 adds the inbox.
- **Usernames are not screened for offensive words.** Reporting ("Inappropriate username or name") covers it; a word
  list is a possible addition.
- **Acting on a report** (for example removing an account) is done in the Supabase dashboard; the admin page records
  the decision only.
- **Privacy Policy and Terms** do not yet describe sharing between members. They are drafts awaiting attorney review;
  this feature must be covered before the flag is switched on for real members.

## Proposal, not implemented: what could be Pro later

Nothing below is built or gated. All of phase 1 is available to Free and Pro alike.

| Free | Possible Pro |
|---|---|
| Friends, invitations, requests, block, report, privacy | |
| Basic accountability partnerships and encouragement | |
| Joining private challenges; creating one challenge at a time | Running several challenges at once |
| Current standings | Advanced statistics and trends within a challenge |
| Recent results | Full challenge history |

## Challenge scoring safeguards (planned for phase 5)

Workouts are self-reported, so results are honour-based. Planned safeguards, to be enforced in the database:

- A workout counts only when the server recorded it as saved while the challenge was running (a server-set time the
  member cannot write), and its stated start is inside the challenge too: no backdating into a challenge.
- At least one completed set; one workout per member per day counts for consistency scores.
- Duplicates are prevented by the existing one-row-per-saved-workout rule.
- Steps count only from Apple Health or Health Connect, not manual entries.
- Standings are calculated by the server from the underlying rows each time; no member can write a score.
- Each challenge screen states its rule in one sentence.
