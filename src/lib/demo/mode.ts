/**
 * Whether this server runs the interactive demo (sample accounts, a Free/Pro switch, scripted AI, payments off).
 *
 * It needs DEMO_MODE=true, and it is refused on any deployment that serves real members or real money, whatever its
 * environment says: Vercel's production environment (VERCEL_ENV=production) or a deployment approved for live Stripe
 * charges (STRIPE_LIVE_APPROVED=true). There, a stray DEMO_MODE would otherwise open demo sign-ups and the Pro switch
 * to the public, switch real members' AI to the script and stop the payment webhooks. The demo's own hosting (a
 * protected Vercel preview, or a computer running `npm run demo`) is neither, so it is unaffected.
 */
export function demoModeOn(env: Record<string, string | undefined> = process.env): boolean {
  if (env.DEMO_MODE !== "true") return false;
  if (env.VERCEL_ENV === "production" || env.STRIPE_LIVE_APPROVED === "true") return false;
  return true;
}

/** DEMO_MODE=true was set where it isn't allowed (so it is being ignored). */
export function demoModeRefused(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEMO_MODE === "true" && !demoModeOn(env);
}
