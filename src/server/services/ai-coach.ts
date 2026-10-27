import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getPlans, hasFeature } from "@/lib/domain/plans";
import type { Plan, UnitSystem } from "@/lib/domain/types";
import { displayWeight, weightUnit } from "@/lib/domain/units";
import { aiPlanOutputSchema, validateAiPlan, type AiPlan } from "@/lib/validation/ai";
import { isAiConfigured, isServiceRoleConfigured, serverEnv } from "@/server/env";
import { isFlagEnabled } from "@/server/flags";
import { rateLimit } from "@/server/rate-limit";
import { logError } from "@/server/log";

export type AiErrorCode =
  | "consent_required"
  | "not_configured"
  | "disabled"
  | "not_entitled"
  | "plan_not_entitled"
  | "quota"
  | "rate_limited"
  | "metering_unavailable"
  | "not_found"
  | "provider";

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export const AI_ERROR_STATUS: Record<AiErrorCode, number> = {
  consent_required: 403,
  not_configured: 503,
  disabled: 503,
  not_entitled: 403,
  plan_not_entitled: 403,
  quota: 429,
  rate_limited: 429,
  metering_unavailable: 503,
  not_found: 404,
  provider: 502,
};

const SYSTEM_PROMPT = `You are the Narrow Gate Fitness AI coach: a knowledgeable, encouraging strength and conditioning coach inside a fitness app.

What you help with: personalized training plans, exercise technique and form cues, exercise alternatives, progressive overload, adjusting difficulty, recovery and deload guidance, organizing training schedules, realistic goal setting, basic nutrition concepts (protein, calories, hydration, meal timing), and reviewing the user's logged progress and consistency.

Boundaries — always follow these:
- You are not a doctor, physical therapist or dietitian. Never diagnose injuries or medical conditions, and never present advice as medical treatment or rehabilitation. If the user describes pain, injury, dizziness, chest pain, or other symptoms, recommend they stop the aggravating activity and consult a qualified healthcare professional; you may suggest pain-free alternatives in general terms.
- Do not provide extreme dieting guidance (e.g. very-low-calorie diets, prolonged fasting for weight loss, dehydration or weight-cutting protocols), unproven "detox" or "cleanse" claims, or protocols for anabolic steroids, SARMs, prohormones, stimulant stacks or other unsafe supplements. Basic, evidence-supported information (e.g. creatine monohydrate, caffeine moderation, protein intake) is fine with a note to check with a professional if they have health conditions.
- Keep calorie recommendations moderate (a deficit of roughly 10–20% below maintenance at most) and never recommend fewer than 1,200 kcal/day.
- Don't reference religion unless the user brings it up first. Treat every user respectfully regardless of background.
- Base advice on the athlete context provided. If information is missing, make a reasonable assumption and say so briefly. Use the user's preferred units.
- Be concise and practical: short paragraphs, bullet lists for steps, specific sets/reps/RPE where helpful.
- You cannot change the user's program directly. If they want a new or modified plan, tell them to switch to "Plan" mode so you can draft one for them to review and approve.`;

