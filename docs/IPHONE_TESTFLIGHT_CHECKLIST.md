# Narrow Gate Fitness on your iPhone: the checklist

Written 2026-11-23 for Josh, who isn't a software developer. Do the steps in order. Each step says **where** to go,
what to **click**, what to **enter**, what it **costs**, and **how you know it worked**. Fuller explanations of the
same steps are in [TESTFLIGHT_FIRST_BUILD_GUIDE.md](TESTFLIGHT_FIRST_BUILD_GUIDE.md) (step numbers in brackets).

**What you need:** your Mac (any web browser; **no Xcode needed**), your iPhone (iOS 16 or later), your Apple ID,
a password manager or a safe place for passwords, and about **$99** for Apple. Plan on two or three short sessions,
plus a wait of up to two days while Apple processes your enrolment.

**What stays off in this test:**
- **Payments:** no payment keys are set, so nothing can be bought.
- **AI coach:** no AI key is set, so it shows "temporarily unavailable" and costs nothing.
- **Your real data:** everything goes into a separate **staging** copy of the app, used only by you (and John).

**Golden rule:** never paste a password, key or the `.p8` file's text into any chat (including Claude). Each goes only
into the website the step names. If something goes wrong, send Claude the **step number** and the **error words**
you see, and nothing secret.

---

## Stage 0: one approval (2 minutes)

### Step 0. Let Claude update the release candidate
- **Where:** this chat with Claude.
- **Enter:** "Yes, update the release candidate."
- **Why:** the branch every step below uses (`claude/rc-testflight-1`) then contains the latest tested fixes. Nothing
  is deployed or merged into `main`.
- **Cost:** free.
- **It worked if:** Claude replies that `claude/rc-testflight-1` was updated, and names the commit.

---

## Stage 1: Apple (about 1 hour of clicking, then up to 2 days of waiting)

### Step 1. Turn on two-step sign-in for your Apple ID
- **Where:** iPhone → **Settings** → your name at the top → **Sign-In & Security**.
- **Click:** **Two-Factor Authentication** → **Turn On** (skip if it already says On).
- **Cost:** free.
- **It worked if:** it shows **Two-Factor Authentication: On**.

### Step 2. Join the Apple Developer Program [guide steps 1–2]
- **Where:** on your Mac, open **developer.apple.com/programs/enroll** (or the **Apple Developer** app on your iPhone).
- **Click:** **Start your enrollment** → sign in with your Apple ID → **Individual / Sole Proprietor** (fastest; see
  guide step 1 if you want a company instead).
- **Enter:** your legal name, address and phone number, exactly as on your ID.
- **Cost:** **$99 per year** (the only required cost in this checklist).
- **It worked if:** you get an email from Apple welcoming you to the Apple Developer Program. It can take from minutes to
  2 days, and you can't continue until it arrives.

### Step 3. Write down your Team ID [guide step 3]
- **Where:** **developer.apple.com/account** → **Membership details**.
- **Enter:** nothing. Copy the **Team ID** (10 letters and numbers) into your password manager.
- **Cost:** free.
- **It worked if:** you have a 10-character code saved.

### Step 4. Register the app's ID, with Apple Health [guide step 4]
- **Where:** developer.apple.com/account → **Certificates, IDs & Profiles** → **Identifiers**.
- **Click:** the blue **+** → **App IDs** → **App** → **Continue**.
- **Enter:**
  - Description: `Narrow Gate Fitness`.
  - Bundle ID: **Explicit**, `com.narrowgatefitness.app`, exactly as written.
  - In the capabilities list, tick **HealthKit** (nothing else).
  - Then **Continue** → **Register**.
- **Cost:** free.
- **It worked if:** `com.narrowgatefitness.app` is in the Identifiers list.

### Step 5. Create the app in App Store Connect [guide step 5]
- **Where:** **appstoreconnect.apple.com** → **Apps**.
- **Click:** the **+** → **New App**.
- **Enter:**
  - Platform: **iOS**.
  - Name: `Narrow Gate Fitness`. If the name is taken, add a word; you can change it later.
  - Language: **English (U.S.)**.
  - Bundle ID: choose `com.narrowgatefitness.app`.
  - SKU: `NGF001`.
  - Access: **Full Access**.
  - Then **Create**.
- **Cost:** free.
- **It worked if:** the app's page opens with a **TestFlight** tab.

