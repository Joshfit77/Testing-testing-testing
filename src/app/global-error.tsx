"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/error-report";
import "./globals.css";

/**
 * The last-resort recovery screen: shown when the root layout itself fails, or an error escapes every other boundary
 * (pages outside the signed-in area have no error.tsx of their own). It replaces the whole document, so it carries its
 * own <html> and <body> and depends on nothing from the app shell. A workout in progress is unaffected: it is saved on
 * the device on every change (src/lib/workout-storage.ts) and comes back when the workout screen opens again.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? error.name);
    reportClientError("boundary", error, error.digest ?? null);
  }, [error]);
  return (
    <html lang="en" className="dark">
      <body className="bg-background font-sans text-foreground">
        <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
          <h1 className="font-display text-3xl font-bold uppercase">Something went wrong</h1>
          <p className="max-w-sm text-muted-foreground">
            The app hit an error it couldn&apos;t recover from on this screen. If you were logging a workout, it&apos;s saved on this device.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={reset} className="h-11 rounded-xl bg-gold-gradient px-5 font-semibold text-primary-foreground">
              Try again
            </button>
            {/* A full page load, not a client navigation: the app shell that failed is rebuilt from scratch. */}
            <a href="/home" className="inline-flex h-11 items-center rounded-xl border border-gold/80 px-5 font-semibold text-gold-highlight">
              Go to Home
            </a>
          </div>
          {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
