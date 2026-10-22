-- Narrow Gate Fitness — AI model routing (memberships stage 1).
--
-- Pro coaching runs most requests on a fast model and sends plan generation and complex coaching questions to a
-- larger model, capped at a monthly share. Each usage row now records which model served it so the cap can be
-- enforced and costs reviewed. Rows written before routing existed count as the fast tier.
-- Users still can't write their own usage rows (service role only), so the cap can't be bypassed from the client.
alter table public.ai_usage_events
  add column model text check (char_length(model) <= 100),
  add column model_tier text not null default 'fast' check (model_tier in ('fast', 'smart'));

create index ai_usage_events_user_tier_idx on public.ai_usage_events (user_id, model_tier, created_at desc);

-- AI data-sharing consent. The AI coach sends parts of the user's own data to the AI provider (Anthropic) to
-- answer. Nothing is sent until the user allows it on the coach screen; they can withdraw it any time in
-- Profile & Settings, which stops the coach until they allow it again (App Store guideline 5.1.2(i)).
alter table public.profiles add column ai_data_consent_at timestamptz;
grant update (ai_data_consent_at) on public.profiles to authenticated;
