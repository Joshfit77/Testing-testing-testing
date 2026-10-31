/**
 * Messages the auth link routes (/auth/callback, /auth/confirm) show on the sign-in page. The routes pass a code,
 * never text: the sign-in page only shows these fixed messages, so a crafted link like
 * /login?error=Your+account+is+locked.+Call+… can't put its own words on the app's sign-in page.
 */
export const AUTH_LINK_MESSAGES = {
  link_invalid: "That link is invalid or has expired.",
  link_processed: "Your link was processed. Please sign in to continue.",
} as const;

export type AuthLinkMessage = keyof typeof AUTH_LINK_MESSAGES;

export function authLinkMessage(code: unknown): string | null {
  return typeof code === "string" && Object.hasOwn(AUTH_LINK_MESSAGES, code) ? AUTH_LINK_MESSAGES[code as AuthLinkMessage] : null;
}
