# Setup, deployment & native builds

## 1. Prerequisites

- Node.js 20+ (developed on 22) and npm
- Docker (for the local Supabase stack)
- Optional: Stripe account, Anthropic API key, USDA FoodData Central API key
- Native builds: Xcode 16+ on macOS (iOS) and Android Studio with a recent SDK (Android)

## 2. Local development

```bash
npm install
npx supabase start
npx supabase db reset
cp .env.example .env.local
npm run dev
```

`supabase start` prints the local API URL, the anon key and the service-role key. Put them in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Without the Supabase variables, the app shows a "Setup required" screen instead of crashing.

- **Emails**: confirmation and reset emails are captured by Mailpit at http://127.0.0.1:54324.
- **Seed data**: `supabase/seed.sql` is generated from `src/data/*.ts`. After editing the catalog, run `npm run seed:generate && npx supabase db reset`.

### Make yourself an admin

Sign up and finish onboarding, then run this in the Supabase SQL editor (or `psql`):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

The **Admin** item then appears in the navigation. End users can't change `role`: the column isn't updatable by them.

## 3. Optional integrations

Each integration is optional. When it isn't configured, the related feature shows a clear "not configured" message, and the rest of the app keeps working.

### AI coach (Anthropic)

```
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-opus-5-5          # optional override
AI_RATE_LIMIT_PER_MINUTE=6
```

- The AI coach needs `SUPABASE_SERVICE_ROLE_KEY`, because usage is metered in `ai_usage_events`, which users can't write to.
- Monthly limits per plan: `PLAN_*_AI_MONTHLY_LIMIT` and `PLAN_PRO_AI_PLAN_MONTHLY_LIMIT`.
- Requests use Anthropic's server-side refusal fallback where the model supports it. Model output is validated with Zod before anything is shown, and plans are saved only after explicit user approval.

### Stripe subscriptions

1. Create two recurring monthly prices in Stripe (Plus, Pro) and set:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_PLUS=price_...
   STRIPE_PRICE_PRO=price_...
   ```
2. Enable the **Customer portal** in Stripe (Settings → Billing → Customer portal), including plan switching and cancellation.
3. Webhook endpoint: `https://<your-domain>/api/stripe/webhook`, with these events:
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`
   - `invoice.paid`, `invoice.payment_failed`

   Set `STRIPE_WEBHOOK_SECRET=whsec_...`.
4. Local testing: run `stripe listen --forward-to localhost:3000/api/stripe/webhook` and use the printed secret. Test card: `4242 4242 4242 4242`.

Display prices default to $9.99 and $19.99 and can be overridden with `PLAN_PLUS_PRICE_CENTS` / `PLAN_PRO_PRICE_CENTS`. Keep them in sync with your Stripe prices.

### Food search (USDA FoodData Central)

Get a free key at https://fdc.nal.usda.gov/api-key-signup.html and set `USDA_FDC_API_KEY`. Without it, users can still log custom foods and manual entries.

## 4. Deploying to Supabase + Vercel

### Supabase (production)

1. Create a project at https://supabase.com.
2. Link it and push the schema:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push            # applies supabase/migrations
   psql "$PROD_DB_URL" -f supabase/seed.sql   # catalog seed (idempotent)
   ```
3. **Auth → URL configuration**: set the Site URL to your domain and add `https://<your-domain>/**` to the redirect URLs.
4. **Auth → Email**: keep "Confirm email" enabled. Configure custom SMTP for production email delivery.
5. Optional: change the email templates to link to `/auth/confirm?token_hash={{ .TokenHash }}&type=signup` (or `type=recovery` with `next=/reset-password`). The default `{{ .ConfirmationURL }}` flow also works through `/auth/callback`.

### Vercel

1. Import the repository into Vercel (framework: Next.js).
2. Add the environment variables from `.env.example` with production values, and set `NEXT_PUBLIC_SITE_URL=https://<your-domain>`.
3. Deploy, then point the Stripe webhook at the production URL.
4. The service worker (`/sw.js`) is served with `Cache-Control: no-cache`, so updates roll out on the next visit.

