import { NextResponse, type NextRequest } from "next/server";
import { FOOD_PHOTO_MAX_BYTES, sniffImageType } from "@/lib/domain/food-photo";
import { authenticateRequest } from "@/server/api-auth";
import { getUserPlan } from "@/server/auth";
import { AI_ERROR_STATUS, AiError } from "@/server/services/ai-coach";
import { analyzeFoodPhoto } from "@/server/services/food-photo";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai/food-photo — multipart form with `photo` (JPEG, PNG or WebP, up to 5 MB) and optional `notes`.
 * Returns the AI's estimate for the member to correct and confirm. The photo is read into memory, sent to the AI
 * provider once and discarded: it is never stored. Entitlement, consent and usage limits are checked on the server.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.error === "unauthorized" ? 401 : 403 });
  const lengthHeader = request.headers.get("content-length");
  if (!lengthHeader || !/^\d+$/.test(lengthHeader)) return NextResponse.json({ error: "invalid_request", message: "Send the photo as a form upload." }, { status: 411 });
  const declared = Number(lengthHeader);
  if (declared > FOOD_PHOTO_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "too_large", message: "That photo is too large. Try a smaller one." }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "Send the photo as a form upload." }, { status: 400 });
  }
  const file = form.get("photo");
  if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "invalid_request", message: "Add a photo of your meal." }, { status: 400 });
  if (file.size > FOOD_PHOTO_MAX_BYTES) return NextResponse.json({ error: "too_large", message: "That photo is too large. Try a smaller one." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType) return NextResponse.json({ error: "invalid_image", message: "That file isn't a JPEG, PNG or WebP photo." }, { status: 415 });
  const notes = String(form.get("notes") ?? "").trim().slice(0, 300);

  try {
    const plan = await getUserPlan(auth.user.id);
    const analysis = await analyzeFoodPhoto(auth.supabase, auth.user.id, plan, { base64: Buffer.from(bytes).toString("base64"), mediaType }, notes);
    return NextResponse.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: AI_ERROR_STATUS[err.code], headers: err.retryAfterSeconds ? { "Retry-After": String(err.retryAfterSeconds) } : undefined });
    }
    logError("ai.food_photo", err);
    return NextResponse.json({ error: "server_error", message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
