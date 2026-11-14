import "server-only";
import { NextResponse } from "next/server";
import type { Plan } from "@/lib/domain/types";
import { rateLimit } from "@/server/rate-limit";
import { getAiAllowance } from "@/server/services/ai-coach";

/**
 * How many photo uploads one member may send to the AI photo endpoints in a minute. Twice the AI burst limit
 * (AI_RATE_LIMIT_PER_MINUTE, 6 by default), so someone retrying a blurry photo meets the AI limiter's own message
 * first; this one only stops a script. It changes no allowance: analyses are still counted and capped where they
 * always were (withAiRequest / reserve_ai_usage).
 */
export const PHOTO_UPLOADS_PER_MINUTE = 12;

/**
 * Refuses an AI photo upload before its body is read. Buffering up to 5 MB and decoding and re-encoding it (up to
 * 40 megapixels) is the expensive part of these endpoints, and it used to happen before the plan was looked at, so
 * any signed-in account, Free included, could make the server do that work as often as it liked. Now a member whose
 * plan has no AI allowance gets the same 403 `not_entitled` the analysis itself would give, and uploads are limited
 * per member, both before a single byte of the photo is parsed. Returns null when the upload may go ahead; the full
 * checks (consent, monthly allowance, the 20-a-day photo cap, budgets) still run afterwards, unchanged.
 */
export async function refusePhotoUpload(userId: string, plan: Plan): Promise<NextResponse | null> {
  const allowance = await getAiAllowance(userId, plan);
  if (allowance.chatLimit <= 0) {
    return NextResponse.json({ error: "not_entitled", message: "AI coaching is included with Pro All Access." }, { status: 403 });
  }
  const burst = await rateLimit(`ai-photo-upload:${userId}`, PHOTO_UPLOADS_PER_MINUTE, 60_000);
  if (!burst.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "You're sending photos quickly. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(burst.retryAfterSeconds) } },
    );
  }
  return null;
}
