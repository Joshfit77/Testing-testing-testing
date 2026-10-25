-- plan_of(uuid) takes any user id and runs as its definer, and it was callable by every signed-in member through
-- PostgREST (POST /rest/v1/rpc/plan_of), so one member could read another's plan by id. Only the database needs it:
-- has_plan() and can_use_program() (both security definer) call it with the caller's own id. Members keep reading
-- their own plan through the user_entitlements policy.
revoke execute on function public.plan_of(uuid) from authenticated;
