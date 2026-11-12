/**
 * A local stand-in for the Anthropic Messages API (POST /v1/messages), for tests and for the evaluation harness's
 * self-test. It answers on 127.0.0.1 only, never forwards anything, and every reply it writes is scripted: nothing it
 * returns is model output, and results produced against it must never be reported as live results.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export type MockBlock = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

export interface MockRequestBody {
  model: string;
  max_tokens: number;
  stream?: boolean;
  system?: string | { type: string; text: string }[];
  messages: { role: string; content: string | { type: string; [k: string]: unknown }[] }[];
  tools?: { name: string }[];
  output_config?: { format?: unknown };
}

/** What the handler wants sent back: a message (streamed or not, as the request asked), an HTTP error, or nothing. */
export type MockAnswer =
  | { blocks: MockBlock[]; stop?: string; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }; delayMs?: number }
  | { status: number; errorType: string; message?: string }
  | { hang: true };

export interface MockApi {
  url: string;
  requests: MockRequestBody[];
  /** The headers of each request, in the same order (to check what a proxy forwards). */
  headers: Record<string, string | string[] | undefined>[];
  close: () => Promise<void>;
}

let seq = 0;

function sse(res: ServerResponse, body: MockRequestBody, answer: Extract<MockAnswer, { blocks: MockBlock[] }>) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  const send = (event: Record<string, unknown>) => res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  const usage = { input_tokens: 1000, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...answer.usage };
  send({ type: "message_start", message: { id: `msg_mock_${++seq}`, type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { ...usage, output_tokens: 1 } } });
  answer.blocks.forEach((b, index) => {
    if (b.type === "text") {
      send({ type: "content_block_start", index, content_block: { type: "text", text: "" } });
      for (const chunk of b.text.match(/[\s\S]{1,400}/g) ?? []) send({ type: "content_block_delta", index, delta: { type: "text_delta", text: chunk } });
    } else {
      send({ type: "content_block_start", index, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } });
      send({ type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input) } });
    }
    send({ type: "content_block_stop", index });
  });
  send({ type: "message_delta", delta: { stop_reason: answer.stop ?? (answer.blocks.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn"), stop_sequence: null }, usage: { output_tokens: usage.output_tokens } });
  send({ type: "message_stop" });
  res.end();
}

function json(res: ServerResponse, body: MockRequestBody, answer: Extract<MockAnswer, { blocks: MockBlock[] }>) {
  const usage = { input_tokens: 1000, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...answer.usage };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      id: `msg_mock_${++seq}`,
      type: "message",
      role: "assistant",
      model: body.model,
      content: answer.blocks,
      stop_reason: answer.stop ?? "end_turn",
      stop_sequence: null,
      usage,
    }),
  );
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Starts the stand-in on a free local port. `handler` decides each answer from the request body. */
export async function startMockMessagesApi(handler: (body: MockRequestBody, index: number) => MockAnswer | Promise<MockAnswer>): Promise<MockApi> {
  const requests: MockRequestBody[] = [];
  const headers: Record<string, string | string[] | undefined>[] = [];
  const hanging = new Set<ServerResponse>();
  const server: Server = createServer(async (req, res) => {
    if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "Not found" } }));
      return;
    }
    const body = JSON.parse(await readBody(req)) as MockRequestBody;
    requests.push(body);
    headers.push({ ...req.headers });
    const answer = await handler(body, requests.length - 1);
    if ("hang" in answer) {
      hanging.add(res);
      return;
    }
    if ("status" in answer) {
      res.writeHead(answer.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: answer.errorType, message: answer.message ?? answer.errorType } }));
      return;
    }
    if (answer.delayMs) await new Promise((r) => setTimeout(r, answer.delayMs));
    if (body.stream) sse(res, body, answer);
    else json(res, body, answer);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    headers,
    close: () =>
      new Promise<void>((resolve) => {
        for (const res of hanging) res.destroy();
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
