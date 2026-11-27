-- Administrators act only from a session verified with a second factor (finding F-8, security assessment 2026-11-20).
--
-- Until now any session of an account with role = 'admin' had admin rights in the database, so an admin password
-- alone (guessed, phished, reused) was enough to change the exercise library, programs, feature flags and content,
-- and to read the admin audit log, through the public API as well as the app. is_admin() now also requires the
-- session's authenticator assurance level to be aal2: the member signed in and then entered a code from their
-- authenticator app (Supabase Auth TOTP). Every admin policy and function goes through is_admin(), so all of them
-- follow. With a password-only (aal1) session an admin is an ordinary member.
--
-- Recovery if the admin loses their authenticator (docs/security/ADMIN_MFA.md): the Supabase project owner removes
-- the factor (Dashboard > Authentication > Users > the user > remove MFA factor, or delete it from auth.mfa_factors);
-- the admin then enrols a new one at /admin/mfa.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
     and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
