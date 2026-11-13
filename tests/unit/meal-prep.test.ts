import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "@/lib/domain/dates";
import { computeAmount, type FoodBasis } from "@/lib/domain/food-basis";
import {
  buildPrepPlan,
  entriesForWeek,
  FRIDGE_MAX_DAYS,
  parseFreezeParam,
  prepPlanText,
  recipeNutrition,
  scalePrepIngredient,
  splitDays,
  toggleFreeze,
  type PrepEntry,
  type PrepIngredient,
  type PrepRecipe,
} from "@/lib/domain/meal-prep";
import { formatNutrient, recipeTotals, scaleTotals } from "@/lib/domain/recipes";

// Week of Monday 2026-11-16 – Sunday 2026-11-22. "Today" is the Friday before, unless a test says otherwise.
const MON = "2026-11-16";
const SUN_BEFORE = "2026-11-15";
const TODAY = "2026-11-13";
const day = (i: number) => addDays(MON, i);

const rice: FoodBasis = { per100: { calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3, fiber_g: 0.4, sugar_g: 0.1, sodium_mg: 1 }, portions: [{ label: "1 cup", grams: 158 }] };
const chicken: FoodBasis = { per100: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, sugar_g: 0, sodium_mg: 74 } };

const ing = (name: string, basis: FoodBasis, quantity: number, unitId: string, unitLabel: string): PrepIngredient => ({
  name,
  basis,
  quantity,
  unitId,
  unitLabel,
  amountLabel: computeAmount(basis, quantity, unitId)!.amountLabel,
});

/** 200 g chicken + 2 cups rice, makes 2 servings. */
const chickenRice: PrepRecipe = {
  key: "recipe:00000000-0000-4000-8000-000000000001",
  name: "Chicken and rice",
  servings: 2,
  ingredients: [ing("Chicken breast", chicken, 200, "g", "g"), ing("White rice", rice, 2, "p0", "1 cup")],
};
const oats: PrepRecipe = { key: "app:overnight-oats", name: "Overnight oats", servings: 1, ingredients: [ing("Rice (stand-in)", rice, 1, "p0", "1 cup")] };
const recipes = new Map([chickenRice, oats].map((r) => [r.key, r]));

let n = 0;
function entry(date: string, key: string, opts: Partial<PrepEntry> = {}): PrepEntry {
  n++;
  return { id: `e${n}`, date, slot: 1, label: "Lunch", key, name: key === chickenRice.key ? chickenRice.name : key, portion: 1, logged: false, ...opts };
}
const everyDay = (key: string, opts: Partial<PrepEntry> = {}) => Array.from({ length: 7 }, (_, i) => entry(day(i), key, opts));

describe("grouping planned meals into batches", () => {
  it("one batch per recipe, with total servings and the meals it covers", () => {
    const entries = [
      entry(day(0), chickenRice.key, { slot: 1, label: "Lunch", portion: 1.5 }),
      entry(day(0), oats.key, { slot: 0, label: "Breakfast" }),
      entry(day(1), chickenRice.key, { slot: 2, label: "Dinner", portion: 1 }),
      entry(day(2), chickenRice.key, { slot: 1, label: "Lunch", portion: 0.75 }),
    ];
    const plan = buildPrepPlan(entries, recipes, { weekStart: MON, today: TODAY });
    expect(plan.batches.map((b) => b.key)).toEqual([oats.key, chickenRice.key]); // first meal first
    const cr = plan.batches.find((b) => b.key === chickenRice.key)!;
    expect(cr.totalServings).toBe(3.25);
    expect(cr.recipeServings).toBe(2);
    expect(cr.meals.map((m) => [m.date, m.label, m.portion])).toEqual([
      [day(0), "Lunch", 1.5],
      [day(1), "Dinner", 1],
      [day(2), "Lunch", 0.75],
    ]);
    expect(cr.origin).toBe("recipe");
    expect(plan.batches[0]!.origin).toBe("app");
    // Mon–Wed fits one prep day: Sunday.
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0]).toMatchObject({ prepDate: SUN_BEFORE, from: day(0), to: day(2) });
    expect(plan.sessions[0]!.cooks.map((c) => [c.name, c.servings])).toEqual([
      ["Overnight oats", 1],
      ["Chicken and rice", 3.25],
    ]);
  });

  it("orders meals within a day by their slot", () => {
    const plan = buildPrepPlan([entry(day(0), chickenRice.key, { slot: 2, label: "Dinner" }), entry(day(0), chickenRice.key, { slot: 1, label: "Lunch" })], recipes, { weekStart: MON });
    expect(plan.batches[0]!.meals.map((m) => m.label)).toEqual(["Lunch", "Dinner"]);
    expect(plan.batches[0]!.totalServings).toBe(2);
  });

  it("saved meals are listed as not batched, with their servings", () => {
    const meal = "meal:00000000-0000-4000-8000-0000000000aa";
    const plan = buildPrepPlan(
      [entry(day(0), meal, { name: "Yogurt bowl", portion: 1 }), entry(day(3), meal, { name: "Yogurt bowl", portion: 0.5 }), entry(day(1), chickenRice.key)],
      recipes,
      { weekStart: MON, today: TODAY },
    );
    expect(plan.notBatched).toEqual([{ key: meal, name: "Yogurt bowl", servings: 1.5, meals: [{ date: day(0), label: "Lunch", portion: 1 }, { date: day(3), label: "Lunch", portion: 0.5 }] }]);
    expect(plan.batches.map((b) => b.key)).toEqual([chickenRice.key]);
  });

  it("a week with only saved meals has no sessions", () => {
    const plan = buildPrepPlan([entry(day(0), "meal:00000000-0000-4000-8000-0000000000aa", { name: "Yogurt bowl" })], recipes, { weekStart: MON });
    expect(plan.batches).toEqual([]);
    expect(plan.sessions).toEqual([]);
    expect(plan.notBatched).toHaveLength(1);
  });
});

