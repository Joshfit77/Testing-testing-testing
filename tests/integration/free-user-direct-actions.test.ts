import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTestUser, deleteTestUser, exerciseIds, grantPlan, serviceClient, stackAvailable, type TestUser } from "./helpers";

/**
 * Every server action that opens a Pro feature, called directly (as a script with a Free member's own session would)
 * rather than through the screens that hide the buttons. The member's session is real; only the request plumbing
 * (cookies, revalidation) is stubbed. Each call must be refused with the plan message and write nothing; granting Pro
 * server-side (the only way a plan is ever set) opens the same call. Nothing here may reach an AI provider: the
 * refused calls never get that far, and a slip would hit a closed port.
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
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";
// The demo Pro switch must be inert here: DEMO_MODE is not set on this process (and is never set in production).
delete process.env.DEMO_MODE;

const available = await stackAvailable();

const count = async (svc: SupabaseClient, table: string, column: string, id: string) =>
  (await svc.from(table).select("id", { count: "exact", head: true }).eq(column, id)).count ?? 0;

describe.skipIf(!available)("a Free member calling Pro server actions directly is refused server-side", () => {
  let free: TestUser;
  const svc = serviceClient();

  beforeAll(async () => {
    free = await createTestUser("direct-free");
    current = free.client;
    const now = new Date().toISOString();
    await svc.from("profiles").update({ onboarding_completed_at: now, ai_data_consent_at: now, timezone: "UTC" }).eq("id", free.id);
  });
  afterAll(async () => deleteTestUser(free));

  it("meal planner, recipes, grocery lists and AI meal plans", async () => {
    const mealPlan = await import("@/server/actions/meal-plan");
    const recipes = await import("@/server/actions/recipes");
    const grocery = await import("@/server/actions/grocery");
    const aiMeal = await import("@/server/actions/ai-meal-plan");
    const today = new Date().toISOString().slice(0, 10);
    for (const res of [
      await mealPlan.generatePlanAction({ days: 7 }),
      await mealPlan.savePlannerSettingsAction({}),
      await mealPlan.swapPlanMealAction({ planId: randomUUID(), mealId: randomUUID(), recipeId: randomUUID() }),
      await mealPlan.logPlanMealAction({ planId: randomUUID(), mealId: randomUUID() }),
      await mealPlan.setPlanPortionAction({ planId: randomUUID(), mealId: randomUUID(), portion: 1 }),
      await mealPlan.replacePlanIngredientAction({ planId: randomUUID(), mealId: randomUUID(), ingredient: "oats", replacement: "rice" }),
      await recipes.saveRecipeAction({ name: "Oats", servings: 1, ingredients: [] }),
      await recipes.logRecipeAction({ recipeId: randomUUID(), date: today, mealType: "breakfast", servings: 1 }),
      await grocery.generateGroceryAction({ from: today, to: today }),
      await grocery.addGroceryItemAction({ name: "Milk" }),
      await grocery.toggleGroceryItemAction({ id: randomUUID(), checked: true }),
      // Schema-valid, so the refusal is the plan check and not the input check.
      await aiMeal.draftAiMealPlanAction({ startDate: today, days: 3, focus: "balanced" }),
      await aiMeal.approveAiMealPlanAction(),
    ]) {
      expect(res.ok).toBe(false);
      expect(res.message).toMatch(/Pro All Access/);
    }
    for (const table of ["recipes", "meal_plans", "grocery_lists", "meal_plan_drafts", "ai_usage_events"]) {
      expect(await count(svc, table, "user_id", free.id)).toBe(0);
    }
  });

  it("custom program builder, calendar rescheduling, strength ranks, food filters and AI product explanations", async () => {
    const { buildCustomProgramAction } = await import("@/server/actions/custom-programs");
    const { movePlannedSessionAction } = await import("@/server/actions/calendar");
    const { setStrengthStandardsAction } = await import("@/server/actions/body-map");
    const { setFoodFiltersAction, explainProductAction } = await import("@/server/actions/food-quality");
    expect((await buildCustomProgramAction({} as never)).message).toMatch(/Pro All Access/);
    expect((await movePlannedSessionAction({ dayId: randomUUID(), date: "2026-11-10" })).message).toMatch(/Pro All Access/);
    const ranks = await setStrengthStandardsAction("women");
    expect(ranks.ok).toBe(false);
    if (!ranks.ok) expect(ranks.error).toMatch(/Pro All Access/);
    const filters = await setFoodFiltersAction({ allergens: ["gluten"], diet: "vegan", nutrition: [] });
    expect(filters.ok).toBe(false);
    if (!filters.ok) expect(filters.error).toMatch(/Pro All Access/);
    // The AI explanation is refused by the allowance before any provider call (the provider port is closed above).
    const explain = await explainProductAction("3017620422003");
    expect(explain.ok).toBe(false);
    if (!explain.ok) expect(explain.error).toMatch(/Pro All Access|isn't in Open Food Facts|isn't responding/);
    const { data: profile } = await svc.from("profiles").select("strength_standards, food_filters").eq("id", free.id).single();
    expect(profile?.strength_standards ?? "men").toBe("men");
    expect(profile?.food_filters).toBeNull();
    expect(await count(svc, "training_programs", "owner_id", free.id)).toBe(0);
    expect(await count(svc, "ai_usage_events", "user_id", free.id)).toBe(0);
  });

  it("a published Pro-tier program can't be saved or started", async () => {
    const { saveProgramAction, startProgramAction } = await import("@/server/actions/programs");
    const { data: paid } = await svc.from("training_programs").select("id").eq("is_published", true).in("tier", ["plus", "pro"]).limit(1).maybeSingle();
    if (!paid) return; // no paid library program seeded in this database
    const form = new FormData();
    form.set("programId", paid.id as string);
    expect((await saveProgramAction({ ok: false }, form)).message).toMatch(/upgraded plan/);
    expect((await startProgramAction({ ok: false }, form)).message).toMatch(/upgraded plan/);
    expect(await count(svc, "user_programs", "user_id", free.id)).toBe(0);
  });

  it("Body Scan consent, live GPS saving and food-photo consent", async () => {
    const scan = await import("@/server/actions/body-scan");
    const gps = await import("@/server/actions/gps-activities");
    const photo = await import("@/server/actions/food-photo");
    const consent = await scan.giveBodyScanConsentAction(true);
    expect(consent.ok).toBe(false);
    if (!consent.ok) expect(consent.error).toMatch(/Pro/);
    const saved = await gps.saveGpsActivityAction({});
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.error).toMatch(/Pro All Access/);
    const photoConsent = await photo.setFoodPhotoConsentAction(true);
    expect(photoConsent.ok).toBe(false);
    if (!photoConsent.ok) expect(photoConsent.error).toMatch(/Pro/);
    const logged = await photo.logFoodPhotoItemsAction({});
    expect(logged.ok).toBe(false);
    if (!logged.ok) expect(logged.error).toMatch(/Pro/);
    const { data: profile } = await svc.from("profiles").select("body_scan_consent_at, food_photo_consent_at").eq("id", free.id).single();
    expect(profile?.body_scan_consent_at).toBeNull();
    expect(profile?.food_photo_consent_at).toBeNull();
    expect(await count(svc, "activities", "user_id", free.id)).toBe(0);
  });

  it("AI coach proposals, coaching memory and adaptive training", async () => {
    const coach = await import("@/server/actions/coach");
    const memory = await import("@/server/actions/coach-memory");
    const adaptive = await import("@/server/actions/adaptive-training");
    for (const res of [
      await coach.applyProposalAction(randomUUID(), true),
      await coach.applyCoachProposalAction(randomUUID()),
      await memory.setCoachMemoryEnabledAction(true),
      await memory.addCoachMemoryAction({ category: "schedule", content: "Prefers morning sessions" }),
      await memory.updateCoachMemoryAction(randomUUID(), { category: "schedule", content: "Evenings" }),
      await adaptive.acceptRecommendationAction("deload_week"),
      await adaptive.rejectRecommendationAction("deload_week"),
      await adaptive.restoreRecommendationAction("deload_week"),
    ]) {
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toMatch(/Pro/);
    }
    const { data: profile } = await svc.from("profiles").select("coach_memory_enabled").eq("id", free.id).single();
    expect(profile?.coach_memory_enabled ?? false).toBe(false);
    expect(await count(svc, "coach_memories", "user_id", free.id)).toBe(0);
  });

  it("saved workouts stop at the Free limit through the action, and a template beyond it is not written", async () => {
    const { createTemplateAction } = await import("@/server/actions/templates");
    const { getPlans } = await import("@/lib/domain/plans");
    const limit = getPlans().free.templateLimit!;
    const { error } = await svc.from("workout_templates").insert(Array.from({ length: limit }, (_, i) => ({ user_id: free.id, name: `Seeded ${i + 1}` })));
    if (error) throw error;
    const ids = await exerciseIds(["back-squat"]);
    const exerciseId = Object.values(ids)[0];
    expect(exerciseId).toBeTruthy();
    const res = await createTemplateAction({
      name: "One too many",
      notes: null,
      exercises: [{ exerciseId, sets: 3, target: "reps", reps: "5", durationSeconds: null, distanceM: null, restSeconds: 90, supersetGroup: null, notes: null }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Free accounts can keep/);
    expect(await count(svc, "workout_templates", "user_id", free.id)).toBe(limit);
  });

  it("the demo Free/Pro switch does nothing when DEMO_MODE is not set", async () => {
    const { setDemoPlanAction } = await import("@/server/actions/demo");
    // Even an account flagged as a demo account (only the service role can set app_metadata) gets nothing without DEMO_MODE.
    await svc.auth.admin.updateUserById(free.id, { app_metadata: { demo: true } });
    const form = new FormData();
    form.set("plan", "pro");
    await setDemoPlanAction(form);
    const { getPlanWith } = await import("@/server/auth");
    expect(await getPlanWith(free.client, free.id)).toBe("free");
    const { data: ent } = await svc.from("user_entitlements").select("plan, source").eq("user_id", free.id).maybeSingle();
    expect(ent?.plan ?? "free").toBe("free");
    await svc.auth.admin.updateUserById(free.id, { app_metadata: { demo: false } });
  });

  it("a plan claimed in cookies, the request body or the member's own metadata changes nothing", async () => {
    // user_metadata is the one place a member can write to themselves; the plan must never be read from it.
    const { error } = await free.client.auth.updateUser({ data: { plan: "pro", tier: "pro", subscription: "active" } });
    expect(error).toBeNull();
    const { data: session } = await free.client.auth.getSession();
    const { POST } = await import("@/app/api/ai/chat/route");
    const res = await POST(
      new NextRequest("http://localhost:3000/api/ai/chat", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.session!.access_token}`,
          "content-type": "application/json",
          cookie: "ngf.plan=pro; plan=pro; subscription=active",
        },
        body: JSON.stringify({ conversationId: null, message: "Plan my week", mode: "chat", plan: "pro", tier: "pro" }),
      }),
    );
    expect(res.status).toBe(403);
    const { getPlanWith } = await import("@/server/auth");
    expect(await getPlanWith(free.client, free.id)).toBe("free");
    expect(await count(svc, "ai_usage_events", "user_id", free.id)).toBe(0);
  });

  it("the same calls open once the server grants Pro, and close again when the grant expires", async () => {
    const { setStrengthStandardsAction } = await import("@/server/actions/body-map");
    const { setFoodFiltersAction } = await import("@/server/actions/food-quality");
    const { giveBodyScanConsentAction } = await import("@/server/actions/body-scan");
    const { setCoachMemoryEnabledAction } = await import("@/server/actions/coach-memory");
    await grantPlan(free, "pro");
    expect((await setStrengthStandardsAction("women")).ok).toBe(true);
    expect((await setFoodFiltersAction({ allergens: ["gluten"], diet: "vegan", nutrition: [] })).ok).toBe(true);
    expect((await giveBodyScanConsentAction(true)).ok).toBe(true);
    expect((await setCoachMemoryEnabledAction(true)).ok).toBe(true);
    const { data: profile } = await svc.from("profiles").select("strength_standards, body_scan_consent_at, coach_memory_enabled").eq("id", free.id).single();
    expect(profile?.strength_standards).toBe("women");
    expect(profile?.body_scan_consent_at).not.toBeNull();
    expect(profile?.coach_memory_enabled).toBe(true);
    // The grant lapses (as a cancelled subscription leaves it): Free again, without any client involvement.
    await svc.from("user_entitlements").update({ valid_until: new Date(Date.now() - 60_000).toISOString() }).eq("user_id", free.id);
    expect((await setStrengthStandardsAction("men")).ok).toBe(false);
    expect((await setCoachMemoryEnabledAction(true)).ok).toBe(false);
  });
});
