import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { MAX_QUESTION } from "@/lib/biblical-ai/config";
import { authenticateRequest, planForAuth } from "@/server/api-auth";
import { logError } from "@/server/log";
import { BIBLICAL_AI_TIMEOUT_MS, askBiblicalAi, type AskResult } from "@/server/services/biblical-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** Requests larger than this are refused before they are read. */
const MAX_BODY_BYTES = 16_000;

const bodySchema = z.object({
  question: z.string().min(1).max(MAX_QUESTION + 200),
  depth: z.enum(["quick", "standard", "deep"]),
  category: z.enum(["scripture", "doctrine", "apologetics", "languages", "history", "personal"]),
  requestId: z.string().uuid(),
  conversationId: z.string().uuid().nullish(),
  passage: z.string().max(60).nullish(),
  memberShared: z.string().max(2000).nullish(),
});

/** The body as text, or null once it passes `max` bytes (read in chunks, so a chunked body without a length can't be large). */
async function readCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const STATUS: Record<string, number> = { unavailable: 503, consent_required: 403, not_entitled: 403, rate_limited: 429, quota: 429, invalid: 400, refused: 422, not_found: 404, cancelled: 499, timeout: 504, error: 500 };

/**
 * POST /api/biblical-ai/ask: one Biblical AI question (Narrow Gate Biblical AI; off unless the `biblical_ai` flag is on).
 *
 * With `Accept: application/x-ndjson` the progress is streamed as newline-delimited JSON: `{type:"status", status}`
 * (retrieving, answering, checking, saving), then `{type:"done", result}` or `{type:"error", ...}`. The answer itself is
 * sent only once it has passed every check (never unchecked text). Otherwise a single JSON result. Closing the request
 * cancels the provider call; the question isn't counted.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.error === "unauthorized" ? 401 : 403 });
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let body: unknown;
  try {
    const raw = await readCapped(request, MAX_BODY_BYTES);
    if (raw === null) return NextResponse.json({ error: "too_large" }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", message: parsed.error.issues[0]?.message }, { status: 400 });
  const plan = await planForAuth(auth).catch(() => null);
  if (!plan) return NextResponse.json({ error: "server_error", message: "Something went wrong. Please try again." }, { status: 500 });

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(BIBLICAL_AI_TIMEOUT_MS)]);
  const input = { userId: auth.user.id, plan, ...parsed.data, signal };
  const wantsStream = (request.headers.get("accept") ?? "").includes("application/x-ndjson");
  const respond = (r: AskResult) => (r.ok ? NextResponse.json(r) : NextResponse.json(r, { status: STATUS[r.code] ?? 500, headers: r.retryAfter ? { "Retry-After": String(r.retryAfter) } : undefined }));

  if (!wantsStream) {
    try {
      return respond(await askBiblicalAi(input));
    } catch (err) {
      logError("biblical_ai.route", err);
      return NextResponse.json({ ok: false, code: "error", error: "Something went wrong. Please try again." }, { status: 500 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false;
        }
      };
      // A line every 15 s while the provider works, so idle proxies don't drop the connection.
      const heartbeat = setInterval(() => send({ type: "ping" }), 15_000);
      try {
        const result = await askBiblicalAi({ ...input, onStatus: (status) => send({ type: "status", status }) });
        send(result.ok ? { type: "done", result } : { type: "error", ...result });
      } catch (err) {
        logError("biblical_ai.stream", err);
        send({ type: "error", ok: false, code: "error", error: "Something went wrong. Please try again." });
      } finally {
        clearInterval(heartbeat);
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
