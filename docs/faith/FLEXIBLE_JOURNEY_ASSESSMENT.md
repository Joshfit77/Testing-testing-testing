# A separate flexible journey mode: assessment

**Status:** this is an assessment only. **Nothing has changed.** The strict rule stays exactly as it is: a journey day
needs both Bible reading and prayer, and a missed day restarts the journey at Day 1, enforced in the database by
`faith_journey_settle_at` (migration 053). A flexible mode would be an *additional, opt-in* choice, built only if the
owner approves it.

## Should there be one?

The independent review (§8 of the Faith review, 2026-11-03) concluded:

- **Strict works as a commitment device people choose.** Members tick an acknowledgement when they enrol, and it
  fits the Narrow Gate identity. Keep it as the default and the signature.
- **As the only mode it will mostly produce resets on long plans.**
  - A member who completes 99% of days has about a 2.6% chance of finishing a 365-day strict journey.
  - Research on streaks finds people drop off after a break, especially one they blame themselves for.
  - Mainstream Bible apps choose forgiveness: YouVersion offers "Catch Me Up".
- **The app already has precedent for forgiveness:**
  - the 40-day Faith & Fitness challenge lets people catch up;
  - practices can be ticked up to six days late.

Recommendation:

1. **For the TestFlight cohort, keep Strict as the only mode,** and measure what happens. The data is already
   recorded (see "Measuring it" below).
2. **First, remove the accidental resets the review found** (fixes not yet approved):
   - writing a prayer doesn't mark prayer done;
   - reading in the Bible reader doesn't mark reading done;
   - the Prayer and Scripture practices look as if they count toward the journey.

   A reset should only ever follow a real miss. Without these fixes, the data would mostly measure the traps.
3. **Then decide on a flexible mode with the data,** at the latest for the 180- and 365-day plans.

## Options, least to most lenient

| Option | What a miss does | Fits the brand? | Build size |
| --- | --- | --- | --- |
| A. Stage restarts | Long plans are split into 30- or 90-day "gates"; a miss restarts the current gate, not the whole plan | Yes (still strict, smaller scope) | S–M |
| B. One repair | Within 24 hours, completing both days' reading and prayer repairs the miss; otherwise strict restart | Mostly | M |
| C. Declared rest days | A planned pause chosen in advance (illness, travel) doesn't count as a miss | Yes | M |
| D. Steady pace (flexible) | A miss never restarts: the plan's Day N advances only on days with reading and prayer done, so the end date moves | A separate, gentler mode | M |

Option D is the true "flexible mode". A–C keep the strict identity, so they could be offered inside strict.

## If D is approved: design that leaves Strict untouched

- **Data:** add `faith_journeys.mode text not null default 'strict' check (mode in ('strict', 'flexible'))`.
  - Every existing journey stays strict because of the default.
  - The mode is chosen at enrolment and can't be changed mid-journey. Optionally, strict → flexible could be allowed
    with a confirmation, but never the reverse.
- **Rule:** in `faith_journey_settle_at`, flexible journeys skip the interruption branch. A missed date just isn't
  counted; the day number becomes "completed days + 1", and the plan ends after `duration_days` completed days. The
  strict branch is not edited.
- **Screens:**
  - Enrolment offers "Narrow Gate (strict)", the default, and "Steady pace (flexible)", each with a one-line
    explanation.
  - The Today card shows "Day N of 90". It never shows a miss count or a guilt message.
- **Reminders:** only strict journeys get the before-midnight reminder. The planner's journey flag would become
  "strict journey active". Today it is "journey active", which is correct while only strict exists.
- **Ranks and badges:** decide whether flexible completions count the same. The review suggests counting journey
  *days* toward Faith totals in both modes.
- **Tests:**
  - every existing strict test must stay unchanged and green;
  - new database tests: a flexible miss doesn't create an interrupted attempt, the day number, the end date, and
    the mode can't be changed by a member mid-journey;
  - browser tests for enrolment and the Today card in both modes.
- **Copy:** never imply a reset, or the choice of mode, affects anyone's standing before God. Use the exact BSB words
  of any verse quoted (the review flagged that the current restart message paraphrases Lamentations 3:22–23).

## Measuring it (no code change needed)

`faith_journey_attempts` keeps every attempt with:

- `interrupted_on`, the missed date;
- `interruption_reason` (reading, prayer or both);
- `days_completed`.

Run this read-only query as the service role in the Supabase SQL editor once TestFlight starts. It excludes nobody,
so filter out test accounts by email if needed.

```sql
-- Resets by plan length and day of miss, and whether the member came back within 7 days.
select j.duration_days,
       a.interruption_reason,
       width_bucket(a.days_completed, 0, 365, 12) as days_completed_bucket,
       count(*) as resets,
       count(*) filter (where exists (
         select 1 from public.faith_journey_checkins c
         where c.user_id = a.user_id and c.check_date > a.interrupted_on and c.check_date <= a.interrupted_on + 7
       )) as returned_within_7_days
from public.faith_journey_attempts a
join public.faith_journeys j on j.id = a.journey_id
where a.status = 'interrupted'
group by 1, 2, 3
order by 1, 3, 2;
```

**Decision needed from the owner:** whether to build option D (and/or A–C), and after which data. Until then the
strict rule is the only mode.
