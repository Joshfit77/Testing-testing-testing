import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { simulatedChat, simulatedStructured, sseEvents, type SimRequest } from "@/lib/demo/simulated-ai";
import { demoAiSimulated } from "@/server/demo";

export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ type: "error", error: { type: "not_found_error", message: "Not found" } }, { status: 404 });

function sameKey(given: string | null): boolean {
  const expected = Buffer.from(process.env.ANTHROPIC_API_KEY ?? "");
  const actual = Buffer.from(given ?? "");
  return expected.length > 0 && actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Demo deployments only (DEMO_MODE=true with ANTHROPIC_BASE_URL pointing here): the app's own server calls this
 * instead of the AI provider. No model runs and nothing is paid for; see src/lib/demo/simulated-ai.ts.
 */
export async function POST(request: Request) {
  if (!demoAiSimulated()) return notFound();
  if (!sameKey(request.headers.get("x-api-key"))) {
    return NextResponse.json({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, { status: 401 });
  }
  let body: SimRequest;
  try {
    body = (await request.json()) as SimRequest;
  } catch {
    return NextResponse.json({ type: "error", error: { type: "invalid_request_error", message: "Invalid JSON" } }, { status: 400 });
  }
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return NextResponse.json({ type: "error", error: { type: "invalid_request_error", message: "messages required" } }, { status: 400 });
  }
  const model = String(body.model ?? "demo");

  if (!body.stream) {
    const structured = simulatedStructured(body);
    const content = structured ? JSON.stringify(structured) : simulatedChat(body).blocks;
    return NextResponse.json({
      id: `msg_demo_${Date.now().toString(36)}`,
      type: "message",
      role: "assistant",
      model,
      content: Array.isArray(content) ? content : [{ type: "text", text: content }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    });
  }

  const reply = simulatedChat(body);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const e of sseEvents(model, reply.blocks, reply.stop)) controller.enqueue(encoder.encode(`event: ${e.type as string}\ndata: ${JSON.stringify(e)}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