describe("scaled ingredient amounts", () => {
  it("scales the recipe's own amounts in their own units with scaleIngredient", () => {
    // 3 servings of a 2-serving recipe: × 1.5.
    const plan = buildPrepPlan([entry(day(0), chickenRice.key, { portion: 2 }), entry(day(1), chickenRice.key, { portion: 1 })], recipes, { weekStart: MON, today: TODAY });
    const cook = plan.batches[0]!.cooks[0]!;
    expect(cook.servings).toBe(3);
    expect(cook.factor).toBe(1.5);
    expect(cook.ingredients.map((i) => [i.name, i.quantity, i.amountLabel])).toEqual([
      ["Chicken breast", 300, "300 g"],
      ["White rice", 3, computeAmount(rice, 3, "p0")!.amountLabel],
    ]);
    expect(cook.ingredients[1]!.amountLabel).toBe("3 cup (474 g)");
    expect(cook.ingredients.every((i) => i.data === "complete")).toBe(true);
  });

  it("nutrition comes from the recipe's data, scaled to the cook", () => {
    const plan = buildPrepPlan([entry(day(0), chickenRice.key, { portion: 3 })], recipes, { weekStart: MON, today: TODAY });
    const b = plan.batches[0]!;
    const recipeTotal = recipeTotals(chickenRice.ingredients.map((i) => ({ basis: i.basis!, quantity: i.quantity, unitId: i.unitId! })));
    expect(b.cooks[0]!.totals).toEqual(scaleTotals(recipeTotal, 1.5));
    // 330 + 411 = 741 kcal for the recipe as written; 371 per serving.
    expect(recipeTotal.calories.value).toBe(741);
    expect(formatNutrient(b.perServing!.calories, "calories")).toBe("371 kcal");
    expect(formatNutrient(b.cooks[0]!.totals!.calories, "calories")).toBe("1,112 kcal");
  });

  it("a factor of 1 keeps the amount as written", () => {
    const plan = buildPrepPlan([entry(day(0), chickenRice.key, { portion: 2 })], recipes, { weekStart: MON });
    expect(plan.batches[0]!.cooks[0]!.ingredients.map((i) => i.amountLabel)).toEqual(chickenRice.ingredients.map((i) => i.amountLabel));
  });
});

