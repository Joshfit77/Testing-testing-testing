/**
 * Runs in the browser before the app hydrates (Next.js instrumentation-client), so it comes before any module that
 * builds a Zod schema. Zod builds each object schema with a one-time `Function("")` probe unless it has been told not
 * to; the Content-Security-Policy refuses that probe and reports it as a violation. `NativeInit` used to set this, but
 * a page's own modules can be evaluated before it (seen intermittently on /login in e2e/csp-and-layout.spec.ts).
 */
import "@/lib/zod-browser";
