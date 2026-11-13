# Program library audit and clean-up

Branch `claude/pro-premium` (worktree branch), 2026-11-14. Nothing here is merged, deployed or live.

## Summary

| | Before | After |
|---|---|---|
| Programs in the library (rows / definitions) | 81 (74 training + 7 habit) | 81 (74 training + 7 habit): nothing deleted |
| Training programs shown when browsing, searching, in the API list and in coach suggestions | 74 | 64 |
| Habit programs (`/train/habits`) | 7 | 7 (all kept, unchanged) |
| Exact duplicates (identical week-by-week prescriptions) | 0 | 0 |
| Near-duplicate groups (same goal, level, schedule and progression method) | 9 groups, 10 redundant programs | 0 visible |
| Visible names that are identical or near-identical | 3 pairs | 0 (unit-tested) |
| Names whose duration disagrees with the stored plan | 1 (Wave Strength) | 0 (unit-tested) |
| Programs renamed | | 13 (slugs unchanged) |
| Summaries rewritten with a one-line "who it's for" | | 43 |

What changed, in one paragraph: 10 redundant programs are **retired from browsing** (not deleted, not unpublished)
and point to the program that replaces them; 13 programs get clearer names, including the Wave Strength duration fix;
43 programs whose neighbours look alike now open their summary with who they are for; the browse categories are
reordered so general goals come before specialist disciplines, with two clearer category labels. Members who started
or saved any program keep it exactly as it was.

## Method

1. Every program was expanded week by week with the app's own `expandProgram` and compared on actual content, not
   names: the set of exercises across all weeks and the exact prescriptions (exercise, sets × reps or seconds, by day),
   plus a hash of the full week-by-week prescription to find exact duplicates. Pairs with ≥ 50% exercise overlap were
   read side by side (week 1 and every following week), together with goal, level, days per week, progression method,
   equipment and length. Scratch scripts: `dump.ts`, `sim.ts`, `profile.ts`, `durs.ts` (not committed).
2. A program was judged **redundant** only when another program has the same primary goal, the same level, the same
   number of sessions a week, the same progression method and the same equipment class, and that other program covers
   it (as long or longer, with planned deloads). Programs that share exercises but differ in method (for example AMRAP
   linear progression vs reps-in-reserve volume blocks), audience (women's, 50+, seated) or phase (off-camp vs fight
   camp) were kept and given a "who it's for" line instead.
3. Every number in a name ("N-Week", "N Weeks", "N-Day", "N Days") was checked against the stored weeks and days, and
   every week/day count in summaries and descriptions was reviewed (only Wave Strength was wrong; the rest describe
   blocks inside the plan, e.g. "two 4-week blocks").
4. Member references were traced through the schema (below) before deciding how to hide anything.

The existing guard `programSimilarity` (tests/unit/program-catalog.test.ts) compares first-week prescriptions only
(exercise + sets × reps), so two plans with the same goal and structure but different rep ranges or exercise picks
scored low and passed. That is how the near-duplicates below got in.

## Exact duplicates

None. No two programs have the same week-by-week prescription (hash of every week, day, exercise, sets and reps), and
no two have the same first week.

## Near-duplicate groups and what was done

Exercise overlap = Jaccard overlap of the exercises used across all weeks; prescription overlap = overlap of exact
day/exercise/sets × reps entries.