describe("prep sessions and the 4-day refrigerator window", () => {
  it("splits the week into runs of at most 4 days, shorter run first", () => {
    expect(splitDays(day(0), day(6))).toEqual([
      { from: day(0), to: day(2) },
      { from: day(3), to: day(6) },
    ]);
    expect(splitDays(day(0), day(3))).toEqual([{ from: day(0), to: day(3) }]);
    expect(splitDays(day(0), day(4))).toEqual([
      { from: day(0), to: day(1) },
      { from: day(2), to: day(4) },
    ]);
    expect(splitDays(day(2), day(2))).toEqual([{ from: day(2), to: day(2) }]);
    expect(splitDays(day(3), day(2))).toEqual([]);
  });

  it("a recipe planned all 7 days becomes two sessions: Sunday for Mon–Wed, Wednesday for Thu–Sun", () => {
    const plan = buildPrepPlan(everyDay(chickenRice.key), recipes, { weekStart: MON, today: TODAY });
    expect(plan.sessions.map((s) => [s.prepDate, s.from, s.to])).toEqual([
      [SUN_BEFORE, day(0), day(2)],
      [day(2), day(3), day(6)],
    ]);
    const b = plan.batches[0]!;
    expect(b.totalServings).toBe(7);
    expect(b.cooks.map((c) => [c.sessionIndex, c.prepDate, c.servings])).toEqual([
      [0, SUN_BEFORE, 3],
      [1, day(2), 4],
    ]);
    expect(b.cooks[0]!.ingredients[0]!.amountLabel).toBe("300 g");
    expect(b.cooks[1]!.ingredients[0]!.amountLabel).toBe("400 g");
    expect(b.canFreeze).toBe(true);
    expect(b.frozen).toBe(false);
    for (const m of b.meals) {
      expect(m.daysAfterCooking).toBeGreaterThanOrEqual(1);
      expect(m.daysAfterCooking).toBeLessThanOrEqual(FRIDGE_MAX_DAYS);
      expect(m.storage).toBe("fridge");
    }
    // Sunday's last day (Sun after Wednesday's prep) is exactly 4 days out.
    expect(b.meals.at(-1)!.daysAfterCooking).toBe(4);
  });

  it("a batch that fits the first prep day's window is cooked once, even when the week has two prep days", () => {
    // Chicken and rice Mon and Thu (Thu is 4 days after Sunday); oats only on Sunday the 22nd.
    const plan = buildPrepPlan([entry(day(0), chickenRice.key), entry(day(3), chickenRice.key), entry(day(6), oats.key)], recipes, { weekStart: MON, today: TODAY });
    const cr = plan.batches.find((b) => b.key === chickenRice.key)!;
    expect(cr.cooks).toHaveLength(1);
    expect(cr.cooks[0]).toMatchObject({ prepDate: SUN_BEFORE, servings: 2 });
    expect(cr.canFreeze).toBe(false);
    const o = plan.batches.find((b) => b.key === oats.key)!;
    expect(o.cooks[0]!.prepDate).toBe(day(5)); // the day before Sunday the 22nd
    expect(plan.sessions.map((s) => s.prepDate)).toEqual([SUN_BEFORE, day(5)]);
  });

  it("drops a prep day nothing is cooked on", () => {
    // Mon and Thu only: one run of 4 days, one session.
    const plan = buildPrepPlan([entry(day(0), chickenRice.key), entry(day(3), chickenRice.key)], recipes, { weekStart: MON, today: TODAY });
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0]).toMatchObject({ index: 0, prepDate: SUN_BEFORE, from: day(0), to: day(3) });
  });

  it("never suggests a prep day before today, and leaves out past and logged meals", () => {
    // Today is Monday: Monday's meals are cooked today; Sunday before has passed.
    const entries = [entry(addDays(MON, -1), chickenRice.key), ...everyDay(chickenRice.key)];
    entries[1]!.logged = true; // Monday lunch already logged
    const plan = buildPrepPlan([...entries, entry(day(0), chickenRice.key, { slot: 2, label: "Dinner" })], recipes, { weekStart: MON, today: MON });
    expect(plan.skipped).toEqual({ logged: 1, past: 0 }); // the Sunday entry is outside the week
    expect(plan.sessions[0]!.prepDate).toBe(MON);
    expect(plan.batches[0]!.meals[0]).toMatchObject({ date: MON, label: "Dinner", daysAfterCooking: 0 });

    const midweek = buildPrepPlan(everyDay(chickenRice.key), recipes, { weekStart: MON, today: day(3) });
    expect(midweek.skipped).toEqual({ logged: 0, past: 3 });
    expect(midweek.batches[0]!.totalServings).toBe(4);
    expect(midweek.sessions.map((s) => s.prepDate)).toEqual([day(3)]);
  });

  it("no refrigerated portion is ever planned more than 4 days after its prep day", () => {
    // Every pattern of days a recipe can be planned on in a week (127), with two recipes and different todays.
    for (let mask = 1; mask < 128; mask++) {
      const entries: PrepEntry[] = [];
      for (let i = 0; i < 7; i++) {
        if (mask & (1 << i)) entries.push(entry(day(i), chickenRice.key));
        if (mask & (1 << (6 - i))) entries.push(entry(day(i), oats.key, { slot: 0, label: "Breakfast" }));
      }
      for (const today of [TODAY, MON, day(2)]) {
        const plan = buildPrepPlan(entries, recipes, { weekStart: MON, today });
        for (const b of plan.batches)
          for (const c of b.cooks) {
            expect(c.prepDate >= today).toBe(true);
            for (const m of c.meals) {
              expect(m.storage).toBe("fridge");
              expect(daysBetween(c.prepDate, m.date)).toBeLessThanOrEqual(FRIDGE_MAX_DAYS);
              expect(daysBetween(c.prepDate, m.date)).toBeGreaterThanOrEqual(0);
            }
          }
        for (const s of plan.sessions) expect(s.cooks.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("freezing portions", () => {
  it("a frozen batch is cooked once; portions more than 4 days out go in the freezer", () => {
    const plan = buildPrepPlan(everyDay(chickenRice.key), recipes, { weekStart: MON, today: TODAY, freeze: [chickenRice.key] });
    const b = plan.batches[0]!;
    expect(b.frozen).toBe(true);
    expect(b.canFreeze).toBe(true);
    expect(b.cooks).toHaveLength(1);
    expect(b.cooks[0]).toMatchObject({ prepDate: SUN_BEFORE, servings: 7, freezerServings: 3 });
    expect(b.cooks[0]!.ingredients[0]!.amountLabel).toBe("700 g");
    expect(b.meals.map((m) => m.storage)).toEqual(["fridge", "fridge", "fridge", "fridge", "freezer", "freezer", "freezer"]);
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0]!.cooks[0]).toMatchObject({ servings: 7, freezerServings: 3 });
  });

  it("freezing a batch that fits one cook changes nothing", () => {
    const entries = [entry(day(0), chickenRice.key), entry(day(1), chickenRice.key)];
    const plain = buildPrepPlan(entries, recipes, { weekStart: MON, today: TODAY });
    const frozen = buildPrepPlan(entries, recipes, { weekStart: MON, today: TODAY, freeze: [chickenRice.key] });
    expect(frozen).toEqual(plain);
    expect(frozen.batches[0]!.frozen).toBe(false);
  });

  it("only the chosen batch is frozen", () => {
    const plan = buildPrepPlan([...everyDay(chickenRice.key), ...everyDay(oats.key, { slot: 0, label: "Breakfast" })], recipes, { weekStart: MON, today: TODAY, freeze: [oats.key] });
    expect(plan.batches.find((b) => b.key === oats.key)!.cooks).toHaveLength(1);
    expect(plan.batches.find((b) => b.key === chickenRice.key)!.cooks).toHaveLength(2);
    expect(plan.sessions).toHaveLength(2);
  });

  it("reads and toggles the freeze parameter", () => {
    expect(parseFreezeParam("recipe:00000000-0000-4000-8000-000000000001,app:overnight-oats,bad key,meal:x,app:overnight-oats")).toEqual([
      "recipe:00000000-0000-4000-8000-000000000001",
      "app:overnight-oats",
    ]);
    expect(parseFreezeParam(undefined)).toEqual([]);
    expect(parseFreezeParam(["app:a", "app:b"])).toEqual(["app:a", "app:b"]);
    expect(toggleFreeze(["app:a"], "app:b")).toEqual(["app:a", "app:b"]);
    expect(toggleFreeze(["app:a", "app:b"], "app:a")).toEqual(["app:b"]);
  });
});

describe("ingredients without data", () => {
  const noData: PrepIngredient = { name: "Grandma's spice mix", basis: null, quantity: 1, unitId: null, unitLabel: "tbsp", amountLabel: "1 tbsp" };
  const noProtein: FoodBasis = { per100: { calories: 400, protein_g: 0, carbs_g: 60, fat_g: 10, fiber_g: null, sugar_g: null, sodium_mg: null }, missing: ["protein_g"] };
  const stew: PrepRecipe = {
    key: "recipe:00000000-0000-4000-8000-000000000002",
    name: "Stew",
    servings: 4,
    ingredients: [ing("Chicken breast", chicken, 400, "g", "g"), noData, ing("Mystery crackers", noProtein, 50, "g", "g")],
  };

  it("an ingredient with no data is scaled from the amount as written and flagged", () => {
    const s = scalePrepIngredient(noData, 2);
    expect(s).toEqual({ name: "Grandma's spice mix", quantity: 2, amountLabel: "2 tbsp", data: "none", missing: [] });
    expect(scalePrepIngredient(noData, 1).amountLabel).toBe("1 tbsp");
  });

  it("an amount in a unit the food doesn't have is flagged, not shown with the unscaled label", () => {
    const bad: PrepIngredient = { name: "Rice", basis: rice, quantity: 2, unitId: "p9", unitLabel: "1 bowl", amountLabel: "2 bowl" };
    expect(scalePrepIngredient(bad, 1.5)).toMatchObject({ quantity: 3, amountLabel: "3 bowl", data: "none" });
  });

  it("macros the source doesn't list are named", () => {
    expect(scalePrepIngredient(stew.ingredients[2]!, 2)).toMatchObject({ amountLabel: "100 g", data: "partial", missing: ["protein_g"] });
  });

  it("totals with a missing ingredient read 'at least', never counting it as zero", () => {
    const totals = recipeNutrition(stew);
    expect(totals.calories.known).toBe(2);
    expect(totals.calories.total).toBe(3);
    const plan = buildPrepPlan([entry(day(0), stew.key, { name: "Stew", portion: 2 })], new Map([[stew.key, stew]]), { weekStart: MON, today: TODAY });
    const cook = plan.batches[0]!.cooks[0]!;
    expect(cook.ingredients.map((i) => i.data)).toEqual(["complete", "none", "partial"]);
    expect(cook.ingredients.map((i) => i.amountLabel)).toEqual(["200 g", "0.5 tbsp", "25 g"]);
    expect(formatNutrient(cook.totals!.calories, "calories")).toMatch(/^at least /);
    expect(formatNutrient(cook.totals!.protein_g, "protein_g")).toMatch(/^at least /);
  });

  it("a recipe that no longer exists keeps its servings but shows no amounts", () => {
    const gone = "recipe:00000000-0000-4000-8000-0000000000ff";
    const plan = buildPrepPlan([entry(day(0), gone, { name: "Old chili", portion: 1.5 })], recipes, { weekStart: MON, today: TODAY });
    expect(plan.batches[0]).toMatchObject({ name: "Old chili", missingRecipe: true, recipeServings: null, totalServings: 1.5, perServing: null });
    expect(plan.batches[0]!.cooks[0]).toMatchObject({ servings: 1.5, ingredients: [], totals: null });
  });
});

describe("an empty week", () => {
  it("has no batches, sessions or skipped meals", () => {
    const plan = buildPrepPlan([], recipes, { weekStart: MON, today: TODAY });
    expect(plan).toEqual({ weekStart: MON, weekEnd: day(6), batches: [], sessions: [], notBatched: [], skipped: { logged: 0, past: 0 } });
    expect(prepPlanText(plan)).toContain("No recipes to prep this week.");
  });

  it("ignores meals outside the week", () => {
    const plan = buildPrepPlan([entry(addDays(MON, -1), chickenRice.key), entry(day(7), chickenRice.key)], recipes, { weekStart: MON, today: TODAY });
    expect(plan.batches).toEqual([]);
    expect(plan.skipped).toEqual({ logged: 0, past: 0 });
  });
});

describe("planned meals for the week across plans", () => {
  it("takes each day from the plan covering it, the later plan winning an overlap", () => {
    const a = { start_date: addDays(MON, -3), days: 7, entries: [entry(day(0), "app:a"), entry(day(1), "app:a"), entry(day(3), "app:a")] };
    const b = { start_date: day(1), days: 7, entries: [entry(day(1), "app:b"), entry(day(5), "app:b"), entry(day(9), "app:b")] };
    const got = entriesForWeek([a, b], MON);
    expect(got.map((e) => [e.date, e.key])).toEqual([
      [day(0), "app:a"],
      [day(1), "app:b"],
      [day(5), "app:b"],
    ]);
    expect(entriesForWeek([], MON)).toEqual([]);
  });
});

describe("share text", () => {
  it("lists each session's cooks and their amounts, and the food-safety source", () => {
    const text = prepPlanText(buildPrepPlan(everyDay(chickenRice.key), recipes, { weekStart: MON, today: TODAY, freeze: [] }));
    expect(text).toContain("Prep plan · Mon, Nov 16 – Sun, Nov 22");
    expect(text).toContain("Sun, Nov 15 prep · for Mon, Nov 16 – Wed, Nov 18");
    expect(text).toContain("• Chicken and rice: 3 servings");
    expect(text).toContain("   - Chicken breast: 300 g");
    expect(text).toContain("Wed, Nov 18 prep · for Thu, Nov 19 – Sun, Nov 22");
    expect(text).toContain("   - Chicken breast: 400 g");
    expect(text).toContain("FoodSafety.gov");
    const frozen = prepPlanText(buildPrepPlan(everyDay(chickenRice.key), recipes, { weekStart: MON, today: TODAY, freeze: [chickenRice.key] }));
    expect(frozen).toContain("• Chicken and rice: 7 servings (freeze 3 servings)");
  });
});
