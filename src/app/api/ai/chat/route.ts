import { NextResponse, type NextRequest } from "next/server";
import { aiChatRequestSchema } from "@/lib/validation/schemas";
import { authenticateRequest } from "@/server/api-auth";
import { getUserPlan } from "@/server/auth";
import { AI_ERROR_STATUS, AiError, coachTurn, type CoachEvent, type CoachTurnResult } from "@/server/services/ai-coach";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

function errorBody(err: unknown): { status: number; body: { error: string; message: string }; retryAfter?: number } {
  if (err instanceof AiError) return { status: AI_ERROR_STATUS[err.code], body: { error: err.code, message: err.message }, retryAfter: err.retryAfterSeconds };
  logError("ai.chat", err);
  return { status: 500, body: { error: "server_error", message: "Something went wrong. Please try again." } };
}

/**
 * POST /api/ai/chat — one coach turn.
 *
 * Default: a JSON `CoachTurnResult` (native clients). With `Accept: application/x-ndjson` the reply is
 * streamed as newline-delimited JSON events: `status`, `tool` (activity label), `text` (delta),
 * `reset`, then a final `done` (with the saved messages) or `error`. Eligibility errors that happen
 * before anything is streamed are still returned as normal JSON with the matching HTTP status.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.error === "unauthorized" ? 401 : 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = aiChatRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", message: parsed.error.issues[0]?.message }, { status: 400 });
  const wantsStream = (request.headers.get("accept") ?? "").includes("application/x-ndjson");
  const plan = await getUserPlan(auth.user.id).catch(() => null);
  if (!plan) return NextResponse.json({ error: "server_error", message: "Something went wrong. Please try again." }, { status: 500 });

  if (!wantsStream) {
    try {
      const result = await coachTurn({ supabase: auth.supabase, userId: auth.user.id, plan, ...parsed.data });
      return NextResponse.json(result);
    } catch (err) {
      const e = errorBody(err);
      return NextResponse.json(e.body, { status: e.status, headers: e.retryAfter ? { "Retry-After": String(e.retryAfter) } : undefined });
    }
  }

  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true; // the client went away; the turn still finishes and is saved
    },
  });
  const send = (event: Record<string, unknown>) => {
    if (closed) return;
    try {
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    } catch {
      closed = true;
    }
  };
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      controller.close();
    } catch {
      /* already closed */
    }
  };

  let resolveStarted!: () => void;
  const started = new Promise<void>((resolve) => (resolveStarted = resolve));
  const turn: Promise<CoachTurnResult> = coachTurn({
    supabase: auth.supabase,
    userId: auth.user.id,
    plan,
    ...parsed.data,
    onEvent: (e: CoachEvent) => {
      resolveStarted();
      send(e);
    },
  });

  try {
    await Promise.race([started, turn]);
  } catch (err) {
    // Failed before streaming started (not configured, quota, rate limit…): plain JSON with a status.
    const e = errorBody(err);
    return NextResponse.json(e.body, { status: e.status, headers: e.retryAfter ? { "Retry-After": String(e.retryAfter) } : undefined });
  }

  turn
    .then((result) => send({ type: "done", result }))
    .catch((err) => {
      const e = errorBody(err);
      send({ type: "error", status: e.status, ...e.body });
    })
    .finally(close);

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