| # | Group | Evidence (content) | Decision |
|---|---|---|---|
| 1 | "Active Aging: Strength & Balance" (`active-aging-low-impact`, 6 wk) vs "Active Aging Strength and Balance" (`active-aging-strength-and-balance`, 12 wk) | Same name apart from punctuation. Both beginner, 3 days, low impact, bodyweight + dumbbell + band, volume progression. Day A in both: sit-to-stand to a chair, wall/counter push-up, band row, single-leg balance, calf raise; day B: step-ups, carries, standing march. The 6-week has no deload and stops at "one extra set"; the 12-week runs three phases with lighter weeks, harder variations and growing balance holds. | Retire the 6-week → 12-week. Keep "Strong for Life: 2-Day Strength (50+)" (2 days, heavier dumbbell sets of 6–8) and "Seated Strength & Mobility" (chair-based): different audiences. |
| 2 | "Hypertrophy: Upper / Lower Split" (`hypertrophy-upper-lower`, 8 wk) vs "Upper/Lower Hypertrophy" (`upper-lower-hypertrophy-12-week`, 12 wk) | Both intermediate, 4-day upper/lower, muscle first, reps-in-reserve waves that add sets then deload, same gym equipment; exercise overlap 0.66 (bench, squat, RDL, pulldown, rows, leg curl, calf raise in both week 1s). Only length and exercise rotation differ. | Retire the 8-week → 12-week. |
| 3 | "Power & Hypertrophy Upper/Lower (4 Days)" (`power-hypertrophy-upper-lower`, 6 wk) vs "Powerbuilding 4-Day: Strength + Size" (`powerbuilding-4-day`, 8 wk) | Identical week shape: Upper heavy, Lower heavy, Upper hypertrophy, Lower hypertrophy. Both intermediate, strength + size, heavy-day load steps plus RIR volume waves, same equipment. Heavy days 3–5 reps vs 4–6 reps. | Retire the 6-week → Powerbuilding 4-Day. Keep "Power-Hypertrophy 5-Day" (advanced, 5 days with speed work) and "Advanced Bodybuilding" (priority blocks): different method. |
| 4 | "First 5K: Run/Walk to 30 Minutes" (`aerobic-base-run-walk`, 8 wk) vs "Beginner Run/Walk to 5K: 10 Weeks" (`beginner-run-walk-5k-10-week`) | Exercise overlap 1.00 (run/walk intervals, then continuous easy runs). Same start (60 s run / 90 s walk), same 3 sessions a week, same finish (30 minutes continuous); the 10-week adds two step-back weeks and caps weekly growth at about 15%. | Retire the 8-week → 10-week. The Run page now links the 10-week. Keep "Walk to Run" (starts from walking, ends at a 20-minute jog) and "5K Training" (for people who already run 30 minutes). |
| 5 | "Daily Mobility Flow" (`daily-mobility-flow`, 4 wk × 4) vs "Full-Body Mobility: 6-Week Routine" (`full-body-mobility-6-week`, 6 wk × 5) | Exercise overlap 0.80: cat-cow, world's greatest stretch, 90/90, couch stretch, open book, band pass-through, ankle-to-wall, deep squat hold, child's pose in both. Same 15-minute sessions for hips, spine, shoulders and ankles, same method (hold time grows). | Retire the 4-week → 6-week. Recovery page links the 6-week. Keep "Flexibility & Recovery Routines" (adds easy aerobic work, for recovery days) and "Recovery & Deload Week". |
| 6 | "Explosive Athletic Power" (`athletic-power-development`, 6 wk) vs "Power and Athletic Strength" (`power-and-athletic-strength-10-week`, 10 wk) | Both intermediate, 3 days, power first then RPE strength: box jumps, broad jumps, med-ball throws, power cleans, trap-bar work, split squats in both. 10-week adds phases, a deload and a test week. | Retire the 6-week → 10-week. Keep Speed Development and Agility & Footwork (different qualities). |
| 7 | "Home Strength: Bodyweight Builder" (`home-bodyweight-strength`, 4 wk) vs "Bands & Bodyweight Total Body" (`band-bodyweight-total-body`, 6 wk) | Same equipment list (bodyweight, band, mat), same goals (health, strength, fat loss), beginner, 3 days, reps-then-sets progression: push-ups, squats, reverse lunges, glute bridges, band rows, pike push-ups, planks in both. 4-week has no deload. | Retire the 4-week → 6-week. |
| 8 | "Foundations: Full-Body Strength" (`foundations-full-body`, 6 wk) vs "Dumbbell Home Strength" (`dumbbell-home-strength`, 8 wk) — and its name sits next to "Full Body Fitness Foundations" and "Beginner Strength Foundations" | Both beginner, 3 full-body dumbbell sessions, double progression, dumbbells + bench: goblet squat, dumbbell bench, one-arm row, RDL, reverse lunge, seated press, carries and planks in both. | Retire the 6-week → Dumbbell Home Strength. Keep First 30 Days (gym orientation, machines), Full Body Fitness Foundations (gym + conditioning finishers) and Movement Quality Foundations (bodyweight patterns first). |
| 9 | One-week "session libraries": "Athletic Qualities Session Library" (`athletic-qualities-sessions`, 1 wk × 4) and "Combat Conditioning Session Library" (`combat-conditioning-sessions`, 1 wk × 6) | Misleading as programs: their summary says "pick 1–2 a week", but they are stored and shown as "4 (or 6) days/week · 1 week", and a member has only one active program, so starting one pauses their main plan and schedules all sessions in a single week. Their sessions are covered by full programs: athletic library (box jumps, med-ball throws, push press, trap-bar deadlift, split squats, landmine press, chin-ups) by Power and Athletic Strength; combat library (hip escapes, sandbag carries, sprawls, kettlebell swings, heavy-bag rounds, bike and row intervals, footwork) by MMA Fight Conditioning, Boxing: Round Ready and Wrestling & Grappling: Mat Endurance. | Retire both → Power and Athletic Strength / MMA Fight Conditioning. (Owner decision flagged below: the athletic library's grip and rotational-core sessions have no exact equivalent.) |

Kept on purpose although they look alike:

| Pair | Why both stay |
|---|---|
| Push/Pull/Legs 6-day (6 wk) vs Push/Pull/Legs 12-week | Different progression: the 6-week drives a heavy main lift each day with a last-set rep target and linear load jumps (strength + size); the 12-week is two reps-in-reserve volume blocks (muscle). Renamed "Push/Pull/Legs: Strength & Size" and "Push/Pull/Legs: Hypertrophy". |
| Hybrid 8-week vs Hybrid 12-week | Opposite priorities: 3 runs + 2 strength days vs 3 strength days + 2 runs. Renamed "Hybrid: Running Focus" and "Hybrid: Strength Focus". |
| Novice Linear Progression vs Beginner Strength Foundations | Add weight every session (12 wk, resets) vs effort-driven progression with rep step-downs and a 5-rep test (8 wk). |
| Wave Strength vs Intermediate Strength Builder | Both use a training max, but AMRAP 5s/3s/5-3-1 waves (one lift a day) vs accumulate → intensify → realize upper/lower blocks. |
| Glutes & Strength (beginner, 6 wk) vs Lower Body and Glute Development (intermediate, 10 wk) | Different level and length; the summaries now say so. |
| MMA Fight Conditioning vs MMA Fight Camp vs Fighter Off-Camp Strength | No fight booked / fight eight weeks out / between camps (2 days). |
| Strength for Fat-Loss Goals vs Lean & Conditioned | Gym strength-first 4 × a week for 12 weeks vs dumbbell circuits + cardio days. |
| Kettlebell & Bodyweight Circuits vs Conditioning & Intervals | Kettlebell at home vs bike/rower machines. |
| Upper Body / Arms and Shoulders Specialization | Different priority muscles. |

## Names and durations

**Wave Strength (the duration discrepancy).** Stored as 8 weeks with 8 week templates; the name said "4-Week". The
content is two 4-week waves: weeks 1–3 are the 5s / 3s / 5-3-1 weeks of cycle 1 with 5 × 10 volume work, week 4 is a
deload, weeks 5–7 repeat the waves in cycle 2 with 5 × 5 "first set last", and week 8 is a deload; the progression
raises the training max after each deload. So the stored 8 weeks and the content are right and the name was wrong.
Renamed **"Wave Strength: Training-Max Method"**, `duration_weeks` stays 8, and the summary now says "two 4-week
training-max waves (8 weeks)". Shortening it to 4 weeks would have deleted weeks 5–8 (and unlinked any workout logged
in them) for members part-way through.

