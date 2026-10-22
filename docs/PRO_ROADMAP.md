# Pro roadmap: AI coach review, future coaching, Body Scan and Body Map

Reviewed on branch `claude/app-cleanup`, 2026-10-22. Nothing in the "future" sections is built. Each lists what it
needs, so it can be scoped and approved separately.

## 1. AI coach: current state (verified)

| Area | Status | Evidence |
|---|---|---|
| Who gets it | Pro, plus existing subscribers who kept their earlier allowance | `aiAllowance` (`src/lib/domain/plans.ts`); `tests/integration/entitlements.test.ts` |
| Monthly limits | 150 requests, 15 plan generations, 15 on the larger model | `getPlans()`; the database reserves each request (below) |
| Limits enforced on the server, race-free | A usage row is reserved before every provider call under a per-member lock that re-checks every limit (monthly, plans, larger-model share, per minute); token counts are filled in afterwards; provider failures give the reservation back | `supabase/migrations/20261023000025_ai_usage_reservation.sql`; `tests/integration/ai-limits.test.ts` (10 simultaneous requests at 147/150 → exactly 3 succeed) |
| Haiku / Sonnet routing | Everyday questions on Claude Haiku; plan generation and complex questions on Claude Sonnet, capped at about 10 % | `src/lib/coach/routing.ts`; `tests/unit/coach-routing.test.ts`; e2e checks which model served each request |
| Streaming | NDJSON stream with tool-activity status; a failed send keeps the unsent text and offers retry | `e2e/coach.spec.ts` (mock Messages API) |
| Safe tools | Read-only tools; proposal tools never write. A change applies only when the member taps Confirm and is re-validated then. | `src/lib/coach/tools.ts`, `applyCoachProposalAction` |
| Programs | AI plans are saved only on approval, validated against the exercise catalogue | `applyProposalAction` (now claims the proposal first, so it can't be saved twice) |
| Data consent | Nothing reaches the provider until the member allows it (App Store 5.1.2(i)); it can be withdrawn | `profiles.ai_data_consent_at`; the server checks it on every turn |
| Message integrity | Members can only insert their own questions; replies are written by the server; history sent to the model is capped per message | migration `20261023000025`; `tests/integration/ai-limits.test.ts` |
| Errors | Typed errors (`quota`, `rate_limited`, `consent_required`, `provider`, …) with HTTP statuses; usage-count errors block instead of reading as zero | `AiError` in `src/server/services/ai-coach.ts` |
| Key protection | `ANTHROPIC_API_KEY` is server-only; nothing secret is `NEXT_PUBLIC_` | security review |

**Cost monitoring.** Every request is a row in `ai_usage_events` with `model`, `model_tier`, `input_tokens` and
`output_tokens`. The admin dashboard shows only the 30-day request count. Monthly cost by model:

```sql
select date_trunc('month', created_at) as month, model, count(*) as requests,
       sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens
from public.ai_usage_events group by 1, 2 order by 1 desc, 2;
```

Multiply by the current per-million-token prices. Recommended next: show this on the admin dashboard, and set a
monthly spending limit on the Anthropic account as a backstop.

**Not verified:** no request has been made to the real Anthropic API from the development environment (tests use a
local mock). The first live call should be checked in staging.

## 2. Future Pro coaching: what each feature needs

- **User-controlled coaching memory**
  - A `coach_memories` table (owner-only RLS, in export and deletion), written only through a proposal the member
    confirms ("Remember that my left knee…").
  - A memory screen to view, edit and delete entries.
  - Memories added to the system context under a size cap.
  - The consent text extended to cover them.
- **Adaptive training**
  - A weekly job, or one triggered on workout finish, that compares logged sets with prescriptions (e1RM trend, RPE
    drift, missed sessions).
  - It proposes load or volume changes as a reviewable diff of the program. Nothing applies without confirmation.
  - Reuses the plan validator; needs a "program revision" history so a change can be undone.
- **Weekly progress reviews**
  - A scheduled job (Supabase cron or a queue) building a one-page summary from the existing analytics, on Haiku.
  - A notification to open it, an opt-out, and its own usage kind so it doesn't eat the chat allowance unexpectedly.
- **Recovery-aware recommendations**
  - Already available: recovery check-ins (consented wellness data), sleep, soreness and steps.
  - Needed: rules that lower the day's prescription on poor recovery (shown as a suggestion), a clear "not medical
    advice" boundary, and no inference from data the member hasn't consented to.
- **AI meal plans**
  - The meal planner exists (Plus). An AI layer would fill the plan from recipes and foods within the member's
    macros and diet style. The output must be validated against the food database (no invented nutrition), and
    every plan approved before saving.
- **Multi-goal training recommendations**
  - The builder already supports a second goal (e.g. strength + a 5K). The coach needs the goal pair in context and
    rules for interference (e.g. running before or after lifting).
  - It should only propose program changes through the existing builder, not free-form.

## 3. Pro Body Scan (not built; nothing purchased)

**Current state:** no body-scan code exists anywhere in the repository. Related but different:

- progress photos (private, with comparisons on Plus);
- manual body measurements, including an optional body-fat % the member types in;
- the planned body map (section 4).

**Proposed feature** (Pro):

1. **Guided capture:** front and side photos with an on-screen outline. The phone's gyroscope keeps it level, with
   a fixed distance, a framing guide and a 10-second timer, plus lighting and clothing guidance.
2. **Optional measurements:** waist, hips, chest, arms and thighs, entered with the same units as today.
3. **Comparison:** pairs of scans side by side with a date slider, and the measurements alongside.
4. **Storage:**
   - a private bucket per member (as progress photos), signed URLs only, never shown to admins;
   - included in the data export and removed on account deletion;
   - each scan deletable on its own.
5. **Consent:**
   - a separate explicit consent for body images, revocable (revoking deletes all scans);
   - a privacy-policy section and App Store privacy-label entries.
6. **Optional body-fat estimate (later):**
   - only from a validated method or vendor (e.g. Prism Labs or Bodygram, evaluated in `docs/APP_AUDIT.md` §9), and
     only after owner approval and a data-processing agreement;
   - always shown as an estimate with its error range.
   - **The app must never present visceral fat as something an ordinary phone camera measures.**
7. **Cost control:** any paid scan API is metered like AI usage, with a monthly cap per member.

**Native-only:** level-guided capture, the timer and camera control need the native app (Capacitor camera plus
motion sensors) and must be tested on real phones.

## 4. Interactive body map (not built)

1. **Data:** map each exercise's primary and secondary muscles to body regions. The catalogue already has `primary_muscles` and
   `secondary_muscles`; they need normalising to about 16 regions, front and back.
2. **Training history:** sets per muscle per week from completed sets (weighted 1.0 primary, 0.5 secondary), shown
   as a heat map with the evidence-based weekly-volume bands already used in `docs/PROGRAM_RESEARCH.md`.
3. **Strength progress:** per region, the trend of the best e1RM of its main lifts. The planned "strength ranks by
   muscle group" can build on the existing rank system's rules (activity-derived, never stored, never reset).
4. **UI:**
   - an SVG front and back figure with tappable regions and accessible names;
   - a list fallback for screen readers;
   - the same black-and-gold styling as the badges.
5. **Plan:** basic weekly heat map for everyone (basic progress); history and strength trends on Plus (advanced
   analytics).
