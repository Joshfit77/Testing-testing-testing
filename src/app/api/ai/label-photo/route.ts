import { NextResponse, type NextRequest } from "next/server";
import { FOOD_PHOTO_MAX_BYTES, sniffImageType } from "@/lib/domain/food-photo";
import { LABEL_PHOTO_MAX_DIMENSION } from "@/lib/domain/label-photo";
import { authenticateRequest, planForAuth } from "@/server/api-auth";
import { AI_ERROR_STATUS, AiError } from "@/server/services/ai-coach";
import { prepareImageForAi, UnreadableImageError } from "@/server/services/image-prep";
import { readLabelPhoto } from "@/server/services/label-photo";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai/label-photo — multipart form with `photo` (JPEG, PNG or WebP, up to 5 MB). Returns the label's text
 * as transcribed by the AI, for the member to correct; nothing is analysed or saved here. The photo is re-encoded on
 * the server (upright, at most 1,568 px, metadata removed), sent once and discarded. Entitlement, consent and usage
 * limits are checked on the server, as for meal photos.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.error === "unauthorized" ? 401 : 403 });
  const lengthHeader = request.headers.get("content-length");
  if (!lengthHeader || !/^\d+$/.test(lengthHeader)) return NextResponse.json({ error: "invalid_request", message: "Send the photo as a form upload." }, { status: 411 });
  if (Number(lengthHeader) > FOOD_PHOTO_MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "too_large", message: "That photo is too large. Try a smaller one." }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "Send the photo as a form upload." }, { status: 400 });
  }
  const file = form.get("photo");
  if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "invalid_request", message: "Add a photo of the label." }, { status: 400 });
  if (file.size > FOOD_PHOTO_MAX_BYTES) return NextResponse.json({ error: "too_large", message: "That photo is too large. Try a smaller one." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType) return NextResponse.json({ error: "invalid_image", message: "That file isn't a JPEG, PNG or WebP photo." }, { status: 415 });

  let prepared: Awaited<ReturnType<typeof prepareImageForAi>>;
  try {
    prepared = await prepareImageForAi(bytes, mediaType, LABEL_PHOTO_MAX_DIMENSION);
  } catch (err) {
    if (err instanceof UnreadableImageError) return NextResponse.json({ error: "invalid_image", message: "That photo couldn't be read. Try another one." }, { status: 415 });
    throw err;
  }

  try {
    const plan = await planForAuth(auth);
    const reading = await readLabelPhoto(auth.supabase, auth.user.id, plan, { base64: Buffer.from(prepared.bytes).toString("base64"), mediaType: prepared.mediaType });
    return NextResponse.json(reading, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: AI_ERROR_STATUS[err.code], headers: err.retryAfterSeconds ? { "Retry-After": String(err.retryAfterSeconds) } : undefined });
    }
    logError("ai.label_photo", err);
    return NextResponse.json({ error: "server_error", message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
