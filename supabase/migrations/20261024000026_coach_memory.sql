-- Narrow Gate Fitness — long-term AI coaching memory (Pro).
--
-- Memories are short notes the coach keeps about a member across conversations and devices: a secondary goal, an
-- exercise they prefer, when they train, how they like to be coached, a change they approved. They hold only what
-- the structured data doesn't (goal, experience, equipment, program, logs and targets stay in their own tables and
-- are read fresh every turn). Nothing is saved without the member: memory is off until they turn it on, the coach
-- can only suggest a memory (the member saves, edits or declines it), and every memory can be viewed, edited and
-- deleted. Deleting the account removes them (on delete cascade).

-- Does the signed-in member have the AI coach: Pro, or a subscription that kept its AI allowance from before the
-- October 2026 plan change (the same rule as aiAllowance / legacyTermsApply in src/lib/domain/plans.ts).
create or replace function public.has_ai_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_plan('pro') or exists (
    select 1
    from public.legacy_plan_terms t
    join public.subscriptions s on s.stripe_subscription_id = t.stripe_subscription_id
    where t.user_id = auth.uid()
      and t.ai_monthly_limit > 0
      and (t.ends_at is null or t.ends_at > now())
      and s.plan = t.plan
      and s.status in ('active', 'trialing', 'past_due')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;
revoke all on function public.has_ai_coach() from public, anon;
grant execute on function public.has_ai_coach() to authenticated, service_role;

-- The member's switch (off by default; turning it on is their consent) and when they agreed.
alter table public.profiles
  add column coach_memory_enabled boolean not null default false,
  add column coach_memory_consent_at timestamptz;
grant update (coach_memory_enabled, coach_memory_consent_at) on public.profiles to authenticated;

-- "Don't remember anything from this chat."
alter table public.ai_conversations add column memory_off boolean not null default false;

create table public.coach_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in (
    'goals', 'experience', 'exercise_preferences', 'equipment', 'schedule', 'nutrition',
    'training_changes', 'recovery', 'milestones', 'coaching_style', 'other'
  )),
  content text not null check (char_length(content) between 3 and 300),
  -- coach: suggested by the coach and saved by the member; member: added on the memory screen;
  -- approved_change: recorded when the member confirmed a coach-suggested change.
  source text not null default 'member' check (source in ('coach', 'member', 'approved_change')),
  source_message_id uuid references public.ai_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_memories_user_idx on public.coach_memories (user_id, created_at desc);
create trigger coach_memories_updated_at before update on public.coach_memories
  for each row execute function public.set_updated_at();

alter table public.coach_memories enable row level security;

-- Members always see and can delete their own memories (also after a downgrade or with memory switched off).
create policy coach_memories_select_own on public.coach_memories
  for select to authenticated using (user_id = (select auth.uid()));
create policy coach_memories_delete_own on public.coach_memories
  for delete to authenticated using (user_id = (select auth.uid()));
-- Adding or editing needs the AI coach and memory switched on.
create policy coach_memories_insert_own on public.coach_memories
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public.has_ai_coach()
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.coach_memory_enabled)
  );
create policy coach_memories_update_own on public.coach_memories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.has_ai_coach()
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.coach_memory_enabled)
  );
revoke update on public.coach_memories from authenticated;
grant update (category, content) on public.coach_memories to authenticated;

-- At most 100 memories per member (MEMORY_LIMIT in src/lib/coach/memory.ts; keep them equal). Locked per member so
-- two saves at once can't both slip under the limit.
create or replace function public.enforce_coach_memory_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('coach_memories:' || new.user_id::text, 0));
  if (select count(*) from public.coach_memories where user_id = new.user_id) >= 100 then
    raise exception 'coach_memory_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger coach_memories_limit before insert on public.coach_memories
  for each row execute function public.enforce_coach_memory_limit();