**Naming pattern.** `<Program>: <what makes it different>`. Weeks appear in a visible name only where the length is
the point (event countdowns: "12-Week Powerlifting Peak", "MMA Fight Camp: 8-Week Countdown"; and "First 30 Days in
the Gym"); everywhere else the card already shows the weeks. Sessions a week are written "N-Day". Retired programs keep
their old names so members who have them recognise them.

| Slug | Before | After | Why |
|---|---|---|---|
| `wave-strength-training-max` | 4-Week Wave Strength: Training-Max Method | Wave Strength: Training-Max Method | Name said 4 weeks; plan is 8 (two 4-week waves) |
| `push-pull-legs-6-day` | Push / Pull / Legs: 6 Days | Push/Pull/Legs: Strength & Size | Near-identical to the other PPL; both are 6 days |
| `push-pull-legs-12-week` | Push/Pull/Legs | Push/Pull/Legs: Hypertrophy | Name was contained in the other PPL's name |
| `hybrid-strength-and-run` | Hybrid: Strength & 5K–10K Running | Hybrid: Running Focus | Say which side has priority |
| `hybrid-strength-run-12-week` | Hybrid Strength + Running: 12-Week Strength-Priority Plan | Hybrid: Strength Focus | Same; drop weeks from the name |
| `walk-to-run-beginner` | Walk to Run: 6 Weeks to Your First 20-Minute Jog | Walk to Run: Your First 20-Minute Jog | Weeks pattern |
| `beginner-run-walk-5k-10-week` | Beginner Run/Walk to 5K: 10 Weeks | Beginner Run/Walk to 5K | Weeks pattern |
| `full-body-mobility-6-week` | Full-Body Mobility: 6-Week Routine | Full-Body Mobility | Weeks pattern |
| `core-strength-stability-8-week` | Core Strength & Stability: 8 Weeks | Core Strength & Stability | Weeks pattern |
| `aerobic-endurance-builder-8-week` | Aerobic Endurance Builder: 8 Weeks | Aerobic Endurance Builder | Weeks pattern |
| `mma-fight-camp-3-day` | MMA Fight Camp: 8 Weeks (3 Days) | MMA Fight Camp: 8-Week Countdown | Countdown is the point; one format |
| `mma-off-camp-2-day` | Off-Camp Strength for Fighters (2 Days) | Fighter Off-Camp Strength: 2-Day | "N-Day" format |
| `full-body-hypertrophy-3-day` | Full-Body Hypertrophy: 3 Days | Full-Body Hypertrophy: 3-Day | "N-Day" format |

Slugs are never changed: they derive the stable ids (`stableUuid("program:<slug>")`) that members' rows point to.
Two cosmetic inconsistencies were left alone to avoid churn in names members already see: "Full Body Fitness
Foundations" (no hyphen) and "Calisthenics Strength: Upper / Lower" (spaced slash).

## Easier browsing

* **Category order** (`SPEC_CATEGORIES`, src/lib/domain/program-catalog.ts): general goals first — Beginner, Strength,
  Bodybuilding, Fat loss & conditioning, Running & endurance, Home, Active aging, Mobility — then specialist
  disciplines — Bench/squat/deadlift, Calisthenics, Speed/agility/power, Combat, Strongman. Same 13 categories, same
  ids and URLs.
* **Clearer labels:** "Functional, circuits & intervals" → "Fat loss, circuits & conditioning" (it holds the two
  fat-loss programs); "Endurance & hybrid" → "Running, endurance & hybrid".
* **Who it's for:** 43 summaries now open with "For …:" so similar programs can be told apart on the card (the card
  shows the first two lines of the summary). No new UI.
* **Fewer look-alikes:** 64 programs to browse instead of 74; no visible pair of names is identical or contained in
  the other (unit test).

## Member references and how they are preserved

Where members point at a library program (from the migrations):

| Reference | Column | On program/day delete | Effect of this change |
|---|---|---|---|
| Enrollment / active plan | `user_programs.program_id` → `training_programs.id` | cascade (enrollment deleted) | Unchanged: no program row is deleted |
| Logged workouts | `workout_sessions.program_day_id` → `program_days.id`; `user_program_id` → `user_programs.id` | set null (workout unlinked) | Unchanged: no week or day is removed (Wave Strength keeps 8 weeks) |
| Calendar moves | `planned_session_overrides.program_day_id` | cascade | Unchanged |
| Coach training adjustments | `training_adjustments.program_id` | cascade | Unchanged |
| Partner summaries | `accountability_summary()` shows `training_programs.name` for published library programs | — | Shows the new name; still published so still shown |
| Access | `training_programs_read`, `can_view_program`, `can_use_program`, `program_of_week/day`, `check_member_reference` | — | Unchanged: retired programs stay `is_published = true` |

**Why retired programs are not unpublished.** The brief suggested `is_published = false`. That flag is not just
"listed": `training_programs_read`, `can_view_program`, `program_of_week`/`program_of_day` and the
`check_member_reference` trigger all require `is_published` (or ownership), so an enrolled member would lose sight of
the program row, its weeks and days, and could no longer log a workout against them. Checked in a throwaway database
(below): with the flag set to false, a member's active plan showed 0 visible weeks and logging a workout inserted
nothing. There is no other "listed" flag in the schema, so retirement lives in the catalog source
(`src/data/program-retirements.ts`, next to the milestones and instructions that also live in app code) and is
applied where programs are offered:

* library page (`/train/programs`) list and categories — retired ones left out; "My programs" still shows them;
* search (`/search`), `GET /api/v1/programs`, the AI coach's ranked suggestions and `propose_program` (refuses a
  retired slug and names the replacement);
* in-app links: Run page (First 5K → Beginner Run/Walk to 5K), Recovery page (Daily Mobility Flow → Full-Body
  Mobility; low-impact link → Active Aging Strength and Balance), rest-day activity text, demo seed.