const PLAN_INSTRUCTIONS = `Create a training plan for this user as structured output.
Rules:
- Use ONLY exercise slugs from the provided catalog list, and only exercises the user's equipment allows.
- 1–7 days per week (match the user's available days unless they asked otherwise), 3–8 exercises per day, realistic for their session length.
- reps as a string like "5", "8-12", "10 per side" or "AMRAP"; use seconds (and reps null) for timed exercises.
- rest_seconds 30–240 typically; rpe 5–9 (null for mobility/timed work).
- weeks 1–12. Include a clear progression description (how to add load/reps, when to deload).
- Respect stated limitations by avoiding aggravating movements, without diagnosing anything.
- In "reply", briefly explain the plan's logic in 3–6 sentences. Remind the user they can skip anything that causes pain.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: serverEnv.anthropicApiKey, maxRetries: 2, timeout: 90_000 });
  return client;
}

/** Models that accept server-side refusal fallbacks ("default" routing). */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
function fallbackParams(model: string) {
  return FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {};
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function getAiUsage(userId: string, plan: Plan) {
  const plans = getPlans();
  if (!isServiceRoleConfigured()) return { chatUsed: 0, planUsed: 0, chatLimit: plans[plan].aiMonthlyLimit, planLimit: plans[plan].aiPlanMonthlyLimit };
  const admin = getServiceSupabase();
  const since = monthStartIso();
  const [chat, gen] = await Promise.all([
    admin.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    admin.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", "plan").gte("created_at", since),
  ]);
  return { chatUsed: chat.count ?? 0, planUsed: gen.count ?? 0, chatLimit: plans[plan].aiMonthlyLimit, planLimit: plans[plan].aiPlanMonthlyLimit };
}

/** All server-side eligibility checks for an AI request. Throws AiError when not allowed. */
export async function assertAiAllowed(userId: string, plan: Plan, mode: "chat" | "plan") {
  if (!isAiConfigured()) throw new AiError("not_configured", "The AI coach isn't configured on this server.");
  if (!(await isFlagEnabled("ai_coach"))) throw new AiError("disabled", "The AI coach is temporarily unavailable.");
  if (!hasFeature(plan, "ai_coach")) throw new AiError("not_entitled", "AI coaching is included with Pro.");
  if (mode === "plan") {
    if (!hasFeature(plan, "ai_plan_generation")) throw new AiError("plan_not_entitled", "Personalized plan generation is included with Pro.");
    if (!(await isFlagEnabled("ai_plan_generation"))) throw new AiError("disabled", "Plan generation is temporarily unavailable.");
  }
  // Durable metering requires the service role (users cannot write their own usage rows).
  if (!isServiceRoleConfigured()) throw new AiError("metering_unavailable", "AI usage metering isn't configured on this server.");
  // Nothing goes to the AI provider until the member has explicitly agreed (Apple 5.1.2(i)).
  const { data: consent } = await getServiceSupabase().from("profiles").select("ai_consent_at").eq("id", userId).maybeSingle();
  if (!consent?.ai_consent_at) throw new AiError("consent_required", "Please review and agree to how the AI coach uses your data before sending a message.");
  const perMinute = Number.parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE ?? "6", 10) || 6;
  const burst = await rateLimit(`ai:${userId}`, perMinute, 60_000);
  if (!burst.ok) throw new AiError("rate_limited", "You're sending messages quickly — please wait a moment.", burst.retryAfterSeconds);
  const usage = await getAiUsage(userId, plan);
  if (usage.chatUsed >= usage.chatLimit) throw new AiError("quota", `You've used all ${usage.chatLimit} AI messages for this month.`);
  if (mode === "plan" && usage.planUsed >= usage.planLimit) throw new AiError("quota", `You've used all ${usage.planLimit} plan generations for this month.`);
  return usage;
}

async function recordUsage(userId: string, kind: "chat" | "plan", inputTokens: number, outputTokens: number) {
  const { error } = await getServiceSupabase().from("ai_usage_events").insert({ user_id: userId, kind, input_tokens: inputTokens, output_tokens: outputTokens });
  if (error) logError("ai.usage_record", error);
}

