/**
 * The evaluation harness's spending guard: a local HTTP proxy (127.0.0.1 only) that every model call of an evaluation
 * goes through. It holds the real API key (the app under test is given a dummy one), refuses any request that could
 * take the run past its request or dollar ceiling (judged on the request's worst case before it is sent), meters
 * what each response actually used, and keeps no request or response bodies and no headers.
 *
 * It is not a public endpoint: it binds to the loopback interface, accepts POST /v1/messages only, and exists only for
 * the life of one harness run.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { costUsd, priceFor, worstCaseUsd, type Usage } from "./pricing";

export interface BudgetLimits {
  /** The most model requests the run may send (each tool round and each judge call is one). */
  maxRequests: number;
  /** The most the run may spend, in USD at list price. */
  maxUsd: number;
}

export interface MeteredCall {
  at: string;
  model: string;
  status: number;
  stream: boolean;
  /** Time to the first byte of the response, and to its end. */
  firstByteMs: number;
  totalMs: number;
  usage: Usage;
  costUsd: number;
  /** Who sent it (`x-ai-eval-tag`), e.g. "S03#2" or "judge:S03#2". */
  tag: string;
}

export interface BudgetProxy {
  url: string;
  calls: MeteredCall[];
  spentUsd: () => number;
  /** Set once a request was refused for the budget: the run must stop. */
  stopped: () => string | null;
  /** Labels the requests that follow (the coach's own requests carry no tag header; the harness sends one turn at a time). */
  setTag: (tag: string) => void;
  close: () => Promise<void>;
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

/** Reads usage out of a streamed (server-sent events) response as it passes through. */
function sseUsageReader() {
  let buffer = "";
  const usage: Usage = {};
  return {
    usage,
    push(text: string) {
      buffer += text;
      let i: number;
      while ((i = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(line.slice(5)) as { type?: string; message?: { usage?: Usage }; usage?: Usage };
          // message_start carries the input side; message_delta the running output count (cumulative).
          if (ev.type === "message_start" && ev.message?.usage) Object.assign(usage, ev.message.usage);
          if (ev.type === "message_delta" && ev.usage) Object.assign(usage, ev.usage);
        } catch {
          /* a partial or non-JSON line: ignore */
        }
      }
    },
  };
}

const refuse = (message: string) => JSON.stringify({ type: "error", error: { type: "invalid_request_error", message } });

export async function startBudgetProxy(opts: { upstream: string; apiKey: string; limits: BudgetLimits; log?: (line: string) => void }): Promise<BudgetProxy> {
  const calls: MeteredCall[] = [];
  let spent = 0;
  let reserved = 0;
  let sent = 0;
  let stopReason: string | null = null;
  let currentTag = "untagged";
  const log = opts.log ?? (() => {});

  const server: Server = createServer(async (req, res) => {
    if (req.method !== "POST" || !(req.url ?? "").startsWith("/v1/messages") || (req.url ?? "").startsWith("/v1/messages/batches")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(refuse("The evaluation proxy only forwards POST /v1/messages."));
      return;
    }
    const raw = await readBody(req);
    let body: { model?: string; max_tokens?: number; stream?: boolean };
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(refuse("Invalid JSON."));
      return;
    }
    const model = String(body.model ?? "");
    const tag = String(req.headers["x-ai-eval-tag"] ?? currentTag).slice(0, 80);
    if (!priceFor(model)) {
      stopReason = `refused a request for ${model}, which has no verified price`;
      res.writeHead(400, { "content-type": "application/json" });
      res.end(refuse(`Evaluation budget: no verified price for ${model}.`));
      return;
    }
    const worst = worstCaseUsd(model, raw.length, Number(body.max_tokens ?? 0));
    if (stopReason || sent >= opts.limits.maxRequests || spent + reserved + worst > opts.limits.maxUsd) {
      stopReason ??= sent >= opts.limits.maxRequests ? `request ceiling of ${opts.limits.maxRequests} reached` : `spend ceiling of $${opts.limits.maxUsd.toFixed(2)} would be exceeded (spent $${spent.toFixed(4)}, next request up to $${worst.toFixed(4)})`;
      log(`budget: refused ${tag} (${stopReason})`);
      // 400: not retried by the SDK, so a refused request costs nothing and ends at once.
      res.writeHead(400, { "content-type": "application/json" });
      res.end(refuse(`Evaluation budget reached: ${stopReason}.`));
      return;
    }
    sent++;
    reserved += worst;
    const started = Date.now();
    let firstByte = 0;
    let status = 0;
    let usage: Usage = {};
    try {
      // Only what the API needs is forwarded: never the dummy key or any other credential the app process holds.
      const headers: Record<string, string> = { "content-type": "application/json", "x-api-key": opts.apiKey };
      for (const h of ["anthropic-version", "anthropic-beta"]) {
        const v = req.headers[h];
        if (typeof v === "string") headers[h] = v;
      }
      const upstream = await fetch(`${opts.upstream.replace(/\/$/, "")}/v1/messages`, { method: "POST", headers, body: new Uint8Array(raw) });
      status = upstream.status;
      firstByte = Date.now() - started;
      const contentType = upstream.headers.get("content-type") ?? "application/json";
      const passHeaders: Record<string, string> = { "content-type": contentType };
      for (const h of ["retry-after", "request-id"]) {
        const v = upstream.headers.get(h);
        if (v) passHeaders[h] = v;
      }
      res.writeHead(status, passHeaders);
      if (contentType.includes("text/event-stream") && upstream.body) {
        const reader = sseUsageReader();
        const decoder = new TextDecoder();
        for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
          reader.push(decoder.decode(chunk, { stream: true }));
          res.write(chunk);
        }
        usage = reader.usage;
      } else {
        const text = await upstream.text();
        if (status === 200) {
          try {
            usage = (JSON.parse(text) as { usage?: Usage }).usage ?? {};
          } catch {
            /* keep empty */
          }
        }
        res.write(text);
      }
      res.end();
    } catch (err) {
      status = status || 502;
      if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
      res.end(refuse(`Evaluation proxy could not reach the API: ${(err as Error).message}`));
    } finally {
      reserved -= worst;
      const cost = status === 200 ? costUsd(model, usage) : 0;
      spent += cost;
      calls.push({ at: new Date(started).toISOString(), model, status, stream: Boolean(body.stream), firstByteMs: firstByte, totalMs: Date.now() - started, usage, costUsd: cost, tag });
      log(`${tag} ${model} ${status} ${Date.now() - started} ms $${cost.toFixed(5)} (run total $${spent.toFixed(4)})`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    spentUsd: () => spent,
    stopped: () => stopReason,
    setTag: (tag) => {
      currentTag = tag;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
