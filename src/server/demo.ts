import "server-only";
import type { User } from "@supabase/supabase-js";

/**
 * Demo mode: a private, isolated preview of the real app for the owner to click through.
 *
 * It is switched on only by the server environment (`DEMO_MODE=true`) of a deployment that uses its own throwaway
 * Supabase project (or the local stack), seeded by `scripts/demo/seed-demo.ts`. In demo mode:
 *   - payments are off: Stripe and RevenueCat keys are ignored (src/server/env.ts), so nothing can be charged;
 *   - demo accounts are marked in `app_metadata.demo`, which only the service role can set (members can't edit it);
 *   - a demo account can switch itself between Free and Pro through a server-held entitlement (source `admin`);
 *   - AI replies come from the simulated provider at /api/demo-ai unless a real key and base URL are configured.
 * Nothing here exists in a deployment without DEMO_MODE=true: every demo action and route checks it first.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

/** A demo account: marked by the server when the seed script or "Try onboarding" created it. */
export function isDemoUser(user: Pick<User, "app_metadata"> | null | undefined): boolean {
  return Boolean(user && (user.app_metadata as Record<string, unknown> | undefined)?.demo === true);
}

/** The seeded demo account's sign-in (server-only; set by the seed script's output, never committed). */
export function demoAccount(): { email: string; password: string } | null {
  const email = process.env.DEMO_ACCOUNT_EMAIL ?? "";
  const password = process.env.DEMO_ACCOUNT_PASSWORD ?? "";
  return isDemoMode() && email && password ? { email, password } : null;
}

/** Is the AI in this demo simulated (the built-in demo provider) rather than a real model? */
export function demoAiSimulated(): boolean {
  return isDemoMode() && (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/$/, "").endsWith("/api/demo-ai");
}
