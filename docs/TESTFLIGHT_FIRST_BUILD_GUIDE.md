# Your first TestFlight build: a step-by-step guide

For Josh (and John). One step at a time, in this order. Each step says where to click and what you should see.
Nothing here needs Xcode. The only special tool is a plain text editor (TextEdit on a Mac, Notepad on Windows) for one file in step 15.

The first build is **private and safe**: it uses a separate *staging* copy of the app with its own empty database,
**no real payments** (no payment keys are set), **no live AI** (no AI key is set), and only you and John as testers.
Nothing here touches production, and nothing is merged into `main`.

Never paste a password, key or secret into a chat (including with Claude). Each one goes only into the website named
in the step.

---

## Part A: Apple (about 1–2 days, mostly waiting for Apple)

**Step 1. Decide: individual or organization.**
- *Individual*: fastest. The App Store shows your personal legal name as the seller.
- *Organization*: needs a registered company (for example an LLC) and a free D-U-N-S number first; the company's name
  is the seller. Moving an app from an individual account to a company later is possible but has conditions.
- For a private TestFlight with John, either works. If your company will exist within about two weeks, organization
  saves a move later. Ask your attorney or accountant about the company itself.

**Step 2. Enroll.** On your iPhone or computer go to **developer.apple.com/programs/enroll**, sign in with your Apple ID
(two-factor authentication must be on), choose individual or organization, and pay **$99/year**.
*You should see:* an email from Apple confirming your membership. This can take from minutes to a couple of days.

**Step 3. Find your Team ID.** developer.apple.com → **Account** → **Membership details**. Write down the
**Team ID** (10 letters and numbers). You'll need it in step 15.

**Step 4. Register the app's ID.** developer.apple.com → **Certificates, Identifiers & Profiles** → **Identifiers** →
the **+** button → **App IDs** → **App** → Continue.
- Description: `Narrow Gate Fitness`
- Bundle ID: **Explicit**, exactly `com.narrowgatefitness.app`
- Capabilities: tick **HealthKit** only.
- Continue → Register.
*You should see:* `com.narrowgatefitness.app` in the Identifiers list.

**Step 5. Create the app in App Store Connect.** Go to **appstoreconnect.apple.com** → **Apps** → **+** → **New App**.
- Platform: iOS. Name: `Narrow Gate Fitness` (if the name is taken, add a word; you can change it later).
- Primary language: English (U.S.). Bundle ID: pick `com.narrowgatefitness.app`. SKU: `NGF001`.
- User access: Full access → Create.
*You should see:* the app's page with tabs including **TestFlight**.

