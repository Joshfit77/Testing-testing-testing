/**
 * Redaction for error reports (src/lib/error-report.ts in the browser, src/app/api/client-errors on the server, and
 * src/instrumentation.ts). An error report must never carry what a member wrote or who they are: no journal or prayer
 * text, no food or health values, no email addresses, ids, tokens or query strings. Only the kind of error, a short
 * scrubbed message and the screen's path pattern are kept.
 */

export const ERROR_KINDS = ["error", "unhandledrejection", "boundary", "hydration", "server"] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

const MAX_MESSAGE = 200;

/** A scrubbed, short error message: emails, ids, tokens, numbers, quoted text and URLs' queries removed. */
export function redactMessage(raw: unknown): string {
  let s = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : String(raw ?? "");
  s = s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "<email>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, "<token>")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "<token>")
    .replace(/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/g, "$1")
    .replace(/(["'“‘])(?:(?!\1).){1,}\1/g, "<text>")
    .replace(/\d{4,}/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > MAX_MESSAGE ? `${s.slice(0, MAX_MESSAGE - 1)}…` : s;
}

/** The screen's path pattern: no query or fragment, ids and numbers replaced (e.g. /train/history/:id). */
export function redactPath(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  const path = s.split(/[?#]/)[0] ?? "";
  const parts = path
    .split("/")
    .map((seg) => (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^\d+$/.test(seg) || /^[A-Za-z0-9_-]{24,}$/.test(seg) ? ":id" : seg.slice(0, 60)));
  const out = parts.join("/").slice(0, 120);
  return out.startsWith("/") ? out : `/${out}`;
}

/** A React hydration failure (minified #418/#423/#425 in production, or the development wording). */
export function isHydrationError(message: string): boolean {
  return /Minified React error #4(18|19|20|21|22|23|25)\b|Hydration failed|didn't match the client/i.test(message);
}