## 5. Installable web app (PWA)

The web app is already installable. The manifest is at `/manifest.webmanifest`, the icons are in `public/icons/`, the service worker at `public/sw.js` and the offline page at `public/offline.html`.

- On iOS Safari: Share → Add to Home Screen.
- On Android Chrome or desktop: use the install prompt or icon.

The service worker caches only static assets. It never caches authenticated pages or API responses. In-progress workouts persist in `localStorage` and on the server.

## 6. iOS & Android apps (Capacitor)

The native shells live in `ios/` and `android/`. They load your deployed web app: the app depends on server actions and server-side Stripe and AI calls, so it can't be exported statically. They add native capabilities:

- Haptic feedback when completing a set
- Local notifications when rest timers end, even if the app is in the background
- Native splash screen, status bar styling and the Android back button
- A built-in offline error page (`native-shell/error.html`)

### Configure and sync

```bash
# Use your production URL and a reverse-domain bundle ID you own
export CAP_SERVER_URL=https://app.yourdomain.com
export CAP_APP_ID=com.yourcompany.narrowgate
npm run cap:sync
```

`CAP_APP_ID` is read when the config is evaluated. For a permanent change, edit `appId` in `capacitor.config.ts`. Also update the bundle identifier in Xcode and the `applicationId` in `android/app/build.gradle`.

To test on a device against your dev machine, use `CAP_SERVER_URL=http://<LAN-IP>:3000 CAP_ALLOW_CLEARTEXT=true npm run cap:sync`. Never ship cleartext.

### iOS (App Store)

1. `npm run cap:ios` opens Xcode.
2. Select your Team (Signing & Capabilities) and set the bundle ID and version/build number.
3. Product → Archive, then distribute to App Store Connect.
4. In App Store Connect, provide the privacy "nutrition labels": account email, fitness data, health-related wellness notes (optional, consent-based), and purchase history if you add IAP. Add the privacy policy URL and a demo account for review.

### Android (Google Play)

1. `npm run cap:android` opens Android Studio.
2. Set the `applicationId`, `versionCode` and `versionName` in `android/app/build.gradle`.
3. Build → Generate Signed App Bundle (`.aab`) with your upload key.
4. Upload to Play Console. Complete Data safety (same data as above), the content rating, and the target audience (adults).

### App-store requirements to plan for (important)

- **In-app purchases.** Apple (App Store Review Guideline 3.1.1) and Google Play generally require their own billing systems for digital subscriptions bought in the app. The native shells therefore hide Stripe checkout: the server detects the `NarrowGateApp` user-agent token and shows a notice instead. Users with a web subscription keep their plan in the app. To sell in-app, integrate StoreKit and Google Play Billing (RevenueCat is a common choice), then map store purchases to `user_entitlements` from a server webhook. See IMPLEMENTATION_STATUS.md.
- **Account deletion.** Required by Apple. It is available in Profile → Privacy & data.
- **Minimum functionality (Guideline 4.2).** The native features above help, but reviewers may still scrutinize web-based apps. Consider adding push notifications or HealthKit / Health Connect integration before submission.
- **Universal Links / App Links.** Confirmation and reset links open in the browser by default. Add `apple-app-site-association` and `assetlinks.json` if you want them to open in the app.

### Regenerating icons and splash screens

`npm run icons` re-renders the PNGs from `public/icons/*.svg` (with Playwright's Chromium) and regenerates every native icon and splash size with `@capacitor/assets`.

## 7. Tests

```bash
npm run typecheck && npm run lint
npm run test:unit
npx supabase start && npx supabase db reset && npm run test:integration
npm run build && npm run test:e2e        # starts `next start` automatically
```

Integration and e2e tests run against the local Supabase stack. They use its standard demo keys, plus dummy Stripe and Anthropic keys, and never call those services over the network. The e2e tests read confirmation emails from Mailpit. Integration tests skip automatically if Supabase isn't reachable.
