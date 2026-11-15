import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/lib/domain/dates";
import { getNutritionDaily } from "@/server/services/progress";
import { createTestUser, deleteTestUser, stackAvailable, type TestUser } from "./helpers";

const available = await stackAvailable();

/**
 * Audit 2026-11-14: the API returns at most 1,000 rows per request (supabase/config.toml max_rows). A member who logs
 * 12 foods a day passes that in under three months, so the 90-day and 1-year nutrition charts silently lost rows and
 * understated whichever days they belonged to.
 */
describe.skipIf(!available)("daily nutrition totals over a long range (more than 1,000 logged foods)", () => {
  let user: TestUser;
  const DAYS = 90;
  const PER_DAY = 13; // 1,170 rows in all
  const end = "2026-10-31";
  const start = addDays(end, -(DAYS - 1));

  beforeAll(async () => {
    user = await createTestUser("nutri-paging");
    const dates = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
    const { data: meals, error } = await user.client
      .from("meals")
      .insert(dates.map((d) => ({ user_id: user.id, eaten_on: d, meal_type: "lunch" })))
      .select("id, eaten_on");
    if (error) throw error;
    const rows = (meals ?? []).flatMap((m) =>
      // Every food: 100 kcal, 10 g protein, 5.5 g carbs, 2.1 g fat. A day is 1,300 kcal, 130 g, 71.5 g, 27.3 g.
      Array.from({ length: PER_DAY }, (_, n) => ({ meal_id: m.id as string, user_id: user.id, name: `Food ${n + 1}`, servings: 1, calories: 100, protein_g: 10, carbs_g: 5.5, fat_g: 2.1 })),
    );
    for (let i = 0; i < rows.length; i += 400) {
      const { error: iErr } = await user.client.from("meal_items").insert(rows.slice(i, i + 400));
      if (iErr) throw iErr;
    }
  }, 120_000);

  afterAll(async () => {
    await deleteTestUser(user);
  });

  it("every day keeps its full total", async () => {
    const days = await getNutritionDaily(user.client, user.id, start, end);
    expect(days).toHaveLength(DAYS);
    const wrong = days.filter((d) => d.calories !== 1300 || d.protein !== 130 || d.carbs !== 72 || d.fat !== 27);
    expect(wrong).toEqual([]);
    expect(days.reduce((s, d) => s + d.calories, 0)).toBe(DAYS * 1300);
  });

  it("a short range inside it is unchanged", async () => {
    const days = await getNutritionDaily(user.client, user.id, addDays(end, -6), end);
    expect(days.map((d) => d.calories)).toEqual(Array(7).fill(1300));
  });
});
