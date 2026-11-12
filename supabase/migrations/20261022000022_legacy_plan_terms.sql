-- Narrow Gate Fitness — keep existing subscribers' AI allowance through the October 2026 plan change.
--
-- Before this change Plus included an AI coach allowance (60 messages a month) and Pro 400 messages and 20 plan
-- generations. Under the new plans Plus has no AI and Pro has 150 messages. So nobody who is already paying loses
-- anything unexpectedly, every Stripe subscription that exists when this migration runs keeps its previous AI
-- allowance for as long as that subscription stays on the same plan and keeps access. Subscriptions created
-- afterwards follow the new plans. If there are no existing subscriptions, nothing is inserted.
--
-- Nothing in `subscriptions` or `user_entitlements` is changed. The terms end on their own when the subscription
-- ends (cancelled and past its paid period, or expired). The owner can end them earlier with notice by setting
-- `ends_at`. The allowances below are the previous code defaults; if production overrode them with
-- PLAN_PLUS_AI_MONTHLY_LIMIT / PLAN_PRO_AI_MONTHLY_LIMIT, update these rows to match.
create table public.legacy_plan_terms (
  stripe_subscription_id text primary key references public.subscriptions (stripe_subscription_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('plus', 'pro')),
  ai_monthly_limit integer not null check (ai_monthly_limit >= 0),
  ai_plan_monthly_limit integer not null check (ai_plan_monthly_limit >= 0),
  ai_smart_monthly_limit integer not null check (ai_smart_monthly_limit >= 0),
  ends_at timestamptz,
  reason text not null default 'Subscribed before the October 2026 plan change' check (char_length(reason) <= 200),
  created_at timestamptz not null default now()
);
create index legacy_plan_terms_user_idx on public.legacy_plan_terms (user_id);

alter table public.legacy_plan_terms enable row level security;
-- Members can see their own kept terms (shown on Plans & billing); only the service role writes.
create policy legacy_plan_terms_select_own on public.legacy_plan_terms
  for select to authenticated using (user_id = (select auth.uid()));

-- One-time snapshot: every subscription that has, or can still regain, access when this migration runs.
-- (Run once here, not kept as a callable function, so later subscriptions can't be added to it by mistake.)
insert into public.legacy_plan_terms (stripe_subscription_id, user_id, plan, ai_monthly_limit, ai_plan_monthly_limit, ai_smart_monthly_limit)
select s.stripe_subscription_id, s.user_id, s.plan,
       case s.plan when 'plus' then 60 else 400 end,
       case s.plan when 'plus' then 0 else 20 end,
       case s.plan when 'plus' then 6 else 40 end
from public.subscriptions s
where s.status in ('active', 'trialing', 'past_due', 'unpaid', 'paused')
   or (s.status = 'canceled' and s.current_period_end > now())
on conflict (stripe_subscription_id) do nothing;