The retired program's own page still works by slug for everyone and shows: "Retired from the library: <replacement>
covers …", plus, for members who have it, "Your copy of this program, its progress and your logged workouts stay
exactly as they are." Starting it from a direct link is still possible (no enrollment logic changed). To bring one
back, delete its entry from `RETIRED_PROGRAMS`; no data change is needed.

Local database check (read-only, shared DB): `user_programs` references to curated programs are 5k-training (saved),
foundations-full-body (saved, now retired) and powerbuilding-4-day (active, 8 logged workouts; kept). Production is
unknown, so every program was treated as referenced.

## Database change

`supabase/migrations/20261114000070_program_library_cleanup.sql`: 44 `update … set name/summary … where slug = …`
statements for curated programs only, with the full rollback (old names and summaries) in its header. It touches no
ids, weeks, days, exercises, tiers or `is_published`. `supabase/seed.sql` was regenerated (`npx tsx
scripts/generate-seed.ts`; only those 44 program rows changed) and `supabase/setup-all.sql` rebuilt (`bash
scripts/bundle-sql.sh`).

Verified in a throwaway Postgres container (`supabase/postgres:17.11.0.004` on its own port, removed afterwards;
the shared local database was not touched):

1. Built the **old** database (previous `setup-all.sql`: migrations 001–069 + old seed), then added a member part-way
   through Wave Strength (week 6, a workout logged on week 6 day 1, a calendar move on week 7) and a member active on
   `foundations-full-body` (logged workout) with `aerobic-base-run-walk` saved.
2. Applied migration 070, then the new seed, then both again (idempotent): all exit 0.
3. No curated program changed id, `is_published`, `duration_weeks`, week count or day ids; 13 names changed; 74/74
   still published; Wave Strength = "Wave Strength: Training-Max Method", 8 weeks; both workouts still linked to
   their days, the calendar move intact, enrollments at the same week.
4. Signed in as the member on the retired programs (a Free member): reads both programs, all weeks, days and
   exercises (`can_use_program` true via the enrollment) and logs a new workout against a retired program's day.
5. Control (rolled back): with `is_published = false` the same member saw 0 program rows and 0 plan weeks.
6. The header rollback restores all names; re-applying 070 renames again. A **fresh** database from the new
   `setup-all.sql` also builds cleanly (74 published programs).

## Every program (81)

Category is the browse group after this change. Goal = first two goals. Weeks/days are stored values. Tier: `plus`
programs are legacy Plus (Pro includes them); unchanged.

