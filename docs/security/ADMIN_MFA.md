# Admin two-step sign-in (F-8) and its recovery procedure

**Needs your approval:** the recovery procedure below. Admin tools are refused without the second step, so this is the
only way back in if an admin's authenticator is lost.

## How it works

- Admin tools (`/admin` and every admin action) and the database's admin rights (`is_admin()`, migration 085) require a
  session verified with a code from an authenticator app (Supabase Auth TOTP, "aal2").
- Signed in with the password alone, an admin is an ordinary member: their own account works as usual; admin pages
  send them to `/admin/mfa`.
- First visit to `/admin/mfa`: scan the QR code (or type the key) into an authenticator app (Apple Passwords, Google
  Authenticator, 1Password…), enter one code. After that, each sign-in asks for a code before admin tools open.
- Members aren't affected (nothing changes for anyone who isn't an admin).

## Before you rely on it

1. **Hosted Supabase:** Authentication → **Multi-Factor** (or Sign In / Providers → MFA) → **TOTP (App Authenticator)**:
   enrollment and verification **enabled**. (Local development has it on: `supabase/config.toml`.)
2. Set up the authenticator on your phone at `/admin/mfa` the first time you open Admin.
3. **Backup:** when the QR code is on screen, add the same key to a second device too (for example a password manager
   on your computer). Either device's code works.

## If an admin's authenticator is lost (recovery)

You are never locked out of your account: the password still signs in. Only admin tools wait for the second step.

1. The owner of the Supabase project (you) signs in to **supabase.com** → the project → **Authentication** → **Users**
   → the admin's row → **Remove MFA factors** (wording can differ slightly).
   *Or* in **SQL Editor**: `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'admin@example.com');`
2. The admin signs in with the password and opens `/admin`: they are asked to set up a new authenticator.

Tested: `tests/integration/admin-mfa.test.ts` ("recovery: when the project owner removes a lost authenticator…") runs
exactly this against the local auth server.

If the Supabase owner account itself is the one locked out, Supabase's own account recovery applies (keep its
two-factor recovery codes somewhere safe).
