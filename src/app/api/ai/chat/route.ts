import { NextResponse, type NextRequest } from "next/server";
import { aiChatRequestSchema } from "@/lib/validation/schemas";
import { authenticateRequest } from "@/server/api-auth";
import { getUserPlan } from "@/server/auth";
import { AI_ERROR_STATUS, AiError, coachTurn } from "@/server/services/ai-coach";
import { logError } from "@/server/log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  try {
    const plan = await getUserPlan(auth.user.id);
    const result = await coachTurn({ supabase: auth.supabase, userId: auth.user.id, plan, ...parsed.data });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: AI_ERROR_STATUS[err.code], headers: err.retryAfterSeconds ? { "Retry-After": String(err.retryAfterSeconds) } : undefined },
      );
    }
    logError("ai.chat", err);
    return NextResponse.json({ error: "server_error", message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