| # | Name (after) | Slug | Browse group | Goal | Level | Weeks | Days/wk | Progression method | Equipment | Tier | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | First 30 Days in the Gym | `first-30-days-in-the-gym` | Beginner & general fitness | General health, Strength | beginner | 4 | 3 | Sets then load, RPE 6→7.5 | machine, dumbbell, bench, bodyweight, bike, rower | pro | Keep + who-it's-for summary |
| 2 | Foundations: Full-Body Strength | `foundations-full-body` | Beginner & general fitness | General health, Strength | beginner | 6 | 3 | Double progression, RPE 6→8 | dumbbell, bodyweight, bench, band | pro | **Retire from browse** → `dumbbell-home-strength` |
| 3 | Full Body Fitness Foundations | `full-body-fitness-foundations` | Beginner & general fitness | General health, Strength | beginner | 8 | 3 | Double progression + finisher time ↑ | dumbbell, bench, machine, bodyweight, bike, rower | pro | Keep + who-it's-for summary |
| 4 | Movement Quality Foundations: Squat, Hinge, Lunge, Push, Pull, Carry | `movement-quality-foundations` | Beginner & general fitness | General health, Strength | beginner | 6 | 3 | Bodyweight → light load, sets/reps ↑ | bodyweight, dumbbell, band, bench | pro | Keep + who-it's-for summary |
| 5 | 12-Week Powerlifting Peak | `powerlifting-peaking-12-week` | Strength & powerlifting | Strength | advanced | 12 | 4 | Block periodization (% 1RM) to a meet | barbell, rack, bench, dumbbell, cable, machine, pull up bar | plus | Keep |
| 6 | Beginner Strength Foundations | `beginner-strength-foundations-8-week` | Strength & powerlifting | Strength, General health | beginner | 8 | 3 | Effort-driven linear (RIR), reps 8→6→5, 5-rep test | barbell, rack, bench, pull up bar, cable | pro | Keep + who-it's-for summary |
| 7 | Conjugate 4-Day: Max Effort & Dynamic Effort | `conjugate-4-day` | Strength & powerlifting | Strength | advanced | 8 | 4 | Max-effort / dynamic-effort rotation | barbell, rack, bench, box, dumbbell, cable, machine, pull up bar, sled | plus | Keep |
| 8 | Glutes & Strength: 4-Day Upper/Lower | `womens-glute-strength` | Strength & powerlifting | Muscle, Strength | beginner | 6 | 4 | RIR volume block (sets ↑), deload | barbell, rack, bench, dumbbell, cable, machine, band, pull up bar | plus | Keep + who-it's-for summary |
| 9 | Intermediate Strength Builder | `intermediate-strength-builder-upper-lower` | Strength & powerlifting | Strength, Muscle | intermediate | 12 | 4 | Training-max % blocks: accumulate → intensify → realize | barbell, rack, bench, dumbbell, pull up bar, cable, ab wheel | pro | Keep + who-it's-for summary |
| 10 | Novice Linear Progression: 3×5 Barbell | `barbell-strength-foundations` | Strength & powerlifting | Strength, Muscle | beginner | 12 | 3 | Novice linear: +load every session, 10% resets | barbell, rack, bench, pull up bar | pro | Keep + who-it's-for summary |
| 11 | Powerbuilding 4-Day: Strength + Size | `powerbuilding-4-day` | Strength & powerlifting | Strength, Muscle | intermediate | 8 | 4 | Heavy-day load steps + RIR volume waves | barbell, rack, bench, dumbbell, cable, machine, pull up bar | plus | Keep + who-it's-for summary |
| 12 | Powerlifting Base Block | `powerlifting-base-block` | Strength & powerlifting | Strength | intermediate | 8 | 4 | % 1RM +2.5%/week with RPE caps | barbell, rack, bench, dumbbell, cable | plus | Keep |
| 13 | Strong Foundations: Women's Strength | `womens-strength-progression` | Strength & powerlifting | Strength, Muscle | beginner | 8 | 3 | RPE load progression 7→9 | barbell, dumbbell, bench, rack, pull up bar, band, cable | plus | Keep + who-it's-for summary |
| 14 | Tiered Strength: Heavy, Volume & Pump | `tiered-strength-program` | Strength & powerlifting | Strength, Muscle | beginner | 12 | 4 | Tiered (T1/T2/T3) linear with stage resets | barbell, rack, bench, cable, dumbbell | plus | Keep |
| 15 | Wave Strength: Training-Max Method | `wave-strength-training-max` | Strength & powerlifting | Strength, Muscle | intermediate | 8 | 4 | Training-max waves, last set AMRAP, TM raised per wave | barbell, rack, bench, pull up bar, dumbbell, cable, dip station | plus | **Rename + fix duration** (was "4-Week Wave Strength: Training-Max Method"; content is 8 weeks) |
| 16 | Weekly Undulating Strength: Volume, Light & Heavy Days | `intermediate-weekly-undulating` | Strength & powerlifting | Strength | intermediate | 8 | 3 | Weekly undulating (volume/light/heavy), weekly PRs | barbell, rack, bench, pull up bar | plus | Keep + who-it's-for summary |
| 17 | Advanced Bodybuilding | `advanced-bodybuilding-5-day` | Bodybuilding & muscle | Muscle, Strength | advanced | 12 | 5 | Three priority blocks (RIR, sets ↑) | barbell, rack, bench, dumbbell, cable, machine, pull up bar | pro | Keep + who-it's-for summary |
| 18 | Arms and Shoulders Specialization | `arms-shoulders-specialization` | Bodybuilding & muscle | Muscle | intermediate | 8 | 4 | Priority volume blocks, rest at maintenance | barbell, rack, bench, dumbbell, cable, machine, pull up bar | pro | Keep |
| 19 | Beginner Muscle Builder | `beginner-muscle-builder` | Bodybuilding & muscle | Muscle, General health | beginner | 8 | 3 | Double progression in two RIR blocks | barbell, rack, bench, dumbbell, cable, machine | pro | Keep + who-it's-for summary |
| 20 | Full-Body Hypertrophy: 3-Day | `full-body-hypertrophy-3-day` | Bodybuilding & muscle | Muscle, Strength | beginner | 6 | 3 | RIR volume block (sets ↑), deload | barbell, rack, bench, dumbbell, cable, machine | pro | **Rename** (was "Full-Body Hypertrophy: 3 Days") + who-it's-for |
| 21 | Hypertrophy: Upper / Lower Split | `hypertrophy-upper-lower` | Bodybuilding & muscle | Muscle, Strength | intermediate | 8 | 4 | Two RIR volume waves, deloads | barbell, dumbbell, bench, cable, machine, rack, pull up bar | plus | **Retire from browse** → `upper-lower-hypertrophy-12-week` |
| 22 | Lower Body and Glute Development | `lower-body-glute-development` | Bodybuilding & muscle | Muscle, Strength | intermediate | 10 | 4 | Priority volume blocks, upper at maintenance | barbell, rack, bench, dumbbell, cable, machine, pull up bar, band | pro | Keep + who-it's-for summary |
| 23 | Physique Show Prep | `physique-show-prep` | Bodybuilding & muscle | Muscle, Fat loss | advanced | 12 | 5 | RIR volume + rising conditioning to show week | barbell, rack, bench, dumbbell, cable, machine, pull up bar, bike | plus | Keep |
| 24 | Power & Hypertrophy Upper/Lower (4 Days) | `power-hypertrophy-upper-lower` | Bodybuilding & muscle | Muscle, Strength | intermediate | 6 | 4 | Power days +load; hypertrophy days RIR block | barbell, rack, bench, dumbbell, cable, machine, pull up bar | plus | **Retire from browse** → `powerbuilding-4-day` |
| 25 | Power-Hypertrophy 5-Day | `power-hypertrophy-5-day` | Bodybuilding & muscle | Muscle, Strength | advanced | 6 | 5 | Power days +load, speed sets, hypertrophy RIR block | barbell, rack, bench, dumbbell, cable, machine, pull up bar, dip station | plus | Keep + who-it's-for summary |
| 26 | Push/Pull/Legs: Hypertrophy | `push-pull-legs-12-week` | Bodybuilding & muscle | Muscle | intermediate | 12 | 6 | Two 6-week RIR volume blocks | barbell, rack, bench, dumbbell, cable, machine, pull up bar | pro | **Rename** (was "Push/Pull/Legs") + who-it's-for |
| 27 | Push/Pull/Legs: Strength & Size | `push-pull-legs-6-day` | Bodybuilding & muscle | Muscle, Strength | intermediate | 6 | 6 | Main lift AMRAP linear + accessory volume block | barbell, rack, bench, dumbbell, cable, machine, pull up bar | plus | **Rename** (was "Push / Pull / Legs: 6 Days") + who-it's-for |
| 28 | Upper Body Specialization | `upper-body-specialization` | Bodybuilding & muscle | Muscle | intermediate | 8 | 4 | Priority volume blocks, legs at maintenance | barbell, rack, bench, dumbbell, cable, machine, pull up bar | pro | Keep |
| 29 | Upper/Lower Hypertrophy | `upper-lower-hypertrophy-12-week` | Bodybuilding & muscle | Muscle, Strength | intermediate | 12 | 4 | Three RIR mesocycles with exercise rotation | barbell, rack, bench, dumbbell, cable, machine, pull up bar | pro | Keep + who-it's-for summary |
| 30 | Conditioning & Intervals: Bike, Rower and Kettlebell | `conditioning-intervals-8-week` | Fat loss, circuits & conditioning | Conditioning, Fat loss | intermediate | 8 | 3 | Work:rest ratios tighten (density) | bike, rower, kettlebell, bodyweight | pro | Keep + who-it's-for summary |
| 31 | Functional Engine | `functional-engine` | Fat loss, circuits & conditioning | Conditioning, Fat loss | intermediate | 4 | 4 | Density (rounds ↑ / rest ↓), strength to RPE 8 | barbell, rack, kettlebell, dumbbell, rower, box, pull up bar, jump rope, medicine ball, bike | plus | Keep + who-it's-for summary |
| 32 | Kettlebell & Bodyweight Circuits | `kettlebell-circuit-intervals` | Fat loss, circuits & conditioning | Conditioning, Fat loss | intermediate | 6 | 3 | Density (rounds ↑ / rest ↓) | kettlebell, dumbbell, bodyweight, jump rope | plus | Keep + who-it's-for summary |
| 33 | Lean & Conditioned | `lean-and-conditioned` | Fat loss, circuits & conditioning | Fat loss, General health | beginner | 6 | 4 | Cardio time + interval rounds ↑, sets 3→4 | dumbbell, bodyweight, bike, rower, band | plus | Keep + who-it's-for summary |
| 34 | Strength for Fat-Loss Goals | `strength-for-fat-loss` | Fat loss, circuits & conditioning | Fat loss, Strength | beginner | 12 | 4 | Three blocks 10–12 → 6–8 reps, conditioning time ↑ | dumbbell, bench, machine, bodyweight, bike, rower | pro | Keep + who-it's-for summary |
| 35 | 10K Training: Build to 10 Kilometres | `10k-training` | Running, endurance & hybrid | Conditioning, General health | intermediate | 10 | 4 | Easy volume ↑ + one quality session, taper | bodyweight | plus | Keep |
| 36 | 5K Training: Run Your Best 5K | `5k-training` | Running, endurance & hybrid | Conditioning, General health | intermediate | 8 | 3 | Easy volume ↑ + one quality session, taper | bodyweight | plus | Keep + who-it's-for summary |
| 37 | Aerobic Endurance Builder | `aerobic-endurance-builder-8-week` | Running, endurance & hybrid | Conditioning, General health | beginner | 8 | 3 | Easy time ≤ 10%/week, tempo from week 5 | bodyweight | pro | **Rename** (was "Aerobic Endurance Builder: 8 Weeks") + who-it's-for |
| 38 | Beginner Run/Walk to 5K | `beginner-run-walk-5k-10-week` | Running, endurance & hybrid | Conditioning, General health | beginner | 10 | 3 | Run/walk ≤ 15%/week, 2 step-back weeks | bodyweight | pro | **Rename** (was "Beginner Run/Walk to 5K: 10 Weeks") + who-it's-for |
| 39 | First 5K: Run/Walk to 30 Minutes | `aerobic-base-run-walk` | Running, endurance & hybrid | Conditioning, General health | beginner | 8 | 3 | Run/walk: run bouts ↑, walks ↓ | bodyweight | pro | **Retire from browse** → `beginner-run-walk-5k-10-week` |
| 40 | Half Marathon: 80/20 Base to Race | `half-marathon-base-80-20` | Running, endurance & hybrid | Conditioning, General health | intermediate | 12 | 4 | 80/20 running volume ↑, cutbacks, taper | bodyweight, dumbbell | plus | Keep |
| 41 | Hybrid: Running Focus | `hybrid-strength-and-run` | Running, endurance & hybrid | Conditioning, Strength | intermediate | 8 | 5 | Strength RPE 7–8 + running time +10%/week | barbell, rack, bench, dumbbell, pull up bar, bodyweight | plus | **Rename** (was "Hybrid: Strength & 5K–10K Running") + who-it's-for |
| 42 | Hybrid: Strength Focus | `hybrid-strength-run-12-week` | Running, endurance & hybrid | Strength, Conditioning | intermediate | 12 | 5 | Strength 6s → 5s → 3s; running ≤ 10%/week | barbell, rack, bench, dumbbell, pull up bar, bodyweight | pro | **Rename** (was "Hybrid Strength + Running: 12-Week Strength-Priority Plan") + who-it's-for |
| 43 | Walk to Run: Your First 20-Minute Jog | `walk-to-run-beginner` | Running, endurance & hybrid | Conditioning, General health | beginner | 6 | 3 | Walk/jog: jog bouts ↑ | bodyweight | pro | **Rename** (was "Walk to Run: 6 Weeks to Your First 20-Minute Jog") + who-it's-for |
| 44 | Bands & Bodyweight Total Body | `band-bodyweight-total-body` | Home, dumbbell, band & bodyweight | General health, Strength | beginner | 6 | 3 | Reps → heavier band / harder variation | band, bodyweight | plus | Keep + who-it's-for summary |
| 45 | Busy Schedule: 30-Minute Workouts | `busy-schedule-30-minute-workouts` | Home, dumbbell, band & bodyweight | General health, Strength | beginner | 8 | 3 | Density in a fixed 30 min | dumbbell, bench, bodyweight | pro | Keep + who-it's-for summary |
| 46 | Core Strength & Stability | `core-strength-stability-8-week` | Home, dumbbell, band & bodyweight | Strength, General health | beginner | 8 | 3 | Holds/reps ↑, then harder versions | bodyweight, band, dumbbell, ab wheel, bench | pro | **Rename** (was "Core Strength & Stability: 8 Weeks") |
| 47 | Dumbbell Home Strength | `dumbbell-home-strength` | Home, dumbbell, band & bodyweight | Strength, Muscle | beginner | 8 | 3 | Double progression (next dumbbell) | dumbbell, bench, bodyweight | plus | Keep + who-it's-for summary |
| 48 | Home Strength: Bodyweight Builder | `home-bodyweight-strength` | Home, dumbbell, band & bodyweight | General health, Strength | beginner | 4 | 3 | Reps then sets, harder variations | bodyweight, band | pro | **Retire from browse** → `band-bodyweight-total-body` |
| 49 | Active Aging Strength and Balance | `active-aging-strength-and-balance` | Active aging, seated & low-impact | General health, Strength | beginner | 12 | 3 | Three phases: harder variations, balance holds ↑ | bodyweight, dumbbell, band | pro | Keep + who-it's-for summary |
| 50 | Active Aging: Strength & Balance | `active-aging-low-impact` | Active aging, seated & low-impact | General health, Mobility | beginner | 6 | 3 | Reps then sets (RPE ≤ 7) | bodyweight, dumbbell, band | pro | **Retire from browse** → `active-aging-strength-and-balance` |
| 51 | Seated Strength & Mobility | `seated-strength-mobility` | Active aging, seated & low-impact | General health, Mobility | beginner | 6 | 3 | Reps then sets, deload | bodyweight, dumbbell, band | pro | Keep + who-it's-for summary |
| 52 | Strong for Life: 2-Day Strength (50+) | `active-aging-strength-2-day` | Active aging, seated & low-impact | General health, Strength | beginner | 8 | 2 | RPE linear, 12s → 6–8s, 2 deloads | dumbbell, bench, band | plus | Keep + who-it's-for summary |
| 53 | Daily Mobility Flow | `daily-mobility-flow` | Mobility, warm-ups & recovery | Mobility, General health | beginner | 4 | 4 | Hold time +5 s/week | band, bodyweight | pro | **Retire from browse** → `full-body-mobility-6-week` |
| 54 | Flexibility & Recovery Routines | `flexibility-recovery-routines` | Mobility, warm-ups & recovery | Mobility, General health | beginner | 6 | 4 | Easy aerobic time and hold time ↑ | bodyweight, band | pro | Keep + who-it's-for summary |
| 55 | Full-Body Mobility | `full-body-mobility-6-week` | Mobility, warm-ups & recovery | Mobility, General health | beginner | 6 | 5 | Hold time and sets ↑ | band, bodyweight | pro | **Rename** (was "Full-Body Mobility: 6-Week Routine") + who-it's-for |
| 56 | Recovery & Deload Week | `recovery-deload-week` | Mobility, warm-ups & recovery | General health, Mobility | beginner | 1 | 3 | None (one easy week) | bodyweight, dumbbell, band, bike | pro | Keep + who-it's-for summary |
| 57 | Bench Press Specialist | `bench-press-specialist` | Bench, squat & deadlift | Strength, Muscle | intermediate | 8 | 4 | RPE 7→9 load progression | barbell, rack, bench, dumbbell, cable, pull up bar | plus | Keep |
| 58 | Deadlift Specialist | `deadlift-specialist` | Bench, squat & deadlift | Strength | intermediate | 8 | 3 | RPE 7→9 load progression | barbell, rack, bench, dumbbell, cable, pull up bar | plus | Keep |
| 59 | Squat Specialist | `squat-specialist` | Bench, squat & deadlift | Strength, Muscle | intermediate | 8 | 4 | RPE 7→9 load progression | barbell, rack, bench, dumbbell, machine, pull up bar | plus | Keep |
| 60 | Calisthenics Foundations | `calisthenics-foundations` | Calisthenics | Strength, Muscle | beginner | 8 | 3 | Double progression through skill progressions | bodyweight, pull up bar, band | pro | Keep |
| 61 | Calisthenics Strength: Upper / Lower | `calisthenics-strength-upper-lower` | Calisthenics | Strength, Muscle | intermediate | 8 | 4 | Volume waves, weighted progressions | bodyweight, pull up bar, dip station, bench | plus | Keep |
| 62 | Agility & Footwork | `agility-footwork` | Speed, agility & power | Athletic performance | beginner | 6 | 3 | Drill reps ↑ while quality holds | bodyweight, dumbbell, box, band | pro | Keep |
| 63 | Athletic Qualities Session Library | `athletic-qualities-sessions` | Speed, agility & power | Athletic performance, Combat sports | intermediate | 1 | 4 | Repeat sessions (no weekly plan) | barbell, medicine ball, box, cable, band, pull up bar, dumbbell, kettlebell, trap bar, landmine | plus | **Retire from browse** → `power-and-athletic-strength-10-week` |
| 64 | Explosive Athletic Power | `athletic-power-development` | Speed, agility & power | Athletic performance, Strength | intermediate | 6 | 3 | Low-contact power + RPE 7→9 strength | barbell, rack, box, medicine ball, dumbbell, kettlebell, trap bar, pull up bar, landmine | plus | **Retire from browse** → `power-and-athletic-strength-10-week` |
| 65 | Power and Athletic Strength | `power-and-athletic-strength-10-week` | Speed, agility & power | Athletic performance, Strength | intermediate | 10 | 3 | Power by intent + RIR strength, test week | barbell, rack, bench, box, trap bar, medicine ball, pull up bar, dumbbell | pro | Keep + who-it's-for summary |
| 66 | Speed Development | `speed-development` | Speed, agility & power | Athletic performance | intermediate | 6 | 3 | Sprint reps/distance ↑ at full rest | bodyweight, barbell, rack, dumbbell, box | plus | Keep |
| 67 | Boxing: Round Ready | `boxing-round-ready` | MMA, boxing & grappling | Combat sports, Conditioning | beginner | 4 | 3 | Density (rounds ↑ / rest ↓) | jump rope, heavy bag, dumbbell, medicine ball, bodyweight | plus | Keep |
| 68 | Combat Conditioning Session Library | `combat-conditioning-sessions` | MMA, boxing & grappling | Combat sports, Conditioning | intermediate | 1 | 6 | Repeat sessions, +rounds / −rest | kettlebell, sandbag, pull up bar, bike, rower, jump rope, heavy bag | plus | **Retire from browse** → `mma-fight-conditioning` |
| 69 | Fighter Off-Camp Strength: 2-Day | `mma-off-camp-2-day` | MMA, boxing & grappling | Combat sports, Strength | beginner | 8 | 2 | RPE linear, sets of 5 → triples | barbell, trap bar, dumbbell, medicine ball, box, pull up bar, bench, rack | pro | **Rename** (was "Off-Camp Strength for Fighters (2 Days)") + who-it's-for |
| 70 | MMA Fight Camp: 8-Week Countdown | `mma-fight-camp-3-day` | MMA, boxing & grappling | Combat sports, Conditioning | intermediate | 8 | 3 | Fight-camp periodization (base → peak → fight week) | trap bar, dumbbell, medicine ball, bike, heavy bag, pull up bar, box, landmine, band, bench | plus | **Rename** (was "MMA Fight Camp: 8 Weeks (3 Days)") + who-it's-for |
| 71 | MMA Fight Conditioning | `mma-fight-conditioning` | MMA, boxing & grappling | Combat sports, Conditioning | intermediate | 6 | 3 | Density, strength held at 2–3 RIR | barbell, trap bar, kettlebell, medicine ball, bike, jump rope, heavy bag, pull up bar, sandbag, landmine | plus | Keep + who-it's-for summary |
| 72 | Wrestling & Grappling: Mat Endurance | `grappling-mat-endurance` | MMA, boxing & grappling | Combat sports, Conditioning | intermediate | 4 | 3 | Density (rounds ↑ / rest ↓) | kettlebell, sandbag, pull up bar, barbell, dumbbell, landmine | plus | Keep |
| 73 | Strongman 4-Day: Statics & Events | `strongman-4-day-events` | Strongman | Strength, Athletic performance | intermediate | 8 | 4 | Two 3-week waves (triples → doubles), timed events | barbell, rack, bench, strongman implements, sled, cable, pull up bar | plus | Keep |
| 74 | Strongman Foundations | `strongman-foundations` | Strongman | Strength, Athletic performance | beginner | 6 | 3 | RPE linear on events and lifts | barbell, rack, sandbag, sled, dumbbell, kettlebell | pro | Keep |
| 75 | Nutrition Foundations | `nutrition-foundations` | Habit programs (/train/habits) | nutrition | beginner | 28 days | — | Daily/weekly habit check-ins (80% completion) | — | pro | Keep |
| 76 | Sustainable Fat-Loss Habits | `sustainable-fat-loss` | Habit programs (/train/habits) | nutrition | all | 84 days | — | Daily/weekly habit check-ins (80% completion) | — | pro | Keep |
| 77 | Muscle-Gain Nutrition | `muscle-gain-nutrition` | Habit programs (/train/habits) | nutrition | all | 56 days | — | Daily/weekly habit check-ins (80% completion) | — | pro | Keep |
| 78 | Meal Prep and Protein Planning | `meal-prep-protein` | Habit programs (/train/habits) | nutrition | all | 42 days | — | Daily/weekly habit check-ins (80% completion) | — | pro | Keep |
| 79 | Faith and Fitness Foundations | `faith-fitness-foundations` | Habit programs (/train/habits) | faith & fitness | beginner | 56 days | — | Daily/weekly habit check-ins (80% completion) | — | pro | Keep |
| 80 | Strength and Scripture | `strength-and-scripture` | Habit programs (/train/habits) | faith & fitness | intermediate | 84 days | — | Daily/weekly habit check-ins (80% completion) | — | pro | Keep |
| 81 | Ninety-Day Healthy Habits Journey | `healthy-habits-90` | Habit programs (/train/habits) | lifestyle | all | 90 days | — | Daily/weekly habit check-ins (80% completion) | — | pro | Keep |

