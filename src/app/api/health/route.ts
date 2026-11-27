import { apiOk } from "@/server/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — public liveness and version check. The iOS TestFlight workflow calls it before building, to
 * confirm the address the app will load is up and to show which commit it serves (Vercel sets
 * VERCEL_GIT_COMMIT_SHA; other hosts can set NGF_BUILD_SHA).
 */
export function GET() {
  return apiOk({ app: "narrow-gate-fitness", commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NGF_BUILD_SHA ?? null });
}
