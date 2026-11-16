# 08 — Friends and Accountability Partners: privacy audit

Date: 2026-11-16. Branch: `claude/friends-challenges` (commit `3b9bc44`). Prepared for the founder and a US
privacy/technology attorney. **Not legal advice.** This file records what the code and database do, and lists questions
for counsel. No file other than the three audit deliverables was changed.

Abbreviations: **M076** = `supabase/migrations/20261116000076_friends_foundation.sql`; **M067** =
`supabase/migrations/20261113000067_accountability_partners.sql`.

## 1. Summary

- Friends is **off**. The `friends_challenges` flag is `false` in the database (queried today), the pages return 404
  and the database functions that connect two members refuse to run while it is off.
- The core design holds: no member can read another member's rows in any Friends table. Every read of another member
  goes through four functions, and the fields they return are listed in section 4.
- 22 findings: 1 high, 9 medium, 11 low and 1 informational. None exposes private health, nutrition, faith, photo or
  AI data to another member. Most concern what can be *inferred*, what is promised on screen, and what is undefined
  (retention, moderation, consent wording).
- **The high finding (F-01):** the Privacy Policy and Terms do not describe sharing between members. The feature's own
  flag description says it must stay off until they do.
- **Two things the documentation states that the database does not deliver:** a block "is never revealed" (F-03: a
  blocked member can tell), and "a decline isn't shown to the sender" (F-04: the sender can tell).
- **One access-control defect (F-05):** a reporter can read the administrators' internal note on their own report.
- **Rate limits on search and invite codes exist only in the app layer (F-02, F-08).** A signed-in member calling the
  database API directly is not limited.
- The Friends integration test did not fully pass today: **16 of 17 passed**. The failure is a test that gives a
  different answer on Mondays, not a product defect (F-17).

## 2. How this was verified

| Check | Result |
|---|---|
| Read M076 (883 lines) and M067 (403 lines) in full | Done |
| Read `src/server/actions/friends.ts`, `src/server/services/friends.ts`, `src/lib/domain/friends.ts`, the four `/friends` pages, `/admin/reports`, `src/server/actions/accountability.ts`, `docs/friends/FRIENDS_CHALLENGES.md` | Done |
| `src/components/friends/friends-panels.tsx` (593 lines) | Searched for the consent, block, report and invite wording; not read line by line |
| `pg_policies`, `information_schema.role_table_grants`, `information_schema.column_privileges`, `pg_proc` privileges on the local database | Done; results quoted below |
| Live behaviour, as the `authenticated` role with three synthetic accounts, inside one transaction that was rolled back | Done; the flag was `false` again afterwards and no test rows remained |
| `npx vitest run --project integration tests/integration/friends.test.ts` | Run: 16 passed, 1 failed (F-17) |
| `e2e/friends.spec.ts` (browser test) | **Not run** |
| Behaviour on a real iPhone or Android phone; the native share sheet | **Not verified** |
| The hosted (production or staging) database | **Not inspected**; only the local stack |

Note: the local database containers were stopped when this work began. The Docker service was restarted; the existing
containers came back with their data and all migrations applied.

## 3. Feature flag

| Fact | Evidence |
|---|---|
| Inserted disabled | M076:43-45 |
| Currently `false` locally | `select key, enabled from feature_flags` → `friends_challenges|f`, `accountability_partners|f` |
| App treats a missing or unreadable flag as off | `src/server/flags.ts:34-37` (`isFlagOn`) |
| Pages 404 while off | `src/app/(app)/friends/page.tsx:26`, `[id]/page.tsx:21`, `privacy/page.tsx:18`, `invite/[code]/page.tsx:19` |
| Database refuses while off | `claim_username` M076:271, `send_friend_request` :360, `accept_friend_invite` :620, `search_users` :678, `friends_overview` :772, `friend_profile` :827, accepting a request :433, new invites via `friends_can_invite` :185 |
| Works while off (by design) | decline, withdraw, remove, block, unblock, report, switching a privacy setting off |
| Who can switch it on | Any account with `profiles.role = 'admin'`, from `/admin/flags` (`src/server/actions/admin.ts:298`). The change is written to `admin_audit_logs` (:299). There is no second approval step |
| Who can read the flag list | Everyone, including signed-out visitors (policy `feature_flags_read`, roles `{anon,authenticated}`, `using true`). The description text of each flag is readable too |

## 4. What one member can learn about another

"A" is the viewer, "B" the other member. Fields are exactly what the functions return.

### 4.1 By function