## Tests

`tests/unit/program-library-cleanup.test.ts`:

* no two visible programs (64 training + 7 habit) have names that are identical, contained in one another, or share
  60% or more of their words; the three near-identical pairs found here are no longer both visible;
* every "N-Week"/"N Weeks"/"N-Day"/"N Days" in any program name (retired ones too, and habit programs) matches the
  stored weeks, sessions a week or days; weeks appear in visible names only for event countdowns; Wave Strength is 8
  weeks with deloads in weeks 4 and 8 and its name and summary say so;
* the similar programs that stay visible each open their summary with who they are for;
* every retired program still resolves by slug with all its weeks and days, is still seeded `is_published = true`
  under the same slug (so the same stable id), is never unpublished or deleted by any migration, points to a listed
  program that shares a goal, and is left out of browsing, coach suggestions and coach proposals; every browse
  category still has programs;
* migration 070 only updates names and summaries and writes exactly what the seed writes.

Existing guards still pass (program structure, catalog batches, seed keeps history attached, coach program tools).

## For the owner to decide

1. **The two one-week session libraries.** Retired because they don't work as programs (one active program at a time;
   all sessions land in one week). If you want them back as add-on sessions, that needs a different home (for example
   as workout templates), which is a new feature and was not done. The athletic library's grip-endurance and
   rotational-core sessions have no exact equivalent in the remaining programs.
2. **Retired programs can still be started from a direct link** (the page says it is retired and links the
   replacement). Blocking new starts would mean changing the start action; not done, to keep enrollment logic as it was.
3. **Borderline keeps** you may want to merge later: Explosive Athletic Power was retired but Speed Development and
   Agility & Footwork remain separate; "Push/Pull/Legs: Strength & Size" vs "Push/Pull/Legs: Hypertrophy" and the two
   hybrid plans are kept because their progression or priority differs.
4. **Plus vs Pro tier** labels were left as they are (37/37); unifying them is a pricing decision, not a clean-up.
5. **No professional review** has happened for any program; the "not yet reviewed" flags are unchanged.
6. `docs/pro/MIGRATIONS_AND_ROLLBACK.md` previously suggested hiding programs with `is_published = false`; it now
   says not to (see "Why retired programs are not unpublished").