/** Summarize the user's authorized training data for the model. Faith content is never included. */
export async function buildAthleteContext(supabase: SupabaseClient, userId: string): Promise<{ text: string; units: UnitSystem; goal: string | null; equipment: string[] }> {
  const [profileRes, answersRes, sessionsRes, prsRes, weightsRes, programRes, readinessRes, goalsRes] = await Promise.all([
    supabase.from("profiles").select("unit_system, birth_year, height_cm, wellness_consent_at").eq("id", userId).single(),
    supabase.from("onboarding_answers").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("name, started_at, total_volume_kg, workout_exercises(skipped, skip_reason, exercise:exercises!workout_exercises_exercise_id_fkey(name), sets:workout_sets(reps, weight_kg, duration_seconds, rpe, completed, is_warmup))")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(8),
    supabase.from("personal_records").select("record_type, value, exercise:exercises(name)").eq("user_id", userId).eq("record_type", "estimated_1rm").order("value", { ascending: false }).limit(10),
    supabase.from("weight_entries").select("recorded_on, weight_kg").eq("user_id", userId).order("recorded_on", { ascending: false }).limit(6),
    supabase.from("user_programs").select("current_week, current_day, program:training_programs(name, duration_weeks)").eq("user_id", userId).eq("status", "active").maybeSingle(),
    supabase.from("recovery_checkins").select("checked_on, readiness_score").eq("user_id", userId).order("checked_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("nutrition_goals").select("calories, protein_g, is_estimate").eq("user_id", userId).maybeSingle(),
  ]);
  const units = (profileRes.data?.unit_system as UnitSystem) ?? "imperial";
  const u = weightUnit(units);
  const w = (kg: number) => `${displayWeight(kg, units)} ${u}`;
  const a = answersRes.data;
  const lines: string[] = [`Units: ${units === "imperial" ? "pounds / inches" : "kilograms / centimetres"}`];
  if (profileRes.data?.birth_year) lines.push(`Age: about ${new Date().getUTCFullYear() - (profileRes.data.birth_year as number)}`);
  if (a) {
    lines.push(
      `Primary goal: ${a.primary_goal}`,
      `Experience: ${a.experience}`,
      `Availability: ${a.days_per_week} days/week, ~${a.session_minutes} minutes per session`,
      `Equipment: ${(a.equipment as string[]).join(", ") || "bodyweight only"}`,
      `Preferred training styles: ${(a.preferred_types as string[]).join(", ") || "none stated"}`,
      `Dietary preferences: ${(a.dietary_preferences as string[]).join(", ")}`,
    );
    if (a.limitations && profileRes.data?.wellness_consent_at) lines.push(`User-reported limitations (consented; do not diagnose): ${a.limitations as string}`);
  }
  const prog = programRes.data?.program as unknown as { name: string; duration_weeks: number } | null;
  if (prog) lines.push(`Active program: ${prog.name}, week ${programRes.data!.current_week}/${prog.duration_weeks}, next day ${programRes.data!.current_day}`);
  const weights = weightsRes.data ?? [];
  if (weights.length) lines.push(`Recent bodyweight: ${weights.map((x) => `${x.recorded_on as string}: ${w(Number(x.weight_kg))}`).join("; ")}`);
  if (readinessRes.data) lines.push(`Latest readiness check-in: ${readinessRes.data.readiness_score}/100 on ${readinessRes.data.checked_on}`);
  if (goalsRes.data) lines.push(`Nutrition targets: ${goalsRes.data.calories} kcal, ${goalsRes.data.protein_g} g protein${goalsRes.data.is_estimate ? " (estimated)" : ""}`);
  const prs = prsRes.data ?? [];
  if (prs.length) lines.push(`Best estimated 1RMs: ${prs.map((p) => `${(p.exercise as unknown as { name: string } | null)?.name}: ${w(Number(p.value))}`).join("; ")}`);
  const sessions = (sessionsRes.data ?? []) as unknown as {
    name: string;
    started_at: string;
    workout_exercises: { skipped: boolean; skip_reason: string | null; exercise: { name: string } | null; sets: { reps: number | null; weight_kg: number | null; duration_seconds: number | null; rpe: number | null; completed: boolean; is_warmup: boolean }[] }[];
  }[];
  if (sessions.length) {
    lines.push(`Recent workouts (newest first, ${sessions.length}):`);
    for (const s of sessions) {
      const parts = s.workout_exercises.map((e) => {
        if (e.skipped) return `${e.exercise?.name} (skipped${e.skip_reason ? `: ${e.skip_reason}` : ""})`;
        const done = e.sets.filter((x) => x.completed && !x.is_warmup);
        const top = done.reduce<(typeof done)[number] | null>((best, x) => (!best || (x.weight_kg ?? 0) > (best.weight_kg ?? 0) ? x : best), null);
        const desc = top ? (top.duration_seconds ? `${top.duration_seconds}s` : `${top.weight_kg ? w(Number(top.weight_kg)) : "BW"} × ${top.reps ?? 0}${top.rpe ? ` @RPE ${top.rpe}` : ""}`) : "no completed sets";
        return `${e.exercise?.name} ${done.length} sets, top ${desc}`;
      });
      lines.push(`- ${s.started_at.slice(0, 10)} ${s.name}: ${parts.join("; ")}`);
    }
  } else {
    lines.push("No completed workouts logged yet.");
  }
  return { text: lines.join("\n"), units, goal: (a?.primary_goal as string) ?? null, equipment: (a?.equipment as string[]) ?? [] };
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal: AiPlan | null;
  proposal_status: "proposed" | "applied" | "dismissed" | null;
  created_at: string;
}

export interface CoachTurnResult {
  conversationId: string;
  userMessage: CoachMessage;
  assistantMessage: CoachMessage;
  usage: { used: number; limit: number };
}

export async function coachTurn(params: {
  supabase: SupabaseClient;
  userId: string;
  plan: Plan;
  conversationId: string | null;
  message: string;
  mode: "chat" | "plan";
}): Promise<CoachTurnResult> {
  const { supabase, userId, plan, message, mode } = params;
  const usage = await assertAiAllowed(userId, plan, mode);

  let conversationId = params.conversationId;
  if (conversationId) {
    const { data } = await supabase.from("ai_conversations").select("id").eq("id", conversationId).eq("user_id", userId).maybeSingle();
    if (!data) throw new AiError("not_found", "Conversation not found.");
  } else {
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: userId, title: message.replace(/\s+/g, " ").slice(0, 60) || "New conversation" })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Conversation insert failed");
    conversationId = data.id as string;
  }

  const { data: history } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: userRow, error: umErr } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, user_id: userId, role: "user", content: message })
    .select("id, role, content, proposal, proposal_status, created_at")
    .single();
  if (umErr || !userRow) throw umErr ?? new Error("Message insert failed");

  const context = await buildAthleteContext(supabase, userId);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...((history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string })) as Anthropic.Beta.BetaMessageParam[]),
    { role: "user", content: message },
  ];
  // The API requires alternating roles starting with a user turn; drop a leading assistant message if present.
  while (messages.length && messages[0]!.role !== "user") messages.shift();

  const model = serverEnv.aiModel;
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    { type: "text", text: `Athlete context (from the user's own logged data):\n${context.text}` },
  ];

  let reply = "";
  let proposal: AiPlan | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    if (mode === "chat") {
      const res = await getClient().beta.messages.create({
        model,
        max_tokens: 2000,
        system,
        messages,
        output_config: { effort: "low" },
        ...fallbackParams(model),
      });
      inputTokens = res.usage.input_tokens;
      outputTokens = res.usage.output_tokens;
      if (res.stop_reason === "refusal") {
        reply = "I can't help with that request. I'm happy to help with training, technique, recovery or general nutrition questions instead.";
      } else {
        reply = res.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        if (res.stop_reason === "max_tokens") reply += "\n\n_(Response shortened — ask me to continue.)_";
      }
    } else {
      const { data: exRows } = await supabase.from("exercises").select("slug, name, equipment, difficulty, is_timed").eq("is_published", true);
      const catalog = (exRows ?? []).map((e) => `${e.slug} | ${e.name} | equipment: ${(e.equipment as string[]).join("/")} | ${e.difficulty}${e.is_timed ? " | timed" : ""}`);
      const knownSlugs = new Set((exRows ?? []).map((e) => e.slug as string));
      const res = await getClient().beta.messages.parse({
        model,
        max_tokens: 12000,
        system: [...system, { type: "text", text: `${PLAN_INSTRUCTIONS}\n\nExercise catalog (slug | name | equipment | difficulty):\n${catalog.join("\n")}` }],
        messages,
        output_config: { effort: "medium", format: betaZodOutputFormat(aiPlanOutputSchema) },
        ...fallbackParams(model),
      });
      inputTokens = res.usage.input_tokens;
      outputTokens = res.usage.output_tokens;
      if (res.stop_reason === "refusal") {
        reply = "I can't create a plan for that request. Try describing your goal, schedule and equipment, and I'll draft one.";
      } else if (!res.parsed_output) {
        reply = "I couldn't produce a complete plan that time. Please try again, perhaps with a simpler request.";
      } else {
        const validation = validateAiPlan(res.parsed_output.plan, knownSlugs);
        if (validation.ok) {
          proposal = validation.plan;
          reply = res.parsed_output.reply.trim();
        } else {
          logError("ai.plan_validation", new Error(validation.errors.slice(0, 3).join(" | ")));
          reply = "I drafted a plan, but it didn't pass our safety and format checks, so I haven't shown it. Please try again.";
        }
      }
    }
  } catch (err) {
    // Remove the orphaned user message so retries don't duplicate it.
    await supabase.from("ai_messages").delete().eq("id", userRow.id);
    if (err instanceof Anthropic.RateLimitError) throw new AiError("rate_limited", "The AI service is busy. Please try again shortly.", 30);
    if (err instanceof Anthropic.APIConnectionError) throw new AiError("provider", "Couldn't reach the AI service. Please try again.");
    if (err instanceof Anthropic.APIError) {
      logError("ai.provider", err, { status: err.status ?? null });
      throw new AiError("provider", "The AI service returned an error. Please try again.");
    }
    throw err;
  }

  const { data: assistantRow, error: amErr } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      content: reply || "Sorry — I didn't get a response. Please try again.",
      proposal,
      proposal_status: proposal ? "proposed" : null,
    })
    .select("id, role, content, proposal, proposal_status, created_at")
    .single();
  if (amErr || !assistantRow) throw amErr ?? new Error("Assistant message insert failed");
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  await recordUsage(userId, mode, inputTokens, outputTokens);

  return {
    conversationId,
    userMessage: userRow as CoachMessage,
    assistantMessage: assistantRow as CoachMessage,
    usage: { used: usage.chatUsed + 1, limit: usage.chatLimit },
  };
}