| Function | Returns | Lines |
|---|---|---|
| `search_users(query)` | `user_id` (the account's UUID), `username`, `relation` (`friend` / `requested` / `incoming` / `none`). Prefix match, 3 to 20 characters, at most 10 rows. Excludes the caller, members with `searchable = false` (unless already a friend), and anyone blocked in either direction | M076:667-699 |
| `friends_overview()` | **friends:** `user_id`, `username`, `display_name`, `since`. **incoming:** `request_id`, `user_id`, `username`, `at`. **outgoing:** same four. **blocked:** `user_id`, `username`, `at` | M076:762-805 |
| `friend_profile(user)` | Always, between friends: `user_id`, `username`, `display_name`, `since`, `profile_visible`. If B's `profile_visible` and `show_workouts` are on: `workouts_last_7_days`, `streak_days`, `streak_weeks`. Null for anyone who is not a friend, or is blocked | M076:813-855, 703-757 |
| `accountability_summary(partnership)` | Always: `partner_name` (display name). If shared: `workouts_last_7_days`; `streak_days`, `streak_weeks`; `program {name, week, weeks}` (a member-made program shows as "Custom program") | M067:175-271 |

`display_name` is `profiles.display_name`, the name typed at sign-up ("Tell us what to call you",
`src/lib/validation/schemas.ts:38`). If it is blank the username is used.

### 4.2 By relationship stage

| Stage | What A can learn about B | How |
|---|---|---|
| **Stranger** (B has a username, searchable on) | That an account with that username exists; B's account UUID; that there is no relationship | `search_users` |
| **Stranger** (B has `searchable` off) | Nothing through search. If A already holds B's UUID (for example a former friend), A can still send a request, block or report | `send_friend_request` does not check `searchable` (M076:369) |
| **Stranger** (B never joined Friends) | Nothing through search. With B's UUID, `block_user` and `report_user` tell A whether the account exists (`user_not_found` or success) | M076:514, 575 |
| **A sent B a request (pending)** | B's username and UUID, and the time A sent it. No display name, no activity | `friends_overview.outgoing` |
| **B sent A a request (pending)** | B's username, UUID and the time. No display name | `friends_overview.incoming` |
| **Request declined by B** | Not told directly. Inferable: see F-04 | — |
| **Friends** | Username, display name, exact time the friendship began, whether B hides their profile, and (default on) B's completed-workout count for 7 days and day and week streaks | `friend_profile` |
| **Removed** (either removed the other) | Back to the stranger row. A keeps B's UUID and last-seen username. A is not notified but sees B gone from the list | `remove_friend` M076:475-493 |
| **A blocked B** | A sees B's current username in A's blocked list (it follows B's username changes) | `friends_overview.blocked` |
| **B blocked A** | Not told directly. Inferable: see F-03 | — |

Never returned by any of these functions, at any stage (confirmed by reading every `jsonb_build_object` and `select`
list): email, weight, measurements, nutrition, sleep, photos, body scans, prayer journal, Bible activity, AI chats,
individual exercises or sets, time zone, location. The switches for body, nutrition, faith, records and leaderboards are
stored but **no function reads them** (F-09).

## 5. Limits and where each is enforced

| Limit | Value | Enforced in database | Enforced in app only |
|---|---|---|---|
| Friends per member | 200 | Yes, M076:329 | |
| Requests per sender per 24 h | 20 | Yes, M076:397 | |
| Repeat after decline | 30 days | Yes, M076:392-396 | |
| One pending request per pair | — | Yes, unique index M076:99-100 | |
| Username change | once per 30 days | Yes, M076:288 | |
| Username attempts | 10 per 10 min | | **App only**, `actions/friends.ts:60` |
| Username search | 30 per minute | | **App only**, `actions/friends.ts:75` |
| Search minimum and result cap | 3 characters, 10 rows | Yes, M076:678, 695 | |
| Open invite links | 5 | Yes, `friends_can_invite` M076:178-189 | |
| Invite: single use, 7 days | — | Yes, M076:629-634, 146-148 | |
| Invite-code attempts | 10 per 10 min | | **App only**, `actions/friends.ts:223` |
| Reports per reporter per 24 h | 5 | Yes, M076:590 | |
| One open report per pair | — | Yes, M076:585-589 | |
| Report detail length | 500 characters | Yes, M076:129, 581 | |

The app-layer limiter (`src/server/rate-limit.ts`) is a shared counter in Postgres when the service-role key is set, and
falls back to a per-server-instance counter otherwise (:42-59).

## 6. Database access controls (as applied)

**Row-level security** is enabled on all six tables (`relrowsecurity = t`; not forced, so the table owner and the
service role bypass it, which is normal for Supabase).

| Table | Policies (role `authenticated` only) | Direct writes by members |
|---|---|---|
| `social_profiles` | select own; update own | Update of the 8 switch columns only. No insert, no delete |
| `friend_requests` | select where recipient, or sender and status is not `declined` | None |
| `friendships` | select where a member of the pair | None |
| `user_blocks` | select where blocker | None |
| `user_reports` | select where reporter, **or admin**; update where admin | Admin: `status`, `admin_note`, `reviewed_at` |
| `friend_invites` | select own; insert own (if `friends_can_invite()`); delete own | Insert of `inviter_id`, `code` |

**Table grants** (`information_schema.role_table_grants`): `anon` and `authenticated` both hold table-level `SELECT`
on all six tables; `friend_invites` also `DELETE`. `anon` has no policy, so it reads zero rows (the integration test
confirms this). See F-15.

**Functions** (`pg_proc`): all 18 Friends functions and all 6 accountability functions are `SECURITY DEFINER` with
`search_path=public`. None is executable by `anon` or `PUBLIC`. The three internal helpers (`friends_blocked`,
`friends_make_friends`, `friends_workout_stats`) are not executable by `authenticated` either. `is_admin()` is
executable by everyone, including `anon` (it predates Friends).

**Administrators.** There is no admin policy on `social_profiles`, `friend_requests`, `friendships`, `user_blocks` or
`friend_invites`, so an admin signed in to the app cannot read them. Admins can read every row of `user_reports`.
Anyone holding the service-role key or Supabase dashboard access can read everything; that access is outside the app.

## 7. Findings

Columns: **Sev** severity · **Status** confirmed or suspected · **Counsel** counsel must decide · **Blocks** blocks
public launch · **Test** can technical testing resolve it.

"Blocks" is answered for a public launch **with Friends switched off**, which is the current plan. Where a finding
would block *switching the feature on*, the row says so.

| ID | Sev | Status | Finding | Counsel | Blocks | Test |
|---|---|---|---|---|---|---|
| F-01 | High | Confirmed | Legal documents do not cover sharing between members | Y | N while off; **Y to switch on** | N |
| F-02 | Medium | Confirmed | Username search is rate-limited in the app only; usernames and account IDs can be listed | N | N while off; fix before on | Y |
| F-03 | Medium | Confirmed | A blocked member can tell they were blocked | N (wording: Y) | N while off | Y |
| F-04 | Medium | Confirmed | A sender can tell their request was declined | N | N while off | Y |
| F-05 | Medium | Confirmed | A reporter can read the administrators' note on their report | N | N while off; fix before on | Y |
| F-06 | Medium | Confirmed | Reports: free text, no retention period, deleted with either account, no moderation procedure | Y | Counsel, before on | N |
| F-07 | Medium | Confirmed | Sharing is on by default once a request is accepted; the display name is always shown | Y | Counsel, before on | N |
| F-08 | Medium | Confirmed | Invite links make the holder a friend at once; the invitee does not see who invited them | N | N while off | Partly |
| F-09 | Medium | Confirmed | Five switches are shown but do nothing yet; one covers faith activity | Y | Counsel, before on | N |
| F-20 | Medium | Confirmed | No screening of usernames or display names; no handling specific to minors | Y | Counsel, before on | N |
| F-10 | Low | Confirmed | A member cannot leave Friends without deleting the whole account | Y | Counsel, before on | N |
| F-11 | Low | Confirmed | Export leaves out some Friends rows about the member | Y | N | Y |
| F-12 | Low | Confirmed | The permanent account ID is given to strangers | N | N | N |
| F-13 | Low | Suspected | A friend could infer time zone and activity timing | N | N | Y |
| F-14 | Low | Confirmed | `SECURITY DEFINER` functions use `search_path = public` | N | N | Y |
| F-15 | Low | Confirmed | Unneeded table grants to the signed-out role | N | N | Y |
| F-16 | Low | Confirmed | A branch of `respond_friend_request` has no effect | N | N | Y |
| F-17 | Low | Confirmed | The Friends integration test fails on Mondays | N | N | Y |
| F-18 | Low | Confirmed | A request can be withdrawn and re-sent repeatedly | N | N | Y |
| F-19 | Low | Confirmed | Any admin can switch the feature on; flag descriptions are public | N | N | N |
| F-21 | Low | Confirmed | Accountability partners: same display-name, retention and limit questions | Y | Counsel, before on | Partly |
| F-22 | Info | Confirmed | What administrators can read | Y | N | N |

### F-01 — Legal documents do not cover sharing between members (High, confirmed)

- **Evidence.** The flag's own description: "Off until the owner approves it (and the privacy policy and terms cover
  sharing between members)" (M076:44). `docs/friends/FRIENDS_CHALLENGES.md:104-105` says the same.
  `docs/legal/PRIVACY_POLICY_DRAFT.md` has no mention of usernames, friends, other members, reports or blocks; section
  6 (:138-152) lists processors only. The in-app page `src/app/legal/privacy/page.tsx` says location and other data
  are seen by "only you". `src/app/legal/terms/page.tsx:20-21` has "Acceptable use: [To be completed.]".
  Accountability partners (M067:30) has the same condition and the same gap.
- **Impact.** Switching either flag on would start a new kind of disclosure (fitness activity and a name to other
  consumers) that no published or draft document describes. Members would have accepted documents that say otherwise.
- **Recommended action.** Keep both flags off. Give counsel sections 4, 5 and 9 of this file as the facts to cover:
  username and search, what friends see by default, blocking, reporting and who reads reports, moderation and account
  removal, conduct rules, retention.
- **Counsel decides:** Y. **Blocks launch:** N with the flag off; Y for switching on. **Testing resolves:** N.

### F-02 — Username search is rate-limited in the app only (Medium, confirmed)

- **Evidence.** `search_users` has no limiter (M076:667-699). The 30-per-minute limit is in the server action
  (`src/server/actions/friends.ts:74-75`). `search_users` is granted to `authenticated` (M076:699; `pg_proc`: anon `f`,
  authenticated `t`). In the rolled-back test, a synthetic member called it directly as the `authenticated` role with
  no limiter involved, and a member who had **not** chosen a username could search too (1 row returned).
- **Impact.** A signed-in member who calls the database API directly (the project URL and public key are in every app
  build) can walk prefixes and list every searchable username with its account UUID. Usernames often resemble real
  names or handles used elsewhere.
- **Recommended action.** Count searches inside the database function, per caller. Decide whether a member must have
  joined Friends before searching. Consider exact-match only for the first release.
- **Counsel decides:** N. **Blocks launch:** N while off. **Testing resolves:** Y.

### F-03 — A blocked member can tell they were blocked (Medium, confirmed)

- **Evidence.** M076:369-371 raises `user_not_found` when either has blocked the other, *before* the checks that
  raise `already_requested` (:380), `request_cooldown` (:392-396) or return `requested`. Rolled-back test: the same
  sender got `request_cooldown` before the block and `user_not_found` after it; search for the blocker went from 1 row
  to 0. A valid invite code returns `invite_not_found` for a blocked member (M076:626). Accounts cannot leave Friends
  (F-10), so "not found" for a previously visible member means either a deleted account or a block; a second account
  tells the two apart.
- **Impact.** The migration (M076:497), the doc (`FRIENDS_CHALLENGES.md:60, 86`) and the test title ("is never
  revealed") describe concealment the system cannot deliver. The in-app wording is narrower and accurate: "They
  aren't told" (`friends-panels.tsx:454`, `privacy/page.tsx:57`).
- **Recommended action.** Keep the in-app promise at "they aren't told". Do not state in any policy that a block
  cannot be detected. Correct the internal doc.
- **Counsel decides:** N for the mechanism; Y for any wording that goes into the Terms or Privacy Policy.
  **Blocks launch:** N while off. **Testing resolves:** Y.

### F-04 — A sender can tell their request was declined (Medium, confirmed)

- **Evidence.** The policy hides declined rows from the sender (M076:212-213) and the comment says "a decline isn't
  announced". But a re-send within 30 days raises `request_cooldown` (M076:392-396), shown as "You sent this member a
  request recently. You can try again later." (`src/lib/domain/friends.ts:239`). Rolled-back test: after the decline
  the sender saw 0 of their own requests and got `request_cooldown`. A withdrawn request has no cooldown, so the
  cooldown appears only after a decline or a block-triggered decline (M076:521-523).
- **Impact.** Minor social friction. It matters only if a document promises that declines are hidden.
- **Recommended action.** Do not promise it. Optionally apply the same cooldown message to all repeat requests.
- **Counsel decides:** N. **Blocks launch:** N. **Testing resolves:** Y.

### F-05 — A reporter can read the administrators' note on their report (Medium, confirmed)

- **Evidence.** Policy `user_reports_select_own_or_admin` lets the reporter read their row (M076:228-230). Column
  privileges give `authenticated` `SELECT` on `admin_note`, `status` and `reviewed_at` (query result in section 2).
  Rolled-back test: the reporter read `status = dismissed` and the admin note text. The data export selects `*` from
  `user_reports` for the reporter (`src/server/services/account.ts:78, 146`), so the note is exported too. No screen
  shows it.
- **Impact.** An internal moderation note (which may describe the reported member or the decision) reaches the
  reporter through the API or their export.
- **Recommended action.** Revoke column `SELECT` on `admin_note` from members, or move the note to an admin-only
  table. Decide deliberately whether reporters should see the outcome (`status`).
- **Counsel decides:** N. **Blocks launch:** N while off. **Testing resolves:** Y.

### F-06 — Reports: free text, no retention, deleted with either account (Medium, confirmed)

- **Evidence.**
  - `details` is free text up to 500 characters (M076:129) and `admin_note` likewise (:131). The admin page shows
    `details` in full (`src/app/(app)/admin/reports/page.tsx:49`).
  - No deletion or expiry exists for `user_reports`: the only scheduled job in the database is
    `faith-journeys-settle` (`cron.job`).
  - Both `reporter_id` and `reported_id` are `on delete cascade` (M076:125-126). If the reported member deletes
    their account, every report about them disappears, and nothing prevents a new sign-up.
  - A report can name any account UUID, including a member who never joined Friends (M076:575; confirmed in the
    rolled-back test).
  - Report works with the flag off.
  - Administrators see the reporter's username (`admin_user_reports`, M076:860-883).
  - "Acting" on a report is done in the Supabase dashboard (`FRIENDS_CHALLENGES.md:102-103`); the app records only
    the status change (`admin.ts:310-311`).
- **Impact.** Free text can hold sensitive statements about a third person. There is no stated period for keeping
  it, no written procedure for reviewing it, and no record of what was done to an account. Evidence of harassment is
  lost when either account is deleted. A member can file five unfounded reports a day.
- **Recommended action.** Owner and counsel to set: a retention period; who may read reports; what happens to
  reports when an account is deleted; whether the reported member is ever told; a written moderation procedure; what
  to do with reports that describe a threat, self-harm or a crime.
- **Counsel decides:** Y. **Blocks launch:** counsel, before switching on. **Testing resolves:** N.

### F-07 — Sharing is on by default; the display name is always shown (Medium, confirmed)

- **Evidence.** Defaults: `searchable true`, `profile_visible true`, `show_workouts true`,
  `show_in_leaderboards true` (M076:70-79; `src/lib/domain/friends.ts:48-57`). `friend_profile` always returns
  `display_name` between friends (M076:839-844) and no switch hides it. The username screen says "Nothing is shared
  with anyone until you accept them as a friend" (`friends/page.tsx:38`) and does not say the sign-up name will be
  shown. The privacy screen does say it ("Off: friends see your name and username", `src/lib/domain/friends.ts:68`).
- **Impact.** Accepting one request discloses a name and workout frequency to another consumer without a separate
  step. Workout counts and streaks are fitness information; whether disclosure to another member needs its own
  consent is a question under the consumer-health-data laws listed in file 06.
- **Recommended action.** Counsel to decide whether the first acceptance needs an explicit sharing step or whether
  the switches should start off. State on the username screen that the profile name is shown to friends, or let
  members choose a separate name for Friends.
- **Counsel decides:** Y. **Blocks launch:** counsel, before switching on. **Testing resolves:** N.

### F-08 — Invite links make the holder a friend at once (Medium, confirmed)

- **Evidence.** `accept_friend_invite` creates the friendship immediately with no confirmation by the inviter
  (M076:606-658). The landing page checks the code only on Accept, "so opening the link reveals nothing about who
  sent it" (`invite/[code]/page.tsx:14-15`): the invitee agrees without knowing who the inviter is. The app tells
  the inviter "Whoever opens it and signs in becomes your friend" (`friends/page.tsx:100`). The code is inserted by
  the member's own session with a column grant (`insert (inviter_id, code)`, M076:248); the only database check is
  the pattern. In the rolled-back test a member inserted the hand-picked code `AAAAAAAAAA`. The attempt limit is
  app-only (`actions/friends.ts:222-223`).
- **Impact.** A forwarded or publicly posted link gives a stranger a member's display name and default workout
  figures, in both directions. An invitee who accepts a link from an unknown source shares the same with the sender.
  A member who bypasses the app can create a guessable code for their own link.
- **Recommended action.** Show the inviter's username on the landing page after sign-in and before Accept. Generate
  the code in the database. Count failed attempts in the database.
- **Counsel decides:** N. **Blocks launch:** N while off. **Testing resolves:** partly.

### F-09 — Five switches are shown but do nothing yet (Medium, confirmed)

- **Evidence.** `show_records`, `show_body`, `show_nutrition`, `show_faith` and `show_in_leaderboards` are stored
  (M076:74-79) and member-editable (:206-207). `friend_profile` reads only `profile_visible` and `show_workouts`
  (:845-850); the comment at :812 confirms the rest are not returned. The privacy screen shows all of them with
  descriptions, for example "Faith and discipline activity — Reading and prayer streaks only"
  (`src/lib/domain/friends.ts:66-75`).
- **Impact.** A member can switch on "faith" or "weight and body measurements" today. If a later release starts
  reading those switches, religious-practice or body data would begin flowing to friends on the strength of a choice
  made before the sharing existed and before its exact content was known.
- **Recommended action.** Hide switches that have no effect, or reset them to off and ask again when each kind of
  sharing ships. Counsel to say what consent is needed for the sensitive ones.
- **Counsel decides:** Y. **Blocks launch:** counsel, before switching on. **Testing resolves:** N.

### F-20 — No screening of names; nothing specific to minors (Medium, confirmed)

- **Evidence.** Reserved-name rules apply to usernames only (M076:278-282). `display_name` is free text up to 60
  characters, not unique (`profiles_display_name_check`), and is what friends see most prominently
  (`friends/[id]/page.tsx:32, 37`). A display name such as "Narrow Gate Support" is not refused. Usernames are not
  screened for offensive words (`FRIENDS_CHALLENGES.md:100-101`). Friends has no age check of its own; it relies on
  the sign-up checkbox and onboarding age (file 06, section 5.5).
- **Impact.** Impersonation and offensive names reach other members until someone reports them. If a minor holds an
  account despite the age gate, adults can find and befriend them.
- **Recommended action.** Apply the reserved list to display names shown to others. Counsel to advise on conduct
  terms and on what the age gate must do before members can contact each other.
- **Counsel decides:** Y. **Blocks launch:** counsel, before switching on. **Testing resolves:** N.

### F-10 — A member cannot leave Friends (Low, confirmed)

- **Evidence.** `social_profiles` has no delete policy or grant (M076:198-207) and no function deletes it.
  `username` is `not null`. A member can turn `searchable` and `profile_visible` off and remove each friend, but the
  username stays reserved to them and existing friends still see the name and username.
- **Impact.** Consent to take part cannot be fully withdrawn without deleting the account.
- **Recommended action.** Add a "leave Friends" function that removes the profile, friendships, requests and invites.
- **Counsel decides:** Y (is this needed for consent withdrawal or deletion rights). **Blocks launch:** counsel,
  before switching on. **Testing resolves:** N.

### F-11 — Export leaves out some Friends rows about the member (Low, confirmed)

- **Evidence.** The export reads with the member's own session (`src/app/api/account/export/route.ts:17-18`), so it
  returns what the policies allow. Requests the member sent that were declined are hidden from them
  (M076:212-213) and therefore not exported. Reports made about the member and blocks placed on them are left out
  on purpose (`src/server/services/account.ts:72-73, 77-78`). The export does include other members' UUIDs
  (friendships, requests, blocks, reports) and the `admin_note` (F-05).
- **Impact.** For an access request, the member does not receive every row that relates to them.
- **Recommended action.** Counsel to say whether reports about a member, and declined requests, fall within an
  access request and what exceptions apply.
- **Counsel decides:** Y. **Blocks launch:** N. **Testing resolves:** Y (to confirm contents).

### F-12 — The permanent account ID is given to strangers (Low, confirmed)

- **Evidence.** `search_users` returns `user_id` (M076:668, 682). It is `auth.users.id`: the key of every table, the
  RevenueCat app user ID (`src/lib/billing/store-purchases.ts:26-29`) and Stripe metadata
  (`src/server/services/billing.ts:136, 202-204`). It never changes, including when the username changes. With it,
  anyone can call `send_friend_request` (ignores `searchable`), `block_user` and `report_user`.
- **Impact.** Not a secret, and row-level security protects the data. It does let a former contact keep targeting a
  member who has hidden from search, until that member blocks them.
- **Recommended action.** Have `send_friend_request` honour `searchable` for non-friends, or use a separate public
  identifier.
- **Counsel decides:** N. **Blocks launch:** N. **Testing resolves:** N.

### F-13 — A friend could infer time zone and activity timing (Low, suspected)

- **Evidence.** `friends_workout_stats` computes "today" in the member's stored time zone (M076:717-728). The
  7-day count and the day streak therefore change at that member's local midnight; a friend who checks repeatedly
  could work out the UTC offset. `workouts_last_7_days` rises when a workout is saved, which shows when the friend
  trained. `since` is an exact timestamp. Reasoned from the code; not demonstrated by test.
- **Impact.** Coarse location (a time-zone band) and daily routine could be learned by a persistent friend.
- **Recommended action.** Accept and document, or round `since` to a date and refresh friend figures on a fixed
  schedule.
- **Counsel decides:** N. **Blocks launch:** N. **Testing resolves:** Y.

### F-14 — `SECURITY DEFINER` functions use `search_path = public` (Low, confirmed)

- **Evidence.** `pg_proc.proconfig = {search_path=public}` for all 24 functions in M076 and M067. Table names
  inside the Friends functions are schema-qualified; `auth.uid()` is too. Temporary-schema objects are searched
  before `public` for unqualified *table* names when `pg_temp` is not listed.
- **Impact.** No practical exploit was found: members reach the database only through the REST API and cannot
  create objects. It is a hardening gap, not a leak.
- **Recommended action.** Use `set search_path = ''` or `public, pg_temp` in a later migration.
- **Counsel decides:** N. **Blocks launch:** N. **Testing resolves:** Y.

### F-15 — Unneeded table grants to the signed-out role (Low, confirmed)

- **Evidence.** `anon` holds `SELECT` on all six Friends tables and `DELETE` on `friend_invites`
  (`role_table_grants`). `accountability_partnerships` keeps `INSERT, UPDATE, DELETE` for `anon` and
  `authenticated` with no matching policy; `feature_flags` likewise for `anon`. Row-level security blocks all of it
  today (the test at `tests/integration/friends.test.ts:297-315` confirms zero rows for a signed-out visitor).
- **Impact.** None today. Protection rests on one layer: a policy added later with role `public` would expose rows.
- **Recommended action.** Revoke the unused grants.
- **Counsel decides:** N. **Blocks launch:** N. **Testing resolves:** Y.

### F-16 — A branch of `respond_friend_request` has no effect (Low, confirmed)

- **Evidence.** M076:436-439 updates the request to `declined` and then raises an exception, which undoes the
  update. The request stays pending.
- **Impact.** None in practice: `block_user` already closes pending requests (M076:521-523) and
  `friends_overview` hides blocked senders (:789).
- **Recommended action.** Return a value instead of raising, or remove the update.
- **Counsel decides:** N. **Blocks launch:** N. **Testing resolves:** Y.

### F-17 — The Friends integration test fails on Mondays (Low, confirmed)

- **Evidence.** Today (Monday 2026-11-16, UTC) the run gave "1 failed | 16 passed (17)". The failing check
  (`tests/integration/friends.test.ts:143`) expects `streak_weeks: 1` for a member who trained "today and yesterday"
  (:52-56). On a Monday those two days fall in two calendar weeks, and the function correctly returns 2.
  `FRIENDS_CHALLENGES.md:86` records all 17 as verified.
- **Impact.** The safety net for this feature is red one day in seven, which invites ignoring it. Product behaviour
  is as designed.
- **Recommended action.** Seed the two workouts inside one week, or accept 1 or 2.
- **Counsel decides:** N. **Blocks launch:** N. **Testing resolves:** Y.

### F-18 — A request can be withdrawn and re-sent repeatedly (Low, confirmed)

- **Evidence.** The 30-day cooldown applies only to declined requests (M076:392-396). `cancel_friend_request`
  (:453-472) leaves no cooldown. All requests, including withdrawn ones, count toward 20 per 24 hours (:397).
- **Impact.** Up to 20 request-and-withdraw cycles a day at one person. With no notifications today the recipient
  sees little; once notifications exist (phase 2) this becomes a nuisance channel. Blocking stops it.
- **Recommended action.** Apply a per-pair cooldown to any repeat request.
- **Counsel decides:** N. **Blocks launch:** N. **Testing resolves:** Y.

### F-19 — Any admin can switch the feature on; flag descriptions are public (Low, confirmed)

- **Evidence.** Section 3. Flag descriptions are readable by signed-out visitors and include the sentence about the
  privacy policy not yet covering the feature.
- **Impact.** A single admin action starts member-to-member sharing. The public descriptions disclose unreleased
  features and an admission about document coverage.
- **Recommended action.** Owner to decide who may hold the admin role and whether this flag needs a deployment-level
  switch as well. Remove the description column from what `anon` can read, or reword it.
- **Counsel decides:** N. **Blocks launch:** N. **Testing resolves:** N.

### F-21 — Accountability partners (migration 067) (Low, confirmed)

- **Evidence and facts.**
  - Flag `accountability_partners` is off (M067:29-31; database `f`).
  - A partner always sees `partner_name`, the display name (M067:212). Workouts and streak are shared by default;
    program progress is off by default (M067:75-77).
  - Up to 3 partners; codes single use, 7 days, 5 open (M067:25-27, 319-324).
  - Encouragements are six fixed messages, 3 per 24 hours (M067:92, 392-395). One is `praying`.
  - `acceptInviteAction` has no attempt limit in the app (`src/server/actions/accountability.ts:78-88`) and the
    database function has none either. The code space is about 10^15.
  - `accept_accountability_invite` does not check `user_blocks`, so two members with a block between them can still
    become partners if one enters the other's code.
  - Ending a partnership deletes share settings and encouragements at once (M067:354-355); the partnership row
    (both UUIDs, start and end time) stays until either account is deleted.
  - Each member can read the other's three share switches while active (policy `accountability_shares_select_member`).
- **Impact.** Same display-name and default-sharing questions as F-07, on a smaller scale. Ended-partnership rows
  have no retention period.
- **Recommended action.** Treat together with Friends in the legal documents. Add an attempt limit. Decide retention
  for ended partnerships.
- **Counsel decides:** Y. **Blocks launch:** counsel, before switching on. **Testing resolves:** partly.

### F-22 — What administrators can read (Info, confirmed)

- **Evidence.** Through the app, an admin can read: all `user_reports` rows (reporter ID, reported ID, reason,
  details, status, note, times); both usernames and the count of open reports against the reported member
  (`admin_user_reports`); the last 15 audit-log entries. They cannot read Friends profiles, friendships, requests,
  blocks or invites (no admin policy; confirmed in `pg_policies`). The admin page states "the reported member is
  never told who reported them" (`admin/reports/page.tsx:33`). Closing a report is logged
  (`admin.ts:311`); reading reports is not logged.
- **Impact.** The Privacy Policy draft says there is "no administrator access path to journals, photos or health
  records" (`PRIVACY_POLICY_DRAFT.md:223`). Reports are a new category that administrators do read, and free text may
  contain health or other sensitive statements.
- **Recommended action.** Describe administrator access to reports in the Privacy Policy. Decide whether reads
  should be logged.
- **Counsel decides:** Y. **Blocks launch:** N. **Testing resolves:** N.

## 8. Consent, revocation, deletion and export

| Topic | Fact | Evidence |
|---|---|---|
| Joining | Choosing a username creates the Friends profile. There is no separate consent record, version or timestamp beyond `created_at` | M076:299 |
| Switch changes take effect | Immediately. `friend_profile` reads the row on every call; the friend's page is rendered per request | M076:835-850; test "switching sharing off takes effect at once" passed |
| Sharing less while the feature is off | Allowed | `actions/friends.ts:168-169` |
| Removing a friend | Immediate; the pair row is deleted | M076:488 |
| Blocking | Deletes the friendship; closes pending requests between the two; ends an active accountability partnership and deletes its share settings and encouragements | M076:519-531 |
| Unblocking | Removes the block only; the friendship is not restored | M076:551 |
| Account deletion | All six tables reference `auth.users` with `on delete cascade` in every user column. Test "deleting an account removes its username, friendships, requests, blocks and reports" passed | M076:65, 90-91, 105-106, 115-116, 125-126, 142 |
| What survives account deletion | `admin_audit_logs` rows for closed reports (report ID and status; the report itself is gone). Backups and logs: not controlled by this code | `admin.ts:311` |
| Export | Includes own profile, requests visible to the member, friendships, own blocks, own reports, own invites. Gaps in F-11 | `account.ts:72-79` |
| Retention | No automatic deletion of declined, cancelled or accepted requests, used or expired invites, closed reports, or blocks | No purge code found |

## 9. Not built, and the privacy questions each will raise

Source: `docs/friends/FRIENDS_CHALLENGES.md:27-36`. None of the following exists in code.

| Planned | Questions to settle before building |
|---|---|
| **Notification inbox** (phase 2), later push | Does a notification reveal a decline, a removal or a block? What text appears on a locked screen? Which notifications are on by default? Push tokens would be a new data type and possibly a new processor (Apple, Google, a push service) |
| **Accountability inside Friends** (phase 3): weekly goal, on-track status, nudges | "On track / behind" is a judgment about a member's health behaviour shown to another person. Is the shared goal visible? Can nudges be muted? |
| **Comparisons and same-exercise records** (phase 4) | Activates `show_records` and `show_in_leaderboards` (F-09). Strength records can reveal body size and sex-based standards |
| **Challenges** (phase 5): head-to-head and team, steps from Apple Health or Health Connect | Steps and workouts from HealthKit or Health Connect shown to other members: a use to check against Apple's and Google's health-data rules. Team challenges show data to people who are not friends. A shared Bible-reading challenge reveals religious practice to teammates. Who sees results after the challenge ends, and for how long? |
| **Activity feed with fixed reactions** (phase 6) | A feed is a standing disclosure, not a lookup. Per-item or per-type consent? Retention of feed items? Screenshots by others |
| **Weight, nutrition and faith sharing** (switches exist) | Sensitive categories: consent wording, default off, re-consent (F-09) |
| **Moderation tooling** | Suspension, appeal, repeat-offender handling, re-registration after removal, record of actions taken |

## 10. Low-risk technical fixes recommended (not applied)

Each is a small change confined to Friends or accountability. None changes what members can see for the better
without also needing the tests updated.

| # | Where | Change |
|---|---|---|
| 1 | New migration (after 076) | `revoke select (admin_note) on public.user_reports from authenticated, anon;` and grant `SELECT` on the remaining columns only (F-05) |
| 2 | New migration, `search_users` | Count calls per caller inside the function (reuse the `rate_limit_counters` table) and require the caller to have a `social_profiles` row (F-02) |
| 3 | New migration, `send_friend_request` | Move the `friends_blocked` check after the `already_requested` and cooldown checks and return the same outcome a non-blocked sender would see; or accept F-03 and correct the comments |
| 4 | New migration, `friend_invites` | Generate `code` in a `SECURITY DEFINER` function; revoke the direct `insert (inviter_id, code)` grant (F-08) |
| 5 | New migration, all 24 functions | `set search_path = public, pg_temp` (or empty with qualified names) (F-14) |
| 6 | New migration | `revoke select on` the six Friends tables `from anon`; `revoke insert, update, delete on public.accountability_partnerships from anon, authenticated` (F-15) |
| 7 | New migration, `respond_friend_request` | Replace the update-then-raise branch with a plain `raise` (F-16) |
| 8 | `tests/integration/friends.test.ts:52-56, 143` | Seed both workouts inside the same Monday-based week so the test does not depend on the weekday (F-17) |
| 9 | `src/app/(app)/friends/page.tsx:38` | Add one sentence: friends also see the name on your profile (F-07) |
| 10 | `src/lib/domain/friends.ts:66-75` and the privacy page | Hide the five switches that no function reads until each ships (F-09) |
| 11 | `src/app/(app)/friends/invite/[code]/page.tsx` | After sign-in, show the inviter's username before Accept (F-08) |
| 12 | `src/server/actions/accountability.ts:78` | Add the same attempt limit used for friend invites (F-21) |
| 13 | `docs/friends/FRIENDS_CHALLENGES.md:58, 60, 86` | Reword "the decline isn't shown" and "told nothing / never revealed" to "not notified"; record the Monday test failure (F-03, F-04, F-17) |
| 14 | New migration, `send_friend_request` | Per-pair cooldown after a withdrawn request (F-18) |

## 11. Could not be verified

- The browser test `e2e/friends.spec.ts` was not run.
- Nothing was tested on a physical iPhone or Android phone.
- The hosted database (staging or production) was not inspected; grants and policies there may differ if migrations
  were applied differently.
- Who holds the admin role, the service-role key and Supabase dashboard access in production.
- Backup and log retention at the hosting providers.
- F-13 is reasoned from the code and was not demonstrated.
