import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { startMockMessagesApi, type MockAnswer, type MockApi, type MockRequestBody } from "../../scripts/ai-eval/mock-api";
import { createTestUser, deleteTestUser, exerciseIds, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * What actually leaves the server for the AI provider (launch closure pass, 2026-11-17). Every AI entry point that can
 * run in-process is driven through its real server code (the chat and photo routes as a native client calls them, the
 * Bible, meal-plan and "Ask AI about this food" server actions, and the weekly report as the scheduled job calls it),
 * with a local stand-in for the Messages API that records each request body. Two synthetic members carry distinctive
 * markers in every sensitive table; the assertions are made on JSON.stringify of the captured bodies (system prompt,
 * messages, tool results), never on what the app intended to send.
 *
 * Only the request plumbing is stubbed (cookies, revalidation, and the Open Food Facts lookup, which is a public
 * product record, not member data). Nothing here reaches a real provider: the stand-in answers on 127.0.0.1 only.
 */
let current: SupabaseClient;
vi.mock("@/lib/supabase/server", async (original) => ({ ...(await original<typeof import("@/lib/supabase/server")>()), getServerSupabase: async () => current }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }), headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));
vi.mock("@/server/services/food-quality", async (original) => {
  const mod = await original<typeof import("@/server/services/food-quality")>();
  const { normalizeQualityProduct } = await import("@/lib/food-quality");
  const code = "3017620422003";
  const quality = normalizeQualityProduct(
    { status: 1, code, product: { code, product_name: "Marker Crunch Cereal", brands: "Test Co", categories_tags: ["en:breakfast-cereals"], nutriments: { "energy-kcal_100g": 380, proteins_100g: 9, carbohydrates_100g: 70, fat_100g: 6, sugars_100g: 20, salt_100g: 0.5 } } },
    code,
  );
  return { ...mod, getQualityProduct: async () => (quality ? { quality, diary: null } : null), searchCategory: async () => ({ status: "ok", candidates: [] }) };
});

// Scripted answers by request shape. Nothing returned here is model output.
const READ_TOOLS: { name: string; input: Record<string, unknown> }[] = [
  { name: "get_sleep_summary", input: { days: 14 } },
  { name: "get_training_review", input: {} },
  { name: "get_recovery_summary", input: { days: 14 } },
  { name: "analyze_lift_progress", input: { exercise: "bench press", weeks: 8 } },
  { name: "get_nutrition_summary", input: { days: 7 } },
  { name: "get_recent_workouts", input: { days: 30, limit: 10 } },
  { name: "get_exercise_history", input: { exercise: "bench press", sessions: 10 } },
  { name: "get_running_summary", input: { weeks: 8 } },
  { name: "get_program_week", input: { week: null } },
  { name: "get_program_recommendations", input: {} },
  { name: "recall_conversations", input: { query: null } },
];
const hasToolResults = (body: MockRequestBody) => {
  const last = body.messages.at(-1);
  return Array.isArray(last?.content) && last.content.some((c) => c.type === "tool_result");
};
function answer(body: MockRequestBody): MockAnswer {
  const system = JSON.stringify(body.system ?? "");
  if (body.tools?.length) {
    return hasToolResults(body)
      ? { blocks: [{ type: "text", text: "Here is what your records show." }] }
      : { blocks: READ_TOOLS.map((t, i) => ({ type: "tool_use" as const, id: `toolu_${i}`, name: t.name, input: t.input })), stop: "tool_use" };
  }
  if (body.output_config?.format) {
    const json = (v: unknown): MockAnswer => ({ blocks: [{ type: "text", text: JSON.stringify(v) }] });
    if (system.includes("weekly fitness report")) return json({ wentWell: ["You trained."], toImprove: [], recovery: [], recommendations: ["Train.", "Eat.", "Sleep."] });
    if (system.includes("Plan mode")) return { blocks: [] };
    if (system.includes("transcribe the text printed on a food label"))
      return json({ is_label: true, legibility: "clear", product_name: "Oats", ingredients_text: "Oats.", allergen_statement: "", nutrition: { basis: "per_100g", serving_size_grams: null, calories: 370, protein_g: 13, carbs_g: 60, sugars_g: 1, fat_g: 7, sat_fat_g: 1, fiber_g: 10, salt_g: 0, sodium_mg: null } });
    if (system.includes("estimate the nutrition of a meal"))
      return json({ is_food: true, photo_quality: "clear", packaged: false, summary: "A bowl of oats.", items: [{ name: "Oats", visible_ingredients: ["oats"], portion: "1 cup", grams: 80, calories: 300, protein_g: 10, carbs_g: 54, fat_g: 5, confidence: "medium", search_term: "oats" }], questions: [] });
    if (system.includes("explain a packaged food")) return json({ summary: "It fits.", fits: [], watch_outs: [], uncertainties: [] });
    return json({ summary: "A simple plan.", days: [], assumptions: [] }); // the meal plan
  }
  return { blocks: [{ type: "text", text: "John 3:16 speaks of God's love." }] };
}
const api: MockApi = await startMockMessagesApi((body) => answer(body));
process.env.ANTHROPIC_BASE_URL = api.url;
delete process.env.DEMO_MODE;
// Many requests from one member within a minute: the burst limit is not what is under test here.
vi.stubEnv("AI_RATE_LIMIT_PER_MINUTE", "1000");