### Step 6. Make your testing group [guide steps 6–7]
- **Where:** your app → **TestFlight** → **Internal Testing** (left side).
- **Click:** **+** next to Internal Testing.
- **Enter:**
  - Group name: `Josh and John`.
  - Add yourself.
  - To add John: first invite him under **Users and Access** → **+**, with the **Developer** role; he must accept
    the email.
- **Cost:** free.
- **It worked if:** the group lists your name (and John's once he accepts).

### Step 7. Create the upload key for GitHub [guide step 8]
- **Where:** App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys**.
  The first time, click **Request Access** and accept.
- **Click:** **+**.
- **Enter:** Name `GitHub TestFlight`, Access **Admin**. Then click **Generate**.
- **Then:**
  - Click **Download API Key**. Apple lets you download it **only once**. The file is named like
    `AuthKey_ABC123XYZ.p8`; keep it in a private folder (not email, not the repository).
  - Copy the **Key ID** (next to the key) and the **Issuer ID** (top of the page) into your password manager.
- **Cost:** free.
- **It worked if:** you have the `.p8` file, a Key ID and an Issuer ID.

---

## Stage 2: Supabase, the staging database (about 20 minutes)

### Step 8. Create a separate staging project [guide step 9]
- **Where:** **supabase.com** → sign in (or sign up) → **New project**.
- **Enter:**
  - Name: `narrowgate-staging`.
  - Database password: click **Generate a password** and save it in your password manager.
  - Region: the one nearest you.
  - Plan: **Free**.
- **Cost:** free.
- **It worked if:** after a minute or two the project's dashboard appears.

### Step 9. Create the app's tables [guide step 10]
- **Where:** in a second browser tab, open the file `supabase/setup-all.sql` on GitHub. Go to your repository →
  change the branch selector from `main` to `claude/rc-testflight-1` → open the `supabase` folder →
  `setup-all.sql` → click **Raw**.
- **Click:** press **⌘A** then **⌘C** to copy it all. In Supabase: **SQL Editor** → **New query** → click in the
  editor → **⌘V** → **Run**.
- **Cost:** free.
- **It worked if:** it says **Success. No rows returned** (the file is large, so give it a minute or two). Then
  check the photo upload limits are installed: **New query** → paste
  `select tgname from pg_trigger where tgname in ('progress_photos_quota', 'body_scan_photos_quota') order by 1;`
  → **Run** → two rows, `body_scan_photos_quota` and `progress_photos_quota`. If either is missing, tell Claude.
- **Do this only once, only in this new project.** If you see an error, don't run it again: send Claude the error
  words.

### Step 10. Sign-in settings [guide step 11]
- **Where:** Supabase → **Authentication**.
- **Click and enter:**
  - **Sign In / Providers** → **Email**:
    - **Secure password change**: on.
    - **Email OTP expiration**: `1800`.
    - **Email OTP length**: `8` if offered.
    - **Minimum password length**: `8`.
    - **Save**.
  - **Multi-Factor**: make sure **TOTP (App Authenticator)** is enabled.
  - **Skip "Email Templates".** New free projects can't change them; the app works without them (see the next note).
  - **Invite John** so he can receive the app's emails: your organization (top left) → **Team** → **Invite**, with
    the email John will sign up with.
- **Cost:** free. If Supabase asks for payment to add John, stop and ask Claude.
- **It worked if:** the settings show your values after saving, and John appears under Team (after he accepts).
- **Note on emails:** Supabase's free email sender only sends to your Supabase team's addresses, and about **2
  emails an hour**. Space out sign-ups and password resets.

### Step 11. Copy the connection values [guide step 12]
- **Where:** Supabase → **Project Settings** (gear icon) → **API Keys**, and **Data API** for the URL.
- **Enter:** nothing. Copy three values into your password manager:
  - the **Project URL** (starts `https://` and ends `.supabase.co`);
  - the **Publishable key** (starts `sb_publishable_`). On an older project this is called the **anon public** key;
  - the **Secret key** (starts `sb_secret_`; click to reveal). On an older project this is called **service_role**.
    It's a master key: it goes only into Vercel in step 12, nowhere else.
- **Cost:** free.
- **It worked if:** you have three values saved.

---

## Stage 3: Vercel, the staging website the iPhone app opens (about 15 minutes)

### Step 12. Put the staging website online [guide step 13]
- **Where:** **vercel.com** → **Sign Up / Log In** → **Continue with GitHub**.
- **Click:** **Add New** → **Project** → find `Testing-testing-testing` → **Import**. Before clicking Deploy, open
  **Environment Variables**.
- **Enter** these names and values, one at a time:

  | Name | Value |
  |---|---|
  | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL (step 11) |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the Publishable (or anon public) key |
  | `SUPABASE_SERVICE_ROLE_KEY` | the Secret (or service_role) key; tick **Sensitive** |
  | `ERROR_REPORTING` | `on` |
  | `NEXT_PUBLIC_ERROR_REPORTING` | `on` |

  Add **nothing else**. In particular, no AI key and no Stripe or RevenueCat key: that is what keeps AI and payments
  off. Then click **Deploy**.
- **Cost:** free on the **Hobby** plan while the GitHub repository stays public. If you later make it private, Vercel
  needs **Pro** (about $20 a month); see "Costs" below.
- **It worked if:** Vercel shows "Congratulations" and an address like `https://testing-testing-testing-xxxx.vercel.app`.

### Step 13. Use the release candidate, and tell each side the address [guide step 13]
- **Where:** Vercel → your project → **Settings**.
- **Click and enter:**
  1. **Use the release candidate:**
     - **Git** (on some accounts **Environments** → **Production**) → **Production Branch** → `claude/rc-testflight-1`
       → **Save**.
     - **Deployments** → the newest one → **⋯** → **Redeploy**.
  2. **Tell the site its own address:**
     - Copy the site's address (Vercel shows it under **Domains**).
     - **Settings** → **Environment Variables** → add `NEXT_PUBLIC_SITE_URL` = that address → **Redeploy** again.
  3. **Tell Supabase the address:**
     - **Authentication** → **URL Configuration** → **Site URL** = the address.
     - **Redirect URLs** → **Add URL** → the address followed by `/**` → **Save**.
- **Cost:** free.
- **It worked if:**
  - on your iPhone in Safari, `https://<your address>/api/health` shows `"app":"narrow-gate-fitness"`;
  - the address itself shows the Narrow Gate opening.

---

## Stage 4: GitHub, which builds the iPhone app for you (about 10 minutes, then about 30 minutes of waiting)

### Step 14. Make the protected "testflight" place for the Apple key [guide step 15]
- **Where:** **github.com** → the repository `Testing-testing-testing` → **Settings** → **Environments**.
- **Click:**
  1. **New environment** → name it `testflight` → **Configure environment**.
  2. **Required reviewers:** tick it, type your GitHub name and pick yourself. Leave "Prevent self-review"
     **unticked**. Untick **Allow administrators to bypass configured protection rules**. Then **Save protection
     rules**.
  3. **Deployment branches and tags:** choose **Selected branches and tags** → **Add deployment branch or tag rule**
     → type `claude/rc-testflight-1` → **Add rule**.
  4. **Environment secrets** → **Add environment secret**, four times (below).
- **Enter:**

  | Name | Value |
  |---|---|
  | `TF_APPLE_TEAM_ID` | your Team ID (step 3) |
  | `TF_ASC_KEY_ID` | the Key ID (step 7) |
  | `TF_ASC_ISSUER_ID` | the Issuer ID (step 7) |
  | `TF_ASC_KEY_P8` | open the `.p8` file in **TextEdit** (right-click → Open With → TextEdit), press ⌘A, ⌘C, and paste it all, including the `BEGIN` and `END` lines |

  Put them **only** here, never under "Secrets and variables → Actions". If you ever saved Apple secrets there,
  delete them.
- **Cost:** free while the repository is public.
- **It worked if:** the `testflight` environment shows 1 protection rule, 1 branch rule and 4 secrets. GitHub never
  shows the secret values again, which is normal.

### Step 15. A practice build: signed, but not uploaded
- **Where:** the repository → **Actions** → **iOS** (left list).
- **Click:**
  1. **Run workflow** (right side).
  2. Choose **Branch** `claude/rc-testflight-1` **first**; the boxes then match that branch.
  3. **job**: `testflight`.
  4. **server_url**: your Vercel address, starting `https://`.
  5. **upload**: leave it **unticked**.
  6. Click the green **Run workflow**.
  7. The run says **Waiting for review**. Open it → **Review deployments** → tick `testflight` → **Approve and
     deploy**. Nothing is signed or uploaded before you approve, and only you can start this build.
- **Cost:** free while the repository is public.
- **It worked if:** after about 20–30 minutes the run shows a **green check**. Nothing was sent to Apple: this proves
  your secrets and Apple signing work.
- **If it's red:** open it and send Claude the name of the red step and its error line. No secrets are ever
  printed. If the red step is "Check the deployed app…", your website isn't serving the same commit: in Vercel →
  **Deployments** → newest → **⋯** → **Redeploy**, wait for it to finish, then run the build again.

### Step 16. The real build: signed and uploaded to TestFlight [guide step 16]
- **Where and click:** the same as step 15 (including **Approve and deploy**), but tick **upload**.
- **This is the step that sends the app to Apple.** Only you start it and approve it; Claude doesn't.
- **Cost:** free.
- **It worked if:** the run is green, and its last lines say "Uploaded build … It appears in App Store Connect >
  TestFlight after Apple finishes processing."

---

## Stage 5: on your iPhone (about 30 minutes)

### Step 17. Wait for Apple [guide step 17]
- **Where:** App Store Connect → your app → **TestFlight**.
- **Cost:** free.
- **It worked if:** the build shows **Ready to Test** (usually 10–30 minutes after step 16).

### Step 18. Install [guide steps 18–19]
- **Where:**
  - App Store Connect → **TestFlight** → **Internal Testing** → `Josh and John` → **Builds** → **+** → pick the
    build. It may already be there.
  - Then on your iPhone: **App Store** → search **TestFlight** → **Get**.
- **Click:** open the TestFlight invitation email on the iPhone (or open the TestFlight app) → **Accept** →
  **Install**.
- **Cost:** free.
- **It worked if:** **Narrow Gate Fitness** is on your home screen with a small orange dot (the TestFlight mark).

### Step 19. Create your account
- **Where:** the Narrow Gate Fitness app.
- **Click:** **Enter Narrow Gate** → **Create an account**. Then tap the link in the confirmation email. Safari opens and
  says the link was processed. Go back to the app and **sign in**.
- **Enter:** your email and a password of at least 8 characters.
- **Cost:** free.
- **It worked if:** you reach the first onboarding screen.

### Step 20 (optional). Make yourself admin and give yourself Pro, without paying
- **Where:** Supabase → **SQL Editor** → **New query**.
- **Enter:** the SQL under "Admin and Pro for testing" in the guide, with your email in place of
  `you@example.com`. Then click **Run**. (Tested 2026-11-23 on a local copy: it gives the account `admin` and `pro`.)
- **Then:** the first time you open **Admin** in the app, set up an authenticator (Apple Passwords or Google
  Authenticator), and add the same key to a second device: `docs/security/ADMIN_MFA.md`.
- **Cost:** free.
- **It worked if:** the SQL says `UPDATE 1` and `INSERT 0 1`, and Pro features open in the app.

### Step 21. Test, and write down what happens
- **Where:** the guide, section **"What to test on the iPhones"**: 18 checks, including GPS, Apple Health, the
  barcode camera, notifications and password reset.
- **Note on password reset:** start it in **Safari** on the staging address, not in the app (guide step 11 explains
  why).
- **Enter:** for each check, write **pass** or **fail**. For a failure, also write what you did, what you expected,
  what happened, your iPhone model and iOS version, and take a screenshot.
- **Cost:** free.
- **It worked if:** you have a list of 18 results. Send the failures to Claude.

### Step 22. Close the door behind you [guide step 14]
- **Where:** Supabase → **Authentication** → **Sign In / Providers**.
- **Click:** turn off **Allow new users to sign up** → **Save**. Do this after you and John have both created
  accounts.
- **Cost:** free.
- **It worked if:** a sign-up attempt with a new email is refused.

---

## Costs

| What | When | Cost |
|---|---|---|
| Apple Developer Program | Step 2 | **$99 a year** |
| Supabase (staging) | Steps 8–11 | Free plan |
| Vercel (staging website) | Steps 12–13 | Free (Hobby) while the repository is public; about $20 a month (Pro) if you make it private |
| GitHub Actions (building the app on a Mac in the cloud) | Steps 15–16 | Free while the repository is public; if private, Mac minutes count 10× against 2,000 free monthly minutes (one TestFlight build is about 100–300 of them) |
| TestFlight | Steps 17–18 | Free |
| AI and payments | Not used in this test | $0 |

Making the repository private is a separate decision (`docs/security/MAKE_REPOSITORY_PRIVATE.md`). Claude won't
change it without your approval.
