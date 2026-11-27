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
| Search | By the start of a username, at least 3 characters, 10 results; 30 searches a minute in the app and 60 a minute enforced by the database itself (migration 077); returns the username only |
| Search switched off | The member is hidden from search and can't be sent a request, even by someone who holds their account id, unless they sent that person a request first (migration 078, audit finding F-12) |
| Sharing by default | None. A new friend sees the username and the display name, nothing else, until the member switches "Workouts and streak" on (migration 078). Whether sharing may ever start on is an owner and counsel decision (audit finding F-07); off is the conservative setting |
| Display name | Shown between friends only, and always shown to a friend (no switch hides it) |
| Friends | 200 per member |
| Requests | 20 per sender in 24 hours; one pending per pair; a declined request can't be repeated for 30 days. The sender isn't told of a decline, but can infer it: the request leaves their list and a new one is refused for 30 days (audit finding F-04) |
| Invite links | Single use, 7 days, 5 open at a time; opening one makes the two friends |
| Block | Ends the friendship, any pending request and any accountability partnership between the two; each disappears from the other's search; an accountability invite code between the two is refused (migration 078). The blocked member isn't told, but can infer it: a member they could see before now reads as "not found" (audit finding F-03). No policy should say a block cannot be detected |
| Reports | Fixed reasons, optional detail up to 500 characters, one open report per pair, 5 per reporter in 24 hours. No administrators' note is stored (migration 077) |
| With the flag off | Removing, blocking, unblocking, reporting, declining, withdrawing and switching sharing off still work |

### What a friend can see

A friend always sees the username, the display name, and the date the friendship began. Everything else:

| Switch | Default | On the Privacy & sharing screen | Phase 1 effect |
|---|---|---|---|
| Show my profile to friends | On | Yes | On shares nothing by itself. Off: name and username only, whatever the switch below says |
| Workouts and streak | **Off** (migration 078) | Yes | When on: completed workouts in the last 7 days; day and week streaks |
| Let people find me by username | On | Yes | Off: hidden from search and from requests (friends still find each other) |
| Personal records | Off | **No** (hidden) | Column kept; no function reads it (phase 4) |
| Appear in friend rankings | On (stored value) | **No** (hidden) | Column kept; no function reads it (phase 4). **Its default should be decided, and the question asked afresh, before anything reads it** |
| Weight and body measurements | Off | **No** (hidden) | Column kept; **nothing is returned by any function** |
| Nutrition | Off | **No** (hidden) | Column kept; nothing is returned |
| Faith and discipline activity | Off | **No** (hidden) | Column kept; nothing is returned |

The five hidden switches can't be switched on through the app (`updatePrivacyAction` refuses; switching off is
allowed). Their columns are still writable by the member's own session through the database API, so a stored "on"
must not be trusted when that sharing ships: reset the column and ask again (audit finding F-09). The screen says:
"Weight, measurements, nutrition and Faith activity are not shared with friends at all."

Never shared, whatever the switches: prayer journal and Faith notes, sleep, progress photos and body scans, AI Coach
conversations, individual exercises, sets and workout notes, the email address.

## Phase 1 verification

| Check | Result |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | VERIFIED: clean |
| Unit (`tests/unit/friends.test.ts` and the whole suite) | VERIFIED: 257 files, 4,728 passed, 1 skipped |
| Database (`tests/integration/friends.test.ts`, 17 tests) | VERIFIED: off while the flag is off; unique usernames; no direct writes to any Friends table; search returns usernames only; nothing shared before acceptance; a friend sees only what is switched on (since migration 078 workouts start off); switching off takes effect at once; crossing requests; withdraw; invite links single use and expiring; remove; block (the blocked member isn't notified, but can infer it; ends an accountability partnership); reports reach administrators only; a signed-out visitor can do none of it; account deletion removes every trace |
| Existing security gates with the new tables | VERIFIED: cross-user isolation sweep, callable-function allow-list (three internal helpers refuse members and visitors), row-security coverage, account deletion and export coverage |
| Whole integration suite | VERIFIED: 80 files passed, 1 skipped; 484 passed, 1 skipped |
| Browser, two members in two browsers (`e2e/friends.spec.ts`) | VERIFIED: hidden with the flag off (no entry, 404); username; search; request; accept; friend profile; privacy switch changes the friend's view; report sheet; remove; invite link through sign-in; a used link is refused; no sideways scroll |
| Whole browser suite (`--project mobile`, stand-ins for the AI provider and the food database) | 148 passed, 101 skipped (demo-only and opt-in audits), **2 failed**: both offline Bible tests. Cause: not Friends. The service worker still asked for the seven Home pictures removed in `56500ff`; some of those requests never finished, the worker never installed and nothing worked offline. Fixed on this branch (`public/sw.js` stores the pictures only once they exist; version `ngf-v3`); both tests and the Home tests then VERIFIED passing. **The release-candidate branch still has this defect** and needs the same fix |
| iPhone-size screens (393 x 852, Chromium emulation, not Safari) | Captured for review |
| On an iPhone or Android phone | NOT TESTED |
| The native share sheet for invite links | NOT TESTED (Chromium copies the text instead) |

## After the privacy audit (2026-11-16, migrations 077 and 078)

Statuses below are for this change only; the tables above are the earlier phase 1 record.

| Check | Result |
|---|---|
| Migration 078 applied locally (`npx supabase migration up`), bundle regenerated (`npm run db:bundle`) | VERIFIED |
| All 24 `SECURITY DEFINER` functions of migrations 067, 076, 077 have `search_path=public, pg_temp` (`pg_proc.proconfig`) | VERIFIED by query |
| `anon` holds no privilege on the six Friends tables or the four accountability tables, and only `SELECT` on `feature_flags`; no function of these features is executable by `anon` (`role_table_grants`, `column_privileges`, `has_function_privilege`) | VERIFIED by query, before and after |
| `social_profiles.show_workouts` defaults to `false`; both flags still `false` | VERIFIED by query |
| Database (`tests/integration/friends.test.ts`, 20 tests; `accountability.test.ts`, 13 tests) | VERIFIED: a brand-new friend sees `user_id`, `username`, `display_name`, `since`, `profile_visible` only; workouts appear only after the friend switches them on; hidden switches can't be switched on; a member with search off can't be sent a request unless they asked first; a planted request across a block can't be accepted; a block holds for accountability codes; a signed-out visitor is refused on every table (42501) |
| Unit (`tests/unit/friends.test.ts`, `tests/unit/friends-privacy-switches.test.tsx`) | VERIFIED: defaults; only three switches are rendered |
| `npx tsc --noEmit`, `npx eslint .`, whole unit suite, whole integration suite | See "Status after remediation" in `docs/legal-audit-2026-11-16/08_FRIENDS_PRIVACY_AUDIT.md` for the counts of the last run |
| Browser (`e2e/friends.spec.ts`) | Edited to match (Sam switches workouts on before Jordan sees numbers; the five hidden switches are absent). **NOT RUN after these changes** |
| On an iPhone or Android phone | NOT TESTED |

A block and a decline are **not notified** to the other member. Neither is concealed: the other member can infer both
(audit findings F-03, F-04). No screen, test title or document should say otherwise.

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