const available = await stackAvailable();
const DAY = 86_400_000;
const DEVICE = "Zebulon Quartzfield's Ring";
const PNG_1X1 = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));

describe.skipIf(!available)("what reaches the AI provider: captured request bodies, two synthetic members", async () => {
  const svc = serviceClient();
  const { ensureWeeklyReport } = await import("@/server/services/weekly-reports");
  const { latestDuePeriod } = await import("@/lib/domain/weekly-report");
  const { sealMemory } = await import("@/server/crypto/memory-crypto");
  const { askBibleAction } = await import("@/server/actions/bible-ai");
  const { draftAiMealPlanAction } = await import("@/server/actions/ai-meal-plan");
  const { explainProductAction } = await import("@/server/actions/food-quality");
  const { setAiDataConsentAction } = await import("@/server/actions/profile");
  const { getPlanWith } = await import("@/server/auth");

  let A: TestUser;
  let B: TestUser;
  let F: TestUser; // Free plan, every consent given
  let bThread: string;
  let bConversation: string;
  const period = latestDuePeriod(new Date(), "UTC");
  const dayIso = (back: number) => new Date(Date.now() - back * DAY).toISOString().slice(0, 10);

  // ---- what each call sent --------------------------------------------------------------------------------------
  const sentDuring = async <T>(fn: () => Promise<T>): Promise<{ result: T; bodies: MockRequestBody[]; text: string }> => {
    const before = api.requests.length;
    const result = await fn();
    const bodies = api.requests.slice(before);
    return { result, bodies, text: bodies.map((b) => JSON.stringify(b)).join("\n") };
  };
  const has = (text: string, marker: string | RegExp) => (typeof marker === "string" ? text.includes(marker) : marker.test(text));
  const expectNone = (text: string, markers: (string | RegExp)[]) => {
    for (const m of markers) expect(has(text, m), `payload must not contain ${String(m)}`).toBe(false);
  };
  const expectAll = (text: string, markers: (string | RegExp)[]) => {
    for (const m of markers) expect(has(text, m), `payload should contain ${String(m)} (positive control)`).toBe(true);
  };
  /** Markers that may never reach the provider for member A, whatever A has allowed. */
  const NEVER_FOR_A: (string | RegExp)[] = [
    "ZQX-A-UNSHARED-JOURNAL",
    DEVICE,
    "Zebulon",
    "ZQX-A-RECOVERY-NOTE",
    "ZQX-A-SLEEP-NOTE",
    "ZQX-A-CHECKIN-NOTE",
    "ZQX-A-MEALNOTE",
    "ZQX-A-PHOTO",
    "ZQX-A-SCAN",
    "storage_path",
    "ZQX-A-FORGET",
    "ZQX-A-DISPLAYNAME",
    // Every one of B's markers, and B's step figures as the coach context prints them (B's days, and their average).
    "ZQX-B",
    "27,913",
    "6,543",
    "17,228",
  ];
  /**
   * Imported (Apple Health / Health Connect) data: only with the separate health permission. The context prints the
   * step average, so the imported day shows as the average of both days (11,379) instead of the typed-in 4,321; the
   * ring's heart-rate variability and breathing rate are its own readings.
   */
  const IMPORTED: (string | RegExp)[] = ["11,379", "18,437", /\b87\.3\b/, /\b13\.9\b/];

  // ---- entry points, called the way the app calls them ----------------------------------------------------------
  const token = async (u: TestUser) => (await u.client.auth.getSession()).data.session!.access_token;
  const chat = async (u: TestUser, body: Record<string, unknown>) => {
    const { POST } = await import("@/app/api/ai/chat/route");
    const res = await POST(new NextRequest("http://localhost:3000/api/ai/chat", { method: "POST", headers: { authorization: `Bearer ${await token(u)}`, "content-type": "application/json" }, body: JSON.stringify(body) }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const ask = (u: TestUser, message: string, conversationId: string | null = null, mode: "chat" | "plan" = "chat") => chat(u, { conversationId, message, mode });
  const photo = async (route: "food-photo" | "label-photo", u: TestUser, notes = "") => {
    const { POST } = route === "food-photo" ? await import("@/app/api/ai/food-photo/route") : await import("@/app/api/ai/label-photo/route");
    const form = new FormData();
    form.append("photo", new Blob([PNG_1X1], { type: "image/png" }), "photo.png");
    if (notes) form.append("notes", notes);
    const built = new Request(`http://localhost:3000/api/ai/${route}`, { method: "POST", body: form });
    const bytes = await built.arrayBuffer();
    const res = await POST(new NextRequest(built.url, { method: "POST", headers: { authorization: `Bearer ${await token(u)}`, "content-type": built.headers.get("content-type")!, "content-length": String(bytes.byteLength) }, body: bytes }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const as = <T>(u: TestUser, fn: () => Promise<T>) => {
    current = u.client;
    return fn();
  };
  /** The weekly report exactly as the scheduled job makes it (service client, plan from the entitlement row). */
  const weekly = async (u: TestUser) => {
    await svc.from("weekly_reports").delete().eq("user_id", u.id).eq("week_start", period.weekStart);
    return ensureWeeklyReport(svc, u.id, await getPlanWith(u.client, u.id), period, "UTC", 480);
  };
  const weeklyMetricsSent = (bodies: MockRequestBody[]) => JSON.parse(String(bodies[0]!.messages[0]!.content)) as { sleep: { nights: number; avgAsleepMinutes: number | null; steadiness: unknown; stages: unknown } };
  /** Every AI entry point once, for "nothing is sent" checks. Returns each outcome. */
  const everyPath = async (u: TestUser) => {
    const out: Record<string, unknown> = {};
    out.chat = await ask(u, "How is my training going?");
    out.plan = await ask(u, "Write me a 4-week plan", null, "plan");
    out.weekly = (await weekly(u)).analysis_source;
    out.bible = await as(u, () => askBibleAction("What does John 3:16 mean?", crypto.randomUUID()));
    out.foodPhoto = await photo("food-photo", u, "with honey");
    out.labelPhoto = await photo("label-photo", u);
    out.explain = await as(u, () => explainProductAction("3017620422003", "goals"));
    out.mealPlan = await as(u, () => draftAiMealPlanAction({ startDate: dayIso(0), days: 1, focus: "balanced" }));
    return out;
  };

  // ---- seed -----------------------------------------------------------------------------------------------------
  const seed = async (u: TestUser, P: "A" | "B", steps: { imported: number; manual: number }) => {
    const now = new Date().toISOString();
    const ok = (r: { error: unknown }) => {
      if (r.error) throw r.error;
    };
    ok(await svc.from("profiles").update({ display_name: `ZQX-${P}-DISPLAYNAME Person`, timezone: "UTC", faith_enabled: true, wellness_consent_at: now, coach_memory_enabled: true, coach_memory_consent_at: now, food_photo_consent_at: now }).eq("id", u.id));
    ok(await svc.from("onboarding_answers").upsert({ user_id: u.id, primary_goal: "build_strength", experience: "intermediate", days_per_week: 3, session_minutes: 45, limitations: `ZQX-${P}-LIMITATION left knee` }));
    ok(await svc.from("nutrition_goals").upsert({ user_id: u.id, calories: 2345, protein_g: 167, carbs_g: 250, fat_g: 70, is_estimate: false }));
    ok(
      await svc.from("faith_journal_entries").insert([
        { user_id: u.id, body: `ZQX-${P}-UNSHARED-JOURNAL a private prayer`, share_with_coach: false },
        { user_id: u.id, body: `ZQX-${P}-SHARED-JOURNAL thankful for strength`, share_with_coach: true },
      ]),
    );
    ok(
      await svc.from("daily_steps").insert([
        { user_id: u.id, day: dayIso(1), steps: steps.imported, source: "apple_health" },
        { user_id: u.id, day: dayIso(2), steps: steps.manual, source: "manual" },
      ]),
    );
    // Two nights inside the report week (and the last 14 days): one typed in (7 h 13 min), one from a ring (8 h 37 min).
    const night = (nightOf: string, minutes: number, extra: Record<string, unknown>) => {
      const end = new Date(`${nightOf}T06:30:00Z`);
      const start = new Date(end.getTime() - minutes * 60_000);
      return { id: crypto.randomUUID(), user_id: u.id, kind: "night", started_at: start.toISOString(), ended_at: end.toISOString(), overlap_until: end.toISOString(), timezone: "UTC", night_of: nightOf, ...extra };
    };
    const ring = { source: "apple_health", source_id: `hk-${crypto.randomUUID()}`, device_name: DEVICE, hr_avg: 51, hr_min: 44, hr_max: 70, hr_samples: 300, hrv_avg_ms: 87.3, hrv_method: "sdnn", hrv_samples: 10, rr_avg: 13.9, rr_min: 12, rr_max: 16, rr_samples: 200 };
    ok(await svc.from("sleep_sessions").insert(night(period.weekEnd, 433, { source: "manual", notes: `ZQX-${P}-SLEEP-NOTE` })));
    ok(await svc.from("sleep_sessions").insert(night(addDays(period.weekEnd, -1), 517, ring)));
    ok(await svc.from("sleep_checkins").insert({ user_id: u.id, day: period.weekEnd, restedness: 4, notes: `ZQX-${P}-CHECKIN-NOTE` }));
    ok(await svc.from("recovery_checkins").insert({ user_id: u.id, checked_on: dayIso(0), sleep_quality: 4, energy: 4, soreness: 2, stress: 2, readiness_score: 77, notes: `ZQX-${P}-RECOVERY-NOTE` }));
    // Food log: today's item name may go (general AI consent); the meal's notes are never selected.
    const { data: meal, error: mealErr } = await svc.from("meals").insert({ user_id: u.id, eaten_on: dayIso(0), meal_type: "lunch", status: "logged", notes: `ZQX-${P}-MEALNOTE` }).select("id").single();
    if (mealErr) throw mealErr;
    ok(await svc.from("meal_items").insert({ meal_id: meal.id, user_id: u.id, name: `ZQX-${P}-FOOD oat bowl`, servings: 1, calories: 412, protein_g: 21, carbs_g: 60, fat_g: 9 }));
    // Training: bench sessions with a marked workout name.
    const { "bench-press": bench } = await exerciseIds(["bench-press"]);
    const { data: sessions, error: sErr } = await svc
      .from("workout_sessions")
      .insert([3, 6, 10].map((d) => ({ user_id: u.id, client_id: crypto.randomUUID(), name: `ZQX-${P}-WORKOUT Upper`, status: "completed", started_at: new Date(Date.now() - d * DAY).toISOString(), ended_at: new Date(Date.now() - d * DAY + 3_600_000).toISOString() })))
      .select("id");
    if (sErr) throw sErr;
    const { data: wes, error: weErr } = await svc.from("workout_exercises").insert(sessions!.map((s) => ({ session_id: s.id, user_id: u.id, exercise_id: bench, position: 0 }))).select("id");
    if (weErr) throw weErr;
    ok(await svc.from("workout_sets").insert(wes!.flatMap((w) => [1, 2, 3].map((k) => ({ workout_exercise_id: w.id, user_id: u.id, set_number: k, reps: 5, weight_kg: 80, rpe: 8, completed: true, is_warmup: false })))));
    // Photos: rows whose storage paths and notes are marked. No code path should ever read them for AI.
    ok(await svc.from("progress_photos").insert({ user_id: u.id, storage_path: `${u.id}/ZQX-${P}-PHOTOFILE.jpg`, pose: "front", note: `ZQX-${P}-PHOTO-NOTE` }));
    const scanId = crypto.randomUUID();
    ok(await svc.from("body_scans").insert({ id: scanId, user_id: u.id, taken_on: dayIso(1), note: `ZQX-${P}-SCAN-NOTE` }));
    ok(await svc.from("body_scan_photos").insert({ scan_id: scanId, user_id: u.id, pose: "front", storage_path: `${u.id}/${scanId}/ZQX-${P}-SCANFILE.jpg` }));
    // Coaching memory (sealed at rest, as the app stores it).
    ok(
      await svc.from("coach_memories").insert([
        { user_id: u.id, category: "nutrition", content: sealMemory(`ZQX-${P}-MEMORY-NUTRITION likes oats`, u.id), source: "member" },
        { user_id: u.id, category: "recovery", content: sealMemory(`ZQX-${P}-MEMORY-RECOVERY sore knees after runs`, u.id), source: "member" },
      ]),
    );
    // Earlier coach conversations: one ordinary, one marked "don't remember".
    const conv = async (title: string, memoryOff: boolean, text: string) => {
      const { data, error } = await svc.from("ai_conversations").insert({ user_id: u.id, title, memory_off: memoryOff, updated_at: new Date(Date.now() - DAY).toISOString() }).select("id").single();
      if (error) throw error;
      const at = Date.now() - DAY;
      ok(
        await svc.from("ai_messages").insert([
          { conversation_id: data.id, user_id: u.id, role: "user", content: text, created_at: new Date(at).toISOString() },
          { conversation_id: data.id, user_id: u.id, role: "assistant", content: "Noted.", created_at: new Date(at + 1000).toISOString() },
        ]),
      );
      return data.id as string;
    };
    const recalled = await conv("Deadlifts", false, `ZQX-${P}-RECALL how do I deadlift`);
    await conv("Private", true, `ZQX-${P}-FORGET something I asked not to keep`);
    // An earlier Bible-helper thread.
    const thread = crypto.randomUUID();
    ok(await svc.from("bible_ai_messages").insert([{ user_id: u.id, thread_id: thread, role: "user", content: `ZQX-${P}-BIBLE my earlier question`, citations: [] }]));
    return { thread, conversation: recalled };
  };
  const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
  const setProfile = async (u: TestUser, values: Record<string, unknown>) => {
    const { error } = await svc.from("profiles").update(values).eq("id", u.id);
    if (error) throw error;
  };

  beforeAll(async () => {
    [A, B, F] = await Promise.all([createTestUser("aipay-a"), createTestUser("aipay-b"), createTestUser("aipay-free")]);
    await Promise.all([grantPlan(A, "pro"), grantPlan(B, "pro")]);
    await seed(A, "A", { imported: 18437, manual: 4321 });
    const b = await seed(B, "B", { imported: 27913, manual: 6543 });
    bThread = b.thread;
    bConversation = b.conversation;
    const now = new Date().toISOString();
    // B has allowed everything, including the health permission: none of it may ever show up in A's requests.
    await setProfile(B, { ai_data_consent_at: now, health_ai_share_consent_at: now });
    // A starts with no AI consent at all.
    await setProfile(A, { ai_data_consent_at: null, health_ai_share_consent_at: null });
    // The Free member has given every consent; only the plan can stop them.
    await setProfile(F, { ai_data_consent_at: now, food_photo_consent_at: now, wellness_consent_at: now, faith_enabled: true });
    await svc.from("nutrition_goals").upsert({ user_id: F.id, calories: 2000, protein_g: 120, carbs_g: 220, fat_g: 60, is_estimate: false });
  });

  afterAll(async () => {
    await Promise.all([A, B, F].map((u) => deleteTestUser(u)));
    await api.close();
    vi.unstubAllEnvs();
  });

  it("without AI consent: every entry point is refused and the provider receives nothing", async () => {
    const { result: out, bodies } = await sentDuring(() => everyPath(A));
    expect(bodies).toHaveLength(0);
    expect(out.chat).toMatchObject({ status: 403, body: { error: "consent_required" } });
    expect(out.plan).toMatchObject({ status: 403, body: { error: "consent_required" } });
    expect(out.weekly).toBe("rules"); // the report is still made, from rules only
    expect(out.bible).toMatchObject({ ok: false, code: "consent_required" });
    expect(out.foodPhoto).toMatchObject({ status: 403, body: { error: "consent_required" } });
    expect(out.labelPhoto).toMatchObject({ status: 403, body: { error: "consent_required" } });
    expect(out.explain).toMatchObject({ ok: false });
    expect(out.mealPlan).toMatchObject({ ok: false });
    expect((await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", A.id)).count).toBe(0);
  });

  it("Free plan (every consent given): every entry point is refused and the provider receives nothing", async () => {
    const { result: out, bodies } = await sentDuring(() => everyPath(F));
    expect(bodies).toHaveLength(0);
    expect(out.chat).toMatchObject({ status: 403, body: { error: "not_entitled" } });
    expect(out.plan).toMatchObject({ status: 403, body: { error: "not_entitled" } });
    expect(out.weekly).toBe("rules");
    expect(out.bible).toMatchObject({ ok: false, code: "not_entitled" });
    expect(out.foodPhoto).toMatchObject({ status: 403, body: { error: "not_entitled" } });
    expect(out.labelPhoto).toMatchObject({ status: 403, body: { error: "not_entitled" } });
    expect(out.explain).toMatchObject({ ok: false });
    expect(out.mealPlan).toMatchObject({ ok: false, message: expect.stringMatching(/Pro All Access/) });
    expect((await svc.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("user_id", F.id)).count).toBe(0);
  });

  it("coach chat with every read tool (AI + wellness consent, no health permission): no imported data, device name, unshared journal, notes, photos or B's data", async () => {
    await setProfile(A, { ai_data_consent_at: new Date().toISOString() });
    const { result, bodies, text } = await sentDuring(() => ask(A, "How am I doing overall? Check my sleep, recovery and bench."));
    expect(result.status).toBe(200);
    expect(bodies).toHaveLength(2); // the request that asked for the tools, and the one carrying their results
    const results = bodies[1]!.messages.at(-1)!.content as { type: string; content: string; is_error?: boolean }[];
    expect(results.filter((c) => c.type === "tool_result")).toHaveLength(READ_TOOLS.length);
    expect(results.filter((c) => c.is_error).map((c) => c.content)).toEqual([]);
    // Positive controls: what A allowed does reach the provider, so the absences below are meaningful.
    expectAll(text, ["ZQX-A-SHARED-JOURNAL", "ZQX-A-LIMITATION", "Steps: avg 4,321/day", "ZQX-A-FOOD", "ZQX-A-WORKOUT", "ZQX-A-RECALL", "ZQX-A-MEMORY-RECOVERY", "ZQX-A-MEMORY-NUTRITION", "health_platform_nights_not_shared"]);
    expectNone(text, [...NEVER_FOR_A, ...IMPORTED, A.email]);
  });

  it("with the health permission on: imported steps and the ring's readings are sent; the device name still is not", async () => {
    await setProfile(A, { health_ai_share_consent_at: new Date().toISOString() });
    try {
      const { text } = await sentDuring(() => ask(A, "How did I sleep this week?"));
      expectAll(text, ["11,379", /\b87\.3\b/, /\b13\.9\b/]);
      expectNone(text, NEVER_FOR_A);
    } finally {
      await setProfile(A, { health_ai_share_consent_at: null });
    }
    const off = await sentDuring(() => ask(A, "And my steps?"));
    expectNone(off.text, IMPORTED);
    expectAll(off.text, ["Steps: avg 4,321/day"]);
  });

  it("a journal entry is sent only while it is marked 'Share with AI Coach'", async () => {
    await svc.from("faith_journal_entries").update({ share_with_coach: true }).eq("user_id", A.id).like("body", "ZQX-A-UNSHARED-JOURNAL%");
    expectAll((await sentDuring(() => ask(A, "Encourage me."))).text, ["ZQX-A-UNSHARED-JOURNAL"]);
    await svc.from("faith_journal_entries").update({ share_with_coach: false }).eq("user_id", A.id).like("body", "ZQX-A-UNSHARED-JOURNAL%");
    const after = await sentDuring(() => ask(A, "Encourage me again."));
    expectNone(after.text, ["ZQX-A-UNSHARED-JOURNAL"]);
    expectAll(after.text, ["ZQX-A-SHARED-JOURNAL"]);
  });

  it("training-plan generation (plan mode) sends the same minimised context", async () => {
    const { result, bodies, text } = await sentDuring(() => ask(A, "Write me a 4-week strength plan", null, "plan"));
    expect(result.status).toBe(200);
    expect(bodies).toHaveLength(1);
    expectAll(text, ["ZQX-A-SHARED-JOURNAL", "Plan mode"]);
    expectNone(text, [...NEVER_FOR_A, ...IMPORTED, A.email]);
  });

  it("weekly report (as the scheduled job makes it): only A's figures; imported nights only with the health permission", async () => {
    await setProfile(A, { health_ai_share_consent_at: null });
    const off = await sentDuring(() => weekly(A));
    expect(off.result.analysis_source).toBe("ai");
    expect(off.bodies).toHaveLength(1);
    expect(weeklyMetricsSent(off.bodies).sleep).toMatchObject({ nights: 1, avgAsleepMinutes: 433, stages: null });
    expectNone(off.text, [...NEVER_FOR_A, /\b517\b/, "ZQX-A"]);
    await setProfile(A, { health_ai_share_consent_at: new Date().toISOString() });
    const on = await sentDuring(() => weekly(A));
    try {
      expect(weeklyMetricsSent(on.bodies).sleep).toMatchObject({ nights: 2, avgAsleepMinutes: 475 });
      expectNone(on.text, NEVER_FOR_A);
    } finally {
      await setProfile(A, { health_ai_share_consent_at: null });
    }
  });

  it("weekly report: without wellness consent no sleep figures are sent (as for the coach's tools)", async () => {
    await setProfile(A, { wellness_consent_at: null });
    try {
      const { bodies } = await sentDuring(() => weekly(A));
      expect(bodies).toHaveLength(1);
      expect(weeklyMetricsSent(bodies).sleep).toMatchObject({ nights: 0, avgAsleepMinutes: null, steadiness: null, stages: null });
    } finally {
      await setProfile(A, { wellness_consent_at: new Date().toISOString() });
    }
  });

  it("without wellness consent the coach gets no limitation note, recovery memory or sleep", async () => {
    // Only the consent is cleared (the note itself is kept), so this tests the gate, not the deletion.
    await setProfile(A, { wellness_consent_at: null });
    try {
      const { text } = await sentDuring(() => ask(A, "Check my sleep and recovery."));
      expectNone(text, ["ZQX-A-LIMITATION", "ZQX-A-MEMORY-RECOVERY", /\b433\b/, "7h 13m", ...NEVER_FOR_A, ...IMPORTED]);
      expectAll(text, ["hasn't allowed sleep logging"]);
    } finally {
      await setProfile(A, { wellness_consent_at: new Date().toISOString() });
    }
  });

  it("cross-account: A can't continue B's conversation or read B's Bible thread into a request", async () => {
    const conv = await sentDuring(() => ask(A, "Continue", bConversation));
    expect(conv.result).toMatchObject({ status: 404, body: { error: "not_found" } });
    expect(conv.bodies).toHaveLength(0);
    const bible = await sentDuring(() => as(A, () => askBibleAction("What does Psalm 23 say about rest?", bThread)));
    expect(bible.result).toMatchObject({ ok: true });
    expect(bible.bodies).toHaveLength(1);
    expectNone(bible.text, ["ZQX-B", "ZQX-"]);
    expectAll(bible.text, ["Psalm 23 say about rest"]);
  });

  it("Bible helper: the question, its own thread and Bible text only; never the journal or any other record", async () => {
    const { result, bodies, text } = await sentDuring(() => as(A, () => askBibleAction("What does John 3:16 mean?", crypto.randomUUID())));
    expect(result).toMatchObject({ ok: true });
    expect(bodies).toHaveLength(1);
    expectNone(text, ["ZQX-", A.email]);
  });

  it("food photo and label photo: the re-encoded image and the member's note only; separate photo consent required", async () => {
    const food = await sentDuring(() => photo("food-photo", A, "with honey"));
    expect(food.result.status).toBe(200);
    expect(food.bodies).toHaveLength(1);
    const content = food.bodies[0]!.messages[0]!.content as { type: string; source?: { type: string } }[];
    expect(content.map((c) => c.type)).toEqual(["image", "text"]);
    expect(content[0]!.source?.type).toBe("base64");
    expectAll(food.text, ["with honey"]);
    expectNone(food.text, ["ZQX-", A.email]);
    const label = await sentDuring(() => photo("label-photo", A));
    expect(label.result.status).toBe(200);
    expect(label.bodies).toHaveLength(1);
    expectNone(label.text, ["ZQX-", A.email]);
    // Without the separate food-photo consent nothing is sent, even with the general AI consent.
    await setProfile(A, { food_photo_consent_at: null });
    try {
      const refused = await sentDuring(async () => [await photo("food-photo", A), await photo("label-photo", A)]);
      expect(refused.result.map((r) => r.body.error)).toEqual(["consent_required", "consent_required"]);
      expect(refused.bodies).toHaveLength(0);
    } finally {
      await setProfile(A, { food_photo_consent_at: new Date().toISOString() });
    }
  });

  it("'Ask AI about this food': product facts plus goal, diet, targets and filters; nothing else of the member's", async () => {
    const { result, bodies, text } = await sentDuring(() => as(A, () => explainProductAction("3017620422003", "goals")));
    expect(result).toMatchObject({ ok: true });
    expect(bodies).toHaveLength(1);
    expectAll(text, ["Marker Crunch Cereal", "2345 kcal"]);
    expectNone(text, ["ZQX-", A.email]);
  });

  it("AI meal plan: targets, settings, the member's note and nutrition memories only", async () => {
    const { result, bodies, text } = await sentDuring(() => as(A, () => draftAiMealPlanAction({ startDate: dayIso(0), days: 1, focus: "balanced", notes: "quick breakfasts" })));
    expect(result).toMatchObject({ ok: true });
    expect(bodies).toHaveLength(1);
    expectAll(text, ["quick breakfasts", "ZQX-A-MEMORY-NUTRITION"]);
    expectNone(text, ["ZQX-A-MEMORY-RECOVERY", "ZQX-A-LIMITATION", "ZQX-A-SHARED-JOURNAL", ...NEVER_FOR_A, ...IMPORTED, A.email]);
  });

  it("after AI consent is withdrawn (the real setting action), the next call of every entry point sends nothing", async () => {
    // Health permission on first, to show withdrawal clears it too.
    await setProfile(A, { health_ai_share_consent_at: new Date().toISOString() });
    expect(await as(A, () => setAiDataConsentAction(false))).toMatchObject({ ok: true });
    const { data: profile } = await svc.from("profiles").select("ai_data_consent_at, health_ai_share_consent_at, coach_memory_enabled").eq("id", A.id).single();
    expect(profile).toEqual({ ai_data_consent_at: null, health_ai_share_consent_at: null, coach_memory_enabled: false });
    const { result: out, bodies } = await sentDuring(() => everyPath(A));
    expect(bodies).toHaveLength(0);
    expect(out.chat).toMatchObject({ status: 403, body: { error: "consent_required" } });
    expect(out.bible).toMatchObject({ ok: false, code: "consent_required" });
    expect(out.weekly).toBe("rules");
    expect(out.foodPhoto).toMatchObject({ status: 403, body: { error: "consent_required" } });
  });

  it("across every request captured in this file: no Body Scan or progress-photo path, note or image, and nothing of B's", () => {
    expect(api.requests.length).toBeGreaterThan(10);
    const all = api.requests.map((b) => JSON.stringify(b)).join("\n");
    expectNone(all, ["ZQX-A-PHOTO", "ZQX-A-SCAN", "ZQX-B", "storage_path", "body-scans/", "progress-photos/", "signedUrl", DEVICE]);
    // The only images ever sent are the two meal/label uploads above (re-encoded 1×1 test images).
    const images = api.requests.flatMap((b) => b.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : []).filter((c) => c.type === "image")));
    expect(images).toHaveLength(2);
  });
});
