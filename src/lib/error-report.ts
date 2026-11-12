"use client";

import { isHydrationError, redactMessage, redactPath, type ErrorKind } from "@/lib/error-redact";

/**
 * Production error monitoring, opt-in and private (docs/ERROR_MONITORING.md). Off unless the deployment sets
 * NEXT_PUBLIC_ERROR_REPORTING=on (and the server ERROR_REPORTING=on). When on, a script error, an unhandled promise
 * rejection, a crash screen or a hydration failure sends one small, redacted report to /api/client-errors, which writes
 * it to the server log. Nothing a member typed, no ids, no emails and no query strings are sent (src/lib/error-redact.ts).
 * At most five reports per page load, so a loop can't flood the log.
 */

const ENABLED = process.env.NEXT_PUBLIC_ERROR_REPORTING === "on";
const MAX_PER_PAGE = 5;
let sent = 0;
let installed = false;

export interface ClientErrorReport {
  kind: ErrorKind;
  name: string;
  message: string;
  path: string;
  digest: string | null;
}

/** What would be sent for this error (exported for tests). */
export function buildReport(kind: ErrorKind, error: unknown, path: string, digest?: string | null): ClientErrorReport {
  const e = error as { name?: unknown } | null;
  const message = redactMessage(error);
  return {
    kind: kind === "error" && isHydrationError(message) ? "hydration" : kind,
    name: typeof e?.name === "string" ? e.name.slice(0, 40) : "Error",
    message,
    path: redactPath(path),
    digest: typeof digest === "string" ? digest.slice(0, 40) : null,
  };
}

/** Report one error (no-op unless error reporting is switched on for this deployment). */
export function reportClientError(kind: ErrorKind, error: unknown, digest?: string | null): void {
  if (!ENABLED || sent >= MAX_PER_PAGE || typeof window === "undefined") return;
  sent += 1;
  try {
    const body = JSON.stringify(buildReport(kind, error, window.location.pathname, digest));
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/client-errors", blob)) {
      void fetch("/api/client-errors", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  } catch {
    /* reporting must never break the page */
  }
}

/** Listen for uncaught errors and rejections (called once, from src/instrumentation-client.ts). */
export function installErrorReporting(): void {
  if (!ENABLED || installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => reportClientError("error", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportClientError("unhandledrejection", e.reason));
}
