/**
 * Who may choose a new password in the app: only a session that an emailed link opened a short while ago.
 *
 * The app has no "change password" form for an ordinary signed-in session: Profile → Change password sends a reset
 * email, and the link in it signs the member in. Supabase records how a session started in the access token's `amr`
 * claim: `password` for a normal sign-in, `otp` for an emailed link (reset, sign-up confirmation, magic link).
 * Requiring a recent `otp` sign-in means someone holding an unlocked, signed-in phone can't open /reset-password and
 * lock the member out; they would need the member's inbox.
 */
export const EMAIL_LINK_WINDOW_SECONDS = 30 * 60;

/** Methods that mean "signed in by a link sent to the member's email". `recovery` is accepted for older servers. */
const EMAIL_LINK_METHODS = new Set(["otp", "recovery"]);

export function openedByRecentEmailLink(amr: unknown, nowSeconds: number): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    if (typeof method !== "string" || !EMAIL_LINK_METHODS.has(method) || typeof timestamp !== "number") return false;
    const age = nowSeconds - timestamp;
    // A little clock skew between the auth server and this one is fine; a timestamp from the future beyond that isn't.
    return age >= -60 && age <= EMAIL_LINK_WINDOW_SECONDS;
  });
}
