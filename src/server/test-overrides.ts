import "server-only";

/**
 * Settings that exist only so automated tests can point the app at local stand-ins (Stripe, RevenueCat, the AI
 * provider, Open Food Facts) or sign up many accounts from one machine. A production deployment must never honour
 * them by accident: a stray STRIPE_API_BASE_URL would send the secret key, and every payment, to another host.
 *
 * Rules:
 * - A stand-in address is honoured only when it points at this machine (localhost, 127.0.0.1, ::1). Anything else is
 *   ignored and the real service is used. Open Food Facts may also use an https mirror, which carries no secret.
 * - AUTH_RATE_LIMIT_SCALE (raises sign-in limits for test runs) is ignored on a production or real-money deployment
 *   and is capped at 100 elsewhere.
 */

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Is this URL on this machine? */
export function isLoopbackUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && LOOPBACK.has(u.hostname);
  } catch {
    return false;
  }
}

/** A test stand-in base URL, or null (use the real service) when unset or not on this machine. */
export function localStandIn(raw: string | undefined): string | null {
  return isLoopbackUrl(raw) ? raw!.replace(/\/+$/, "") : null;
}

/** A deployment serving real customers: Vercel production, or approved for real Stripe charges. */
export function isProductionDeployment(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.STRIPE_LIVE_APPROVED === "true";
}

/** The multiplier for the sign-in rate limits: 1 in production, otherwise AUTH_RATE_LIMIT_SCALE capped at 100. */
export function authRateLimitScale(env: Record<string, string | undefined> = process.env): number {
  if (isProductionDeployment(env)) return 1;
  const n = Number(env.AUTH_RATE_LIMIT_SCALE);
  return Number.isFinite(n) && n > 1 ? Math.min(100, Math.floor(n)) : 1;
}

/** Open Food Facts origin: a local stand-in, an https mirror, or the public API. */
export function openFoodFactsOrigin(raw: string | undefined = process.env.OFF_API_BASE_URL): string {
  if (!raw) return "https://world.openfoodfacts.org";
  if (isLoopbackUrl(raw)) return raw.replace(/\/+$/, "");
  try {
    const u = new URL(raw);
    if (u.protocol === "https:") return raw.replace(/\/+$/, "");
  } catch {
    /* fall through */
  }
  return "https://world.openfoodfacts.org";
}

/**
 * The AI provider base URL, always passed to the SDK explicitly: the SDK would otherwise read ANTHROPIC_BASE_URL
 * itself, whatever host it names. A local stand-in, or Anthropic's API.
 */
export function anthropicBaseUrl(raw: string | undefined = process.env.ANTHROPIC_BASE_URL): string {
  return localStandIn(raw) ?? "https://api.anthropic.com";
}
