/**
 * The longest a sign-in lasts before the member is asked to sign in again (F-14, security assessment 2026-11-20).
 * Supabase refresh tokens otherwise never expire, so a session copied from a lost or shared device stayed usable for
 * ever (Supabase's own session limits need a paid plan). The access token's `amr` claim keeps the time of the original
 * sign-in through every refresh (checked against the local auth server), so the session's age can't be renewed by
 * using it.
 */
export const DEFAULT_SESSION_MAX_AGE_DAYS = 30;

/** SESSION_MAX_AGE_DAYS from the environment, between 1 and 365 days; 30 when unset or invalid. */
export function sessionMaxAgeDays(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : DEFAULT_SESSION_MAX_AGE_DAYS;
}

/** When this session was signed in (seconds since 1970), from the access token's amr claim; null if unreadable. */
export function sessionSignedInAt(accessToken: string | null | undefined): number | null {
  if (!accessToken) return null;
  try {
    // atob, not Buffer: this also runs in the middleware's edge runtime.
    const part = (accessToken.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(part + "=".repeat((4 - (part.length % 4)) % 4))) as { amr?: unknown };
    if (!Array.isArray(payload.amr)) return null;
    const times = payload.amr.map((m) => (m && typeof m === "object" ? (m as { timestamp?: unknown }).timestamp : null)).filter((t): t is number => typeof t === "number");
    return times.length ? Math.min(...times) : null;
  } catch {
    return null;
  }
}

/** The session is older than the maximum age (an unreadable token is left to the auth server's own checks). */
export function sessionTooOld(accessToken: string | null | undefined, nowMs: number, maxAgeDays: number): boolean {
  const at = sessionSignedInAt(accessToken);
  return at !== null && nowMs - at * 1000 > maxAgeDays * 86_400_000;
}