**Step 6. Invite John to your team.** App Store Connect → **Users and Access** → **+**. Enter John's name and the email
of his Apple ID, give him the **Developer** role (he can test and see builds; he can't change billing or agreements) →
Invite. John accepts the email invitation.
*If your account type doesn't offer this,* skip it: in step 18 you'll add John as an *external* tester instead (Apple
then reviews the build briefly, usually within a day).

**Step 7. Create the testing group.** Your app → **TestFlight** → **Internal Testing** → **+** → name it
`Josh and John` → add yourself and John.

**Step 8. Create the key GitHub uses to upload builds.** App Store Connect → **Users and Access** → **Integrations** →
**App Store Connect API** → **Team Keys** (click "Request Access" the first time) → **+**.
- Name: `GitHub TestFlight`. Access: **Admin** (needed so the build can create its own signing certificate).
- Generate → **Download API Key**. You get a file named like `AuthKey_ABC123XYZ.p8`. **Apple lets you download it only
  once**: keep it somewhere safe (not in the repository, not in email).
- Write down the **Key ID** (shown next to the key) and the **Issuer ID** (at the top of the page).

---

## Part B: Supabase staging database (about 20 minutes)

**Step 9. Create a separate staging project.** **supabase.com** → sign in → **New project**.
- Name: `narrowgate-staging`. Database password: let Supabase generate one and save it in your password manager.
- Region: the one closest to you. Plan: Free is fine for two testers.
*You should see:* the project dashboard after a minute or two.

**Step 10. Create the database.** In the project: **SQL Editor** → **New query**. Open the file
`supabase/setup-all.sql` from the branch `claude/rc-testflight-1` on GitHub (click the file → **Raw** → select all →
copy), paste it into the editor, click **Run**.
*You should see:* "Success. No rows returned". Run it **only once, only on this new project**. Never run it on any
other project.
The file is large (about 6 MB, mostly the exercise and program library), so the page may take a minute or two. If the
editor shows an error instead (for example about size or a timeout), **don't run it again**: send Claude the exact
message, and you'll get a version split into smaller parts, or a one-line command to run it from a computer instead.

**Step 11. Sign-in settings.** **Authentication** → **URL Configuration**: leave it for now; you'll fill in the website
address in step 13. **Authentication** → **Email Templates**: for "Confirm signup" paste the contents of
`supabase/templates/confirmation.html`, for "Reset password" paste `supabase/templates/recovery.html`.
**Authentication** → **Sign In / Providers** → **Email** (security settings; names can differ slightly):
- **Secure password change**: on.
- **Email OTP expiration**: `1800` seconds (30 minutes) instead of an hour.
- **Email OTP length**: `8` if offered.
- Minimum password length: `8` or more.
Save.
**Authentication** → **Multi-Factor** (MFA): make sure **TOTP / App Authenticator** is enabled (admin tools require it:
docs/security/ADMIN_MFA.md, including what to do if you lose your phone).
**Before inviting anyone beyond you and John** (not needed for the first build, when sign-ups are off): **Authentication**
→ **Attack Protection** → enable **CAPTCHA protection** with **Cloudflare Turnstile** (create a free Turnstile site at
dash.cloudflare.com; paste its *secret key* here), and in Vercel add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = its *site key*.
Switch both on together: with only Supabase's switched on, nobody can sign in.

**Step 12. Copy the three connection values.** **Project Settings** → **API**: the **Project URL**, the **anon public**
key, and the **service_role** key (the service_role key is a master key: it goes only into Vercel in step 13, nowhere
else).

---

## Part C: Vercel staging website (about 15 minutes)

**Step 13. Deploy the staging website.** **vercel.com** → sign in with GitHub → **Add New** → **Project** → import
`Testing-testing-testing`. Before clicking Deploy, open **Environment Variables** and add exactly these:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the Project URL from step 12 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon public key from step 12 |
| `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 12 (mark it **Sensitive**) |
| `NEXT_PUBLIC_SITE_URL` | leave for now; set it after the first deploy (below) |
| `ERROR_REPORTING` | `on` |
| `NEXT_PUBLIC_ERROR_REPORTING` | `on` |

**Leave out on purpose:** `ANTHROPIC_API_KEY` (AI stays off), every `STRIPE_…` and `REVENUECAT_…` variable (payments
stay off), `DEMO_MODE`, `STRIPE_LIVE_APPROVED`.

Click **Deploy**. Then: **Settings** → **Git** → **Production Branch** → `claude/rc-testflight-1` → Save, and
**Deployments** → **Redeploy**. (The production address of this *staging* project is what the iPhone app loads;
Vercel's preview addresses ask visitors to log in to Vercel, which would block the app.)

Now copy the site's address (like `https://narrowgate-staging.vercel.app`):
- Vercel → **Settings** → **Environment Variables** → set `NEXT_PUBLIC_SITE_URL` to it → Redeploy.
- Supabase → **Authentication** → **URL Configuration** → Site URL = the address; Redirect URLs → add the address
  followed by `/**`.

*Check:* open `https://<your-address>/api/health` on your phone. *You should see* `"app":"narrow-gate-fitness"` and a
`commit` value. Open the address itself: you should see the Narrow Gate opening.

**Which Vercel plan.** The free Hobby plan is meant for non-commercial use. And once the GitHub repository is
**private**, Hobby only deploys commits *you* wrote: commits by Claude or John are blocked with "Hobby Plan does not
support collaboration for private repositories". Most commits on this branch are Claude's, so with a private repository
choose **Pro** for this project (Vercel shows the current price when you upgrade). With a public repository Hobby works.

**Step 14 (security). After you and John have created your accounts,** turn off new sign-ups on staging so strangers who
find the address can't register: Supabase → **Authentication** → **Sign In / Providers** → turn off **Allow new users
to sign up** → Save. (The app's own Admin → Feature flags → **signups** switch only hides the app's sign-up form; the
Supabase setting is the one that actually stops new accounts, because the app's public key can reach Supabase
directly.) To add a tester later, turn it back on for a minute.

---

## Part D: GitHub (about 10 minutes)

**Step 15. Add the four secrets.** github.com → the repository → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**, four times:

| Name | Value |
|---|---|
| `APPLE_TEAM_ID` | the Team ID from step 3 |
| `ASC_KEY_ID` | the Key ID from step 8 |
| `ASC_ISSUER_ID` | the Issuer ID from step 8 |
| `ASC_KEY_P8` | open the `.p8` file from step 8 in **TextEdit** (Mac) or **Notepad** (Windows) and copy **everything**, including the lines `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` |

GitHub never shows a secret again after you save it.

**Step 16. Build and upload.** github.com → the repository → **Actions** → **iOS** → **Run workflow** →
- Branch: `claude/rc-testflight-1` (choose this first: the boxes below then match that branch)
- job: `testflight`
- server_url: your staging address from step 13 (starting `https://`)
- upload: **ticked**
→ Run workflow.
*You should see:* a run that takes about 20–30 minutes and ends with a green check. If it's red, open it and send
Claude the step name and the error line (no secrets are ever printed in the log).
If a run fails, you can use **Re-run jobs**: each attempt gets its own build number (for example 57.1, then 57.2), so
App Store Connect never refuses the upload as a repeat.

---

## Part E: Install on your iPhones

**Step 17. Wait for Apple to process the build** (usually 10–30 minutes). App Store Connect → your app →
**TestFlight**: the build appears with status "Ready to Test" (if it asks about export compliance, the answer is
already set to "No" in the app, so it shouldn't).

**Step 18. Give the build to the group.** TestFlight → **Internal Testing** → `Josh and John` → **Builds** → **+** →
pick the build. (External tester instead, if step 6 wasn't possible: **External Testing** → new group → add John's
email → add the build → submit for review.)

**Step 19. Install.** On each iPhone install **TestFlight** from the App Store, open the invitation email (or the
TestFlight app) → **Accept** → **Install**. Narrow Gate Fitness appears on the home screen with an orange dot (beta).

---

## Admin and Pro for testing (optional)

Payments are off, so Pro features stay locked unless you grant Pro by hand on **staging**. After signing up, in
Supabase → **SQL Editor**, replace the email and run:

```sql
-- staging only: make this account an admin and give it Pro, without any payment
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
insert into public.user_entitlements (user_id, plan, source)
  select id, 'pro', 'admin' from auth.users where email = 'you@example.com'
  on conflict (user_id) do update set plan = 'pro', source = 'admin';
```

---

## What to test on the iPhones (record what actually happens)

Write down **pass / fail** and, for a failure, the screen, what you did, what you expected, what happened, your iPhone
model and iOS version, and a screenshot. Mark each failure **critical** (lost data, crash, can't sign in, can't finish a
workout) or **cosmetic** (looks wrong, works).

1. Create an account; confirm the email; finish onboarding.
2. Start a workout, log two sets, see an exercise animation, let the rest timer run.
3. Lock the phone for a minute mid-workout; unlock: the sets are still there and the timer is right.
4. Swipe the app away completely mid-workout; reopen: the workout comes back.
5. Turn on Airplane Mode; log a set (the header says "Saved on device"); turn it off: it says "Synced".
6. Finish the workout; see it in History.
7. Sign out (with no workout open) and sign back in: your history is there.
8. Start a workout, log a set, turn on Airplane Mode, then try to sign out: the app warns you the workout isn't saved to
   your account yet. Tap Cancel; turn Airplane Mode off; the set is still there.
9. Move around every tab for a few minutes: no crash, nothing blank.
10. If you allow Apple Health: the app asks for permission once and shows the data it imported.
11. **Password reset:** on the sign-in screen tap "Forgot password?", open the email **on the iPhone**, set a new
    password, sign in with it.
12. **GPS run or walk:** start a recording outdoors, lock the phone for 5 minutes while walking, unlock, stop: the
    route, distance and time look right. Then check iPhone Settings → Narrow Gate Fitness → Location says what you
    chose.
13. **Barcode:** Nutrition → scan a packaged food's barcode with the camera: the product appears (or a clear
    "not found"), and adding it puts it in today's diary.
14. **Notifications:** allow notifications when asked; turn on a workout reminder in the app for today, a few minutes
    ahead; it arrives at that time with the app closed. Also start a rest timer and lock the phone: an alert appears
    when it ends.
15. **Two devices** (needs two iPhones, or an iPhone and the website): open the same unfinished workout on both,
    complete the **same** set with different weights, finish on one, then the other: nothing logged is lost, and the
    app says the set was logged differently on the other device.
16. **Free and Pro:** a Free test account sees Pro features as locked; a Pro test account (see "Admin and Pro for
    testing") can use them. **Do not buy anything**: purchases stay off for this build.
17. **Accessibility:** turn on VoiceOver (Settings → Accessibility) and log one set using it; turn on Larger Text at
    the biggest size: screens still read correctly and nothing important is cut off.
18. **Export and delete** (use a throwaway test account): Profile → Privacy & data → export your data (a file
    arrives); then delete the account: you're signed out and can't sign back in with it.

Simulator and browser tests don't count for this list: only what you see on the real iPhones.
