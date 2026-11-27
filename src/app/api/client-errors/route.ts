import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ERROR_KINDS, redactMessage, redactPath } from "@/lib/error-redact";
import { logError } from "@/server/log";
import { clientIp, hashKey, rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Receives the browser's redacted error reports (src/lib/error-report.ts) and writes them to the server log, where the
 * host's log drain or alerting picks them up (docs/ERROR_MONITORING.md). Off unless ERROR_REPORTING=on. Everything is
 * redacted again here (the browser is never trusted), bodies over 4 KB are refused, and each address may send 30
 * reports per 10 minutes. The reply is always 204 and says nothing.
 */
const MAX_BYTES = 4096;
const schema = z.object({
  kind: z.enum(ERROR_KINDS),
  name: z.string().max(80),
  message: z.string().max(400),
  path: z.string().max(300),
  digest: z.string().max(80).nullable().optional(),
});

const nothing = () => new NextResponse(null, { status: 204 });

export async function POST(request: NextRequest) {
  if (process.env.ERROR_REPORTING !== "on") return nothing();
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return nothing();
  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return nothing();
  }
  if (raw.length > MAX_BYTES) return nothing();
  const limit = await rateLimit(`client-errors:${hashKey(await clientIp())}`, 30, 10 * 60_000);
  if (!limit.ok) return nothing();
  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(JSON.parse(raw));
  } catch {
    return nothing();
  }
  logError(
    `client.${parsed.kind}`,
    { name: parsed.name.replace(/[^\w]/g, "").slice(0, 40) || "Error", message: redactMessage(parsed.message) },
    { path: redactPath(parsed.path), digest: parsed.digest ? parsed.digest.replace(/[^\w-]/g, "").slice(0, 40) : null },
  );
  return nothing();
}
