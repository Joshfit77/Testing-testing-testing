import { z } from "zod";

/**
 * Zod finds out whether it may compile validators with eval by calling Function("") once. The Content-Security-Policy
 * doesn't allow eval (src/lib/security-headers.ts), so in the browser that probe is refused and reported as a CSP
 * violation, after which Zod uses its no-eval path anyway. Asking for that path up front skips the refused probe.
 * The server (Node, no CSP) keeps the faster compiled validators.
 */
if (typeof window !== "undefined") z.config({ jitless: true });
